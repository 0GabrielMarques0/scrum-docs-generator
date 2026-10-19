import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Key, Loader2, AlertCircle, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react'
import { api, getApiErrorMessage } from '../services/api'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

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
    if (!isPasswordValid || !passwordsMatch) return
    setError('')
    setLoading(true)

    try {
      await api.post('/auth/reset-password', { token, newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      setError(await getApiErrorMessage(err, 'Não foi possível redefinir a senha'))
      setLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700/50 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <img src="/specai_icon_transparent.svg" alt="SpecAI" className="w-20 h-20 mx-auto mb-4 drop-shadow-xl" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Redefinir senha</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Escolha uma nova senha para sua conta</p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700/50">
          {success ? (
            <div className="text-center" role="status">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                <Check size={32} className="text-white" />
              </div>
              <p className="font-semibold text-slate-800 dark:text-white">Senha redefinida!</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Redirecionando para o login...</p>
            </div>
          ) : !token ? (
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-300 mb-4">Link inválido. Solicite uma nova redefinição de senha.</p>
              <Link to="/forgot-password" className="text-primary-500 hover:text-primary-400 font-medium">
                Solicitar novo link
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 text-red-500">
                  <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm">{error}</p>
                    <Link to="/forgot-password" className="text-sm underline">Solicitar novo link</Link>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      id="newPassword"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className={`${inputClass} pr-12`}
                      autoComplete="new-password"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      aria-label={showPasswords ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
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
                    onChange={e => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    autoComplete="new-password"
                    required
                    disabled={loading}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isPasswordValid || !passwordsMatch}
                  className="w-full py-3.5 px-4 bg-primary-600 hover:bg-primary-500 disabled:bg-primary-600/50 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed mt-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Key size={20} />}
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-500">
              <ArrowLeft size={16} />
              Voltar para o login
            </Link>
          </div>
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
