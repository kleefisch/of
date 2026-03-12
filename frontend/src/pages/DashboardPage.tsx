import { useState, useEffect, useCallback } from 'react'
import {
  DollarSign,
  Receipt,
  Clock,
  TrendingUp,
  Users,
  BarChart2,
  ChefHat,
  RefreshCw,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import api from '@/services/api'
import type { ApiSuccess } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type Period = 'today' | '7d' | '30d' | 'month' | 'custom'

interface TrendPoint {
  date: string
  value: number
}

interface TopItem {
  name: string
  quantity: number
  revenue: number
}

interface HourBucket {
  hour: number
  count: number
}

interface TableOverview {
  id: number
  number: number
  seats: number
  status: string
}

interface WaiterOption {
  id: number
  name: string
}

interface DashboardData {
  filters: { period: string; waiter_id: number | null; start_date: string; end_date: string }
  revenue: { total: number; trend: TrendPoint[] }
  avg_ticket: { value: number; trend: TrendPoint[] }
  bills_closed: { total: number; trend: TrendPoint[] }
  total_tips: { total: number; trend: TrendPoint[] }
  avg_turn_time_minutes: number
  turn_time_trend: TrendPoint[]
  table_utilization_pct: number
  top_items: TopItem[]
  orders_by_hour: HourBucket[]
  avg_prep_time_minutes: number
  prep_time_trend: TrendPoint[]
  tables_overview: TableOverview[]
  waiters: WaiterOption[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(value: number) {
  return '$' + value.toFixed(2)
}

function fmtMin(value: number) {
  const m = Math.floor(value)
  const s = Math.round((value - m) * 60)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

const TABLE_STATUS_CLASSES: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  occupied: 'bg-amber-100 text-amberted-700 border-amber-200',
  reserved: 'bg-blue-100 text-blue-700 border-blue-200',
  cleaning: 'bg-purple-100 text-purple-700 border-purple-200',
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  custom: 'Custom',
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  if (h === 0) return '12a'
  if (h < 12) return `${h}a`
  if (h === 12) return '12p'
  return `${h - 12}p`
})

// ── Sub-components ────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string
  icon: React.ReactNode
  sub?: string
}

function KpiCard({ label, value, icon, sub }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm flex gap-3 items-start">
      <div className="rounded-lg bg-[#F3F4F6] p-2 text-[#374151] shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#6B7280] truncate">{label}</p>
        <p className="text-xl font-bold text-[#111827] leading-tight">{value}</p>
        {sub && <p className="text-xs text-[#9CA3AF] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [waiterId, setWaiterId] = useState<number | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = { period }
      if (period === 'custom') {
        if (!customStart || !customEnd) { setLoading(false); return }
        params.start_date = customStart
        params.end_date = customEnd
      }
      if (waiterId) params.waiter_id = String(waiterId)
      const res = await api.get<ApiSuccess<DashboardData>>('/analytics/dashboard', { params })
      setData(res.data.data)
    } catch {
      setError('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }, [period, customStart, customEnd, waiterId])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const waiters = data?.waiters ?? []

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F9FAFB] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E5E7EB] px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-[#111827]">Dashboard</h1>
          <button
            onClick={fetchDashboard}
            disabled={loading}
            className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] disabled:opacity-40 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-4 space-y-6">
        {/* ── Filters ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-3 flex flex-wrap gap-2 items-center">
          {/* Period pills */}
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? 'bg-[#111827] text-white'
                    : 'bg-[#F3F4F6] text-[#374151] hover:bg-[#E5E7EB]'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {period === 'custom' && (
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="border border-[#D1D5DB] rounded-lg px-2 py-1.5 text-xs text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#111827]"
              />
              <span className="text-xs text-[#6B7280]">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="border border-[#D1D5DB] rounded-lg px-2 py-1.5 text-xs text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#111827]"
              />
            </div>
          )}

          {/* Waiter filter */}
          {waiters.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              <Users size={14} className="text-[#6B7280]" />
              <select
                value={waiterId ?? ''}
                onChange={(e) => setWaiterId(e.target.value ? Number(e.target.value) : null)}
                className="border border-[#D1D5DB] rounded-lg px-2 py-1.5 text-xs text-[#374151] focus:outline-none focus:ring-2 focus:ring-[#111827]"
              >
                <option value="">All staff</option>
                {waiters.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm p-4">
            {error}
          </div>
        )}

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Revenue"
                value={fmt$(data.revenue.total)}
                icon={<DollarSign size={18} />}
                sub={`${data.bills_closed.total} bills closed`}
              />
              <KpiCard
                label="Avg Ticket"
                value={fmt$(data.avg_ticket.value)}
                icon={<Receipt size={18} />}
              />
              <KpiCard
                label="Total Tips"
                value={fmt$(data.total_tips.total)}
                icon={<TrendingUp size={18} />}
              />
              <KpiCard
                label="Table Utilization"
                value={`${data.table_utilization_pct}%`}
                icon={<BarChart2 size={18} />}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <KpiCard
                label="Avg Turn Time"
                value={fmtMin(data.avg_turn_time_minutes)}
                icon={<Clock size={18} />}
                sub="per table"
              />
              <KpiCard
                label="Avg Prep Time"
                value={fmtMin(data.avg_prep_time_minutes)}
                icon={<ChefHat size={18} />}
                sub="kitchen"
              />
              <KpiCard
                label="Bills Closed"
                value={String(data.bills_closed.total)}
                icon={<Receipt size={18} />}
              />
            </div>

            {/* ── Revenue chart ──────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-4">
              <h2 className="text-sm font-semibold text-[#374151] mb-3">Revenue trend</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.revenue.trend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#111827" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={(v: string) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    tickFormatter={(v: number) => `$${v}`}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmt$(v), 'Revenue']}
                    labelFormatter={(l: string) => l}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#111827" strokeWidth={2} fill="url(#revGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── Orders by hour ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-4">
              <h2 className="text-sm font-semibold text-[#374151] mb-3">Orders by hour</h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.orders_by_hour} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 9, fill: '#9CA3AF' }}
                    tickFormatter={(h: number) => HOUR_LABELS[h]}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(v: number) => [v, 'Orders']}
                    labelFormatter={(h: number) => `${HOUR_LABELS[h]} – ${HOUR_LABELS[(h + 1) % 24]}`}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                  />
                  <Bar dataKey="count" fill="#374151" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Top items ──────────────────────────────────────────────── */}
            {data.top_items.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-4">
                <h2 className="text-sm font-semibold text-[#374151] mb-3">Top selling items</h2>
                <ResponsiveContainer width="100%" height={Math.max(180, data.top_items.length * 32)}>
                  <BarChart
                    data={data.top_items}
                    layout="vertical"
                    margin={{ top: 0, right: 60, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10, fill: '#374151' }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) =>
                        name === 'quantity' ? [v, 'Qty'] : [fmt$(v), 'Revenue']
                      }
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                    />
                    <Bar dataKey="quantity" fill="#111827" radius={[0, 3, 3, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── Tables live ────────────────────────────────────────────── */}
            {data.tables_overview.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-4">
                <h2 className="text-sm font-semibold text-[#374151] mb-3">Tables — current status</h2>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
                  {data.tables_overview.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg border p-2 text-center text-xs font-medium ${
                        TABLE_STATUS_CLASSES[t.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      <div className="text-base font-bold leading-tight">#{t.number}</div>
                      <div className="text-[10px] opacity-80 capitalize">{t.status}</div>
                      <div className="text-[10px] opacity-60">{t.seats}p</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {loading && !data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-[#F3F4F6]" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
