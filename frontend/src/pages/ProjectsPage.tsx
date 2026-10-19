import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Trash2, ArrowRight, FileText, MessagesSquare } from 'lucide-react'
import { api, getApiErrorMessage } from '../services/api'
import Loading from '../components/Loading'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/ConfirmModal'
import { ProjectSummary } from '../types/project'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { showError, showSuccess } = useToast()
  const { confirm } = useConfirm()
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const { data } = await api.get('/projects')
      setProjects(data.projects)
    } catch (error) {
      showError('Erro', await getApiErrorMessage(error, 'Não foi possível carregar os projetos'))
    } finally {
      setLoading(false)
    }
  }

  const createProject = async () => {
    if (!newProject.name) {
      showError('Nome obrigatório', 'Insira um nome para o projeto')
      return
    }
    
    try {
      setCreating(true)
      const { data } = await api.post('/projects', {
        name: newProject.name.trim(),
        description: newProject.description.trim() || undefined,
      })
      setShowNewModal(false)
      setNewProject({ name: '', description: '' })
      showSuccess('Projeto criado', 'Agora adicione prints das telas para gerar os requisitos')
      navigate(`/app/projects/${data.id}`)
    } catch (error) {
      showError('Erro', await getApiErrorMessage(error, 'Não foi possível criar o projeto'))
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = async (id: string) => {
    const confirmed = await confirm({
      title: 'Excluir projeto',
      message: 'Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      danger: true
    })
    
    if (!confirmed) return
    
    try {
      await api.delete(`/projects/${id}`)
      setProjects(prev => prev.filter(p => p.id !== id))
      showSuccess('Projeto excluído')
    } catch (error) {
      showError('Erro ao excluir', await getApiErrorMessage(error, 'Não foi possível excluir o projeto'))
    }
  }

  if (loading) {
    return <Loading message="Carregando projetos..." />
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Projetos</h1>
          <p className="text-slate-600 dark:text-slate-400">Gerencie seus projetos e documentos de requisitos</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-primary-700 flex items-center gap-2"
        >
          <Plus size={20} />
          Novo Projeto
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <FolderOpen className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Nenhum projeto</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Crie um projeto para começar a documentar</p>
          <button
            onClick={() => setShowNewModal(true)}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Criar primeiro projeto
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 animate-stagger">
          {projects.map(project => (
            <div key={project.id} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:border-primary-300 dark:hover:border-primary-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 p-2 rounded-lg">
                  <FolderOpen size={24} />
                </div>
                <button
                  onClick={() => deleteProject(project.id)}
                  aria-label={`Excluir projeto ${project.name}`}
                  className="text-slate-400 hover:text-red-500 p-1"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <h3 className="font-semibold text-slate-800 dark:text-white mb-1">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">{project.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <span className="flex items-center gap-1"><FileText size={13} /> {project.screen_count} tela(s)</span>
                {project.open_questions > 0 && (
                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                    <MessagesSquare size={13} /> {project.open_questions} dúvida(s) aberta(s)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
                Criado em {new Date(project.created_at).toLocaleDateString('pt-BR')}
              </p>
              <button
                onClick={() => navigate(`/app/projects/${project.id}`)}
                className="w-full bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 flex items-center justify-center gap-2"
              >
                Abrir Projeto
                <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 modal-backdrop">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 modal-content">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Novo Projeto</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Projeto
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Ex: Sistema de Vendas"
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400"
                  autoFocus
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descrição <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Ex: App de delivery; perfis cliente e entregador; pagamento via Pix e cartão"
                  rows={3}
                  maxLength={2000}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400"
                />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                A descrição dá contexto à IA: quem usa o sistema, objetivo e regras gerais. Você pode editá-la depois.
              </p>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowNewModal(false)}
                disabled={creating}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={createProject}
                disabled={creating || !newProject.name.trim()}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Projeto'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
