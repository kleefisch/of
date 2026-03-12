import { useState, useRef } from 'react'
import { X, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { ApiSuccess } from '@/types'
import PaymentProcessModal from './PaymentProcessModal'

type PayMethod = 'cash' | 'qr_code' | 'tap_to_pay' | 'card_reader'

export interface SplitPerson {
  label: string
  amount: number
  tipAmount: number
  method: PayMethod
  status: 'pending' | 'paid'
}

interface Props {
  splitMethod: 'split_equally' | 'custom_amount'
  persons: SplitPerson[]
  billId: number
  total: number
  onBack: () => void
  onSuccess: () => void
}

const PAYMENT_METHODS: Array<{ method: PayMethod; label: string }> = [
  { method: 'cash', label: 'Cash' },
  { method: 'tap_to_pay', label: 'Tap to Pay' },
  { method: 'qr_code', label: 'QR Code' },
  { method: 'card_reader', label: 'Card Reader' },
]

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

export default function SplitPaymentModal({
  splitMethod: _splitMethod,
  persons: initialPersons,
  billId,
  total,
  onBack,
  onSuccess,
}: Props) {
  const [persons, setPersons] = useState<SplitPerson[]>(initialPersons)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const autoClosedRef = useRef(false)

  function setMethod(idx: number, method: PayMethod) {
    if (method === 'card_reader') return
    setPersons((prev) => prev.map((p, i) => (i === idx ? { ...p, method } : p)))
  }

  async function handlePayPerson(idx: number, method: PayMethod): Promise<boolean> {
    try {
      const res = await api.post<
        ApiSuccess<{
          auto_closed: boolean
          split_plan: Array<{
            label: string
            amount: number
            tip_amount: number
            status: 'pending' | 'paid'
            payment_id: number | null
          }>
        }>
      >(`/payments/bill/${billId}/pay-person`, { person_index: idx, method })
      const { auto_closed, split_plan } = res.data.data
      setPersons((prev) =>
        split_plan.map((sp, i) => ({
          label: sp.label,
          amount: sp.amount,
          tipAmount: sp.tip_amount,
          method: prev[i]?.method ?? 'cash',
          status: sp.status,
        }))
      )
      return auto_closed
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Payment failed. Please try again.'
      toast.error(msg)
      return false
    }
  }

  async function handleProcess(idx: number) {
    const person = persons[idx]
    if (person.method === 'cash') {
      const autoClosed = await handlePayPerson(idx, 'cash')
      if (autoClosed) {
        toast.success('All payments confirmed! Table is now available.')
        onSuccess()
      }
    } else {
      autoClosedRef.current = false
      setActiveIdx(idx)
    }
  }

  // If a person is currently in QR/Tap flow, show PaymentProcessModal
  if (activeIdx !== null) {
    const activePerson = persons[activeIdx]
    const capturedIdx = activeIdx
    return (
      <PaymentProcessModal
        type={activePerson.method as 'qr_code' | 'tap_to_pay'}
        amount={activePerson.amount + activePerson.tipAmount}
        billId={billId}
        onConfirm={async () => {
          autoClosedRef.current = await handlePayPerson(capturedIdx, activePerson.method)
        }}
        showSuccessToast={false}
        onBack={() => setActiveIdx(null)}
        onSuccess={() => {
          setActiveIdx(null)
          if (autoClosedRef.current) {
            toast.success('All payments confirmed! Table is now available.')
            onSuccess()
          }
        }}
      />
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onBack} />

      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:inset-y-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[16px]">
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-6 py-4"
          style={{ background: 'linear-gradient(90deg, #F54900 0%, #FF6900 100%)' }}
        >
          <h2 className="text-[18px] font-bold text-white">Select Payment Methods</h2>
          <button onClick={onBack} className="text-white/70 hover:text-white">
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-[13px] text-[#4A5565]">Choose how each person will pay:</p>

          <div className="flex flex-col gap-3">
            {persons.map((person, idx) => (
              <div key={idx} className="rounded-[10px] border border-[#E5E7EB] bg-white p-4">
                {person.status === 'paid' ? (
                  // Paid state
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#DCFCE7]">
                        <CheckCircle2 size={18} className="text-[#16A34A]" />
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold text-[#1E2939]">{person.label}</p>
                        <p className="text-[13px] text-[#4A5565]">
                          {fmt(person.amount + person.tipAmount)}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-[4px] bg-[#DCFCE7] px-2.5 py-1 text-[12px] font-semibold text-[#16A34A]">
                      Paid
                    </span>
                  </div>
                ) : (
                  // Pending state
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-[14px] font-semibold text-[#1E2939]">{person.label}</p>
                      <p className="text-[16px] font-bold text-[#F54900]">
                        {fmt(person.amount + person.tipAmount)}
                      </p>
                    </div>

                    {/* Payment method 2×2 grid */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map(({ method, label }) => (
                        <button
                          key={method}
                          onClick={() => setMethod(idx, method)}
                          disabled={method === 'card_reader'}
                          className={`flex items-center justify-center rounded-[10px] border py-2.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            person.method === method
                              ? 'border-[#F54900] bg-[#F54900] text-white'
                              : 'border-[#E5E7EB] bg-white text-[#1E2939]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* Process Payment button */}
                    <button
                      onClick={() => handleProcess(idx)}
                      className="w-full rounded-[10px] bg-[#16A34A] py-3 text-[14px] font-bold text-white"
                    >
                      Process Payment
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Total bar */}
        <div className="shrink-0 border-t border-[#E5E7EB] px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#1E2939]">Total:</span>
            <span className="text-[18px] font-bold text-[#F54900]">{fmt(total)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 px-5 pb-5">
          <button
            onClick={onBack}
            className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] py-3.5 text-[15px] font-semibold text-[#4A5565]"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
