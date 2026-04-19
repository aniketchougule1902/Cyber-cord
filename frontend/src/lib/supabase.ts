import { createClient } from '@supabase/supabase-js'

function isValidHttpUrl(url: string | undefined): boolean {
  try {
    const parsed = new URL(url ?? '')
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!isValidHttpUrl(envUrl) && process.env.NODE_ENV !== 'production') {
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL is not set or is not a valid URL. ' +
    'Authentication will not work until real Supabase credentials are configured.'
  )
}

const supabaseUrl = isValidHttpUrl(envUrl) ? envUrl! : 'https://placeholder.supabase.co'
const supabaseAnonKey = envKey || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'user'
          display_name: string | null
          avatar_url: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      investigations: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: 'active' | 'archived' | 'completed'
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['investigations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['investigations']['Insert']>
      }
      investigation_findings: {
        Row: {
          id: string
          investigation_id: string
          tool_name: string
          input_data: Record<string, unknown>
          result_data: Record<string, unknown>
          risk_level: 'low' | 'medium' | 'high' | 'critical'
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['investigation_findings']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['investigation_findings']['Insert']>
      }
    }
  }
}
