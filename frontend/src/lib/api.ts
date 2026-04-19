import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      supabase.auth.signOut()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const toolsApi = {
  list: () => api.get('/api/tools/list'),
  run: (tool_name: string, input: Record<string, unknown>) =>
    api.post('/api/tools/run', { tool_name, input }),
}

export const investigationsApi = {
  list: (params?: { page?: number; limit?: number }) =>
    api.get('/api/investigations', { params }),
  create: (data: { title: string; description?: string; tags?: string[] }) =>
    api.post('/api/investigations', data),
  get: (id: string) => api.get(`/api/investigations/${id}`),
  update: (id: string, data: Partial<{ title: string; description: string; status: string; tags: string[] }>) =>
    api.put(`/api/investigations/${id}`, data),
  delete: (id: string) => api.delete(`/api/investigations/${id}`),
  addFinding: (id: string, finding: { tool_name: string; input_data: unknown; result_data: unknown; risk_level: string; notes?: string }) =>
    api.post(`/api/investigations/${id}/findings`, finding),
  getFindings: (id: string) => api.get(`/api/investigations/${id}/findings`),
  deleteFinding: (id: string, findingId: string) =>
    api.delete(`/api/investigations/${id}/findings/${findingId}`),
}

export const aiApi = {
  analyze: (findings: unknown[], context?: string) =>
    api.post('/api/ai/analyze', { findings, context }),
  summarize: (investigation: unknown, findings: unknown[]) =>
    api.post('/api/ai/summarize', { investigation, findings }),
  recommend: (investigation: unknown, findings: unknown[], current_focus?: string) =>
    api.post('/api/ai/recommend', { investigation, findings, current_focus }),
}

export const adminApi = {
  getLogs: (params?: { page?: number; limit?: number; user_id?: string; action?: string }) =>
    api.get('/api/admin/logs', { params }),
  getUsageStats: () => api.get('/api/admin/usage-stats'),
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/api/admin/users', { params }),
  updateUser: (id: string, data: { role?: string; is_active?: boolean }) =>
    api.patch(`/api/admin/users/${id}`, data),
}

export default api
