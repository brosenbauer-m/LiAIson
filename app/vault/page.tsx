'use client'

import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import VaultSectionCard from '@/components/vault/VaultSectionCard'
import FolderManager from '@/components/vault/FolderManager'
import FileImport, { type ImportTarget } from '@/components/vault/FileImport'
import type { VaultSection, VaultFolder } from '@/types'
import { placementFields, placementHelp, placementLabel, placementOf, type CustomCircle, type Placement } from '@/lib/circles'

const countChars = (text: string | null | undefined) => Array.from(text ?? '').length

function limitMessage(limit: number): string {
  return `This doesn't fit in your Vault. Your plan allows up to ${limit.toLocaleString('en-GB')} characters in total. Shorten some text, or get more space with a higher plan.`
}

const SECTION_HINTS: Record<string, string> = {
  skills: "Try describing not just what tools you know, but what problems you're best at solving.",
  current_role: "Include your title, company, and what you're working on day-to-day.",
  work_history: "Highlight key roles, what you achieved, and what you learned.",
  bio: "Write as you'd introduce yourself to someone you just met — warm and genuine.",
  values: "What principles guide your decisions? What do you care about deeply?",
  looking_for: "Be specific about what kind of people or opportunities you're seeking.",
  hobbies: "Don't just list activities — share what excites you about them.",
}

type Tab = Placement

// Keeps the Discover search index up to date (only Outer Circle content of
// Public + Discoverable profiles is ever indexed). Fire and forget.
const refreshSearchIndex = () => {
  void fetch('/api/discover/index', { method: 'POST' }).catch(() => {})
}

export default function VaultPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const welcome = searchParams.get('welcome') === '1'

  const [sections, setSections] = useState<VaultSection[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('outer')
  const [showWelcome, setShowWelcome] = useState(welcome)
  const [userId, setUserId] = useState<string | null>(null)
  const [folders, setFolders] = useState<VaultFolder[]>([])
  const [vaultLimit, setVaultLimit] = useState<number | null>(null)
  // Inner Circle only on plans with two circles (Ambivert / Extrovert).
  const [innerAllowed, setInnerAllowed] = useState(false)
  // Own circles (Social Butterfly), managed on the Connections page.
  const [customCircles, setCustomCircles] = useState<CustomCircle[]>([])
  const [limitHit, setLimitHit] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Loaded first: on a one-circle plan this also turns Inner Circle sections into drafts.
      const planRes = await fetch('/api/plan', { cache: 'no-store' }).catch(() => null)
      if (planRes?.ok) {
        const plan = await planRes.json() as { vaultLimit?: number; circles?: number }
        if (typeof plan.vaultLimit === 'number') setVaultLimit(plan.vaultLimit)
        setInnerAllowed(plan.circles === 2)
      }
      const circlesRes = await fetch('/api/circles', { cache: 'no-store' }).catch(() => null)
      if (circlesRes?.ok) {
        const data = await circlesRes.json() as { extraCircles: number; circles: CustomCircle[] }
        setCustomCircles(data.extraCircles > 0 ? data.circles.map(c => ({ id: c.id, name: c.name })) : [])
      }

      const { data, error } = await supabase
        .from('vault_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('domain', { ascending: true })

      if (error) {
        setErrorMessage("Couldn't load your vault — please refresh")
        setLoading(false)
        return
      }
      setSections(data as VaultSection[] ?? [])

      const { data: folderData } = await supabase
        .from('vault_folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      setFolders(folderData as VaultFolder[] ?? [])

      setLoading(false)
    }
    load()
  }, [])

  const updateSection = useCallback(async (id: string, updates: Partial<VaultSection>) => {
    setErrorMessage(null)
    setLimitHit(false)
    const { data, error } = await supabase
      .from('vault_sections')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      const limit = /VAULT_LIMIT:(\d+)/.exec(error.message ?? '')
      if (limit) {
        setLimitHit(true)
        setErrorMessage(limitMessage(Number(limit[1])))
      } else {
        setErrorMessage("Couldn't save this section — please try again")
      }
      throw error
    }

    if (data) {
      setSections(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
    }
    refreshSearchIndex()
  }, [supabase])

  const deleteSection = useCallback(async (id: string) => {
    setErrorMessage(null)
    const { error } = await supabase
      .from('vault_sections')
      .delete()
      .eq('id', id)

    if (error) {
      setErrorMessage("Couldn't delete this section — please try again")
      throw error
    }

    setSections(prev => prev.filter(section => section.id !== id))
  }, [supabase])

  const createFolder = useCallback(async (name: string, color: string) => {
    if (!userId) return
    const { data, error } = await supabase
      .from('vault_folders')
      .insert({ user_id: userId, name, color })
      .select()
      .single()
    if (error) { setErrorMessage("Couldn't create folder — please try again"); return }
    if (data) setFolders(prev => [...prev, data as VaultFolder])
  }, [supabase, userId])

  const updateFolder = useCallback(async (id: string, updates: { name?: string; color?: string }) => {
    const { data, error } = await supabase
      .from('vault_folders')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) { setErrorMessage("Couldn't update folder — please try again"); return }
    if (data) setFolders(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
  }, [supabase])

  const deleteFolder = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('vault_folders')
      .delete()
      .eq('id', id)
    if (error) { setErrorMessage("Couldn't delete folder — please try again"); return }
    setFolders(prev => prev.filter(f => f.id !== id))
    setSections(prev => prev.map(s => s.folder_id === id ? { ...s, folder_id: null } : s))
  }, [supabase])

  const addCustomSection = async () => {
    if (!userId) return
    const label = prompt('Section name:')
    if (!label) return

    const { data, error } = await supabase
      .from('vault_sections')
      .insert({
        user_id: userId,
        domain: 'custom',
        is_professional: false,
        is_personal: false,
        ...placementFields(activeTab),
        section_type: 'custom',
        label,
        content: '',
        source: 'manual',
      })
      .select()
      .single()

    if (error) {
      setErrorMessage("Couldn't add this section — please try again")
      return
    }

    if (data) setSections(prev => [...prev, data as VaultSection])
  }


  const saveImportedSection = async (label: string, content: string, target: ImportTarget): Promise<true | string> => {
    if (!userId) return "Couldn't save this section — please try again."
    setErrorMessage(null)
    const { data, error } = await supabase
      .from('vault_sections')
      .insert({
        user_id: userId,
        domain: 'custom',
        is_professional: false,
        is_personal: false,
        ...placementFields(target),
        section_type: 'custom',
        label,
        content,
        source: 'file_extracted',
      })
      .select()
      .single()

    if (error || !data) {
      const limit = /VAULT_LIMIT:(\d+)/.exec(error?.message ?? '')
      return limit ? limitMessage(Number(limit[1])) : "Couldn't save this section — please try again."
    }
    setSections(prev => [...prev, data as VaultSection])
    setActiveTab(target)
    refreshSearchIndex()
    return true
  }

  const totalChars = sections.reduce((n, s) => n + countChars(s.content), 0)
  const usedPct = vaultLimit ? Math.min(100, Math.round((totalChars / vaultLimit) * 100)) : 0

  const filtered = sections.filter(section => placementOf(section) === activeTab)
  const tabs: Tab[] = [
    'outer',
    ...(innerAllowed || sections.some(s => s.circle === 'inner') ? ['inner' as const] : []),
    ...customCircles.map(c => `c:${c.id}` as const),
    'draft',
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-text-secondary">Loading your vault...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Welcome Modal */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-xl p-8 max-w-md w-full shadow-card">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-text-primary mb-3">Welcome to your Vault!</h2>
            <p className="text-text-secondary text-base mb-6 leading-relaxed">
              This is where you feed your LiAIson. The more you add, the better it can represent you. Start with a few sections and build from there.
            </p>
            <button
              onClick={() => setShowWelcome(false)}
              className="w-full py-3 bg-accent hover:bg-accent-light text-white font-semibold rounded-lg transition-all shadow-soft"
            >
              Let&apos;s go! →
            </button>
          </div>
        </div>
      )}



      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">My Vault</h1>
            <p className="text-text-secondary text-lg mt-2">Your LiAIson only knows what you put here</p>
          </div>
          <div className="flex flex-col items-end">
            <FileImport defaultTarget={activeTab} innerAllowed={innerAllowed} customCircles={customCircles} onSave={saveImportedSection} />
          </div>
        </div>

        {vaultLimit !== null && (
          <div className="mb-6 space-y-1.5">
            <div className="flex justify-between gap-4 text-xs text-text-secondary">
              <span>Vault space</span>
              <span className="tabular-nums">
                {totalChars.toLocaleString('en-GB')} of {vaultLimit.toLocaleString('en-GB')} characters used
              </span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden" aria-hidden="true">
              <div className={`h-full ${usedPct >= 100 ? 'bg-error' : 'bg-accent'}`} style={{ width: `${usedPct}%` }} />
            </div>
            {usedPct >= 90 && (
              <p className="text-xs text-text-secondary">
                {totalChars > vaultLimit
                  ? 'Your Vault is over the limit of your plan. You can shorten text, but not add more.'
                  : 'Your Vault is almost full.'}{' '}
                <Link href="/plans" className="text-accent hover:underline">Get more space with a higher plan</Link>
              </p>
            )}
          </div>
        )}

        {errorMessage && (
          <p role="alert" className="mb-5 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {errorMessage}
            {limitHit && <> <Link href="/plans" className="underline font-medium">See plans</Link></>}
          </p>
        )}

        <FolderManager folders={folders} onCreate={createFolder} onUpdate={updateFolder} onDelete={deleteFolder} />

        {/* Tabs: one per circle */}
        <div className="flex flex-wrap gap-1 mb-3 bg-surface border border-border rounded-lg p-1 w-fit max-w-full shadow-soft">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-accent text-white shadow-soft'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {placementLabel(tab, customCircles)}
            </button>
          ))}
        </div>
        <p className="mb-8 text-sm text-text-secondary">
          {placementHelp(activeTab, customCircles)}
          {!innerAllowed && activeTab === 'outer' && (
            <> With Ambivert or Extrovert you can also share some things only with people you choose. <Link href="/plans#circles" className="text-accent hover:underline">Learn more</Link></>
          )}
        </p>

        {/* Sections */}
        <div className="space-y-5">
          {filtered.map(section => (
            <VaultSectionCard
              key={section.id}
              section={section}
              onUpdate={updateSection}
              onDelete={deleteSection}
              hint={SECTION_HINTS[section.section_type]}
              innerAllowed={innerAllowed}
              customCircles={customCircles}
              roomLeft={vaultLimit === null ? undefined : vaultLimit - (totalChars - countChars(section.content))}
            />
          ))}
        </div>

        {/* Add custom section */}
        <button
          onClick={addCustomSection}
          className="mt-6 w-full py-4 border-2 border-dashed border-border hover:border-accent hover:bg-accent-tint text-text-secondary hover:text-accent rounded-xl text-sm font-medium transition-all"
        >
          + Add Custom Section
        </button>
      </div>
    </div>
  )
}
