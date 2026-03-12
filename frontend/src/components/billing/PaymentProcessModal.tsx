import { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle2, XCircle, Wifi } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import api from '@/services/api'
import type { ApiSuccess } from '@/types'
import type { ConfirmPayload } from './CloseTableModal'

type ModalState = 'loading' | 'waiting' | 'processing' | 'success' | 'failed'

interface Props {
  type: 'qr_code' | 'tap_to_pay'
  amount: number
  billId: number
  payload?: ConfirmPayload
  onConfirm?: () => Promise<void>
  showSuccessToast?: boolean
  onBack: () => void
  onSuccess: () => void
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`
}

const QR_EXPIRY_SECONDS = 30 * 60 // Stripe Checkout sessions last 30 min
const POLL_INTERVAL_MS = 3000

function headerColor(type: Props['type'], state: ModalState) {
  if (state === 'success') return '#16A34A'
  if (state === 'failed') return '#DC2626'
  return type === 'qr_code' ? '#155DFC' : '#F54900'
}

// ── QR Code waiting content ────────────────────────────────────────────────────
function QRWaiting({ checkoutUrl, countdown }: { checkoutUrl: string; countdown: number }) {
  const mins = Math.floor(countdown / 60)
  const secs = String(countdown % 60).padStart(2, '0')
  return (
    <>
      <div className="flex h-52 w-52 items-center justify-center rounded-[14px] border-2 border-[#E5E7EB] bg-white p-3">
        <QRCodeSVG value={checkoutUrl} size={196} />
      </div>

      <div className="w-full rounded-[10px] bg-[#EFF6FF] px-4 py-3">
        <p className="mb-2 text-[13px] font-semibold text-[#1E40AF]">📱 How to pay:</p>
        <div className="flex flex-col gap-1">
          {[
            '1. Open your phone camera or payment app',
            '2. Scan the QR code above',
            '3. Enter your card details on the Stripe page',
            '4. Payment is confirmed automatically',
          ].map((step) => (
            <p key={step} className="text-[13px] text-[#1E40AF]">{step}</p>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-[13px] text-[#4A5565]">
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#4A5565]" />
        <span>Expires in: <span className="font-semibold">{mins}:{secs}</span> · Waiting for payment…</span>
      </div>
    </>
  )
}

// ── Tap to Pay waiting content ──────────────────────────────────────────────────
function TapWaiting() {
  return (
    <>
      <div className="relative flex h-40 w-40 items-center justify-center">
        <div
          className="absolute h-40 w-40 animate-ping rounded-full bg-[#F54900]/10"
          style={{ animationDuration: '2s' }}
        />
        <div
          className="absolute h-30 w-30 animate-ping rounded-full bg-[#F54900]/15"
          style={{ animationDuration: '2s', animationDelay: '0.35s' }}
        />
        <div
          className="absolute h-21 w-21 animate-ping rounded-full bg-[#F54900]/20"
          style={{ animationDuration: '2s', animationDelay: '0.7s' }}
        />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#F54900] shadow-lg shadow-orange-200">
          <Wifi size={28} className="text-white" />
        </div>
      </div>

      <div className="w-full rounded-[10px] bg-[#EFF6FF] px-4 py-3">
        <p className="mb-2 text-[13px] font-semibold text-[#1E40AF]">📱 How to Pay:</p>
        <div className="flex flex-col gap-1">
          {[
            '1. Hold your phone or card near the screen',
            '2. Wait for the vibration feedback',
            '3. Confirm the payment on your device',
          ].map((step) => (
            <p key={step} className="text-[13px] text-[#1E40AF]">
              {step}
            </p>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16A34A]">
          <div className="h-2 w-2 rounded-full bg-[#16A34A]" />
          Ready to accept payment
        </div>
        <p className="text-[13px] text-[#99A1AF]">Waiting for device...</p>
      </div>
    </>
  )
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function PaymentProcessModal({ type, amount, billId, payload, onConfirm, showSuccessToast = true, onBack, onSuccess }: Props) {
  const [state, setState] = useState<ModalState>(type === 'qr_code' ? 'loading' : 'waiting')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(QR_EXPIRY_SECONDS)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const didConfirm = useRef(false)

  // ── QR Code: create Checkout Session on mount ───────────────────────────────
  useEffect(() => {
    if (type !== 'qr_code') return
    const amountCents = Math.round(amount * 100)
    api
      .post<ApiSuccess<{ session_id: string; checkout_url: string }>>(
        `/payments/bill/${billId}/create-checkout-session`,
        { amount_cents: amountCents },
      )
      .then((res) => {
        setCheckoutUrl(res.data.data.checkout_url)
        setSessionId(res.data.data.session_id)
        setState('waiting')
      })
      .catch((err: unknown) => {
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Could not create payment session.'
        setErrorMsg(msg)
        setState('failed')
      })
  }, [type, billId, amount])

  // ── QR Code: countdown timer ────────────────────────────────────────────────
  useEffect(() => {
    if (type !== 'qr_code' || state !== 'waiting') return
    if (countdown <= 0) {
      setState('failed')
      setErrorMsg('QR Code expired. Please generate a new one.')
      return
    }
    const id = setInterval(() => setCountdown((c) => c - 1), 1000)
    return () => clearInterval(id)
  }, [type, state, countdown])

  // ── QR Code: poll session status ────────────────────────────────────────────
  useEffect(() => {
    if (type !== 'qr_code' || state !== 'waiting' || !sessionId) return

    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get<ApiSuccess<{ status: string; payment_intent_id: string | null }>>(
          `/payments/stripe/session-status/${sessionId}`,
        )
        if (res.data.data.status === 'paid' && !didConfirm.current) {
          didConfirm.current = true
          clearInterval(pollRef.current!)
          await runConfirm(res.data.data.payment_intent_id)
        }
      } catch {
        // silently ignore poll errors — will retry on next tick
      }
    }, POLL_INTERVAL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, state, sessionId])

  const runConfirm = useCallback(async (stripePaymentIntentId: string | null) => {
    setState('processing')
    try {
      if (onConfirm) {
        await onConfirm()
      } else if (payload) {
        const enrichedPayload = {
          ...payload,
          payments: payload.payments.map((p) => ({
            ...p,
            stripe_payment_intent_id: stripePaymentIntentId,
          })),
        }
        await api.post(`/payments/bill/${billId}/confirm`, enrichedPayload)
      }
      setState('success')
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Payment failed. Please try again.'
      setErrorMsg(msg)
      setState('failed')
    }
  }, [billId, payload, onConfirm])

  // ── Tap to Pay: manual confirm ──────────────────────────────────────────────
  const confirmPayment = useCallback(async () => {
    await runConfirm(null)
  }, [runConfirm])

  function handleRetry() {
    didConfirm.current = false
    setState(type === 'qr_code' ? 'loading' : 'waiting')
    setCheckoutUrl(null)
    setSessionId(null)
    setCountdown(QR_EXPIRY_SECONDS)
    setErrorMsg(null)
  }

  function handleDone() {
    if (showSuccessToast) {
      toast.success('Payment confirmed! Table is now available.')
    }
    onSuccess()
  }

  const bg = headerColor(type, state)
  const title = type === 'qr_code' ? 'QR Code Payment' : 'Tap to Pay'

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" />

      <div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[16px] bg-white shadow-2xl sm:inset-y-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[16px]"
      >
        {/* Colored header bar */}
        <div
          className="flex shrink-0 items-center gap-2 px-6 py-4 transition-colors duration-500"
          style={{ backgroundColor: bg }}
        >
          <Wifi size={22} className={`text-white ${type === 'qr_code' ? 'hidden' : ''}`} />
          <span className="text-[16px] font-bold text-white">{title}</span>
          {(state === 'waiting' || state === 'loading') && (
            <button onClick={onBack} className="ml-auto text-white/70 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-6">
          {/* Amount */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[13px] text-[#99A1AF]">Amount to pay</span>
            <span className="text-[32px] font-bold text-[#F54900]">{fmt(amount)}</span>
          </div>

          {/* State content */}
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#155DFC]/20 border-t-[#155DFC]" />
              <p className="text-[14px] text-[#4A5565]">Generating QR Code…</p>
            </div>
          )}

          {state === 'waiting' && type === 'qr_code' && checkoutUrl && (
            <QRWaiting checkoutUrl={checkoutUrl} countdown={countdown} />
          )}
          {state === 'waiting' && type === 'tap_to_pay' && <TapWaiting />}

          {state === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#F54900]/20 border-t-[#F54900]" />
              <h3 className="text-[18px] font-bold text-[#1E2939]">Processing Payment</h3>
              <p className="text-center text-[14px] text-[#4A5565]">
                Please wait while we confirm your payment...
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#DCFCE7]">
                <CheckCircle2 size={48} className="text-[#16A34A]" />
              </div>
              <h3 className="text-[20px] font-bold text-[#1E2939]">Payment Successful!</h3>
              <p className="text-[15px] font-semibold text-[#4A5565]">Amount: {fmt(amount)}</p>
              <p className="text-[13px] text-[#99A1AF]">Transaction completed</p>
            </div>
          )}

          {state === 'failed' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FEF2F2]">
                <XCircle size={48} className="text-[#DC2626]" />
              </div>
              <h3 className="text-[20px] font-bold text-[#1E2939]">Payment Failed</h3>
              <p className="text-center text-[13px] text-[#4A5565]">
                {errorMsg ?? 'Please try again or choose another payment method.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex flex-col gap-2 px-6 pb-6">
          {state === 'waiting' && type === 'tap_to_pay' && (
            <>
              <button
                onClick={confirmPayment}
                className="w-full rounded-[10px] bg-[#16A34A] py-3.5 text-[15px] font-bold text-white"
              >
                Confirm Payment Received
              </button>
              <button
                onClick={onBack}
                className="w-full rounded-[10px] border border-[#E5E7EB] py-3.5 text-[15px] font-semibold text-[#4A5565]"
              >
                Cancel
              </button>
            </>
          )}

          {state === 'waiting' && type === 'qr_code' && (
            <button
              onClick={onBack}
              className="w-full rounded-[10px] border border-[#E5E7EB] py-3.5 text-[15px] font-semibold text-[#4A5565]"
            >
              Cancel
            </button>
          )}

          {state === 'success' && (
            <button
              onClick={handleDone}
              className="w-full rounded-[10px] bg-[#16A34A] py-3.5 text-[15px] font-bold text-white"
            >
              Done
            </button>
          )}

          {state === 'failed' && (
            <>
              <button
                onClick={handleRetry}
                className="w-full rounded-[10px] bg-[#F54900] py-3.5 text-[15px] font-bold text-white"
              >
                Try Again
              </button>
              <button
                onClick={onBack}
                className="w-full rounded-[10px] border border-[#E5E7EB] py-3.5 text-[15px] font-semibold text-[#4A5565]"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
