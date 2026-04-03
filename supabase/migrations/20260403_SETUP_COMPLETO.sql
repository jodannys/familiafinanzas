-- =====================================================================
-- SETUP COMPLETO — Familia Finanzas
-- Fecha: 2026-04-03
--
-- Ejecutar este archivo ÚNICO en el SQL Editor de Supabase.
-- Es idempotente: seguro de re-ejecutar si algo falla a mitad.
--
-- Consolida y reemplaza:
--   - 20260402_rls_policies.sql          (estaba en ROLLBACK)
--   - 20260403_hogares_rls_familiar.sql  (estaba en ROLLBACK)
--   - 20260403_invitaciones_rpc.sql      (funciones llamaban a mi_rol() inexistente)
--   - 20260403_patch_get_movimientos.sql (mismo problema)
--
-- Orden de ejecución:
--   1. Tablas nuevas (hogares, perfiles, invitaciones)
--   2. Columnas nuevas en tablas existentes
--   3. Funciones auxiliares RLS  ← EL FIX CRÍTICO
--   4. Backfill de datos
--   5. Triggers
--   6. RLS + políticas
--   7. RPCs (todas re-creadas correctamente)
--   8. Grants
-- =====================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. TABLAS NUEVAS
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.hogares (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_hogar text        NOT NULL DEFAULT 'Mi Familia',
  plan_tipo    text        NOT NULL DEFAULT 'free' CHECK (plan_tipo IN ('free','premium')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.perfiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hogar_id   uuid        NOT NULL REFERENCES public.hogares(id) ON DELETE CASCADE,
  nombre     text        NOT NULL DEFAULT '',
  rol        text        NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin','miembro')),
  permisos   jsonb       NOT NULL DEFAULT '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":false,"reportes":false}'::jsonb,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_hogar ON public.perfiles(hogar_id);

CREATE TABLE IF NOT EXISTS public.invitaciones (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id           uuid        NOT NULL REFERENCES public.hogares(id) ON DELETE CASCADE,
  email              text        NOT NULL,
  rol_asignado       text        NOT NULL DEFAULT 'miembro' CHECK (rol_asignado IN ('admin','miembro')),
  permisos_asignados jsonb       NOT NULL DEFAULT '{}'::jsonb,
  token              uuid        NOT NULL DEFAULT gen_random_uuid(),
  aceptada           boolean     NOT NULL DEFAULT false,
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON public.invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_invitaciones_email  ON public.invitaciones(email);


-- ═══════════════════════════════════════════════════════════════════
-- 2. COLUMNAS NUEVAS EN TABLAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════════

-- presupuesto_items: cat_id puede faltar si la tabla es anterior al schema
ALTER TABLE public.presupuesto_items
  ADD COLUMN IF NOT EXISTS cat_id uuid REFERENCES public.presupuesto_cats(id) ON DELETE CASCADE;

-- Tablas financieras: hogar_id + creado_por
DO $cols$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'movimientos','deudas','deuda_movimientos','metas','inversiones',
    'sobre_movimientos','presupuesto_bloques','presupuesto_sub',
    'presupuesto_cats','categorias','perfiles_tarjetas',
    'perfiles_familia','agenda_notas'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS hogar_id uuid REFERENCES public.hogares(id) ON DELETE CASCADE', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL', tbl);
  END LOOP;
END $cols$;

-- inmuebles: viene de su propio migration, añadir hogar_id si existe la tabla
DO $inm$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inmuebles') THEN
    EXECUTE 'ALTER TABLE public.inmuebles ADD COLUMN IF NOT EXISTS hogar_id uuid REFERENCES public.hogares(id) ON DELETE CASCADE';
    EXECUTE 'ALTER TABLE public.inmuebles ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL';
  END IF;
END $inm$;

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_movimientos_hogar       ON public.movimientos(hogar_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_creado_por  ON public.movimientos(creado_por);
CREATE INDEX IF NOT EXISTS idx_deudas_hogar            ON public.deudas(hogar_id);
CREATE INDEX IF NOT EXISTS idx_metas_hogar             ON public.metas(hogar_id);
CREATE INDEX IF NOT EXISTS idx_inversiones_hogar       ON public.inversiones(hogar_id);
CREATE INDEX IF NOT EXISTS idx_agenda_hogar            ON public.agenda_notas(hogar_id);
CREATE INDEX IF NOT EXISTS idx_categorias_hogar        ON public.categorias(hogar_id);


-- ═══════════════════════════════════════════════════════════════════
-- 3. FUNCIONES AUXILIARES RLS  ← EL FIX CRÍTICO
--    Deben existir ANTES que cualquier función que las llame.
--    SECURITY DEFINER evita recursión RLS al leer 'perfiles'.
--    STABLE permite que Postgres cachee el resultado por query.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mi_hogar_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT hogar_id FROM public.perfiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.tengo_permiso(modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT CASE
    WHEN rol = 'admin' THEN true
    ELSE COALESCE((permisos ->> modulo)::boolean, false)
  END
  FROM public.perfiles WHERE id = auth.uid()
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 4. BACKFILL — migrar datos existentes al modelo hogar
--    Por cada usuario en auth.users:
--      a) Crear su hogar si no tiene perfil todavía
--      b) Asignar hogar_id + creado_por a todos sus registros
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user   RECORD;
  v_hogar  uuid;
BEGIN
  FOR v_user IN SELECT id, email FROM auth.users LOOP

    IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = v_user.id) THEN
      INSERT INTO public.hogares (nombre_hogar)
      VALUES ('Familia ' || split_part(v_user.email, '@', 1))
      RETURNING id INTO v_hogar;

      INSERT INTO public.perfiles (id, hogar_id, nombre, rol)
      VALUES (
        v_user.id,
        v_hogar,
        split_part(v_user.email, '@', 1),
        'admin'
      );
    ELSE
      SELECT hogar_id INTO v_hogar FROM public.perfiles WHERE id = v_user.id;
    END IF;

    -- Actualizar tablas financieras
    UPDATE public.movimientos       SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.deudas            SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.metas             SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.inversiones       SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.sobre_movimientos SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.presupuesto_bloques SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.presupuesto_sub   SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.presupuesto_cats  SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.categorias        SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.perfiles_tarjetas SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.perfiles_familia  SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;
    UPDATE public.agenda_notas      SET hogar_id=v_hogar, creado_por=v_user.id WHERE user_id=v_user.id AND hogar_id IS NULL;

    UPDATE public.deuda_movimientos dm
    SET hogar_id=v_hogar, creado_por=v_user.id
    FROM public.deudas d
    WHERE dm.deuda_id=d.id AND d.user_id=v_user.id AND dm.hogar_id IS NULL;

    -- inmuebles si existe
    EXECUTE format(
      'UPDATE public.inmuebles SET hogar_id=$1, creado_por=$2 WHERE user_id=$3 AND hogar_id IS NULL'
    ) USING v_hogar, v_user.id, v_user.id;

  END LOOP;
  RAISE NOTICE 'Backfill completado.';
EXCEPTION WHEN undefined_table THEN
  RAISE NOTICE 'Tabla inmuebles no encontrada, ignorando.';
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 5. TRIGGERS
-- ═══════════════════════════════════════════════════════════════════

-- 5a. Auto-crear hogar + perfil en cada nuevo registro
CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_hogar uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = NEW.id) THEN
    INSERT INTO public.hogares (nombre_hogar)
    VALUES ('Familia ' || split_part(NEW.email, '@', 1))
    RETURNING id INTO v_hogar;

    INSERT INTO public.perfiles (id, hogar_id, nombre, rol)
    VALUES (
      NEW.id, v_hogar,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'admin'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();

-- 5b. Auto-rellenar hogar_id + creado_por en cada INSERT financiero
CREATE OR REPLACE FUNCTION public.set_hogar_y_creador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.hogar_id  IS NULL THEN NEW.hogar_id  := public.mi_hogar_id(); END IF;
  IF NEW.creado_por IS NULL THEN NEW.creado_por := auth.uid();          END IF;
  RETURN NEW;
END;
$$;

DO $trg$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'movimientos','deudas','deuda_movimientos','metas','inversiones',
    'sobre_movimientos','presupuesto_bloques','presupuesto_sub',
    'presupuesto_cats','categorias','perfiles_tarjetas',
    'perfiles_familia','agenda_notas'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_hogar_y_creador ON public.%I', tbl);
    EXECUTE format(
      'CREATE TRIGGER set_hogar_y_creador BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_hogar_y_creador()', tbl
    );
  END LOOP;
END $trg$;


-- ═══════════════════════════════════════════════════════════════════
-- 6. RLS
-- ═══════════════════════════════════════════════════════════════════

-- Borrar TODAS las políticas anteriores para empezar limpio
DO $drop$ DECLARE pol RECORD; BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $drop$;

-- Activar RLS
DO $rls$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'hogares','perfiles','invitaciones',
    'movimientos','deudas','deuda_movimientos','metas','inversiones',
    'sobre_movimientos','presupuesto_bloques','presupuesto_sub',
    'presupuesto_cats','presupuesto_items','categorias','subcategorias',
    'perfiles_tarjetas','perfiles_familia','agenda_notas'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $rls$;

-- ── hogares ─────────────────────────────────────────────────────────
CREATE POLICY "hogares_select" ON public.hogares
  FOR SELECT USING (id = public.mi_hogar_id());
CREATE POLICY "hogares_update" ON public.hogares
  FOR UPDATE USING (id = public.mi_hogar_id() AND public.mi_rol() = 'admin')
  WITH CHECK   (id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

-- ── perfiles ─────────────────────────────────────────────────────────
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT USING (hogar_id = public.mi_hogar_id());
CREATE POLICY "perfiles_insert" ON public.perfiles
  FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "perfiles_update" ON public.perfiles
  FOR UPDATE USING (hogar_id = public.mi_hogar_id() AND (id = auth.uid() OR public.mi_rol() = 'admin'));

-- ── invitaciones (solo admin) ────────────────────────────────────────
CREATE POLICY "invitaciones_all" ON public.invitaciones
  FOR ALL USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin')
  WITH CHECK   (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

-- ── movimientos ──────────────────────────────────────────────────────
CREATE POLICY "movimientos_select" ON public.movimientos FOR SELECT USING (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('gastos')
  AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "movimientos_insert" ON public.movimientos FOR INSERT WITH CHECK (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('gastos'));
CREATE POLICY "movimientos_update" ON public.movimientos FOR UPDATE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "movimientos_delete" ON public.movimientos FOR DELETE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));

-- ── deudas ───────────────────────────────────────────────────────────
CREATE POLICY "deudas_select" ON public.deudas FOR SELECT USING (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('deudas')
  AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "deudas_insert" ON public.deudas FOR INSERT WITH CHECK (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('deudas'));
CREATE POLICY "deudas_update" ON public.deudas FOR UPDATE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "deudas_delete" ON public.deudas FOR DELETE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));

-- ── deuda_movimientos ────────────────────────────────────────────────
CREATE POLICY "deuda_mov_select" ON public.deuda_movimientos FOR SELECT USING (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('deudas')
  AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "deuda_mov_insert" ON public.deuda_movimientos FOR INSERT WITH CHECK (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('deudas'));
CREATE POLICY "deuda_mov_update" ON public.deuda_movimientos FOR UPDATE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "deuda_mov_delete" ON public.deuda_movimientos FOR DELETE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));

-- ── metas ────────────────────────────────────────────────────────────
CREATE POLICY "metas_select" ON public.metas FOR SELECT USING (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('metas')
  AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "metas_insert" ON public.metas FOR INSERT WITH CHECK (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('metas'));
CREATE POLICY "metas_update" ON public.metas FOR UPDATE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "metas_delete" ON public.metas FOR DELETE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));

-- ── inversiones ──────────────────────────────────────────────────────
CREATE POLICY "inversiones_select" ON public.inversiones FOR SELECT USING (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('inversiones')
  AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "inversiones_insert" ON public.inversiones FOR INSERT WITH CHECK (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('inversiones'));
CREATE POLICY "inversiones_update" ON public.inversiones FOR UPDATE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "inversiones_delete" ON public.inversiones FOR DELETE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));

-- ── sobre_movimientos ────────────────────────────────────────────────
CREATE POLICY "sobre_mov_select" ON public.sobre_movimientos FOR SELECT USING (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('gastos')
  AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "sobre_mov_insert" ON public.sobre_movimientos FOR INSERT WITH CHECK (
  hogar_id = public.mi_hogar_id() AND public.tengo_permiso('gastos'));
CREATE POLICY "sobre_mov_update" ON public.sobre_movimientos FOR UPDATE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));
CREATE POLICY "sobre_mov_delete" ON public.sobre_movimientos FOR DELETE USING (
  hogar_id = public.mi_hogar_id() AND (public.mi_rol() = 'admin' OR creado_por = auth.uid()));

-- ── presupuesto (solo admin puede editar, todos pueden leer) ─────────
CREATE POLICY "pres_bloques_select" ON public.presupuesto_bloques FOR SELECT USING (hogar_id=public.mi_hogar_id() AND public.tengo_permiso('presupuesto'));
CREATE POLICY "pres_bloques_write"  ON public.presupuesto_bloques FOR ALL   USING (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin') WITH CHECK (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin');
CREATE POLICY "pres_sub_select"     ON public.presupuesto_sub     FOR SELECT USING (hogar_id=public.mi_hogar_id() AND public.tengo_permiso('presupuesto'));
CREATE POLICY "pres_sub_write"      ON public.presupuesto_sub     FOR ALL   USING (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin') WITH CHECK (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin');
CREATE POLICY "pres_cats_select"    ON public.presupuesto_cats    FOR SELECT USING (hogar_id=public.mi_hogar_id() AND public.tengo_permiso('presupuesto'));
CREATE POLICY "pres_cats_write"     ON public.presupuesto_cats    FOR ALL   USING (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin') WITH CHECK (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin');

CREATE POLICY "pres_items_select" ON public.presupuesto_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.presupuesto_cats pc WHERE pc.id=cat_id AND pc.hogar_id=public.mi_hogar_id() AND public.tengo_permiso('presupuesto')));
CREATE POLICY "pres_items_write"  ON public.presupuesto_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.presupuesto_cats pc WHERE pc.id=cat_id AND pc.hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin'))
  WITH CHECK (
  EXISTS (SELECT 1 FROM public.presupuesto_cats pc WHERE pc.id=cat_id AND pc.hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin'));

-- ── categorias / subcategorias ───────────────────────────────────────
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT USING (hogar_id=public.mi_hogar_id());
CREATE POLICY "categorias_write"  ON public.categorias FOR ALL   USING (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin') WITH CHECK (hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin');

CREATE POLICY "subcats_select" ON public.subcategorias FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.categorias c WHERE c.id=categoria_id AND c.hogar_id=public.mi_hogar_id()));
CREATE POLICY "subcats_write"  ON public.subcategorias FOR ALL USING (
  EXISTS (SELECT 1 FROM public.categorias c WHERE c.id=categoria_id AND c.hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin'))
  WITH CHECK (
  EXISTS (SELECT 1 FROM public.categorias c WHERE c.id=categoria_id AND c.hogar_id=public.mi_hogar_id() AND public.mi_rol()='admin'));

-- ── perfiles_tarjetas ────────────────────────────────────────────────
CREATE POLICY "tarjetas_select" ON public.perfiles_tarjetas FOR SELECT USING (
  hogar_id=public.mi_hogar_id() AND public.tengo_permiso('deudas')
  AND (public.mi_rol()='admin' OR creado_por=auth.uid()));
CREATE POLICY "tarjetas_write" ON public.perfiles_tarjetas FOR ALL USING (
  hogar_id=public.mi_hogar_id() AND (public.mi_rol()='admin' OR creado_por=auth.uid()))
  WITH CHECK (hogar_id=public.mi_hogar_id());

-- ── perfiles_familia ─────────────────────────────────────────────────
CREATE POLICY "pf_select" ON public.perfiles_familia FOR SELECT USING (hogar_id=public.mi_hogar_id());
CREATE POLICY "pf_write"  ON public.perfiles_familia FOR ALL   USING (hogar_id=public.mi_hogar_id()) WITH CHECK (hogar_id=public.mi_hogar_id());

-- ── agenda_notas ─────────────────────────────────────────────────────
CREATE POLICY "agenda_select" ON public.agenda_notas FOR SELECT USING (
  hogar_id=public.mi_hogar_id() AND public.tengo_permiso('agenda')
  AND (public.mi_rol()='admin' OR creado_por=auth.uid()));
CREATE POLICY "agenda_insert" ON public.agenda_notas FOR INSERT WITH CHECK (
  hogar_id=public.mi_hogar_id() AND public.tengo_permiso('agenda'));
CREATE POLICY "agenda_update" ON public.agenda_notas FOR UPDATE USING (
  hogar_id=public.mi_hogar_id() AND (public.mi_rol()='admin' OR creado_por=auth.uid()));
CREATE POLICY "agenda_delete" ON public.agenda_notas FOR DELETE USING (
  hogar_id=public.mi_hogar_id() AND (public.mi_rol()='admin' OR creado_por=auth.uid()));


-- ═══════════════════════════════════════════════════════════════════
-- 7. RPCs — todas re-creadas con la lógica correcta
-- ═══════════════════════════════════════════════════════════════════

-- 7a. validar_token_invitacion (público, sin sesión)
CREATE OR REPLACE FUNCTION public.validar_token_invitacion(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_inv invitaciones%ROWTYPE; v_hogar hogares%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.invitaciones WHERE token=p_token;
  IF NOT FOUND  THEN RETURN jsonb_build_object('valida',false,'error','Token no existe'); END IF;
  IF v_inv.aceptada THEN RETURN jsonb_build_object('valida',false,'error','Invitación ya usada'); END IF;
  IF v_inv.expires_at < now() THEN RETURN jsonb_build_object('valida',false,'error','Invitación expirada'); END IF;
  SELECT * INTO v_hogar FROM public.hogares WHERE id=v_inv.hogar_id;
  RETURN jsonb_build_object(
    'valida',true,'email',v_inv.email,'rol_asignado',v_inv.rol_asignado,
    'permisos_asignados',v_inv.permisos_asignados,'hogar_id',v_inv.hogar_id,
    'nombre_hogar',v_hogar.nombre_hogar,'expires_at',v_inv.expires_at);
END;
$$;

-- 7b. inicializar_hogar (registro nuevo sin token)
CREATE OR REPLACE FUNCTION public.inicializar_hogar(p_nombre text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_hogar_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id=auth.uid()) THEN
    SELECT hogar_id INTO v_hogar_id FROM public.perfiles WHERE id=auth.uid();
    RETURN jsonb_build_object('ok',true,'hogar_id',v_hogar_id,'ya_existia',true);
  END IF;
  INSERT INTO public.hogares (nombre_hogar) VALUES ('Mi Familia') RETURNING id INTO v_hogar_id;
  INSERT INTO public.perfiles (id,hogar_id,nombre,rol,permisos)
  VALUES (auth.uid(),v_hogar_id,p_nombre,'admin',
    '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":true,"reportes":true}'::jsonb);
  RETURN jsonb_build_object('ok',true,'hogar_id',v_hogar_id,'ya_existia',false);
END;
$$;

-- 7c. aceptar_invitacion (post-registro con token)
CREATE OR REPLACE FUNCTION public.aceptar_invitacion(p_token uuid, p_nombre text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_inv invitaciones%ROWTYPE; v_email text; v_permisos jsonb;
BEGIN
  SELECT * INTO v_inv FROM public.invitaciones WHERE token=p_token AND NOT aceptada AND expires_at>now();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','Invitación inválida o expirada'); END IF;
  SELECT email INTO v_email FROM auth.users WHERE id=auth.uid();
  IF lower(trim(v_email)) != lower(trim(v_inv.email)) THEN
    RETURN jsonb_build_object('ok',false,'error','Este link no corresponde a tu correo');
  END IF;
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id=auth.uid()) THEN
    RETURN jsonb_build_object('ok',false,'error','Ya tienes un perfil activo');
  END IF;
  v_permisos := CASE
    WHEN v_inv.permisos_asignados='{}'::jsonb OR v_inv.permisos_asignados IS NULL
    THEN '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":false,"reportes":false}'::jsonb
    ELSE v_inv.permisos_asignados END;
  INSERT INTO public.perfiles (id,hogar_id,nombre,rol,permisos)
  VALUES (auth.uid(),v_inv.hogar_id,p_nombre,v_inv.rol_asignado,v_permisos);
  UPDATE public.invitaciones SET aceptada=true WHERE token=p_token;
  RETURN jsonb_build_object('ok',true,'hogar_id',v_inv.hogar_id,'rol',v_inv.rol_asignado);
END;
$$;

-- 7d. get_mis_permisos
CREATE OR REPLACE FUNCTION public.get_mis_permisos()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT jsonb_build_object('rol',rol,'permisos',permisos,'hogar_id',hogar_id,'nombre',nombre)
  FROM public.perfiles WHERE id=auth.uid()
$$;

-- 7e. crear_invitacion (solo admin)
CREATE OR REPLACE FUNCTION public.crear_invitacion(
  p_email    text,
  p_rol      text  DEFAULT 'miembro',
  p_permisos jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE v_hogar_id uuid; v_token uuid;
BEGIN
  IF public.mi_rol() != 'admin' THEN RAISE EXCEPTION 'Solo el admin puede crear invitaciones'; END IF;
  IF p_rol NOT IN ('admin','miembro') THEN RAISE EXCEPTION 'rol debe ser admin o miembro'; END IF;
  v_hogar_id := public.mi_hogar_id();
  INSERT INTO public.invitaciones (hogar_id,email,rol_asignado,permisos_asignados)
  VALUES (v_hogar_id,lower(trim(p_email)),p_rol,p_permisos)
  ON CONFLICT (hogar_id,email) DO UPDATE
    SET token=gen_random_uuid(), aceptada=false,
        expires_at=now()+interval '7 days',
        rol_asignado=EXCLUDED.rol_asignado,
        permisos_asignados=EXCLUDED.permisos_asignados
  RETURNING token INTO v_token;
  RETURN jsonb_build_object('ok',true,'token',v_token,'link','/login?token='||v_token::text);
END;
$$;

-- 7f. get_movimientos_por_usuario (admin filtra por miembro)
DROP FUNCTION IF EXISTS public.get_movimientos_por_usuario(uuid,date,date,text,text,integer);
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
  IF public.mi_rol() != 'admin' THEN
    RAISE EXCEPTION 'Solo el admin puede filtrar movimientos por usuario';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id=p_user_id AND hogar_id=public.mi_hogar_id()) THEN
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
  WHERE m.hogar_id   = public.mi_hogar_id()
    AND m.creado_por  = p_user_id
    AND (p_desde      IS NULL OR m.fecha >= p_desde)
    AND (p_hasta      IS NULL OR m.fecha <= p_hasta)
    AND (p_categoria  IS NULL OR m.categoria = p_categoria)
    AND (p_tipo       IS NULL OR m.tipo = p_tipo)
  ORDER BY m.fecha DESC
  LIMIT p_limite;
END;
$$;

-- 7g. registrar_movimiento — actualizado para incluir hogar_id/creado_por
--     (el trigger set_hogar_y_creador lo rellena automáticamente,
--      pero lo dejamos explícito por claridad)
CREATE OR REPLACE FUNCTION public.registrar_movimiento(
  p_tipo            text,
  p_monto           numeric,
  p_descripcion     text,
  p_categoria       text,
  p_fecha           date,
  p_quien           text,
  p_metodo_pago     text DEFAULT 'efectivo',
  p_meta_id         uuid DEFAULT NULL,
  p_inversion_id    uuid DEFAULT NULL,
  p_deuda_id        uuid DEFAULT NULL,
  p_subcategoria_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_hogar_id uuid := public.mi_hogar_id();
  v_mov_id   uuid;
  v_dm_id    uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF v_hogar_id IS NULL THEN RAISE EXCEPTION 'Sin hogar asignado. Completa el registro.'; END IF;

  INSERT INTO public.movimientos
    (user_id, hogar_id, creado_por, tipo, monto, descripcion, categoria,
     fecha, quien, metodo_pago, meta_id, inversion_id, deuda_id, subcategoria_id)
  VALUES
    (v_user_id, v_hogar_id, v_user_id, p_tipo, p_monto, p_descripcion, p_categoria,
     p_fecha, p_quien, p_metodo_pago, p_meta_id, p_inversion_id, p_deuda_id, p_subcategoria_id)
  RETURNING id INTO v_mov_id;

  IF p_meta_id IS NOT NULL AND p_tipo='egreso' THEN
    UPDATE public.metas SET actual=actual+p_monto WHERE id=p_meta_id AND hogar_id=v_hogar_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Meta no encontrada: %', p_meta_id; END IF;
  END IF;

  IF p_inversion_id IS NOT NULL AND p_tipo='egreso' THEN
    UPDATE public.inversiones SET capital=capital+p_monto WHERE id=p_inversion_id AND hogar_id=v_hogar_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inversión no encontrada: %', p_inversion_id; END IF;
  END IF;

  IF p_deuda_id IS NOT NULL AND p_tipo='egreso' THEN
    INSERT INTO public.deuda_movimientos (deuda_id, hogar_id, creado_por, tipo, descripcion, monto, fecha, mes, año)
    VALUES (p_deuda_id, v_hogar_id, v_user_id, 'pago', p_descripcion, p_monto, p_fecha,
            EXTRACT(MONTH FROM p_fecha)::int, EXTRACT(YEAR FROM p_fecha)::int)
    RETURNING id INTO v_dm_id;

    UPDATE public.movimientos SET deuda_movimiento_id=v_dm_id WHERE id=v_mov_id;

    UPDATE public.deudas
    SET pendiente = GREATEST(0, pendiente-p_monto),
        pagadas   = COALESCE(pagadas,0)+1,
        estado    = CASE WHEN GREATEST(0, pendiente-p_monto)=0 THEN 'pagada' ELSE estado END
    WHERE id=p_deuda_id AND hogar_id=v_hogar_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Deuda no encontrada: %', p_deuda_id; END IF;
  END IF;

  RETURN jsonb_build_object('ok',true,'mov_id',v_mov_id,'dm_id',v_dm_id);
END;
$$;

-- 7h. revertir_movimiento
CREATE OR REPLACE FUNCTION public.revertir_movimiento(p_mov_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_user_id uuid := auth.uid(); v_mov RECORD;
BEGIN
  SELECT * INTO v_mov FROM public.movimientos
  WHERE id=p_mov_id AND (user_id=v_user_id OR public.mi_rol()='admin');
  IF NOT FOUND THEN RAISE EXCEPTION 'Movimiento no encontrado o sin permisos: %', p_mov_id; END IF;

  IF v_mov.meta_id IS NOT NULL AND v_mov.tipo='egreso' THEN
    UPDATE public.metas SET actual=GREATEST(0,actual-v_mov.monto) WHERE id=v_mov.meta_id;
  END IF;
  IF v_mov.inversion_id IS NOT NULL AND v_mov.tipo='egreso' THEN
    UPDATE public.inversiones SET capital=GREATEST(0,capital-v_mov.monto) WHERE id=v_mov.inversion_id;
  END IF;
  IF v_mov.deuda_id IS NOT NULL AND v_mov.tipo='egreso' THEN
    UPDATE public.deudas SET pendiente=pendiente+v_mov.monto, pagadas=GREATEST(0,COALESCE(pagadas,0)-1), estado='activa'
    WHERE id=v_mov.deuda_id;
  END IF;

  DELETE FROM public.movimientos WHERE id=p_mov_id;
  IF v_mov.deuda_movimiento_id IS NOT NULL THEN
    DELETE FROM public.deuda_movimientos WHERE id=v_mov.deuda_movimiento_id;
  END IF;

  RETURN jsonb_build_object('ok',true);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- 8. GRANTS
-- ═══════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.mi_hogar_id()                                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.mi_rol()                                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.tengo_permiso(text)                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_mis_permisos()                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.crear_invitacion(text,text,jsonb)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceptar_invitacion(uuid,text)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.inicializar_hogar(text)                                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_movimientos_por_usuario(uuid,date,date,text,text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento(text,numeric,text,text,date,text,text,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revertir_movimiento(uuid)                                  TO authenticated;
-- validar_token_invitacion es pública (anon también la necesita)
GRANT EXECUTE ON FUNCTION public.validar_token_invitacion(uuid)                             TO authenticated, anon;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN RÁPIDA (ejecutar después del COMMIT)
-- ─────────────────────────────────────────────────────────────────
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY 1;
-- SELECT tablename, count(*) FROM pg_policies WHERE schemaname='public' GROUP BY 1 ORDER BY 1;
-- SELECT h.nombre_hogar, p.nombre, p.rol FROM public.hogares h JOIN public.perfiles p ON p.hogar_id=h.id;
-- ═══════════════════════════════════════════════════════════════════

COMMIT;
