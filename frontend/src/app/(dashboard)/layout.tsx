'use client'

import { useEffect, useState, lazy, Suspense } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import {
  LayoutDashboard,
  Wrench,
  Search,
  Shield,
  LogOut,
  Menu,
  X,
  Terminal,
  Bot,
  ChevronRight,
  Zap,
  Bell,
  Settings,
} from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'

const SatelliteIntro = lazy(() => import('@/app/components/SatelliteIntro'))

const INTRO_SEEN_KEY = 'cybercord_intro_seen'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tools', label: 'OSINT Tools', icon: Wrench },
  { href: '/investigations', label: 'Investigations', icon: Search },
  { href: '/terminal', label: 'Terminal', icon: Terminal },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, loading, isAuthenticated, isAdmin, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showIntro, setShowIntro] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) return
    try {
      const seen = sessionStorage.getItem(INTRO_SEEN_KEY)
      if (!seen) {
        setShowIntro(true)
      }
    } catch {
      // sessionStorage unavailable — skip intro
    }
  }, [loading, isAuthenticated])

  const handleIntroComplete = () => {
    try { sessionStorage.setItem(INTRO_SEEN_KEY, '1') } catch { /* ignore */ }
    setShowIntro(false)
  }

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login')
    }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center shadow-lg animate-pulse">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  if (showIntro) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
        <SatelliteIntro onComplete={handleIntroComplete} />
      </Suspense>
    )
  }

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Analyst'
  const initials = displayName.slice(0, 2).toUpperCase()

  const allNavItems = [
    ...navItems,
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  const handleSignOut = async () => {
    setDrawerOpen(false)
    await signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ─────────────────── Desktop Sidebar ─────────────────── */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-white border-r border-slate-100 flex-col fixed inset-y-0 left-0 z-20 shadow-sm">
        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center shadow-sm">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900 tracking-tight text-base">CyberCord</span>
            <span className="block text-[10px] text-slate-400 font-medium tracking-wider uppercase">AI Platform</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-3 mb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Workspace</p>
          {allNavItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`nav-link ${active ? 'nav-link-active' : 'nav-link-inactive'}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                <span>{label}</span>
                {active && <ChevronRight className="h-3 w-3 ml-auto text-brand-400" />}
              </Link>
            )
          })}
        </nav>

        {/* User + Sign out */}
        <div className="px-3 py-4 border-t border-slate-100 space-y-1">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-default">
            <Avatar.Root className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-violet-100 border border-brand-200/50 shrink-0">
              {profile?.avatar_url && (
                <Avatar.Image src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
              )}
              <Avatar.Fallback className="text-xs font-bold text-brand-600">{initials}</Avatar.Fallback>
            </Avatar.Root>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─────────────────── Mobile Top Header ─────────────────── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="font-bold text-slate-900 tracking-tight">CyberCord</span>
        </div>
        <div className="flex items-center gap-2">
          <Avatar.Root className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-violet-100 border border-brand-200/50">
            {profile?.avatar_url && (
              <Avatar.Image src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
            )}
            <Avatar.Fallback className="text-xs font-bold text-brand-600">{initials}</Avatar.Fallback>
          </Avatar.Root>
          <button
            onClick={() => setDrawerOpen(o => !o)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Menu"
          >
            {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* ─────────────────── Mobile Slide-Down Drawer ─────────────────── */}
      {drawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="lg:hidden fixed top-14 inset-x-0 z-50 bg-white border-b border-slate-100 shadow-lg px-4 py-3 space-y-1 animate-slide-up">
            <div className="pb-3 mb-2 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">{displayName}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            {allNavItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link ${active ? 'nav-link-active' : 'nav-link-inactive'}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-brand-600' : 'text-slate-400'}`} />
                  {label}
                </Link>
              )
            })}
            <div className="pt-2 mt-2 border-t border-slate-100">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm font-medium text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─────────────────── Main Content ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        {/* Desktop top header */}
        <header className="hidden lg:flex h-14 bg-white border-b border-slate-100 items-center justify-between px-6 shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-brand-50 text-brand-600 text-xs font-semibold px-2.5 py-1 rounded-full border border-brand-100">
              <Zap className="h-3 w-3" />
              AI-Powered OSINT Platform
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <Bell className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2.5">
              <Avatar.Root className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-violet-100 border border-brand-200/50">
                {profile?.avatar_url && (
                  <Avatar.Image src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
                )}
                <Avatar.Fallback className="text-xs font-bold text-brand-600">{initials}</Avatar.Fallback>
              </Avatar.Root>
              <div>
                <p className="text-sm font-semibold text-slate-800">{displayName}</p>
                <p className="text-[11px] text-slate-400">{isAdmin ? 'Administrator' : 'Analyst'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 pt-[72px] lg:pt-8 pb-28 lg:pb-8">
          {children}
        </main>
      </div>

      {/* ─────────────────── Mobile Bottom Tab Bar ─────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-100 shadow-lg flex items-center justify-around px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {allNavItems.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-3 min-w-0 flex-1 transition-colors ${
                active ? 'text-brand-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`relative flex items-center justify-center w-10 h-8 rounded-xl transition-colors ${active ? 'bg-brand-50' : ''}`}>
                <Icon className="h-5 w-5 shrink-0" />
                {active && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-brand-500" />}
              </div>
              <span className={`text-[10px] font-semibold truncate max-w-full ${active ? 'text-brand-600' : 'text-slate-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
