import { useState, useEffect, useCallback } from 'react'
import api from '@/services/api'
import type { ApiSuccess, Table, Order } from '@/types'

export interface BillData {
  billId: number
  table: Table
  orders: Order[]
}

export function useCurrentBill(tableId: number) {
  const [data, setData] = useState<BillData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    try {
      const billRes = await api.get<ApiSuccess<{ bill_id: number; table: Table }>>(
        `/tables/${tableId}/current-bill`,
      )
      const { bill_id, table } = billRes.data.data
      const ordersRes = await api.get<ApiSuccess<Order[]>>(`/orders?bill_id=${bill_id}`)
      setData({ billId: bill_id, table, orders: ordersRes.data.data })
      setError(null)
    } catch {
      setError('Failed to load service data.')
    } finally {
      setIsLoading(false)
    }
  }, [tableId])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { data, isLoading, error, refetch }
}
