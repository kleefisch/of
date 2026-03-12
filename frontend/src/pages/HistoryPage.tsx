import { useState, useEffect, useCallback } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  Users,
  DollarSign,
  Clock,
  TrendingUp,
  Receipt,
  CheckCircle,
  Circle,
  XCircle,
} from 'lucide-react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import type { ApiSuccess } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'today' | 'last7days' | 'last30days' | 'current_month'
type StatusFilter = 'all' | 'open' | 'closed' | 'cancelled'

interface HistoryOrderItem {
  name: string
  quantity: number
  unit_price: number
  line_total: number
}

interface HistoryOrder {
  id: number
  sequence_number: number
  status: string
  sent_to_kitchen_at: string | null
  delivered_at: string | null
  items: HistoryOrderItem[]
}

interface HistoryPayment {
  method: string
  amount: number
  tip_amount: number
}

interface HistoryBill {
  id: number
  table_number: number | null
  waiter_id: number
  waiter_name: string | null
  status: 'open' | 'closed' | 'cancelled'
  split_method: string | null
  tip_percent: number | null
  tip_amount: number | null
  subtotal: number | null
  total: number | null
  opened_at: string
  closed_at: string | null
  duration_minutes: number | null
  orders: HistoryOrder[]
  payments: HistoryPayment[]
}

interface HistorySummary {
  total_sales: number
  tables_served: number
  total_tips: number
  avg_ticket: number
  avg_service_minutes: number
}

interface WaiterOption {
  id: number
  name: string
}

interface HistoryResponse {
  summary: HistorySummary
  bills: HistoryBill[]
  waiters: WaiterOption[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtAvgTime(minutes: number): string {
  if (minutes === 0) return '—'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function methodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    credit: 'Credit Card',
    debit: 'Debit Card',
    tap_to_pay: 'Tap to Pay',
    qr_code: 'QR Code',
    card_reader: 'Card Reader',
  }
  return labels[method] ?? method
}

function splitLabel(method: string | null): string {
  const labels: Record<string, string> = {
    full: 'Full',
    split_equally: 'Split Equally',
    custom_amount: 'Custom Amount',
    by_items: 'By Items',
  }
  return method ? (labels[method] ?? method) : '—'
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-semibold text-[#166534]">
        <CheckCircle size={10} />
        Closed
      </span>
    )
  }
  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
        <Circle size={10} />
        Open
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-semibold text-[#991B1B]">
      <XCircle size={10} />
      Cancelled
    </span>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  iconBg,
  icon: Icon,
}: {
  label: string
  value: string
  sub: string
  iconBg: string
  icon: React.ElementType
}) {
  return (
    <div className="flex items-center justify-between rounded-[14px] border border-[#E5E7EB] bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-[#1E2939]">
      <div className="flex flex-col gap-0.5">
        <span className="text-[12px] font-medium text-[#6B7280] dark:text-gray-400">{label}</span>
        <span className="text-[22px] font-bold leading-tight text-[#1E2939] dark:text-white">{value}</span>
        <span className="text-[11px] text-[#9CA3AF] dark:text-gray-500">{sub}</span>
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${iconBg}`}>
        <Icon size={20} className="text-white" />
      </div>
    </div>
  )
}

// ── Bill accordion row ────────────────────────────────────────────────────────

function BillRow({ bill }: { bill: HistoryBill }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#E5E7EB] dark:border-gray-700">
      {/* Header button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between bg-[#F9FAFB] px-4 py-3 text-left transition-colors hover:bg-gray-100 dark:bg-[#1E2939] dark:hover:bg-gray-700"
      >
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-[#1E2939] dark:text-white">
              Bill #{String(bill.id).padStart(3, '0')}
            </span>
            <StatusBadge status={bill.status} />
          </div>
          <span className="text-[12px] text-[#6B7280] dark:text-gray-400">
            {fmtDateTime(bill.opened_at)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 ml-2">
          <span className="text-[15px] font-bold text-[#1E2939] dark:text-white">
            {bill.total !== null ? `€${fmt(bill.total)}` : '—'}
          </span>
          {open ? (
            <ChevronUp size={16} className="text-[#6B7280]" />
          ) : (
            <ChevronDown size={16} className="text-[#6B7280]" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-[#E5E7EB] bg-[#F3F4F6] dark:border-gray-700 dark:bg-[#111827]">
          {/* Info strip */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[#E5E7EB] px-4 py-3 dark:border-gray-700">
            <InfoChip label="Table" value={bill.table_number ? `#${bill.table_number}` : '—'} />
            <InfoChip label="Duration" value={fmtDuration(bill.duration_minutes)} />
            <InfoChip label="Opened" value={fmtTime(bill.opened_at)} />
            <InfoChip label="Closed" value={fmtTime(bill.closed_at)} />
            <InfoChip label="Waiter" value={bill.waiter_name ?? '—'} />
          </div>

          {/* Orders */}
          <div className="px-4 pt-3 pb-2">
            <p className="mb-2 text-[13px] font-semibold text-[#1E2939] dark:text-white">
              Orders ({bill.orders.length})
            </p>
            <div className="flex flex-col gap-2">
              {bill.orders.map((order) => (
                <div
                  key={order.id}
                  className="overflow-hidden rounded-[8px] bg-[#F9FAFB] dark:bg-[#1E2939]"
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] px-3 py-2 dark:border-gray-700">
                    <span className="text-[12px] font-semibold text-[#1E2939] dark:text-white">
                      Order #{order.sequence_number}
                    </span>
                    <span className="text-[11px] text-[#6B7280] dark:text-gray-400">
                      {fmtTime(order.sent_to_kitchen_at)}
                      {order.delivered_at ? ` → ${fmtTime(order.delivered_at)}` : ''}
                    </span>
                  </div>
                  {/* Items */}
                  <div className="flex flex-col divide-y divide-[#E5E7EB] dark:divide-gray-700">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5">
                        <span className="text-[12px] text-[#1E2939] dark:text-white">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-[12px] text-[#6B7280] dark:text-gray-400">
                          €{fmt(item.line_total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {bill.orders.length === 0 && (
                <p className="text-[12px] italic text-[#9CA3AF]">No orders</p>
              )}
            </div>
          </div>

          {/* Payment summary */}
          <div className="mx-4 mb-3 mt-1 rounded-[8px] border border-[#E5E7EB] bg-[#F9FAFB] dark:border-gray-700 dark:bg-[#1E2939]">
            {/* Method + split */}
            <div className="flex flex-col gap-1 border-b border-[#E5E7EB] px-3 py-2 dark:border-gray-700">
              {bill.payments.length > 0 ? (
                bill.payments.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-[12px] text-[#6B7280] dark:text-gray-400">
                      Payment Method:
                    </span>
                    <span className="text-[12px] font-medium text-[#1E2939] dark:text-white">
                      {methodLabel(p.method)}
                    </span>
                  </div>
                ))
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[#6B7280] dark:text-gray-400">Split Type:</span>
                <span className="text-[12px] font-medium text-[#1E2939] dark:text-white">
                  {splitLabel(bill.split_method)}
                </span>
              </div>
            </div>
            {/* Totals */}
            <div className="flex flex-col gap-1 px-3 py-2">
              <div className="flex justify-between">
                <span className="text-[12px] text-[#6B7280] dark:text-gray-400">Subtotal:</span>
                <span className="text-[12px] text-[#6B7280] dark:text-gray-400">
                  {bill.subtotal !== null ? `€${fmt(bill.subtotal)}` : '—'}
                </span>
              </div>
              {(bill.tip_percent !== null && bill.tip_percent > 0) && (
                <div className="flex justify-between">
                  <span className="text-[12px] text-[#F54900]">
                    Tip ({bill.tip_percent}%):
                  </span>
                  <span className="text-[12px] text-[#F54900]">
                    +€{fmt(bill.tip_amount ?? 0)}
                  </span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-[#E5E7EB] pt-1.5 dark:border-gray-700">
                <span className="text-[13px] font-bold text-[#1E2939] dark:text-white">Total:</span>
                <span className="text-[13px] font-bold text-[#1E2939] dark:text-white">
                  {bill.total !== null ? `€${fmt(bill.total)}` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[12px] text-[#6B7280] dark:text-gray-400">
      <span className="font-medium text-[#4B5563] dark:text-gray-300">{label}:</span>{' '}
      {value}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'last7days', label: 'Last 7 days' },
  { value: 'last30days', label: 'Last 30 days' },
  { value: 'current_month', label: 'This month' },
]

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All status' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function HistoryPage() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  const [period, setPeriod] = useState<Period>('today')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [waiterId, setWaiterId] = useState<number | null>(null)

  const [data, setData] = useState<HistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { period, status: statusFilter }
      if (waiterId) params.waiter_id = String(waiterId)
      const res = await api.get<ApiSuccess<HistoryResponse>>('/history/bills', { params })
      setData(res.data.data)
    } catch {
      setError('Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [period, statusFilter, waiterId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const summary = data?.summary
  const bills = data?.bills ?? []
  const waiters = data?.waiters ?? []

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {/* ── Page header ── */}
          <div className="mb-5">
            <h1 className="text-[22px] font-bold tracking-tight text-[#1E2939] dark:text-white">
              Bill History
            </h1>
            <p className="text-[13px] text-[#6B7280] dark:text-gray-400">
              Track your sales, tips, and service performance.
            </p>
          </div>

          {/* ── Filters ── */}
          <div className="mb-5 flex flex-wrap gap-2">
            {/* Period filter */}
            <div className="flex items-center gap-1 rounded-[10px] border border-[#E5E7EB] bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-[#1E2939]">
              <Calendar size={14} className="ml-1 text-[#6B7280]" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="bg-transparent pr-1 text-[13px] font-medium text-[#4A5565] outline-none dark:text-gray-300"
              >
                {PERIODS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1 rounded-[10px] border border-[#E5E7EB] bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-[#1E2939]">
              <Filter size={14} className="ml-1 text-[#6B7280]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-transparent pr-1 text-[13px] font-medium text-[#4A5565] outline-none dark:text-gray-300"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Waiter filter — manager only */}
            {isManager && (
              <div className="flex items-center gap-1 rounded-[10px] border border-[#E5E7EB] bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-[#1E2939]">
                <Users size={14} className="ml-1 text-[#6B7280]" />
                <select
                  value={waiterId ?? ''}
                  onChange={(e) => setWaiterId(e.target.value ? Number(e.target.value) : null)}
                  className="bg-transparent pr-1 text-[13px] font-medium text-[#4A5565] outline-none dark:text-gray-300"
                >
                  <option value="">All waiters</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── KPI cards ── */}
          {summary && (
            <div className="mb-5 grid grid-cols-2 gap-3">
              <KpiCard
                label="Total Sales"
                value={`€${fmt(summary.total_sales)}`}
                sub={`${summary.tables_served} tables`}
                iconBg="bg-[#2B7FFF]"
                icon={DollarSign}
              />
              <KpiCard
                label="Tables Served"
                value={String(summary.tables_served)}
                sub="Closed bills"
                iconBg="bg-[#F54900]"
                icon={Receipt}
              />
              <KpiCard
                label="Total Tips"
                value={`€${fmt(summary.total_tips)}`}
                sub={summary.tables_served > 0 ? `Avg €${fmt(summary.total_tips / summary.tables_served)}/table` : '—'}
                iconBg="bg-[#16A34A]"
                icon={TrendingUp}
              />
              <KpiCard
                label="Avg. Service Time"
                value={fmtAvgTime(summary.avg_service_minutes)}
                sub="Per table"
                iconBg="bg-[#9810FA]"
                icon={Clock}
              />
              <KpiCard
                label="Average Ticket"
                value={summary.tables_served > 0 ? `€${fmt(summary.avg_ticket)}` : '—'}
                sub="Per table"
                iconBg="bg-[#E7000B]"
                icon={DollarSign}
              />
            </div>
          )}

          {/* ── Bills list ── */}
          <div className="rounded-[14px] border border-[#E5E7EB] bg-white shadow-sm dark:border-gray-700 dark:bg-[#1E2939]">
            <div className="border-b border-[#E5E7EB] px-4 py-3 dark:border-gray-700">
              <h2 className="text-[15px] font-semibold text-[#1E2939] dark:text-white">
                Bills ({bills.length})
              </h2>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#F54900] border-t-transparent" />
              </div>
            ) : error ? (
              <div className="py-12 text-center text-[13px] text-red-500">{error}</div>
            ) : bills.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-[#9CA3AF]">
                No bills found for this period.
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3">
                {bills.map((bill) => (
                  <BillRow key={bill.id} bill={bill} />
                ))}
              </div>
            )}
          </div>

          {/* Bottom padding for nav bar */}
          <div className="h-4" />
        </div>
      </div>
    </div>
  )
}
