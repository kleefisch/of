import { AlertTriangle, X } from 'lucide-react'

interface Props {
  open: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmCancelDialog({ open, onConfirm, onClose }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-[20px] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF2F2]">
            <AlertTriangle size={28} color="#E7000B" strokeWidth={2} />
          </div>
        </div>

        {/* Text */}
        <h2 className="mb-1 text-center text-[18px] font-bold text-[#1E2939]">
          Cancel Order?
        </h2>
        <p className="mb-6 text-center text-[14px] text-[#4A5565]">
          This action is irreversible. The order will be permanently cancelled and cannot be restored.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#E7000B] font-semibold text-white transition-opacity active:opacity-80"
            style={{ fontSize: 14 }}
          >
            <X size={16} strokeWidth={2.5} />
            Yes, Cancel Order
          </button>
          <button
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-[12px] border border-[#E5E7EB] bg-white font-semibold text-[#4A5565] transition-opacity active:opacity-80"
            style={{ fontSize: 14 }}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}
