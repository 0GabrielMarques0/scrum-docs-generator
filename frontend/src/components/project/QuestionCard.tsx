import { HelpCircle } from 'lucide-react'
import { Question, QUESTION_CATEGORY_LABELS } from '../../types/project'

interface QuestionCardProps {
  question: Question
  value: string
  onChange: (value: string) => void
  index?: number
  disabled?: boolean
  /** Extra actions rendered under the answer field (save, dismiss...) */
  actions?: React.ReactNode
  showScope?: boolean
}

export default function QuestionCard({
  question,
  value,
  onChange,
  index,
  disabled,
  actions,
  showScope,
}: QuestionCardProps) {
  const inputId = `answer-${question.id}`

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-3">
      <div className="flex items-start gap-2 mb-2">
        <HelpCircle size={16} className="text-purple-500 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-800 dark:text-slate-100">
            {index !== undefined && <span className="text-slate-400 mr-1">{index + 1}.</span>}
            {question.question}
          </label>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
              {QUESTION_CATEGORY_LABELS[question.category] ?? question.category}
            </span>
            {showScope && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {question.screenName ? `Tela: ${question.screenName}` : 'Projeto'}
              </span>
            )}
          </div>
          {question.reason && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{question.reason}</p>
          )}
        </div>
      </div>

      {question.options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2" role="group" aria-label="Respostas sugeridas">
          {question.options.map(option => {
            const selected = value === option
            return (
              <button
                key={option}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onChange(selected ? '' : option)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 ${
                  selected
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-400'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      <textarea
        id={inputId}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        rows={2}
        maxLength={4000}
        placeholder={question.options.length ? 'Escolha uma opção acima ou escreva sua resposta' : 'Sua resposta'}
        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y disabled:opacity-60"
      />

      {actions && <div className="flex items-center justify-end gap-2 mt-2">{actions}</div>}
    </div>
  )
}
