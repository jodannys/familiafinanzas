import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Archivos estáticos y rutas internas de Next.js
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|json|woff|woff2|ttf)$/)
  ) {
    return NextResponse.next()
  }

  // Login y callback de OAuth siempre accesibles
  if (pathname === '/login' || pathname === '/auth/callback') {
    return NextResponse.next()
  }

  // Verificar si existe alguna cookie de sesión de Supabase
  const cookies = request.cookies.getAll()
  const hasSession = cookies.some(
    c => c.name.startsWith('sb-') && c.name.includes('-auth-token')
  )

  if (!hasSession) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
