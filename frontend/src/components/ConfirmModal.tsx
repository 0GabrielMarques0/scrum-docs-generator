import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextType | null>(null)

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolveRef, setResolveRef] = useState<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts)
    setIsOpen(true)
    
    return new Promise((resolve) => {
      setResolveRef(() => resolve)
    })
  }, [])

  const handleConfirm = () => {
    setIsOpen(false)
    resolveRef?.(true)
  }

  const handleCancel = () => {
    setIsOpen(false)
    resolveRef?.(false)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      
      {/* Confirm Modal */}
      {isOpen && options && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 modal-content">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-full ${options.danger 
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              }`}>
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                  {options.title}
                </h3>
                <p className="mt-2 text-slate-600 dark:text-slate-400">
                  {options.message}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end mt-6">
              <button 
                onClick={handleCancel} 
                className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
              >
                {options.cancelText || 'Cancelar'}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg font-medium text-white ${
                  options.danger 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {options.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}
