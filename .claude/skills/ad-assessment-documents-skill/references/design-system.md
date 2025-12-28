# Design System Reference

Complete visual design specifications for AD Assessment documents.

## Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Navy | `#1E3A5F` | 30, 58, 95 | Titles, primary headings |
| Ocean | `#2563EB` | 37, 99, 235 | Links, interactive elements |
| White | `#FFFFFF` | 255, 255, 255 | Background |

### Gray Scale

| Name | Hex | docx-js | Usage |
|------|-----|---------|-------|
| Gray-900 | `#111827` | `'111827'` | Body text |
| Gray-700 | `#374151` | `'374151'` | Heading 2 |
| Gray-600 | `#4B5563` | `'4B5563'` | Heading 3 |
| Gray-500 | `#6B7280` | `'6B7280'` | Captions, footer |
| Gray-400 | `#9CA3AF` | `'9CA3AF'` | Disabled text |
| Gray-200 | `#E5E7EB` | `'E5E7EB'` | Borders |
| Gray-100 | `#F3F4F6` | `'F3F4F6'` | Code background |
| Gray-50 | `#F9FAFB` | `'F9FAFB'` | Subtle background |

### Severity Colors

```javascript
const SEVERITY_COLORS = {
  CRITICAL: {
    fill: 'FEE2E2',    // Light red background
    text: '991B1B',    // Dark red text
    border: 'FCA5A5',  // Medium red border
    emoji: '🔴'
  },
  HIGH: {
    fill: 'FEF3C7',    // Light orange/amber background
    text: '92400E',    // Dark amber text
    border: 'FCD34D',  // Medium amber border
    emoji: '🟠'
  },
  MEDIUM: {
    fill: 'FEF9C3',    // Light yellow background
    text: '854D0E',    // Dark yellow/brown text
    border: 'FDE047',  // Medium yellow border
    emoji: '🟡'
  },
  LOW: {
    fill: 'DBEAFE',    // Light blue background
    text: '1E40AF',    // Dark blue text
    border: '93C5FD',  // Medium blue border
    emoji: '🔵'
  },
  INFO: {
    fill: 'F3F4F6',    // Light gray background
    text: '374151',    // Dark gray text
    border: 'D1D5DB',  // Medium gray border
    emoji: 'ℹ️'
  },
  SUCCESS: {
    fill: 'D1FAE5',    // Light green background
    text: '065F46',    // Dark green text
    border: '6EE7B7',  // Medium green border
    emoji: '✅'
  }
};
```

### Status Colors

| Status | Fill | Text | Example |
|--------|------|------|---------|
| Operativo | `D1FAE5` | `065F46` | DC online |
| Advertencia | `FEF3C7` | `92400E` | Needs attention |
| Error | `FEE2E2` | `991B1B` | DC offline |
| Desconocido | `F3F4F6` | `6B7280` | No data |

### Table Colors

| Element | Color | Usage |
|---------|-------|-------|
| Header Background | `E8F4FD` | Light blue header row |
| Header Text | `1E3A5F` | Navy header text |
| Row Alternate | `F9FAFB` | Zebra striping (optional) |
| Border | `D1D5DB` | All table borders |

## Typography

### Font Stack

```javascript
const FONTS = {
  primary: 'Arial',           // Headers and body - universal
  secondary: 'Calibri',       // Alternative if needed
  code: 'Consolas',           // Code blocks
  fallback: 'sans-serif'      // Web fallback
};
```

### Size Scale (in half-points for docx-js)

| Name | Size | Half-points | Usage |
|------|------|-------------|-------|
| Display | 36pt | 72 | Cover page title |
| Title | 28pt | 56 | Document title |
| H1 | 18pt | 36 | Section headings |
| H2 | 14pt | 28 | Subsection headings |
| H3 | 12pt | 24 | Finding titles |
| Body | 11pt | 22 | Regular text |
| Small | 10pt | 20 | Metadata, captions |
| Code | 9pt | 18 | Code blocks |
| Footer | 9pt | 18 | Page numbers |

### Style Definitions

```javascript
const TEXT_STYLES = {
  // Display - Cover page
  display: { size: 72, bold: true, color: '1E3A5F', font: 'Arial' },
  
  // Title
  title: { size: 56, bold: true, color: '1E3A5F', font: 'Arial' },
  
  // Headings
  h1: { size: 36, bold: true, color: '1E3A5F', font: 'Arial' },
  h2: { size: 28, bold: true, color: '374151', font: 'Arial' },
  h3: { size: 24, bold: true, color: '4B5563', font: 'Arial' },
  
  // Body
  body: { size: 22, color: '111827', font: 'Arial' },
  bodyBold: { size: 22, bold: true, color: '111827', font: 'Arial' },
  
  // Metadata
  meta: { size: 20, color: '6B7280', font: 'Arial' },
  metaBold: { size: 20, bold: true, color: '374151', font: 'Arial' },
  
  // Code
  code: { size: 18, color: '1F2937', font: 'Consolas' },
  
  // Links
  link: { size: 22, color: '2563EB', underline: { type: 'single' } },
  
  // Table
  tableHeader: { size: 22, bold: true, color: '1E3A5F', font: 'Arial' },
  tableCell: { size: 22, color: '111827', font: 'Arial' }
};
```

## Spacing System

### Paragraph Spacing (in twentieths of a point - TWIPs)

| Context | Before | After | docx-js |
|---------|--------|-------|---------|
| Title | 240 | 240 | `{ before: 240, after: 240 }` |
| H1 | 360 | 200 | `{ before: 360, after: 200 }` |
| H2 | 280 | 160 | `{ before: 280, after: 160 }` |
| H3 | 200 | 120 | `{ before: 200, after: 120 }` |
| Body | 0 | 120 | `{ after: 120 }` |
| List item | 0 | 60 | `{ after: 60 }` |
| Code block | 120 | 120 | `{ before: 120, after: 120 }` |
| Table | 200 | 200 | `{ before: 200, after: 200 }` |

### Page Margins (TWIPs: 1440 = 1 inch)

```javascript
const PAGE_MARGINS = {
  standard: { top: 1440, right: 1440, bottom: 1440, left: 1440 },  // 1"
  narrow: { top: 720, right: 720, bottom: 720, left: 720 },        // 0.5"
  wide: { top: 1440, right: 2160, bottom: 1440, left: 2160 }       // 1" / 1.5"
};
```

### Table Cell Margins

```javascript
const CELL_MARGINS = {
  tight: { top: 60, bottom: 60, left: 120, right: 120 },
  normal: { top: 100, bottom: 100, left: 180, right: 180 },
  relaxed: { top: 140, bottom: 140, left: 240, right: 240 }
};
```

### Indentation

| Element | Left Indent | Hanging | Usage |
|---------|-------------|---------|-------|
| List item L0 | 720 | 360 | First level bullet/number |
| List item L1 | 1440 | 360 | Second level |
| Code block | 360 | 0 | Indented code |
| Quote | 720 | 0 | Block quotes |

## Visual Hierarchy Examples

### Finding Card Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ [SEVERITY BG] 1. Finding Title Here                             │  H3 + severity bg
├─────────────────────────────────────────────────────────────────┤
│ 🎯 MITRE ATT&CK: T1078.002  │  📋 CIS Control: 5.2             │  Metadata table
│ ⏱️ Timeline: Inmediato      │  📊 Afectados: 9                 │
├─────────────────────────────────────────────────────────────────┤
│ **Descripción:** Lorem ipsum dolor sit amet...                  │  Body text
│                                                                 │
│ **💼 Impacto en el Negocio:** Critical impact description...    │  Body text
│                                                                 │
│ **Recomendación:** Steps to remediate...                        │  Body text
├─────────────────────────────────────────────────────────────────┤
│ **⚡ Comandos PowerShell:**                                      │  Label
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Get-ADUser -Filter * | Set-ADUser -PasswordNeverExpires $f  │ │  Code block
│ └─────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ **📚 Documentación:** https://docs.microsoft.com/...  [link]    │  Link
└─────────────────────────────────────────────────────────────────┘
```

### Summary Table Structure

```
┌────────────────────────────────────┬──────────────┐
│ [Header BG] Métrica                │ Cantidad     │  Header row
├────────────────────────────────────┼──────────────┤
│ Pruebas Ejecutadas                 │ 13           │  Normal row
├────────────────────────────────────┼──────────────┤
│ 🔴 Configuraciones Críticas        │ [RED]  3     │  Colored value
├────────────────────────────────────┼──────────────┤
│ 🟠 Alta Prioridad                  │ [ORANGE] 3   │  Colored value
├────────────────────────────────────┼──────────────┤
│ 🟡 Media Prioridad                 │ [YELLOW] 6   │  Colored value
├────────────────────────────────────┼──────────────┤
│ 🔵 Optimización                    │ [BLUE]  1    │  Colored value
└────────────────────────────────────┴──────────────┘
```

## Icons and Emoji Usage

### Standard Icons by Context

| Context | Emoji | Usage |
|---------|-------|-------|
| Date | 📅 | Assessment date |
| Score/Metrics | 📊 | Health score, counts |
| Security | 🔒 | Confidential notice |
| Forest/Tree | 🌳 | AD Forest |
| Document | 📋 | Executive summary, CIS |
| Target | 🎯 | MITRE ATT&CK |
| Clock | ⏱️ | Timeline, urgency |
| Lightning | ⚡ | PowerShell commands |
| Book | 📚 | Documentation links |
| Briefcase | 💼 | Business impact |
| Warning | ⚠️ | Warnings |
| Check | ✅ | Success/Compliant |
| Cross | ❌ | Failed/Non-compliant |
| Info | ℹ️ | Informational |

### Severity Indicators

| Severity | Circle | Word |
|----------|--------|------|
| Critical | 🔴 | CRÍTICO |
| High | 🟠 | ALTO |
| Medium | 🟡 | MEDIO |
| Low | 🔵 | BAJO |
| Info | ⚪ | INFO |

## Border Styles

```javascript
const BORDERS = {
  // Standard table border
  standard: { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' },
  
  // Thick border for headers
  thick: { style: BorderStyle.SINGLE, size: 2, color: '9CA3AF' },
  
  // No border
  none: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  
  // Box for code blocks
  code: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' }
};

// Apply to all sides
const createCellBorders = (border) => ({
  top: border,
  bottom: border,
  left: border,
  right: border
});
```

## Responsive Column Widths

### Letter Size (8.5" x 11") - 1" margins = 6.5" usable = 9360 DXA

| Columns | Widths (DXA) | Usage |
|---------|--------------|-------|
| 1 | `[9360]` | Full width |
| 2 equal | `[4680, 4680]` | Two column |
| 2 (30/70) | `[2808, 6552]` | Label/Value |
| 2 (40/60) | `[3744, 5616]` | Wider label |
| 3 equal | `[3120, 3120, 3120]` | Three column |
| 4 equal | `[2340, 2340, 2340, 2340]` | Four column |

### Finding Metadata Table

```javascript
// 2 columns for metadata pairs
const METADATA_WIDTHS = [4500, 4500];  // 9000 total (leaves margin)
```

### DC Status Table

```javascript
// 4 columns: Hostname, IP, OS, Status
const DC_TABLE_WIDTHS = [2800, 1800, 2500, 2260];  // 9360 total
```
