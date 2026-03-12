import { useState, useEffect, useCallback } from 'react'
import api from '@/services/api'
import { socket } from '@/services/socket'
import type { ApiSuccess, Table } from '@/types'

export function useTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTables = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await api.get<ApiSuccess<Table[]>>('/tables')
      setTables(res.data.data)
      setError(null)
    } catch {
      setError('Failed to load tables')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  // Silent re-fetch when any table status changes (admin room event)
  useEffect(() => {
    socket.on('table:status_changed', fetchTables)
    return () => {
      socket.off('table:status_changed', fetchTables)
    }
  }, [fetchTables])

  return { tables, isLoading, error, refetch: fetchTables }
}
