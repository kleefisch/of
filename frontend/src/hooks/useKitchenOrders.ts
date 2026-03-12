import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/services/api'
import { socket } from '@/services/socket'
import type { Order } from '@/types'

interface KitchenOrdersState {
  pending: Order[]
  preparing: Order[]
  done: Order[]
  isLoading: boolean
  error: string | null
}

const POLL_INTERVAL_MS = 15_000

export function useKitchenOrders(onNewOrder?: () => void) {
  const [state, setState] = useState<KitchenOrdersState>({
    pending: [],
    preparing: [],
    done: [],
    isLoading: true,
    error: null,
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    try {
      const res = await api.get<{ data: Order[] }>('/orders')
      const orders: Order[] = res.data.data
      setState({
        pending: orders.filter((o) => o.status === 'pending'),
        preparing: orders.filter((o) => o.status === 'preparing'),
        done: orders.filter((o) => o.status === 'done'),
        isLoading: false,
        error: null,
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load orders'
      setState((prev) => ({ ...prev, isLoading: false, error: msg }))
    }
  }, [])

  useEffect(() => {
    fetch()
    timerRef.current = setInterval(fetch, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [fetch])

  // Socket listeners: refetch instantly on any relevant event
  useEffect(() => {
    function handleCreated() {
      fetch()
      onNewOrder?.()
    }
    function handleChanged() {
      fetch()
    }

    socket.on('order:created', handleCreated)
    socket.on('order:status_changed', handleChanged)

    return () => {
      socket.off('order:created', handleCreated)
      socket.off('order:status_changed', handleChanged)
    }
  }, [fetch, onNewOrder])

  const updateOrderStatus = useCallback(
    async (orderId: number, status: 'preparing' | 'done' | 'delivered' | 'cancelled') => {
      await api.patch(`/orders/${orderId}/status`, { status })
      fetch()
    },
    [fetch],
  )

  return { ...state, refetch: fetch, updateOrderStatus }
}
