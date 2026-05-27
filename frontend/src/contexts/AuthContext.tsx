import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { api } from '../services/api'

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load auth state from localStorage on mount and validate token
  useEffect(() => {
    const validateAndLoadAuth = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY)
      const storedUser = localStorage.getItem(USER_KEY)
      
      if (storedToken && storedUser) {
        // Set token in axios defaults first
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
        
        try {
          // Validate token by calling /auth/me
          const { data } = await api.get('/auth/me')
          setToken(storedToken)
          setUser(data)
          // Update stored user with fresh data
          localStorage.setItem(USER_KEY, JSON.stringify(data))
        } catch (error) {
          // Token is invalid or expired, clear auth
          console.warn('Token validation failed, clearing auth...')
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
          delete api.defaults.headers.common['Authorization']
        }
      }
      
      setIsLoading(false)
    }
    
    validateAndLoadAuth()
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    
    setToken(data.token)
    setUser(data.user)
    
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    
    // Set token in axios defaults
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    
    // Remove token from axios defaults
    delete api.defaults.headers.common['Authorization']
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
