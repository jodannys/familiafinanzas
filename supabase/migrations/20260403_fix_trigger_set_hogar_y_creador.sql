-- ═══════════════════════════════════════════════════════════════════
-- FIX: set_hogar_y_creador() — manejo seguro de auth.uid() NULL
--
-- Problema: mi_hogar_id() devuelve NULL cuando auth.uid() es NULL
-- (SQL Editor, scripts de seed/migración). El trigger original no
-- tenía fallback y dejaba hogar_id = NULL, causando error P0001 en
-- versiones anteriores del trigger o violación de FK en tablas con
-- NOT NULL en hogar_id.
--
-- Solución:
--   1. Si NEW.hogar_id ya tiene valor  → no tocar.
--   2. Si NULL → intentar via auth.uid() → perfiles.hogar_id
--   3. Si sigue NULL → intentar via NEW.user_id → perfiles.hogar_id
--      (cubre inserts desde scripts donde user_id se pasa explícito)
--   4. Si sigue NULL → dejar pasar; la FK/NOT NULL constraint
--      fallará con un error claro y estándar de Postgres.
--
--   creado_por:
--   1. Si ya tiene valor → no tocar.
--   2. Si NULL → auth.uid()
--   3. Si sigue NULL → NEW.user_id (mismo criterio que hogar_id)
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.set_hogar_y_creador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid;
  v_hogar_id uuid;
BEGIN
  -- ── 1. Resolver hogar_id ──────────────────────────────────────────
  IF NEW.hogar_id IS NULL THEN

    -- Intento 1: usuario autenticado en la sesión actual
    v_uid := auth.uid();

    IF v_uid IS NOT NULL THEN
      SELECT hogar_id INTO v_hogar_id
        FROM public.perfiles
       WHERE id = v_uid
       LIMIT 1;
    END IF;

    -- Intento 2: user_id explícito en el registro (scripts / seed)
    IF v_hogar_id IS NULL AND NEW.user_id IS NOT NULL THEN
      SELECT hogar_id INTO v_hogar_id
        FROM public.perfiles
       WHERE id = NEW.user_id
       LIMIT 1;
    END IF;

    -- Asignar solo si se resolvió; si no, la FK/NOT NULL lo manejará
    IF v_hogar_id IS NOT NULL THEN
      NEW.hogar_id := v_hogar_id;
    END IF;

  END IF;

  -- ── 2. Resolver creado_por (solo tablas que tienen la columna) ────
  --    deuda_movimientos no tiene creado_por, el resto sí.
  IF TG_TABLE_NAME != 'deuda_movimientos' THEN

    IF NEW.creado_por IS NULL THEN
      -- Reusar v_uid si ya se calculó arriba
      IF v_uid IS NULL THEN
        v_uid := auth.uid();
      END IF;

      NEW.creado_por := COALESCE(v_uid, NEW.user_id);
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ── Re-aplicar trigger en todas las tablas financieras ──────────────
-- Idempotente: DROP IF EXISTS + CREATE
DO $$ DECLARE tbl text; BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'movimientos', 'deudas', 'deuda_movimientos', 'metas', 'inversiones',
    'sobre_movimientos', 'presupuesto_bloques', 'presupuesto_sub',
    'presupuesto_cats', 'categorias', 'perfiles_tarjetas',
    'perfiles_familia', 'agenda_notas'
  ] LOOP
    -- Solo aplicar si la tabla existe (evita error en entornos parciales)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name   = tbl
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS set_hogar_y_creador ON public.%I', tbl
      );
      EXECUTE format(
        'CREATE TRIGGER set_hogar_y_creador
           BEFORE INSERT ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.set_hogar_y_creador()',
        tbl
      );
    END IF;
  END LOOP;
END $$;

-- ── Verificación ──────────────────────────────────────────────────
-- Confirma que el trigger quedó registrado en todas las tablas:
--
--   SELECT event_object_table, trigger_name, action_timing, event_manipulation
--     FROM information_schema.triggers
--    WHERE trigger_schema = 'public'
--      AND trigger_name   = 'set_hogar_y_creador'
--    ORDER BY event_object_table;
--
-- ⚠ Cambia ROLLBACK por COMMIT cuando hayas verificado.
ROLLBACK;
