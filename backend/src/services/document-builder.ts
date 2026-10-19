import { escapeHtml } from '../utils/validation.js';
import { extractBody } from './document.service.js';

export const DOCUMENT_STYLES = `
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #ffffff; max-width: 900px; margin: 0 auto; padding: 20px; }
  h1 { color: #1e3a5f; font-size: 30px; border-bottom: 3px solid #1e3a5f; padding-bottom: 10px; }
  h2 { color: #1e3a5f; font-size: 22px; margin-top: 36px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
  h3 { color: #2c5282; font-size: 16px; margin-top: 20px; }
  p { margin: 10px 0; color: #333; }
  ul { margin: 10px 0; padding-left: 25px; }
  li { margin: 5px 0; color: #333; }
  table { width: 100%; border-collapse: collapse; margin: 15px 0; border: 1px solid #e2e8f0; table-layout: fixed; }
  th { background-color: #1e3a5f; color: white; padding: 12px; text-align: left; font-weight: 600; border: 1px solid #1e3a5f; word-wrap: break-word; }
  td { padding: 10px 12px; border: 1px solid #e2e8f0; color: #333; word-wrap: break-word; overflow-wrap: break-word; vertical-align: top; }
  tr:nth-child(even) { background-color: #f8fafc; }
  hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
  .header-table { width: auto; margin: 20px auto; table-layout: auto; }
  .header-table td:first-child { font-weight: bold; background-color: #f1f5f9; }
  .toc { background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; }
  .toc ul { list-style: none; padding-left: 0; }
  .toc ul ul { padding-left: 20px; font-size: 0.9em; }
  .toc a { color: #2c5282; text-decoration: none; }
  .page-break { page-break-before: always; }
`;

/** Wraps a body fragment in the standard standalone document used for a single screen */
export function wrapRequirementDocument(bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><style>${DOCUMENT_STYLES}</style></head><body>${bodyHtml}</body></html>`;
}

/** Converts legacy markdown documents to basic HTML */
function markdownToHTML(md: string): string {
  let html = escapeHtml(md);

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const tableRegex = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (_match, header: string, rows: string) => {
    const toCells = (line: string, tag: 'th' | 'td') =>
      line.split('|').filter(c => c.trim()).map(c => `<${tag}>${c.trim()}</${tag}>`).join('');
    const body = rows.trim().split('\n').map(row => `<tr>${toCells(row, 'td')}</tr>`).join('');
    return `<table><tr>${toCells(header, 'th')}</tr>${body}</table>`;
  });

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>');
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^(?!<[hultpd]|$)(.+)$/gm, '<p>$1</p>');

  return html;
}

function isMarkdown(content: string): boolean {
  const trimmed = content.trim();
  return !trimmed.startsWith('<') && (trimmed.startsWith('#') || trimmed.startsWith('|'));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Removes leading numbering like "2.1 " or "3. " from a heading */
function stripNumbering(text: string): string {
  return text.replace(/^\s*\d+(\.\d+)*\.?\s+/, '');
}

// Sections of old single-screen templates that don't belong in the combined document
const LEGACY_SECTIONS = /^(introdução|histórico)/i;

interface Subsection {
  id: string;
  title: string;
}

/**
 * Normalizes one saved screen document into a numbered section of the combined document:
 * drops document-level titles (h1 / "Tela de X") and renumbers every subsection as N.k.
 */
function buildScreenSection(content: string, sectionNum: number): { html: string; subsections: Subsection[] } {
  let body = extractBody(isMarkdown(content) ? markdownToHTML(content) : content);

  body = body
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '')
    .replace(/<table class="header-table">[\s\S]*?<\/table>/gi, '')
    .replace(/<hr\s*\/?>/gi, '');

  // Split into [before, heading, content, heading, content...]
  const parts = body.split(/(<h[23][^>]*>[\s\S]*?<\/h[23]>)/i);
  const subsections: Subsection[] = [];
  let html = parts[0];
  let k = 0;

  for (let i = 1; i < parts.length; i += 2) {
    const title = stripNumbering(stripTags(parts[i]));
    const sectionContent = parts[i + 1] ?? '';

    // "Tela de X" is the screen title, already rendered as the section heading
    if (/^tela( de)?\b/i.test(title)) {
      html += sectionContent;
      continue;
    }
    // Legacy wrapper headings ("2. Descrição") and empty sections add nothing to the TOC
    if (LEGACY_SECTIONS.test(title) || !stripTags(sectionContent)) continue;

    k += 1;
    const id = `screen-${sectionNum}-${k}`;
    subsections.push({ id, title });
    html += `<h3 id="${id}">${sectionNum}.${k} ${escapeHtml(title)}</h3>${sectionContent}`;
  }

  return { html, subsections };
}

/** Generates the combined requirements document with cover, table of contents and one section per screen */
export function generateCombinedDocument(
  project: { name: string; description?: string | null },
  requirements: { screen_name: string; content: string }[]
): string {
  const projectName = escapeHtml(project.name);
  const date = new Date().toLocaleDateString('pt-BR');
  const sections = requirements.map((req, index) => ({
    screenName: escapeHtml(req.screen_name),
    sectionNum: index + 2,
    ...buildScreenSection(req.content, index + 2),
  }));

  const toc = sections.map(s => `
      <li><a href="#screen-${s.sectionNum}">${s.sectionNum}. ${s.screenName}</a>
        <ul>${s.subsections.map((sub, k) => `<li><a href="#${sub.id}">${s.sectionNum}.${k + 1} ${escapeHtml(sub.title)}</a></li>`).join('')}</ul>
      </li>`).join('');

  const scope = sections.map(s => `<li>${s.screenName}</li>`).join('');
  const description = project.description
    ? `<p>${escapeHtml(project.description)}</p>`
    : '';

  const screens = sections.map(s => `
    <div class="page-break"></div>
    <h2 id="screen-${s.sectionNum}">${s.sectionNum}. ${s.screenName}</h2>
    ${s.html}`).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Documento de Requisitos - ${projectName}</title>
  <style>${DOCUMENT_STYLES}</style>
</head>
<body>
  <h1 style="text-align: center;">${projectName}</h1>
  <h2 style="text-align: center; border: none;">Documento de Requisitos de Software</h2>
  <table class="header-table">
    <tr><td>Versão</td><td>1.0</td></tr>
    <tr><td>Data</td><td>${date}</td></tr>
    <tr><td>Status</td><td>Em Andamento</td></tr>
    <tr><td>Telas</td><td>${sections.length}</td></tr>
  </table>

  <div class="toc">
    <h3>Sumário</h3>
    <ul>
      <li><a href="#intro">1. Introdução</a>
        <ul>
          <li><a href="#intro-objetivo">1.1 Objetivo</a></li>
          <li><a href="#intro-escopo">1.2 Escopo</a></li>
          <li><a href="#intro-definicoes">1.3 Definições e Siglas</a></li>
        </ul>
      </li>
      ${toc}
    </ul>
  </div>

  <h2 id="intro">1. Introdução</h2>
  <p>Este documento descreve os requisitos funcionais, não funcionais e as regras de negócio do projeto ${projectName}.</p>
  ${description}
  <h3 id="intro-objetivo">1.1 Objetivo</h3>
  <p>Especificar o comportamento esperado, restrições e critérios de aceitação das funcionalidades, servindo como referência para o time de desenvolvimento, QA e stakeholders.</p>
  <h3 id="intro-escopo">1.2 Escopo</h3>
  <p>O escopo deste documento abrange as seguintes telas:</p>
  <ul>${scope}</ul>
  <h3 id="intro-definicoes">1.3 Definições e Siglas</h3>
  <table>
    <tr><th>Termo</th><th>Definição</th></tr>
    <tr><td>RF</td><td>Requisito Funcional</td></tr>
    <tr><td>RNF</td><td>Requisito Não Funcional</td></tr>
    <tr><td>RN</td><td>Regra de Negócio</td></tr>
    <tr><td>UI</td><td>Interface de Usuário (User Interface)</td></tr>
    <tr><td>UX</td><td>Experiência do Usuário (User Experience)</td></tr>
  </table>
  ${screens}
</body>
</html>`;
}
