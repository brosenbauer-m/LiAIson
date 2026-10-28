import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/access'
import AdminNav from './AdminNav'

// The admin console (owner decision 2026-10-28): only the one admin account
// gets in; everyone else is sent to their dashboard. No LiAIson features here.

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await requireAdmin())) redirect('/dashboard')
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-10 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-medium tracking-tight text-text-primary">Admin</h1>
            <p className="text-text-secondary mt-1">Event codes, accounts and the numbers.</p>
          </div>
          <AdminNav />
        </div>
        {children}
      </div>
    </div>
  )
}
