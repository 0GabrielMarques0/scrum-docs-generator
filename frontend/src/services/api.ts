import axios, { AxiosError } from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

/** AI requests (vision + long documents) can take a few minutes */
export const AI_REQUEST_TIMEOUT = 6 * 60_000

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only logout on 401 if user was logged in and not on auth endpoints
    if (error.response?.status === 401) {
      const isAuthEndpoint = error.config?.url?.includes('/auth/')
      const hasToken = localStorage.getItem('auth_token')

      if (hasToken && !isAuthEndpoint) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        // Use replace to prevent back button issues
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  }
)

/**
 * Extracts the API error message. Handles `responseType: 'blob'` requests,
 * where the JSON error body arrives as a Blob.
 */
export async function getApiErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (!axios.isAxiosError(error)) return fallback
  const axiosError = error as AxiosError<any>

  if (axiosError.code === 'ECONNABORTED') {
    return 'A requisição demorou demais. Tente novamente.'
  }
  if (!axiosError.response) {
    return 'Não foi possível conectar ao servidor. Verifique sua conexão.'
  }

  const data = axiosError.response.data
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).error || fallback
    } catch {
      return fallback
    }
  }
  return data?.error || fallback
}
