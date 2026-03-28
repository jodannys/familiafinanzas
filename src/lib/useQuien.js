import { useState, useEffect } from 'react'
import { supabase } from './supabase'

/**
 * Hook que construye las opciones de "¿Quién?" a partir de:
 *  1. Los usuarios registrados en `perfiles_familia` (se puebla automáticamente al hacer login)
 *  2. El nombre del usuario actual (user_metadata.nombre) como fallback
 *
 * - 1 miembro  → opciones: [{ id: nombre, label: nombre }]
 *               default: ese nombre
 * - 2+ miembros → opciones: [...miembros, { id: 'Ambos', label: 'Ambos' }]
 *               default: 'Ambos'
 */
export function useQuien() {
  const [perfiles, setPerfiles] = useState([])
  const [loadingQuien, setLoadingQuien] = useState(true)

  useEffect(() => {
    async function cargar() {
      // Obtener nombre del usuario actual desde auth (siempre disponible)
      const { data: { user } } = await supabase.auth.getUser()
      const nombreActual = user?.user_metadata?.nombre

      // Leer todos los perfiles registrados
      const { data } = await supabase
        .from('perfiles_familia')
        .select('nombre')
        .order('created_at')

      let nombres = (data || []).map(p => p.nombre)

      // Si el usuario actual tiene nombre pero aún no está en la tabla, añadirlo
      if (nombreActual && !nombres.includes(nombreActual)) {
        // Sincronizar en background para futuros accesos
        supabase.from('perfiles_familia').upsert(
          { nombre: nombreActual },
          { onConflict: 'nombre', ignoreDuplicates: true }
        )
        nombres = [...nombres, nombreActual]
      }

      setPerfiles(nombres)
      setLoadingQuien(false)
    }

    cargar()
  }, [])

  const opcionesQuien =
    perfiles.length === 0
      ? []
      : perfiles.length === 1
        ? [{ id: perfiles[0], label: perfiles[0] }]
        : [
            ...perfiles.map(n => ({ id: n, label: n })),
            { id: 'Ambos', label: 'Ambos' },
          ]

  const defaultQuien = perfiles.length === 1 ? perfiles[0] : 'Ambos'

  return { opcionesQuien, defaultQuien, loadingQuien }
}
