import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, Loader2, AlertCircle, Eye, EyeOff, Moon, Sun } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      setSuccess(true)
      // Wait for welcome animation then start exit
      setTimeout(() => {
        setExiting(true)
        // Wait for exit animation then navigate
        setTimeout(() => {
          navigate('/app')
        }, 500)
      }, 1500)
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao fazer login'
      setError(errorMessage)
      setLoading(false)
    }
  }

  // Success screen with animation
  if (success) {
    return (
      <div className={`min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center px-4 transition-all duration-500 ${exiting ? 'opacity-0 scale-110' : 'opacity-100 scale-100'}`}>
        <div className="text-center">
          <div className="mb-6 animate-scale-in">
            <img 
              src="/specai_icon_transparent.svg" 
              alt="SpecAI" 
              className="w-32 h-32 mx-auto drop-shadow-2xl"
            />
          </div>
          <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Bem-vindo!</h1>
            <p className="text-slate-500 dark:text-slate-400">
              Entrando no sistema...
            </p>
          </div>
          <div className="mt-8 flex justify-center gap-1.5 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
            <div className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center px-4 relative">
      {/* Dark Mode Toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-4 right-4 p-3 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-lg"
        title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="max-w-md w-full animate-fade-in">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <img 
            src="/specai_icon_transparent.svg" 
            alt="SpecAI" 
            className="w-24 h-24 mx-auto mb-4 drop-shadow-xl"
          />
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">SpecAI</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Gerador de Documentos de Requisitos</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700/50">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-6 text-center">
            Entrar na sua conta
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 text-red-400 animate-shake">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-sm">Erro ao entrar</p>
                <p className="text-sm text-red-400/80">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                placeholder="seu@email.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-500 disabled:bg-primary-600/50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-600/25 hover:shadow-primary-500/40 disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Entrando...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Entrar
                </>
              )}
            </button>

            <div className="text-center">
              <Link 
                to="/forgot-password" 
                className="text-sm text-primary-500 hover:text-primary-400 transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Não tem uma conta?{' '}
              <Link to="/register" className="text-primary-500 hover:text-primary-400 font-medium">
                Criar conta
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-slate-500">
          © 2026 SpecAI - Scrum Docs Generator
        </p>
      </div>
    </div>
  )
}
