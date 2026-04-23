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
  Area,
  AreaChart,
} from 'recharts'
import {
  Search, Wrench, Activity, TrendingUp, ArrowUpRight,
  Zap, Shield, Clock, Plus, ChevronRight, Bot,
} from 'lucide-react'
import Link from 'next/link'

const MOCK_ACTIVITY = [
  { day: 'Mon', runs: 4 },
  { day: 'Tue', runs: 7 },
  { day: 'Wed', runs: 3 },
  { day: 'Thu', runs: 9 },
  { day: 'Fri', runs: 5 },
  { day: 'Sat', runs: 2 },
  { day: 'Sun', runs: 6 },
]

const STATUS_STYLES: Record<string, string> = {
  active: 'badge badge-active',
  completed: 'badge badge-completed',
  archived: 'badge badge-archived',
}

const QUICK_ACTIONS = [
  { label: 'Run Tool', icon: Wrench, href: '/tools', color: 'bg-brand-50 text-brand-600 border-brand-100' },
  { label: 'New Investigation', icon: Search, href: '/investigations', color: 'bg-violet-50 text-violet-600 border-violet-100' },
  { label: 'Terminal', icon: Activity, href: '/terminal', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  { label: 'AI Copilot', icon: Bot, href: '#copilot', color: 'bg-amber-50 text-amber-600 border-amber-100' },
]

export default function DashboardPage() {
  const { profile, user } = useAuth()
  const { investigations, loading, total } = useInvestigations()

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Analyst'
  const recent = investigations.slice(0, 5)
  const activeCount = investigations.filter(i => i.status === 'active').length

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-600 to-violet-700 p-6 md:p-8 shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/3 translate-x-1/4 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/20 rounded-full translate-y-1/2 -translate-x-1/4 blur-xl" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-brand-200 text-sm font-medium mb-1">Good to see you 👋</p>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                {displayName}
              </h1>
              <p className="text-brand-200 text-sm mt-2 max-w-sm">
                Your OSINT workspace is ready. {activeCount > 0 ? `You have ${activeCount} active investigation${activeCount !== 1 ? 's' : ''}.` : 'Start a new investigation to get going.'}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <Link href="/tools" className="flex items-center gap-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2.5 rounded-xl border border-white/20 transition-all">
                <Zap className="h-4 w-4" />
                Run Tool
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Search className="h-5 w-5 text-brand-600" />}
          label="Investigations"
          value={loading ? '…' : String(total)}
          trend="+2 this week"
          color="brand"
          iconBg="bg-brand-50"
        />
        <StatCard
          icon={<Wrench className="h-5 w-5 text-violet-600" />}
          label="OSINT Tools"
          value="50+"
          trend="Ready to use"
          color="violet"
          iconBg="bg-violet-50"
        />
        <StatCard
          icon={<Activity className="h-5 w-5 text-emerald-600" />}
          label="Active"
          value={loading ? '…' : String(activeCount)}
          trend="Ongoing cases"
          color="emerald"
          iconBg="bg-emerald-50"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map(({ label, icon: Icon, href, color }) => (
          <Link
            key={label}
            href={href}
            className={`card-hover flex flex-col items-center gap-3 p-4 border ${color.split(' ').pop()} transition-all group`}
          >
            <div className={`p-3 rounded-xl border ${color}`}>
              <Icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{label}</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Recent investigations */}
        <div className="lg:col-span-3 card p-5 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Investigations</h2>
              <p className="text-xs text-slate-500 mt-0.5">Your latest OSINT cases</p>
            </div>
            <Link href="/investigations" className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                <Search className="h-6 w-6 text-brand-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No investigations yet</p>
                <p className="text-xs text-slate-500 mt-1">Create one to start tracking your OSINT work</p>
              </div>
              <Link href="/investigations" className="btn-primary flex items-center gap-2 mt-1">
                <Plus className="h-4 w-4" />
                New Investigation
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.map(inv => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3 px-4 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
                      <Search className="h-4 w-4 text-brand-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{inv.title}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(inv.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={STATUS_STYLES[inv.status] ?? 'badge'}>
                      {inv.status}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Activity chart */}
        <div className="lg:col-span-2 card p-5 shadow-card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Weekly Activity</h2>
              <p className="text-xs text-slate-500 mt-0.5">Tool runs per day</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
              <TrendingUp className="h-3 w-3" />
              +24%
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={MOCK_ACTIVITY} barSize={20}>
              <defs>
                <linearGradient id="colorRuns" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  color: '#0f172a',
                  fontSize: 12,
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)',
                }}
                cursor={{ fill: 'rgba(99,102,241,0.05)' }}
              />
              <Area type="monotone" dataKey="runs" stroke="#6366f1" strokeWidth={2} fill="url(#colorRuns)" dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5, fill: '#4f46e5' }} />
            </AreaChart>
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
  trend,
  color,
  iconBg,
}: {
  icon: React.ReactNode
  label: string
  value: string
  trend: string
  color: string
  iconBg: string
}) {
  return (
    <div className="card p-4 md:p-5 shadow-card hover:shadow-card-hover transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
        <ArrowUpRight className="h-4 w-4 text-slate-300" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      <p className="text-[11px] text-slate-400 mt-1">{trend}</p>
    </div>
  )
}
