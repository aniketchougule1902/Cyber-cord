'use client'
import { useState, useEffect } from 'react'
import axios from 'axios'
import { toolsApi } from '@/lib/api'
import { STATIC_TOOLS } from '@/lib/tools-data'
import type { Tool, ToolResult } from '@/types'

const OFFLINE_DISCLAIMER =
  'Offline fallback mode: result generated in the browser because backend is unreachable.'

function getStrengthLabel(score: number): 'very_weak' | 'weak' | 'moderate' | 'strong' | 'very_strong' {
  if (score < 20) return 'very_weak'
  if (score < 40) return 'weak'
  if (score < 60) return 'moderate'
  if (score < 80) return 'strong'
  return 'very_strong'
}

function makeOfflineResult(
  toolName: string,
  inputLabel: string,
  result: Record<string, unknown>,
  riskLevel: ToolResult['risk_level']
): ToolResult {
  return {
    tool: toolName,
    input: inputLabel,
    result,
    risk_level: riskLevel,
    disclaimer: OFFLINE_DISCLAIMER,
    timestamp: new Date().toISOString(),
  }
}

function runOfflineFallbackTool(
  toolName: string,
  input: Record<string, unknown>
): ToolResult | null {
  if (toolName === 'password-strength') {
    const password = String(input.password ?? '')
    if (!password) {
      throw new Error('Password is required.')
    }
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasDigits = /\d/.test(password)
    const hasSpecial = /[^a-zA-Z0-9]/.test(password)
    const length = password.length
    let charsetSize = 0
    if (hasLower) charsetSize += 26
    if (hasUpper) charsetSize += 26
    if (hasDigits) charsetSize += 10
    if (hasSpecial) charsetSize += 32
    const entropyBits = length > 0 ? Math.round(Math.log2(Math.max(charsetSize, 1)) * length * 100) / 100 : 0
    let strengthScore = 0
    strengthScore += Math.min(length * 3, 30)
    strengthScore += hasLower ? 10 : 0
    strengthScore += hasUpper ? 10 : 0
    strengthScore += hasDigits ? 10 : 0
    strengthScore += hasSpecial ? 20 : 0
    strengthScore += Math.min(Math.floor(entropyBits / 3), 20)
    strengthScore = Math.max(0, Math.min(100, strengthScore))
    const strengthLabel = getStrengthLabel(strengthScore)
    const riskLevel = ['very_weak', 'weak'].includes(strengthLabel) ? 'high' : strengthLabel === 'moderate' ? 'medium' : 'low'
    return makeOfflineResult(
      toolName,
      '[password hidden]',
      {
        length,
        has_uppercase: hasUpper,
        has_lowercase: hasLower,
        has_digits: hasDigits,
        has_special: hasSpecial,
        entropy_bits: entropyBits,
        strength_score: strengthScore,
        strength_label: strengthLabel,
      },
      riskLevel
    )
  }

  if (toolName === 'email-headers') {
    const raw = String(input.headers ?? '').trim()
    if (!raw) {
      throw new Error('Email headers text is required.')
    }
    const lines = raw.split(/\r?\n/)
    const headers: Record<string, string> = {}
    let currentKey: string | null = null
    for (const line of lines) {
      if (/^\s/.test(line) && currentKey) {
        headers[currentKey] += ` ${line.trim()}`
      } else {
        const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)/)
        if (match) {
          currentKey = match[1].toLowerCase()
          headers[currentKey] = match[2].trim()
        }
      }
    }
    const received = lines
      .filter((line) => /^Received:/i.test(line))
      .map((line) => line.replace(/^Received:\s*/i, '').trim())
    return makeOfflineResult(
      toolName,
      '[email headers]',
      {
        from: headers.from ?? null,
        to: headers.to ?? null,
        subject: headers.subject ?? null,
        date: headers.date ?? null,
        message_id: headers['message-id'] ?? null,
        received_hop_count: received.length,
        received_chain: received,
      },
      'low'
    )
  }

  if (toolName === 'metadata-extract') {
    const url = String(input.url ?? '').trim()
    if (!url) {
      throw new Error('A publicly accessible URL is required.')
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('Invalid URL format.')
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http/https URLs are supported.')
    }
    return makeOfflineResult(
      toolName,
      url,
      {
        source_url: url,
        protocol: parsed.protocol,
        host: parsed.host,
        pathname: parsed.pathname,
        query_params_count: parsed.searchParams.size,
        note: 'Offline mode returns URL-level metadata only. File/network metadata requires backend access.',
      },
      'low'
    )
  }

  return null
}

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
          const offlineResult = runOfflineFallbackTool(toolName, input)
          if (offlineResult) {
            setResult(offlineResult)
            return offlineResult
          }
          message = 'Cannot reach backend service. Offline fallback is currently available for: password-strength, email-headers, metadata-extract.'
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
