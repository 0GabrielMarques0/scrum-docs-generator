import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, FileText, Save, Loader2, 
  Check, 
  Sparkles, Edit3, Trash2, Eye, Download,
  X, FileType, File, ChevronDown, Code, Upload, Image, Plus
} from 'lucide-react'
import ReactQuill from 'react-quill-new'
// @ts-ignore
import 'react-quill-new/dist/quill.snow.css'
import { saveAs } from 'file-saver'
import { api } from '../services/api'
import Loading from '../components/Loading'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'

interface Project {
  id: string
  name: string
  description?: string
  created_at: string
}

interface Screen {
  id: string
  screen_id: string
  screen_name: string
  image_path: string
  status: string
}

interface SavedRequirement {
  id: string
  screen_id: string
  screen_name: string
  content: string
  created_at: string
  updated_at: string
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { showError, showWarning, showSuccess } = useToast()
  const { confirm } = useConfirm()
  
  const [project, setProject] = useState<Project | null>(null)
  const [screens, setScreens] = useState<Screen[]>([])
  const [savedRequirements, setSavedRequirements] = useState<SavedRequirement[]>([])
  const [loading, setLoading] = useState(true)
  
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(null)
  const [editorContent, setEditorContent] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('preview')

  // New screen modal state
  const [showAddScreenModal, setShowAddScreenModal] = useState(false)
  const [newScreenName, setNewScreenName] = useState('')
  const [newScreenImages, setNewScreenImages] = useState<{ file: File; preview: string }[]>([])
  const addScreenFileInputRef = useRef<HTMLInputElement>(null)

  // Load project data
  useEffect(() => {
    if (!id) return
    loadProject()
  }, [id])

  const loadProject = async () => {
    try {
      setLoading(true)
      const { data } = await api.get(`/projects/${id}`)
      setProject(data)
      
      // Load saved requirements
      const reqRes = await api.get(`/projects/${id}/requirements`)
      setSavedRequirements(reqRes.data.requirements)
      
      // Load screens
      loadScreens()
    } catch (error) {
      console.error('Error loading project:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadScreens = async () => {
    try {
      const { data } = await api.get(`/screens/${id}`)
      setScreens(data.screens || [])
    } catch (error: any) {
      console.error('Error loading screens:', error)
    }
  }

  // Add Screen Modal functions
  const openAddScreenModal = () => {
    setNewScreenName('')
    setNewScreenImages([])
    setShowAddScreenModal(true)
  }

  const closeAddScreenModal = () => {
    setShowAddScreenModal(false)
    setNewScreenName('')
    // Clean up previews
    newScreenImages.forEach(img => URL.revokeObjectURL(img.preview))
    setNewScreenImages([])
  }

  const handleAddScreenImages = (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const images = fileArray.filter(f => f.type.startsWith('image/'))
    
    if (images.length === 0) {
      showWarning('Formato inválido', 'Envie apenas imagens (PNG, JPG, GIF, WebP)')
      return
    }

    const newImages = images.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }))

    setNewScreenImages(prev => [...prev, ...newImages])
  }

  const removeScreenImage = (index: number) => {
    setNewScreenImages(prev => {
      const updated = [...prev]
      URL.revokeObjectURL(updated[index].preview)
      updated.splice(index, 1)
      return updated
    })
  }

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data:image/xxx;base64, prefix
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const createScreenWithAI = async () => {
    if (!newScreenName.trim()) {
      showWarning('Nome obrigatório', 'Digite um nome para a tela')
      return
    }

    if (newScreenImages.length === 0) {
      showWarning('Imagens obrigatórias', 'Adicione pelo menos uma imagem')
      return
    }

    try {
      setGenerating(true)
      closeAddScreenModal()

      // Convert all images to base64
      const imagesBase64 = await Promise.all(
        newScreenImages.map(async img => ({
          base64: await convertFileToBase64(img.file),
          mimeType: img.file.type
        }))
      )

      // Send to backend for AI analysis (images are not saved)
      const { data } = await api.post(`/screens/analyze-images`, {
        projectId: id,
        screenName: newScreenName.trim(),
        projectName: project?.name,
        images: imagesBase64
      })

      // Create a virtual screen (not stored in database)
      const virtualScreen: Screen = {
        id: `temp-${Date.now()}`,
        screen_id: `temp-${Date.now()}`,
        screen_name: newScreenName.trim(),
        image_path: '',
        status: 'analyzed'
      }

      setSelectedScreen(virtualScreen)
      setEditorContent(data.requirements)
      setHasChanges(true)
      showSuccess('Requisitos gerados', 'A IA analisou as imagens e gerou os requisitos')
    } catch (error: any) {
      console.error('Error creating screen:', error)
      showError('Erro ao gerar', error.response?.data?.error || 'Erro ao analisar imagens com IA')
    } finally {
      setGenerating(false)
    }
  }

  const generateRequirements = async () => {
    if (!project || !selectedScreen) return
    
    try {
      setGenerating(true)
      const { data } = await api.post(`/screens/${selectedScreen.id}/analyze`, {
        projectName: project.name,
      })
      
      setEditorContent(data.requirements)
      setHasChanges(true)
      showSuccess('Requisitos gerados', 'A IA analisou a tela e gerou os requisitos')
    } catch (error: any) {
      console.error('Error generating requirements:', error)
      showError('Erro ao gerar', error.response?.data?.error || 'Erro ao analisar tela com IA')
    } finally {
      setGenerating(false)
    }
  }

  const saveRequirement = async () => {
    if (!selectedScreen || !editorContent.trim()) return
    
    try {
      setSaving(true)
      await api.post(`/projects/${id}/requirements`, {
        screenId: selectedScreen.id,
        screenName: selectedScreen.screen_name,
        content: editorContent,
      })
      
      const { data } = await api.get(`/projects/${id}/requirements`)
      setSavedRequirements(data.requirements)
      setHasChanges(false)
      showSuccess('Salvo!', 'Requisito salvo com sucesso')
    } catch (error: any) {
      console.error('Error saving requirement:', error)
      showError('Erro ao salvar', error.response?.data?.error || 'Erro ao salvar requisito')
    } finally {
      setSaving(false)
    }
  }

  const deleteRequirement = async (reqId: string) => {
    const confirmed = await confirm({
      title: 'Excluir documento',
      message: 'Excluir este documento de requisitos? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      danger: true
    })
    
    if (!confirmed) return
    
    try {
      await api.delete(`/projects/${id}/requirements/${reqId}`)
      setSavedRequirements(prev => prev.filter(r => r.id !== reqId))
      
      if (selectedScreen) {
        const wasSelected = savedRequirements.find(r => r.id === reqId)?.screen_id === selectedScreen.id
        if (wasSelected) {
          setEditorContent('')
          setHasChanges(false)
        }
      }
    } catch (error) {
      console.error('Error deleting requirement:', error)
    }
  }

  const [exporting, setExporting] = useState(false)

  // Quill editor modules config
  const quillModules = useMemo(() => ({
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['clean']
    ],
  }), [])

  // Extract body content from full HTML document
  const getBodyContent = (html: string): string => {
    if (!html) return ''
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    return bodyMatch ? bodyMatch[1] : html
  }

  // Wrap body content back into full HTML document
  const wrapInHTML = (bodyContent: string): string => {
    const styles = `
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #ffffff; max-width: 900px; margin: 0 auto; padding: 20px; }
      h1 { color: #1e3a5f; font-size: 28px; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
      h2 { color: #1e3a5f; font-size: 22px; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
      h3 { color: #2c5282; font-size: 16px; margin-top: 20px; }
      p { color: #333; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; border: 1px solid #e2e8f0; table-layout: fixed; }
      th { background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f; word-wrap: break-word; }
      td { padding: 10px 12px; border: 1px solid #e2e8f0; color: #333; word-wrap: break-word; overflow-wrap: break-word; }
      tr:nth-child(even) { background-color: #f8fafc; }
      ul { margin: 10px 0; padding-left: 25px; }
      li { margin: 5px 0; color: #333; }
    `
    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>${styles}</style></head><body>${bodyContent}</body></html>`
  }

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFormat, setExportFormat] = useState<'html' | 'docx' | 'pdf'>('docx')
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

  const openExportModal = () => {
    if (savedRequirements.length === 0) {
      showWarning('Sem requisitos', 'Nenhum requisito salvo para exportar')
      return
    }
    setShowExportModal(true)
  }
  
  const exportAllRequirements = async () => {
    setExporting(true)
    setShowExportModal(false)
    
    try {
      const fileName = `documento-requisitos-${project?.name.replace(/\s+/g, '-').toLowerCase()}`

      if (exportFormat === 'docx') {
        const response = await api.get(`/projects/${id}/export?format=docx`, {
          responseType: 'blob'
        })
        saveAs(response.data, `${fileName}.docx`)
      } else {
        const response = await api.get(`/projects/${id}/export`)
        const html = response.data.html

        if (exportFormat === 'html') {
          const blob = new Blob([html], { type: 'text/html' })
          saveAs(blob, `${fileName}.html`)
        } else if (exportFormat === 'pdf') {
          const printWindow = window.open('', '_blank')
          if (printWindow) {
            printWindow.document.write(html)
            printWindow.document.close()
            printWindow.focus()
            setTimeout(() => {
              printWindow.print()
            }, 500)
          }
        }
        showSuccess('Exportado!', 'Documento exportado com sucesso')
      }
    } catch (error: any) {
      console.error('Error exporting:', error)
      showError('Erro ao exportar', error.response?.data?.error || 'Erro ao exportar documento')
    } finally {
      setExporting(false)
    }
  }

  const downloadIndividual = async (format: 'html' | 'docx' | 'pdf') => {
    if (!editorContent || !selectedScreen) return
    setShowDownloadMenu(false)
    
    if (format === 'html') {
      const blob = new Blob([editorContent], { type: 'text/html' })
      saveAs(blob, `requisitos-${selectedScreen.screen_name.replace(/\s+/g, '-').toLowerCase()}.html`)
      return
    }
    
    if (format === 'pdf') {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(editorContent)
        printWindow.document.close()
        printWindow.print()
      }
      return
    }
    
    if (format === 'docx') {
      try {
        const response = await api.post(`/projects/${id}/export-single`, {
          html: editorContent,
          screenName: selectedScreen.screen_name
        }, { responseType: 'blob' })
        
        saveAs(response.data, `requisitos-${selectedScreen.screen_name.replace(/\s+/g, '-').toLowerCase()}.docx`)
      } catch (error) {
        console.error('Error exporting to DOCX:', error)
        showError('Erro', 'Falha ao exportar para DOCX')
      }
    }
  }

  if (loading) {
    return <Loading message="Carregando projeto..." />
  }

  if (!project) {
    return (
      <div className="text-center py-12 animate-fade-in">
        <p className="text-slate-500 dark:text-slate-400">Projeto não encontrado</p>
        <button onClick={() => navigate('/projects')} className="text-primary-600 mt-4">
          Voltar para projetos
        </button>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate('/projects')}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar - Screens list */}
        <div className="w-80 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-slate-800 dark:text-white">Telas do Projeto</h2>
              <button
                onClick={openAddScreenModal}
                disabled={generating}
                className="p-1.5 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-lg"
                title="Adicionar tela"
              >
                <Plus size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {savedRequirements.length} tela(s) documentada(s)
            </p>
          </div>
          
          {/* Screens list - shows saved requirements */}
          <div className="flex-1 overflow-y-auto p-2">
            {savedRequirements.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto text-slate-400 dark:text-slate-500 mb-2" size={32} />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Clique em <span className="text-primary-600 font-medium">+</span> para adicionar uma tela
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {savedRequirements.map(req => {
                  const isSelected = selectedScreen?.screen_name === req.screen_name
                  
                  return (
                    <div
                      key={req.id}
                      className={`relative group flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500' 
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                      onClick={() => {
                        // Create a virtual screen to display the saved requirement
                        const virtualScreen: Screen = {
                          id: req.screen_id,
                          screen_id: req.screen_id,
                          screen_name: req.screen_name,
                          image_path: '',
                          status: 'documented'
                        }
                        setSelectedScreen(virtualScreen)
                        setEditorContent(req.content)
                        setHasChanges(false)
                      }}
                    >
                      <Check size={14} className="text-green-500 flex-shrink-0" />
                      <span className={`text-sm truncate flex-1 ${
                        isSelected 
                          ? 'text-primary-700 dark:text-primary-400 font-medium' 
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {req.screen_name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteRequirement(req.id)
                        }}
                        className="p-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remover documento"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Export button */}
          {savedRequirements.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-700 p-3">
              <button
                onClick={openExportModal}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
              >
                {exporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download size={16} />
                    Exportar Documento Completo
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Main content - Editor */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col">
          {selectedScreen ? (
            <>
              {/* Editor toolbar */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">{selectedScreen.screen_name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {hasChanges ? 'Alterações não salvas' : editorContent ? 'Documento salvo' : 'Sem conteúdo'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        viewMode === 'preview' ? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Eye size={14} />
                      Visualizar
                    </button>
                    <button
                      onClick={() => setViewMode('edit')}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        viewMode === 'edit' ? 'bg-white dark:bg-slate-600 shadow text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Edit3 size={14} />
                      Editar
                    </button>
                  </div>
                  
                  {/* Only show "Gerar com IA" when there's no content yet */}
                  {!editorContent && (
                    <button
                      onClick={generateRequirements}
                      disabled={generating}
                      className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    >
                      {generating ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <Sparkles size={16} />
                      )}
                      {generating ? 'Analisando...' : 'Gerar com IA'}
                    </button>
                  )}
                  
                  {/* Download dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                      disabled={!editorContent}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 disabled:opacity-50"
                      title="Baixar"
                    >
                      <Download size={16} />
                      <ChevronDown size={14} />
                    </button>
                    
                    {showDownloadMenu && editorContent && (
                      <>
                        <div 
                          className="fixed inset-0 z-10"
                          onClick={() => setShowDownloadMenu(false)}
                        />
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[160px] z-20">
                          <button
                            onClick={() => downloadIndividual('docx')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <FileType size={16} className="text-blue-600" />
                            Word (.docx)
                          </button>
                          <button
                            onClick={() => downloadIndividual('pdf')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <File size={16} className="text-red-600" />
                            PDF
                          </button>
                          <button
                            onClick={() => downloadIndividual('html')}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                          >
                            <Code size={16} className="text-orange-600" />
                            HTML
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <button
                    onClick={saveRequirement}
                    disabled={saving || !hasChanges}
                    className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                  >
                    {saving ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <Save size={16} />
                    )}
                    Salvar
                  </button>
                </div>
              </div>

              {/* Editor/Preview area */}
              <div className="flex-1 overflow-hidden">
                {viewMode === 'preview' ? (
                  <div className="h-full overflow-auto bg-white">
                    {editorContent ? (
                      <iframe
                        srcDoc={editorContent}
                        className="w-full h-full border-0 bg-white"
                        title="Preview"
                        style={{ backgroundColor: 'white' }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <div className="text-center">
                          <Sparkles className="mx-auto mb-2 text-purple-400" size={32} />
                          <p className="font-medium">Clique em "Gerar com IA" para criar o documento</p>
                          <p className="text-sm mt-1">A IA vai analisar a imagem e gerar os requisitos</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex flex-col overflow-hidden">
                    <ReactQuill
                      theme="snow"
                      value={getBodyContent(editorContent)}
                      onChange={(content) => {
                        setEditorContent(wrapInHTML(content))
                        setHasChanges(true)
                      }}
                      modules={quillModules}
                      placeholder="Clique em 'Gerar com IA' para criar os requisitos automaticamente, ou edite aqui..."
                      className="flex-1 overflow-auto"
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Image className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
                <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {screens.length === 0 ? 'Adicione prints das telas' : 'Selecione uma tela'}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm">
                  {screens.length === 0 
                    ? 'Faça upload de screenshots das telas do seu sistema para gerar os requisitos automaticamente'
                    : 'Escolha uma tela para gerar ou editar os requisitos'
                  }
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export Format Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md mx-4 modal-content">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Exportar Documento</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <X size={20} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Escolha o formato de exportação:
              </p>
              
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    exportFormat === 'docx' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value="docx"
                    checked={exportFormat === 'docx'}
                    onChange={() => setExportFormat('docx')}
                    className="sr-only"
                  />
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <FileType size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">Word (.docx)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Documento editável</p>
                  </div>
                  {exportFormat === 'docx' && <Check size={20} className="text-primary-600" />}
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    exportFormat === 'pdf' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value="pdf"
                    checked={exportFormat === 'pdf'}
                    onChange={() => setExportFormat('pdf')}
                    className="sr-only"
                  />
                  <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <File size={20} className="text-red-600 dark:text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">PDF</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Janela de impressão</p>
                  </div>
                  {exportFormat === 'pdf' && <Check size={20} className="text-primary-600" />}
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    exportFormat === 'html' 
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' 
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="format"
                    value="html"
                    checked={exportFormat === 'html'}
                    onChange={() => setExportFormat('html')}
                    className="sr-only"
                  />
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <Code size={20} className="text-orange-600 dark:text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">HTML</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Página web</p>
                  </div>
                  {exportFormat === 'html' && <Check size={20} className="text-primary-600" />}
                </label>
              </div>
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={exportAllRequirements}
                className="flex-1 px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Download size={16} />
                Exportar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Screen Modal */}
      {showAddScreenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 modal-backdrop">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg mx-4 modal-content max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Adicionar Tela</h3>
              <button
                onClick={closeAddScreenModal}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
              >
                <X size={20} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              {/* Screen Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome da Tela
                </label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="Ex: Tela de Login, Dashboard, etc."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Images Upload Area */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Prints da Tela
                </label>
                <input
                  ref={addScreenFileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => e.target.files && handleAddScreenImages(e.target.files)}
                  className="hidden"
                />
                <div
                  onClick={() => addScreenFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
                >
                  <Upload className="mx-auto text-slate-400 dark:text-slate-500 mb-2" size={32} />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Clique para adicionar imagens
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    PNG, JPG, GIF ou WebP
                  </p>
                </div>
              </div>

              {/* Image Previews */}
              {newScreenImages.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {newScreenImages.length} imagem(ns) selecionada(s)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {newScreenImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeScreenImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400">
                As imagens serão analisadas pela IA para gerar os requisitos. Elas não serão salvas.
              </p>
            </div>

            <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={closeAddScreenModal}
                className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={createScreenWithAI}
                disabled={!newScreenName.trim() || newScreenImages.length === 0}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                Gerar com IA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generating Loading Overlay */}
      {generating && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center">
            {/* Animated AI Icon */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse opacity-30" />
              <div className="absolute inset-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse opacity-50 animation-delay-150" />
              <div className="absolute inset-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-white animate-pulse" />
              </div>
              {/* Rotating ring */}
              <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-r-blue-500 rounded-full animate-spin" />
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Analisando com IA
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              A inteligência artificial está analisando as imagens e gerando os requisitos...
            </p>
            
            {/* Progress dots */}
            <div className="flex justify-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
            </div>
            
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
              Isso pode levar alguns segundos...
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
