# Feature: AI-Powered Analysis Engine

## Feature Spec

### User Intent
As a system, I want to analyze AD data using AI models with specialized prompts per category, so that I can identify misconfigurations and operational issues with high accuracy and minimal false positives.

### Acceptance Criteria

#### AC-1: Category Processing Pipeline
- **Given** An assessment is in 'analyzing' status
- **When** The analysis engine starts
- **Then** The system processes each category sequentially:
  1. Extracts available categories from JSON data
  2. Applies smart filtering (reduce dataset to relevant objects only)
  3. Updates progress: `category.status = 'processing'`
  4. Generates specialized prompt for category
  5. Selects appropriate AI model (Opus for complex, Sonnet for standard)
  6. Chunks data if > 40 items
  7. Sends requests to AI provider
  8. Parses AI response with fallback strategies
  9. Validates findings per-chunk
  10. Merges findings from chunks
  11. Validates all merged findings
  12. Validates attributes
  13. Inserts validated findings into database
  14. Updates progress: `category.status = 'completed'`, `progress = 100%`
  15. Adds 20s rate limit between categories

#### AC-2: Smart Filtering
- **Given** A category is being analyzed
- **When** The system applies smart filtering
- **Then** The system:
  1. **Users Category**: Uses deterministic rules (`userRules.js`) - filters high-risk users (disabled, password never expires, kerberoastable, ASREPRoastable, delegation, adminCount=1)
  2. **Computers Category**: Filters stale (>90 days), legacy OS (Windows 2012/2008/2003/XP/7/Vista), delegation, no LAPS, weak encryption
  3. **Groups Category**: Filters privileged, empty, excessive members (>50)
  4. **GPOs Category**: Filters unlinked, disabled, version mismatch, monolithic (>30 settings), dangerous permissions
  5. **DNS Category**: Injects DNSConfiguration.Forwarders, filters public forwarders (8.8.8.8, 1.1.1.1), insecure dynamic updates, zone transfer enabled, scavenging disabled
  6. **DHCP Category**: Filters rogue servers, scope exhaustion (>80%), weak configuration, auditing disabled
  7. **DCHealth Category**: Filters unhealthy DCs only (replication failures, legacy OS, FSMO concentration, NTP misconfiguration, service issues, low disk space)
  8. **ReplicationStatus Category**: Filters failures only (lingering objects, consecutive failures > 0, high latency >60min, never replicated, USN rollback)
  9. **TrustHealth Category**: Filters problematic trusts only (broken/degraded, SID filtering disabled, selective auth not enabled, old password >180 days, orphaned/suspicious)
  10. **OrphanedTrusts Category**: Filters orphaned trusts only (Status = ORPHANED or SUSPICIOUS)
  11. **FSMORolesHealth Category**: Filters issues only (inaccessible roles, high latency >200ms, RID pool exhausted >90%, all on single DC, VM time sync, infrastructure master on GC)
  12. **Sites Category**: Filters problematic sites only (no subnets, Default-First-Site-Name, no DCs, issues present, high link cost >500, manual bridgehead)
  13. **Kerberos Category**: Analyzes all data (no smart filtering)
  14. **Security Category**: Analyzes all data (no smart filtering)
  15. **PasswordPolicies Category**: Analyzes all data (no smart filtering)
  16. **ProtocolSecurity Category**: Analyzes all data (no smart filtering)
  17. **ADCSInventory Category**: Analyzes all data (no smart filtering)

#### AC-3: AI Model Selection
- **Given** A category is being analyzed
- **When** The system selects an AI model
- **Then** The system:
  1. Uses **Claude Opus 4.5** for complex categories: Kerberos, Security, ACLs, TrustHealth, CertServices, FSMORolesHealth
  2. Uses **Claude Sonnet 4.5** for standard categories: Users, Groups, Computers, GPOs, DNS, DHCP, DCHealth, ReplicationStatus, Sites, PasswordPolicies, ProtocolSecurity, ADCSInventory
  3. Uses **Auto Mode** (if selected) to dynamically choose based on category complexity
  4. Supports fallback to alternative provider if primary fails

#### AC-4: Data Chunking
- **Given** A category has > 40 items after smart filtering
- **When** The system chunks the data
- **Then** The system:
  1. Divides data into chunks of 40 items each
  2. Preserves category context across chunks
  3. Processes chunks sequentially
  4. Merges findings from all chunks
  5. Deduplicates findings by type_id

#### AC-5: AI Prompt Generation
- **Given** A category is being analyzed
- **When** The system generates a prompt
- **Then** The prompt includes:
  1. Category-specific analysis instructions
  2. Compliance framework mappings (CIS, NIST 800-53, ISO 27001, PCI-DSS, SOX, GDPR)
  3. MITRE ATT&CK technique mappings
  4. PowerShell remediation commands with exact parameters
  5. Implementation roadmap (4-5 phases)
  6. Business impact assessment
  7. Prerequisites for remediation
  8. Current vs Recommended configuration
  9. Operational impact analysis
  10. Microsoft documentation links
  11. Anti-hallucination rules: "⚠️ REGLA ANTI-ALUCINACIÓN: Solo reporta objetos que aparezcan EXPLÍCITAMENTE en los datos"

#### AC-6: Multi-Provider AI Support
- **Given** An AI request needs to be made
- **When** The system calls the AI API
- **Then** The system supports:
  1. **OpenAI**: gpt-4o, gpt-4o-mini, gpt-4-turbo
  2. **Anthropic**: claude-opus-4-5, claude-sonnet-4-5
  3. **Gemini**: gemini-1.5-pro, gemini-1.5-flash
  4. **DeepSeek**: deepseek-chat, deepseek-coder
  5. **Fallback**: Switch to alternative provider if primary fails
  6. **Configurable**: Provider and model can be changed in admin panel

## Tech Design

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│         processAssessment() (server.js)               │
│  - Iterates through available categories               │
└────────────────┬────────────────────────────────────┘
                 │
                 │ extractCategoryData()
                 ▼
┌─────────────────────────────────────────────────────────┐
│         Smart Filtering (server.js)                    │
│  - Reduces dataset to relevant objects                │
│  - Reduces token usage by 70%                       │
└────────────────┬────────────────────────────────────┘
                 │
                 │ buildPrompt()
                 ▼
┌─────────────────────────────────────────────────────────┐
│         Prompt Generation (server.js)                   │
│  - Category-specific instructions                     │
│  - Compliance mappings                              │
│  - Anti-hallucination rules                         │
└────────────────┬────────────────────────────────────┘
                 │
                 │ callAI()
                 ▼
┌─────────────────────────────────────────────────────────┐
│         AI Provider (OpenAI/Anthropic/Gemini)         │
│  - Sends chunked requests                          │
│  - Receives JSON response                           │
└────────────────┬────────────────────────────────────┘
                 │
                 │ validateFindingsPerChunk()
                 ▼
┌─────────────────────────────────────────────────────────┐
│         Per-Chunk Validation                          │
│  - Verify affected_objects exist in chunk           │
│  - Verify affected_count matches                     │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Merge findings
                 ▼
┌─────────────────────────────────────────────────────────┐
│         validateFindings()                           │
│  - Verify objects exist in full assessment           │
│  - Update affected_count                           │
└────────────────┬────────────────────────────────────┘
                 │
                 │ validateAttributes()
                 ▼
┌─────────────────────────────────────────────────────────┐
│         Attribute Validation                           │
│  - Verify objects have claimed vulnerability          │
│  - Use ATTRIBUTE_VALIDATION_RULES                  │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Insert into findings table
                 ▼
┌─────────────────────────────────────────────────────────┐
│         PostgreSQL Database                           │
│  - Store validated findings                        │
│  - Update analysis_progress                        │
└─────────────────────────────────────────────────────────┘
```

### Components

#### Backend
- **server.js** (~4600 lines)
  - `analyzeCategory()` (lines 666-856): Main orchestrator
  - `buildPrompt()` (lines 1543-3543): Category-specific prompts
  - `callAI()` (lines 880-1020): Multi-provider AI client
  - `validateFindings()` (lines 1489-2367): Ground-truth verification
  - `validateFindingsPerChunk()` (lines 2403-2750): Per-chunk validation
  - `validateAttributes()` (lines 1192-1483): Attribute validation
  - `extractCategoryData()` (lines 171-659): Smart filtering

#### Analyzers
- **analyzers/userRules.js**
  - Deterministic rules for Users category
  - High-risk user identification
  - Bypasses AI for obvious findings

### Data Model

#### AI Request
```typescript
{
  provider: 'openai' | 'anthropic' | 'gemini' | 'deepseek';
  model: string;
  prompt: string;
  systemMessage: string;
  temperature: number;  // 0.1-1.0
  maxTokens: number;
}
```

#### AI Response
```typescript
{
  findings: Array<{
    type_id: string;
    title: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    description: string;
    recommendation: string;
    evidence: {
      affected_objects: string[];
      count: number;
      details: Record<string, any>;
    };
    mitre_attack: string;
    cis_control: string;
    impact_business: string;
    remediation_commands: string;
    prerequisites: string;
    operational_impact: string;
    microsoft_docs: string;
    current_vs_recommended: string;
    timeline: string;
  }>;
}
```

#### Validation Rule
```typescript
{
  [type_id: string]: {
    category: string;
    identifierField: string;
    validate: (obj: any) => boolean;
    validateAffectedObject?: (objName: string, parentObj: any) => boolean;
  };
}
```

### API Endpoints

#### POST /api/analyze-category
**Request**:
```json
{
  "assessmentId": "uuid",
  "category": "Users",
  "data": { ... },
  "aiConfig": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-5"
  }
}
```

**Response** (200 OK):
```json
{
  "findingsCount": 12,
  "categoriesProcessed": 1,
  "validationErrors": 0,
  "message": "Category analyzed successfully"
}
```

### Prompts

#### Example: Users Category Prompt
```text
You are an Active Directory hygiene expert. Analyze the Users data for operational hygiene issues.

Focus on:
1. Password policies (never expires, not required, history count)
2. Privilege exposure (adminCount=1, delegation)
3. Inactive accounts (>90 days since last logon)
4. Kerberoasting risk (ServicePrincipalNames)
5. AS-REP Roasting risk (DoNotRequirePreAuth)
6. Unconstrained delegation

For each finding, provide:
- type_id (e.g., PASSWORD_NEVER_EXPIRES, INACTIVE_ACCOUNTS)
- title (concise, actionable)
- severity (critical/high/medium/low)
- description (what is the issue?)
- recommendation (how to fix?)
- affected_objects (list of user names from data)
- mitre_attack (if applicable)
- cis_control (if applicable)
- remediation_commands (exact PowerShell commands)
- timeline (how long to fix?)

⚠️ REGLA ANTI-ALUCINACIÓN: Solo reporta objetos que aparezcan EXPLÍCITAMENTE en los datos proporcionados. NO inventes nombres de usuarios.

Return JSON array of findings.
```

## Dev Tasks

### Task-1: Implement Smart Filtering
- [ ] Implement extractCategoryData() with category-specific filters
- [ ] Add smart filtering for Users (use userRules.js)
- [ ] Add smart filtering for Computers (stale, legacy OS, delegation)
- [ ] Add smart filtering for Groups (privileged, empty, excessive)
- [ ] Add smart filtering for GPOs (unlinked, disabled, monolithic)
- [ ] Add smart filtering for DNS (public forwarders, scavenging)
- [ ] Add smart filtering for DHCP (rogue servers, scope issues)
- [ ] Add smart filtering for DCHealth (unhealthy DCs only)
- [ ] Add smart filtering for ReplicationStatus (failures only)
- [ ] Add smart filtering for TrustHealth (problematic trusts only)
- [ ] Add smart filtering for OrphanedTrusts (orphaned trusts only)
- [ ] Add smart filtering for FSMORolesHealth (issues only)
- [ ] Add smart filtering for Sites (problematic sites only)
- [ ] Test token reduction (should be 70%+)

**Files**: `server/server.js` (lines 171-659)
**Estimated**: 8 hours

### Task-2: Implement AI Model Selection
- [ ] Implement model selection logic (Opus vs Sonnet)
- [ ] Add category-to-model mapping
- [ ] Implement auto mode (complexity-based selection)
- [ ] Add provider fallback logic
- [ ] Test model selection for all 17 categories

**Files**: `server/server.js` (lines 880-1020)
**Estimated**: 3 hours

### Task-3: Implement Data Chunking
- [ ] Implement chunking logic (40 items per chunk)
- [ ] Add context preservation across chunks
- [ ] Implement sequential chunk processing
- [ ] Implement findings merging
- [ ] Implement deduplication by type_id
- [ ] Test with large datasets (>1000 items)

**Files**: `server/server.js` (lines 666-856)
**Estimated**: 4 hours

### Task-4: Implement Category Prompts
- [ ] Create Users category prompt (use userRules.js)
- [ ] Create Computers category prompt
- [ ] Create Groups category prompt
- [ ] Create GPOs category prompt
- [ ] Create DNS category prompt
- [ ] Create DHCP category prompt
- [ ] Create DCHealth category prompt
- [ ] Create ReplicationStatus category prompt
- [ ] Create TrustHealth category prompt
- [ ] Create OrphanedTrusts category prompt
- [ ] Create FSMORolesHealth category prompt
- [ ] Create Sites category prompt
- [ ] Create Kerberos category prompt (complex - Opus 4.5)
- [ ] Create Security category prompt (complex - Opus 4.5)
- [ ] Create PasswordPolicies category prompt
- [ ] Create ProtocolSecurity category prompt
- [ ] Create ADCSInventory category prompt
- [ ] Add compliance mappings (CIS, NIST, ISO 27001, PCI-DSS, SOX, GDPR)
- [ ] Add MITRE ATT&CK mappings
- [ ] Add PowerShell remediation commands
- [ ] Add 4-5 phase implementation roadmaps
- [ ] Add anti-hallucination rules to all prompts

**Files**: `server/server.js` (lines 1543-3543)
**Estimated**: 20 hours

### Task-5: Implement Multi-Provider AI Client
- [ ] Implement OpenAI client
- [ ] Implement Anthropic client
- [ ] Implement Gemini client
- [ ] Implement DeepSeek client
- [ ] Add provider fallback logic
- [ ] Add error handling and retry
- [ ] Add timeout configuration
- [ ] Test all providers

**Files**: `server/server.js` (lines 880-1020)
**Estimated**: 6 hours

### Task-6: Implement Anti-Hallucination Validation
- [ ] Implement validateFindingsPerChunk() (per-chunk validation)
- [ ] Implement validateFindings() (post-merge validation)
- [ ] Implement validateAttributes() (attribute validation)
- [ ] Create ATTRIBUTE_VALIDATION_RULES for all type_ids
- [ ] Add n-gram indexing for fuzzy matching
- [ ] Add validation error logging
- [ ] Test with known false positives

**Files**: `server/server.js` (lines 862-2750)
**Estimated**: 12 hours

### Task-7: Implement Deterministic Analyzer (Users)
- [ ] Create userRules.js with deterministic rules
- [ ] Implement PASSWORD_NEVER_EXPIRES detection
- [ ] Implement INACTIVE_ACCOUNTS detection
- [ ] Implement ADMIN_COUNT_EXPOSURE detection
- [ ] Implement KERBEROASTING_RISK detection
- [ ] Implement ASREP_ROASTING detection
- [ ] Implement UNCONSTRAINED_DELEGATION detection
- [ ] Implement PASSWORD_NOT_REQUIRED detection
- [ ] Implement PRIVILEGED_NO_PROTECTION detection
- [ ] Test with known good and bad users

**Files**: `server/analyzers/userRules.js`
**Estimated**: 4 hours

### Task-8: Add Rate Limiting
- [ ] Implement 20s delay between categories
- [ ] Add rate limit configuration
- [ ] Add rate limit logging
- [ ] Test with full assessment (15+ categories)

**Files**: `server/server.js` (lines 666-856)
**Estimated**: 1 hour

## Test Plan

### Unit Tests
- [ ] Test smart filtering for each category
- [ ] Test model selection logic
- [ ] Test chunking with various sizes
- [ ] Test prompt generation for all categories
- [ ] Test AI client for each provider
- [ ] Test per-chunk validation
- [ ] Test post-merge validation
- [ ] Test attribute validation
- [ ] Test userRules.js deterministic analyzer
- [ ] Test findings merging and deduplication

### Integration Tests
- [ ] Test full category processing flow (extract → filter → prompt → AI → validate → store)
- [ ] Test multi-provider AI fallback
- [ ] Test rate limiting between categories
- [ ] Test error handling (AI failures, validation errors)

### E2E Tests
- [ ] Test complete assessment analysis (all 17 categories)
- [ ] Test with small AD (<100 users)
- [ ] Test with large AD (>10,000 users)
- [ ] Test with complex AD (multiple domains, trusts)
- [ ] Test validation accuracy (known good data = 0 findings)

### Manual Tests
- [ ] Run analysis with OpenAI provider
- [ ] Run analysis with Anthropic provider
- [ ] Run analysis with Gemini provider
- [ ] Run analysis with DeepSeek provider
- [ ] Test false positive rate (manually verify findings)
- [ ] Test false negative rate (known issues should be detected)

---

**Status**: ✅ Complete (Phase 1)
