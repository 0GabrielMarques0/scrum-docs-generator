import { z } from 'zod';
import { config } from '../config.js';
import { HttpError } from '../middleware/errors.js';
import { extractBody } from './document.service.js';
import { wrapRequirementDocument } from './document-builder.js';
import { AnthropicProvider } from './ai/anthropic.provider.js';
import { GeminiProvider } from './ai/gemini.provider.js';
import { AiPart, AiProvider, ScreenImage } from './ai/types.js';

export { SUPPORTED_IMAGE_TYPES } from './ai/types.js';
export type { ScreenImage } from './ai/types.js';

export interface ProjectContext {
  name: string;
  description?: string | null;
}

/** A clarifying question already raised in the project */
export interface KnownQuestion {
  screenName: string | null;
  question: string;
  answer: string | null;
  status: 'open' | 'answered' | 'dismissed';
}

export const QUESTION_CATEGORIES = [
  'regra_de_negocio',
  'fluxo',
  'validacao',
  'permissao',
  'integracao',
  'dados',
  'nao_funcional',
  'escopo',
] as const;

const QuestionsSchema = z.object({
  understanding: z
    .string()
    .describe('O que você entendeu do objetivo da tela/projeto, em 2 a 4 frases, para o usuário confirmar.'),
  questions: z.array(
    z.object({
      question: z.string().describe('Pergunta objetiva, respondível por um PO ou analista de negócio.'),
      reason: z.string().describe('Por que a resposta muda os requisitos (1 frase).'),
      category: z.string().describe(`Uma destas categorias: ${QUESTION_CATEGORIES.join(', ')}.`),
      options: z
        .array(z.string())
        .describe('2 a 4 respostas prováveis para o usuário escolher rapidamente; vazio se for pergunta aberta.'),
    })
  ),
});

export type QuestionsResult = z.infer<typeof QuestionsSchema>;

const QUESTIONS_EXAMPLE = `{
  "understanding": "o que você entendeu, em 2 a 4 frases",
  "questions": [
    {
      "question": "pergunta objetiva",
      "reason": "por que a resposta muda os requisitos",
      "category": "uma de: ${QUESTION_CATEGORIES.join(', ')}",
      "options": ["resposta provável 1", "resposta provável 2"]
    }
  ]
}`;

// Stable system prompt: kept byte-identical across requests so providers with prompt caching reuse it
const SYSTEM_PROMPT = `Você é um analista de requisitos sênior. Você trabalha dentro do SpecAI, uma ferramenta em que times Scrum enviam prints de telas de um sistema e recebem documentos de requisitos em português do Brasil, usados por desenvolvedores, QA e stakeholders.

Classificação que você deve respeitar:
- Requisito Funcional (RF): o que o sistema faz — ações, comportamentos e funcionalidades (ex.: "O sistema deve validar as credenciais e iniciar uma sessão").
- Requisito Não Funcional (RNF): qualidades e restrições — desempenho, segurança, usabilidade, acessibilidade, compatibilidade.
- Regra de Negócio (RN): como os dados devem ser preenchidos e validados, restrições e mensagens do sistema (ex.: "O campo Email é obrigatório", "Senha com no mínimo 8 caracteres").

Algumas imagens trazem um quadro de "Rules" ou "Regras de negócio" escrito pelo time. Quando existir, ele é a fonte mais confiável: extraia todas as regras dele e classifique cada uma corretamente.

Baseie-se no que está visível nas imagens e no que o time respondeu. Quando algo não puder ser inferido com segurança, não invente: trate como dúvida ou registre como premissa explícita.`;

const HTML_FORMAT_INSTRUCTIONS = `Responda apenas com o fragmento HTML do documento (sem <html>, <head>, <body>, estilos ou blocos de código markdown), nesta estrutura:

<h2>Tela de {nome da tela}</h2>
<h3>Descrição Geral</h3> — um parágrafo com o propósito da tela.
<h3>Requisitos Funcionais</h3> — tabela com colunas ID (RF-01, RF-02…), Requisito (nome curto) e Descrição.
<h3>Requisitos Não Funcionais</h3> — tabela com colunas ID (RNF-01…), Requisito e Descrição.
<h3>Regras de Negócio</h3> — tabela com colunas ID (RN-01…), Descrição e Mensagem (a mensagem exibida pelo sistema, ou "-" se não houver).
<h3>Premissas e Pontos em Aberto</h3> — lista <ul> com as premissas que você assumiu e as dúvidas que continuam sem resposta. Omita a seção se não houver nenhuma.

Use tabelas simples (<table><thead><tr><th>…</th></tr></thead><tbody>…</tbody></table>) sem atributos de estilo — o sistema aplica a formatação. Descrições concisas (até 2 linhas). Não inclua cenários de teste, APIs ou histórico de revisões.`;

let provider: AiProvider | null = null;

/** Picks the provider from the environment (see .env.example) */
function getProvider(): AiProvider {
  if (provider) return provider;

  if (config.ai.provider === 'anthropic') {
    if (!config.ai.anthropicApiKey) {
      throw new HttpError(503, 'IA não configurada no servidor (ANTHROPIC_API_KEY ausente)');
    }
    provider = new AnthropicProvider(config.ai.anthropicApiKey, config.ai.anthropicModel);
  } else {
    if (!config.ai.geminiApiKey) {
      throw new HttpError(503, 'IA não configurada no servidor (GEMINI_API_KEY ausente)');
    }
    provider = new GeminiProvider(config.ai.geminiApiKey, config.ai.geminiModel, config.ai.geminiFallbackModel || undefined);
  }

  console.log(`🤖 AI provider: ${provider.label}`);
  return provider;
}

function imageParts(images: ScreenImage[]): AiPart[] {
  return images.map(image => ({ type: 'image', image }));
}

function describeProject(project: ProjectContext): string {
  const description = project.description?.trim() ? `\nDescrição do projeto: ${project.description.trim()}` : '';
  return `Projeto: "${project.name}"${description}`;
}

function describeKnownQuestions(questions: KnownQuestion[]): string {
  const scopeOf = (q: KnownQuestion) => (q.screenName ? `tela "${q.screenName}"` : 'projeto');

  const answered = questions
    .filter(q => q.status === 'answered' && q.answer?.trim())
    .map(q => `- [${scopeOf(q)}] ${q.question}\n  Resposta do time: ${q.answer!.trim()}`);

  const pending = questions
    .filter(q => q.status === 'open')
    .map(q => `- [${scopeOf(q)}] ${q.question}`);

  const dismissed = questions
    .filter(q => q.status === 'dismissed')
    .map(q => `- [${scopeOf(q)}] ${q.question}`);

  const parts: string[] = [];
  if (answered.length) parts.push(`Respostas já dadas pelo time (são decisões, siga-as):\n${answered.join('\n')}`);
  if (pending.length) parts.push(`Dúvidas já levantadas e ainda sem resposta (não pergunte de novo):\n${pending.join('\n')}`);
  if (dismissed.length) parts.push(`Dúvidas que o time marcou como "não se aplica" (ignore-as e não pergunte de novo):\n${dismissed.join('\n')}`);
  return parts.length ? parts.join('\n\n') : 'Ainda não há perguntas respondidas neste projeto.';
}

/**
 * Converts a requirements document to compact text (headings, table rows, list items).
 * Uses far fewer tokens than the HTML, which keeps free-tier quotas going further.
 */
function documentToText(html: string): string {
  const decode = (text: string) =>
    text
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');

  return decode(
    extractBody(html)
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, '\n## $1\n')
      .replace(/<\/t[hd]>\s*<t[hd][^>]*>/gi, ' | ')
      .replace(/<tr[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<\/p>|<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Turns the model output into a sanitized, standalone HTML document */
function toRequirementDocument(text: string): string {
  const fragment = extractBody(text.replace(/```(?:html)?/gi, '').trim())
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  if (!fragment) throw new HttpError(502, 'A IA retornou um documento vazio. Tente novamente.');
  return wrapRequirementDocument(fragment);
}

export const aiService = {
  /**
   * Step 1 for a new screen: the AI studies the prints and lists what it needs to know
   * before writing requirements that would otherwise be guesses.
   */
  raiseScreenQuestions(params: {
    project: ProjectContext;
    screenName: string;
    images: ScreenImage[];
    knownQuestions: KnownQuestion[];
  }): Promise<QuestionsResult> {
    return getProvider().generateJson({
      system: SYSTEM_PROMPT,
      effort: 'high',
      schema: QuestionsSchema,
      example: QUESTIONS_EXAMPLE,
      parts: [
        ...imageParts(params.images),
        {
          type: 'text',
          text: `${describeProject(params.project)}
Tela: "${params.screenName}" (${params.images.length} imagem(ns) acima, que podem mostrar partes ou estados diferentes da mesma tela).

${describeKnownQuestions(params.knownQuestions)}

Tarefa: antes de escrever os requisitos desta tela, levante as dúvidas cuja resposta mudaria o documento — regras de negócio implícitas, comportamentos não visíveis no print (erros, estados vazios, carregamento), permissões, validações, integrações e escopo.

Faça no máximo 7 perguntas, ordenadas da mais para a menos impactante. Pergunte só o que não dá para inferir com segurança das imagens ou das respostas acima, e nunca repita uma dúvida já listada. Se a tela for autoexplicativa, retorne poucas perguntas ou nenhuma.`,
        },
      ],
    });
  },

  /** Step 2: writes the requirements document using the prints and every answer given so far */
  async generateScreenRequirements(params: {
    project: ProjectContext;
    screenName: string;
    images: ScreenImage[];
    knownQuestions: KnownQuestion[];
  }): Promise<string> {
    const text = await getProvider().generateText({
      system: SYSTEM_PROMPT,
      effort: 'high',
      parts: [
        ...imageParts(params.images),
        {
          type: 'text',
          text: `${describeProject(params.project)}
Tela: "${params.screenName}" (${params.images.length} imagem(ns) acima, que podem mostrar partes ou estados diferentes da mesma tela).

${describeKnownQuestions(params.knownQuestions)}

Tarefa: escreva o documento de requisitos desta tela. As respostas do time têm prioridade sobre o que você inferir das imagens. Dúvidas sem resposta que afetem esta tela entram em "Premissas e Pontos em Aberto", junto com a premissa que você adotou.

${HTML_FORMAT_INSTRUCTIONS}`,
        },
      ],
    });
    return toRequirementDocument(text);
  },

  /** Updates an existing screen document after new answers, keeping what is still valid */
  async refineRequirement(params: {
    project: ProjectContext;
    screenName: string;
    currentDocument: string;
    knownQuestions: KnownQuestion[];
    instructions?: string;
  }): Promise<string> {
    const extra = params.instructions?.trim()
      ? `\nPedido adicional do usuário: ${params.instructions.trim()}\n`
      : '';

    const text = await getProvider().generateText({
      system: SYSTEM_PROMPT,
      effort: 'medium',
      parts: [
        {
          type: 'text',
          text: `${describeProject(params.project)}
Tela: "${params.screenName}"

Documento atual desta tela (tabelas no formato "coluna | coluna | coluna"):
<documento>
${documentToText(params.currentDocument)}
</documento>

${describeKnownQuestions(params.knownQuestions)}
${extra}
Tarefa: atualize o documento para refletir as respostas do time${extra ? ' e o pedido adicional' : ''}. Mantenha o que continua válido e os IDs existentes; acrescente novos itens com IDs sequenciais. Remova de "Premissas e Pontos em Aberto" o que já foi respondido.

${HTML_FORMAT_INSTRUCTIONS}`,
        },
      ],
    });
    return toRequirementDocument(text);
  },

  /**
   * Reviews every saved document of the project and raises project-wide questions:
   * gaps between screens, contradictions, missing flows and undefined profiles.
   */
  reviewProject(params: {
    project: ProjectContext;
    documents: { screenName: string; content: string }[];
    knownQuestions: KnownQuestion[];
  }): Promise<QuestionsResult> {
    const documents = params.documents
      .map(doc => `<tela nome="${doc.screenName}">\n${documentToText(doc.content)}\n</tela>`)
      .join('\n\n');

    return getProvider().generateJson({
      system: SYSTEM_PROMPT,
      effort: 'high',
      schema: QuestionsSchema,
      example: QUESTIONS_EXAMPLE,
      parts: [
        {
          type: 'text',
          text: `${describeProject(params.project)}

Documentos de requisitos já escritos para as telas do projeto:
${documents}

${describeKnownQuestions(params.knownQuestions)}

Tarefa: revise o projeto como um todo e levante as dúvidas mais importantes para fechar os requisitos — contradições entre telas, fluxos que levam a telas não documentadas, perfis de acesso indefinidos, regras repetidas com valores diferentes, requisitos não funcionais ausentes e decisões de escopo.

Faça no máximo 8 perguntas, ordenadas por impacto. Não repita dúvidas já listadas. Em "understanding", resuma em poucas frases o que o sistema faz segundo os documentos.`,
        },
      ],
    });
  },
};
