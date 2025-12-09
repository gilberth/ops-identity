// server/analyzers/userRules.js

/**
 * Deterministic Rules Engine for Active Directory Users
 * This module replaces AI guessing with mathematical certainty for user risks.
 */

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
            const names = users.slice(0, 5).map(u => u.SamAccountName).join(', ');
            return `Ejecutar en PowerShell:\nGet-ADUser -Filter "PasswordNeverExpires -eq $true" | Set-ADUser -PasswordNeverExpires $false\n\nUsuarios afectados (ejemplo): ${names}`;
        }
    },

    // 2. Inactive Accounts (Enabled but stale)
    INACTIVE_ACCOUNTS: {
        id: 'INACTIVE_ACCOUNTS',
        severity: 'medium',
        title: (count) => `${count} cuentas inactivas habilitadas detectadas`,
        description: `Se detectaron cuentas de usuario que están habilitadas pero no han iniciado sesión en los últimos 90 días. Las cuentas inactivas son objetivos frecuentes para los atacantes ya que su actividad maliciosa a menudo pasa desapercibida.`,
        check: (user) => {
            if (!user.Enabled || !user.LastLogonDate) return false;

            const lastLogon = new Date(parseInt(user.LastLogonDate.replace(/\/Date\((\d+)\)\//, '$1')));
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            return lastLogon < ninetyDaysAgo;
        },
        remediation: (users) => {
            return `Deshabilitar cuentas inactivas:\nSearch-ADAccount -AccountInactive -TimeSpan 90.00:00:00 -UsersOnly | Where-Object {$_.Enabled -eq $true} | Disable-ADAccount`;
        }
    },

    // 3. Admin Count (Potentially Privileged but Orphaned)
    // Check specifically for AdminCount=1 but maybe not in obvious groups
    ADMIN_COUNT_EXPOSURE: {
        id: 'ADMIN_COUNT_EXPOSURE',
        severity: 'high',
        title: (count) => `${count} usuarios marcados con AdminCount=1 (SDProp)`,
        description: `Estos usuarios tienen el atributo AdminCount=1, lo que indica que son o fueron miembros de grupos protegidos (como Domain Admins). Active Directory protege estas cuentas automáticamente (SDProp), lo que puede romper la herencia de permisos y dificultar su gestión. A menudo, este atributo queda activo ("stuck") incluso después de que el usuario pierde sus privilegios.`,
        check: (user) => {
            return user.Enabled === true && user.AdminCount === 1;
        },
        remediation: (users) => `Revisar membresía de grupos para confirmar privilegios. Si ya no son admins, limpiar atributo:\nSet-ADUser -Identity <User> -Clear "adminCount"\nEnable-ADAccount -Identity <User> (para restablecer herencia)`
    },

    // 4. Kerberoastable Users (Has SPN)
    KERBEROASTING_RISK: {
        id: 'KERBEROASTING_RISK',
        severity: 'critical',
        title: (count) => `${count} usuarios vulnerables a ataques de Kerberoasting`,
        description: `Se detectaron usuarios configurados con Service Principal Names (SPN). Estas cuentas son vulnerables a Kerberoasting, una técnica donde un atacante solicita un ticket de servicio (TGS) y lo crackea offline para obtener la contraseña en texto claro.`,
        check: (user) => {
            return user.Enabled === true &&
                user.ServicePrincipalNames &&
                user.ServicePrincipalNames.length > 0 &&
                user.SamAccountName !== 'krbtgt'; // Exclude krbtgt
        },
        remediation: (users) => `1. Usar contraseñas largas (>25 caracteres) para estas cuentas.\n2. Migrar a gMSA (Group Managed Service Accounts) si es posible.\n3. Auditar eventos 4769 (Kerberos Ticket Request).`
    },

    // 5. AS-REP Roasting (No Pre Auth)
    ASREP_ROASTING: {
        id: 'ASREP_ROASTING',
        severity: 'critical',
        title: (count) => `${count} usuarios vulnerables a AS-REP Roasting`,
        description: `Usuarios configurados con 'Do not require Kerberos preauthentication'. Esto permite a cualquier atacante solicitar un TGT para el usuario sin conocer su contraseña y luego intentar crackear el hash offline.`,
        check: (user) => {
            return user.Enabled === true && user.DoNotRequirePreAuth === true;
        },
        remediation: (users) => `Habilitar pre-autenticación Kerberos:\nSet-ADUser -Identity <User> -DoNotRequirePreAuth $false`
    },

    // 6. Trusted for Unconstrained Delegation
    UNCONSTRAINED_DELEGATION: {
        id: 'UNCONSTRAINED_DELEGATION',
        severity: 'critical',
        title: (count) => `${count} usuarios con Delegación Sin Restricciones`,
        description: `Riesgo EXTREMO. Estas cuentas pueden suplantar a cualquier usuario del dominio que se conecte a ellas. Un atacante que comprometa esta cuenta puede obtener tickets TGT de administradores y controlar el dominio.`,
        check: (user) => {
            return user.Enabled === true && user.TrustedForDelegation === true;
        },
        remediation: (users) => `Desactivar la delegación en la pestaña "Delegation" de ADUC o cambiar a "Constrained Delegation".`
    }
};

/**
 * Main Analyzer Function
 * @param {Array} users - Raw User JSON objects
 * @returns {Array} - List of verified findings
 */
function analyzeUsersDeterministic(users) {
    const findings = [];

    // Iterate over each rule definition
    Object.values(userRules).forEach(rule => {
        // Find all matching users for this rule
        const affectedUsers = users.filter(u => {
            try {
                return rule.check(u);
            } catch (e) {
                console.warn(`Error checking rule ${rule.id} for user ${u.SamAccountName}:`, e);
                return false;
            }
        });

        if (affectedUsers.length > 0) {
            // Construct the finding deterministically
            findings.push({
                title: rule.title(affectedUsers.length),
                description: rule.description,
                severity: rule.severity,
                recommendation: "Ver detalles en la sección de remediación.",
                remediation_commands: rule.remediation(affectedUsers),
                affected_count: affectedUsers.length,
                evidence: {
                    count: affectedUsers.length,
                    affected_objects: affectedUsers.map(u => u.SamAccountName),
                    details: `Detectado determinísticamente por Active Scan Insight.`
                },
                // Default Metadata
                impact_business: "Compromiso de identidad y posible escalación de privilegios.",
                mitre_attack: "T1098, T1558",
                cis_control: "5.2"
            });
        }
    });

    return findings;
}

export { analyzeUsersDeterministic };
