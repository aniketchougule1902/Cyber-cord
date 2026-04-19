export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
  display_name: string | null
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Investigation {
  id: string
  user_id: string
  title: string
  description: string | null
  status: 'active' | 'archived' | 'completed'
  tags: string[]
  created_at: string
  updated_at: string
  findings_count?: number
}

export interface Finding {
  id: string
  investigation_id: string
  tool_name: string
  input_data: Record<string, unknown>
  result_data: Record<string, unknown>
  risk_level: RiskLevel
  notes: string | null
  created_at: string
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface Tool {
  tool_name: string
  category: ToolCategory
  description: string
  risk_level: RiskLevel
  input_schema: ToolInputField[]
  requires_api_key: boolean
  icon?: string
}

export type ToolCategory = 'email' | 'domain' | 'ip' | 'username' | 'phone' | 'metadata' | 'social'

export interface ToolInputField {
  name: string
  type: 'text' | 'email' | 'number' | 'textarea' | 'select' | 'file'
  required: boolean
  description: string
  placeholder?: string
  options?: string[]
}

export interface ToolResult {
  tool: string
  input: string
  result: Record<string, unknown>
  risk_level: RiskLevel
  disclaimer: string
  timestamp: string
}

export interface AiAnalysis {
  threat_summary: string
  risk_level: RiskLevel
  key_findings: string[]
  threat_actors: string[]
  attack_vectors: string[]
  recommended_actions: string[]
  confidence_score: number
  iocs: string[]
}

export interface AiRecommendation {
  next_steps: Array<{
    action: string
    tool_suggestion: string
    priority: 'high' | 'medium' | 'low'
    rationale: string
  }>
  potential_leads: string[]
  investigation_gaps: string[]
  estimated_time_hours: number
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface UsageLog {
  id: string
  user_id: string
  tool_name: string
  input_hash: string
  status: 'success' | 'error' | 'pending'
  execution_time_ms: number
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource: string
  resource_id: string
  ip_address: string
  user_agent: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
}
