import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, LogIn, Sun, Moon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

type LoginFormData = z.infer<typeof loginSchema>

const ROLE_REDIRECT: Record<string, string> = {
  waiter: '/tables',
  kitchen: '/kitchen',
  manager: '/tables',
}

export default function LoginPage() {
  const { login, user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true)
    try {
      await login(data.username, data.password)
      // After login, user state updates — navigate by role
      // We read directly from the response since state may not have updated yet
      // So we trigger navigate via the effect-like pattern: re-read after login
    } catch {
      toast.error('Invalid username or password')
    } finally {
      setIsLoading(false)
    }
  }

  if (user) {
    return <Navigate to={ROLE_REDIRECT[user.role] ?? '/tables'} replace />
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center px-4 sm:px-0 bg-[linear-gradient(135deg,rgba(255,137,4,1)_0%,rgba(245,73,0,1)_100%)] dark:bg-[linear-gradient(135deg,rgba(30,41,57,1)_0%,rgba(16,24,40,1)_100%)]">
      {/* Dark mode toggle */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute top-4 right-4 flex h-12 w-12 cursor-pointer items-center justify-center rounded-[10px] bg-white/10 text-white transition-colors hover:bg-white/20 dark:bg-[rgba(30,41,57,0.5)] dark:hover:bg-[rgba(30,41,57,0.8)]"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Card */}
      <div className="flex w-full sm:w-md flex-col gap-8 rounded-3xl bg-white px-8 pt-8 shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] dark:bg-[#1E2939]">
        {/* Header */}
        <div className="flex flex-col gap-4">
          {/* Logo row */}
          <div className="flex justify-center">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="flex h-20 w-20 items-center justify-center rounded-[14px] bg-[linear-gradient(135deg,rgba(255,105,0,1)_0%,rgba(231,0,11,1)_100%)] shadow-lg">
                <svg width="42" height="42" viewBox="0 0 48 48" fill="none">
                  <path
                    d="M12 34L24 10L36 34"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M16 26H32"
                    stroke="white"
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              {/* Text */}
              <div className="flex flex-col items-center">
                <span className="text-[30px] font-bold tracking-[0.013em] text-[#1E2939] dark:text-white">
                  OrderFlow
                </span>
                <span className="text-[12px] font-normal text-[#F54900] dark:text-[#FF8904]">
                  POS System
                </span>
              </div>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-center text-[14px] text-[#4A5565] dark:text-[#99A1AF]">
            Log in to continue
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-5 pb-8"
          noValidate
        >
          {/* Username */}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-semibold text-[#364153] dark:text-[#D1D5DC]">
              Username
            </label>
            <input
              {...register('username')}
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              className="w-full rounded-[10px] border border-[#D1D5DC] bg-white px-4 py-3 text-[16px] text-gray-900 placeholder:text-black/50 outline-none transition-colors focus:border-[#F54900] focus:ring-2 focus:ring-[#F54900]/20 dark:border-[#4A5565] dark:bg-[#364153] dark:text-gray-100 dark:placeholder:text-gray-100/50 dark:focus:border-[#FF6900] dark:focus:ring-[#FF6900]/20"
            />
            {errors.username && (
              <span className="text-[12px] text-red-500">
                {errors.username.message}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="text-[14px] font-semibold text-[#364153] dark:text-[#D1D5DC]">
              Password
            </label>
            <div className="relative">
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                className="w-full rounded-[10px] border border-[#D1D5DC] bg-white py-3 pr-12 pl-4 text-[16px] text-gray-900 placeholder:text-black/50 outline-none transition-colors focus:border-[#F54900] focus:ring-2 focus:ring-[#F54900]/20 dark:border-[#4A5565] dark:bg-[#364153] dark:text-gray-100 dark:placeholder:text-gray-100/50 dark:focus:border-[#FF6900] dark:focus:ring-[#FF6900]/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute top-1/2 right-4 -translate-y-1/2 text-[#6A7282] transition-colors hover:text-[#364153] dark:text-[#99A1AF] dark:hover:text-[#D1D5DC]"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <span className="text-[12px] text-red-500">
                {errors.password.message}
              </span>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#F54900] py-3 text-[16px] font-semibold text-white transition-colors hover:bg-[#d94000] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#FF6900] dark:hover:bg-[#e55f00]"
          >
            <LogIn size={20} />
            <span>{isLoading ? 'Logging in…' : 'Login'}</span>
          </button>
        </form>
      </div>
    </div>
  )
}
