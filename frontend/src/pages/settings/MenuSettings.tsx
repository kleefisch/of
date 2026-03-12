import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { MenuItem, MenuCategory, ApiSuccess } from '@/types'

// ── Category Modal ────────────────────────────────────────────────────────────

function CategoryModal({
  category,
  onClose,
  onSaved,
}: {
  category: MenuCategory | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = category !== null
  const [name, setName] = useState(category?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Category name is required.')
    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await api.patch(`/menu/categories/${category!.id}`, { name: name.trim() })
        toast.success('Category updated.')
      } else {
        await api.post('/menu/categories', { name: name.trim() })
        toast.success('Category created.')
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save category.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-[16px] bg-white shadow-2xl dark:bg-[#1E2939]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#1E2939] dark:text-white">
              {isEdit ? 'Edit Category' : 'Add Category'}
            </h2>
            <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <X size={18} className="text-[#6B7280]" />
            </button>
          </div>

          {error && (
            <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Category Name *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Desserts"
              className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[10px] border border-[#D1D5DB] py-2 text-[14px] font-medium text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-[10px] bg-[#1E2939] py-2 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#F54900]"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Menu Item Modal ───────────────────────────────────────────────────────────

interface ItemFormValues {
  name: string
  category_id: string
  price: string
  description: string
  image_url: string
  is_available: boolean
  is_active: boolean
}

function MenuItemModal({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: MenuItem | null
  categories: MenuCategory[]
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = item !== null
  const [values, setValues] = useState<ItemFormValues>({
    name: item?.name ?? '',
    category_id: item ? String(item.category_id) : (categories[0]?.id ? String(categories[0].id) : ''),
    price: item ? String(item.price) : '',
    description: item?.description ?? '',
    image_url: item?.image_url ?? '',
    is_available: item?.is_available ?? true,
    is_active: item?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof ItemFormValues, value: string | boolean) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.name.trim()) return setError('Item name is required.')
    if (!values.category_id) return setError('Category is required.')
    const price = parseFloat(values.price)
    if (!price || price <= 0) return setError('Price must be greater than 0.')

    setSaving(true)
    setError(null)
    const payload: Record<string, unknown> = {
      name: values.name.trim(),
      category_id: parseInt(values.category_id),
      price,
      description: values.description.trim() || null,
      image_url: values.image_url.trim() || null,
      is_available: values.is_available,
    }
    if (isEdit) payload.is_active = values.is_active

    try {
      if (isEdit) {
        await api.patch(`/menu/items/${item!.id}`, payload)
        toast.success('Item updated.')
      } else {
        await api.post('/menu/items', payload)
        toast.success('Item created.')
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save item.')
    } finally {
      setSaving(false)
    }
  }

  const activeCategories = categories.filter((c) => c.is_active)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[16px] bg-white shadow-2xl dark:bg-[#1E2939]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#1E2939] dark:text-white">
              {isEdit ? 'Edit Item' : 'Add New Item'}
            </h2>
            <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700">
              <X size={18} className="text-[#6B7280]" />
            </button>
          </div>

          {error && (
            <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Item Name *</label>
            <input
              value={values.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Caesar Salad"
              className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Category *</label>
              <select
                value={values.category_id}
                onChange={(e) => set('category_id', e.target.value)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
              >
                <option value="">Select…</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Price ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={values.price}
                onChange={(e) => set('price', e.target.value)}
                placeholder="0.00"
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Description</label>
            <textarea
              rows={2}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short description…"
              className="resize-none rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Image URL</label>
            <input
              value={values.image_url}
              onChange={(e) => set('image_url', e.target.value)}
              placeholder="https://…"
              className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
            />
          </div>

          <div className="flex gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={values.is_available}
                onChange={(e) => set('is_available', e.target.checked)}
                className="h-4 w-4 rounded accent-[#F54900]"
              />
              <span className="text-[13px] text-[#374151] dark:text-gray-300">Available</span>
            </label>
            {isEdit && (
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={values.is_active}
                  onChange={(e) => set('is_active', e.target.checked)}
                  className="h-4 w-4 rounded accent-[#F54900]"
                />
                <span className="text-[13px] text-[#374151] dark:text-gray-300">Active</span>
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-[10px] border border-[#D1D5DB] py-2 text-[14px] font-medium text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-[10px] bg-[#1E2939] py-2 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#F54900]"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-[16px] bg-white p-6 shadow-2xl dark:bg-[#1E2939]">
        <p className="text-[14px] text-[#374151] dark:text-gray-300">{message}</p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-[10px] border border-[#D1D5DB] py-2 text-[14px] text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-[10px] bg-[#E7000B] py-2 text-[14px] font-medium text-white"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MenuSettings() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [editingItem, setEditingItem] = useState<MenuItem | null | undefined>(undefined) // undefined = closed, null = create
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null | undefined>(undefined)
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<MenuItem | null>(null)
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<MenuCategory | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [itemsRes, catsRes] = await Promise.all([
        api.get<ApiSuccess<MenuItem[]>>('/menu/items?include_all=true'),
        api.get<ApiSuccess<MenuCategory[]>>('/menu/categories?include_all=true'),
      ])
      setItems(itemsRes.data.data)
      setCategories(catsRes.data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const filtered = items.filter((item) => {
    if (activeCategoryId !== null && item.category_id !== activeCategoryId) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (categoryMap[item.category_id] ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const countForCategory = (id: number) => items.filter((i) => i.category_id === id).length

  async function handleToggleAvailable(item: MenuItem) {
    try {
      await api.patch(`/menu/items/${item.id}`, { is_available: !item.is_available })
      toast.success(item.is_available ? 'Marked as unavailable.' : 'Marked as available.')
      load()
    } catch {
      toast.error('Failed to update item.')
    }
  }

  async function handleDeleteItem(item: MenuItem) {
    try {
      await api.patch(`/menu/items/${item.id}`, { is_active: false })
      toast.success('Item removed.')
      setConfirmDeleteItem(null)
      load()
    } catch {
      toast.error('Failed to delete item.')
      setConfirmDeleteItem(null)
    }
  }

  async function handleDeleteCategory(cat: MenuCategory) {
    try {
      await api.patch(`/menu/categories/${cat.id}`, { is_active: false })
      toast.success('Category deactivated.')
      setConfirmDeleteCategory(null)
      if (activeCategoryId === cat.id) setActiveCategoryId(null)
      load()
    } catch {
      toast.error('Failed to deactivate category.')
      setConfirmDeleteCategory(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E2939] dark:text-white">Menu Setup</h1>
          <p className="text-[13px] text-[#6B7280] dark:text-gray-400">Manage menu items and availability</p>
        </div>
        <button
          onClick={() => setEditingItem(null)}
          className="flex items-center gap-2 rounded-[10px] bg-[#1E2939] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 dark:bg-[#F54900]"
        >
          <Plus size={16} />
          Add Item
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu items by name, description or category…"
          className="w-full rounded-[10px] border border-[#D1D5DB] py-2 pl-8 pr-3 text-[13px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#1E2939] dark:text-white dark:placeholder-gray-500"
        />
      </div>

      {/* Category pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategoryId(null)}
          className={`rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-colors ${
            activeCategoryId === null
              ? 'bg-[#1E2939] text-white dark:bg-white dark:text-[#1E2939]'
              : 'border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-gray-50 dark:border-gray-600 dark:bg-[#1E2939] dark:text-gray-300'
          }`}
        >
          All Items ({items.length})
        </button>
        {categories.map((cat) => (
          <div key={cat.id} className={`flex items-center rounded-[10px] overflow-hidden border ${activeCategoryId === cat.id ? 'border-[#1E2939] dark:border-white' : 'border-[#E5E7EB] dark:border-gray-600'} ${!cat.is_active ? 'opacity-50' : ''}`}>
            <button
              onClick={() => setActiveCategoryId(cat.id)}
              className={`px-3 py-1.5 text-[12px] font-medium transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-[#1E2939] text-white dark:bg-white dark:text-[#1E2939]'
                  : 'bg-white text-[#6B7280] hover:bg-gray-50 dark:bg-[#1E2939] dark:text-gray-300'
              }`}
            >
              {cat.name} ({countForCategory(cat.id)})
            </button>
            <button
              onClick={() => setEditingCategory(cat)}
              title="Edit category"
              className={`flex items-center justify-center px-1.5 py-1.5 border-l transition-colors ${
                activeCategoryId === cat.id
                  ? 'border-[#374151] bg-[#1E2939] text-gray-300 hover:text-white dark:border-gray-400 dark:bg-white dark:text-gray-500 dark:hover:text-gray-900'
                  : 'border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:bg-[#1E2939] dark:hover:text-gray-200'
              }`}
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => setConfirmDeleteCategory(cat)}
              title="Deactivate category"
              className={`flex items-center justify-center px-1.5 py-1.5 border-l transition-colors ${
                activeCategoryId === cat.id
                  ? 'border-[#374151] bg-[#1E2939] text-red-400 hover:text-red-300 dark:border-gray-400 dark:bg-white dark:text-red-400 dark:hover:text-red-600'
                  : 'border-[#E5E7EB] bg-white text-[#9CA3AF] hover:text-[#E7000B] hover:bg-red-50 dark:border-gray-600 dark:bg-[#1E2939] dark:hover:text-red-400'
              }`}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={() => setEditingCategory(null)}
          className="flex items-center gap-1 rounded-[10px] border border-dashed border-[#D1D5DB] px-3 py-1.5 text-[12px] font-medium text-[#6B7280] hover:border-[#9CA3AF] hover:text-[#374151] dark:border-gray-600 dark:text-gray-400"
        >
          <Plus size={12} />
          Add Category
        </button>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F54900] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-[#9CA3AF]">No items found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`flex items-start justify-between rounded-[14px] border bg-white p-4 shadow-sm dark:bg-[#1E2939] ${
                item.is_active
                  ? 'border-[#E5E7EB] dark:border-gray-700'
                  : 'border-dashed border-[#D1D5DB] opacity-55 dark:border-gray-600'
              }`}
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="mr-3 h-14 w-14 shrink-0 rounded-[8px] object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex flex-1 flex-col gap-1 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-[#1E2939] dark:text-white">{item.name}</span>
                  <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-medium text-[#4338CA] dark:bg-[#312E81] dark:text-indigo-300">
                    {categoryMap[item.category_id] ?? '—'}
                  </span>
                  {!item.is_available && (
                    <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-medium text-[#92400E]">
                      Unavailable
                    </span>
                  )}
                  {!item.is_active && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                      Inactive
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-[12px] text-[#6B7280] dark:text-gray-400 line-clamp-1">{item.description}</p>
                )}
                <span className="text-[13px] font-semibold text-[#F54900]">${item.price.toFixed(2)}</span>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => handleToggleAvailable(item)}
                  className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {item.is_available ? 'Mark Unavailable' : 'Mark Available'}
                </button>
                <button
                  onClick={() => setEditingItem(item)}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmDeleteItem(item)}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#FCA5A5] text-[#E7000B] hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editingItem !== undefined && (
        <MenuItemModal
          item={editingItem}
          categories={categories}
          onClose={() => setEditingItem(undefined)}
          onSaved={() => { setEditingItem(undefined); load() }}
        />
      )}
      {editingCategory !== undefined && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(undefined)}
          onSaved={() => { setEditingCategory(undefined); load() }}
        />
      )}
      {confirmDeleteItem && (
        <ConfirmDialog
          message={`Delete "${confirmDeleteItem.name}"? This cannot be undone from the interface.`}
          onConfirm={() => handleDeleteItem(confirmDeleteItem)}
          onCancel={() => setConfirmDeleteItem(null)}
        />
      )}
      {confirmDeleteCategory && (
        <ConfirmDialog
          message={`Deactivate category "${confirmDeleteCategory.name}"? Items in this category will not be affected.`}
          onConfirm={() => handleDeleteCategory(confirmDeleteCategory)}
          onCancel={() => setConfirmDeleteCategory(null)}
        />
      )}
    </div>
  )
}
