import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Play, Calendar, CalendarX, ArrowRight, LogOut, Users } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { Table, ApiSuccess } from '@/types'

interface Props {
  table: Table
  onClose: () => void
  onSuccess: () => void
}

const STATUS_TEXT_COLOR: Record<string, string> = {
  available: 'text-[#00A63E]',
  occupied: 'text-[#9F0712]',
  reserved: 'text-[#9F2D00]',
}

export default function TableActionModal({ table, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function startService() {
    if (loading) return
    setLoading(true)
    try {
      await api.post<ApiSuccess<Table>>(`/tables/${table.id}/start-service`)
      onSuccess()
      navigate(`/service/${table.id}`)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Something went wrong.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function callAction(endpoint: string) {
    if (loading) return
    setLoading(true)
    try {
      await api.post<ApiSuccess<Table>>(`/tables/${table.id}/${endpoint}`)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Something went wrong.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const statusLabel = table.status.charAt(0).toUpperCase() + table.status.slice(1)

  const primaryAction = {
    available: { label: 'Start Service', icon: Play, onClick: startService },
    reserved: { label: 'Start Service', icon: Play, onClick: startService },
    occupied: { label: 'Continue Service', icon: ArrowRight, onClick: () => navigate(`/service/${table.id}`) },
  }[table.status]

  const secondaryAction = {
    available: { label: 'Reserve Table', icon: Calendar, onClick: () => callAction('reserve') },
    reserved: {
      label: 'Release Reservation',
      icon: CalendarX,
      onClick: () => callAction('release-reservation'),
    },
    occupied: { label: 'Release Table', icon: LogOut, onClick: () => callAction('release') },
  }[table.status]

  const secondaryStyle =
    table.status === 'available'
      ? 'bg-[#D08700] text-white'
      : 'bg-[#FEF2F2] text-[#9F0712] dark:bg-[#3D1515] dark:text-[#FFC9C9]'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      {/* Card */}
      <div className="fixed inset-x-0 top-1/2 z-50 mx-auto w-full max-w-md -translate-y-1/2 px-4 sm:px-0">
        <div className="w-full rounded-[16px] bg-white p-6 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] dark:bg-[#1E2939]">

          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[20px] font-bold leading-[1.4] tracking-[-0.45px] text-[#1E2939] dark:text-white">
              Table {table.number}
            </h2>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center text-[#99A1AF] transition-opacity active:opacity-70"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {/* Info row */}
          <div className="mb-6 flex items-center gap-1.5">
            <Users size={16} className="text-[#4A5565] dark:text-gray-400" />
            <span className="text-[14px] text-[#4A5565] dark:text-gray-400">
              {table.seats} seats
            </span>
            <span className="text-[16px] text-[#4A5565] dark:text-gray-400">•</span>
            <span className={`text-[14px] font-semibold ${STATUS_TEXT_COLOR[table.status]}`}>
              {statusLabel}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-3">
            {/* Primary */}
            <button
              onClick={primaryAction.onClick}
              disabled={loading}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-[#F54900] text-[16px] font-semibold text-white transition-opacity disabled:opacity-60 active:opacity-80"
            >
              <primaryAction.icon size={20} />
              {primaryAction.label}
            </button>

            {/* Secondary */}
            <button
              onClick={secondaryAction.onClick}
              disabled={loading}
              className={`flex h-14 w-full items-center justify-center gap-2 rounded-[14px] text-[16px] font-semibold transition-opacity disabled:opacity-60 active:opacity-80 ${secondaryStyle}`}
            >
              <secondaryAction.icon size={20} />
              {secondaryAction.label}
            </button>

            {/* Cancel */}
            <button
              onClick={onClose}
              disabled={loading}
              className="flex h-12 w-full items-center justify-center rounded-[14px] bg-[#F3F4F6] text-[16px] font-semibold text-[#364153] transition-opacity disabled:opacity-60 active:opacity-80 dark:bg-[#364153] dark:text-[#D1D5DC]"
            >
              Cancel
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
