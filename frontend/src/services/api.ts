import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
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
      
      // Only auto-logout if user had a token and it's not an auth request
      if (hasToken && !isAuthEndpoint) {
        console.warn('Session expired, redirecting to login...')
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        // Use replace to prevent back button issues
        window.location.replace('/login')
      }
    }
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)
