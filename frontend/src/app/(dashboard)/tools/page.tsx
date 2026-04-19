'use client'

import { useState } from 'react'
import { useTools } from '@/hooks/useTools'
import type { ToolCategory, RiskLevel } from '@/types'
import { Wrench, Key } from 'lucide-react'

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

export default function ToolsPage() {
  const { tools, loading } = useTools()
  const [activeCategory, setActiveCategory] = useState<ToolCategory | typeof ALL>(ALL)

  const categories: ToolCategory[] = ['email', 'domain', 'ip', 'username', 'phone', 'metadata', 'social', 'security']

  const filtered =
    activeCategory === ALL ? tools : tools.filter(t => t.category === activeCategory)

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">OSINT Tools</h1>
        <p className="text-slate-400 text-sm mt-1">
          {tools.length} tools across {categories.length} categories.
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
            <div
              key={tool.tool_name}
              className="cyber-card p-4 md:p-5 flex flex-col gap-3 hover:border-cyan-700/50 active:bg-slate-800/50 transition-colors cursor-default"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{CATEGORY_ICONS[tool.category as ToolCategory] ?? '🛠️'}</span>
                  <h3 className="text-sm font-semibold text-white truncate">
                    {tool.tool_name.replace(/_/g, ' ').replace(/-/g, ' ')}
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
                {tool.requires_api_key && (
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Key className="h-3 w-3" />
                    API key
                  </span>
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
