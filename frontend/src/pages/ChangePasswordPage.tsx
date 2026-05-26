import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, Loader2, AlertCircle, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react'
import { api } from '../services/api'
import { useToast } from '../components/Toast'

export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { showSuccess, showError } = useToast()
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Password validation rules
  const passwordRules = {
    minLength: newPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(newPassword),
    hasLowercase: /[a-z]/.test(newPassword),
    hasNumber: /[0-9]/.test(newPassword),
  }
  
  const isPasswordValid = Object.values(passwordRules).every(Boolean)
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isPasswordValid) {
      setError('A nova senha não atende aos requisitos mínimos')
      return
    }

    if (!passwordsMatch) {
      setError('As senhas não coincidem')
      return
    }

    setLoading(true)

    try {
      await api.post('/auth/change-password', { 
        currentPassword, 
        newPassword 
      })
      showSuccess('Senha alterada!', 'Sua senha foi alterada com sucesso')
      navigate('/app')
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Erro ao alterar senha'
      setError(errorMessage)
      showError('Erro', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary-500 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key size={28} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Alterar Senha</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
              Digite sua senha atual e a nova senha
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 text-red-400">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Senha Atual
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  id="currentPassword"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                  tabIndex={-1}
                >
                  {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nova Senha
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                placeholder="••••••••"
                required
                disabled={loading}
              />
              
              {/* Password Requirements */}
              {newPassword.length > 0 && (
                <div className="mt-2 space-y-1">
                  <PasswordRule valid={passwordRules.minLength} text="Mínimo 8 caracteres" />
                  <PasswordRule valid={passwordRules.hasUppercase} text="Uma letra maiúscula" />
                  <PasswordRule valid={passwordRules.hasLowercase} text="Uma letra minúscula" />
                  <PasswordRule valid={passwordRules.hasNumber} text="Um número" />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Confirmar Nova Senha
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-slate-700/50 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all ${
                  confirmPassword.length > 0 
                    ? passwordsMatch 
                      ? 'border-green-500' 
                      : 'border-red-500' 
                    : 'border-slate-300 dark:border-slate-600'
                }`}
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || !passwordsMatch || !currentPassword}
              className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-500 disabled:bg-primary-600/50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-600/25 hover:shadow-primary-500/40 disabled:shadow-none disabled:cursor-not-allowed mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Alterando...
                </>
              ) : (
                <>
                  <Key size={20} />
                  Alterar Senha
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function PasswordRule({ valid, text }: { valid: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${valid ? 'text-green-500' : 'text-slate-400'}`}>
      {valid ? <Check size={14} /> : <X size={14} />}
      <span>{text}</span>
    </div>
  )
}
