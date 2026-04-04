import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('⚠️ Advertencia: Faltan variables de Supabase en el entorno actual.')
}

// createBrowserClient guarda la sesión en cookies (no localStorage),
// lo que permite que el middleware SSR la lea correctamente.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

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

// ── Invitaciones ──────────────────────────────────────────────────

/**
 * Valida un token de invitación sin necesitar sesión activa.
 * @returns {{ valida, email, nombre_hogar, error }}
 */
export async function validarTokenInvitacion(token) {
  const { data, error } = await supabase.rpc('validar_token_invitacion', { p_token: token })
  if (error) return { valida: false, error: error.message }
  return data
}

/**
 * Crea el hogar + perfil admin para un usuario recién registrado (sin token).
 * @param {string} nombre        - Nombre personal del admin
 * @param {string} nombreFamilia - Nombre del hogar (ej: "Familia Quintero")
 */
export async function inicializarHogar(nombre, nombreFamilia) {
  const { data, error } = await supabase.rpc('inicializar_hogar', {
    p_nombre: nombre,
    p_nombre_hogar: nombreFamilia,
  })
  return { data, error }
}

/**
 * Vincula el usuario recién registrado al hogar de la invitación.
 * Debe llamarse después de signUp con sesión activa.
 */
export async function aceptarInvitacion(token, nombre) {
  const { data, error } = await supabase.rpc('aceptar_invitacion', {
    p_token: token,
    p_nombre: nombre,
  })
  return { data, error }
}

/**
 * Crea un link de invitación para un email.
 * @returns {{ ok, token, link, error }}
 */
export async function crearInvitacion(email) {
  const { data, error } = await supabase.rpc('crear_invitacion', {
    p_email: email,
  })
  return { data, error }
}

/**
 * Devuelve { hogar_id, nombre, nombre_hogar } del usuario autenticado.
 */
export async function getMisPermisos() {
  const { data, error } = await supabase.rpc('get_mis_permisos')
  return { data, error }
}

// ── Filtro Admin ──────────────────────────────────────────────────

/**
 * Admin: obtiene movimientos de un usuario específico del hogar.
 * @param {string} userId   - UUID del miembro a consultar
 * @param {object} filtros  - { desde, hasta, categoria, tipo, limite }
 */
export async function getMovimientosPorUsuario(userId, filtros = {}) {
  const { data, error } = await supabase.rpc('get_movimientos_por_usuario', {
    p_user_id:   userId,
    p_desde:     filtros.desde     ?? null,
    p_hasta:     filtros.hasta     ?? null,
    p_categoria: filtros.categoria ?? null,
    p_tipo:      filtros.tipo      ?? null,
    p_limite:    filtros.limite    ?? 200,
  })
  return { data, error }
}