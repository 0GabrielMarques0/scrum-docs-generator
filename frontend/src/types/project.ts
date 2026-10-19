export interface Project {
  id: string
  name: string
  description?: string | null
  created_at: string
  updated_at?: string
}

export interface ProjectSummary extends Project {
  screen_count: number
  open_questions: number
}

export interface SavedRequirement {
  id: string
  screen_id: string
  screen_name: string
  content: string
  created_at: string
  updated_at: string
}

export type QuestionStatus = 'open' | 'answered' | 'dismissed'

export interface Question {
  id: string
  /** null = project-wide question */
  screenName: string | null
  question: string
  reason: string | null
  category: string
  options: string[]
  answer: string | null
  status: QuestionStatus
  createdAt: string
  answeredAt: string | null
}

export interface QuestionsResult {
  understanding: string
  questions: Question[]
}

/** Document open in the editor: a saved requirement or a freshly generated, unsaved one */
export interface OpenDocument {
  screenId: string
  screenName: string
  /** Set once the document exists in the database */
  requirementId: string | null
}

export const QUESTION_CATEGORY_LABELS: Record<string, string> = {
  regra_de_negocio: 'Regra de negócio',
  fluxo: 'Fluxo',
  validacao: 'Validação',
  permissao: 'Permissão',
  integracao: 'Integração',
  dados: 'Dados',
  nao_funcional: 'Não funcional',
  escopo: 'Escopo',
}
