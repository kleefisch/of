import api from '@/services/api'

async function getVapidPublicKey(): Promise<string> {
  const res = await api.get<{ data: { vapid_public_key: string } }>('/push/vapid-public-key')
  return res.data.data.vapid_public_key
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/**
 * Request notification permission, subscribe the browser to Web Push,
 * and POST the subscription to the backend.
 * Safe to call multiple times — handles existing subscriptions gracefully.
 */
export async function subscribeToPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return

  try {
    const registration = await navigator.serviceWorker.ready
    const vapidKey = await getVapidPublicKey()
    if (!vapidKey) return

    const existingSubscription = await registration.pushManager.getSubscription()
    const subscription = existingSubscription ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })

    const json = subscription.toJSON()
    const keys = json.keys as { p256dh: string; auth: string }
    if (!keys?.p256dh || !keys?.auth) return

    await api.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
  } catch {
    // Push subscription failed silently — notifications will still work in-app
  }
}
