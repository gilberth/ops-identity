# Table Templates Reference

Pre-built table templates for common AD Assessment sections.

## Common Configuration

```javascript
const { Table, TableRow, TableCell, Paragraph, TextRun, 
        BorderStyle, WidthType, ShadingType, AlignmentType } = require('docx');

// Standard colors
const COLORS = {
  headerBg: 'E8F4FD',
  headerText: '1E3A5F',
  borderColor: 'D1D5DB',
  rowAlt: 'F9FAFB',
  success: { fill: 'D1FAE5', text: '065F46' },
  warning: { fill: 'FEF3C7', text: '92400E' },
  error: { fill: 'FEE2E2', text: '991B1B' },
  unknown: { fill: 'F3F4F6', text: '6B7280' }
};

// Standard border
const BORDER = { style: BorderStyle.SINGLE, size: 1, color: COLORS.borderColor };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
```

## 1. Forest/Domain Summary Table

```javascript
function createForestSummaryTable(data) {
  const rows = [
    ['Nombre del Bosque AD', data.forestName || 'N/A'],
    ['Dominio Raíz del Bosque', data.rootDomain || 'N/A'],
    ['Nivel Funcional del Bosque', data.forestLevel || 'N/A'],
    ['Nivel Funcional del Dominio', data.domainLevel || 'N/A'],
    ['Controladores de Dominio', String(data.dcCount || 0)],
    ['Número de Sitios AD', String(data.siteCount || 0)]
  ];
  
  return new Table({
    columnWidths: [4500, 4860],
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('Propiedad', 4500),
          createHeaderCell('Valor', 4860)
        ]
      }),
      // Data rows
      ...rows.map(([label, value]) => new TableRow({
        children: [
          createLabelCell(label, 4500),
          createValueCell(value, 4860)
        ]
      }))
    ]
  });
}

function createHeaderCell(text, width) {
  return new TableCell({
    borders: CELL_BORDERS,
    shading: { fill: COLORS.headerBg, type: ShadingType.CLEAR },
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 22, color: COLORS.headerText })]
    })]
  });
}

function createLabelCell(text, width) {
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 22 })]
    })]
  });
}

function createValueCell(text, width, options = {}) {
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: width, type: WidthType.DXA },
    shading: options.fill ? { fill: options.fill, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({
      alignment: options.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ 
        text, 
        size: 22,
        bold: options.bold,
        color: options.color
      })]
    })]
  });
}
```

## 2. Domain Controllers Status Table

```javascript
function createDCStatusTable(domainControllers) {
  if (!domainControllers || domainControllers.length === 0) {
    return createEmptyTablePlaceholder('No se encontraron controladores de dominio.');
  }
  
  const columnWidths = [2800, 1800, 2500, 2260];
  
  return new Table({
    columnWidths,
    rows: [
      // Header
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('Hostname', columnWidths[0]),
          createHeaderCell('IPv4', columnWidths[1]),
          createHeaderCell('OS', columnWidths[2]),
          createHeaderCell('Estado', columnWidths[3])
        ]
      }),
      // Data rows
      ...domainControllers.map(dc => {
        const status = getStatusConfig(dc.status || dc.IsOperational);
        return new TableRow({
          children: [
            createValueCell(sanitize(dc.hostname || dc.Name), columnWidths[0]),
            createValueCell(sanitize(dc.ipv4 || dc.IPv4Address), columnWidths[1]),
            createValueCell(sanitize(dc.os || dc.OperatingSystem), columnWidths[2]),
            createStatusCell(status.label, columnWidths[3], status)
          ]
        });
      })
    ]
  });
}

function getStatusConfig(status) {
  if (status === true || status === 'Operativo' || status === 'Online') {
    return { label: '✅ Operativo', ...COLORS.success };
  }
  if (status === false || status === 'Offline' || status === 'Error') {
    return { label: '❌ Error', ...COLORS.error };
  }
  if (status === 'Warning' || status === 'Advertencia') {
    return { label: '⚠️ Advertencia', ...COLORS.warning };
  }
  return { label: '❓ Desconocido', ...COLORS.unknown };
}

function createStatusCell(text, width, colors) {
  return new TableCell({
    borders: CELL_BORDERS,
    shading: { fill: colors.fill, type: ShadingType.CLEAR },
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 22, color: colors.text })]
    })]
  });
}
```

## 3. FSMO Roles Table

```javascript
function createFSMORolesTable(fsmoData) {
  // Validate and sanitize FSMO data
  const roles = [
    { name: 'Schema Master', holder: fsmoData?.schemaMaster, status: fsmoData?.schemaStatus },
    { name: 'Domain Naming Master', holder: fsmoData?.domainNaming, status: fsmoData?.domainNamingStatus },
    { name: 'PDC Emulator', holder: fsmoData?.pdcEmulator, status: fsmoData?.pdcStatus },
    { name: 'RID Master', holder: fsmoData?.ridMaster, status: fsmoData?.ridStatus },
    { name: 'Infrastructure Master', holder: fsmoData?.infrastructure, status: fsmoData?.infraStatus }
  ];
  
  const columnWidths = [2500, 3000, 2000, 1860];
  
  return new Table({
    columnWidths,
    rows: [
      // Header
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('Rol', columnWidths[0]),
          createHeaderCell('Titular', columnWidths[1]),
          createHeaderCell('Estado', columnWidths[2]),
          createHeaderCell('Latencia', columnWidths[3])
        ]
      }),
      // Data rows
      ...roles.map(role => {
        const statusConfig = role.status === true || role.status === 'OK' 
          ? { label: '✅ OK', ...COLORS.success }
          : role.holder 
            ? { label: '⚠️ Verificar', ...COLORS.warning }
            : { label: '❌ Error', ...COLORS.error };
        
        return new TableRow({
          children: [
            createValueCell(role.name, columnWidths[0]),
            createValueCell(sanitize(role.holder), columnWidths[1]),
            createStatusCell(statusConfig.label, columnWidths[2], statusConfig),
            createValueCell(formatLatency(role.latency), columnWidths[3], { center: true })
          ]
        });
      })
    ]
  });
}

function formatLatency(latency) {
  if (latency === undefined || latency === null || latency === 'undefined ms') {
    return 'N/A';
  }
  if (typeof latency === 'number') {
    return `${latency} ms`;
  }
  return String(latency);
}
```

## 4. GPO Summary Table

```javascript
function createGPOSummaryTable(gpos) {
  if (!gpos || gpos.length === 0) {
    return createEmptyTablePlaceholder('No se encontraron GPOs.');
  }
  
  const columnWidths = [3500, 2000, 1500, 2360];
  
  return new Table({
    columnWidths,
    rows: [
      // Header
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('Nombre de GPO', columnWidths[0]),
          createHeaderCell('Estado', columnWidths[1]),
          createHeaderCell('Enlaces', columnWidths[2]),
          createHeaderCell('Última Modificación', columnWidths[3])
        ]
      }),
      // Data rows (limit to first 20 for readability)
      ...gpos.slice(0, 20).map(gpo => new TableRow({
        children: [
          createValueCell(sanitize(gpo.DisplayName || gpo.Name), columnWidths[0]),
          createGPOStatusCell(gpo.GpoStatus || gpo.Status, columnWidths[1]),
          createValueCell(String(gpo.LinksCount || gpo.Links?.length || 0), columnWidths[2], { center: true }),
          createValueCell(formatDate(gpo.ModificationTime || gpo.WhenChanged), columnWidths[3])
        ]
      })),
      // Show count if truncated
      ...(gpos.length > 20 ? [createTruncatedRow(gpos.length - 20, columnWidths)] : [])
    ]
  });
}

function createGPOStatusCell(status, width) {
  const statusMap = {
    'AllSettingsEnabled': { label: 'Habilitada', ...COLORS.success },
    'AllSettingsDisabled': { label: 'Deshabilitada', ...COLORS.warning },
    'UserSettingsDisabled': { label: 'Usuario Deshabilitado', ...COLORS.warning },
    'ComputerSettingsDisabled': { label: 'Equipo Deshabilitado', ...COLORS.warning }
  };
  
  const config = statusMap[status] || { label: sanitize(status), ...COLORS.unknown };
  
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: config.label, size: 20, color: config.text })]
    })]
  });
}

function createTruncatedRow(remaining, columnWidths) {
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  return new TableRow({
    children: [
      new TableCell({
        borders: CELL_BORDERS,
        columnSpan: columnWidths.length,
        shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
        width: { size: totalWidth, type: WidthType.DXA },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ 
            text: `... y ${remaining} GPOs adicionales (ver anexo para lista completa)`, 
            italics: true,
            size: 20,
            color: '6B7280'
          })]
        })]
      })
    ]
  });
}
```

## 5. Findings Summary Table

```javascript
function createFindingsSummaryTable(findings) {
  const columnWidths = [6000, 2000, 1360];
  
  // Sort by severity
  const sortedFindings = [...findings].sort((a, b) => {
    const order = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
    return (order[a.severity] || 4) - (order[b.severity] || 4);
  });
  
  return new Table({
    columnWidths,
    rows: [
      // Header
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('Detalle del Problema', columnWidths[0]),
          createHeaderCell('Severidad', columnWidths[1]),
          createHeaderCell('Afectados', columnWidths[2])
        ]
      }),
      // Data rows
      ...sortedFindings.map(finding => {
        const severity = finding.severity || 'MEDIUM';
        const severityColors = {
          'CRITICAL': COLORS.error,
          'HIGH': COLORS.warning,
          'MEDIUM': { fill: 'FEF9C3', text: '854D0E' },
          'LOW': { fill: 'DBEAFE', text: '1E40AF' }
        };
        const colors = severityColors[severity] || severityColors['MEDIUM'];
        
        return new TableRow({
          children: [
            createValueCell(sanitize(finding.title), columnWidths[0]),
            createStatusCell(severity, columnWidths[1], colors),
            createValueCell(String(finding.affectedCount || finding.affected_objects?.length || '-'), columnWidths[2], { center: true })
          ]
        });
      })
    ]
  });
}
```

## 6. DNS Zones Table

```javascript
function createDNSZonesTable(zones) {
  if (!zones || zones.length === 0) {
    return createEmptyTablePlaceholder('No se encontraron zonas DNS.');
  }
  
  const columnWidths = [3000, 1800, 2200, 2360];
  
  return new Table({
    columnWidths,
    rows: [
      // Header
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('Nombre de Zona', columnWidths[0]),
          createHeaderCell('Tipo', columnWidths[1]),
          createHeaderCell('Actualización Dinámica', columnWidths[2]),
          createHeaderCell('DNSSEC', columnWidths[3])
        ]
      }),
      // Data rows
      ...zones.slice(0, 15).map(zone => new TableRow({
        children: [
          createValueCell(sanitize(zone.ZoneName || zone.Name), columnWidths[0]),
          createValueCell(sanitize(zone.ZoneType || 'Primary'), columnWidths[1]),
          createDynamicUpdateCell(zone.DynamicUpdate, columnWidths[2]),
          createDNSSECCell(zone.IsSigned || zone.DNSSEC, columnWidths[3])
        ]
      }))
    ]
  });
}

function createDynamicUpdateCell(status, width) {
  const config = status === 'Secure' || status === 'SecureAndNonsecure'
    ? { label: 'Segura', ...COLORS.success }
    : status === 'NonsecureAndSecure'
      ? { label: 'No Segura + Segura', ...COLORS.warning }
      : status === 'None'
        ? { label: 'Ninguna', ...COLORS.unknown }
        : { label: sanitize(status), ...COLORS.unknown };
  
  return new TableCell({
    borders: CELL_BORDERS,
    width: { size: width, type: WidthType.DXA },
    children: [new Paragraph({
      children: [new TextRun({ text: config.label, size: 20 })]
    })]
  });
}

function createDNSSECCell(isSigned, width) {
  const config = isSigned === true || isSigned === 'Signed'
    ? { label: '✅ Firmada', ...COLORS.success }
    : { label: 'No Firmada', ...COLORS.unknown };
  
  return createStatusCell(config.label, width, config);
}
```

## 7. Risk Scorecard Table

```javascript
function createRiskScorecardTable(categories) {
  const defaultCategories = [
    { name: 'Active Directory y Bosque', status: 'unknown' },
    { name: 'Políticas de Cuentas de Dominio', status: 'unknown' },
    { name: 'Controlador de Dominio', status: 'unknown' },
    { name: 'Seguridad y Cumplimiento', status: 'unknown' }
  ];
  
  const cats = categories || defaultCategories;
  const columnWidths = [5000, 4360];
  
  const statusMap = {
    'critical': { label: 'Requiere Atención Inmediata', ...COLORS.error },
    'high': { label: 'Requiere Atención', ...COLORS.warning },
    'medium': { label: 'Requiere Revisión', ...{ fill: 'FEF9C3', text: '854D0E' } },
    'low': { label: 'Sugerencias Disponibles', ...{ fill: 'DBEAFE', text: '1E40AF' } },
    'ok': { label: 'Aceptable', ...COLORS.success },
    'unknown': { label: 'Sin Evaluar', ...COLORS.unknown }
  };
  
  return new Table({
    columnWidths,
    rows: [
      // Header
      new TableRow({
        tableHeader: true,
        children: [
          createHeaderCell('Categoría', columnWidths[0]),
          createHeaderCell('Estado de Configuración', columnWidths[1])
        ]
      }),
      // Data rows
      ...cats.map(cat => {
        const config = statusMap[cat.status?.toLowerCase()] || statusMap['unknown'];
        return new TableRow({
          children: [
            createValueCell(cat.name, columnWidths[0]),
            createStatusCell(config.label, columnWidths[1], config)
          ]
        });
      })
    ]
  });
}
```

## Utility Functions

```javascript
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

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return String(dateStr);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

function createEmptyTablePlaceholder(message) {
  return new Table({
    columnWidths: [9360],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: CELL_BORDERS,
            shading: { fill: 'F9FAFB', type: ShadingType.CLEAR },
            width: { size: 9360, type: WidthType.DXA },
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: message, italics: true, size: 22, color: '6B7280' })]
            })]
          })
        ]
      })
    ]
  });
}

module.exports = {
  createForestSummaryTable,
  createDCStatusTable,
  createFSMORolesTable,
  createGPOSummaryTable,
  createFindingsSummaryTable,
  createDNSZonesTable,
  createRiskScorecardTable,
  sanitize,
  formatDate
};
```
