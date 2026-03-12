import { XCircle } from 'lucide-react'

export default function PaymentCancelledPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F9FAFB] px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
        <XCircle size={52} className="text-red-500" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold text-[#1E2939]">Payment Cancelled</h1>
        <p className="text-[16px] text-[#4A5565]">
          Your payment was not completed.
        </p>
        <p className="mt-1 text-[14px] text-[#6A7282]">
          Please ask the waiter to generate a new QR code if you wish to pay again.
        </p>
      </div>

      <div className="mt-2 rounded-[14px] border border-red-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-[14px] font-medium text-red-600">
          No charges were made to your account.
        </p>
      </div>
    </div>
  )
}
