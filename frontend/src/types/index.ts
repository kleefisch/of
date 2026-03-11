export type Role = 'waiter' | 'kitchen' | 'manager'

export interface AuthUser {
  id: number
  display_name: string
  role: Role
}

export type TableStatus = 'available' | 'reserved' | 'occupied'

export interface Table {
  id: number
  number: number
  seats: number
  status: TableStatus
  is_active: boolean
  waiter_id: number | null
  service_started_at: string | null
}

export type OrderStatus = 'pending' | 'preparing' | 'done' | 'delivered' | 'cancelled'
export type BillStatus = 'open' | 'closed' | 'cancelled'
export type SplitMethod = 'full' | 'custom_amount' | 'split_equally' | 'by_items'
export type PaymentMethod = 'credit' | 'debit' | 'cash'

export interface MenuCategory {
  id: number
  name: string
  is_active: boolean
}

export interface MenuItem {
  id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
  category_id: number
  is_available: boolean
  is_active: boolean
}

export interface OrderItem {
  id: number
  order_id: number
  menu_item_id: number
  quantity: number
  unit_price: number
  special_instructions: string | null
}

export interface Order {
  id: number
  bill_id: number
  sequence_number: number
  status: OrderStatus
  sent_to_kitchen_at: string
  done_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  cancelled_by: number | null
  items: OrderItem[]
}

export interface Bill {
  id: number
  table_id: number
  waiter_id: number
  status: BillStatus
  split_method: SplitMethod | null
  payment_method: PaymentMethod | null
  tip_percent: number | null
  tip_amount: number | null
  subtotal: number | null
  total: number | null
  opened_at: string
  closed_at: string | null
}

export interface ApiSuccess<T> {
  data: T
  message: string
}

export interface ApiError {
  error: string
  code: string
}
