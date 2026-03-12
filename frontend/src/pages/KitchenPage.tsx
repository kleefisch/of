import { useEffect, useState, useCallback, useRef } from 'react'
import { ChefHat, Clock, User, ShoppingBag, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { useKitchenOrders } from '@/hooks/useKitchenOrders'
import { useAuth } from '@/contexts/AuthContext'
import ConfirmCancelDialog from '@/components/ConfirmCancelDialog'
import type { Order, OrderItem } from '@/types'

// ---------------------------------------------------------------------------
// Elapsed timer — counts up from `since`; freezes at `until` when provided
// ---------------------------------------------------------------------------
function useElapsed(since: string, until?: string | null) {
  const getSeconds = () => {
    const end = until ? new Date(until).getTime() : Date.now()
    return Math.floor((end - new Date(since).getTime()) / 1000)
  }
  const [seconds, setSeconds] = useState(getSeconds)

  useEffect(() => {
    if (until) {
      setSeconds(getSeconds())
      return
    }
    const id = setInterval(() => setSeconds(getSeconds()), 1_000)
    return () => clearInterval(id)
  }, [since, until]) // eslint-disable-line react-hooks/exhaustive-deps

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Column theme tokens
// ---------------------------------------------------------------------------
type ColumnTheme = {
  headerBg: string
  bodyBg: string
  cardBg: string
  cardBorder: string
  avatarBg: string
  avatarBorder: string
  timerBg: string
  timerBorder: string
  timerText: string
  actionBg: string
  actionLabel: string
  noticeBg: string
  noticeBorder: string
  noticeText: string
}

const THEMES: Record<'pending' | 'preparing' | 'done', ColumnTheme> = {
  pending: {
    headerBg: '#E7000B',
    bodyBg: 'rgba(254,242,242,0.5)',
    cardBg: '#FEF2F2',
    cardBorder: '#FFC9C9',
    avatarBg: '#FFE2E2',
    avatarBorder: '#FFC9C9',
    timerBg: '#FFE2E2',
    timerBorder: '#FFC9C9',
    timerText: '#9F0712',
    actionBg: '#D08700',
    actionLabel: 'Start Preparing',
    noticeBg: '#FFE2E2',
    noticeBorder: '#FFC9C9',
    noticeText: '#9F0712',
  },
  preparing: {
    headerBg: '#D08700',
    bodyBg: 'rgba(254,252,232,0.5)',
    cardBg: '#FEFCE8',
    cardBorder: '#FFF085',
    avatarBg: '#FEF9C2',
    avatarBorder: '#FFF085',
    timerBg: '#FEF9C2',
    timerBorder: '#FFF085',
    timerText: '#894B00',
    actionBg: '#00A63E',
    actionLabel: 'Mark Done',
    noticeBg: '#FEF9C2',
    noticeBorder: '#FFF085',
    noticeText: '#894B00',
  },
  done: {
    headerBg: '#00A63E',
    bodyBg: 'rgba(240,253,244,0.5)',
    cardBg: '#F0FDF4',
    cardBorder: '#B9F8CF',
    avatarBg: '#DCFCE7',
    avatarBorder: '#B9F8CF',
    timerBg: '#DCFCE7',
    timerBorder: '#00A63E',
    timerText: '#016630',
    actionBg: '#00A63E',
    actionLabel: 'Deliver',
    noticeBg: '#DCFCE7',
    noticeBorder: '#7BF1A8',
    noticeText: '#008236',
  },
}

// ---------------------------------------------------------------------------
// Order item row
// ---------------------------------------------------------------------------
function ItemRow({ item, accentText }: { item: OrderItem; accentText: string }) {
  return (
    <div
      className="rounded-[10px] border"
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: '#E5E7EB',
        padding: '9px 12px',
      }}
    >
      <div className="flex items-start gap-2">
        {/* Qty bubble */}
        <div
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white font-medium"
          style={{
            fontSize: 10,
            color: accentText,
            boxShadow: '0 0 0 1.5px currentColor',
          }}
        >
          {item.quantity}
        </div>

        <div className="flex-1">
          <p
            className="font-semibold leading-tight"
            style={{ fontSize: 14, color: '#1E2939' }}
          >
            {item.name ?? `Item #${item.menu_item_id}`}
          </p>
          {item.special_instructions && (
            <p
              className="mt-0.5 leading-snug"
              style={{ fontSize: 12, color: '#F54900' }}
            >
              {item.special_instructions}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Order card
// ---------------------------------------------------------------------------
function OrderCard({
  order,
  theme,
  canAct,
  canCancel,
  onAction,
  onCancel,
}: {
  order: Order
  theme: ColumnTheme
  canAct: boolean
  canCancel: boolean
  onAction?: (orderId: number) => void
  onCancel: (orderId: number) => void
}) {
  const elapsed = useElapsed(order.sent_to_kitchen_at, order.done_at)
  const sentAt = new Date(order.sent_to_kitchen_at)
  const timeLabel = sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const totalItems = order.items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <div
      className="rounded-[14px] overflow-hidden"
      style={{
        backgroundColor: theme.cardBg,
        border: `2px solid ${theme.cardBorder}`,
        boxShadow:
          '0px 1px 2px -1px rgba(0,0,0,0.1), 0px 1px 3px 0px rgba(0,0,0,0.1)',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-start justify-between gap-2 rounded-t-[12px] border-b px-3 py-3"
        style={{
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderColor: '#E5E7EB',
        }}
      >
        {/* Left: avatar + table info */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
            style={{
              backgroundColor: theme.avatarBg,
              border: `1px solid ${theme.avatarBorder}`,
            }}
          >
            <ChefHat size={16} color={theme.timerText} strokeWidth={2} />
          </div>
          <div>
            <p className="font-bold leading-tight" style={{ fontSize: 20, color: '#1E2939' }}>
              Table {order.table_number ?? '—'}
            </p>
            <p
              className="leading-none tracking-wide"
              style={{ fontSize: 10, color: '#6A7282', letterSpacing: '0.05em' }}
            >
              #{order.sequence_number} · {timeLabel}
            </p>
          </div>
        </div>

        {/* Right: timer, waiter, item count */}
        <div className="flex flex-col items-end gap-1.5">
          {/* Timer chip */}
          <div
            className="flex items-center gap-1 rounded-[10px] px-2 py-1"
            style={{
              backgroundColor: theme.timerBg,
              border: `1px solid ${theme.timerBorder}`,
            }}
          >
            <Clock size={12} color={theme.timerText} strokeWidth={2} />
            <span
              className="font-bold tabular-nums"
              style={{ fontSize: 12, color: theme.timerText, fontFamily: 'Menlo, monospace' }}
            >
              {elapsed}
            </span>
          </div>

          {/* Waiter */}
          {order.waiter_name && (
            <div className="flex items-center gap-1">
              <User size={12} color="#4A5565" strokeWidth={2} />
              <span style={{ fontSize: 12, color: '#4A5565', fontWeight: 500 }}>
                {order.waiter_name}
              </span>
            </div>
          )}

          {/* Item count */}
          <div className="flex items-center gap-1">
            <ShoppingBag size={12} color="#4A5565" strokeWidth={2} />
            <span style={{ fontSize: 12, color: '#4A5565', fontWeight: 600 }}>
              {totalItems} {totalItems === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-2 px-3 py-3">
        {order.items.map((item) => (
          <ItemRow key={item.id} item={item} accentText={theme.timerText} />
        ))}
      </div>

      {/* Done section: notice shown only for roles that cannot deliver (i.e. kitchen) */}
      {order.status === 'done' && !canAct && (
        <div
          className="mx-3 mb-3 flex items-center justify-center gap-1.5 rounded-[10px] py-2"
          style={{
            backgroundColor: theme.noticeBg,
            border: `1px solid ${theme.noticeBorder}`,
          }}
        >
          <ChevronRight size={14} color={theme.noticeText} strokeWidth={2} />
          <span style={{ fontSize: 12, color: theme.noticeText, fontWeight: 500 }}>
            Waiting for waiter to deliver
          </span>
        </div>
      )}

      {/* Action button: canAct gates by role per status (see OrderColumn) */}
      {canAct && onAction && (
        <div className="px-3 pb-3">
          <button
            onClick={() => onAction(order.id)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] font-semibold text-white transition-opacity active:opacity-80"
            style={{ backgroundColor: theme.actionBg, fontSize: 14 }}
          >
            {theme.actionLabel}
          </button>
        </div>
      )}

      {/* Cancel button */}
      {canCancel && (
        <div className="px-3 pb-3">
          <button
            onClick={() => onCancel(order.id)}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[#FCA5A5] bg-[#FEF2F2] font-semibold text-[#C10007] transition-opacity active:opacity-80"
            style={{ fontSize: 14 }}
          >
            <X size={16} strokeWidth={2} />
            Cancel Order
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Column section
// ---------------------------------------------------------------------------
type StatusKey = 'pending' | 'preparing' | 'done'

const COLUMN_LABELS: Record<StatusKey, string> = {
  pending: 'Pending',
  preparing: 'Preparing',
  done: 'Done',
}

const NEXT_STATUS: Record<'pending' | 'preparing', 'preparing' | 'done'> = {
  pending: 'preparing',
  preparing: 'done',
}

function OrderColumn({
  status,
  orders,
  role,
  onUpdateStatus,
  onRequestCancel,
}: {
  status: StatusKey
  orders: Order[]
  role: string
  onUpdateStatus: (id: number, status: 'preparing' | 'done' | 'delivered' | 'cancelled') => void
  onRequestCancel: (orderId: number) => void
}) {
  const theme = THEMES[status]

  // pending/preparing → kitchen or manager can act
  // done → waiter or manager can deliver
  const canAct =
    status === 'done'
      ? role === 'waiter' || role === 'manager'
      : role === 'kitchen' || role === 'manager'

  const handleAction = (orderId: number) => {
    if (status === 'pending' || status === 'preparing') {
      onUpdateStatus(orderId, NEXT_STATUS[status])
    } else if (status === 'done') {
      onUpdateStatus(orderId, 'delivered')
    }
  }

  // Cancel permission per CONTEXT rules:
  // pending   → waiter, kitchen, manager
  // preparing → kitchen, manager
  // done      → manager only
  const canCancelStatus = (orderStatus: StatusKey) => {
    if (role === 'manager') return true
    if (role === 'kitchen') return orderStatus !== 'done'
    if (role === 'waiter') return orderStatus === 'pending'
    return false
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-[14px]">
      {/* Column header */}
      <div
        className="flex h-13 items-center justify-between px-4"
        style={{
          backgroundColor: theme.headerBg,
          borderRadius: '14px 14px 0 0',
          boxShadow:
            '0px 2px 4px -2px rgba(0,0,0,0.1), 0px 4px 6px -1px rgba(0,0,0,0.1)',
        }}
      >
        <span className="font-bold text-white" style={{ fontSize: 18 }}>
          {COLUMN_LABELS[status]}
        </span>
        <div
          className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2"
        >
          <span className="font-bold" style={{ fontSize: 14, color: theme.headerBg }}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div
        className="flex flex-col gap-3 rounded-b-[14px] p-3"
        style={{ backgroundColor: theme.bodyBg }}
      >
        {orders.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">No orders</p>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              theme={theme}
              canAct={canAct}
              canCancel={canCancelStatus(status)}
              onAction={handleAction}
              onCancel={onRequestCancel}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Notification helpers (vibration + toast — audio handled inside KitchenPage)
// ---------------------------------------------------------------------------
function notifyNewOrder(audio: HTMLAudioElement | null) {
  if (audio) {
    audio.currentTime = 0
    audio.play().catch(() => {})
  }
  navigator.vibrate?.([200, 80, 200])
  toast.info('New order received!', { duration: 5000 })
}

// ---------------------------------------------------------------------------
// KitchenPage
// ---------------------------------------------------------------------------
export default function KitchenPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Preload and unlock audio on first user gesture
  useEffect(() => {
    const audio = new Audio('/beep.wav')
    audio.preload = 'auto'
    audioRef.current = audio
    function unlockAudio() {
      audio.play().then(() => audio.pause()).catch(() => {})
    }
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [])

  const handleNewOrder = useCallback(() => notifyNewOrder(audioRef.current), [])
  const { pending, preparing, done, isLoading, error, updateOrderStatus } =
    useKitchenOrders(handleNewOrder)
  const { user } = useAuth()
  const role = user?.role ?? 'waiter'
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null)

  async function confirmCancel() {
    if (cancelTargetId === null) return
    const id = cancelTargetId
    setCancelTargetId(null)
    await updateOrderStatus(id, 'cancelled')
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-gray-500">Loading orders…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Page header */}
        <div className="flex items-center gap-2">
          <ChefHat size={24} color="#1E2939" strokeWidth={2} />
          <h1 className="font-bold" style={{ fontSize: 24, color: '#1E2939' }}>
            Kitchen Dashboard
          </h1>
        </div>

        {/* Columns — stacked on mobile, kanban side-by-side on md+ */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="flex-1">
            <OrderColumn
              status="pending"
              orders={pending}
              role={role}
              onUpdateStatus={updateOrderStatus}
              onRequestCancel={setCancelTargetId}
            />
          </div>
          <div className="flex-1">
            <OrderColumn
              status="preparing"
              orders={preparing}
              role={role}
              onUpdateStatus={updateOrderStatus}
              onRequestCancel={setCancelTargetId}
            />
          </div>
          <div className="flex-1">
            <OrderColumn
              status="done"
              orders={done}
              role={role}
              onUpdateStatus={updateOrderStatus}
              onRequestCancel={setCancelTargetId}
            />
          </div>
        </div>
      </div>

      <ConfirmCancelDialog
        open={cancelTargetId !== null}
        onConfirm={confirmCancel}
        onClose={() => setCancelTargetId(null)}
      />
    </>
  )
}
