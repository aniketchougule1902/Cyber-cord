'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User as SupabaseUser, Session } from '@supabase/supabase-js'
import type { User } from '@/types'

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

  const fetchProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    return data as User | null
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const profile = session?.user ? await fetchProfile(session.user.id) : null
      setState({ user: session?.user ?? null, profile, session, loading: false, error: null })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const profile = session?.user ? await fetchProfile(session.user.id) : null
      setState({ user: session?.user ?? null, profile, session, loading: false, error: null })
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }))
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setState(s => ({ ...s, loading: false, error: error.message }))
    return { error }
  }

  const signUp = async (email: string, password: string, displayName?: string) => {
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
