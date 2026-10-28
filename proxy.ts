import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { needsCard } from '@/lib/billing/access'
import { isAdminUser } from '@/lib/admin/access'

const protectedRoutes = ['/dashboard', '/vault', '/profile', '/settings']
// Pages that need a saved card once the free month is over (see lib/billing/access.ts).
const cardRequiredRoutes = ['/dashboard', '/vault', '/profile', '/settings', '/connections', '/discover', '/echoes', '/similarities', '/circles']

export async function proxy(request: NextRequest) {
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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = protectedRoutes.some(r => path.startsWith(r))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', path)
    return NextResponse.redirect(url)
  }

  // The admin account lives at /admin only; nobody else gets in there.
  if (user && !path.startsWith('/api/') && !path.startsWith('/auth/')) {
    const admin = await isAdminUser(user.id).catch(() => false)
    const onAdmin = path === '/admin' || path.startsWith('/admin/')
    if (admin !== onAdmin && path !== '/' && path !== '/privacy' && path !== '/logout') {
      const url = request.nextUrl.clone()
      url.pathname = admin ? '/admin' : '/dashboard'
      url.search = ''
      const redirect = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(c => redirect.cookies.set(c))
      return redirect
    }
    if (admin) return supabaseResponse
  }

  if (user && cardRequiredRoutes.some(r => path === r || path.startsWith(`${r}/`))) {
    if (await needsCard(user.id).catch(() => false)) {
      const url = request.nextUrl.clone()
      url.pathname = '/billing/setup'
      url.search = ''
      const redirect = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(c => redirect.cookies.set(c))
      return redirect
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
