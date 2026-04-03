import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  const response = NextResponse.redirect(origin)

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          ),
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
  }

  return response
}
