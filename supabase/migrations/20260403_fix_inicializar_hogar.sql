-- =====================================================================
-- MIGRACIÓN: Corrige inicializar_hogar para recibir el nombre del hogar
-- Fecha: 2026-04-03
-- Problema: la versión anterior hardcodeaba 'Mi Familia' y no aceptaba
--           el nombre real que el administrador escribe al registrarse.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.inicializar_hogar(
  p_nombre       text,
  p_nombre_hogar text DEFAULT 'Mi Familia'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hogar_id uuid;
BEGIN
  -- Idempotente: si ya tiene perfil, no hacer nada
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid()) THEN
    SELECT hogar_id INTO v_hogar_id FROM public.perfiles WHERE id = auth.uid();
    RETURN jsonb_build_object('ok', true, 'hogar_id', v_hogar_id, 'ya_existia', true);
  END IF;

  -- Crear hogar con el nombre que eligió el admin
  INSERT INTO public.hogares (nombre_hogar, plan_tipo)
  VALUES (p_nombre_hogar, 'free')
  RETURNING id INTO v_hogar_id;

  -- Crear perfil como admin con todos los permisos
  INSERT INTO public.perfiles (id, hogar_id, nombre, rol, permisos)
  VALUES (
    auth.uid(),
    v_hogar_id,
    p_nombre,
    'admin',
    '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":true,"reportes":true}'::jsonb
  );

  RETURN jsonb_build_object('ok', true, 'hogar_id', v_hogar_id, 'ya_existia', false);
END;
$$;

COMMIT;
