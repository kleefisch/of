import axios, { type AxiosRequestConfig } from 'axios'

const api = axios.create({
  baseURL: '/api',
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

// In-memory token store — never use localStorage or cookies
export const tokenStore = (() => {
  let _token: string | null = null
  return {
    get: () => _token,
    set: (t: string) => { _token = t },
    clear: () => { _token = null },
  }
})()

export default api

export function buildRequest<T>(config: AxiosRequestConfig): Promise<T> {
  return api.request<T>(config).then((r) => r.data)
}
