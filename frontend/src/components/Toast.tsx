import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  title: string
  message?: string
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string) => void
  showError: (title: string, message?: string) => void
  showSuccess: (title: string, message?: string) => void
  showWarning: (title: string, message?: string) => void
  showInfo: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const toastStyles = {
  success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
  error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
  warning: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
}

const iconStyles = {
  success: 'text-green-500 dark:text-green-400',
  error: 'text-red-500 dark:text-red-400',
  warning: 'text-amber-500 dark:text-amber-400',
  info: 'text-blue-500 dark:text-blue-400',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  let toastId = 0

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, type, title, message }])
    
    // Auto remove after 5 seconds
    setTimeout(() => removeToast(id), 5000)
  }, [removeToast])

  const showError = useCallback((title: string, message?: string) => {
    showToast('error', title, message)
  }, [showToast])

  const showSuccess = useCallback((title: string, message?: string) => {
    showToast('success', title, message)
  }, [showToast])

  const showWarning = useCallback((title: string, message?: string) => {
    showToast('warning', title, message)
  }, [showToast])

  const showInfo = useCallback((title: string, message?: string) => {
    showToast('info', title, message)
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess, showWarning, showInfo }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md">
        {toasts.map(toast => {
          const Icon = icons[toast.type]
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${toastStyles[toast.type]} animate-slide-in-right`}
            >
              <Icon size={20} className={`flex-shrink-0 mt-0.5 ${iconStyles[toast.type]}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{toast.title}</p>
                {toast.message && (
                  <p className="text-sm opacity-80 mt-1">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded-lg text-current opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
