'use client'

import { useState } from 'react'
import { useInvestigations } from '@/hooks/useInvestigations'
import { formatDistanceToNow } from 'date-fns'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X } from 'lucide-react'
import type { Investigation } from '@/types'

const STATUS_STYLES: Record<Investigation['status'], string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  archived: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export default function InvestigationsPage() {
  const { investigations, loading, error, total, createInvestigation } = useInvestigations()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    setFormError(null)
    try {
      await createInvestigation({
        title: title.trim(),
        description: description.trim() || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
      setTitle('')
      setDescription('')
      setTags('')
      setOpen(false)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create investigation')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Investigations</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? 'Loading…' : `${total} investigation${total !== 1 ? 's' : ''} total`}
          </p>
        </div>

        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button className="cyber-button-primary flex items-center gap-2">
              <Plus className="h-4 w-4" />
              New Investigation
            </button>
          </Dialog.Trigger>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <Dialog.Title className="text-lg font-semibold text-white">
                  New Investigation
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="text-slate-500 hover:text-slate-300 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>

              {formError && (
                <div className="mb-4 px-3 py-2 rounded-md bg-red-950 border border-red-700 text-red-400 text-sm">
                  {formError}
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    className="cyber-input"
                    placeholder="e.g. Phishing domain analysis"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                  <textarea
                    className="cyber-input resize-none"
                    rows={3}
                    placeholder="Optional notes about the investigation…"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tags</label>
                  <input
                    className="cyber-input"
                    placeholder="phishing, domain (comma-separated)"
                    value={tags}
                    onChange={e => setTags(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="cyber-button-primary flex-1" disabled={creating}>
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                  <Dialog.Close asChild>
                    <button type="button" className="cyber-button-secondary flex-1">Cancel</button>
                  </Dialog.Close>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-md bg-red-950 border border-red-700 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="cyber-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left">
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Tags</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Updated</th>
              <th className="px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Findings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-5 py-3">
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            ) : investigations.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                  No investigations yet. Create one to get started.
                </td>
              </tr>
            ) : (
              investigations.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-100">{inv.title}</div>
                    {inv.description && (
                      <div className="text-xs text-slate-500 mt-0.5 truncate max-w-xs">{inv.description}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 hidden sm:table-cell">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[inv.status]}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {inv.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 hidden lg:table-cell">
                    {formatDistanceToNow(new Date(inv.updated_at), { addSuffix: true })}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 hidden md:table-cell">
                    {inv.findings_count ?? 0}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
