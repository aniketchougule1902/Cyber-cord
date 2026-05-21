'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toolsApi } from '@/lib/api'
import { STATIC_TOOLS } from '@/lib/tools-data'
import type { Tool, ToolResult } from '@/types'

export function useTools() {
  const [tools, setTools] = useState<Tool[]>(STATIC_TOOLS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    toolsApi.list()
      .then(res => {
        const fetched: Tool[] = res.data.tools || res.data
        if (Array.isArray(fetched) && fetched.length > 0) {
          setTools(fetched)
        }
      })
      .catch(() => {
        // Static fallback already loaded; silently ignore backend unreachable
      })
      .finally(() => setLoading(false))
  }, [])

  return { tools, loading, error }
}

export function useToolRunner() {
  const [result, setResult] = useState<ToolResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runTool = async (toolName: string, input: Record<string, unknown>) => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await toolsApi.run(toolName, input)
      setResult(res.data)
      return res.data
    } catch (err: unknown) {
      let message = 'Tool execution failed'
      if (axios.isAxiosError(err)) {
        const serverMessage =
          typeof err.response?.data?.error === 'string'
            ? err.response.data.error
            : typeof err.response?.data?.message === 'string'
              ? err.response.data.message
              : null
        if (serverMessage) {
          message = serverMessage
        } else if (!err.response) {
          message = 'Cannot reach backend service. Check NEXT_PUBLIC_BACKEND_URL (or same-project backend route) and try again.'
        } else {
          message = err.message || message
        }
      } else if (err instanceof Error) {
        message = err.message
      }
      setError(message)
      return null
    } finally {
      setRunning(false)
    }
  }

  const clearResult = () => { setResult(null); setError(null) }

  return { result, running, error, runTool, clearResult }
}
