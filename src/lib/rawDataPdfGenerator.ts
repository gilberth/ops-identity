import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface RawDataPdfOptions {
  domain: string;
  rawData: any;
  date: string;
}

export async function generateRawDataPdf(options: RawDataPdfOptions): Promise<Blob> {
  const { domain, rawData, date } = options;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  let currentPage = 1;
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;

  // Helper function to add footer
  const addFooter = (pageNum: number) => {
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${pageNum}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };

  // PORTADA
  doc.setFillColor(59, 130, 246); // Blue background
  doc.rect(0, 0, pageWidth, 80, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text('ANEXO TÉCNICO', pageWidth / 2, 30, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Datos Raw del Active Directory', pageWidth / 2, 45, { align: 'center' });
  
  doc.setFontSize(20);
  doc.text(domain, pageWidth / 2, 65, { align: 'center' });

  doc.setTextColor(0);
  doc.setFontSize(12);
  const formattedDate = new Date(date).toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  doc.text(`Fecha de extracción: ${formattedDate}`, pageWidth / 2, 100, { align: 'center' });
  doc.text('Tipo de documento: Anexo Técnico', pageWidth / 2, 110, { align: 'center' });
  doc.text('Formato: Datos Estructurados del AD', pageWidth / 2, 120, { align: 'center' });

  addFooter(currentPage);

  // TABLA DE CONTENIDOS
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('Tabla de Contenidos', margin, 30);
  
  doc.setTextColor(0);
  doc.setFontSize(12);
  const toc = [
    '1. Resumen Ejecutivo de Datos',
    '2. Usuarios del Dominio',
    '3. Grupos de Seguridad',
    '4. Equipos del Dominio',
    '5. Group Policy Objects (GPOs)',
    '6. Controladores de Dominio',
    '7. Configuración de Dominio',
    '8. Datos Adicionales'
  ];
  
  let yPos = 50;
  toc.forEach((item) => {
    doc.text(`▸  ${item}`, margin + 5, yPos);
    yPos += 10;
  });

  addFooter(currentPage);

  // RESUMEN EJECUTIVO
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('1. Resumen Ejecutivo de Datos', margin, 30);
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Estadísticas Generales del Active Directory', margin, 45);

  // Calcular estadísticas
  const users = rawData.Users?.Data || rawData.Users || [];
  const groups = rawData.Groups?.Data || rawData.Groups || [];
  const computers = rawData.Computers?.Data || rawData.Computers || [];
  const gpos = rawData.GPOs?.Data || rawData.GPOs || [];
  const dcs = rawData.DomainControllers || [];

  const activeUsers = users.filter((u: any) => u.Enabled !== false).length;
  const activeComputers = computers.filter((c: any) => c.Enabled !== false).length;
  const adminUsers = users.filter((u: any) => u.AdminCount === 1 || u.AdminCount === true).length;

  // Estadísticas en grid
  const stats = [
    { label: 'TOTAL USUARIOS', value: users.length.toLocaleString('es-ES') },
    { label: 'USUARIOS ACTIVOS', value: activeUsers.toLocaleString('es-ES') },
    { label: 'GRUPOS DE SEGURIDAD', value: groups.length.toLocaleString('es-ES') },
    { label: 'ADMINISTRADORES', value: adminUsers.toLocaleString('es-ES') },
    { label: 'EQUIPOS TOTALES', value: computers.length.toLocaleString('es-ES') },
    { label: 'EQUIPOS ACTIVOS', value: activeComputers.toLocaleString('es-ES') },
    { label: 'GPOS', value: gpos.length.toLocaleString('es-ES') },
    { label: 'DCS', value: dcs.length.toLocaleString('es-ES') },
  ];

  let statY = 60;
  let statX = margin;
  const boxWidth = 85;
  const boxHeight = 25;
  
  stats.forEach((stat, index) => {
    if (index % 2 === 0 && index > 0) {
      statY += boxHeight + 5;
      statX = margin;
    } else if (index % 2 === 1) {
      statX = pageWidth / 2 + 5;
    }

    // Box border
    doc.setDrawColor(200);
    doc.rect(statX, statY, boxWidth, boxHeight);
    
    // Label
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(stat.label, statX + 5, statY + 8);
    
    // Value
    doc.setFontSize(20);
    doc.setTextColor(59, 130, 246);
    doc.text(stat.value, statX + 5, statY + 20);
  });

  // Nota informativa
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFillColor(240, 248, 255);
  doc.rect(margin, statY + 35, pageWidth - 2 * margin, 15, 'F');
  doc.text('ℹ  Nota: Este anexo contiene los datos raw extraídos directamente del Active Directory.', 
    margin + 5, statY + 43);
  doc.text('Los datos están organizados por categorías para facilitar su análisis técnico.', 
    margin + 5, statY + 48);

  addFooter(currentPage);

  // USUARIOS DEL DOMINIO
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('2. Usuarios del Dominio', margin, 30);
  
  const maxUsers = 100;
  const displayUsers = users.slice(0, maxUsers);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total de usuarios: ${users.length.toLocaleString('es-ES')} (mostrando primeros ${maxUsers})`, margin, 40);

  const usersTableData = displayUsers.map((user: any) => [
    user.Name || user.DisplayName || 'N/A',
    user.SamAccountName || 'N/A',
    user.EmailAddress || user.Mail || 'N/A',
    user.Enabled !== false ? 'ACTIVO' : 'INACTIVO',
    user.LastLogonDate ? new Date(user.LastLogonDate).toLocaleDateString('es-ES') : '-',
    user.PasswordLastSet ? new Date(user.PasswordLastSet).toLocaleDateString('es-ES') : '-',
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Nombre', 'SAM Account', 'Email', 'Estado', 'Último Logon', 'Pwd Último Cambio']],
    body: usersTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      if (data.pageNumber > currentPage) {
        currentPage = data.pageNumber;
      }
      addFooter(data.pageNumber + 2); // +2 por portada y TOC
    },
  });

  // Nota de truncamiento usuarios
  if (users.length > maxUsers) {
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFillColor(255, 243, 205);
    doc.rect(margin, finalY + 5, pageWidth - 2 * margin, 10, 'F');
    doc.text(`⚠  Nota: Solo se muestran los primeros ${maxUsers} usuarios de ${users.length.toLocaleString('es-ES')} totales por limitaciones de tamaño del documento.`,
      margin + 5, finalY + 11);
  }

  // GRUPOS DE SEGURIDAD
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('3. Grupos de Seguridad', margin, 30);
  
  const maxGroups = 100;
  const displayGroups = groups.slice(0, maxGroups);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total de grupos: ${groups.length.toLocaleString('es-ES')}`, margin, 40);

  const groupsTableData = displayGroups.map((group: any) => [
    group.Name || 'N/A',
    group.Description || '-',
    group.Members?.length?.toString() || '0',
    group.GroupType || group.Type || 'Security',
    group.GroupScope || group.Scope || 'Global',
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Nombre del Grupo', 'Descripción', 'Miembros', 'Tipo', 'Scope']],
    body: groupsTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 70 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
    },
    didDrawPage: (data) => {
      if (data.pageNumber > currentPage) {
        currentPage = data.pageNumber;
      }
      addFooter(data.pageNumber + 2);
    },
  });

  // EQUIPOS DEL DOMINIO
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('4. Equipos del Dominio', margin, 30);
  
  const maxComputers = 100;
  const displayComputers = computers.slice(0, maxComputers);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total de equipos: ${computers.length.toLocaleString('es-ES')} (mostrando primeros ${maxComputers})`, margin, 40);

  const computersTableData = displayComputers.map((computer: any) => [
    computer.Name || 'N/A',
    computer.OperatingSystem || 'N/A',
    computer.OperatingSystemVersion || 'N/A',
    computer.Enabled !== false ? 'ACTIVO' : 'INACTIVO',
    computer.LastLogonDate ? new Date(computer.LastLogonDate).toLocaleDateString('es-ES') : '-',
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Nombre', 'Sistema Operativo', 'Versión', 'Estado', 'Último Logon']],
    body: computersTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [245, 158, 11],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      if (data.pageNumber > currentPage) {
        currentPage = data.pageNumber;
      }
      addFooter(data.pageNumber + 2);
    },
  });

  // Nota de truncamiento equipos
  if (computers.length > maxComputers) {
    const finalY = (doc as any).lastAutoTable.finalY || 45;
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.setFillColor(255, 243, 205);
    doc.rect(margin, finalY + 5, pageWidth - 2 * margin, 10, 'F');
    doc.text(`⚠  Nota: Solo se muestran los primeros ${maxComputers} equipos de ${computers.length.toLocaleString('es-ES')} totales.`,
      margin + 5, finalY + 11);
  }

  // GROUP POLICY OBJECTS
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('5. Group Policy Objects (GPOs)', margin, 30);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total de GPOs: ${gpos.length.toLocaleString('es-ES')}`, margin, 40);

  const gposTableData = gpos.map((gpo: any) => [
    gpo.DisplayName || gpo.Name || 'N/A',
    gpo.GpoStatus || gpo.Status || 'N/A',
    gpo.CreationTime ? new Date(gpo.CreationTime).toLocaleDateString('es-ES') : '-',
    gpo.ModificationTime ? new Date(gpo.ModificationTime).toLocaleDateString('es-ES') : '-',
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Nombre', 'Estado', 'Creado', 'Modificado']],
    body: gposTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [139, 92, 246],
      textColor: 255,
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: 50,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: margin, right: margin },
    didDrawPage: (data) => {
      if (data.pageNumber > currentPage) {
        currentPage = data.pageNumber;
      }
      addFooter(data.pageNumber + 2);
    },
  });

  // CONTROLADORES DE DOMINIO
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('6. Controladores de Dominio', margin, 30);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text(`Total de DCs: ${dcs.length.toLocaleString('es-ES')}`, margin, 40);

  if (dcs.length > 0) {
    const dcsTableData = dcs.map((dc: any) => [
      dc.Name || dc.HostName || 'N/A',
      dc.HostName || 'N/A',
      dc.IPAddress || dc.IPv4Address || 'N/A',
      dc.OperatingSystem || 'N/A',
    ]);

    autoTable(doc, {
      startY: 45,
      head: [['Nombre', 'Hostname', 'IP Address', 'Sistema Operativo']],
      body: dcsTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: 255,
        fontSize: 9,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: 50,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        if (data.pageNumber > currentPage) {
          currentPage = data.pageNumber;
        }
        addFooter(data.pageNumber + 2);
      },
    });
  } else {
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('No hay controladores de dominio disponibles.', margin, 55);
  }

  // CONFIGURACIÓN DE DOMINIO
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('7. Configuración de Dominio', margin, 30);
  
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Información del Dominio', margin, 45);

  const domainInfo = rawData.DomainInfo || {};
  const domainConfig = [
    ['Nombre DNS:', domainInfo.DomainName || 'N/A'],
    ['Nivel Funcional:', domainInfo.DomainMode || 'N/A'],
    ['Distinguished Name:', domainInfo.DistinguishedName || 'N/A'],
    ['NetBIOS Name:', domainInfo.NetBIOSName || 'N/A'],
    ['PDC Emulator:', domainInfo.PDCEmulator || 'N/A'],
    ['RID Master:', domainInfo.RIDMaster || 'N/A'],
    ['Infrastructure Master:', domainInfo.InfrastructureMaster || 'N/A'],
  ];

  autoTable(doc, {
    startY: 50,
    body: domainConfig,
    theme: 'plain',
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { textColor: 100 },
    },
    margin: { left: margin, right: margin },
  });

  addFooter(currentPage);

  // DATOS ADICIONALES
  doc.addPage();
  currentPage++;
  
  doc.setFontSize(20);
  doc.setTextColor(59, 130, 246);
  doc.text('8. Datos Adicionales', margin, 30);

  let additionalY = 45;
  const additionalSections = [
    { key: 'Trusts', label: 'Trusts' },
    { key: 'ReplicationStatus', label: 'ReplicationStatus' },
    { key: 'OldPasswords', label: 'OldPasswords' },
    { key: 'AdminCountObjects', label: 'AdminCountObjects' },
  ];

  additionalSections.forEach((section) => {
    const data = rawData[section.key];
    const count = Array.isArray(data) ? data.length : 'N/A';
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(section.label, margin, additionalY);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Total de elementos: ${count}`, margin, additionalY + 7);
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      doc.setTextColor(150);
      doc.text('No hay datos disponibles.', margin, additionalY + 15);
      additionalY += 25;
    } else {
      doc.setFontSize(8);
      doc.setTextColor(50);
      const preview = JSON.stringify(Array.isArray(data) ? data.slice(0, 3) : data, null, 2);
      const lines = doc.splitTextToSize(preview.substring(0, 500) + '...', pageWidth - 2 * margin);
      doc.text(lines, margin, additionalY + 15);
      additionalY += 15 + (lines.length * 3) + 10;
    }

    if (additionalY > pageHeight - 40) {
      doc.addPage();
      currentPage++;
      addFooter(currentPage);
      additionalY = 30;
    }
  });

  // PÁGINA FINAL
  doc.addPage();
  currentPage++;
  
  doc.setFillColor(59, 130, 246);
  doc.rect(0, pageHeight - 60, pageWidth, 60, 'F');
  
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.text('Active Directory Security Assessment', pageWidth / 2, pageHeight - 45, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Anexo Técnico - Datos Raw | Generado el ${formattedDate}`, pageWidth / 2, pageHeight - 35, { align: 'center' });
  
  doc.setFontSize(9);
  doc.text('Documento Confidencial - Solo para uso interno', pageWidth / 2, pageHeight - 25, { align: 'center' });

  return doc.output('blob');
}
