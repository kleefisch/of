/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// Inject Workbox precache manifest (populated at build time by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST)

// Never cache API calls or WebSocket — always go to the network
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly())
registerRoute(({ url }) => url.pathname.startsWith('/socket.io/'), new NetworkOnly())

// Handle Web Push notifications sent by the backend
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string } = {}
  try {
    payload = (event.data?.json() ?? {}) as { title?: string; body?: string; url?: string }
  } catch {
    const text = event.data?.text() ?? ''
    payload = { body: text }
  }

  const title = payload.title ?? 'OrderFlow'
  const body = payload.body ?? 'You have a new update.'
  const url = payload.url ?? '/'

  // Keep options typed as a generic dictionary to support all SW runtimes.
  const notificationOptions: Record<string, unknown> = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-64x64.png',
    vibrate: [150, 80, 150, 80, 300],
    tag: 'orderflow-notification',
    renotify: true,
    requireInteraction: true,
    data: { url },
  }

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions as NotificationOptions)
  )
})

// Tapping the notification opens / focuses the app
self.addEventListener('notificationclick', (event: Event) => {
  const notificationEvent = event as NotificationEvent & ExtendableEvent
  notificationEvent.notification.close()
  const targetUrl = (notificationEvent.notification.data as { url?: string } | undefined)?.url ?? '/'
  notificationEvent.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) {
              void (client as WindowClient).navigate(targetUrl)
            }
            return client.focus()
          }
        }
        return self.clients.openWindow(targetUrl)
      })
  )
})
