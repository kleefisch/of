import { useState } from 'react'
import { X, Minus, Plus } from 'lucide-react'
import type { MenuItem } from '@/types'

interface Props {
  item: MenuItem
  initial?: { quantity: number; specialInstructions: string }
  onCancel: () => void
  onAdd: (item: MenuItem, quantity: number, specialInstructions: string) => void
}

export default function AddItemModal({ item, initial, onCancel, onAdd }: Props) {
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1)
  const [instructions, setInstructions] = useState(initial?.specialInstructions ?? '')

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onCancel} />

      <div className="fixed inset-x-0 top-1/2 z-50 mx-auto w-full max-w-md -translate-y-1/2 px-4 sm:px-0">
        <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]">

          {/* Header */}
          <div className="flex items-start justify-between p-4">
            <div className="flex flex-col gap-0.5 pr-3">
              <h2 className="text-[18px] font-bold leading-7 tracking-tight text-[#1E2939]">
                {item.name}
              </h2>
              {item.description && (
                <p className="text-[14px] text-[#4A5565]">{item.description}</p>
              )}
              <p className="mt-1 text-[20px] font-bold text-[#F54900]">
                ${item.price.toFixed(2)}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="flex h-9 w-9 shrink-0 items-center justify-center pt-2 text-[#4A5565]"
            >
              <X size={20} />
            </button>
          </div>

          {/* Image */}
          {item.image_url && (
            <div className="mx-4">
              <img
                src={item.image_url}
                alt={item.name}
                className="h-48 w-full rounded-[10px] object-cover"
              />
            </div>
          )}

          <div className="flex flex-col gap-4 p-4">
            {/* Quantity */}
            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold text-[#364153]">Quantity</span>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#D1D5DC] bg-[#F3F4F6] text-[#4A5565] disabled:opacity-50"
                >
                  <Minus size={16} />
                </button>
                <span className="w-16 text-center text-[24px] font-bold text-[#1E2939]">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#D1D5DC] bg-[#F3F4F6] text-[#4A5565]"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Special Instructions */}
            <div className="flex flex-col gap-2">
              <span className="text-[14px] font-semibold text-[#364153]">
                Special Instructions (Optional)
              </span>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="e.g. no onions, well done..."
                className="w-full resize-none rounded-[10px] border border-[#D1D5DC] px-3 py-2 text-[14px] text-[#1E2939] outline-none placeholder:text-black/50 focus:border-[#F54900]"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex h-12 flex-1 items-center justify-center rounded-[10px] bg-[#E5E7EB] text-[16px] font-semibold text-[#364153]"
              >
                Cancel
              </button>
              <button
                onClick={() => onAdd(item, quantity, instructions)}
                className="flex h-12 flex-1 items-center justify-center rounded-[10px] bg-[#F54900] text-[16px] font-semibold text-white"
              >
                Add to Order
              </button>
            </div>

            {/* Total bar */}
            <div className="flex h-[52px] items-center justify-between rounded-[10px] bg-[#FFF7ED] px-3">
              <span className="text-[14px] text-[#364153]">Total:</span>
              <span className="text-[18px] font-bold text-[#F54900]">
                ${(item.price * quantity).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
