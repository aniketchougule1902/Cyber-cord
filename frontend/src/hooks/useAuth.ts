'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import type { User } from '@/types'

const CONFIG_ERROR = {
  name: 'AuthConfigError',
  message:
    'Authentication is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and ' +
    'NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.',
  status: 0,
} as const

interface AuthState {
  user: SupabaseUser | null
  profile: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    session: null,
    loading: true,
    error: null,
  })

  // Prevent stale profile fetches from overwriting newer state
  const sessionIdRef = useRef<string | null>(null)

  const fetchProfileAsync = useCallback(async (userId: string, activeSessionId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
      // Only apply if this session is still active
      if (sessionIdRef.current === activeSessionId) {
        setState(s => ({ ...s, profile: data as User | null }))
      }
    } catch {
      // Profile fetch failure is non-fatal – auth still works
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured) {
      setState({ user: null, profile: null, session: null, loading: false, error: null })
      return
    }

    // onAuthStateChange fires INITIAL_SESSION synchronously from cached storage,
    // so it resolves loading fast on refresh without waiting for a network round-trip.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionId = session?.access_token ?? 'none'
      sessionIdRef.current = sessionId
      // Immediately mark loading done with session info available
      setState({
        user: session?.user ?? null,
        profile: null,
        session,
        loading: false,
        error: null,
      })
      // Fetch profile in background without blocking the auth gate
      if (session?.user) {
        fetchProfileAsync(session.user.id, sessionId)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfileAsync])

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured) {
      setState(s => ({ ...s, loading: false, error: CONFIG_ERROR.message }))
      return { error: CONFIG_ERROR }
    }
    setState(s => ({ ...s, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setState(s => ({ ...s, loading: false, error: error.message }))
    return { error }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!supabaseConfigured) {
      setState(s => ({ ...s, loading: false, error: CONFIG_ERROR.message }))
      return { error: CONFIG_ERROR }
    }
    setState(s => ({ ...s, loading: true, error: null }))
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } }
    })
    if (error) setState(s => ({ ...s, loading: false, error: error.message }))
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setState({ user: null, profile: null, session: null, loading: false, error: null })
  }

  return {
    ...state,
    isAdmin: state.profile?.role === 'admin',
    isAuthenticated: !!state.user,
    signIn,
    signUp,
    signOut,
  }
}
