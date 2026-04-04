-- RPC para insertar en deuda_movimientos con SECURITY DEFINER
-- Resuelve el error 400 por RLS policy que exige hogar_id = mi_hogar_id()

CREATE OR REPLACE FUNCTION public.registrar_deuda_movimiento(
  p_deuda_id UUID,
  p_tipo TEXT,
  p_monto NUMERIC,
  p_descripcion TEXT DEFAULT NULL,
  p_fecha DATE DEFAULT CURRENT_DATE,
  p_mes INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int,
  p_año INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS deuda_movimientos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hogar_id UUID;
  v_user_id UUID;
  v_result deuda_movimientos;
BEGIN
  v_user_id := auth.uid();
  v_hogar_id := public.mi_hogar_id();

  IF v_hogar_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró hogar para el usuario';
  END IF;

  INSERT INTO deuda_movimientos (
    deuda_id, hogar_id, creado_por, tipo, monto, descripcion, fecha, mes, año
  ) VALUES (
    p_deuda_id, v_hogar_id, v_user_id, p_tipo, p_monto, p_descripcion, p_fecha, p_mes, p_año
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_deuda_movimiento TO authenticated;
