import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType, HeadingLevel, ShadingType } from 'docx';
import puppeteer from 'puppeteer';

// Colors
const COLORS = {
  primary: '1e3a5f',
  border: 'e2e8f0',
  headerBg: '1e3a5f',
  altRow: 'f8fafc',
};

/**
 * Decode HTML entities to their corresponding characters
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    // Portuguese accents
    '&aacute;': 'á', '&Aacute;': 'Á',
    '&agrave;': 'à', '&Agrave;': 'À',
    '&atilde;': 'ã', '&Atilde;': 'Ã',
    '&acirc;': 'â', '&Acirc;': 'Â',
    '&eacute;': 'é', '&Eacute;': 'É',
    '&egrave;': 'è', '&Egrave;': 'È',
    '&ecirc;': 'ê', '&Ecirc;': 'Ê',
    '&iacute;': 'í', '&Iacute;': 'Í',
    '&igrave;': 'ì', '&Igrave;': 'Ì',
    '&icirc;': 'î', '&Icirc;': 'Î',
    '&oacute;': 'ó', '&Oacute;': 'Ó',
    '&ograve;': 'ò', '&Ograve;': 'Ò',
    '&otilde;': 'õ', '&Otilde;': 'Õ',
    '&ocirc;': 'ô', '&Ocirc;': 'Ô',
    '&uacute;': 'ú', '&Uacute;': 'Ú',
    '&ugrave;': 'ù', '&Ugrave;': 'Ù',
    '&ucirc;': 'û', '&Ucirc;': 'Û',
    '&ccedil;': 'ç', '&Ccedil;': 'Ç',
    '&ntilde;': 'ñ', '&Ntilde;': 'Ñ',
    // Other common entities
    '&ndash;': '–', '&mdash;': '—',
    '&lsquo;': '\u2018', '&rsquo;': '\u2019',
    '&ldquo;': '\u201C', '&rdquo;': '\u201D',
    '&bull;': '•', '&hellip;': '…',
    '&copy;': '©', '&reg;': '®', '&trade;': '™',
  };
  
  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities (&#123; or &#x1F;)
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  
  return result;
}

/**
 * Parse simple HTML and extract text content
 */
function stripHtml(html: string): string {
  const text = html.replace(/<[^>]*>/g, '').trim();
  return decodeHtmlEntities(text);
}

/**
 * Parse HTML table and return rows data
 */
function parseHtmlTable(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  
  for (const rowHtml of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowHtml.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
    
    for (const cellHtml of cellMatches) {
      const content = cellHtml.replace(/<t[hd][^>]*>/i, '').replace(/<\/t[hd]>/i, '');
      cells.push(stripHtml(content));
    }
    
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  
  return rows;
}

/**
 * Create a table for DOCX from parsed data
 */
function createDocxTable(data: string[][], hasHeader: boolean = true): Table {
  const tableRows: TableRow[] = [];
  
  data.forEach((row, rowIndex) => {
    const isHeader = hasHeader && rowIndex === 0;
    const isAltRow = !isHeader && rowIndex % 2 === 1;
    
    const cells = row.map(cellText => {
      return new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: cellText,
                bold: isHeader,
                color: isHeader ? 'FFFFFF' : '333333',
                size: isHeader ? 22 : 20,
              }),
            ],
          }),
        ],
        shading: isHeader 
          ? { fill: COLORS.headerBg, type: ShadingType.CLEAR }
          : isAltRow 
            ? { fill: COLORS.altRow, type: ShadingType.CLEAR }
            : undefined,
        margins: { top: 100, bottom: 100, left: 100, right: 100 },
      });
    });
    
    tableRows.push(new TableRow({ children: cells }));
  });
  
  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Convert HTML content to DOCX buffer
 */
export async function htmlToDocx(html: string, title: string): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];
  
  // Add title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 36, color: COLORS.primary })],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 400 },
    })
  );
  
  // Extract and process sections from HTML
  const sections = html.split(/<h[123][^>]*>/i);
  
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    
    // Extract heading text
    const headingMatch = section.match(/^([^<]+)<\/h[123]>/i);
    if (headingMatch) {
      const headingText = decodeHtmlEntities(headingMatch[1].trim());
      children.push(
        new Paragraph({
          children: [new TextRun({ text: headingText, bold: true, size: 28, color: COLORS.primary })],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 },
        })
      );
    }
    
    // Extract and process tables
    const tableMatches = section.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
    for (const tableHtml of tableMatches) {
      const tableData = parseHtmlTable(tableHtml);
      if (tableData.length > 0) {
        children.push(createDocxTable(tableData));
        children.push(new Paragraph({ spacing: { after: 200 } }));
      }
    }
    
    // Extract paragraphs (text outside tables)
    const withoutTables = section.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, '');
    const paragraphs = withoutTables.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
    
    for (const pHtml of paragraphs) {
      const text = stripHtml(pHtml);
      if (text) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text, size: 22 })],
            spacing: { after: 100 },
          })
        );
      }
    }
    
    // Extract list items (without bullets, with hierarchy indentation)
    const listItems = withoutTables.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    for (const liHtml of listItems) {
      const text = stripHtml(liHtml);
      if (text) {
        // Check if it's a sub-item (has format like "1.1" or "2.3")
        const isSubItem = /^\d+\.\d+/.test(text);
        
        children.push(
          new Paragraph({
            children: [new TextRun({ text, size: 22 })],
            spacing: { after: 50 },
            indent: { left: isSubItem ? 720 : 360 },
          })
        );
      }
    }
  }
  
  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });
  
  return await Packer.toBuffer(doc);
}

/**
 * Convert HTML content to PDF buffer using Puppeteer
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  // Decode HTML entities in the content
  const decodedHtml = decodeHtmlEntities(html);
  
  // Wrap HTML in proper document structure with styles
  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 2cm; }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      font-size: 11pt; 
      line-height: 1.6; 
      color: #333;
      background: white;
    }
    h1 { 
      color: #1e3a5f; 
      font-size: 24pt; 
      border-bottom: 3px solid #1e3a5f; 
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 { 
      color: #1e3a5f; 
      font-size: 16pt; 
      margin-top: 30px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 5px;
    }
    h3 { 
      color: #2c5282; 
      font-size: 13pt; 
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 15px 0; 
      page-break-inside: avoid;
    }
    th { 
      background-color: #1e3a5f !important; 
      color: white !important; 
      padding: 12px 10px; 
      text-align: left; 
      font-weight: bold;
      border: 1px solid #1e3a5f;
    }
    td { 
      padding: 10px; 
      border: 1px solid #e2e8f0; 
    }
    tr:nth-child(even) { 
      background-color: #f8fafc; 
    }
    ul, ol { 
      margin: 10px 0; 
      padding-left: 25px; 
    }
    li { 
      margin: 5px 0; 
    }
    p { 
      margin: 8px 0; 
    }
    .header { 
      background: linear-gradient(135deg, #1e3a5f, #2c5282);
      color: white;
      padding: 20px;
      margin: -2cm -2cm 20px -2cm;
      text-align: center;
    }
    .header h1 {
      color: white;
      border: none;
      margin: 0;
    }
  </style>
</head>
<body>
${decodedHtml}
</body>
</html>`;

  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '2cm', right: '2cm', bottom: '2cm', left: '2cm' },
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
