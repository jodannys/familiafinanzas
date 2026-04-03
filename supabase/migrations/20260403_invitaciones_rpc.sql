-- =====================================================================
-- MIGRACIÓN: RPCs de Invitaciones, Permisos y Filtro Admin
-- Fecha: 2026-04-03
-- PREREQUISITO: 20260403_hogares_rls_familiar.sql ejecutado primero.
--
-- Contiene:
--   1. validar_token_invitacion  → público (sin auth) para pre-registro
--   2. inicializar_hogar         → crea hogar+perfil admin para registro nuevo
--   3. aceptar_invitacion        → vincula nuevo usuario a hogar existente
--   4. get_mis_permisos          → devuelve permisos completos del usuario
--   5. crear_invitacion          → admin crea link de invitación
--   6. get_movimientos_por_usuario → filtro admin por user_id
-- =====================================================================

BEGIN;


-- ═══════════════════════════════════════════════════════════════════
-- 1. VALIDAR TOKEN (público, sin sesión requerida)
--    Permite mostrar info de la invitación antes de registrarse.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.validar_token_invitacion(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv  invitaciones%ROWTYPE;
  v_hogar hogares%ROWTYPE;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitaciones
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valida', false, 'error', 'Token no existe');
  END IF;

  IF v_inv.aceptada THEN
    RETURN jsonb_build_object('valida', false, 'error', 'Invitación ya usada');
  END IF;

  IF v_inv.expires_at < now() THEN
    RETURN jsonb_build_object('valida', false, 'error', 'Invitación expirada');
  END IF;

  SELECT * INTO v_hogar FROM public.hogares WHERE id = v_inv.hogar_id;

  RETURN jsonb_build_object(
    'valida',             true,
    'email',              v_inv.email,
    'rol_asignado',       v_inv.rol_asignado,
    'permisos_asignados', v_inv.permisos_asignados,
    'hogar_id',           v_inv.hogar_id,
    'nombre_hogar',       v_hogar.nombre_hogar,
    'expires_at',         v_inv.expires_at
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 2. INICIALIZAR HOGAR (para registro sin token — nuevo admin)
--    Crea hogar + perfil admin para el usuario recién registrado.
--    SECURITY DEFINER: evita que RLS bloquee el INSERT en perfiles/hogares.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.inicializar_hogar(p_nombre text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hogar_id uuid;
BEGIN
  -- Idempotente: si ya tiene perfil, no hacer nada
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid()) THEN
    SELECT hogar_id INTO v_hogar_id FROM public.perfiles WHERE id = auth.uid();
    RETURN jsonb_build_object('ok', true, 'hogar_id', v_hogar_id, 'ya_existia', true);
  END IF;

  -- Crear hogar
  INSERT INTO public.hogares (nombre_hogar, plan_tipo)
  VALUES ('Mi Familia', 'free')
  RETURNING id INTO v_hogar_id;

  -- Crear perfil como admin con todos los permisos
  INSERT INTO public.perfiles (id, hogar_id, nombre, rol, permisos)
  VALUES (
    auth.uid(),
    v_hogar_id,
    p_nombre,
    'admin',
    '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":true,"reportes":true}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'hogar_id', v_hogar_id, 'ya_existia', false);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 3. ACEPTAR INVITACIÓN (post-registro con token)
--    Vincula el usuario autenticado al hogar de la invitación.
--    Valida que el email coincida con el del token.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.aceptar_invitacion(p_token uuid, p_nombre text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv      invitaciones%ROWTYPE;
  v_email    text;
  v_permisos jsonb;
BEGIN
  -- Buscar invitación válida
  SELECT * INTO v_inv
  FROM public.invitaciones
  WHERE token = p_token
    AND NOT aceptada
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitación inválida o expirada');
  END IF;

  -- Verificar que el email del usuario coincide con el de la invitación
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF lower(trim(v_email)) != lower(trim(v_inv.email)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este link de invitación no corresponde a tu correo');
  END IF;

  -- Si ya tiene perfil (raro pero posible), abortamos
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya tienes un perfil activo');
  END IF;

  -- Resolver permisos finales (si permisos_asignados está vacío, usar defaults de miembro)
  v_permisos := CASE
    WHEN v_inv.permisos_asignados = '{}'::jsonb OR v_inv.permisos_asignados IS NULL
    THEN '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":false,"reportes":false}'::jsonb
    ELSE v_inv.permisos_asignados
  END;

  -- Crear perfil en el hogar de la invitación
  INSERT INTO public.perfiles (id, hogar_id, nombre, rol, permisos)
  VALUES (auth.uid(), v_inv.hogar_id, p_nombre, v_inv.rol_asignado, v_permisos);

  -- Marcar invitación como aceptada
  UPDATE public.invitaciones SET aceptada = true WHERE token = p_token;

  RETURN jsonb_build_object(
    'ok',       true,
    'hogar_id', v_inv.hogar_id,
    'rol',      v_inv.rol_asignado
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 4. GET_MIS_PERMISOS
--    Devuelve rol + permisos + hogar_id del usuario autenticado.
--    Usar en el frontend para mostrar/ocultar módulos.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_mis_permisos()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'rol',      rol,
    'permisos', permisos,
    'hogar_id', hogar_id,
    'nombre',   nombre
  )
  FROM public.perfiles
  WHERE id = auth.uid()
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 5. CREAR INVITACIÓN (solo admin)
--    Genera o renueva el link de invitación para un email dado.
--    Devuelve el token y el link listo para enviar.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.crear_invitacion(
  p_email    text,
  p_rol      text    DEFAULT 'miembro',
  p_permisos jsonb   DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hogar_id uuid;
  v_token    uuid;
BEGIN
  IF public.mi_rol() != 'admin' THEN
    RAISE EXCEPTION 'Solo el admin puede crear invitaciones';
  END IF;

  IF p_rol NOT IN ('admin', 'miembro') THEN
    RAISE EXCEPTION 'rol debe ser admin o miembro';
  END IF;

  v_hogar_id := public.mi_hogar_id();

  -- Upsert: renovar si ya existe una invitación para ese email en el mismo hogar
  INSERT INTO public.invitaciones (hogar_id, email, rol_asignado, permisos_asignados)
  VALUES (v_hogar_id, lower(trim(p_email)), p_rol, p_permisos)
  ON CONFLICT (hogar_id, email) DO UPDATE
    SET token              = gen_random_uuid(),
        aceptada           = false,
        expires_at         = now() + interval '7 days',
        rol_asignado       = EXCLUDED.rol_asignado,
        permisos_asignados = EXCLUDED.permisos_asignados
  RETURNING token INTO v_token;

  RETURN jsonb_build_object(
    'ok',    true,
    'token', v_token,
    'link',  '/login?token=' || v_token::text
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 6. GET_MOVIMIENTOS_POR_USUARIO (filtro admin)
--    El admin puede ver los movimientos de cualquier miembro de su hogar.
--    Los miembros solo ven sus propios movimientos (controlado por RLS).
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_movimientos_por_usuario(
  p_user_id   uuid,
  p_desde     date    DEFAULT NULL,
  p_hasta     date    DEFAULT NULL,
  p_categoria text    DEFAULT NULL,
  p_tipo      text    DEFAULT NULL,   -- 'ingreso' | 'egreso' | 'retiro'
  p_limite    integer DEFAULT 200
)
RETURNS TABLE (
  id           uuid,
  hogar_id     uuid,
  creado_por   uuid,
  user_id      uuid,
  fecha        date,
  tipo         text,
  categoria    text,
  subcategoria text,
  descripcion  text,
  monto        numeric,
  quien        text,
  meta_id      uuid,
  inversion_id uuid,
  deuda_id     uuid,
  created_at   timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo admin puede usar este filtro
  IF public.mi_rol() != 'admin' THEN
    RAISE EXCEPTION 'Solo el admin puede filtrar movimientos por usuario';
  END IF;

  -- Validar que el usuario objetivo pertenece al mismo hogar
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = p_user_id AND hogar_id = public.mi_hogar_id()
  ) THEN
    RAISE EXCEPTION 'El usuario no pertenece a tu hogar';
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.hogar_id, m.creado_por, m.user_id,
    m.fecha, m.tipo, m.categoria, m.subcategoria,
    m.descripcion, m.monto, m.quien,
    m.meta_id, m.inversion_id, m.deuda_id,
    m.created_at
  FROM public.movimientos m
  WHERE m.hogar_id  = public.mi_hogar_id()
    AND m.creado_por = p_user_id
    AND (p_desde     IS NULL OR m.fecha >= p_desde)
    AND (p_hasta     IS NULL OR m.fecha <= p_hasta)
    AND (p_categoria IS NULL OR m.categoria = p_categoria)
    AND (p_tipo      IS NULL OR m.tipo = p_tipo)
  ORDER BY m.fecha DESC
  LIMIT p_limite;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- POLÍTICA ADICIONAL: permitir leer invitación por token sin sesión
-- (necesario para validar el token antes del registro)
-- ═══════════════════════════════════════════════════════════════════

-- La función validar_token_invitacion usa SECURITY DEFINER,
-- así que no necesita política extra. Pero si se quiere exponer
-- la tabla directamente al anon, se puede añadir:
-- CREATE POLICY "inv_anon_token" ON public.invitaciones
--   FOR SELECT USING (true);
-- Por ahora usamos solo la función RPC.


COMMIT;
