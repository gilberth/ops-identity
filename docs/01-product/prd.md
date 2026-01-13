# Product Requirements Document (PRD)

## Document Control

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Last Updated | 2025-01-13 |
| Author | Product Team |
| Status | Live (Phase 1 Complete) |

## Executive Summary

**OpsIdentity** is an Enterprise Active Directory Hygiene, Architecture & Configuration Drift Assessment Platform. The product uses AI-powered analysis across 15+ AD categories to identify administrative disorder, architectural debt, and configuration drift that make AD infrastructure inefficient and unstable.

### Business Problem
- **AD environments are chaotic**: 40+ trusts, 100+ Domain Admins, monolithic GPOs
- **Configuration drift**: Manual changes over time create vulnerabilities
- **Lack of visibility**: No clear picture of AD health across all domains
- **Remediation gap**: Finding issues is easy, fixing them is hard

### Solution
- **AI-powered analysis**: Specialized prompts per category with 4-5 phase roadmaps
- **Operational hygiene focus**: Security is outcome of good practices
- **Actionable insights**: PowerShell commands, implementation timelines, compliance mappings
- **Anti-hallucination**: Multi-layer validation ensures findings are grounded in source data

### Success Metrics
- Assessment completion rate > 95%
- Analysis accuracy > 90%
- User engagement > 100 monthly active assessments
- AD incident rate reduced by 30% after implementation

## Target Audience

### Primary Personas

#### Persona 1: Active Directory Administrator
**Name**: Carlos
**Role**: AD Operations Manager
**Background**: 10+ years in Windows Server administration
**Goals**:
- Keep AD environment stable and performant
- Quickly identify misconfigurations
- Reduce operational overhead
- Prepare for audits and compliance checks

**Pain Points**:
- Manual AD health checks take hours
- Don't know what I don't know (blind spots)
- Competing priorities (security vs operations)
- Remediation is time-consuming and error-prone

**How OpsIdentity Helps**:
- Automated analysis across 15+ categories
- Prioritized findings by severity
- PowerShell commands ready to execute
- Compliance mappings (CIS, NIST, ISO 27001)

#### Persona 2: System Architect
**Name**: Sarah
**Role**: Enterprise Infrastructure Architect
**Background**: 15+ years designing AD topologies
**Goals**:
- Validate AD design decisions
- Identify architectural debt
- Plan migrations and consolidations
- Ensure scalability and resilience

**Pain Points**:
- No visibility into trust relationships
- FSMO role concentration unknown
- Replication topology poorly documented
- Site topology not optimal

**How OpsIdentity Helps**:
- Trust health analysis (orphaned trusts, password freshness)
- FSMO role distribution reports
- Replication topology and latency analysis
- Site/subnet topology validation

#### Persona 3: Security Engineer
**Name**: James
**Role**: Information Security Engineer
**Background**: 8+ years in security operations
**Goals**:
- Harden AD infrastructure
- Reduce attack surface
- Achieve compliance certifications
- Respond to security incidents

**Pain Points**:
- LAPS not deployed consistently
- Kerberos configuration weak
- Delegation risks unidentified
- Password policies not enforced

**How OpsIdentity Helps**:
- Security category analysis (NTLM, SMB, LAPS, LDAP signing)
- Kerberos configuration review (KRBTGT rotation, weak encryption)
- Delegation analysis (unconstrained, constrained, RBCD)
- Password policy audit (complexity, expiration, history)

### Secondary Personas

#### Persona 4: IT Manager
**Name**: Lisa
**Role**: IT Operations Manager
**Background**: 12+ years in IT management
**Goals**:
- Track AD health over time
- Report to executive leadership
- Justify budget for remediation
- Manage team workload

**How OpsIdentity Helps**:
- Executive dashboard with security scores
- Trend analysis (Phase 2)
- Professional DOCX reports with business impact
- Prioritized remediation roadmaps

#### Persona 5: Compliance Officer
**Name**: Michael
**Role**: Compliance & Risk Manager
**Background**: 6+ years in compliance management
**Goals**:
- Achieve SOC2 certification
- Maintain ISO 27001 compliance
- Prepare for audits
- Document security posture

**How OpsIdentity Helps**:
- CIS Control mappings (v8)
- NIST 800-53 controls
- ISO 27001 alignment
- GDPR data protection considerations
- Audit-ready reports with evidence

## Functional Requirements

### FR-1: Assessment Creation
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As an AD administrator, I want to create a new assessment by generating a PowerShell script that I can run on my Domain Controller, so that I can collect AD data for analysis.

**Acceptance Criteria**:
1. User enters domain name (required field)
2. User selects analysis modules (Infrastructure, Replication, Security, GPO, Core, ADCS)
3. System generates unique assessment ID (UUID)
4. System generates PowerShell script with:
   - Assessment ID embedded
   - Module selection
   - UTF-8 encoding
   - TLS 1.2 enforcement
   - Error handling
   - Progress indicators
5. User downloads script
6. Script collects AD data using PowerShell cmdlets (7+ functions per module)
7. Script validates collected data
8. Script uploads JSON to `/api/process-assessment` or `/api/upload-large-file`
9. System stores data in `assessment_data` table (JSONB)
10. System updates assessment status to 'analyzing'

**Dependencies**:
- PowerShell 5.1+ on DC
- RSAT/AD module installed
- Network connectivity to API endpoint

### FR-2: AI Analysis Engine
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As the system, I want to analyze AD data using AI models with specialized prompts per category, so that I can identify misconfigurations and operational issues.

**Acceptance Criteria**:
1. System extracts available categories from JSON data
2. System applies smart filtering (reduce dataset to relevant objects only)
3. System updates progress: `category.status = 'processing'`
4. System generates specialized prompt based on category (15+ prompts)
5. System selects AI model:
   - Opus 4.5 for complex categories (Kerberos, Security, ACLs, TrustHealth, CertServices, FSMORolesHealth)
   - Sonnet 4.5 for standard categories
6. System chunks data if > 40 items
7. System sends requests to AI provider with prompt
8. System parses AI response (multiple fallback strategies)
9. System validates findings per-chunk using `validateFindingsPerChunk`
10. System merges findings from chunks (deduplicate by type_id)
11. System validates all merged findings with `validateFindings`
12. System validates attributes with `validateAttributes`
13. System inserts validated findings into `findings` table
14. System updates progress: `category.status = 'completed'`, `progress = 100%`
15. System applies 20s rate limit between categories

**Dependencies**:
- AI provider API keys configured
- OpenAI/Anthropic/Gemini/DeepSeek APIs available
- Validation rules defined in `ATTRIBUTE_VALIDATION_RULES`

### FR-3: Anti-Hallucination Validation
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As the system, I want to validate all AI findings against source data, so that I don't invent findings that don't exist.

**Acceptance Criteria**:
1. **Per-chunk validation** (`validateFindingsPerChunk`):
   - Verify each `affected_object` exists in chunk data
   - Verify `affected_count` matches actual count
   - Reject findings with non-existent objects

2. **Post-merge validation** (`validateFindings`):
   - Verify each `affected_object` exists in full assessment data
   - Use n-gram indexing for fuzzy matching
   - Update `affected_count` to match verified data

3. **Attribute validation** (`validateAttributes`):
   - Verify objects actually have claimed vulnerability attributes
   - Use validation rules in `ATTRIBUTE_VALIDATION_RULES`
   - Reject findings where objects don't meet criteria

4. **Smart filtering**:
   - Pre-filter data before AI to reduce noise
   - Users category uses deterministic rules (`userRules.js`)
   - Reduces token usage by 70%

5. **Validation rules coverage**:
   - All `type_id` values must have validation rule
   - Rules must check both object existence and attributes
   - Rules must be documented in `server.js`

**Dependencies**:
- `ATTRIBUTE_VALIDATION_RULES` object defined
- `userRules.js` deterministic analyzer
- Validation functions tested against real data

### FR-4: Real-time Progress Tracking
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As a user, I want to see real-time progress of AI analysis, so that I know how long the assessment will take.

**Acceptance Criteria**:
1. Frontend polls assessment every 5 seconds while `status='analyzing'`
2. Backend updates `assessment.analysis_progress` with per-category status
3. Progress structure:
   ```json
   {
     "categoryId": {
       "status": "pending|processing|completed",
       "progress": 0-100,
       "count": N
     }
   }
   ```
4. Frontend displays `AnalysisProgress` component with category progress bars
5. Frontend displays `AssessmentLogs` component with real-time log stream
6. All categories complete → Update `assessment.status = 'completed'`, `completed_at = NOW()`
7. System handles polling errors gracefully (retry with exponential backoff)

**Dependencies**:
- WebSocket not required (polling is sufficient)
- Backend stores progress in `analysis_progress` JSONB column
- Frontend uses `setInterval` with 5s interval

### FR-5: Dashboard
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As a user, I want to see a dashboard with security scores, category analysis, and assessment history, so that I can quickly understand my AD health.

**Acceptance Criteria**:
1. **Security Score**:
   - Letter grade (A-F) based on severity-weighted findings
   - Trend indicator (improved, declined, stable)
   - Visual color-coding (A=green, F=red)

2. **Category Analysis**:
   - Radar chart across 15 categories
   - Category health cards with scores
   - Severity bar (Critical, High, Medium, Low counts)

3. **Top Findings**:
   - Carousel of priority findings
   - Sort by severity, affected count, business impact
   - Quick links to full findings

4. **Objects Analyzed**:
   - Users, Computers, Groups, GPOs, DCs, Trusts counts
   - Icon badges with counts

5. **Assessment History**:
   - Table with assessments (date, domain, status, findings count)
   - Filter by status (all/pending/analyzing/completed/failed)
   - Actions: View, Delete, Reset

6. **Data Loading**:
   - Load latest assessment on page load
   - Handle no assessments (empty state)
   - Error handling with retry button

**Dependencies**:
- React Query for data fetching
- Recharts for visualizations
- shadcn/ui components

### FR-6: Report Generation
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As a user, I want to generate professional reports in DOCX/PDF format with compliance mappings, so that I can share findings with stakeholders.

**Acceptance Criteria**:
1. **DOCX Report** (`lib/reportGenerator.ts`):
   - Executive Summary (security score, key findings, top priorities)
   - Findings by Severity (Critical, High, Medium, Low sections with tables)
   - Compliance Matrix (CIS, NIST 800-53, ISO 27001, PCI-DSS, SOX, GDPR)
   - Findings Detail (each finding with description, recommendation, evidence)
   - Implementation Roadmap (4-phase roadmap for each finding type)
   - DC Health Analysis (operational health with remediation tables)
   - Appendices (assessment metadata, executive note, methodology)

2. **PDF Report** (`lib/pdfGenerator.ts`):
   - Two-page security scorecard
   - Security score visualization (large letter grade)
   - Category radar charts
   - Severity breakdown bar charts
   - Executive summary section

3. **Raw Data PDF** (`lib/rawDataPdfGenerator.ts`):
   - Technical appendix with complete AD inventory
   - User inventory (all users with risk flags)
   - Computer inventory (OS, last logon, status)
   - Group inventory (members, privilege levels)
   - GPO inventory (settings, links, permissions)
   - Password policies (domain and fine-grained)

4. **Export Options**:
   - CSV exports (users, computers, groups, risk-specific)
   - Download triggers in browser
   - File name format: `assessment-{domain}-{date}.docx` or `.pdf`

5. **Styling**:
   - Professional branding (navy blue primary)
   - Severity-coded text/borders
   - Alternating row colors for tables
   - Consistent fonts (Arial)

**Dependencies**:
- docx 9.5.1 library
- jspdf 3.0.4 library
- jspdf-autotable 5.0.2
- Recharts for SVG export

### FR-7: Multi-Tenant Support
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As a user, I want to manage multiple organizations/clients, so that I can assess multiple AD environments separately.

**Acceptance Criteria**:
1. **Client Selection**:
   - User selects organization/client from dropdown
   - Selection persists across page refreshes (localStorage)
   - Redirect to dashboard on selection

2. **Client Management**:
   - List all clients (name, contact_email, status, created_at)
   - Create new client (name, contact_email)
   - Default client for new users

3. **Data Isolation**:
   - Assessments filtered by `client_id`
   - Dashboard shows data only for current client
   - User can switch clients at any time

4. **API Integration**:
   - `GET /api/clients` - List clients
   - `POST /api/clients` - Create client
   - `GET /api/assessments?clientId=X` - Filter by client
   - `POST /api/assessments` with `client_id` parameter

5. **State Management**:
   - `ClientContext.tsx` for global state
   - `useClient()` custom hook
   - LocalStorage persistence

**Dependencies**:
- `ClientContext` provider
- `clients` table in database
- Foreign key constraint: `assessments.client_id → clients.id`

### FR-8: Admin Panel
**Priority**: P1 (Should Have)
**Status**: ✅ Complete

**User Story**: As an admin, I want to manage assessments and AI configuration, so that I can troubleshoot issues and optimize costs.

**Acceptance Criteria**:
1. **Assessment Management**:
   - View all assessments with status filters
   - Real-time polling for status changes
   - Restart assessment (clear findings, re-analyze)
   - Delete assessment with confirmation dialog

2. **AI Configuration**:
   - Select AI provider (OpenAI, Anthropic, Gemini, DeepSeek)
   - Select model from provider's available models
   - Update API keys (stored in `system_config` table)
   - View current configuration

3. **Status Filters**:
   - All, Pending, Analyzing, Completed, Failed
   - Sort by date, domain, status

4. **Actions**:
   - Restart: `POST /api/assessments/:id/reset`
   - Delete: `DELETE /api/assessments/:id`
   - View: Navigate to assessment detail

**Dependencies**:
- Admin authentication (Authentik OAuth2)
- `system_config` table for AI settings
- AI provider API keys management

### FR-9: Authentik OAuth2 Integration
**Priority**: P1 (Should Have)
**Status**: ✅ Complete

**User Story**: As an admin, I want to configure Authentik OAuth2 for SSO, so that I can manage access control centrally.

**Acceptance Criteria**:
1. **Setup Wizard** (`/setup`):
   - Enter Authentik base URL and API token
   - Test connection
   - Create OAuth2 provider (redirect URI = VPS_ENDPOINT/callback)
   - Create application with provider link
   - Save configuration to `.env` file

2. **OAuth2 Flow**:
   - `/auth` route initiates flow
   - `/callback` route handles redirect
   - `/api/auth/callback` exchanges code for token
   - Session state managed via `express-session`

3. **Protected Routes**:
   - `ProtectedRoute` component wraps authenticated routes
   - Redirect to `/auth` if not authenticated
   - Persist session across page refreshes

4. **Configuration**:
   - AUTHENTIK_BASE_URL
   - AUTHENTIK_CLIENT_ID
   - AUTHENTIK_CLIENT_SECRET
   - AUTHENTIK_SLUG

**Dependencies**:
- Authentik server accessible
- passport-oauth2 middleware
- express-session for session management

### FR-10: Category-Specific Analysis
**Priority**: P0 (Must Have)
**Status**: ✅ Complete

**User Story**: As the system, I want to analyze each AD category with specialized prompts and smart filtering, so that I can identify specific misconfigurations per category.

**Acceptance Criteria**:

| Category | Model | Smart Filtering | Validation Rules |
|----------|-------|----------------|-----------------|
| Users | Deterministic | Yes | userRules.js |
| Computers | Sonnet 4.5 | Yes | Legacy OS, stale, delegation |
| Groups | Sonnet 4.5 | Yes | Privileged, empty, excessive |
| GPOs | Sonnet 4.5 | Yes | Unlinked, disabled, monolithic |
| DNS | Sonnet 4.5 | Yes | Public forwarders, scavenging |
| DHCP | Sonnet 4.5 | Yes | Rogue servers, scope issues |
| DCHealth | Sonnet 4.5 | Yes | Replication, legacy OS |
| ReplicationStatus | Sonnet 4.5 | Yes | Failures, lingering objects |
| TrustHealth | Sonnet 4.5 | Yes | Broken, SID filtering |
| OrphanedTrusts | Sonnet 4.5 | Yes | Orphaned, suspicious |
| FSMORolesHealth | Sonnet 4.5 | Yes | Latency, concentration |
| Sites | Sonnet 4.5 | Yes | Default site, missing subnets |
| Kerberos | Opus 4.5 | N/A | KRBTGT, weak encryption |
| Security | Opus 4.5 | N/A | NTLM, SMB, LAPS |
| PasswordPolicies | Sonnet 4.5 | N/A | Weak policies |
| ProtocolSecurity | Sonnet 4.5 | N/A | LDAP signing, NTLM |
| ADCSInventory | Sonnet 4.5 | N/A | ESC1-ESC8, CA placement |

**Dependencies**:
- Category-specific prompts in `server.js` (lines 1543-3543)
- Smart filtering logic in `extractCategoryData()` (lines 171-659)
- Validation rules for each category

## Non-Functional Requirements

### NFR-1: Performance
| Metric | Target | Current Status |
|--------|--------|----------------|
| Assessment analysis time | < 15 min (15 categories) | ✅ 10-15 min |
| Report generation time | < 30 sec | ✅ 10-30 sec |
| API response time (p95) | < 500ms | ✅ 200-500ms |
| Database query time (p95) | < 1s | ✅ 50-200ms |
| Frontend load time | < 3s | ⚠️ 2-4s |

### NFR-2: Scalability
| Metric | Target | Current Status |
|--------|--------|----------------|
| Concurrent users | 100+ | ⚠️ Not tested |
| Assessments per day | 1000+ | ⚠️ Not tested |
| Assessment size | Up to 5GB | ✅ Configurable |
| Database storage | 10TB+ | ✅ PostgreSQL scaling |

### NFR-3: Reliability
| Metric | Target | Current Status |
|--------|--------|----------------|
| Uptime | 99.5%+ | ⚠️ No monitoring |
| Error rate | < 1% | ⚠️ Not measured |
| Data loss | 0% | ✅ PostgreSQL ACID |
| Recovery time | < 1 hour | ⚠️ No backups configured |

### NFR-4: Security
| Requirement | Target | Current Status |
|-------------|--------|----------------|
| TLS 1.2+ | Required | ✅ Enforced |
| Data encryption at rest | AES-256 | ⚠️ Not configured |
| API key storage | Environment variables | ✅ Yes |
| Input validation | All endpoints | ✅ Yes |
| SQL injection protection | Prepared statements | ✅ Yes |
| XSS protection | Sanitization | ✅ DOMPurify |

### NFR-5: Availability
| Metric | Target | Current Status |
|--------|--------|----------------|
| Maintenance windows | < 4 hours/month | ✅ Docker rolling updates |
| Planned downtime | < 1% | ✅ Docker deployments |
| Disaster recovery | RPO < 1 hour | ⚠️ Not configured |
| Backup retention | 30 days | ⚠️ Not configured |

## Technical Constraints

### TC-1: Technology Stack
- **Frontend**: React 18.3, TypeScript 5.8, Vite 5.4, Tailwind CSS
- **Backend**: Node.js 18 (or Bun 1), Express 4.18, PostgreSQL 15
- **AI Providers**: OpenAI, Anthropic, Gemini, DeepSeek
- **Deployment**: Docker Compose (multi-stage builds)

### TC-2: Hosting Requirements
- **Minimum**: 2 vCPU, 4 GB RAM, 20 GB disk
- **Recommended**: 4 vCPU, 8 GB RAM, 50 GB disk
- **Network**: 5 Mbps+ upload bandwidth

### TC-3: Client Requirements
- **PowerShell**: 5.1+ on Domain Controller
- **RSAT**: AD module installed
- **Network**: Connectivity to API endpoint
- **Privileges**: Domain Admin or equivalent

### TC-4: Compliance Requirements
- **Data Residency**: Configurable (PostgreSQL location)
- **Audit Logging**: Available but not configured
- **Data Retention**: Configurable (database cleanup jobs)
- **GDPR**: Data export and deletion available

## Out of Scope

### Phase 1 Out of Scope
1. **Historical Trend Analysis**: Compare assessments over time
2. **Configuration Drift Detection**: Automated detection of changes
3. **Automated Remediation**: Execute PowerShell commands remotely
4. **Real-time Monitoring**: Continuous AD health checks
5. **Mobile App**: Mobile-optimized interface
6. **Multi-language Support**: Beyond English/Spanish
7. **Self-Hosted AI**: Local LLM support (Ollama)
8. **Advanced Analytics**: Machine learning for predictive insights
9. **API for Third-Party Integrations**: Public API with auth
10. **Assessment Templates**: Preset configurations for different industries

### Future Phases
See `vision.md` for Phase 2 and Phase 3 plans.

## Dependencies & Risks

### Dependencies
1. **AI Provider APIs**: OpenAI/Anthropic/Gemini/DeepSeek availability
2. **PowerShell Scripts**: User must have access to run scripts on DCs
3. **Network Connectivity**: User must reach API endpoint
4. **PostgreSQL**: Database must be available
5. **Docker**: Deployment requires Docker runtime

### Risks
1. **AI Provider Outage**: Fallback to alternative provider
2. **Cost Overrun**: Usage-based pricing from AI providers
3. **False Positives**: Validation rules must be continuously refined
4. **Data Privacy**: Assessment data contains sensitive information
5. **Adoption Rate**: Users may prefer existing tools (PingCastle, etc.)

## Release Plan

### Phase 1 (Current) - Complete ✅
- 15+ AD categories with AI analysis
- Multi-provider AI support
- Anti-hallucination validation
- Real-time progress tracking
- Dashboard and reporting
- Multi-tenant support
- Admin panel
- Authentik OAuth2 integration

### Phase 2 (Next 6 months) - Planned
- Historical trend analysis
- Configuration drift detection
- Automated remediation orchestration
- Assessment templates and presets
- Public API for third-party integrations
- Enhanced monitoring and alerting

### Phase 3 (6-12 months) - Planned
- Scheduled automated assessments
- Real-time monitoring alerts
- Mobile app for quick assessments
- Knowledge base integration
- Community prompt library
- Multi-language support

---

**This document is single source of truth for product requirements. All features must be traceable to this PRD.**

**Version History**:
- v1.0 (2025-01-13): Initial PRD for Phase 1
