-- =====================================================================
-- MIGRACIÓN: Eliminar sistema de roles y permisos granulares
-- Fecha: 2026-04-04
--
-- Decisión de diseño: todos los miembros de un hogar son iguales.
-- Acceso completo a todos los módulos sin distinción de rol.
--
-- Cambios:
--   1. Tablas: eliminar columnas rol/permisos/rol_asignado/permisos_asignados
--   2. Funciones eliminadas: mi_rol(), tengo_permiso(text)
--   3. Funciones reescritas: get_mis_permisos(), inicializar_hogar(),
--      aceptar_invitacion(), crear_invitacion(), validar_token_invitacion(),
--      get_movimientos_por_usuario(), revertir_movimiento(),
--      on_auth_user_created()
--   4. Políticas RLS: reemplazadas — solo chequean hogar_id = mi_hogar_id()
--
-- Idempotente: usa IF EXISTS / CREATE OR REPLACE donde aplique.
-- =====================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 0. ELIMINAR TODAS LAS POLÍTICAS PRIMERO
--    (deben caer antes que las funciones de las que dependen)
-- ═══════════════════════════════════════════════════════════════════
DO $drop_pol$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $drop_pol$;


-- ═══════════════════════════════════════════════════════════════════
-- 1. ELIMINAR COLUMNAS DE ROLES Y PERMISOS
-- ═══════════════════════════════════════════════════════════════════

-- perfiles: quitar rol y permisos
ALTER TABLE public.perfiles
  DROP COLUMN IF EXISTS rol,
  DROP COLUMN IF EXISTS permisos;

-- invitaciones: quitar rol_asignado y permisos_asignados
ALTER TABLE public.invitaciones
  DROP COLUMN IF EXISTS rol_asignado,
  DROP COLUMN IF EXISTS permisos_asignados;


-- ═══════════════════════════════════════════════════════════════════
-- 2. FUNCIONES OBSOLETAS
--    mi_rol() SE CONSERVA como stub (retorna 'miembro' siempre)
--    para uso futuro en filtros de gastos por miembro.
--    tengo_permiso() SÍ se elimina (ya no hay permisos granulares).
-- ═══════════════════════════════════════════════════════════════════

-- mi_rol(): stub — todos son 'miembro', se reutilizará cuando se
-- implemente el filtrado de gastos por integrante de la familia.
CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT 'miembro'::text
$$;

DROP FUNCTION IF EXISTS public.tengo_permiso(text);


-- ═══════════════════════════════════════════════════════════════════
-- 3. REESCRIBIR FUNCIONES QUE USABAN ROL/PERMISOS
-- ═══════════════════════════════════════════════════════════════════

-- 3a. get_mis_permisos — ahora solo retorna hogar_id, nombre, nombre_hogar
CREATE OR REPLACE FUNCTION public.get_mis_permisos()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT jsonb_build_object(
    'hogar_id',     p.hogar_id,
    'nombre',       p.nombre,
    'nombre_hogar', h.nombre_hogar
  )
  FROM public.perfiles p
  JOIN public.hogares  h ON h.id = p.hogar_id
  WHERE p.id = auth.uid()
$$;

-- 3b. inicializar_hogar — sin asignación de rol ni permisos
CREATE OR REPLACE FUNCTION public.inicializar_hogar(p_nombre text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_hogar_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid()) THEN
    SELECT hogar_id INTO v_hogar_id FROM public.perfiles WHERE id = auth.uid();
    RETURN jsonb_build_object('ok', true, 'hogar_id', v_hogar_id, 'ya_existia', true);
  END IF;

  INSERT INTO public.hogares (nombre_hogar) VALUES ('Mi Familia') RETURNING id INTO v_hogar_id;

  INSERT INTO public.perfiles (id, hogar_id, nombre)
  VALUES (auth.uid(), v_hogar_id, p_nombre);

  RETURN jsonb_build_object('ok', true, 'hogar_id', v_hogar_id, 'ya_existia', false);
END;
$$;

-- 3c. aceptar_invitacion — sin lógica de rol ni permisos al crear perfil
CREATE OR REPLACE FUNCTION public.aceptar_invitacion(p_token uuid, p_nombre text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_inv   invitaciones%ROWTYPE;
  v_email text;
BEGIN
  SELECT * INTO v_inv
  FROM public.invitaciones
  WHERE token = p_token AND NOT aceptada AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitación inválida o expirada');
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF lower(trim(v_email)) != lower(trim(v_inv.email)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Este link no corresponde a tu correo');
  END IF;

  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ya tienes un perfil activo');
  END IF;

  INSERT INTO public.perfiles (id, hogar_id, nombre)
  VALUES (auth.uid(), v_inv.hogar_id, p_nombre);

  UPDATE public.invitaciones SET aceptada = true WHERE token = p_token;

  RETURN jsonb_build_object('ok', true, 'hogar_id', v_inv.hogar_id);
END;
$$;

-- 3d. crear_invitacion — firma simplificada, cualquier miembro del hogar puede invitar
DROP FUNCTION IF EXISTS public.crear_invitacion(text, text, jsonb);

CREATE OR REPLACE FUNCTION public.crear_invitacion(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_hogar_id uuid;
  v_token    uuid;
BEGIN
  v_hogar_id := public.mi_hogar_id();

  IF v_hogar_id IS NULL THEN
    RAISE EXCEPTION 'No tienes un hogar asignado';
  END IF;

  INSERT INTO public.invitaciones (hogar_id, email)
  VALUES (v_hogar_id, lower(trim(p_email)))
  ON CONFLICT (hogar_id, email) DO UPDATE
    SET token      = gen_random_uuid(),
        aceptada   = false,
        expires_at = now() + interval '7 days'
  RETURNING token INTO v_token;

  RETURN jsonb_build_object('ok', true, 'token', v_token, 'link', '/login?token=' || v_token::text);
END;
$$;

-- 3e. validar_token_invitacion — sin campos de rol/permisos en el resultado
CREATE OR REPLACE FUNCTION public.validar_token_invitacion(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_inv   invitaciones%ROWTYPE;
  v_hogar hogares%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.invitaciones WHERE token = p_token;
  IF NOT FOUND    THEN RETURN jsonb_build_object('valida', false, 'error', 'Token no existe');        END IF;
  IF v_inv.aceptada THEN RETURN jsonb_build_object('valida', false, 'error', 'Invitación ya usada'); END IF;
  IF v_inv.expires_at < now() THEN RETURN jsonb_build_object('valida', false, 'error', 'Invitación expirada'); END IF;

  SELECT * INTO v_hogar FROM public.hogares WHERE id = v_inv.hogar_id;

  RETURN jsonb_build_object(
    'valida',       true,
    'email',        v_inv.email,
    'hogar_id',     v_inv.hogar_id,
    'nombre_hogar', v_hogar.nombre_hogar,
    'expires_at',   v_inv.expires_at
  );
END;
$$;

-- 3f. get_movimientos_por_usuario — cualquier miembro del hogar puede filtrar por otro miembro
DROP FUNCTION IF EXISTS public.get_movimientos_por_usuario(uuid, date, date, text, text, integer);

CREATE FUNCTION public.get_movimientos_por_usuario(
  p_user_id   uuid,
  p_desde     date    DEFAULT NULL,
  p_hasta     date    DEFAULT NULL,
  p_categoria text    DEFAULT NULL,
  p_tipo      text    DEFAULT NULL,
  p_limite    integer DEFAULT 200
)
RETURNS TABLE (
  id              uuid,
  hogar_id        uuid,
  creado_por      uuid,
  fecha           date,
  tipo            text,
  categoria       text,
  subcategoria    text,
  subcategoria_id uuid,
  descripcion     text,
  monto           numeric,
  quien           text,
  meta_id         uuid,
  inversion_id    uuid,
  deuda_id        uuid,
  created_at      timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Verificar que el usuario destino pertenece al mismo hogar
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = p_user_id AND hogar_id = public.mi_hogar_id()
  ) THEN
    RAISE EXCEPTION 'El usuario no pertenece a tu hogar';
  END IF;

  RETURN QUERY
  SELECT
    m.id, m.hogar_id, m.creado_por,
    m.fecha, m.tipo, m.categoria,
    sc.nombre        AS subcategoria,
    m.subcategoria_id,
    m.descripcion, m.monto, m.quien,
    m.meta_id, m.inversion_id, m.deuda_id, m.created_at
  FROM public.movimientos m
  LEFT JOIN public.subcategorias sc ON sc.id = m.subcategoria_id
  WHERE m.hogar_id    = public.mi_hogar_id()
    AND m.creado_por  = p_user_id
    AND (p_desde      IS NULL OR m.fecha >= p_desde)
    AND (p_hasta      IS NULL OR m.fecha <= p_hasta)
    AND (p_categoria  IS NULL OR m.categoria = p_categoria)
    AND (p_tipo       IS NULL OR m.tipo = p_tipo)
  ORDER BY m.fecha DESC
  LIMIT p_limite;
END;
$$;

-- 3g. revertir_movimiento — cualquier miembro del hogar puede revertir (no solo creador o admin)
CREATE OR REPLACE FUNCTION public.revertir_movimiento(p_mov_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_mov RECORD;
BEGIN
  SELECT * INTO v_mov
  FROM public.movimientos
  WHERE id = p_mov_id AND hogar_id = public.mi_hogar_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento no encontrado o no pertenece a tu hogar: %', p_mov_id;
  END IF;

  IF v_mov.meta_id IS NOT NULL AND v_mov.tipo = 'egreso' THEN
    UPDATE public.metas SET actual = GREATEST(0, actual - v_mov.monto) WHERE id = v_mov.meta_id;
  END IF;

  IF v_mov.inversion_id IS NOT NULL AND v_mov.tipo = 'egreso' THEN
    UPDATE public.inversiones SET capital = GREATEST(0, capital - v_mov.monto) WHERE id = v_mov.inversion_id;
  END IF;

  IF v_mov.deuda_id IS NOT NULL AND v_mov.tipo = 'egreso' THEN
    UPDATE public.deudas
    SET pendiente = pendiente + v_mov.monto,
        pagadas   = GREATEST(0, COALESCE(pagadas, 0) - 1),
        estado    = 'activa'
    WHERE id = v_mov.deuda_id;
  END IF;

  DELETE FROM public.movimientos WHERE id = p_mov_id;

  IF v_mov.deuda_movimiento_id IS NOT NULL THEN
    DELETE FROM public.deuda_movimientos WHERE id = v_mov.deuda_movimiento_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3h. on_auth_user_created — sin asignación de rol ni permisos
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_hogar        uuid;
  v_nombre       text;
  v_nombre_hogar text;
BEGIN
  -- Ya tiene perfil: no hacer nada
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Es usuario invitado: aceptar_invitacion creará el perfil
  IF EXISTS (
    SELECT 1 FROM public.invitaciones
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND NOT aceptada
      AND expires_at > now()
  ) THEN
    RETURN NEW;
  END IF;

  -- Solo auto-crear si el usuario registró 'nombre' explícitamente (email, no OAuth)
  v_nombre := NEW.raw_user_meta_data->>'nombre';

  IF v_nombre IS NULL OR trim(v_nombre) = '' THEN
    RETURN NEW;
  END IF;

  v_nombre_hogar := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nombre_hogar'), ''),
    'Mi Familia'
  );

  INSERT INTO public.hogares (nombre_hogar) VALUES (v_nombre_hogar) RETURNING id INTO v_hogar;

  INSERT INTO public.perfiles (id, hogar_id, nombre)
  VALUES (NEW.id, v_hogar, trim(v_nombre));

  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 4. RLS — REESCRIBIR TODAS LAS POLÍTICAS
--    Regla única: hogar_id = public.mi_hogar_id()
--    Sin restricciones por rol. Sin restricciones por creado_por.
-- ═══════════════════════════════════════════════════════════════════

-- ── hogares ──────────────────────────────────────────────────────────
CREATE POLICY "hogares_select" ON public.hogares
  FOR SELECT USING (id = public.mi_hogar_id());

CREATE POLICY "hogares_update" ON public.hogares
  FOR UPDATE USING (id = public.mi_hogar_id())
  WITH CHECK   (id = public.mi_hogar_id());

-- ── perfiles ─────────────────────────────────────────────────────────
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT USING (hogar_id = public.mi_hogar_id());

CREATE POLICY "perfiles_insert" ON public.perfiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "perfiles_update" ON public.perfiles
  FOR UPDATE USING (hogar_id = public.mi_hogar_id())
  WITH CHECK   (hogar_id = public.mi_hogar_id());

-- ── invitaciones ─────────────────────────────────────────────────────
-- Cualquier miembro del hogar puede ver, crear y gestionar invitaciones
CREATE POLICY "invitaciones_all" ON public.invitaciones
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── movimientos ──────────────────────────────────────────────────────
CREATE POLICY "movimientos_all" ON public.movimientos
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── deudas ───────────────────────────────────────────────────────────
CREATE POLICY "deudas_all" ON public.deudas
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── deuda_movimientos ────────────────────────────────────────────────
CREATE POLICY "deuda_mov_all" ON public.deuda_movimientos
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── metas ────────────────────────────────────────────────────────────
CREATE POLICY "metas_all" ON public.metas
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── inversiones ──────────────────────────────────────────────────────
CREATE POLICY "inversiones_all" ON public.inversiones
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── sobre_movimientos ────────────────────────────────────────────────
CREATE POLICY "sobre_mov_all" ON public.sobre_movimientos
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── presupuesto ──────────────────────────────────────────────────────
CREATE POLICY "pres_bloques_all" ON public.presupuesto_bloques
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

CREATE POLICY "pres_sub_all" ON public.presupuesto_sub
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

CREATE POLICY "pres_cats_all" ON public.presupuesto_cats
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- presupuesto_items: no tiene hogar_id directo, se navega por cat_id
CREATE POLICY "pres_items_all" ON public.presupuesto_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.presupuesto_cats pc
      WHERE pc.id = cat_id AND pc.hogar_id = public.mi_hogar_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.presupuesto_cats pc
      WHERE pc.id = cat_id AND pc.hogar_id = public.mi_hogar_id()
    )
  );

-- ── categorias ───────────────────────────────────────────────────────
CREATE POLICY "categorias_all" ON public.categorias
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- subcategorias: navega por categoria_id
CREATE POLICY "subcats_all" ON public.subcategorias
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.categorias c
      WHERE c.id = categoria_id AND c.hogar_id = public.mi_hogar_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.categorias c
      WHERE c.id = categoria_id AND c.hogar_id = public.mi_hogar_id()
    )
  );

-- ── perfiles_tarjetas ────────────────────────────────────────────────
CREATE POLICY "tarjetas_all" ON public.perfiles_tarjetas
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── perfiles_familia ─────────────────────────────────────────────────
CREATE POLICY "pf_all" ON public.perfiles_familia
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── agenda_notas ─────────────────────────────────────────────────────
CREATE POLICY "agenda_all" ON public.agenda_notas
  FOR ALL USING    (hogar_id = public.mi_hogar_id())
  WITH CHECK       (hogar_id = public.mi_hogar_id());

-- ── inmuebles (si existe la tabla) ───────────────────────────────────
DO $inm_rls$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'inmuebles'
  ) THEN
    EXECUTE 'ALTER TABLE public.inmuebles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "inmuebles_all" ON public.inmuebles';
    EXECUTE $pol$
      CREATE POLICY "inmuebles_all" ON public.inmuebles
        FOR ALL USING    (hogar_id = public.mi_hogar_id())
        WITH CHECK       (hogar_id = public.mi_hogar_id())
    $pol$;
  END IF;
END $inm_rls$;


-- ═══════════════════════════════════════════════════════════════════
-- 5. GRANTS — actualizar lista de funciones
-- ═══════════════════════════════════════════════════════════════════

-- Grants nuevos/actualizados
GRANT EXECUTE ON FUNCTION public.mi_rol()                                                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.mi_hogar_id()                                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mis_permisos()                                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_invitacion(text)                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_invitacion(uuid, text)                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.inicializar_hogar(text)                                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_movimientos_por_usuario(uuid, date, date, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento(text, numeric, text, text, date, text, text, uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revertir_movimiento(uuid)                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_token_invitacion(uuid)                                TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.registrar_deuda_movimiento(uuid, text, numeric, text, date, integer, integer) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN RÁPIDA (ejecutar después del COMMIT)
-- ═══════════════════════════════════════════════════════════════════
-- Confirmar que rol y permisos ya no existen:
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='perfiles'
--   ORDER BY ordinal_position;
--
-- Confirmar que las funciones eliminadas ya no existen:
--   SELECT proname FROM pg_proc
--   JOIN pg_namespace ON pg_namespace.oid=pg_proc.pronamespace
--   WHERE nspname='public' AND proname IN ('mi_rol','tengo_permiso');
--
-- Confirmar políticas activas:
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname='public' ORDER BY tablename, policyname;
--
-- Probar acceso completo de un miembro:
--   SELECT public.get_mis_permisos();
-- ═══════════════════════════════════════════════════════════════════

COMMIT;
