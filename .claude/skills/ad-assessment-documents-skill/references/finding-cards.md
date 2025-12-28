# Finding Cards Reference

Templates for presenting individual security findings in a professional, consistent format.

## Complete Finding Card Implementation

```javascript
const { Paragraph, TextRun, Table, TableRow, TableCell, 
        BorderStyle, WidthType, ShadingType, AlignmentType, 
        ExternalHyperlink } = require('docx');

// Color configuration
const SEVERITY_STYLES = {
  CRITICAL: { fill: 'FEE2E2', text: '991B1B', border: 'FCA5A5', label: 'CRÍTICO', emoji: '🔴' },
  HIGH: { fill: 'FEF3C7', text: '92400E', border: 'FCD34D', label: 'ALTO', emoji: '🟠' },
  MEDIUM: { fill: 'FEF9C3', text: '854D0E', border: 'FDE047', label: 'MEDIO', emoji: '🟡' },
  LOW: { fill: 'DBEAFE', text: '1E40AF', border: '93C5FD', label: 'BAJO', emoji: '🔵' }
};

const FONTS = { primary: 'Arial', code: 'Consolas' };
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function createFindingCard(finding, index) {
  const severity = (finding.severity || 'MEDIUM').toUpperCase();
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.MEDIUM;
  const children = [];
  
  // 1. Title with severity background
  children.push(createFindingTitle(finding, index, style));
  
  // 2. Metadata table
  children.push(createMetadataTable(finding));
  
  // 3. Description
  children.push(createLabeledParagraph('Descripción', finding.description));
  
  // 4. Business Impact
  if (finding.businessImpact) {
    children.push(createLabeledParagraph('💼 Impacto en el Negocio', finding.businessImpact, style.text));
  }
  
  // 5. Current vs Recommended
  if (finding.currentVsRecommended || finding.actualVsRecommended) {
    children.push(createComparisonParagraph(finding.currentVsRecommended || finding.actualVsRecommended));
  }
  
  // 6. Recommendation
  children.push(createLabeledParagraph('Recomendación', finding.recommendation));
  
  // 7. PowerShell Commands
  if (finding.powershellCommands || finding.commands) {
    children.push(...createCommandsSection(finding.powershellCommands || finding.commands));
  }
  
  // 8. Prerequisites
  if (finding.prerequisites) {
    children.push(createLabeledParagraph('✅ Prerrequisitos', finding.prerequisites));
  }
  
  // 9. Operational Impact
  if (finding.operationalImpact) {
    children.push(createLabeledParagraph('⚙️ Impacto Operacional', finding.operationalImpact));
  }
  
  // 10. Documentation link
  if (finding.documentationUrl || finding.documentation) {
    children.push(createDocumentationLink(finding.documentationUrl || finding.documentation));
  }
  
  // 11. Spacing
  children.push(new Paragraph({ spacing: { after: 400 } }));
  
  return children;
}

function createFindingTitle(finding, index, style) {
  const affectedCount = finding.affectedCount || finding.affected_objects?.length;
  const countText = affectedCount ? ` (${affectedCount} afectados)` : '';
  const titleText = sanitize(finding.title) + countText;
  
  return new Paragraph({
    spacing: { before: 300, after: 120 },
    shading: { fill: style.fill, type: ShadingType.CLEAR },
    border: {
      top: { style: BorderStyle.SINGLE, size: 1, color: style.border },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: style.border },
      left: { style: BorderStyle.SINGLE, size: 1, color: style.border },
      right: { style: BorderStyle.SINGLE, size: 1, color: style.border }
    },
    children: [new TextRun({ text: `${index}. ${titleText}`, bold: true, size: 24, color: style.text, font: FONTS.primary })]
  });
}

function createMetadataTable(finding) {
  return new Table({
    columnWidths: [4500, 4500],
    rows: [
      new TableRow({
        children: [
          createMetadataCell('🎯 MITRE ATT&CK', sanitize(finding.mitreAttack || finding.mitre)),
          createMetadataCell('📋 CIS Control', sanitize(finding.cisControl || finding.cis))
        ]
      }),
      new TableRow({
        children: [
          createMetadataCell('⏱️ Timeline', formatTimeline(finding.timeline)),
          createMetadataCell('📊 Objetos Afectados', String(finding.affectedCount || finding.affected_objects?.length || 'N/A'))
        ]
      })
    ]
  });
}

function createMetadataCell(label, value) {
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: 4500, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({
      children: [
        new TextRun({ text: label + ': ', bold: true, size: 20, font: FONTS.primary }),
        new TextRun({ text: value, size: 20, font: FONTS.primary })
      ]
    })]
  });
}

function createLabeledParagraph(label, value, highlightColor = null) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({ text: label + ': ', bold: true, size: 22, color: highlightColor || '111827', font: FONTS.primary }),
      new TextRun({ text: sanitize(value), size: 22, font: FONTS.primary })
    ]
  });
}

function createComparisonParagraph(comparison) {
  return new Paragraph({
    spacing: { before: 160, after: 80 },
    shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
    children: [
      new TextRun({ text: '📏 Configuración Actual vs Recomendada: ', bold: true, size: 22 }),
      new TextRun({ text: sanitize(comparison), size: 22 })
    ]
  });
}

function createCommandsSection(commands) {
  const cleanCommands = cleanPowerShellCode(commands);
  return [
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [new TextRun({ text: '⚡ Comandos PowerShell:', bold: true, size: 22 })]
    }),
    new Paragraph({
      shading: { fill: 'F3F4F6', type: ShadingType.CLEAR },
      spacing: { before: 40, after: 40 },
      indent: { left: 240, right: 240 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
      },
      children: [new TextRun({ text: cleanCommands, font: FONTS.code, size: 18, color: '1F2937' })]
    })
  ];
}

function cleanPowerShellCode(code) {
  if (!code) return 'N/A';
  return String(code)
    .replace(/\\\$/g, '$')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .trim();
}

function createDocumentationLink(url) {
  if (!url || url === 'N/A') return new Paragraph({ spacing: { after: 0 } });
  
  return new Paragraph({
    spacing: { before: 120, after: 80 },
    children: [
      new TextRun({ text: '📚 Documentación: ', bold: true, size: 22 }),
      new ExternalHyperlink({
        children: [new TextRun({ text: url, color: '2563EB', size: 20, underline: { type: 'single' } })],
        link: url
      })
    ]
  });
}

function formatTimeline(timeline) {
  if (!timeline) return 'N/A';
  const timelineMap = {
    'immediate': 'Inmediato (24h)', 'Immediate': 'Inmediato (24h)', '24h': 'Inmediato (24h)',
    '7d': '7 días', '7 days': '7 días', '30d': '30 días', '30 days': '30 días',
    '1-2 weeks': '1-2 semanas', '1-2 semanas': '1-2 semanas'
  };
  return timelineMap[timeline] || sanitize(timeline);
}

function sanitize(value) {
  if (value === undefined || value === null || value === '') return 'N/A';
  if (typeof value === 'object') {
    if (Array.isArray(value)) return value.join(', ') || 'N/A';
    return JSON.stringify(value);
  }
  const str = String(value);
  if (str === 'undefined' || str === '[object Object]' || str === 'null') return 'N/A';
  return str;
}

module.exports = { createFindingCard, SEVERITY_STYLES };
```

## Finding Data Structure

Expected input format:

```javascript
const finding = {
  // Required
  title: "9 usuarios con contraseña no requerida (PASSWD_NOTREQD)",
  severity: "CRITICAL",  // CRITICAL | HIGH | MEDIUM | LOW
  description: "Cuentas configuradas con el flag PASSWD_NOTREQD...",
  recommendation: "1. Establecer contraseña para cada usuario...",
  
  // Recommended
  mitreAttack: "T1078.002 - Valid Accounts: Domain Accounts",
  cisControl: "5.2 - Use Unique Passwords",
  timeline: "Immediate",
  affectedCount: 9,
  businessImpact: "CRÍTICO - Acceso sin contraseña permite compromiso inmediato",
  
  // Optional
  currentVsRecommended: "Actual: PASSWD_NOTREQD=True | Recomendado: Contraseña obligatoria",
  powershellCommands: "Set-ADUser -Identity <User> -PasswordNotRequired $false",
  prerequisites: "Módulo ActiveDirectory de PowerShell",
  operationalImpact: "MEDIO - Usuario deberá establecer nueva contraseña",
  documentationUrl: "https://docs.microsoft.com/...",
  affected_objects: ["user1", "user2", "user3"]
};
```

## Best Practices

### Do's ✅

1. **Always include MITRE ATT&CK reference** - Helps security teams understand attack context
2. **Include CIS Control mapping** - Essential for compliance reporting
3. **Provide copy-paste commands** - Reduces implementation errors
4. **Clean PowerShell escaping** - Use `cleanPowerShellCode()` to remove `\$` etc.
5. **Format timeline in Spanish** - Match document language
6. **Include affected count** - Helps prioritize remediation effort
7. **Link to official documentation** - Enables deeper learning

### Don'ts ❌

1. **Don't show undefined values** - Use `sanitize()` on all inputs
2. **Don't leave placeholder text** - "Ver detalles en otra sección" is useless
3. **Don't escape PowerShell in document** - Clean before rendering
4. **Don't mix languages** - Stick to Spanish for entire document
5. **Don't omit timeline** - Always indicate urgency
6. **Don't forget business impact** - Executive readers need this
