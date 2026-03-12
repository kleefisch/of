import { useState, useEffect, useCallback } from 'react'
import api from '@/services/api'
import type { ApiSuccess, MenuCategory, MenuItem } from '@/types'

export function useMenu() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [allItemsById, setAllItemsById] = useState<Map<number, MenuItem>>(new Map())
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [isLoadingItems, setIsLoadingItems] = useState(false)

  // Fetch categories once on mount
  useEffect(() => {
    api
      .get<ApiSuccess<MenuCategory[]>>('/menu/categories')
      .then((r) => {
        const cats = r.data.data.filter((c) => c.is_active)
        setCategories(cats)
        if (cats.length > 0) setActiveCategoryId(cats[0].id)
      })
      .catch(() => {})
  }, [])

  // Fetch ALL available items once for order name lookup
  useEffect(() => {
    api
      .get<ApiSuccess<MenuItem[]>>('/menu/items?available=true')
      .then((r) => {
        const map = new Map<number, MenuItem>()
        r.data.data.forEach((i) => map.set(i.id, i))
        setAllItemsById(map)
      })
      .catch(() => {})
  }, [])

  // Fetch filtered items (debounced 250ms) when category or search changes
  const fetchItems = useCallback(async () => {
    const params = new URLSearchParams({ available: 'true' })
    if (activeCategoryId) params.set('category_id', String(activeCategoryId))
    if (search.trim()) params.set('search', search.trim())
    setIsLoadingItems(true)
    try {
      const r = await api.get<ApiSuccess<MenuItem[]>>(`/menu/items?${params}`)
      setItems(r.data.data)
    } finally {
      setIsLoadingItems(false)
    }
  }, [activeCategoryId, search])

  useEffect(() => {
    const id = setTimeout(fetchItems, 250)
    return () => clearTimeout(id)
  }, [fetchItems])

  return {
    categories,
    items,
    allItemsById,
    isLoadingItems,
    activeCategoryId,
    setActiveCategoryId,
    search,
    setSearch,
  }
}
