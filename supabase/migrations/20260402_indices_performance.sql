-- =====================================================================
-- Índices de performance — familia-finanzas
-- INSTRUCCIONES: Ejecutar DESPUÉS de 20260402_rls_policies.sql
-- (los índices sobre user_id requieren que la columna ya exista).
-- Los índices son idempotentes (IF NOT EXISTS) — seguros de re-ejecutar.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- movimientos — tabla más consultada
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_movimientos_user_fecha
  ON public.movimientos (user_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_movimientos_user_categoria_fecha
  ON public.movimientos (user_id, categoria, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_movimientos_deuda_id
  ON public.movimientos (deuda_id) WHERE deuda_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_meta_id
  ON public.movimientos (meta_id) WHERE meta_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimientos_inversion_id
  ON public.movimientos (inversion_id) WHERE inversion_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- deudas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deudas_user_estado
  ON public.deudas (user_id, estado);

CREATE INDEX IF NOT EXISTS idx_deudas_perfil_tarjeta
  ON public.deudas (perfil_tarjeta_id) WHERE perfil_tarjeta_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- deuda_movimientos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_deuda_mov_deuda_mes
  ON public.deuda_movimientos (deuda_id, mes, año);

-- ─────────────────────────────────────────────────────────────────────────────
-- sobre_movimientos
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sobre_mov_user_mes
  ON public.sobre_movimientos (user_id, mes, año);

-- ─────────────────────────────────────────────────────────────────────────────
-- metas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_metas_user_estado
  ON public.metas (user_id, estado);

-- ─────────────────────────────────────────────────────────────────────────────
-- inversiones
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inversiones_user
  ON public.inversiones (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- agenda_notas
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agenda_user_fecha
  ON public.agenda_notas (user_id, fecha);

-- ─────────────────────────────────────────────────────────────────────────────
-- presupuesto_cats
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_presupuesto_cats_user
  ON public.presupuesto_cats (user_id);

COMMIT;
