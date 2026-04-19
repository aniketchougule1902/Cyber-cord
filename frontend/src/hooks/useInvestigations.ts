'use client'
import { useState, useEffect, useCallback } from 'react'
import { investigationsApi } from '@/lib/api'
import type { Investigation, Finding } from '@/types'

export function useInvestigations() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  const fetchInvestigations = useCallback(async (page = 1, limit = 20) => {
    setLoading(true)
    try {
      const res = await investigationsApi.list({ page, limit })
      setInvestigations(res.data.investigations || res.data.data || [])
      setTotal(res.data.total || 0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch investigations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInvestigations() }, [fetchInvestigations])

  const createInvestigation = async (data: { title: string; description?: string; tags?: string[] }) => {
    const res = await investigationsApi.create(data)
    await fetchInvestigations()
    return res.data
  }

  const updateInvestigation = async (id: string, data: Partial<Investigation>) => {
    const apiData = {
      ...data,
      description: data.description ?? undefined,
    }
    const res = await investigationsApi.update(id, apiData)
    setInvestigations(prev => prev.map(inv => inv.id === id ? { ...inv, ...res.data.investigation } : inv))
    return res.data
  }

  const deleteInvestigation = async (id: string) => {
    await investigationsApi.delete(id)
    setInvestigations(prev => prev.filter(inv => inv.id !== id))
  }

  return { investigations, loading, error, total, fetchInvestigations, createInvestigation, updateInvestigation, deleteInvestigation }
}

export function useInvestigationFindings(investigationId: string) {
  const [findings, setFindings] = useState<Finding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFindings = useCallback(async () => {
    if (!investigationId) return
    setLoading(true)
    try {
      const res = await investigationsApi.getFindings(investigationId)
      setFindings(res.data.findings || res.data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch findings')
    } finally {
      setLoading(false)
    }
  }, [investigationId])

  useEffect(() => { fetchFindings() }, [fetchFindings])

  const addFinding = async (finding: { tool_name: string; input_data: unknown; result_data: unknown; risk_level: string; notes?: string }) => {
    const res = await investigationsApi.addFinding(investigationId, finding)
    await fetchFindings()
    return res.data
  }

  const deleteFinding = async (findingId: string) => {
    await investigationsApi.deleteFinding(investigationId, findingId)
    setFindings(prev => prev.filter(f => f.id !== findingId))
  }

  return { findings, loading, error, fetchFindings, addFinding, deleteFinding }
}
