import { CheckCircle } from 'lucide-react'

export default function PaymentSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#F9FAFB] px-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
        <CheckCircle size={52} className="text-green-600" />
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-bold text-[#1E2939]">Payment Successful!</h1>
        <p className="text-[16px] text-[#4A5565]">
          Your payment has been processed. Thank you!
        </p>
        <p className="mt-1 text-[14px] text-[#6A7282]">
          You can close this page now.
        </p>
      </div>

      <div className="mt-2 rounded-[14px] border border-green-200 bg-white px-6 py-4 shadow-sm">
        <p className="text-[14px] font-medium text-green-700">
          The waiter has been notified of your payment.
        </p>
      </div>
    </div>
  )
}
