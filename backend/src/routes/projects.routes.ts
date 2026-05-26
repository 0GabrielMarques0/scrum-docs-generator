import { Router, Request, Response } from 'express';
import { db } from '../database/init.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { aiService } from '../services/ai.service.js';
import HTMLtoDOCX from 'html-to-docx';

const router = Router();

/**
 * GET /api/projects
 * List all projects
 */
router.get('/', async (req, res) => {
  try {
    const [projects] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM projects ORDER BY updated_at DESC'
    );
    
    res.json({ projects });
  } catch (error: any) {
    console.error('Error listing projects:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao listar projetos' });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/', async (req, res) => {
  try {
    const { name, figmaFileKey, figmaUrl, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'name é obrigatório' });
    }
    
    const id = `proj-${Date.now()}`;
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await db.execute(
      `INSERT INTO projects (id, name, figma_file_key, figma_url, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, figmaFileKey || null, figmaUrl || '', description || '', now, now]
    );
    
    res.status(201).json({
      id,
      name,
      figmaFileKey: figmaFileKey || null,
      figmaUrl,
      description,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('Error creating project:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao criar projeto' });
  }
});

/**
 * GET /api/projects/:id
 * Get project details with screens
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [projects] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    const project = projects[0];
    
    const [screens] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM project_screens WHERE project_id = ?',
      [id]
    );
    
    res.json({
      ...project,
      screens,
    });
  } catch (error: any) {
    console.error('Error getting project:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao obter projeto' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM projects WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting project:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao deletar projeto' });
  }
});

/**
 * GET /api/projects/:id/screens
 * Get uploaded screens for a project (moved to screens.routes.ts)
 * This route is deprecated - use /api/screens/:projectId instead
 */
router.get('/:id/screens', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [screens] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM project_screens WHERE project_id = ? ORDER BY screen_name',
      [id]
    );
    
    res.json({ screens });
  } catch (error: any) {
    console.error('Error getting screens:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao obter telas' });
  }
});

/**
 * GET /api/projects/:id/description
 * Get or generate AI description for a project
 */
router.get('/:id/description', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if description exists
    const [descriptions] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM project_descriptions WHERE project_id = ?',
      [id]
    );
    
    if (descriptions.length > 0) {
      return res.json({ description: descriptions[0].description });
    }
    
    // Get project
    const [projects] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    const project = projects[0];
    
    // Get screens from database
    const [screens] = await db.execute<RowDataPacket[]>(
      'SELECT screen_name FROM project_screens WHERE project_id = ?',
      [id]
    );
    
    // Generate description using AI
    const screenNames = screens.map((s: any) => s.screen_name).join(', ');
    const prompt = `Analise este projeto chamado "${project.name}" com as seguintes telas: ${screenNames || 'nenhuma tela cadastrada ainda'}. 
    Gere uma breve descrição (2-3 frases) explicando o propósito do aplicativo/sistema. 
    Seja objetivo e profissional.`;
    
    let description = project.description || `Projeto "${project.name}" com ${screens.length} telas disponíveis para documentação.`;
    
    if (screens.length > 0) {
      try {
        const aiResponse = await aiService.chat([
          { role: 'system', content: 'Você é um analista de sistemas que descreve projetos de forma concisa.' },
          { role: 'user', content: prompt }
        ]);
        description = aiResponse;
      } catch (err) {
        console.log('AI unavailable, using default description');
      }
    }
    
    // Save description
    const descId = `desc-${Date.now()}`;
    await db.execute(
      'INSERT INTO project_descriptions (id, project_id, description) VALUES (?, ?, ?)',
      [descId, id, description]
    );
    
    res.json({ description });
  } catch (error: any) {
    console.error('Error getting description:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao obter descrição' });
  }
});

/**
 * GET /api/projects/:id/requirements
 * List all saved requirements for a project
 */
router.get('/:id/requirements', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [requirements] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM project_requirements WHERE project_id = ? ORDER BY created_at DESC',
      [id]
    );
    
    res.json({ requirements });
  } catch (error: any) {
    console.error('Error listing requirements:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao listar requisitos' });
  }
});

/**
 * POST /api/projects/:id/requirements
 * Save a requirement document for a project
 */
router.post('/:id/requirements', async (req, res) => {
  try {
    const { id } = req.params;
    const { screenId, screenName, content } = req.body;
    
    if (!screenId || !screenName || !content) {
      return res.status(400).json({ error: 'screenId, screenName e content são obrigatórios' });
    }
    
    // Check if requirement exists for this screen
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM project_requirements WHERE project_id = ? AND screen_id = ?',
      [id, screenId]
    );
    
    if (existing.length > 0) {
      // Update existing
      await db.execute(
        'UPDATE project_requirements SET content = ?, screen_name = ? WHERE id = ?',
        [content, screenName, existing[0].id]
      );
      
      return res.json({ id: existing[0].id, updated: true });
    }
    
    // Create new
    const reqId = `req-${Date.now()}`;
    await db.execute(
      'INSERT INTO project_requirements (id, project_id, screen_id, screen_name, content) VALUES (?, ?, ?, ?, ?)',
      [reqId, id, screenId, screenName, content]
    );
    
    res.status(201).json({ id: reqId, created: true });
  } catch (error: any) {
    console.error('Error saving requirement:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao salvar requisito' });
  }
});

/**
 * PUT /api/projects/:projectId/requirements/:reqId
 * Update a requirement document
 */
router.put('/:projectId/requirements/:reqId', async (req, res) => {
  try {
    const { reqId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'content é obrigatório' });
    }
    
    const [result] = await db.execute<ResultSetHeader>(
      'UPDATE project_requirements SET content = ? WHERE id = ?',
      [content, reqId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Requisito não encontrado' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating requirement:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao atualizar requisito' });
  }
});

/**
 * DELETE /api/projects/:projectId/requirements/:reqId
 * Delete a requirement document
 */
router.delete('/:projectId/requirements/:reqId', async (req, res) => {
  try {
    const { reqId } = req.params;
    
    const [result] = await db.execute<ResultSetHeader>(
      'DELETE FROM project_requirements WHERE id = ?',
      [reqId]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Requisito não encontrado' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting requirement:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao deletar requisito' });
  }
});

/**
 * GET /api/projects/:id/export
 * Export combined document with all requirements
 * Query params: format=html|docx (default: html)
 */
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const format = (req.query.format as string) || 'html';
    
    // Get project info
    const [projects] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM projects WHERE id = ?',
      [id]
    );
    
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    const project = projects[0];
    
    // Get all saved requirements
    const [requirements] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM project_requirements WHERE project_id = ? ORDER BY created_at ASC',
      [id]
    );
    
    if (requirements.length === 0) {
      return res.status(400).json({ error: 'Nenhum requisito salvo para exportar' });
    }
    
    // Generate combined HTML document
    const html = generateCombinedDocument(project, requirements);
    
    if (format === 'docx') {
      // Convert to DOCX
      // Add specific styles for DOCX conversion
      const docxHtml = html.replace(/<style>[\s\S]*?<\/style>/i, `<style>
        body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
        h1 { font-size: 18pt; color: #1e3a5f; }
        h2 { font-size: 14pt; color: #1e3a5f; margin-top: 20pt; }
        h3 { font-size: 12pt; color: #2c5282; margin-top: 15pt; }
        table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
        th { background-color: #1e3a5f; color: white; padding: 8pt; text-align: left; border: 1pt solid #1e3a5f; }
        td { padding: 6pt 8pt; border: 1pt solid #e2e8f0; }
        tr:nth-child(even) { background-color: #f8fafc; }
        ul { margin: 5pt 0; padding-left: 20pt; }
        li { margin: 3pt 0; }
        p { margin: 5pt 0; }
      </style>`);
      const docxBuffer = await HTMLtoDOCX(docxHtml, null, {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
        margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      });
      
      const fileName = `documento-requisitos-${project.name.replace(/\s+/g, '-').toLowerCase()}.docx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(docxBuffer as ArrayBuffer));
    } else {
      res.json({ html, screenCount: requirements.length });
    }
  } catch (error: any) {
    console.error('Error exporting project:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao exportar projeto' });
  }
});

/**
 * Export single screen to DOCX
 */
router.post('/:id/export-single', async (req: Request, res: Response) => {
  try {
    const { html, screenName } = req.body;
    
    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }
    
    // Add specific styles for DOCX conversion
    const docxHtml = html.replace(/<style>[\s\S]*?<\/style>/i, `<style>
      body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; }
      h1 { font-size: 18pt; color: #1e3a5f; }
      h2 { font-size: 14pt; color: #1e3a5f; margin-top: 20pt; }
      h3 { font-size: 12pt; color: #2c5282; margin-top: 15pt; }
      table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
      th { background-color: #1e3a5f; color: white; padding: 8pt; text-align: left; border: 1pt solid #1e3a5f; }
      td { padding: 6pt 8pt; border: 1pt solid #e2e8f0; }
      tr:nth-child(even) { background-color: #f8fafc; }
      ul { margin: 5pt 0; padding-left: 20pt; }
      li { margin: 3pt 0; }
      p { margin: 5pt 0; }
    </style>`);
    
    const docxBuffer = await HTMLtoDOCX(docxHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    });
    
    const fileName = `requisitos-${(screenName || 'documento').replace(/\s+/g, '-').toLowerCase()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(Buffer.from(docxBuffer as ArrayBuffer));
  } catch (error: any) {
    console.error('Error exporting single screen:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao exportar documento' });
  }
});

/**
 * Convert markdown to basic HTML (for legacy content)
 */
function markdownToHTML(md: string): string {
  let html = md;
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Tables - convert markdown tables to HTML
  const tableRegex = /\|(.+)\|\n\|[-:|]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (match, header, rows) => {
    const headerCells = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
    const rowLines = rows.trim().split('\n').map((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('\n');
    return `<table><tr>${headerCells}</tr>${rowLines}</table>`;
  });
  
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Paragraphs (lines that aren't already wrapped)
  html = html.replace(/^(?!<[hultpd]|$)(.+)$/gm, '<p>$1</p>');
  
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');
  
  // Clean up extra newlines
  html = html.replace(/\n{3,}/g, '\n\n');
  
  return html;
}

/**
 * Check if content is markdown (not HTML)
 */
function isMarkdown(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith('#') || (trimmed.startsWith('|') && !trimmed.includes('<'));
}

/**
 * Generate combined HTML document from all requirements
 */
function generateCombinedDocument(project: any, requirements: any[]): string {
  const date = new Date().toLocaleDateString('pt-BR');
  const platformText = 'Plataforma Web';
  
  const styles = `
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #ffffff; max-width: 900px; margin: 0 auto; padding: 20px; }
      h1 { color: #1e3a5f; font-size: 32px; border-bottom: 3px solid #1e3a5f; padding-bottom: 10px; text-align: center; }
      h2 { color: #1e3a5f; font-size: 22px; margin-top: 40px; border-bottom: 1px solid #ddd; padding-bottom: 8px; page-break-before: auto; }
      h3 { color: #2c5282; font-size: 16px; margin-top: 20px; }
      p { margin: 10px 0; text-align: justify; color: #333; }
      ul { margin: 10px 0; padding-left: 25px; }
      li { margin: 5px 0; color: #333; }
      table { width: 100%; border-collapse: collapse; margin: 15px 0; border: 1px solid #e2e8f0; table-layout: fixed; }
      th { background-color: #1e3a5f; color: white; padding: 12px; text-align: left; font-weight: 600; border: 1px solid #1e3a5f; word-wrap: break-word; }
      td { padding: 10px 12px; border: 1px solid #e2e8f0; color: #333; word-wrap: break-word; overflow-wrap: break-word; }
      tr:nth-child(even) { background-color: #f8fafc; }
      .header-table { width: auto; margin: 20px auto; }
      .header-table td { border: 1px solid #e2e8f0; padding: 8px 20px; color: #333; }
      .header-table td:first-child { font-weight: bold; background-color: #f1f5f9; width: 100px; }
      hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
      .toc { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .toc h3 { margin-top: 0; color: #1e3a5f; }
      .toc > ul { list-style: none; padding-left: 0; }
      .toc li { padding: 5px 0; color: #333; }
      .toc > ul > li { border-bottom: 1px solid #e2e8f0; padding: 8px 0; }
      .toc ul ul { list-style: none; padding-left: 20px; margin-top: 5px; }
      .toc ul ul li { border-bottom: none; padding: 3px 0; font-size: 0.9em; }
      .toc a { color: #2c5282; text-decoration: none; }
      .toc a:hover { text-decoration: underline; }
      .page-break { page-break-before: always; }
      @media print { 
        body { padding: 0; }
        .page-break { page-break-before: always; }
      }
    </style>
  `;

  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Documento de Requisitos - ${project.name}</title>
  ${styles}
</head>
<body>
`;

  // === COVER PAGE ===
  html += `<h1>${project.name}</h1>\n`;
  html += `<h2 style="text-align: center; border: none;">Documento de Requisitos de Software</h2>\n`;
  html += `<table class="header-table">
    <tr><td>Versão</td><td>1.0</td></tr>
    <tr><td>Data</td><td>${date}</td></tr>
    <tr><td>Status</td><td>Em Andamento</td></tr>
    <tr><td>Projeto</td><td>${project.name} — ${platformText}</td></tr>
  </table>\n`;

  // === TABLE OF CONTENTS ===
  html += `<div class="toc">
    <h3>Sumário</h3>
    <ul>
      <li>
        <a href="#intro">1. Introdução</a>
        <ul>
          <li><a href="#intro-objetivo">1.1 Objetivo</a></li>
          <li><a href="#intro-escopo">1.2 Escopo</a></li>
          <li><a href="#intro-definicoes">1.3 Definições e Siglas</a></li>
        </ul>
      </li>
  `;
  
  requirements.forEach((req, index) => {
    const sectionNum = index + 2;
    html += `<li>
        <a href="#screen-${sectionNum}">${sectionNum}. ${req.screen_name}</a>
        <ul>
          <li><a href="#screen-${sectionNum}-desc">${sectionNum}.1 Descrição Geral</a></li>
          <li><a href="#screen-${sectionNum}-rf">${sectionNum}.2 Requisitos Funcionais</a></li>
          <li><a href="#screen-${sectionNum}-rnf">${sectionNum}.3 Requisitos Não Funcionais</a></li>
          <li><a href="#screen-${sectionNum}-rn">${sectionNum}.4 Regras de Negócio</a></li>
        </ul>
      </li>\n`;
  });
  
  html += `</ul>
  </div>\n`;

  html += `<hr>\n`;

  // === 1. INTRODUCTION ===
  html += `<h2 id="intro">1. Introdução</h2>\n`;
  html += `<p>Este documento descreve os requisitos funcionais e não funcionais, regras, campos e usuários para a plataforma web do projeto ${project.name}.</p>\n`;

  html += `<h3 id="intro-objetivo">1.1 Objetivo</h3>\n`;
  html += `<p>Especificar o comportamento esperado, restrições e critérios de aceitação das funcionalidades da plataforma web, servindo como referência para o time de desenvolvimento, QA e stakeholders.</p>\n`;

  html += `<h3 id="intro-escopo">1.2 Escopo</h3>\n`;
  html += `<p>O escopo deste documento abrange:</p>\n`;
  html += `<ul>\n`;
  requirements.forEach(req => {
    html += `<li>${req.screen_name}</li>\n`;
  });
  html += `</ul>\n`;

  html += `<h3 id="intro-definicoes">1.3 Definições e Siglas</h3>\n`;
  html += `<table>
    <tr><th>Termo</th><th>Definição</th></tr>
    <tr><td>RF</td><td>Requisito Funcional</td></tr>
    <tr><td>RNF</td><td>Requisito Não Funcional</td></tr>
    <tr><td>UI</td><td>Interface de Usuário (User Interface)</td></tr>
    <tr><td>UX</td><td>Experiência do Usuário (User Experience)</td></tr>
    <tr><td>2FA</td><td>Autenticação de Dois Fatores</td></tr>
    <tr><td>JWT</td><td>JSON Web Token — padrão para tokens de sessão</td></tr>
    <tr><td>HTTPS</td><td>Protocolo seguro de transferência de dados</td></tr>
  </table>\n`;

  // === SCREEN SECTIONS ===
  requirements.forEach((req, index) => {
    const sectionNum = index + 2;
    html += `<div class="page-break"></div>\n`;
    html += `<h2 id="screen-${sectionNum}">${sectionNum}. ${req.screen_name}</h2>\n`;
    
    let content = req.content;
    
    // Check if content is markdown and convert to HTML
    if (isMarkdown(content)) {
      content = markdownToHTML(content);
    }
    
    // Extract content from saved HTML (remove doctype, html, head, body tags)
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1];
    }
    // Remove the h1 and h2 headers from individual docs (we have our own structure)
    content = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
    content = content.replace(/<h2[^>]*>Documento de Requisitos[\s\S]*?<\/h2>/gi, '');
    content = content.replace(/<table class="header-table">[\s\S]*?<\/table>/gi, '');
    content = content.replace(/<hr>/gi, '');
    // Remove unwanted sections and re-number
    content = content.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, ''); // Remove h1
    content = content.replace(/<h2[^>]*>Documento de Requisitos[\s\S]*?<\/h2>/gi, ''); // Remove doc title
    content = content.replace(/<h2[^>]*>1\. Introdução[\s\S]*?(?=<h2|<hr|$)/gi, ''); // Remove intro section
    content = content.replace(/<h2[^>]*>3\. Regras de Negócio[\s\S]*?(?=<h2|<hr|$)/gi, ''); // Remove old business rules section from template
    content = content.replace(/<h2[^>]*>4\. Histórico[\s\S]*?(?=<h2|$)/gi, ''); // Remove history
    // Re-number sections: 2.x -> sectionNum.x and add IDs for TOC navigation
    content = content.replace(/<h2[^>]*>2\. ([^<]+)<\/h2>/gi, `<h3 id="screen-${sectionNum}-desc">${sectionNum}.1 $1</h3>`);
    content = content.replace(/<h3>2\.1/g, `<h3 id="screen-${sectionNum}-desc">${sectionNum}.1`);
    content = content.replace(/<h3>2\.2/g, `<h3 id="screen-${sectionNum}-rf">${sectionNum}.2`);
    content = content.replace(/<h3>2\.3/g, `<h3 id="screen-${sectionNum}-rnf">${sectionNum}.3`);
    content = content.replace(/<h3>2\.4/g, `<h3>${sectionNum}.4`);
    
    // Also handle sections without numbering (AI might generate "Descrição Geral" instead of "2.1 Descrição Geral")
    content = content.replace(/<h3[^>]*>Descrição Geral<\/h3>/gi, `<h3 id="screen-${sectionNum}-desc">${sectionNum}.1 Descrição Geral</h3>`);
    content = content.replace(/<h3[^>]*>Requisitos Funcionais<\/h3>/gi, `<h3 id="screen-${sectionNum}-rf">${sectionNum}.2 Requisitos Funcionais</h3>`);
    content = content.replace(/<h3[^>]*>Requisitos Não Funcionais<\/h3>/gi, `<h3 id="screen-${sectionNum}-rnf">${sectionNum}.3 Requisitos Não Funcionais</h3>`);
    content = content.replace(/<h3[^>]*>Regras de Negócio<\/h3>/gi, `<h3 id="screen-${sectionNum}-rn">${sectionNum}.4 Regras de Negócio</h3>`);
    
    // Handle "Tela de X" as section title if present
    content = content.replace(/<h2[^>]*>Tela de ([^<]+)<\/h2>/gi, `<h3 id="screen-${sectionNum}-desc">${sectionNum}.1 Descrição da Tela</h3><p><strong>Tela de $1</strong></p>`);
    
    // Clean up extra hr tags
    content = content.replace(/<hr>\s*<hr>/gi, '<hr>');
    content = content.replace(/^\s*<hr>/i, '');
    
    html += content;
  });

  html += `</body></html>`;

  return html;
}

export const projectsRoutes = router;
