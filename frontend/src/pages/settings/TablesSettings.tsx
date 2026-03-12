import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { Table, ApiSuccess } from '@/types'

// ── TableFormModal ────────────────────────────────────────────────────────────

interface TableFormValues {
  number: string
  seats: string
  is_active: boolean
}

function TableFormModal({
  table,
  onClose,
  onSaved,
}: {
  table: Table | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = table !== null
  const [values, setValues] = useState<TableFormValues>({
    number: table ? String(table.number) : '',
    seats: table ? String(table.seats) : '',
    is_active: table ? table.is_active : true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(values.number)
    const seats = parseInt(values.seats)
    if (!num || num < 1) return setError('Table number must be at least 1.')
    if (!seats || seats < 1) return setError('Seats must be at least 1.')

    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await api.patch(`/tables/${table!.id}`, { number: num, seats, is_active: values.is_active })
        toast.success('Table updated.')
      } else {
        await api.post('/tables', { number: num, seats })
        toast.success('Table created.')
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save table.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[16px] bg-white shadow-2xl dark:bg-[#1E2939]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <h2 className="text-[18px] font-bold text-[#1E2939] dark:text-white">
            {isEdit ? 'Edit Table' : 'Add Table'}
          </h2>

          {error && (
            <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Table Number *</label>
            <input
              type="number"
              min={1}
              value={values.number}
              onChange={(e) => setValues((v) => ({ ...v, number: e.target.value }))}
              placeholder="e.g. 6"
              className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
            />
            <span className="text-[11px] text-[#9CA3AF]">Must be unique</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Number of Seats *</label>
            <input
              type="number"
              min={1}
              value={values.seats}
              onChange={(e) => setValues((v) => ({ ...v, seats: e.target.value }))}
              placeholder="e.g. 4"
              className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
            />
          </div>

          {isEdit && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={values.is_active}
                onChange={(e) => setValues((v) => ({ ...v, is_active: e.target.checked }))}
                className="h-4 w-4 rounded accent-[#F54900]"
              />
              <span className="text-[13px] font-medium text-[#374151] dark:text-gray-300">
                Table is active and available for use
              </span>
            </label>
          )}

          <div className="flex gap-3 pt-2">
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
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Table'}
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
  dangerous,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
  dangerous?: boolean
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
            className={`flex-1 rounded-[10px] py-2 text-[14px] font-medium text-white ${
              dangerous ? 'bg-[#E7000B]' : 'bg-[#1E2939] dark:bg-[#F54900]'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    available: 'bg-[#DCFCE7] text-[#166534]',
    occupied: 'bg-[#FEE2E2] text-[#991B1B]',
    reserved: 'bg-[#FEF3C7] text-[#92400E]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'active' | 'inactive'

export default function TablesSettings() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [editingTable, setEditingTable] = useState<Table | null | undefined>(undefined) // undefined = closed, null = create
  const [confirmDelete, setConfirmDelete] = useState<Table | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ApiSuccess<Table[]>>('/tables?include_all=true')
      setTables(res.data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tables.filter((t) => {
    if (filter === 'active') return t.is_active
    if (filter === 'inactive') return !t.is_active
    return true
  })

  const counts = {
    all: tables.length,
    active: tables.filter((t) => t.is_active).length,
    inactive: tables.filter((t) => !t.is_active).length,
  }

  async function handleToggleActive(table: Table) {
    try {
      await api.patch(`/tables/${table.id}`, { is_active: !table.is_active })
      toast.success(table.is_active ? 'Table deactivated.' : 'Table activated.')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update table.')
    }
  }

  async function handleDelete(table: Table) {
    try {
      await api.patch(`/tables/${table.id}`, { is_active: false })
      toast.success('Table removed.')
      setConfirmDelete(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to delete table.')
      setConfirmDelete(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E2939] dark:text-white">Table Setup</h1>
          <p className="text-[13px] text-[#6B7280] dark:text-gray-400">Manage restaurant tables and capacity</p>
        </div>
        <button
          onClick={() => setEditingTable(null)}
          className="flex items-center gap-2 rounded-[10px] bg-[#1E2939] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 dark:bg-[#F54900]"
        >
          <Plus size={16} />
          Add Table
        </button>
      </div>

      {/* Filter pills */}
      <div className="mb-4 flex gap-2">
        {(['all', 'active', 'inactive'] as FilterTab[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-[10px] px-3 py-1.5 text-[13px] font-medium capitalize transition-colors ${
              filter === f
                ? 'bg-[#1E2939] text-white dark:bg-white dark:text-[#1E2939]'
                : 'border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-gray-50 dark:border-gray-600 dark:bg-[#1E2939] dark:text-gray-300'
            }`}
          >
            {f === 'all' ? 'All Tables' : f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F54900] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-[#9CA3AF]">No tables found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((table) => (
            <div
              key={table.id}
              className={`flex items-center justify-between rounded-[14px] border bg-white p-4 shadow-sm dark:bg-[#1E2939] ${
                table.is_active ? 'border-[#E5E7EB] dark:border-gray-700' : 'border-dashed border-[#D1D5DB] opacity-60 dark:border-gray-600'
              }`}
            >
              {/* Left: icon + info */}
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${table.is_active ? 'bg-[#E0E7FF]' : 'bg-[#F3F4F6] dark:bg-gray-700'}`}>
                  <span className="text-[14px] font-bold text-[#4338CA]">{table.number}</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#1E2939] dark:text-white">Table {table.number}</p>
                  <div className="flex items-center gap-2">
                    <Users size={12} className="text-[#6B7280]" />
                    <span className="text-[12px] text-[#6B7280] dark:text-gray-400">{table.seats} seats</span>
                  </div>
                </div>
              </div>

              {/* Right: badge + actions */}
              <div className="flex items-center gap-2">
                <StatusBadge status={table.status} />
                {!table.is_active && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    Inactive
                  </span>
                )}
                <button
                  onClick={() => handleToggleActive(table)}
                  disabled={table.status !== 'available' && table.is_active}
                  title={table.status !== 'available' && table.is_active ? 'Can only deactivate available tables' : table.is_active ? 'Deactivate' : 'Activate'}
                  className="rounded-[8px] border border-[#E5E7EB] px-2.5 py-1 text-[12px] font-medium text-[#374151] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {table.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setEditingTable(table)}
                  disabled={table.status !== 'available'}
                  title={table.status !== 'available' ? 'Can only edit available tables' : 'Edit'}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setConfirmDelete(table)}
                  disabled={table.status !== 'available'}
                  title={table.status !== 'available' ? 'Cannot delete occupied table' : 'Delete'}
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#FCA5A5] text-[#E7000B] hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editingTable !== undefined && (
        <TableFormModal
          table={editingTable}
          onClose={() => setEditingTable(undefined)}
          onSaved={() => { setEditingTable(undefined); load() }}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete Table ${confirmDelete.number}? This cannot be undone from the interface.`}
          dangerous
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
