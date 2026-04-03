-- =====================================================================
-- FIX: Trigger on_auth_user_created
--
-- Problema anterior:
--   - Usaba NEW.raw_user_meta_data->>'full_name' (nosotros guardamos 'nombre')
--   - Usaba email prefix para nombre_hogar ('Familia jodannysaliendres')
--   - No detectaba usuarios invitados → creaba hogar por error
--
-- Esta versión:
--   1. Lee 'nombre' y 'nombre_hogar' del user_metadata
--   2. Salta si hay invitación pendiente para ese email
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

  -- Leer nombre y nombre_hogar del user_metadata
  v_nombre := COALESCE(
    NEW.raw_user_meta_data->>'nombre',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  v_nombre_hogar := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'nombre_hogar'), ''),
    'Mi Familia'
  );

  -- Crear hogar con el nombre real que el admin escribió
  INSERT INTO public.hogares (nombre_hogar)
  VALUES (v_nombre_hogar)
  RETURNING id INTO v_hogar;

  -- Crear perfil admin con todos los permisos
  INSERT INTO public.perfiles (id, hogar_id, nombre, rol, permisos)
  VALUES (
    NEW.id,
    v_hogar,
    v_nombre,
    'admin',
    '{"gastos":true,"presupuesto":true,"metas":true,"inversiones":true,"deudas":true,"agenda":true,"hipoteca":true,"reportes":true,"sobres":true,"tarjetas":true,"inmuebles":true}'::jsonb
  );

  RETURN NEW;
END;
$$;

-- Recrear el trigger (ya existía, solo se reemplaza la función)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.on_auth_user_created();
