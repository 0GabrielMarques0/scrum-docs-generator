import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FolderOpen, Home, Moon, Sun, LogOut, User, X, AlertTriangle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved ? JSON.parse(saved) : true
  })
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const handleLogout = () => {
    setLoggingOut(true)
    setTimeout(() => {
      logout()
      navigate('/login')
    }, 500)
  }
  
  const navItems = [
    { path: '/', label: 'Início', icon: Home },
    { path: '/projects', label: 'Projetos', icon: FolderOpen },
  ]

  // Modal rendered via portal to ensure proper positioning
  const logoutModal = showLogoutModal ? createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setShowLogoutModal(false)}
      />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-[90%] max-w-sm animate-scale-in border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setShowLogoutModal(false)}
          className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X size={20} />
        </button>
        
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
            <LogOut className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
            Sair do sistema?
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Você será redirecionado para a tela de login.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => setShowLogoutModal(false)}
              className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-2.5 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut size={18} />
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null
  
  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 transition-all duration-500 ${loggingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
      {logoutModal}

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-3">
              <img 
                src="/specai_icon_transparent.svg" 
                alt="SpecAI" 
                className="w-9 h-9" 
              />
              <div>
                <h1 className="text-xl font-bold text-slate-800 dark:text-white">SpecAI</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Figma → Requisitos</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-2">
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive 
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400' 
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* User Menu */}
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 px-2 py-1 text-slate-600 dark:text-slate-300">
                <User size={18} />
                <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
              </div>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Sair"
              >
                <LogOut size={20} />
              </button>
            </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50">
        <div className="flex justify-around py-2">
          {navItems.map(item => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg ${
                  isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-xs">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  )
}
