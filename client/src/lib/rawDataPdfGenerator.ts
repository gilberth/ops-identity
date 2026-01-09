import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RawDataPdfOptions {
  domain: string;
  rawData: any;
  date: string;
}

// Enterprise Color Palette
const COLORS = {
  primary: [30, 41, 59],      // Slate 800 (Dark Header)
  secondary: [59, 130, 246],  // Blue 500 (Accents)
  success: [16, 185, 129],    // Emerald 500
  warning: [245, 158, 11],    // Amber 500
  danger: [239, 68, 68],      // Red 500
  text: [51, 65, 85],         // Slate 700
  textLight: [100, 116, 139], // Slate 500
  bgLight: [248, 250, 252],   // Slate 50
  white: [255, 255, 255],
  border: [226, 232, 240]     // Slate 200
};

export async function generateRawDataPdf(options: RawDataPdfOptions): Promise<Blob> {
  const { domain, rawData, date } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFont('helvetica');

  let currentPage = 1;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 15; // Slightly tighter margin for modern look

  // Helper: Draw Header on every page (except Cover)
  const drawHeader = (title: string) => {
    // Top colored bar
    doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.rect(0, 0, pageWidth, 15, 'F');

    // Title in header
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), margin, 10);

    // Domain on right
    doc.text(domain, pageWidth - margin, 10, { align: 'right' });
  };

  // Helper: Draw Footer
  const addFooter = (pageNum: number) => {
    const footerY = pageHeight - 10;

    // Line separator
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFontSize(8);
    doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);

    // Left: Confidential
    doc.text('CONFIDENCIAL - USO INTERNO', margin, footerY);

    // Center: Date
    const formattedDate = new Date(date).toLocaleDateString('es-ES');
    doc.text(`Generado el ${formattedDate}`, pageWidth / 2, footerY, { align: 'center' });

    // Right: Page Number
    doc.text(`Página ${pageNum}`, pageWidth - margin, footerY, { align: 'right' });
  };

  // --- COVER PAGE ---
  // Modern Split Layout

  // Left Side (Dark)
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth * 0.4, pageHeight, 'F');

  // Right Side (White) - implicitly white

  // Content Left
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.text('ANEXO', 20, 60);
  doc.text('TÉCNICO', 20, 75);

  doc.setFontSize(12);
  doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
  doc.text('DATOS RAW DEL ACTIVE DIRECTORY', 20, 90);

  // Decorative Line
  doc.setDrawColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
  doc.setLineWidth(1);
  doc.line(20, 95, 60, 95);

  // Content Right
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(24);
  doc.text(domain, pageWidth * 0.45, 60);

  doc.setFontSize(10);
  doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
  doc.text('REPORTE DE INVENTARIO Y CONFIGURACIÓN', pageWidth * 0.45, 70);

  // Bottom Info (Left side)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('Generado por:', 20, pageHeight - 40);
  doc.setFontSize(12);
  doc.text('Active Scan Insight', 20, pageHeight - 33);

  // Bottom Info (Right side)
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(10);
  doc.text('Fecha de Extracción:', pageWidth * 0.45, pageHeight - 40);
  doc.setFontSize(12);
  doc.text(new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }), pageWidth * 0.45, pageHeight - 33);

  // No footer on cover

  // --- TABLE OF CONTENTS ---
  doc.addPage();
  currentPage++;
  drawHeader('Tabla de Contenidos');

  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(22);
  doc.text('Índice del Reporte', margin, 40);

  const toc = [
    '1. Resumen Ejecutivo de Datos',
    '2. Usuarios del Dominio',
    '3. Grupos de Seguridad',
    '4. Equipos del Dominio',
    '5. Group Policy Objects (GPOs)',
    '6. Controladores de Dominio',
    '7. Configuración de Dominio',
    '8. Unidades Organizativas (OUs)',
    '9. Infraestructura DNS',
    '10. Servicios DHCP',
    '11. Sites y Topología AD',
    '12. Replicación de AD',
    '13. Datos Adicionales'
  ];

  let yPos = 60;
  toc.forEach((item) => {
    const parts = item.split('. ');
    const number = parts[0];
    const text = parts.slice(1).join('. ');

    // Number circle
    doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2]);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.circle(margin + 2, yPos - 1, 4, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.text(number, margin + 2, yPos, { align: 'center', baseline: 'middle' });

    doc.setFontSize(11);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text(text, margin + 10, yPos);

    // Dotted line
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineDash([1, 1], 0);
    doc.line(margin + 12 + doc.getTextWidth(text), yPos, pageWidth - margin - 10, yPos);
    doc.setLineDash([], 0); // Reset

    yPos += 12;
  });

  addFooter(currentPage);

  // --- EXECUTIVE SUMMARY ---
  doc.addPage();
  currentPage++;
  drawHeader('Resumen Ejecutivo');

  doc.setFontSize(20);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('1. Resumen Ejecutivo', margin, 35);

  // Data Extraction
  const ensureArray = (data: any): any[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.Data && Array.isArray(data.Data)) return data.Data;
    return [];
  };

  const users = ensureArray(rawData.Users);
  const groups = ensureArray(rawData.Groups);
  const computers = ensureArray(rawData.Computers);
  const gpos = ensureArray(rawData.GPOs);
  const dcs = ensureArray(rawData.DomainControllers);

  // Fix: Handle nested arrays for OUs, DNS, and DHCP
  // OUs can be in OUStructure.OUs or OUs.OUs or OUs directly
  const ous = rawData.OUStructure?.OUs
    ? ensureArray(rawData.OUStructure.OUs)
    : rawData.OUs?.OUs
      ? ensureArray(rawData.OUs.OUs)
      : ensureArray(rawData.OUs);
  const dns = rawData.DNSConfiguration?.Zones ? ensureArray(rawData.DNSConfiguration.Zones) : ensureArray(rawData.DNSConfiguration || rawData.DNS);
  const dhcp = rawData.DHCPConfiguration?.Scopes ? ensureArray(rawData.DHCPConfiguration.Scopes) : ensureArray(rawData.DHCPConfiguration || rawData.DHCP);

  const activeUsers = users.filter((u: any) => u?.Enabled !== false).length;
  const activeComputers = computers.filter((c: any) => c?.Enabled !== false).length;
  const adminUsers = users.filter((u: any) => u?.AdminCount === 1 || u?.AdminCount === true).length;

  // KPI Cards Grid
  const stats = [
    { label: 'USUARIOS TOTALES', value: users.length, sub: `${activeUsers} Activos`, icon: 'U' },
    { label: 'GRUPOS', value: groups.length, sub: 'Seguridad y Dist.', icon: 'G' },
    { label: 'EQUIPOS', value: computers.length, sub: `${activeComputers} Activos`, icon: 'C' },
    { label: 'ADMINISTRADORES', value: adminUsers, sub: 'Privilegiados', icon: 'A', highlight: true },
    { label: 'GPOs', value: gpos.length, sub: 'Políticas', icon: 'P' },
    { label: 'CONTROLADORES', value: dcs.length, sub: 'Domain Controllers', icon: 'D' },
    { label: 'OUs', value: ous.length, sub: 'Estructura', icon: 'O' },
    { label: 'DNS ZONES', value: dns.length, sub: 'Infraestructura', icon: 'Z' },
  ];

  let cardX = margin;
  let cardY = 50;
  const cardW = (pageWidth - (margin * 2) - 10) / 2; // 2 columns
  const cardH = 25;

  stats.forEach((stat, i) => {
    if (i > 0 && i % 2 === 0) {
      cardX = margin;
      cardY += cardH + 5;
    } else if (i % 2 === 1) {
      cardX = margin + cardW + 10;
    }

    // Card Background
    doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2]);
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'FD');

    // Accent Bar on Left
    const barColor = stat.highlight ? COLORS.danger : COLORS.secondary;
    doc.setFillColor(barColor[0], barColor[1], barColor[2]);
    doc.rect(cardX, cardY, 2, cardH, 'F');

    // Value (Big Number)
    doc.setFontSize(18);
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.text(stat.value.toLocaleString('es-ES'), cardX + 8, cardY + 10);

    // Label
    doc.setFontSize(8);
    doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
    doc.text(stat.label, cardX + 8, cardY + 18);

    // Subtext (Right aligned)
    doc.setFontSize(8);
    doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
    doc.text(stat.sub, cardX + cardW - 5, cardY + 14, { align: 'right' });
  });

  addFooter(currentPage);

  // --- COMMON TABLE STYLES ---
  const tableTheme = {
    headStyles: {
      fillColor: COLORS.primary as [number, number, number],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold' as 'bold',
      halign: 'left' as 'left',
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.text as [number, number, number],
      cellPadding: 3,
      lineColor: COLORS.border as [number, number, number],
      lineWidth: 0.1,
    },
    alternateRowStyles: {
      fillColor: COLORS.bgLight as [number, number, number],
    },
    margin: { left: margin, right: margin },
  };

  // Helper for dates - supports PowerShell /Date(timestamp)/ format
  const formatDate = (dateValue: any) => {
    if (!dateValue) return '-';
    try {
      let d: Date;

      // Format 1: PowerShell /Date(1234567890000)/ format
      if (typeof dateValue === 'string' && dateValue.includes('/Date(')) {
        const match = dateValue.match(/\/Date\((-?\d+)\)\//);
        if (match) {
          d = new Date(parseInt(match[1]));
        } else {
          return '-';
        }
      }
      // Format 2: Unix timestamp (number)
      else if (typeof dateValue === 'number') {
        d = new Date(dateValue > 1e12 ? dateValue : dateValue * 1000);
      }
      // Format 3: ISO string or other parseable format
      else {
        d = new Date(dateValue);
      }

      if (isNaN(d.getTime())) return '-';
      return d.toLocaleDateString('es-ES');
    } catch { return '-'; }
  };

  // --- SECTIONS GENERATION ---

  // 2. USUARIOS
  doc.addPage();
  currentPage++;
  drawHeader('Usuarios del Dominio');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('2. Usuarios del Dominio', margin, 30);

  autoTable(doc, {
    startY: 40,
    head: [['Nombre', 'SAM Account', 'Email', 'Estado', 'Último Logon', 'Password Set', 'Admin?', 'Nunca Expira?']],
    body: users.slice(0, 500).map((u: any) => [
      u.Name || u.DisplayName || 'N/A',
      u.SamAccountName || 'N/A',
      u.EmailAddress || u.Mail || '-',
      u.Enabled !== false ? 'Activo' : 'Inactivo',
      formatDate(u.LastLogonDate),
      formatDate(u.PasswordLastSet),
      u.AdminCount === 1 || u.AdminCount === true ? 'SÍ' : 'No',
      u.PasswordNeverExpires === true ? 'SÍ' : 'No'
    ]),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Usuarios del Dominio');
    }
  });
  if (users.length > 500) {
    doc.setFontSize(8);
    doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
    doc.text(`* Se muestran los primeros 500 de ${users.length} usuarios. Para el listado completo, consulte el archivo JSON raw.`, margin, (doc as any).lastAutoTable.finalY + 10);
  }

  // 3. GRUPOS
  doc.addPage();
  currentPage++;
  drawHeader('Grupos de Seguridad');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('3. Grupos de Seguridad', margin, 30);

  autoTable(doc, {
    startY: 40,
    head: [['Nombre', 'Descripción', 'Miembros', 'Tipo', 'Ámbito', 'Managed By']],
    body: groups.slice(0, 500).map((g: any) => [
      g.Name || 'N/A',
      g.Description || '-',
      g.Members?.length || 0,
      g.GroupType || 'Security',
      g.GroupScope || 'Global',
      g.ManagedBy || '-'
    ]),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Grupos de Seguridad');
    }
  });
  if (groups.length > 500) {
    doc.setFontSize(8);
    doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
    doc.text(`* Se muestran los primeros 500 de ${groups.length} grupos.`, margin, (doc as any).lastAutoTable.finalY + 10);
  }

  // 4. EQUIPOS
  doc.addPage();
  currentPage++;
  drawHeader('Equipos del Dominio');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('4. Equipos del Dominio', margin, 30);

  autoTable(doc, {
    startY: 40,
    head: [['Nombre', 'IPv4 / DNS', 'OS', 'Versión', 'Estado', 'Último Logon']],
    body: computers.slice(0, 500).map((c: any) => [
      c.Name || 'N/A',
      c.IPv4Address || c.DNSHostName || '-',
      c.OperatingSystem || '-',
      c.OperatingSystemVersion || '-',
      c.Enabled !== false ? 'Activo' : 'Inactivo',
      formatDate(c.LastLogonDate)
    ]),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Equipos del Dominio');
    }
  });
  if (computers.length > 500) {
    doc.setFontSize(8);
    doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
    doc.text(`* Se muestran los primeros 500 de ${computers.length} equipos.`, margin, (doc as any).lastAutoTable.finalY + 10);
  }

  // 5. GPOs
  doc.addPage();
  currentPage++;
  drawHeader('Group Policy Objects');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('5. Group Policy Objects (GPOs)', margin, 30);

  autoTable(doc, {
    startY: 40,
    head: [['Nombre', 'Estado', 'Creado', 'Modificado', 'Links', 'File Path']],
    body: gpos.slice(0, 500).map((g: any) => [
      g.DisplayName || g.Name || 'N/A',
      g.GpoStatus || 'Enabled',
      formatDate(g.CreationTime),
      formatDate(g.ModificationTime),
      'Ver Detalle', // Placeholder
      (g.FileSysPath || '').split('}')[1] || '-' // Shorten path
    ]),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Group Policy Objects');
    }
  });

  // 6. DCs
  doc.addPage();
  currentPage++;
  drawHeader('Controladores de Dominio');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('6. Controladores de Dominio', margin, 30);

  // Helper to get DC roles from FSMORolesHealth
  const getDCRoles = (dcHostName: string): string => {
    const fsmoRoles = rawData.FSMORolesHealth?.Roles;
    if (!Array.isArray(fsmoRoles)) return '-';

    const roles = fsmoRoles
      .filter((r: any) => r.Holder?.toLowerCase().includes(dcHostName?.toLowerCase()?.split('.')[0]))
      .map((r: any) => r.RoleName)
      .filter(Boolean);

    return roles.length > 0 ? roles.join(', ') : '-';
  };

  autoTable(doc, {
    startY: 40,
    head: [['Hostname', 'IP Address', 'OS', 'Site', 'GC', 'Roles FSMO']],
    body: dcs.map((dc: any) => {
      const hostname = dc.HostName || dc.Name || 'N/A';
      // Try to get roles from FSMORolesHealth first, then from DC itself
      let roles = getDCRoles(hostname);
      if (roles === '-' && Array.isArray(dc.Roles) && dc.Roles.length > 0) {
        roles = dc.Roles.map((r: any) => typeof r === 'string' ? r : r.RoleName || r.Name || '').filter(Boolean).join(', ') || '-';
      }
      return [
        hostname,
        dc.IPv4Address || dc.IPAddress || '-',
        dc.OperatingSystem || '-',
        dc.Site || '-',
        dc.IsGlobalCatalog ? 'Sí' : 'No',
        roles
      ];
    }),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Controladores de Dominio');
    }
  });

  // 7. DOMAIN CONFIG
  doc.addPage();
  currentPage++;
  drawHeader('Configuración de Dominio');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('7. Configuración de Dominio', margin, 30);

  const domainInfo = rawData.DomainInfo || {};

  // Extract FSMO Roles from FSMORolesHealth (primary) or Domain Controllers list (fallback)
  const findRoleHolder = (roleName: string): string => {
    // Primary: Check FSMORolesHealth.Roles array
    const fsmoRoles = rawData.FSMORolesHealth?.Roles;
    if (Array.isArray(fsmoRoles)) {
      const role = fsmoRoles.find((r: any) =>
        r.RoleName?.toLowerCase() === roleName.toLowerCase()
      );
      if (role?.Holder) {
        return role.Holder;
      }
    }

    // Fallback: Check Domain Controllers list
    if (!dcs || !Array.isArray(dcs)) return 'N/A';
    const holder = dcs.find((dc: any) => {
      const roles = dc.Roles || dc.OperationMasterRoles;
      if (Array.isArray(roles)) {
        return roles.some((r: any) => {
          if (typeof r === 'string') {
            return r.toLowerCase().includes(roleName.toLowerCase());
          }
          if (r && typeof r === 'object') {
            const roleStr = r.Name || r.RoleName || r.Role || String(r);
            return typeof roleStr === 'string' && roleStr.toLowerCase().includes(roleName.toLowerCase());
          }
          return false;
        });
      }
      return false;
    });
    return holder ? (holder.HostName || holder.Name) : 'N/A';
  };

  const pdc = domainInfo.PDCEmulator || findRoleHolder('PDCEmulator');
  const rid = domainInfo.RIDMaster || findRoleHolder('RIDMaster');
  const infra = domainInfo.InfrastructureMaster || findRoleHolder('InfrastructureMaster');

  // Get Schema and Domain Naming Master as well
  const schemaMaster = findRoleHolder('SchemaMaster');
  const domainNaming = findRoleHolder('DomainNamingMaster');

  autoTable(doc, {
    startY: 40,
    body: [
      ['Nombre DNS', domainInfo.DomainName || domainInfo.DomainDNS || domain || 'N/A'],
      ['Nivel Funcional Dominio', domainInfo.DomainMode || domainInfo.DomainFunctionalLevel || 'N/A'],
      ['Nivel Funcional Forest', domainInfo.ForestFunctionalLevel || 'N/A'],
      ['Forest', domainInfo.ForestName || 'N/A'],
      ['NetBIOS', domainInfo.NetBIOSName || domainInfo.DomainNetBIOS || 'N/A'],
      ['Schema Version', domainInfo.SchemaVersion || 'N/A'],
      ['PDC Emulator', pdc],
      ['RID Master', rid],
      ['Infrastructure Master', infra],
      ['Schema Master', schemaMaster],
      ['Domain Naming Master', domainNaming]
    ],
    theme: 'striped',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60, textColor: COLORS.primary } },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Configuración de Dominio');
    }
  });

  // 8. OUs
  doc.addPage();
  currentPage++;
  drawHeader('Unidades Organizativas');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('8. Unidades Organizativas (OUs)', margin, 30);

  autoTable(doc, {
    startY: 40,
    head: [['Nombre', 'Distinguished Name', 'GPOs Vinculadas', 'Protected?']],
    body: ous.slice(0, 500).map((o: any) => [
      o.Name || 'N/A',
      o.DistinguishedName || '-',
      o.LinkedGPOs?.length || 0,
      o.ProtectedFromAccidentalDeletion ? 'Sí' : 'No'
    ]),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Unidades Organizativas');
    }
  });

  // 9. DNS
  doc.addPage();
  currentPage++;
  drawHeader('Infraestructura DNS');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('9. Infraestructura DNS', margin, 30);

  autoTable(doc, {
    startY: 40,
    head: [['Zona', 'Tipo', 'Integrada AD', 'Transferencias', 'Masters']],
    body: dns.slice(0, 500).map((z: any) => [
      z.ZoneName || z.Name || 'N/A',
      z.ZoneType || '-',
      z.IsDsIntegrated ? 'Sí' : 'No',
      z.SecureSecondaries || '-',
      (z.MasterServers || []).join(', ') || '-'
    ]),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Infraestructura DNS');
    }
  });

  // 10. DHCP
  doc.addPage();
  currentPage++;
  drawHeader('Servicios DHCP');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('10. Servicios DHCP', margin, 30);

  autoTable(doc, {
    startY: 40,
    head: [['Scope ID', 'Nombre', 'Estado', 'Rango', 'Lease', 'Subnet']],
    body: dhcp.slice(0, 500).map((s: any) => [
      s.ScopeId || 'N/A',
      s.Name || '-',
      s.State || '-',
      `${s.StartRange || ''} - ${s.EndRange || ''}`,
      s.LeaseDuration || '-',
      s.SubnetMask || '-'
    ]),
    ...tableTheme,
    didDrawPage: (data) => {
      currentPage = doc.getNumberOfPages();
      addFooter(currentPage);
      drawHeader('Servicios DHCP');
    }
  });

  // 11. SITES Y TOPOLOGÍA AD
  doc.addPage();
  currentPage++;
  drawHeader('Sites y Topología AD');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('11. Sites y Topología AD', margin, 30);

  // Extract Sites data - IMPORTANTE: SiteTopology.Sites es el formato del PowerShell collector
  const sites = rawData.SiteTopology?.Sites
    ? ensureArray(rawData.SiteTopology.Sites)
    : rawData.Sites?.Sites
      ? ensureArray(rawData.Sites.Sites)
      : ensureArray(rawData.Sites);

  // Extract Subnets data
  const subnets = rawData.SiteTopology?.Subnets
    ? ensureArray(rawData.SiteTopology.Subnets)
    : ensureArray(rawData.Subnets);

  if (sites.length > 0) {
    autoTable(doc, {
      startY: 40,
      head: [['Nombre del Site', 'Descripción', 'Ubicación']],
      body: sites.slice(0, 100).map((s: any) => [
        s.Name || s.SiteName || 'N/A',
        s.Description || '-',
        s.Location || '-'
      ]),
      ...tableTheme,
      didDrawPage: (data) => {
        currentPage = doc.getNumberOfPages();
        addFooter(currentPage);
        drawHeader('Sites y Topología AD');
      }
    });
  }

  // Mostrar subnets si existen
  if (subnets.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || 50;
    doc.setFontSize(14);
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.text(`Subredes Configuradas (${subnets.length} total)`, margin, lastY + 15);

    autoTable(doc, {
      startY: lastY + 20,
      head: [['Subred', 'Site Asociado', 'Descripción']],
      body: subnets.slice(0, 100).map((sub: any) => {
        // Extraer nombre del site del DN (CN=SITENAME,CN=Sites,...)
        const siteDN = sub.Site || '';
        const siteMatch = siteDN.match(/CN=([^,]+)/);
        const siteName = siteMatch ? siteMatch[1] : (siteDN || '-');
        return [
          sub.Name || 'N/A',
          siteName,
          sub.Description || '-'
        ];
      }),
      ...tableTheme,
      didDrawPage: (data) => {
        currentPage = doc.getNumberOfPages();
        addFooter(currentPage);
        drawHeader('Sites y Topología AD');
      }
    });

    if (subnets.length > 100) {
      doc.setFontSize(8);
      doc.setTextColor(COLORS.danger[0], COLORS.danger[1], COLORS.danger[2]);
      doc.text(`* Se muestran las primeras 100 de ${subnets.length} subredes.`, margin, (doc as any).lastAutoTable.finalY + 10);
    }
  }

  if (sites.length === 0 && subnets.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
    doc.text('No se encontraron datos de Sites y Topología en el assessment.', margin, 45);
  }

  // Site Links subsection if available
  const siteLinks = rawData.SiteTopology?.SiteLinks
    ? ensureArray(rawData.SiteTopology.SiteLinks)
    : rawData.Sites?.SiteLinks
      ? ensureArray(rawData.Sites.SiteLinks)
      : rawData.SiteLinks
        ? ensureArray(rawData.SiteLinks)
        : [];

  if (siteLinks.length > 0) {
    const lastY = (doc as any).lastAutoTable?.finalY || 50;
    doc.setFontSize(14);
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.text('Site Links', margin, lastY + 15);

    autoTable(doc, {
      startY: lastY + 20,
      head: [['Nombre', 'Sites Conectados', 'Costo', 'Frecuencia (min)', 'Protocolo']],
      body: siteLinks.slice(0, 100).map((sl: any) => [
        sl.Name || 'N/A',
        Array.isArray(sl.Sites) ? sl.Sites.join(', ') : (sl.SitesIncluded || '-'),
        sl.Cost || '-',
        sl.ReplicationFrequencyInMinutes || sl.Frequency || '-',
        sl.InterSiteTransportProtocol || 'IP'
      ]),
      ...tableTheme,
      didDrawPage: (data) => {
        currentPage = doc.getNumberOfPages();
        addFooter(currentPage);
        drawHeader('Sites y Topología AD');
      }
    });
  }

  addFooter(currentPage);

  // 12. REPLICACIÓN DE AD
  doc.addPage();
  currentPage++;
  drawHeader('Replicación de AD');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('12. Replicación de AD', margin, 30);

  // Extract Replication data - can be in ReplicationHealthAllDCs, ReplicationStatus, or DCHealth
  const replicationHealth = rawData.ReplicationHealthAllDCs?.DCReplicationHealth
    ? ensureArray(rawData.ReplicationHealthAllDCs.DCReplicationHealth)
    : rawData.ReplicationHealthAllDCs
      ? ensureArray(rawData.ReplicationHealthAllDCs)
      : [];

  const replicationStatus = ensureArray(rawData.ReplicationStatus);
  const dcHealth = rawData.DCHealth?.DCHealthResults
    ? ensureArray(rawData.DCHealth.DCHealthResults)
    : ensureArray(rawData.DCHealth);

  let repY = 40;

  // DC Replication Health Table
  if (replicationHealth.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.text('Estado de Replicación por DC', margin, repY);

    autoTable(doc, {
      startY: repY + 5,
      head: [['DC', 'Partner', 'Estado', 'Último Éxito', 'Fallos Consecutivos', 'Naming Context']],
      body: replicationHealth.slice(0, 200).map((r: any) => [
        r.SourceDC || r.DC || r.Server || 'N/A',
        r.PartnerDC || r.Partner || r.DestinationDC || '-',
        r.ReplicationStatus || r.Status || (r.LastReplicationSuccess ? 'OK' : 'Error'),
        formatDate(r.LastReplicationSuccess || r.LastSuccessTime),
        r.ConsecutiveFailures || r.FailureCount || 0,
        r.NamingContext || r.Partition || '-'
      ]),
      ...tableTheme,
      didDrawPage: (data) => {
        currentPage = doc.getNumberOfPages();
        addFooter(currentPage);
        drawHeader('Replicación de AD');
      }
    });
    repY = (doc as any).lastAutoTable?.finalY + 15 || repY + 60;
  }

  // DC Health Summary
  if (dcHealth.length > 0 && repY < pageHeight - 60) {
    doc.setFontSize(12);
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.text('Salud de Controladores de Dominio', margin, repY);

    autoTable(doc, {
      startY: repY + 5,
      head: [['DC', 'Servicios', 'Conectividad', 'DNS', 'Tiempo Sincronizado', 'Estado General']],
      body: dcHealth.slice(0, 50).map((h: any) => [
        h.DC || h.Server || h.HostName || 'N/A',
        h.ServicesStatus || h.Services || '-',
        h.Connectivity || h.NetworkStatus || '-',
        h.DNSStatus || h.DNS || '-',
        h.TimeSyncStatus || h.TimeSync || '-',
        h.OverallHealth || h.Status || '-'
      ]),
      ...tableTheme,
      didDrawPage: (data) => {
        currentPage = doc.getNumberOfPages();
        addFooter(currentPage);
        drawHeader('Replicación de AD');
      }
    });
    repY = (doc as any).lastAutoTable?.finalY + 15 || repY + 60;
  }

  // Legacy Replication Status (from ReplicationStatus key)
  if (replicationStatus.length > 0 && repY < pageHeight - 60) {
    doc.setFontSize(12);
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.text('Estado de Replicación Detallado', margin, repY);

    autoTable(doc, {
      startY: repY + 5,
      head: [['Origen', 'Destino', 'Partición', 'Estado', 'Última Replicación']],
      body: replicationStatus.slice(0, 100).map((r: any) => [
        r.SourceDC || r.Source || 'N/A',
        r.DestinationDC || r.Destination || '-',
        r.Partition || r.NamingContext || '-',
        r.Status || r.ReplicationStatus || '-',
        formatDate(r.LastReplication || r.LastSuccessTime)
      ]),
      ...tableTheme,
      didDrawPage: (data) => {
        currentPage = doc.getNumberOfPages();
        addFooter(currentPage);
        drawHeader('Replicación de AD');
      }
    });
  }

  // If no replication data found at all
  if (replicationHealth.length === 0 && dcHealth.length === 0 && replicationStatus.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
    doc.text('No se encontraron datos de replicación en el assessment.', margin, 45);
    doc.text('Para obtener datos de replicación, ejecute el script de colección con los parámetros', margin, 55);
    doc.text('de Sites y Replicación habilitados.', margin, 65);
  }

  addFooter(currentPage);

  // 13. DATOS ADICIONALES
  doc.addPage();
  currentPage++;
  drawHeader('Datos Adicionales');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('13. Datos Adicionales', margin, 30);

  let addY = 40;
  const additionalSections = [
    { key: 'Trusts', label: 'Relaciones de Confianza (Trusts)' },
    { key: 'OldPasswords', label: 'Usuarios con Contraseñas Antiguas' },
    { key: 'AdminCountObjects', label: 'Objetos AdminCount' },
    { key: 'LingeringObjectsRisk', label: 'Objetos Lingering (Huérfanos)' },
    { key: 'FSMORolesHealth', label: 'Salud de Roles FSMO' },
  ];

  additionalSections.forEach((sec) => {
    const data = rawData[sec.key];
    const count = Array.isArray(data) ? data.length : 0;

    doc.setFontSize(12);
    doc.setTextColor(COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]);
    doc.text(`${sec.label} (${count})`, margin, addY);

    addY += 10;

    // Simple preview if data exists
    if (count > 0 && Array.isArray(data)) {
      const previewText = JSON.stringify(data.slice(0, 2), null, 2).substring(0, 300) + '...';
      doc.setFontSize(8);
      doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
      const splitText = doc.splitTextToSize(previewText, pageWidth - (margin * 2));
      doc.text(splitText, margin, addY);
      addY += (splitText.length * 4) + 10;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
      doc.text('No hay datos disponibles o la lista está vacía.', margin, addY);
      addY += 10;
    }

    if (addY > pageHeight - 40) {
      doc.addPage();
      currentPage++;
      drawHeader('Datos Adicionales');
      addY = 30;
    }
  });

  return doc.output('blob');
}
