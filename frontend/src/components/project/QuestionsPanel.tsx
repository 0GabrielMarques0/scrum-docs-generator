import { useState } from 'react'
import { Loader2, ScanSearch, Check, Ban, RotateCcw, MessagesSquare } from 'lucide-react'
import { api, AI_REQUEST_TIMEOUT, getApiErrorMessage } from '../../services/api'
import { useToast } from '../Toast'
import QuestionCard from './QuestionCard'
import { Question, QuestionsResult, QuestionStatus } from '../../types/project'

interface QuestionsPanelProps {
  projectId: string
  questions: Question[]
  hasDocuments: boolean
  onReload: () => Promise<void>
}

const FILTERS: { status: QuestionStatus; label: string }[] = [
  { status: 'open', label: 'Abertas' },
  { status: 'answered', label: 'Respondidas' },
  { status: 'dismissed', label: 'Descartadas' },
]

export default function QuestionsPanel({ projectId, questions, hasDocuments, onReload }: QuestionsPanelProps) {
  const { showError, showSuccess } = useToast()
  const [filter, setFilter] = useState<QuestionStatus>('open')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState(false)
  const [reviewSummary, setReviewSummary] = useState<string | null>(null)

  const visible = questions.filter(q => q.status === filter)
  const countOf = (status: QuestionStatus) => questions.filter(q => q.status === status).length

  const draftOf = (q: Question) => drafts[q.id] ?? q.answer ?? ''

  const update = async (question: Question, body: { answer?: string; status?: QuestionStatus }, success: string) => {
    setSavingId(question.id)
    try {
      await api.patch(`/projects/${projectId}/ai/questions/${question.id}`, body)
      await onReload()
      setDrafts(prev => {
        const { [question.id]: _removed, ...rest } = prev
        return rest
      })
      showSuccess(success)
    } catch (error) {
      showError('Erro', await getApiErrorMessage(error, 'Não foi possível atualizar a pergunta'))
    } finally {
      setSavingId(null)
    }
  }

  const reviewProject = async () => {
    setReviewing(true)
    try {
      const { data } = await api.post<QuestionsResult>(
        `/projects/${projectId}/ai/questions/review`,
        {},
        { timeout: AI_REQUEST_TIMEOUT }
      )
      setReviewSummary(data.understanding)
      setFilter('open')
      await onReload()
      showSuccess(
        'Revisão concluída',
        data.questions.length
          ? `${data.questions.length} nova(s) dúvida(s) sobre o projeto`
          : 'A IA não encontrou novas dúvidas'
      )
    } catch (error) {
      showError('Erro na revisão', await getApiErrorMessage(error, 'Não foi possível revisar o projeto'))
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2">
        <button
          onClick={reviewProject}
          disabled={reviewing || !hasDocuments}
          title={hasDocuments ? undefined : 'Salve pelo menos uma tela para revisar o projeto'}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {reviewing ? <Loader2 size={16} className="animate-spin" /> : <ScanSearch size={16} />}
          {reviewing ? 'Revisando o projeto...' : 'Revisar projeto com IA'}
        </button>

        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1" role="tablist" aria-label="Filtrar dúvidas">
          {FILTERS.map(({ status, label }) => (
            <button
              key={status}
              role="tab"
              aria-selected={filter === status}
              onClick={() => setFilter(status)}
              className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                filter === status
                  ? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {label} ({countOf(status)})
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {reviewSummary && filter === 'open' && (
          <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">Visão da IA sobre o projeto</p>
            <p className="text-xs text-slate-700 dark:text-slate-200">{reviewSummary}</p>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="text-center py-8">
            <MessagesSquare className="mx-auto text-slate-400 dark:text-slate-500 mb-2" size={32} />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filter === 'open'
                ? 'Nenhuma dúvida aberta. Adicione uma tela ou peça uma revisão do projeto.'
                : 'Nada por aqui.'}
            </p>
          </div>
        ) : (
          visible.map(question => {
            const saving = savingId === question.id
            const draft = draftOf(question)

            return (
              <QuestionCard
                key={question.id}
                question={question}
                value={draft}
                showScope
                disabled={saving || question.status === 'dismissed'}
                onChange={value => setDrafts(prev => ({ ...prev, [question.id]: value }))}
                actions={
                  question.status === 'dismissed' ? (
                    <button
                      onClick={() => update(question, { status: 'open' }, 'Pergunta reaberta')}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <RotateCcw size={12} /> Reabrir
                    </button>
                  ) : (
                    <>
                      {question.status === 'open' && (
                        <button
                          onClick={() => update(question, { status: 'dismissed' }, 'Pergunta descartada')}
                          disabled={saving}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <Ban size={12} /> Não se aplica
                        </button>
                      )}
                      <button
                        onClick={() => update(question, { answer: draft }, 'Resposta salva')}
                        disabled={saving || !draft.trim() || draft === question.answer}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {question.status === 'answered' ? 'Atualizar' : 'Responder'}
                      </button>
                    </>
                  )
                }
              />
            )
          })
        )}
      </div>

      {countOf('answered') > 0 && (
        <p className="px-3 py-2 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700">
          As respostas valem para as próximas gerações. Para aplicá-las a uma tela já salva, abra a tela e use
          "Refinar com IA".
        </p>
      )}
    </div>
  )
}
