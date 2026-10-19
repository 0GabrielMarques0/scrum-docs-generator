import { Router, Response } from 'express';
import crypto from 'crypto';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../database/init.js';
import { getProject, getUserId, loadOwnedProject } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { htmlToDocx, htmlToPdf } from '../services/document.service.js';
import { generateCombinedDocument } from '../services/document-builder.js';
import { RequirementRow } from '../types/index.js';
import { requireString, toFileName } from '../utils/validation.js';

const router = Router();

const MAX_DOCUMENT_LENGTH = 2_000_000;
const MAX_DESCRIPTION_LENGTH = 2000;

type ExportFormat = 'html' | 'docx' | 'pdf';

function parseFormat(value: unknown, fallback: ExportFormat): ExportFormat {
  if (value === undefined) return fallback;
  if (value === 'html' || value === 'docx' || value === 'pdf') return value;
  throw new HttpError(400, 'Formato inválido. Use html, docx ou pdf.');
}

function optionalDescription(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Descrição inválida');
  if (value.length > MAX_DESCRIPTION_LENGTH) {
    throw new HttpError(400, `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres`);
  }
  return value.trim();
}

async function touchProject(projectId: string) {
  await db.execute('UPDATE projects SET updated_at = NOW() WHERE id = ?', [projectId]);
}

async function sendDocument(res: Response, html: string, format: ExportFormat, title: string) {
  const fileName = toFileName(title);

  if (format === 'docx') {
    const buffer = await htmlToDocx(html, title);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.docx"`);
    return res.send(buffer);
  }

  if (format === 'pdf') {
    const buffer = await htmlToPdf(html, title);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.pdf"`);
    return res.send(buffer);
  }

  res.json({ html });
}

/**
 * GET /api/projects
 * List all projects for the authenticated user
 */
router.get('/', asyncHandler(async (req, res) => {
  const [projects] = await db.execute<RowDataPacket[]>(
    `SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
       (SELECT COUNT(*) FROM project_requirements r WHERE r.project_id = p.id) AS screen_count,
       (SELECT COUNT(*) FROM project_questions q WHERE q.project_id = p.id AND q.status = 'open') AS open_questions
     FROM projects p
     WHERE p.user_id = ?
     ORDER BY p.updated_at DESC`,
    [getUserId(req)]
  );

  res.json({ projects });
}));

/**
 * POST /api/projects
 * Create a new project for the authenticated user
 */
router.post('/', asyncHandler(async (req, res) => {
  const name = requireString(req.body?.name, 'Nome', 255);
  const description = optionalDescription(req.body?.description);
  const id = `proj-${crypto.randomUUID()}`;

  await db.execute(
    `INSERT INTO projects (id, user_id, name, description, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [id, getUserId(req), name, description]
  );

  res.status(201).json({ id, name, description });
}));

router.get('/:id', loadOwnedProject, asyncHandler(async (req, res) => {
  const { id, name, description, created_at, updated_at } = getProject(req);
  res.json({ id, name, description, created_at, updated_at });
}));

/**
 * PATCH /api/projects/:id
 * Update name and/or description (the description is sent to the AI as project context)
 */
router.patch('/:id', loadOwnedProject, asyncHandler(async (req, res) => {
  const project = getProject(req);
  const name = req.body?.name !== undefined ? requireString(req.body.name, 'Nome', 255) : project.name;
  const description = req.body?.description !== undefined
    ? optionalDescription(req.body.description)
    : project.description;

  await db.execute(
    'UPDATE projects SET name = ?, description = ?, updated_at = NOW() WHERE id = ?',
    [name, description, project.id]
  );

  res.json({ id: project.id, name, description });
}));

router.delete('/:id', loadOwnedProject, asyncHandler(async (req, res) => {
  await db.execute('DELETE FROM projects WHERE id = ?', [getProject(req).id]);
  res.json({ success: true });
}));

/**
 * GET /api/projects/:id/requirements
 * List all saved requirements for a project
 */
router.get('/:id/requirements', loadOwnedProject, asyncHandler(async (req, res) => {
  const [requirements] = await db.execute<RequirementRow[]>(
    'SELECT * FROM project_requirements WHERE project_id = ? ORDER BY created_at ASC',
    [getProject(req).id]
  );

  res.json({ requirements });
}));

/**
 * POST /api/projects/:id/requirements
 * Create or update (by screenId) the requirement document of a screen
 */
router.post('/:id/requirements', loadOwnedProject, asyncHandler(async (req, res) => {
  const projectId = getProject(req).id;
  const screenId = requireString(req.body?.screenId, 'screenId', 255);
  const screenName = requireString(req.body?.screenName, 'Nome da tela', 255);
  const content = requireString(req.body?.content, 'Conteúdo', MAX_DOCUMENT_LENGTH);

  const [existing] = await db.execute<RowDataPacket[]>(
    'SELECT id FROM project_requirements WHERE project_id = ? AND screen_id = ?',
    [projectId, screenId]
  );

  if (existing.length > 0) {
    await db.execute(
      'UPDATE project_requirements SET content = ?, screen_name = ? WHERE id = ? AND project_id = ?',
      [content, screenName, existing[0].id, projectId]
    );
    await touchProject(projectId);
    return res.json({ id: existing[0].id, updated: true });
  }

  const reqId = `req-${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO project_requirements (id, project_id, screen_id, screen_name, content) VALUES (?, ?, ?, ?, ?)',
    [reqId, projectId, screenId, screenName, content]
  );
  await touchProject(projectId);

  res.status(201).json({ id: reqId, created: true });
}));

router.put('/:id/requirements/:reqId', loadOwnedProject, asyncHandler(async (req, res) => {
  const projectId = getProject(req).id;
  const content = requireString(req.body?.content, 'Conteúdo', MAX_DOCUMENT_LENGTH);

  const [result] = await db.execute<ResultSetHeader>(
    'UPDATE project_requirements SET content = ? WHERE id = ? AND project_id = ?',
    [content, req.params.reqId, projectId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Requisito não encontrado');

  await touchProject(projectId);
  res.json({ success: true });
}));

router.delete('/:id/requirements/:reqId', loadOwnedProject, asyncHandler(async (req, res) => {
  const [result] = await db.execute<ResultSetHeader>(
    'DELETE FROM project_requirements WHERE id = ? AND project_id = ?',
    [req.params.reqId, getProject(req).id]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Requisito não encontrado');

  res.json({ success: true });
}));

/**
 * GET /api/projects/:id/export?format=html|docx|pdf
 * Export the combined document with all saved requirements
 */
router.get('/:id/export', loadOwnedProject, asyncHandler(async (req, res) => {
  const project = getProject(req);
  const format = parseFormat(req.query.format, 'html');

  const [requirements] = await db.execute<RequirementRow[]>(
    'SELECT screen_name, content FROM project_requirements WHERE project_id = ? ORDER BY created_at ASC',
    [project.id]
  );
  if (requirements.length === 0) throw new HttpError(400, 'Nenhum requisito salvo para exportar');

  const html = generateCombinedDocument(project, requirements);
  await sendDocument(res, html, format, `Requisitos - ${project.name}`);
}));

/**
 * POST /api/projects/:id/export-single
 * Export the document currently open in the editor (may contain unsaved edits)
 */
router.post('/:id/export-single', loadOwnedProject, asyncHandler(async (req, res) => {
  const html = requireString(req.body?.html, 'Conteúdo', MAX_DOCUMENT_LENGTH);
  const screenName = typeof req.body?.screenName === 'string' ? req.body.screenName.slice(0, 255) : 'Documento';
  const format = parseFormat(req.body?.format, 'docx');

  await sendDocument(res, html, format, `Requisitos - ${screenName}`);
}));

export const projectsRoutes = router;
