'use client'

import { useState } from 'react'
import { useTools, useToolRunner } from '@/hooks/useTools'
import type { Tool, ToolCategory, RiskLevel, ToolInputField, ToolResult } from '@/types'
import * as Dialog from '@radix-ui/react-dialog'
import { Wrench, Key, X, Play, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const CATEGORY_LABELS: Record<ToolCategory, string> = {
  email: 'Email',
  domain: 'Domain',
  ip: 'IP',
  username: 'Username',
  phone: 'Phone',
  metadata: 'Metadata',
  social: 'Social',
  security: 'Security',
}

const CATEGORY_ICONS: Record<ToolCategory, string> = {
  email: '✉️',
  domain: '🌐',
  ip: '📡',
  username: '👤',
  phone: '📱',
  metadata: '🗂️',
  social: '🔗',
  security: '🔒',
}

const ALL = 'all'

function formatToolName(name: string) {
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function ToolsPage() {
  const { tools, loading } = useTools()
  const [activeCategory, setActiveCategory] = useState<ToolCategory | typeof ALL>(ALL)
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)

  const categories: ToolCategory[] = ['email', 'domain', 'ip', 'username', 'phone', 'metadata', 'social', 'security']

  const filtered =
    activeCategory === ALL ? tools : tools.filter(t => t.category === activeCategory)

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">OSINT Tools</h1>
        <p className="text-slate-400 text-sm mt-1">
          {tools.length} tools across {categories.length} categories. Tap any tool to run it.
        </p>
      </div>

      {/* Category filter — horizontally scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap scrollbar-hide">
        <CategoryBtn value={ALL} active={activeCategory === ALL} onClick={() => setActiveCategory(ALL)} label="All" emoji="🛠️" />
        {categories.map(cat => (
          <CategoryBtn
            key={cat}
            value={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            label={CATEGORY_LABELS[cat]}
            emoji={CATEGORY_ICONS[cat]}
          />
        ))}
      </div>

      {/* Tools grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cyber-card p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="cyber-card p-10 text-center">
          <Wrench className="h-10 w-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">No tools in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filtered.map(tool => (
            <button
              key={tool.tool_name}
              onClick={() => setSelectedTool(tool)}
              className="cyber-card p-4 md:p-5 flex flex-col gap-3 hover:border-cyan-600/60 hover:bg-slate-800/40 active:bg-slate-800/70 transition-all cursor-pointer text-left group focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{CATEGORY_ICONS[tool.category as ToolCategory] ?? '🛠️'}</span>
                  <h3 className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {formatToolName(tool.tool_name)}
                  </h3>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${RISK_STYLES[tool.risk_level]}`}>
                  {tool.risk_level}
                </span>
              </div>

              <p className="text-xs text-slate-400 flex-1 line-clamp-3 leading-relaxed">{tool.description}</p>

              <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {CATEGORY_LABELS[tool.category as ToolCategory] ?? tool.category}
                </span>
                <div className="flex items-center gap-2">
                  {tool.requires_api_key && (
                    <span className="flex items-center gap-1 text-xs text-amber-400">
                      <Key className="h-3 w-3" />
                      API key
                    </span>
                  )}
                  <span className="text-xs text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <Play className="h-3 w-3" />
                    Run
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Tool Run Modal */}
      {selectedTool && (
        <ToolRunModal tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}
    </div>
  )
}

// ─── Tool Run Modal ───────────────────────────────────────────────────────────

function ToolRunModal({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const { runTool, running, result, error, clearResult } = useToolRunner()
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(tool.input_schema.map(f => [f.name, '']))
  )
  const [showRaw, setShowRaw] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearResult()
    const input: Record<string, unknown> = {}
    for (const field of tool.input_schema) {
      const val = fieldValues[field.name]
      if (val !== '') input[field.name] = val
    }
    await runTool(tool.tool_name, input)
  }

  const handleClose = () => {
    clearResult()
    onClose()
  }

  const toolLabel = formatToolName(tool.tool_name)

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) handleClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl">{CATEGORY_ICONS[tool.category as ToolCategory] ?? '🛠️'}</span>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-white truncate">
                  {toolLabel}
                </Dialog.Title>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{tool.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${RISK_STYLES[tool.risk_level]}`}>
                {tool.risk_level}
              </span>
              <Dialog.Close asChild>
                <button className="p-1 text-slate-500 hover:text-slate-200 transition-colors rounded-lg hover:bg-slate-800" onClick={handleClose}>
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
            {/* API key warning */}
            {tool.requires_api_key && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/40 border border-amber-700/40 text-amber-400 text-xs">
                <Key className="h-3.5 w-3.5 shrink-0" />
                This tool requires an API key configured on the server.
              </div>
            )}

            {/* Input form */}
            <form id="tool-form" onSubmit={handleSubmit} className="space-y-3">
              {tool.input_schema.length === 0 ? (
                <p className="text-sm text-slate-400">This tool requires no input.</p>
              ) : (
                tool.input_schema.map(field => (
                  <ToolField
                    key={field.name}
                    field={field}
                    value={fieldValues[field.name] ?? ''}
                    onChange={val => setFieldValues(prev => ({ ...prev, [field.name]: val }))}
                  />
                ))
              )}
            </form>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-950/50 border border-red-700/40 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Result
                </div>
                <div className="rounded-xl bg-slate-950 border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowRaw(r => !r)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors border-b border-slate-800"
                  >
                    <span>Raw JSON</span>
                    {showRaw ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                  {showRaw && (
                    <pre className="p-3 text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all max-h-60 overflow-y-auto">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  )}
                  {!showRaw && (
                    <ResultSummary result={result} />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-3">
            <button
              type="submit"
              form="tool-form"
              disabled={running}
              className="cyber-button-primary flex-1 flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running…
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Tool
                </>
              )}
            </button>
            <button type="button" className="cyber-button-secondary" onClick={handleClose}>
              Close
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ─── Tool Input Field ─────────────────────────────────────────────────────────

function ToolField({
  field,
  value,
  onChange,
}: {
  field: ToolInputField
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">
        {field.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        {field.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {field.description && (
        <p className="text-xs text-slate-500 mb-1.5">{field.description}</p>
      )}
      {field.type === 'textarea' ? (
        <textarea
          className="cyber-input resize-none"
          rows={4}
          placeholder={field.placeholder ?? `Enter ${field.name}…`}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={field.required}
        />
      ) : field.type === 'select' && field.options ? (
        <select
          className="cyber-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          required={field.required}
        >
          <option value="">Select…</option>
          {field.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          className="cyber-input"
          type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'}
          placeholder={field.placeholder ?? `Enter ${field.name}…`}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={field.required}
        />
      )}
    </div>
  )
}

// ─── Result Summary ───────────────────────────────────────────────────────────

function ResultSummary({ result }: { result: ToolResult }) {
  // Prefer the `result` sub-object when available; fall back to all top-level keys
  const dataEntries: [string, unknown][] = result.result && typeof result.result === 'object'
    ? Object.entries(result.result as Record<string, unknown>)
    : Object.entries(result).filter(([k]) => !['tool', 'input', 'risk_level', 'disclaimer', 'timestamp'].includes(k))
  const disclaimer = result.disclaimer != null ? String(result.disclaimer) : null
  const timestamp = result.timestamp != null ? String(result.timestamp) : null

  if (dataEntries.length === 0) {
    return (
      <p className="px-3 py-3 text-xs text-slate-500">No data returned.</p>
    )
  }

  return (
    <div className="divide-y divide-slate-800">
      {result.risk_level && (
        <div className="px-3 py-2 flex items-start gap-3">
          <span className="text-xs text-slate-500 font-medium w-28 shrink-0 mt-0.5 capitalize">risk level</span>
          <span className="text-xs text-slate-200 break-all">{String(result.risk_level)}</span>
        </div>
      )}
      {dataEntries.map(([key, val]) => (
        <div key={key} className="px-3 py-2 flex items-start gap-3">
          <span className="text-xs text-slate-500 font-medium w-28 shrink-0 mt-0.5 capitalize">
            {key.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-slate-200 break-all">
            {Array.isArray(val)
              ? val.length === 0 ? '—' : val.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
              : typeof val === 'object' && val !== null
              ? JSON.stringify(val)
              : String(val ?? '—')}
          </span>
        </div>
      ))}
      {(disclaimer || timestamp) && (
        <div className="px-3 py-2 text-xs text-slate-600">
          {disclaimer && <p>{disclaimer}</p>}
          {timestamp && <p className="mt-0.5">{timestamp}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Category Button ──────────────────────────────────────────────────────────

function CategoryBtn({
  value,
  active,
  onClick,
  label,
  emoji,
}: {
  value: string
  active: boolean
  onClick: () => void
  label: string
  emoji?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-colors shrink-0 ${
        active
          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300 active:bg-slate-700'
      }`}
    >
      {emoji && <span>{emoji}</span>}
      {label}
    </button>
  )
}
