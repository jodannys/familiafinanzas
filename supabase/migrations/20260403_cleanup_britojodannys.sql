-- =====================================================================
-- LIMPIEZA: britojodannys955 creó un hogar propio en vez de unirse
--           a Familia Quintero como miembro.
--
-- EJECUTAR EN SUPABASE SQL EDITOR (no es una migración estructural,
-- es una corrección puntual de datos).
-- =====================================================================

BEGIN;

-- 1. Eliminar el perfil erróneo de britojodannys en el hogar equivocado
DELETE FROM public.perfiles
WHERE nombre ILIKE '%britojodannys%'
  AND hogar_id = 'ad102284-1c1f-4c50-b25c-ac6253af0a29';

-- 2. Eliminar el hogar vacío que se creó por error
DELETE FROM public.hogares
WHERE id = 'ad102284-1c1f-4c50-b25c-ac6253af0a29';

-- 3. Insertar el perfil correcto: miembro de Familia Quintero
--    (reemplaza los permisos y el hogar_id con los de tu invitación)
INSERT INTO public.perfiles (id, hogar_id, nombre, rol, permisos)
VALUES (
  'ccc819e9-ce05-4edd-86b6-3d92f9e363be',           -- su UUID en auth.users
  'e6e081e8-98df-422b-a56c-304cb6ba99e0',            -- hogar Familia Quintero
  'Jodannys B',                                       -- ajusta el nombre si quieres
  'miembro',
  '{"metas":true,"agenda":true,"deudas":true,"gastos":true,"sobres":true,"reportes":false,"tarjetas":false,"inmuebles":false,"inversiones":false,"presupuesto":true}'::jsonb
)
ON CONFLICT (id) DO UPDATE
  SET hogar_id = EXCLUDED.hogar_id,
      rol      = EXCLUDED.rol,
      permisos = EXCLUDED.permisos;

-- 4. Marcar la invitación como aceptada para que no se pueda volver a usar
UPDATE public.invitaciones
SET aceptada = true
WHERE token = 'fb90bb27-38a7-4129-8e10-26ac02b2d8f4';

COMMIT;
