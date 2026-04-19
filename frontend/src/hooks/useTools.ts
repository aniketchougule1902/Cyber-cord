'use client'
import { useState, useEffect } from 'react'
import { toolsApi } from '@/lib/api'
import type { Tool, ToolResult } from '@/types'

export function useTools() {
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    toolsApi.list()
      .then(res => setTools(res.data.tools || res.data))
      .catch(err => setError(err.message))
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
      const message = err instanceof Error ? err.message : 'Tool execution failed'
      setError(message)
      return null
    } finally {
      setRunning(false)
    }
  }

  const clearResult = () => { setResult(null); setError(null) }

  return { result, running, error, runTool, clearResult }
}
