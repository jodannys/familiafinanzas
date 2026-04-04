import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // Si hay un error en la URL que viene de Supabase, lo capturamos
  const authError = searchParams.get('error_description')

  if (authError) {
    console.error('[Auth Callback] Error de Supabase:', authError)
    return NextResponse.redirect(`${origin}/login?auth_error=${encodeURIComponent(authError)}`)
  }

  if (code) {
    // Si es un flujo de recuperación de contraseña, pasar type=recovery para que
    // el middleware no redirija al panel y useAuthFlow muestre el formulario de reset.
    const type = searchParams.get('type')
    const loginUrl = type === 'recovery' ? `${origin}/login?type=recovery` : `${origin}/login`
    const response = NextResponse.redirect(loginUrl)

    // 2. Creamos el cliente usando la lógica de cookies recomendada para Next.js
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Esto es vital: se setea en la request y en la response
              request.cookies.set(name, value)
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // 3. Intercambiamos el código por la sesión
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      console.log('[Auth Callback] Intercambio exitoso. Redirigiendo...')
      return response
    }

    console.error('[Auth Callback] Error en el exchange:', error.message)
    return NextResponse.redirect(`${origin}/login?auth_error=${encodeURIComponent(error.message)}`)
  }

  // Si llegamos aquí sin código, algo salió mal
  return NextResponse.redirect(`${origin}/login?auth_error=No+code+found`)
}