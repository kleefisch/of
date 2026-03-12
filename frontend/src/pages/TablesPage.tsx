
import { useState, useEffect } from 'react'
import { Users, LayoutGrid } from 'lucide-react'
import { useTables } from '@/hooks/useTables'
import { useAuth } from '@/contexts/AuthContext'
import TableActionModal from '@/components/TableActionModal'
import type { Table, TableStatus } from '@/types'

// ── Elapsed timer (live, ticking every second) ──────────────────────────────
function ElapsedTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const update = () => {
      const diff = Date.now() - new Date(startedAt).getTime()
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setElapsed(
        h > 0
          ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
          : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [startedAt])

  return <span className="font-mono text-[12px] font-medium text-[#E7000B]">{elapsed}</span>
}

// ── Per-status design tokens ─────────────────────────────────────────────────
const STATUS_STYLES: Record<TableStatus, { card: string; badge: string; badgeText: string }> = {
  available: {
    card: 'bg-[#F0FDF4] border-[#B9F8CF]',
    badge: 'bg-[#B9F8CF]',
    badgeText: 'text-[#016630]',
  },
  occupied: {
    card: 'bg-[#FEF2F2] border-[#FFC9C9]',
    badge: 'bg-[#FFC9C9]',
    badgeText: 'text-[#9F0712]',
  },
  reserved: {
    card: 'bg-[#FFF7ED] border-[#FFD6A8]',
    badge: 'bg-[#FFD6A8]',
    badgeText: 'text-[#9F2D00]',
  },
}

// ── Table card ───────────────────────────────────────────────────────────────
function TableCard({ table, onPress }: { table: Table; onPress: (t: Table) => void }) {
  const { card, badge, badgeText } = STATUS_STYLES[table.status]
  const label = table.status.charAt(0).toUpperCase() + table.status.slice(1)

  return (
    <button
      onClick={() => onPress(table)}
      className={`relative flex h-35 w-full flex-col overflow-hidden rounded-[14px] border-2 shadow-sm transition-opacity active:opacity-70 ${card}`}
    >
      {/* Seats badge — top-left */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full border border-[rgba(209,213,220,0.5)] bg-white/80 px-2 py-0.5">
        <Users size={12} className="text-[#4A5565]" />
        <span className="text-[10px] font-semibold tracking-[0.012em] text-[#364153]">{table.seats}</span>
      </div>

      {/* Timer badge — top-right (occupied only) */}
      {table.status === 'occupied' && table.service_started_at && (
        <div className="absolute top-2.5 right-2.5 rounded-[8px] border border-[rgba(255,201,201,0.5)] bg-white/80 px-1.5 py-0.5">
          <ElapsedTimer startedAt={table.service_started_at} />
        </div>
      )}

      {/* Center content: icon + number + status badge */}
      <div
        className={`flex flex-col items-center justify-center gap-2 ${
          table.status === 'occupied' ? 'h-25.25' : 'flex-1'
        }`}
      >
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-[#4A5565] dark:text-gray-400" />
          <span className="text-[30px] font-bold leading-none tracking-[0.013em] text-[#1E2939] dark:text-white">
            {table.number}
          </span>
        </div>
        <div className={`rounded-full px-3 py-1 text-[12px] font-semibold ${badge} ${badgeText}`}>
          {label}
        </div>
      </div>

      {/* Waiter info — bottom (occupied only) */}
      {table.status === 'occupied' && (
        <div className="flex h-9.75 items-start border-t border-[#E5E7EB] px-2 pt-2.25">
          <p className="w-full truncate text-center text-[12px] font-medium text-[#4A5565]">
            👤{table.waiter_display_name ? ` ${table.waiter_display_name}` : ''}
          </p>
        </div>
      )}
    </button>
  )
}

// ── Filter type ──────────────────────────────────────────────────────────────
type FilterKey = 'my' | 'all' | TableStatus

// ── TablesPage ───────────────────────────────────────────────────────────────
export default function TablesPage() {
  const { user } = useAuth()
  const { tables, isLoading, error, refetch } = useTables()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)

  const counts = {
    my: tables.filter((t) => t.waiter_id === user?.id).length,
    all: tables.length,
    available: tables.filter((t) => t.status === 'available').length,
    occupied: tables.filter((t) => t.status === 'occupied').length,
    reserved: tables.filter((t) => t.status === 'reserved').length,
  }

  const filterOptions: Array<{ key: FilterKey; label: string }> = [
    { key: 'my', label: `My Tables (${counts.my})` },
    { key: 'all', label: `All (${counts.all})` },
    { key: 'available', label: `Available (${counts.available})` },
    { key: 'occupied', label: `Occupied (${counts.occupied})` },
    { key: 'reserved', label: `Reserved (${counts.reserved})` },
  ]

  const filtered = tables.filter((t) => {
    if (filter === 'my') return t.waiter_id === user?.id
    if (filter === 'all') return true
    return t.status === filter
  })

  const handlePress = (table: Table) => setSelectedTable(table)

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-[14px] text-[#6A7282]">
        Loading tables…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center text-[14px] text-red-500">{error}</div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {selectedTable && (
        <TableActionModal
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onSuccess={refetch}
        />
      )}
      {/* Heading + filters */}
      <div className="flex flex-col gap-3">
        <h1 className="text-[20px] font-bold leading-tight tracking-[-0.022em] text-[#1E2939] dark:text-white">
          Select a Table
        </h1>

        {/* Horizontally scrollable filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`shrink-0 rounded-[10px] px-4.25 py-2.25 text-[14px] font-semibold transition-colors ${
                filter === key
                  ? 'bg-[#1E2939] text-white dark:bg-white dark:text-[#1E2939]'
                  : 'border border-[#D1D5DC] bg-white text-[#364153] dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table cards grid */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-[14px] text-[#6A7282]">
          No tables found.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((table) => (
            <TableCard key={table.id} table={table} onPress={handlePress} />
          ))}
        </div>
      )}
    </div>
  )
}
