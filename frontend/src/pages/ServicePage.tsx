import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  Search,
  Plus,
  Minus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  BookOpen,
  X,
  CheckCheck,
  CreditCard,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { ApiSuccess, MenuItem, Order, OrderItem } from '@/types'
import { useCurrentBill } from '@/hooks/useCurrentBill'
import { useMenu } from '@/hooks/useMenu'
import AddItemModal from '@/components/AddItemModal'
import ConfirmCancelDialog from '@/components/ConfirmCancelDialog'
import CloseTableModal from '@/components/billing/CloseTableModal'

// ── Types ──────────────────────────────────────────────────────────────────────
interface CartItem {
  menuItem: MenuItem
  quantity: number
  specialInstructions: string
}
type ViewState = 'service' | 'menu' | 'review'
type ModalTarget = { item: MenuItem; initial?: { quantity: number; specialInstructions: string } }

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}
function cartTotal(cart: CartItem[]) {
  return cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0)
}
function orderItemsTotal(items: OrderItem[]) {
  return items.reduce((s, i) => s + i.unit_price * i.quantity, 0)
}
function ordersGrandTotal(orders: Order[]) {
  return orders.reduce((s, o) => s + orderItemsTotal(o.items), 0)
}

// ── CartItemRow (shared by MenuPanel and ReviewPanel) ─────────────────────────
function CartItemRow({
  cartItem,
  onQtyChange,
  onEdit,
  onRemove,
}: {
  cartItem: CartItem
  onQtyChange: (id: number, delta: number) => void
  onEdit: (cartItem: CartItem) => void
  onRemove: (id: number) => void
}) {
  const { menuItem, quantity, specialInstructions } = cartItem
  return (
    <div className="flex flex-col gap-2 rounded-[10px] bg-[#F9FAFB] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] font-semibold text-[#1E2939]">{menuItem.name}</span>
          <span className="text-[12px] text-[#4A5565]">${menuItem.price.toFixed(2)} each</span>
          {specialInstructions && (
            <span className="mt-0.5 self-start rounded-[4px] bg-[#FFF7ED] px-2 py-0.5 text-[12px] text-[#F54900]">
              📝 {specialInstructions}
            </span>
          )}
        </div>
        <span className="shrink-0 text-[16px] font-bold text-[#1E2939]">
          ${(menuItem.price * quantity).toFixed(2)}
        </span>
      </div>
      <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onQtyChange(menuItem.id, -1)}
            disabled={quantity <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#E5E7EB] text-[#364153] disabled:opacity-50"
          >
            <Minus size={14} />
          </button>
          <span className="w-8 text-center text-[20px] font-bold text-[#1E2939]">{quantity}</span>
          <button
            onClick={() => onQtyChange(menuItem.id, 1)}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#E5E7EB] text-[#364153]"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => onEdit(cartItem)}
            className="flex items-center gap-1 px-2 py-1.5 text-[12px] font-semibold text-[#F54900]"
          >
            <Pencil size={12} /> Edit
          </button>
          <button
            onClick={() => onRemove(menuItem.id)}
            className="flex items-center gap-1 px-2 py-1.5 text-[12px] font-semibold text-[#E7000B]"
          >
            <Trash2 size={12} /> Remove
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OrderCard — a sent order in the "Orders" section ──────────────────────────
function OrderCard({
  order,
  allItemsById,
  onCancel,
  onDeliver,
}: {
  order: Order
  allItemsById: Map<number, MenuItem>
  onCancel: (orderId: number) => void
  onDeliver: (orderId: number) => void
}) {
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
  const total = orderItemsTotal(order.items)
  const isPending = order.status === 'pending'
  const isDone = order.status === 'done'

  return (
    <div className="flex flex-col gap-2 rounded-[10px] bg-[#F9FAFB] p-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-semibold text-[#4A5565]">
          {itemCount} item{itemCount !== 1 ? 's' : ''} • {formatTime(order.sent_to_kitchen_at)}
        </span>
        <span
          className="flex items-center gap-1 rounded-[4px] border border-[#C10007] bg-[#FFE2E2] px-2 py-0.5 text-[12px] text-[#C10007]"
        >
          {order.status}
        </span>
      </div>
      {/* Items */}
      {order.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between">
          <span className="text-[12px] text-[#364153]">
            {item.quantity}x {allItemsById.get(item.menu_item_id)?.name ?? `Item #${item.menu_item_id}`}
          </span>
          <span className="text-[12px] text-[#4A5565]">${(item.unit_price * item.quantity).toFixed(2)}</span>
        </div>
      ))}
      {/* Total + Cancel */}
      <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-1.5">
        <span className="text-[12px] font-bold text-[#1E2939]">${total.toFixed(2)}</span>
        {isPending && (
          <button
            onClick={() => onCancel(order.id)}
            className="flex items-center gap-1 rounded-[10px] bg-[#E7000B] px-3 py-1 text-[12px] font-semibold text-white"
          >
            <X size={12} /> Cancel Order
          </button>
        )}
        {isDone && (
          <button
            onClick={() => onDeliver(order.id)}
            className="flex items-center gap-1 rounded-[10px] bg-[#00A63E] px-3 py-1 text-[12px] font-semibold text-white"
          >
            <CheckCheck size={12} /> Deliver
          </button>
        )}
      </div>
    </div>
  )
}

// ── ServicePanel — shown when view === 'service' ───────────────────────────────
function ServicePanel({
  cart,
  hasKitchenOrders,
  onBrowseMenu,
  onReview,
  onQtyChange,
  onEdit,
  onRemove,
}: {
  cart: CartItem[]
  hasKitchenOrders: boolean
  onBrowseMenu: () => void
  onReview: () => void
  onQtyChange: (id: number, delta: number) => void
  onEdit: (c: CartItem) => void
  onRemove: (id: number) => void
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-[18px] font-bold text-[#1E2939]">Add Items</h2>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center gap-1 py-8 text-center">
          <UtensilsCrossed size={32} className="text-[#D1D5DC]" />
          <p className="mt-2 text-[14px] font-semibold text-[#4A5565]">No items added yet</p>
          <p className="text-[12px] text-[#6A7282]">Browse the menu to add items</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cart.map((c) => (
            <CartItemRow
              key={c.menuItem.id}
              cartItem={c}
              onQtyChange={onQtyChange}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <button
          onClick={onBrowseMenu}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#4A5565] text-[16px] font-semibold text-white"
        >
          <BookOpen size={18} /> Browse Menu
        </button>
        {cart.length > 0 && (
          <button
            onClick={onReview}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#F54900] text-[16px] font-semibold text-white"
          >
            Review Order
          </button>
        )}
      </div>

      {hasKitchenOrders && (
        <div className="rounded-[10px] border border-[#FFF085] bg-[#FEFCE8] px-3 py-3">
          <p className="text-[12px] text-[#894B00]">Kitchen is preparing your orders...</p>
        </div>
      )}
    </div>
  )
}

// ── MenuPanel — shown when view === 'menu' ────────────────────────────────────
function MenuPanel({
  categories,
  items,
  isLoadingItems,
  activeCategoryId,
  setActiveCategoryId,
  search,
  setSearch,
  cart,
  onAddItem,
  onQtyChange,
  onEdit,
  onRemove,
  onDone,
  onReview,
}: {
  categories: import('@/types').MenuCategory[]
  items: MenuItem[]
  isLoadingItems: boolean
  activeCategoryId: number | null
  setActiveCategoryId: (id: number) => void
  search: string
  setSearch: (s: string) => void
  cart: CartItem[]
  onAddItem: (item: MenuItem) => void
  onQtyChange: (id: number, delta: number) => void
  onEdit: (c: CartItem) => void
  onRemove: (id: number) => void
  onDone: () => void
  onReview: () => void
}) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-bold text-[#1E2939]">Menu</h2>
        <button
          onClick={onDone}
          className="flex h-8 items-center justify-center rounded-[10px] bg-[#E5E7EB] px-3 text-[14px] font-semibold text-[#364153]"
        >
          Done
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#6A7282]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu items by name, description or category..."
          className="h-[42px] w-full rounded-[10px] border border-[#D1D5DC] bg-white pl-9 pr-3 text-[14px] text-[#1E2939] outline-none placeholder:text-black/50 focus:border-[#F54900]"
        />
      </div>

      {/* Category chips */}
      {!search && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`shrink-0 h-9 rounded-[10px] px-3 text-[14px] font-semibold transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-[#F54900] text-white'
                  : 'bg-[#F3F4F6] text-[#4A5565]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Items list */}
      <div className="flex flex-col gap-3">
        {isLoadingItems ? (
          <p className="py-4 text-center text-[14px] text-[#6A7282]">Loading...</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-[14px] text-[#6A7282]">No items found.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex overflow-hidden rounded-[10px] bg-[#F9FAFB]"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-24 w-24 shrink-0 object-cover"
                />
              )}
              <div className="flex flex-1 flex-col justify-between p-3">
                <div>
                  <p className="text-[14px] font-bold text-[#1E2939]">{item.name}</p>
                  {item.description && (
                    <p className="mt-0.5 text-[12px] text-[#4A5565] line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[16px] font-bold text-[#F54900]">
                    ${item.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => onAddItem(item)}
                    className="flex h-8 items-center gap-1 rounded-[10px] bg-[#F54900] px-3 text-[14px] font-semibold text-white"
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Current Order section (if cart has items) */}
      {cart.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-[#E5E7EB] pt-4">
          <h3 className="text-[14px] font-bold text-[#1E2939]">Current Order</h3>
          {cart.map((c) => (
            <CartItemRow
              key={c.menuItem.id}
              cartItem={c}
              onQtyChange={onQtyChange}
              onEdit={onEdit}
              onRemove={onRemove}
            />
          ))}
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-[#1E2939]">
              Subtotal ({cart.reduce((s, c) => s + c.quantity, 0)} items):
            </span>
            <span className="text-[14px] font-bold text-[#F54900]">
              ${cartTotal(cart).toFixed(2)}
            </span>
          </div>
          <button
            onClick={onReview}
            className="flex h-12 w-full items-center justify-center rounded-[10px] bg-[#F54900] text-[16px] font-semibold text-white"
          >
            Review Order
          </button>
        </div>
      )}
    </div>
  )
}

// ── ReviewPanel — shown when view === 'review' ────────────────────────────────
function ReviewPanel({
  cart,
  isSending,
  onQtyChange,
  onEdit,
  onRemove,
  onBrowseMenu,
  onSend,
}: {
  cart: CartItem[]
  isSending: boolean
  onQtyChange: (id: number, delta: number) => void
  onEdit: (c: CartItem) => void
  onRemove: (id: number) => void
  onBrowseMenu: () => void
  onSend: () => void
}) {
  const total = cartTotal(cart)
  const itemCount = cart.reduce((s, c) => s + c.quantity, 0)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-[18px] font-bold text-[#1E2939]">New Items</h2>

      <div className="flex flex-col gap-3">
        {cart.map((c) => (
          <CartItemRow
            key={c.menuItem.id}
            cartItem={c}
            onQtyChange={onQtyChange}
            onEdit={onEdit}
            onRemove={onRemove}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-2">
        <span className="text-[14px] font-bold text-[#1E2939]">Items: {itemCount}</span>
        <span className="text-[14px] font-bold text-[#F54900]">${total.toFixed(2)}</span>
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onBrowseMenu}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-[#4A5565] text-[16px] font-semibold text-white"
        >
          <BookOpen size={18} /> Browse Menu
        </button>
        <button
          onClick={onSend}
          disabled={isSending || cart.length === 0}
          className="flex h-12 w-full items-center justify-center rounded-[10px] bg-[#F54900] text-[16px] font-semibold text-white disabled:opacity-60"
        >
          {isSending ? 'Sending...' : `Add Order ($${total.toFixed(2)})`}
        </button>
      </div>
    </div>
  )
}

// ── ServicePage ───────────────────────────────────────────────────────────────
export default function ServicePage() {
  const { tableId } = useParams<{ tableId: string }>()
  const navigate = useNavigate()
  const id = Number(tableId)

  const { data, isLoading, error, refetch } = useCurrentBill(id)
  const {
    categories,
    items,
    allItemsById,
    isLoadingItems,
    activeCategoryId,
    setActiveCategoryId,
    search,
    setSearch,
  } = useMenu()

  const [view, setView] = useState<ViewState>('service')
  const [cart, setCart] = useState<CartItem[]>([])
  const [modalTarget, setModalTarget] = useState<ModalTarget | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null)
  const [closeModalOpen, setCloseModalOpen] = useState(false)

  function addOrUpdateCart(item: MenuItem, quantity: number, specialInstructions: string) {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.menuItem.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { menuItem: item, quantity, specialInstructions }
        return next
      }
      return [...prev, { menuItem: item, quantity, specialInstructions }]
    })
    setModalTarget(null)
  }

  function changeQty(menuItemId: number, delta: number) {
    setCart((prev) =>
      prev.map((c) =>
        c.menuItem.id === menuItemId
          ? { ...c, quantity: Math.max(1, c.quantity + delta) }
          : c,
      ),
    )
  }

  function removeFromCart(menuItemId: number) {
    setCart((prev) => prev.filter((c) => c.menuItem.id !== menuItemId))
  }

  async function sendOrder() {
    if (!data || cart.length === 0) return
    setIsSending(true)
    try {
      const response = await api.post<ApiSuccess<Order>>('/orders', {
        bill_id: data.billId,
        items: cart.map((c) => ({
          menu_item_id: c.menuItem.id,
          quantity: c.quantity,
          special_instructions: c.specialInstructions || null,
        })),
      })

      setCart([])
      setView('service')
      toast.success('Order sent to kitchen!')

      try {
        await refetch()
      } catch {
        toast.warning('Order was created, but the screen could not refresh automatically.')
      }

      return response
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to send order.'
      toast.error(msg)
    } finally {
      setIsSending(false)
    }
  }

  async function cancelOrder(orderId: number) {
    setCancelTargetId(orderId)
  }

  async function deliverOrder(orderId: number) {
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'delivered' })
      await refetch()
      toast.success('Order marked as delivered.')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to deliver order.'
      toast.error(msg)
    }
  }

  async function confirmCancel() {
    if (cancelTargetId === null) return
    const orderId = cancelTargetId
    setCancelTargetId(null)
    try {
      await api.patch(`/orders/${orderId}/status`, { status: 'cancelled' })
      await refetch()
      toast.success('Order cancelled.')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to cancel order.'
      toast.error(msg)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-[14px] text-[#6A7282]">
        Loading...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-3">
        <p className="text-[14px] text-red-500">{error ?? 'Table not found.'}</p>
        <button
          onClick={() => navigate('/tables')}
          className="text-[14px] font-semibold text-[#F54900]"
        >
          Back to Tables
        </button>
      </div>
    )
  }

  const { table, orders } = data
  const activeOrders = orders.filter((o) => ['pending', 'preparing', 'done'].includes(o.status))
  const hasKitchenOrders = activeOrders.length > 0
  const billTotal = ordersGrandTotal(orders)

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {/* Card 1 — Table header + existing orders */}
      <div className="rounded-[14px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.10),0px_1px_2px_-1px_rgba(0,0,0,0.10)]">
        {/* Header row */}
        <div className="flex items-start justify-between p-4">
          <button
            onClick={() => navigate('/tables')}
            className="flex items-center gap-1.5 text-[14px] text-[#4A5565]"
          >
            <ChevronLeft size={20} />
            Back
          </button>
          <div className="flex flex-col items-end">
            <span className="text-[20px] font-bold leading-7 text-[#1E2939]">
              Table {table.number}
            </span>
            <span className="text-[12px] text-[#4A5565]">{table.seats} seats</span>
          </div>
        </div>

        {/* Orders section */}
        {orders.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-[rgba(0,0,0,0.1)] px-4 pt-3 pb-4">
            <h3 className="text-[14px] font-bold text-[#364153]">Orders</h3>
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                allItemsById={allItemsById}
                onCancel={cancelOrder}
                onDeliver={deliverOrder}
              />
            ))}
            <div className="flex items-center justify-between border-t border-[rgba(0,0,0,0.1)] pt-2">
              <span className="text-[14px] font-bold text-[#1E2939]">Table Total:</span>
              <span className="text-[14px] font-bold text-[#1E2939]">${billTotal.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setCloseModalOpen(true)}
              disabled={hasKitchenOrders}
              title={hasKitchenOrders ? 'Finish all kitchen orders before closing' : ''}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#00A63E] text-[14px] font-semibold text-white transition-opacity disabled:opacity-40 active:opacity-80"
            >
              <CreditCard size={16} />
              Close Table &amp; Pay
            </button>
          </div>
        )}
      </div>

      {/* Card 2 — Dynamic view */}
      <div className="rounded-[14px] bg-white shadow-[0px_1px_3px_0px_rgba(0,0,0,0.10),0px_1px_2px_-1px_rgba(0,0,0,0.10)]">
        {view === 'service' && (
          <ServicePanel
            cart={cart}
            hasKitchenOrders={hasKitchenOrders}
            onBrowseMenu={() => setView('menu')}
            onReview={() => setView('review')}
            onQtyChange={changeQty}
            onEdit={(c) => setModalTarget({ item: c.menuItem, initial: { quantity: c.quantity, specialInstructions: c.specialInstructions } })}
            onRemove={removeFromCart}
          />
        )}
        {view === 'menu' && (
          <MenuPanel
            categories={categories}
            items={items}
            isLoadingItems={isLoadingItems}
            activeCategoryId={activeCategoryId}
            setActiveCategoryId={setActiveCategoryId}
            search={search}
            setSearch={setSearch}
            cart={cart}
            onAddItem={(item) => setModalTarget({ item })}
            onQtyChange={changeQty}
            onEdit={(c) => setModalTarget({ item: c.menuItem, initial: { quantity: c.quantity, specialInstructions: c.specialInstructions } })}
            onRemove={removeFromCart}
            onDone={() => setView('service')}
            onReview={() => setView('review')}
          />
        )}
        {view === 'review' && (
          <ReviewPanel
            cart={cart}
            isSending={isSending}
            onQtyChange={changeQty}
            onEdit={(c) => setModalTarget({ item: c.menuItem, initial: { quantity: c.quantity, specialInstructions: c.specialInstructions } })}
            onRemove={removeFromCart}
            onBrowseMenu={() => setView('menu')}
            onSend={sendOrder}
          />
        )}
      </div>

      {/* Add/Edit item modal */}
      {modalTarget && (
        <AddItemModal
          item={modalTarget.item}
          initial={modalTarget.initial}
          onCancel={() => setModalTarget(null)}
          onAdd={(item, qty, instructions) => {
            addOrUpdateCart(item, qty, instructions)
            setModalTarget(null)
          }}
        />
      )}

      {/* Cancel order confirmation dialog */}
      <ConfirmCancelDialog
        open={cancelTargetId !== null}
        onConfirm={confirmCancel}
        onClose={() => setCancelTargetId(null)}
      />

      {/* Close Table & Pay modal */}
      {closeModalOpen && data && (
        <CloseTableModal
          billId={data.billId}
          tableNumber={data.table.number}
          onClose={() => setCloseModalOpen(false)}
          onSuccess={() => navigate('/tables')}
        />
      )}
    </div>
  )
}
