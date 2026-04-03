-- =====================================================================
-- MIGRACIÓN: Corrige datos corruptos y agrega GRANT a la nueva firma
-- Fecha: 2026-04-03
--
-- Problemas que resuelve:
--   1. nombre_hogar en hogares quedó concatenado (ej: "Familia jodannysaliendres")
--   2. perfiles.nombre quedó sin espacios (ej: "jodannysaliendres")
--   3. Faltaba GRANT para inicializar_hogar(text, text)
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. GRANT para la nueva firma de inicializar_hogar con 2 parámetros
-- ─────────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.inicializar_hogar(text, text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────
-- 2. CORRECCIÓN DE DATOS CORRUPTOS
--    Ejecuta solo lo que aplique a tu base de datos.
--    Ajusta los valores entre comillas con los nombres correctos.
-- ─────────────────────────────────────────────────────────────────────

-- Corregir nombre del hogar (pon el nombre real de tu familia)
UPDATE public.hogares
SET nombre_hogar = 'Familia Quintero'
WHERE nombre_hogar ILIKE 'familia%'          -- aplica a todos los hogares mal nombrados
  AND nombre_hogar NOT IN ('Familia Quintero');  -- evita tocar los que ya estén bien

-- Corregir nombres en perfiles (ajusta cada caso)
-- Perfil de Jodannys
UPDATE public.perfiles
SET nombre = 'Jodannys'
WHERE nombre ILIKE '%jodannys%' AND nombre NOT IN ('Jodannys');

-- Perfil de Rolando (ajusta al nombre correcto si difiere)
UPDATE public.perfiles
SET nombre = 'Rolando'
WHERE nombre ILIKE '%rolando%' AND nombre NOT IN ('Rolando');


COMMIT;
