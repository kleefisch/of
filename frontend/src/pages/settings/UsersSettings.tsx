import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Search, Eye, EyeOff, X, Power } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { User, Role, ApiSuccess } from '@/types'

// ── UserFormModal ─────────────────────────────────────────────────────────────

interface UserFormValues {
  full_name: string
  display_name: string
  username: string
  password: string
  confirm_password: string
  role: Role
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'waiter', label: 'Waiter' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'manager', label: 'Manager' },
]

function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user: User | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = user !== null
  const [values, setValues] = useState<UserFormValues>({
    full_name: user?.full_name ?? '',
    display_name: user?.display_name ?? '',
    username: user?.username ?? '',
    password: '',
    confirm_password: '',
    role: user?.role ?? 'waiter',
  })
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(field: keyof UserFormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function validate(): string | null {
    if (!values.full_name.trim()) return 'Full name is required.'
    if (!values.display_name.trim()) return 'Display name is required.'
    if (!values.username.trim()) return 'Username is required.'
    if (!isEdit || values.password) {
      if (!isEdit && !values.password) return 'Password is required.'
      if (values.password && values.password.length < 6) return 'Password must be at least 6 characters.'
      if (values.password !== values.confirm_password) return 'Passwords do not match.'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) return setError(validationError)

    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      full_name: values.full_name.trim(),
      display_name: values.display_name.trim(),
      username: values.username.trim(),
      role: values.role,
    }
    if (values.password) payload.password = values.password

    try {
      if (isEdit) {
        await api.patch(`/admin/users/${user!.id}`, payload)
        toast.success('User updated.')
      } else {
        await api.post('/admin/users', payload)
        toast.success('User created.')
      }
      onSaved()
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Failed to save user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[16px] bg-white shadow-2xl dark:bg-[#1E2939]">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#1E2939] dark:text-white">
              {isEdit ? 'Edit User' : 'New User'}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Full Name *</label>
              <input
                value={values.full_name}
                onChange={(e) => set('full_name', e.target.value)}
                placeholder="João Silva"
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Display Name *</label>
              <input
                value={values.display_name}
                onChange={(e) => set('display_name', e.target.value)}
                placeholder="João"
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Username *</label>
              <input
                value={values.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="joao.silva"
                autoComplete="off"
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">Role *</label>
              <select
                value={values.role}
                onChange={(e) => set('role', e.target.value)}
                className="rounded-[10px] border border-[#D1D5DB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">
              Password {isEdit && <span className="font-normal text-[#9CA3AF]">(leave blank to keep current)</span>}
              {!isEdit && '*'}
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={values.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={isEdit ? '••••••' : 'At least 6 characters'}
                autoComplete="new-password"
                className="w-full rounded-[10px] border border-[#D1D5DB] px-3 py-2 pr-10 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] dark:hover:text-gray-300"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {(!isEdit || values.password) && (
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#374151] dark:text-gray-300">
                Confirm Password {!isEdit && '*'}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={values.confirm_password}
                  onChange={(e) => set('confirm_password', e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  className="w-full rounded-[10px] border border-[#D1D5DB] px-3 py-2 pr-10 text-[14px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#111827] dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] dark:hover:text-gray-300"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

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
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
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
            Deactivate
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Role badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    waiter: 'bg-[#DBEAFE] text-[#1E40AF]',
    kitchen: 'bg-[#EDE9FE] text-[#5B21B6]',
    manager: 'bg-[#FFEDD5] text-[#C2410C]',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${styles[role]}`}>
      {role}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UsersSettings() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingUser, setEditingUser] = useState<User | null | undefined>(undefined) // undefined = closed, null = create
  const [confirmDeactivate, setConfirmDeactivate] = useState<User | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get<ApiSuccess<User[]>>('/admin/users')
      setUsers(res.data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter((u) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return u.full_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
  })

  async function handleToggleActive(user: User) {
    try {
      await api.patch(`/admin/users/${user.id}`, { is_active: !user.is_active })
      toast.success(user.is_active ? 'User deactivated.' : 'User activated.')
      setConfirmDeactivate(null)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.error ?? 'Failed to update user.')
      setConfirmDeactivate(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E2939] dark:text-white">User Management</h1>
          <p className="text-[13px] text-[#6B7280] dark:text-gray-400">Create and manage staff accounts</p>
        </div>
        <button
          onClick={() => setEditingUser(null)}
          className="flex items-center gap-2 rounded-[10px] bg-[#1E2939] px-4 py-2 text-[13px] font-medium text-white hover:opacity-90 dark:bg-[#F54900]"
        >
          <Plus size={16} />
          New User
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users by name or username…"
          className="w-full rounded-[10px] border border-[#D1D5DB] py-2 pl-8 pr-3 text-[13px] outline-none focus:border-[#F54900] dark:border-gray-600 dark:bg-[#1E2939] dark:text-white dark:placeholder-gray-500"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F54900] border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-[13px] text-[#9CA3AF]">No users found.</p>
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm dark:border-gray-700 dark:bg-[#1E2939]">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] gap-3 border-b border-[#E5E7EB] px-4 py-2 dark:border-gray-700">
            {['Name', 'Username', 'Role', 'Status', 'Actions'].map((h) => (
              <span key={h} className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{h}</span>
            ))}
          </div>

          {/* Data rows */}
          {filtered.map((user, idx) => (
            <div
              key={user.id}
              className={`grid grid-cols-[2fr_1.5fr_1fr_1fr_auto] items-center gap-3 px-4 py-3 ${
                idx < filtered.length - 1 ? 'border-b border-[#F3F4F6] dark:border-gray-700/50' : ''
              } ${!user.is_active ? 'opacity-50' : ''}`}
            >
              <span className="truncate text-[13px] font-medium text-[#1E2939] dark:text-white">{user.full_name}</span>
              <span className="truncate text-[12px] text-[#6B7280] dark:text-gray-400">@{user.username}</span>
              <RoleBadge role={user.role} />
              <span
                className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  user.is_active
                    ? 'bg-[#DCFCE7] text-[#166534]'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setEditingUser(user)}
                  title="Edit user"
                  className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-[#E5E7EB] text-[#374151] hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => {
                    if (user.is_active) {
                      setConfirmDeactivate(user)
                    } else {
                      handleToggleActive(user)
                    }
                  }}
                  title={user.is_active ? 'Deactivate user' : 'Activate user'}
                  className={`flex h-7 items-center justify-center gap-1 rounded-[7px] border px-2 text-[11px] font-medium transition-colors ${
                    user.is_active
                      ? 'border-[#FCA5A5] text-[#E7000B] hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20'
                      : 'border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20'
                  }`}
                >
                  <Power size={12} />
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {editingUser !== undefined && (
        <UserFormModal
          user={editingUser}
          onClose={() => setEditingUser(undefined)}
          onSaved={() => { setEditingUser(undefined); load() }}
        />
      )}
      {confirmDeactivate && (
        <ConfirmDialog
          message={`Deactivate ${confirmDeactivate.full_name}? They will no longer be able to log in.`}
          onConfirm={() => handleToggleActive(confirmDeactivate)}
          onCancel={() => setConfirmDeactivate(null)}
        />
      )}
    </div>
  )
}
