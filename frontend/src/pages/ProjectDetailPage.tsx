import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, FileText, Save, Loader2, Check, Sparkles, Edit3, Trash2, Eye, Download,
  FileType, File, ChevronDown, Code, Image, Plus, MessagesSquare, Wand2, Pencil, X,
} from 'lucide-react'
import { Editor } from '@tinymce/tinymce-react'
import { saveAs } from 'file-saver'
import { api, AI_REQUEST_TIMEOUT, getApiErrorMessage } from '../services/api'
import Loading from '../components/Loading'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import AddScreenWizard from '../components/project/AddScreenWizard'
import QuestionsPanel from '../components/project/QuestionsPanel'
import ExportModal, { ExportFormat } from '../components/project/ExportModal'
import { OpenDocument, Project, Question, SavedRequirement } from '../types/project'
import { toFileName } from '../utils/files'

const DOCUMENT_STYLES = `
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #ffffff; max-width: 900px; margin: 0 auto; padding: 20px; }
  h1 { color: #1e3a5f; font-size: 28px; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
  h2 { color: #1e3a5f; font-size: 22px; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
  h3 { color: #2c5282; font-size: 16px; margin-top: 20px; }
  p { color: #333; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; border: 1px solid #e2e8f0; table-layout: fixed; }
  th { background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f; word-wrap: break-word; }
  td { padding: 10px 12px; border: 1px solid #e2e8f0; color: #333; word-wrap: break-word; overflow-wrap: break-word; vertical-align: top; }
  tr:nth-child(even) { background-color: #f8fafc; }
  ul { margin: 10px 0; padding-left: 25px; }
  li { margin: 5px 0; color: #333; }
`

const getBodyContent = (html: string): string => {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  return bodyMatch ? bodyMatch[1] : html
}

const wrapInHTML = (bodyContent: string): string =>
  `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>${DOCUMENT_STYLES}</style></head><body>${bodyContent}</body></html>`

const newScreenId = () => `screen-${crypto.randomUUID()}`

type SidebarTab = 'screens' | 'questions'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const { confirm } = useConfirm()

  const [project, setProject] = useState<Project | null>(null)
  const [savedRequirements, setSavedRequirements] = useState<SavedRequirement[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('screens')

  const [openDoc, setOpenDoc] = useState<OpenDocument | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview')
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

  const [showWizard, setShowWizard] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showRefine, setShowRefine] = useState(false)
  const [refineInstructions, setRefineInstructions] = useState('')
  const [refining, setRefining] = useState(false)

  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [savingDescription, setSavingDescription] = useState(false)

  const loadRequirements = useCallback(async () => {
    const { data } = await api.get<{ requirements: SavedRequirement[] }>(`/projects/${id}/requirements`)
    setSavedRequirements(data.requirements)
    return data.requirements
  }, [id])

  const loadQuestions = useCallback(async () => {
    try {
      const { data } = await api.get<{ questions: Question[] }>(`/projects/${id}/ai/questions`)
      setQuestions(data.questions)
    } catch (error) {
      console.error('Error loading questions:', error)
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const [projectRes] = await Promise.all([
          api.get<Project>(`/projects/${id}`),
          loadRequirements(),
          loadQuestions(),
        ])
        if (!cancelled) setProject(projectRes.data)
      } catch (error: any) {
        if (cancelled) return
        if (error.response?.status !== 404) {
          setLoadError(await getApiErrorMessage(error, 'Erro ao carregar o projeto'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id, loadRequirements, loadQuestions])

  // Warn before closing the tab with unsaved edits
  useEffect(() => {
    if (!hasChanges) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [hasChanges])

  /** Asks before throwing away unsaved edits. Returns true when it's safe to continue. */
  const confirmDiscard = async () => {
    if (!hasChanges) return true
    return confirm({
      title: 'Descartar alterações?',
      message: 'O documento aberto tem alterações não salvas que serão perdidas.',
      confirmText: 'Descartar',
      cancelText: 'Continuar editando',
      danger: true,
    })
  }

  const openRequirement = async (req: SavedRequirement) => {
    if (openDoc?.requirementId === req.id) return
    if (!(await confirmDiscard())) return
    setOpenDoc({ screenId: req.screen_id, screenName: req.screen_name, requirementId: req.id })
    setEditorContent(req.content)
    setHasChanges(false)
    setViewMode('preview')
  }

  const openWizard = async () => {
    if (!(await confirmDiscard())) return
    setShowWizard(true)
  }

  const handleGenerated = (screenName: string, html: string) => {
    setShowWizard(false)
    setOpenDoc({ screenId: newScreenId(), screenName, requirementId: null })
    setEditorContent(html)
    setHasChanges(true)
    setViewMode('preview')
    setSidebarTab('screens')
    showSuccess('Requisitos gerados', 'Revise o documento e clique em Salvar')
  }

  const saveRequirement = async () => {
    if (!openDoc || !editorContent.trim()) return
    setSaving(true)
    try {
      const { data } = await api.post<{ id: string }>(`/projects/${id}/requirements`, {
        screenId: openDoc.screenId,
        screenName: openDoc.screenName,
        content: editorContent,
      })
      setOpenDoc(doc => (doc ? { ...doc, requirementId: data.id } : doc))
      await loadRequirements()
      setHasChanges(false)
      showSuccess('Salvo!', 'Requisito salvo com sucesso')
    } catch (error) {
      showError('Erro ao salvar', await getApiErrorMessage(error, 'Erro ao salvar requisito'))
    } finally {
      setSaving(false)
    }
  }

  const deleteRequirement = async (req: SavedRequirement) => {
    const confirmed = await confirm({
      title: 'Excluir documento',
      message: `Excluir o documento de "${req.screen_name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      danger: true,
    })
    if (!confirmed) return

    try {
      await api.delete(`/projects/${id}/requirements/${req.id}`)
      setSavedRequirements(prev => prev.filter(r => r.id !== req.id))
      if (openDoc?.requirementId === req.id) {
        setOpenDoc(null)
        setEditorContent('')
        setHasChanges(false)
      }
      showSuccess('Documento excluído')
    } catch (error) {
      showError('Erro ao excluir', await getApiErrorMessage(error, 'Não foi possível excluir o documento'))
    }
  }

  const refineDocument = async () => {
    if (!openDoc?.requirementId) return
    setRefining(true)
    try {
      const { data } = await api.post<{ requirements: string }>(
        `/projects/${id}/ai/refine`,
        { requirementId: openDoc.requirementId, instructions: refineInstructions },
        { timeout: AI_REQUEST_TIMEOUT }
      )
      setEditorContent(data.requirements)
      setHasChanges(true)
      setViewMode('preview')
      setShowRefine(false)
      setRefineInstructions('')
      showSuccess('Documento refinado', 'Revise as mudanças e clique em Salvar')
    } catch (error) {
      showError('Erro ao refinar', await getApiErrorMessage(error, 'Não foi possível refinar o documento'))
    } finally {
      setRefining(false)
    }
  }

  const saveDescription = async () => {
    if (!project) return
    setSavingDescription(true)
    try {
      const { data } = await api.patch<Project>(`/projects/${id}`, { description: descriptionDraft })
      setProject(prev => (prev ? { ...prev, description: data.description } : prev))
      setEditingDescription(false)
      showSuccess('Descrição salva', 'A IA vai usar essa descrição como contexto')
    } catch (error) {
      showError('Erro', await getApiErrorMessage(error, 'Não foi possível salvar a descrição'))
    } finally {
      setSavingDescription(false)
    }
  }

  const exportAllRequirements = async (format: ExportFormat) => {
    if (!project) return
    setShowExportModal(false)
    setExporting(true)
    const fileName = `documento-requisitos-${toFileName(project.name)}`

    try {
      if (format === 'html') {
        const { data } = await api.get<{ html: string }>(`/projects/${id}/export`, { params: { format } })
        saveAs(new Blob([data.html], { type: 'text/html;charset=utf-8' }), `${fileName}.html`)
      } else {
        const response = await api.get(`/projects/${id}/export`, {
          params: { format },
          responseType: 'blob',
          timeout: 2 * 60_000,
        })
        saveAs(response.data, `${fileName}.${format}`)
      }
      showSuccess('Exportado!', 'Documento exportado com sucesso')
    } catch (error) {
      showError('Erro ao exportar', await getApiErrorMessage(error, 'Erro ao exportar documento'))
    } finally {
      setExporting(false)
    }
  }

  const downloadIndividual = async (format: ExportFormat) => {
    if (!editorContent || !openDoc) return
    setShowDownloadMenu(false)
    const fileName = `requisitos-${toFileName(openDoc.screenName)}`

    if (format === 'html') {
      saveAs(new Blob([editorContent], { type: 'text/html;charset=utf-8' }), `${fileName}.html`)
      return
    }

    setExporting(true)
    try {
      const response = await api.post(
        `/projects/${id}/export-single`,
        { html: editorContent, screenName: openDoc.screenName, format },
        { responseType: 'blob', timeout: 2 * 60_000 }
      )
      saveAs(response.data, `${fileName}.${format}`)
    } catch (error) {
      showError('Erro', await getApiErrorMessage(error, `Falha ao exportar para ${format.toUpperCase()}`))
    } finally {
      setExporting(false)
    }
  }

  const goBack = async () => {
    if (await confirmDiscard()) navigate('/app/projects')
  }

  if (loading) {
    return <Loading message="Carregando projeto..." />
  }

  if (!project) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-slate-500 dark:text-slate-400">{loadError ?? 'Projeto não encontrado'}</p>
        <button onClick={() => navigate('/app/projects')} className="text-primary-600 mt-4">
          Voltar para projetos
        </button>
      </div>
    )
  }

  const openQuestionsCount = questions.filter(q => q.status === 'open').length
  const canRefine = !!openDoc?.requirementId

  return (
    <div className="md:h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <button
          onClick={goBack}
          aria-label="Voltar para projetos"
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white truncate">{project.name}</h1>
          {editingDescription ? (
            <div className="mt-1 flex flex-col sm:flex-row gap-2">
              <textarea
                value={descriptionDraft}
                onChange={e => setDescriptionDraft(e.target.value)}
                maxLength={2000}
                rows={2}
                autoFocus
                aria-label="Descrição do projeto"
                placeholder="Ex: App de delivery para restaurantes; usuários são clientes e entregadores; pagamentos via Pix e cartão."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500"
              />
              <div className="flex gap-2 sm:flex-col">
                <button
                  onClick={saveDescription}
                  disabled={savingDescription}
                  className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {savingDescription ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Salvar
                </button>
                <button
                  onClick={() => setEditingDescription(false)}
                  disabled={savingDescription}
                  className="px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setDescriptionDraft(project.description ?? '')
                setEditingDescription(true)
              }}
              className="group mt-0.5 flex items-start gap-1.5 text-left text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <span className={project.description ? '' : 'italic'}>
                {project.description || 'Adicionar descrição do projeto (contexto para a IA)'}
              </span>
              <Pencil size={13} className="mt-1 flex-shrink-0 opacity-50 group-hover:opacity-100" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Sidebar */}
        <div className="w-full md:w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[60vh] md:max-h-none">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1" role="tablist" aria-label="Painel do projeto">
              <button
                role="tab"
                aria-selected={sidebarTab === 'screens'}
                onClick={() => setSidebarTab('screens')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                  sidebarTab === 'screens' ? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <FileText size={15} /> Telas ({savedRequirements.length})
              </button>
              <button
                role="tab"
                aria-selected={sidebarTab === 'questions'}
                onClick={() => setSidebarTab('questions')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-sm font-medium transition-colors ${
                  sidebarTab === 'questions' ? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <MessagesSquare size={15} /> Dúvidas
                {openQuestionsCount > 0 && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-purple-600 text-white text-[11px] leading-[18px]">
                    {openQuestionsCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {sidebarTab === 'questions' ? (
            <QuestionsPanel
              projectId={project.id}
              questions={questions}
              hasDocuments={savedRequirements.length > 0}
              onReload={loadQuestions}
            />
          ) : (
            <>
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <button
                  onClick={openWizard}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-sm font-medium"
                >
                  <Plus size={16} /> Adicionar tela
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {openDoc && !openDoc.requirementId && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-400">
                    <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-sm truncate flex-1 text-amber-800 dark:text-amber-200 font-medium">{openDoc.screenName}</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-300">não salva</span>
                  </div>
                )}

                {savedRequirements.length === 0 && !openDoc ? (
                  <div className="text-center py-8">
                    <FileText className="mx-auto text-slate-400 dark:text-slate-500 mb-2" size={32} />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma tela documentada ainda</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {savedRequirements.map(req => {
                      const isSelected = openDoc?.requirementId === req.id
                      return (
                        <li key={req.id} className="relative group">
                          <button
                            onClick={() => openRequirement(req)}
                            aria-current={isSelected ? 'true' : undefined}
                            className={`w-full flex items-center gap-2 pl-3 pr-9 py-2 rounded-lg text-left transition-all ${
                              isSelected
                                ? 'bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                            }`}
                          >
                            <Check size={14} className="text-green-500 flex-shrink-0" aria-hidden="true" />
                            <span className={`text-sm truncate flex-1 ${
                              isSelected ? 'text-primary-700 dark:text-primary-400 font-medium' : 'text-slate-700 dark:text-slate-300'
                            }`}>
                              {req.screen_name}
                            </span>
                            {isSelected && hasChanges && (
                              <span className="w-2 h-2 rounded-full bg-amber-500" title="Alterações não salvas" />
                            )}
                          </button>
                          <button
                            onClick={() => deleteRequirement(req)}
                            aria-label={`Remover documento ${req.screen_name}`}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {savedRequirements.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 p-3">
                  <button
                    onClick={() => setShowExportModal(true)}
                    disabled={exporting}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {exporting ? 'Exportando...' : 'Exportar Documento Completo'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Main content - Editor */}
        <div className="flex-1 min-h-[60vh] md:min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
          {openDoc ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-800 dark:text-white truncate">{openDoc.screenName}</h3>
                  <p className={`text-xs ${hasChanges ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {hasChanges ? 'Alterações não salvas' : 'Documento salvo'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1" role="group" aria-label="Modo de visualização">
                    <button
                      onClick={() => setViewMode('preview')}
                      aria-pressed={viewMode === 'preview'}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        viewMode === 'preview' ? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Eye size={14} /> Visualizar
                    </button>
                    <button
                      onClick={() => setViewMode('edit')}
                      aria-pressed={viewMode === 'edit'}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        viewMode === 'edit' ? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Edit3 size={14} /> Editar
                    </button>
                  </div>

                  <button
                    onClick={() => setShowRefine(true)}
                    disabled={!canRefine || hasChanges || refining}
                    title={
                      !canRefine ? 'Salve o documento para poder refiná-lo'
                        : hasChanges ? 'Salve as alterações antes de refinar'
                          : 'Atualizar o documento com as respostas das dúvidas'
                    }
                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refining ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    Refinar com IA
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      disabled={!editorContent || exporting}
                      aria-haspopup="menu"
                      aria-expanded={showDownloadMenu}
                      aria-label="Baixar documento"
                      className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50"
                    >
                      {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      <ChevronDown size={14} />
                    </button>

                    {showDownloadMenu && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowDownloadMenu(false)} />
                        <div role="menu" className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[160px] z-20">
                          {([
                            { format: 'docx', label: 'Word (.docx)', icon: FileType, color: 'text-blue-600' },
                            { format: 'pdf', label: 'PDF', icon: File, color: 'text-red-600' },
                            { format: 'html', label: 'HTML', icon: Code, color: 'text-orange-600' },
                          ] as const).map(({ format, label, icon: Icon, color }) => (
                            <button
                              key={format}
                              role="menuitem"
                              onClick={() => downloadIndividual(format)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              <Icon size={16} className={color} /> {label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={saveRequirement}
                    disabled={saving || !hasChanges}
                    className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Salvar
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden min-h-[50vh] md:min-h-0">
                {viewMode === 'preview' ? (
                  // sandbox without allow-scripts: AI/user HTML can't run code in the app origin
                  <iframe
                    sandbox=""
                    srcDoc={editorContent}
                    className="w-full h-full min-h-[50vh] md:min-h-0 border-0 bg-white rounded-b-xl"
                    title={`Pré-visualização: ${openDoc.screenName}`}
                  />
                ) : (
                  <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-slate-800">
                    <Editor
                      tinymceScriptSrc="/tinymce/tinymce.min.js"
                      value={getBodyContent(editorContent)}
                      onEditorChange={(content, editor) => {
                        setEditorContent(wrapInHTML(content))
                        // Ignore the change event TinyMCE fires while normalizing the initial content
                        if (editor.isDirty()) setHasChanges(true)
                      }}
                      init={{
                        height: '100%',
                        menubar: false,
                        plugins: ['lists', 'table', 'wordcount'],
                        toolbar: 'undo redo | blocks | bold italic underline | forecolor backcolor | bullist numlist | table | removeformat',
                        content_style: `
                          body { font-family: 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; padding: 16px; }
                          h1 { color: #1e3a5f; font-size: 1.75rem; border-bottom: 2px solid #1e3a5f; padding-bottom: 0.5rem; }
                          h2 { color: #1e3a5f; font-size: 1.375rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 1.5rem; }
                          h3 { color: #2c5282; font-size: 1.125rem; margin-top: 1rem; }
                          table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                          th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; vertical-align: top; }
                          th { background-color: #1e3a5f; color: white; font-weight: 600; }
                          tr:nth-child(even) { background-color: #f8fafc; }
                        `,
                        skin: 'oxide',
                        content_css: false,
                        branding: false,
                        promotion: false,
                      }}
                      licenseKey="gpl"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <Image className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {savedRequirements.length === 0 ? 'Adicione prints das telas' : 'Selecione uma tela'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-4">
                  {savedRequirements.length === 0
                    ? 'Envie screenshots das telas do seu sistema. A IA levanta as dúvidas importantes e gera os requisitos.'
                    : 'Escolha uma tela na lista para visualizar, editar ou refinar os requisitos.'}
                </p>
                {savedRequirements.length === 0 && (
                  <button
                    onClick={openWizard}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    <Plus size={16} /> Adicionar primeira tela
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} onExport={exportAllRequirements} />
      )}

      {showWizard && (
        <AddScreenWizard
          projectId={project.id}
          onClose={() => setShowWizard(false)}
          onGenerated={handleGenerated}
          onQuestionsChanged={loadQuestions}
        />
      )}

      {showRefine && openDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="refine-title"
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 modal-content"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 id="refine-title" className="text-lg font-semibold text-slate-800 dark:text-white">
                Refinar "{openDoc.screenName}"
              </h3>
              <button
                onClick={() => setShowRefine(false)}
                disabled={refining}
                aria-label="Fechar"
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded disabled:opacity-50"
              >
                <X size={20} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                A IA atualiza o documento com as respostas dadas no painel de dúvidas (desta tela e do projeto),
                mantendo os IDs existentes.
              </p>
              <label htmlFor="refine-instructions" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Pedido adicional (opcional)
              </label>
              <textarea
                id="refine-instructions"
                value={refineInstructions}
                onChange={e => setRefineInstructions(e.target.value)}
                maxLength={4000}
                rows={3}
                disabled={refining}
                placeholder="Ex: detalhe melhor as mensagens de erro; adicione requisitos de acessibilidade"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowRefine(false)}
                disabled={refining}
                className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={refineDocument}
                disabled={refining}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {refining ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {refining ? 'Refinando...' : 'Refinar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
