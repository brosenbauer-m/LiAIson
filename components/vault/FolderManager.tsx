'use client'

import { useState } from 'react'
import type { VaultFolder } from '@/types'

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']

interface FolderManagerProps {
  folders: VaultFolder[]
  onCreate: (name: string, color: string) => Promise<void>
  onUpdate: (id: string, updates: { name?: string; color?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function FolderManager({ folders, onCreate, onUpdate, onDelete }: FolderManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [saving, setSaving] = useState(false)

  const startCreate = () => {
    setEditingId(null)
    setCreating(true)
    setName('')
    setColor(PRESET_COLORS[0])
  }

  const startEdit = (folder: VaultFolder) => {
    setCreating(false)
    setEditingId(folder.id)
    setName(folder.name)
    setColor(folder.color)
  }

  const cancel = () => {
    setCreating(false)
    setEditingId(null)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await onUpdate(editingId, { name: name.trim(), color })
      } else {
        await onCreate(name.trim(), color)
      }
      cancel()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this folder? Entries in it will become unfoldered, not deleted.')) return
    await onDelete(id)
    if (editingId === id) cancel()
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {folders.map(folder => (
          <button
            key={folder.id}
            onClick={() => startEdit(folder)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:border-accent bg-surface text-sm text-text-primary transition-all"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: folder.color }} />
            {folder.name}
          </button>
        ))}
        <button
          onClick={startCreate}
          className="px-3 py-1.5 rounded-full border-2 border-dashed border-border hover:border-accent text-text-secondary hover:text-accent text-sm transition-all"
        >
          + New Folder
        </button>
      </div>

      {(creating || editingId) && (
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border border-border bg-card shadow-soft">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Folder name"
            className="px-3 py-2 rounded-lg border-2 border-border bg-background text-text-primary text-sm flex-1 min-w-[140px]"
          />
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-accent' : ''}`}
                style={{ backgroundColor: c }}
                aria-label={`Choose color ${c}`}
              />
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={cancel}
            className="px-4 py-2 border-2 border-border hover:border-accent text-text-secondary hover:text-accent text-sm font-medium rounded-lg transition-all"
          >
            Cancel
          </button>
          {editingId && (
            <button
              onClick={() => handleDelete(editingId)}
              className="px-4 py-2 border-2 border-error/30 hover:bg-error/10 text-error text-sm font-medium rounded-lg transition-all"
            >
              Delete Folder
            </button>
          )}
        </div>
      )}
    </div>
  )
}