'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Shield, Users, FileText, BarChart2 } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const { isAdmin, loading } = useAuth()

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/dashboard')
    }
  }, [loading, isAdmin, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Shield className="h-8 w-8 text-cyan-400 animate-pulse" />
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <p className="text-slate-400 text-sm mt-1">Platform administration and monitoring.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdminSection
          icon={<Users className="h-5 w-5 text-cyan-400" />}
          title="Users"
          description="Manage user accounts, roles, and access permissions."
        />
        <AdminSection
          icon={<FileText className="h-5 w-5 text-amber-400" />}
          title="Audit Logs"
          description="Review user activity, access events, and audit trails."
        />
        <AdminSection
          icon={<BarChart2 className="h-5 w-5 text-green-400" />}
          title="Usage Stats"
          description="Platform usage metrics, tool run counts, and trends."
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="cyber-card p-6">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" />
            Users
          </h2>
          <p className="text-slate-500 text-sm">User management UI coming soon.</p>
        </div>

        <div className="cyber-card p-6">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-400" />
            Audit Logs
          </h2>
          <p className="text-slate-500 text-sm">Audit log viewer coming soon.</p>
        </div>

        <div className="cyber-card p-6">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-green-400" />
            Usage Stats
          </h2>
          <p className="text-slate-500 text-sm">Usage statistics dashboard coming soon.</p>
        </div>
      </div>
    </div>
  )
}

function AdminSection({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="cyber-card p-5 flex items-start gap-4">
      <div className="p-2.5 rounded-lg bg-slate-800 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
    </div>
  )
}
