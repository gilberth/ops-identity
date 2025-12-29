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
    '11. Datos Adicionales'
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
  const ous = rawData.OUs?.OUs ? ensureArray(rawData.OUs.OUs) : ensureArray(rawData.OUs);
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

  // Helper for dates
  const formatDate = (dateString: any) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
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
    head: [['Nombre', 'IPv4', 'OS', 'Versión', 'Estado', 'Último Logon']],
    body: computers.slice(0, 500).map((c: any) => [
      c.Name || 'N/A',
      c.IPv4Address || '-',
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

  autoTable(doc, {
    startY: 40,
    head: [['Hostname', 'IP Address', 'OS', 'Roles']],
    body: dcs.map((dc: any) => [
      dc.HostName || dc.Name || 'N/A',
      dc.IPv4Address || dc.IPAddress || '-',
      dc.OperatingSystem || '-',
      (dc.Roles || []).join(', ') || '-'
    ]),
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

  // Extract FSMO Roles from Domain Controllers list if not in DomainInfo
  const findRoleHolder = (rolePattern: string) => {
    if (!dcs || !Array.isArray(dcs)) return 'N/A';
    const holder = dcs.find((dc: any) => {
      const roles = dc.Roles || dc.OperationMasterRoles;
      if (Array.isArray(roles)) {
        return roles.some(r => {
          // Handle case where r might be an object or non-string
          if (typeof r === 'string') {
            return r.toLowerCase().includes(rolePattern.toLowerCase());
          }
          // If r is an object, try to get a string representation
          if (r && typeof r === 'object') {
            const roleStr = r.Name || r.Role || r.value || String(r);
            return typeof roleStr === 'string' && roleStr.toLowerCase().includes(rolePattern.toLowerCase());
          }
          return false;
        });
      }
      return false;
    });
    return holder ? (holder.HostName || holder.Name) : 'N/A';
  };

  const pdc = domainInfo.PDCEmulator || findRoleHolder('PDC') || findRoleHolder('Primary');
  const rid = domainInfo.RIDMaster || findRoleHolder('RID');
  const infra = domainInfo.InfrastructureMaster || findRoleHolder('Infrastructure');

  autoTable(doc, {
    startY: 40,
    body: [
      ['Nombre DNS', domainInfo.DomainName || domainInfo.DomainDNS || 'N/A'],
      ['Nivel Funcional', domainInfo.DomainMode || domainInfo.DomainFunctionalLevel || 'N/A'],
      ['Distinguished Name', domainInfo.DistinguishedName || 'N/A'],
      ['NetBIOS', domainInfo.NetBIOSName || domainInfo.DomainNetBIOS || 'N/A'],
      ['PDC Emulator', pdc],
      ['RID Master', rid],
      ['Infrastructure Master', infra]
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

  // 11. DATOS ADICIONALES
  doc.addPage();
  currentPage++;
  drawHeader('Datos Adicionales');
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('11. Datos Adicionales', margin, 30);

  let addY = 40;
  const additionalSections = [
    { key: 'Trusts', label: 'Relaciones de Confianza (Trusts)' },
    { key: 'ReplicationStatus', label: 'Estado de Replicación' },
    { key: 'OldPasswords', label: 'Usuarios con Contraseñas Antiguas' },
    { key: 'AdminCountObjects', label: 'Objetos AdminCount' },
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
