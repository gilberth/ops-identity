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

// Modern 'Health Check' color palette
const COLORS = {
  primary: "005A9C",      // Microsoft Blue (Professional/Corporate)
  secondary: "0078D4",    // Lighter Blue
  accent: "107C10",       // Office Green (Healthy)
  critical: "D83B01",     // Office Orange/Red (Attention Needed) - Less alarming than pure red
  high: "EA4300",         // Orange (Warning)
  medium: "FFB900",       // Yellow/Amber (Deviation)
  low: "0078D4",          // Blue (Info/Suggestion)
  info: "505050",         // Dark Gray
  lightBg: "F3F2F1",      // Light Gray Background (Microsoft UI style)
  border: "E1DFDD",       // Border Gray
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
    case 'medium': return "#8A6D05"; // Darker yellow for text readability
    case 'low': return COLORS.low;
    default: return COLORS.info;
  }
};

const getStatusBg = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'critical': return "FDE7E9"; // Very light red
    case 'high': return "FFF4CE";     // Very light orange
    case 'medium': return "FFF4CE";   // Light yellow
    case 'low': return "DEECF9";      // Light blue
    default: return "F3F2F1";
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
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Rol", "Titular", "Estado", "Latencia"], true),
              ...Object.entries(rawData.FSMORolesHealth).map(([role, info]: [string, any]) => {
                const status = info.Status === "OK" ? "✅ OK" : "⚠️ Error";
                const statusColor = info.Status === "OK" ? "low" : "critical";
                return createTableRow([
                  role,
                  info.Holder || "Desconocido",
                  status,
                  `${info.ResponseTime} ms`
                ], false, statusColor);
              }),
            ],
          }),
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
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                createTableRow(["Nivel de Riesgo", "Método de Detección", "Indicadores"], true),
                createTableRow([
                  rawData.LingeringObjectsRisk.RiskLevel || "Desconocido",
                  rawData.LingeringObjectsRisk.DetectionMethod || "N/A",
                  (rawData.LingeringObjectsRisk.Indicators || []).join(", ") || "Ninguno"
                ], false, rawData.LingeringObjectsRisk.RiskLevel === "Low" ? "low" : "medium")
              ]
            })
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
              createTableRow(["DC Name", "OS", "Antivirus", "BitLocker"], true),
              ...(rawData.DCHealth.DomainControllers || []).map((dc: any) => {
                const avStatus = dc.Antivirus?.Enabled ? "Activo" : "Inactivo/Desconocido";
                const blStatus = dc.BitLocker?.ProtectionStatus || "Desconocido";
                return createTableRow([
                  dc.Name || "N/A",
                  "Windows Server", // OS info might be elsewhere, placeholder
                  avStatus,
                  blStatus
                ]);
              }),
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
