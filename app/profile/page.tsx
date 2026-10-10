import { redirect } from 'next/navigation'

// Profile editing moved into Settings (owner decision 2026-10-10).
export default function ProfileRedirect() {
  redirect('/settings#profile')
}
