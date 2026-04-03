-- =====================================================================
-- MIGRACIÓN: Modelo Familiar Multi-Hogar + RLS Jerárquico
-- Fecha: 2026-04-03
-- Ejecutar en Supabase SQL Editor
--
-- PREREQUISITO: Haber ejecutado 00000000_schema_inicial.sql primero.
-- NOTA: El archivo 20260402_rls_policies.sql terminaba en ROLLBACK,
--       por lo que las políticas RLS anteriores NO están activas.
--       Este script las crea desde cero (usa DROP POLICY IF EXISTS).
--
-- INSTRUCCIONES:
--   1. Ejecuta TODO el script.
--   2. Verifica con las queries al final del archivo.
--   3. Cambia ROLLBACK → COMMIT cuando estés conforme.
-- =====================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 0: LIMPIAR políticas RLS previas (del script que quedó en ROLLBACK)
--           Safe de ejecutar aunque no existan.
-- ═══════════════════════════════════════════════════════════════════

DO $$ DECLARE pol RECORD; BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 1: TABLA HOGARES
--           Entidad raíz. Todos los datos cuelgan de aquí.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.hogares (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_hogar text        NOT NULL DEFAULT 'Mi Familia',
  plan_tipo    text        NOT NULL DEFAULT 'free' CHECK (plan_tipo IN ('free','premium')),
  created_at   timestamptz NOT NULL DEFAULT now()
);


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 2: TABLA PERFILES
--           Extensión de auth.users. Un usuario → un perfil → un hogar.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.perfiles (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hogar_id   uuid        NOT NULL REFERENCES public.hogares(id) ON DELETE CASCADE,
  nombre     text        NOT NULL DEFAULT '',
  rol        text        NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin','miembro')),
  permisos   jsonb       NOT NULL DEFAULT '{
    "gastos":true,"presupuesto":true,"metas":true,
    "inversiones":true,"deudas":true,"agenda":true,
    "hipoteca":false,"reportes":false
  }'::jsonb,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perfiles_hogar ON public.perfiles(hogar_id);


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 3: TABLA INVITACIONES
--           Flujo de onboarding para añadir miembros al hogar.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.invitaciones (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  hogar_id            uuid        NOT NULL REFERENCES public.hogares(id) ON DELETE CASCADE,
  email               text        NOT NULL,
  rol_asignado        text        NOT NULL DEFAULT 'miembro' CHECK (rol_asignado IN ('admin','miembro')),
  permisos_asignados  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  token               uuid        NOT NULL DEFAULT gen_random_uuid(),
  aceptada            boolean     NOT NULL DEFAULT false,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hogar_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON public.invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_invitaciones_email  ON public.invitaciones(email);


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 4: AÑADIR hogar_id + creado_por A TABLAS FINANCIERAS
--
-- hogar_id  → aisla datos por familia
-- creado_por → rastrea quién registró cada movimiento
-- ═══════════════════════════════════════════════════════════════════

-- movimientos
ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- deudas
ALTER TABLE public.deudas
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- deuda_movimientos (tabla hija, añadir hogar_id para RLS directo sin JOIN)
ALTER TABLE public.deuda_movimientos
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- metas
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- inversiones
ALTER TABLE public.inversiones
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- sobre_movimientos
ALTER TABLE public.sobre_movimientos
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- presupuesto_bloques
ALTER TABLE public.presupuesto_bloques
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- presupuesto_sub
ALTER TABLE public.presupuesto_sub
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- presupuesto_cats
ALTER TABLE public.presupuesto_cats
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- presupuesto_items: garantizar que cat_id existe antes de usarla en RLS
ALTER TABLE public.presupuesto_items
  ADD COLUMN IF NOT EXISTS cat_id uuid REFERENCES public.presupuesto_cats(id) ON DELETE CASCADE;

-- categorias
ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- perfiles_tarjetas
ALTER TABLE public.perfiles_tarjetas
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- perfiles_familia
ALTER TABLE public.perfiles_familia
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- agenda_notas
ALTER TABLE public.agenda_notas
  ADD COLUMN IF NOT EXISTS hogar_id   uuid REFERENCES public.hogares(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES auth.users(id)     ON DELETE SET NULL;

-- Índices de rendimiento para las nuevas columnas
CREATE INDEX IF NOT EXISTS idx_movimientos_hogar         ON public.movimientos(hogar_id);
CREATE INDEX IF NOT EXISTS idx_deudas_hogar              ON public.deudas(hogar_id);
CREATE INDEX IF NOT EXISTS idx_metas_hogar               ON public.metas(hogar_id);
CREATE INDEX IF NOT EXISTS idx_inversiones_hogar         ON public.inversiones(hogar_id);
CREATE INDEX IF NOT EXISTS idx_sobre_movimientos_hogar   ON public.sobre_movimientos(hogar_id);
CREATE INDEX IF NOT EXISTS idx_categorias_hogar          ON public.categorias(hogar_id);
CREATE INDEX IF NOT EXISTS idx_agenda_notas_hogar        ON public.agenda_notas(hogar_id);


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 5: BACKFILL — migrar datos existentes al modelo nuevo
--
-- Para cada usuario existente:
--   1. Crea un hogar automáticamente.
--   2. Crea su perfil como 'admin' del hogar.
--   3. Asigna hogar_id y creado_por a todos sus registros.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_user    RECORD;
  v_hogar   uuid;
BEGIN
  FOR v_user IN SELECT id, email FROM auth.users LOOP

    -- Solo crear hogar si el usuario aún no tiene perfil
    IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = v_user.id) THEN

      -- Crear hogar
      INSERT INTO public.hogares (nombre_hogar, plan_tipo)
      VALUES ('Familia ' || split_part(v_user.email, '@', 1), 'free')
      RETURNING id INTO v_hogar;

      -- Crear perfil admin
      INSERT INTO public.perfiles (id, hogar_id, nombre, rol)
      VALUES (
        v_user.id,
        v_hogar,
        split_part(v_user.email, '@', 1),
        'admin'
      );

      RAISE NOTICE 'Hogar creado para usuario %: hogar_id=%', v_user.email, v_hogar;
    ELSE
      SELECT hogar_id INTO v_hogar FROM public.perfiles WHERE id = v_user.id;
    END IF;

    -- Actualizar todas las tablas financieras donde el user_id coincide
    UPDATE public.movimientos        SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.deudas             SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.metas              SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.inversiones        SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.sobre_movimientos  SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.presupuesto_bloques SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.presupuesto_sub    SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.presupuesto_cats   SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.categorias         SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.perfiles_tarjetas  SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.perfiles_familia   SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;
    UPDATE public.agenda_notas       SET hogar_id = v_hogar, creado_por = v_user.id WHERE user_id = v_user.id AND hogar_id IS NULL;

    -- deuda_movimientos: hereda via deudas
    UPDATE public.deuda_movimientos dm
    SET hogar_id   = v_hogar,
        creado_por = v_user.id
    FROM public.deudas d
    WHERE dm.deuda_id = d.id
      AND d.user_id   = v_user.id
      AND dm.hogar_id IS NULL;

  END LOOP;

  RAISE NOTICE 'Backfill completado para todos los usuarios.';
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 6: FUNCIONES AUXILIARES PARA RLS
--
-- SECURITY DEFINER → evita recursión RLS al consultar 'perfiles'.
-- STABLE           → Postgres puede cachearlas por query (rendimiento).
-- ═══════════════════════════════════════════════════════════════════

-- Devuelve el hogar_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.mi_hogar_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hogar_id FROM public.perfiles WHERE id = auth.uid()
$$;

-- Devuelve el rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.mi_rol()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol FROM public.perfiles WHERE id = auth.uid()
$$;

-- Devuelve true si el usuario tiene permiso para un módulo específico
-- Admins siempre tienen acceso total.
CREATE OR REPLACE FUNCTION public.tengo_permiso(modulo text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN rol = 'admin' THEN true
    ELSE COALESCE((permisos ->> modulo)::boolean, false)
  END
  FROM public.perfiles WHERE id = auth.uid()
$$;


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 7: ACTIVAR RLS EN TODAS LAS TABLAS
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.hogares             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitaciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deudas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deuda_movimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inversiones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sobre_movimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_bloques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_sub     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_cats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategorias       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_tarjetas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_familia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_notas        ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 8: POLÍTICAS RLS
--
-- Jerarquía de acceso:
--   ADMIN  → ve y edita TODO lo del mismo hogar_id
--   MIEMBRO → ve solo lo que él creó (creado_por = auth.uid())
--             dentro de los módulos que tiene habilitados en permisos
-- ═══════════════════════════════════════════════════════════════════

-- ─── HOGARES ────────────────────────────────────────────────────────
-- El usuario puede ver su propio hogar; solo el admin puede editarlo.
CREATE POLICY "hogares_select" ON public.hogares
  FOR SELECT USING (id = public.mi_hogar_id());

CREATE POLICY "hogares_update" ON public.hogares
  FOR UPDATE USING (id = public.mi_hogar_id() AND public.mi_rol() = 'admin')
  WITH CHECK   (id = public.mi_hogar_id() AND public.mi_rol() = 'admin');


-- ─── PERFILES ───────────────────────────────────────────────────────
-- Cualquier miembro del hogar puede ver los perfiles del mismo hogar.
-- Solo puede editar su propio perfil.
-- Solo admin puede cambiar rol y permisos de otros (vía UPDATE sin restricción extra aquí;
-- la lógica de negocio lo controla en el servidor).
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT USING (hogar_id = public.mi_hogar_id());

CREATE POLICY "perfiles_insert" ON public.perfiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "perfiles_update" ON public.perfiles
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (id = auth.uid() OR public.mi_rol() = 'admin')
  );


-- ─── INVITACIONES ───────────────────────────────────────────────────
-- Solo admin puede crear/ver/revocar invitaciones de su hogar.
CREATE POLICY "invitaciones_select" ON public.invitaciones
  FOR SELECT USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

CREATE POLICY "invitaciones_insert" ON public.invitaciones
  FOR INSERT WITH CHECK (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

CREATE POLICY "invitaciones_update" ON public.invitaciones
  FOR UPDATE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

CREATE POLICY "invitaciones_delete" ON public.invitaciones
  FOR DELETE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');


-- ─── MACRO para tablas financieras ──────────────────────────────────
-- Patrón común:
--   SELECT → mismo hogar Y (admin O creado por mí) Y tiene permiso de módulo
--   INSERT → mismo hogar Y yo soy el creador
--   UPDATE/DELETE → mismo hogar Y (admin O creado por mí)


-- ─── MOVIMIENTOS (módulo: gastos) ───────────────────────────────────
CREATE POLICY "movimientos_select" ON public.movimientos
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('gastos')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "movimientos_insert" ON public.movimientos
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('gastos')
  );
CREATE POLICY "movimientos_update" ON public.movimientos
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "movimientos_delete" ON public.movimientos
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── DEUDAS (módulo: deudas) ─────────────────────────────────────────
CREATE POLICY "deudas_select" ON public.deudas
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('deudas')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "deudas_insert" ON public.deudas
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('deudas')
  );
CREATE POLICY "deudas_update" ON public.deudas
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "deudas_delete" ON public.deudas
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── DEUDA_MOVIMIENTOS (hereda acceso via deudas) ───────────────────
CREATE POLICY "deuda_movimientos_select" ON public.deuda_movimientos
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('deudas')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "deuda_movimientos_insert" ON public.deuda_movimientos
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('deudas')
  );
CREATE POLICY "deuda_movimientos_update" ON public.deuda_movimientos
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "deuda_movimientos_delete" ON public.deuda_movimientos
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── METAS (módulo: metas) ───────────────────────────────────────────
CREATE POLICY "metas_select" ON public.metas
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('metas')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "metas_insert" ON public.metas
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('metas')
  );
CREATE POLICY "metas_update" ON public.metas
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "metas_delete" ON public.metas
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── INVERSIONES (módulo: inversiones) ──────────────────────────────
CREATE POLICY "inversiones_select" ON public.inversiones
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('inversiones')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "inversiones_insert" ON public.inversiones
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('inversiones')
  );
CREATE POLICY "inversiones_update" ON public.inversiones
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "inversiones_delete" ON public.inversiones
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── SOBRE_MOVIMIENTOS (módulo: gastos) ─────────────────────────────
CREATE POLICY "sobre_movimientos_select" ON public.sobre_movimientos
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('gastos')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "sobre_movimientos_insert" ON public.sobre_movimientos
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('gastos')
  );
CREATE POLICY "sobre_movimientos_update" ON public.sobre_movimientos
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "sobre_movimientos_delete" ON public.sobre_movimientos
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── PRESUPUESTO (módulo: presupuesto) ──────────────────────────────

CREATE POLICY "presupuesto_bloques_select" ON public.presupuesto_bloques
  FOR SELECT USING (hogar_id = public.mi_hogar_id() AND public.tengo_permiso('presupuesto'));
CREATE POLICY "presupuesto_bloques_insert" ON public.presupuesto_bloques
  FOR INSERT WITH CHECK (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "presupuesto_bloques_update" ON public.presupuesto_bloques
  FOR UPDATE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "presupuesto_bloques_delete" ON public.presupuesto_bloques
  FOR DELETE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

CREATE POLICY "presupuesto_sub_select" ON public.presupuesto_sub
  FOR SELECT USING (hogar_id = public.mi_hogar_id() AND public.tengo_permiso('presupuesto'));
CREATE POLICY "presupuesto_sub_insert" ON public.presupuesto_sub
  FOR INSERT WITH CHECK (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "presupuesto_sub_update" ON public.presupuesto_sub
  FOR UPDATE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "presupuesto_sub_delete" ON public.presupuesto_sub
  FOR DELETE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

CREATE POLICY "presupuesto_cats_select" ON public.presupuesto_cats
  FOR SELECT USING (hogar_id = public.mi_hogar_id() AND public.tengo_permiso('presupuesto'));
CREATE POLICY "presupuesto_cats_insert" ON public.presupuesto_cats
  FOR INSERT WITH CHECK (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "presupuesto_cats_update" ON public.presupuesto_cats
  FOR UPDATE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "presupuesto_cats_delete" ON public.presupuesto_cats
  FOR DELETE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

-- presupuesto_items hereda via presupuesto_cats (sin hogar_id propio)
CREATE POLICY "presupuesto_items_select" ON public.presupuesto_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.presupuesto_cats pc
      WHERE pc.id = cat_id
        AND pc.hogar_id = public.mi_hogar_id()
        AND public.tengo_permiso('presupuesto')
    )
  );
CREATE POLICY "presupuesto_items_insert" ON public.presupuesto_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.presupuesto_cats pc
      WHERE pc.id = cat_id
        AND pc.hogar_id = public.mi_hogar_id()
        AND public.mi_rol() = 'admin'
    )
  );
CREATE POLICY "presupuesto_items_update" ON public.presupuesto_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.presupuesto_cats pc
      WHERE pc.id = cat_id
        AND pc.hogar_id = public.mi_hogar_id()
        AND public.mi_rol() = 'admin'
    )
  );
CREATE POLICY "presupuesto_items_delete" ON public.presupuesto_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.presupuesto_cats pc
      WHERE pc.id = cat_id
        AND pc.hogar_id = public.mi_hogar_id()
        AND public.mi_rol() = 'admin'
    )
  );


-- ─── CATEGORIAS (módulo: presupuesto) ───────────────────────────────
-- Todos pueden ver; solo admin puede crear/editar/borrar.
CREATE POLICY "categorias_select" ON public.categorias
  FOR SELECT USING (hogar_id = public.mi_hogar_id());
CREATE POLICY "categorias_insert" ON public.categorias
  FOR INSERT WITH CHECK (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "categorias_update" ON public.categorias
  FOR UPDATE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');
CREATE POLICY "categorias_delete" ON public.categorias
  FOR DELETE USING (hogar_id = public.mi_hogar_id() AND public.mi_rol() = 'admin');

-- subcategorias hereda via categorias
CREATE POLICY "subcategorias_select" ON public.subcategorias
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.categorias c
      WHERE c.id = categoria_id AND c.hogar_id = public.mi_hogar_id()
    )
  );
CREATE POLICY "subcategorias_insert" ON public.subcategorias
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.categorias c
      WHERE c.id = categoria_id
        AND c.hogar_id = public.mi_hogar_id()
        AND public.mi_rol() = 'admin'
    )
  );
CREATE POLICY "subcategorias_update" ON public.subcategorias
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.categorias c
      WHERE c.id = categoria_id
        AND c.hogar_id = public.mi_hogar_id()
        AND public.mi_rol() = 'admin'
    )
  );
CREATE POLICY "subcategorias_delete" ON public.subcategorias
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.categorias c
      WHERE c.id = categoria_id
        AND c.hogar_id = public.mi_hogar_id()
        AND public.mi_rol() = 'admin'
    )
  );


-- ─── PERFILES_TARJETAS (módulo: deudas) ─────────────────────────────
CREATE POLICY "perfiles_tarjetas_select" ON public.perfiles_tarjetas
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('deudas')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "perfiles_tarjetas_insert" ON public.perfiles_tarjetas
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('deudas')
  );
CREATE POLICY "perfiles_tarjetas_update" ON public.perfiles_tarjetas
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "perfiles_tarjetas_delete" ON public.perfiles_tarjetas
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── PERFILES_FAMILIA (visible por todos del hogar) ─────────────────
CREATE POLICY "perfiles_familia_select" ON public.perfiles_familia
  FOR SELECT USING (hogar_id = public.mi_hogar_id());
CREATE POLICY "perfiles_familia_insert" ON public.perfiles_familia
  FOR INSERT WITH CHECK (hogar_id = public.mi_hogar_id());
CREATE POLICY "perfiles_familia_update" ON public.perfiles_familia
  FOR UPDATE USING (hogar_id = public.mi_hogar_id());
CREATE POLICY "perfiles_familia_delete" ON public.perfiles_familia
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ─── AGENDA_NOTAS (módulo: agenda) ──────────────────────────────────
CREATE POLICY "agenda_notas_select" ON public.agenda_notas
  FOR SELECT USING (
    hogar_id = public.mi_hogar_id()
    AND public.tengo_permiso('agenda')
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "agenda_notas_insert" ON public.agenda_notas
  FOR INSERT WITH CHECK (
    hogar_id   = public.mi_hogar_id()
    AND creado_por = auth.uid()
    AND public.tengo_permiso('agenda')
  );
CREATE POLICY "agenda_notas_update" ON public.agenda_notas
  FOR UPDATE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );
CREATE POLICY "agenda_notas_delete" ON public.agenda_notas
  FOR DELETE USING (
    hogar_id = public.mi_hogar_id()
    AND (public.mi_rol() = 'admin' OR creado_por = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 9: TRIGGER — Auto-crear hogar y perfil en registro de usuario nuevo
--
-- Cuando alguien se registra vía Supabase Auth, automáticamente:
--   1. Se crea su hogar.
--   2. Se crea su perfil como 'admin'.
-- Así el onboarding fluye sin necesidad de pasos manuales.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hogar_id uuid;
BEGIN
  -- Solo actuar si el usuario no tiene perfil aún (evitar duplicados)
  IF NOT EXISTS (SELECT 1 FROM public.perfiles WHERE id = NEW.id) THEN

    INSERT INTO public.hogares (nombre_hogar, plan_tipo)
    VALUES ('Familia ' || split_part(NEW.email, '@', 1), 'free')
    RETURNING id INTO v_hogar_id;

    INSERT INTO public.perfiles (id, hogar_id, nombre, rol)
    VALUES (
      NEW.id,
      v_hogar_id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      'admin'
    );

  END IF;
  RETURN NEW;
END;
$$;

-- Crear trigger (drop primero para idempotencia)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();


-- ═══════════════════════════════════════════════════════════════════
-- BLOQUE 10: TRIGGER — Auto-asignar hogar_id y creado_por en INSERTs
--
-- Para que el frontend no tenga que pasar hogar_id manualmente.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_hogar_y_creador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hogar_id IS NULL THEN
    NEW.hogar_id := public.mi_hogar_id();
  END IF;
  IF TG_TABLE_NAME != 'deuda_movimientos' THEN
    -- creado_por ya existe en estas tablas
    IF NEW.creado_por IS NULL THEN
      NEW.creado_por := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Aplicar trigger a tablas financieras principales
DO $$ DECLARE tbl text; BEGIN
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
END $$;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (ejecutar después de confirmar con COMMIT)
-- ═══════════════════════════════════════════════════════════════════
--
-- 1. Ver tablas con RLS activo:
--    SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname = 'public' ORDER BY tablename;
--
-- 2. Ver todas las políticas creadas:
--    SELECT tablename, policyname, cmd, qual
--    FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd;
--
-- 3. Ver hogares y perfiles creados:
--    SELECT h.nombre_hogar, p.nombre, p.rol, p.permisos
--    FROM public.hogares h JOIN public.perfiles p ON p.hogar_id = h.id;
--
-- 4. Contar registros sin hogar_id (debe ser 0 en todo):
--    SELECT 'movimientos' t, count(*) FROM public.movimientos WHERE hogar_id IS NULL
--    UNION ALL SELECT 'deudas', count(*) FROM public.deudas WHERE hogar_id IS NULL
--    UNION ALL SELECT 'metas', count(*) FROM public.metas WHERE hogar_id IS NULL;
--
-- ═══════════════════════════════════════════════════════════════════

-- ⚠️  Cambia ROLLBACK por COMMIT cuando hayas verificado.
ROLLBACK;
