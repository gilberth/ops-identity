// Generador de anexo técnico en formato Word (DOCX)
// Convierte datos raw JSON a documento Word profesional usando docx library

import { Document, Packer, Paragraph, Table, TableCell, TableRow, HeadingLevel, AlignmentType, WidthType, TextRun, convertInchesToTwip } from 'docx';

export interface RawDataDocOptions {
  domain: string;
  rawData: any;
  date: string;
}

// Helper function para crear párrafos en negrita (headers de tabla)
function createBoldParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        bold: true,
      }),
    ],
  });
}

// Helper function para crear párrafos en itálica
function createItalicParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text,
        italics: true,
      }),
    ],
  });
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
      children: [
        new TextRun({
          text: domain,
          bold: true,
        }),
      ],
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
    new Paragraph({ text: '6. Datos Adicionales ..................', spacing: { after: 100 } }),
    new Paragraph({ text: '   6.1. Contraseñas Antiguas .........', spacing: { after: 100 } }),
    new Paragraph({ text: '   6.2. Estado de Replicación .......', spacing: { after: 100 } }),
    new Paragraph({ text: '   6.3. Relaciones de Confianza .....', spacing: { after: 100 } }),
    new Paragraph({ text: '   6.4. Objetos AdminCount=1 .........', spacing: { after: 100 } }),
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
              children: [createBoldParagraph('Nombre')],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('SAM Account')],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Email')],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Habilitado')],
              shading: { fill: "3B82F6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Último Logon')],
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
            ],
          })
        ),
      ];

      if (users.length > 200) {
        userRows.push(
          new TableRow({
            children: [
              new TableCell({ 
                children: [createItalicParagraph(`... y ${users.length - 200} usuarios más (datos completos en JSON original)`)],
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
              children: [createBoldParagraph('Nombre')],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Scope')],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Categoría')],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Miembros')],
              shading: { fill: "10B981", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Description')],
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
                children: [createItalicParagraph(`... y ${groups.length - 100} grupos más`)],
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
              children: [createBoldParagraph('Display Name')],
              shading: { fill: "8B5CF6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('GUID')],
              shading: { fill: "8B5CF6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Estado')],
              shading: { fill: "8B5CF6", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Creación')],
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
              children: [createBoldParagraph('Nombre')],
              shading: { fill: "F59E0B", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('DNS')],
              shading: { fill: "F59E0B", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Sistema Operativo')],
              shading: { fill: "F59E0B", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Habilitado')],
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
                children: [createItalicParagraph(`... y ${computers.length - 150} computadoras más`)],
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
              children: [createBoldParagraph('Nombre')],
              shading: { fill: "EF4444", color: "FFFFFF" },
            }),
            new TableCell({ 
              children: [createBoldParagraph('Distinguished Name')],
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

  // 6. DATOS ADICIONALES
  sections.push(
    new Paragraph({
      text: '6. DATOS ADICIONALES',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      pageBreakBefore: true,
    })
  );

  // 6.1 Old Passwords
  if (rawData.OldPasswords && rawData.OldPasswords.length > 0) {
    const oldPasswords = rawData.OldPasswords;
    sections.push(
      new Paragraph({
        text: `6.1. Contraseñas Antiguas (${oldPasswords.length} total)`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    const oldPasswordRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ 
            children: [createBoldParagraph('SAM Account')],
            shading: { fill: "DC2626", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Días')],
            shading: { fill: "DC2626", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Riesgo')],
            shading: { fill: "DC2626", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Nunca Expira')],
            shading: { fill: "DC2626", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Última Config.')],
            shading: { fill: "DC2626", color: "FFFFFF" },
          }),
        ],
      }),
      ...oldPasswords.slice(0, 100).map((pwd: any) => 
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: pwd.SamAccountName || '', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: String(pwd.PasswordAgeDays || 0), style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: pwd.RiskLevel || 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: pwd.PasswordNeverExpires ? 'Sí' : 'No', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: pwd.PasswordLastSet ? new Date(parseInt(pwd.PasswordLastSet.match(/\d+/)?.[0] || '0')).toLocaleDateString('es-ES') : 'N/A', style: 'Normal' })] }),
          ],
        })
      ),
    ];

    if (oldPasswords.length > 100) {
      oldPasswordRows.push(
        new TableRow({
          children: [
            new TableCell({ 
              children: [createItalicParagraph(`... y ${oldPasswords.length - 100} contraseñas antiguas más`)],
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
        rows: oldPasswordRows,
      }),
      new Paragraph({ text: '', spacing: { after: 400 } })
    );
  }

  // 6.2 Replication Status
  if (rawData.ReplicationStatus && rawData.ReplicationStatus.length > 0) {
    const replication = rawData.ReplicationStatus;
    sections.push(
      new Paragraph({
        text: `6.2. Estado de Replicación (${replication.length} total)`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    const replicationRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ 
            children: [createBoldParagraph('Servidor')],
            shading: { fill: "0891B2", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Partner')],
            shading: { fill: "0891B2", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Último Resultado')],
            shading: { fill: "0891B2", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Última Réplica')],
            shading: { fill: "0891B2", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Fallos Consecutivos')],
            shading: { fill: "0891B2", color: "FFFFFF" },
          }),
        ],
      }),
      ...replication.map((rep: any) => {
        const partnerName = rep.Partner?.split(',')[0]?.replace('CN=NTDS Settings,CN=', '') || 'N/A';
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: rep.Server || '', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: partnerName, style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: rep.LastReplicationResult === 0 ? 'OK' : String(rep.LastReplicationResult), style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: rep.LastReplicationSuccess ? new Date(parseInt(rep.LastReplicationSuccess.match(/\d+/)?.[0] || '0')).toLocaleString('es-ES') : 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: String(rep.ConsecutiveReplicationFailures || 0), style: 'Normal' })] }),
          ],
        });
      }),
    ];

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: replicationRows,
      }),
      new Paragraph({ text: '', spacing: { after: 400 } })
    );
  }

  // 6.3 Trusts
  if (rawData.Trusts && rawData.Trusts.length > 0) {
    const trusts = rawData.Trusts;
    sections.push(
      new Paragraph({
        text: `6.3. Relaciones de Confianza (${trusts.length} total)`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    const trustRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ 
            children: [createBoldParagraph('Nombre')],
            shading: { fill: "7C3AED", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Dirección')],
            shading: { fill: "7C3AED", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Tipo')],
            shading: { fill: "7C3AED", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Origen')],
            shading: { fill: "7C3AED", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Destino')],
            shading: { fill: "7C3AED", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('SID Filtering')],
            shading: { fill: "7C3AED", color: "FFFFFF" },
          }),
        ],
      }),
      ...trusts.map((trust: any) => 
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: trust.Name || '', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: trust.Direction || 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: trust.TrustType || 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: trust.Source || 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: trust.Target || 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: trust.SIDFilteringQuarantined ? 'Sí' : 'No', style: 'Normal' })] }),
          ],
        })
      ),
    ];

    sections.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: trustRows,
      }),
      new Paragraph({ text: '', spacing: { after: 400 } })
    );
  }

  // 6.4 AdminCount Objects
  if (rawData.AdminCountObjects && rawData.AdminCountObjects.length > 0) {
    const adminCount = rawData.AdminCountObjects;
    sections.push(
      new Paragraph({
        text: `6.4. Objetos con AdminCount=1 (${adminCount.length} total)`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 200 },
      })
    );

    const adminCountRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({ 
            children: [createBoldParagraph('Nombre')],
            shading: { fill: "EA580C", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Tipo')],
            shading: { fill: "EA580C", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Creado')],
            shading: { fill: "EA580C", color: "FFFFFF" },
          }),
          new TableCell({ 
            children: [createBoldParagraph('Modificado')],
            shading: { fill: "EA580C", color: "FFFFFF" },
          }),
        ],
      }),
      ...adminCount.slice(0, 100).map((obj: any) => 
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: obj.Name || '', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: obj.ObjectClass || 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: obj.WhenCreated ? new Date(parseInt(obj.WhenCreated.match(/\d+/)?.[0] || '0')).toLocaleDateString('es-ES') : 'N/A', style: 'Normal' })] }),
            new TableCell({ children: [new Paragraph({ text: obj.WhenChanged ? new Date(parseInt(obj.WhenChanged.match(/\d+/)?.[0] || '0')).toLocaleDateString('es-ES') : 'N/A', style: 'Normal' })] }),
          ],
        })
      ),
    ];

    if (adminCount.length > 100) {
      adminCountRows.push(
        new TableRow({
          children: [
            new TableCell({ 
              children: [createItalicParagraph(`... y ${adminCount.length - 100} objetos más`)],
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
        rows: adminCountRows,
      }),
      new Paragraph({ text: '', spacing: { after: 400 } })
    );
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
