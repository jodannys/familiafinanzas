-- =====================================================================
-- PATCH: Corrige get_movimientos_por_usuario
-- Problema: la función referenciaba m.subcategoria (no existe);
--           la columna real es subcategoria_id (uuid FK).
-- Solución: LEFT JOIN con subcategorias para devolver el nombre.
-- =====================================================================

DROP FUNCTION IF EXISTS public.get_movimientos_por_usuario(uuid,date,date,text,text,integer);

CREATE OR REPLACE FUNCTION public.get_movimientos_por_usuario(
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
  user_id         uuid,
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
SET search_path = public
AS $$
BEGIN
  -- Solo admin puede filtrar por usuario
  IF public.mi_rol() != 'admin' THEN
    RAISE EXCEPTION 'Solo el admin puede filtrar movimientos por usuario';
  END IF;

  -- Validar que el usuario pertenece al mismo hogar
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = p_user_id AND hogar_id = public.mi_hogar_id()
  ) THEN
    RAISE EXCEPTION 'El usuario no pertenece a tu hogar';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.hogar_id,
    m.creado_por,
    m.user_id,
    m.fecha,
    m.tipo,
    m.categoria,
    sc.nombre      AS subcategoria,
    m.subcategoria_id,
    m.descripcion,
    m.monto,
    m.quien,
    m.meta_id,
    m.inversion_id,
    m.deuda_id,
    m.created_at
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

REVOKE ALL ON FUNCTION public.get_movimientos_por_usuario(uuid,date,date,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_movimientos_por_usuario(uuid,date,date,text,text,integer) TO authenticated;
