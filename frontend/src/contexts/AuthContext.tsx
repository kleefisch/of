import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { AuthUser } from '@/types'
import api, { tokenStore } from '@/services/api'
import { socket } from '@/services/socket'
import { subscribeToPush } from '@/services/pushNotifications'
import type { ApiSuccess } from '@/types'

interface LoginResponse {
  access_token: string
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function joinRooms(userData: AuthUser) {
  if (userData.role === 'kitchen') {
    socket.emit('join', { room: 'kitchen' })
  } else if (userData.role === 'waiter') {
    socket.emit('join', { room: `waiter_${userData.id}` })
  } else if (userData.role === 'manager') {
    socket.emit('join', { room: 'kitchen' })
    socket.emit('join', { room: `waiter_${userData.id}` })
    socket.emit('join', { room: 'admin' })
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    // Restore session from sessionStorage on page refresh
    try {
      const token = sessionStorage.getItem('auth_token')
      const stored = sessionStorage.getItem('auth_user')
      if (token && stored) return JSON.parse(stored) as AuthUser
    } catch {
      // ignore parse errors
    }
    return null
  })

  // Reconnect WebSocket and subscribe to push when session is restored after a page refresh
  useEffect(() => {
    if (!user) return
    if (!socket.connected) {
      socket.connect()
      socket.once('connect', () => joinRooms(user))
    }
    // Re-subscribe to push (no-op if already subscribed)
    subscribeToPush()
  }, [user])

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post<ApiSuccess<LoginResponse>>('/auth/login', {
      username,
      password,
    })
    const { access_token, user: userData } = response.data.data
    tokenStore.set(access_token)
    sessionStorage.setItem('auth_user', JSON.stringify(userData))
    setUser(userData)

    // Connect WebSocket and join role-appropriate rooms
    socket.connect()
    socket.once('connect', () => joinRooms(userData))
    // Subscribe to Web Push (works for waiter, kitchen, and manager)
    subscribeToPush()
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    sessionStorage.removeItem('auth_user')
    setUser(null)
    socket.disconnect()
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
