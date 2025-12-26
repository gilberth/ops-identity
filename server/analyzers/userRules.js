// server/analyzers/userRules.js

/**
 * Deterministic Rules Engine for Active Directory Users v1.7.0
 * This module replaces AI guessing with mathematical certainty for user risks.
 *
 * Changes in v1.7.0:
 * - Added PASSWORD_NOT_REQUIRED and PRIVILEGED_NO_PROTECTION rules
 * - Fixed LastLogonDate parsing with multiple format support
 * - Added all required fields for database compatibility
 * - Specific MITRE ATT&CK and CIS Control mappings per rule
 */

/**
 * Flexible date parser for multiple formats
 * Supports: /Date(\d+)/, ISO 8601, Unix timestamp
 */
function parseFlexibleDate(dateValue) {
    if (!dateValue) return null;

    try {
        // Format 1: /Date(1234567890000)/
        if (typeof dateValue === 'string' && dateValue.includes('/Date(')) {
            const match = dateValue.match(/\/Date\((-?\d+)\)\//);
            if (match) return new Date(parseInt(match[1]));
        }

        // Format 2: ISO 8601 string (e.g., "2024-12-20T10:30:00Z")
        if (typeof dateValue === 'string' && (dateValue.includes('-') || dateValue.includes('T'))) {
            const parsed = new Date(dateValue);
            if (!isNaN(parsed.getTime())) return parsed;
        }

        // Format 3: Unix timestamp (number or numeric string)
        const timestamp = typeof dateValue === 'number' ? dateValue : parseInt(dateValue);
        if (!isNaN(timestamp) && timestamp > 0) {
            // Handle both seconds and milliseconds (timestamps before year 2001 in ms, after in s)
            const date = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
            if (!isNaN(date.getTime())) return date;
        }

        return null;
    } catch (e) {
        console.warn(`[parseFlexibleDate] Failed to parse: ${dateValue}`, e.message);
        return null;
    }
}

const userRules = {
    // 1. Password Never Expires
    PASSWORD_NEVER_EXPIRES: {
        id: 'PASSWORD_NEVER_EXPIRES',
        severity: 'high',
        title: (count) => `${count} usuarios con contraseñas que nunca expiran detectados`,
        description: `Se han identificado cuentas de usuario configuradas para que sus contraseñas nunca caduquen. Esta configuración anula las políticas de rotación de contraseñas de la organización, aumentando significativamente el riesgo de que una credencial comprometida pueda ser utilizada indefinidamente por un atacante.`,
        check: (user) => {
            return user.Enabled === true && user.PasswordNeverExpires === true;
        },
        remediation: (users) => {
            const names = users.slice(0, 5).map(u => u.SamAccountName || 'Unknown').join(', ');
            return `Ejecutar en PowerShell:\nGet-ADUser -Filter "PasswordNeverExpires -eq $true -and Enabled -eq $true" | Set-ADUser -PasswordNeverExpires $false\n\nUsuarios afectados (ejemplo): ${names}${users.length > 5 ? ` y ${users.length - 5} más...` : ''}`;
        },
        // v1.7.0: Specific mappings
        mitre_attack: 'T1078.002 - Valid Accounts: Domain Accounts',
        cis_control: '5.2 - Use Unique Passwords',
        impact_business: 'Las credenciales comprometidas pueden ser utilizadas indefinidamente, permitiendo acceso persistente no autorizado a sistemas críticos.',
        prerequisites: 'Acceso a Active Directory Users and Computers o PowerShell con módulo AD.',
        operational_impact: 'BAJO - Usuarios deberán cambiar contraseña en próximo inicio de sesión.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/password-must-meet-complexity-requirements',
        current_vs_recommended: 'Actual: PasswordNeverExpires=True | Recomendado: PasswordNeverExpires=False con política de rotación cada 90 días.',
        timeline: '1-2 días para implementar, comunicar a usuarios afectados antes del cambio.'
    },

    // 2. Inactive Accounts (Enabled but stale)
    INACTIVE_ACCOUNTS: {
        id: 'INACTIVE_ACCOUNTS',
        severity: 'medium',
        title: (count) => `${count} cuentas inactivas habilitadas detectadas`,
        description: `Se detectaron cuentas de usuario que están habilitadas pero no han iniciado sesión en los últimos 90 días. Las cuentas inactivas son objetivos frecuentes para los atacantes ya que su actividad maliciosa a menudo pasa desapercibida.`,
        check: (user) => {
            if (!user.Enabled) return false;
            if (!user.LastLogonDate) return true; // Never logged in = inactive

            const lastLogon = parseFlexibleDate(user.LastLogonDate);
            if (!lastLogon) return false; // Cannot parse, skip

            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            return lastLogon < ninetyDaysAgo;
        },
        remediation: (users) => {
            return `Deshabilitar cuentas inactivas:\nSearch-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Where-Object {$_.Enabled -eq $true} | Disable-ADAccount\n\nRevisar antes de deshabilitar cuentas de servicio o sistemas automatizados.`;
        },
        mitre_attack: 'T1078.002 - Valid Accounts: Domain Accounts, T1087.002 - Account Discovery: Domain Account',
        cis_control: '5.3 - Disable Dormant Accounts',
        impact_business: 'Cuentas inactivas pueden ser comprometidas sin detección, usadas para movimiento lateral y persistencia.',
        prerequisites: 'Módulo ActiveDirectory de PowerShell, permisos para deshabilitar cuentas.',
        operational_impact: 'MEDIO - Verificar que no sean cuentas de servicio antes de deshabilitar.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows-server/identity/ad-ds/plan/security-best-practices/best-practices-for-securing-active-directory',
        current_vs_recommended: 'Actual: Cuentas habilitadas sin login >90 días | Recomendado: Deshabilitar o eliminar cuentas inactivas.',
        timeline: '3-5 días para revisión y deshabilitación coordinada con propietarios.'
    },

    // 3. Admin Count (Potentially Privileged but Orphaned)
    ADMIN_COUNT_EXPOSURE: {
        id: 'ADMIN_COUNT_EXPOSURE',
        severity: 'high',
        title: (count) => `${count} usuarios marcados con AdminCount=1 (SDProp)`,
        description: `Estos usuarios tienen el atributo AdminCount=1, lo que indica que son o fueron miembros de grupos protegidos (como Domain Admins). Active Directory protege estas cuentas automáticamente (SDProp), lo que puede romper la herencia de permisos y dificultar su gestión. A menudo, este atributo queda activo ("stuck") incluso después de que el usuario pierde sus privilegios.`,
        check: (user) => {
            return user.Enabled === true && user.AdminCount === 1;
        },
        remediation: (users) => {
            const names = users.slice(0, 3).map(u => u.SamAccountName || 'Unknown').join(', ');
            return `1. Verificar membresía actual en grupos privilegiados:\nGet-ADUser "${names.split(',')[0]}" -Properties MemberOf | Select -ExpandProperty MemberOf\n\n2. Si ya no es admin, limpiar atributo:\nSet-ADUser -Identity <User> -Clear "adminCount"\n\n3. Restablecer herencia de permisos en ADUC.`;
        },
        mitre_attack: 'T1078.002 - Valid Accounts: Domain Accounts',
        cis_control: '5.4 - Restrict Administrator Privileges',
        impact_business: 'Cuentas con AdminCount=1 huérfano tienen permisos inconsistentes y pueden retener acceso elevado no documentado.',
        prerequisites: 'ADUC o PowerShell, conocimiento de grupos protegidos del dominio.',
        operational_impact: 'BAJO - Limpieza de atributo no afecta operación si el usuario ya no es admin.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows-server/identity/ad-ds/plan/security-best-practices/appendix-c--protected-accounts-and-groups-in-active-directory',
        current_vs_recommended: 'Actual: AdminCount=1 sin membresía en grupos protegidos | Recomendado: Limpiar AdminCount y restablecer herencia.',
        timeline: '1 día para auditoría, 2-3 días para limpieza coordinada.'
    },

    // 4. Kerberoastable Users (Has SPN)
    KERBEROASTING_RISK: {
        id: 'KERBEROASTING_RISK',
        severity: 'critical',
        title: (count) => `${count} usuarios vulnerables a ataques de Kerberoasting`,
        description: `Se detectaron usuarios configurados con Service Principal Names (SPN). Estas cuentas son vulnerables a Kerberoasting, una técnica donde un atacante solicita un ticket de servicio (TGS) y lo crackea offline para obtener la contraseña en texto claro. Es una de las técnicas más utilizadas para escalación de privilegios en Active Directory.`,
        check: (user) => {
            if (user.Enabled !== true) return false;
            if (!user.ServicePrincipalNames) return false;

            // Handle both array and string formats
            const spns = Array.isArray(user.ServicePrincipalNames)
                ? user.ServicePrincipalNames
                : [user.ServicePrincipalNames];

            // Exclude krbtgt and its variants
            const samName = (user.SamAccountName || '').toLowerCase();
            if (samName === 'krbtgt' || samName.startsWith('krbtgt_')) return false;

            return spns.length > 0 && spns.some(spn => spn && spn.length > 0);
        },
        remediation: (users) => {
            const names = users.slice(0, 3).map(u => u.SamAccountName || 'Unknown').join(', ');
            return `PRIORIDAD CRÍTICA:\n1. Usar contraseñas largas (>25 caracteres) para estas cuentas.\n2. Migrar a gMSA (Group Managed Service Accounts) si es posible:\n   New-ADServiceAccount -Name "gMSA_ServiceName" -DNSHostName "server.domain.com"\n3. Auditar eventos 4769 (Kerberos Ticket Request) para detectar intentos de Kerberoasting.\n4. Considerar AES-only para estas cuentas.\n\nCuentas afectadas: ${names}`;
        },
        mitre_attack: 'T1558.003 - Steal or Forge Kerberos Tickets: Kerberoasting',
        cis_control: '5.4 - Restrict Administrator Privileges, 16.4 - Encrypt Sensitive Information',
        impact_business: 'CRÍTICO - Compromiso de cuenta de servicio puede dar acceso a sistemas críticos y datos sensibles.',
        prerequisites: 'Acceso a AD, capacidad de crear gMSA, coordinación con equipos de aplicaciones.',
        operational_impact: 'ALTO - Migración a gMSA requiere cambios en aplicaciones y servicios.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview',
        current_vs_recommended: 'Actual: Cuentas de usuario con SPN | Recomendado: gMSA o contraseñas >25 chars con rotación.',
        timeline: '1-2 semanas para migración a gMSA, inmediato para cambio de contraseñas.'
    },

    // 5. AS-REP Roasting (No Pre Auth)
    ASREP_ROASTING: {
        id: 'ASREP_ROASTING',
        severity: 'critical',
        title: (count) => `${count} usuarios vulnerables a AS-REP Roasting`,
        description: `Usuarios configurados con 'Do not require Kerberos preauthentication'. Esto permite a cualquier atacante solicitar un TGT para el usuario sin conocer su contraseña y luego intentar crackear el hash offline. Es una vulnerabilidad crítica que permite ataques completamente anónimos.`,
        check: (user) => {
            return user.Enabled === true &&
                (user.DoNotRequirePreAuth === true || user.IsASREPRoastable === true);
        },
        remediation: (users) => {
            const names = users.slice(0, 5).map(u => u.SamAccountName || 'Unknown').join(', ');
            return `ACCIÓN INMEDIATA REQUERIDA:\nHabilitar pre-autenticación Kerberos:\nGet-ADUser -Filter "DoesNotRequirePreAuth -eq $true" | Set-ADAccountControl -DoesNotRequirePreAuth $false\n\nUsuarios afectados: ${names}`;
        },
        mitre_attack: 'T1558.004 - Steal or Forge Kerberos Tickets: AS-REP Roasting',
        cis_control: '5.4 - Restrict Administrator Privileges, 16.4 - Encrypt Sensitive Information',
        impact_business: 'CRÍTICO - Cualquier usuario de la red puede obtener el hash de estas cuentas sin autenticación.',
        prerequisites: 'Módulo ActiveDirectory de PowerShell.',
        operational_impact: 'BAJO - Habilitar preauth es transparente para el usuario.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows/security/threat-protection/security-policy-settings/network-security-do-not-store-lan-manager-hash-value-on-next-password-change',
        current_vs_recommended: 'Actual: DoNotRequirePreAuth=True | Recomendado: DoNotRequirePreAuth=False',
        timeline: 'Inmediato - Cambio sin impacto operacional.'
    },

    // 6. Trusted for Unconstrained Delegation
    UNCONSTRAINED_DELEGATION: {
        id: 'UNCONSTRAINED_DELEGATION',
        severity: 'critical',
        title: (count) => `${count} usuarios con Delegación Sin Restricciones`,
        description: `Riesgo EXTREMO. Estas cuentas pueden suplantar a cualquier usuario del dominio que se conecte a ellas. Un atacante que comprometa esta cuenta puede obtener tickets TGT de administradores y controlar completamente el dominio (Golden Ticket path).`,
        check: (user) => {
            return user.Enabled === true && user.TrustedForDelegation === true;
        },
        remediation: (users) => {
            const names = users.slice(0, 3).map(u => u.SamAccountName || 'Unknown').join(', ');
            return `RIESGO EXTREMO - ACCIÓN PRIORITARIA:\n1. Revisar si la delegación es realmente necesaria.\n2. Migrar a Constrained Delegation o Resource-Based Constrained Delegation.\n3. Agregar cuentas sensibles a "Protected Users" o marcar como "Account is sensitive and cannot be delegated".\n\nCuentas afectadas: ${names}`;
        },
        mitre_attack: 'T1558.001 - Steal or Forge Kerberos Tickets: Golden Ticket, T1550.003 - Use Alternate Authentication Material: Pass the Ticket',
        cis_control: '5.4 - Restrict Administrator Privileges, 6.5 - Require MFA for Administrative Access',
        impact_business: 'EXTREMO - Compromiso permite control total del dominio mediante impersonación de cualquier usuario.',
        prerequisites: 'Acceso a ADUC, conocimiento de arquitectura de delegación.',
        operational_impact: 'ALTO - Cambio a constrained delegation requiere reconfiguración de aplicaciones.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows-server/security/kerberos/kerberos-constrained-delegation-overview',
        current_vs_recommended: 'Actual: TrustedForDelegation=True | Recomendado: Constrained Delegation o RBCD',
        timeline: '1-2 semanas para análisis de impacto y migración.'
    },

    // 7. NEW v1.7.0: Password Not Required
    PASSWORD_NOT_REQUIRED: {
        id: 'PASSWORD_NOT_REQUIRED',
        severity: 'critical',
        title: (count) => `${count} usuarios con contraseña no requerida (PASSWD_NOTREQD)`,
        description: `Cuentas configuradas con el flag PASSWD_NOTREQD, lo que permite que tengan contraseñas vacías o nulas. Esto es una vulnerabilidad crítica que permite acceso sin autenticación a sistemas y recursos del dominio.`,
        check: (user) => {
            return user.Enabled === true && user.PasswordNotRequired === true;
        },
        remediation: (users) => {
            const names = users.slice(0, 5).map(u => u.SamAccountName || 'Unknown').join(', ');
            return `ACCIÓN INMEDIATA REQUERIDA:\n1. Establecer contraseña y eliminar flag:\nSet-ADAccountPassword -Identity <User> -NewPassword (ConvertTo-SecureString "TempP@ss123!" -AsPlainText -Force) -Reset\nSet-ADUser -Identity <User> -PasswordNotRequired $false\n\n2. Forzar cambio de contraseña en próximo login:\nSet-ADUser -Identity <User> -ChangePasswordAtLogon $true\n\nUsuarios afectados: ${names}`;
        },
        mitre_attack: 'T1078.002 - Valid Accounts: Domain Accounts, T1110 - Brute Force',
        cis_control: '5.2 - Use Unique Passwords, 5.1 - Establish Secure Password Policy',
        impact_business: 'CRÍTICO - Acceso sin contraseña permite compromiso inmediato de la cuenta.',
        prerequisites: 'Módulo ActiveDirectory de PowerShell, permisos para resetear contraseñas.',
        operational_impact: 'MEDIO - Usuario deberá establecer nueva contraseña.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows/win32/adschema/a-useraccountcontrol',
        current_vs_recommended: 'Actual: PASSWD_NOTREQD=True | Recomendado: Contraseña obligatoria con complejidad.',
        timeline: 'Inmediato - Requiere acción en las próximas 24 horas.'
    },

    // 8. NEW v1.7.0: Privileged Users Without Protected Users Group
    PRIVILEGED_NO_PROTECTION: {
        id: 'PRIVILEGED_NO_PROTECTION',
        severity: 'high',
        title: (count) => `${count} usuarios privilegiados sin protección adicional`,
        description: `Usuarios con privilegios administrativos que no están en el grupo "Protected Users" ni tienen el flag "Account is sensitive and cannot be delegated". Estas cuentas son vulnerables a ataques de credential theft, pass-the-hash y delegation abuse.`,
        check: (user) => {
            // Check if privileged but not protected
            return user.Enabled === true &&
                user.IsPrivileged === true &&
                user.AccountNotDelegated !== true; // Not protected from delegation
        },
        remediation: (users) => {
            const names = users.slice(0, 5).map(u => u.SamAccountName || 'Unknown').join(', ');
            return `RECOMENDACIÓN DE SEGURIDAD:\n1. Agregar a grupo "Protected Users" (Windows Server 2012 R2+):\nAdd-ADGroupMember -Identity "Protected Users" -Members "${names.split(',')[0]}"\n\n2. O marcar cuenta como sensible:\nSet-ADUser -Identity <User> -AccountNotDelegated $true\n\n3. Implementar Credential Guard en estaciones de trabajo admin.\n\nUsuarios afectados: ${names}`;
        },
        mitre_attack: 'T1550.002 - Use Alternate Authentication Material: Pass the Hash, T1558 - Steal or Forge Kerberos Tickets',
        cis_control: '5.4 - Restrict Administrator Privileges, 6.5 - Require MFA for Administrative Access',
        impact_business: 'ALTO - Cuentas admin sin protección son objetivo principal de atacantes para movimiento lateral.',
        prerequisites: 'Windows Server 2012 R2+ para Protected Users, Credential Guard requiere hardware compatible.',
        operational_impact: 'MEDIO - Protected Users deshabilita NTLM y limita ticket lifetime.',
        microsoft_docs: 'https://docs.microsoft.com/en-us/windows-server/security/credentials-protection-and-management/protected-users-security-group',
        current_vs_recommended: 'Actual: Cuenta privilegiada sin protección | Recomendado: Agregar a Protected Users + AccountNotDelegated.',
        timeline: '1 semana para evaluación de impacto, 2 semanas para implementación gradual.'
    }
};

/**
 * Main Analyzer Function
 * @param {Array} users - Raw User JSON objects
 * @returns {Array} - List of verified findings with all required fields
 */
function analyzeUsersDeterministic(users) {
    const findings = [];

    if (!users || !Array.isArray(users) || users.length === 0) {
        console.log('[userRules] No users to analyze');
        return findings;
    }

    console.log(`[userRules] Analyzing ${users.length} users with ${Object.keys(userRules).length} deterministic rules`);

    // Iterate over each rule definition
    Object.values(userRules).forEach(rule => {
        // Find all matching users for this rule
        const affectedUsers = users.filter(u => {
            if (!u) return false;
            try {
                return rule.check(u);
            } catch (e) {
                console.warn(`[userRules] Error checking rule ${rule.id} for user ${u.SamAccountName || 'Unknown'}:`, e.message);
                return false;
            }
        });

        if (affectedUsers.length > 0) {
            console.log(`[userRules] Rule ${rule.id}: Found ${affectedUsers.length} affected users`);

            // Construct the finding deterministically with ALL required fields
            findings.push({
                // Core fields
                type_id: rule.id,
                title: rule.title(affectedUsers.length),
                description: rule.description,
                severity: rule.severity,
                recommendation: "Ver detalles en la sección de remediación.",
                remediation_commands: rule.remediation(affectedUsers),
                affected_count: affectedUsers.length,

                // Evidence structure
                evidence: {
                    count: affectedUsers.length,
                    affected_objects: affectedUsers.map(u => u.SamAccountName || u.Name || 'Unknown'),
                    details: `Detectado determinísticamente por Active Scan Insight v1.7.0. Regla: ${rule.id}`
                },

                // v1.7.0: All required metadata fields
                impact_business: rule.impact_business,
                mitre_attack: rule.mitre_attack,
                cis_control: rule.cis_control,
                prerequisites: rule.prerequisites,
                operational_impact: rule.operational_impact,
                microsoft_docs: rule.microsoft_docs,
                current_vs_recommended: rule.current_vs_recommended,
                timeline: rule.timeline
            });
        }
    });

    console.log(`[userRules] Analysis complete: ${findings.length} findings generated`);
    return findings;
}

export { analyzeUsersDeterministic, parseFlexibleDate };
