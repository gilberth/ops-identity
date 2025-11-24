// Generador de documento Word para datos raw del Active Directory
// Convierte el JSON raw en un documento Word formateado profesionalmente

export interface RawDataDocOptions {
  domain: string;
  rawData: any;
  date: string;
}

export function generateRawDataDoc(options: RawDataDocOptions): void {
  const { domain, rawData, date } = options;
  
  // Generar HTML formateado que se puede imprimir/guardar como Word
  const htmlContent = generateFormattedHTML(domain, rawData, date);
  
  // Abrir en nueva ventana para guardar como Word
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('No se pudo abrir la ventana');
  }
  
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  
  // Esperar un momento y luego activar guardado
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

function generateFormattedHTML(domain: string, rawData: any, date: string): string {
  const currentDate = new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Anexo Técnico - Datos Raw AD - ${domain}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
          size: A4;
          margin: 2cm;
        }
        
        body {
          font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          padding: 20px;
          max-width: 210mm;
          margin: 0 auto;
          background: white;
        }
        
        .cover-page {
          text-align: center;
          padding: 100px 20px;
          page-break-after: always;
          border: 3px solid #1e40af;
          margin-bottom: 40px;
        }
        
        .cover-page h1 {
          font-size: 36px;
          color: #1e40af;
          margin-bottom: 20px;
          font-weight: bold;
        }
        
        .cover-page h2 {
          font-size: 24px;
          color: #475569;
          margin-bottom: 40px;
        }
        
        .cover-page .domain {
          font-size: 28px;
          color: #1e40af;
          font-weight: bold;
          margin: 30px 0;
          padding: 15px;
          background: #eff6ff;
          border-radius: 8px;
        }
        
        .cover-page .metadata {
          margin-top: 60px;
          font-size: 14px;
          color: #64748b;
        }
        
        .toc {
          page-break-after: always;
          margin-bottom: 40px;
        }
        
        .toc h2 {
          color: #1e40af;
          font-size: 24px;
          margin-bottom: 20px;
          border-bottom: 3px solid #1e40af;
          padding-bottom: 10px;
        }
        
        .toc ul {
          list-style: none;
          padding: 0;
        }
        
        .toc li {
          padding: 10px 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 16px;
        }
        
        .toc li::before {
          content: "▸ ";
          color: #3b82f6;
          font-weight: bold;
          margin-right: 10px;
        }
        
        .section {
          page-break-inside: avoid;
          margin-bottom: 40px;
        }
        
        .section h2 {
          color: #1e40af;
          font-size: 22px;
          margin-bottom: 15px;
          padding: 10px;
          background: #eff6ff;
          border-left: 5px solid #3b82f6;
          page-break-after: avoid;
        }
        
        .section h3 {
          color: #475569;
          font-size: 18px;
          margin: 20px 0 10px 0;
          padding-bottom: 5px;
          border-bottom: 2px solid #e2e8f0;
          page-break-after: avoid;
        }
        
        .summary-box {
          background: #f8fafc;
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
          page-break-inside: avoid;
        }
        
        .summary-box h4 {
          color: #1e40af;
          margin-bottom: 15px;
          font-size: 16px;
        }
        
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-top: 15px;
        }
        
        .summary-item {
          background: white;
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #e2e8f0;
        }
        
        .summary-item .label {
          font-size: 12px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 5px;
        }
        
        .summary-item .value {
          font-size: 24px;
          font-weight: bold;
          color: #1e40af;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          page-break-inside: auto;
          font-size: 11px;
        }
        
        thead {
          background: #1e40af;
          color: white;
        }
        
        thead th {
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          border: 1px solid #1e40af;
        }
        
        tbody tr {
          page-break-inside: avoid;
          border-bottom: 1px solid #e2e8f0;
        }
        
        tbody tr:nth-child(even) {
          background: #f8fafc;
        }
        
        tbody tr:hover {
          background: #eff6ff;
        }
        
        tbody td {
          padding: 10px 8px;
          border: 1px solid #e2e8f0;
          vertical-align: top;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          white-space: nowrap;
        }
        
        .badge.enabled { background: #dcfce7; color: #166534; }
        .badge.disabled { background: #fee2e2; color: #991b1b; }
        .badge.admin { background: #dbeafe; color: #1e40af; }
        .badge.warning { background: #fef3c7; color: #92400e; }
        
        .code-block {
          background: #1e293b;
          color: #e2e8f0;
          padding: 15px;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          overflow-x: auto;
          margin: 15px 0;
          page-break-inside: avoid;
        }
        
        .highlight {
          background: #fef3c7;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 600;
        }
        
        .note {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
          padding: 15px;
          margin: 15px 0;
          font-size: 13px;
          page-break-inside: avoid;
        }
        
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 2px solid #e2e8f0;
          text-align: center;
          color: #64748b;
          font-size: 11px;
        }
        
        @media print {
          body { padding: 0; }
          .section { page-break-inside: avoid; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
        }
      </style>
    </head>
    <body>
      <!-- Página de portada -->
      <div class="cover-page">
        <h1>ANEXO TÉCNICO</h1>
        <h2>Datos Raw del Active Directory</h2>
        <div class="domain">${domain}</div>
        <div class="metadata">
          <p><strong>Fecha de extracción:</strong> ${currentDate}</p>
          <p><strong>Tipo de documento:</strong> Anexo Técnico</p>
          <p><strong>Formato:</strong> Datos Estructurados del AD</p>
        </div>
      </div>

      <!-- Tabla de contenidos -->
      <div class="toc">
        <h2>Tabla de Contenidos</h2>
        <ul>
          <li>1. Resumen Ejecutivo de Datos</li>
          <li>2. Usuarios del Dominio</li>
          <li>3. Grupos de Seguridad</li>
          <li>4. Equipos del Dominio</li>
          <li>5. Group Policy Objects (GPOs)</li>
          <li>6. Controladores de Dominio</li>
          <li>7. Configuración de Dominio</li>
          <li>8. Datos Adicionales</li>
        </ul>
      </div>

      ${generateSummarySection(rawData)}
      ${generateUsersSection(rawData)}
      ${generateGroupsSection(rawData)}
      ${generateComputersSection(rawData)}
      ${generateGPOsSection(rawData)}
      ${generateDomainControllersSection(rawData)}
      ${generateDomainConfigSection(rawData)}
      ${generateAdditionalDataSection(rawData)}

      <div class="footer">
        <p><strong>Active Directory Security Assessment</strong></p>
        <p>Anexo Técnico - Datos Raw | Generado el ${currentDate}</p>
        <p>Documento Confidencial - Solo para uso interno</p>
      </div>
    </body>
    </html>
  `;
}

function generateSummarySection(rawData: any): string {
  const users = rawData.Users?.Data || rawData.Users || [];
  const groups = rawData.Groups?.Data || rawData.Groups || [];
  const computers = rawData.Computers?.Data || rawData.Computers || [];
  const gpos = rawData.GPOs?.Data || rawData.GPOs || [];
  const dcs = rawData.DomainControllers?.Data || rawData.DomainControllers || [];

  const enabledUsers = users.filter((u: any) => u.Enabled === true || u.Enabled === 'True').length;
  const adminUsers = groups.find((g: any) => g.Name === 'Domain Admins')?.Members?.length || 0;
  const enabledComputers = computers.filter((c: any) => c.Enabled === true || c.Enabled === 'True').length;

  return `
    <div class="section">
      <h2>1. Resumen Ejecutivo de Datos</h2>
      
      <div class="summary-box">
        <h4>Estadísticas Generales del Active Directory</h4>
        <div class="summary-grid">
          <div class="summary-item">
            <div class="label">Total Usuarios</div>
            <div class="value">${users.length}</div>
          </div>
          <div class="summary-item">
            <div class="label">Usuarios Activos</div>
            <div class="value">${enabledUsers}</div>
          </div>
          <div class="summary-item">
            <div class="label">Grupos de Seguridad</div>
            <div class="value">${groups.length}</div>
          </div>
          <div class="summary-item">
            <div class="label">Administradores</div>
            <div class="value">${adminUsers}</div>
          </div>
          <div class="summary-item">
            <div class="label">Equipos Totales</div>
            <div class="value">${computers.length}</div>
          </div>
          <div class="summary-item">
            <div class="label">Equipos Activos</div>
            <div class="value">${enabledComputers}</div>
          </div>
          <div class="summary-item">
            <div class="label">GPOs</div>
            <div class="value">${gpos.length}</div>
          </div>
          <div class="summary-item">
            <div class="label">DCs</div>
            <div class="value">${dcs.length}</div>
          </div>
        </div>
      </div>

      <div class="note">
        <strong>ℹ️ Nota:</strong> Este anexo contiene los datos raw extraídos directamente del Active Directory.
        Los datos están organizados por categorías para facilitar su análisis técnico.
      </div>
    </div>
  `;
}

function generateUsersSection(rawData: any): string {
  const users = rawData.Users?.Data || rawData.Users || [];
  
  if (users.length === 0) {
    return '<div class="section"><h2>2. Usuarios del Dominio</h2><p>No hay datos de usuarios disponibles.</p></div>';
  }

  // Limitar a primeros 100 usuarios para no exceder tamaño
  const displayUsers = users.slice(0, 100);
  const hasMore = users.length > 100;

  return `
    <div class="section">
      <h2>2. Usuarios del Dominio</h2>
      <p><strong>Total de usuarios:</strong> ${users.length}${hasMore ? ` (mostrando primeros 100)` : ''}</p>
      
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>SAM Account</th>
            <th>Email</th>
            <th>Estado</th>
            <th>Último Logon</th>
            <th>Creado</th>
          </tr>
        </thead>
        <tbody>
          ${displayUsers.map((user: any) => `
            <tr>
              <td><strong>${user.Name || user.DisplayName || 'N/A'}</strong></td>
              <td>${user.SamAccountName || 'N/A'}</td>
              <td>${user.EmailAddress || user.Mail || '-'}</td>
              <td>
                <span class="badge ${user.Enabled === true || user.Enabled === 'True' ? 'enabled' : 'disabled'}">
                  ${user.Enabled === true || user.Enabled === 'True' ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>${formatDate(user.LastLogonDate)}</td>
              <td>${formatDate(user.Created || user.WhenCreated)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${hasMore ? `<div class="note"><strong>⚠️ Nota:</strong> Solo se muestran los primeros 100 usuarios de ${users.length} totales por limitaciones de tamaño del documento.</div>` : ''}
    </div>
  `;
}

function generateGroupsSection(rawData: any): string {
  const groups = rawData.Groups?.Data || rawData.Groups || [];
  
  if (groups.length === 0) {
    return '<div class="section"><h2>3. Grupos de Seguridad</h2><p>No hay datos de grupos disponibles.</p></div>';
  }

  return `
    <div class="section">
      <h2>3. Grupos de Seguridad</h2>
      <p><strong>Total de grupos:</strong> ${groups.length}</p>
      
      <table>
        <thead>
          <tr>
            <th>Nombre del Grupo</th>
            <th>Descripción</th>
            <th>Miembros</th>
            <th>Tipo</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          ${groups.map((group: any) => {
            const isAdmin = group.Name?.toLowerCase().includes('admin');
            const memberCount = group.Members?.length || group.MemberCount || 0;
            
            return `
              <tr>
                <td>
                  <strong>${group.Name || 'N/A'}</strong>
                  ${isAdmin ? '<span class="badge admin">Admin</span>' : ''}
                </td>
                <td>${group.Description || '-'}</td>
                <td>${memberCount}</td>
                <td>${group.GroupCategory || group.Category || '-'}</td>
                <td>${group.GroupScope || group.Scope || '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateComputersSection(rawData: any): string {
  const computers = rawData.Computers?.Data || rawData.Computers || [];
  
  if (computers.length === 0) {
    return '<div class="section"><h2>4. Equipos del Dominio</h2><p>No hay datos de equipos disponibles.</p></div>';
  }

  const displayComputers = computers.slice(0, 100);
  const hasMore = computers.length > 100;

  return `
    <div class="section">
      <h2>4. Equipos del Dominio</h2>
      <p><strong>Total de equipos:</strong> ${computers.length}${hasMore ? ` (mostrando primeros 100)` : ''}</p>
      
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Sistema Operativo</th>
            <th>Versión</th>
            <th>Estado</th>
            <th>Último Logon</th>
          </tr>
        </thead>
        <tbody>
          ${displayComputers.map((computer: any) => `
            <tr>
              <td><strong>${computer.Name || computer.DNSHostName || 'N/A'}</strong></td>
              <td>${computer.OperatingSystem || '-'}</td>
              <td>${computer.OperatingSystemVersion || '-'}</td>
              <td>
                <span class="badge ${computer.Enabled === true || computer.Enabled === 'True' ? 'enabled' : 'disabled'}">
                  ${computer.Enabled === true || computer.Enabled === 'True' ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>${formatDate(computer.LastLogonDate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      ${hasMore ? `<div class="note"><strong>⚠️ Nota:</strong> Solo se muestran los primeros 100 equipos de ${computers.length} totales.</div>` : ''}
    </div>
  `;
}

function generateGPOsSection(rawData: any): string {
  const gpos = rawData.GPOs?.Data || rawData.GPOs || [];
  
  if (gpos.length === 0) {
    return '<div class="section"><h2>5. Group Policy Objects (GPOs)</h2><p>No hay datos de GPOs disponibles.</p></div>';
  }

  return `
    <div class="section">
      <h2>5. Group Policy Objects (GPOs)</h2>
      <p><strong>Total de GPOs:</strong> ${gpos.length}</p>
      
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Estado</th>
            <th>Creado</th>
            <th>Modificado</th>
            <th>Links</th>
          </tr>
        </thead>
        <tbody>
          ${gpos.map((gpo: any) => `
            <tr>
              <td><strong>${gpo.DisplayName || gpo.Name || 'N/A'}</strong></td>
              <td>
                <span class="badge ${gpo.GpoStatus?.includes('Enabled') ? 'enabled' : 'warning'}">
                  ${gpo.GpoStatus || 'N/A'}
                </span>
              </td>
              <td>${formatDate(gpo.CreationTime)}</td>
              <td>${formatDate(gpo.ModificationTime)}</td>
              <td>${gpo.LinksTo?.length || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateDomainControllersSection(rawData: any): string {
  const dcs = rawData.DomainControllers?.Data || rawData.DomainControllers || [];
  
  if (dcs.length === 0) {
    return '<div class="section"><h2>6. Controladores de Dominio</h2><p>No hay datos de DCs disponibles.</p></div>';
  }

  return `
    <div class="section">
      <h2>6. Controladores de Dominio</h2>
      <p><strong>Total de DCs:</strong> ${dcs.length}</p>
      
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Hostname</th>
            <th>IP Address</th>
            <th>Sistema Operativo</th>
            <th>Roles FSMO</th>
          </tr>
        </thead>
        <tbody>
          ${dcs.map((dc: any) => `
            <tr>
              <td><strong>${dc.Name || dc.HostName || 'N/A'}</strong></td>
              <td>${dc.HostName || dc.DNSHostName || '-'}</td>
              <td>${dc.IPv4Address || dc.IPAddress || '-'}</td>
              <td>${dc.OperatingSystem || '-'}</td>
              <td>${dc.OperationMasterRoles?.join(', ') || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateDomainConfigSection(rawData: any): string {
  const domain = rawData.Domain?.Data?.[0] || rawData.Domain?.[0] || rawData.Domain || {};
  
  return `
    <div class="section">
      <h2>7. Configuración de Dominio</h2>
      
      <div class="summary-box">
        <h4>Información del Dominio</h4>
        <table style="margin: 0;">
          <tbody>
            <tr>
              <td style="width: 40%;"><strong>Nombre DNS:</strong></td>
              <td>${domain.DNSRoot || domain.Name || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Nivel Funcional:</strong></td>
              <td>${domain.DomainMode || domain.ForestMode || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Distinguished Name:</strong></td>
              <td>${domain.DistinguishedName || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>NetBIOS Name:</strong></td>
              <td>${domain.NetBIOSName || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>PDC Emulator:</strong></td>
              <td>${domain.PDCEmulator || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>RID Master:</strong></td>
              <td>${domain.RIDMaster || 'N/A'}</td>
            </tr>
            <tr>
              <td><strong>Infrastructure Master:</strong></td>
              <td>${domain.InfrastructureMaster || 'N/A'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function generateAdditionalDataSection(rawData: any): string {
  const sections = [];
  
  // Buscar cualquier otra propiedad en rawData que no hayamos procesado
  const processedKeys = ['Users', 'Groups', 'Computers', 'GPOs', 'DomainControllers', 'Domain'];
  const additionalKeys = Object.keys(rawData).filter(key => !processedKeys.includes(key));
  
  if (additionalKeys.length === 0) {
    return '';
  }

  return `
    <div class="section">
      <h2>8. Datos Adicionales</h2>
      
      ${additionalKeys.map(key => {
        const data = rawData[key];
        const dataArray = data?.Data || (Array.isArray(data) ? data : []);
        
        return `
          <h3>${key}</h3>
          <p><strong>Total de elementos:</strong> ${dataArray.length || 'N/A'}</p>
          
          ${dataArray.length > 0 ? `
            <div class="code-block">
              ${JSON.stringify(dataArray.slice(0, 3), null, 2)}
              ${dataArray.length > 3 ? '\n... (datos truncados)' : ''}
            </div>
          ` : '<p>No hay datos disponibles.</p>'}
        `;
      }).join('')}
    </div>
  `;
}

function formatDate(dateString: any): string {
  if (!dateString) return '-';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '-';
  }
}
