import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { Role } from '@/types'

const ROLE_DEFAULT: Record<Role, string> = {
  waiter: '/tables',
  kitchen: '/kitchen',
  manager: '/tables',
}

interface Props {
  allowedRoles: Role[]
}

export default function ProtectedRoute({ allowedRoles }: Props) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_DEFAULT[user.role]} replace />
  }

  return <Outlet />
}
