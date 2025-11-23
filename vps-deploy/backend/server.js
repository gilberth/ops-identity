import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Ensure node-fetch is available or use global fetch in Node 18+
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import zlib from 'zlib';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database Configuration
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/postgres',
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.text({ limit: '500mb' }));

// Constants
const CATEGORIES = [
  'Users', 'GPOs', 'Computers', 'OUs', 'Groups', 'Domains',
  'Containers', 'ACLs', 'CertServices', 'Meta', 'DCHealth', 'DNS', 'DHCP', 'Security', 'Kerberos'
];

const MAX_PROMPT = 8000;

// Helper: Log to DB
const timestamp = () => new Date().toISOString();

async function addLog(assessmentId, level, message, categoryId = null) {
  try {
    console.log(`[${timestamp()}] [${level.toUpperCase()}] ${message}`);
    await pool.query(
      'INSERT INTO assessment_logs (assessment_id, level, message, category_id) VALUES ($1, $2, $3, $4)',
      [assessmentId, level, message, categoryId]
    );
  } catch (error) {
    console.error(`[${timestamp()}] ❌ Error logging to DB:`, error.message);
  }
}

// Helper: Sanitize text to remove null bytes and other problematic characters
function sanitizeText(text) {
  if (!text) return '';
  // Ensure text is a string before calling .replace()
  const str = typeof text === 'string' ? text : String(text);
  // Remove null bytes (0x00) and other control characters except newlines and tabs
  return str.replace(/\x00/g, '').replace(/[\x01-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

// Helper: Get system configuration
async function getConfig(key) {
  try {
    const result = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
    return result.rows[0]?.value || null;
  } catch (error) {
    console.error(`[${timestamp()}] Error getting config ${key}:`, error.message);
    return null;
  }
}

// Helper: Set system configuration
async function setConfig(key, value) {
  try {
    await pool.query(
      'INSERT INTO system_config (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP',
      [key, value]
    );
    return true;
  } catch (error) {
    console.error(`[${timestamp()}] Error setting config ${key}:`, error.message);
    return false;
  }
}

// Helper: Extract Category Data
function extractCategoryData(jsonData, categoryName) {
  const categoryKey = Object.keys(jsonData).find(key =>
    key.toLowerCase() === categoryName.toLowerCase()
  );

  if (!categoryKey || !jsonData[categoryKey]) return null;

  const categoryData = jsonData[categoryKey];

  if (categoryData.Data) {
    return Array.isArray(categoryData.Data) ? categoryData.Data : [categoryData.Data];
  }
  if (Array.isArray(categoryData)) return categoryData;
  if (typeof categoryData === 'object') return [categoryData];

  return null;
}

// AI Analysis Logic (Ported from Edge Function)
async function analyzeCategory(assessmentId, category, data) {
  try {
    await addLog(assessmentId, 'info', `Starting AI analysis for ${category}...`, category);

    // Get AI configuration
    const provider = (await getConfig('ai_provider')) || 'openai';
    const model = (await getConfig('ai_model')) || 'gpt-4o-mini';
    const apiKey = await getConfig(`${provider}_api_key`) || process.env.OPENAI_API_KEY || process.env.LOVABLE_API_KEY;

    if (!apiKey) {
      await addLog(assessmentId, 'warn', `No API key found for ${provider}. Skipping AI analysis.`, category);
      return [];
    }

    // Chunking logic for large datasets
    const CHUNK_SIZE = 10000; // Process 10K items at a time
    const MAX_PARALLEL_CHUNKS = 3; // Limit concurrent processing
    let allFindings = [];

    if (data.length > CHUNK_SIZE) {
      // Large dataset - process in chunks
      const totalChunks = Math.ceil(data.length / CHUNK_SIZE);
      await addLog(assessmentId, 'info', `Dataset grande: ${data.length.toLocaleString()} items. Dividiendo en ${totalChunks} chunks de ${CHUNK_SIZE.toLocaleString()}`, category);
      console.log(`[${timestamp()}] [AI] ${category}: Large dataset (${data.length} items), chunking into ${totalChunks} chunks`);

      for (let i = 0; i < totalChunks; i += MAX_PARALLEL_CHUNKS) {
        const chunkPromises = [];
        
        for (let j = 0; j < MAX_PARALLEL_CHUNKS && (i + j) < totalChunks; j++) {
          const chunkIndex = i + j;
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, data.length);
          const chunk = data.slice(start, end);
          
          console.log(`[${timestamp()}] [AI] Processing chunk ${chunkIndex + 1}/${totalChunks} (${start}-${end})`);
          
          chunkPromises.push(
            (async () => {
              try {
                await addLog(assessmentId, 'info', `Analizando chunk ${chunkIndex + 1}/${totalChunks} (${chunk.length.toLocaleString()} items)`, category);
                
                const prompt = buildPrompt(category, chunk);
                console.log(`[${timestamp()}] [AI] Chunk ${chunkIndex + 1} prompt: ${prompt.length} chars`);
                
                const findings = await callAI(prompt, provider, model, apiKey);
                console.log(`[${timestamp()}] [AI] Chunk ${chunkIndex + 1} returned ${findings.length} findings`);
                
                if (findings.length > 0) {
                  await addLog(assessmentId, 'info', `Chunk ${chunkIndex + 1}: ${findings.length} hallazgos encontrados`, category);
                }
                
                return findings;
              } catch (error) {
                console.error(`[${timestamp()}] [AI] Error in chunk ${chunkIndex + 1}:`, error);
                await addLog(assessmentId, 'error', `Error en chunk ${chunkIndex + 1}: ${error.message}`, category);
                return [];
              }
            })()
          );
        }
        
        // Wait for current batch of chunks
        const chunkResults = await Promise.all(chunkPromises);
        allFindings.push(...chunkResults.flat());
        
        await addLog(assessmentId, 'info', `Progreso: ${Math.min(i + MAX_PARALLEL_CHUNKS, totalChunks)}/${totalChunks} chunks completados`, category);
      }
      
      // Deduplicate findings by title
      const uniqueFindings = [];
      const seenTitles = new Set();
      for (const f of allFindings) {
        if (!seenTitles.has(f.title)) {
          seenTitles.add(f.title);
          uniqueFindings.push(f);
        }
      }
      
      allFindings = uniqueFindings;
      console.log(`[${timestamp()}] [AI] ${category}: Total ${allFindings.length} unique findings after deduplication`);
      
    } else {
      // Small dataset - process as single chunk
      console.log(`[${timestamp()}] [AI] ${category}: Small dataset (${data.length} items), processing in single chunk`);
      const prompt = buildPrompt(category, data);
      console.log(`[${timestamp()}] [AI] Analyzing ${category} with prompt length: ${prompt.length} chars`);
      
      allFindings = await callAI(prompt, provider, model, apiKey);
    }

    console.log(`[${timestamp()}] [AI] ${category} analysis complete: ${allFindings.length} findings`);
    await addLog(assessmentId, 'info', `AI analysis complete: ${allFindings.length} findings`, category);

    // Save findings to database
    if (allFindings.length > 0) {
      for (const f of allFindings) {
        await pool.query(
          `INSERT INTO findings (
            assessment_id, title, severity, description, recommendation, evidence,
            mitre_attack, cis_control, impact_business, remediation_commands,
            prerequisites, operational_impact, microsoft_docs, current_vs_recommended,
            timeline, affected_count
          )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            assessmentId,
            sanitizeText(f.title || 'Security Issue'),
            f.severity || 'medium',
            sanitizeText(f.description || 'No description'),
            sanitizeText(f.recommendation || 'Review finding'),
            JSON.stringify(f.evidence || {}),
            sanitizeText(f.mitre_attack || ''),
            sanitizeText(f.cis_control || ''),
            sanitizeText(f.impact_business || ''),
            sanitizeText(f.remediation_commands || ''),
            sanitizeText(f.prerequisites || ''),
            sanitizeText(f.operational_impact || ''),
            sanitizeText(f.microsoft_docs || ''),
            sanitizeText(f.current_vs_recommended || ''),
            sanitizeText(f.timeline || ''),
            f.affected_count || 0
          ]
        );
      }
      await addLog(assessmentId, 'info', 'Findings saved successfully', category);
    }

    return allFindings;
  } catch (error) {
    console.error(`Error analyzing ${category}:`, error);
    await addLog(assessmentId, 'error', `Analysis error: ${error.message}`, category);
    return [];
  }
}

function buildPrompt(cat, d) {
  const str = (v, max) => JSON.stringify(v || [], null, 2).substring(0, max);

  const categoryInstructions = {
    Users: `Analiza estos usuarios de Active Directory para identificar vulnerabilidades de seguridad.

**⚠️ VALIDACIÓN CRÍTICA PARA USUARIOS:**
- SOLO genera findings si hay usuarios con el problema en los datos (count > 0)
- Los nombres de usuarios en affected_objects deben ser REALES de los datos analizados
- Los comandos PowerShell deben incluir los SamAccountName reales encontrados
- Si los datos muestran 0 usuarios con un problema, NO generes finding para eso

**BUSCA ESPECÍFICAMENTE (SOLO SI HAY EVIDENCIA):**

1. **Contraseñas que nunca expiran** (PasswordNeverExpires=true AND Enabled=true)
   - Riesgo: Contraseñas comprometidas permanecen válidas indefinidamente
   - CIS Control: 5.2.1 - Ensure password expiration is enabled for all accounts
   - Impacto: Permite persistencia de atacantes, vulnera compliance (NIST 800-53)
   - Comando búsqueda: Get-ADUser -Filter {PasswordNeverExpires -eq $true -and Enabled -eq $true} -Properties PasswordNeverExpires, LastLogonDate
   - Comando fix: Set-ADUser -Identity "SamAccountName" -PasswordNeverExpires $false
   - Verificación: Get-ADUser -Identity "SamAccountName" -Properties PasswordNeverExpires | Select Name, PasswordNeverExpires
   - Timeline: Remediar en 7 días

2. **Usuarios privilegiados excesivos** (miembros de Domain Admins > 5, Enterprise Admins > 3)
   - Riesgo: Exceso de cuentas con privilegios elevados aumenta superficie de ataque exponencialmente
   - CIS Control: 5.1.1 - Minimize administrative accounts to essential personnel only
   - Impacto: Mayor probabilidad de compromiso, dificulta auditoría forense
   - Comando búsqueda: Get-ADGroupMember -Identity "Domain Admins" -Recursive | Select Name, SamAccountName
   - Comando auditoría: Get-ADUser -Filter {AdminCount -eq 1} -Properties AdminCount, LastLogonDate | Select Name, LastLogonDate
   - Recomendación: Implementar JIT (Just-In-Time) Admin Access con Azure AD PIM o PAM
   - Timeline: Revisar en 14 días, justificar cada cuenta

3. **Cuentas inactivas habilitadas** (LastLogonDate > 90 días AND Enabled=true)
   - Riesgo: Cuentas olvidadas son vectores de ataque, difíciles de monitorear
   - CIS Control: 5.3.1 - Disable or remove inactive accounts within 90 days
   - Impacto: Backdoors potenciales, vulnera principio de least privilege
   - Comando búsqueda: $InactiveDate = (Get-Date).AddDays(-90); Get-ADUser -Filter {LastLogonDate -lt $InactiveDate -and Enabled -eq $true} -Properties LastLogonDate
   - Comando fix: Disable-ADAccount -Identity "SamAccountName"
   - Verificación: Get-ADUser -Identity "SamAccountName" -Properties Enabled | Select Name, Enabled
   - Timeline: Deshabilitar en 30 días tras notificar manager

4. **Kerberoasting vulnerable** (ServicePrincipalNames presentes en cuentas de usuario)
   - Riesgo: Atacantes pueden solicitar TGS y crackear passwords offline sin detectar
   - MITRE ATT&CK: T1558.003 (Kerberoasting)
   - Impacto: Compromiso de cuentas de servicio suele llevar a movimiento lateral
   - Comando búsqueda: Get-ADUser -Filter {ServicePrincipalName -like "*"} -Properties ServicePrincipalName, PasswordLastSet
   - Comando auditoría: Get-ADUser -Filter {ServicePrincipalName -like "*"} -Properties PasswordLastSet | Where {$_.PasswordLastSet -lt (Get-Date).AddDays(-365)}
   - Recomendación: Usar gMSA (Group Managed Service Accounts) o passwords > 25 caracteres
   - Timeline: Migrar a gMSA en 60 días

5. **ASREPRoasting vulnerable** (DoNotRequirePreAuth=true)
   - Riesgo: Permite obtener TGT sin autenticación previa, crackearlo offline
   - MITRE ATT&CK: T1558.004 (AS-REP Roasting)
   - Impacto: Bypass de autenticación, extracción de hashes sin credenciales
   - Comando búsqueda: Get-ADUser -Filter {DoNotRequirePreAuth -eq $true} -Properties DoNotRequirePreAuth
   - Comando fix: Set-ADUser -Identity "SamAccountName" -DoNotRequirePreAuth $false
   - Verificación: Get-ADUser -Identity "SamAccountName" -Properties DoNotRequirePreAuth
   - Timeline: Remediar INMEDIATAMENTE (24 horas)

6. **Delegación sin restricciones en usuarios** (TrustedForDelegation=true, no service accounts)
   - Riesgo: Permite ataques de pass-the-ticket, suplantación de cualquier usuario incluyendo DAs
   - MITRE ATT&CK: T1134.005 (SID-History Injection), T1550.003 (Pass the Ticket)
   - Impacto: Escalación de privilegios total, compromiso de dominio
   - Comando búsqueda: Get-ADUser -Filter {TrustedForDelegation -eq $true} -Properties TrustedForDelegation
   - Comando fix: Set-ADUser -Identity "SamAccountName" -TrustedForDelegation $false
   - Alternativa segura: Usar constrained delegation: Set-ADUser -Identity "SamAccountName" -Add @{'msDS-AllowedToDelegateTo'='HTTP/server.domain.com'}
   - Timeline: Remediar INMEDIATAMENTE (24 horas)

7. **Protected Users Group** (cuentas admin NO están en el grupo)
   - Riesgo: Cuentas privilegiadas vulnerables a credential theft, pass-the-hash
   - CIS Control: 5.8.1 - Add privileged accounts to Protected Users security group
   - Comando búsqueda: Get-ADGroupMember "Domain Admins" | Where {(Get-ADUser $_.SamAccountName -Properties MemberOf).MemberOf -notcontains (Get-ADGroup "Protected Users").DistinguishedName}
   - Comando fix: Add-ADGroupMember -Identity "Protected Users" -Members "SamAccountName"
   - Nota: Validar compatibilidad de aplicaciones antes de mover cuentas
   - Timeline: Implementar en 30 días tras testing

**PARA CADA HALLAZGO, PROPORCIONA (EN ESPAÑOL):**
- **Título**: Número REAL de usuarios afectados + problema específico
  Ejemplo: "15 usuarios con contraseñas que nunca expiran detectados"
  
- **Descripción**: 2-3 párrafos con:
  * Número exacto y problema (con datos de los findings)
  * Vector de ataque específico (credential stuffing, brute force, etc.)
  * Impacto en negocio (acceso no autorizado, exfiltración de datos, ransomware)
  * Referencia a CIS/MITRE con número específico
  * Regulaciones afectadas (GDPR Art. 32, NIST 800-53 IA-5)
  
- **Recomendación**: Pasos inmediatamente ejecutables:
  * Comandos PowerShell con SamAccountName reales de los datos
  * Cada comando debe ser copy-paste ready
  * Script completo si son > 5 usuarios: ForEach-Object loop
  * Path de GPO para automatizar: Computer Config > Policies > Security Settings > Account Policies
  * Comando de verificación post-fix
  * Nivel de dificultad: Bajo (1 comando) / Medio (requiere GPO) / Alto (requiere arquitectura)
  
- **Evidencia**: 
  * affected_objects: Array con SamAccountName reales (máximo 10, si son más indicar "...y X más")
  * count: Número total REAL de los datos
  * details: Información específica (ej: "LastLogonDate promedio: 245 días, PasswordLastSet promedio: 18 meses")`,

    GPOs: `Analiza estas Group Policy Objects para identificar configuraciones inseguras.

**⚠️ VALIDACIÓN CRÍTICA PARA GPOs:**
- Si los datos muestran "cpassword": null o "cpassword" no aparece → NO generar finding de cpassword
- Solo reporta GPOs que existan en los datos con valores problemáticos verificables
- Los comandos PowerShell deben ser ESPECÍFICOS para GPO (Get-GPO, Get-GPOReport, Set-GPPermission)
- NO uses comandos no relacionados como Get-WMIObject para problemas de GPO

**BUSCA ESPECÍFICAMENTE (CON EVIDENCIA REAL):**
1. **GPOs sin aplicar** (Links vacíos o deshabilitados)
   - Riesgo: Políticas de seguridad no se están aplicando
   - Comando para verificar: Get-GPO -All | Where-Object {$_.GpoStatus -eq 'AllSettingsDisabled'}
   
2. **Permisos peligrosos** (Authenticated Users puede editar)
   - Riesgo: Usuarios no privilegiados pueden modificar políticas
   - CIS Control: 2.3.10.5 - Restrict GPO modification
   - Comando para auditar: Get-GPPermission -Name "GPO_NAME" -All

3. **GPO Preference Passwords** (cpassword con valor real en XML)
   - ⚠️ SOLO SI encuentras valor cpassword NO NULO
   - Riesgo: Contraseñas almacenadas con cifrado reversible AES-256 crackeado
   - MITRE ATT&CK: T1552.006
   - Comando para buscar: Get-ChildItem "\\\\domain\\SYSVOL\\*\\Policies\\*\\Machine\\Preferences" -Recurse -Filter "*.xml" | Select-String "cpassword"

4. **Configuraciones de seguridad débiles** (SOLO SI ESTÁN EN LOS DATOS):
   - Password policy: MinimumPasswordLength < 14 caracteres
   - Lockout threshold: LockoutThreshold < 5 intentos o 0 (deshabilitado)
   - Maximum password age: > 90 días o 0 (nunca expira)
   - Password history: PasswordHistorySize < 24
   - Comando para verificar: Get-ADDefaultDomainPasswordPolicy

5. **GPOs con configuraciones conflictivas**
   - Múltiples GPOs configurando el mismo setting
   - Comando para detectar: Get-GPOReport -Name "GPO_NAME" -ReportType HTML

**PARA CADA HALLAZGO, PROPORCIONA:**
- **Título**: En ESPAÑOL, específico con número de GPOs afectadas
  Ejemplo: "2 GPOs con configuraciones de contraseña débiles detectadas"
  
- **Descripción**: En ESPAÑOL, impacto en la postura de seguridad:
  * Qué configuración específica está mal (con valores reales de los datos)
  * Por qué facilita ataques (brute force, credential stuffing, etc.)
  * Impacto en cumplimiento (CIS, NIST, ISO 27001)
  
- **Recomendación**: En ESPAÑOL, pasos ACCIONABLES:
  * Path en GPMC: Computer Configuration > Policies > Windows Settings > Security Settings > ...
  * Configuración correcta según CIS Benchmark (valor específico)
  * Comandos PowerShell SOLO para GPO (Get-GPO, Set-GPLink, etc.)
  * Cada comando debe incluir el nombre real del GPO de los datos
  * Comando de verificación: Get-GPOReport -Name "NOMBRE_REAL" -ReportType XML
  
- **Evidencia**: Nombres REALES de GPOs de los datos y sus configuraciones problemáticas con valores específicos`,

    Computers: `Analiza estos equipos de Active Directory para identificar riesgos.

**BUSCA ESPECÍFICAMENTE:**
1. **Sistemas operativos obsoletos** (Windows Server 2008/2012, Windows 7/8)
   - Riesgo: Sin soporte, vulnerabilidades sin parchar
   - CIS Control: 7.1 - Maintain supported OS versions

2. **Equipos inactivos** (LastLogonDate > 90 días)
   - Riesgo: Equipos comprometidos no detectados
   
3. **Delegación sin restricciones** (TrustedForDelegation=true, no DC)
   - Riesgo: Permite ataques de pass-the-ticket
   - MITRE ATT&CK: T1550.003

4. **Controladores de dominio**:
   - Versiones de OS desactualizadas
   - Roles FSMO mal distribuidos
   - Sin redundancia geográfica

**PARA CADA HALLAZGO, PROPORCIONA:**
- **Título**: Número de equipos afectados y tipo de problema
- **Descripción**: Riesgo específico y vectores de ataque
- **Recomendación**: Plan de remediación:
  * Para OS obsoletos: Plan de migración/actualización
  * Para delegación: Cómo deshabilitar o restringir
  * Comandos PowerShell para implementar
- **Evidencia**: Lista de equipos (hostname, OS, última actividad)`,

    Groups: `Eres un auditor de seguridad especializado en privilegios y gestión de identidades en Active Directory.

**⚠️ CONTEXTO DE ANÁLISIS:**
Los grupos son el mecanismo principal de asignación de permisos en AD. El exceso de privilegios es una de las vulnerabilidades más explotadas en compromisos de dominio. Debes buscar desviaciones del principio de least privilege y grupos con configuraciones que faciliten escalación de privilegios.

**🎯 PRIORIDADES DE DETECCIÓN (EN ORDEN):**

1. **🔴 CRITICAL: Grupos de Tier 0 sobrepoblados**
   - Domain Admins > 5 miembros permanentes
   - Enterprise Admins > 3 miembros
   - Schema Admins con miembros permanentes (debe estar vacío excepto durante cambios)
   - Administrators (Built-in) > 10 miembros
   - Riesgo: Superficie de ataque masiva, dificulta respuesta a incidentes
   - MITRE ATT&CK: T1078.002 (Valid Accounts: Domain Accounts)
   - CIS Control: 5.4 - Restrict Administrator Privileges to Dedicated Accounts
   - Impacto: Un solo compromiso = control total del dominio
   - Comando auditoría: Get-ADGroupMember "Domain Admins" | Measure-Object | Select-Object Count
   - Comando detalle: Get-ADGroupMember "Domain Admins" -Recursive | Get-ADUser -Properties Enabled,LastLogonDate,PasswordLastSet
   - Timeline: Remediar INMEDIATAMENTE (48 horas)

2. **🔴 HIGH: Cuentas de usuario estándar en grupos privilegiados**
   - Buscar cuentas sin prefijo admin/svc/srv en Domain Admins
   - Ejemplo: "juan.perez" en vez de "admin-juan.perez"
   - Riesgo: Cuentas admin usadas para tareas diarias, mayor exposición a phishing
   - CIS Control: 5.1 - Establish and Maintain an Inventory of Accounts
   - Comando verificar: Get-ADGroupMember "Domain Admins" | Where-Object {$_.SamAccountName -notlike "admin*" -and $_.SamAccountName -notlike "svc*"}
   - Timeline: Crear cuentas admin separadas en 7 días

3. **🔴 HIGH: Protected Users Group no implementado**
   - Grupo debe contener TODAS las cuentas Tier 0/1
   - Si está vacío o < 50% de cuentas privilegiadas → HIGH finding
   - Riesgo: Cuentas admin vulnerables a pass-the-hash, Kerberos delegation attacks
   - CIS Control: 5.8 - Add Privileged Accounts to Protected Users Group
   - Protección: Deshabilita NTLM, DES/RC4, delegación, credential caching
   - Comando verificar: Get-ADGroupMember "Protected Users" | Measure-Object
   - Comando fix: Add-ADGroupMember -Identity "Protected Users" -Members (Get-ADGroupMember "Domain Admins")
   - Timeline: Implementar en 14 días tras testing de compatibilidad

4. **⚠️ MEDIUM: Grupos privilegiados con miembros inactivos**
   - Miembros de grupos admin sin LastLogonDate en > 90 días
   - Riesgo: Cuentas olvidadas, posibles backdoors
   - Comando: Get-ADGroupMember "Domain Admins" | Get-ADUser -Properties LastLogonDate | Where-Object {$_.LastLogonDate -lt (Get-Date).AddDays(-90)}
   - Timeline: Revisar y remover en 30 días

5. **⚠️ MEDIUM: Anidamiento complejo de grupos**
   - Grupos dentro de grupos > 3 niveles de profundidad
   - Riesgo: Permisos heredados no evidentes, dificulta auditoría
   - Ejemplo problemático: GroupA → GroupB → GroupC → Domain Admins
   - Comando: Get-ADGroup -Filter * -Properties MemberOf | Where-Object {$_.MemberOf.Count -gt 0}

**🏆 MEJORES PRÁCTICAS - BASELINE RECOMENDADO:**
- **Tier 0 (Domain/Enterprise Admins)**: Máximo 3-5 cuentas permanentes, dedicadas solo a tareas críticas de dominio
- **Tier 1 (Server Admins)**: Separados de Tier 0, máximo 10 cuentas, solo para gestión de servidores
- **Tier 2 (Workstation Admins)**: Separados de Tier 0/1, para soporte de escritorio
- **Naming Convention**: Cuentas admin deben tener prefijo identificable (admin-, adm-, svc-)
- **Protected Users**: 100% de cuentas Tier 0 deben estar en este grupo
- **Revisión periódica**: Auditoría trimestral de membresía en grupos privilegiados
- **Justificación documentada**: Cada miembro debe tener business justification aprobada
- **Separación de deberes**: Administradores de diferentes áreas en grupos diferentes
- **JIT Access**: Implementar Privileged Identity Management (PIM) para acceso temporal

**📋 FORMATO DE REPORTE - CADA FINDING DEBE INCLUIR:**
- **Título** (ESPAÑOL): "[NÚMERO] cuentas no autorizadas en grupo [NOMBRE]" o "Grupo [NOMBRE] sobrepoblado con [COUNT] miembros"
- **Descripción** (3 párrafos obligatorios):
  * Párrafo 1 - ESTADO ACTUAL: Número exacto, nombres de grupos afectados, configuración actual vs baseline recomendado
  * Párrafo 2 - RIESGO: Vector de ataque específico (credential theft, lateral movement), técnicas MITRE ATT&CK aplicables
  * Párrafo 3 - IMPACTO: Consecuencias en negocio (downtime, data breach), compliance (GDPR Art. 32, SOX 404, PCI-DSS 7.1.2, ISO 27001 A.9.2.3)
- **Recomendación** (roadmap de implementación paso a paso):
  * FASE 1 - AUDITORÍA (Semana 1):
    - Comando PowerShell: Get-ADGroupMember "Domain Admins" -Recursive | Get-ADUser -Properties LastLogonDate,PasswordLastSet,Enabled | Export-CSV
    - Identificar cuentas sin justificación documentada
    - Validar con owners de cada cuenta (IT Manager, CISO)
  * FASE 2 - LIMPIEZA (Semana 2-3):
    - Criterios de remoción: cuentas inactivas > 90 días, usuarios sin rol admin documentado, cuentas de servicio mal ubicadas
    - Comando fix: Remove-ADGroupMember -Identity "Domain Admins" -Members "username" -Confirm:$false
    - Proceso de aprobación: Requiere sign-off de CISO + CIO
  * FASE 3 - HARDENING (Semana 4):
    - Implementar naming convention: Renombrar cuentas a formato admin-firstname.lastname
    - Agregar a Protected Users: Add-ADGroupMember -Identity "Protected Users" -Members (Get-ADGroupMember "Domain Admins")
    - Configurar alertas: Event ID 4728 (miembro agregado a grupo privilegiado) → SIEM
  * FASE 4 - AUTOMATIZACIÓN (Mes 2):
    - Implementar JIT access con Azure AD PIM o ManageEngine PAM360
    - Script de auditoría mensual automático
    - Dashboard de compliance en PowerBI/Grafana
  * VALIDACIÓN POST-IMPLEMENTACIÓN:
    - Verificar: (Get-ADGroupMember "Domain Admins").Count -le 5
    - Verificar: Get-ADGroupMember "Protected Users" debe contener todas las cuentas admin
    - Test de acceso: Validar que cuentas removidas no tienen acceso privilegiado
- **Evidencia**: affected_objects con nombres REALES (máximo 10, luego "...y X más"), affected_count preciso, details con estadísticas (promedio LastLogonDate, distribución por OU)`,

    DCHealth: `Analiza la salud y seguridad de los controladores de dominio.

**BUSCA ESPECÍFICAMENTE:**
1. **Problemas de replicación** (ConsecutiveReplicationFailures > 0)
   - Riesgo: Inconsistencia de datos, posible DoS
   
2. **Versiones de OS obsoletas** (< Windows Server 2016)
   - Riesgo: Vulnerabilidades sin parchar, sin soporte
   
3. **Roles FSMO** (todos en un solo DC)
   - Riesgo: Single point of failure
   
4. **KRBTGT password age** (> 180 días)
   - Riesgo: Golden ticket attacks
   - MITRE ATT&CK: T1558.001

5. **SMBv1 habilitado**
   - Riesgo: Vulnerable a EternalBlue, ransomware
   - CIS Control: 2.3.11.9 - Disable SMBv1

6. **NTLM authentication** (no restringido)
   - Riesgo: Pass-the-hash attacks
   - CIS Control: 2.3.11.7 - Restrict NTLM

7. **AD Recycle Bin** (deshabilitado)
   - Riesgo: No se pueden recuperar objetos eliminados
   
8. **Tombstone Lifetime** (< 180 días)
   - Riesgo: Pérdida de datos en backups antiguos

**PARA CADA HALLAZGO, PROPORCIONA:**
- **Título**: Problema específico del DC
- **Descripción**: Impacto en disponibilidad y seguridad
- **Recomendación**: Pasos detallados de remediación:
  * Para KRBTGT: Procedimiento de rotación segura
  * Para SMBv1: Cómo deshabilitar sin romper servicios
  * Para replicación: Diagnóstico y solución
  * Comandos PowerShell exactos
  * Referencias a Microsoft best practices
- **Evidencia**: Estado actual de cada DC`,

    DNS: `Eres un especialista en seguridad de infraestructura DNS de Active Directory con experiencia en detección de misconfigurations y vulnerabilidades de resolución de nombres.

**⚠️ CONTEXTO DE ANÁLISIS:**
DNS es crítico en AD - todos los servicios dependen de él (Kerberos, LDAP, replicación). Un DNS mal configurado puede permitir ataques de man-in-the-middle, DNS spoofing, y denial of service.

**🎯 BUSCA ESPECÍFICAMENTE:**

1. **⚠️ MEDIUM: DNS sin Forwarders configurados**
   - Si Forwarders array está vacío o no existe
   - Riesgo: Resolución DNS lenta para dominios externos, dependencia total de root hints
   - Impacto: Puede causar timeouts en aplicaciones, degradación de performance
   - CIS Control: 2.2.5 - Configure DNS forwarders
   - Comando verificar: Get-DnsServerForwarder
   - Comando fix: Add-DnsServerForwarder -IPAddress "8.8.8.8","1.1.1.1"
   - Recomendación: Usar DNS internos corporativos o públicos confiables (Google 8.8.8.8, Cloudflare 1.1.1.1)
   - Timeline: Configurar en 30 días

2. **🔴 HIGH: Zonas DNS con transferencias no seguras**
   - Si AllowZoneTransfer = true sin restricción de IPs
   - Riesgo: Enumeración completa de infraestructura (hostnames, IPs, estructura organizacional)
   - MITRE ATT&CK: T1590.002 (Gather Victim Network Information: DNS)
   - Comando verificar: Get-DnsServerZone | Where-Object {$_.SecureSecondaries -eq 'NoTransfer'}
   - Comando fix: Set-DnsServerPrimaryZone -Name "domain.com" -SecureSecondaries "TransferToSecureServers"
   - Timeline: Remediar INMEDIATAMENTE (48 horas)

3. **⚠️ MEDIUM: Scavenging deshabilitado**
   - Registros DNS obsoletos no se limpian automáticamente
   - Riesgo: DNS cache poisoning más efectivo, confusión en resolución
   - Comando verificar: Get-DnsServerScavenging
   - Comando habilitar: Set-DnsServerScavenging -ScavengingState $true -ScavengingInterval "7.00:00:00"
   - Timeline: Habilitar en 30 días

4. **ℹ️ INFO: Número de zonas DNS**
   - Reportar total de zonas (primarias, secundarias, stub)
   - No es problema, solo visibilidad de complejidad

**📋 SOLO GENERA FINDING SI:**
- Forwarders = [] (array vacío) o null
- SecureSecondaries permite transferencias no autorizadas
- ScavengingEnabled = false

**FORMATO DE REPORTE:**
- **Título**: "DNS sin forwarders configurados" o "[N] zonas DNS con transferencias no seguras"
- **Descripción**: Impacto en performance/seguridad, escenarios de ataque
- **Recomendación**: Comandos PowerShell específicos para fix
- **Evidencia**: Configuración actual, IPs de forwarders recomendados`,

    DHCP: `Eres un especialista en seguridad de servicios de red Windows Server con enfoque en DHCP y detección de rogue servers.

**⚠️ CONTEXTO DE ANÁLISIS:**
DHCP asigna configuración de red crítica (IP, gateway, DNS servers). Un DHCP comprometido o rogue puede redirigir tráfico, capturar credenciales, y ejecutar man-in-the-middle attacks.

**🎯 BUSCA ESPECÍFICAMENTE:**

1. **🔴 CRITICAL: Rogue DHCP Servers detectados**
   - Servidores DHCP NO autorizados en AuthorizedServers
   - Riesgo: Man-in-the-middle, credential theft, DNS spoofing
   - MITRE ATT&CK: T1557.001 (Man-in-the-Middle: LLMNR/NBT-NS Poisoning)
   - Impacto: Atacante puede interceptar TODO el tráfico de red
   - Comando detectar: Get-DhcpServerInDC | Compare-Object -ReferenceObject (netsh dhcp show server)
   - Timeline: Deshabilitar INMEDIATAMENTE (< 1 hora)

2. **⚠️ MEDIUM: Scopes sin configuración de seguridad**
   - Conflict detection attempts < 2
   - Delay time < 1000ms (permite DHCP starvation)
   - Comando verificar: Get-DhcpServerv4Scope | Get-DhcpServerv4ScopeStatistics
   - Timeline: Configurar en 30 días

3. **⚠️ MEDIUM: Auditing de DHCP deshabilitado**
   - No hay logs de asignaciones IP
   - Riesgo: Imposible rastrear actividad maliciosa en investigaciones forenses
   - Comando habilitar: Set-DhcpServerAuditLog -Enable $true
   - Timeline: Habilitar en 14 días

4. **ℹ️ INFO: DHCP no configurado**
   - Si Scopes = [] y AuthorizedServers = []
   - Reportar que DHCP no está en uso o datos no disponibles
   - NO es vulnerabilidad, solo información

**📋 SOLO GENERA FINDING SI:**
- Hay servidores DHCP no autorizados (CRITICAL)
- Scopes tienen configuración débil (MEDIUM)
- Auditing está deshabilitado (MEDIUM)
- Si todo está vacío → INFO "DHCP no configurado o datos no disponibles"

**FORMATO DE REPORTE:**
- **Título**: "[N] servidores DHCP no autorizados detectados" o "Auditing de DHCP deshabilitado"
- **Descripción**: Vector de ataque, impacto en red
- **Recomendación**: Comandos para autorizar/remover servers, habilitar logging
- **Evidencia**: IPs de servers, configuración actual`,

    Security: `Eres un experto en hardening de Active Directory con especialización en protocolos de autenticación legacy y configuraciones de seguridad avanzadas.

**⚠️ CONTEXTO DE ANÁLISIS:**
Esta categoría consolida múltiples configuraciones de seguridad críticas: NTLM, SMB, LAPS, cifrado Kerberos, y delegación. Busca configuraciones legacy que faciliten lateral movement y credential theft.

**🎯 PRIORIDADES DE DETECCIÓN:**

1. **🔴 CRITICAL: NTLM Authentication Level inseguro**
   - Si DomainControllers tienen LMCompatibilityLevel < 5
   - Level 0-2: Permite LM y NTLM v1 (EXTREMADAMENTE inseguro)
   - Level 3-4: Permite NTLM v2 pero acepta v1
   - Level 5: Solo NTLMv2 (recomendado)
   - Riesgo: Pass-the-Hash attacks, NTLM relay, credential downgrade
   - MITRE ATT&CK: T1550.002 (Use Alternate Authentication Material: Pass the Hash)
   - CIS Control: 2.3.11.7 - Configure Network Security: LAN Manager Authentication Level to "Send NTLMv2 response only\\refuse LM & NTLM"
   - Impacto: Atacante puede reusar hashes NTLM sin conocer password, movimiento lateral sin detección
   - Comando verificar: Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Name "LmCompatibilityLevel"
   - Comando fix GPO: Computer Config > Policies > Windows Settings > Security Settings > Local Policies > Security Options > "Network security: LAN Manager authentication level" → "Send NTLMv2 response only\\refuse LM & NTLM"
   - Timeline: Remediar INMEDIATAMENTE (48 horas) en producción tras testing

2. **🔴 HIGH: SMBv1 habilitado en Domain Controllers**
   - Si SMBv1Status indica que SMBv1 está enabled
   - Riesgo: Vulnerable a EternalBlue (MS17-010), WannaCry, NotPetya ransomware
   - CVE: CVE-2017-0144 (EternalBlue)
   - CIS Control: 2.3.11.9 - Disable SMBv1
   - Comando verificar: Get-WindowsFeature FS-SMB1
   - Comando deshabilitar: Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart
   - Timeline: Deshabilitar en 7 días tras validar dependencias

3. **🔴 HIGH: LAPS no implementado**
   - Si LAPS.SchemaExtended = false o LAPS.ComputersWithLAPS = 0
   - Riesgo: Passwords de administrador local idénticas en todos los equipos
   - MITRE ATT&CK: T1078.003 (Valid Accounts: Local Accounts)
   - CIS Control: 5.3 - Use Unique Passwords for Local Administrator Accounts
   - Impacto: Compromiso de un equipo = acceso admin a TODOS los equipos
   - Comando verificar schema: Get-ADObject -SearchBase (Get-ADRootDSE).schemaNamingContext -Filter "name -eq 'ms-Mcs-AdmPwd'"
   - Procedimiento implementación: Extender schema, configurar GPO, instalar cliente
   - Timeline: Implementar en 30 días

4. **⚠️ MEDIUM: RC4 Encryption Types permitidos**
   - Si RC4EncryptionTypes.UsersWithRC4 > 0 o ComputersWithRC4 > 0
   - Riesgo: RC4 es cifrado débil, vulnerable a ataques de fuerza bruta
   - MITRE ATT&CK: T1558.003 (Kerberoasting más efectivo con RC4)
   - Comando verificar: Get-ADUser -Filter * -Properties msDS-SupportedEncryptionTypes | Where-Object {$_."msDS-SupportedEncryptionTypes" -band 0x4}
   - Comando fix: Set-ADUser -Identity "username" -Replace @{"msDS-SupportedEncryptionTypes"=24} # AES128+AES256
   - Timeline: Migrar a AES en 60 días

5. **⚠️ MEDIUM: Unconstrained Delegation habilitado**
   - Si UnconstrainedDelegation.Users > 0 o Computers > 0 (excluyendo DCs)
   - Riesgo: Pass-the-Ticket attacks, impersonation de cualquier usuario
   - MITRE ATT&CK: T1134.005 (Access Token Manipulation: SID-History Injection)
   - Comando verificar: Get-ADUser -Filter {TrustedForDelegation -eq $true} -Properties TrustedForDelegation
   - Comando fix: Set-ADUser -Identity "user" -TrustedForDelegation $false
   - Timeline: Remediar en 14 días

6. **ℹ️ INFO: Protected Users Group**
   - Reportar tamaño del grupo, no es problema si está implementado
   - Si tiene miembros → POSITIVO (buena práctica)

**🏆 MEJORES PRÁCTICAS SECURITY - BASELINE ENTERPRISE:**
- **NTLM Authentication**: Level 5 (Send NTLMv2 only\\refuse LM & NTLM) en TODOS los DCs y servidores
- **SMB Protocol**: SMBv1 deshabilitado, SMBv2/SMBv3 con firma digital habilitada
- **LAPS**: 100% de workstations y servers (no-DCs) con LAPS implementado, passwords rotados cada 30 días
- **Kerberos Encryption**: AES256 + AES128, RC4 solo para compatibilidad legacy documentada
- **Delegation**: Unconstrained delegation SOLO en DCs, resto debe usar Constrained o Resource-Based
- **Protected Users**: Todas las cuentas Tier 0 en este grupo (deshabilita RC4, NTLM, delegation)
- **Auditing**: Event IDs 4624, 4625, 4768, 4769 logueados y enviados a SIEM
- **Patching**: DCs parcheados mensualmente, prioridad CRÍTICA para vulnerabilidades RCE

**📋 SOLO GENERA FINDING SI:**
- LMCompatibilityLevel < 5 en DCs → CRITICAL
- SMBv1 = enabled → HIGH
- LAPS no extendido o sin deployment → HIGH
- RC4 en uso en > 10% de cuentas → MEDIUM
- Delegación sin restricciones en cuentas no-DC → MEDIUM

**FORMATO DE REPORTE (EJEMPLO PARA NTLM):**
- **Título**: "[N] Domain Controllers con NTLM Authentication Level [X] inseguro - Vulnerable a Pass-the-Hash"
  
- **Descripción** (4 párrafos):
  * Párrafo 1 - HALLAZGO: "[N] Domain Controllers están configurados con LAN Manager Authentication Level [X], permitiendo autenticación NTLM v1 o LM. Los DCs afectados son: [lista de nombres]. El baseline de seguridad Microsoft recomienda Level 5 (Send NTLMv2 response only\\refuse LM & NTLM) para prevenir ataques de Pass-the-Hash."
  * Párrafo 2 - ATAQUE PTH: "Pass-the-Hash permite a un atacante autenticarse usando el hash NTLM sin conocer el password en texto plano. Una vez obtenido el hash (mediante Mimikatz, DCSync, NTDS.dit dump), el atacante puede: (1) Ejecutar comandos remotos con psexec/wmiexec, (2) Acceder a recursos de red (SMB shares, SQL, Exchange), (3) Movimiento lateral entre servidores, (4) Escalar privilegios a Domain Admin. Herramientas: Mimikatz, Impacket, CrackMapExec."
  * Párrafo 3 - IMPACTO: "NTLM v1/LM son protocolos legacy de 1990s sin protección contra replay attacks y con cifrado débil. Hashes LM son crackeables en minutos con rainbow tables. En incidentes como NotPetya (2017) y WannaCry (2017), Pass-the-Hash fue vector clave de propagación. Permite compromiso masivo de infraestructura en horas."
  * Párrafo 4 - COMPLIANCE: "Violaciones: CIS Control 2.3.11.7 (Configure NTLM authentication to reject LM and NTLM v1), NIST 800-53 IA-5(1)(c) (cryptographically-protected passwords), PCI-DSS 8.2.1 (strong cryptography), ISO 27001 A.9.4.3 (password management system). Auditorías de compliance marcarán como finding CRÍTICO."
  
- **Recomendación** (ROADMAP COMPLETO DE MIGRACIÓN A LEVEL 5):
  
  * FASE 1 - ASSESSMENT Y COMPATIBILIDAD (Semanas 1-2):
    OBJETIVO: Identificar aplicaciones legacy que requieren NTLM v1
    COMANDO AUDITORÍA: Habilitar logging temporal en DCs
    GPO: Computer Config > Policies > Windows Settings > Security Settings > Local Policies > Security Options
    SETTING: "Network security: Restrict NTLM: Audit NTLM authentication in this domain" → Enable auditing for all accounts
    MONITOREO: Event ID 8004 en DCs → indica intentos NTLM v1
    COMANDO ANÁLISIS: Get-WinEvent -FilterHashtable @{LogName='Security';ID=8004} | Select TimeCreated,Message | Export-CSV ntlm_usage.csv
    IDENTIFICAR: Aplicaciones/servicios usando NTLM v1 (SQL Server legacy, dispositivos IoT, scanners, CRM old)
    DOCUMENTAR: Lista de aplicaciones con owners y plan de mitigación
    
  * FASE 2 - REMEDIACIÓN DE LEGACY APPS (Semanas 3-6):
    OPCIÓN A - UPGRADE: Actualizar aplicación a versión que soporta NTLMv2/Kerberos
    OPCIÓN B - CONFIGURACIÓN: Cambiar settings de app para usar NTLMv2
    OPCIÓN C - EXCEPCIÓN: Si upgrade imposible, documentar riesgo y aprobar excepción temporal
    EJEMPLO SQL: SQL Server 2000 requiere NTLM v1 → migrar a SQL 2016+ (soporta AES Kerberos)
    EJEMPLO SCANNERS: HP/Canon antiguos → actualizar firmware o reemplazar
    VALIDACIÓN: Test de aplicaciones en non-prod con Level 5 habilitado
    
  * FASE 3 - IMPLEMENTACIÓN GRADUAL (Semanas 7-8):
    PASO 1 - NON-PROD: Aplicar GPO con Level 5 en entornos Dev/QA
    GPO PATH: Computer Config > Policies > Windows Settings > Security Settings > Local Policies > Security Options
    SETTING: "Network security: LAN Manager authentication level" → Send NTLMv2 response only. Refuse LM & NTLM
    VALOR REGISTRY: LmCompatibilityLevel = 5 (REG_DWORD en HKLM\\SYSTEM\\CurrentControlSet\\Control\\Lsa)
    COMANDO POWERSHELL: Set-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Name "LmCompatibilityLevel" -Value 5
    TESTING: 48 horas de monitoreo intensivo, validar autenticación de usuarios/servicios
    
    PASO 2 - PROD PILOT: OUs piloto (ej: IT department DCs primero)
    COMANDO: New-GPO -Name "NTLM Level 5 - Pilot" | New-GPLink -Target "OU=DomainControllers,DC=domain,DC=com"
    MONITOREO: Event IDs 4625 (failed logon), 8004 (NTLM audit)
    ROLLBACK PLAN: Si > 5% de fallos, pausar 24h y analizar
    
    PASO 3 - PROD COMPLETO: Rollout a todos los DCs
    TIMING: Implementar en ventana de mantenimiento (fin de semana)
    NOTIFICAR: Service desk para manejar tickets de autenticación
    VALIDAR: gpresult /r en cada DC debe mostrar GPO aplicada
    
  * FASE 4 - POST-IMPLEMENTACIÓN (Semana 9):
    VALIDACIÓN TÉCNICA:
    COMANDO: Get-ADDomainController -Filter * | ForEach-Object {Invoke-Command -ComputerName $_.HostName -ScriptBlock {Get-ItemProperty "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Lsa" -Name "LmCompatibilityLevel"}}
    EXPECTED: Todos deben devolver LmCompatibilityLevel = 5
    
    VALIDACIÓN FUNCIONAL:
    TEST: Login de usuarios desde workstations Windows 10/11
    TEST: Acceso a file shares (SMB)
    TEST: Aplicaciones críticas (ERP, CRM, Email)
    TEST: Autenticación de servicios (SQL, IIS, APIs)
    
    MONITOREO CONTINUO:
    ALERTA: Event ID 4625 con error 0xC000006D (bad username/password) - podría indicar NTLM v1 rechazado
    DASHBOARD: PowerBI/Splunk con métricas de autenticación NTLM vs Kerberos
    OBJETIVO: < 5% de autenticaciones usando NTLM (mayoría debe ser Kerberos)
    
  * FASE 5 - HARDENING ADICIONAL (Mes 3):
    PASO 1: Deshabilitar NTLM completamente donde sea posible
    GPO: "Network security: Restrict NTLM: NTLM authentication in this domain" → Deny all
    NOTA: Solo en ambientes 100% Kerberos, requiere testing exhaustivo
    
    PASO 2: Habilitar SMB Signing obligatorio
    GPO: "Microsoft network server: Digitally sign communications (always)" → Enabled
    PREVIENE: NTLM relay attacks incluso con NTLMv2
    
    PASO 3: Auditoría trimestral
    SCRIPT: Automated compliance check de LmCompatibilityLevel en todos los DCs
    REPORTE: Dashboard ejecutivo con estado de compliance
    
  * TIMELINE CRÍTICO:
    - Si Level 0-2 (LM/NTLM v1): EMERGENCIA - Remediar en 48 horas
    - Si Level 3-4: URGENTE - Remediar en 14 días
    - Total duración proyecto: 8-12 semanas desde inicio hasta prod completo
    
  * COSTO Y RECURSOS:
    - Esfuerzo: 80-120 horas (Security Engineer + Sys Admin + App Owners)
    - Downtime: Máximo 2 horas por DC (aplicación GPO + reboot)
    - Riesgo de rollback: < 5% si testing es adecuado
    
- **Evidencia**:
  * affected_objects: [nombres REALES de DCs con Level < 5]
  * affected_count: [número de DCs afectados]
  * details: "LMCompatibilityLevel actual: [valores por DC], Baseline recomendado: 5 (NTLMv2 only), Desvío: [análisis], DCs críticos afectados: [lista prioritaria]"`,

    Kerberos: `Eres un especialista en protocolos de autenticación Kerberos y detección de vectores de ataque avanzados en Active Directory.

**⚠️ VALIDACIÓN CRÍTICA PARA KERBEROS:**
- SIEMPRE revisa KRBTGTPasswordAge - es el indicador más crítico
- Si KRBTGTPasswordAge > 180 días → CRITICAL finding OBLIGATORIO
- Si KRBTGTPasswordAge > 365 días → CRITICAL con máxima prioridad
- Microsoft recomienda renovar KRBTGT cada 180 días máximo

**BUSCA ESPECÍFICAMENTE:**

1. **🔴 KRBTGT Password Age Excesivo** (KRBTGTPasswordAge > 180 días)
   - **CRITICAL SI > 365 días, HIGH SI 180-365 días**
   - Riesgo: Permite ataques Golden Ticket indefinidamente, compromiso total del dominio
   - MITRE ATT&CK: T1558.001 (Golden Ticket)
   - CIS Control: 5.2.3 - Rotate the KRBTGT account password at least every 180 days
   - Impacto: 
     * Atacante con hash KRBTGT puede generar tickets Kerberos válidos para CUALQUIER usuario
     * Persistencia post-compromiso INDEFINIDA hasta rotación
     * Bypass TOTAL de autenticación y logs
     * Movimiento lateral sin detección
     * Vulnera NIST 800-53 IA-5, ISO 27001 A.9.2.4
   - Comando verificar: Get-ADUser krbtgt -Properties PasswordLastSet | Select Name, PasswordLastSet
   - Comando calcular edad: [math]::Round(((Get-Date) - (Get-ADUser krbtgt -Properties PasswordLastSet).PasswordLastSet).Days)
   - Timeline: 
     * Si > 1 año: INMEDIATO (dentro de 48 horas)
     * Si > 180 días: Urgente (dentro de 7 días)
   
2. **Procedimiento de Rotación Segura de KRBTGT:**
   - ⚠️ NUNCA simplemente cambiar password - causará outage total
   - Proceso de rotación dual (Microsoft recomendado):
     POWERSHELL COMMANDS:
     # Paso 1: Primera rotación (esperar 10 horas de replicación)
     Get-ADUser krbtgt -Properties msds-KeyVersionNumber
     Set-ADAccountPassword -Identity krbtgt -Reset -NewPassword (ConvertTo-SecureString -AsPlainText "NewComplexPassword1!" -Force)
     
     # Paso 2: Verificar replicación (esperar 10+ horas)
     Get-ADReplicationPartnerMetadata -Target "DC01" -Scope Domain | Where-Object {LastReplicationSuccess -gt (Get-Date).AddHours(-1)}
     
     # Paso 3: Segunda rotación (invalidar tickets antiguos)
     Set-ADAccountPassword -Identity krbtgt -Reset -NewPassword (ConvertTo-SecureString -AsPlainText "NewComplexPassword2!" -Force)
     
   - Usar scripts oficiales: New-KrbtgtKeys.ps1 de Microsoft (recomendado)
   - Ventana de mantenimiento: Programar en horario de baja actividad
   - Post-rotación: Monitorear Event ID 4769 (TGS requests) para tickets inválidos
   
3. **KRBTGTPasswordLastSet** (fecha de última renovación)
   - Si es fecha muy antigua (> 2 años): CRITICAL
   - Indica dominio comprometido potencialmente o mala práctica de seguridad
   - Comando: (Get-ADUser krbtgt -Properties PasswordLastSet).PasswordLastSet
   
4. **Tickets de Kerberos con vida excesiva** (si disponible en datos)
   - Default: 10 horas (TGT), 10 horas (Service Ticket)
   - Máximo recomendado: TGT Lifetime < 10 horas, Max Renew < 7 días
   - Verificar en GPO: Computer Configuration > Policies > Windows Settings > Security Settings > Account Policies > Kerberos Policy

**SEVERIDADES:**
- CRITICAL: KRBTGTPasswordAge > 365 días (1 año)
- HIGH: KRBTGTPasswordAge entre 180-365 días
- MEDIUM: KRBTGTPasswordAge entre 90-180 días

**🏆 MEJORES PRÁCTICAS KERBEROS - BASELINE ENTERPRISE:**
- **KRBTGT Password Rotation**: Cada 180 días máximo (Microsoft recommendation)
- **Auditoría**: Trimestral, revisar KRBTGTPasswordAge
- **Procedimiento documentado**: Runbook de rotación probado en non-prod
- **Ticket Lifetime**: TGT 10 horas (default OK), Service Ticket 10 horas
- **Max Renewal**: 7 días (default OK), validar en GPO Kerberos Policy
- **Encryption Types**: AES256 + AES128 habilitados, RC4 deshabilitado donde sea posible
- **Clock Skew**: Máximo 5 minutos (default), monitorear sincronización NTP
- **Monitoring**: Alertas en Event ID 4768 (TGT request), 4769 (Service ticket), 4770 (TGT renewal)
- **Post-compromise**: Si hay sospecha de compromiso, rotación INMEDIATA dual en < 24 horas

**PARA EL HALLAZGO DE KRBTGT, PROPORCIONA:**
- **Título**: "Cuenta KRBTGT sin renovar por [DÍAS] días ([AÑOS] años) - Riesgo de Golden Ticket" 
  Ejemplo: "Cuenta KRBTGT sin renovar por 3537 días (9.7 años) - Riesgo de Golden Ticket"
  
- **Descripción** (4 párrafos obligatorios):
  * Párrafo 1 - ESTADO ACTUAL: "La cuenta KRBTGT del dominio tiene [DÍAS] días ([AÑOS] años) sin rotación de password desde [FECHA]. Microsoft recomienda rotación cada 180 días máximo. El desvío actual es de [DÍAS-180] días sobre la recomendación."
  * Párrafo 2 - ATAQUE GOLDEN TICKET: "Un atacante que obtenga el hash NTLM de la cuenta KRBTGT puede generar Ticket Granting Tickets (TGT) de Kerberos válidos para CUALQUIER usuario del dominio, incluyendo Domain Admins, sin necesidad de conocer sus passwords. Estos tickets falsificados (Golden Tickets) son indistinguibles de tickets legítimos y permiten acceso total al dominio sin ser detectados en logs de autenticación. El atacante puede establecer validez del ticket hasta 10 años, garantizando persistencia indefinida."
  * Párrafo 3 - IMPACTO CRÍTICO: "Este es considerado uno de los hallazgos MÁS CRÍTICOS en seguridad de Active Directory. Permite: (1) Acceso administrativo total sin credenciales, (2) Persistencia post-compromiso que sobrevive a cambios de passwords de usuarios, (3) Bypass completo de MFA y Conditional Access, (4) Movimiento lateral sin detección, (5) Exfiltración de datos sin trazabilidad. En caso de compromiso, el dominio completo debe considerarse comprometido hasta completar rotación dual de KRBTGT."
  * Párrafo 4 - COMPLIANCE: "Regulaciones violadas: NIST 800-53 IA-5(1)(e) require rotación periódica de credenciales privilegiadas, ISO 27001 A.9.2.4 gestión de información secreta de autenticación, PCI-DSS 8.2.4 cambio de passwords cada 90 días para cuentas privilegiadas, CIS Control 5.2.3 rotación de KRBTGT cada 180 días."
  
- **Recomendación** (PROCEDIMIENTO COMPLETO DE ROTACIÓN DUAL):
  
  * ⚠️ ADVERTENCIAS CRÍTICAS:
    - NUNCA usar Set-ADAccountPassword directamente sin procedimiento dual
    - Rotación única puede causar outage total (tickets válidos quedan inválidos)
    - Requiere ventana de mantenimiento coordinada con todos los equipos
    - Notificar a: IT Operations, Application Owners, Security Team, Management
    - Rollback no es posible - única solución es esperar expiración de tickets (10 horas)
    
  * FASE 1 - PRE-VALIDACIÓN (Día 0):
    COMANDO: Get-ADUser krbtgt -Properties PasswordLastSet,msDS-KeyVersionNumber | Select Name,PasswordLastSet,msDS-KeyVersionNumber
    COMANDO: Get-ADDomainController -Filter * | Test-ComputerSecureChannel -Verbose
    VALIDAR: Todos los DCs online, replicación sin errores (Get-ADReplicationFailure)
    VALIDAR: Sincronización NTP correcta en todos los DCs (w32tm /query /status)
    BACKUP: Realizar System State backup de todos los DCs
    COMUNICAR: Email a stakeholders con ventana de mantenimiento (fuera de horario productivo)
    
  * FASE 2 - PRIMERA ROTACIÓN (Día 1 - Hora no productiva, ej: 2 AM):
    PASO 1: Descargar script oficial de Microsoft New-CtmADKrbtgtKeys.ps1 desde TechNet Gallery
    COMANDO: Import-Module ActiveDirectory
    COMANDO: New-CtmADKrbtgtKeys -WhatIf  # Dry-run para validar
    COMANDO: New-CtmADKrbtgtKeys -Confirm:$false  # Ejecutar primera rotación
    RESULTADO: KeyVersionNumber incrementa en 1, PasswordLastSet actualizado
    VALIDAR: Get-ADReplicationPartnerMetadata -Target "DC01" -Scope Domain | Select Partner,LastReplicationSuccess
    MONITOREAR: Event Viewer → Security → Event ID 4724 (password reset attempt)
    
  * FASE 3 - PERIODO DE ESPERA (10+ horas obligatorias):
    RAZÓN: Tickets Kerberos existentes tienen validez de 10 horas default
    RAZÓN: Replicación AD entre todos los DCs (especialmente sitios remotos)
    ESPERAR: Mínimo 10 horas, recomendado 12-24 horas
    MONITOREAR: Logs de aplicaciones por errores de autenticación
    COMANDO MONITOREO: Get-WinEvent -FilterHashtable @{LogName='Security';ID=4768,4769} -MaxEvents 50 | Where {$_.Message -like "*failure*"}
    VALIDAR: Replicación completada: repadmin /showrepl /csv > repl_status.csv
    
  * FASE 4 - SEGUNDA ROTACIÓN (Día 2 - Misma hora que primera):
    COMANDO: New-CtmADKrbtgtKeys -Confirm:$false  # Segunda rotación
    RESULTADO: KeyVersionNumber incrementa nuevamente, password cambia segunda vez
    OBJETIVO: Invalidar tickets generados con password anterior (pre-rotación)
    VALIDAR: KeyVersionNumber debería ser = versión original + 2
    COMANDO VERIFICACIÓN: Get-ADUser krbtgt -Properties msDS-KeyVersionNumber | Select msDS-KeyVersionNumber
    
  * FASE 5 - POST-VALIDACIÓN (Día 3):
    TEST 1 - Autenticación: klist purge en estación de trabajo, login exitoso
    TEST 2 - Servicios: Validar servicios críticos (SQL, Exchange, SharePoint, aplicaciones custom)
    TEST 3 - Replicación: repadmin /replsum - debe mostrar 0 errores
    TEST 4 - LDAP: ldp.exe conectar a DCs, validar bind exitoso
    MONITOREO: Event ID 4768 sin códigos de error (0x6 = old password, 0x18 = policy)
    COMANDO: Get-WinEvent -FilterHashtable @{LogName='Security';ID=4768} -MaxEvents 100 | Group ResultCode
    DOCUMENTAR: Actualizar runbook con lecciones aprendidas
    AGENDAR: Próxima rotación en 180 días (crear ticket en ServiceNow/Jira)
    
  * HERRAMIENTAS RECOMENDADAS:
    - Script oficial: New-CtmADKrbtgtKeys.ps1 (Microsoft)
    - Alternativa: Reset-KrbtgtKeyInteractive.ps1 (Trimarc Security)
    - Validación: Get-KrbtgtPassword.ps1 para verificar estado
    - Documentación: https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/ad-forest-recovery-resetting-the-krbtgt-password
    
  * TIMELINE:
    - Si > 3 años: CRÍTICO - Ejecutar en próxima ventana de mantenimiento (máximo 7 días)
    - Si 1-3 años: ALTO - Planificar en 30 días
    - Si 180-365 días: MEDIO - Planificar en 90 días
    
- **Evidencia**:
  * affected_objects: ["krbtgt"]
  * affected_count: 1
  * details: "KRBTGTPasswordAge: [DÍAS] días ([AÑOS] años), KRBTGTPasswordLastSet: [FECHA_EXACTA], Última rotación: [FECHA_HUMANA], Desvío sobre baseline: [DÍAS-180] días, Compliance: CRÍTICO - Excede 180 días recomendados por Microsoft, CIS, NIST"`
  };

  const instruction = categoryInstructions[cat] || `Analiza los siguientes datos de ${cat} para vulnerabilidades de seguridad.`;

  return `${instruction}

**DATOS A ANALIZAR** (primeros 4000 caracteres):
${str(d, 4000)}

**INSTRUCCIONES CRÍTICAS PARA TU RESPUESTA:**

**🚨 REGLA FUNDAMENTAL - CERO FALSOS POSITIVOS:**
- **NO** generes un finding SI NO HAY EVIDENCIA CONCRETA del problema
- **NO** reportes algo como crítico si los datos dicen "no se observa" o "0 elementos"
- **NO** inventes problemas basándote en ausencia de datos
- Solo genera findings cuando los datos DEMUESTREN un problema real y verificable

**VALIDACIÓN DE EVIDENCIA OBLIGATORIA:**
Antes de generar cada finding, verifica:
✅ ¿Hay objetos afectados reales en los datos? (count > 0)
✅ ¿Los nombres/valores de affected_objects son específicos y verificables?
✅ ¿La evidencia muestra claramente el problema?
✅ ¿Los comandos PowerShell son relevantes al problema específico identificado?

**EJEMPLO DE LÓGICA CORRECTA:**
❌ MAL: "No se observan cpasswords" → Generar finding CRITICAL
✅ BIEN: "No se observan cpasswords" → NO generar finding (no hay problema)

❌ MAL: Incluir comando \`Get-WMIObject\` en finding de GPO
✅ BIEN: Solo comandos relacionados directamente con GPO (\`Get-GPO\`, \`Get-GPOReport\`)

**ESTRUCTURA PARA CADA FINDING:**
1. **severity**: "critical" o "high" (SOLO si impacto es real y demostrable)
   
2. **title**: En ESPAÑOL, formato "X [objetos] [problema específico]"
   Ejemplo: "15 usuarios con contraseñas que nunca expiran"
   NO usar: "Password issues detected"

3. **description**: En ESPAÑOL, 2-3 párrafos con:
   - Qué problema específico se encontró (con números reales)
   - Por qué es peligroso según CIS/MITRE
   - Impacto de negocio concreto (pérdida de datos, compromiso, downtime)
   - Qué vectores de ataque habilita
   - Timeline sugerido de remediación (Inmediato/30 días/90 días)

4. **recommendation**: En ESPAÑOL, pasos ACCIONABLES:
   - Comandos PowerShell ESPECÍFICOS con parámetros reales de los datos
   - Cada comando debe ser copy-paste ejecutable
   - Configuración de GPO paso a paso (GPMC path completo)
   - Referencia a CIS Benchmark específico (ej: "CIS Control 5.2.1")
   - Link a documentación Microsoft si aplica
   - Comando de verificación para confirmar que se aplicó
   - Nivel de dificultad: Bajo/Medio/Alto

5. **evidence**: Objeto JSON con:
   - **affected_objects**: Array con nombres REALES de los datos (máx 10)
   - **count**: Número TOTAL verificable en los datos
   - **details**: String con contexto adicional específico

**CALIDAD DE COMANDOS POWERSHELL:**
✅ Usar cmdlets oficiales: Get-ADUser, Set-ADUser, Get-GPO, etc.
✅ Incluir filtros específicos: -Filter, -Properties
✅ Incluir parámetros de los objetos reales encontrados
❌ NO usar comandos genéricos irrelevantes al problema

**CONDICIÓN DE SALIDA:**
- Si después de analizar NO encuentras problemas críticos o altos con evidencia real
- Devuelve: {"findings": []}
- NO fuerces findings para "rellenar"

**IDIOMA:**
🇪🇸 ESPAÑOL OBLIGATORIO en: title, description, recommendation, evidence.details
- Usa terminología técnica correcta en español
- Mantén nombres de comandos/parámetros en inglés (ej: Set-ADUser -PasswordNeverExpires $false)

**IMPACTO DE NEGOCIO (agregar en description):**
- Riesgo financiero potencial
- Cumplimiento regulatorio afectado (GDPR, SOX, HIPAA si aplica)
- SLA de disponibilidad en riesgo
`;
}

async function callAI(prompt, provider, model, apiKey) {
  try {
    console.log(`[${timestamp()}] [${provider.toUpperCase()}] Making API call with model ${model}...`);
    
    if (provider === 'openai') {
      return await callOpenAI(prompt, model, apiKey);
    } else if (provider === 'gemini') {
      return await callGemini(prompt, model, apiKey);
    } else if (provider === 'deepseek') {
      return await callDeepSeek(prompt, model, apiKey);
    } else {
      throw new Error(`Unknown AI provider: ${provider}`);
    }
  } catch (error) {
    console.error(`[${timestamp()}] [${provider.toUpperCase()}] Call failed:`, error.message);
    return [];
  }
}

async function callOpenAI(prompt, model, key) {
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
        messages: [
          {
            role: 'system',
            content: `Eres un analista senior de seguridad de Active Directory con certificaciones CISSP, OSCP y experiencia en auditorías de cumplimiento.

PRINCIPIOS FUNDAMENTALES:
1. CERO TOLERANCIA A FALSOS POSITIVOS - Solo reporta problemas que existan y sean verificables en los datos
2. EVIDENCIA PRIMERO - Si no hay evidencia concreta (count > 0, nombres específicos), NO generes finding
3. COMANDOS RELEVANTES - Cada comando PowerShell debe estar directamente relacionado con el problema específico
4. CALIDAD SOBRE CANTIDAD - Mejor 3 findings de alta calidad que 10 mediocres
5. TODO EN ESPAÑOL - Excepto nombres de comandos técnicos

PROCESO DE VALIDACIÓN ANTES DE REPORTAR:
✓ ¿Los datos muestran el problema claramente?
✓ ¿El count es > 0 con objetos reales identificados?
✓ ¿Los comandos PowerShell son específicos y ejecutables?
✓ ¿La severidad está justificada por el impacto real?
✓ ¿El finding ayuda al administrador a mejorar la seguridad?

Si cualquier respuesta es NO, descarta el finding.

FORMATO DE SALIDA JSON OBLIGATORIO:
Cada finding DEBE incluir estos campos para personal de TI:

{
  "findings": [
    {
      "title": "Título específico con número de afectados",
      "severity": "critical|high|medium|low",
      "description": "Descripción técnica detallada",
      "recommendation": "Pasos de remediación ejecutables",
      "mitre_attack": "T1558.003 - Kerberoasting | T1078 - Valid Accounts | etc",
      "cis_control": "5.2.1 - Ensure password expiration | CIS Control específico",
      "impact_business": "Impacto financiero, regulatorio, reputacional específico",
      "remediation_commands": "Comandos PowerShell copy-paste ready con nombres reales de objetos",
      "prerequisites": "Requisitos antes de remediar (backups, testing, coordinación)",
      "operational_impact": "Impacto en producción (reinicio servicios, usuarios afectados, downtime)",
      "microsoft_docs": "https://learn.microsoft.com/... URLs oficiales de Microsoft Docs",
      "current_vs_recommended": "Valor Actual: X | Recomendado: Y según CIS/NIST",
      "timeline": "24h - Inmediato | 7d | 30d | 60d | 90d",
      "affected_count": 15,
      "evidence": {
        "affected_objects": ["user1", "user2"],
        "count": 15,
        "details": "Detalles técnicos específicos"
      }
    }
  ]
}

EJEMPLOS DE CAMPOS TÉCNICOS:

mitre_attack: "T1558.003 - Kerberoasting: Permite extracción de TGS y crackeo offline de contraseñas"

remediation_commands: 
"# Listar usuarios afectados
Get-ADUser -Filter {ServicePrincipalName -like '*'} -Properties ServicePrincipalName, PasswordLastSet | Format-Table Name, PasswordLastSet

# Remediar (opción 1): Migrar a gMSA
New-ADServiceAccount -Name svc_app_gMSA -DNSHostName app.domain.com -PrincipalsAllowedToRetrieveManagedPassword 'APP_SERVERS$'

# Remediar (opción 2): Passwords complejas > 25 caracteres
Set-ADAccountPassword -Identity 'svc_app' -Reset -NewPassword (ConvertTo-SecureString -AsPlainText 'ComplexP@ssw0rd!25Chars+' -Force)

# Verificación
Get-ADServiceAccount -Identity svc_app_gMSA -Properties * | Select Name, Enabled, PrincipalsAllowedToRetrieveManagedPassword"

prerequisites: "✓ Backup de AD antes de cambios | ✓ Validar compatibilidad de aplicaciones con gMSA (Windows Server 2012+) | ✓ Coordinar con equipos de aplicaciones | ✓ Ventana de mantenimiento programada"

operational_impact: "⚠️ MEDIO: Requiere reiniciar servicios que usan la cuenta. Coordinar con equipos de aplicaciones. Downtime estimado: 5-15 minutos por servicio. No afecta usuarios finales si se ejecuta fuera de horario laboral."

microsoft_docs: "https://learn.microsoft.com/en-us/windows-server/security/group-managed-service-accounts/group-managed-service-accounts-overview | https://learn.microsoft.com/en-us/powershell/module/activedirectory/new-adserviceaccount"

current_vs_recommended: "Actual: 8 cuentas de servicio con SPN usando contraseñas estándar (<15 caracteres), PasswordLastSet promedio: 18 meses | Recomendado: Migrar a gMSA o contraseñas >25 caracteres aleatorios, rotación automática cada 30 días (CIS Benchmark 5.2.3)"

timeline: "60d - Migración gradual por aplicación, testing en QA primero"`
          },
          { role: 'user', content: prompt.substring(0, MAX_PROMPT) }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'security_findings',
            strict: false,
            schema: {
              type: 'object',
              properties: {
                findings: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      severity: {
                        type: 'string',
                        enum: ['critical', 'high', 'medium', 'low']
                      },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      recommendation: { type: 'string' },
                      mitre_attack: { type: 'string' },
                      cis_control: { type: 'string' },
                      impact_business: { type: 'string' },
                      remediation_commands: { type: 'string' },
                      prerequisites: { type: 'string' },
                      operational_impact: { type: 'string' },
                      microsoft_docs: { type: 'string' },
                      current_vs_recommended: { type: 'string' },
                      timeline: { type: 'string' },
                      affected_count: { type: 'number' },
                      evidence: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                          affected_objects: { type: 'array', items: { type: 'string' } },
                          count: { type: 'number' },
                          details: { type: 'string' }
                        },
                        required: ['affected_objects', 'count', 'details']
                      }
                    },
                    required: ['severity', 'title', 'description', 'recommendation', 'evidence'],
                    additionalProperties: false
                  }
                }
              },
              required: ['findings'],
              additionalProperties: false
            }
          }
        }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[${timestamp()}] [OpenAI] API error: ${res.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    console.log(`[${timestamp()}] [OpenAI] Response received:`, JSON.stringify(result).substring(0, 500));

    const content = result.choices?.[0]?.message?.content;

    if (content) {
      const parsed = JSON.parse(content);
      console.log(`[${timestamp()}] [OpenAI] Parsed ${parsed.findings?.length || 0} findings`);
      return parsed.findings || [];
    }

    console.log(`[${timestamp()}] [OpenAI] No content in response`);
    return [];
  } catch (e) {
    console.error(`[${timestamp()}] [OpenAI] Call failed:`, e.message);
    console.error(`[${timestamp()}] [OpenAI] Stack:`, e.stack);
    throw e;
  }
}

async function callGemini(prompt, model, key) {
  const systemPrompt = `Eres un analista senior de seguridad de Active Directory con certificaciones CISSP, OSCP y experiencia en auditorías de cumplimiento.

PRINCIPIOS FUNDAMENTALES:
1. CERO TOLERANCIA A FALSOS POSITIVOS - Solo reporta problemas que existan y sean verificables en los datos
2. EVIDENCIA PRIMERO - Si no hay evidencia concreta (count > 0, nombres específicos), NO generes finding
3. COMANDOS RELEVANTES - Cada comando PowerShell debe estar directamente relacionado con el problema específico
4. CALIDAD SOBRE CANTIDAD - Mejor 3 findings de alta calidad que 10 mediocres
5. TODO EN ESPAÑOL - Excepto nombres de comandos técnicos

FORMATO JSON REQUERIDO: Devuelve un objeto JSON con array "findings" que contenga objetos con: severity, title, description, recommendation, evidence (con affected_objects, count, details), y opcionalmente: mitre_attack, cis_control, impact_business, remediation_commands, prerequisites, operational_impact, microsoft_docs, current_vs_recommended, timeline, affected_count`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: systemPrompt + '\n\n' + prompt.substring(0, MAX_PROMPT) }]
      }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[${timestamp()}] [Gemini] API error: ${res.status} - ${errorText}`);
    throw new Error(`Gemini API error: ${res.status} - ${errorText}`);
  }

  const result = await res.json();
  console.log(`[${timestamp()}] [Gemini] Response received:`, JSON.stringify(result).substring(0, 500));

  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (content) {
    const parsed = JSON.parse(content);
    console.log(`[${timestamp()}] [Gemini] Parsed ${parsed.findings?.length || 0} findings`);
    return parsed.findings || [];
  }

  console.log(`[${timestamp()}] [Gemini] No content in response`);
  return [];
}

async function callDeepSeek(prompt, model, key) {
  // DeepSeek usa la misma API que OpenAI
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: `Eres un analista senior de seguridad de Active Directory con certificaciones CISSP, OSCP y experiencia en auditorías de cumplimiento.

PRINCIPIOS FUNDAMENTALES:
1. CERO TOLERANCIA A FALSOS POSITIVOS - Solo reporta problemas que existan y sean verificables en los datos
2. EVIDENCIA PRIMERO - Si no hay evidencia concreta (count > 0, nombres específicos), NO generes finding
3. COMANDOS RELEVANTES - Cada comando PowerShell debe estar directamente relacionado con el problema específico
4. CALIDAD SOBRE CANTIDAD - Mejor 3 findings de alta calidad que 10 mediocres
5. TODO EN ESPAÑOL - Excepto nombres de comandos técnicos

FORMATO JSON REQUERIDO: Devuelve SOLO un objeto JSON válido con este formato:
{
  "findings": [
    {
      "title": "string",
      "severity": "critical|high|medium|low",
      "description": "string",
      "recommendation": "string",
      "evidence": {
        "affected_objects": ["string"],
        "count": number,
        "details": "string"
      },
      "mitre_attack": "string (opcional)",
      "cis_control": "string (opcional)",
      "timeline": "string (opcional)",
      "affected_count": number (opcional)
    }
  ]
}`
        },
        { role: 'user', content: prompt.substring(0, MAX_PROMPT) }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[${timestamp()}] [DeepSeek] API error: ${res.status} - ${errorText}`);
    throw new Error(`DeepSeek API error: ${res.status} - ${errorText}`);
  }

  const result = await res.json();
  console.log(`[${timestamp()}] [DeepSeek] Response received:`, JSON.stringify(result).substring(0, 500));

  const content = result.choices?.[0]?.message?.content;
  if (content) {
    const parsed = JSON.parse(content);
    console.log(`[${timestamp()}] [DeepSeek] Parsed ${parsed.findings?.length || 0} findings`);
    return parsed.findings || [];
  }

  console.log(`[${timestamp()}] [DeepSeek] No content in response`);
  return [];
}

// Main Processing Function
async function processAssessment(assessmentId, jsonData) {
  try {
    await addLog(assessmentId, 'info', '🚀 Starting processing on Self-Hosted VPS');

    // 1. Store Raw Data (compressed)
    const jsonString = JSON.stringify(jsonData);
    const compressed = zlib.gzipSync(jsonString);
    const compressionRatio = Math.round((1 - compressed.length/jsonString.length) * 100);
    console.log(`[${timestamp()}] Compressed ${Math.round(jsonString.length/1024/1024)} MB to ${Math.round(compressed.length/1024/1024)} MB (${compressionRatio}% reduction)`);
    
    await pool.query(
      'INSERT INTO assessment_data (assessment_id, data) VALUES ($1, $2)',
      [assessmentId, compressed]
    );
    await addLog(assessmentId, 'info', `✅ Raw data stored (compressed ${compressionRatio}%)`);

    // 2. Identify Categories
    const availableCategories = [];
    for (const category of CATEGORIES) {
      const data = extractCategoryData(jsonData, category);
      if (data && data.length > 0) {
        availableCategories.push({ id: category, count: data.length, data });
      }
    }

    if (availableCategories.length === 0) {
      throw new Error('No valid categories found');
    }

    // 3. Update Status to Analyzing
    const progressData = availableCategories.reduce((acc, cat) => {
      acc[cat.id] = { status: 'pending', progress: 0, count: cat.count };
      return acc;
    }, {});

    await pool.query(
      'UPDATE assessments SET status = $1, analysis_progress = $2 WHERE id = $3',
      ['analyzing', progressData, assessmentId]
    );

    // 4. Process Categories
    for (const categoryInfo of availableCategories) {
      const { id: category, data } = categoryInfo;

      progressData[category].status = 'processing';
      await pool.query('UPDATE assessments SET analysis_progress = $1 WHERE id = $2', [progressData, assessmentId]);

      await analyzeCategory(assessmentId, category, data);

      progressData[category].status = 'completed';
      progressData[category].progress = 100;
      await pool.query('UPDATE assessments SET analysis_progress = $1 WHERE id = $2', [progressData, assessmentId]);
    }

    // 5. Finish
    await pool.query(
      'UPDATE assessments SET status = $1, completed_at = NOW() WHERE id = $2',
      ['completed', assessmentId]
    );
    await addLog(assessmentId, 'info', '🎉 Analysis completed successfully');

  } catch (error) {
    console.error('Fatal processing error:', error);
    await addLog(assessmentId, 'error', `Fatal error: ${error.message}`);
    await pool.query('UPDATE assessments SET status = $1 WHERE id = $2', ['failed', assessmentId]);
  }
}

// API Endpoint
app.post('/api/process-assessment', async (req, res) => {
  try {
    const { assessmentId, jsonData, domainName } = req.body;

    if (!jsonData) return res.status(400).json({ error: 'Missing jsonData' });

    // Create assessment if ID not provided (or if it doesn't exist)
    let finalAssessmentId = assessmentId;
    if (!finalAssessmentId) {
      const result = await pool.query(
        'INSERT INTO assessments (domain, status) VALUES ($1, $2) RETURNING id',
        [domainName || 'Unknown Domain', 'analyzing']
      );
      finalAssessmentId = result.rows[0].id;
    } else {
      // Check if exists, if not create
      const check = await pool.query('SELECT id FROM assessments WHERE id = $1', [assessmentId]);
      if (check.rows.length === 0) {
        await pool.query(
          'INSERT INTO assessments (id, domain, status) VALUES ($1, $2, $3)',
          [assessmentId, domainName || 'Unknown Domain', 'analyzing']
        );
      }
    }

    // Start processing in background
    processAssessment(finalAssessmentId, jsonData).catch(err => console.error('Background error:', err));

    res.json({ success: true, assessmentId: finalAssessmentId, message: 'Processing started' });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', db: e.message });
  }
});

// GET /api/config/ai - Get AI configuration
app.get('/api/config/ai', async (req, res) => {
  try {
    const provider = (await getConfig('ai_provider')) || 'openai';
    const model = (await getConfig('ai_model')) || 'gpt-4o-mini';
    const hasOpenAIKey = !!(await getConfig('openai_api_key') || process.env.OPENAI_API_KEY);
    const hasGeminiKey = !!await getConfig('gemini_api_key');
    const hasDeepSeekKey = !!await getConfig('deepseek_api_key');
    
    res.json({
      provider,
      model,
      available_providers: {
        openai: hasOpenAIKey,
        gemini: hasGeminiKey,
        deepseek: hasDeepSeekKey
      },
      models: {
        openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
        gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        deepseek: ['deepseek-chat', 'deepseek-coder']
      }
    });
  } catch (error) {
    console.error('Error fetching AI config:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/config/ai - Update AI configuration
app.post('/api/config/ai', async (req, res) => {
  try {
    const { provider, model, api_keys } = req.body;
    
    if (provider) {
      await setConfig('ai_provider', provider);
    }
    
    if (model) {
      await setConfig('ai_model', model);
    }
    
    if (api_keys) {
      if (api_keys.openai) await setConfig('openai_api_key', api_keys.openai);
      if (api_keys.gemini) await setConfig('gemini_api_key', api_keys.gemini);
      if (api_keys.deepseek) await setConfig('deepseek_api_key', api_keys.deepseek);
    }
    
    res.json({ success: true, message: 'AI configuration updated' });
  } catch (error) {
    console.error('Error updating AI config:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assessments - Create a new assessment
app.post('/api/assessments', async (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO assessments (domain, status) VALUES ($1, $2) RETURNING *',
      [domain, 'pending']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assessments - List all assessments
app.get('/api/assessments', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM assessments ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching assessments:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assessments/:id - Get single assessment
app.get('/api/assessments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM assessments WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assessments/:id/findings - Get findings for an assessment
app.get('/api/assessments/:id/findings', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM findings WHERE assessment_id = $1 ORDER BY CASE severity WHEN \'critical\' THEN 1 WHEN \'high\' THEN 2 WHEN \'medium\' THEN 3 WHEN \'low\' THEN 4 ELSE 5 END',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching findings:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assessments/:id/logs - Get logs for an assessment
app.get('/api/assessments/:id/logs', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM assessment_logs WHERE assessment_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assessments/:id/data - Get raw data for an assessment
app.get('/api/assessments/:id/data', async (req, res) => {
  const { id } = req.params;
  console.log(`[${timestamp()}] [API] Fetching raw data for assessment ${id}`);
  try {
    const result = await pool.query(
      'SELECT data FROM assessment_data WHERE assessment_id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      console.log(`[${timestamp()}] [API] No raw data found for assessment ${id}`);
      return res.status(404).json({ error: 'Assessment data not found' });
    }

    // Decompress data in streaming mode to reduce memory usage
    const compressedData = result.rows[0].data;
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Encoding', 'gzip');
    
    // Send compressed data directly, let browser decompress
    console.log(`[${timestamp()}] [API] Sending compressed raw data for assessment ${id} (${Math.round(compressedData.length/1024/1024)} MB)`);
    res.send(compressedData);
  } catch (error) {
    console.error(`[${timestamp()}] [API] Error fetching assessment data:`, error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/assessments/:id - Delete an assessment
app.delete('/api/assessments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Cascading delete should handle related data if configured, 
    // but let's be safe and delete related data first if needed.
    // Our schema uses ON DELETE CASCADE so deleting assessment is enough.

    const result = await pool.query(
      'DELETE FROM assessments WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    console.error('Error deleting assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assessments/:id/reset - Reset an assessment
app.post('/api/assessments/:id/reset', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete findings
    await pool.query('DELETE FROM findings WHERE assessment_id = $1', [id]);

    // Reset assessment status
    const result = await pool.query(
      `UPDATE assessments 
       SET status = 'pending', 
           analysis_progress = '{"total": 0, "current": null, "completed": 0, "categories": []}',
           completed_at = NULL,
           updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error resetting assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/upload-large-file - Handle large file uploads (.json or .zip)
const upload = multer({ 
  dest: '/tmp/uploads/',
  limits: { 
    fileSize: 5 * 1024 * 1024 * 1024 // 5GB max file size
  }
});

app.post('/api/upload-large-file', upload.single('file'), async (req, res) => {
  const { assessmentId } = req.body;
  const filePath = req.file?.path;

  if (!assessmentId || !filePath) {
    return res.status(400).json({ error: 'Missing assessmentId or file' });
  }

  try {
    console.log(`[${timestamp()}] [UPLOAD] Processing file: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
    await addLog(assessmentId, 'info', `Archivo recibido: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    let jsonData;
    const isZip = req.file.originalname.endsWith('.zip');

    if (isZip) {
      // Decompress ZIP file
      await addLog(assessmentId, 'info', 'Descomprimiendo archivo ZIP...');
      console.log(`[${timestamp()}] [UPLOAD] Decompressing ZIP file...`);
      
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries();
      
      // Find the JSON file inside ZIP
      const jsonEntry = entries.find(e => e.entryName.endsWith('.json') && !e.isDirectory);
      
      if (!jsonEntry) {
        await addLog(assessmentId, 'error', 'No se encontró archivo JSON dentro del ZIP');
        return res.status(400).json({ error: 'No JSON file found in ZIP' });
      }

      console.log(`[${timestamp()}] [UPLOAD] Found JSON entry: ${jsonEntry.entryName}`);
      let jsonContent = zip.readAsText(jsonEntry);
      
      // Remove BOM (Byte Order Mark) if present
      if (jsonContent.charCodeAt(0) === 0xFEFF) {
        console.log(`[${timestamp()}] [UPLOAD] Removing BOM from JSON content`);
        jsonContent = jsonContent.substring(1);
      }
      
      jsonData = JSON.parse(jsonContent);
      
      await addLog(assessmentId, 'info', `Archivo descomprimido: ${jsonEntry.entryName}`);
    } else {
      // Read JSON directly
      console.log(`[${timestamp()}] [UPLOAD] Reading JSON file...`);
      let jsonContent = fs.readFileSync(filePath, 'utf8');
      
      // Remove BOM (Byte Order Mark) if present
      if (jsonContent.charCodeAt(0) === 0xFEFF) {
        console.log(`[${timestamp()}] [UPLOAD] Removing BOM from JSON content`);
        jsonContent = jsonContent.substring(1);
      }
      
      jsonData = JSON.parse(jsonContent);
    }

    console.log(`[${timestamp()}] [UPLOAD] JSON parsed successfully`);
    await addLog(assessmentId, 'info', 'Datos JSON procesados correctamente');

    // Compress JSON before storing
    const jsonString = JSON.stringify(jsonData);
    const compressed = zlib.gzipSync(jsonString);
    const compressionRatio = Math.round((1 - compressed.length/jsonString.length) * 100);
    console.log(`[${timestamp()}] [UPLOAD] Compressed ${Math.round(jsonString.length/1024/1024)} MB to ${Math.round(compressed.length/1024/1024)} MB (${compressionRatio}% reduction)`);
    console.log(`[${timestamp()}] [UPLOAD] Compressed data type: ${typeof compressed}, isBuffer: ${Buffer.isBuffer(compressed)}`);
    await addLog(assessmentId, 'info', `Comprimiendo datos (${compressionRatio}% reducción)...`);

    // Store compressed data in assessment_data table (Buffer is automatically converted to bytea by pg driver)
    await addLog(assessmentId, 'info', 'Guardando datos comprimidos en la base de datos...');
    await pool.query(
      'INSERT INTO assessment_data (assessment_id, data) VALUES ($1, $2) ON CONFLICT (assessment_id) DO UPDATE SET data = $2',
      [assessmentId, compressed]
    );

    // Update assessment status
    await pool.query(
      'UPDATE assessments SET status = $1, updated_at = NOW() WHERE id = $2',
      ['uploaded', assessmentId]
    );

    console.log(`[${timestamp()}] [UPLOAD] Data stored in database`);
    await addLog(assessmentId, 'info', 'Datos guardados. Iniciando análisis...');

    // Start analysis process (async, don't wait)
    processAssessmentData(assessmentId, jsonData).catch(err => {
      console.error(`[${timestamp()}] [UPLOAD] Background analysis error:`, err);
      addLog(assessmentId, 'error', `Error en análisis: ${err.message}`);
    });

    // Return success immediately
    res.json({
      success: true,
      message: 'Archivo procesado correctamente',
      status: 'analyzing',
      fileType: isZip ? 'zip' : 'json',
      originalSize: req.file.size
    });

  } catch (error) {
    console.error(`[${timestamp()}] [UPLOAD] Error processing file:`, error);
    await addLog(assessmentId, 'error', `Error procesando archivo: ${error.message}`);
    
    res.status(500).json({ 
      error: 'Error processing file', 
      details: error.message 
    });
  } finally {
    // Clean up temporary file
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`[${timestamp()}] [UPLOAD] Temporary file deleted: ${filePath}`);
      } catch (cleanupError) {
        console.error(`[${timestamp()}] [UPLOAD] Error deleting temp file:`, cleanupError);
      }
    }
  }
});

// Helper function to process assessment data
async function processAssessmentData(assessmentId, jsonData) {
  try {
    console.log(`[${timestamp()}] [PROCESS] Starting analysis for assessment ${assessmentId}`);
    await addLog(assessmentId, 'info', 'Iniciando análisis de categorías...');

    // Update assessment status
    await pool.query(
      'UPDATE assessments SET status = $1, analysis_progress = $2, updated_at = NOW() WHERE id = $3',
      ['analyzing', JSON.stringify({ total: CATEGORIES.length, completed: 0, current: null }), assessmentId]
    );

    let completedCategories = 0;

    // Process each category
    for (const category of CATEGORIES) {
      try {
        await addLog(assessmentId, 'info', `Analizando categoría: ${category}`, category);
        
        const categoryData = extractCategoryData(jsonData, category);
        
        if (!categoryData || categoryData.length === 0) {
          await addLog(assessmentId, 'info', `Categoría ${category} sin datos, omitiendo`, category);
          completedCategories++;
          continue;
        }

        await addLog(assessmentId, 'info', `Procesando ${categoryData.length} elementos de ${category}`, category);
        
        // Analyze with AI
        const findings = await analyzeCategory(assessmentId, category, categoryData);
        
        if (findings && findings.length > 0) {
          await addLog(assessmentId, 'info', `${findings.length} hallazgos encontrados en ${category}`, category);
        } else {
          await addLog(assessmentId, 'info', `No se encontraron hallazgos en ${category}`, category);
        }

        completedCategories++;

        // Update progress
        await pool.query(
          'UPDATE assessments SET analysis_progress = $1, updated_at = NOW() WHERE id = $2',
          [JSON.stringify({ total: CATEGORIES.length, completed: completedCategories, current: category }), assessmentId]
        );

      } catch (categoryError) {
        console.error(`[${timestamp()}] [PROCESS] Error analyzing ${category}:`, categoryError);
        await addLog(assessmentId, 'error', `Error en categoría ${category}: ${categoryError.message}`, category);
      }
    }

    // Mark as completed
    await pool.query(
      'UPDATE assessments SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['completed', assessmentId]
    );

    await addLog(assessmentId, 'info', 'Análisis completado exitosamente');
    console.log(`[${timestamp()}] [PROCESS] Analysis completed for assessment ${assessmentId}`);

  } catch (error) {
    console.error(`[${timestamp()}] [PROCESS] Fatal error processing assessment:`, error);
    await addLog(assessmentId, 'error', `Error crítico: ${error.message}`);
    await pool.query(
      'UPDATE assessments SET status = $1, updated_at = NOW() WHERE id = $2',
      ['failed', assessmentId]
    );
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Self-hosted backend listening on port ${PORT}`);
});
