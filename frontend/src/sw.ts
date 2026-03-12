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
  const data = event.data?.json() as { title: string; body: string } | undefined
  if (!data) return

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      vibrate: [150, 80, 150, 80, 300],
      data: { url: '/' },
    })
  )
})

// Tapping the notification opens / focuses the app
self.addEventListener('notificationclick', (event: NotificationClickEvent) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        return self.clients.openWindow('/')
      })
  )
})
