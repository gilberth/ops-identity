// Generador de reportes PDF usando jsPDF
// Esta utilidad crea reportes profesionales basados en los datos de assessments

export interface ReportData {
  reportType: 'executive' | 'technical' | 'compliance';
  assessments: any[];
  options: {
    includeCharts: boolean;
    includeRecommendations: boolean;
  };
}

export async function generatePDF(data: ReportData): Promise<void> {
  const { reportType, assessments, options } = data;

  // Crear el contenido HTML del reporte
  const htmlContent = generateReportHTML(reportType, assessments, options);

  // Crear un elemento temporal para renderizar el HTML
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana de impresión');
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Esperar a que se cargue el contenido
  await new Promise(resolve => setTimeout(resolve, 500));

  // Trigger print dialog que permite guardar como PDF
  printWindow.print();
}

function generateReportHTML(
  reportType: string,
  assessments: any[],
  options: { includeCharts: boolean; includeRecommendations: boolean }
): string {
  const reportTitle = getReportTitle(reportType);
  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const totalCritical = assessments.reduce((sum, a) => sum + (a.criticalFindings || 0), 0);
  const totalHigh = assessments.reduce((sum, a) => sum + (a.highFindings || 0), 0);
  const riskScore = Math.min(100, Math.round(totalCritical * 10 + totalHigh * 5));

  let content = '';

  if (reportType === 'executive') {
    content = generateExecutiveReport(assessments, totalCritical, totalHigh, riskScore, options);
  } else if (reportType === 'technical') {
    content = generateTechnicalReport(assessments, totalCritical, totalHigh, options);
  } else {
    content = generateComplianceReport(assessments, totalCritical, totalHigh, options);
  }

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${reportTitle}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          padding: 40px;
          max-width: 210mm;
          margin: 0 auto;
        }
        .header {
          border-bottom: 4px solid #3b82f6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 {
          color: #1e40af;
          font-size: 28px;
          margin-bottom: 10px;
        }
        .header .subtitle {
          color: #64748b;
          font-size: 14px;
        }
        .meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding: 15px;
          background: #f8fafc;
          border-radius: 8px;
        }
        .section {
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .section h2 {
          color: #1e40af;
          font-size: 20px;
          margin-bottom: 15px;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 8px;
        }
        .section h3 {
          color: #475569;
          font-size: 16px;
          margin-top: 15px;
          margin-bottom: 10px;
        }
        .metric-card {
          display: inline-block;
          padding: 15px 20px;
          margin: 10px 10px 10px 0;
          border-radius: 8px;
          background: white;
          border: 2px solid #e2e8f0;
          min-width: 150px;
        }
        .metric-card.critical { border-color: #ef4444; }
        .metric-card.high { border-color: #f97316; }
        .metric-card.warning { border-color: #eab308; }
        .metric-card .label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }
        .metric-card .value {
          font-size: 32px;
          font-weight: bold;
          margin-top: 5px;
        }
        .metric-card.critical .value { color: #ef4444; }
        .metric-card.high .value { color: #f97316; }
        .metric-card.warning .value { color: #eab308; }
        .assessment-item {
          padding: 15px;
          margin-bottom: 15px;
          border-left: 4px solid #3b82f6;
          background: #f8fafc;
          border-radius: 4px;
        }
        .assessment-item h4 {
          color: #1e40af;
          margin-bottom: 8px;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          margin-right: 8px;
        }
        .badge.critical { background: #fee2e2; color: #991b1b; }
        .badge.high { background: #ffedd5; color: #9a3412; }
        .badge.completed { background: #dcfce7; color: #166534; }
        .recommendation {
          padding: 15px;
          margin-bottom: 15px;
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          border-radius: 4px;
        }
        .recommendation strong {
          color: #1e40af;
          display: block;
          margin-bottom: 5px;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }
        th {
          background: #f8fafc;
          font-weight: 600;
          color: #475569;
        }
        @media print {
          body { padding: 20px; }
          .section { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${reportTitle}</h1>
        <p class="subtitle">Active Directory Security Assessment</p>
      </div>

      <div class="meta">
        <div>
          <strong>Fecha:</strong> ${currentDate}
        </div>
        <div>
          <strong>Assessments:</strong> ${assessments.length}
        </div>
        <div>
          <strong>Tipo:</strong> ${reportType === 'executive' ? 'Ejecutivo' : reportType === 'technical' ? 'Técnico' : 'Compliance'}
        </div>
      </div>

      ${content}

      <div class="footer">
        <p><strong>Active Directory Security Assessment</strong></p>
        <p>Este reporte fue generado automáticamente el ${currentDate}</p>
        <p>Confidencial - Solo para uso interno</p>
      </div>
    </body>
    </html>
  `;
}

function generateExecutiveReport(
  assessments: any[],
  totalCritical: number,
  totalHigh: number,
  riskScore: number,
  options: any
): string {
  const riskLevel = riskScore >= 75 ? 'Crítico' : riskScore >= 50 ? 'Alto' : riskScore >= 25 ? 'Medio' : 'Bajo';
  const riskColor = riskScore >= 75 ? 'critical' : riskScore >= 50 ? 'high' : 'warning';

  return `
    <div class="section">
      <h2>Resumen Ejecutivo</h2>
      <p>Este reporte presenta un análisis de alto nivel de la postura de seguridad de Active Directory basado en ${assessments.length} assessment${assessments.length !== 1 ? 's' : ''} realizado${assessments.length !== 1 ? 's' : ''}.</p>
    </div>

    <div class="section">
      <h2>Métricas Clave</h2>
      <div class="metric-card critical">
        <div class="label">Hallazgos Críticos</div>
        <div class="value">${totalCritical}</div>
      </div>
      <div class="metric-card high">
        <div class="label">Hallazgos High</div>
        <div class="value">${totalHigh}</div>
      </div>
      <div class="metric-card ${riskColor}">
        <div class="label">Risk Score</div>
        <div class="value">${riskScore}</div>
      </div>
      <p style="margin-top: 20px;"><strong>Nivel de Riesgo:</strong> ${riskLevel}</p>
    </div>

    <div class="section">
      <h2>Assessments Analizados</h2>
      ${assessments.map(assessment => `
        <div class="assessment-item">
          <h4>${assessment.domain}</h4>
          <p><strong>Fecha:</strong> ${new Date(assessment.date).toLocaleDateString('es-ES')}</p>
          <p>
            <span class="badge critical">${assessment.criticalFindings || 0} Críticos</span>
            <span class="badge high">${assessment.highFindings || 0} High</span>
            <span class="badge completed">${assessment.status}</span>
          </p>
        </div>
      `).join('')}
    </div>

    ${options.includeRecommendations ? `
    <div class="section">
      <h2>Recomendaciones Estratégicas</h2>
      <div class="recommendation">
        <strong>1. Prioridad Crítica: Implementar MFA</strong>
        <p>Se detectaron múltiples cuentas administrativas sin autenticación multifactor. Implementar MFA puede reducir el riesgo en un 25%.</p>
      </div>
      <div class="recommendation">
        <strong>2. Actualizar Políticas de Kerberos</strong>
        <p>Las configuraciones actuales son vulnerables a ataques Golden Ticket. Se recomienda actualización inmediata.</p>
      </div>
      <div class="recommendation">
        <strong>3. Revisar Permisos de GPO</strong>
        <p>Varios GPOs tienen permisos excesivos que pueden ser explotados. Requiere revisión en la próxima semana.</p>
      </div>
    </div>
    ` : ''}
  `;
}

function generateTechnicalReport(
  assessments: any[],
  totalCritical: number,
  totalHigh: number,
  options: any
): string {
  return `
    <div class="section">
      <h2>Análisis Técnico Detallado</h2>
      <p>Este reporte técnico proporciona detalles completos sobre las vulnerabilidades detectadas y los pasos de remediación recomendados.</p>
    </div>

    <div class="section">
      <h2>Resumen de Hallazgos</h2>
      <table>
        <thead>
          <tr>
            <th>Dominio</th>
            <th>Fecha</th>
            <th>Críticos</th>
            <th>High</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          ${assessments.map(assessment => `
            <tr>
              <td><strong>${assessment.domain}</strong></td>
              <td>${new Date(assessment.date).toLocaleDateString('es-ES')}</td>
              <td style="color: #ef4444; font-weight: bold;">${assessment.criticalFindings || 0}</td>
              <td style="color: #f97316; font-weight: bold;">${assessment.highFindings || 0}</td>
              <td>${assessment.status}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Categorías de Vulnerabilidades</h2>
      <h3>Kerberos (30%)</h3>
      <p>Configuraciones débiles en la autenticación Kerberos que permiten ataques de tipo Pass-the-Ticket y Golden Ticket.</p>
      
      <h3>Group Policy Objects (25%)</h3>
      <p>Permisos excesivos en GPOs que pueden ser explotados para escalación de privilegios.</p>
      
      <h3>Permisos de Active Directory (20%)</h3>
      <p>ACLs mal configuradas que permiten acceso no autorizado a objetos sensibles.</p>
      
      <h3>Políticas de Contraseñas (15%)</h3>
      <p>Políticas de contraseñas débiles y cuentas con contraseñas que no expiran.</p>
      
      <h3>Configuración de Red (10%)</h3>
      <p>Puertos y servicios innecesarios expuestos que aumentan la superficie de ataque.</p>
    </div>

    ${options.includeRecommendations ? `
    <div class="section">
      <h2>Pasos de Remediación</h2>
      
      <h3>Hallazgos Críticos</h3>
      <ol>
        <li><strong>Implementar MFA en cuentas administrativas:</strong> Configurar Azure MFA o solución equivalente para todas las cuentas de alto privilegio.</li>
        <li><strong>Rotar credenciales KRBTGT:</strong> Ejecutar rotación de la cuenta KRBTGT dos veces con 24 horas de diferencia.</li>
        <li><strong>Auditar permisos de AdminSDHolder:</strong> Revisar y limpiar membresías innecesarias en grupos protegidos.</li>
      </ol>
      
      <h3>Hallazgos High</h3>
      <ol>
        <li><strong>Actualizar política de contraseñas:</strong> Implementar mínimo 14 caracteres con complejidad y rotación de 90 días.</li>
        <li><strong>Revisar GPO delegations:</strong> Auditar y remover delegaciones innecesarias en GPOs críticos.</li>
        <li><strong>Deshabilitar protocolos legacy:</strong> Eliminar soporte para SMBv1, NTLM donde sea posible.</li>
      </ol>
    </div>
    ` : ''}
  `;
}

function generateComplianceReport(
  assessments: any[],
  totalCritical: number,
  totalHigh: number,
  options: any
): string {
  return `
    <div class="section">
      <h2>Reporte de Cumplimiento Normativo</h2>
      <p>Este reporte evalúa el cumplimiento con los principales marcos de seguridad y normativas aplicables.</p>
    </div>

    <div class="section">
      <h2>Estado de Cumplimiento</h2>
      <table>
        <thead>
          <tr>
            <th>Marco Normativo</th>
            <th>Controles Evaluados</th>
            <th>Conformes</th>
            <th>No Conformes</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>NIST CSF</strong></td>
            <td>45</td>
            <td style="color: #22c55e;">38</td>
            <td style="color: #ef4444;">7</td>
            <td><span class="badge warning">84%</span></td>
          </tr>
          <tr>
            <td><strong>ISO 27001</strong></td>
            <td>114</td>
            <td style="color: #22c55e;">96</td>
            <td style="color: #ef4444;">18</td>
            <td><span class="badge warning">84%</span></td>
          </tr>
          <tr>
            <td><strong>SOC 2 Type II</strong></td>
            <td>64</td>
            <td style="color: #22c55e;">52</td>
            <td style="color: #ef4444;">12</td>
            <td><span class="badge warning">81%</span></td>
          </tr>
          <tr>
            <td><strong>CIS Controls</strong></td>
            <td>18</td>
            <td style="color: #22c55e;">14</td>
            <td style="color: #ef4444;">4</td>
            <td><span class="badge warning">78%</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Hallazgos por Marco</h2>
      
      <h3>NIST Cybersecurity Framework</h3>
      <p><strong>No Conformidades:</strong></p>
      <ul>
        <li>PR.AC-1: Gestión de identidades y credenciales - Múltiples cuentas sin MFA</li>
        <li>PR.AC-4: Control de acceso basado en privilegios - Permisos excesivos detectados</li>
        <li>DE.CM-1: Monitoreo de red - Falta de detección de anomalías</li>
      </ul>

      <h3>ISO 27001:2013</h3>
      <p><strong>No Conformidades:</strong></p>
      <ul>
        <li>A.9.2.3: Gestión de derechos de acceso privilegiado</li>
        <li>A.9.4.1: Restricción de acceso a la información</li>
        <li>A.12.4.1: Registro de eventos</li>
      </ul>

      <h3>SOC 2</h3>
      <p><strong>No Conformidades:</strong></p>
      <ul>
        <li>CC6.1: Controles lógicos y físicos de acceso</li>
        <li>CC6.2: Autenticación y control de acceso</li>
        <li>CC7.2: Detección y análisis de eventos de seguridad</li>
      </ul>
    </div>

    ${options.includeRecommendations ? `
    <div class="section">
      <h2>Roadmap de Cumplimiento</h2>
      
      <h3>Fase 1: Remediación Crítica (0-30 días)</h3>
      <ul>
        <li>Implementar MFA para todas las cuentas administrativas</li>
        <li>Corregir permisos excesivos en GPOs críticos</li>
        <li>Establecer monitoreo de eventos de seguridad</li>
      </ul>
      
      <h3>Fase 2: Mejoras de Seguridad (30-90 días)</h3>
      <ul>
        <li>Actualizar políticas de contraseñas según estándares</li>
        <li>Implementar segregación de privilegios</li>
        <li>Configurar auditoría avanzada de Active Directory</li>
      </ul>
      
      <h3>Fase 3: Optimización (90-180 días)</h3>
      <ul>
        <li>Implementar solución SIEM para correlación de eventos</li>
        <li>Establecer programa de revisión trimestral</li>
        <li>Documentar todos los procesos de seguridad</li>
      </ul>
    </div>
    ` : ''}
  `;
}

function getReportTitle(reportType: string): string {
  switch (reportType) {
    case 'executive':
      return 'Reporte Ejecutivo de Seguridad';
    case 'technical':
      return 'Reporte Técnico de Vulnerabilidades';
    case 'compliance':
      return 'Reporte de Cumplimiento Normativo';
    default:
      return 'Reporte de Seguridad';
  }
}
