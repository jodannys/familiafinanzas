-- =====================================================================
-- RPC atómica: registrar_movimiento + revertir_movimiento
-- Familia Finanzas — Ejecutar en Supabase SQL Editor
-- Fecha: 2026-04-02
--
-- Propósito: reemplazar las 3-4 operaciones secuenciales que existían en
-- gastos/page.js por una sola llamada que, al correr dentro de una
-- transacción PL/pgSQL, garantiza atomicidad completa:
--   INSERT movimientos → UPDATE metas/inversiones/deudas → INSERT deuda_movimientos
-- Si cualquier paso falla, PostgreSQL hace rollback automático de todo.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. registrar_movimiento
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.registrar_movimiento(
  p_tipo            text,
  p_monto           numeric,
  p_descripcion     text,
  p_categoria       text,
  p_fecha           date,
  p_quien           text,
  p_metodo_pago     text    DEFAULT 'efectivo',
  p_meta_id         uuid    DEFAULT NULL,
  p_inversion_id    uuid    DEFAULT NULL,
  p_deuda_id        uuid    DEFAULT NULL,
  p_subcategoria_id uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_mov_id    uuid;
  v_dm_id     uuid;
BEGIN
  -- Verificar sesión activa
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- ── 1. Insertar movimiento principal ─────────────────────────────────────
  INSERT INTO public.movimientos
    (user_id, tipo, monto, descripcion, categoria, fecha,
     quien, metodo_pago, meta_id, inversion_id, deuda_id, subcategoria_id)
  VALUES
    (v_user_id, p_tipo, p_monto, p_descripcion, p_categoria, p_fecha,
     p_quien, p_metodo_pago, p_meta_id, p_inversion_id, p_deuda_id, p_subcategoria_id)
  RETURNING id INTO v_mov_id;

  -- ── 2. Actualizar meta si aplica ─────────────────────────────────────────
  -- Solo se incrementa cuando el tipo es 'egreso' (el usuario está destinando
  -- dinero hacia la meta, no retirando).
  IF p_meta_id IS NOT NULL AND p_tipo = 'egreso' THEN
    UPDATE public.metas
    SET actual = actual + p_monto
    WHERE id = p_meta_id AND user_id = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Meta no encontrada o sin permisos: %', p_meta_id;
    END IF;
  END IF;

  -- ── 3. Actualizar inversión si aplica ────────────────────────────────────
  IF p_inversion_id IS NOT NULL AND p_tipo = 'egreso' THEN
    UPDATE public.inversiones
    SET capital = capital + p_monto
    WHERE id = p_inversion_id AND user_id = v_user_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inversión no encontrada o sin permisos: %', p_inversion_id;
    END IF;
  END IF;

  -- ── 4. Actualizar deuda + registrar en historial si aplica ───────────────
  -- El INSERT en deuda_movimientos ocurre ANTES del UPDATE en deudas para
  -- poder capturar el id generado y vincularlo en movimientos.
  IF p_deuda_id IS NOT NULL AND p_tipo = 'egreso' THEN
    INSERT INTO public.deuda_movimientos
      (deuda_id, tipo, descripcion, monto, fecha, mes, año)
    VALUES
      (p_deuda_id, 'pago', p_descripcion, p_monto, p_fecha,
       EXTRACT(MONTH FROM p_fecha)::int,
       EXTRACT(YEAR  FROM p_fecha)::int)
    RETURNING id INTO v_dm_id;

    -- Vincular el movimiento con el registro de historial
    UPDATE public.movimientos
    SET deuda_movimiento_id = v_dm_id
    WHERE id = v_mov_id;

    -- Reducir el pendiente; si llega a 0 o menos, marcar como pagada
    UPDATE public.deudas
    SET
      pendiente = GREATEST(0, pendiente - p_monto),
      pagadas   = COALESCE(pagadas, 0) + 1,
      estado    = CASE WHEN GREATEST(0, pendiente - p_monto) = 0 THEN 'pagada' ELSE estado END
    WHERE id = p_deuda_id AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Deuda no encontrada o sin permisos: %', p_deuda_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'mov_id', v_mov_id, 'dm_id', v_dm_id);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. revertir_movimiento
-- ─────────────────────────────────────────────────────────────────────────────
-- Invierte exactamente lo que registrar_movimiento creó.
-- Orden crítico: borrar movimientos ANTES de deuda_movimientos para evitar
-- la violación de FK que existía en la lógica manual del cliente.
CREATE OR REPLACE FUNCTION public.revertir_movimiento(p_mov_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mov     RECORD;
BEGIN
  -- Verificar sesióna y ownership en una sola consulta
  SELECT * INTO v_mov FROM public.movimientos
  WHERE id = p_mov_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimiento no encontrado o sin permisos: %', p_mov_id;
  END IF;

  -- ── Revertir meta ─────────────────────────────────────────────────────────
  IF v_mov.meta_id IS NOT NULL AND v_mov.tipo = 'egreso' THEN
    UPDATE public.metas
    SET actual = GREATEST(0, actual - v_mov.monto)
    WHERE id = v_mov.meta_id AND user_id = v_user_id;
  END IF;

  -- ── Revertir inversión ────────────────────────────────────────────────────
  IF v_mov.inversion_id IS NOT NULL AND v_mov.tipo = 'egreso' THEN
    UPDATE public.inversiones
    SET capital = GREATEST(0, capital - v_mov.monto)
    WHERE id = v_mov.inversion_id AND user_id = v_user_id;
  END IF;

  -- ── Revertir deuda ────────────────────────────────────────────────────────
  IF v_mov.deuda_id IS NOT NULL AND v_mov.tipo = 'egreso' THEN
    UPDATE public.deudas
    SET
      pendiente = pendiente + v_mov.monto,
      pagadas   = GREATEST(0, COALESCE(pagadas, 0) - 1),
      estado    = 'activa'
    WHERE id = v_mov.deuda_id AND user_id = v_user_id;
  END IF;

  -- ── Borrar movimiento primero (FK hacia deuda_movimientos) ────────────────
  DELETE FROM public.movimientos WHERE id = p_mov_id;

  -- ── Borrar registro de historial de deuda si existe ──────────────────────
  IF v_mov.deuda_movimiento_id IS NOT NULL THEN
    DELETE FROM public.deuda_movimientos WHERE id = v_mov.deuda_movimiento_id;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- Permisos: solo el rol authenticated puede invocar estas funciones.
-- SECURITY DEFINER hace que corran con privilegios del owner (postgres),
-- pero auth.uid() limita el alcance al usuario de la sesión activa.
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.registrar_movimiento(text,numeric,text,text,date,text,text,uuid,uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_movimiento(text,numeric,text,text,date,text,text,uuid,uuid,uuid,uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.revertir_movimiento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revertir_movimiento(uuid) TO authenticated;
