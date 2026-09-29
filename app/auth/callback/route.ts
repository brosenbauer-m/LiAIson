import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/vault?welcome=1'
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/vault?welcome=1'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Email is already confirmed by Supabase at this point; the code exchange can fail
  // if the link was opened in a different browser/device. Ask them to sign in.
  return NextResponse.redirect(`${origin}/login?confirmed=1`)
}