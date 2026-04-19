'use client'

import { useAuth } from '@/hooks/useAuth'
import { useInvestigations } from '@/hooks/useInvestigations'
import { formatDistanceToNow } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { Search, Wrench, Activity, TrendingUp } from 'lucide-react'

const MOCK_ACTIVITY = [
  { day: 'Mon', runs: 4 },
  { day: 'Tue', runs: 7 },
  { day: 'Wed', runs: 3 },
  { day: 'Thu', runs: 9 },
  { day: 'Fri', runs: 5 },
  { day: 'Sat', runs: 2 },
  { day: 'Sun', runs: 6 },
]

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  completed: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  archived: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
}

export default function DashboardPage() {
  const { profile, user } = useAuth()
  const { investigations, loading, total } = useInvestigations()

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Analyst'
  const recent = investigations.slice(0, 5)
  const activeCount = investigations.filter(i => i.status === 'active').length

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Welcome */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-white">
          Welcome back, <span className="text-cyan-400">{displayName}</span> 👋
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Here&apos;s an overview of your OSINT workspace.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatCard
          icon={<Search className="h-5 w-5 text-cyan-400" />}
          label="Investigations"
          value={loading ? '…' : String(total)}
          color="cyan"
        />
        <StatCard
          icon={<Wrench className="h-5 w-5 text-green-400" />}
          label="Tools"
          value="16"
          color="green"
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-purple-400" />}
          label="Active"
          value={loading ? '…' : String(activeCount)}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {/* Recent investigations */}
        <div className="cyber-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Recent Investigations
            </h2>
            <Search className="h-4 w-4 text-slate-600" />
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8">
              <Search className="h-8 w-8 text-slate-700 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No investigations yet.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {recent.map(inv => (
                <li key={inv.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800/60 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">{inv.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDistanceToNow(new Date(inv.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[inv.status] ?? ''}`}>
                    {inv.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity chart */}
        <div className="cyber-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Weekly Activity
            </h2>
            <TrendingUp className="h-4 w-4 text-slate-600" />
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={MOCK_ACTIVITY} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0', fontSize: 12 }}
                cursor={{ fill: 'rgba(6,182,212,0.07)' }}
              />
              <Bar dataKey="runs" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: 'cyan' | 'green' | 'purple'
}) {
  const bg = {
    cyan: 'bg-cyan-500/10',
    green: 'bg-green-500/10',
    purple: 'bg-purple-500/10',
  }[color]

  return (
    <div className="cyber-card p-3 md:p-5 flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
      <div className={`p-2 md:p-2.5 rounded-lg ${bg} w-fit`}>{icon}</div>
      <div>
        <p className="text-lg md:text-2xl font-bold text-white">{value}</p>
        <p className="text-[10px] md:text-xs text-slate-400 leading-tight">{label}</p>
      </div>
    </div>
  )
}


