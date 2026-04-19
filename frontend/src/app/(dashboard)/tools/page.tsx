'use client'

import { useState } from 'react'
import { useTools } from '@/hooks/useTools'
import type { ToolCategory, RiskLevel } from '@/types'
import { Wrench } from 'lucide-react'

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
}

const ALL = 'all'

export default function ToolsPage() {
  const { tools, loading, error } = useTools()
  const [activeCategory, setActiveCategory] = useState<ToolCategory | typeof ALL>(ALL)

  const categories: ToolCategory[] = ['email', 'domain', 'ip', 'username', 'phone', 'metadata', 'social']

  const filtered =
    activeCategory === ALL ? tools : tools.filter(t => t.category === activeCategory)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">OSINT Tools</h1>
        <p className="text-slate-400 text-sm mt-1">Run investigations across a variety of data sources.</p>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <CategoryBtn value={ALL} active={activeCategory === ALL} onClick={() => setActiveCategory(ALL)} label="All" />
        {categories.map(cat => (
          <CategoryBtn
            key={cat}
            value={cat}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
            label={CATEGORY_LABELS[cat]}
          />
        ))}
      </div>

      {/* Tools grid */}
      {error && (
        <div className="px-4 py-3 rounded-md bg-red-950 border border-red-700 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cyber-card p-5 animate-pulse h-36" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 text-sm">No tools available in this category.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(tool => (
            <div key={tool.tool_name} className="cyber-card p-5 flex flex-col gap-3 hover:border-cyan-700 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-cyan-400 shrink-0" />
                  <h3 className="text-sm font-semibold text-white">{tool.tool_name.replace(/_/g, ' ')}</h3>
                </div>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${RISK_STYLES[tool.risk_level]}`}>
                  {tool.risk_level}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex-1 line-clamp-3">{tool.description}</p>
              <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                  {CATEGORY_LABELS[tool.category]}
                </span>
                {tool.requires_api_key && (
                  <span className="text-xs text-amber-400">API key required</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryBtn({
  value,
  active,
  onClick,
  label,
}: {
  value: string
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
        active
          ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}
