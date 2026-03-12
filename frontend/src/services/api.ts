import axios, { type AxiosRequestConfig } from 'axios'

// In dev, VITE_API_URL is not set — the Vite proxy forwards /api to localhost:5000.
// In production, VITE_API_URL is set to the Render backend URL (e.g. https://orderflow.onrender.com).
const BASE_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token from memory to every request
api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Redirect to login on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      tokenStore.clear()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// sessionStorage token store — survives page refresh, cleared when the tab closes
export const tokenStore = {
  get: () => sessionStorage.getItem('auth_token'),
  set: (t: string) => sessionStorage.setItem('auth_token', t),
  clear: () => sessionStorage.removeItem('auth_token'),
}

export default api

export function buildRequest<T>(config: AxiosRequestConfig): Promise<T> {
  return api.request<T>(config).then((r) => r.data)
}
