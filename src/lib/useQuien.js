import { useState, useEffect } from 'react'
import { supabase } from './supabase'

/**
 * Hook que construye las opciones de "¿Quién?" a partir de
 * los miembros registrados en `perfiles` del mismo hogar.
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
      const { data } = await supabase
        .from('perfiles')
        .select('nombre')
        .order('created_at')

      setPerfiles((data || []).map(p => p.nombre))
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
