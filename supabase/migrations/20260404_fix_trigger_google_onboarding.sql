-- =====================================================================
-- FIX: Trigger on_auth_user_created — no crear perfil para usuarios OAuth (Google)
--
-- Problema:
--   El trigger usaba 'full_name' como fallback, lo que hacía que los usuarios
--   de Google tuvieran su perfil creado automáticamente, saltándose el
--   formulario de bienvenida donde el usuario elige su nombre y nombre de familia.
--
-- Fix:
--   Solo auto-crear el perfil si el usuario tiene 'nombre' explícito en sus
--   metadatos (lo que solo ocurre en el registro por email, no con OAuth).
--   Si no hay 'nombre', el trigger se detiene y deja que useAuthFlow muestre
--   el formulario de onboarding (modo 'nombre').
-- =====================================================================

CREATE OR REPLACE FUNCTION public.on_auth_user_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_hogar        uuid;
  v_nombre       text;
  v_nombre_hogar text;
BEGIN
  -- Ya tiene perfil: no hacer nada
  IF EXISTS (SELECT 1 FROM public.perfiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Es usuario invitado: aceptar_invitacion creará el perfil después
  IF EXISTS (
    SELECT 1 FROM public.invitaciones
    WHERE lower(trim(email)) = lower(trim(NEW.email))
      AND NOT aceptada
      AND expires_at > now()
  ) THEN
    RETURN NEW;
  END IF;

  -- Solo auto-crear si el usuario registró 'nombre' explícitamente (registro por email).
  -- Usuarios de Google u OAuth no tienen 'nombre' aquí → se omite y useAuthFlow
  -- los dirige al formulario de bienvenida (modo 'nombre').
  v_nombre := NEW.raw_user_meta_data->>'nombre';

  IF v_nombre IS NULL OR trim(v_nombre) = '' THEN
    RETURN NEW;
  END IF;

  v_nombre_hogar := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nombre_hogar'), ''),
    'Mi Familia'
  );

  -- Crear hogar
  INSERT INTO public.hogares (nombre_hogar)
  VALUES (v_nombre_hogar)
  RETURNING id INTO v_hogar;

  -- Crear perfil admin
  INSERT INTO public.perfiles (id, hogar_id, nombre, rol, permisos)
  VALUES (
    NEW.id,
    v_hogar,
    trim(v_nombre),
    'admin',
    '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":true,"reportes":true,"sobres":true,"tarjetas":true,"inmuebles":true}'::jsonb
  );

  RETURN NEW;
END;
$$;
