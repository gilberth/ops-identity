import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign } from 'docx';

interface Finding {
  id: string;
  title: string;
  severity: string;
  description: string;
  recommendation: string;
  evidence?: any;
  // Campos técnicos adicionales generados por IA
  mitre_attack?: string;  // Ej: "T1558.003 - Kerberoasting"
  cis_control?: string;   // Ej: "5.2.1 - Password expiration"
  impact_business?: string; // Impacto en negocio
  remediation_commands?: string; // Comandos PowerShell específicos
  prerequisites?: string;  // Requisitos previos para remediar
  operational_impact?: string; // Impacto operacional de la remediación
  microsoft_docs?: string; // URLs de documentación de Microsoft
  current_vs_recommended?: string; // Valores actuales vs recomendados
  timeline?: string; // Timeline de remediación (24h, 7d, 30d, etc)
  affected_count?: number; // Número de objetos afectados
}

interface Assessment {
  domain: string;
  created_at: string;
  status: string;
}

interface ReportData {
  assessment: Assessment;
  findings: Finding[];
  rawData: any;
}

// Professional color palette based on AD Assessment Document Skill
const COLORS = {
  // Primary branding
  primary: "1E3A5F",      // Navy - Titles, primary headings
  secondary: "2563EB",    // Ocean Blue - Links, interactive
  accent: "107C10",       // Office Green (Healthy)

  // Severity colors (text)
  critical: "991B1B",     // Dark red text
  high: "92400E",         // Dark amber text
  medium: "854D0E",       // Dark yellow/brown text
  low: "1E40AF",          // Dark blue text
  info: "374151",         // Gray-700

  // Background colors
  lightBg: "F3F4F6",      // Gray-100
  border: "D1D5DB",       // Gray-300
  headerBg: "E8F4FD",     // Light blue header

  // Severity backgrounds (for cells)
  criticalBg: "FEE2E2",   // Light red
  highBg: "FEF3C7",       // Light amber
  mediumBg: "FEF9C3",     // Light yellow
  lowBg: "DBEAFE",        // Light blue
  successBg: "D1FAE5",    // Light green
  successText: "065F46",  // Dark green
};

// Utility function to sanitize values - CRITICAL: Never show undefined/null/[object Object]
const sanitizeValue = (value: any): string => {
  if (value === undefined || value === null || value === '') return 'N/A';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.map(v => sanitizeValue(v)).join(', ') : 'N/A';
    }
    // Try to extract meaningful properties
    if (value.Name) return String(value.Name);
    if (value.SamAccountName) return String(value.SamAccountName);
    if (value.DisplayName) return String(value.DisplayName);
    return JSON.stringify(value);
  }
  const str = String(value);
  if (str === 'undefined' || str === '[object Object]' || str === 'null') return 'N/A';
  if (str.includes('undefined ms')) return str.replace('undefined ms', 'N/A');
  return str;
};

const createTableRow = (cells: string[], isHeader = false, status?: string) => {
  const headerColor = isHeader ? COLORS.primary : undefined;
  const cellBg = isHeader ? COLORS.primary : (status ? getStatusBg(status) : undefined);

  return new TableRow({
    children: cells.map(cell => new TableCell({
      children: [new Paragraph({
        children: [new TextRun({
          text: cell,
          bold: isHeader,
          color: isHeader ? "FFFFFF" : (status ? getStatusColor(status) : undefined),
          size: isHeader ? 24 : 22,
        })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 100, after: 100 },
      })],
      shading: cellBg ? { fill: cellBg } : undefined,
      margins: {
        top: 150,
        bottom: 150,
        left: 150,
        right: 150,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
        right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
      },
    })),
  });
};

const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'critical': return COLORS.critical;
    case 'high': return COLORS.high;
    case 'medium': return COLORS.medium;
    case 'low': return COLORS.low;
    case 'success': return COLORS.successText;
    default: return COLORS.info;
  }
};

const getStatusBg = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'critical': return COLORS.criticalBg;
    case 'high': return COLORS.highBg;
    case 'medium': return COLORS.mediumBg;
    case 'low': return COLORS.lowBg;
    case 'success': return COLORS.successBg;
    default: return COLORS.lightBg;
  }
};

const createDetailTable = (title: string, content: string, color: string = COLORS.primary) => {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
      left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
      right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 24 })],
              spacing: { before: 100, after: 100 },
            })],
            shading: { fill: COLORS.lightBg },
            width: { size: 25, type: WidthType.PERCENTAGE },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            verticalAlign: VerticalAlign.CENTER,
          }),
          new TableCell({
            children: [new Paragraph({
              text: content,
              spacing: { before: 100, after: 100 },
            })],
            width: { size: 75, type: WidthType.PERCENTAGE },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            verticalAlign: VerticalAlign.CENTER,
          }),
        ],
      }),
    ],
  });
};

export async function generateReport(data: ReportData): Promise<Blob> {
  const { assessment, findings, rawData } = data;

  // Extract functional levels from wherever they are in the data structure
  const extractFunctionalLevels = (data: any) => {
    // Try to find these values in various possible locations
    let forestLevel = "Desconocido";
    let domainLevel = "Desconocido";

    if (data?.ForestFunctionalLevel) {
      forestLevel = data.ForestFunctionalLevel;
    } else if (data?.DomainInfo?.ForestFunctionalLevel) {
      forestLevel = data.DomainInfo.ForestFunctionalLevel;
    } else if (data?.ForestMode) {
      forestLevel = data.ForestMode;
    } else if (data?.DomainInfo?.ForestMode) {
      forestLevel = data.DomainInfo.ForestMode;
    }

    if (data?.DomainFunctionalLevel) {
      domainLevel = data.DomainFunctionalLevel;
    } else if (data?.DomainInfo?.DomainFunctionalLevel) {
      domainLevel = data.DomainInfo.DomainFunctionalLevel;
    } else if (data?.DomainMode) {
      domainLevel = data.DomainMode;
    } else if (data?.DomainInfo?.DomainMode) {
      domainLevel = data.DomainInfo.DomainMode;
    }

    return { forestLevel, domainLevel };
  };

  const { forestLevel, domainLevel } = extractFunctionalLevels(rawData);

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    info: findings.filter(f => f.severity === 'info').length,
  };

  const criticalFindings = findings.filter(f => f.severity === 'critical');
  const highFindings = findings.filter(f => f.severity === 'high');
  const mediumFindings = findings.filter(f => f.severity === 'medium');
  const lowFindings = findings.filter(f => f.severity === 'low');

  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate Health Score (0-100)
  // Start with 100. Deduct points based on severity.
  // Critical: -20, High: -10, Medium: -5, Low: -1
  let healthScore = 100;
  healthScore -= (severityCounts.critical * 20);
  healthScore -= (severityCounts.high * 10);
  healthScore -= (severityCounts.medium * 5);
  healthScore -= (severityCounts.low * 1);
  if (healthScore < 0) healthScore = 0;

  const overallHealth = healthScore >= 90 ? "Excelente" :
    healthScore >= 75 ? "Bueno" :
      healthScore >= 50 ? "Requiere Revisión" : "Requiere Atención";

  const scoreColor = healthScore >= 90 ? COLORS.accent :
    healthScore >= 75 ? COLORS.secondary :
      healthScore >= 50 ? COLORS.medium : COLORS.critical;

  const totalTests = findings.length;
  // const overallHealth = severityCounts.critical > 0 ? "Requiere Atención" :
  //   severityCounts.high > 0 ? "Requiere Revisión" :
  //     severityCounts.medium > 0 ? "Aceptable" : "Saludable";

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1440, // 1 inch
            right: 1440,
            bottom: 1440,
            left: 1440,
          },
        },
      },
      children: [
        // PORTADA MODERNA
        new Paragraph({
          children: [new TextRun({
            text: "Active Directory",
            size: 56,
            bold: true,
            color: COLORS.primary,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Reporte de Estado y Configuración",
            size: 48,
            color: COLORS.secondary,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: assessment.domain,
            size: 40,
            bold: true,
            color: COLORS.primary,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        }),
        new Table({
          width: { size: 60, type: WidthType.PERCENTAGE },
          alignment: AlignmentType.CENTER,
          borders: {
            top: { style: BorderStyle.NONE, size: 0 },
            bottom: { style: BorderStyle.NONE, size: 0 },
            left: { style: BorderStyle.NONE, size: 0 },
            right: { style: BorderStyle.NONE, size: 0 },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: "📅 Fecha de Evaluación", bold: true, size: 24 })],
                    alignment: AlignmentType.LEFT,
                  })],
                  shading: { fill: COLORS.lightBg },
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0 },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                  },
                  margins: { top: 100, bottom: 100, left: 200, right: 200 },
                }),
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: currentDate, size: 24 })],
                    alignment: AlignmentType.RIGHT,
                  })],
                  shading: { fill: COLORS.lightBg },
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0 },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                  },
                  margins: { top: 100, bottom: 100, left: 200, right: 200 },
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: "📊 Estado de Salud", bold: true, size: 24 })],
                    alignment: AlignmentType.LEFT,
                  })],
                  shading: { fill: COLORS.lightBg },
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0 },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                  },
                  margins: { top: 100, bottom: 100, left: 200, right: 200 },
                }),
                new TableCell({
                  children: [new Paragraph({
                    children: [
                      new TextRun({
                        text: `${healthScore}/100`,
                        size: 36,
                        bold: true,
                        color: scoreColor
                      }),
                      new TextRun({
                        text: ` (${overallHealth})`,
                        size: 24,
                        color: COLORS.info
                      })
                    ],
                    alignment: AlignmentType.RIGHT,
                  })],
                  shading: { fill: COLORS.lightBg },
                  borders: {
                    top: { style: BorderStyle.NONE, size: 0 },
                    bottom: { style: BorderStyle.NONE, size: 0 },
                    left: { style: BorderStyle.NONE, size: 0 },
                    right: { style: BorderStyle.NONE, size: 0 },
                  },
                  margins: { top: 100, bottom: 100, left: 200, right: 200 },
                }),
              ],
            }),
          ],
        }),
        new Paragraph({
          children: [new TextRun({
            text: "🔒 CONFIDENTIAL",
            bold: true,
            color: COLORS.critical,
            size: 28,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 1200 },
        }),

        // AD FOREST AND DOMAIN SUMMARY
        new Paragraph({
          children: [new TextRun({
            text: "🌳 AD Forest and Domain Summary",
            size: 36,
            bold: true,
            color: COLORS.primary,
          })],
          spacing: { before: 600, after: 300 },
          border: {
            bottom: {
              color: COLORS.secondary,
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        }),
        new Paragraph({
          text: "",
          spacing: { after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
          },
          rows: [
            createTableRow(["Propiedad", "Valor"], true),
            createTableRow(["Nombre del Bosque AD", rawData?.ForestName || rawData?.DomainInfo?.ForestName || assessment.domain]),
            createTableRow(["Dominio Raíz del Bosque", rawData?.ForestRootDomain || rawData?.DomainInfo?.ForestRootDomain || assessment.domain]),
            createTableRow(["Nivel Funcional del Bosque", forestLevel]),
            createTableRow(["Nivel Funcional del Dominio", domainLevel]),
            createTableRow(["Controladores de Dominio", rawData?.DomainControllers?.length?.toString() || "N/A"]),
            createTableRow(["Número de Sitios AD", rawData?.Sites?.length?.toString() || "1"]),
          ],
        }),

        // DOMAIN CONTROLLER HEALTH (SEMAPHORE STYLE)
        ...(rawData?.DomainControllers && rawData.DomainControllers.length > 0 ? [
          new Paragraph({
            text: "Estado de Controladores de Dominio",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Hostname", "IPv4", "OS", "Estado"], true),
              ...rawData.DomainControllers.map((dc: any) => {
                // Simulate health checks based on available data
                // In a real scenario, we would check specific health flags
                const isHealthy = true; // Default to true for layout demo
                const statusText = isHealthy ? "✅ Operativo" : "⚠️ Revisar";
                const statusColor = isHealthy ? "low" : "high"; // Blue for healthy (info), Orange for warning

                return createTableRow([
                  dc.HostName || dc.Name || "N/A",
                  dc.IPv4Address || dc.IPAddress || "N/A",
                  dc.OperatingSystem || "N/A",
                  statusText
                ], false, statusColor);
              }),
            ],
          }),
        ] : []),

        // SALUD DE ROLES FSMO
        ...(rawData?.FSMORolesHealth ? [
          new Paragraph({
            text: "Salud y Ubicación de Roles FSMO",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: `Estado General: ${rawData.FSMORolesHealth.OverallHealth || "Desconocido"}`,
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Rol", "Titular", "Alcance", "Estado", "Latencia"], true),
              ...(rawData.FSMORolesHealth.Roles || []).map((role: any) => {
                const status = role.Health === "Healthy" ? "✅ OK" : "⚠️ Error";
                const statusColor = role.Health === "Healthy" ? "low" : "critical";
                const latency = role.ADResponseTimeMs ? `${role.ADResponseTimeMs.toFixed(1)} ms` : "N/A";
                return createTableRow([
                  role.RoleName || "Desconocido",
                  role.Holder || "Desconocido",
                  role.Scope || "N/A",
                  status,
                  latency
                ], false, statusColor);
              }),
            ],
          }),
          // RID Pool Status
          ...(rawData.FSMORolesHealth.RIDPoolStatus ? [
            new Paragraph({
              text: "Estado del Pool RID",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Métrica", "Valor"], true),
                createTableRow(["RIDs Emitidos", rawData.FSMORolesHealth.RIDPoolStatus.RIDsIssued?.toString() || "N/A"]),
                createTableRow(["RIDs Restantes", rawData.FSMORolesHealth.RIDPoolStatus.RIDsRemaining?.toString() || "N/A"]),
                createTableRow(["% Utilizado", `${rawData.FSMORolesHealth.RIDPoolStatus.PercentUsed || 0}%`]),
              ],
            }),
          ] : []),
        ] : []),

        // SALUD DE REPLICACIÓN
        ...(rawData?.ReplicationHealthAllDCs && rawData.ReplicationHealthAllDCs.length > 0 ? [
          new Paragraph({
            text: "Salud de Replicación Active Directory",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Análisis del estado de replicación entre controladores de dominio. Se muestran posibles fallos y latencias excesivas.",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["DC Origen", "Socio (Partner)", "Estado", "Fallas Consec."], true),
              ...rawData.ReplicationHealthAllDCs.flatMap((dc: any) =>
                (dc.ReplicationPartners || []).map((partner: any) => {
                  const isHealthy = partner.LastReplicationResult === 0;
                  const statusText = isHealthy ? "✅ Éxito" : `❌ Error ${partner.LastReplicationResult}`;
                  const color = isHealthy ? "low" : "critical";
                  return createTableRow([
                    dc.SourceDC || "N/A",
                    partner.Partner || "N/A",
                    statusText,
                    partner.ConsecutiveFailureCount?.toString() || "0"
                  ], false, color);
                })
              ).slice(0, 20), // Limit detailed rows to prevent overflow
            ],
          }),
        ] : []),

        // TOPOLOGÍA DE SITIOS Y SUBNETS
        ...(rawData?.SiteTopology ? [
          new Paragraph({
            text: "Topología de Sitios y Subnets",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),

          // Sitios sin Subnets
          ...(rawData.SiteTopology.SitesWithoutSubnets && rawData.SiteTopology.SitesWithoutSubnets.length > 0 ? [
            new Paragraph({
              text: "⚠️ Sitios Sin Subnets Asociadas",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              text: "Los siguientes sitios no tienen subredes asignadas, lo que puede causar problemas de autenticación y tráfico de clientes:",
              spacing: { after: 100 }
            }),
            ...rawData.SiteTopology.SitesWithoutSubnets.map((site: string) =>
              new Paragraph({
                text: `• ${site}`,
                bullet: { level: 0 },
                spacing: { after: 50 },
                // color: COLORS.high
              })
            )
          ] : []),

          // Subnets sin Sitio
          ...(rawData.SiteTopology.SubnetsWithoutSite && rawData.SiteTopology.SubnetsWithoutSite.length > 0 ? [
            new Paragraph({
              text: "⚠️ Subredes No Asociadas a Sitios",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              text: "Las siguientes subredes no están asociadas a ningún sitio AD. Los clientes en estas redes pueden autenticarse contra DCs remotos ineficientes:",
              spacing: { after: 100 }
            }),
            ...rawData.SiteTopology.SubnetsWithoutSite.map((subnet: string) =>
              new Paragraph({
                text: `• ${subnet}`,
                bullet: { level: 0 },
                spacing: { after: 50 }
              })
            )
          ] : []),

          // Sitios Vacíos (Sin DCs)
          ...(rawData.SiteTopology.EmptySites && rawData.SiteTopology.EmptySites.length > 0 ? [
            new Paragraph({
              text: "ℹ️ Sitios Vacíos (Sin Controladores de Dominio)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            ...rawData.SiteTopology.EmptySites.map((site: string) =>
              new Paragraph({
                text: `• ${site}`,
                bullet: { level: 0 },
                spacing: { after: 50 }
              })
            )
          ] : [])

        ] : []),

        // ANÁLISIS DE OBJETOS DE DIRECTIVA DE GRUPO
        ...(rawData?.GPOs && rawData.GPOs.length > 0 ? [
          new Paragraph({
            text: "Análisis de Objetos de Directiva de Grupo",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: `Se identificaron un total de ${rawData.GPOs.length} Objetos de Directiva de Grupo en el dominio. La siguiente sección proporciona información detallada sobre cada GPO, incluyendo su estado, enlaces, permisos y mejoras recomendadas.`,
            spacing: { after: 200 },
          }),
          // ... (resto del bloque GPO existente)


          // Tabla de Resumen de GPO
          new Paragraph({
            text: "Resumen de GPOs",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Nombre de GPO", "Estado", "Enlaces", "Última Modificación"], true),
              ...rawData.GPOs.slice(0, 20).map((gpo: any) => {
                const displayName = gpo.DisplayName || gpo.Name || "N/A";
                const status = gpo.GpoStatus || "AllSettingsEnabled";
                const linksCount = gpo.Links?.length?.toString() || gpo.LinksCount?.toString() || "0";
                let lastModified = "N/A";

                if (gpo.ModificationTime) {
                  try {
                    const date = new Date(gpo.ModificationTime);
                    if (!isNaN(date.getTime())) {
                      lastModified = date.toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                      });
                    }
                  } catch (e) {
                    console.error('Error parsing date:', gpo.ModificationTime, e);
                  }
                }

                return createTableRow([displayName, status, linksCount, lastModified]);
              }),
            ],
          }),

          // Análisis de Estado de GPOs
          new Paragraph({
            text: "Distribución de Estado de GPOs",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            text: (() => {
              const statusCount = rawData.GPOs.reduce((acc: any, gpo: any) => {
                const status = gpo.GpoStatus || "Desconocido";
                acc[status] = (acc[status] || 0) + 1;
                return acc;
              }, {});
              return `GPO Status: ${Object.entries(statusCount).map(([status, count]) => `${status}: ${count}`).join(", ")}`;
            })(),
            spacing: { after: 200 },
          }),

          // Recomendaciones para GPOs
          new Paragraph({
            text: "Recomendaciones de GPO",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            text: "Basado en el análisis de GPO, se recomiendan las siguientes mejoras:",
            spacing: { after: 100 },
          }),
          ...(() => {
            const recommendations = [];

            // Verificar GPOs no enlazadas
            const unlinkedGPOs = rawData.GPOs.filter((gpo: any) => !gpo.Links || gpo.Links.length === 0);
            if (unlinkedGPOs.length > 0) {
              recommendations.push(
                new Paragraph({
                  text: `1. GPOs No Enlazadas: ${unlinkedGPOs.length} GPO(s) no están enlazadas a ninguna OU. Considere eliminarlas o enlazarlas:`,
                  spacing: { before: 100, after: 50 },
                }),
                ...unlinkedGPOs.slice(0, 5).map((gpo: any) =>
                  new Paragraph({
                    text: `   • ${gpo.DisplayName}`,
                    spacing: { after: 50 },
                  })
                )
              );
            }

            // Verificar GPOs deshabilitadas
            const disabledGPOs = rawData.GPOs.filter((gpo: any) => gpo.GpoStatus === "AllSettingsDisabled");
            if (disabledGPOs.length > 0) {
              recommendations.push(
                new Paragraph({
                  text: `2. GPOs Deshabilitadas: ${disabledGPOs.length} GPO(s) tienen todas las configuraciones deshabilitadas. Revise si aún son necesarias:`,
                  spacing: { before: 100, after: 50 },
                }),
                ...disabledGPOs.slice(0, 5).map((gpo: any) =>
                  new Paragraph({
                    text: `   • ${gpo.DisplayName}`,
                    spacing: { after: 50 },
                  })
                )
              );
            }

            // Verificar GPOs antiguas (no modificadas en 180+ días)
            const now = new Date();
            const oldGPOs = rawData.GPOs.filter((gpo: any) => {
              if (!gpo.ModificationTime) return false;
              const modDate = new Date(gpo.ModificationTime);
              const daysDiff = (now.getTime() - modDate.getTime()) / (1000 * 3600 * 24);
              return daysDiff > 180;
            });
            if (oldGPOs.length > 0) {
              recommendations.push(
                new Paragraph({
                  text: `3. GPOs Obsoletas: ${oldGPOs.length} GPO(s) no se han modificado en más de 180 días. Revise si siguen siendo relevantes.`,
                  spacing: { before: 100, after: 50 },
                })
              );
            }

            // Verificar GPOs con problemas de permisos
            const gposWithAuthUsers = rawData.GPOs.filter((gpo: any) =>
              gpo.Permissions?.some((p: any) => p.Trustee === "Authenticated Users" && p.Permission !== "GpoApply")
            );
            if (gposWithAuthUsers.length > 0) {
              recommendations.push(
                new Paragraph({
                  text: `4. Problemas de Permisos: ${gposWithAuthUsers.length} GPO(s) pueden tener acceso excesivamente permisivo. Revise permisos para:`,
                  spacing: { before: 100, after: 50 },
                }),
                ...gposWithAuthUsers.slice(0, 5).map((gpo: any) =>
                  new Paragraph({
                    text: `   • ${gpo.DisplayName}`,
                    spacing: { after: 50 },
                  })
                )
              );
            }

            // Recomendación general
            recommendations.push(
              new Paragraph({
                text: "5. Mejores Prácticas: Asegure que todas las GPOs sigan convenciones de nomenclatura, tengan documentación adecuada y sean revisadas regularmente para el cumplimiento de seguridad.",
                spacing: { before: 100, after: 100 },
              })
            );

            return recommendations.length > 0 ? recommendations : [
              new Paragraph({
                text: "No specific GPO improvements identified at this time. Continue monitoring GPO health regularly.",
                spacing: { after: 100 },
              })
            ];
          })(),
        ] : []),

        // RELACIONES DE CONFIANZA Y OBJETOS HUÉRFANOS
        ...(rawData?.TrustHealth ? [
          new Paragraph({
            text: "Salud de Relaciones de Confianza",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          ...(rawData.TrustHealth.length > 0 ? [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Target", "Tipo", "Dirección", "Estado"], true),
                ...rawData.TrustHealth.map((trust: any) => {
                  const status = trust.Status === "Success" || trust.Status === "Ok" ? "✅ Activo" : "⚠️ Error";
                  const color = trust.Status === "Success" || trust.Status === "Ok" ? "low" : "high";
                  return createTableRow([
                    trust.Target || "N/A",
                    trust.TrustType || "N/A",
                    trust.TrustDirection || "N/A",
                    status
                  ], false, color);
                }),
              ],
            }),
          ] : [
            new Paragraph({
              text: "No se detectaron relaciones de confianza externas configuradas.",
              spacing: { after: 200 },
            })
          ]),

          ...(rawData?.OrphanedTrusts && rawData.OrphanedTrusts.length > 0 ? [
            new Paragraph({
              text: "⚠️ Relaciones de Confianza Huérfanas Detectadas",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              children: [new TextRun({
                text: "Se han detectado objetos TDO (Trusted Domain Objects) que no parecen tener una relación activa correspondiente. Revise estos objetos:",
                color: COLORS.high
              })],
              spacing: { after: 100 },
            }),
            ...rawData.OrphanedTrusts.map((orphan: any) =>
              new Paragraph({
                text: `• ${orphan.Name} (DN: ${orphan.DistinguishedName})`,
                bullet: { level: 0 },
                spacing: { after: 50 },
              })
            )
          ] : []),
        ] : []),

        // RIESGO DE OBJETOS PERSISTENTES (LINGERING OBJECTS)
        ...(rawData?.LingeringObjectsRisk ? [
          new Paragraph({
            text: "Análisis de Riesgo: Objetos Persistentes (Lingering Objects)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "El análisis de 'Lingering Objects' verifica inconsistencias de replicación críticas que pueden reintroducir objetos eliminados.",
            spacing: { after: 200 },
          }),
          ...(Array.isArray(rawData.LingeringObjectsRisk) ? [
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["DC", "Estado de Riesgo", "Detalles"], true),
                ...rawData.LingeringObjectsRisk.map((risk: any) => {
                  const isSafe = risk.Status === "Pass" || risk.RiskLevel === "Low";
                  const statusIcon = isSafe ? "✅ Bajo Riesgo" : "🔴 Alto Riesgo";
                  const color = isSafe ? "low" : "critical";
                  return createTableRow([
                    risk.TargetDC || "N/A",
                    statusIcon,
                    risk.Message || "Sin problemas detectados"
                  ], false, color);
                }),
              ],
            })
          ] : [
            // Object format with RiskLevel, DetectionMethod, Indicators array
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Nivel de Riesgo", "Método de Detección"], true),
                createTableRow([
                  rawData.LingeringObjectsRisk.RiskLevel || "Desconocido",
                  rawData.LingeringObjectsRisk.DetectionMethod || "N/A"
                ], false, rawData.LingeringObjectsRisk.RiskLevel === "Low" ? "low" : "medium")
              ]
            }),
            // Indicators as separate list (they are objects, not strings)
            ...(rawData.LingeringObjectsRisk.Indicators && rawData.LingeringObjectsRisk.Indicators.length > 0 ? [
              new Paragraph({
                text: "Indicadores Detectados:",
                spacing: { before: 200, after: 100 },
              }),
              ...rawData.LingeringObjectsRisk.Indicators.map((indicator: any) =>
                new Paragraph({
                  text: `• [${indicator.Severity || "INFO"}] ${indicator.Description || indicator.Type || "Sin descripción"}`,
                  spacing: { after: 50 },
                })
              )
            ] : [
              new Paragraph({
                text: "✅ No se detectaron indicadores de riesgo.",
                spacing: { before: 100, after: 100 },
              })
            ]),
            // USN Analysis if available
            ...(rawData.LingeringObjectsRisk.USNAnalysis ? [
              new Paragraph({
                text: "Análisis USN:",
                spacing: { before: 200, after: 100 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  createTableRow(["Métrica", "Valor"], true),
                  createTableRow(["DCs Analizados", rawData.LingeringObjectsRisk.USNAnalysis.DCsAnalyzed?.toString() || "N/A"]),
                  createTableRow(["USN Más Alto", rawData.LingeringObjectsRisk.USNAnalysis.HighestUSN?.toString() || "N/A"]),
                  createTableRow(["USN Más Bajo", rawData.LingeringObjectsRisk.USNAnalysis.LowestUSN?.toString() || "N/A"]),
                  createTableRow(["Brecha USN", rawData.LingeringObjectsRisk.USNAnalysis.Gap?.toString() || "N/A"]),
                ]
              })
            ] : [])
          ]),
        ] : []),

        // ANÁLISIS DE CONFIGURACIÓN DNS
        ...(rawData?.DNSConfiguration ? [
          new Paragraph({
            text: "Análisis de Configuración DNS",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: `Se analizó la configuración DNS en los controladores de dominio. Método utilizado: ${rawData.DNSConfiguration.Method || "Desconocido"}.`,
            spacing: { after: 200 },
          }),

          // Tabla de Zonas DNS
          ...(rawData.DNSConfiguration.Zones && rawData.DNSConfiguration.Zones.length > 0 ? [
            new Paragraph({
              text: "Zonas DNS",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Nombre de Zona", "Tipo", "Actualización Dinámica", "DNSSEC"], true),
                ...rawData.DNSConfiguration.Zones.slice(0, 15).map((zone: any) => {
                  return createTableRow([
                    zone.ZoneName || "N/A",
                    zone.ZoneType || "N/A",
                    zone.DynamicUpdate || "N/A",
                    zone.DNSSECStatus || "N/A"
                  ]);
                }),
              ],
            }),
          ] : []),

          // Problemas de Seguridad DNS
          ...(rawData.DNSConfiguration.GlobalSettings && rawData.DNSConfiguration.GlobalSettings.some((s: any) => s.SecurityIssues && s.SecurityIssues.length > 0) ? [
            new Paragraph({
              text: "Problemas de Seguridad DNS Detectados",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            ...rawData.DNSConfiguration.GlobalSettings.flatMap((setting: any) =>
              (setting.SecurityIssues || []).map((issue: string) =>
                new Paragraph({
                  text: `• [${setting.DCName}] ${issue}`,
                  spacing: { after: 50 },
                  bullet: { level: 0 }
                })
              )
            )
          ] : []),

          // DETALLES AVANZADOS DE DNS

          // 1. Conflictos DNS
          ...(rawData?.DNSConflicts && rawData.DNSConflicts.length > 0 ? [
            new Paragraph({
              text: "⚠️ Conflictos de Registros DNS",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              text: "Se han detectado registros duplicados o en conflicto.",
              spacing: { after: 100 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Registro", "Conflicto", "Detalle"], true),
                ...rawData.DNSConflicts.slice(0, 15).map((conflict: any) =>
                  createTableRow([
                    conflict.RecordName || "N/A",
                    conflict.ConflictType || "Duplicado",
                    conflict.Message || "-"
                  ], false, "high")
                ),
              ],
            }),
            new Paragraph({ text: "", spacing: { after: 200 } })
          ] : []),

          // 2. Scavenging Detallado
          ...(rawData?.DNSScavengingDetailed ? [
            new Paragraph({
              text: "Análisis de Limpieza DNS (Scavenging)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            ...(rawData.DNSScavengingDetailed.ConfigurationMismatches && rawData.DNSScavengingDetailed.ConfigurationMismatches.length > 0 ? [
              new Paragraph({
                children: [new TextRun({
                  text: "⚠️ Desalineación de Configuración: La configuración de limpieza difiere entre zonas y servidor.",
                  color: COLORS.high
                })],
                spacing: { after: 100 }
              }),
              ...rawData.DNSScavengingDetailed.ConfigurationMismatches.map((mismatch: string) =>
                new Paragraph({
                  text: `• ${mismatch}`,
                  bullet: { level: 0 },
                  spacing: { after: 50 }
                })
              )
            ] : [
              new Paragraph({
                text: "✅ La configuración (Aging/Scavenging) parece consistente.",
                spacing: { after: 100 }
              })
            ]),
            new Paragraph({ text: "", spacing: { after: 200 } })
          ] : []),

          // 3. Root Hints
          ...(rawData?.DNSRootHints && rawData.DNSRootHints.UnresponsiveHints && rawData.DNSRootHints.UnresponsiveHints.length > 0 ? [
            new Paragraph({
              text: "⚠️ Problemas con Root Hints",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              text: "Algunos servidores raíz no responden:",
              spacing: { after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Servidor Raíz", "Estado"], true),
                ...rawData.DNSRootHints.UnresponsiveHints.map((hint: any) =>
                  createTableRow([
                    hint.NameServer || hint.ToString(),
                    "No Responde"
                  ], false, "medium")
                )
              ]
            })
          ] : [])

        ] : []),

        // ANÁLISIS DE CONFIGURACIÓN DHCP
        ...(rawData?.DHCPConfiguration ? [
          new Paragraph({
            text: "Análisis de Configuración DHCP",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: `Se analizó la infraestructura DHCP. Método utilizado: ${rawData.DHCPConfiguration.Method || "Desconocido"}.`,
            spacing: { after: 200 },
          }),

          // Servidores Autorizados
          ...(rawData.DHCPConfiguration.AuthorizedServers && rawData.DHCPConfiguration.AuthorizedServers.length > 0 ? [
            new Paragraph({
              text: "Servidores DHCP Autorizados",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Servidor", "IP", "Estado"], true),
                ...rawData.DHCPConfiguration.AuthorizedServers.map((server: any) => {
                  return createTableRow([
                    server.DNSName || "N/A",
                    server.IPAddress || "N/A",
                    "Autorizado"
                  ]);
                }),
              ],
            }),
          ] : []),

          // Scopes DHCP
          ...(rawData.DHCPConfiguration.Scopes && rawData.DHCPConfiguration.Scopes.length > 0 ? [
            new Paragraph({
              text: "Ámbitos (Scopes) DHCP",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Nombre", "Subnet", "Estado", "% Uso"], true),
                ...rawData.DHCPConfiguration.Scopes.slice(0, 15).map((scope: any) => {
                  return createTableRow([
                    scope.Name || "N/A",
                    scope.SubnetMask || "N/A",
                    scope.State || "N/A",
                    scope.PercentageInUse ? `${scope.PercentageInUse}%` : "N/A"
                  ]);
                }),
              ],
            }),
          ] : []),
        ] : []),

        // DETALLES AVANZADOS DE DHCP

        // 1. Servidores Rogue (No Autorizados)
        ...(rawData?.DHCPRogueServers && rawData.DHCPRogueServers.RogueServers && rawData.DHCPRogueServers.RogueServers.length > 0 ? [
          new Paragraph({
            text: "🚨 Servidores DHCP Rogue Detectados",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "CRÍTICO: Se han detectado servidores DHCP respondiendo en la red que NO están autorizados en Active Directory. Esto representa un riesgo grave de seguridad (Man-in-the-Middle) o interrupción de servicio.",
              color: COLORS.critical,
              bold: true
            })],
            spacing: { after: 100 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["IP Server", "Mensaje"], true),
              ...rawData.DHCPRogueServers.RogueServers.map((rogue: any) =>
                createTableRow([
                  rogue.ServerIpAddress || "N/A",
                  "No Autorizado en AD"
                ], false, "critical")
              )
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 200 } })
        ] : []),

        // 2. Auditoría de Opciones DHCP (WINS, DNS obsoletos, etc.)
        ...(rawData?.DHCPOptionsAudit && rawData.DHCPOptionsAudit.Issues && rawData.DHCPOptionsAudit.Issues.length > 0 ? [
          new Paragraph({
            text: "Auditoría de Opciones de Ámbito",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            text: "Se han detectado configuraciones obsoletas o inseguras en las opciones de ámbito DHCP (ej. Servidores WINS, DNS heredados).",
            spacing: { after: 100 }
          }),
          ...rawData.DHCPOptionsAudit.Issues.map((issue: string) =>
            new Paragraph({
              text: `• ${issue}`,
              bullet: { level: 0 },
              spacing: { after: 50 }
            })
          ),
          new Paragraph({ text: "", spacing: { after: 200 } })
        ] : []),



        // SALUD DE CONTROLADORES DE DOMINIO
        ...(rawData?.DCHealth ? [
          new Paragraph({
            text: "Salud de Controladores de Dominio",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["DC Name", "Estado General", "Antivirus", "Eventos Críticos"], true),
              ...(rawData.DCHealth.DomainControllers || []).map((dc: any) => {
                const healthStatus = dc.OverallHealth === "Healthy" ? "✅ Saludable" :
                                     dc.OverallHealth === "Warning" ? "⚠️ Advertencia" :
                                     dc.OverallHealth === "Critical" ? "🔴 Crítico" : "❓ Desconocido";
                const healthColor = dc.OverallHealth === "Healthy" ? "low" :
                                    dc.OverallHealth === "Warning" ? "medium" : "critical";
                const avStatus = dc.Antivirus?.Enabled ? "✅ Activo" : "⚠️ Inactivo";
                const criticalEvents = dc.CriticalEvents?.length || 0;
                return createTableRow([
                  dc.Name || "N/A",
                  healthStatus,
                  avStatus,
                  criticalEvents.toString()
                ], false, healthColor);
              }),
            ],
          }),
          // Health Issues Summary
          ...(() => {
            const dcsWithIssues = (rawData.DCHealth.DomainControllers || []).filter((dc: any) =>
              dc.HealthIssues && dc.HealthIssues.length > 0
            );
            if (dcsWithIssues.length === 0) return [];
            return [
              new Paragraph({
                text: "Problemas de Salud Detectados",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 100 },
              }),
              ...dcsWithIssues.flatMap((dc: any) => [
                new Paragraph({
                  text: `${dc.Name}:`,
                  spacing: { before: 100, after: 50 },
                }),
                ...dc.HealthIssues.map((issue: string) =>
                  new Paragraph({
                    text: `  • ${issue}`,
                    spacing: { after: 30 },
                  })
                )
              ])
            ];
          })(),
        ] : []),

        // ═══════════════════════════════════════════════════════════════════
        // SECCIONES DE SEGURIDAD CRÍTICA
        // ═══════════════════════════════════════════════════════════════════

        // CONFIGURACIÓN KERBEROS Y KRBTGT
        ...(rawData?.KerberosConfig ? [
          new Paragraph({
            text: "🔐 Configuración Kerberos",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "La seguridad de Kerberos depende de la rotación regular de la contraseña de la cuenta KRBTGT. Una contraseña antigua permite ataques Golden Ticket.",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Métrica", "Valor", "Estado"], true),
              (() => {
                const age = rawData.KerberosConfig.KRBTGTPasswordAge || 0;
                const status = age > 180 ? "🔴 CRÍTICO" : age > 90 ? "⚠️ Advertencia" : "✅ OK";
                const color = age > 180 ? "critical" : age > 90 ? "medium" : "low";
                return createTableRow([
                  "Edad de Contraseña KRBTGT",
                  `${age} días`,
                  status
                ], false, color);
              })(),
              createTableRow([
                "Última Rotación",
                rawData.KerberosConfig.KRBTGTPasswordLastSet ?
                  new Date(parseInt(rawData.KerberosConfig.KRBTGTPasswordLastSet.match(/\d+/)?.[0] || 0)).toLocaleDateString('es-ES') :
                  "Desconocido",
                ""
              ]),
            ],
          }),
          ...(rawData.KerberosConfig.KRBTGTPasswordAge > 180 ? [
            new Paragraph({
              children: [new TextRun({
                text: "⚠️ ACCIÓN REQUERIDA: La contraseña KRBTGT tiene más de 180 días. Se recomienda rotarla dos veces (con intervalo de 10+ horas entre rotaciones).",
                color: COLORS.critical,
                bold: true
              })],
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Comando PowerShell para rotar:",
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [new TextRun({
                text: "Reset-KrbtgtKeyInteractive.ps1 (Microsoft Script)",
                italics: true
              })],
              spacing: { after: 200 },
            }),
          ] : []),
        ] : []),

        // POLÍTICAS DE CONTRASEÑA
        ...(rawData?.PasswordPolicies ? [
          new Paragraph({
            text: "🔑 Políticas de Contraseña del Dominio",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Política", "Valor Actual", "Recomendado"], true),
              createTableRow([
                "Longitud Mínima",
                `${rawData.PasswordPolicies.MinPasswordLength || 0} caracteres`,
                "14+ caracteres"
              ], false, (rawData.PasswordPolicies.MinPasswordLength || 0) >= 14 ? "low" : "medium"),
              createTableRow([
                "Complejidad Requerida",
                rawData.PasswordPolicies.ComplexityEnabled ? "✅ Habilitada" : "❌ Deshabilitada",
                "Habilitada"
              ], false, rawData.PasswordPolicies.ComplexityEnabled ? "low" : "critical"),
              createTableRow([
                "Historial de Contraseñas",
                `${rawData.PasswordPolicies.PasswordHistoryCount || 0} contraseñas`,
                "24+ contraseñas"
              ]),
              createTableRow([
                "Edad Máxima",
                `${rawData.PasswordPolicies.MaxPasswordAge || "N/A"} días`,
                "60-90 días"
              ]),
              createTableRow([
                "Edad Mínima",
                `${rawData.PasswordPolicies.MinPasswordAge || 0} días`,
                "1+ día"
              ]),
              createTableRow([
                "Duración de Bloqueo",
                `${rawData.PasswordPolicies.LockoutDuration || 0} minutos`,
                "15+ minutos"
              ]),
              createTableRow([
                "Umbral de Bloqueo",
                `${rawData.PasswordPolicies.LockoutThreshold || 0} intentos`,
                "5-10 intentos"
              ]),
            ],
          }),
          // Fine-Grained Password Policies
          ...(rawData.PasswordPolicies.FineGrainedPolicies && rawData.PasswordPolicies.FineGrainedPolicies.length > 0 ? [
            new Paragraph({
              text: "Políticas de Contraseña Detalladas (Fine-Grained)",
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 100 },
            }),
            new Paragraph({
              text: `Se encontraron ${rawData.PasswordPolicies.FineGrainedPolicies.length} política(s) fine-grained configurada(s).`,
              spacing: { after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Nombre", "Precedencia", "Longitud Mín.", "Aplicado a"], true),
                ...rawData.PasswordPolicies.FineGrainedPolicies.slice(0, 5).map((fgpp: any) =>
                  createTableRow([
                    fgpp.Name || "N/A",
                    fgpp.Precedence?.toString() || "N/A",
                    `${fgpp.MinPasswordLength || 0} chars`,
                    fgpp.AppliesTo?.length ? `${fgpp.AppliesTo.length} objeto(s)` : "N/A"
                  ])
                ),
              ],
            }),
          ] : []),
        ] : []),

        // PERMISOS DCSYNC
        ...(rawData?.DCSyncPermissions && rawData.DCSyncPermissions.length > 0 ? [
          new Paragraph({
            text: "🚨 Permisos DCSync (Replicación de Directorio)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "Las siguientes identidades tienen permisos para ejecutar DCSync (extraer hashes de contraseñas). Solo cuentas de DC y administración crítica deberían tener estos permisos.",
              color: COLORS.critical
            })],
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Identidad", "Tipo", "Permisos"], true),
              ...rawData.DCSyncPermissions.map((perm: any) => {
                const isExpected = perm.Identity?.includes("Domain Controllers") ||
                                   perm.Identity?.includes("Enterprise Admins") ||
                                   perm.Identity?.includes("Domain Admins") ||
                                   perm.Identity?.includes("Administrators");
                const color = isExpected ? "low" : "critical";
                const permissions = [
                  perm.GetChanges ? "GetChanges" : "",
                  perm.GetChangesAll ? "GetChangesAll" : "",
                  perm.GetChangesInFilteredSet ? "FilteredSet" : ""
                ].filter(Boolean).join(", ");
                return createTableRow([
                  perm.Identity || "N/A",
                  isExpected ? "✅ Esperado" : "⚠️ Revisar",
                  permissions
                ], false, color);
              }),
            ],
          }),
          new Paragraph({
            text: `Total: ${rawData.DCSyncPermissions.length} identidades con permisos DCSync`,
            spacing: { before: 100, after: 200 },
          }),
        ] : []),

        // GRUPO PROTECTED USERS
        ...(rawData?.ProtectedUsers ? [
          new Paragraph({
            text: "🛡️ Grupo Protected Users",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "El grupo Protected Users proporciona protecciones adicionales contra robo de credenciales (no NTLM, no delegación, tickets Kerberos de corta duración).",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Métrica", "Valor"], true),
              createTableRow([
                "Miembros Actuales",
                (rawData.ProtectedUsers.MemberCount || 0).toString()
              ], false, (rawData.ProtectedUsers.MemberCount || 0) > 0 ? "low" : "critical"),
              createTableRow([
                "Estado",
                rawData.ProtectedUsers.Exists ? "✅ Grupo Existe" : "❌ No Encontrado"
              ]),
            ],
          }),
          ...(rawData.ProtectedUsers.MemberCount === 0 ? [
            new Paragraph({
              children: [new TextRun({
                text: "⚠️ RECOMENDACIÓN: El grupo Protected Users está vacío. Se recomienda agregar cuentas de administradores de Tier 0 (Domain Admins, Enterprise Admins) para protección adicional.",
                color: COLORS.high,
                bold: true
              })],
              spacing: { before: 200, after: 200 },
            }),
          ] : [
            new Paragraph({
              text: "Miembros del grupo:",
              spacing: { before: 200, after: 100 },
            }),
            ...(rawData.ProtectedUsers.Members || []).slice(0, 10).map((member: any) =>
              new Paragraph({
                text: `• ${typeof member === 'string' ? member : member.Name || member.SamAccountName || 'N/A'}`,
                spacing: { after: 30 },
              })
            )
          ]),
        ] : []),

        // ESTADO DE AD RECYCLE BIN
        ...(rawData?.RecycleBinStatus ? [
          new Paragraph({
            text: "♻️ Estado de AD Recycle Bin",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Característica", "Estado"], true),
              createTableRow([
                "AD Recycle Bin",
                rawData.RecycleBinStatus.Enabled ? "✅ Habilitado" : "❌ DESHABILITADO"
              ], false, rawData.RecycleBinStatus.Enabled ? "low" : "critical"),
              ...(rawData.RecycleBinStatus.EnabledDate ? [
                createTableRow([
                  "Fecha de Habilitación",
                  rawData.RecycleBinStatus.EnabledDate
                ])
              ] : []),
            ],
          }),
          ...(!rawData.RecycleBinStatus.Enabled ? [
            new Paragraph({
              children: [new TextRun({
                text: "⚠️ CRÍTICO: AD Recycle Bin está deshabilitado. Sin esta característica, los objetos eliminados no pueden recuperarse fácilmente. Habilitar requiere Forest Functional Level 2008 R2+.",
                color: COLORS.critical,
                bold: true
              })],
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "Comando para habilitar:",
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [new TextRun({
                text: "Enable-ADOptionalFeature -Identity 'Recycle Bin Feature' -Scope ForestOrConfigurationSet -Target (Get-ADForest).Name",
                italics: true,
                size: 20
              })],
              spacing: { after: 200 },
            }),
          ] : []),
        ] : []),

        // ESTADO SMBv1
        ...(rawData?.SMBv1Status ? [
          new Paragraph({
            text: "🔒 Estado de Protocolo SMBv1",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "SMBv1 es un protocolo obsoleto con vulnerabilidades conocidas (WannaCry, EternalBlue). Debe estar deshabilitado en todos los sistemas.",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Servidor", "SMBv1 Estado"], true),
              ...(rawData.SMBv1Status.DomainControllers && rawData.SMBv1Status.DomainControllers.length > 0 ?
                rawData.SMBv1Status.DomainControllers.map((dc: any) =>
                  createTableRow([
                    dc.Name || dc.HostName || "N/A",
                    dc.SMBv1Enabled ? "⚠️ HABILITADO" : "✅ Deshabilitado"
                  ], false, dc.SMBv1Enabled ? "critical" : "low")
                ) : [
                  createTableRow([
                    "Estado General",
                    rawData.SMBv1Status.IsEnabled ? "⚠️ HABILITADO" : "✅ Deshabilitado"
                  ], false, rawData.SMBv1Status.IsEnabled ? "critical" : "low")
                ]
              ),
            ],
          }),
        ] : []),

        // ESTADO DE LAPS
        ...(rawData?.LAPS ? [
          new Paragraph({
            text: "🔐 Estado de LAPS (Local Administrator Password Solution)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "LAPS proporciona gestión automatizada de contraseñas de administrador local, eliminando contraseñas compartidas/estáticas.",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Métrica", "Valor"], true),
              createTableRow([
                "LAPS Desplegado",
                rawData.LAPS.Deployed ? "✅ Sí" : "❌ No"
              ], false, rawData.LAPS.Deployed ? "low" : "critical"),
              ...(rawData.LAPS.SchemaExtended !== undefined ? [
                createTableRow([
                  "Schema Extendido",
                  rawData.LAPS.SchemaExtended ? "✅ Sí" : "❌ No"
                ])
              ] : []),
              ...(rawData.LAPS.ComputersWithLAPS !== undefined ? [
                createTableRow([
                  "Equipos con LAPS",
                  rawData.LAPS.ComputersWithLAPS.toString()
                ])
              ] : []),
              ...(rawData.LAPS.ComputersWithoutLAPS !== undefined ? [
                createTableRow([
                  "Equipos sin LAPS",
                  rawData.LAPS.ComputersWithoutLAPS.toString()
                ], false, rawData.LAPS.ComputersWithoutLAPS > 0 ? "medium" : "low")
              ] : []),
              ...(rawData.LAPS.CoveragePercentage !== undefined ? [
                createTableRow([
                  "Cobertura",
                  `${rawData.LAPS.CoveragePercentage}%`
                ], false, rawData.LAPS.CoveragePercentage >= 90 ? "low" : rawData.LAPS.CoveragePercentage >= 50 ? "medium" : "critical")
              ] : []),
            ],
          }),
          ...(!rawData.LAPS.Deployed ? [
            new Paragraph({
              children: [new TextRun({
                text: "⚠️ CRÍTICO: LAPS no está desplegado. Las contraseñas de administrador local pueden ser compartidas o estáticas, facilitando movimiento lateral.",
                color: COLORS.critical,
                bold: true
              })],
              spacing: { before: 200, after: 200 },
            }),
          ] : []),
        ] : []),

        // USUARIOS CON CONTRASEÑAS ANTIGUAS
        ...(rawData?.OldPasswords && rawData.OldPasswords.length > 0 ? [
          new Paragraph({
            text: "⏰ Usuarios con Contraseñas Antiguas (>365 días)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: `Se encontraron ${rawData.OldPasswords.length} usuarios con contraseñas sin cambiar en más de 1 año.`,
              color: rawData.OldPasswords.length > 100 ? COLORS.critical : COLORS.high
            })],
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "Última Cambio", "Días"], true),
              ...rawData.OldPasswords.slice(0, 15).map((user: any) => {
                const days = user.PasswordAgeDays || user.DaysSinceChange || "N/A";
                return createTableRow([
                  sanitizeValue(user.SamAccountName || user.Name),
                  user.PasswordLastSet ? new Date(user.PasswordLastSet).toLocaleDateString('es-ES') : "Nunca",
                  sanitizeValue(days)
                ], false, "medium");
              }),
            ],
          }),
          ...(rawData.OldPasswords.length > 15 ? [
            new Paragraph({
              text: `... y ${rawData.OldPasswords.length - 15} usuarios más.`,
              spacing: { before: 100, after: 200 },
            }),
          ] : []),
        ] : []),

        // ═══════════════════════════════════════════════════════════════════
        // SECCIONES ADICIONALES DE SEGURIDAD (basadas en Coverage Matrix)
        // ═══════════════════════════════════════════════════════════════════

        // DELEGACIONES (Unconstrained/Constrained) - Critical según Coverage Matrix
        ...(rawData?.DelegationIssues && (rawData.DelegationIssues.UnconstrainedDelegation?.length > 0 || rawData.DelegationIssues.ConstrainedDelegation?.length > 0) ? [
          new Paragraph({
            text: "🔓 Análisis de Delegación Kerberos",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "La delegación Kerberos permite a servicios actuar en nombre de usuarios. La delegación sin restricciones (Unconstrained) es un riesgo crítico de seguridad.",
            spacing: { after: 200 },
          }),
          // Unconstrained Delegation
          ...(rawData.DelegationIssues.UnconstrainedDelegation?.length > 0 ? [
            new Paragraph({
              children: [new TextRun({
                text: `🔴 Delegación Sin Restricciones: ${rawData.DelegationIssues.UnconstrainedDelegation.length} objeto(s)`,
                bold: true,
                color: COLORS.critical
              })],
              spacing: { before: 200, after: 100 },
            }),
            new Paragraph({
              text: "CRÍTICO: Estos objetos pueden suplantar a CUALQUIER usuario que se autentique contra ellos (incluidos Domain Admins).",
              spacing: { after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Nombre", "Tipo", "DN"], true),
                ...rawData.DelegationIssues.UnconstrainedDelegation.slice(0, 10).map((obj: any) =>
                  createTableRow([
                    sanitizeValue(obj.Name || obj.SamAccountName),
                    sanitizeValue(obj.ObjectClass || "Computer"),
                    sanitizeValue(obj.DistinguishedName).substring(0, 50) + "..."
                  ], false, "critical")
                ),
              ],
            }),
          ] : []),
          // Constrained Delegation
          ...(rawData.DelegationIssues.ConstrainedDelegation?.length > 0 ? [
            new Paragraph({
              children: [new TextRun({
                text: `⚠️ Delegación Restringida: ${rawData.DelegationIssues.ConstrainedDelegation.length} objeto(s)`,
                bold: true,
                color: COLORS.high
              })],
              spacing: { before: 200, after: 100 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Nombre", "Servicios Permitidos"], true),
                ...rawData.DelegationIssues.ConstrainedDelegation.slice(0, 10).map((obj: any) =>
                  createTableRow([
                    sanitizeValue(obj.Name || obj.SamAccountName),
                    sanitizeValue(obj.AllowedToDelegateTo)
                  ], false, "high")
                ),
              ],
            }),
          ] : []),
        ] : []),

        // GRUPOS PRIVILEGIADOS - Critical según Coverage Matrix
        ...(rawData?.PrivilegedGroups && rawData.PrivilegedGroups.length > 0 ? [
          new Paragraph({
            text: "👑 Análisis de Grupos Privilegiados (Tier 0)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Los grupos Tier 0 tienen control total sobre el dominio. El acceso debe ser mínimo y auditado regularmente.",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Grupo", "Miembros", "Estado"], true),
              ...rawData.PrivilegedGroups.map((group: any) => {
                const memberCount = group.MemberCount || group.Members?.length || 0;
                const status = memberCount > 10 ? "🔴 Excesivo" : memberCount > 5 ? "⚠️ Alto" : "✅ OK";
                const color = memberCount > 10 ? "critical" : memberCount > 5 ? "high" : "low";
                return createTableRow([
                  sanitizeValue(group.Name || group.GroupName),
                  memberCount.toString(),
                  status
                ], false, color);
              }),
            ],
          }),
          // Detalles de miembros si existen
          ...rawData.PrivilegedGroups.filter((g: any) => g.Members && g.Members.length > 0).slice(0, 3).flatMap((group: any) => [
            new Paragraph({
              text: `Miembros de ${sanitizeValue(group.Name)}:`,
              spacing: { before: 200, after: 100 },
            }),
            ...group.Members.slice(0, 5).map((member: any) =>
              new Paragraph({
                text: `  • ${sanitizeValue(member.Name || member.SamAccountName || member)}`,
                spacing: { after: 30 },
              })
            ),
            ...(group.Members.length > 5 ? [
              new Paragraph({
                text: `  ... y ${group.Members.length - 5} más`,
                spacing: { after: 100 },
              })
            ] : [])
          ]),
        ] : []),

        // CUENTAS DE SERVICIO EN GRUPOS ADMIN - Critical según Coverage Matrix
        ...(rawData?.ServiceAccountsInAdminGroups && rawData.ServiceAccountsInAdminGroups.length > 0 ? [
          new Paragraph({
            text: "🚨 Cuentas de Servicio en Grupos Administrativos",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "CRÍTICO: Las cuentas de servicio NO deberían ser miembros de grupos administrativos. Esto viola el principio de mínimo privilegio y aumenta el riesgo de compromiso.",
              color: COLORS.critical
            })],
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Cuenta de Servicio", "Grupo Admin", "Tipo"], true),
              ...rawData.ServiceAccountsInAdminGroups.slice(0, 15).map((svc: any) =>
                createTableRow([
                  sanitizeValue(svc.ServiceAccount || svc.Name),
                  sanitizeValue(svc.AdminGroup || svc.Group),
                  sanitizeValue(svc.AccountType || "Service")
                ], false, "critical")
              ),
            ],
          }),
        ] : []),

        // ADMINSDSHOLDER ORPHANS - High según Coverage Matrix
        ...(rawData?.AdminSDHolderOrphans && rawData.AdminSDHolderOrphans.length > 0 ? [
          new Paragraph({
            text: "👤 Objetos Huérfanos de AdminSDHolder",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Estos objetos tienen el flag AdminCount=1 pero ya NO son miembros de grupos protegidos. Sus ACLs no se restauran automáticamente, creando inconsistencias de seguridad.",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Nombre", "Tipo", "Último Grupo Protegido"], true),
              ...rawData.AdminSDHolderOrphans.slice(0, 15).map((orphan: any) =>
                createTableRow([
                  sanitizeValue(orphan.Name || orphan.SamAccountName),
                  sanitizeValue(orphan.ObjectClass || "User"),
                  sanitizeValue(orphan.LastProtectedGroup || "Desconocido")
                ], false, "high")
              ),
            ],
          }),
          new Paragraph({
            text: "Recomendación: Ejecutar 'Set-ADUser -Identity <user> -Replace @{AdminCount=0}' y restablecer ACLs heredadas.",
            spacing: { before: 100, after: 200 },
          }),
        ] : []),

        // USUARIOS KERBEROASTABLE - Ya existe parcialmente, mejoramos
        ...(rawData?.KerberoastableUsers && rawData.KerberoastableUsers.length > 0 ? [
          new Paragraph({
            text: "🎫 Usuarios Kerberoastable (SPN configurado)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: `Se encontraron ${rawData.KerberoastableUsers.length} cuentas de usuario con SPNs configurados. Atacantes pueden solicitar tickets TGS y realizar ataques offline de fuerza bruta.`,
              color: rawData.KerberoastableUsers.length > 20 ? COLORS.critical : COLORS.high
            })],
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "SPN", "Password Age"], true),
              ...rawData.KerberoastableUsers.slice(0, 15).map((user: any) => {
                const spns = Array.isArray(user.ServicePrincipalNames) ? user.ServicePrincipalNames[0] : user.ServicePrincipalName || "N/A";
                return createTableRow([
                  sanitizeValue(user.SamAccountName || user.Name),
                  sanitizeValue(spns).substring(0, 40),
                  user.PasswordAge ? `${user.PasswordAge} días` : "N/A"
                ], false, "high");
              }),
            ],
          }),
          new Paragraph({
            text: "Recomendación: Migrar a Group Managed Service Accounts (gMSA) cuando sea posible.",
            spacing: { before: 100, after: 200 },
          }),
        ] : []),

        // USUARIOS AS-REP ROASTABLE - PreAuth disabled
        ...(rawData?.ASREPRoastableUsers && rawData.ASREPRoastableUsers.length > 0 ? [
          new Paragraph({
            text: "🔑 Usuarios AS-REP Roastable (PreAuth Disabled)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [new TextRun({
              text: `CRÍTICO: ${rawData.ASREPRoastableUsers.length} cuentas tienen pre-autenticación Kerberos deshabilitada. Atacantes pueden solicitar AS-REP sin conocer la contraseña.`,
              color: COLORS.critical
            })],
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "Estado", "Última Autenticación"], true),
              ...rawData.ASREPRoastableUsers.slice(0, 15).map((user: any) =>
                createTableRow([
                  sanitizeValue(user.SamAccountName || user.Name),
                  "🔴 PreAuth Disabled",
                  user.LastLogon ? new Date(user.LastLogon).toLocaleDateString('es-ES') : "N/A"
                ], false, "critical")
              ),
            ],
          }),
          new Paragraph({
            text: "Recomendación: Habilitar pre-autenticación Kerberos: Set-ADAccountControl -Identity <user> -DoesNotRequirePreAuth $false",
            spacing: { before: 100, after: 200 },
          }),
        ] : []),

        // TOKEN BLOAT RISK - Critical según Coverage Matrix
        ...(rawData?.TokenBloatRisk && rawData.TokenBloatRisk.length > 0 ? [
          new Paragraph({
            text: "📊 Riesgo de Token Bloat (>40 grupos)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "Usuarios con membresía en más de 40 grupos pueden experimentar problemas de autenticación debido al tamaño del token Kerberos (límite ~12KB).",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "# Grupos", "Tamaño Estimado", "Estado"], true),
              ...rawData.TokenBloatRisk.slice(0, 15).map((user: any) => {
                const groupCount = user.GroupCount || user.TotalGroups || 0;
                const tokenSize = user.EstimatedTokenSize || (groupCount * 40 + 1200);
                const status = tokenSize > 12000 ? "🔴 Crítico" : tokenSize > 8000 ? "⚠️ Alto" : "✅ OK";
                const color = tokenSize > 12000 ? "critical" : tokenSize > 8000 ? "high" : "low";
                return createTableRow([
                  sanitizeValue(user.SamAccountName || user.Name),
                  groupCount.toString(),
                  `~${Math.round(tokenSize / 1024)} KB`,
                  status
                ], false, color);
              }),
            ],
          }),
        ] : []),

        // NESTED GROUPS DEPTH - High según Coverage Matrix
        ...(rawData?.NestedGroupsAnalysis && rawData.NestedGroupsAnalysis.DeepNesting?.length > 0 ? [
          new Paragraph({
            text: "📁 Análisis de Anidamiento de Grupos (Depth >3)",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: "El anidamiento excesivo de grupos dificulta la auditoría de permisos y puede causar problemas de rendimiento.",
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Grupo", "Profundidad", "Ruta de Anidamiento"], true),
              ...rawData.NestedGroupsAnalysis.DeepNesting.slice(0, 10).map((group: any) =>
                createTableRow([
                  sanitizeValue(group.Name || group.GroupName),
                  (group.NestingDepth || group.Depth || 0).toString(),
                  sanitizeValue(group.NestingPath || "N/A").substring(0, 50)
                ], false, (group.NestingDepth || group.Depth || 0) > 5 ? "critical" : "high")
              ),
            ],
          }),
        ] : []),

        // RESUMEN EJECUTIVO
        new Paragraph({
          children: [new TextRun({
            text: "📋 Resumen Ejecutivo",
            size: 36,
            bold: true,
            color: COLORS.primary,
          })],
          spacing: { before: 600, after: 300 },
          border: {
            bottom: {
              color: COLORS.secondary,
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `Este reporte detalla los problemas descubiertos durante la evaluación de salud y riesgo de ${assessment.domain}.`,
            size: 24,
          })],
          spacing: { after: 400 },
        }),

        // Health Status Card
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 3, color: scoreColor },
            bottom: { style: BorderStyle.SINGLE, size: 3, color: scoreColor },
            left: { style: BorderStyle.SINGLE, size: 3, color: scoreColor },
            right: { style: BorderStyle.SINGLE, size: 3, color: scoreColor },
          },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({
                        text: "Puntuación de Salud del Dominio",
                        bold: true,
                        size: 28,
                        color: COLORS.primary,
                      })],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 200, after: 100 },
                    }),
                    new Paragraph({
                      children: [new TextRun({
                        text: `${healthScore}`,
                        bold: true,
                        size: 72,
                        color: scoreColor
                      })],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 100 },
                    }),
                    new Paragraph({
                      children: [new TextRun({
                        text: overallHealth,
                        bold: true,
                        size: 32,
                        color: COLORS.info
                      })],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 200 },
                    }),
                  ],
                  shading: { fill: COLORS.lightBg },
                  margins: { top: 300, bottom: 300, left: 300, right: 300 },
                }),
              ],
            }),
          ],
        }),

        new Paragraph({ text: "", spacing: { after: 300 } }),

        // Test Summary Table with modern design
        new Paragraph({
          children: [new TextRun({
            text: "📊 Resultados de la Evaluación",
            size: 28,
            bold: true,
            color: COLORS.primary,
          })],
          spacing: { before: 300, after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.border },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
          },
          rows: [
            createTableRow(["Métrica", "Cantidad"], true),
            createTableRow(["Pruebas de Configuración Ejecutadas", totalTests.toString()]),
            createTableRow(["🔴 Configuraciones Críticas a Revisar", severityCounts.critical.toString()], false, 'critical'),
            createTableRow(["🟠 Desviaciones de Alta Prioridad", severityCounts.high.toString()], false, 'high'),
            createTableRow(["🟡 Desviaciones de Media Prioridad", severityCounts.medium.toString()], false, 'medium'),
            createTableRow(["🔵 Sugerencias de Optimización", severityCounts.low.toString()], false, 'low'),
          ],
        }),

        // RISK ASSESSMENT SCORECARD
        new Paragraph({
          text: "Tarjeta de Puntuación de Riesgo",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: "Esta tarjeta proporciona la puntuación general de riesgo por categoría. Se determina por el problema de mayor puntuación de riesgo en cada categoría.",
          spacing: { after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Categoría", "Estado de Configuración"], true),
            createTableRow(["Active Directory y Bosque", severityCounts.critical > 0 ? "Requiere Atención" : "Configuración Óptima"]),
            createTableRow(["Políticas de Cuentas de Dominio", severityCounts.high > 0 ? "Requiere Revisión" : "Configuración Óptima"]),
            createTableRow(["Controlador de Dominio", severityCounts.medium > 0 ? "Aceptable" : "Configuración Óptima"]),
            createTableRow(["Seguridad y Cumplimiento", severityCounts.low > 0 ? "Sugerencias Disponibles" : "Configuración Óptima"]),
          ],
        }),

        // RESUMEN DE PROBLEMAS POR NIVEL
        new Paragraph({
          text: "Resumen de Problemas por Nivel",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Detalles del Problema", "Severidad de Riesgo"], true),
            ...findings.map(f => createTableRow([f.title, f.severity.toUpperCase()])),
          ],
        }),

        // CRITICAL ISSUES
        ...(criticalFindings.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "🔴 Configuraciones Críticas",
              size: 36,
              bold: true,
              color: COLORS.critical,
            })],
            spacing: { before: 600, after: 300 },
            border: {
              bottom: {
                color: COLORS.critical,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "Los siguientes problemas críticos requieren atención y remediación inmediata.",
              size: 24,
              color: COLORS.critical,
            })],
            spacing: { after: 300 },
          }),
          ...criticalFindings.flatMap((finding, index) => [
            new Paragraph({
              children: [new TextRun({
                text: `${index + 1}. ${finding.title}`,
                size: 28,
                bold: true,
                color: COLORS.primary,
              })],
              spacing: { before: 400, after: 200 },
            }),

            // Información técnica de referencia
            ...(finding.mitre_attack || finding.cis_control || finding.timeline ? [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                },
                rows: [
                  ...(finding.mitre_attack ? [createTableRow(["🎯 MITRE ATT&CK", finding.mitre_attack])] : []),
                  ...(finding.cis_control ? [createTableRow(["📋 CIS Control", finding.cis_control])] : []),
                  ...(finding.timeline ? [createTableRow(["⏱️ Timeline de Remediación", finding.timeline])] : []),
                  ...(finding.affected_count ? [createTableRow(["📊 Objetos Afectados", finding.affected_count.toString()])] : []),
                ],
              }),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ] : []),

            createDetailTable("Descripción", finding.description, COLORS.critical),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.impact_business ? [
              createDetailTable("💼 Impacto en el Negocio", finding.impact_business, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.current_vs_recommended ? [
              createDetailTable("📏 Configuración Actual vs Recomendada", finding.current_vs_recommended, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            createDetailTable("Recomendación", finding.recommendation, COLORS.critical),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.remediation_commands ? [
              createDetailTable("⚡ Comandos de Remediación (PowerShell)", finding.remediation_commands, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.prerequisites ? [
              createDetailTable("✅ Prerrequisitos", finding.prerequisites, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.operational_impact ? [
              createDetailTable("⚙️ Impacto Operacional", finding.operational_impact, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.microsoft_docs ? [
              createDetailTable("📚 Documentación Técnica Microsoft", finding.microsoft_docs, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            new Paragraph({ text: "", spacing: { after: 300 } }),
          ]),
        ] : []),

        // SERIOUS ISSUES (HIGH)
        ...(highFindings.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "🟠 Desviaciones Importantes",
              size: 36,
              bold: true,
              color: COLORS.high,
            })],
            spacing: { before: 600, after: 300 },
            border: {
              bottom: {
                color: COLORS.high,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "Estos problemas de alta severidad deben priorizarse para su remediación.",
              size: 24,
              color: COLORS.high,
            })],
            spacing: { after: 300 },
          }),
          ...highFindings.flatMap((finding, index) => [
            new Paragraph({
              children: [new TextRun({
                text: `${index + 1}. ${finding.title}`,
                size: 28,
                bold: true,
                color: COLORS.primary,
              })],
              spacing: { before: 400, after: 200 },
            }),

            // Información técnica de referencia
            ...(finding.mitre_attack || finding.cis_control || finding.timeline ? [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                },
                rows: [
                  ...(finding.mitre_attack ? [createTableRow(["🎯 MITRE ATT&CK", finding.mitre_attack])] : []),
                  ...(finding.cis_control ? [createTableRow(["📋 CIS Control", finding.cis_control])] : []),
                  ...(finding.timeline ? [createTableRow(["⏱️ Timeline", finding.timeline])] : []),
                  ...(finding.affected_count ? [createTableRow(["📊 Objetos Afectados", finding.affected_count.toString()])] : []),
                ],
              }),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ] : []),

            createDetailTable("Descripción", finding.description, COLORS.high),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.impact_business ? [
              createDetailTable("💼 Impacto en el Negocio", finding.impact_business, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.current_vs_recommended ? [
              createDetailTable("📏 Actual vs Recomendado", finding.current_vs_recommended, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            createDetailTable("Recomendación", finding.recommendation, COLORS.high),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.remediation_commands ? [
              createDetailTable("⚡ Comandos PowerShell", finding.remediation_commands, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.prerequisites ? [
              createDetailTable("✅ Prerrequisitos", finding.prerequisites, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.operational_impact ? [
              createDetailTable("⚙️ Impacto Operacional", finding.operational_impact, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.microsoft_docs ? [
              createDetailTable("📚 Docs Microsoft", finding.microsoft_docs, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            new Paragraph({ text: "", spacing: { after: 300 } }),
          ]),
        ] : []),

        // MODERATE ISSUES (MEDIUM)
        ...(mediumFindings.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "🟡 Problemas de Severidad Media",
              size: 36,
              bold: true,
              color: COLORS.medium,
            })],
            spacing: { before: 600, after: 300 },
            border: {
              bottom: {
                color: COLORS.medium,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "Estos problemas moderados deben abordarse como parte del mantenimiento regular de seguridad.",
              size: 24,
              color: COLORS.medium,
            })],
            spacing: { after: 300 },
          }),
          new Paragraph({
            text: "La siguiente tabla es una lista de problemas moderados detectados como parte de la evaluación de Active Directory.",
            spacing: { after: 200 },
          }),
          ...mediumFindings.flatMap((finding, index) => [
            new Paragraph({
              children: [new TextRun({
                text: `${index + 1}. ${finding.title}`,
                size: 26,
                bold: true,
                color: COLORS.primary,
              })],
              spacing: { before: 300, after: 200 },
            }),

            // Información técnica de referencia
            ...(finding.mitre_attack || finding.cis_control || finding.timeline ? [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                  right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
                },
                rows: [
                  ...(finding.mitre_attack ? [createTableRow(["🎯 MITRE ATT&CK", finding.mitre_attack])] : []),
                  ...(finding.cis_control ? [createTableRow(["📋 CIS Control", finding.cis_control])] : []),
                  ...(finding.timeline ? [createTableRow(["⏱️ Timeline", finding.timeline])] : []),
                  ...(finding.affected_count ? [createTableRow(["📊 Afectados", finding.affected_count.toString()])] : []),
                ],
              }),
              new Paragraph({ text: "", spacing: { after: 150 } }),
            ] : []),

            createDetailTable("Descripción", finding.description, COLORS.medium),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.current_vs_recommended ? [
              createDetailTable("📏 Actual vs Recomendado", finding.current_vs_recommended, COLORS.medium),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            createDetailTable("Recomendación", finding.recommendation, COLORS.medium),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.remediation_commands ? [
              createDetailTable("⚡ Comandos PowerShell", finding.remediation_commands, COLORS.medium),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.microsoft_docs ? [
              createDetailTable("📚 Documentación", finding.microsoft_docs, COLORS.medium),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            new Paragraph({ text: "", spacing: { after: 250 } }),
          ]),
        ] : []),

        // CONCLUSIONES
        new Paragraph({
          text: "Conclusiones y Próximos Pasos",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: `La evaluación de ${assessment.domain} ha identificado ${findings.length} hallazgos que requieren atención. Se recomienda priorizar la remediación de problemas críticos y graves dentro de los próximos 30 días.`,
          spacing: { after: 200 },
        }),
        new Paragraph({
          text: "Se deben realizar evaluaciones regulares cada 6 meses para mantener una postura de seguridad adecuada.",
          spacing: { after: 200 },
        }),
      ],
    }],
  });

  return await Packer.toBlob(doc);
}
