-- =====================================================================
-- MÓDULO: Inmuebles — Simulador Inmobiliario
-- Familia Finanzas — Ejecutar en Supabase SQL Editor
-- Basado en: Plan_compra_vivienda.xlsx
-- =====================================================================

-- ── Tabla principal ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inmuebles (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  nombre  text NOT NULL,
  tipo    text NOT NULL DEFAULT 'vivienda_habitual'
          CHECK (tipo IN ('vivienda_habitual', 'inversion')),
  estado  text NOT NULL DEFAULT 'simulacion'
          CHECK (estado IN ('simulacion', 'comprado')),

  -- ── Datos de compra ──────────────────────────────────────────────────────
  -- Ejemplo (vivienda habitual del Excel):
  --   precio: 180000, gastos_compra: 16014 (ITP 5400 + Notaría 2880 + Broker 6534 + Gestoría 1000 + ITP% 3%)
  --   reforma: 20000, aportacion_inicial: 36000
  datos_compra jsonb NOT NULL DEFAULT '{}',
  -- {
  --   "precio":             180000,
  --   "gastos_compra":      16014,    ← ITP + Notaría + Broker + Gestoría
  --   "reforma":            20000,
  --   "aportacion_inicial": 36000     ← entrada en cash
  -- }

  -- ── Hipoteca ─────────────────────────────────────────────────────────────
  hipoteca jsonb NOT NULL DEFAULT '{}',
  -- {
  --   "principal":    144000,   ← precio × LTV% (80/90/100)
  --   "interes_anual": 3.0,
  --   "plazo_meses":   360,
  --   "fecha_inicio": "2026-06" ← YYYY-MM
  -- }

  -- ── Configuración alquiler (solo si tipo = 'inversion') ──────────────────
  -- Vacancia del Excel: meses_ocupados = 11 (= 11 meses de ingresos al año)
  alquiler_config jsonb DEFAULT '{}',
  -- {
  --   "renta_mensual":         1000,
  --   "meses_ocupados":          11,  ← Excel "Vacancia: 11"
  --   "comunidad_mensual":       50,
  --   "mantenimiento_mensual":   92,  ← reserva mantenimiento (91.67 en Excel)
  --   "ibi_anual":              300,
  --   "seguro_anual":           180
  -- }

  -- ── Amortizaciones extra programadas ─────────────────────────────────────
  amortizaciones_extra jsonb NOT NULL DEFAULT '[]',
  -- [{ "mes": 12, "montoCents": 500000, "nota": "Paga extra diciembre" }]

  -- ── Financiación especial (Aval ICO, Crédito Público, Bróker) ─────────────
  -- {
  --   "modo_financiacion": "ninguna" | "aval_ico" | "dual",
  --   "aval_ico": bool,          ← backward compat
  --   "ltv_banco": 0.80,
  --   "credito_publico": {
  --     "activo": true,
  --     "ltv": 0.20,
  --     "interes_anual": 0,
  --     "nombre": "Plan Joven / Familias con menores — Castilla-La Mancha"
  --   },
  --   "comision_agente": {
  --     "activo": true,
  --     "pct": 3,
  --     "importe": 5400   ← se suma a inversión total y afecta ROI
  --   }
  -- }
  financiacion jsonb NOT NULL DEFAULT '{}'::jsonb,

  notas      text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inmuebles_user_id ON public.inmuebles(user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.inmuebles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inmuebles_select" ON public.inmuebles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "inmuebles_insert" ON public.inmuebles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "inmuebles_update" ON public.inmuebles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "inmuebles_delete" ON public.inmuebles
  FOR DELETE USING (auth.uid() = user_id);

-- ── Trigger: updated_at automático ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inmuebles_updated_at ON public.inmuebles;
CREATE TRIGGER trg_inmuebles_updated_at
  BEFORE UPDATE ON public.inmuebles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── RPC: Registrar compra de forma atómica ────────────────────────────────────
-- En una sola transacción:
--   1. Marca el inmueble como 'comprado'
--   2. Registra la salida de la entrada en movimientos (categoria='ahorro')
--
-- Llámalo desde el cliente: supabase.rpc('registrar_compra_inmueble', { p_inmueble_id: id })

CREATE OR REPLACE FUNCTION public.registrar_compra_inmueble(p_inmueble_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   uuid;
  v_inmueble  public.inmuebles%ROWTYPE;
  v_entrada   numeric;
  v_nombre    text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT * INTO v_inmueble
  FROM public.inmuebles
  WHERE id = p_inmueble_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inmueble no encontrado o sin permisos';
  END IF;

  IF v_inmueble.estado = 'comprado' THEN
    RAISE EXCEPTION 'Este inmueble ya está registrado como comprado';
  END IF;

  v_entrada := (v_inmueble.datos_compra->>'aportacion_inicial')::numeric;
  v_nombre  := v_inmueble.nombre;

  -- 1. Marcar como comprado
  UPDATE public.inmuebles
  SET estado = 'comprado'
  WHERE id = p_inmueble_id;

  -- 2. Registrar salida de la entrada del ahorro
  IF v_entrada > 0 THEN
    INSERT INTO public.movimientos
      (user_id, tipo, monto, categoria, descripcion, fecha)
    VALUES
      (v_user_id, 'egreso', v_entrada, 'ahorro',
       'Entrada compra: ' || v_nombre, CURRENT_DATE);
  END IF;

  RETURN jsonb_build_object('ok', true, 'inmueble_id', p_inmueble_id);
END;
$$;

-- ── Datos iniciales de ejemplo (opcional — basados en el Excel) ──────────────
-- Descomenta para insertar las 3 simulaciones del Excel como punto de partida.
-- Sustituye '00000000-0000-0000-0000-000000000000' por un user_id real.

/*
INSERT INTO public.inmuebles (user_id, nombre, tipo, datos_compra, hipoteca, notas)
VALUES
  -- Hoja "Presupuesto-Casa" — Caso 80% LTV (vivienda habitual)
  ('00000000-0000-0000-0000-000000000000',
   'Piso principal — Caso 80%', 'vivienda_habitual',
   '{"precio":180000,"gastos_compra":16014,"reforma":20000,"aportacion_inicial":36000}',
   '{"principal":144000,"interes_anual":3.0,"plazo_meses":360,"fecha_inicio":"2026-06"}',
   'Cuota 607€/mes — Total desembolso inicial ~71,814€'),

  -- Hoja "1-Alquiler piso"
  ('00000000-0000-0000-0000-000000000000',
   'Piso alquiler 70k', 'inversion',
   '{"precio":70000,"gastos_compra":15000,"reforma":10000,"aportacion_inicial":21000}',
   '{"principal":49000,"interes_anual":3.0,"plazo_meses":360,"fecha_inicio":"2026-06"}',
   'CF mensual ~528€, Rentabilidad 6.67%'),

  -- Hoja "2-Alquiler piso"
  ('00000000-0000-0000-0000-000000000000',
   'Piso alquiler 100k', 'inversion',
   '{"precio":100000,"gastos_compra":15000,"reforma":10000,"aportacion_inicial":30000}',
   '{"principal":70000,"interes_anual":3.0,"plazo_meses":360,"fecha_inicio":"2026-06"}',
   'CF mensual ~601€, Rentabilidad 5.77%');
*/
