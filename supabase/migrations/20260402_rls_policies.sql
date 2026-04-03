-- =====================================================================
-- Row Level Security — familia-finanzas
-- INSTRUCCIONES DE EJECUCIÓN (leer antes de ejecutar):
--
-- PASO 1 — Obtener tu user_id:
--   Ejecuta en SQL Editor:
--     SELECT id FROM auth.users LIMIT 5;
--   Copia tu UUID y reemplaza 'TU-USER-UUID-AQUI' en la sección BACKFILL.
--
-- PASO 2 — Ejecuta TODO el script (el ROLLBACK final es solo de seguridad).
--          Cuando hayas verificado los resultados, cambia ROLLBACK por COMMIT.
--
-- PASO 3 — Verifica con:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
-- =====================================================================

BEGIN;


-- ─────────────────────────────────a────────────────────────────────────────────
-- FASE 1: Añadir columna user_id a las tablas que no la tienen
-- DEFAULT auth.uid() hace que los nuevos INSERTs desde el cliente autenticado
-- asignen automáticamente el user_id sin cambios en el frontend.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.movimientos
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.deudas
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.inversiones
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.sobre_movimientos
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.presupuesto_bloques
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.presupuesto_sub
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.presupuesto_cats
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.categorias
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.perfiles_tarjetas
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.perfiles_familia
  ADD COLUMN IF NOT EXISTS user_id uuid DEFAULT auth.uid()
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- agenda_notas ya tiene user_id — no se toca

-- presupuesto_items puede no tener cat_id si la tabla existía antes del schema_inicial
ALTER TABLE public.presupuesto_items
  ADD COLUMN IF NOT EXISTS cat_id uuid
  REFERENCES public.presupuesto_cats(id) ON DELETE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2: Backfill — asignar el user_id a registros existentes (sin user_id)
-- ⚠️ REEMPLAZA 'TU-USER-UUID-AQUI' con tu UUID real antes de ejecutar.
--    Obtén tu UUID con: SELECT id FROM auth.users LIMIT 5;
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Intenta obtener el único usuario de la app automáticamente
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró ningún usuario en auth.users. Crea una cuenta primero.';
  END IF;

  UPDATE public.movimientos        SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.deudas             SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.metas              SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.inversiones        SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.sobre_movimientos  SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.presupuesto_bloques SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.presupuesto_sub    SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.presupuesto_cats   SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.categorias         SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.perfiles_tarjetas  SET user_id = v_user_id WHERE user_id IS NULL;
  UPDATE public.perfiles_familia   SET user_id = v_user_id WHERE user_id IS NULL;

  RAISE NOTICE 'Backfill completado con user_id: %', v_user_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 3: Activar RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.movimientos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deudas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deuda_movimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inversiones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sobre_movimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_bloques ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_sub     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_cats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_tarjetas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_familia    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_notas        ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 4: Políticas RLS
-- ─────────────────────────────────────────────────────────────────────────────

-- movimientos
CREATE POLICY "movimientos_select" ON public.movimientos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "movimientos_insert" ON public.movimientos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "movimientos_update" ON public.movimientos
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "movimientos_delete" ON public.movimientos
  FOR DELETE USING (auth.uid() = user_id);

-- deudas
CREATE POLICY "deudas_select" ON public.deudas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "deudas_insert" ON public.deudas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "deudas_update" ON public.deudas
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "deudas_delete" ON public.deudas
  FOR DELETE USING (auth.uid() = user_id);

-- deuda_movimientos (sin user_id propio, hereda via deudas)
CREATE POLICY "deuda_movimientos_select" ON public.deuda_movimientos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.deudas d WHERE d.id = deuda_id AND d.user_id = auth.uid())
  );
CREATE POLICY "deuda_movimientos_insert" ON public.deuda_movimientos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.deudas d WHERE d.id = deuda_id AND d.user_id = auth.uid())
  );
CREATE POLICY "deuda_movimientos_update" ON public.deuda_movimientos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.deudas d WHERE d.id = deuda_id AND d.user_id = auth.uid())
  );
CREATE POLICY "deuda_movimientos_delete" ON public.deuda_movimientos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.deudas d WHERE d.id = deuda_id AND d.user_id = auth.uid())
  );

-- metas
CREATE POLICY "metas_all" ON public.metas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- inversiones
CREATE POLICY "inversiones_all" ON public.inversiones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- sobre_movimientos
CREATE POLICY "sobre_movimientos_all" ON public.sobre_movimientos
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- presupuesto_bloques
CREATE POLICY "presupuesto_bloques_all" ON public.presupuesto_bloques
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- presupuesto_sub
CREATE POLICY "presupuesto_sub_all" ON public.presupuesto_sub
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- presupuesto_cats
CREATE POLICY "presupuesto_cats_all" ON public.presupuesto_cats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- presupuesto_items (sin user_id, hereda via presupuesto_cats)
-- ⚠️ Solo si la columna cat_id existe en presupuesto_items.
--    Si el nombre de la FK es diferente, ajusta el campo.
CREATE POLICY "presupuesto_items_all" ON public.presupuesto_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.presupuesto_cats pc WHERE pc.id = cat_id AND pc.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.presupuesto_cats pc WHERE pc.id = cat_id AND pc.user_id = auth.uid())
  );

-- categorias
CREATE POLICY "categorias_all" ON public.categorias
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- subcategorias (sin user_id, hereda via categorias)
-- ⚠️ Si el FK se llama diferente a categoria_id, ajusta el campo.
CREATE POLICY "subcategorias_all" ON public.subcategorias
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.categorias c WHERE c.id = categoria_id AND c.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.categorias c WHERE c.id = categoria_id AND c.user_id = auth.uid())
  );

-- perfiles_tarjetas
CREATE POLICY "perfiles_tarjetas_all" ON public.perfiles_tarjetas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- perfiles_familia
CREATE POLICY "perfiles_familia_all" ON public.perfiles_familia
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- agenda_notas
CREATE POLICY "agenda_notas_all" ON public.agenda_notas
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ Cambia ROLLBACK por COMMIT cuando hayas verificado los resultados.
-- Verifica primero:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
--   SELECT count(*) FROM public.movimientos WHERE user_id IS NULL;  -- debe ser 0
-- ─────────────────────────────────────────────────────────────────────────────
ROLLBACK;
