import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { underLimit } from '@/lib/redis'
import { escapeHtml, isEmailConfigured, sendEmail } from '@/lib/email/scaleway'

// "Forgot password": emails a link to /auth/confirm (type=recovery), where the
// person presses a button before the link is used (email scanners that open
// every link can't use it up), then sets a new password on /reset-password.
// Always answers the same, so nobody can find out which emails have accounts.
// Rate-limited per IP and per email address.

const OK = NextResponse.json({ ok: true })

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const [ipOk, emailOk] = await Promise.all([
    underLimit(`pwreset:ip:${ip}`, 10, 3600),
    underLimit(`pwreset:email:${email}`, 3, 3600),
  ])
  if (!ipOk || !emailOk) return OK

  const origin = request.nextUrl.origin
  const supabase = createServiceClient()
  try {
    if (!isEmailConfigured()) {
      // Fallback: Supabase's own reset email.
      await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/callback?next=/reset-password` })
      return OK
    }
    const { data, error } = await supabase.auth.admin.generateLink({ type: 'recovery', email })
    const token = data?.properties?.hashed_token
    if (error || !token) return OK // unknown email: same answer
    const link = `${origin}/auth/confirm?token_hash=${encodeURIComponent(token)}&type=recovery&next=/reset-password`
    await sendEmail({
      from: { email: 'noreply@my-liaison.app', name: 'LiAIson' },
      to: email,
      subject: 'Reset your LiAIson password',
      text: `Someone asked to reset the password of your LiAIson account. If that was you, open this link to choose a new password:\n\n${link}\n\nThe link works for one hour. If it wasn't you, you can ignore this email; your password stays the same.`,
      html: `<p>Someone asked to reset the password of your LiAIson account. If that was you, choose a new password here:</p><p><a href="${escapeHtml(link)}">Reset my password</a></p><p>The link works for one hour. If it wasn't you, you can ignore this email; your password stays the same.</p>`,
    })
  } catch (err) {
    console.error('PASSWORD_RESET_ERROR', err)
  }
  return OK
}
