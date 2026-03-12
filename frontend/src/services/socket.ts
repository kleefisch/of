import { io, type Socket } from 'socket.io-client'

// Empty string = same origin. In production set VITE_SOCKET_URL to the Render backend URL.
const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? ''

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  path: '/socket.io',
})
