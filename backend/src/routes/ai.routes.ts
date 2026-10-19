import { Request, Router } from 'express';
import crypto from 'crypto';
import { ResultSetHeader } from 'mysql2';
import { db } from '../database/init.js';
import { getProject, loadOwnedProject } from '../middleware/auth.js';
import { aiLimiter } from '../middleware/rateLimits.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import {
  aiService,
  KnownQuestion,
  QUESTION_CATEGORIES,
  QuestionsResult,
  ScreenImage,
  SUPPORTED_IMAGE_TYPES,
} from '../services/ai.service.js';
import { QuestionRow, QuestionStatus, RequirementRow } from '../types/index.js';
import { requireString } from '../utils/validation.js';
import { config } from '../config.js';

// Mounted at /api/projects/:projectId/ai
const router = Router({ mergeParams: true });
router.use(loadOwnedProject);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_ANSWER_LENGTH = 4000;
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/;

function parseImages(value: unknown): ScreenImage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, 'Envie pelo menos uma imagem');
  }
  if (value.length > config.maxImagesPerScreen) {
    throw new HttpError(400, `Envie no máximo ${config.maxImagesPerScreen} imagens por tela`);
  }

  return value.map((image, index) => {
    const base64 = typeof image?.base64 === 'string' ? image.base64.replace(/\s/g, '') : '';
    const mimeType = image?.mimeType === 'image/jpg' ? 'image/jpeg' : image?.mimeType;

    if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
      throw new HttpError(400, `Imagem ${index + 1}: formato não suportado. Use PNG, JPG, GIF ou WebP.`);
    }
    if (!base64 || !BASE64_REGEX.test(base64)) {
      throw new HttpError(400, `Imagem ${index + 1}: conteúdo inválido`);
    }
    if (Math.floor((base64.length * 3) / 4) > MAX_IMAGE_BYTES) {
      throw new HttpError(400, `Imagem ${index + 1}: tamanho máximo de 5 MB`);
    }
    return { base64, mimeType };
  });
}

function serializeQuestion(row: QuestionRow) {
  let options: string[] = [];
  try {
    options = row.options ? JSON.parse(row.options) : [];
  } catch {
    options = [];
  }
  return {
    id: row.id,
    screenName: row.screen_name,
    question: row.question,
    reason: row.reason,
    category: row.category,
    options,
    answer: row.answer,
    status: row.status,
    createdAt: row.created_at,
    answeredAt: row.answered_at,
  };
}

async function listQuestions(projectId: string): Promise<QuestionRow[]> {
  const [rows] = await db.execute<QuestionRow[]>(
    'SELECT * FROM project_questions WHERE project_id = ? ORDER BY created_at ASC, id ASC',
    [projectId]
  );
  return rows;
}

/** Questions relevant to a screen: project-wide ones plus the ones raised for that screen */
async function knownQuestionsFor(projectId: string, screenName?: string): Promise<KnownQuestion[]> {
  const rows = await listQuestions(projectId);
  return rows
    .filter(row => !screenName || row.screen_name === null || row.screen_name === screenName)
    .map(row => ({
      screenName: row.screen_name,
      question: row.question,
      answer: row.answer,
      status: row.status,
    }));
}

function normalizeCategory(category: string): string {
  const normalized = category.trim().toLowerCase();
  return (QUESTION_CATEGORIES as readonly string[]).includes(normalized) ? normalized : 'escopo';
}

async function saveQuestions(projectId: string, screenName: string | null, result: QuestionsResult) {
  for (const q of result.questions) {
    await db.execute(
      `INSERT INTO project_questions (id, project_id, screen_name, question, reason, category, options, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`,
      [
        `q-${crypto.randomUUID()}`,
        projectId,
        screenName,
        q.question,
        q.reason,
        normalizeCategory(q.category),
        JSON.stringify(q.options.slice(0, 6)),
      ]
    );
  }
}

async function updateQuestion(projectId: string, questionId: string, answer: string | null, status: QuestionStatus) {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE project_questions
     SET answer = ?, status = ?, answered_at = ${status === 'answered' ? 'NOW()' : 'NULL'}
     WHERE id = ? AND project_id = ?`,
    [answer, status, questionId, projectId]
  );
  return result.affectedRows > 0;
}

/** Applies `[{ id, answer }]` sent together with a generation request */
async function applyAnswers(req: Request) {
  const answers = req.body?.answers;
  if (answers === undefined) return;
  if (!Array.isArray(answers)) throw new HttpError(400, 'answers deve ser uma lista');

  for (const item of answers) {
    if (typeof item?.id !== 'string' || typeof item?.answer !== 'string') continue;
    const answer = item.answer.trim().slice(0, MAX_ANSWER_LENGTH);
    if (answer) await updateQuestion(getProject(req).id, item.id, answer, 'answered');
  }
}

async function questionsResponse(projectId: string, understanding: string, screenName: string | null) {
  const rows = await listQuestions(projectId);
  return {
    understanding,
    questions: rows
      .filter(row => row.screen_name === screenName && row.status === 'open')
      .map(serializeQuestion),
  };
}

/**
 * GET /api/projects/:projectId/ai/config
 * Limits the UI must respect for the configured AI provider
 */
router.get('/config', (_req, res) => {
  res.json({ provider: config.ai.provider, maxImagesPerScreen: config.maxImagesPerScreen });
});

/**
 * GET /api/projects/:projectId/ai/questions
 * All clarifying questions of the project (open, answered and dismissed)
 */
router.get('/questions', asyncHandler(async (req, res) => {
  const rows = await listQuestions(getProject(req).id);
  res.json({ questions: rows.map(serializeQuestion) });
}));

/**
 * POST /api/projects/:projectId/ai/questions/screen
 * The AI analyzes the prints of a new screen and raises the questions it needs answered
 */
router.post('/questions/screen', aiLimiter, asyncHandler(async (req, res) => {
  const project = getProject(req);
  const screenName = requireString(req.body?.screenName, 'Nome da tela', 255);
  const images = parseImages(req.body?.images);

  const result = await aiService.raiseScreenQuestions({
    project,
    screenName,
    images,
    knownQuestions: await knownQuestionsFor(project.id, screenName),
  });

  await saveQuestions(project.id, screenName, result);
  res.json(await questionsResponse(project.id, result.understanding, screenName));
}));

/**
 * POST /api/projects/:projectId/ai/questions/review
 * The AI reviews every saved document and raises project-wide questions
 */
router.post('/questions/review', aiLimiter, asyncHandler(async (req, res) => {
  const project = getProject(req);
  const [documents] = await db.execute<RequirementRow[]>(
    'SELECT screen_name, content FROM project_requirements WHERE project_id = ? ORDER BY created_at ASC',
    [project.id]
  );
  if (documents.length === 0) {
    throw new HttpError(400, 'Salve pelo menos uma tela antes de pedir a revisão do projeto');
  }

  const result = await aiService.reviewProject({
    project,
    documents: documents.map(doc => ({ screenName: doc.screen_name, content: doc.content })),
    knownQuestions: await knownQuestionsFor(project.id),
  });

  await saveQuestions(project.id, null, result);
  res.json(await questionsResponse(project.id, result.understanding, null));
}));

/**
 * PATCH /api/projects/:projectId/ai/questions/:questionId
 * Answer, dismiss or reopen a question. Body: { answer?: string, status?: 'open' | 'dismissed' }
 */
router.patch('/questions/:questionId', asyncHandler(async (req, res) => {
  const { answer, status } = req.body ?? {};
  let nextAnswer: string | null = null;
  let nextStatus: QuestionStatus;

  if (typeof answer === 'string' && answer.trim()) {
    nextAnswer = answer.trim().slice(0, MAX_ANSWER_LENGTH);
    nextStatus = 'answered';
  } else if (status === 'dismissed' || status === 'open') {
    nextStatus = status;
  } else {
    throw new HttpError(400, 'Informe uma resposta ou um status válido');
  }

  const updated = await updateQuestion(getProject(req).id, req.params.questionId, nextAnswer, nextStatus);
  if (!updated) throw new HttpError(404, 'Pergunta não encontrada');

  res.json({ success: true });
}));

router.delete('/questions/:questionId', asyncHandler(async (req, res) => {
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM project_questions WHERE id = ? AND project_id = ?',
    [req.params.questionId, getProject(req).id]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Pergunta não encontrada');
  res.json({ success: true });
}));

/**
 * POST /api/projects/:projectId/ai/generate
 * Generates the requirements document of a screen. Body: { screenName, images, answers?: [{ id, answer }] }
 * Images are only sent to the AI provider, never stored.
 */
router.post('/generate', aiLimiter, asyncHandler(async (req, res) => {
  const project = getProject(req);
  const screenName = requireString(req.body?.screenName, 'Nome da tela', 255);
  const images = parseImages(req.body?.images);
  await applyAnswers(req);

  const requirements = await aiService.generateScreenRequirements({
    project,
    screenName,
    images,
    knownQuestions: await knownQuestionsFor(project.id, screenName),
  });

  res.json({ screenName, requirements });
}));

/**
 * POST /api/projects/:projectId/ai/refine
 * Rewrites a saved document using the answers given since it was generated.
 * Body: { requirementId, instructions? }. The result is returned for review, not saved.
 */
router.post('/refine', aiLimiter, asyncHandler(async (req, res) => {
  const project = getProject(req);
  const requirementId = requireString(req.body?.requirementId, 'requirementId', 255);
  const instructions = typeof req.body?.instructions === 'string'
    ? req.body.instructions.slice(0, MAX_ANSWER_LENGTH)
    : undefined;

  const [rows] = await db.execute<RequirementRow[]>(
    'SELECT * FROM project_requirements WHERE id = ? AND project_id = ?',
    [requirementId, project.id]
  );
  if (rows.length === 0) throw new HttpError(404, 'Requisito não encontrado');

  const requirements = await aiService.refineRequirement({
    project,
    screenName: rows[0].screen_name,
    currentDocument: rows[0].content,
    knownQuestions: await knownQuestionsFor(project.id, rows[0].screen_name),
    instructions,
  });

  res.json({ screenName: rows[0].screen_name, requirements });
}));

export const aiRoutes = router;
