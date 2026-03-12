import { useEffect, useRef } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LayoutGrid, ChefHat, Clock, Sun, Moon, LogOut, BarChart2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { socket } from '@/services/socket'
import type { Role } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: React.ElementType
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  waiter: [
    { to: '/tables', label: 'Tables', icon: LayoutGrid },
    { to: '/kitchen', label: 'Kitchen', icon: ChefHat },
    { to: '/history', label: 'History', icon: Clock },
  ],
  kitchen: [
    { to: '/kitchen', label: 'Kitchen', icon: ChefHat },
  ],
  manager: [
    { to: '/dashboard', label: 'Dashboard', icon: BarChart2 },
    { to: '/tables', label: 'Tables', icon: LayoutGrid },
    { to: '/kitchen', label: 'Kitchen', icon: ChefHat },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/history', label: 'History', icon: Clock },
  ],
}

function getInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  // Audio element — more reliable than AudioContext on mobile browsers
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Preload beep and unlock it on first user gesture
  useEffect(() => {
    const audio = new Audio('/beep.wav')
    audio.preload = 'auto'
    audioRef.current = audio

    function unlockAudio() {
      // Play silent and immediately pause to unlock audio restrictions
      audio.play().then(() => audio.pause()).catch(() => {})
    }
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
  }, [])

  useEffect(() => {
    function handleOrderDone(order: { table_number: number | null; sequence_number: number }) {
      const label = order.table_number ? `Table ${order.table_number}` : 'a table'
      const message = `Order #${order.sequence_number} for ${label} is ready to deliver!`

      // Play beep — reset currentTime so it works if triggered in quick succession
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
      }

      navigator.vibrate?.([150, 80, 150, 80, 300])
      toast.success(message, { duration: 8000 })
    }

    socket.on('order:done', handleOrderDone)
    return () => {
      socket.off('order:done', handleOrderDone)
    }
  }, [])

  if (!user) return null

  const navItems = NAV_ITEMS[user.role]
  const initials = getInitials(user.display_name)

  return (
    <div className="flex h-screen flex-col bg-[#F9FAFB] dark:bg-[#0A0A0A]">
      {/* ── Header ── */}
      <header className="flex h-19.75 shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)] dark:border-gray-700 dark:bg-[#1E2939]">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,rgba(255,105,0,1)_0%,rgba(231,0,11,1)_100%)] shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)]">
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <path d="M12 34L24 10L36 34" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 26H32" stroke="white" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-bold leading-tight tracking-[-0.022em] text-[#1E2939] dark:text-white">OrderFlow</span>
            <span className="text-[12px] font-normal text-[#F54900]">POS System</span>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4A5565] transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            aria-label="Log out"
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4A5565] transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <LogOut size={20} />
          </button>

          {/* User button */}
          <div className="ml-1 flex items-center gap-3 rounded-[10px] border border-[#E5E7EB] px-3 py-1.5 dark:border-gray-600">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(43,127,255,1)_0%,rgba(152,16,250,1)_100%)]">
              <span className="text-[14px] font-bold text-white">{initials}</span>
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-[14px] font-semibold leading-tight text-[#1E2939] dark:text-white">{user.display_name}</span>
              <span className="text-[12px] font-medium capitalize text-[#1447E6] dark:text-blue-400">{user.role}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Scrollable content ── */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <Outlet />
      </main>

      {/* ── Bottom nav ── */}
      <nav className="shrink-0 border-t border-[#E5E7EB] bg-white dark:border-gray-700 dark:bg-[#1E2939]">
        <div className="flex h-15 items-center justify-around">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-1 text-[12px] font-semibold transition-colors ${
                  isActive ? 'text-[#F54900]' : 'text-[#6A7282] dark:text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
