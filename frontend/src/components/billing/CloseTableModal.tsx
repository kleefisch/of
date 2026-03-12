import { useState, useEffect } from 'react'
import { ArrowLeft, X, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { ApiSuccess } from '@/types'
import PaymentProcessModal from './PaymentProcessModal'
import SplitPaymentModal, { type SplitPerson } from './SplitPaymentModal'

interface BillItem {
  order_item_id: number
  name: string
  quantity: number
  unit_price: number
  line_total: number
  special_instructions: string | null
}

interface ServerSplitPerson {
  index: number
  label: string
  amount: number
  tip_amount: number
  status: 'pending' | 'paid'
  payment_id: number | null
}

interface BillSummary {
  bill_id: number
  subtotal: number
  items: BillItem[]
  split_method: string | null
  tip_percent: number | null
  split_plan: ServerSplitPerson[] | null
}

type TipOption = 0 | 10 | 15 | 'custom'
type SplitMode = 'full' | 'split_equally' | 'custom_amount'
type PayMethod = 'cash' | 'qr_code' | 'tap_to_pay' | 'card_reader'

export interface ConfirmPayload {
  split_method: SplitMode
  tip_percent: number
  payments: Array<{
    method: string
    amount: number
    tip_amount: number
    stripe_payment_intent_id: null
  }>
}

interface Props {
  billId: number
  tableNumber: number
  onClose: () => void
  onSuccess: () => void
}

function r2(n: number) {
  return Math.round(n * 100) / 100
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

export default function CloseTableModal({ billId, tableNumber, onClose, onSuccess }: Props) {
  const [summary, setSummary] = useState<BillSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isProcessingCash, setIsProcessingCash] = useState(false)

  const [tipOption, setTipOption] = useState<TipOption>(0)
  const [customTip, setCustomTip] = useState('')

  const [splitMode, setSplitMode] = useState<SplitMode>('full')
  const [equallyCount, setEquallyCount] = useState(2)
  const [customPeople, setCustomPeople] = useState<Array<{ amount: string }>>([{ amount: '' }, { amount: '' }])
  const [splitPersons, setSplitPersons] = useState<SplitPerson[] | null>(null)
  const [isInitialisingSplit, setIsInitialisingSplit] = useState(false)

  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [showSplitModal, setShowSplitModal] = useState(false)

  useEffect(() => {
    api
      .get<ApiSuccess<BillSummary>>(`/payments/bill/${billId}`)
      .then((res) => setSummary(res.data.data))
      .catch((err: unknown) => {
        setLoadError(
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
            'Failed to load bill.',
        )
      })
  }, [billId])

  // Restore split state when summary is loaded and a split_plan exists
  useEffect(() => {
    if (!summary) return
    const plan = summary.split_plan
    if (!plan?.length) return

    if (summary.split_method === 'split_equally' || summary.split_method === 'custom_amount') {
      setSplitMode(summary.split_method as SplitMode)
    }

    const tp = summary.tip_percent ?? 0
    if (tp === 0 || tp === 10 || tp === 15) {
      setTipOption(tp as TipOption)
    } else {
      setTipOption('custom')
      setCustomTip(tp.toString())
    }

    if (summary.split_method === 'split_equally') {
      const unpaidCount = plan.filter((p) => p.status !== 'paid').length
      setEquallyCount(Math.max(1, unpaidCount))
    }

    if (summary.split_method === 'custom_amount') {
      setCustomPeople(
        plan.filter((p) => p.status !== 'paid').map((p) => ({ amount: (p.amount + p.tip_amount).toFixed(2) }))
      )
    }

    setSplitPersons(
      plan.map((p) => ({
        label: p.label,
        amount: p.amount,
        tipAmount: p.tip_amount,
        method: 'cash' as const,
        status: p.status,
      }))
    )
  }, [summary])

  const tipPct = tipOption === 'custom' ? parseFloat(customTip) || 0 : (tipOption as number)
  const subtotal = summary?.subtotal ?? 0
  const tipAmt = r2((subtotal * tipPct) / 100)
  const total = r2(subtotal + tipAmt)
  const tipLocked = (summary?.split_plan ?? []).some((p) => p.status === 'paid')

  const paidPlan = (summary?.split_plan ?? []).filter((p) => p.status === 'paid')
  const paidSubtotal = r2(paidPlan.reduce((s, p) => s + p.amount, 0))
  const paidTip = r2(paidPlan.reduce((s, p) => s + p.tip_amount, 0))
  const totalAlreadyPaid = r2(paidSubtotal + paidTip)
  const remainingSubtotal = r2(subtotal - paidSubtotal)
  const remainingTip = r2(tipAmt - paidTip)
  const remainingTotal = r2(total - totalAlreadyPaid)

  function buildPayload(): ConfirmPayload | null {
    if (!summary) return null
    const method = payMethod === 'card_reader' ? 'cash' : payMethod

    if (splitMode === 'full') {
      return {
        split_method: 'full',
        tip_percent: tipPct,
        payments: [{ method, amount: remainingSubtotal, tip_amount: remainingTip, stripe_payment_intent_id: null }],
      }
    }

    if (splitMode === 'split_equally') {
      const pSub = r2(subtotal / equallyCount)
      const pTip = r2(tipAmt / equallyCount)
      return {
        split_method: 'split_equally',
        tip_percent: tipPct,
        payments: Array.from({ length: equallyCount }, () => ({
          method,
          amount: pSub,
          tip_amount: pTip,
          stripe_payment_intent_id: null,
        })),
      }
    }

    // custom_amount
    if (customPeople.some((p) => !parseFloat(p.amount))) return null
    const pTotal = customPeople.reduce((s, p) => s + parseFloat(p.amount), 0)
    return {
      split_method: 'custom_amount',
      tip_percent: tipPct,
      payments: customPeople.map((p) => {
        const pAmt = parseFloat(p.amount)
        const pTip = pTotal > 0 ? r2((pAmt / pTotal) * tipAmt) : 0
        return { method, amount: r2(pAmt - pTip), tip_amount: pTip, stripe_payment_intent_id: null }
      }),
    }
  }

  function buildSplitPersons(): SplitPerson[] {
    const paidAsPersons: SplitPerson[] = paidPlan.map((p) => ({
      label: p.label,
      amount: p.amount,
      tipAmount: p.tip_amount,
      method: 'cash' as const,
      status: 'paid' as const,
    }))
    const startIdx = paidPlan.length

    if (splitMode === 'split_equally') {
      const pSub = equallyCount > 0 ? r2(remainingSubtotal / equallyCount) : 0
      const pTip = equallyCount > 0 ? r2(remainingTip / equallyCount) : 0
      return [
        ...paidAsPersons,
        ...Array.from({ length: equallyCount }, (_, i) => ({
          label: `Person ${startIdx + i + 1}`,
          amount: pSub,
          tipAmount: pTip,
          method: 'cash' as const,
          status: 'pending' as const,
        })),
      ]
    }
    // custom_amount — user enters total-inclusive per-person amounts (of the remaining total)
    return [
      ...paidAsPersons,
      ...customPeople.map((p, i) => {
        const pTotal = parseFloat(p.amount) || 0
        const pTip = remainingTotal > 0 ? r2((pTotal / remainingTotal) * remainingTip) : 0
        return {
          label: `Person ${startIdx + i + 1}`,
          amount: r2(pTotal - pTip),
          tipAmount: pTip,
          method: 'cash' as const,
          status: 'pending' as const,
        }
      }),
    ]
  }

  async function handleCashPayment() {
    if (!payload) {
      toast.error('Please complete all payment fields.')
      return
    }
    setIsProcessingCash(true)
    try {
      await api.post(`/payments/bill/${billId}/confirm`, payload)
      toast.success('Payment confirmed! Table is now available.')
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Payment failed.'
      toast.error(msg)
    } finally {
      setIsProcessingCash(false)
    }
  }

  function handleProcessPayment() {
    if (payMethod === 'cash') {
      handleCashPayment()
    } else if (payMethod === 'qr_code' || payMethod === 'tap_to_pay') {
      setShowProcessModal(true)
    }
  }

  const canProcess = (() => {
    if (!summary || isProcessingCash) return false
    if (payMethod === 'card_reader') return false
    return true
  })()

  const canStartSplit = (() => {
    if (!summary || isInitialisingSplit) return false
    if (splitMode === 'custom_amount') {
      return customPeople.length >= 1 && customPeople.every((p) => parseFloat(p.amount) > 0)
    }
    return true
  })()

  async function handleStartSplit() {
    if (!summary || !canStartSplit) return
    setIsInitialisingSplit(true)
    try {
      const builtPersons = buildSplitPersons()
      const res = await api.post<ApiSuccess<{ split_plan: ServerSplitPerson[] }>>(
        `/payments/bill/${billId}/init-split`,
        {
          split_method: splitMode,
          tip_percent: tipPct,
          persons: builtPersons.map((p) => ({
            label: p.label,
            amount: p.amount,
            tip_amount: p.tipAmount,
          })),
        }
      )
      const serverPlan = res.data.data.split_plan
      setSplitPersons(
        serverPlan.map((p) => ({
          label: p.label,
          amount: p.amount,
          tipAmount: p.tip_amount,
          method: 'cash' as const,
          status: p.status,
        }))
      )
      setShowSplitModal(true)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Failed to initialise split.'
      toast.error(msg)
    } finally {
      setIsInitialisingSplit(false)
    }
  }

  const payload = buildPayload()

  if (showProcessModal && payload && (payMethod === 'qr_code' || payMethod === 'tap_to_pay')) {
    return (
      <PaymentProcessModal
        type={payMethod}
        amount={remainingTotal}
        billId={billId}
        payload={payload}
        onBack={() => setShowProcessModal(false)}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
      />
    )
  }

  if (showSplitModal && (splitMode === 'split_equally' || splitMode === 'custom_amount')) {
    const persons = splitPersons ?? buildSplitPersons()
    return (
      <SplitPaymentModal
        splitMethod={splitMode}
        persons={persons}
        billId={billId}
        total={remainingTotal}
        onBack={() => setShowSplitModal(false)}
        onSuccess={() => {
          onSuccess()
          onClose()
        }}
      />
    )
  }

  const PAYMENT_METHODS: Array<{ method: PayMethod; label: string }> = [
    { method: 'cash', label: 'Cash' },
    { method: 'tap_to_pay', label: 'Tap to Pay' },
    { method: 'qr_code', label: 'QR Code' },
    { method: 'card_reader', label: 'Card Reader' },
  ]

  const SPLIT_OPTIONS: Array<{ mode: SplitMode; label: string }> = [
    { mode: 'full', label: 'Full Payment' },
    { mode: 'split_equally', label: 'Split Equally' },
    { mode: 'custom_amount', label: 'Custom Amount' },
  ]

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />

      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[14px] bg-white shadow-2xl sm:inset-y-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[14px]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-4 py-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#4A5565]"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="flex flex-col items-center">
            <p className="text-[18px] font-bold text-[#1E2939]">Payment</p>
            <p className="text-[13px] text-[#99A1AF]">Table {tableNumber}</p>
          </div>
          <div className="w-16" />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loadError && (
            <div className="m-4 rounded-[10px] bg-red-50 p-3 text-[13px] text-red-600">{loadError}</div>
          )}

          {!summary && !loadError && (
            <div className="flex h-32 items-center justify-center text-[13px] text-[#99A1AF]">
              Loading bill…
            </div>
          )}

          {summary && (
            <div className="flex flex-col gap-5 px-4 pb-4">
              {/* Order Summary */}
              <section className="rounded-[12px] border border-[#E5E7EB] p-4">
                <h3 className="mb-3 text-[15px] font-semibold text-[#1E2939]">Order Summary</h3>
                <div className="flex flex-col gap-2">
                  {summary.items.map((item) => (
                    <div key={item.order_item_id} className="flex justify-between text-[14px]">
                      <span className="text-[#1E2939]">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="shrink-0 text-[#4A5565]">{fmt(item.line_total)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between border-t border-[#E5E7EB] pt-3 text-[14px] font-semibold text-[#1E2939]">
                  <span>Subtotal:</span>
                  <span>{fmt(subtotal)}</span>
                </div>
              </section>

              {/* Tip */}
              <section>
                <h3 className="mb-3 text-[15px] font-semibold text-[#1E2939]">Tip</h3>
                <div className="flex gap-2">
                  {([0, 10, 15] as const).map((pct) => (
                    <button
                      key={pct}
                      onClick={() => { if (!tipLocked) setTipOption(pct) }}
                      disabled={tipLocked}
                      className={`flex flex-1 flex-col items-center rounded-[10px] border py-2.5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        tipOption === pct
                          ? 'border-[#F54900] bg-[#F54900] text-white'
                          : 'border-[#E5E7EB] bg-white text-[#1E2939]'
                      }`}
                    >
                      {pct}%
                      {pct > 0 && (
                        <span
                          className={`text-[11px] font-normal ${tipOption === pct ? 'text-white/80' : 'text-[#99A1AF]'}`}
                        >
                          {fmt(r2((subtotal * pct) / 100))}
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    onClick={() => { if (!tipLocked) setTipOption('custom') }}
                    disabled={tipLocked}
                    className={`flex flex-1 flex-col items-center rounded-[10px] border py-2.5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      tipOption === 'custom'
                        ? 'border-[#F54900] bg-[#F54900] text-white'
                        : 'border-[#E5E7EB] bg-white text-[#1E2939]'
                    }`}
                  >
                    Custom
                    <span
                      className={`text-[11px] font-normal ${tipOption === 'custom' ? 'text-white/80' : 'text-[#99A1AF]'}`}
                    >
                      $
                    </span>
                  </button>
                </div>

                {tipOption === 'custom' && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                      placeholder="0"
                      className="w-20 rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[14px] outline-none focus:border-[#F54900]"
                    />
                    <span className="text-[14px] text-[#4A5565]">%</span>
                  </div>
                )}

                {tipAmt > 0 && (
                  <div className="mt-2 flex justify-between text-[13px]">
                    <span className="text-[#4A5565]">Tip amount:</span>
                    <span className="font-semibold text-[#F54900]">{fmt(tipAmt)}</span>
                  </div>
                )}
              </section>

              {/* Total */}
              <div className="flex flex-col border-t border-b border-[#E5E7EB] py-4 gap-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[18px] font-bold text-[#1E2939]">Total:</span>
                  <span className="text-[24px] font-bold text-[#F54900]">{fmt(total)}</span>
                </div>
                {totalAlreadyPaid > 0 && (
                  <>
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-[#4A5565]">Already paid:</span>
                      <span className="font-semibold text-[#16A34A]">−{fmt(totalAlreadyPaid)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[14px] font-bold border-t border-[#E5E7EB] pt-1.5">
                      <span className="text-[#1E2939]">Remaining:</span>
                      <span className="text-[#F54900]">{fmt(remainingTotal)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Split Bill */}
              <section>
                <h3 className="mb-3 text-[15px] font-semibold text-[#1E2939]">Split Bill</h3>
                <div className="flex gap-2">
                  {SPLIT_OPTIONS.map(({ mode, label }) => (
                    <button
                      key={mode}
                      onClick={() => { setSplitMode(mode); setSplitPersons(null) }}
                      className={`flex flex-1 items-center justify-center rounded-[10px] border py-2.5 text-[12px] font-semibold transition-colors ${
                        splitMode === mode
                          ? 'border-[#F54900] bg-[#F54900] text-white'
                          : 'border-[#E5E7EB] bg-white text-[#1E2939]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {splitMode === 'split_equally' && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
                      <span className="text-[14px] text-[#4A5565]">Number of people:</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => { setEquallyCount((c) => Math.max(1, c - 1)); setSplitPersons(null) }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#4A5565]"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-6 text-center text-[16px] font-bold text-[#F54900]">
                          {equallyCount}
                        </span>
                        <button
                          onClick={() => { setEquallyCount((c) => c + 1); setSplitPersons(null) }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#4A5565]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-center rounded-[10px] border border-[#F54900] bg-[#FFF4EE] py-2.5">
                      <span className="text-[14px] font-semibold text-[#1E2939]">
                        Per person:{' '}
                        <span className="text-[#F54900]">
                          {fmt(equallyCount > 0 ? r2(remainingTotal / equallyCount) : 0)}
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {splitMode === 'custom_amount' && (() => {
                  const totalAssigned = r2(
                    customPeople.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
                  )
                  const remaining = r2(remainingTotal - totalAssigned)
                  return (
                    <div className="mt-3 flex flex-col gap-3">
                      {customPeople.map((p, i) => (
                        <div key={i} className="rounded-[10px] border border-[#E5E7EB] bg-white p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[14px] font-semibold text-[#1E2939]">
                              Person {i + 1}
                            </span>
                            <span className="text-[15px] font-bold text-[#F54900]">
                              {parseFloat(p.amount) > 0 ? fmt(parseFloat(p.amount)) : '$0.00'}
                            </span>
                          </div>
                          <label className="mb-1 block text-[12px] text-[#4A5565]">
                            Amount to Pay
                          </label>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[14px] text-[#4A5565]">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={p.amount}
                              onChange={(e) =>
                                setCustomPeople((prev) =>
                                  prev.map((cp, idx) =>
                                    idx === i ? { amount: e.target.value } : cp,
                                  ),
                                )
                              }
                              onBlur={() => setSplitPersons(null)}
                              placeholder="0.00"
                              className="flex-1 rounded-[8px] border border-[#E5E7EB] px-3 py-2 text-[14px] text-[#1E2939] outline-none focus:border-[#F54900]"
                            />
                            {customPeople.length > 1 && (
                              <button
                                onClick={() => {
                                  setCustomPeople((prev) => prev.filter((_, idx) => idx !== i))
                                  setSplitPersons(null)
                                }}
                                className="text-[#99A1AF] hover:text-red-500"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => { setCustomPeople((prev) => [...prev, { amount: '' }]); setSplitPersons(null) }}
                        className="flex w-full items-center justify-center rounded-[10px] border border-[#E5E7EB] py-2.5 text-[13px] font-semibold text-[#4A5565] hover:bg-[#F9FAFB]"
                      >
                        + Add Person
                      </button>

                      {/* Assignment summary */}
                      <div className="rounded-[10px] border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                        <div className="flex items-center justify-between text-[13px]">
                          <span className="text-[#4A5565]">Total to assign:</span>
                          <span className="font-semibold text-[#1E2939]">{fmt(remainingTotal)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[13px]">
                          <span className="text-[#4A5565]">Total assigned:</span>
                          <span className="font-semibold text-[#1E2939]">{fmt(totalAssigned)}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between border-t border-[#E5E7EB] pt-1.5 text-[13px]">
                          <span className="text-[#4A5565]">Remaining:</span>
                          <span
                            className={`font-bold ${remaining > 0.009 ? 'text-[#F54900]' : 'text-[#16A34A]'}`}
                          >
                            {fmt(Math.max(0, remaining))}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </section>

              {/* Payment Method — only for Full Payment */}
              {splitMode === 'full' && (
                <section className="rounded-[10px] bg-[#F9FAFB] p-4">
                  <h3 className="mb-3 text-[14px] font-semibold text-[#1E2939]">Payment Method</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(({ method, label }) => (
                      <button
                        key={method}
                        onClick={() => method !== 'card_reader' && setPayMethod(method)}
                        disabled={method === 'card_reader'}
                        className={`flex items-center justify-center rounded-[10px] border py-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          payMethod === method
                            ? 'border-[#F54900] bg-[#F54900] text-white'
                            : 'border-[#E5E7EB] bg-white text-[#1E2939]'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-[10px] bg-[#F54900]/10 px-4 py-3">
                    <span className="text-[13px] font-medium text-[#4A5565]">Total to pay:</span>
                    <span className="text-[18px] font-bold text-[#F54900]">{fmt(remainingTotal)}</span>
                  </div>
                </section>
              )}

              {/* Stripe info for split modes */}
              {splitMode !== 'full' && (
                <div className="rounded-[10px] border border-[#DBEAFE] bg-[#EFF6FF] p-3">
                  <p className="text-[12px] text-[#1E40AF]">
                    💳 Each person will select their own payment method and complete their payment
                    individually.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action button */}
        {summary && (
          <div className="shrink-0 px-4 py-4">
            {splitMode === 'full' ? (
              <button
                onClick={handleProcessPayment}
                disabled={!canProcess}
                className="w-full rounded-[10px] bg-[#16A34A] py-4 text-[16px] font-bold text-white transition-opacity disabled:opacity-40"
              >
                {isProcessingCash ? 'Processing…' : 'Process Payment'}
              </button>
            ) : (
              <button
                onClick={handleStartSplit}
                disabled={!canStartSplit}
                className="w-full rounded-[10px] bg-[#16A34A] py-4 text-[16px] font-bold text-white transition-opacity disabled:opacity-40"
              >
                {isInitialisingSplit ? 'Preparing…' : 'Start Payment Process'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}
