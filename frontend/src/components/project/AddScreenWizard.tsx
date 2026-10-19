import { useEffect, useRef, useState } from 'react'
import { X, Upload, Sparkles, Loader2, ArrowLeft, MessagesSquare, Wand2 } from 'lucide-react'
import { api, AI_REQUEST_TIMEOUT, getApiErrorMessage } from '../../services/api'
import { useToast } from '../Toast'
import QuestionCard from './QuestionCard'
import { QuestionsResult } from '../../types/project'
import {
  filesToPayload,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_SCREEN,
  SUPPORTED_IMAGE_TYPES,
} from '../../utils/files'

interface AddScreenWizardProps {
  projectId: string
  onClose: () => void
  /** Called with the generated (still unsaved) document */
  onGenerated: (screenName: string, html: string) => void
  /** Questions were created or answered: the parent should reload its list */
  onQuestionsChanged: () => void
}

interface SelectedImage {
  file: File
  preview: string
}

type Busy = 'questions' | 'generate' | null

export default function AddScreenWizard({ projectId, onClose, onGenerated, onQuestionsChanged }: AddScreenWizardProps) {
  const { showWarning, showError } = useToast()
  const [step, setStep] = useState<'upload' | 'questions'>('upload')
  const [screenName, setScreenName] = useState('')
  const [images, setImages] = useState<SelectedImage[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [analysis, setAnalysis] = useState<QuestionsResult | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [maxImages, setMaxImages] = useState(MAX_IMAGES_PER_SCREEN)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // The limit depends on the AI provider configured in the backend
  useEffect(() => {
    api
      .get<{ maxImagesPerScreen: number }>(`/projects/${projectId}/ai/config`)
      .then(({ data }) => setMaxImages(data.maxImagesPerScreen))
      .catch(() => {})
  }, [projectId])

  // Revoke object URLs when the wizard unmounts
  const imagesRef = useRef(images)
  imagesRef.current = images
  useEffect(() => () => imagesRef.current.forEach(img => URL.revokeObjectURL(img.preview)), [])

  // Close on Escape (unless a request is running)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [busy, onClose])

  const addImages = (files: FileList | File[]) => {
    const accepted: SelectedImage[] = []

    for (const file of Array.from(files)) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        showWarning('Formato inválido', `${file.name}: envie PNG, JPG, GIF ou WebP`)
        continue
      }
      if (file.size > MAX_IMAGE_BYTES) {
        showWarning('Imagem muito grande', `${file.name}: o limite é 5 MB por imagem`)
        continue
      }
      accepted.push({ file, preview: URL.createObjectURL(file) })
    }

    const room = Math.max(maxImages - images.length, 0)
    if (accepted.length > room) {
      showWarning('Limite de imagens', `Use no máximo ${maxImages} imagens por tela`)
      accepted.slice(room).forEach(img => URL.revokeObjectURL(img.preview))
    }
    setImages(prev => [...prev, ...accepted.slice(0, room)])
  }

  const removeImage = (index: number) => {
    setImages(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter((file): file is File => !!file)

    if (files.length > 0) {
      e.preventDefault()
      addImages(files)
    }
  }

  const canSubmit = screenName.trim().length > 0 && images.length > 0 && !busy

  const raiseQuestions = async () => {
    if (!canSubmit) return
    setBusy('questions')
    try {
      const { data } = await api.post<QuestionsResult>(
        `/projects/${projectId}/ai/questions/screen`,
        { screenName: screenName.trim(), images: await filesToPayload(images.map(i => i.file)) },
        { timeout: AI_REQUEST_TIMEOUT }
      )
      setAnalysis(data)
      setAnswers({})
      setStep('questions')
      onQuestionsChanged()
    } catch (error) {
      showError('Erro na análise', await getApiErrorMessage(error, 'Não foi possível analisar as imagens'))
    } finally {
      setBusy(null)
    }
  }

  const generate = async () => {
    if (!canSubmit) return
    setBusy('generate')
    try {
      const answerList = Object.entries(answers)
        .filter(([, answer]) => answer.trim())
        .map(([id, answer]) => ({ id, answer }))

      const { data } = await api.post<{ requirements: string }>(
        `/projects/${projectId}/ai/generate`,
        {
          screenName: screenName.trim(),
          images: await filesToPayload(images.map(i => i.file)),
          answers: answerList,
        },
        { timeout: AI_REQUEST_TIMEOUT }
      )
      if (answerList.length > 0) onQuestionsChanged()
      onGenerated(screenName.trim(), data.requirements)
    } catch (error) {
      showError('Erro ao gerar', await getApiErrorMessage(error, 'Não foi possível gerar os requisitos'))
    } finally {
      setBusy(null)
    }
  }

  const answeredCount = Object.values(answers).filter(a => a.trim()).length
  const totalQuestions = analysis?.questions.length ?? 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-screen-title"
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 modal-content max-h-[90vh] flex flex-col relative"
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 id="add-screen-title" className="text-lg font-semibold text-slate-800 dark:text-white">
              {step === 'upload' ? 'Adicionar Tela' : `Dúvidas da IA — ${screenName}`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {step === 'upload'
                ? 'Passo 1 de 2: envie os prints da tela'
                : 'Passo 2 de 2: responda o que souber para gerar requisitos mais precisos'}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={!!busy}
            aria-label="Fechar"
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-50"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {step === 'upload' ? (
            <>
              <div className="mb-4">
                <label htmlFor="screen-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Tela
                </label>
                <input
                  id="screen-name"
                  type="text"
                  value={screenName}
                  onChange={e => setScreenName(e.target.value)}
                  maxLength={255}
                  autoFocus
                  placeholder="Ex: Tela de Login, Dashboard, etc."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div className="mb-4">
                <span className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prints da Tela</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={SUPPORTED_IMAGE_TYPES.join(',')}
                  onChange={e => {
                    if (e.target.files) addImages(e.target.files)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Adicionar imagens: arraste, cole ou clique"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  onPaste={handlePaste}
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={e => { e.preventDefault(); setIsDragOver(false) }}
                  onDrop={e => {
                    e.preventDefault()
                    setIsDragOver(false)
                    if (e.dataTransfer?.files?.length) addImages(e.dataTransfer.files)
                  }}
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    isDragOver
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-slate-300 dark:border-slate-600 hover:border-primary-400 dark:hover:border-primary-500'
                  }`}
                >
                  <Upload className={`mx-auto mb-2 ${isDragOver ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'}`} size={32} />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isDragOver ? 'Solte a imagem aqui' : 'Arraste, cole (Ctrl+V) ou clique'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    PNG, JPG, GIF ou WebP · até 5 MB cada · máx. {maxImages} imagens
                  </p>
                </div>
              </div>

              {images.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {images.length} imagem(ns) selecionada(s)
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {images.map((img, index) => (
                      <div key={img.preview} className="relative group">
                        <img src={img.preview} alt={`Print ${index + 1}`} className="w-full h-20 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          aria-label={`Remover imagem ${index + 1}`}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-3 text-xs text-purple-800 dark:text-purple-200">
                <strong>Recomendado:</strong> "Analisar e levantar dúvidas" — a IA estuda os prints e pergunta o que
                não dá para saber só pela imagem (regras, permissões, erros). As imagens são enviadas apenas para a
                análise e não ficam salvas.
              </div>
            </>
          ) : (
            analysis && (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-3">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">O que a IA entendeu</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{analysis.understanding}</p>
                </div>

                {totalQuestions === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    A IA não tem dúvidas sobre esta tela. Pode gerar os requisitos.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Responda o que souber. Perguntas sem resposta continuam abertas no painel de dúvidas e entram no
                      documento como premissas.
                    </p>
                    {analysis.questions.map((question, index) => (
                      <QuestionCard
                        key={question.id}
                        index={index}
                        question={question}
                        value={answers[question.id] ?? ''}
                        disabled={!!busy}
                        onChange={value => setAnswers(prev => ({ ...prev, [question.id]: value }))}
                      />
                    ))}
                  </>
                )}
              </div>
            )
          )}
        </div>

        <div className="flex flex-wrap gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          {step === 'upload' ? (
            <>
              <button
                onClick={generate}
                disabled={!canSubmit}
                className="flex-1 min-w-[140px] px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'generate' ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                Gerar direto
              </button>
              <button
                onClick={raiseQuestions}
                disabled={!canSubmit}
                className="flex-[2] min-w-[200px] px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'questions' ? <Loader2 size={16} className="animate-spin" /> : <MessagesSquare size={16} />}
                {busy === 'questions' ? 'Analisando...' : 'Analisar e levantar dúvidas'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('upload')}
                disabled={!!busy}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                Voltar
              </button>
              <button
                onClick={generate}
                disabled={!canSubmit}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy === 'generate' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {busy === 'generate'
                  ? 'Gerando requisitos...'
                  : totalQuestions > 0
                    ? `Gerar requisitos (${answeredCount}/${totalQuestions} respondidas)`
                    : 'Gerar requisitos'}
              </button>
            </>
          )}
        </div>

        {busy && (
          <div className="absolute inset-0 rounded-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-[1px] flex items-center justify-center" aria-live="polite">
            <div className="text-center px-6">
              <Loader2 className="mx-auto mb-3 text-purple-500 animate-spin" size={36} />
              <p className="font-semibold text-slate-800 dark:text-white">
                {busy === 'questions' ? 'A IA está analisando os prints...' : 'A IA está escrevendo os requisitos...'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Isso pode levar até alguns minutos.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
