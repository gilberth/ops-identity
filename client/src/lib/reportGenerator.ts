import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, VerticalAlign,
  Header, Footer, PageNumber, LevelFormat, ShadingType,
  PageBreak
} from 'docx';

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

// Table column widths in DXA (twentieths of a point)
// Letter size with 1" margins = 9360 DXA usable width
const TABLE_WIDTHS = {
  full: 9360,
  twoCol: [4680, 4680],
  threeCol: [3120, 3120, 3120],
  fourCol: [2340, 2340, 2340, 2340],
  asymmetric: [3120, 6240], // 1/3 + 2/3
};

// Global document styles configuration
const getDocumentStyles = () => ({
  default: {
    document: {
      run: { font: "Arial", size: 22 }, // 11pt default
    },
  },
  paragraphStyles: [
    {
      id: "Title",
      name: "Title",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 56, bold: true, color: COLORS.primary, font: "Arial" },
      paragraph: { spacing: { before: 240, after: 120 }, alignment: AlignmentType.CENTER },
    },
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 36, bold: true, color: COLORS.primary, font: "Arial" },
      paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 28, bold: true, color: COLORS.primary, font: "Arial" },
      paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 },
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 24, bold: true, color: COLORS.info, font: "Arial" },
      paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 },
    },
    {
      id: "FindingCritical",
      name: "Critical Finding",
      basedOn: "Normal",
      run: { size: 28, bold: true, color: COLORS.critical, font: "Arial" },
      paragraph: { spacing: { before: 300, after: 150 } },
    },
    {
      id: "FindingHigh",
      name: "High Finding",
      basedOn: "Normal",
      run: { size: 28, bold: true, color: COLORS.high, font: "Arial" },
      paragraph: { spacing: { before: 300, after: 150 } },
    },
    {
      id: "FindingMedium",
      name: "Medium Finding",
      basedOn: "Normal",
      run: { size: 26, bold: true, color: COLORS.medium, font: "Arial" },
      paragraph: { spacing: { before: 250, after: 120 } },
    },
    {
      id: "ExecutiveNote",
      name: "Executive Note",
      basedOn: "Normal",
      run: { size: 22, font: "Arial" },
      paragraph: { spacing: { before: 100, after: 100 }, shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR } },
    },
  ],
  characterStyles: [
    {
      id: "CriticalText",
      name: "Critical Text",
      run: { color: COLORS.critical, bold: true },
    },
    {
      id: "HighText",
      name: "High Text",
      run: { color: COLORS.high, bold: true },
    },
    {
      id: "SuccessText",
      name: "Success Text",
      run: { color: COLORS.successText, bold: true },
    },
  ],
});

// Numbering configuration for proper Word lists
const getNumberingConfig = () => ({
  config: [
    {
      reference: "bullet-list",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
        {
          level: 1,
          format: LevelFormat.BULLET,
          text: "○",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1440, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "numbered-findings",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "recommendations-list",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    // DC Health remediation lists - each error type gets unique reference for proper numbering restart
    {
      reference: "dc-remediation-1",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "dc-remediation-2",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "dc-remediation-3",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "dc-remediation-4",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "dc-remediation-5",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "dc-remediation-6",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
  ],
});

// Standard table cell borders
const getTableBorders = () => {
  const border = { style: BorderStyle.SINGLE, size: 1, color: COLORS.border };
  return { top: border, bottom: border, left: border, right: border };
};

// =============================================================================
// DC HEALTH ROOT CAUSE ANALYSIS
// Analyzes CriticalEvents to identify specific problems and affected computers
// =============================================================================

interface ErrorAnalysis {
  type: string;
  description: string;
  severity: "critical" | "warning" | "info";
  affectedObjects: string[];
  remediation: string[];
}

interface DCHealthAnalysis {
  status: string;
  color: string;
  issues: string[];
  rootCauseAnalysis: ErrorAnalysis[];
}

// Analyze NETLOGON errors to identify root causes
const analyzeNetlogonErrors = (events: any[]): ErrorAnalysis[] => {
  const analyses: ErrorAnalysis[] = [];
  const netlogonEvents = events.filter((e: any) => e.Source === "NETLOGON");

  if (netlogonEvents.length === 0) return analyses;

  // Group by error patterns
  const ghostAccounts: string[] = [];
  const trustProblems: Set<string> = new Set();
  const accessDenied: string[] = [];
  const secureChannelErrors: string[] = [];

  netlogonEvents.forEach((event: any) => {
    const message = event.Message || "";

    // Pattern 1: Ghost computer accounts (machines that don't exist or were renamed)
    // "No existe la cuenta de equipo para este equipo: NOMBREPC$"
    // "The computer name ... could not be mapped to the computer account"
    const ghostMatch = message.match(/cuenta.*equipo.*:\s*([A-Z0-9_-]+)\$/i) ||
                       message.match(/computer.*account.*:\s*([A-Z0-9_-]+)\$/i) ||
                       message.match(/([A-Z0-9_-]+)\$.*no existe/i) ||
                       message.match(/could not be mapped.*account.*([A-Z0-9_-]+)/i);
    if (ghostMatch) {
      const computerName = ghostMatch[1].replace('$', '');
      if (!ghostAccounts.includes(computerName)) {
        ghostAccounts.push(computerName);
      }
    }

    // Pattern 2: Trust relationship problems with other domains
    // "La sesión de seguridad de confianza ... DOMINIO ... ha fallado"
    // "The trust relationship ... with domain ... failed"
    const trustMatch = message.match(/confianza.*dominio\s+([A-Z0-9._-]+)/i) ||
                       message.match(/trust.*domain\s+([A-Z0-9._-]+)/i) ||
                       message.match(/dominio\s+([A-Z0-9._-]+).*confianza/i) ||
                       message.match(/secure channel.*domain\s+([A-Z0-9._-]+)/i);
    if (trustMatch) {
      trustProblems.add(trustMatch[1]);
    }

    // Pattern 3: Access denied errors (credential desync)
    // "Acceso denegado" / "Access denied"
    if (message.match(/acceso denegado/i) || message.match(/access denied/i)) {
      const computerMatch = message.match(/equipo\s+([A-Z0-9_-]+)/i) ||
                           message.match(/computer\s+([A-Z0-9_-]+)/i) ||
                           message.match(/([A-Z0-9_-]+)\s+error/i);
      if (computerMatch && !accessDenied.includes(computerMatch[1])) {
        accessDenied.push(computerMatch[1]);
      }
    }

    // Pattern 4: Secure channel errors
    // "No se puede establecer canal seguro" / "Cannot establish secure channel"
    if (message.match(/canal seguro/i) || message.match(/secure channel/i)) {
      const channelMatch = message.match(/equipo\s+([A-Z0-9_-]+)/i) ||
                          message.match(/computer\s+([A-Z0-9_-]+)/i);
      if (channelMatch && !secureChannelErrors.includes(channelMatch[1])) {
        secureChannelErrors.push(channelMatch[1]);
      }
    }
  });

  // Create analysis for ghost accounts
  if (ghostAccounts.length > 0) {
    analyses.push({
      type: "Cuentas de Equipo Fantasma (Ghost Objects)",
      description: `Se detectaron ${ghostAccounts.length} equipos que intentan autenticarse pero sus cuentas de AD no existen o están desincronizadas. Esto ocurre cuando equipos fueron reformateados sin eliminar su cuenta de AD, o cuando hay registros DNS obsoletos.`,
      severity: ghostAccounts.length > 5 ? "critical" : "warning",
      affectedObjects: ghostAccounts.slice(0, 15), // Limit to 15 for readability
      remediation: [
        "Verificar si los equipos existen físicamente con: Get-ADComputer -Filter {Name -like 'NOMBREPC*'}",
        "Si no existen, eliminar cuentas huérfanas: Remove-ADComputer -Identity 'NOMBREPC'",
        "Limpiar registros DNS obsoletos: dnscmd /AgeAllRecords",
        "Habilitar scavenging en zonas DNS para limpieza automática"
      ]
    });
  }

  // Create analysis for trust problems
  if (trustProblems.size > 0) {
    analyses.push({
      type: "Problemas de Relación de Confianza (Trust Failures)",
      description: `Se detectaron fallas en las relaciones de confianza con ${trustProblems.size} dominio(s). Esto impide la autenticación entre dominios y puede causar fallas de acceso a recursos compartidos.`,
      severity: "critical",
      affectedObjects: Array.from(trustProblems),
      remediation: [
        "Verificar estado del trust: Get-ADTrust -Filter * | Select Name, Direction, TrustType",
        "Restablecer la relación de confianza desde AD Domains and Trusts",
        "Verificar conectividad DNS entre dominios",
        "Comando para reparar: netdom trust DOMINIO /domain:OTRODOMINIO /reset"
      ]
    });
  }

  // Create analysis for access denied
  if (accessDenied.length > 0) {
    analyses.push({
      type: "Errores de Acceso Denegado (Credential Desync)",
      description: `${accessDenied.length} equipos reportan acceso denegado. Esto indica que las credenciales de la cuenta de equipo están desincronizadas entre el equipo y AD (password mismatch).`,
      severity: accessDenied.length > 3 ? "critical" : "warning",
      affectedObjects: accessDenied.slice(0, 15),
      remediation: [
        "En el equipo afectado ejecutar: Reset-ComputerMachinePassword -Credential (Get-Credential)",
        "Alternativa PowerShell: Test-ComputerSecureChannel -Repair -Credential (Get-Credential)",
        "Si persiste, desunir y reunir al dominio manualmente",
        "Verificar que la política 'Machine account password age' no sea muy agresiva"
      ]
    });
  }

  // Create analysis for secure channel errors
  if (secureChannelErrors.length > 0) {
    analyses.push({
      type: "Errores de Canal Seguro (Secure Channel)",
      description: `${secureChannelErrors.length} equipos tienen problemas estableciendo canal seguro con el DC. Esto previene la autenticación Kerberos y puede causar fallas de login.`,
      severity: "critical",
      affectedObjects: secureChannelErrors.slice(0, 15),
      remediation: [
        "Verificar canal seguro: Test-ComputerSecureChannel -Server DC01",
        "Reparar canal: Test-ComputerSecureChannel -Repair",
        "Verificar sincronización de tiempo (diferencia máx 5 min)",
        "Revisar conectividad a puertos: TCP 88 (Kerberos), 389 (LDAP), 445 (SMB)"
      ]
    });
  }

  return analyses;
};

// Analyze NTDS/Replication errors
const analyzeNTDSErrors = (events: any[]): ErrorAnalysis[] => {
  const analyses: ErrorAnalysis[] = [];
  const ntdsEvents = events.filter((e: any) =>
    e.Source === "NTDS" || e.Source === "NTDS Replication" || e.Source === "ActiveDirectory_DomainService"
  );

  if (ntdsEvents.length === 0) return analyses;

  const replicationPartners: string[] = [];
  const databaseErrors: string[] = [];

  ntdsEvents.forEach((event: any) => {
    const message = event.Message || "";

    // Replication partner failures
    const partnerMatch = message.match(/(?:servidor|server|DC|partner)\s+([A-Z0-9._-]+)/i);
    if (partnerMatch && !replicationPartners.includes(partnerMatch[1])) {
      replicationPartners.push(partnerMatch[1]);
    }

    // Database errors
    if (message.match(/database|base de datos|jet|esent/i)) {
      databaseErrors.push(event.EventID?.toString() || "Unknown");
    }
  });

  if (replicationPartners.length > 0 || ntdsEvents.length > 0) {
    analyses.push({
      type: "Errores de Replicación de Active Directory",
      description: `Se detectaron ${ntdsEvents.length} errores relacionados con la base de datos AD y replicación. Esto puede causar inconsistencias entre DCs y pérdida de cambios.`,
      severity: ntdsEvents.length > 5 ? "critical" : "warning",
      affectedObjects: replicationPartners.length > 0 ? replicationPartners : [`${ntdsEvents.length} eventos NTDS`],
      remediation: [
        "Verificar estado de replicación: repadmin /replsummary",
        "Identificar fallos específicos: repadmin /showrepl",
        "Forzar replicación: repadmin /syncall /AdeP",
        "Verificar conectividad RPC entre DCs: dcdiag /test:connectivity"
      ]
    });
  }

  return analyses;
};

// Analyze KDC/Kerberos errors
const analyzeKDCErrors = (events: any[]): ErrorAnalysis[] => {
  const analyses: ErrorAnalysis[] = [];
  const kdcEvents = events.filter((e: any) =>
    e.Source === "Kerberos-Key-Distribution-Center" || e.Source === "KDC" || e.Source === "Kerberos"
  );

  if (kdcEvents.length === 0) return analyses;

  const spnProblems: string[] = [];
  const encryptionErrors: string[] = [];

  kdcEvents.forEach((event: any) => {
    const message = event.Message || "";

    // SPN issues
    if (message.match(/SPN|service principal|principal de servicio/i)) {
      const spnMatch = message.match(/SPN[:\s]+([^\s,]+)/i) ||
                       message.match(/servicio\s+([^\s,]+)/i);
      if (spnMatch && !spnProblems.includes(spnMatch[1])) {
        spnProblems.push(spnMatch[1]);
      }
    }

    // Encryption type errors
    if (message.match(/encryption|cifrado|etype/i)) {
      encryptionErrors.push(event.EventID?.toString() || "Unknown");
    }
  });

  analyses.push({
    type: "Errores de Kerberos (KDC)",
    description: `Se detectaron ${kdcEvents.length} errores de Kerberos. Esto afecta la autenticación segura y puede causar fallback a NTLM o fallas de login.`,
    severity: kdcEvents.length > 3 ? "critical" : "warning",
    affectedObjects: spnProblems.length > 0 ? spnProblems : [`${kdcEvents.length} eventos KDC`],
    remediation: [
      "Verificar SPNs duplicados: setspn -X",
      "Verificar tipos de cifrado: Get-ADUser/Computer -Properties msDS-SupportedEncryptionTypes",
      "Verificar sincronización de tiempo (crítico para Kerberos)",
      "Revisar política 'Network security: Configure encryption types allowed for Kerberos'"
    ]
  });

  return analyses;
};

// Analyze DNS errors
const analyzeDNSErrors = (events: any[]): ErrorAnalysis[] => {
  const analyses: ErrorAnalysis[] = [];
  const dnsEvents = events.filter((e: any) =>
    e.Source === "DNS" || e.Source === "DNS Server" || (e.Source && e.Source.includes("DNS"))
  );

  if (dnsEvents.length === 0) return analyses;

  analyses.push({
    type: "Errores de DNS Server",
    description: `Se detectaron ${dnsEvents.length} errores de DNS. DNS es crítico para AD - todos los servicios dependen de la resolución correcta de nombres.`,
    severity: dnsEvents.length > 5 ? "critical" : "warning",
    affectedObjects: [`${dnsEvents.length} eventos de DNS`],
    remediation: [
      "Verificar zonas DNS: dnscmd /EnumZones",
      "Verificar registros SRV: nslookup -type=srv _ldap._tcp.dc._msdcs.DOMINIO",
      "Limpiar caché DNS: Clear-DnsServerCache",
      "Verificar replicación de zonas integradas en AD"
    ]
  });

  return analyses;
};

// Analyze Time Sync errors
const analyzeTimeSyncErrors = (events: any[]): ErrorAnalysis[] => {
  const analyses: ErrorAnalysis[] = [];
  const timeEvents = events.filter((e: any) =>
    e.Source === "W32Time" || e.Source === "Time-Service"
  );

  if (timeEvents.length === 0) return analyses;

  analyses.push({
    type: "Errores de Sincronización de Tiempo",
    description: `Se detectaron ${timeEvents.length} errores de sincronización de tiempo. Una diferencia mayor a 5 minutos causa fallas de autenticación Kerberos.`,
    severity: timeEvents.length > 3 ? "critical" : "warning",
    affectedObjects: [`${timeEvents.length} eventos de tiempo`],
    remediation: [
      "PDC debe sincronizar con fuente externa: w32tm /config /manualpeerlist:time.windows.com /syncfromflags:manual",
      "Otros DCs sincronizan con PDC automáticamente",
      "Verificar jerarquía: w32tm /query /status",
      "Forzar resync: w32tm /resync /force"
    ]
  });

  return analyses;
};

// Analyze DFSR/SYSVOL errors
const analyzeDFSRErrors = (events: any[]): ErrorAnalysis[] => {
  const analyses: ErrorAnalysis[] = [];
  const dfsrEvents = events.filter((e: any) =>
    e.Source === "DFSR" || e.Source === "DFS Replication" || e.Source === "NtFrs"
  );

  if (dfsrEvents.length === 0) return analyses;

  analyses.push({
    type: "Errores de Replicación SYSVOL (DFS-R)",
    description: `Se detectaron ${dfsrEvents.length} errores de replicación SYSVOL/DFS-R. Esto causa que las GPOs no se apliquen consistentemente en todos los DCs.`,
    severity: dfsrEvents.length > 5 ? "critical" : "warning",
    affectedObjects: [`${dfsrEvents.length} eventos DFS-R`],
    remediation: [
      "Verificar estado: dfsrdiag ReplicationState",
      "Verificar backlog: dfsrdiag Backlog /RGName:'Domain System Volume'",
      "Si hay conflictos, revisar: Get-DfsrBacklog",
      "Para problemas graves considerar: D2 authoritative restore"
    ]
  });

  return analyses;
};

// Main function to perform comprehensive DC health analysis
// Uses HygieneAnalysis from PS1 if available, falls back to regex analysis
const analyzeDCHealthDetailed = (dc: any): DCHealthAnalysis => {
  const events = dc.CriticalEvents || [];
  const rootCauseAnalysis: ErrorAnalysis[] = [];
  const hygieneData = dc.HygieneAnalysis;

  // If HygieneAnalysis exists (from improved PS1 v3.6.12+), use structured data
  if (hygieneData) {
    // Ghost Computers from PS1
    if (hygieneData.GhostComputers && hygieneData.GhostComputers.length > 0) {
      rootCauseAnalysis.push({
        type: "Cuentas de Equipo Fantasma (Ghost Objects)",
        description: `Se detectaron ${hygieneData.GhostComputersCount} equipos que intentan autenticarse pero sus cuentas de AD no existen o están desincronizadas. Esto ocurre cuando equipos fueron reformateados sin eliminar su cuenta de AD, o cuando hay registros DNS obsoletos.`,
        severity: hygieneData.GhostComputersCount > 5 ? "critical" : "warning",
        affectedObjects: hygieneData.GhostComputers.slice(0, 15),
        remediation: [
          "Verificar si los equipos existen físicamente con: Get-ADComputer -Filter {Name -like 'NOMBREPC*'}",
          "Si no existen, eliminar cuentas huérfanas: Remove-ADComputer -Identity 'NOMBREPC'",
          "Limpiar registros DNS obsoletos: dnscmd /AgeAllRecords",
          "Habilitar scavenging en zonas DNS para limpieza automática"
        ]
      });
    }

    // Trust Failures from PS1
    if (hygieneData.TrustFailures && hygieneData.TrustFailures.length > 0) {
      rootCauseAnalysis.push({
        type: "Problemas de Relación de Confianza (Trust Failures)",
        description: `Se detectaron fallas en las relaciones de confianza con ${hygieneData.TrustFailuresCount} dominio(s). Esto impide la autenticación entre dominios y puede causar fallas de acceso a recursos compartidos.`,
        severity: "critical",
        affectedObjects: hygieneData.TrustFailures,
        remediation: [
          "Verificar estado del trust: Get-ADTrust -Filter * | Select Name, Direction, TrustType",
          "Restablecer la relación de confianza desde AD Domains and Trusts",
          "Verificar conectividad DNS entre dominios",
          "Comando para reparar: netdom trust DOMINIO /domain:OTRODOMINIO /reset"
        ]
      });
    }

    // Credential Desync from PS1
    if (hygieneData.CredentialDesync && hygieneData.CredentialDesync.length > 0) {
      rootCauseAnalysis.push({
        type: "Errores de Acceso Denegado (Credential Desync)",
        description: `${hygieneData.CredentialDesyncCount} equipos reportan acceso denegado. Esto indica que las credenciales de la cuenta de equipo están desincronizadas entre el equipo y AD (password mismatch).`,
        severity: hygieneData.CredentialDesyncCount > 3 ? "critical" : "warning",
        affectedObjects: hygieneData.CredentialDesync.slice(0, 15),
        remediation: [
          "En el equipo afectado ejecutar: Reset-ComputerMachinePassword -Credential (Get-Credential)",
          "Alternativa PowerShell: Test-ComputerSecureChannel -Repair -Credential (Get-Credential)",
          "Si persiste, desunir y reunir al dominio manualmente",
          "Verificar que la política 'Machine account password age' no sea muy agresiva"
        ]
      });
    }

    // Secure Channel Failures from PS1
    if (hygieneData.SecureChannelFailures && hygieneData.SecureChannelFailures.length > 0) {
      rootCauseAnalysis.push({
        type: "Errores de Canal Seguro (Secure Channel)",
        description: `${hygieneData.SecureChannelFailuresCount} equipos tienen problemas estableciendo canal seguro con el DC. Esto previene la autenticación Kerberos y puede causar fallas de login.`,
        severity: "critical",
        affectedObjects: hygieneData.SecureChannelFailures.slice(0, 15),
        remediation: [
          "Verificar canal seguro: Test-ComputerSecureChannel -Server DC01",
          "Reparar canal: Test-ComputerSecureChannel -Repair",
          "Verificar sincronización de tiempo (diferencia máx 5 min)",
          "Revisar conectividad a puertos: TCP 88 (Kerberos), 389 (LDAP), 445 (SMB)"
        ]
      });
    }

    // Replication Partner Issues from PS1
    if (hygieneData.ReplicationPartnerIssues && hygieneData.ReplicationPartnerIssues.length > 0) {
      rootCauseAnalysis.push({
        type: "Errores de Replicación de Active Directory",
        description: `Se detectaron problemas de replicación con ${hygieneData.ReplicationPartnerIssuesCount} DC partner(s). Esto puede causar inconsistencias entre DCs y pérdida de cambios.`,
        severity: hygieneData.ReplicationPartnerIssuesCount > 2 ? "critical" : "warning",
        affectedObjects: hygieneData.ReplicationPartnerIssues,
        remediation: [
          "Verificar estado de replicación: repadmin /replsummary",
          "Identificar fallos específicos: repadmin /showrepl",
          "Forzar replicación: repadmin /syncall /AdeP",
          "Verificar conectividad RPC entre DCs: dcdiag /test:connectivity"
        ]
      });
    }

    // Still run analyzers for KDC, DNS, Time, DFSR (not in HygieneAnalysis)
    rootCauseAnalysis.push(...analyzeKDCErrors(events));
    rootCauseAnalysis.push(...analyzeDNSErrors(events));
    rootCauseAnalysis.push(...analyzeTimeSyncErrors(events));
    rootCauseAnalysis.push(...analyzeDFSRErrors(events));

  } else {
    // Fallback: No HygieneAnalysis, use regex-based analysis (for old JSONs)
    rootCauseAnalysis.push(...analyzeNetlogonErrors(events));
    rootCauseAnalysis.push(...analyzeNTDSErrors(events));
    rootCauseAnalysis.push(...analyzeKDCErrors(events));
    rootCauseAnalysis.push(...analyzeDNSErrors(events));
    rootCauseAnalysis.push(...analyzeTimeSyncErrors(events));
    rootCauseAnalysis.push(...analyzeDFSRErrors(events));
  }

  // Determine overall status based on analysis
  let healthScore: "Healthy" | "Warning" | "Critical" = "Healthy";
  const issues: string[] = [];

  rootCauseAnalysis.forEach(analysis => {
    if (analysis.severity === "critical") {
      healthScore = "Critical";
    } else if (analysis.severity === "warning" && healthScore !== "Critical") {
      healthScore = "Warning";
    }
    issues.push(`${analysis.type}: ${analysis.affectedObjects.length} objetos afectados`);
  });

  // If no specific analysis but many events, still flag it
  if (rootCauseAnalysis.length === 0 && events.length > 50) {
    healthScore = "Warning";
    issues.push(`Alto volumen de eventos críticos (${events.length})`);
  }

  const status = healthScore === "Healthy" ? "SALUDABLE" :
                 healthScore === "Warning" ? "ADVERTENCIA" : "CRITICO";
  const color = healthScore === "Healthy" ? "low" :
                healthScore === "Warning" ? "medium" : "critical";

  return { status, color, issues, rootCauseAnalysis };
};

// =============================================================================
// ORIGINAL FUNCTIONS (kept for backward compatibility)
// =============================================================================

// Calculate DC OverallHealth from CriticalEvents when not provided
// Based on Microsoft Best Practices: DCDiag, repadmin /replsum, w32tm /monitor
const calculateDCHealth = (dc: any): { status: string; color: string; issues: string[] } => {
  // If OverallHealth already exists, use it
  if (dc.OverallHealth) {
    const status = dc.OverallHealth === "Healthy" ? "SALUDABLE" :
                   dc.OverallHealth === "Warning" ? "ADVERTENCIA" :
                   dc.OverallHealth === "Critical" ? "CRITICO" : "DESCONOCIDO";
    const color = dc.OverallHealth === "Healthy" ? "low" :
                  dc.OverallHealth === "Warning" ? "medium" : "critical";
    return { status, color, issues: dc.HealthIssues || [] };
  }

  // Calculate from CriticalEvents if OverallHealth is missing
  const events = dc.CriticalEvents || [];
  const issues: string[] = [];
  let healthScore: "Healthy" | "Warning" | "Critical" = "Healthy";

  // Count errors by source (AD-critical services)
  const netlogonErrors = events.filter((e: any) => e.Source === "NETLOGON").length;
  const ntdsErrors = events.filter((e: any) =>
    e.Source === "NTDS" || e.Source === "NTDS Replication" || e.Source === "ActiveDirectory_DomainService"
  ).length;
  const kdcErrors = events.filter((e: any) =>
    e.Source === "Kerberos-Key-Distribution-Center" || e.Source === "KDC"
  ).length;
  const dnsErrors = events.filter((e: any) =>
    e.Source === "DNS" || e.Source === "DNS Server" || (e.Source && e.Source.includes("DNS"))
  ).length;
  const timeErrors = events.filter((e: any) =>
    e.Source === "W32Time" || e.Source === "Time-Service"
  ).length;
  const dfsrErrors = events.filter((e: any) =>
    e.Source === "DFSR" || e.Source === "DFS Replication" || e.Source === "NtFrs"
  ).length;

  // CRITICAL: NETLOGON errors (authentication/trust issues)
  if (netlogonErrors > 10) {
    issues.push(`Errores NETLOGON críticos (${netlogonErrors}) - Problemas de autenticación`);
    healthScore = "Critical";
  } else if (netlogonErrors > 0) {
    issues.push(`Errores NETLOGON detectados (${netlogonErrors})`);
    if (healthScore !== "Critical") healthScore = "Warning";
  }

  // CRITICAL: NTDS errors (AD database/replication)
  if (ntdsErrors > 5) {
    issues.push(`Errores de base de datos AD (${ntdsErrors}) - Problemas de replicación`);
    healthScore = "Critical";
  } else if (ntdsErrors > 0) {
    issues.push(`Errores NTDS detectados (${ntdsErrors})`);
    if (healthScore !== "Critical") healthScore = "Warning";
  }

  // CRITICAL: KDC errors (Kerberos authentication)
  if (kdcErrors > 3) {
    issues.push(`Errores KDC Kerberos (${kdcErrors}) - Autenticación en riesgo`);
    healthScore = "Critical";
  } else if (kdcErrors > 0) {
    issues.push(`Errores KDC detectados (${kdcErrors})`);
    if (healthScore !== "Critical") healthScore = "Warning";
  }

  // WARNING: DNS errors
  if (dnsErrors > 5) {
    issues.push(`Errores DNS (${dnsErrors}) - Resolución de nombres afectada`);
    if (healthScore !== "Critical") healthScore = "Warning";
  }

  // WARNING: Time sync errors
  if (timeErrors > 3) {
    issues.push(`Errores de sincronización de tiempo (${timeErrors})`);
    if (healthScore !== "Critical") healthScore = "Warning";
  }

  // WARNING: DFSR/SYSVOL errors
  if (dfsrErrors > 5) {
    issues.push(`Errores de replicación SYSVOL (${dfsrErrors}) - GPOs afectadas`);
    if (healthScore !== "Critical") healthScore = "Warning";
  }

  // WARNING: High volume of events
  if (events.length > 50 && healthScore === "Healthy") {
    issues.push(`Alto volumen de eventos críticos (${events.length})`);
    healthScore = "Warning";
  }

  const status = healthScore === "Healthy" ? "SALUDABLE" :
                 healthScore === "Warning" ? "ADVERTENCIA" : "CRITICO";
  const color = healthScore === "Healthy" ? "low" :
                healthScore === "Warning" ? "medium" : "critical";

  return { status, color, issues };
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

// Parse PowerShell dates - handles multiple formats including /Date(timestamp)/ and ISO strings
const parseDate = (dateValue: any): string => {
  if (!dateValue) return 'N/A';

  try {
    // Handle PowerShell /Date(1234567890000)/ format
    if (typeof dateValue === 'string') {
      const match = dateValue.match(/\/Date\((-?\d+)\)\//);
      if (match) {
        const timestamp = parseInt(match[1], 10);
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('es-ES');
        }
      }

      // Try ISO string or other standard formats
      const date = new Date(dateValue);
      if (!isNaN(date.getTime()) && date.getFullYear() > 1970) {
        return date.toLocaleDateString('es-ES');
      }
    }

    // Handle Date object
    if (dateValue instanceof Date && !isNaN(dateValue.getTime())) {
      return dateValue.toLocaleDateString('es-ES');
    }

    // Handle timestamp number
    if (typeof dateValue === 'number' && dateValue > 0) {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-ES');
      }
    }

    return 'N/A';
  } catch {
    return 'N/A';
  }
};

const createTableRow = (cells: string[], isHeader = false, status?: string, columnWidths?: number[]) => {
  const cellBg = isHeader ? COLORS.primary : (status ? getStatusBg(status) : undefined);
  const borders = getTableBorders();

  return new TableRow({
    tableHeader: isHeader,
    children: cells.map((cell, index) => new TableCell({
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
      shading: cellBg ? { fill: cellBg, type: ShadingType.CLEAR } : undefined,
      width: columnWidths && columnWidths[index] ? { size: columnWidths[index], type: WidthType.DXA } : undefined,
      margins: {
        top: 150,
        bottom: 150,
        left: 150,
        right: 150,
      },
      borders,
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
  const borders = getTableBorders();
  return new Table({
    columnWidths: TABLE_WIDTHS.asymmetric,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: title, bold: true, size: 24 })],
              spacing: { before: 100, after: 100 },
            })],
            shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
            width: { size: TABLE_WIDTHS.asymmetric[0], type: WidthType.DXA },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            verticalAlign: VerticalAlign.CENTER,
            borders,
          }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: content, size: 22 })],
              spacing: { before: 100, after: 100 },
            })],
            width: { size: TABLE_WIDTHS.asymmetric[1], type: WidthType.DXA },
            margins: { top: 150, bottom: 150, left: 150, right: 150 },
            verticalAlign: VerticalAlign.CENTER,
            borders,
          }),
        ],
      }),
    ],
  });
};

// Función para crear tabla de evidencia (objetos afectados)
const createEvidenceTable = (evidence: any, severityColor: string): (Paragraph | Table)[] => {
  if (!evidence) return [];

  // Si evidence tiene el formato { count, affected_objects } del backend
  if (typeof evidence === 'object' && !Array.isArray(evidence) && evidence.affected_objects) {
    const objects = evidence.affected_objects;
    const totalCount = evidence.count || objects.length;

    if (Array.isArray(objects) && objects.length > 0) {
      // Si affected_objects es un array de strings simples
      if (typeof objects[0] === 'string') {
        return [
          new Paragraph({
            children: [new TextRun({
              text: `Objetos Afectados (${totalCount}):`,
              bold: true,
              size: 22,
              color: severityColor,
            })],
            spacing: { before: 150, after: 100 },
          }),
          new Table({
            columnWidths: TABLE_WIDTHS.twoCol,
            rows: [
              createTableRow(['#', 'Nombre/Cuenta'], true, undefined, TABLE_WIDTHS.twoCol),
              ...objects.slice(0, 15).map((name: string, idx: number) =>
                createTableRow([(idx + 1).toString(), name], false, undefined, TABLE_WIDTHS.twoCol)
              ),
            ],
          }),
          ...(totalCount > 15 ? [
            new Paragraph({
              children: [new TextRun({ text: `... y ${totalCount - 15} objetos más.`, size: 20 })],
              spacing: { before: 50, after: 150 },
              shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
            }),
          ] : []),
          new Paragraph({ text: "", spacing: { after: 100 } }),
        ];
      }
      // Si affected_objects es un array de objetos complejos, procesar abajo
      return createEvidenceTable(objects, severityColor);
    }
  }

  // Si evidence es un array de objetos
  if (Array.isArray(evidence) && evidence.length > 0) {
    // Detectar las columnas disponibles del primer objeto
    const firstItem = evidence[0];
    const columns: string[] = [];
    const columnLabels: { [key: string]: string } = {
      'SamAccountName': 'Usuario/Cuenta',
      'Name': 'Nombre',
      'name': 'Nombre',
      'ComputerName': 'Equipo',
      'HostName': 'Hostname',
      'OperatingSystem': 'Sistema Operativo',
      'LastLogonDate': 'Último Inicio',
      'PasswordLastSet': 'Contraseña Cambiada',
      'Enabled': 'Habilitado',
      'ServicePrincipalName': 'SPN',
      'SPN': 'SPN',
      'DistinguishedName': 'DN',
      'Description': 'Descripción',
      'DaysSinceLastLogon': 'Días Inactivo',
      'DaysInactive': 'Días Inactivo',
      'IPv4Address': 'IP',
    };

    // Seleccionar columnas relevantes (máximo 4)
    const priorityColumns = ['SamAccountName', 'Name', 'name', 'ComputerName', 'HostName', 'OperatingSystem', 'LastLogonDate', 'DaysSinceLastLogon', 'DaysInactive', 'Enabled'];
    for (const col of priorityColumns) {
      if (firstItem[col] !== undefined && columns.length < 4) {
        columns.push(col);
      }
    }

    // Si no hay columnas prioritarias, usar las primeras disponibles
    if (columns.length === 0) {
      const availableKeys = Object.keys(firstItem).filter(k =>
        typeof firstItem[k] !== 'object' && k !== 'id' && k !== 'Id'
      );
      columns.push(...availableKeys.slice(0, 4));
    }

    if (columns.length === 0) return [];

    const headerLabels = columns.map(col => columnLabels[col] || col);

    return [
      new Paragraph({
        children: [new TextRun({
          text: "Objetos Afectados:",
          bold: true,
          size: 22,
          color: severityColor,
        })],
        spacing: { before: 150, after: 100 },
      }),
      new Table({
        columnWidths: columns.length === 2 ? TABLE_WIDTHS.twoCol :
                      columns.length === 3 ? TABLE_WIDTHS.threeCol : TABLE_WIDTHS.fourCol,
        rows: [
          createTableRow(headerLabels, true),
          ...evidence.slice(0, 15).map((item: any) => {
            const values = columns.map(col => {
              const val = item[col];
              if (val === undefined || val === null) return 'N/A';
              if (typeof val === 'boolean') return val ? 'Sí' : 'No';
              if (val instanceof Date) return val.toLocaleDateString('es-ES');
              // Parsear fechas de PowerShell
              if (typeof val === 'string' && val.includes('/Date(')) {
                const match = val.match(/\/Date\((-?\d+)\)\//);
                if (match) {
                  return new Date(parseInt(match[1])).toLocaleDateString('es-ES');
                }
              }
              return String(val).substring(0, 40);
            });
            return createTableRow(values, false);
          }),
        ],
      }),
      ...(evidence.length > 15 ? [
        new Paragraph({
          children: [new TextRun({ text: `... y ${evidence.length - 15} objetos más.`, size: 20 })],
          spacing: { before: 50, after: 150 },
        }),
      ] : []),
      new Paragraph({ text: "", spacing: { after: 100 } }),
    ];
  }

  // Si evidence es un string o tiene formato especial
  if (typeof evidence === 'string' && evidence.length > 0) {
    return [
      new Paragraph({
        children: [new TextRun({
          text: "Objetos Afectados: ",
          bold: true,
          size: 22,
          color: severityColor,
        }), new TextRun({
          text: evidence,
          size: 22,
        })],
        spacing: { before: 150, after: 150 },
        shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
      }),
    ];
  }

  return [];
};

export async function generateReport(data: ReportData): Promise<Blob> {
  const { assessment, findings: rawFindings, rawData } = data;

  // ═══════════════════════════════════════════════════════════════════════════
  // DEDUPLICACIÓN Y CONSOLIDACIÓN DE FINDINGS
  // Combina findings similares para evitar redundancia en el informe
  // ═══════════════════════════════════════════════════════════════════════════
  const deduplicateFindings = (findings: Finding[]): Finding[] => {
    const consolidated: Finding[] = [];
    const processed = new Set<string>();

    // Patrones de consolidación
    const patterns = [
      {
        // Equipos inactivos +90 días (múltiples variantes)
        match: (f: Finding) => /equipos?\s+(inactivos?|sin\s+actividad|habilitados?).*90\s+d[ií]as/i.test(f.title) ||
                              /90\s+d[ií]as.*inactivos?/i.test(f.title) ||
                              /stale.*computer/i.test(f.title),
        key: 'stale-computers-90days',
        consolidate: (items: Finding[]) => {
          const totalCount = items.reduce((sum, f) => sum + (f.affected_count || parseInt(f.title.match(/\d+/)?.[0] || '0')), 0);
          const maxSeverity = items.some(f => f.severity === 'critical') ? 'critical' :
                             items.some(f => f.severity === 'high') ? 'high' : 'medium';
          return {
            ...items[0],
            id: 'consolidated-stale-computers',
            title: `${totalCount} equipos inactivos por más de 90 días detectados en el dominio`,
            severity: maxSeverity,
            description: `Se detectaron ${totalCount} equipos con cuentas habilitadas en Active Directory que no han iniciado sesión en más de 90 días. Estos equipos representan un riesgo de seguridad significativo porque mantienen credenciales válidas que pueden ser comprometidas sin detección. Incluye equipos "zombie" con años de inactividad que expanden la superficie de ataque innecesariamente.`,
            recommendation: `Plan de remediación: 1) Generar lista completa con Get-ADComputer -Filter {LastLogonDate -lt (Get-Date).AddDays(-90)} 2) Validar con áreas de negocio qué equipos siguen en uso 3) Deshabilitar equipos confirmados como inactivos 4) Mover a OU de "Pendiente Eliminación" 5) Eliminar después de 30 días sin reclamos. Referencia: CIS Control 1.4 - Maintain Asset Inventory.`,
            affected_count: totalCount,
          };
        }
      },
      {
        // Windows 7 sin soporte (múltiples variantes)
        match: (f: Finding) => /windows\s*7/i.test(f.title) && /(sin\s+soporte|obsoleto|legacy)/i.test(f.title),
        key: 'windows7-unsupported',
        consolidate: (items: Finding[]) => {
          const totalCount = items.reduce((sum, f) => sum + (f.affected_count || parseInt(f.title.match(/\d+/)?.[0] || '1')), 0);
          return {
            ...items[0],
            id: 'consolidated-windows7',
            title: `${totalCount} equipos con Windows 7 sin soporte de seguridad`,
            severity: 'critical',
            description: `Se identificaron ${totalCount} equipos ejecutando Windows 7, sistema operativo que finalizó su soporte extendido el 14 de enero de 2020. Estos equipos no reciben actualizaciones de seguridad desde hace más de 4 años, dejándolos vulnerables a exploits conocidos como EternalBlue (WannaCry), BlueKeep (CVE-2019-0708) y vulnerabilidades posteriores.`,
            recommendation: `Plan de migración urgente: 1) Inventariar aplicaciones críticas en cada equipo 2) Evaluar compatibilidad con Windows 10/11 3) Planificar migración o reemplazo de hardware 4) Mientras tanto, aislar en VLAN separada sin acceso a recursos sensibles. Timeline: INMEDIATO (0-30 días). Referencia: CIS Control 7.1 - Maintain Supported Operating Systems.`,
            affected_count: totalCount,
          };
        }
      },
      {
        // Windows Server 2008 R2 sin soporte
        match: (f: Finding) => /windows\s*server\s*2008/i.test(f.title) && /(sin\s+soporte|obsoleto|legacy)/i.test(f.title),
        key: 'server2008-unsupported',
        consolidate: (items: Finding[]) => {
          const totalCount = items.reduce((sum, f) => sum + (f.affected_count || parseInt(f.title.match(/\d+/)?.[0] || '1')), 0);
          return {
            ...items[0],
            id: 'consolidated-server2008',
            title: `${totalCount} servidores con Windows Server 2008/2008 R2 sin soporte`,
            severity: 'critical',
            description: `Se identificaron ${totalCount} servidores ejecutando Windows Server 2008 o 2008 R2, sistemas que finalizaron soporte extendido el 14 de enero de 2020. Vulnerables a EternalBlue (MS17-010), BlueKeep y exploits posteriores sin parches disponibles.`,
            recommendation: `Migración urgente a Windows Server 2019/2022. Usar Storage Migration Service para migrar roles. Si no es posible migrar inmediatamente, considerar ESU (Extended Security Updates) de Microsoft como medida temporal.`,
            affected_count: totalCount,
          };
        }
      },
      {
        // Windows 8/8.1 sin soporte
        match: (f: Finding) => /windows\s*8\.?1?/i.test(f.title) && /(sin\s+soporte|obsoleto|fuera)/i.test(f.title),
        key: 'windows8-unsupported',
        consolidate: (items: Finding[]) => {
          const totalCount = items.reduce((sum, f) => sum + (f.affected_count || parseInt(f.title.match(/\d+/)?.[0] || '1')), 0);
          return {
            ...items[0],
            id: 'consolidated-windows8',
            title: `${totalCount} equipos con Windows 8/8.1 sin soporte extendido`,
            severity: 'high',
            description: `Se detectaron ${totalCount} equipos ejecutando Windows 8 o 8.1. Windows 8 finalizó soporte en 2018 y Windows 8.1 en enero 2023. No reciben actualizaciones de seguridad.`,
            recommendation: `Actualizar a Windows 10/11. Menor urgencia que Windows 7 pero requiere atención en 60 días.`,
            affected_count: totalCount,
          };
        }
      },
      {
        // Windows Server 2012/2012 R2
        match: (f: Finding) => /windows\s*server\s*2012/i.test(f.title) && /(sin\s+soporte|obsoleto|fin\s+de\s+soporte)/i.test(f.title),
        key: 'server2012-unsupported',
        consolidate: (items: Finding[]) => {
          const totalCount = items.reduce((sum, f) => sum + (f.affected_count || parseInt(f.title.match(/\d+/)?.[0] || '1')), 0);
          return {
            ...items[0],
            id: 'consolidated-server2012',
            title: `${totalCount} servidores con Windows Server 2012/2012 R2 en fin de soporte`,
            severity: 'high',
            description: `Se identificaron ${totalCount} servidores ejecutando Windows Server 2012 o 2012 R2. El soporte extendido finalizó en octubre 2023.`,
            recommendation: `Planificar migración a Windows Server 2019/2022 en los próximos 90 días. Considerar ESU si la migración no es inmediatamente posible.`,
            affected_count: totalCount,
          };
        }
      },
      {
        // Sistemas operativos obsoletos genérico
        match: (f: Finding) => /sistemas?\s+operativos?\s+obsoletos?/i.test(f.title) && !/windows\s*(7|8|server)/i.test(f.title),
        key: 'generic-obsolete-os',
        consolidate: (items: Finding[]) => {
          const totalCount = items.reduce((sum, f) => sum + (f.affected_count || parseInt(f.title.match(/\d+/)?.[0] || '1')), 0);
          return {
            ...items[0],
            id: 'consolidated-obsolete-os',
            title: `${totalCount} equipos con sistemas operativos obsoletos sin soporte`,
            severity: 'critical',
            description: `Se identificaron ${totalCount} equipos ejecutando sistemas operativos que ya no reciben actualizaciones de seguridad (Windows XP, Vista, Server 2003, etc.).`,
            recommendation: `Migrar o reemplazar estos equipos con urgencia máxima. Aislar de la red mientras se planifica la migración.`,
            affected_count: totalCount,
          };
        }
      }
    ];

    // Agrupar findings por patrón
    const groups = new Map<string, Finding[]>();

    for (const finding of findings) {
      let matched = false;
      for (const pattern of patterns) {
        if (pattern.match(finding)) {
          const key = pattern.key;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(finding);
          matched = true;
          break;
        }
      }
      if (!matched) {
        // No coincide con ningún patrón, agregar directamente
        consolidated.push(finding);
      }
    }

    // Consolidar grupos
    for (const [key, items] of groups) {
      const pattern = patterns.find(p => p.key === key);
      if (pattern && items.length > 0) {
        const consolidatedFinding = pattern.consolidate(items);
        consolidated.push(consolidatedFinding);
      }
    }

    return consolidated;
  };

  // Aplicar deduplicación
  const findings = deduplicateFindings(rawFindings);

  // ═══════════════════════════════════════════════════════════════════════════
  // TRADUCCIÓN DE MENSAJES COMUNES
  // ═══════════════════════════════════════════════════════════════════════════
  const translateHealthIssue = (issue: string): string => {
    const translations: { [key: string]: string } = {
      'Antivirus disabled or unknown': 'Antivirus deshabilitado o desconocido',
      'Real-time protection disabled': 'Protección en tiempo real deshabilitada',
      'High number of critical events': 'Alto número de eventos críticos',
      'Multiple NETLOGON errors': 'Múltiples errores de NETLOGON',
      'Time synchronization error detected': 'Error de sincronización de tiempo detectado',
      'Recursion is ENABLED - Risk of DNS amplification attacks': 'Recursión HABILITADA - Riesgo de ataques de amplificación DNS',
      'Event logging level too low - Insufficient audit trail': 'Nivel de registro de eventos muy bajo - Auditoría insuficiente',
      'DNS cache poisoning vulnerability': 'Vulnerabilidad de envenenamiento de caché DNS',
      'Zone transfer allowed to any server': 'Transferencia de zona permitida a cualquier servidor',
    };

    // Buscar traducción exacta
    if (translations[issue]) return translations[issue];

    // Buscar traducción parcial
    for (const [eng, esp] of Object.entries(translations)) {
      if (issue.includes(eng)) {
        return issue.replace(eng, esp);
      }
    }

    // Traducir patrones comunes
    return issue
      .replace(/High number of critical events \((\d+)\)/g, 'Alto número de eventos críticos ($1)')
      .replace(/Multiple NETLOGON errors \((\d+)\)/g, 'Múltiples errores de NETLOGON ($1)')
      .replace(/Recursion is ENABLED/g, 'Recursión HABILITADA')
      .replace(/Risk of DNS amplification attacks/g, 'Riesgo de ataques de amplificación DNS')
      .replace(/Event logging level too low/g, 'Nivel de registro muy bajo')
      .replace(/Insufficient audit trail/g, 'Auditoría insuficiente');
  };

  const translateDNSIssue = (issue: string): string => {
    return issue
      .replace(/Recursion is ENABLED - Risk of DNS amplification attacks/g,
               'Recursión HABILITADA - Riesgo de ataques de amplificación DNS. La recursión permite que el servidor DNS consulte otros servidores en nombre de clientes, pero puede ser abusada para ataques DDoS.')
      .replace(/Event logging level too low - Insufficient audit trail/g,
               'Nivel de registro muy bajo - Auditoría insuficiente. Se recomienda aumentar el nivel de logging para detectar actividades sospechosas.');
  };

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
    styles: getDocumentStyles(),
    numbering: getNumberingConfig(),
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
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: `${assessment.domain} - Active Directory Assessment`, size: 18, color: COLORS.info }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "Página ", size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
                new TextRun({ text: " de ", size: 18 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
                new TextRun({ text: " | ", size: 18, color: COLORS.border }),
                new TextRun({ text: "CONFIDENCIAL", size: 18, bold: true, color: COLORS.critical }),
              ],
            }),
          ],
        }),
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
                    children: [new TextRun({ text: "Fecha de Evaluación", bold: true, size: 24 })],
                    alignment: AlignmentType.LEFT,
                  })],
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
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
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
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
                    children: [new TextRun({ text: "Estado de Salud", bold: true, size: 24 })],
                    alignment: AlignmentType.LEFT,
                  })],
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
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
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
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
            text: "CONFIDENCIAL",
            bold: true,
            color: COLORS.critical,
            size: 28,
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 400 },
        }),

        // PAGE BREAK AFTER COVER
        new Paragraph({ children: [new PageBreak()] }),

        // TABLE OF CONTENTS (Static - no update prompt on open)
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "Tabla de Contenidos", bold: true, size: 32 })],
          spacing: { after: 300 },
        }),
        // Static TOC entries
        ...([
          "1. Resumen del Bosque y Dominio AD",
          "2. Resumen Ejecutivo",
          "3. Puntuación de Higiene de Identidad",
          "4. Resumen de Hallazgos por Severidad",
          "5. Configuraciones Críticas",
          "6. Configuraciones de Riesgo Alto",
          "7. Configuraciones de Riesgo Medio",
          "8. Configuraciones de Riesgo Bajo",
          "9. Análisis Detallado de Usuarios",
          "10. Análisis de Grupos Privilegiados",
          "11. Análisis de GPOs",
          "12. Análisis de Equipos",
          "13. Salud de Controladores de Dominio",
          "14. Configuración DNS",
          "15. Configuración DHCP",
          "16. Topología de Sitios AD",
          "17. Resumen de Problemas por Nivel",
        ].map(title => new Paragraph({
          children: [
            new TextRun({ text: "• ", size: 22 }),
            new TextRun({ text: title, size: 22 }),
          ],
          spacing: { before: 60, after: 60 },
          indent: { left: 360 },
        }))),
        new Paragraph({ children: [new PageBreak()] }),

        // AD FOREST AND DOMAIN SUMMARY
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: "1. Resumen del Bosque y Dominio AD" })],
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
          children: [new TextRun({ text: "" })],
          spacing: { after: 200 },
        }),
        new Table({
          columnWidths: TABLE_WIDTHS.twoCol,
          rows: [
            createTableRow(["Propiedad", "Valor"], true, undefined, TABLE_WIDTHS.twoCol),
            createTableRow(["Nombre del Bosque AD", rawData?.ForestName || rawData?.DomainInfo?.ForestName || assessment.domain], false, undefined, TABLE_WIDTHS.twoCol),
            createTableRow(["Dominio Raíz del Bosque", rawData?.ForestRootDomain || rawData?.DomainInfo?.ForestRootDomain || assessment.domain], false, undefined, TABLE_WIDTHS.twoCol),
            createTableRow(["Nivel Funcional del Bosque", forestLevel], false, undefined, TABLE_WIDTHS.twoCol),
            createTableRow(["Nivel Funcional del Dominio", domainLevel], false, undefined, TABLE_WIDTHS.twoCol),
            createTableRow(["Controladores de Dominio", rawData?.DomainControllers?.length?.toString() || "N/A"], false, undefined, TABLE_WIDTHS.twoCol),
            createTableRow(["Número de Sitios AD", rawData?.Sites?.length?.toString() || "1"], false, undefined, TABLE_WIDTHS.twoCol),
          ],
        }),

        // DOMAIN CONTROLLER HEALTH (SEMAPHORE STYLE)
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "Estado de Controladores de Dominio" })],
          spacing: { before: 400, after: 200 },
        }),
        new Table({
          columnWidths: TABLE_WIDTHS.fourCol,
          rows: [
            createTableRow(["Hostname", "IPv4", "OS", "Estado"], true, undefined, TABLE_WIDTHS.fourCol),
            ...(rawData?.DomainControllers || []).map((dc: any) => {
              const isHealthy = true;
              const statusText = isHealthy ? "OK" : "REVISAR";
              const statusColor = isHealthy ? "low" : "high";

              return createTableRow([
                dc.HostName || dc.Name || "N/A",
                dc.IPv4Address || dc.IPAddress || "N/A",
                dc.OperatingSystem || "N/A",
                statusText
              ], false, statusColor);
            }),
          ],
        }),

        // SALUD DE ROLES FSMO
        new Paragraph({
          text: "Salud y Ubicación de Roles FSMO",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: `Estado General: ${rawData?.FSMORolesHealth?.OverallHealth || "Desconocido"}`,
          spacing: { after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Rol", "Titular", "Alcance", "Estado", "Latencia"], true),
            ...(rawData?.FSMORolesHealth?.Roles || []).map((role: any) => {
              const status = role.Health === "Healthy" ? "OK" : "ERROR";
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
        new Paragraph({
          text: "Estado del Pool RID",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Métrica", "Valor"], true),
            createTableRow(["RIDs Emitidos", rawData?.FSMORolesHealth?.RIDPoolStatus?.RIDsIssued?.toString() || "N/A"]),
            createTableRow(["RIDs Restantes", rawData?.FSMORolesHealth?.RIDPoolStatus?.RIDsRemaining?.toString() || "N/A"]),
            createTableRow(["% Utilizado", `${rawData?.FSMORolesHealth?.RIDPoolStatus?.PercentUsed || 0}%`]),
          ],
        }),

        // SALUD DE REPLICACIÓN
        // Soporta múltiples formatos de datos de replicación
        ...(() => {
          // Intentar extraer datos de replicación de varias fuentes posibles
          const replData = rawData?.ReplicationHealthAllDCs || rawData?.ReplicationStatus || rawData?.Replication || [];
          const replArray = Array.isArray(replData) ? replData :
                           (replData?.DCReplicationHealth ? replData.DCReplicationHealth : []);

          // Determinar el formato de los datos
          const hasPartners = replArray.some((dc: any) => dc.ReplicationPartners);

          let tableRows: any[] = [];

          if (hasPartners) {
            // Formato con ReplicationPartners anidados
            tableRows = replArray.flatMap((dc: any) =>
              (dc.ReplicationPartners || []).map((partner: any) => {
                const isHealthy = partner.LastReplicationResult === 0;
                const statusText = isHealthy ? "OK" : `ERROR ${partner.LastReplicationResult}`;
                const color = isHealthy ? "low" : "critical";
                return createTableRow([
                  dc.SourceDC || dc.DC || dc.Server || "N/A",
                  partner.Partner || partner.PartnerDC || "N/A",
                  statusText,
                  partner.ConsecutiveFailureCount?.toString() || "0"
                ], false, color);
              })
            );
          } else {
            // Formato plano (cada registro es una conexión de replicación)
            tableRows = replArray.map((r: any) => {
              const status = r.ReplicationStatus || r.Status || (r.LastReplicationSuccess ? "OK" : "ERROR");
              const isHealthy = status === "OK" || status === "Success" || r.ConsecutiveFailures === 0;
              const color = isHealthy ? "low" : "critical";
              return createTableRow([
                r.SourceDC || r.DC || r.Server || "N/A",
                r.PartnerDC || r.Partner || r.DestinationDC || "N/A",
                status,
                (r.ConsecutiveFailures || r.FailureCount || 0).toString()
              ], false, color);
            });
          }

          return [
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
                ...tableRows.slice(0, 20), // Limit detailed rows to prevent overflow
              ],
            }),
          ];
        })(),

        // TOPOLOGÍA DE SITIOS Y SUBNETS
        // Soporta múltiples formatos: SiteTopology.Sites, Sites.Sites, Sites
        ...(() => {
          // Intentar extraer datos de sitios de varias fuentes posibles
          const siteTopology = rawData?.SiteTopology;
          // IMPORTANTE: SiteTopology.Sites es el formato más común del PowerShell collector
          const sitesData = siteTopology?.Sites || rawData?.Sites?.Sites || rawData?.Sites || [];
          const sitesArray = Array.isArray(sitesData) ? sitesData : [];

          // Extraer subnets de SiteTopology si existe
          const subnetsData = siteTopology?.Subnets || rawData?.Subnets || [];
          const subnetsArray = Array.isArray(subnetsData) ? subnetsData : [];

          // Calcular sitios sin subnets asociadas (comparando con la lista de subnets)
          const sitesWithSubnets = new Set(
            subnetsArray.map((sub: any) => {
              // El Site puede venir como CN=SITENAME,CN=Sites,... o directamente como nombre
              const siteName = sub.Site || '';
              const match = siteName.match(/CN=([^,]+)/);
              return match ? match[1] : siteName;
            }).filter(Boolean)
          );

          const sitesWithoutSubnets = siteTopology?.SitesWithoutSubnets ||
            sitesArray
              .filter((s: any) => !sitesWithSubnets.has(s.Name || s.SiteName))
              .map((s: any) => s.Name || s.SiteName);

          const subnetsWithoutSite = siteTopology?.SubnetsWithoutSite ||
            subnetsArray.filter((sub: any) => !sub.Site).map((sub: any) => sub.Name);

          const emptySites = siteTopology?.EmptySites ||
            sitesArray.filter((s: any) => !s.Servers || s.Servers.length === 0).map((s: any) => s.Name || s.SiteName);

          // Si no hay datos relevantes, mostrar tabla de sitios si existe
          const hasSiteIssues = (sitesWithoutSubnets?.length > 0) ||
                               (subnetsWithoutSite?.length > 0) ||
                               (emptySites?.length > 0);
          const hasSitesData = sitesArray.length > 0;
          const hasSubnetsData = subnetsArray.length > 0;

          if (!hasSiteIssues && !hasSitesData && !hasSubnetsData) return [];

          const sections: any[] = [
            new Paragraph({
              text: "Topología de Sitios y Subnets AD",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
          ];

          // Mostrar tabla de sitios si hay datos
          if (hasSitesData) {
            sections.push(
              new Paragraph({
                text: `Se identificaron ${sitesArray.length} sitio(s) de Active Directory en el dominio.`,
                spacing: { after: 200 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  createTableRow(["Nombre del Site", "Descripción", "Ubicación"], true),
                  ...sitesArray.slice(0, 30).map((s: any) => {
                    return createTableRow([
                      s.Name || s.SiteName || 'N/A',
                      s.Description || '-',
                      s.Location || '-'
                    ]);
                  }),
                ],
              })
            );
          }

          // Mostrar resumen de subnets si hay datos
          if (hasSubnetsData) {
            sections.push(
              new Paragraph({
                text: `Subredes Configuradas (${subnetsArray.length} total)`,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 100 },
              }),
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  createTableRow(["Subred", "Site Asociado", "Descripción"], true),
                  ...subnetsArray.slice(0, 30).map((sub: any) => {
                    // Extraer nombre del site del DN
                    const siteDN = sub.Site || '';
                    const siteMatch = siteDN.match(/CN=([^,]+)/);
                    const siteName = siteMatch ? siteMatch[1] : (siteDN || '-');
                    return createTableRow([
                      sub.Name || 'N/A',
                      siteName,
                      sub.Description || '-'
                    ]);
                  }),
                ],
              }),
              ...(subnetsArray.length > 30 ? [
                new Paragraph({
                  text: `... y ${subnetsArray.length - 30} subredes más.`,
                  spacing: { before: 50, after: 100 },
                })
              ] : [])
            );
          }

          // Sitios sin Subnets
          if (sitesWithoutSubnets?.length > 0) {
            sections.push(
              new Paragraph({
                text: "Sitios Sin Subnets Asociadas",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 100 },
              }),
              new Paragraph({
                text: "Los siguientes sitios no tienen subredes asignadas, lo que puede causar problemas de autenticación y tráfico de clientes:",
                spacing: { after: 100 }
              }),
              ...sitesWithoutSubnets.slice(0, 20).map((site: string) =>
                new Paragraph({
                  text: `• ${site}`,
                  bullet: { level: 0 },
                  spacing: { after: 50 },
                })
              )
            );
          }

          // Subnets sin Sitio
          if (subnetsWithoutSite?.length > 0) {
            sections.push(
              new Paragraph({
                text: "Subredes No Asociadas a Sitios",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 100 },
              }),
              new Paragraph({
                text: "Las siguientes subredes no están asociadas a ningún sitio AD. Los clientes en estas redes pueden autenticarse contra DCs remotos ineficientes:",
                spacing: { after: 100 }
              }),
              ...subnetsWithoutSite.slice(0, 20).map((subnet: string) =>
                new Paragraph({
                  text: `• ${subnet}`,
                  bullet: { level: 0 },
                  spacing: { after: 50 }
                })
              )
            );
          }

          // Sitios Vacíos (Sin DCs)
          if (emptySites?.length > 0) {
            sections.push(
              new Paragraph({
                text: "Sitios Vacíos (Sin Controladores de Dominio)",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 100 },
              }),
              ...emptySites.slice(0, 20).map((site: string) =>
                new Paragraph({
                  text: `• ${site}`,
                  bullet: { level: 0 },
                  spacing: { after: 50 }
                })
              )
            );
          }

          return sections;
        })(),

        // ANÁLISIS DE OBJETOS DE DIRECTIVA DE GRUPO
        new Paragraph({
          text: "Análisis de Objetos de Directiva de Grupo",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: `Se identificaron un total de ${(rawData?.GPOs || []).length} Objetos de Directiva de Grupo en el dominio.`,
          spacing: { after: 200 },
        }),

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
            ...(rawData?.GPOs || []).slice(0, 20).map((gpo: any) => {
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
            const statusCount = (rawData?.GPOs || []).reduce((acc: any, gpo: any) => {
              const status = gpo.GpoStatus || "Desconocido";
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});
            return Object.keys(statusCount).length > 0 
              ? `GPO Status: ${Object.entries(statusCount).map(([status, count]) => `${status}: ${count}`).join(", ")}`
              : "No hay GPOs para analizar";
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
          const gpos = rawData?.GPOs || [];
          const recommendations = [];
          let recNumber = 1;

          if (gpos.length === 0) {
            return [
              new Paragraph({
                text: "No hay GPOs para analizar.",
                spacing: { after: 100 },
              })
            ];
          }

          // Verificar GPOs no enlazadas
          const unlinkedGPOs = gpos.filter((gpo: any) => !gpo.Links || gpo.Links.length === 0);
          if (unlinkedGPOs.length > 0) {
            recommendations.push(
              new Paragraph({
                text: `${recNumber}. GPOs No Enlazadas: ${unlinkedGPOs.length} GPO(s) no están enlazadas a ninguna OU.`,
                spacing: { before: 100, after: 50 },
              }),
              ...unlinkedGPOs.slice(0, 5).map((gpo: any) =>
                new Paragraph({
                  text: `   - ${gpo.DisplayName}`,
                  spacing: { after: 50 },
                })
              )
            );
            recNumber++;
          }

          // Verificar GPOs deshabilitadas
          const disabledGPOs = gpos.filter((gpo: any) => gpo.GpoStatus === "AllSettingsDisabled");
          if (disabledGPOs.length > 0) {
            recommendations.push(
              new Paragraph({
                text: `${recNumber}. GPOs Deshabilitadas: ${disabledGPOs.length} GPO(s) tienen todas las configuraciones deshabilitadas.`,
                spacing: { before: 100, after: 50 },
              }),
              ...disabledGPOs.slice(0, 5).map((gpo: any) =>
                new Paragraph({
                  text: `   - ${gpo.DisplayName}`,
                  spacing: { after: 50 },
                })
              )
            );
            recNumber++;
          }

          // Verificar GPOs antiguas (no modificadas en 180+ días)
          const now = new Date();
          const oldGPOs = gpos.filter((gpo: any) => {
            if (!gpo.ModificationTime) return false;
            const modDate = new Date(gpo.ModificationTime);
            const daysDiff = (now.getTime() - modDate.getTime()) / (1000 * 3600 * 24);
            return daysDiff > 180;
          });
          if (oldGPOs.length > 0) {
            recommendations.push(
              new Paragraph({
                text: `${recNumber}. GPOs Obsoletas: ${oldGPOs.length} GPO(s) no se han modificado en más de 180 días.`,
                spacing: { before: 100, after: 50 },
              })
            );
            recNumber++;
          }

          // Verificar GPOs con problemas de permisos
          const gposWithAuthUsers = gpos.filter((gpo: any) =>
            gpo.Permissions?.some((p: any) => p.Trustee === "Authenticated Users" && p.Permission !== "GpoApply")
          );
          if (gposWithAuthUsers.length > 0) {
            recommendations.push(
              new Paragraph({
                text: `${recNumber}. Problemas de Permisos: ${gposWithAuthUsers.length} GPO(s) pueden tener acceso excesivamente permisivo.`,
                spacing: { before: 100, after: 50 },
              }),
              ...gposWithAuthUsers.slice(0, 5).map((gpo: any) =>
                new Paragraph({
                  text: `   - ${gpo.DisplayName}`,
                  spacing: { after: 50 },
                })
              )
            );
            recNumber++;
          }

          // Recomendación general siempre al final
          recommendations.push(
            new Paragraph({
              text: `${recNumber}. Mejores Prácticas: Asegure que todas las GPOs sigan convenciones de nomenclatura y sean revisadas regularmente.`,
              spacing: { before: 100, after: 100 },
            })
          );

          return recommendations;
        })(),

        // RELACIONES DE CONFIANZA Y OBJETOS HUÉRFANOS
        // Buscar trusts en múltiples ubicaciones posibles del JSON
        ...(() => {
          const trustData = rawData?.TrustHealth || rawData?.Trusts || rawData?.DomainTrusts || [];
          const trusts = Array.isArray(trustData) ? trustData : [];

          if (trusts.length === 0 && !rawData?.TrustHealth && !rawData?.Trusts) {
            return []; // No hay sección de trusts en absoluto
          }

          return [
            new Paragraph({
              text: "Salud de Relaciones de Confianza",
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            // EXPLICACIÓN EJECUTIVA
            new Paragraph({
              children: [new TextRun({
                text: "¿Qué es esto? ",
                bold: true,
                size: 22,
              }), new TextRun({
                text: "Las relaciones de confianza (Trusts) permiten que usuarios de un dominio accedan a recursos de otro dominio. Son fundamentales para organizaciones con múltiples dominios o que colaboran con partners externos. Una relación mal configurada puede ser una puerta de entrada para atacantes.",
                size: 22,
              })],
              spacing: { after: 200 },
              shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
            }),
            ...(trusts.length > 0 ? [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  createTableRow(["Dominio Destino", "Tipo", "Dirección", "Estado"], true),
                  ...trusts.map((trust: any) => {
                    const targetName = trust.Target || trust.TrustedDomain || trust.Name || trust.TargetName || "N/A";
                    const trustType = trust.TrustType || trust.Type || "N/A";
                    const direction = trust.TrustDirection || trust.Direction || "N/A";
                    const isHealthy = trust.Status === "Success" || trust.Status === "Ok" || trust.ValidationStatus === "Healthy" || !trust.Issues || trust.Issues?.length === 0;
                    const status = isHealthy ? "ACTIVO" : "REVISAR";
                    const color = isHealthy ? "low" : "high";
                    return createTableRow([
                      targetName,
                      trustType,
                      direction,
                      status
                    ], false, color);
                  }),
                ],
              }),
              // Interpretación
              new Paragraph({
                children: [new TextRun({
                  text: "Interpretación: ",
                  bold: true,
                  size: 22,
                }), new TextRun({
                  text: `Se encontraron ${trusts.length} relación(es) de confianza configurada(s). "ACTIVO" significa que la relación funciona correctamente. "REVISAR" indica posibles problemas de conectividad o configuración que requieren atención.`,
                  size: 22,
                })],
                spacing: { before: 150, after: 200 },
              }),
            ] : [
              new Paragraph({
                text: "No se detectaron relaciones de confianza externas configuradas.",
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({
                  text: "Nota: ",
                  bold: true,
                  size: 22,
                }), new TextRun({
                  text: "Esto puede ser normal si su organización opera con un único dominio aislado. Si esperaba ver relaciones de confianza aquí, verifique que el script de recolección tenga permisos suficientes para consultarlas.",
                  size: 22,
                  italics: true,
                })],
                spacing: { after: 200 },
              }),
            ]),

            ...(rawData?.OrphanedTrusts && rawData.OrphanedTrusts.length > 0 ? [
              new Paragraph({
                text: "Relaciones de Confianza Huérfanas Detectadas",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 300, after: 100 },
              }),
              new Paragraph({
                children: [new TextRun({
                  text: "¿Qué significa? ",
                  bold: true,
                }), new TextRun({
                  text: "Se encontraron objetos de confianza (TDO) que apuntan a dominios que ya no existen o no responden. Esto puede indicar relaciones obsoletas que deberían eliminarse por seguridad.",
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
              ),
              new Paragraph({
                children: [new TextRun({
                  text: "Acción recomendada: ",
                  bold: true,
                }), new TextRun({
                  text: "Verifique si estos dominios aún existen. Si no, elimine las relaciones huérfanas con Remove-ADTrust.",
                })],
                spacing: { before: 100, after: 200 },
              }),
            ] : []),
          ];
        })(),

        // RIESGO DE OBJETOS PERSISTENTES (LINGERING OBJECTS)
        new Paragraph({
          text: "Análisis de Riesgo: Objetos Persistentes (Lingering Objects)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
          // EXPLICACIÓN EJECUTIVA
          new Paragraph({
            children: [new TextRun({
              text: "¿Qué son los Objetos Persistentes? ",
              bold: true,
              size: 22,
            }), new TextRun({
              text: "Cuando un objeto (usuario, computador, etc.) se elimina en un Controlador de Dominio pero otro DC no recibe la actualización a tiempo, puede \"resucitar\" el objeto eliminado. Esto causa inconsistencias de datos y potenciales problemas de seguridad si se reactivan cuentas que deberían estar eliminadas.",
              size: 22,
            })],
            spacing: { after: 150 },
            shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
          }),
          new Paragraph({
            children: [new TextRun({
              text: "¿Por qué importa? ",
              bold: true,
              size: 22,
            }), new TextRun({
              text: "Objetos persistentes pueden causar errores de replicación, bloqueos de autenticación, y en casos extremos, reactivar cuentas de usuario eliminadas permitiendo accesos no autorizados.",
              size: 22,
            })],
            spacing: { after: 200 },
          }),
          // Lingering Objects data table - handles array, object, or no data
          ...(() => {
            const lingeringData = rawData?.LingeringObjectsRisk;
            
            // No data case
            if (!lingeringData) {
              return [
                new Paragraph({
                  text: "No se encontraron datos de análisis de objetos persistentes.",
                  spacing: { before: 100, after: 100 },
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
                })
              ];
            }
            
            // Array format case
            if (Array.isArray(lingeringData)) {
              if (lingeringData.length === 0) {
                return [
                  new Paragraph({
                    text: "No se detectaron objetos persistentes.",
                    spacing: { before: 100, after: 100 },
                  })
                ];
              }
              return [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    createTableRow(["DC", "Estado de Riesgo", "Detalles"], true),
                    ...lingeringData.map((risk: any) => {
                      const isSafe = risk.Status === "Pass" || risk.RiskLevel === "Low";
                      const statusIcon = isSafe ? "BAJO RIESGO" : "ALTO RIESGO";
                      const color = isSafe ? "low" : "critical";
                      return createTableRow([
                        risk.TargetDC || "N/A",
                        statusIcon,
                        risk.Message || "Sin problemas detectados"
                      ], false, color);
                    }),
                  ],
                })
              ];
            }
            
            // Object format case with RiskLevel, DetectionMethod, Indicators array
            const result: any[] = [
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                  createTableRow(["Nivel de Riesgo", "Método de Detección"], true),
                  createTableRow([
                    lingeringData.RiskLevel || "Desconocido",
                    lingeringData.DetectionMethod || "N/A"
                  ], false, lingeringData.RiskLevel === "Low" ? "low" : "medium")
                ]
              })
            ];
            
            // Indicators as separate list (they are objects, not strings)
            if (lingeringData.Indicators && lingeringData.Indicators.length > 0) {
              result.push(
                new Paragraph({
                  text: "Indicadores Detectados:",
                  spacing: { before: 200, after: 100 },
                }),
                // Explicación de severidades
                new Paragraph({
                  children: [
                    new TextRun({ text: "Niveles de severidad: ", bold: true, size: 20 }),
                    new TextRun({ text: "[LOW] = Información/Bajo riesgo, ", size: 20, color: COLORS.low }),
                    new TextRun({ text: "[MEDIUM] = Atención recomendada, ", size: 20, color: COLORS.medium }),
                    new TextRun({ text: "[HIGH] = Acción requerida, ", size: 20, color: COLORS.high }),
                    new TextRun({ text: "[CRITICAL] = Urgente", size: 20, color: COLORS.critical }),
                  ],
                  spacing: { after: 100 },
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
                }),
                ...lingeringData.Indicators.map((indicator: any) => {
                  const severity = (indicator.Severity || "INFO").toUpperCase();
                  const color = severity === "CRITICAL" ? COLORS.critical :
                                severity === "HIGH" ? COLORS.high :
                                severity === "MEDIUM" ? COLORS.medium :
                                severity === "LOW" ? COLORS.low : COLORS.info;
                  return new Paragraph({
                    children: [
                      new TextRun({ text: `• [${severity}] `, bold: true, color: color, size: 22 }),
                      new TextRun({ text: indicator.Description || indicator.Type || "Sin descripción", size: 22 }),
                    ],
                    spacing: { after: 50 },
                  });
                })
              );
            } else {
              result.push(
                new Paragraph({
                  text: "No se detectaron indicadores de riesgo.",
                  spacing: { before: 100, after: 100 },
                })
              );
            }
            
            // USN Analysis if available
            if (lingeringData.USNAnalysis) {
              const gap = lingeringData.USNAnalysis.Gap || 0;
              const isLargeGap = gap > 1000000; // Más de 1 millón es significativo
              const isCriticalGap = gap > 5000000; // Más de 5 millones es crítico

              result.push(
                new Paragraph({
                  text: "Análisis USN (Update Sequence Number):",
                  spacing: { before: 200, after: 100 },
                }),
                // EXPLICACIÓN EJECUTIVA
                new Paragraph({
                  children: [new TextRun({
                    text: "¿Qué es el USN? ",
                    bold: true,
                    size: 21,
                  }), new TextRun({
                    text: "El USN es un contador que cada Controlador de Dominio usa para rastrear cambios. Cuando un DC hace un cambio (crear usuario, modificar grupo, etc.), incrementa su USN. Al comparar USNs entre DCs, podemos detectar si alguno está desincronizado.",
                    size: 21,
                  })],
                  spacing: { after: 150 },
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    createTableRow(["Métrica", "Valor", "Significado"], true),
                    createTableRow([
                      "DCs Analizados",
                      lingeringData.USNAnalysis.DCsAnalyzed?.toString() || "N/A",
                      "Número de Controladores de Dominio comparados"
                    ]),
                    createTableRow([
                      "USN Más Alto",
                      lingeringData.USNAnalysis.HighestUSN?.toLocaleString() || "N/A",
                      "El DC más actualizado tiene este número"
                    ]),
                    createTableRow([
                      "USN Más Bajo",
                      lingeringData.USNAnalysis.LowestUSN?.toLocaleString() || "N/A",
                      "El DC menos actualizado tiene este número"
                    ]),
                    createTableRow([
                      "Brecha USN",
                      gap.toLocaleString(),
                      isCriticalGap ? "[CRITICO] Brecha - Posible desincronización severa" :
                        isLargeGap ? "[ALERTA] Brecha significativa - Monitorear replicación" :
                        "[OK] Diferencia normal entre DCs"
                    ], false, isCriticalGap ? "critical" : isLargeGap ? "high" : "low"),
                  ]
                }),
                // Interpretación
                new Paragraph({
                  children: [new TextRun({
                    text: "Interpretación: ",
                    bold: true,
                    size: 21,
                  }), new TextRun({
                    text: isCriticalGap ?
                      `La brecha de ${gap.toLocaleString()} cambios entre DCs es MUY ALTA. Esto puede indicar que un DC estuvo offline por mucho tiempo o tiene problemas de replicación graves. Se recomienda investigar inmediatamente con 'repadmin /showrepl' y 'dcdiag'.` :
                      isLargeGap ?
                      `La brecha de ${gap.toLocaleString()} cambios es significativa pero puede ser normal en ambientes grandes con muchos cambios. Verifique que la replicación esté funcionando correctamente.` :
                      `La brecha de ${gap.toLocaleString()} cambios está dentro de rangos normales. Los DCs están razonablemente sincronizados.`,
                    size: 21,
                    color: isCriticalGap ? COLORS.critical : isLargeGap ? COLORS.high : undefined,
                  })],
                  spacing: { before: 150, after: 200 },
                })
              );
            }
            
            return result;
          })(),

        // ANÁLISIS DE CONFIGURACIÓN DNS
        new Paragraph({
          text: "Análisis de Configuración DNS",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: `Se analizó la configuración DNS en los controladores de dominio. Método utilizado: ${rawData?.DNSConfiguration?.Method || "DNSServer Module"}.`,
          spacing: { after: 200 },
        }),

        // Tabla de Zonas DNS
        new Paragraph({
          text: "Zonas DNS",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DNSConfiguration?.Zones || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Nombre de Zona", "Tipo", "Actualización Dinámica", "DNSSEC"], true),
              ...(rawData?.DNSConfiguration?.Zones || []).slice(0, 15).map((zone: any) => {
                return createTableRow([
                  zone.ZoneName || "N/A",
                  zone.ZoneType || "N/A",
                  zone.DynamicUpdate || "N/A",
                  zone.DNSSECStatus || "N/A"
                ]);
              }),
            ],
          }),
            // EXPLICACIÓN DE COLUMNAS PARA EJECUTIVOS
            new Paragraph({
              children: [new TextRun({
                text: "Guía de interpretación:",
                bold: true,
                size: 22,
              })],
              spacing: { before: 200, after: 100 },
              shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "• Actualización Dinámica: ", bold: true, size: 21 }),
                new TextRun({ text: '"Secure" es lo recomendado (solo equipos autenticados pueden crear registros). ', size: 21 }),
                new TextRun({ text: '"NonsecureAndSecure" permite que cualquier dispositivo cree registros DNS, lo cual es un riesgo de seguridad moderado. ', size: 21, color: COLORS.medium }),
                new TextRun({ text: '"None" significa que los registros se gestionan manualmente.', size: 21 }),
              ],
              spacing: { after: 80 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "• DNSSEC: ", bold: true, size: 21 }),
                new TextRun({ text: '"Signed" significa que la zona tiene firma digital para prevenir suplantación de DNS (recomendado para zonas críticas). ', size: 21 }),
                new TextRun({ text: '"Not Signed" indica que la zona no tiene protección contra ataques de envenenamiento DNS. ', size: 21, color: COLORS.medium }),
                new TextRun({ text: 'Para zonas internas de Active Directory, DNSSEC es opcional pero recomendado en ambientes de alta seguridad.', size: 21 }),
              ],
            spacing: { after: 200 },
          }),
        ] : [
          new Paragraph({
            text: "No se encontraron zonas DNS configuradas.",
            spacing: { after: 100 },
          }),
        ]),

        // Problemas de Seguridad DNS
        new Paragraph({
          text: "Problemas de Seguridad DNS",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DNSConfiguration?.GlobalSettings || []).some((s: any) => s.SecurityIssues && s.SecurityIssues.length > 0) ? [
          ...(rawData?.DNSConfiguration?.GlobalSettings || []).flatMap((setting: any) =>
            (setting.SecurityIssues || []).map((issue: string) =>
              new Paragraph({
                text: `- [${setting.DCName}] ${translateDNSIssue(issue)}`,
                spacing: { after: 50 },
              })
            )
          )
        ] : [
          new Paragraph({
            text: "No se detectaron problemas de seguridad DNS.",
            spacing: { after: 100 },
          }),
        ]),

        // 1. Conflictos DNS
        new Paragraph({
          text: "Conflictos de Registros DNS",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DNSConflicts || []).length > 0 ? [
          new Paragraph({
            text: "Se han detectado registros duplicados o en conflicto.",
            spacing: { after: 100 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Registro", "Conflicto", "Detalle"], true),
              ...(rawData?.DNSConflicts || []).slice(0, 15).map((conflict: any) =>
                createTableRow([
                  conflict.RecordName || "N/A",
                  conflict.ConflictType || "Duplicado",
                  conflict.Message || "-"
                ], false, "high")
              ),
            ],
          }),
          new Paragraph({ text: "", spacing: { after: 200 } })
        ] : [
          new Paragraph({
            text: "No se detectaron conflictos de registros DNS.",
            spacing: { after: 100 },
          }),
        ]),

          // 2. Scavenging Detallado
          new Paragraph({
            text: "Análisis de Limpieza DNS (Scavenging)",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
        ...(rawData?.DNSScavengingDetailed?.ConfigurationMismatches && rawData.DNSScavengingDetailed.ConfigurationMismatches.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "[ALERTA] Desalineación de Configuración: La configuración de limpieza difiere entre zonas y servidor.",
              color: COLORS.high
            })],
            spacing: { after: 100 }
          }),
          ...rawData.DNSScavengingDetailed.ConfigurationMismatches.map((mismatch: string) =>
            new Paragraph({
              text: `- ${mismatch}`,
              spacing: { after: 50 }
            })
          )
        ] : [
          new Paragraph({
            text: "La configuración (Aging/Scavenging) es consistente.",
            spacing: { after: 100 }
          })
        ]),
        new Paragraph({ text: "", spacing: { after: 200 } }),

        // 3. Root Hints
        new Paragraph({
          text: "Estado de Root Hints",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DNSRootHints?.UnresponsiveHints || []).length > 0 ? [
          new Paragraph({
            text: "Algunos servidores raíz no responden:",
            spacing: { after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Servidor Raíz", "Estado"], true),
              ...(rawData?.DNSRootHints?.UnresponsiveHints || []).map((hint: any) =>
                createTableRow([
                  hint.NameServer || String(hint),
                  "No Responde"
                ], false, "medium")
              )
            ]
          })
        ] : [
          new Paragraph({
            text: "Todos los servidores raíz responden correctamente.",
            spacing: { after: 100 },
          }),
        ]),

        // ANÁLISIS DE CONFIGURACIÓN DHCP
        new Paragraph({
          text: "Análisis de Configuración DHCP",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: `Se analizó la infraestructura DHCP. Método utilizado: ${rawData?.DHCPConfiguration?.Method || "Desconocido"}.`,
          spacing: { after: 200 },
        }),

        // Servidores Autorizados
        new Paragraph({
          text: "Servidores DHCP Autorizados",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DHCPConfiguration?.AuthorizedServers || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Servidor", "IP", "Estado"], true),
              ...(rawData?.DHCPConfiguration?.AuthorizedServers || []).map((server: any) => {
                return createTableRow([
                  server.DNSName || "N/A",
                  server.IPAddress || "N/A",
                  "Autorizado"
                ]);
              }),
            ],
          }),
        ] : [
          new Paragraph({
            text: "No se encontraron servidores DHCP autorizados.",
            spacing: { after: 100 },
          }),
        ]),

        // Scopes DHCP
        new Paragraph({
          text: "Ámbitos (Scopes) DHCP",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DHCPConfiguration?.Scopes || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Nombre", "Subnet", "Estado", "% Uso"], true),
              ...(rawData?.DHCPConfiguration?.Scopes || []).slice(0, 15).map((scope: any) => {
                return createTableRow([
                  scope.Name || "N/A",
                  scope.SubnetMask || "N/A",
                  scope.State || "N/A",
                  scope.PercentageInUse ? `${scope.PercentageInUse}%` : "N/A"
                ]);
              }),
            ],
          }),
        ] : [
          new Paragraph({
            text: "No se encontraron ámbitos DHCP configurados.",
            spacing: { after: 100 },
          }),
        ]),

        // DETALLES AVANZADOS DE DHCP

        // 1. Servidores Rogue (No Autorizados)
        new Paragraph({
          text: "Servidores DHCP Rogue",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DHCPRogueServers?.RogueServers || []).length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "CRÍTICO: Se han detectado servidores DHCP respondiendo en la red que NO están autorizados en Active Directory.",
              color: COLORS.critical,
              bold: true
            })],
            spacing: { after: 100 }
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["IP Server", "Mensaje"], true),
              ...(rawData?.DHCPRogueServers?.RogueServers || []).map((rogue: any) =>
                createTableRow([
                  rogue.ServerIpAddress || "N/A",
                  "No Autorizado en AD"
                ], false, "critical")
              )
            ]
          }),
          new Paragraph({ text: "", spacing: { after: 200 } })
        ] : [
          new Paragraph({
            text: "No se detectaron servidores DHCP rogue en la red.",
            spacing: { after: 100 },
          }),
        ]),

        // 2. Auditoría de Opciones DHCP
        new Paragraph({
          text: "Auditoría de Opciones de Ámbito",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        ...((rawData?.DHCPOptionsAudit?.Issues || []).length > 0 ? [
          new Paragraph({
            text: "Se han detectado configuraciones obsoletas o inseguras en las opciones de ámbito DHCP.",
            spacing: { after: 100 }
          }),
          ...(rawData?.DHCPOptionsAudit?.Issues || []).map((issue: string) =>
            new Paragraph({
              text: `- ${issue}`,
              bullet: { level: 0 },
              spacing: { after: 50 }
            })
          ),
          new Paragraph({ text: "", spacing: { after: 200 } })
        ] : [
          new Paragraph({
            text: "No se detectaron problemas de configuración en opciones DHCP.",
            spacing: { after: 100 },
          }),
        ]),



        // SALUD DE CONTROLADORES DE DOMINIO
        new Paragraph({
          text: "Salud de Controladores de Dominio",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Estado de salud basado en indicadores críticos de AD: errores de replicación (NTDS), autenticación (NETLOGON, KDC), sincronización de tiempo (W32Time), DNS y SYSVOL (DFSR).",
            size: 20,
            italics: true,
            color: COLORS.info,
          })],
          spacing: { after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["DC Name", "Estado General", "Eventos Críticos", "Problemas Detectados"], true),
            ...(rawData?.DCHealth?.DomainControllers || []).map((dc: any) => {
              const health = analyzeDCHealthDetailed(dc);
              const criticalEvents = dc.CriticalEvents?.length || 0;
              const issuesSummary = health.issues.length > 0
                ? health.issues.slice(0, 2).join("; ") + (health.issues.length > 2 ? "..." : "")
                : "Sin problemas";
              return createTableRow([
                dc.Name || "N/A",
                health.status,
                criticalEvents.toString(),
                issuesSummary
                ], false, health.color);
              }),
            ],
          }),

          // ========================================
          // ROOT CAUSE ANALYSIS SECTION
          // ========================================
          ...(() => {
            // Collect all root cause analyses from all DCs
            const allAnalyses: { dcName: string; analysis: ErrorAnalysis }[] = [];

            (rawData.DCHealth.DomainControllers || []).forEach((dc: any) => {
              const health = analyzeDCHealthDetailed(dc);
              health.rootCauseAnalysis.forEach(analysis => {
                allAnalyses.push({ dcName: dc.Name || "N/A", analysis });
              });
            });

            if (allAnalyses.length === 0) return [];

            // Group by error type to consolidate
            const groupedByType: { [key: string]: { analysis: ErrorAnalysis; dcs: string[] } } = {};
            allAnalyses.forEach(({ dcName, analysis }) => {
              if (!groupedByType[analysis.type]) {
                groupedByType[analysis.type] = { analysis, dcs: [] };
              }
              if (!groupedByType[analysis.type].dcs.includes(dcName)) {
                groupedByType[analysis.type].dcs.push(dcName);
              }
              // Merge affected objects
              analysis.affectedObjects.forEach(obj => {
                if (!groupedByType[analysis.type].analysis.affectedObjects.includes(obj)) {
                  groupedByType[analysis.type].analysis.affectedObjects.push(obj);
                }
              });
            });

            const sections: (Paragraph | Table)[] = [];

            // Add header for root cause analysis
            sections.push(
              new Paragraph({
                text: "Análisis de Causa Raíz",
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 400, after: 200 },
              }),
              new Paragraph({
                children: [new TextRun({
                  text: "A continuación se presenta un análisis detallado de los problemas detectados, incluyendo las causas probables, objetos afectados y recomendaciones de remediación.",
                  size: 20,
                  italics: true,
                })],
                spacing: { after: 200 },
              })
            );

            // Generate detailed section for each error type
            // Use counter for unique numbering references (restarts numbering for each error type)
            let remediationListIndex = 0;
            const remediationRefs = ["dc-remediation-1", "dc-remediation-2", "dc-remediation-3",
                                     "dc-remediation-4", "dc-remediation-5", "dc-remediation-6"];

            Object.values(groupedByType).forEach(({ analysis, dcs }) => {
              const severityColor = analysis.severity === "critical" ? COLORS.critical :
                                   analysis.severity === "warning" ? COLORS.medium : COLORS.info;

              // Error type header with severity badge
              sections.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: analysis.severity === "critical" ? "[CRÍTICO] " :
                            analysis.severity === "warning" ? "[ADVERTENCIA] " : "[INFO] ",
                      bold: true,
                      color: severityColor,
                      size: 24,
                    }),
                    new TextRun({
                      text: analysis.type,
                      bold: true,
                      size: 24,
                    }),
                  ],
                  spacing: { before: 300, after: 100 },
                  shading: {
                    type: ShadingType.CLEAR,
                    fill: analysis.severity === "critical" ? "FFF0F0" :
                          analysis.severity === "warning" ? "FFF8E6" : "F0F8FF",
                  },
                })
              );

              // Description
              sections.push(
                new Paragraph({
                  children: [new TextRun({
                    text: analysis.description,
                    size: 20,
                  })],
                  spacing: { after: 150 },
                })
              );

              // Affected DCs
              if (dcs.length > 0) {
                sections.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: "DCs Afectados: ", bold: true, size: 20 }),
                      new TextRun({ text: dcs.join(", "), size: 20, italics: true }),
                    ],
                    spacing: { after: 100 },
                  })
                );
              }

              // Affected objects displayed in a table (per docx-js best practices)
              if (analysis.affectedObjects.length > 0) {
                sections.push(
                  new Paragraph({
                    children: [new TextRun({
                      text: `Objetos Afectados (${analysis.affectedObjects.length}):`,
                      bold: true,
                      size: 20,
                    })],
                    spacing: { before: 100, after: 50 },
                  })
                );

                // Create table with affected objects (3 columns, max 15 objects)
                const objectsToShow = analysis.affectedObjects.slice(0, 15);
                const tableBorders = getTableBorders();

                // Split objects into rows of 3
                const rows: TableRow[] = [];
                for (let i = 0; i < objectsToShow.length; i += 3) {
                  const rowObjects = objectsToShow.slice(i, i + 3);
                  rows.push(
                    new TableRow({
                      children: [
                        ...rowObjects.map(obj =>
                          new TableCell({
                            borders: tableBorders,
                            width: { size: 3120, type: WidthType.DXA },
                            shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
                            children: [new Paragraph({
                              children: [new TextRun({ text: obj, size: 18, color: COLORS.info })],
                              alignment: AlignmentType.CENTER,
                            })],
                          })
                        ),
                        // Fill empty cells if row has less than 3 objects
                        ...Array(3 - rowObjects.length).fill(null).map(() =>
                          new TableCell({
                            borders: tableBorders,
                            width: { size: 3120, type: WidthType.DXA },
                            shading: { fill: "F5F5F5", type: ShadingType.CLEAR },
                            children: [new Paragraph({ children: [new TextRun("")] })],
                          })
                        ),
                      ],
                    })
                  );
                }

                sections.push(
                  new Table({
                    columnWidths: [3120, 3120, 3120], // 3 equal columns (9360 total for letter)
                    rows: rows,
                  })
                );

                // Show count if more than 15
                if (analysis.affectedObjects.length > 15) {
                  sections.push(
                    new Paragraph({
                      children: [new TextRun({
                        text: `... y ${analysis.affectedObjects.length - 15} objetos más`,
                        size: 18,
                        italics: true,
                        color: COLORS.info,
                      })],
                      spacing: { before: 50, after: 100 },
                      alignment: AlignmentType.RIGHT,
                    })
                  );
                }
              }

              // Remediation recommendations using proper numbering config
              sections.push(
                new Paragraph({
                  children: [new TextRun({
                    text: "Recomendaciones de Remediación:",
                    bold: true,
                    size: 20,
                    color: COLORS.successText,
                  })],
                  spacing: { before: 150, after: 50 },
                })
              );

              // Use unique numbering reference for each error type (restarts at 1)
              const currentRef = remediationRefs[remediationListIndex % remediationRefs.length];
              remediationListIndex++;

              analysis.remediation.forEach((step) => {
                sections.push(
                  new Paragraph({
                    numbering: { reference: currentRef, level: 0 },
                    children: [new TextRun({ text: step, size: 20 })],
                    spacing: { after: 30 },
                  })
                );
              });

              // Add separator
              sections.push(
                new Paragraph({
                  children: [new TextRun("")],
                  spacing: { after: 200 },
                  border: {
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                  },
                })
              );
            });

            return sections;
          })(),

        // ═══════════════════════════════════════════════════════════════════
        // SECCIONES DE SEGURIDAD CRÍTICA
        // ═══════════════════════════════════════════════════════════════════

        // CONFIGURACIÓN KERBEROS Y KRBTGT
        new Paragraph({
          text: "Configuración Kerberos",
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
              const age = rawData?.KerberosConfig?.KRBTGTPasswordAge || 0;
              const status = age > 180 ? "[CRITICO]" : age > 90 ? "ADVERTENCIA" : "OK";
              const color = age > 180 ? "critical" : age > 90 ? "medium" : "low";
              return createTableRow([
                "Edad de Contraseña KRBTGT",
                `${age} días`,
                status
              ], false, color);
            })(),
            createTableRow([
              "Última Rotación",
              rawData?.KerberosConfig?.KRBTGTPasswordLastSet ?
                new Date(parseInt(rawData.KerberosConfig.KRBTGTPasswordLastSet.match(/\d+/)?.[0] || 0)).toLocaleDateString('es-ES') :
                "Desconocido",
              ""
            ]),
          ],
        }),
        ...((rawData?.KerberosConfig?.KRBTGTPasswordAge || 0) > 180 ? [
          new Paragraph({
            children: [new TextRun({
              text: "[ACCION REQUERIDA]: La contraseña KRBTGT tiene más de 180 días. Se recomienda rotarla dos veces (con intervalo de 10+ horas entre rotaciones).",
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

        // POLÍTICAS DE CONTRASEÑA
        new Paragraph({
          text: "Políticas de Contraseña del Dominio",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Política", "Valor Actual", "Recomendado"], true),
            createTableRow([
              "Longitud Mínima",
              `${rawData?.PasswordPolicies?.MinPasswordLength || 0} caracteres`,
              "14+ caracteres"
            ], false, (rawData?.PasswordPolicies?.MinPasswordLength || 0) >= 14 ? "low" : "medium"),
            createTableRow([
              "Complejidad Requerida",
              rawData?.PasswordPolicies?.ComplexityEnabled ? "HABILITADA" : "DESHABILITADA",
              "Habilitada"
            ], false, rawData?.PasswordPolicies?.ComplexityEnabled ? "low" : "critical"),
            createTableRow([
              "Historial de Contraseñas",
              `${rawData?.PasswordPolicies?.PasswordHistoryCount || 0} contraseñas`,
              "24+ contraseñas"
            ]),
            createTableRow([
              "Edad Máxima",
              `${rawData?.PasswordPolicies?.MaxPasswordAge || "N/A"} días`,
              "60-90 días"
            ]),
            createTableRow([
              "Edad Mínima",
              `${rawData?.PasswordPolicies?.MinPasswordAge || 0} días`,
              "1+ día"
            ]),
            createTableRow([
              "Duración de Bloqueo",
              `${rawData?.PasswordPolicies?.LockoutDuration || 0} minutos`,
              "15+ minutos"
            ]),
            createTableRow([
              "Umbral de Bloqueo",
              `${rawData?.PasswordPolicies?.LockoutThreshold || 0} intentos`,
              "5-10 intentos"
            ]),
          ],
        }),
        // Fine-Grained Password Policies
        new Paragraph({
          text: "Políticas de Contraseña Detalladas (Fine-Grained)",
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 100 },
        }),
        new Paragraph({
          text: `Se encontraron ${rawData?.PasswordPolicies?.FineGrainedPolicies?.length || 0} política(s) fine-grained configurada(s).`,
          spacing: { after: 100 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Nombre", "Precedencia", "Longitud Mín.", "Aplicado a"], true),
            ...(rawData?.PasswordPolicies?.FineGrainedPolicies || []).slice(0, 5).map((fgpp: any) =>
              createTableRow([
                fgpp.Name || "N/A",
                fgpp.Precedence?.toString() || "N/A",
                `${fgpp.MinPasswordLength || 0} chars`,
                fgpp.AppliesTo?.length ? `${fgpp.AppliesTo.length} objeto(s)` : "N/A"
              ])
            ),
          ],
        }),

        // PERMISOS DCSYNC
        new Paragraph({
          text: "Permisos DCSync (Replicación de Directorio)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: "¿Qué es DCSync? ",
            bold: true,
            size: 22,
          }), new TextRun({
            text: "DCSync es una técnica de ataque donde un atacante con permisos de replicación puede extraer todos los hashes de contraseñas del dominio. Solo los Controladores de Dominio deberían tener estos permisos.",
            size: 22,
          })],
          spacing: { after: 150 },
          shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Referencia MITRE ATT&CK: ",
            bold: true,
            size: 20,
          }), new TextRun({
            text: "T1003.006 - Credential Dumping: DCSync. Esta técnica permite a atacantes con privilegios de replicación simular un Controlador de Dominio y solicitar hashes de contraseñas.",
            size: 20,
            italics: true,
          })],
          spacing: { after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Identidad", "Evaluación", "Riesgo"], true),
            ...(rawData?.DCSyncPermissions || []).filter((perm: any) => perm.IdentityReference || perm.Identity).map((perm: any) => {
              const identity = perm.IdentityReference || perm.Identity || "N/A";
              const isExpected = identity.includes("Domain Controllers") ||
                                 identity.includes("Enterprise Admins") ||
                                 identity.includes("Domain Admins") ||
                                 identity.includes("Administrators") ||
                                 identity.includes("ENTERPRISE DOMAIN CONTROLLERS") ||
                                 identity.includes("Controladores de dominio") ||
                                 identity.includes("Administradores");
              const color = isExpected ? "low" : "critical";
              const riskLevel = isExpected ? "Bajo - Cuenta de sistema esperada" : "ALTO - Revisar legitimidad";
              return createTableRow([
                identity,
                isExpected ? "ESPERADO" : "REVISAR",
                riskLevel
              ], false, color);
            }),
          ],
        }),
        new Paragraph({
          text: `Total: ${(rawData?.DCSyncPermissions || []).filter((p: any) => p.IdentityReference || p.Identity).length} identidades con permisos DCSync`,
          spacing: { before: 100, after: 100 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Acción recomendada: ",
            bold: true,
              size: 20,
            }), new TextRun({
              text: "Revise las identidades marcadas como 'REVISAR'. Si no son cuentas de servicio legítimas (como Azure AD Connect MSOL_*), considere remover estos permisos inmediatamente.",
              size: 20,
            })],
            spacing: { after: 200 },
          }),

        // GRUPO PROTECTED USERS
        new Paragraph({
          text: "Grupo Protected Users",
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
              (rawData?.ProtectedUsers?.MemberCount || 0).toString()
            ], false, (rawData?.ProtectedUsers?.MemberCount || 0) > 0 ? "low" : "critical"),
            createTableRow([
              "Estado",
              rawData?.ProtectedUsers?.Exists ? "EXISTE" : "NO ENCONTRADO"
            ]),
          ],
        }),
        ...((rawData?.ProtectedUsers?.MemberCount || 0) === 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "[RECOMENDACION]: El grupo Protected Users está vacío. Se recomienda agregar cuentas de administradores de Tier 0 (Domain Admins, Enterprise Admins) para protección adicional.",
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
          ...(rawData?.ProtectedUsers?.Members || []).slice(0, 10).map((member: any) =>
            new Paragraph({
              text: `• ${typeof member === 'string' ? member : member.Name || member.SamAccountName || 'N/A'}`,
              spacing: { after: 30 },
            })
          )
        ]),

        // ESTADO DE AD RECYCLE BIN
        new Paragraph({
          text: "Estado de AD Recycle Bin",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(["Característica", "Estado"], true),
            createTableRow([
              "AD Recycle Bin",
              rawData?.RecycleBinStatus?.Enabled ? "HABILITADO" : "DESHABILITADO"
            ], false, rawData?.RecycleBinStatus?.Enabled ? "low" : "critical"),
            ...(rawData?.RecycleBinStatus?.EnabledDate ? [
              createTableRow([
                "Fecha de Habilitación",
                rawData.RecycleBinStatus.EnabledDate
              ])
            ] : []),
          ],
        }),
        ...(!rawData?.RecycleBinStatus?.Enabled ? [
          new Paragraph({
            children: [new TextRun({
              text: "[CRITICO]: AD Recycle Bin está deshabilitado. Sin esta característica, los objetos eliminados no pueden recuperarse fácilmente. Habilitar requiere Forest Functional Level 2008 R2+.",
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

        // ESTADO SMBv1
        new Paragraph({
          text: "Estado de Protocolo SMBv1",
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
            ...(rawData?.SMBv1Status?.DomainControllers && rawData.SMBv1Status.DomainControllers.length > 0 ?
              rawData.SMBv1Status.DomainControllers.map((dc: any) =>
                createTableRow([
                  dc.Name || dc.HostName || "N/A",
                  dc.SMBv1Enabled ? "[ALERTA] HABILITADO" : "DESHABILITADO"
                ], false, dc.SMBv1Enabled ? "critical" : "low")
              ) : [
                createTableRow([
                  "Estado General",
                  rawData?.SMBv1Status?.IsEnabled ? "[ALERTA] HABILITADO" : "Sin datos"
                ], false, rawData?.SMBv1Status?.IsEnabled ? "critical" : "medium")
              ]
            ),
          ],
        }),

        // ESTADO DE LAPS
        new Paragraph({
          text: "Estado de LAPS (Local Administrator Password Solution)",
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
              rawData?.LAPS?.Deployed ? "SI" : "NO"
            ], false, rawData?.LAPS?.Deployed ? "low" : "critical"),
            ...(rawData?.LAPS?.SchemaExtended !== undefined ? [
              createTableRow([
                "Schema Extendido",
                rawData.LAPS.SchemaExtended ? "SI" : "NO"
              ])
            ] : []),
            ...(rawData?.LAPS?.ComputersWithLAPS !== undefined ? [
              createTableRow([
                "Equipos con LAPS",
                rawData.LAPS.ComputersWithLAPS.toString()
              ])
            ] : []),
            ...(rawData?.LAPS?.ComputersWithoutLAPS !== undefined ? [
              createTableRow([
                "Equipos sin LAPS",
                rawData.LAPS.ComputersWithoutLAPS.toString()
              ], false, rawData.LAPS.ComputersWithoutLAPS > 0 ? "medium" : "low")
            ] : []),
            ...(rawData?.LAPS?.CoveragePercentage !== undefined ? [
              createTableRow([
                "Cobertura",
                `${rawData.LAPS.CoveragePercentage}%`
              ], false, rawData.LAPS.CoveragePercentage >= 90 ? "low" : rawData.LAPS.CoveragePercentage >= 50 ? "medium" : "critical")
            ] : []),
          ],
        }),
        ...(!rawData?.LAPS?.Deployed ? [
          new Paragraph({
            children: [new TextRun({
              text: "[CRITICO]: LAPS no está desplegado. Las contraseñas de administrador local pueden ser compartidas o estáticas, facilitando movimiento lateral.",
              color: COLORS.critical,
              bold: true
            })],
            spacing: { before: 200, after: 200 },
          }),
        ] : []),

        // USUARIOS CON CONTRASEÑAS ANTIGUAS
        new Paragraph({
          text: "Usuarios con Contraseñas Antiguas (>365 días)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `Se encontraron ${(rawData?.OldPasswords || []).length} usuarios con contraseñas sin cambiar en más de 1 año.`,
            color: (rawData?.OldPasswords || []).length > 100 ? COLORS.critical : (rawData?.OldPasswords || []).length > 0 ? COLORS.high : COLORS.low
          })],
          spacing: { after: 200 },
        }),
        ...((rawData?.OldPasswords || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "Última Cambio", "Días"], true),
              ...(rawData?.OldPasswords || []).slice(0, 15).map((user: any) => {
                const days = user.PasswordAgeDays || user.DaysSinceChange || "N/A";
                return createTableRow([
                  sanitizeValue(user.SamAccountName || user.Name),
                  parseDate(user.PasswordLastSet),
                  sanitizeValue(days)
                ], false, "medium");
              }),
            ],
          }),
          ...((rawData?.OldPasswords || []).length > 15 ? [
            new Paragraph({
              text: `... y ${(rawData?.OldPasswords || []).length - 15} usuarios más.`,
              spacing: { before: 100, after: 200 },
            }),
          ] : []),
        ] : []),

        // ═══════════════════════════════════════════════════════════════════
        // SECCIONES ADICIONALES DE SEGURIDAD (basadas en Coverage Matrix)
        // ═══════════════════════════════════════════════════════════════════

        // DELEGACIONES (Unconstrained/Constrained) - Critical según Coverage Matrix
        new Paragraph({
          text: "Análisis de Delegación Kerberos",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: "La delegación Kerberos permite a servicios actuar en nombre de usuarios. La delegación sin restricciones (Unconstrained) es un riesgo crítico de seguridad.",
          spacing: { after: 200 },
        }),
        // Unconstrained Delegation
        ...(rawData?.DelegationIssues?.UnconstrainedDelegation?.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: `[CRITICO] Delegación Sin Restricciones: ${rawData.DelegationIssues.UnconstrainedDelegation.length} objeto(s)`,
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
        ] : [
          new Paragraph({
            text: "No se encontraron objetos con delegación sin restricciones.",
            spacing: { after: 100 },
          }),
        ]),
        // Constrained Delegation
        ...(rawData?.DelegationIssues?.ConstrainedDelegation?.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: `[ALTO] Delegación Restringida: ${rawData.DelegationIssues.ConstrainedDelegation.length} objeto(s)`,
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

        // GRUPOS PRIVILEGIADOS - Critical según Coverage Matrix
        new Paragraph({
          text: "Análisis de Grupos Privilegiados (Tier 0)",
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
            ...(rawData?.PrivilegedGroups || []).map((group: any) => {
              const memberCount = group.MemberCount || group.Members?.length || 0;
              const status = memberCount > 10 ? "[CRITICO] Excesivo" : memberCount > 5 ? "[ALTO]" : "OK";
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
        ...(rawData?.PrivilegedGroups || []).filter((g: any) => g.Members && g.Members.length > 0).slice(0, 3).flatMap((group: any) => [
          new Paragraph({
            text: `Miembros de ${sanitizeValue(group.Name)}:`,
            spacing: { before: 200, after: 100 },
          }),
          ...group.Members.slice(0, 5).map((member: any) =>
            new Paragraph({
              text: `  - ${sanitizeValue(member.Name || member.SamAccountName || member)}`,
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

        // CUENTAS DE SERVICIO EN GRUPOS ADMIN - Critical según Coverage Matrix
        new Paragraph({
          text: "Cuentas de Servicio en Grupos Administrativos",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Las cuentas de servicio NO deberían ser miembros de grupos administrativos. Esto viola el principio de mínimo privilegio.",
            color: (rawData?.ServiceAccountsInAdminGroups || []).length > 0 ? COLORS.critical : COLORS.low
          })],
          spacing: { after: 200 },
        }),
        ...((rawData?.ServiceAccountsInAdminGroups || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Cuenta de Servicio", "Grupo Admin", "Tipo"], true),
              ...(rawData?.ServiceAccountsInAdminGroups || []).slice(0, 15).map((svc: any) =>
                createTableRow([
                  sanitizeValue(svc.ServiceAccount || svc.Name),
                  sanitizeValue(svc.AdminGroup || svc.Group),
                  sanitizeValue(svc.AccountType || "Service")
                ], false, "critical")
              ),
            ],
          }),
        ] : [
          new Paragraph({
            text: "No se encontraron cuentas de servicio en grupos administrativos.",
            spacing: { after: 100 },
          }),
        ]),

        // ADMINSDSHOLDER ORPHANS - High según Coverage Matrix
        new Paragraph({
          text: "Objetos Huérfanos de AdminSDHolder",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: "Objetos con AdminCount=1 que ya NO son miembros de grupos protegidos. Sus ACLs no se restauran automáticamente.",
          spacing: { after: 200 },
        }),
        ...((rawData?.AdminSDHolderOrphans || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Nombre", "Tipo", "Último Grupo Protegido"], true),
              ...(rawData?.AdminSDHolderOrphans || []).slice(0, 15).map((orphan: any) =>
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
        ] : [
          new Paragraph({
            text: "No se encontraron objetos huérfanos de AdminSDHolder.",
            spacing: { after: 100 },
          }),
        ]),

        // USUARIOS KERBEROASTABLE
        new Paragraph({
          text: "Usuarios Kerberoastable (SPN configurado)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `Se encontraron ${(rawData?.KerberoastableUsers || []).length} cuentas de usuario con SPNs configurados.`,
            color: (rawData?.KerberoastableUsers || []).length > 20 ? COLORS.critical : (rawData?.KerberoastableUsers || []).length > 0 ? COLORS.high : COLORS.low
          })],
          spacing: { after: 200 },
        }),
        ...((rawData?.KerberoastableUsers || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "SPN", "Antigüedad Contraseña"], true),
              ...(rawData?.KerberoastableUsers || []).slice(0, 15).map((user: any) => {
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
        new Paragraph({
          text: "Usuarios AS-REP Roastable (PreAuth Disabled)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [new TextRun({
            text: `Se encontraron ${(rawData?.ASREPRoastableUsers || []).length} cuentas con pre-autenticación Kerberos deshabilitada.`,
            color: (rawData?.ASREPRoastableUsers || []).length > 0 ? COLORS.critical : COLORS.low
          })],
          spacing: { after: 200 },
        }),
        ...((rawData?.ASREPRoastableUsers || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "Estado", "Última Autenticación"], true),
              ...(rawData?.ASREPRoastableUsers || []).slice(0, 15).map((user: any) =>
                createTableRow([
                  sanitizeValue(user.SamAccountName || user.Name),
                  "[CRITICO] PreAuth Disabled",
                  user.LastLogon ? new Date(user.LastLogon).toLocaleDateString('es-ES') : "N/A"
                ], false, "critical")
              ),
            ],
          }),
          new Paragraph({
            text: "Recomendación: Habilitar pre-autenticación Kerberos: Set-ADAccountControl -Identity <user> -DoesNotRequirePreAuth $false",
            spacing: { before: 100, after: 200 },
          }),
        ] : [
          new Paragraph({
            text: "No se encontraron usuarios con pre-autenticación deshabilitada.",
            spacing: { after: 100 },
          }),
        ]),

        // TOKEN BLOAT RISK - Critical según Coverage Matrix
        new Paragraph({
          text: "Riesgo de Token Bloat (>40 grupos)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: "Usuarios con membresía en más de 40 grupos pueden experimentar problemas de autenticación debido al tamaño del token Kerberos.",
          spacing: { after: 200 },
        }),
        ...((rawData?.TokenBloatRisk || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Usuario", "# Grupos", "Tamaño Estimado", "Estado"], true),
              ...(rawData?.TokenBloatRisk || []).slice(0, 15).map((user: any) => {
                const groupCount = user.GroupCount || user.TotalGroups || 0;
                const tokenSize = user.EstimatedTokenSize || (groupCount * 40 + 1200);
                const status = tokenSize > 12000 ? "CRITICO" : tokenSize > 8000 ? "[ALTO]" : "OK";
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
        ] : [
          new Paragraph({
            text: "No se encontraron usuarios con riesgo de token bloat.",
            spacing: { after: 100 },
          }),
        ]),

        // NESTED GROUPS DEPTH - High según Coverage Matrix
        new Paragraph({
          text: "Análisis de Anidamiento de Grupos (Depth >3)",
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: "El anidamiento excesivo de grupos dificulta la auditoría de permisos y puede causar problemas de rendimiento.",
          spacing: { after: 200 },
        }),
        ...((rawData?.NestedGroupsAnalysis?.DeepNesting || []).length > 0 ? [
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              createTableRow(["Grupo", "Profundidad", "Ruta de Anidamiento"], true),
              ...(rawData?.NestedGroupsAnalysis?.DeepNesting || []).slice(0, 10).map((group: any) =>
                createTableRow([
                  sanitizeValue(group.Name || group.GroupName),
                  (group.NestingDepth || group.Depth || 0).toString(),
                  sanitizeValue(group.NestingPath || "N/A").substring(0, 50)
                ], false, (group.NestingDepth || group.Depth || 0) > 5 ? "critical" : "high")
              ),
            ],
          }),
        ] : [
          new Paragraph({
            text: "No se encontraron grupos con anidamiento excesivo.",
            spacing: { after: 100 },
          }),
        ]),

        // RESUMEN EJECUTIVO
        new Paragraph({
          children: [new TextRun({
            text: "Resumen Ejecutivo",
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
                  shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
                  margins: { top: 300, bottom: 300, left: 300, right: 300 },
                }),
              ],
            }),
          ],
        }),

        // Explicación del cálculo del Score
        new Paragraph({
          children: [new TextRun({
            text: "¿Cómo se calcula esta puntuación? ",
            bold: true,
            size: 20,
          }), new TextRun({
            text: "La puntuación inicia en 100 puntos y se deducen puntos según la severidad de los hallazgos: ",
            size: 20,
          }), new TextRun({
            text: "Crítico (-20 pts), ",
            size: 20,
            color: COLORS.critical,
            bold: true,
          }), new TextRun({
            text: "Alto (-10 pts), ",
            size: 20,
            color: COLORS.high,
            bold: true,
          }), new TextRun({
            text: "Medio (-5 pts), ",
            size: 20,
            color: COLORS.medium,
            bold: true,
          }), new TextRun({
            text: "Bajo (-1 pt). ",
            size: 20,
            color: COLORS.low,
            bold: true,
          }), new TextRun({
            text: `En este caso: ${severityCounts.critical} críticos × 20 = -${severityCounts.critical * 20}, ${severityCounts.high} altos × 10 = -${severityCounts.high * 10}, ${severityCounts.medium} medios × 5 = -${severityCounts.medium * 5}, ${severityCounts.low} bajos × 1 = -${severityCounts.low}. Total: 100 - ${severityCounts.critical * 20 + severityCounts.high * 10 + severityCounts.medium * 5 + severityCounts.low} = ${healthScore}.`,
            size: 20,
          })],
          spacing: { before: 200, after: 100 },
          shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
        }),
        new Paragraph({
          children: [new TextRun({
            text: "Interpretación: ",
            bold: true,
            size: 20,
          }), new TextRun({
            text: "90-100 = Excelente (ambiente seguro), 75-89 = Bueno (mejoras menores), 50-74 = Requiere Revisión (priorizar remediación), 0-49 = Requiere Atención (acción urgente necesaria).",
            size: 20,
          })],
          spacing: { after: 300 },
        }),

        new Paragraph({ text: "", spacing: { after: 200 } }),

        // Test Summary Table with modern design
        new Paragraph({
          children: [new TextRun({
            text: "2. Resultados de la Evaluación",
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
            createTableRow(["Configuraciones Críticas", severityCounts.critical.toString()], false, 'critical'),
            createTableRow(["Desviaciones de Alta Prioridad", severityCounts.high.toString()], false, 'high'),
            createTableRow(["Desviaciones de Media Prioridad", severityCounts.medium.toString()], false, 'medium'),
            createTableRow(["Sugerencias de Optimización", severityCounts.low.toString()], false, 'low'),
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
              text: "CONFIGURACIONES CRÍTICAS",
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
                  ...(finding.mitre_attack ? [createTableRow(["MITRE ATT&CK", finding.mitre_attack])] : []),
                  ...(finding.cis_control ? [createTableRow(["CIS Control", finding.cis_control])] : []),
                  ...(finding.timeline ? [createTableRow(["Timeline de Remediación", finding.timeline])] : []),
                  ...(finding.affected_count ? [createTableRow(["Objetos Afectados", finding.affected_count.toString()])] : []),
                ],
              }),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ] : []),

            createDetailTable("Descripción", finding.description, COLORS.critical),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            // Tabla de evidencia (objetos afectados)
            ...createEvidenceTable(finding.evidence, COLORS.critical),

            ...(finding.impact_business ? [
              createDetailTable("Impacto en el Negocio", finding.impact_business, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.current_vs_recommended ? [
              createDetailTable("Configuración Actual vs Recomendada", finding.current_vs_recommended, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            createDetailTable("Recomendación", finding.recommendation, COLORS.critical),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.remediation_commands ? [
              createDetailTable("Comandos de Remediación (PowerShell)", finding.remediation_commands, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.prerequisites ? [
              createDetailTable("Prerrequisitos", finding.prerequisites, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.operational_impact ? [
              createDetailTable("Impacto Operacional", finding.operational_impact, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.microsoft_docs ? [
              createDetailTable("Documentación Técnica Microsoft", finding.microsoft_docs, COLORS.critical),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            new Paragraph({ text: "", spacing: { after: 300 } }),
          ]),
        ] : []),

        // SERIOUS ISSUES (HIGH)
        ...(highFindings.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "DESVIACIONES IMPORTANTES",
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
                  ...(finding.mitre_attack ? [createTableRow(["MITRE ATT&CK", finding.mitre_attack])] : []),
                  ...(finding.cis_control ? [createTableRow(["CIS Control", finding.cis_control])] : []),
                  ...(finding.timeline ? [createTableRow(["Timeline", finding.timeline])] : []),
                  ...(finding.affected_count ? [createTableRow(["Objetos Afectados", finding.affected_count.toString()])] : []),
                ],
              }),
              new Paragraph({ text: "", spacing: { after: 200 } }),
            ] : []),

            createDetailTable("Descripción", finding.description, COLORS.high),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            // Tabla de evidencia (objetos afectados)
            ...createEvidenceTable(finding.evidence, COLORS.high),

            ...(finding.impact_business ? [
              createDetailTable("Impacto en el Negocio", finding.impact_business, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.current_vs_recommended ? [
              createDetailTable("Actual vs Recomendado", finding.current_vs_recommended, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            createDetailTable("Recomendación", finding.recommendation, COLORS.high),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.remediation_commands ? [
              createDetailTable("Comandos PowerShell", finding.remediation_commands, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.prerequisites ? [
              createDetailTable("Prerrequisitos", finding.prerequisites, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.operational_impact ? [
              createDetailTable("Impacto Operacional", finding.operational_impact, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.microsoft_docs ? [
              createDetailTable("Docs Microsoft", finding.microsoft_docs, COLORS.high),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            new Paragraph({ text: "", spacing: { after: 300 } }),
          ]),
        ] : []),

        // MODERATE ISSUES (MEDIUM)
        ...(mediumFindings.length > 0 ? [
          new Paragraph({
            children: [new TextRun({
              text: "PROBLEMAS DE SEVERIDAD MEDIA",
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
                  ...(finding.mitre_attack ? [createTableRow(["MITRE ATT&CK", finding.mitre_attack])] : []),
                  ...(finding.cis_control ? [createTableRow(["CIS Control", finding.cis_control])] : []),
                  ...(finding.timeline ? [createTableRow(["Timeline", finding.timeline])] : []),
                  ...(finding.affected_count ? [createTableRow(["Afectados", finding.affected_count.toString()])] : []),
                ],
              }),
              new Paragraph({ text: "", spacing: { after: 150 } }),
            ] : []),

            createDetailTable("Descripción", finding.description, COLORS.medium),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            // Tabla de evidencia (objetos afectados)
            ...createEvidenceTable(finding.evidence, COLORS.medium),

            ...(finding.current_vs_recommended ? [
              createDetailTable("Actual vs Recomendado", finding.current_vs_recommended, COLORS.medium),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            createDetailTable("Recomendación", finding.recommendation, COLORS.medium),
            new Paragraph({ text: "", spacing: { after: 100 } }),

            ...(finding.remediation_commands ? [
              createDetailTable("Comandos PowerShell", finding.remediation_commands, COLORS.medium),
              new Paragraph({ text: "", spacing: { after: 100 } }),
            ] : []),

            ...(finding.microsoft_docs ? [
              createDetailTable("Documentación", finding.microsoft_docs, COLORS.medium),
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
