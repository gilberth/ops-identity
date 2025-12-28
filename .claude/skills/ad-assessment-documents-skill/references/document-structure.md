# Document Structure Reference

Complete templates for each section of the AD Assessment document.

## Full Document Skeleton

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        Header, Footer, AlignmentType, PageBreak, HeadingLevel, BorderStyle, 
        WidthType, ShadingType, LevelFormat, ExternalHyperlink, PageNumber } = require('docx');
const fs = require('fs');

// ============================================================================
// CONFIGURATION
// ============================================================================

const COLORS = {
  navy: '1E3A5F',
  gray900: '111827',
  gray700: '374151',
  gray600: '4B5563',
  gray500: '6B7280',
  gray100: 'F3F4F6',
  critical: { fill: 'FEE2E2', text: '991B1B' },
  high: { fill: 'FEF3C7', text: '92400E' },
  medium: { fill: 'FEF9C3', text: '854D0E' },
  low: { fill: 'DBEAFE', text: '1E40AF' },
  success: { fill: 'D1FAE5', text: '065F46' },
  headerBg: 'E8F4FD',
  tableBorder: 'D1D5DB'
};

const FONTS = {
  primary: 'Arial',
  code: 'Consolas'
};

// Standard border for all tables
const TABLE_BORDER = { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder };
const CELL_BORDERS = { top: TABLE_BORDER, bottom: TABLE_BORDER, left: TABLE_BORDER, right: TABLE_BORDER };

// ============================================================================
// STYLES CONFIGURATION
// ============================================================================

const documentStyles = {
  default: {
    document: {
      run: { font: FONTS.primary, size: 22 }  // 11pt default
    }
  },
  paragraphStyles: [
    {
      id: 'Title',
      name: 'Title',
      basedOn: 'Normal',
      run: { size: 56, bold: true, color: COLORS.navy, font: FONTS.primary },
      paragraph: { spacing: { before: 240, after: 240 }, alignment: AlignmentType.CENTER }
    },
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { size: 36, bold: true, color: COLORS.navy, font: FONTS.primary },
      paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 }
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { size: 28, bold: true, color: COLORS.gray700, font: FONTS.primary },
      paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 }
    },
    {
      id: 'Heading3',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: { size: 24, bold: true, color: COLORS.gray600, font: FONTS.primary },
      paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 }
    },
    {
      id: 'CodeBlock',
      name: 'Code Block',
      basedOn: 'Normal',
      run: { size: 20, font: FONTS.code, color: COLORS.gray900 },
      paragraph: { 
        spacing: { before: 120, after: 120 },
        shading: { fill: COLORS.gray100, type: ShadingType.CLEAR }
      }
    }
  ]
};

// ============================================================================
// NUMBERING CONFIGURATION (for lists)
// ============================================================================

const numberingConfig = {
  config: [
    {
      reference: 'bullet-findings',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    },
    {
      reference: 'numbered-steps',
      levels: [{
        level: 0,
        format: LevelFormat.DECIMAL,
        text: '%1.',
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
      }]
    }
  ]
};

// ============================================================================
// SECTION 1: COVER PAGE
// ============================================================================

function createCoverPage(data) {
  const { domainName, assessmentDate, clientName } = data;
  
  return [
    // Spacer
    new Paragraph({ spacing: { before: 2400 } }),
    
    // Main title
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ 
        text: 'Active Directory', 
        bold: true, 
        size: 72, 
        color: COLORS.navy,
        font: FONTS.primary
      })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ 
        text: 'Reporte de Estado y Configuración', 
        size: 36, 
        color: COLORS.gray600,
        font: FONTS.primary
      })]
    }),
    
    // Domain name (prominent)
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 600 },
      children: [new TextRun({ 
        text: domainName || 'domain.local', 
        bold: true, 
        size: 48, 
        color: COLORS.navy,
        font: FONTS.primary
      })]
    }),
    
    // Info table
    createCoverInfoTable(assessmentDate, clientName),
    
    // Spacer
    new Paragraph({ spacing: { before: 1200 } }),
    
    // Confidential notice
    new Paragraph({
      alignment: AlignmentType.CENTER,
      shading: { fill: 'FEF3C7', type: ShadingType.CLEAR },
      children: [new TextRun({ 
        text: '🔒 CONFIDENCIAL', 
        bold: true, 
        size: 24, 
        color: COLORS.high.text
      })]
    }),
    
    // Page break
    new Paragraph({ children: [new PageBreak()] })
  ];
}

function createCoverInfoTable(date, client) {
  return new Table({
    alignment: AlignmentType.CENTER,
    columnWidths: [3000, 4000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
            width: { size: 3000, type: WidthType.DXA },
            children: [new Paragraph({
              children: [new TextRun({ text: '📅 Fecha de Evaluación', bold: true, size: 22 })]
            })]
          }),
          new TableCell({
            borders: CELL_BORDERS,
            width: { size: 4000, type: WidthType.DXA },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: formatDate(date), size: 22 })]
            })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
            width: { size: 3000, type: WidthType.DXA },
            children: [new Paragraph({
              children: [new TextRun({ text: '📊 Estado de Salud', bold: true, size: 22 })]
            })]
          }),
          new TableCell({
            borders: CELL_BORDERS,
            width: { size: 4000, type: WidthType.DXA },
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [new TextRun({ text: '${HEALTH_SCORE}/100', bold: true, size: 28, color: '${SCORE_COLOR}' })]
            })]
          })
        ]
      })
    ]
  });
}

// ============================================================================
// SECTION 2: EXECUTIVE SUMMARY
// ============================================================================

function createExecutiveSummary(data) {
  const { healthScore, findings, domainName } = data;
  
  return [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('📋 Resumen Ejecutivo')] }),
    
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({ 
        text: `Este reporte detalla los hallazgos de la evaluación de salud y configuración de ${domainName || 'el dominio'}.`,
        size: 22
      })]
    }),
    
    // Health Score Box
    createHealthScoreBox(healthScore),
    
    // Results Summary Table
    new Paragraph({ 
      heading: HeadingLevel.HEADING_2, 
      children: [new TextRun('📊 Resultados de la Evaluación')] 
    }),
    
    createResultsSummaryTable(findings),
    
    // Risk Scorecard
    new Paragraph({ 
      heading: HeadingLevel.HEADING_2, 
      children: [new TextRun('Tarjeta de Puntuación de Riesgo')] 
    }),
    
    createRiskScorecard(data.categories),
    
    new Paragraph({ children: [new PageBreak()] })
  ];
}

function createHealthScoreBox(score) {
  const safeScore = typeof score === 'number' ? score : 0;
  const scoreColor = safeScore >= 80 ? COLORS.success.text : 
                     safeScore >= 60 ? COLORS.medium.text : 
                     safeScore >= 40 ? COLORS.high.text : COLORS.critical.text;
  const status = safeScore >= 80 ? 'Saludable' : 
                 safeScore >= 60 ? 'Aceptable' : 
                 safeScore >= 40 ? 'Requiere Atención' : 'Crítico';
  
  return new Table({
    alignment: AlignmentType.CENTER,
    columnWidths: [6000],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            shading: { fill: COLORS.gray100, type: ShadingType.CLEAR },
            width: { size: 6000, type: WidthType.DXA },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200 },
                children: [new TextRun({ text: 'Puntuación de Salud del Dominio', bold: true, size: 24 })]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 200, after: 100 },
                children: [new TextRun({ text: String(safeScore), bold: true, size: 96, color: scoreColor })]
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [new TextRun({ text: status, bold: true, size: 24, color: scoreColor })]
              })
            ]
          })
        ]
      })
    ]
  });
}

function createResultsSummaryTable(findings) {
  const counts = {
    critical: findings.filter(f => f.severity === 'CRITICAL').length,
    high: findings.filter(f => f.severity === 'HIGH').length,
    medium: findings.filter(f => f.severity === 'MEDIUM').length,
    low: findings.filter(f => f.severity === 'LOW').length
  };
  
  return new Table({
    columnWidths: [5000, 2000],
    rows: [
      createSummaryHeaderRow(),
      createSummaryDataRow('Pruebas de Configuración Ejecutadas', String(findings.length), null),
      createSummaryDataRow('🔴 Configuraciones Críticas', String(counts.critical), COLORS.critical),
      createSummaryDataRow('🟠 Desviaciones de Alta Prioridad', String(counts.high), COLORS.high),
      createSummaryDataRow('🟡 Desviaciones de Media Prioridad', String(counts.medium), COLORS.medium),
      createSummaryDataRow('🔵 Sugerencias de Optimización', String(counts.low), COLORS.low)
    ]
  });
}

function createSummaryHeaderRow() {
  return new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        borders: CELL_BORDERS,
        shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
        width: { size: 5000, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text: 'Métrica', bold: true, size: 22 })]
        })]
      }),
      new TableCell({
        borders: CELL_BORDERS,
        shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
        width: { size: 2000, type: WidthType.DXA },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Cantidad', bold: true, size: 22 })]
        })]
      })
    ]
  });
}

function createSummaryDataRow(label, value, colorSet) {
  const fillColor = colorSet ? colorSet.fill : 'FFFFFF';
  const textColor = colorSet ? colorSet.text : COLORS.gray900;
  
  return new TableRow({
    children: [
      new TableCell({
        borders: CELL_BORDERS,
        width: { size: 5000, type: WidthType.DXA },
        children: [new Paragraph({
          children: [new TextRun({ text: label, size: 22, color: textColor })]
        })]
      }),
      new TableCell({
        borders: CELL_BORDERS,
        shading: colorSet ? { fill: fillColor, type: ShadingType.CLEAR } : undefined,
        width: { size: 2000, type: WidthType.DXA },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: value, bold: true, size: 22, color: textColor })]
        })]
      })
    ]
  });
}

// ============================================================================
// SECTION 3: FINDING CARD TEMPLATE
// ============================================================================

function createFindingCard(finding, index) {
  const severity = finding.severity || 'MEDIUM';
  const colorSet = COLORS[severity.toLowerCase()] || COLORS.medium;
  
  const children = [
    // Finding title with number
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      shading: { fill: colorSet.fill, type: ShadingType.CLEAR },
      spacing: { before: 300 },
      children: [new TextRun({ 
        text: `${index}. ${sanitizeValue(finding.title)}`, 
        bold: true, 
        color: colorSet.text 
      })]
    }),
    
    // Metadata table
    createFindingMetadataTable(finding),
    
    // Description
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({ text: 'Descripción: ', bold: true, size: 22 }),
        new TextRun({ text: sanitizeValue(finding.description), size: 22 })
      ]
    }),
    
    // Business Impact
    new Paragraph({
      spacing: { before: 120 },
      children: [
        new TextRun({ text: '💼 Impacto en el Negocio: ', bold: true, size: 22 }),
        new TextRun({ text: sanitizeValue(finding.businessImpact || 'Ver descripción'), size: 22 })
      ]
    }),
    
    // Recommendation
    new Paragraph({
      spacing: { before: 120 },
      children: [
        new TextRun({ text: 'Recomendación: ', bold: true, size: 22 }),
        new TextRun({ text: sanitizeValue(finding.recommendation), size: 22 })
      ]
    })
  ];
  
  // PowerShell commands (if any)
  if (finding.powershellCommands) {
    children.push(
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: '⚡ Comandos PowerShell:', bold: true, size: 22 })]
      }),
      createCodeBlockParagraph(finding.powershellCommands)
    );
  }
  
  // Documentation link
  if (finding.documentationUrl) {
    children.push(
      new Paragraph({
        spacing: { before: 120 },
        children: [
          new TextRun({ text: '📚 Documentación: ', bold: true, size: 22 }),
          new ExternalHyperlink({
            children: [new TextRun({ text: finding.documentationUrl, color: '2563EB', underline: {} })],
            link: finding.documentationUrl
          })
        ]
      })
    );
  }
  
  return children;
}

function createFindingMetadataTable(finding) {
  const rows = [];
  
  // Row 1: MITRE + CIS
  rows.push(new TableRow({
    children: [
      createMetadataCell('🎯 MITRE ATT&CK', sanitizeValue(finding.mitreAttack)),
      createMetadataCell('📋 CIS Control', sanitizeValue(finding.cisControl))
    ]
  }));
  
  // Row 2: Timeline + Affected
  rows.push(new TableRow({
    children: [
      createMetadataCell('⏱️ Timeline', sanitizeValue(finding.timeline)),
      createMetadataCell('📊 Afectados', sanitizeValue(finding.affectedCount))
    ]
  }));
  
  return new Table({
    columnWidths: [4500, 4500],
    rows: rows
  });
}

function createMetadataCell(label, value) {
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: 4500, type: WidthType.DXA },
    children: [new Paragraph({
      children: [
        new TextRun({ text: label + ': ', bold: true, size: 20 }),
        new TextRun({ text: value, size: 20 })
      ]
    })]
  });
}

function createCodeBlockParagraph(code) {
  // Clean up escaped characters
  const cleanCode = String(code || '')
    .replace(/\\\$/g, '$')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"');
  
  return new Paragraph({
    shading: { fill: COLORS.gray100, type: ShadingType.CLEAR },
    spacing: { before: 80, after: 80 },
    indent: { left: 360, right: 360 },
    children: [new TextRun({
      text: cleanCode,
      font: FONTS.code,
      size: 18,
      color: COLORS.gray900
    })]
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sanitizeValue(value) {
  if (value === undefined || value === null) return 'N/A';
  if (value === '') return 'N/A';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.join(', ') || 'N/A';
    return JSON.stringify(value);
  }
  const str = String(value);
  if (str === 'undefined' || str === '[object Object]') return 'N/A';
  if (str.includes('undefined ms')) return str.replace('undefined ms', 'N/A');
  return str;
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toLocaleDateString('es-ES', { 
    day: 'numeric', month: 'long', year: 'numeric' 
  });
  try {
    return new Date(dateStr).toLocaleDateString('es-ES', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}

// ============================================================================
// MAIN DOCUMENT BUILDER
// ============================================================================

async function generateAssessmentDocument(assessmentData) {
  const sections = [];
  
  // Cover page
  sections.push(...createCoverPage(assessmentData));
  
  // Executive summary
  sections.push(...createExecutiveSummary(assessmentData));
  
  // Environment overview (implement similar pattern)
  // ...
  
  // Findings by severity
  const findingsBySeverity = {
    CRITICAL: assessmentData.findings.filter(f => f.severity === 'CRITICAL'),
    HIGH: assessmentData.findings.filter(f => f.severity === 'HIGH'),
    MEDIUM: assessmentData.findings.filter(f => f.severity === 'MEDIUM'),
    LOW: assessmentData.findings.filter(f => f.severity === 'LOW')
  };
  
  let findingIndex = 1;
  for (const [severity, findings] of Object.entries(findingsBySeverity)) {
    if (findings.length > 0) {
      const sectionTitle = {
        CRITICAL: '🔴 Configuraciones Críticas',
        HIGH: '🟠 Desviaciones Importantes',
        MEDIUM: '🟡 Desviaciones de Media Prioridad',
        LOW: '🔵 Sugerencias de Optimización'
      }[severity];
      
      sections.push(new Paragraph({ 
        heading: HeadingLevel.HEADING_1, 
        children: [new TextRun(sectionTitle)] 
      }));
      
      for (const finding of findings) {
        sections.push(...createFindingCard(finding, findingIndex++));
      }
    }
  }
  
  // Build document
  const doc = new Document({
    styles: documentStyles,
    numbering: numberingConfig,
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ 
              text: `AD Assessment - ${assessmentData.domainName || 'Domain'}`, 
              size: 18, 
              color: COLORS.gray500 
            })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Página ', size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
              new TextRun({ text: ' de ', size: 18 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
              new TextRun({ text: ' | CONFIDENCIAL', size: 18, color: COLORS.gray500 })
            ]
          })]
        })
      },
      children: sections
    }]
  });
  
  return Packer.toBuffer(doc);
}

module.exports = { generateAssessmentDocument };
```

## Section Templates Quick Reference

| Section | Key Function | Purpose |
|---------|--------------|---------|
| Cover | `createCoverPage()` | Brand identity, date, score |
| Executive | `createExecutiveSummary()` | Quick overview for leadership |
| Finding | `createFindingCard()` | Individual issue presentation |
| Code | `createCodeBlockParagraph()` | PowerShell commands |
| Table | Various `create*Table()` | Data presentation |
