// Generador de anexo técnico en formato Word (DOCX)
// Convierte datos raw JSON a documento Word profesional usando docx library

import { Document, Packer, Paragraph, Table, TableCell, TableRow, HeadingLevel, AlignmentType, WidthType, TextRun, convertInchesToTwip } from 'docx';

export interface RawDataDocOptions {
  domain: string;
  rawData: any;
  date: string;
}

export async function generateRawDataDoc(options: RawDataDocOptions): Promise<Blob> {
  const { domain, rawData, date } = options;
  
  const sections: any[] = [];

  const currentDate = new Date(date).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Portada
  sections.push(
    new Paragraph({
      text: 'ANEXO TÉCNICO',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: 'Datos Completos de Active Directory',
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: domain, bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({
      text: `Generado: ${currentDate}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 800 },
    }),
    new Paragraph({ text: '', pageBreakBefore: true })
  );

  // Índice
  sections.push(
    new Paragraph({
      text: 'ÍNDICE',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
    new Paragraph({ text: '1. Usuarios ............................', spacing: { after: 100 } }),
    new Paragraph({ text: '2. Grupos .............................', spacing: { after: 100 } }),
    new Paragraph({ text: '3. Group Policy Objects ...............', spacing: { after: 100 } }),
    new Paragraph({ text: '4. Computadoras .......................', spacing: { after: 100 } }),
    new Paragraph({ text: '5. Organizational Units ...............', spacing: { after: 100 } }),
    new Paragraph({ text: '', pageBreakBefore: true })
  );

  // 1. USUARIOS
  if (rawData.Users) {
    const users = rawData.Users.Data || rawData.Users;
    sections.push(
      new Paragraph({
        text: `1. USUARIOS (${users.length} total)`,
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      })
    );

    if (users.length > 0) {
      const userRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Nombre', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'SAM Account', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Email', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Habilitado', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Último Logon', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Pwd Último Cambio', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Pwd Nunca Expira', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'AdminCount', bold: true })] })],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
          ],
        }),
        ...users.slice(0, 200).map((user: any) => 
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: user.Name || user.DisplayName || '', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: user.SamAccountName || '', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: user.EmailAddress || user.Mail || 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: user.Enabled !== false ? 'Sí' : 'No', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: user.LastLogonDate ? new Date(user.LastLogonDate).toLocaleDateString('es-ES') : 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: user.PasswordLastSet ? new Date(user.PasswordLastSet).toLocaleDateString('es-ES') : 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: user.PasswordNeverExpires ? 'Sí' : 'No', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: user.AdminCount ? 'Sí' : 'No', style: 'Normal' })] }),
            ],
          })
        ),
      ];

      if (users.length > 200) {
        userRows.push(
          new TableRow({
            children: [
              new TableCell({ 
                children: [new Paragraph({ children: [new TextRun({ text: `... y ${users.length - 200} usuarios más (datos completos en JSON original)`, italics: true })] })],
                columnSpan: 8,
                shading: { fill: "F3F4F6" },
              }),
            ],
          })
        );
      }

      sections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: userRows,
        }),
        new Paragraph({ text: '', spacing: { after: 400 } })
      );
    }
  }

  // 2. GRUPOS
  if (rawData.Groups) {
    const groups = rawData.Groups.Data || rawData.Groups;
    sections.push(
      new Paragraph({
        text: `2. GRUPOS (${groups.length} total)`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        pageBreakBefore: true,
      })
    );

    if (groups.length > 0) {
      const groupRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Nombre', bold: true })] })],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Scope', bold: true })] })],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Categoría', bold: true })] })],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Miembros', bold: true })] })],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Distinguished Name', bold: true })] })],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Description', bold: true })] })],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
          ],
        }),
        ...groups.slice(0, 100).map((group: any) => 
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: group.Name || '', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: group.GroupScope || 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: group.GroupCategory || 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: String(group.Members?.length || 0), style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: group.DistinguishedName || 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: group.Description || 'N/A', style: 'Normal' })] }),
            ],
          })
        ),
      ];

      if (groups.length > 100) {
        groupRows.push(
          new TableRow({
            children: [
              new TableCell({ 
                children: [new Paragraph({ children: [new TextRun({ text: `... y ${groups.length - 100} grupos más`, italics: true })] })],
                columnSpan: 5,
                shading: { fill: "F3F4F6" },
              }),
            ],
          })
        );
      }

      sections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: groupRows,
        }),
        new Paragraph({ text: '', spacing: { after: 400 } })
      );
    }
  }

  // 3. GPOs
  if (rawData.GPOs) {
    const gpos = rawData.GPOs.Data || rawData.GPOs;
    sections.push(
      new Paragraph({
        text: `3. GROUP POLICY OBJECTS (${gpos.length} total)`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        pageBreakBefore: true,
      })
    );

    if (gpos.length > 0) {
      const gpoRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Display Name', bold: true })] })],
              shading: { fill: "8B5CF6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'GUID', bold: true })] })],
              shading: { fill: "8B5CF6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Estado', bold: true })] })],
              shading: { fill: "8B5CF6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Creación', bold: true })] })],
              shading: { fill: "8B5CF6", color: "FFFFFF" },
            }),
          ],
        }),
        ...gpos.map((gpo: any) => 
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: gpo.DisplayName || '', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: (gpo.Id || gpo.GUID || '').toString(), style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: gpo.GpoStatus || 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: gpo.CreationTime ? new Date(gpo.CreationTime).toLocaleDateString('es-ES') : 'N/A', style: 'Normal' })] }),
            ],
          })
        ),
      ];

      sections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: gpoRows,
        }),
        new Paragraph({ text: '', spacing: { after: 400 } })
      );
    }
  }

  // 4. COMPUTERS
  if (rawData.Computers) {
    const computers = rawData.Computers.Data || rawData.Computers;
    sections.push(
      new Paragraph({
        text: `4. COMPUTADORAS (${computers.length} total)`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        pageBreakBefore: true,
      })
    );

    if (computers.length > 0) {
      const computerRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Nombre', bold: true })] })],
              shading: { fill: "F59E0B", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'DNS', bold: true })] })],
              shading: { fill: "F59E0B", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Sistema Operativo', bold: true })] })],
              shading: { fill: "F59E0B", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Habilitado', bold: true })] })],
              shading: { fill: "F59E0B", color: "FFFFFF" },
            }),
          ],
        }),
        ...computers.slice(0, 150).map((computer: any) => 
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: computer.Name || '', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: computer.DNSHostName || 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: computer.OperatingSystem || 'N/A', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: computer.Enabled !== false ? 'Sí' : 'No', style: 'Normal' })] }),
            ],
          })
        ),
      ];

      if (computers.length > 150) {
        computerRows.push(
          new TableRow({
            children: [
              new TableCell({ 
                children: [new Paragraph({ children: [new TextRun({ text: `... y ${computers.length - 150} computadoras más`, italics: true })] })],
                columnSpan: 4,
                shading: { fill: "F3F4F6" },
              }),
            ],
          })
        );
      }

      sections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: computerRows,
        }),
        new Paragraph({ text: '', spacing: { after: 400 } })
      );
    }
  }

  // 5. OUs
  if (rawData.OUs) {
    const ous = rawData.OUs.Data || rawData.OUs;
    sections.push(
      new Paragraph({
        text: `5. ORGANIZATIONAL UNITS (${ous.length} total)`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
        pageBreakBefore: true,
      })
    );

    if (ous.length > 0) {
      const ouRows = [
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Nombre', bold: true })] })],
              shading: { fill: "EF4444", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [new Paragraph({ children: [new TextRun({ text: 'Distinguished Name', bold: true })] })],
              shading: { fill: "EF4444", color: "FFFFFF" },
            }),
          ],
        }),
        ...ous.map((ou: any) => 
          new TableRow({
            children: [
              new TableCell({ children: [new Paragraph({ text: ou.Name || '', style: 'Normal' })] }),
              new TableCell({ children: [new Paragraph({ text: ou.DistinguishedName || '', style: 'Normal' })] }),
            ],
          })
        ),
      ];

      sections.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: ouRows,
        })
      );
    }
  }

  // Crear documento
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(0.75),
            right: convertInchesToTwip(0.75),
            bottom: convertInchesToTwip(0.75),
            left: convertInchesToTwip(0.75),
          },
        },
      },
      children: sections,
    }],
  });

  // Generar blob y retornarlo
  return await Packer.toBlob(doc);
}
