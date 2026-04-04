import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Creamos la respuesta inicial
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
       setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Actualiza las cookies en la request
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

          // IMPORTANTE: Debemos RECREAR la respuesta para que Next.js registre los cambios
          supabaseResponse = NextResponse.next({
            request,
          })

          // Aplicamos las cookies a la respuesta recién creada
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  // Archivos estáticos públicos y callback — pasar sin procesar auth
  if (
    pathname === '/manifest.json' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname.startsWith('/auth/callback')
  ) {
    return NextResponse.next()
  }

  // getUser() dispara el refresco del token y ejecuta setAll() si es necesario
  const { data: { user } } = await supabase.auth.getUser()

  // ── Lógica de rutas ──────────────────────────────────────────────

  if (!user && pathname !== '/login') {
    const redirectUrl = new URL('/login', request.url)
    const response = NextResponse.redirect(redirectUrl)
    
    // TRUCO VITAL: Copiar las cookies de supabaseResponse a la nueva respuesta de redirección
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value)
    })
    
    return response
  }

  if (user && pathname === '/login') {
    const nombreGuardado = user.user_metadata?.nombre
    const type = request.nextUrl.searchParams.get('type')
    // Dejar pasar si: onboarding pendiente (Google) o flujo de recuperación de contraseña
    if (!nombreGuardado || type === 'recovery') {
      return supabaseResponse
    }

    const redirectUrl = new URL('/', request.url)
    const response = NextResponse.redirect(redirectUrl)

    // Copiar las cookies aquí también para no perder sesiones recién refrescadas
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie.name, cookie.value)
    })

    return response
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Excluye todas las rutas que NO deben ser procesadas por el middleware:
     * - _next/static, _next/image (archivos internos de Next.js)
     * - favicon.ico, manifest.json, sitemap.xml, robots.txt (metadatos)
     * - Archivos de imagen y otros estáticos
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|webmanifest)$).*)',
  ],
}