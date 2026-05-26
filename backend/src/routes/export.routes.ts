import { Router } from 'express';
import PDFDocument from 'pdfkit';
import { db } from '../database/init.js';
import { RowDataPacket } from 'mysql2';

const router = Router();

// Colors
const COLORS = {
  primary: '#0284c7',
  secondary: '#64748b',
  success: '#16a34a',
  warning: '#ea580c',
  danger: '#dc2626',
  dark: '#1e293b',
  light: '#f1f5f9',
  white: '#ffffff',
};

// Helper functions
function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  // Header background
  doc.rect(0, 0, doc.page.width, 120).fill(COLORS.primary);
  
  // Title
  doc.fillColor(COLORS.white)
    .fontSize(28)
    .font('Helvetica-Bold')
    .text(title, 50, 40, { width: doc.page.width - 100 });
  
  if (subtitle) {
    doc.fontSize(14)
      .font('Helvetica')
      .text(subtitle, 50, 80, { width: doc.page.width - 100 });
  }
  
  doc.fillColor(COLORS.dark);
  doc.y = 140;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, icon?: string) {
  doc.moveDown(0.5);
  
  // Section background
  const y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 30).fill(COLORS.light);
  
  doc.fillColor(COLORS.primary)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(icon ? `${icon}  ${title}` : title, 60, y + 8);
  
  doc.fillColor(COLORS.dark).font('Helvetica');
  doc.y = y + 40;
}

function drawInfoBox(doc: PDFKit.PDFDocument, items: { label: string; value: string }[]) {
  const startY = doc.y;
  const boxWidth = (doc.page.width - 120) / 2;
  
  items.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 50 + col * (boxWidth + 20);
    const y = startY + row * 45;
    
    // Box
    doc.rect(x, y, boxWidth, 40).fill(COLORS.light);
    
    // Label
    doc.fillColor(COLORS.secondary)
      .fontSize(9)
      .font('Helvetica')
      .text(item.label.toUpperCase(), x + 10, y + 8);
    
    // Value
    doc.fillColor(COLORS.dark)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(item.value, x + 10, y + 22, { width: boxWidth - 20 });
  });
  
  doc.fillColor(COLORS.dark).font('Helvetica');
  doc.y = startY + Math.ceil(items.length / 2) * 50;
}

function groupComponentsByType(components: any[]) {
  const groups: { [key: string]: any[] } = {
    'Imagens': [],
    'Textos': [],
    'Botões': [],
    'Inputs': [],
    'Outros': [],
  };
  
  components.forEach(comp => {
    const type = comp.type?.toLowerCase() || '';
    if (type.includes('image') || type.includes('imagem')) {
      groups['Imagens'].push(comp);
    } else if (type.includes('button') || type.includes('btn') || comp.name?.toLowerCase().includes('enviar')) {
      groups['Botões'].push(comp);
    } else if (type.includes('input') || type.includes('field') || type.includes('textarea')) {
      groups['Inputs'].push(comp);
    } else if (type.includes('text') || type === 'text') {
      groups['Textos'].push(comp);
    } else {
      groups['Outros'].push(comp);
    }
  });
  
  return groups;
}

function getTypeIcon(type: string): string {
  // Using text symbols instead of emojis (PDFKit doesn't support emojis)
  const icons: { [key: string]: string } = {
    'Imagens': '[IMG]',
    'Textos': '[TXT]',
    'Botões': '[BTN]',
    'Inputs': '[INP]',
    'Outros': '[...]',
  };
  return icons[type] || '*';
}

function getTypeColor(type: string): string {
  const colors: { [key: string]: string } = {
    'Imagens': '#8b5cf6',
    'Textos': '#0284c7',
    'Botões': '#16a34a',
    'Inputs': '#ea580c',
    'Outros': '#64748b',
  };
  return colors[type] || COLORS.secondary;
}

/**
 * GET /api/export/pdf/:id
 * Export requirements as PDF
 */
router.get('/pdf/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM requirements WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Requisitos não encontrados' });
    }
    
    const row = rows[0];
    const requirements = JSON.parse(row.json_data);
    
    // Create PDF
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      bufferPages: true,
    });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${requirements.screenName}-requisitos.pdf"`);
    
    doc.pipe(res);
    
    // ===== PAGE 1: Cover & Info =====
    drawHeader(doc, `Requisitos da Tela`, requirements.screenName);
    
    // Info boxes
    drawInfoBox(doc, [
      { label: 'Plataforma', value: requirements.platform === 'mobile' ? 'App Mobile' : 'Portal Web' },
      { label: 'Data de Geração', value: new Date(requirements.generatedAt).toLocaleDateString('pt-BR') },
      { label: 'Total de Componentes', value: `${requirements.components.length} componentes` },
      { label: 'Cenários de Teste', value: `${requirements.testScenarios?.length || 0} cenários` },
    ]);
    
    // Figma Link
    doc.moveDown();
    doc.fontSize(10)
      .fillColor(COLORS.secondary)
      .text('Link do Figma:', 50)
      .fillColor(COLORS.primary)
      .text(requirements.figmaUrl || 'N/A', { link: requirements.figmaUrl });
    doc.fillColor(COLORS.dark);
    
    // ===== COMPONENTS SECTION =====
    drawSectionTitle(doc, 'Componentes da Tela');
    
    const groups = groupComponentsByType(requirements.components);
    
    Object.entries(groups).forEach(([groupName, components]) => {
      if (components.length === 0) return;
      
      // Check if we need a new page
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
        doc.y = 50;
      }
      
      // Group header
      const groupY = doc.y;
      const groupColor = getTypeColor(groupName);
      
      doc.rect(50, groupY, 4, 25).fill(groupColor);
      doc.fillColor(COLORS.dark)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`${getTypeIcon(groupName)} ${groupName} (${components.length})`, 60, groupY + 5);
      doc.font('Helvetica');
      doc.y = groupY + 35;
      
      // Components list
      components.forEach((comp: any, idx: number) => {
        if (doc.y > doc.page.height - 60) {
          doc.addPage();
          doc.y = 50;
        }
        
        const itemY = doc.y;
        
        // Alternating background
        if (idx % 2 === 0) {
          doc.rect(50, itemY - 2, doc.page.width - 100, 20).fill('#f8fafc');
        }
        
        // Number badge
        doc.rect(55, itemY, 20, 16).fillAndStroke(groupColor, groupColor);
        doc.fillColor(COLORS.white)
          .fontSize(8)
          .text(String(idx + 1), 55, itemY + 4, { width: 20, align: 'center' });
        
        // Component name
        doc.fillColor(COLORS.dark)
          .fontSize(10)
          .text(comp.name || 'Sem nome', 85, itemY + 3, { width: 350 });
        
        // Type badge
        doc.fillColor(COLORS.secondary)
          .fontSize(8)
          .text(comp.type || '-', 440, itemY + 4);
        
        doc.y = itemY + 22;
      });
      
      doc.moveDown(0.5);
    });
    
    // ===== VALIDATION RULES =====
    if (requirements.validationRules && requirements.validationRules.length > 0) {
      doc.addPage();
      drawHeader(doc, 'Regras de Validação', `${requirements.validationRules.length} regras definidas`);
      
      requirements.validationRules.forEach((rule: any, idx: number) => {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          doc.y = 50;
        }
        
        const ruleY = doc.y;
        doc.rect(50, ruleY, doc.page.width - 100, 50).fill(COLORS.light);
        
        doc.fillColor(COLORS.primary)
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`${idx + 1}. ${rule.field}`, 60, ruleY + 8);
        
        doc.fillColor(COLORS.dark)
          .fontSize(10)
          .font('Helvetica')
          .text(`Regra: ${rule.rule}`, 60, ruleY + 22);
        
        doc.fillColor(COLORS.warning)
          .text(`! ${rule.errorMessage}`, 60, ruleY + 36);
        
        doc.y = ruleY + 60;
      });
    }
    
    // ===== SCREEN STATES =====
    doc.addPage();
    drawHeader(doc, 'Estados da Tela', 'Comportamentos esperados em cada estado');
    
    const stateColors: { [key: string]: string } = {
      'Inicial': COLORS.primary,
      'Carregando': COLORS.warning,
      'Sucesso': COLORS.success,
      'Erro': COLORS.danger,
    };
    
    requirements.screenStates?.forEach((state: any) => {
      if (doc.y > doc.page.height - 100) {
        doc.addPage();
        doc.y = 50;
      }
      
      const stateY = doc.y;
      const stateColor = stateColors[state.name] || COLORS.secondary;
      
      // State card
      doc.rect(50, stateY, doc.page.width - 100, 80).fill(COLORS.light);
      doc.rect(50, stateY, 5, 80).fill(stateColor);
      
      // State name
      doc.fillColor(stateColor)
        .fontSize(14)
        .font('Helvetica-Bold')
        .text(state.name, 65, stateY + 10);
      
      // Description
      doc.fillColor(COLORS.secondary)
        .fontSize(10)
        .font('Helvetica')
        .text(state.description, 65, stateY + 28);
      
      // Checks
      doc.fillColor(COLORS.dark).fontSize(9);
      let checkY = stateY + 45;
      state.checks?.forEach((check: string) => {
        doc.text(`> ${check}`, 70, checkY);
        checkY += 12;
      });
      
      doc.y = stateY + 90;
    });
    
    // ===== TEST SCENARIOS =====
    doc.addPage();
    drawHeader(doc, 'Cenários de Teste', `${requirements.testScenarios?.length || 0} cenários de validação`);
    
    requirements.testScenarios?.forEach((test: any, idx: number) => {
      if (doc.y > doc.page.height - 120) {
        doc.addPage();
        doc.y = 50;
      }
      
      const testY = doc.y;
      
      // Test card
      doc.rect(50, testY, doc.page.width - 100, 90).fill(COLORS.light);
      
      // Number circle
      doc.circle(70, testY + 20, 15).fill(COLORS.primary);
      doc.fillColor(COLORS.white)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(String(idx + 1), 62, testY + 14);
      
      // Scenario name
      doc.fillColor(COLORS.dark)
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(test.scenario, 95, testY + 12);
      
      // Steps
      doc.fillColor(COLORS.secondary)
        .fontSize(9)
        .font('Helvetica')
        .text('PASSOS', 95, testY + 35);
      doc.fillColor(COLORS.dark)
        .fontSize(10)
        .text(test.steps, 95, testY + 48, { width: doc.page.width - 160 });
      
      // Expected result
      doc.fillColor(COLORS.success)
        .fontSize(9)
        .text(`=> Resultado: ${test.expectedResult}`, 95, testY + 70);
      
      doc.y = testY + 100;
    });
    
    // ===== FOOTER on all pages =====
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Footer line
      doc.moveTo(50, doc.page.height - 50)
        .lineTo(doc.page.width - 50, doc.page.height - 50)
        .stroke(COLORS.light);
      
      // Page number
      doc.fillColor(COLORS.secondary)
        .fontSize(9)
        .text(
          `Página ${i + 1} de ${pages.count}`,
          50,
          doc.page.height - 40,
          { align: 'center', width: doc.page.width - 100 }
        );
      
      // Generated info
      doc.text(
        `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`,
        50,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - 100 }
      );
    }
    
    doc.end();
  } catch (error: any) {
    console.error('Error exporting PDF:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao exportar PDF' });
  }
});

/**
 * GET /api/export/markdown/:id
 * Export requirements as Markdown file
 */
router.get('/markdown/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM requirements WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Requisitos não encontrados' });
    }
    
    const row = rows[0];
    
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${row.screen_name}-requisitos.md"`);
    res.send(row.markdown);
  } catch (error: any) {
    console.error('Error exporting Markdown:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao exportar Markdown' });
  }
});

export const exportRoutes = router;
