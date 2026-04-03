-- =====================================================================
-- MIGRACIÓN: get_mis_permisos incluye nombre_hogar
-- Fecha: 2026-04-03
-- Motivo: Sidebar y AppShell necesitan el nombre real del hogar
--         para no tenerlo hardcodeado como "Familia Quintero".
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_mis_permisos()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'rol',          p.rol,
    'permisos',     p.permisos,
    'hogar_id',     p.hogar_id,
    'nombre',       p.nombre,
    'nombre_hogar', h.nombre_hogar
  )
  FROM public.perfiles p
  JOIN public.hogares  h ON h.id = p.hogar_id
  WHERE p.id = auth.uid()
$$;

COMMIT;
