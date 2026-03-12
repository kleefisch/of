import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { AuthUser } from '@/types'
import api, { tokenStore } from '@/services/api'
import { socket } from '@/services/socket'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post<ApiSuccess<LoginResponse>>('/auth/login', {
      username,
      password,
    })
    const { access_token, user: userData } = response.data.data
    tokenStore.set(access_token)
    setUser(userData)

    // Connect WebSocket and join role-appropriate rooms
    socket.connect()
    socket.once('connect', () => {
      if (userData.role === 'kitchen') {
        socket.emit('join', { room: 'kitchen' })
      } else if (userData.role === 'waiter') {
        socket.emit('join', { room: `waiter_${userData.id}` })
      } else if (userData.role === 'manager') {
        socket.emit('join', { room: 'kitchen' })
        socket.emit('join', { room: `waiter_${userData.id}` })
        socket.emit('join', { room: 'admin' })
      }
    })
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
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
