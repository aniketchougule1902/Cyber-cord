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
import { Search, Wrench, Activity } from 'lucide-react'

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

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, <span className="text-cyan-400">{displayName}</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Here&apos;s an overview of your OSINT workspace.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<Search className="h-5 w-5 text-cyan-400" />}
          label="Total Investigations"
          value={loading ? '…' : String(total)}
        />
        <StatCard
          icon={<Wrench className="h-5 w-5 text-green-400" />}
          label="Tools Available"
          value="20+"
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-purple-400" />}
          label="Active This Week"
          value={loading ? '…' : String(investigations.filter(i => i.status === 'active').length)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent investigations */}
        <div className="cyber-card p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Recent Investigations
          </h2>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading…</p>
          ) : recent.length === 0 ? (
            <p className="text-slate-500 text-sm">No investigations yet. Create one to get started.</p>
          ) : (
            <ul className="space-y-3">
              {recent.map(inv => (
                <li key={inv.id} className="flex items-start justify-between gap-2">
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
        <div className="cyber-card p-5">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Weekly Activity
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MOCK_ACTIVITY} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f0f19', border: '1px solid #1e293b', borderRadius: 6, color: '#e2e8f0' }}
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="cyber-card p-5 flex items-center gap-4">
      <div className="p-2.5 rounded-lg bg-slate-800">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400 mt-0.5">{label}</p>
      </div>
    </div>
  )
}
