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
  ChevronRight,
} from 'lucide-react'
import * as Avatar from '@radix-ui/react-avatar'

const SatelliteIntro = lazy(() => import('@/app/components/SatelliteIntro'))

// Key stored in sessionStorage so the intro only plays once per browser session
const INTRO_SEEN_KEY = 'cybercord_intro_seen'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tools', label: 'Tools', icon: Wrench },
  { href: '/investigations', label: 'Investigations', icon: Search },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, profile, loading, isAuthenticated, isAdmin, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showIntro, setShowIntro] = useState(false)

  // Determine whether to play intro: only when auth loading resolves, user is
  // authenticated, and the intro hasn't been played this session yet.
  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) return
    try {
      const seen = sessionStorage.getItem(INTRO_SEEN_KEY)
      if (!seen) {
        setShowIntro(true)
      }
    } catch {
      // sessionStorage unavailable (e.g. private mode edge case) — skip intro
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

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  if (loading) {
    // Show a minimal dark screen while auth resolves (fast — no spinner needed)
    return <div className="min-h-screen bg-slate-950" />
  }

  if (!isAuthenticated) return null

  if (showIntro) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
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
    <div className="min-h-screen bg-slate-950 flex">
      {/* ─────────────────── Desktop Sidebar ─────────────────── */}
      <aside className="hidden lg:flex w-56 shrink-0 bg-slate-900 border-r border-slate-800 flex-col fixed inset-y-0 left-0 z-20">
        {/* Brand */}
        <div className="px-5 py-5 flex items-center gap-2 border-b border-slate-800">
          <Shield className="h-6 w-6 text-cyan-400" />
          <span className="font-bold text-white tracking-tight">CyberCord</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {allNavItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
                {active && <ChevronRight className="h-3 w-3 ml-auto text-cyan-500/60" />}
              </Link>
            )
          })}
        </nav>

        {/* User + Sign out */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar.Root className="flex items-center justify-center w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-500/30 shrink-0">
              {profile?.avatar_url && (
                <Avatar.Image src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
              )}
              <Avatar.Fallback className="text-xs font-semibold text-cyan-400">{initials}</Avatar.Fallback>
            </Avatar.Root>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ─────────────────── Mobile Top Header ─────────────────── */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-cyan-400" />
          <span className="font-bold text-white tracking-tight text-base">CyberCord</span>
        </div>
        <div className="flex items-center gap-2">
          <Avatar.Root className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30">
            {profile?.avatar_url && (
              <Avatar.Image src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
            )}
            <Avatar.Fallback className="text-xs font-semibold text-cyan-400">{initials}</Avatar.Fallback>
          </Avatar.Root>
          <button
            onClick={() => setDrawerOpen(o => !o)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
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
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="lg:hidden fixed top-14 inset-x-0 z-50 bg-slate-900 border-b border-slate-800 shadow-2xl px-4 py-3 space-y-1">
            <div className="pb-3 mb-2 border-b border-slate-800">
              <p className="text-sm font-medium text-slate-200">{displayName}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            {allNavItems.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active ? 'bg-cyan-500/15 text-cyan-400' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
            <div className="pt-2 mt-2 border-t border-slate-800">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─────────────────── Main Content ─────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56">
        {/* Desktop top header */}
        <header className="hidden lg:flex h-14 bg-slate-900 border-b border-slate-800 items-center justify-between px-6 shrink-0">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{displayName}</span>
            <Avatar.Root className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30">
              {profile?.avatar_url && (
                <Avatar.Image src={profile.avatar_url} alt={displayName} className="w-full h-full rounded-full object-cover" />
              )}
              <Avatar.Fallback className="text-xs font-semibold text-cyan-400">{initials}</Avatar.Fallback>
            </Avatar.Root>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-5 lg:p-6 pt-[72px] lg:pt-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* ─────────────────── Mobile Bottom Tab Bar ─────────────────── */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-around px-2 safe-area-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {allNavItems.slice(0, 4).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-3 min-w-0 flex-1 transition-colors ${
                active ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <div className={`relative flex items-center justify-center w-10 h-8 rounded-xl transition-colors ${active ? 'bg-cyan-500/15' : ''}`}>
                <Icon className="h-5 w-5 shrink-0" />
                {active && <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-cyan-400" />}
              </div>
              <span className={`text-[10px] font-medium truncate max-w-full ${active ? 'text-cyan-400' : 'text-slate-500'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
