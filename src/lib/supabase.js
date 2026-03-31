import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

// Cambiamos el 'throw' por un console.warn para que no rompa el Build
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Advertencia: Faltan variables de Supabase en el entorno actual.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: async (name, acquireTimeout, fn) => {
      try {
        if (typeof window === 'undefined' || !window.navigator?.locks) return fn()
        return await window.navigator.locks.request(name, { timeout: acquireTimeout }, fn)
      } catch (e) {
        if (e?.message?.includes('lock broken') || e?.name === 'NotSupportedError') {
          return fn()
        }
        throw e
      }
    },
  },
})

// Auth helpers
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getUser() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  } catch (e) {
    return null
  }
}