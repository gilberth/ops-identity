import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Ensure node-fetch is available or use global fetch in Node 18+
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';
import { fileURLToPath } from 'url';
import { analyzeUsersDeterministic } from './analyzers/userRules.js';
import { WebAuthentikSetup } from './authentik-setup.js';
import { CopilotClient, COPILOT_MODELS } from './copilot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database Configuration
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/postgres',
});

// Automatic Database Initialization
async function initializeDatabase() {
  try {
    const initSqlPath = path.join(__dirname, 'init.sql');
    if (fs.existsSync(initSqlPath)) {
      const initSql = fs.readFileSync(initSqlPath, 'utf8');
      console.log('🔄 Initializing database schema...');
      await pool.query(initSql);
      console.log('✅ Database schema initialized successfully');
    } else {
      console.warn('⚠️ init.sql not found, skipping schema initialization');
    }
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    // Optional: exit process or let it continue depending on criticality
  }
}

// Run initialization on startup
initializeDatabase();


// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.text({ limit: '500mb' }));

// Constants
const CATEGORIES = [
  'Users', 'GPOs', 'Computers', 'OUs', 'Groups', 'Domains',
  'Containers', 'ACLs', 'CertServices', 'Meta', 'DCHealth', 'DNS', 'DHCP', 'Security', 'Kerberos', 'Sites',
  'FSMORolesHealth', 'ReplicationStatus', 'ReplicationHealthAllDCs', 'LingeringObjectsRisk', 'TrustHealth', 'OrphanedTrusts',
  'DNSRootHints', 'DNSConflicts', 'DNSScavengingDetailed', 'DHCPRogueServers', 'DHCPOptionsAudit',
  'PasswordPolicies'
];

const MAX_PROMPT = 8000;
const CHUNK_SIZE = 50;
const MAX_PARALLEL_CHUNKS = 3;

// =============================================================================
// v1.8.0: ANTHROPIC MODEL SELECTION - Claude 4.5 (Opus & Sonnet)
// Dynamic model selection based on category complexity
// =============================================================================
const ANTHROPIC_MODELS = {
  OPUS: 'claude-opus-4-5-20251101',    // Released Nov 2025 - Premium model
  SONNET: 'claude-sonnet-4-5-20250929'  // Released Sep 2025 - Best balance
};

// Categories that require deeper analysis → Use Opus 4.5
// These involve complex security implications, privilege escalation paths, or critical infrastructure
const OPUS_CATEGORIES = new Set([
  'Kerberos',       // Golden Ticket, delegation, encryption analysis
  'Security',       // NTLM, SMB, LDAP signing, critical configs
  'ACLs',           // Complex permission analysis, privilege escalation paths
  'TrustHealth',    // Inter-domain trust relationships, SID filtering
  'CertServices',   // PKI vulnerabilities (ESC1-ESC8), template analysis
  'FSMORolesHealth' // Critical FSMO roles, domain operation health
]);

/**
 * Select the appropriate Claude model based on category complexity
 * @param {string} category - The AD category being analyzed
 * @param {boolean} forceOpus - Override to always use Opus (for deep analysis requests)
 * @returns {string} - The model ID to use
 */
function selectAnthropicModel(category, forceOpus = false) {
  if (forceOpus) {
    console.log(`[${timestamp()}] [ModelSelect] Forced Opus 4.5 for ${category}`);
    return ANTHROPIC_MODELS.OPUS;
  }

  if (OPUS_CATEGORIES.has(category)) {
    console.log(`[${timestamp()}] [ModelSelect] Using Opus 4.5 for complex category: ${category}`);
    return ANTHROPIC_MODELS.OPUS;
  }

  console.log(`[${timestamp()}] [ModelSelect] Using Sonnet 4.5 for category: ${category}`);
  return ANTHROPIC_MODELS.SONNET;
}

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

// Helper: Chunk array
function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

// Helper: Get system configuration
// Helper: Get system configuration with Env Fallback
async function getConfig(key) {
  try {
    const result = await pool.query('SELECT value FROM system_config WHERE key = $1', [key]);
    if (result.rows[0]?.value) return result.rows[0].value;
  } catch (error) {
    // console.error(`[${timestamp()}] Error getting config ${key}:`, error.message);
  }

  // Fallback to Environment Variables
  const envKey = key.toUpperCase();
  return process.env[envKey] || null;
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

// =============================================================================
// v2.0.0: GITHUB COPILOT INTEGRATION
// Allows using GitHub Copilot subscription for AI analysis
// =============================================================================
const copilotClient = new CopilotClient(getConfig, setConfig);

// Helper: Extract Category Data
// v1.8.1: Added alias mapping for common category name variations
const CATEGORY_ALIASES = {
  'sites': ['sitetopology', 'adtopology', 'topology'],
  'replicationstatus': ['replicationhealthalldcs', 'replication', 'adreplication'],
};

function extractCategoryData(jsonData, categoryName) {
  // First try exact match (case-insensitive)
  let categoryKey = Object.keys(jsonData).find(key =>
    key.toLowerCase() === categoryName.toLowerCase()
  );

  // If not found, try aliases
  if (!categoryKey) {
    const aliases = CATEGORY_ALIASES[categoryName.toLowerCase()] || [];
    for (const alias of aliases) {
      categoryKey = Object.keys(jsonData).find(key =>
        key.toLowerCase() === alias.toLowerCase()
      );
      if (categoryKey) {
        console.log(`[extractCategoryData] Using alias '${categoryKey}' for category '${categoryName}'`);
        break;
      }
    }
  }

  if (!categoryKey || !jsonData[categoryKey]) return null;

  const categoryData = jsonData[categoryKey];
  let result = [];

  // FIX v1.7.0: Validación robusta de categoryData.Data
  if (categoryData.Data !== undefined && categoryData.Data !== null) {
    // Validar que Data no sea null, undefined, o empty string
    if (Array.isArray(categoryData.Data)) {
      // Filtrar elementos null/undefined del array
      result = categoryData.Data.filter(item => item !== null && item !== undefined);
    } else if (typeof categoryData.Data === 'object' && Object.keys(categoryData.Data).length > 0) {
      result = [categoryData.Data];
    } else if (categoryData.Data === '' || (typeof categoryData.Data === 'object' && Object.keys(categoryData.Data).length === 0)) {
      // Empty string or empty object - return empty array (not null to allow filtering)
      console.log(`[extractCategoryData] Warning: ${categoryName}.Data is empty, skipping`);
      result = [];
    } else {
      // Primitive non-empty value, wrap in array
      result = [categoryData.Data];
    }
  } else if (Array.isArray(categoryData)) {
    // Direct array format: { CategoryName: [...] }
    result = categoryData.filter(item => item !== null && item !== undefined);
  } else if (typeof categoryData === 'object' && Object.keys(categoryData).length > 0) {
    // Single object format: { CategoryName: { prop: value } }
    result = [categoryData];
  } else {
    // Invalid or empty data
    console.log(`[extractCategoryData] Warning: ${categoryName} has no valid data structure`);
    return null;
  }

  // Final validation: ensure we don't return array with only invalid items
  if (result.length === 0) {
    console.log(`[extractCategoryData] ${categoryName}: No valid items after filtering`);
  }

  // Smart Filtering to reduce AI hallucinations and token usage
  // v1.7.0: Added detailed logging for filter transparency
  if (categoryName.toLowerCase() === 'users' && result.length > 0) {
    const originalCount = result.length;
    const filterStats = {
      disabled: 0, passwordNeverExpires: 0, passwordNotRequired: 0,
      delegation: 0, privileged: 0, adminCount: 0,
      asrepRoastable: 0, kerberoastable: 0
    };

    result = result.filter(user => {
      if (!user) return false;

      // Track each risk flag
      if (user.Enabled === false) filterStats.disabled++;
      if (user.PasswordNeverExpires === true) filterStats.passwordNeverExpires++;
      if (user.PasswordNotRequired === true) filterStats.passwordNotRequired++;
      if (user.TrustedForDelegation === true) filterStats.delegation++;
      if (user.IsPrivileged === true) filterStats.privileged++;
      if (user.AdminCount === 1) filterStats.adminCount++;
      if (user.DoNotRequirePreAuth === true || user.IsASREPRoastable === true) filterStats.asrepRoastable++;
      if (user.IsKerberoastable === true) filterStats.kerberoastable++;

      // Keep if any risk/relevant flag is present
      return (
        user.Enabled === false ||
        user.PasswordNeverExpires === true ||
        user.PasswordNotRequired === true ||
        user.TrustedForDelegation === true ||
        user.IsPrivileged === true ||
        user.AdminCount === 1 ||
        user.DoNotRequirePreAuth === true ||
        user.IsASREPRoastable === true ||
        user.IsKerberoastable === true
      );
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Users' category reduced from ${originalCount} to ${result.length} items (keeping only high-risk objects)`);
      console.log(`[SmartFilter] Users breakdown: disabled=${filterStats.disabled}, pwdNeverExp=${filterStats.passwordNeverExpires}, pwdNotReq=${filterStats.passwordNotRequired}, delegation=${filterStats.delegation}, privileged=${filterStats.privileged}, adminCount=${filterStats.adminCount}, asrep=${filterStats.asrepRoastable}, kerberoast=${filterStats.kerberoastable}`);
    }
  }

  // Smart Filtering for Computers
  // FIX v1.7.0: Added Windows Server 2012/2012 R2 (EOL October 2023) to legacy list + detailed logging
  if (categoryName.toLowerCase() === 'computers' && result.length > 0) {
    const originalCount = result.length;
    const filterStats = { stale: 0, delegation: 0, disabled: 0, legacyOS: 0, noLAPS: 0, weakEncryption: 0 };

    result = result.filter(computer => {
      if (!computer) return false;

      const os = (computer.OperatingSystem || '').toLowerCase();
      // Legacy OS detection - includes all EOL Windows versions
      const isLegacy = os.includes('2012') || os.includes('2008') || os.includes('2003') ||
                       os.includes('2000') || os.includes('xp') || os.includes('vista') ||
                       os.includes('windows 7') || os.includes('windows 8');

      // Track each risk flag
      if (computer.IsStale === true) filterStats.stale++;
      if (computer.TrustedForDelegation === true) filterStats.delegation++;
      if (computer.Enabled === false) filterStats.disabled++;
      if (isLegacy) filterStats.legacyOS++;
      if (computer.LAPSEnabled === false && os.includes('server')) filterStats.noLAPS++;
      if (computer.SupportedEncryptionTypes?.includes('RC4')) filterStats.weakEncryption++;

      return (
        computer.IsStale === true ||
        computer.TrustedForDelegation === true ||
        computer.Enabled === false ||
        isLegacy ||
        (computer.LAPSEnabled === false && os.includes('server')) ||
        (computer.SupportedEncryptionTypes && computer.SupportedEncryptionTypes.includes('RC4'))
      );
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Computers' category reduced from ${originalCount} to ${result.length} items`);
      console.log(`[SmartFilter] Computers breakdown: stale=${filterStats.stale}, delegation=${filterStats.delegation}, disabled=${filterStats.disabled}, legacyOS=${filterStats.legacyOS}, noLAPS=${filterStats.noLAPS}, weakEncryption=${filterStats.weakEncryption}`);
    }
  }

  // Smart Filtering for Groups (Focus on Privileged or Empty)
  // v1.7.0: Fixed redundant logic and added detailed logging
  if (categoryName.toLowerCase() === 'groups' && result.length > 0) {
    const originalCount = result.length;
    const filterStats = { privileged: 0, empty: 0, excessiveMembers: 0 };

    result = result.filter(group => {
      if (!group) return false;

      // Check if privileged (Tier 0/1 administrative groups)
      const isPrivileged = group.IsPrivileged === true;
      if (isPrivileged) filterStats.privileged++;

      // v1.7.0: Fixed - Use single source of truth for empty check
      // Prefer MemberCount if available, fallback to Members array
      const memberCount = group.MemberCount !== undefined
        ? group.MemberCount
        : (group.Members ? group.Members.length : undefined);
      const isEmpty = memberCount === 0;
      if (isEmpty) filterStats.empty++;

      // NEW v1.7.0: Groups with excessive members (potential over-permissioning)
      const hasExcessiveMembers = memberCount !== undefined && memberCount > 50;
      if (hasExcessiveMembers) filterStats.excessiveMembers++;

      return isPrivileged || isEmpty || hasExcessiveMembers;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Groups' category reduced from ${originalCount} to ${result.length} items`);
      console.log(`[SmartFilter] Groups breakdown: privileged=${filterStats.privileged}, empty=${filterStats.empty}, excessiveMembers=${filterStats.excessiveMembers}`);
    }
  }

  // =============================================================================
  // SMART FILTERING v1.6.0 - Based on Industry Standards (CIS, PingCastle, Microsoft)
  // =============================================================================

  // Smart Filtering for GPOs (Focus on Problematic GPOs)
  // Source: CIS Benchmark, PingCastle, Microsoft Best Practices
  if (categoryName.toLowerCase() === 'gpos' && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(gpo => {
      // Threshold: CIS recommends keeping GPOs focused and small
      const settingsCount = gpo.SettingsCount || gpo.TotalSettings || 0;
      const hasNoLinks = !gpo.Links || gpo.Links.length === 0 || gpo.LinksTo?.length === 0;
      const isDisabled = gpo.GpoStatus === 'AllSettingsDisabled' || gpo.GpoStatus === 'UserSettingsDisabled' || gpo.GpoStatus === 'ComputerSettingsDisabled';
      const hasVersionMismatch = gpo.UserVersionDS !== gpo.UserVersionSysvol || gpo.ComputerVersionDS !== gpo.ComputerVersionSysvol;
      // CIS: GPOs should be small and focused, >30 settings indicates sprawl
      const isMonolithic = settingsCount > 30;
      // PingCastle: Check for non-admin users with GPO edit permissions
      const hasDangerousPermissions = gpo.Permissions?.some(p =>
        p.Permission === 'GpoEditDeleteModifySecurity' &&
        !['Domain Admins', 'Enterprise Admins', 'Admins. del dominio', 'Administradores de empresas', 'SYSTEM'].includes(p.Trustee)
      );
      // NEW: GPO has WMI filter (complexity indicator)
      const hasWMIFilter = gpo.WmiFilter && gpo.WmiFilter !== '';
      // NEW: GPO modified recently but not linked (potential test GPO left behind)
      const isRecentlyModified = gpo.ModificationTime && (Date.now() - new Date(gpo.ModificationTime).getTime()) < 30 * 24 * 60 * 60 * 1000;
      const isOrphanedRecent = hasNoLinks && isRecentlyModified;

      return (
        hasNoLinks || // GPOs huérfanas (PingCastle rule)
        isDisabled || // GPOs deshabilitadas
        hasVersionMismatch || // Problemas de replicación SYSVOL
        isMonolithic || // GPOs monolíticas (CIS)
        hasDangerousPermissions || // Permisos peligrosos (PingCastle)
        isOrphanedRecent // Recently created but not linked
      );
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'GPOs' category reduced from ${originalCount} to ${result.length} items (keeping only problematic GPOs)`);
    }
  }

  // Smart Filtering for DNS (Focus on Issues)
  // Source: Microsoft DNS Best Practices, CIS
  // FIX v1.7.0: Iterate ALL items, not just check result[0]
  if (categoryName.toLowerCase() === 'dns' && result.length > 0) {
    // Check if ANY item in the array has the expected DNS structure
    const hasDNSStructure = result.some(item =>
      item && (item.SecurityIssues !== undefined || item.ScavengingEnabled !== undefined ||
               item.DynamicUpdate !== undefined || item.Forwarders !== undefined || item.ZoneTransfer !== undefined)
    );

    if (hasDNSStructure) {
      const originalCount = result.length;
      result = result.filter(item => {
        if (!item) return false;
        return (
          (item.SecurityIssues && Array.isArray(item.SecurityIssues) && item.SecurityIssues.length > 0) ||
          item.ScavengingEnabled === false || // CIS: Scavenging should be enabled
          item.DynamicUpdate === 'NonsecureAndSecure' || // Microsoft: Insecure dynamic updates
          item.DynamicUpdate === 'Nonsecure' ||
          // Public DNS forwarders without conditional
          (item.Forwarders && Array.isArray(item.Forwarders) && item.Forwarders.some(f =>
            typeof f === 'string' && (f.includes('8.8.8.8') || f.includes('1.1.1.1'))
          )) ||
          // Zone transfer to any
          item.ZoneTransfer === 'Any' ||
          // NEW v1.7.0: Aging/Scavenging not configured properly
          (item.AgingEnabled === false && item.ZoneType === 'Primary') ||
          // NEW v1.7.0: Stale DNS records threshold exceeded
          (item.StaleRecordCount && item.StaleRecordCount > 100)
        );
      });
      if (originalCount !== result.length) {
        console.log(`[SmartFilter] 'DNS' category reduced from ${originalCount} to ${result.length} items`);
      }
    }
  }

  // NEW: Inject DNS Forwarders configuration to DNS category
  // DNS Forwarders are collected in DNSConfiguration.Forwarders but not extracted by default
  if (categoryName.toLowerCase() === 'dns' && jsonData.DNSConfiguration?.Forwarders) {
    const forwarders = jsonData.DNSConfiguration.Forwarders;
    if (Array.isArray(forwarders) && forwarders.length > 0) {
      // Add forwarders as a special object type to the DNS analysis
      forwarders.forEach(fwd => {
        if (fwd && fwd.Forwarders && fwd.Forwarders.length > 0) {
          result.push({
            Type: 'ForwardersConfig',
            DCName: fwd.DCName,
            Forwarders: fwd.Forwarders,
            ForwardingTimeout: fwd.ForwardingTimeout,
            IsSlave: fwd.IsSlave,
            SecurityWarning: fwd.SecurityWarning || null,
            // Flag for easy identification by LLM
            _isForwarderConfig: true
          });
        }
      });
      console.log(`[extractCategoryData] Added ${forwarders.length} DNS Forwarder configs to DNS category`);
    }
  }

  // Smart Filtering for DCHealth (Focus on Unhealthy DCs)
  // Source: Microsoft TechNet, Quest AD Health
  if (categoryName.toLowerCase() === 'dchealth' && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(dc => {
      const hasErrors = dc.Errors && dc.Errors.length > 0;
      const hasWarnings = dc.Warnings && dc.Warnings.length > 0;
      const isUnhealthy = dc.OverallHealth === 'Critical' || dc.OverallHealth === 'Warning' || dc.Health === 'Unhealthy';
      const hasServiceIssues = dc.ServicesStatus && Object.values(dc.ServicesStatus).some(s => s !== 'Running');
      // Adjusted: 5GB is more critical threshold for DC (SYSVOL needs space)
      const hasLowDiskSpace = dc.FreeDiskSpaceGB && dc.FreeDiskSpaceGB < 5;
      // NEW: DC uptime issues (too short = instability, too long = missing patches)
      const hasUptimeIssue = (dc.UptimeDays && dc.UptimeDays < 1) || (dc.UptimeDays && dc.UptimeDays > 90);
      // NEW: DC running legacy OS (EOL)
      const isLegacyOS = dc.OperatingSystem && (dc.OperatingSystem.includes('2008') || dc.OperatingSystem.includes('2012'));
      // NEW: DC not a Global Catalog in multi-domain
      const notGC = dc.IsGlobalCatalog === false;

      return hasErrors || hasWarnings || isUnhealthy || hasServiceIssues || hasLowDiskSpace || hasUptimeIssue || isLegacyOS || notGC;
    });

    if (result.length === 0 && originalCount > 0) {
      result = [{ Summary: 'All Domain Controllers are healthy', HealthyCount: originalCount }];
    }

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'DCHealth' category reduced from ${originalCount} to ${result.length} items (keeping only unhealthy DCs)`);
    }
  }

  // Smart Filtering for Replication (Focus on Failures)
  // Source: Microsoft TechNet replication best practices
  const replicationCategories = ['replicationhealthalldcs', 'replicationstatus'];
  if (replicationCategories.includes(categoryName.toLowerCase()) && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(rep => {
      const hasFailed = rep.LastReplicationResult !== 0 && rep.LastReplicationResult !== undefined;
      const hasError = rep.Status === 'Failed' || rep.Status === 'Error';
      const isStale = rep.ConsecutiveFailures > 0;
      // Microsoft: Intrasite should replicate within 5 minutes, intersite within schedule
      // Using 60 minutes as universal threshold for "concerning" latency
      const hasHighLatency = rep.LatencyMinutes && rep.LatencyMinutes > 60;
      // NEW: Replication never succeeded
      const neverReplicated = rep.LastReplicationSuccess === null || rep.LastReplicationSuccess === undefined;
      // NEW: USN Rollback detection (critical - Microsoft)
      const hasUSNRollback = rep.USNRollbackDetected === true;

      return hasFailed || hasError || isStale || hasHighLatency || neverReplicated || hasUSNRollback;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Replication' category reduced from ${originalCount} to ${result.length} items (keeping only failures)`);
    }
  }

  // Smart Filtering for Trusts (Focus on Broken/Risky Trusts)
  // Source: Microsoft Trust Security, PingCastle
  const trustCategories = ['trusthealth', 'orphanedtrusts'];
  if (trustCategories.includes(categoryName.toLowerCase()) && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(trust => {
      const isBroken = trust.ValidationStatus !== 'Healthy' && trust.ValidationStatus !== undefined;
      const hasIssues = trust.Issues && trust.Issues.length > 0;
      // Microsoft: SID Filtering prevents SID History injection attacks
      const noSIDFiltering = trust.SIDFilteringEnabled === false || trust.SIDFilteringQuarantined === false;
      const isOrphaned = trust.Status === 'ORPHANED' || trust.Status === 'SUSPICIOUS';
      // Trust password should rotate automatically; >180 days indicates issue
      const oldPassword = trust.PasswordAgeDays && trust.PasswordAgeDays > 180;
      // NEW: Selective Authentication not enabled (PingCastle P-TrustLogin)
      const noSelectiveAuth = trust.SelectiveAuthentication === false && trust.TrustType === 'Forest';
      // NEW: External trust (higher risk than forest trust)
      const isExternalTrust = trust.TrustType === 'External';

      return isBroken || hasIssues || noSIDFiltering || isOrphaned || oldPassword || noSelectiveAuth || isExternalTrust;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Trusts' category reduced from ${originalCount} to ${result.length} items (keeping only problematic trusts)`);
    }
  }

  // Smart Filtering for FSMO Roles (Focus on Issues)
  // Source: Microsoft FSMO Best Practices, PingCastle
  if (categoryName.toLowerCase() === 'fsmoroleshealth' && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(fsmo => {
      const hasIssues = fsmo.Issues && fsmo.Issues.length > 0;
      const isUnhealthy = fsmo.Health !== 'Healthy' && fsmo.Health !== undefined;
      // Single Point of Failure (Quest, Microsoft)
      const allOnSingleDC = fsmo.AllFSMOOnSingleDC === true;
      // PingCastle: PDC should sync with external NTP, not VM host
      const hasVMTimeSync = fsmo.PDCTimeSyncSource && (fsmo.PDCTimeSyncSource.includes('VM IC') || fsmo.PDCTimeSyncSource.includes('Hyper-V') || fsmo.PDCTimeSyncSource.includes('Local CMOS'));
      // Microsoft: RID Pool exhaustion is critical
      const ridPoolLow = fsmo.RIDPoolStatus?.PercentUsed > 80;
      // NEW: FSMO holder is not reachable
      const fsmoUnreachable = fsmo.Reachable === false;
      // NEW: Infrastructure Master on GC in multi-domain (Microsoft KB)
      const infraOnGC = fsmo.InfrastructureMasterOnGC === true && fsmo.IsMultiDomain === true;

      return hasIssues || isUnhealthy || allOnSingleDC || hasVMTimeSync || ridPoolLow || fsmoUnreachable || infraOnGC;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'FSMORolesHealth' category reduced from ${originalCount} to ${result.length} items`);
    }
  }

  // Smart Filtering for Sites (Focus on Topology Issues)
  // Source: PingCastle S-DC-SubnetMissing, Microsoft AD Sites
  if (categoryName.toLowerCase() === 'sites' && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(site => {
      // PingCastle S-DC-SubnetMissing
      const hasNoSubnets = !site.Subnets || site.Subnets.length === 0;
      // DCs should not remain in default site
      const isDefaultSite = site.Name === 'Default-First-Site-Name';
      // Site without DC is orphaned
      const hasNoDC = !site.DomainControllers || site.DomainControllers.length === 0;
      const hasIssues = site.Issues && site.Issues.length > 0;
      // NEW: Site link cost issues (very high cost = suboptimal routing)
      const hasHighCost = site.SiteLinkCost && site.SiteLinkCost > 500;
      // NEW: Manual bridgehead server (potential SPOF)
      const hasManualBridgehead = site.HasManualBridgehead === true;

      return hasNoSubnets || isDefaultSite || hasNoDC || hasIssues || hasHighCost || hasManualBridgehead;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Sites' category reduced from ${originalCount} to ${result.length} items (keeping only problematic sites)`);
    }
  }

  // NEW: Smart Filtering for Kerberos (Focus on Security Issues)
  // Source: MITRE ATT&CK, Microsoft Kerberos Security
  if (categoryName.toLowerCase() === 'kerberos' && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(item => {
      // MITRE: Weak encryption types enable credential theft
      const hasWeakEncryption = item.SupportedETypes?.includes('RC4') || item.SupportedETypes?.includes('DES');
      // CIS: Kerberos delegation issues
      const hasDelegationIssues = item.DelegationIssues && item.DelegationIssues.length > 0;
      // Microsoft: TGT lifetime too long
      const longTGTLifetime = item.MaxTicketAge && item.MaxTicketAge > 10;
      // NEW: Pre-authentication disabled (AS-REP roasting)
      const preAuthDisabled = item.PreAuthNotRequired === true;

      return hasWeakEncryption || hasDelegationIssues || longTGTLifetime || preAuthDisabled;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Kerberos' category reduced from ${originalCount} to ${result.length} items`);
    }
  }

  // NEW: Smart Filtering for Security category
  // Source: CIS Benchmark, Microsoft Security Baseline
  if (categoryName.toLowerCase() === 'security' && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(item => {
      // CIS: Password policy issues
      const weakPasswordPolicy = item.MinPasswordLength && item.MinPasswordLength < 14;
      const noPasswordExpiration = item.MaxPasswordAge === 0;
      // Microsoft: LDAP signing not enforced
      const noLDAPSigning = item.LDAPSigning === 'None' || item.LDAPSigning === false;
      // SMBv1 enabled (CVE-2017-0144 EternalBlue)
      const smbV1Enabled = item.SMBv1Enabled === true;
      // NTLM not restricted
      const ntlmNotRestricted = item.NTLMRestriction === 'None' || item.NTLMRestriction === false;
      // NEW: Audit policy not configured
      const noAuditPolicy = item.AuditPolicyConfigured === false;
      // NEW: LAPS not deployed
      const noLAPS = item.LAPSDeployed === false;
      // NEW: Credential Guard not enabled
      const noCredentialGuard = item.CredentialGuardEnabled === false;

      return weakPasswordPolicy || noPasswordExpiration || noLDAPSigning || smbV1Enabled || ntlmNotRestricted || noAuditPolicy || noLAPS || noCredentialGuard;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'Security' category reduced from ${originalCount} to ${result.length} items`);
    }
  }

  // NEW: Smart Filtering for OUs (Focus on Hygiene Issues)
  if (categoryName.toLowerCase() === 'ous' && result.length > 0) {
    const originalCount = result.length;
    result = result.filter(ou => {
      // Empty OUs (hygiene)
      const isEmpty = ou.ObjectCount === 0 || (ou.ChildCount === 0 && ou.ObjectCount === 0);
      // OU blocking inheritance (shadow IT)
      const blocksInheritance = ou.BlockInheritance === true;
      // OU with no GPO linked (potential orphaned OU)
      const noGPOLinked = !ou.LinkedGPOs || ou.LinkedGPOs.length === 0;
      // Deep nesting (>5 levels creates complexity)
      const deepNesting = ou.NestingLevel && ou.NestingLevel > 5;

      return isEmpty || blocksInheritance || deepNesting;
    });

    if (originalCount !== result.length) {
      console.log(`[SmartFilter] 'OUs' category reduced from ${originalCount} to ${result.length} items`);
    }
  }

  return result;
}

// ------------------------------------------------------------------
// AI ORCHESTRATOR & ANALYZER
// ------------------------------------------------------------------

async function analyzeCategory(assessmentId, category, data, options = {}) {
  try {
    // v1.9.5: Read API keys from database (system_config) with env fallback
    const provider = await getConfig('ai_provider') || process.env.AI_PROVIDER || 'anthropic';

    let apiKey = null;
    // v2.0.0: Copilot provider doesn't need an API key
    if (provider === 'copilot') {
      // Check if Copilot is authenticated
      const copilotStatus = await copilotClient.getAuthStatus();
      if (!copilotStatus.authenticated) {
        throw new Error('GitHub Copilot not authenticated. Please connect with GitHub first.');
      }
      apiKey = 'copilot'; // Placeholder - not actually used
    } else if (provider === 'anthropic') {
      apiKey = await getConfig('anthropic_api_key') || process.env.ANTHROPIC_API_KEY;
    } else if (provider === 'openai') {
      apiKey = await getConfig('openai_api_key') || process.env.OPENAI_API_KEY;
    } else if (provider === 'deepseek') {
      apiKey = await getConfig('deepseek_api_key') || process.env.DEEPSEEK_API_KEY;
    } else if (provider === 'google') {
      apiKey = await getConfig('google_api_key') || process.env.GOOGLE_API_KEY;
    } else {
      apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
    }

    // v2.0.0: Dynamic model selection
    let model;
    if (provider === 'copilot') {
      model = await getConfig('copilot_model') || 'gpt-4o';
      await addLog(assessmentId, 'info', `Usando GitHub Copilot con modelo: ${model}`, category);
    } else if (provider === 'anthropic') {
      const forceOpus = options.deepAnalysis || false;
      model = selectAnthropicModel(category, forceOpus);
      await addLog(assessmentId, 'info', `Modelo seleccionado: ${model.includes('opus') ? 'Opus 4.5' : 'Sonnet 4.5'}`, category);
    } else {
      model = process.env.AI_MODEL || 'gpt-4o';
    }

    if (!apiKey && provider !== 'copilot') {
      throw new Error('AI API Key not configured');
    }

    let allFindings = [];

    // -----------------------------------------------------------------
    // FASE 3 PILOT: Deterministic Analysis for 'Users'
    // -----------------------------------------------------------------
    if (category === 'Users') {
      console.log(`[${timestamp()}] [DETERMINISTIC] Running Phase 3 Engine for ${category}...`);
      await addLog(assessmentId, 'info', `Ejecutando análisis determinístico (Fase 3) para ${category}`, category);

      // Execute Deterministic Logic
      allFindings = analyzeUsersDeterministic(data);

      console.log(`[${timestamp()}] [DETERMINISTIC] Found ${allFindings.length} mathematically verified findings.`);
      await addLog(assessmentId, 'info', `Análisis determinístico completado: ${allFindings.length} hallazgos encontrados`, category);

    } else {
      // -----------------------------------------------------------------
      // FASE 2: Regular AI Analysis + Post-Validation (Legacy for other categories)
      // -----------------------------------------------------------------
      await addLog(assessmentId, 'info', `Starting AI analysis for ${category}...`, category);

      // CRITICAL: Prevent hallucinations on empty datasets
      if (!data || data.length === 0) {
        console.log(`[${timestamp()}] [AI] ${category}: empty dataset (after filtering), skipping analysis to prevent hallucinations.`);
        await addLog(assessmentId, 'info', `Skipping ${category} (no risk objects found).`, category);
        return [];
      }

      const MAX_CHUNK_SIZE = 40; // Reduced to improve AI focus
      if (data.length > MAX_CHUNK_SIZE) {
        console.log(`[${timestamp()}] [AI] ${category}: Large dataset (${data.length} items), chunking...`);
        const chunks = chunkArray(data, MAX_CHUNK_SIZE);
        const mergedFindingsMap = new Map();

        // v1.7.0: Process chunks with per-chunk validation
        const processChunk = async (chunk, index) => {
          await addLog(assessmentId, 'info', `Analizando bloque ${index + 1}/${chunks.length} (${chunk.length.toLocaleString()} items)`, category);
          const prompt = buildPrompt(category, chunk);
          console.log(`[${timestamp()}] [AI] Chunk ${index + 1} prompt: ${prompt.length} chars`);
          try {
            // Rate limit protection
            await new Promise(r => setTimeout(r, 1000 * Math.random()));
            const findings = await callAI(prompt, provider, model, apiKey);
            console.log(`[${timestamp()}] [AI] Chunk ${index + 1} returned ${findings.length} raw findings`);

            // v1.7.0: VALIDATE PER CHUNK before merging
            // This catches hallucinations early and prevents contaminating the merge
            const validatedFindings = validateFindingsPerChunk(findings, chunk, category);
            console.log(`[${timestamp()}] [AI] Chunk ${index + 1}: ${validatedFindings.length}/${findings.length} findings passed validation`);

            if (validatedFindings.length > 0) {
              await addLog(assessmentId, 'info', `Bloque ${index + 1}: ${validatedFindings.length} hallazgos verificados`, category);
            }
            return validatedFindings;
          } catch (e) {
            console.error(`Error processing chunk ${index}:`, e);
            await addLog(assessmentId, 'error', `Error en bloque ${index + 1}: ${e.message}`, category);
            return [];
          }
        };

        // Sequential Chunk Processing to be safe with limits
        for (let i = 0; i < chunks.length; i++) {
          const chunkFindings = await processChunk(chunks[i], i);
          chunkFindings.forEach(f => {
            // Merge Logic - only validated findings reach here
            let key = f.type_id;
            if (!key && f.cis_control) key = f.cis_control.split(' ')[0];
            if (!key) key = (f.title || '').replace(/^\d+\s+/, '');

            if (!mergedFindingsMap.has(key)) {
              mergedFindingsMap.set(key, { ...f });
            } else {
              const existing = mergedFindingsMap.get(key);
              const existingCount = existing.affected_count || existing.evidence?.count || 0;
              const newCount = f.affected_count || f.evidence?.count || 0;
              const totalCount = existingCount + newCount;

              existing.affected_count = totalCount;
              if (existing.evidence) existing.evidence.count = totalCount;

              const existingObjects = existing.evidence?.affected_objects || [];
              const newObjects = f.evidence?.affected_objects || [];
              // Use Set to deduplicate and preserve order
              existing.evidence.affected_objects = [...new Set([...existingObjects, ...newObjects])];

              // Update title with new count
              if (/^\d+/.test(existing.title)) {
                existing.title = existing.title.replace(/^\d+/, totalCount.toString());
              }
            }
          });

          // Progress log
          if (i % 2 === 0) {
            await addLog(assessmentId, 'info', `Progreso: ${i + 1}/${chunks.length} bloques procesados`, category);
          }
        }

        allFindings = Array.from(mergedFindingsMap.values());
        console.log(`[${timestamp()}] [AI] ${category}: Merged into ${allFindings.length} unique findings`);

      } else {
        // Small dataset
        console.log(`[${timestamp()}] [AI] ${category}: Small dataset (${data.length} items), processing in single chunk`);
        const prompt = buildPrompt(category, data);
        allFindings = await callAI(prompt, provider, model, apiKey);
      }

      // POST-PROCESSING: Strict Grounding Check
      // Only needed for AI generated findings
      allFindings = validateFindings(allFindings, data, category);
      console.log(`[${timestamp()}] [AI] ${category} analysis complete (validated): ${allFindings.length} findings`);
      await addLog(assessmentId, 'info', `AI analysis complete: ${allFindings.length} verified findings`, category);
    }

    // Save findings to database (Common path for both engines)
    console.log(`[${timestamp()}] [DB] Saving ${allFindings.length} findings for ${category}`);
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

// =============================================================================
// 🛡️ SECURITY v1.7.0: ATTRIBUTE VALIDATION SYSTEM
// Ensures AI cannot invent attributes for real objects
// =============================================================================

/**
 * Attribute validation rules per finding type
 * Maps type_id/title patterns to validation functions
 */
const ATTRIBUTE_VALIDATION_RULES = {
  // User-related findings
  'PASSWORD_NEVER_EXPIRES': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => obj.Enabled === true && obj.PasswordNeverExpires === true
  },
  'INACTIVE_ACCOUNTS': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => {
      if (!obj.Enabled || !obj.LastLogonDate) return false;
      const lastLogon = parseFlexibleDate(obj.LastLogonDate);
      if (!lastLogon) return false;
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return lastLogon < ninetyDaysAgo;
    }
  },
  'ADMIN_COUNT_EXPOSURE': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => obj.Enabled === true && obj.AdminCount === 1
  },
  'KERBEROASTING': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => obj.Enabled === true &&
      obj.ServicePrincipalNames &&
      (Array.isArray(obj.ServicePrincipalNames) ? obj.ServicePrincipalNames.length > 0 : true) &&
      obj.SamAccountName?.toLowerCase() !== 'krbtgt'
  },
  'ASREP_ROASTING': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => obj.Enabled === true && (obj.DoNotRequirePreAuth === true || obj.IsASREPRoastable === true)
  },
  'UNCONSTRAINED_DELEGATION': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => obj.Enabled === true && obj.TrustedForDelegation === true
  },
  'PASSWORD_NOT_REQUIRED': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => obj.Enabled === true && obj.PasswordNotRequired === true
  },
  'PRIVILEGED_NO_PROTECTION': {
    category: 'Users',
    identifierField: 'SamAccountName',
    validate: (obj) => obj.Enabled === true && obj.IsPrivileged === true
  },

  // Computer-related findings
  'LEGACY_OS': {
    category: 'Computers',
    identifierField: 'Name',
    validate: (obj) => {
      const os = (obj.OperatingSystem || '').toLowerCase();
      return os.includes('2012') || os.includes('2008') || os.includes('2003') ||
             os.includes('2000') || os.includes('xp') || os.includes('vista') ||
             os.includes('windows 7') || os.includes('windows 8');
    }
  },
  'STALE_COMPUTER': {
    category: 'Computers',
    identifierField: 'Name',
    validate: (obj) => obj.IsStale === true || obj.Enabled === false
  },
  'COMPUTER_UNCONSTRAINED_DELEGATION': {
    category: 'Computers',
    identifierField: 'Name',
    validate: (obj) => obj.TrustedForDelegation === true
  },

  // Group-related findings
  'EMPTY_GROUP': {
    category: 'Groups',
    identifierField: 'Name',
    validate: (obj) => obj.MemberCount === 0 || (obj.Members && obj.Members.length === 0)
  },
  'PRIVILEGED_GROUP': {
    category: 'Groups',
    identifierField: 'Name',
    validate: (obj) => obj.IsPrivileged === true
  },

  // GPO-related findings
  'UNLINKED_GPO': {
    category: 'GPOs',
    identifierField: 'DisplayName',
    validate: (obj) => !obj.Links || obj.Links.length === 0 || obj.LinksTo?.length === 0
  },
  'DISABLED_GPO': {
    category: 'GPOs',
    identifierField: 'DisplayName',
    validate: (obj) => obj.GpoStatus === 'AllSettingsDisabled' ||
                       obj.GpoStatus === 'UserSettingsDisabled' ||
                       obj.GpoStatus === 'ComputerSettingsDisabled'
  },

  // DCHealth / HygieneAnalysis findings (v3.6.13)
  // These validate against HygieneAnalysis data extracted from NETLOGON/NTDS events
  'GHOST_COMPUTER_ACCOUNTS': {
    category: 'DCHealth',
    identifierField: 'Name',
    // Validates that reported ghost computers exist in HygieneAnalysis.GhostComputers
    validate: (obj, finding) => {
      // For DCHealth, the object is the DC itself
      // The affected_objects should match items in HygieneAnalysis.GhostComputers
      if (!obj.HygieneAnalysis?.GhostComputers) return false;
      return obj.HygieneAnalysis.GhostComputers.length > 0;
    },
    // Custom validation for affected objects
    validateAffectedObject: (objName, dcData) => {
      if (!dcData.HygieneAnalysis?.GhostComputers) return false;
      return dcData.HygieneAnalysis.GhostComputers.some(ghost =>
        ghost.toLowerCase().includes(objName.toLowerCase()) ||
        objName.toLowerCase().includes(ghost.toLowerCase())
      );
    }
  },
  'TRUST_RELATIONSHIP_FAILURE': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => {
      if (!obj.HygieneAnalysis?.TrustFailures) return false;
      return obj.HygieneAnalysis.TrustFailures.length > 0;
    },
    validateAffectedObject: (objName, dcData) => {
      if (!dcData.HygieneAnalysis?.TrustFailures) return false;
      return dcData.HygieneAnalysis.TrustFailures.some(trust =>
        trust.toLowerCase().includes(objName.toLowerCase()) ||
        objName.toLowerCase().includes(trust.toLowerCase())
      );
    }
  },
  'CREDENTIAL_DESYNC': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => {
      if (!obj.HygieneAnalysis?.CredentialDesync) return false;
      return obj.HygieneAnalysis.CredentialDesync.length > 0;
    },
    validateAffectedObject: (objName, dcData) => {
      if (!dcData.HygieneAnalysis?.CredentialDesync) return false;
      return dcData.HygieneAnalysis.CredentialDesync.some(cred =>
        cred.toLowerCase().includes(objName.toLowerCase()) ||
        objName.toLowerCase().includes(cred.toLowerCase())
      );
    }
  },
  'SECURE_CHANNEL_FAILURE': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => {
      if (!obj.HygieneAnalysis?.SecureChannelFailures) return false;
      return obj.HygieneAnalysis.SecureChannelFailures.length > 0;
    },
    validateAffectedObject: (objName, dcData) => {
      if (!dcData.HygieneAnalysis?.SecureChannelFailures) return false;
      return dcData.HygieneAnalysis.SecureChannelFailures.some(sc =>
        sc.toLowerCase().includes(objName.toLowerCase()) ||
        objName.toLowerCase().includes(sc.toLowerCase())
      );
    }
  },
  'REPLICATION_PARTNER_ISSUE': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => {
      if (!obj.HygieneAnalysis?.ReplicationPartnerIssues) return false;
      return obj.HygieneAnalysis.ReplicationPartnerIssues.length > 0;
    },
    validateAffectedObject: (objName, dcData) => {
      if (!dcData.HygieneAnalysis?.ReplicationPartnerIssues) return false;
      return dcData.HygieneAnalysis.ReplicationPartnerIssues.some(rp =>
        rp.toLowerCase().includes(objName.toLowerCase()) ||
        objName.toLowerCase().includes(rp.toLowerCase())
      );
    }
  },
  // Traditional DCHealth findings
  'REPLICATION_FAILURE': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => obj.ConsecutiveReplicationFailures > 0 || obj.ReplicationStatus === 'Error'
  },
  'OS_OBSOLETE_DC': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => {
      const os = (obj.OperatingSystem || '').toLowerCase();
      return os.includes('2012') || os.includes('2008') || os.includes('2003');
    }
  },
  'FSMO_PLACEMENT_ISSUE': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => obj.FSMORoles && obj.FSMORoles.length > 3 // More than 3 roles = SPOF risk
  },
  'NTP_MISCONFIGURED': {
    category: 'DCHealth',
    identifierField: 'Name',
    validate: (obj) => {
      const source = (obj.TimeSyncConfig?.Source || '').toLowerCase();
      return source.includes('local cmos') || source.includes('free-running') ||
             source.includes('vm ic time');
    }
  },

  // DNS-related findings
  'DNS_FORWARDERS_PUBLIC': {
    category: 'DNS',
    identifierField: 'DCName',
    validate: (obj) => {
      // obj is from DNSConfiguration.Forwarders array
      if (obj._isForwarderConfig) return true; // Injected by extractCategoryData
      return obj.Forwarders && obj.Forwarders.length > 0;
    }
  },
  'DNS_FORWARDERS_INSECURE': {
    category: 'DNS',
    identifierField: 'DCName',
    validate: (obj) => {
      if (obj._isForwarderConfig) return true;
      return obj.SecurityWarning && obj.SecurityWarning.length > 0;
    }
  },
  'DNS_ZONE_TRANSFER': {
    category: 'DNS',
    identifierField: 'ZoneName',
    validate: (obj) => obj.SecureSecondaries === false || obj.SecureSecondaries === 'NoSecurity'
  },
  'DNS_DYNAMIC_UPDATE': {
    category: 'DNS',
    identifierField: 'ZoneName',
    validate: (obj) => obj.DynamicUpdate === 'NonsecureAndSecure' || obj.DynamicUpdate === 'Insecure'
  },

  // PasswordPolicies-related findings
  'PASSWORD_POLICY_WEAK_LENGTH': {
    category: 'PasswordPolicies',
    identifierField: 'Name',
    validate: (obj) => {
      // obj can be DefaultDomainPolicy or a FineGrainedPolicy
      return obj.MinPasswordLength !== undefined && obj.MinPasswordLength < 12;
    }
  },
  'PASSWORD_POLICY_NO_COMPLEXITY': {
    category: 'PasswordPolicies',
    identifierField: 'Name',
    validate: (obj) => obj.ComplexityEnabled === false
  },
  'PASSWORD_POLICY_REVERSIBLE_ENCRYPTION': {
    category: 'PasswordPolicies',
    identifierField: 'Name',
    validate: (obj) => obj.ReversibleEncryptionEnabled === true
  },
  'PASSWORD_POLICY_NO_LOCKOUT': {
    category: 'PasswordPolicies',
    identifierField: 'Name',
    validate: (obj) => obj.LockoutThreshold === 0 || obj.LockoutThreshold === undefined
  },
  'PASSWORD_POLICY_LONG_MAX_AGE': {
    category: 'PasswordPolicies',
    identifierField: 'Name',
    validate: (obj) => {
      // MaxPasswordAge typically in days or TimeSpan format
      if (obj.MaxPasswordAge === 0) return true; // Never expires
      if (typeof obj.MaxPasswordAge === 'number') return obj.MaxPasswordAge > 90;
      return false;
    }
  },
  'PASSWORD_POLICY_WEAK_HISTORY': {
    category: 'PasswordPolicies',
    identifierField: 'Name',
    validate: (obj) => {
      return obj.PasswordHistoryCount !== undefined && obj.PasswordHistoryCount < 12;
    }
  }
};

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

    // Format 2: ISO 8601 string
    if (typeof dateValue === 'string' && dateValue.includes('-')) {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) return parsed;
    }

    // Format 3: Unix timestamp (number or string)
    const timestamp = typeof dateValue === 'number' ? dateValue : parseInt(dateValue);
    if (!isNaN(timestamp)) {
      // Handle both seconds and milliseconds
      const date = new Date(timestamp > 1e12 ? timestamp : timestamp * 1000);
      if (!isNaN(date.getTime())) return date;
    }

    return null;
  } catch (e) {
    console.warn(`[parseFlexibleDate] Failed to parse: ${dateValue}`);
    return null;
  }
}

/**
 * Validates that affected objects actually have the claimed attributes
 * @param {Object} finding - The finding to validate
 * @param {Array} data - Raw data for the category
 * @param {string} category - Category name
 * @returns {Object} - { isValid: boolean, validObjects: string[], invalidObjects: string[] }
 */
function validateAttributes(finding, data, category) {
  const result = { isValid: true, validObjects: [], invalidObjects: [], rule: null };

  if (!finding || !data || !Array.isArray(data)) return result;

  const affectedObjects = finding.evidence?.affected_objects || [];
  if (affectedObjects.length === 0) return result;

  // Find matching rule by type_id or title pattern
  let rule = null;
  const typeId = finding.type_id || '';
  const title = (finding.title || '').toLowerCase();

  // Try exact match first
  if (typeId && ATTRIBUTE_VALIDATION_RULES[typeId]) {
    rule = ATTRIBUTE_VALIDATION_RULES[typeId];
  } else {
    // Try pattern matching on title
    for (const [ruleId, ruleConfig] of Object.entries(ATTRIBUTE_VALIDATION_RULES)) {
      const pattern = ruleId.toLowerCase().replace(/_/g, ' ');
      if (title.includes(pattern) || title.includes(ruleId.toLowerCase())) {
        rule = ruleConfig;
        result.rule = ruleId;
        break;
      }
    }
  }

  // If no matching rule, skip attribute validation (allow the finding)
  if (!rule) {
    result.validObjects = affectedObjects;
    return result;
  }

  // Check if rule applies to this category
  if (rule.category && rule.category.toLowerCase() !== category.toLowerCase()) {
    result.validObjects = affectedObjects;
    return result;
  }

  // Build lookup map for data objects
  const identifierField = rule.identifierField || 'Name';
  const dataMap = new Map();
  data.forEach(obj => {
    if (obj && obj[identifierField]) {
      dataMap.set(obj[identifierField].toLowerCase(), obj);
    }
    // Also try SamAccountName as fallback
    if (obj && obj.SamAccountName) {
      dataMap.set(obj.SamAccountName.toLowerCase(), obj);
    }
    // And Name
    if (obj && obj.Name) {
      dataMap.set(obj.Name.toLowerCase(), obj);
    }
  });

  // Validate each affected object
  for (const objName of affectedObjects) {
    if (!objName) continue;

    const lowerName = objName.toString().toLowerCase();
    const cleanName = lowerName.replace(/^(cn=|name=|user=|computer=)/, '').split(',')[0].trim();

    const realObj = dataMap.get(cleanName) || dataMap.get(lowerName);

    // v3.6.13: Special handling for DCHealth with validateAffectedObject
    // For DCHealth/HygieneAnalysis, affected_objects are computers from logs,
    // not the DC itself, so we need to validate against HygieneAnalysis arrays
    if (rule.validateAffectedObject && category.toLowerCase() === 'dchealth') {
      // Check if any DC in the data has this object in its HygieneAnalysis
      let foundInAnyDC = false;
      for (const dc of data) {
        if (rule.validateAffectedObject(objName, dc)) {
          foundInAnyDC = true;
          break;
        }
      }
      if (foundInAnyDC) {
        result.validObjects.push(objName);
      } else {
        result.invalidObjects.push(objName);
        console.log(`[validateAttributes] ❌ DCHealth object "${objName}" not found in any DC's HygieneAnalysis`);
      }
    } else if (realObj && rule.validate(realObj)) {
      result.validObjects.push(objName);
    } else {
      result.invalidObjects.push(objName);
      console.log(`[validateAttributes] ❌ Object "${objName}" failed attribute check for rule (exists: ${!!realObj}, validate: ${realObj ? rule.validate(realObj) : 'N/A'})`);
    }
  }

  result.isValid = result.validObjects.length > 0;
  return result;
}

// =============================================================================
// v1.7.0: PER-CHUNK VALIDATION
// Lightweight validation for chunk processing - validates against chunk data only
// =============================================================================

/**
 * Validate findings against chunk data before merging
 * This is a lighter version of validateFindings optimized for chunk processing
 * @param {Array} findings - Findings from AI for this chunk
 * @param {Array} chunkData - The chunk data that was sent to AI
 * @param {string} category - Category name
 * @returns {Array} - Validated findings
 */
function validateFindingsPerChunk(findings, chunkData, category) {
  if (!findings || findings.length === 0) return [];
  if (!chunkData || chunkData.length === 0) return [];

  // Build index of valid identifiers from chunk data
  const validIdentifiers = new Set();

  chunkData.forEach(obj => {
    if (!obj) return;
    // Add common identifier fields
    ['SamAccountName', 'Name', 'DisplayName', 'DistinguishedName', 'DNSHostName'].forEach(field => {
      if (obj[field] && typeof obj[field] === 'string') {
        validIdentifiers.add(obj[field].toLowerCase());
      }
    });
  });

  const validatedFindings = [];

  for (const finding of findings) {
    if (!finding) continue;

    const evidence = finding.evidence || {};
    const affectedObjects = evidence.affected_objects || [];

    // Global findings (no specific objects) - allow for non-object categories
    if (affectedObjects.length === 0) {
      if (['Users', 'Computers', 'Groups'].includes(category)) {
        // These require specific objects
        if ((evidence.count || 0) > 0 || (finding.affected_count || 0) > 0) {
          console.log(`[ChunkValidation] 🛑 Rejected: "${finding.title}" claims count but no objects`);
          continue;
        }
      }
      validatedFindings.push(finding);
      continue;
    }

    // Validate each affected object exists in chunk
    const validObjects = affectedObjects.filter(objName => {
      if (!objName) return false;
      const lowerName = objName.toString().toLowerCase();
      const cleanName = lowerName.replace(/^(cn=|name=|user=|computer=)/, '').split(',')[0].trim();

      return validIdentifiers.has(cleanName) || validIdentifiers.has(lowerName) ||
        // Partial match for domain-prefixed names (DOMAIN\user)
        Array.from(validIdentifiers).some(id => id.includes(cleanName) || cleanName.includes(id));
    });

    if (validObjects.length === 0) {
      console.log(`[ChunkValidation] 🛑 Rejected: "${finding.title}" - no valid objects in chunk`);
      continue;
    }

    // Update finding with validated objects
    finding.evidence.affected_objects = validObjects;
    finding.evidence.count = validObjects.length;
    finding.affected_count = validObjects.length;

    // Update title count if present
    if (/^\d+/.test(finding.title)) {
      finding.title = finding.title.replace(/^\d+/, validObjects.length.toString());
    }

    validatedFindings.push(finding);
  }

  return validatedFindings;
}

// 🛡️ SECURITY: Grounding Verification Function
// Ensures AI cannot invent objects that don't exist in the input data.
// v1.7.0: Optimized with n-gram index for O(1) fuzzy matching
function validateFindings(findings, data, category) {
  if (!findings || findings.length === 0) return [];

  // Create a Set of all valid object identifiers for O(1) lookup
  const validNames = new Set();
  // v1.7.0: Create n-gram index for faster fuzzy matching
  const ngramIndex = new Map(); // Maps 3-char substrings to full names

  // Helper to extract n-grams from a string
  const extractNgrams = (str, n = 3) => {
    const ngrams = [];
    const lower = str.toLowerCase();
    for (let i = 0; i <= lower.length - n; i++) {
      ngrams.push(lower.substring(i, i + n));
    }
    return ngrams;
  };

  // Recursive function to extract all strings from an object
  const extractStrings = (obj) => {
    if (!obj) return;

    if (typeof obj === 'string') {
      if (obj.length > 2 && obj.length < 100) {
        const lower = obj.toLowerCase();
        validNames.add(lower);
        // Index n-grams for this string
        extractNgrams(lower).forEach(ngram => {
          if (!ngramIndex.has(ngram)) {
            ngramIndex.set(ngram, new Set());
          }
          ngramIndex.get(ngram).add(lower);
        });
      }
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach(item => extractStrings(item));
      return;
    }

    if (typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        // Add keys as well, as they often contain DC names or hostnames
        if (key.length > 2 && key.length < 100) {
          const lowerKey = key.toLowerCase();
          validNames.add(lowerKey);
          extractNgrams(lowerKey).forEach(ngram => {
            if (!ngramIndex.has(ngram)) {
              ngramIndex.set(ngram, new Set());
            }
            ngramIndex.get(ngram).add(lowerKey);
          });
        }
        extractStrings(obj[key]);
      });
    }
  };

  data.forEach(item => extractStrings(item));
  console.log(`[Validation] Built index with ${validNames.size} valid names, ${ngramIndex.size} n-gram entries`);

  const validatedFindings = [];

  for (const finding of findings) {
    const evidence = finding.evidence || {};
    let affectedObjects = evidence.affected_objects || [];

    // 1. GLOBAL/GENERIC CHECKS (Type II Findings)
    if (affectedObjects.length === 0) {
      if (['Users', 'Computers', 'Groups'].includes(category)) {
        if (evidence.count > 0 || finding.affected_count > 0) {
          console.log(`[Validation] 🛑 PURGING HALLUCINATION: "${finding.title}" (Category: ${category}) claims issues but lists NO objects.`);
          continue;
        }
      }
      validatedFindings.push(finding);
      continue;
    }

    // 2. SPECIFIC OBJECT CHECKS (Type I Findings)
    // v1.7.0: Optimized validation using n-gram index
    const validObjects = affectedObjects.filter(objName => {
      if (!objName) return false;
      const lowerObj = objName.toString().toLowerCase();
      // Clean up common prefixes
      const cleanName = lowerObj.replace(/^(cn=|name=|user=|computer=)/, '').split(',')[0].trim();

      // Fast path: exact match O(1)
      if (validNames.has(cleanName) || validNames.has(lowerObj)) {
        return true;
      }

      // v1.7.0: Optimized fuzzy matching using n-gram index
      // Instead of O(n) iteration, use n-grams to find candidates
      if (cleanName.length >= 3) {
        const searchNgrams = extractNgrams(cleanName);
        const candidates = new Set();

        // Find all names that share at least one n-gram with the search term
        searchNgrams.forEach(ngram => {
          const matches = ngramIndex.get(ngram);
          if (matches) {
            matches.forEach(m => candidates.add(m));
          }
        });

        // Check candidates for actual match (now O(candidates) not O(validNames))
        for (const candidate of candidates) {
          if (candidate.includes(cleanName) || cleanName.includes(candidate)) {
            return true;
          }
        }
      }

      return false;
    });

    // 3. DECISION GATES - EXISTENCE CHECK
    if (validObjects.length === 0) {
      console.log(`[Validation] 🛑 BLOCKING TOTAL HALLUCINATION: Finding "${finding.title}" listed ${affectedObjects.length} objects but NONE exist in real data.`);
      continue; // DELETE FINDING
    }

    if (validObjects.length !== affectedObjects.length) {
      console.log(`[Validation] ⚠️ PARTIAL HALLUCINATION FIX (existence): Finding "${finding.title}" reduced from ${affectedObjects.length} to ${validObjects.length} real objects.`);
    }

    // 4. NEW v1.7.0: ATTRIBUTE VALIDATION
    // Verify that objects actually have the claimed vulnerability attributes
    finding.evidence.affected_objects = validObjects; // Update before attribute check
    const attrValidation = validateAttributes(finding, data, category);

    if (!attrValidation.isValid) {
      console.log(`[Validation] 🛑 BLOCKING ATTRIBUTE HALLUCINATION: Finding "${finding.title}" - objects exist but NONE have the claimed attributes.`);
      continue; // DELETE FINDING
    }

    if (attrValidation.invalidObjects.length > 0) {
      console.log(`[Validation] ⚠️ PARTIAL ATTRIBUTE FIX: Finding "${finding.title}" reduced from ${validObjects.length} to ${attrValidation.validObjects.length} (attribute-verified).`);
    }

    // Use attribute-validated objects (more strict than existence-only)
    const finalValidObjects = attrValidation.validObjects;

    // 5. REWRITE REALITY
    // Force the finding to match the verified reality
    finding.evidence.affected_objects = finalValidObjects;
    finding.evidence.count = finalValidObjects.length;
    finding.affected_count = finalValidObjects.length;

    // Update title to be mathematically correct
    if (/^\d+/.test(finding.title)) {
      finding.title = finding.title.replace(/^\d+/, finalValidObjects.length.toString());
    } else {
      // If title doesn't start with number but finding implies count, prepend it
      if (!finding.title.includes(finalValidObjects.length.toString())) {
        finding.title = `(${finalValidObjects.length}) ${finding.title}`;
      }
    }

    validatedFindings.push(finding);
  }

  console.log(`[Validation] ✅ Final result: ${validatedFindings.length}/${findings.length} findings passed all validations`);
  return validatedFindings;
}

function buildPrompt(cat, d) {
  const str = (v, max) => JSON.stringify(v || [], null, 2).substring(0, max);

  const categoryInstructions = {
    Users: `Analiza estos usuarios de Active Directory para identificar vulnerabilidades de seguridad.

**⚠️ INSTRUCCIONES DE ANÁLISIS DE DATOS (JSON):**
1. Recibirás una lista de objetos JSON. CADA objeto es un usuario.
2. Debes ITERAR mentalmente sobre CADA usuario de la lista.
3. Verifica las condiciones de seguridad para CADA uno.
4. CUENTA cuántos usuarios cumplen cada condición de vulnerabilidad.
5. Si encuentras al menos 1 usuario vulnerable, GENERA EL HALLAZGO.

**⚠️ VALIDACIÓN CRÍTICA:**
- Los nombres de usuarios en affected_objects deben ser REALES de los datos analizados (propiedad 'SamAccountName').
- Si los datos muestran 0 usuarios con un problema, NO generes finding para eso.

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
    
8. **Riesgo de Kerberos Token Bloat** (EstimatedTokenSize > 12000 bytes)
   - Riesgo: Fallos de logon intermitentes, errores HTTP 400 en aplicaciones web, GPOs fallando
   - Causa: Pertenencia a demasiados grupos de seguridad
   - KB Microsoft: https://support.microsoft.com/en-us/help/327825
   - Impacto: Denegación de servicio para usuarios específicos (VIPs suelen ser los más afectados)
   - Validación datos: EstimatedTokenSize > 12000
   - Comando verificar: (Get-ADUser "SamAccountName" -Properties MemberOf).MemberOf.Count
   - Comando fix: Reducir membresía de grupos, limpiar grupos anidados
   - Workaround temporal: Aumentar MaxTokenSize en servidores (regedit)
   - Timeline: Investigar y planificar limpieza de grupos en 30 días

**PARA CADA HALLAZGO, PROPORCIONA (EN ESPAÑOL):**
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: PASSWORD_NEVER_EXPIRES, PRIVILEGED_USERS_EXCESS, INACTIVE_ACCOUNTS, KERBEROASTING_VULN
  IMPORTANTE: Si encuentras un problema nuevo, genera un ID descriptivo (ej: WEAK_PASSWORD_POLICY).
  Este ID es CRÍTICO para agrupar hallazgos similares en reportes grandes.
  
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

4. **⚠️ MEDIUM: GPOs Monolíticas (Complejidad Excesiva)**
   - Si 'TotalSettings' > 50
   - Riesgo: Tiempos de inicio de sesión lentos, dificultad par debugar
   - Impacto: Higiene Operativa
   - Recomendación: Dividir la GPO en unidades lógicas más pequeñas (ej: 'Browser Settings', 'Security Baseline')

5. **⚠️ HIGH: Desajuste de Versiones (Version Mismatch)**
   - Si 'UserDSVersion' != 'UserSysvolVersion' O 'ComputerDSVersion' != 'ComputerSysvolVersion'
   - Riesgo: Problemas de replicación de SYSVOL (Journal Wrap, DFSR roto)
   - Impacto: Las políticas pueden no aplicarse consistentemente en todos los DCs
   - Recomendación: Forzar replicación de SYSVOL o investigar errores de DFSR

6. **Configuraciones de seguridad débiles** (SOLO SI ESTÁN EN LOS DATOS):
   - Password policy: MinimumPasswordLength < 14 caracteres
   - Lockout threshold: LockoutThreshold < 5 intentos o 0 (deshabilitado)
   - Maximum password age: > 90 días o 0 (nunca expira)
   - Password history: PasswordHistorySize < 24
   - Comando para verificar: Get-ADDefaultDomainPasswordPolicy

7. **GPOs con configuraciones conflictivas**
   - Múltiples GPOs configurando el mismo setting
   - Comando para detectar: Get-GPOReport -Name "GPO_NAME" -ReportType HTML

**PARA CADA HALLAZGO, PROPORCIONA:**
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: GPO_WEAK_PASSWORD_POLICY, GPO_UNLINKED, GPO_PREFERENCE_PASSWORD.
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
1. **Sistemas operativos obsoletos** (Windows Server 2008/2003, Windows 7/XP/Vista)
   - ⚠️ IMPORTANTE: Windows Server 2025, 2022, 2019, 2016 NO son obsoletos.
   - ⚠️ Windows Server 2012 R2 está en fin de soporte (EOL), pero 2025 es el MÁS NUEVO. NO lo marques como obsoleto.
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
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: OS_OBSOLETE, INACTIVE_COMPUTERS, UNCONSTRAINED_DELEGATION_COMPUTER.
- **Título**: Número de equipos afectados y tipo de problema
- **Descripción**: Riesgo específico y vectores de ataque
- **Recomendación**: Plan de remediación:
  * Para OS obsoletos: Plan de migración/actualización
  * Para delegación: Cómo deshabilitar o restringir
  * Comandos PowerShell para implementar
- **Evidencia**: Lista de equipos (hostname, OS, última actividad)`,

    ReplicationStatus: `Analiza la salud de la replicación de Active Directory y la topología del bosque.

**⚠️ CONTEXTO CRÍTICO:**
La replicación es el corazón de AD. Fallos aquí significan contraseñas no sincronizadas, objetos fantasma y posible corrupción de la base de datos.
Debes detectar problemas de topología, conexiones huérfanas y errores de replicación persistentes.

**📊 ESTRUCTURA DE DATOS (IMPORTANTE - LEE CON CUIDADO):**
Los datos vienen como objeto ReplicationStatus con 3 secciones:

1. **Connections** (array): Lista de conexiones de replicación configuradas
   - From: DN del servidor origen (ej: "CN=NTDS Settings,CN=DC1,CN=Servers,CN=SiteName,...")
   - To: DN del servidor destino
   - Name: Nombre de la conexión (GUID o nombre manual)
   - AutoGenerated: true/false (si fue creada por KCC automáticamente)
   - IsDeleted: true/false (si está marcada para eliminación)

2. **Partners** (array): Estado actual de replicación con cada partner
   - Partner: DN del partner de replicación
   - LastSuccess: Timestamp de última sincronización exitosa (formato /Date(timestamp)/)
   - LastResult: 0 = éxito, otro valor = código de error
   - Failures: número de fallos consecutivos

3. **Errors** (array): Lista de errores de replicación activos (vacío si no hay problemas)

**=== SECCIÓN 1: ANÁLISIS DE CONEXIONES ===**

1. **🔴 CRITICAL: Objetos Eliminados (Lingering Objects)**
   - Conexiones donde From o To contienen "\\0ADEL:" o "DEL:"
   - Riesgo: Corrupción de base de datos, reaparición de objetos borrados
   - Acción: Eliminar conexión y ejecutar limpieza de metadatos

2. **⚠️ HIGH: Conexiones Marcadas como Eliminadas**
   - Conexiones con IsDeleted: true que aún existen
   - Riesgo: Topología inconsistente
   - Acción: Limpiar metadatos del DC eliminado

3. **⚠️ HIGH: Exceso de Conexiones (KCC Storm)**
   - Analiza cuántas conexiones llegan a cada servidor (campo "To")
   - Si un servidor tiene > 10 conexiones entrantes: posible KCC storm
   - Riesgo: Sobrecarga de red, topología ineficiente

4. **📋 INFO: Balance de Conexiones Automáticas vs Manuales**
   - Cuenta conexiones con AutoGenerated: true vs false
   - Si hay muchas manuales (AutoGenerated: false): puede indicar modificaciones no estándar
   - Best practice: KCC debe gestionar la mayoría de conexiones

**=== SECCIÓN 2: ANÁLISIS DE PARTNERS Y ESTADO DE REPLICACIÓN ===**

5. **🔴 CRITICAL: Fallos de Replicación Activos**
   - Partners con LastResult != 0
   - Partners con Failures > 0
   - Incluye el código de error específico y nombre del partner afectado

6. **🔴 CRITICAL: Replicación Antigua**
   - Convierte LastSuccess de /Date(timestamp)/ a fecha legible
   - Si LastSuccess > 24 horas: CRITICAL
   - Si LastSuccess > 1 hora: HIGH
   - Si LastSuccess < 15 minutos: Saludable
   - Calcula: tiempo_actual - timestamp_en_milisegundos

7. **✅ INFO: Estado Saludable**
   - Si Partners tiene todos LastResult: 0 y Failures: 0
   - Genera finding positivo indicando replicación funcionando correctamente

**=== SECCIÓN 3: ANÁLISIS DE ERRORES ===**

8. **🔴 CRITICAL: Errores Activos**
   - Si el array Errors tiene elementos, analiza cada uno
   - Extrae códigos de error, servidores afectados, mensajes

**=== ANÁLISIS DE TOPOLOGÍA ===**

9. **📋 HYGIENE: Extracción de Sitios**
   - De los DNs extrae los nombres de Sites (ej: "CN=Servers,CN=SiteName,CN=Sites")
   - Lista todos los sitios encontrados
   - Verifica si hay conexiones entre todos los sitios

10. **📋 HYGIENE: Extracción de DCs**
    - Extrae nombres de DCs de los campos From/To/Partner
    - Patrón: "CN=NTDS Settings,CN=NOMBRE_DC,CN=Servers..."
    - Lista todos los DCs identificados

**🛡️ VALIDACIÓN ANTI-ALUCINACIÓN:**

Antes de generar findings, CUENTA y VERIFICA:
1. Total de Connections: len(Connections[])
2. Total de Partners: len(Partners[])
3. Total de Errors: len(Errors[])
4. Para cada Partner: LastResult (0=ok), Failures (0=ok)
5. Extrae nombres REALES de DCs y Sites de los DNs

**EJEMPLO DE ANÁLISIS CORRECTO:**
Datos: {
  Connections: [{From:"...CN=DC1...", To:"...CN=DC2...", AutoGenerated:true}],
  Partners: [{Partner:"...CN=DC2...", LastResult:0, Failures:0, LastSuccess:"/Date(1234567890000)/"}],
  Errors: []
}
→ 1 conexión configurada (DC1 → DC2), auto-generada por KCC
→ 1 partner activo con LastResult=0 (éxito), 0 fallos
→ 0 errores activos
→ Finding: "REPLICATION_HEALTHY - Topología de replicación funcionando correctamente"

**PARA CADA HALLAZGO, PROPORCIONA:**
- **type_id**: REPLICATION_LINGERING_OBJECTS, REPLICATION_FAILURE_CRITICAL, REPLICATION_HEALTHY, REPLICATION_TOPOLOGY_ANALYSIS, etc.
- **Título**: Descriptivo del problema o estado
- **Descripción**: Explica técnicamente qué encontraste, con números exactos
- **Recomendación**: Comandos PowerShell específicos (repadmin, Remove-ADReplicationConnection, ntdsutil)
- **Evidencia**: Nombres de servidores, sitios, códigos de error, timestamps convertidos a fechas`,

    Groups: `Eres un auditor de seguridad especializado en privilegios y gestión de identidades en Active Directory.

**⚠️ CONTEXTO DE ANÁLISIS:**
Los grupos son el mecanismo principal de asignación de permisos en AD. El exceso de privilegios es una de las vulnerabilidades más explotadas en compromisos de dominio. Debes buscar desviaciones del principio de least privilege y grupos con configuraciones que faciliten escalación de privilegios.

**🎯 PRIORIDADES DE DETECCIÓN (EN ORDEN):**

1. **🔴 CRITICAL: Grupos de Tier 0 sobrepoblados**
   - Domain Admins (o "Admins. del dominio") > 5 miembros permanentes
   - Enterprise Admins (o "Administradores de empresas") > 3 miembros
   - Schema Admins (o "Administradores de esquema") con miembros permanentes
   - Administrators (o "Administradores") > 10 miembros
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
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: TIER0_GROUP_OVERPOPULATED, ADMIN_IN_PROTECTED_USERS_MISSING, INACTIVE_GROUP_MEMBERS.
- **Título** (ESPAÑOL): "[NÚMERO] cuentas no autorizadas en grupo [NOMBRE]" o "Grupo [NOMBRE] sobrepoblado con [COUNT] miembros"
- **Descripción** (3 párrafos obligatorios):
  * Párrafo 1 - ESTADO ACTUAL: Número exacto, nombres de grupos afectados, configuración actual vs baseline recomendado
  * Párrafo 2 - RIESGO: Vector de ataque específico (credential theft, lateral movement), técnicas MITRE ATT&CK aplicables
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

    DCHealth: `Analiza la salud operativa y higiene de los controladores de dominio.

**⚠️ CONTEXTO DE ANÁLISIS:**
Este es un análisis de HIGIENE OPERATIVA, no de seguridad ofensiva. El objetivo es identificar desorden administrativo, deuda técnica y configuraciones subóptimas que hacen la infraestructura inestable e ineficiente.

**🎯 BUSCA ESPECÍFICAMENTE:**

## PARTE A: PROBLEMAS OPERATIVOS TRADICIONALES

1. **Problemas de replicación** (ConsecutiveReplicationFailures > 0)
   - Impacto: Inconsistencia de datos entre DCs, usuarios con credenciales desactualizadas
   - Comando verificar: repadmin /showrepl
   - Timeline: Remediar en 24-48 horas

2. **Versiones de OS obsoletas** (< Windows Server 2016)
   - Impacto: Sin soporte de Microsoft, sin actualizaciones de seguridad
   - Timeline: Planificar migración en 90 días

3. **Roles FSMO concentrados** (todos en un solo DC)
   - Impacto: Single point of failure - si ese DC falla, operaciones críticas se detienen
   - Comando verificar: netdom query fsmo
   - Timeline: Redistribuir roles en 30 días

4. **AD Recycle Bin deshabilitado**
   - Impacto: No se pueden recuperar objetos eliminados accidentalmente
   - Comando habilitar: Enable-ADOptionalFeature -Identity "Recycle Bin Feature" -Scope ForestOrConfigurationSet -Target (Get-ADForest).Name
   - Timeline: Habilitar inmediatamente

5. **Tombstone Lifetime** (< 180 días)
   - Impacto: Riesgo de objetos lingering si backup tiene más antigüedad
   - Timeline: Evaluar y ajustar en 30 días

6. **🔴 Sincronización de Tiempo (NTP) Incorrecta**
   - Analiza la sección 'TimeSyncConfig' en los datos.
   - **PDC Emulator**: Debe usar fuente externa (NTP) confiable.
     - CRITICAL: Si Source es "Local CMOS Clock", "Free-running System Clock" o "VM IC Time Sync Provider".
   - **Otros DCs**: Deben sincronizar vía NT5DS (jerarquía de dominio).
   - Impacto: Fallos de Kerberos (si desvío > 5 min), problemas de replicación
   - Timeline: Remediar INMEDIATAMENTE (24 horas)

## PARTE B: ANÁLISIS DE HIGIENE (HygieneAnalysis)

Si los datos incluyen la sección 'HygieneAnalysis', analiza cada categoría:

7. **🔴 CRITICAL: Cuentas de Equipo Fantasma (GhostComputers)**
   - Son equipos que ya no existen físicamente pero siguen en AD, causando errores NETLOGON
   - Indicador: Errores "No logon servers available" o "session setup failed" en logs
   - Impacto: Ruido en logs, confusión operativa, posible uso de licencias innecesarias
   - type_id: GHOST_COMPUTER_ACCOUNTS
   - Remediación:
     * Verificar si el equipo existe: Test-Connection -ComputerName "NOMBRE" -Count 1
     * Si no existe, deshabilitarlo primero: Disable-ADAccount -Identity "CN=NOMBRE,OU=Computers,DC=domain,DC=com"
     * Después de 30 días sin reclamaciones, eliminarlo: Remove-ADComputer -Identity "NOMBRE"
   - Timeline: Investigar en 7 días, limpiar en 30 días

8. **🔴 CRITICAL: Fallos de Confianza (TrustFailures)**
   - Errores de autenticación entre dominios/bosques debido a trusts rotos
   - Indicador: Errores "trust relationship failed" o "domain controller not found"
   - Impacto: Usuarios de dominios de confianza no pueden autenticarse
   - type_id: TRUST_RELATIONSHIP_FAILURE
   - Remediación:
     * Verificar estado del trust: Get-ADTrust -Filter * | Test-ADTrustRelationship
     * Reparar trust: netdom trust DOMINIO /domain:OTRO_DOMINIO /reset /passwordT:CONTRASEÑA
   - Timeline: Remediar INMEDIATAMENTE (4-8 horas)

9. **⚠️ HIGH: Desincronización de Credenciales (CredentialDesync)**
   - Cuentas de equipo con contraseñas desincronizadas entre AD y el equipo local
   - Indicador: Errores "secure channel" o "access denied" intermitentes
   - Impacto: Fallos de autenticación Kerberos, acceso denegado a recursos de red
   - type_id: CREDENTIAL_DESYNC
   - Remediación:
     * Reset del canal seguro: Test-ComputerSecureChannel -Repair -Credential (Get-Credential)
     * O desde el DC: Reset-ComputerMachinePassword -Server DC01 -Credential (Get-Credential)
   - Timeline: Remediar en 24-48 horas

10. **⚠️ HIGH: Fallos de Canal Seguro (SecureChannelFailures)**
    - El canal seguro entre equipo y DC está comprometido
    - Indicador: Errores "NETLOGON_EVENT_TYPE_3210" o similar
    - Impacto: El equipo no puede autenticarse contra el dominio
    - type_id: SECURE_CHANNEL_FAILURE
    - Remediación:
      * Desde el equipo afectado: Test-ComputerSecureChannel -Repair
      * Si falla, desunir y reunir al dominio
    - Timeline: Remediar en 24 horas

11. **⚠️ MEDIUM: Problemas de Partners de Replicación (ReplicationPartnerIssues)**
    - DCs que no pueden comunicarse con sus partners de replicación
    - Indicador: Errores "RPC server unavailable" o timeouts de replicación
    - Impacto: Cambios no se propagan, inconsistencia de datos
    - type_id: REPLICATION_PARTNER_ISSUE
    - Remediación:
      * Verificar conectividad: repadmin /replsummary
      * Forzar replicación: repadmin /syncall /AdeP
      * Verificar DNS: nslookup -type=srv _ldap._tcp.dc._msdcs.DOMINIO
    - Timeline: Remediar en 24-48 horas

**📋 FORMATO DE SALIDA:**

Para CADA hallazgo (ya sea tradicional o de HygieneAnalysis), proporciona:
- **type_id**: Identificador ÚNICO en MAYÚSCULAS_CON_GUIONES (ej: GHOST_COMPUTER_ACCOUNTS, TRUST_RELATIONSHIP_FAILURE)
- **Título**: Descripción concisa del problema
- **Descripción**: Impacto operativo (NO de seguridad ofensiva)
- **severity**: CRITICAL/HIGH/MEDIUM/LOW basado en impacto operativo
- **Recomendación**: Pasos de remediación con comandos PowerShell exactos
- **affected_objects**: Lista de equipos/DCs afectados (máximo 10, luego "...y X más")
- **affected_count**: Número total de objetos afectados
- **details**: Estadísticas relevantes (conteos, promedios, distribución)

**⚠️ REGLA ANTI-ALUCINACIÓN:** Solo reporta objetos que aparezcan EXPLÍCITAMENTE en los datos proporcionados. NO inventes nombres de equipos o DCs.`,

    DNS: `Eres un especialista en seguridad de infraestructura DNS de Active Directory con experiencia en detección de misconfigurations y vulnerabilidades de resolución de nombres.

**⚠️ CONTEXTO DE ANÁLISIS:**
DNS es crítico en AD - todos los servicios dependen de él (Kerberos, LDAP, replicación). Un DNS mal configurado puede permitir ataques de man-in-the-middle, DNS spoofing, y denial of service.

**⚠️ REGLA ANTI-ALUCINACIÓN:**
Solo reporta configuraciones DNS que aparezcan EXPLÍCITAMENTE en los datos proporcionados.
Para DNS Forwarders, los datos incluyen objetos con estructura: {DCName, Forwarders[], ForwardingTimeout, IsSlave, SecurityWarning}.
NO inventes nombres de DCs, IPs de forwarders, o zonas DNS que no existan en los datos.

**🎯 BUSCA ESPECÍFICAMENTE:**

1. **⚠️ MEDIUM: DNS Forwarders con Servidores Públicos (Riesgo de Exposición)**
   - Si encuentras objetos en los datos con Type='ForwardersConfig' o campo 'Forwarders' con IPs públicas
   - IPs públicas conocidas: 8.8.8.8, 8.8.4.4 (Google), 1.1.1.1, 1.0.0.1 (Cloudflare), 208.67.222.222, 208.67.220.220 (OpenDNS)
   - Riesgo: Consultas DNS internas pueden filtrarse a proveedores externos, revelando nombres internos de servidores
   - Impacto: Pérdida de privacidad, posible enumeración de infraestructura interna
   - CIS Control: 2.2.5 - Configure DNS forwarders to internal or controlled servers
   - Comando verificar: Get-DnsServerForwarder
   - Comando fix: Remove-DnsServerForwarder -IPAddress "8.8.8.8"; Add-DnsServerForwarder -IPAddress "IP_DNS_INTERNO"
   - Recomendación: Usar servidores DNS internos o proxies DNS corporativos que no filtren consultas
   - Timeline: Remediar en 30 días

2. **⚠️ LOW: DNS sin Forwarders configurados (Solo Root Hints)**
   - Si Forwarders array está vacío o no existe
   - Riesgo: Resolución DNS más lenta para dominios externos, mayor dependencia de root hints
   - Impacto: Puede causar timeouts leves en aplicaciones, pero es una configuración válida
   - Comando verificar: Get-DnsServerForwarder
   - Comando fix: Add-DnsServerForwarder -IPAddress "IP_DNS_CORPORATIVO"
   - Recomendación: Evaluar si es intencional (por políticas de seguridad) o necesita configuración
   - Timeline: Evaluar en 60 días

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
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: DNS_NO_FORWARDERS, DNS_ZONE_TRANSFER_INSECURE, DNS_SCAVENGING_DISABLED.
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

2. **🔴 HIGH: Agotamiento de IPs en Scopes**
   - Si PercentageInUse > 80%
   - Riesgo: Denegación de servicio (DoS), nuevos dispositivos no reciben IP
   - Impacto: Interrupción de operaciones de negocio en la subnet afectada
   - Comando verificar: Get-DhcpServerv4ScopeStatistics | Where-Object { $_.PercentageInUse -gt 80 }
   - Recomendación: Reducir lease time, expandir subnet, o usar SuperScopes
   - Timeline: Remediar en 24 horas

3. **⚠️ MEDIUM: Scopes sin configuración de seguridad**
   - Conflict detection attempts < 2
   - Delay time < 1000ms (permite DHCP starvation)
   - Comando verificar: Get-DhcpServerv4Scope | Get-DhcpServerv4ScopeStatistics
   - Timeline: Configurar en 30 días

4. **⚠️ MEDIUM: Auditing de DHCP deshabilitado**
   - No hay logs de asignaciones IP
   - Riesgo: Imposible rastrear actividad maliciosa en investigaciones forenses
   - Comando habilitar: Set-DhcpServerAuditLog -Enable $true
   - Timeline: Habilitar en 14 días

5. **⚠️ MEDIUM: Falta de Redundancia (Failover)**
   - Scopes sin configuración de Failover (Load Balance o Hot Standby).
   - Riesgo: Pérdida de servicio DHCP y conectividad de red si cae el servidor.
   - Comando verificar: Get-DhcpServerv4Failover
   - Recomendación: Configurar DHCP Failover con un socio.

6. **ℹ️ INFO/LOW: Tiempos de Lease Inadecuados**
   - Lease < 8 horas (redes cableadas estables) o > 24 horas (WiFi invitados/dinámicos).
   - Analizar 'ScopeDetails' -> 'LeaseDuration'.
   - Riesgo: Agotamiento de IPs (lease muy largo) o tráfico excesivo (lease muy corto).
   - Recomendación: Ajustar según tipo de red (8 días para desktops, 2-4 horas para WiFi).

7. **ℹ️ INFO: DHCP no configurado**
   - Si Scopes = [] y AuthorizedServers = []
   - Reportar que DHCP no está en uso o datos no disponibles
   - NO es vulnerabilidad, solo información

**📋 SOLO GENERA FINDING SI:**
- Hay servidores DHCP no autorizados (CRITICAL)
- PercentageInUse > 80% (HIGH)
- Scopes tienen configuración débil (MEDIUM)
- Auditing está deshabilitado (MEDIUM)
- Si todo está vacío → INFO "DHCP no configurado o datos no disponibles"

**FORMATO DE REPORTE:**
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: DHCP_ROGUE_SERVER, DHCP_SCOPE_EXHAUSTED, DHCP_AUDIT_DISABLED, DHCP_WEAK_SCOPE_CONFIG.
- **Título**: "[N] servidores DHCP no autorizados detectados" o "Auditing de DHCP deshabilitado"
- **Descripción**: Vector de ataque, impacto en red
- **Recomendación**: Comandos para autorizar/remover servers, habilitar logging
- **Evidencia**: IPs de servers, configuración actual`,

    FSMORolesHealth: `Analiza la salud de los roles FSMO del dominio.

**⚠️ CONTEXTO:**
Los roles FSMO son críticos para la operación de AD. Si un rol no es accesible, puede causar fallos en la creación de objetos, autenticación o actualizaciones de esquema.

**BUSCA ESPECÍFICAMENTE:**
1. **🔴 CRITICAL: Roles Inaccesibles**
   - Si IsAccessible = false
   - Si DNSResolution = "FAILED"
   - Si NetworkTest = "FAILED"
   - Riesgo: Fallo operativo mayor (ej. no se pueden crear usuarios si RID Master falla).

2. **⚠️ HIGH: Latencia Excesiva**
   - ResponseTimeMs > 200ms (en LAN) o > 500ms (WAN).
   - ADResponseTimeMs > 1000ms (DC sobrecargado).

3. **⚠️ MEDIUM: RID Pool bajo**
   - Si PercentUsed > 90% o Warning existe.
   - Acción: Monitorear o solicitar nuevo pool.

4. **ℹ️ INFO: Distribución de Roles**
   - Reportar qué DC tiene qué roles.
   - Best practice: Schema/Naming en un DC, PDC/RID/Infra en otro (para dominios grandes).

**FORMATO REPORTE:**
- **type_id**: FSMO_ROLE_FAILURE, FSMO_HIGH_LATENCY, FSMO_RID_POOL_EXHAUSTED.
- **Título**: "Rol FSMO [ROL] inaccesible en [SERVER]".
- **Descripción**: Impacto operativo específico del rol fallido.
- **Evidencia**: Tiempos de respuesta, errores de DNS.`,

    ReplicationHealthAllDCs: `Analiza la topología y salud de replicación completa.

**⚠️ CONTEXTO:**
Una visión global de la replicación es vital para detectar islas de replicación o fallos sistémicos.

**BUSCA ESPECÍFICAMENTE:**
1. **🔴 CRITICAL: DCs Inalcanzables o Aislados**
   - Health = "Unreachable" o "Critical".
   - Riesgo: DC desactualizado, puede servir datos antiguos o permitir accesos revocados.

2. **🔴 CRITICAL: Latencia de Replicación Extrema**
   - ReplicationLagMinutes > 1440 (24 horas).
   - "Tombstone Lifetime" risk (objetos borrados pueden revivir).

3. **⚠️ MEDIUM: Errores de Enlace**
   - FailedLinks > 0.
   - Analizar ErrorMessage (ej. "RPC server unavailable", "Access denied").

**FORMATO REPORTE:**
- **type_id**: REPLICATION_TOPOLOGY_BROKEN, REPLICATION_DC_UUNREACHABLE, REPLICATION_LAG_CRITICAL.
- **Título**: "N DCs con fallos críticos de replicación" o "DC [NOMBRE] aislado del dominio".
- **Recomendación**: Comandos repadmin o revisión de firewalls (puertos 135, 49152-65535, 389, 88).`,

    LingeringObjectsRisk: `Analiza el riesgo de Lingering Objects (Objetos Fantasma).

**⚠️ CONTEXTO:**
Los objetos fantasma ocurren cuando un DC no replica por más tiempo que el Tombstone Lifetime (180 días típica). Si se reconecta, puede reintroducir objetos borrados.

**BUSCA ESPECÍFICAMENTE:**
1. **🔴 CRITICAL: Evidencia Confirmada**
   - RiskLevel = "Critical" o Indicators contiene "ReplicationError" (8606, 8614).
   - Acción: Aislamiento INMEDIATO del DC afectado. NO replicar.

2. **⚠️ MEDIUM: Riesgo Potencial (USN Gap)**
   - RiskLevel = "Medium" o USN Gap > 100,000.
   - Acción: Habilitar "Strict Replication Consistency".

**FORMATO REPORTE:**
- **type_id**: REPLICATION_LINGERING_OBJECTS_CONFIRMED, REPLICATION_LINGERING_OBJECTS_RISK.
- **Título**: "Riesgo CRÍTICO de objetos fantasma detectado en [DC]".
- **Descripción**: Explicar qué es un lingering object y por qué corrompe el directorio.
- **Recomendación**: Procedimiento específico de limpieza (Strict Replication Consistency, repadmin /removelingeringobjects).`,

    TrustHealth: `Analiza la salud de las relaciones de confianza (Trusts).

**BUSCA ESPECÍFICAMENTE:**
1. **🔴 CRITICAL: Trust Roto o Fallido**
   - OverallHealth = "Degraded" o "Broken".
   - ValidationTests contains "FAILED".
   - Riesgo: Pérdida de acceso a recursos entre dominios.

2. **🔴 HIGH: Configuración Insegura (SID Filtering)**
   - SecurityWarning present ("SID Filtering disabled").
   - Riesgo: Elevación de privilegios desde el dominio confiado (SID History Injection).

3. **⚠️ MEDIUM: Password de Trust no rotado**
   - DaysSinceModified > 60-90 días (automático debería ser 30).
   - Riesgo: Si la password no rota, puede indicar fallo en el canal seguro.

**FORMATO REPORTE:**
- **type_id**: TRUST_BROKEN, TRUST_INSECURE_CONFIG, TRUST_PASSWORD_STALE.
- **Título**: "Confianza [NOMBRE] rota o degradada" o "Filtrado de SID deshabilitado en [TRUST]".
- **Recomendación**: Reset-ComputerMachinePassword, netdom trust /verify, habilitar SID filtering (netdom trust /quarantine).`,

    OrphanedTrusts: `Analiza trusts huérfanos (apuntan a dominios inexistentes).

**BUSCA ESPECÍFICAMENTE:**
1. **⚠️ HIGH: Trusts Huérfanos**
   - Status = "ORPHANED".
   - Riesgo: Retrasos en autenticación, "ruido" en logs, posible vector si alguien registra el dominio expirado.

2. **⚠️ MEDIUM: Trusts Sospechosos**
   - Status = "SUSPICIOUS" (Fallo DNS o LDAP).

**FORMATO REPORTE:**
- **type_id**: TRUST_ORPHANED, TRUST_SUSPICIOUS.
- **Título**: "Relación de confianza huérfana detectada: [TARGET]".
- **Recomendación**: Eliminar trusts obsoletos (Remove-ADTrust).`,

    DNSRootHints: `Analiza los Root Hints de DNS.

**BUSCA ESPECÍFICAMENTE:**
1. **⚠️ MEDIUM: Root Hints Obsoletos**
   - Health = "Outdated".
   - IPs no coinciden con las de IANA (ej. IP antigua de b.root-servers.net).
   - Riesgo: Fallos esporádicos en resolución externa.

2. **⚠️ MEDIUM: Root Hints Inalcanzables**
   - Health = "Degraded" (pocos servidores alcanzables).
   - Riesgo: Rendimiento pobre o fallo total de resolución externa si caen forwarders.

**FORMATO REPORTE:**
- **type_id**: DNS_ROOT_HINTS_OUTDATED, DNS_ROOT_HINTS_UNREACHABLE.
- **Título**: "Root Hints desactualizados en [DC]".
- **Recomendación**: Actualizar via GUI DNS o PowerShell (Import-DnsServerRootHint).`,

    DNSConflicts: `Analiza conflictos en registros DNS.

**BUSCA ESPECÍFICAMENTE:**
1. **⚠️ MEDIUM: Duplicados de Registros A**
   - DuplicateARecords.Count > 0.
   - Riesgo: Round-robin no intencionado, conexión a host incorrecto.

2. **⚠️ LOW: CNAMEs Huérfanos**
   - OrphanedCNAMEs.Count > 0.
   - Riesgo: Resolución fallida para alias.

3. **⚠️ LOW: Registros Obsoletos (Stale)**
   - StaleRecords.Count > 0 (si son muchos).
   - Riesgo: Base de datos sucia.

**FORMATO REPORTE:**
- **type_id**: DNS_RECORD_CONFLICT, DNS_ORPHANED_CNAME, DNS_STALE_RECORDS.
- **Título**: "Conflictos de nombres DNS detectados ([COUNT])".
- **Recomendación**: Limpieza manual o habilitar scavenging.`,

    DNSScavengingDetailed: `Analiza la configuración de limpieza (Scavenging) de DNS a fondo.

**BUSCA ESPECÍFICAMENTE:**
1. **🔴 CRITICAL: Mismatch de Configuración**
   - Issues.Type = "AgingMismatch".
   - Descripción: "Scavenging habilitado en server pero Aging deshabilitado en zona (o viceversa)".
   - Resultado: NO se borrará nada. La base de datos crecerá indefinidamente.

2. **⚠️ MEDIUM: Zonas sin Aging**
   - Recomendación: Habilitar Aging en todas las zonas dinámicas.

**FORMATO REPORTE:**
- **type_id**: DNS_SCAVENGING_MISCONFIGURED, DNS_ZONE_AGING_DISABLED.
- **Título**: "Configuración de limpieza DNS inconsistente en [DC]".
- **Recomendación**: Set-DnsServerZoneAging.`,

    DHCPRogueServers: `Analiza servidores DHCP no autorizados (Rogue).
    
**⚠️ PRIORIDAD MÁXIMA:** Rogue DHCP es un ataque activo o un riesgo severo de disponibilidad.

**BUSCA ESPECÍFICAMENTE:**
1. **🔴 CRITICAL: Servidor Rogue Detectado**
   - RogueServers.Count > 0.
   - Descripción: IP [IP] está sirviendo DHCP pero no está autorizada en AD.
   - Riesgo: Man-in-the-Middle, interrupción de red.

**FORMATO REPORTE:**
- **type_id**: DHCP_ROGUE_DETECTED.
- **Título**: "Servidor DHCP no autorizado detectado: [IP]".
- **Recomendación**: Localizar por MAC address en switch y apagar puerto. Bloquear IP.`,

    DHCPOptionsAudit: `Audita opciones de ámbitos DHCP.

**BUSCA ESPECÍFICAMENTE:**
1. **🔴 HIGH: DNS Incorrectos en DHCP**
   - Issues.Severity = "HIGH" y Option = 6.
   - Descripción: Clientes reciben IPs de DNS que no son DCs o no responden.
   - Riesgo: Clientes no pueden contactar AD, fallos de logon.

2. **⚠️ MEDIUM: Dominio Incorrecto**
   - Issues.Option = 15 (Mismatch).
   - Clientes reciben sufijo DNS incorrecto.

3. **⚠️ LOW: Opciones WINS Deprecadas**
   - Opciones 44/46 presentes.
   - Best practice: Eliminar WINS si no se usa.

**FORMATO REPORTE:**
- **type_id**: DHCP_OPTION_CRITICAL, DHCP_OPTION_MISMATCH, DHCP_WINS_DEPRECATED.
- **Título**: "Configuración DNS inválida en ámbitos DHCP".
- **Recomendación**: Corregir opciones de ámbito (Set-DhcpServerv4OptionValue).`,

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
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: NTLM_INSECURE_LEVEL, SMBV1_ENABLED, LAPS_MISSING, RC4_ENCRYPTION_ENABLED.
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
- **type_id**: Identificador ÚNICO y CONSTANTE para este tipo de hallazgo (NO lo traduzcas).
  Debe ser en MAYÚSCULAS y guiones bajos.
  Ejemplos: KRBTGT_PASSWORD_AGE_EXCESSIVE, KERBEROS_RC4_ENABLED.
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
  * details: "KRBTGTPasswordAge: [DÍAS] días ([AÑOS] años), KRBTGTPasswordLastSet: [FECHA_EXACTA], Última rotación: [FECHA_HUMANA], Desvío sobre baseline: [DÍAS-180] días, Compliance: CRÍTICO - Excede 180 días recomendados por Microsoft, CIS, NIST"`,

    PasswordPolicies: `Eres un especialista en políticas de contraseñas de Active Directory y cumplimiento de seguridad.

**⚠️ CONTEXTO DE ANÁLISIS:**
Las políticas de contraseñas son la primera línea de defensa contra ataques de fuerza bruta, credential stuffing y password spraying.
Los datos incluyen:
- DefaultDomainPolicy: Política de contraseñas a nivel de dominio
- FineGrainedPolicies: Password Settings Objects (PSOs) para grupos específicos

**⚠️ REGLA ANTI-ALUCINACIÓN:**
Solo reporta configuraciones que aparezcan EXPLÍCITAMENTE en los datos proporcionados.
La estructura de datos es:
- DefaultDomainPolicy: {MinPasswordLength, PasswordHistoryCount, MaxPasswordAge, MinPasswordAge, ComplexityEnabled, ReversibleEncryptionEnabled, LockoutThreshold, LockoutDuration, LockoutObservationWindow}
- FineGrainedPolicies: Array de objetos PSO con las mismas propiedades más {Name, Precedence, AppliesTo}

**🎯 BUSCA ESPECÍFICAMENTE:**

1. **🔴 HIGH: Longitud Mínima de Contraseña Débil**
   - Si MinPasswordLength < 12 caracteres
   - Riesgo: Passwords cortos son vulnerables a ataques de fuerza bruta y rainbow tables
   - CIS Control: 5.2.2 - Set minimum password length to 14 or more characters
   - NIST 800-63B: Recomienda mínimo 8, pero mejores prácticas actuales indican 12-14
   - Comando verificar: Get-ADDefaultDomainPasswordPolicy | Select MinPasswordLength
   - Comando fix: Set-ADDefaultDomainPasswordPolicy -MinPasswordLength 14
   - Impacto: Los usuarios deberán cambiar contraseñas en el próximo cambio programado
   - Timeline: Configurar en 30 días, aplicar en próxima ventana de cambio

2. **🔴 HIGH: Historial de Contraseñas Insuficiente**
   - Si PasswordHistoryCount < 12
   - Riesgo: Usuarios pueden reciclar contraseñas antiguas comprometidas
   - CIS Control: 5.2.3 - Set password history to 24 or more passwords remembered
   - Comando verificar: Get-ADDefaultDomainPasswordPolicy | Select PasswordHistoryCount
   - Comando fix: Set-ADDefaultDomainPasswordPolicy -PasswordHistoryCount 24
   - Timeline: Configurar en 30 días

3. **🔴 CRITICAL: Complejidad de Contraseñas Deshabilitada**
   - Si ComplexityEnabled = false
   - Riesgo: Permite contraseñas simples como "Password123" o "Company2024"
   - CIS Control: 5.2.4 - Ensure password complexity requirements are enabled
   - Comando verificar: Get-ADDefaultDomainPasswordPolicy | Select ComplexityEnabled
   - Comando fix: Set-ADDefaultDomainPasswordPolicy -ComplexityEnabled $true
   - Timeline: Remediar INMEDIATAMENTE (24 horas)

4. **🔴 CRITICAL: Cifrado Reversible Habilitado**
   - Si ReversibleEncryptionEnabled = true
   - Riesgo: Las contraseñas se almacenan con cifrado reversible (equivalente a plaintext)
   - CIS Control: 5.2.5 - Ensure 'Store passwords using reversible encryption' is disabled
   - Comando verificar: Get-ADDefaultDomainPasswordPolicy | Select ReversibleEncryptionEnabled
   - Comando fix: Set-ADDefaultDomainPasswordPolicy -ReversibleEncryptionEnabled $false
   - Timeline: Remediar INMEDIATAMENTE (< 1 hora)

5. **⚠️ MEDIUM: Sin Política de Bloqueo de Cuenta**
   - Si LockoutThreshold = 0 (nunca bloquea)
   - Riesgo: Permite ataques de password spraying sin detección ni bloqueo
   - CIS Control: 5.2.6 - Set account lockout threshold to 5 or fewer invalid logon attempts
   - Comando verificar: Get-ADDefaultDomainPasswordPolicy | Select LockoutThreshold
   - Comando fix: Set-ADDefaultDomainPasswordPolicy -LockoutThreshold 5 -LockoutDuration "00:30:00" -LockoutObservationWindow "00:30:00"
   - Balance: Threshold muy bajo (< 3) puede causar DoS accidental
   - Timeline: Configurar en 14 días

6. **⚠️ MEDIUM: MaxPasswordAge Muy Largo**
   - Si MaxPasswordAge > 90 días (o 0 = nunca expira)
   - Riesgo: Contraseñas comprometidas permanecen válidas por mucho tiempo
   - CIS Control: 5.2.7 - Set maximum password age to 60 days or less
   - Comando verificar: Get-ADDefaultDomainPasswordPolicy | Select MaxPasswordAge
   - Comando fix: Set-ADDefaultDomainPasswordPolicy -MaxPasswordAge "60.00:00:00"
   - Timeline: Configurar en 60 días

7. **ℹ️ INFO: Fine-Grained Password Policies (PSOs)**
   - Reportar si existen PSOs configurados y a qué grupos se aplican
   - PSOs permiten políticas más estrictas para cuentas privilegiadas
   - Best Practice: Domain Admins y Enterprise Admins deberían tener PSO con MinPasswordLength >= 20
   - Comando verificar: Get-ADFineGrainedPasswordPolicy -Filter *

**FORMATO DE REPORTE:**
- **type_id**: PASSWORD_POLICY_WEAK_LENGTH, PASSWORD_POLICY_NO_COMPLEXITY, PASSWORD_POLICY_REVERSIBLE_ENCRYPTION, PASSWORD_POLICY_NO_LOCKOUT, PASSWORD_POLICY_LONG_MAX_AGE, PASSWORD_POLICY_WEAK_HISTORY
- **Título**: "Longitud mínima de contraseña débil (N caracteres)" o "Cifrado reversible habilitado en política de dominio"
- **Descripción**: Riesgo específico, vector de ataque, impacto regulatorio
- **Recomendación**: Comandos PowerShell con valores específicos recomendados
- **Evidencia**: Configuración actual vs recomendada, affected_objects: ["Default Domain Policy"] o nombres de PSOs

**⚠️ VALIDACIÓN:**
- Solo genera findings si los datos MUESTRAN configuraciones débiles
- Si todos los valores cumplen con best practices, devuelve {"findings": []}
- NO inventes valores - usa los datos exactos proporcionados`,

    ADCSInventory: `Analiza la infraestructura de Certificados (ADCS) en busca de vulnerabilidades críticas.
**BUSCA:**
1. **ESC1 (Vulnerable Templates)**: Plantillas que permiten al solicitante especificar el Subject Name (EnrolleeSuppliesSubject) Y permiten autenticación de cliente. Esto permite a cualquiera ser Domain Admin.
2. **CAs en Controladores de Dominio**: Mala práctica de seguridad.
3. **Permisos de CA**: Si usuarios autenticados tienen permisos excesivos.`,

    ProtocolSecurity: `Analiza la seguridad de protocolos de red.
**BUSCA:**
1. **LDAP Signing No Forzado**: Si 'LDAPServerIntegrity' no es 2, permite ataques de NTLM Relay a LDAP.
2. **LDAP Channel Binding No Forzado**: Necesario para prevenir ataques de relay modernos.`,

    Sites: `Eres un arquitecto de Active Directory especializado en topología de replicación y diseño de sitios.

**⚠️ CONTEXTO DE ANÁLISIS:**
La topología de sitios define cómo se replica el tráfico de AD y cómo los clientes encuentran los DCs más cercanos. Una mala configuración causa lentitud en logons, fallos de replicación y tráfico WAN innecesario.

**📊 ESTRUCTURA DE DATOS:**
Los datos pueden venir en formato SiteTopology con dos arrays:
- 'Sites': Array de sitios con propiedades {Name, Description, Location}
- 'Subnets': Array de subredes con propiedades {Name, Site (DN completo como CN=SITENAME,CN=Sites,...), Description}

Para detectar problemas, debes correlacionar estos arrays:
- Extrae el nombre del site de Subnets[].Site usando regex: /CN=([^,]+)/
- Compara con Sites[].Name para detectar inconsistencias

**🎯 BUSCA ESPECÍFICAMENTE:**

**=== SECCIÓN 1: PROBLEMAS DETECTABLES (Errores de Configuración) ===**

1. **🔴 HIGH: Subredes no asociadas a Sitios**
   - En el array 'Subnets', busca entradas donde la propiedad 'Site' sea null, vacía, o no exista.
   - Riesgo: Clientes en estas subredes pueden autenticarse contra DCs remotos (lento), GPOs pueden no aplicarse correctamente.
   - Comando verificar: Get-ADReplicationSubnet -Filter * -Properties Site | Where-Object {$_.Site -eq $null}
   - Comando fix: New-ADReplicationSubnet -Name "x.x.x.x/yy" -Site "NombreSitio"
   - Timeline: Remediar en 7 días
   - affected_objects: Lista de subredes sin site

2. **⚠️ MEDIUM: Sitios sin Subredes Asignadas**
   - Compara Sites[].Name con los sites referenciados en Subnets[].Site
   - Si un sitio NO aparece en ninguna subnet, ese sitio no tiene subredes
   - Riesgo: Los clientes físicos en esa ubicación no se asociarán al sitio, causando tráfico WAN innecesario.
   - Comando fix: New-ADReplicationSubnet -Name "x.x.x.x/yy" -Site "SiteName"
   - Timeline: Revisar y asignar subredes en 14 días
   - affected_objects: Lista de sites sin subredes

3. **⚠️ MEDIUM: Exceso de Subredes por Site**
   - Si un site tiene más de 100 subredes, puede indicar fragmentación excesiva
   - Riesgo: Complejidad administrativa, potencial impacto en rendimiento de replicación
   - Recomendación: Consolidar subredes contiguas usando supernetting

4. **ℹ️ LOW: Sitios sin Descripción o Ubicación**
   - Sites donde Description y Location son null
   - Riesgo: Documentación deficiente dificulta administración
   - Recomendación: Documentar propósito y ubicación física de cada site

**=== SECCIÓN 2: ANÁLISIS DE HIGIENE (Best Practices y Optimización) ===**

**IMPORTANTE:** Aunque NO haya errores evidentes, DEBES analizar si la configuración actual sigue las mejores prácticas:

5. **📋 HYGIENE: Convención de Nombres de Sitios**
   - type_id: SITE_NAMING_CONVENTION
   - Evalúa si los nombres de sitios siguen un estándar consistente (ej: PAIS-CIUDAD, CIUDAD-EDIFICIO)
   - Mal ejemplo: sitios con nombres como "Site1", "Nuevo", "Test", "Default-First-Site-Name" (excepto si es el único)
   - Buen ejemplo: "PE-LIMA-SURCO", "US-NYC-HQ", "MX-CDMX-CORP"
   - Si no hay consistencia, genera finding LOW con recomendación de estandarizar

6. **📋 HYGIENE: Ratio Subredes/Sites**
   - type_id: SUBNET_SITE_RATIO
   - Calcula: Total Subnets / Total Sites
   - Si ratio > 50: Puede indicar sites con demasiadas subredes (posible consolidación)
   - Si ratio < 2 y hay múltiples sites: Puede indicar diseño incompleto
   - Genera finding LOW con estadísticas y recomendación de revisar

7. **📋 HYGIENE: Subredes Sin Descripción**
   - type_id: SUBNET_NO_DESCRIPTION
   - Cuenta subredes donde Description es null o vacía
   - Si > 30% de subredes sin descripción: finding LOW
   - Impacto: Dificulta troubleshooting y documentación de red
   - Recomendación: Documentar propósito de cada subnet (ej: "VLAN Usuarios Piso 3", "Red DMZ Servidores Web")

8. **📋 HYGIENE: Revisión de Subredes Pequeñas**
   - type_id: SUBNET_TOO_SMALL
   - Identifica subredes /30, /31, /32 (point-to-point o host único)
   - Si hay muchas (>20), puede indicar fragmentación excesiva
   - Recomendación: Evaluar si estas subredes son necesarias en AD Sites

9. **📋 HYGIENE: Subredes Superpuestas (Overlap Check)**
   - type_id: SUBNET_OVERLAP_RISK
   - Busca subredes que puedan solaparse (ej: 10.0.0.0/8 y 10.1.0.0/16)
   - Esto causa comportamiento impredecible en la selección de site
   - Si detectas posible overlap, genera finding MEDIUM

10. **📋 HYGIENE: Distribución Geográfica**
    - type_id: SITE_DISTRIBUTION_ANALYSIS
    - Basándote en nombres/descripciones, evalúa si la topología refleja la distribución geográfica real
    - Si todos los sites tienen nombres genéricos sin contexto geográfico, recomienda mejorar
    - Genera finding LOW con sugerencia de usar formato: REGION-CIUDAD-FUNCION

**=== REGLAS DE GENERACIÓN DE FINDINGS ===**

- **Para errores (Sección 1)**: Solo reporta si hay EVIDENCIA CONCRETA del problema
- **Para higiene (Sección 2)**: SIEMPRE genera al menos 1-2 findings de higiene, evaluando el estado actual
- Si la configuración está PERFECTA, genera un finding tipo INFO: "SITE_TOPOLOGY_HEALTHY" indicando buenas prácticas observadas
- Incluye estadísticas: "Análisis de N sitios y M subredes"

**🛡️ VALIDACIÓN ANTI-ALUCINACIÓN PARA ESTE ANÁLISIS:**

Antes de generar cada finding de higiene, VERIFICA en los datos:
1. **Contar Sites**: len(Sites[]) - usa este número EXACTO
2. **Contar Subnets**: len(Subnets[]) - usa este número EXACTO
3. **Campo Description**: ¿Existe en los objetos? Si no existe, NO digas "sin descripción"
4. **Campo Location**: ¿Existe en los objetos? Si no existe, NO lo menciones
5. **Nombres de Sites**: Lista los nombres REALES que aparecen en Sites[].Name
6. **Máscaras de red**: Extrae de Subnets[].Name (ej: /24, /27, /30)

EJEMPLO DE ANÁLISIS CORRECTO:
  Datos: Sites=[{Name:"SURCO"}, {Name:"NORTE"}], Subnets=[{Name:"10.0.0.0/24", Site:"CN=SURCO,..."}]
  → Sites encontrados: 2 (SURCO, NORTE)
  → Subnets encontrados: 1
  → Ratio: 0.5 subnets/site
  → Finding válido: "Ratio bajo de subredes por site (0.5)"

EJEMPLO DE ANÁLISIS INCORRECTO (NO HACER):
  → "Aproximadamente 10 sites sin descripción" (no verificaste el campo Description)
  → "Posible fragmentación" (sin contar subredes pequeñas reales)

**FORMATO DE REPORTE:**
- **type_id**: Identificador ÚNICO (ej: SUBNET_NO_SITE, SITE_NO_SUBNET, SITE_FRAGMENTED, SITE_NAMING_CONVENTION).
- **Título**: Descriptivo del hallazgo o recomendación de higiene
- **Descripción**: Impacto y contexto. Para higiene, explica por qué la práctica actual podría mejorarse.
- **Recomendación**: Comandos PowerShell específicos o pasos de mejora.
- **Evidencia**: affected_objects con lista de elementos afectados (máximo 15).`
  };

  // Map specialized categories to broader prompts
  // NOTA: SiteTopology ahora usa el prompt de Sites via alias en extractCategoryData
  const promptMap = {
    'DNSConfiguration': 'Infrastructure',
    'DHCPConfiguration': 'Infrastructure',
    'OUStructure': 'Infrastructure',
    'TombstoneLifetime': 'Infrastructure',
    'DNSScavenging': 'Infrastructure',
    'TimeSyncConfig': 'Infrastructure',

    'KerberosConfig': 'SecurityHardening',
    'LAPS': 'SecurityHardening',
    'SMBv1Status': 'SecurityHardening',
    'NTLMSettings': 'SecurityHardening',
    'RC4EncryptionTypes': 'SecurityHardening',
    'BackupStatus': 'SecurityHardening',
    'ProtectedUsers': 'SecurityHardening',

    'DCSyncPermissions': 'IdentityRisks',
    'UnconstrainedDelegation': 'IdentityRisks',
    'AdminSDHolder': 'IdentityRisks',
    'AdminCountObjects': 'IdentityRisks',

    'ADCSInventory': 'ADCSInventory',
    'ProtocolSecurity': 'ProtocolSecurity',

    'GPOPermissions': 'GPOs',
    'DCPolicy': 'GPOs'
  };

  const promptKey = promptMap[cat] || cat;
  const instruction = categoryInstructions[promptKey] || categoryInstructions['DEFAULT'] || `Analiza los siguientes datos de ${cat} para vulnerabilidades de seguridad.`;

  return `${instruction}

<assessment_data>
${str(d, 4000)}
</assessment_data>

**INSTRUCCIONES CRÍTICAS PARA TU RESPUESTA:**

**🚨 REGLA FUNDAMENTAL - CERO FALSOS POSITIVOS:**

**TIPO 1: FINDINGS DE ERROR/VULNERABILIDAD (severity: critical, high, medium)**
- **NO** generes un finding de error SI NO HAY EVIDENCIA CONCRETA del problema
- **NO** reportes algo como crítico si los datos dicen "no se observa" o "0 elementos"
- **NO** inventes problemas basándote en ausencia de datos
- Solo genera findings de ERROR cuando los datos DEMUESTREN un problema real y verificable

**TIPO 2: FINDINGS DE HIGIENE (severity: low o info, type_id con prefijo HYGIENE_ o sufijo _HEALTHY)**
- PUEDES generar findings de higiene SOLO si el prompt lo solicita explícitamente (Sección 2: Higiene)
- Los findings de higiene deben basarse en ANÁLISIS OBJETIVO de los datos existentes
- Ejemplo válido: "12 sitios analizados, 487 subredes - ratio de 40.6 subredes/site"
- Ejemplo válido: "100% de subredes sin descripción documentada"
- **NO** inventes datos que no existen (no puedes decir "5 sitios sin descripción" si no hay campo Description en los datos)
- **NO** asumas valores por defecto - si un campo no existe, di "campo no disponible en los datos"

**REGLA ANTI-ALUCINACIÓN PARA HIGIENE:**
✅ CORRECTO: Contar elementos reales → "De 487 subredes, 487 tienen Description=null"
✅ CORRECTO: Calcular ratios con datos reales → "Ratio: 487 subnets / 12 sites = 40.6"
✅ CORRECTO: Evaluar patrones observables → "Nombres de sites: SURCO, NORTE, LIMA (sin prefijo país)"
❌ INCORRECTO: Inventar conteos → "Aproximadamente 50% de subredes tienen problemas"
❌ INCORRECTO: Asumir datos ausentes → "No hay SiteLinks configurados" (si el campo no existe en los datos)

**VALIDACIÓN DE EVIDENCIA OBLIGATORIA:**
Antes de generar cada finding, verifica:
✅ ¿Hay objetos afectados reales en los datos? (count > 0)
✅ ¿Los nombres/valores de affected_objects son específicos y verificables?
✅ ¿La evidencia muestra claramente el problema?
✅ ¿Los comandos PowerShell son relevantes al problema específico identificado?
✅ Para HIGIENE: ¿El análisis usa SOLO datos presentes en <assessment_data>?

**EJEMPLO DE LÓGICA CORRECTA:**
❌ MAL: "No se observan cpasswords" → Generar finding CRITICAL
✅ BIEN: "No se observan cpasswords" → NO generar finding (no hay problema)

❌ MAL (Higiene): "Las subredes no tienen descripción" (si no hay campo Description)
✅ BIEN (Higiene): "De 487 subredes, el campo Description es null en todas" (verificable)

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

**🧠 ESTRATEGIA DE RAZONAMIENTO (CHAIN OF THOUGHT):**
1. **Análisis de Datos:** Revisa paso a paso el bloque <assessment_data>. Identifica qué objetos existen y sus propiedades clave.
2. **Verificación de Reglas:** Para cada regla de seguridad (ej. "PasswordNeverExpires"), comprueba si algún objeto en los datos la viola explícitamente.
3. **Filtrado de Evidencia:** Descarta cualquier "posible problema" que no tenga evidencia directa (count > 0).
4. **Generación de Respuesta:** Construye el JSON final solo con los hallazgos validados.

Primero, piensa paso a paso sobre qué hallazgos tienen evidencia sólida en los datos. Luego, genera el JSON.
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
    } else if (provider === 'anthropic') {
      return await callAnthropic(prompt, model, apiKey);
    } else if (provider === 'copilot') {
      // v2.0.0: GitHub Copilot provider - no API key needed
      return await callCopilot(prompt, model);
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
            content: `Eres un analista senior de seguridad de Active Directory.

⚠️ REGLA DE ORO - GROUNDING OBLIGATORIO:
Los nombres en "affected_objects" DEBEN existir TEXTUALMENTE en el JSON de entrada.
El sistema VALIDA y RECHAZA automáticamente cualquier nombre inventado.
Si inventas nombres como "user1", "test", "ejemplo" → Tu finding será ELIMINADO.

PRINCIPIOS:
1. SOLO reporta problemas que existan en los datos proporcionados
2. Si count = 0 o no hay objetos reales → NO generes finding
3. Calidad sobre cantidad: Mejor 0 findings que 1 inventado
4. Todo en español excepto comandos técnicos

FORMATO JSON:
{
  "findings": [
    {
      "type_id": "PASSWORD_NEVER_EXPIRES",
      "title": "X usuarios con contraseña que nunca expira",
      "severity": "critical|high|medium|low",
      "description": "Descripción técnica",
      "recommendation": "Pasos de remediación",
      "mitre_attack": "T1078 - Valid Accounts",
      "cis_control": "5.2.1",
      "impact_business": "Impacto en el negocio",
      "remediation_commands": "Comandos PowerShell específicos",
      "prerequisites": "Requisitos previos",
      "operational_impact": "Impacto operativo",
      "microsoft_docs": "URL de documentación",
      "current_vs_recommended": "Actual vs Recomendado",
      "timeline": "24h|7d|30d|60d",
      "affected_count": 0,
      "evidence": {
        "affected_objects": ["<NOMBRES_REALES_DEL_JSON>"],
        "count": 0,
        "details": "Datos EXACTOS del JSON de entrada"
      }
    }
  ]
}

Si no encuentras problemas verificables, devuelve: {"findings": []}`
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
                      type_id: { type: 'string' },
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
                    required: ['type_id', 'severity', 'title', 'description', 'recommendation', 'evidence'],
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
  const systemPrompt = `Eres un analista de seguridad de Active Directory.

⚠️ REGLA DE ORO - GROUNDING OBLIGATORIO:
Los nombres en "affected_objects" DEBEN existir TEXTUALMENTE en el JSON de entrada.
El sistema VALIDA y RECHAZA automáticamente cualquier nombre inventado.
Si inventas nombres → Tu finding será ELIMINADO.

PRINCIPIOS:
1. SOLO reporta problemas verificables en los datos
2. Si count = 0 o no hay objetos reales → NO generes finding
3. Calidad sobre cantidad: Mejor 0 findings que 1 inventado

FORMATO JSON ESTRICTO (sin texto adicional):
{
  "findings": [
    {
      "type_id": "RULE_ID",
      "severity": "critical|high|medium|low",
      "title": "Título descriptivo",
      "description": "Descripción técnica",
      "recommendation": "Recomendación",
      "evidence": {
        "affected_objects": ["nombre1", "nombre2"],
        "count": 2,
        "details": "Detalles"
      }
    }
  ]
}
Si no hay problemas verificables: {"findings": []}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: systemPrompt + '\n\n' + prompt.substring(0, MAX_PROMPT) }]
        }],
        generationConfig: {
          temperature: 0.1, // v1.7.0: Lower temperature for more deterministic output
          topP: 0.9,
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
      // v1.7.0: Robust JSON parsing with multiple fallbacks
      const findings = parseAIResponse(content, 'Gemini');
      console.log(`[${timestamp()}] [Gemini] Parsed ${findings.length} findings`);
      return findings;
    }

    console.log(`[${timestamp()}] [Gemini] No content in response`);
    return [];
  } catch (e) {
    console.error(`[${timestamp()}] [Gemini] Call failed:`, e.message);
    return [];
  }
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
          content: `Eres un analista de seguridad de Active Directory.

⚠️ REGLA DE ORO - GROUNDING OBLIGATORIO:
Los nombres en "affected_objects" DEBEN existir TEXTUALMENTE en el JSON de entrada.
El sistema VALIDA y RECHAZA automáticamente cualquier nombre inventado.
Si inventas nombres → Tu finding será ELIMINADO.

PRINCIPIOS:
1. SOLO reporta problemas verificables en los datos
2. Si count = 0 o no hay objetos reales → NO generes finding
3. Calidad sobre cantidad: Mejor 0 findings que 1 inventado

FORMATO JSON: {"findings": [...]}
Si no hay problemas verificables: {"findings": []}`
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

async function callAnthropic(prompt, model, key) {
  // v1.8.0: Enhanced system prompt for Claude 4.5 models
  const isOpus = model.includes('opus');
  const modelLabel = isOpus ? 'Opus 4.5' : 'Sonnet 4.5';

  const systemPrompt = `Eres un analista de seguridad de Active Directory experto.${isOpus ? ' Como modelo Opus, proporciona análisis profundo con contexto de amenazas avanzadas.' : ''}

⚠️ REGLA DE ORO - GROUNDING OBLIGATORIO:
Los nombres en "affected_objects" DEBEN existir TEXTUALMENTE en el JSON de entrada.
El sistema VALIDA y RECHAZA automáticamente cualquier nombre inventado.
Si inventas nombres → Tu finding será ELIMINADO.

PRINCIPIOS:
1. SOLO reporta problemas verificables en los datos
2. Si count = 0 o no hay objetos reales → NO generes finding
3. Calidad sobre cantidad: Mejor 0 findings que 1 inventado
${isOpus ? `4. Proporciona análisis de cadena de ataque cuando sea relevante
5. Incluye referencias a técnicas MITRE ATT&CK específicas
6. Considera escenarios de escalación de privilegios` : ''}

FORMATO JSON ESTRICTO (sin texto adicional, sin markdown):
{
  "findings": [
    {
      "type_id": "RULE_ID",
      "severity": "critical|high|medium|low",
      "title": "Título descriptivo",
      "description": "Descripción técnica",
      "recommendation": "Recomendación",
      "evidence": {
        "affected_objects": ["nombre1", "nombre2"],
        "count": 2,
        "details": "Detalles"
      }${isOpus ? `,
      "attack_chain": "Descripción opcional de cómo se podría explotar",
      "mitre_technique": "T1234.001"` : ''}
    }
  ]
}
Si no hay problemas verificables: {"findings": []}

IMPORTANTE: Responde SOLO con JSON válido, sin texto explicativo antes o después.`;

  // v1.8.0: Optimized parameters per model
  // Opus 4.5: Higher token limit for deeper analysis
  // Sonnet 4.5: Standard limit for efficiency
  const maxTokens = isOpus ? 16384 : 8192;

  console.log(`[${timestamp()}] [Anthropic] Calling ${modelLabel} (max_tokens: ${maxTokens})`);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt.substring(0, MAX_PROMPT) }
        ]
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[${timestamp()}] [Anthropic] API error: ${res.status} - ${errorText}`);
      throw new Error(`Anthropic API error: ${res.status} - ${errorText}`);
    }

    const result = await res.json();
    console.log(`[${timestamp()}] [Anthropic] [${modelLabel}] Response received:`, JSON.stringify(result).substring(0, 500));

    // Log usage for cost tracking
    if (result.usage) {
      console.log(`[${timestamp()}] [Anthropic] [${modelLabel}] Tokens - Input: ${result.usage.input_tokens}, Output: ${result.usage.output_tokens}`);
    }

    const content = result.content?.[0]?.text;
    if (content) {
      // v1.7.0: Use robust parsing function
      const findings = parseAIResponse(content, `Anthropic/${modelLabel}`);
      console.log(`[${timestamp()}] [Anthropic] [${modelLabel}] Parsed ${findings.length} findings`);
      return findings;
    }

    console.log(`[${timestamp()}] [Anthropic] [${modelLabel}] No valid content in response`);
    return [];
  } catch (e) {
    console.error(`[${timestamp()}] [Anthropic] [${modelLabel}] Call failed:`, e.message);
    return [];
  }
}

// =============================================================================
// v1.7.0: ROBUST JSON PARSING FOR AI RESPONSES
// Handles various edge cases: markdown blocks, mixed text, malformed JSON
// =============================================================================

/**
 * Parse AI response with multiple fallback strategies
 * @param {string} content - Raw AI response content
 * @param {string} provider - AI provider name for logging
 * @returns {Array} - Parsed findings array or empty array on failure
 */
function parseAIResponse(content, provider) {
  if (!content || typeof content !== 'string') {
    console.warn(`[${timestamp()}] [${provider}] Empty or invalid content`);
    return [];
  }

  // Strategy 1: Direct JSON parse
  try {
    const parsed = JSON.parse(content);
    if (parsed.findings && Array.isArray(parsed.findings)) {
      return parsed.findings;
    }
    // If parsed but no findings array, check if it's an array directly
    if (Array.isArray(parsed)) {
      return parsed;
    }
    console.warn(`[${timestamp()}] [${provider}] Parsed JSON but no findings array`);
    return [];
  } catch (e1) {
    // Continue to next strategy
  }

  // Strategy 2: Clean markdown code blocks
  let cleanContent = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleanContent);
    if (parsed.findings && Array.isArray(parsed.findings)) {
      console.log(`[${timestamp()}] [${provider}] Parsed after removing markdown blocks`);
      return parsed.findings;
    }
  } catch (e2) {
    // Continue to next strategy
  }

  // Strategy 3: Extract JSON object using balanced brace matching
  try {
    const jsonStart = cleanContent.indexOf('{');
    if (jsonStart !== -1) {
      let braceCount = 0;
      let jsonEnd = -1;

      for (let i = jsonStart; i < cleanContent.length; i++) {
        if (cleanContent[i] === '{') braceCount++;
        if (cleanContent[i] === '}') braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }

      if (jsonEnd > jsonStart) {
        const extractedJson = cleanContent.substring(jsonStart, jsonEnd);
        const parsed = JSON.parse(extractedJson);
        if (parsed.findings && Array.isArray(parsed.findings)) {
          console.log(`[${timestamp()}] [${provider}] Parsed after balanced brace extraction`);
          return parsed.findings;
        }
      }
    }
  } catch (e3) {
    // Continue to next strategy
  }

  // Strategy 4: Find JSON array directly (for responses that skip the wrapper)
  try {
    const arrayMatch = cleanContent.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        console.log(`[${timestamp()}] [${provider}] Parsed direct array match`);
        return parsed;
      }
    }
  } catch (e4) {
    // Continue to final fallback
  }

  // Strategy 5: Try to fix common JSON issues
  try {
    // Remove trailing commas before ] or }
    let fixedContent = cleanContent
      .replace(/,\s*([}\]])/g, '$1')
      // Fix unquoted keys
      .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');

    const jsonStart = fixedContent.indexOf('{');
    const jsonEnd = fixedContent.lastIndexOf('}') + 1;

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
      const extracted = fixedContent.substring(jsonStart, jsonEnd);
      const parsed = JSON.parse(extracted);
      if (parsed.findings && Array.isArray(parsed.findings)) {
        console.log(`[${timestamp()}] [${provider}] Parsed after JSON fixes`);
        return parsed.findings;
      }
    }
  } catch (e5) {
    console.error(`[${timestamp()}] [${provider}] All parsing strategies failed`);
    console.error(`[${timestamp()}] [${provider}] Content preview: ${content.substring(0, 200)}...`);
  }

  return [];
}

// =============================================================================
// v2.0.0: GITHUB COPILOT AI PROVIDER
// Uses GitHub Copilot subscription for AI analysis (no separate API key needed)
// =============================================================================

async function callCopilot(prompt, model) {
  console.log(`[${timestamp()}] [COPILOT] Calling model: ${model}`);
  
  const systemPrompt = `Eres un analista de seguridad de Active Directory experto.

⚠️ REGLA DE ORO - GROUNDING OBLIGATORIO:
Los nombres en "affected_objects" DEBEN existir TEXTUALMENTE en el JSON de entrada.
El sistema VALIDA y RECHAZA automáticamente cualquier nombre inventado.
Si inventas nombres → Tu finding será ELIMINADO.

PRINCIPIOS:
1. SOLO reporta problemas verificables en los datos
2. Si count = 0 o no hay objetos reales → NO generes finding
3. Calidad sobre cantidad: Mejor 0 findings que 1 inventado

FORMATO JSON ESTRICTO (sin texto adicional, sin markdown):
{
  "findings": [
    {
      "type_id": "RULE_ID",
      "severity": "critical|high|medium|low",
      "title": "Título descriptivo",
      "description": "Descripción técnica",
      "recommendation": "Recomendación",
      "mitre_attack": "T1234 - Técnica",
      "cis_control": "X.Y.Z",
      "impact_business": "Impacto en el negocio",
      "remediation_commands": "Comandos PowerShell",
      "prerequisites": "Requisitos",
      "operational_impact": "Impacto operativo",
      "microsoft_docs": "URL documentación",
      "current_vs_recommended": "Actual vs Recomendado",
      "timeline": "24h|7d|30d|60d",
      "affected_count": 0,
      "evidence": {
        "affected_objects": ["nombre1", "nombre2"],
        "count": 2,
        "details": "Detalles exactos del JSON"
      }
    }
  ]
}
Si no hay problemas verificables: {"findings": []}

IMPORTANTE: Responde SOLO con JSON válido, sin texto explicativo antes o después.`;

  try {
    const response = await copilotClient.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt.substring(0, MAX_PROMPT) }
      ],
      model,
      { temperature: 0.2, max_tokens: 8192 }
    );

    const content = response.choices?.[0]?.message?.content;
    
    if (content) {
      // Use the same robust parsing as other providers
      const findings = parseAIResponse(content, `Copilot/${model}`);
      console.log(`[${timestamp()}] [COPILOT] Parsed ${findings.length} findings`);
      return findings;
    }

    console.log(`[${timestamp()}] [COPILOT] No content in response`);
    return [];
  } catch (error) {
    console.error(`[${timestamp()}] [COPILOT] Call failed:`, error.message);
    throw error;
  }
}

// Main Processing Function
async function processAssessment(assessmentId, jsonData) {
  try {
    await addLog(assessmentId, 'info', '🚀 Starting processing on Self-Hosted VPS');

    // 1. Store Raw Data (JSONB handles storage efficiently)
    // const jsonString = JSON.stringify(jsonData);
    // const compressed = zlib.gzipSync(jsonString);
    // const compressionRatio = Math.round((1 - compressed.length / jsonString.length) * 100);
    // console.log(`[${timestamp()}] Compressed ${Math.round(jsonString.length / 1024 / 1024)} MB to ${Math.round(compressed.length / 1024 / 1024)} MB (${compressionRatio}% reduction)`);

    await pool.query(
      'INSERT INTO assessment_data (assessment_id, data) VALUES ($1, $2)',
      [assessmentId, jsonData]
    );
    await addLog(assessmentId, 'info', `✅ Raw data stored successfully`);

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
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const categoryInfo of availableCategories) {
      const { id: category, data } = categoryInfo;

      progressData[category].status = 'processing';
      await pool.query('UPDATE assessments SET analysis_progress = $1 WHERE id = $2', [progressData, assessmentId]);

      await analyzeCategory(assessmentId, category, data);

      progressData[category].status = 'completed';
      progressData[category].progress = 100;
      await pool.query('UPDATE assessments SET analysis_progress = $1 WHERE id = $2', [progressData, assessmentId]);

      // Rate limit protection: Wait 20 seconds between categories
      console.log(`[${timestamp()}] Waiting 20s to respect API rate limits...`);
      await sleep(20000);
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
    const hasAnthropicKey = !!await getConfig('anthropic_api_key');
    
    // v2.0.0: Check Copilot authentication status
    const copilotStatus = await copilotClient.getAuthStatus();
    const copilotModel = await getConfig('copilot_model') || 'gpt-4o';

    res.json({
      provider,
      model,
      available_providers: {
        openai: hasOpenAIKey,
        gemini: hasGeminiKey,
        deepseek: hasDeepSeekKey,
        anthropic: hasAnthropicKey,
        copilot: copilotStatus.authenticated
      },
      models: {
        openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
        gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
        deepseek: ['deepseek-chat', 'deepseek-coder'],
        anthropic: ['claude-opus-4-5-20250514', 'claude-sonnet-4-5-20250514', 'auto'],
        copilot: COPILOT_MODELS.map(m => m.id)
      },
      // v1.8.0: Inform frontend about dynamic model selection
      anthropic_auto_select: {
        enabled: true,
        opus_categories: Array.from(OPUS_CATEGORIES),
        description: 'Selección automática: Opus 4.5 para categorías críticas, Sonnet 4.5 para el resto'
      },
      // v2.0.0: Copilot configuration
      copilot: {
        authenticated: copilotStatus.authenticated,
        userLogin: copilotStatus.userLogin,
        tokenValid: copilotStatus.tokenValid,
        selectedModel: copilotModel,
        models: COPILOT_MODELS
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
      if (api_keys.anthropic) await setConfig('anthropic_api_key', api_keys.anthropic);
    }

    res.json({ success: true, message: 'AI configuration updated' });
  } catch (error) {
    console.error('Error updating AI config:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// v2.0.0: GITHUB COPILOT ENDPOINTS
// OAuth Device Flow authentication for GitHub Copilot integration
// =============================================================================

// POST /api/copilot/auth/start - Start OAuth Device Flow
app.post('/api/copilot/auth/start', async (req, res) => {
  try {
    console.log('[Copilot API] Starting device flow...');
    const result = await copilotClient.startDeviceFlow();
    res.json({
      success: true,
      deviceCode: result.deviceCode,
      userCode: result.userCode,
      verificationUri: result.verificationUri,
      expiresIn: result.expiresIn,
      interval: result.interval
    });
  } catch (error) {
    console.error('[Copilot API] Start error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/copilot/auth/poll - Poll for device authorization
app.post('/api/copilot/auth/poll', async (req, res) => {
  try {
    const { deviceCode } = req.body;
    if (!deviceCode) {
      return res.status(400).json({ error: 'deviceCode is required' });
    }
    
    const result = await copilotClient.pollDeviceFlow(deviceCode);
    res.json(result);
  } catch (error) {
    console.error('[Copilot API] Poll error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/copilot/auth/status - Get authentication status
app.get('/api/copilot/auth/status', async (req, res) => {
  try {
    const status = await copilotClient.getAuthStatus();
    res.json(status);
  } catch (error) {
    console.error('[Copilot API] Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/copilot/auth/logout - Logout from Copilot
app.post('/api/copilot/auth/logout', async (req, res) => {
  try {
    await copilotClient.logout();
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('[Copilot API] Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/copilot/models - Get available Copilot models
app.get('/api/copilot/models', async (req, res) => {
  try {
    const models = await copilotClient.getModels();
    res.json({ models });
  } catch (error) {
    console.error('[Copilot API] Models error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/copilot/model - Set the preferred Copilot model
app.post('/api/copilot/model', async (req, res) => {
  try {
    const { model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }
    
    await setConfig('copilot_model', model);
    res.json({ success: true, message: `Model set to ${model}` });
  } catch (error) {
    console.error('[Copilot API] Set model error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clients - Create a new client
app.post('/api/clients', async (req, res) => {
  const { name, contact_email } = req.body;
  if (!name) return res.status(400).json({ error: 'Client Name is required' });

  try {
    const result = await pool.query(
      'INSERT INTO clients (name, contact_email) VALUES ($1, $2) RETURNING *',
      [name, contact_email]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clients - List all clients
app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients ORDER BY name ASC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assessments - Create a new assessment
app.post('/api/assessments', async (req, res) => {
  const { domain, client_id } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO assessments (domain, client_id, status) VALUES ($1, $2, $3) RETURNING *',
      [domain, client_id || null, 'pending']
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating assessment:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/assessments - List all assessments (optionally filtered by client)
app.get('/api/assessments', async (req, res) => {
  const { clientId } = req.query;
  try {
    let query = 'SELECT * FROM assessments';
    let params = [];

    if (clientId) {
      query += ' WHERE client_id = $1';
      params.push(clientId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
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

    // Check if data is compressed (Buffer) or raw JSON (Object from JSONB)
    const rawData = result.rows[0].data;

    if (Buffer.isBuffer(rawData)) {
      // Legacy: Compressed data
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Encoding', 'gzip');
      console.log(`[${timestamp()}] [API] Sending compressed raw data for assessment ${id} (${Math.round(rawData.length / 1024 / 1024)} MB)`);
      res.send(rawData);
    } else {
      // New: JSONB data (already parsed by pg)
      console.log(`[${timestamp()}] [API] Sending JSON raw data for assessment ${id}`);
      res.json(rawData);
    }
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

    // Store JSON data directly (JSONB column handles storage efficiently)
    await addLog(assessmentId, 'info', 'Guardando datos en la base de datos...');
    await pool.query(
      'INSERT INTO assessment_data (assessment_id, data) VALUES ($1, $2) ON CONFLICT (assessment_id) DO UPDATE SET data = $2',
      [assessmentId, jsonData]
    );
    console.log(`[${timestamp()}] [UPLOAD] Data stored as JSONB`);

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

// DEBUG ENDPOINTS
// ------------------------------------------------------------------

// 1. Generate/Trigger Assessment Analysis (Manual Trigger)
app.post('/api/debug/assessments/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT data FROM assessment_data WHERE assessment_id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment data not found' });
    }

    let jsonData;
    const rawData = result.rows[0].data;

    // Handle compressed data
    if (Buffer.isBuffer(rawData)) {
      try {
        const decompressed = zlib.gunzipSync(rawData);
        jsonData = JSON.parse(decompressed.toString());
      } catch (e) {
        // Fallback if not compressed (legacy)
        jsonData = JSON.parse(rawData.toString());
      }
    } else {
      jsonData = rawData; // Already JSON
    }

    // Trigger analysis in background
    processAssessmentData(id, jsonData).catch(err => console.error('Manual trigger error:', err));

    res.json({ message: 'Analysis triggered manually', assessmentId: id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Validate Assessment Quality (Check findings vs Data)
app.get('/api/debug/assessments/:id/validate', async (req, res) => {
  try {
    const { id } = req.params;

    // Get findings
    const findingsRes = await pool.query('SELECT * FROM findings WHERE assessment_id = $1', [id]);
    const findings = findingsRes.rows;

    // Get raw data
    const dataRes = await pool.query('SELECT data FROM assessment_data WHERE assessment_id = $1', [id]);
    if (dataRes.rows.length === 0) return res.status(404).json({ error: 'No data' });

    let rawData;
    // Decompress if needed
    if (Buffer.isBuffer(dataRes.rows[0].data)) {
      rawData = JSON.parse(zlib.gunzipSync(dataRes.rows[0].data).toString());
    } else {
      rawData = dataRes.rows[0].data;
    }

    const validationReport = {
      totalFindings: findings.length,
      hallucinationsDetected: [],
      validFindings: 0
    };

    // Build Valid Names Set
    const validNames = new Set();
    const categories = ['Users', 'Computers', 'Groups', 'GPOs', 'DNSConfiguration'];

    // Deep Grounding Extraction (Matches main app logic)
    // Recursive Deep Grounding Extraction
    const extractNames = (obj) => {
      if (!obj) return;

      if (typeof obj === 'string') {
        if (obj.length > 2 && obj.length < 100) validNames.add(obj.toLowerCase());
        return;
      }

      if (Array.isArray(obj)) {
        obj.forEach(item => extractNames(item));
        return;
      }

      if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          if (key.length > 2 && key.length < 100) validNames.add(key.toLowerCase());
          extractNames(obj[key]);
        });
      }
    };

    categories.forEach(cat => {
      const catData = extractCategoryData(rawData, cat);
      if (catData) catData.forEach(extractNames);
    });

    // Validating Findings
    findings.forEach(f => {
      const evidence = f.evidence || {};
      const affected = evidence.affected_objects || [];

      if (affected.length > 0) {
        const invalidObjects = affected.filter(obj => {
          const clean = obj.replace(/^CN=|,.*/g, '').trim().toLowerCase();
          return !validNames.has(clean) && !validNames.has(obj.toLowerCase());
        });

        if (invalidObjects.length > 0) {
          validationReport.hallucinationsDetected.push({
            findingId: f.id,
            title: f.title,
            invalidObjects: invalidObjects
          });
        } else {
          validationReport.validFindings++;
        }
      } else {
        // Global findings
        validationReport.validFindings++;
      }
    });

    res.json(validationReport);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. View Raw Uploaded JSON (Decompressed)
app.get('/api/debug/assessments/:id/json', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT data FROM assessment_data WHERE assessment_id = $1', [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    let jsonData;
    if (Buffer.isBuffer(result.rows[0].data)) {
      jsonData = JSON.parse(zlib.gunzipSync(result.rows[0].data).toString());
    } else {
      jsonData = result.rows[0].data;
    }

    res.json(jsonData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Word Report Data Preview
app.get('/api/debug/assessments/:id/word-data', async (req, res) => {
  try {
    const { id } = req.params;
    // Simulate what goes into the word report
    const assessment = (await pool.query('SELECT * FROM assessments WHERE id = $1', [id])).rows[0];
    const findings = (await pool.query('SELECT * FROM findings WHERE assessment_id = $1', [id])).rows;
    // Retrieve raw data
    const dataRes = await pool.query('SELECT data FROM assessment_data WHERE assessment_id = $1', [id]);
    let rawData = {};
    if (dataRes.rows.length > 0) {
      if (Buffer.isBuffer(dataRes.rows[0].data)) {
        rawData = JSON.parse(zlib.gunzipSync(dataRes.rows[0].data).toString());
      } else {
        rawData = dataRes.rows[0].data;
      }
    }

    const reportPayload = {
      assessment: assessment,
      findingsCount: findings.length,
      findingsPreview: findings.map(f => ({ title: f.title, risk: f.severity })),
      keyMetrics: {
        users: rawData.Users ? (rawData.Users.Data ? rawData.Users.Data.length : rawData.Users.length) : 0,
        computers: rawData.Computers ? (rawData.Computers.Data ? rawData.Computers.Data.length : rawData.Computers.length) : 0,
      }
    };

    res.json(reportPayload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Dashboard Data Debug
app.get('/api/debug/assessments/:id/dashboard-data', async (req, res) => {
  // This mimics the dashboard data loading logic
  try {
    const { id } = req.params;
    const findings = (await pool.query('SELECT * FROM findings WHERE assessment_id = $1', [id])).rows;

    // Calculate Dashboard Metrics
    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;

    const dashboardDebug = {
      scorecard: {
        critical: criticalCount,
        high: highCount,
        total: findings.length
      },
      topRisks: findings.filter(f => f.severity === 'critical').map(f => f.title)
    };

    res.json(dashboardDebug);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Executive Summary Debug - Complete assessment overview
app.get('/api/debug/assessments/:id/summary', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get assessment info
    const assessmentRes = await pool.query('SELECT * FROM assessments WHERE id = $1', [id]);
    if (assessmentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const assessment = assessmentRes.rows[0];
    
    // Get findings
    const findingsRes = await pool.query('SELECT * FROM findings WHERE assessment_id = $1', [id]);
    const findings = findingsRes.rows;
    
    // Get logs
    const logsRes = await pool.query('SELECT * FROM assessment_logs WHERE assessment_id = $1 ORDER BY created_at DESC LIMIT 20', [id]);
    const logs = logsRes.rows;
    
    // Get raw data stats
    const dataRes = await pool.query('SELECT data FROM assessment_data WHERE assessment_id = $1', [id]);
    let dataStats = { hasData: false, categories: [], totalObjects: 0 };
    
    if (dataRes.rows.length > 0) {
      let rawData;
      if (Buffer.isBuffer(dataRes.rows[0].data)) {
        rawData = JSON.parse(zlib.gunzipSync(dataRes.rows[0].data).toString());
      } else {
        rawData = dataRes.rows[0].data;
      }
      
      dataStats.hasData = true;
      // Count objects per category
      for (const category of CATEGORIES) {
        const catData = extractCategoryData(rawData, category);
        if (catData && catData.length > 0) {
          dataStats.categories.push({ name: category, count: catData.length });
          dataStats.totalObjects += catData.length;
        }
      }
    }
    
    // Calculate severity distribution
    const severityDist = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info' || f.severity === 'informational').length
    };
    
    // Calculate health score (simple formula)
    const riskScore = (severityDist.critical * 40) + (severityDist.high * 20) + (severityDist.medium * 5) + (severityDist.low * 1);
    const healthScore = Math.max(0, 100 - Math.min(100, riskScore));
    
    // Categorize findings
    const findingsByCategory = {};
    findings.forEach(f => {
      const cat = f.category_id || 'Uncategorized';
      if (!findingsByCategory[cat]) findingsByCategory[cat] = [];
      findingsByCategory[cat].push({ title: f.title, severity: f.severity });
    });
    
    const summary = {
      assessment: {
        id: assessment.id,
        domain: assessment.domain,
        status: assessment.status,
        created_at: assessment.created_at,
        completed_at: assessment.completed_at,
        duration: assessment.completed_at 
          ? `${Math.round((new Date(assessment.completed_at) - new Date(assessment.created_at)) / 1000 / 60)} minutos`
          : 'En progreso'
      },
      health: {
        score: healthScore,
        grade: healthScore >= 90 ? 'A' : healthScore >= 75 ? 'B' : healthScore >= 60 ? 'C' : healthScore >= 40 ? 'D' : 'F',
        riskLevel: healthScore >= 75 ? 'Bajo' : healthScore >= 50 ? 'Medio' : healthScore >= 25 ? 'Alto' : 'Crítico'
      },
      findings: {
        total: findings.length,
        distribution: severityDist,
        byCategory: findingsByCategory,
        topCritical: findings.filter(f => f.severity === 'critical').slice(0, 5).map(f => f.title)
      },
      data: dataStats,
      recentLogs: logs.slice(0, 10).map(l => ({
        level: l.level,
        message: l.message,
        time: l.created_at
      })),
      debugTips: []
    };
    
    // Add debug tips based on analysis
    if (findings.length === 0) {
      summary.debugTips.push('⚠️ Sin hallazgos: Verificar /validate para detectar problemas de análisis');
    }
    if (!dataStats.hasData) {
      summary.debugTips.push('❌ Sin datos raw: El assessment no tiene datos cargados');
    }
    if (assessment.status === 'failed') {
      summary.debugTips.push('🔴 Assessment fallido: Revisar logs para identificar el error');
    }
    if (severityDist.critical === 0 && dataStats.totalObjects > 100) {
      summary.debugTips.push('🤔 Muchos objetos pero sin críticos: Posible problema en prompts de IA');
    }
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Data Coverage Analysis - What data was collected and analyzed
app.get('/api/debug/assessments/:id/data-coverage', async (req, res) => {
  try {
    const { id } = req.params;
    
    const dataRes = await pool.query('SELECT data FROM assessment_data WHERE assessment_id = $1', [id]);
    if (dataRes.rows.length === 0) {
      return res.status(404).json({ error: 'No data found for assessment' });
    }
    
    let rawData;
    if (Buffer.isBuffer(dataRes.rows[0].data)) {
      rawData = JSON.parse(zlib.gunzipSync(dataRes.rows[0].data).toString());
    } else {
      rawData = dataRes.rows[0].data;
    }
    
    const coverage = {
      timestamp: new Date().toISOString(),
      categories: [],
      missingCategories: [],
      dataQuality: {
        score: 0,
        issues: []
      },
      sampleData: {}
    };
    
    let categoriesWithData = 0;
    
    for (const category of CATEGORIES) {
      const catData = extractCategoryData(rawData, category);
      const catInfo = {
        name: category,
        hasData: false,
        count: 0,
        fields: [],
        sampleSize: 0
      };
      
      if (catData && catData.length > 0) {
        catInfo.hasData = true;
        catInfo.count = catData.length;
        categoriesWithData++;
        
        // Extract field names from first item
        if (catData[0] && typeof catData[0] === 'object') {
          catInfo.fields = Object.keys(catData[0]).slice(0, 15);
        }
        
        // Add sample (first 2 items, sanitized)
        coverage.sampleData[category] = catData.slice(0, 2).map(item => {
          if (typeof item === 'object') {
            const sanitized = {};
            Object.keys(item).slice(0, 10).forEach(k => {
              const val = item[k];
              if (typeof val === 'string' && val.length > 100) {
                sanitized[k] = val.substring(0, 100) + '...';
              } else if (Array.isArray(val)) {
                sanitized[k] = `[Array: ${val.length} items]`;
              } else {
                sanitized[k] = val;
              }
            });
            return sanitized;
          }
          return item;
        });
        
        coverage.categories.push(catInfo);
      } else {
        coverage.missingCategories.push(category);
      }
    }
    
    // Calculate data quality score
    const expectedCategories = ['Users', 'Computers', 'Groups', 'GPOs', 'OUs'];
    const criticalMissing = expectedCategories.filter(c => coverage.missingCategories.includes(c));
    
    coverage.dataQuality.score = Math.round((categoriesWithData / CATEGORIES.length) * 100);
    
    if (criticalMissing.length > 0) {
      coverage.dataQuality.issues.push(`Categorías críticas faltantes: ${criticalMissing.join(', ')}`);
      coverage.dataQuality.score = Math.max(0, coverage.dataQuality.score - (criticalMissing.length * 10));
    }
    
    if (categoriesWithData < 5) {
      coverage.dataQuality.issues.push('Muy pocas categorías con datos - verificar script de recolección');
    }
    
    // Check for empty or minimal data
    coverage.categories.forEach(cat => {
      if (cat.count === 1) {
        coverage.dataQuality.issues.push(`${cat.name}: Solo 1 objeto - posible error de recolección`);
      }
    });
    
    res.json(coverage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Findings Analytics - Detailed analysis of generated findings
app.get('/api/debug/assessments/:id/findings-analytics', async (req, res) => {
  try {
    const { id } = req.params;
    
    const findingsRes = await pool.query('SELECT * FROM findings WHERE assessment_id = $1', [id]);
    const findings = findingsRes.rows;
    
    if (findings.length === 0) {
      return res.json({
        message: 'No findings to analyze',
        suggestions: [
          'Verificar si el análisis completó correctamente',
          'Revisar logs con /api/debug/assessments/:id/summary',
          'Usar /api/debug/assessments/:id/analyze para re-ejecutar'
        ]
      });
    }
    
    const analytics = {
      overview: {
        total: findings.length,
        unique_categories: [...new Set(findings.map(f => f.category_id).filter(Boolean))].length,
        avg_affected_objects: 0
      },
      distribution: {
        bySeverity: {},
        byCategory: {},
        byAffectedCount: { '0': 0, '1-5': 0, '6-20': 0, '21-50': 0, '50+': 0 }
      },
      quality: {
        score: 100,
        issues: [],
        warnings: []
      },
      patterns: {
        duplicateTitles: [],
        emptyEvidence: [],
        noRemediation: [],
        suspiciousFindings: []
      },
      details: []
    };
    
    const titleCounts = {};
    let totalAffected = 0;
    
    findings.forEach(f => {
      // Severity distribution
      const sev = f.severity || 'unknown';
      analytics.distribution.bySeverity[sev] = (analytics.distribution.bySeverity[sev] || 0) + 1;
      
      // Category distribution
      const cat = f.category_id || 'Uncategorized';
      analytics.distribution.byCategory[cat] = (analytics.distribution.byCategory[cat] || 0) + 1;
      
      // Affected objects analysis
      const evidence = f.evidence || {};
      const affected = evidence.affected_objects || [];
      const affectedCount = affected.length;
      totalAffected += affectedCount;
      
      if (affectedCount === 0) analytics.distribution.byAffectedCount['0']++;
      else if (affectedCount <= 5) analytics.distribution.byAffectedCount['1-5']++;
      else if (affectedCount <= 20) analytics.distribution.byAffectedCount['6-20']++;
      else if (affectedCount <= 50) analytics.distribution.byAffectedCount['21-50']++;
      else analytics.distribution.byAffectedCount['50+']++;
      
      // Track duplicates
      titleCounts[f.title] = (titleCounts[f.title] || 0) + 1;
      
      // Quality checks
      if (!evidence || Object.keys(evidence).length === 0) {
        analytics.patterns.emptyEvidence.push(f.title);
      }
      if (!f.remediation || f.remediation.trim().length < 20) {
        analytics.patterns.noRemediation.push(f.title);
      }
      
      // Suspicious patterns (potential hallucinations)
      if (affected.some(obj => obj.includes('ejemplo') || obj.includes('test123') || obj.includes('sample'))) {
        analytics.patterns.suspiciousFindings.push({
          title: f.title,
          reason: 'Contiene objetos con nombres sospechosos (ejemplo, test, sample)'
        });
      }
      
      // Add to details
      analytics.details.push({
        id: f.id,
        title: f.title,
        severity: f.severity,
        category: f.category_id,
        affectedCount: affectedCount,
        hasRemediation: !!(f.remediation && f.remediation.length > 20),
        hasEvidence: !!(evidence && Object.keys(evidence).length > 0)
      });
    });
    
    // Calculate averages
    analytics.overview.avg_affected_objects = Math.round(totalAffected / findings.length);
    
    // Find duplicates
    Object.entries(titleCounts).forEach(([title, count]) => {
      if (count > 1) {
        analytics.patterns.duplicateTitles.push({ title, count });
      }
    });
    
    // Calculate quality score
    if (analytics.patterns.duplicateTitles.length > 0) {
      analytics.quality.score -= 15;
      analytics.quality.issues.push(`${analytics.patterns.duplicateTitles.length} hallazgos duplicados detectados`);
    }
    if (analytics.patterns.emptyEvidence.length > findings.length * 0.3) {
      analytics.quality.score -= 20;
      analytics.quality.issues.push(`${Math.round(analytics.patterns.emptyEvidence.length / findings.length * 100)}% de hallazgos sin evidencia`);
    }
    if (analytics.patterns.suspiciousFindings.length > 0) {
      analytics.quality.score -= 25;
      analytics.quality.issues.push(`${analytics.patterns.suspiciousFindings.length} hallazgos sospechosos (posibles alucinaciones)`);
    }
    if (analytics.patterns.noRemediation.length > findings.length * 0.2) {
      analytics.quality.score -= 10;
      analytics.quality.warnings.push(`${analytics.patterns.noRemediation.length} hallazgos con remediación insuficiente`);
    }
    
    analytics.quality.score = Math.max(0, analytics.quality.score);
    
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Deep Grounding Check - Verify all findings against source data
app.get('/api/debug/assessments/:id/grounding-check', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get findings
    const findingsRes = await pool.query('SELECT * FROM findings WHERE assessment_id = $1', [id]);
    const findings = findingsRes.rows;
    
    // Get raw data
    const dataRes = await pool.query('SELECT data FROM assessment_data WHERE assessment_id = $1', [id]);
    if (dataRes.rows.length === 0) {
      return res.status(404).json({ error: 'No source data found' });
    }
    
    let rawData;
    if (Buffer.isBuffer(dataRes.rows[0].data)) {
      rawData = JSON.parse(zlib.gunzipSync(dataRes.rows[0].data).toString());
    } else {
      rawData = dataRes.rows[0].data;
    }
    
    const groundingReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalFindings: findings.length,
        verified: 0,
        unverified: 0,
        partiallyVerified: 0,
        globalFindings: 0,
        groundingScore: 0
      },
      validNames: {
        total: 0,
        sample: []
      },
      details: [],
      hallucinations: [],
      recommendations: []
    };
    
    // Build comprehensive valid names set with deep extraction
    const validNames = new Set();
    const validNamesMap = {}; // Track source category
    
    const extractNames = (obj, category = 'unknown', path = '') => {
      if (!obj) return;
      
      if (typeof obj === 'string') {
        if (obj.length > 2 && obj.length < 150) {
          const clean = obj.toLowerCase().trim();
          validNames.add(clean);
          if (!validNamesMap[clean]) validNamesMap[clean] = [];
          validNamesMap[clean].push(category);
        }
        return;
      }
      
      if (Array.isArray(obj)) {
        obj.forEach((item, idx) => extractNames(item, category, `${path}[${idx}]`));
        return;
      }
      
      if (typeof obj === 'object') {
        Object.keys(obj).forEach(key => {
          // Add key itself as valid name
          if (key.length > 2 && key.length < 100) {
            validNames.add(key.toLowerCase());
          }
          extractNames(obj[key], category, `${path}.${key}`);
        });
      }
    };
    
    // Extract from all categories
    CATEGORIES.forEach(cat => {
      const catData = extractCategoryData(rawData, cat);
      if (catData) {
        catData.forEach(item => extractNames(item, cat));
      }
    });
    
    groundingReport.validNames.total = validNames.size;
    groundingReport.validNames.sample = Array.from(validNames).slice(0, 50);
    
    // Verify each finding
    findings.forEach(f => {
      const evidence = f.evidence || {};
      const affected = evidence.affected_objects || [];
      
      const findingCheck = {
        id: f.id,
        title: f.title,
        severity: f.severity,
        category: f.category_id,
        affectedObjects: affected.length,
        status: 'pending',
        verifiedObjects: [],
        unverifiedObjects: [],
        verificationRate: 0
      };
      
      if (affected.length === 0) {
        // Global finding (no specific objects)
        findingCheck.status = 'global';
        groundingReport.summary.globalFindings++;
      } else {
        // Verify each affected object
        affected.forEach(obj => {
          // Clean object name for comparison
          const cleanVersions = [
            obj.toLowerCase().trim(),
            obj.replace(/^CN=|,.*/g, '').toLowerCase().trim(),
            obj.split('\\').pop()?.toLowerCase().trim(),
            obj.split('@')[0]?.toLowerCase().trim()
          ].filter(Boolean);
          
          const isValid = cleanVersions.some(v => validNames.has(v));
          
          if (isValid) {
            findingCheck.verifiedObjects.push(obj);
          } else {
            findingCheck.unverifiedObjects.push(obj);
          }
        });
        
        findingCheck.verificationRate = Math.round(
          (findingCheck.verifiedObjects.length / affected.length) * 100
        );
        
        if (findingCheck.verificationRate === 100) {
          findingCheck.status = 'verified';
          groundingReport.summary.verified++;
        } else if (findingCheck.verificationRate >= 50) {
          findingCheck.status = 'partial';
          groundingReport.summary.partiallyVerified++;
        } else {
          findingCheck.status = 'unverified';
          groundingReport.summary.unverified++;
          
          // Add to hallucinations list
          groundingReport.hallucinations.push({
            findingId: f.id,
            title: f.title,
            severity: f.severity,
            invalidObjects: findingCheck.unverifiedObjects.slice(0, 10),
            verificationRate: findingCheck.verificationRate
          });
        }
      }
      
      groundingReport.details.push(findingCheck);
    });
    
    // Calculate grounding score
    const verifiableFindings = findings.length - groundingReport.summary.globalFindings;
    if (verifiableFindings > 0) {
      groundingReport.summary.groundingScore = Math.round(
        ((groundingReport.summary.verified + (groundingReport.summary.partiallyVerified * 0.5)) / verifiableFindings) * 100
      );
    } else {
      groundingReport.summary.groundingScore = 100; // All global findings
    }
    
    // Generate recommendations
    if (groundingReport.hallucinations.length > 0) {
      groundingReport.recommendations.push({
        priority: 'high',
        action: 'Revisar prompts de IA para reforzar grounding',
        details: `${groundingReport.hallucinations.length} hallazgos contienen objetos no verificables`
      });
    }
    if (groundingReport.summary.groundingScore < 70) {
      groundingReport.recommendations.push({
        priority: 'critical',
        action: 'Re-ejecutar análisis con prompts mejorados',
        details: `Score de grounding ${groundingReport.summary.groundingScore}% es demasiado bajo`
      });
    }
    if (groundingReport.summary.globalFindings > findings.length * 0.5) {
      groundingReport.recommendations.push({
        priority: 'medium',
        action: 'Verificar que los hallazgos incluyan objetos específicos afectados',
        details: `${Math.round(groundingReport.summary.globalFindings / findings.length * 100)}% de hallazgos son globales`
      });
    }
    
    res.json(groundingReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. List all assessments for debugging
app.get('/api/debug/assessments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id,
        a.domain,
        a.status,
        a.created_at,
        a.completed_at,
        (SELECT COUNT(*) FROM findings WHERE assessment_id = a.id) as findings_count,
        (SELECT COUNT(*) FROM assessment_data WHERE assessment_id = a.id) as has_data
      FROM assessments a
      ORDER BY a.created_at DESC
      LIMIT 50
    `);
    
    res.json({
      total: result.rows.length,
      assessments: result.rows.map(a => ({
        id: a.id,
        domain: a.domain,
        status: a.status,
        created: a.created_at,
        completed: a.completed_at,
        findings: parseInt(a.findings_count),
        hasData: parseInt(a.has_data) > 0
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to process assessment data
async function processAssessmentData(assessmentId, jsonData) {
  try {
    console.log(`[${timestamp()}] [PROCESS] Starting analysis for assessment ${assessmentId}`);
    await addLog(assessmentId, 'info', 'Iniciando análisis de categorías...');

    // Clear existing findings to prevents duplicates/zombie data (Fix for Hallucinations persistence)
    await pool.query('DELETE FROM findings WHERE assessment_id = $1', [assessmentId]);
    await addLog(assessmentId, 'info', 'Limpiando hallazgos anteriores...');

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




// Authentik Setup Endpoint
app.post('/api/setup', async (req, res) => {
  try {
    const { authentik_url, api_token, app_url } = req.body;

    if (!authentik_url || !api_token || !app_url) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }

    const setup = new WebAuthentikSetup(authentik_url, api_token, app_url);
    const result = await setup.setup();

    if (result.success) {
      res.json({
        success: true,
        message: 'Configuration completed successfully!',
        client_id: result.client_id,
        redirect_uri: result.redirect_uri,
        next_step: 'Restart the application to apply changes'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Unknown error',
        step: result.step
      });
    }
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ success: false, error: `Setup failed: ${error.message}` });
  }
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
