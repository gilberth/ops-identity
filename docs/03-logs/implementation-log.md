# Implementation Log

## 2026-01-13

### Added
- Created comprehensive documentation structure following modern best practices
- Added `/docs/00-context/` directory with vision, assumptions, system-state
- Added `/docs/01-product/` directory with PRD
- Added `/docs/02-features/` directory with feature specifications
- Added `/docs/03-logs/` directory for memory tracking
- Added `/docs/04-process/` directory for workflow documentation

### Changed
- Updated `CLAUDE.md` to reference new documentation structure
- Updated project overview to reflect completed Phase 1 features
- **Added `ReplicationStatus` to CATEGORIES array** (`server/server.js:56-62`)
  - The `ReplicationStatus` prompt (80+ lines) was defined but never executed
  - Now runs alongside `ReplicationHealthAllDCs` for comprehensive replication analysis
  - Analyzes: lingering objects, prolonged failures, KCC storms, partner distribution, freshness

### Fixed
- **Replication table empty in DOCX report** (`client/src/lib/reportGenerator.ts:1734-1850`)
  - **Root cause**: Code expected `ReplicationHealthAllDCs` as an array, but actual structure is nested object with `Summary` and `DomainControllers` properties
  - **Fix**: Added support for `ReplicationHealthAllDCs.DomainControllers` with `InboundPartners` structure
  - **Changes**:
    - Extract DC name from Distinguished Name: `CN=NTDS Settings,CN=TLSCH-AD1,...` → `TLSCH-AD1`
    - Display replication lag in status column: `OK (12.3 min)`
    - Added summary paragraph: "X DCs sanos, Y degradados, Z enlaces fallidos"
    - Added informative message when no data found
    - Increased row limit from 20 to 30
  - **Verified**: Build passes, replication data now renders correctly

### Notes
- Documentation is now centralized in `/docs/` directory
- All features are documented with acceptance criteria, tech design, dev tasks, and test plans
- This serves as single source of truth for project understanding

---

## 2024-12-XX

### Added
- Multi-tenant client management
- Client selection UI with persistence
- ClientContext for global state management
- Client filtering on assessments API

### Changed
- Dashboard now filters by selected client
- New assessments can be assigned to clients
- Assessments table includes client_id foreign key

### Fixed
- Client selection not persisting across page refreshes
- Assessments not properly filtered by client_id

---

## 2024-11-22

### Added
- Authentik OAuth2 integration
- OAuth2 setup wizard (`/setup` route)
- ProtectedRoute component for authentication
- Session management with express-session

### Changed
- App.tsx now wraps routes with ProtectedRoute
- Added `/auth` and `/callback` routes
- Added `/api/auth/callback` endpoint

### Fixed
- OAuth2 flow not completing properly
- Session not persisting across requests

---

## 2024-10-XX

### Added
- AIConfigPanel for provider and model management
- Multi-provider AI support (OpenAI, Anthropic, Gemini, DeepSeek)
- System configuration API (`/api/config/ai`)
- API key storage in system_config table

### Changed
- Admin panel now includes AI configuration section
- AI provider and model are configurable per assessment
- Added provider selection in NewAssessment

### Fixed
- API keys not persisting across server restarts
- Provider switching not updating AI client

---

## 2024-09-XX

### Added
- Real-time progress tracking
- AnalysisProgress component with category progress bars
- AssessmentLogs component with real-time log stream
- Frontend polling (5s interval) for assessment status

### Changed
- AssessmentDetail.tsx now polls while status='analyzing'
- Backend updates analysis_progress JSONB column
- Added 20s rate limit between categories

### Fixed
- Progress not updating in real-time
- Logs not displaying correctly
- Polling not stopping after assessment completion

---

## 2024-08-XX

### Added
- Anti-hallucination validation system
- Per-chunk validation (validateFindingsPerChunk)
- Post-merge validation (validateFindings)
- Attribute validation (validateAttributes)
- ATTRIBUTE_VALIDATION_RULES mapping for all type_ids

### Changed
- All AI findings now pass through 3-layer validation
- Smart filtering reduces token usage by 70%
- Users category uses deterministic rules (userRules.js)

### Fixed
- AI inventing objects that don't exist
- False positives from unvalidated findings
- Attribute claims not matching source data

---

## 2024-07-XX

### Added
- 17 AD categories with specialized AI prompts
- Smart filtering for 11 categories
- AI model selection (Opus 4.5 for complex, Sonnet 4.5 for standard)
- Compliance mappings (CIS, NIST, ISO 27001, PCI-DSS, SOX, GDPR)
- MITRE ATT&CK technique mappings

### Changed
- server.js expanded from ~2000 to ~4600 lines
- Added buildPrompt() with 2000+ lines of category-specific instructions
- Added extractCategoryData() with smart filtering logic

### Fixed
- Generic prompts not capturing category-specific issues
- Token usage excessive (>100k tokens per assessment)

---

## 2024-06-XX

### Added
- DOCX report generation (reportGenerator.ts)
- PDF report generation (pdfGenerator.ts)
- Raw data PDF generation (rawDataPdfGenerator.ts)
- Export modal with multiple format options

### Changed
- AssessmentDetail.tsx now includes "Generate Report" button
- Added compliance matrix to reports
- Added implementation roadmaps (4 phases)

### Fixed
- Report generation timing out on large assessments
- Incorrect table formatting in DOCX
- PDF fonts not rendering correctly

---

## 2024-05-XX

### Added
- Dashboard with security score and category analysis
- LetterGrade component (A-F score)
- CategoryRadar component (visual comparison)
- SeverityBar component (finding counts)
- TopFindings carousel
- ObjectsAnalyzed count badges

### Changed
- App.tsx now includes `/dashboard` route
- Added assessment history table
- Added status filters (all/pending/analyzing/completed/failed)

### Fixed
- Security score calculation errors
- Radar chart not displaying correctly
- Assessment history not updating

---

## 2024-04-XX

### Added
- NewAssessment.tsx with PowerShell script generation
- 27+ data collection functions
- Module selection (Infrastructure, Replication, Security, GPO, Core, ADCS)
- Offline mode with ZIP export

### Changed
- Assessment creation flow now generates and downloads script
- Script includes assessment ID and module selection
- Added connectivity check and TLS 1.2 enforcement

### Fixed
- Script not downloading correctly
- Module selection not working
- UTF-8 encoding issues

---

## 2024-03-XX

### Added
- Initial assessment creation flow
- POST /api/assessments endpoint
- POST /api/process-assessment endpoint
- POST /api/upload-large-file endpoint
- Assessment data storage in assessment_data table

### Changed
- PowerShell script now uploads to /api/process-assessment
- Large files (>50MB) upload to /api/upload-large-file
- Data stored as JSONB with gzip compression

### Fixed
- Large file uploads timing out
- JSON validation errors
- Database insertion failures

---

## 2024-02-XX

### Added
- Initial project scaffold
- PostgreSQL database schema (init.sql)
- Express server with CORS and JSON middleware
- React frontend with Vite and TypeScript
- shadcn/ui components

### Changed
- Project structure established
- Docker Compose configuration
- Environment variable configuration

### Fixed
- Initial setup issues with Docker
- Database connection pool configuration

---

**This log tracks all significant changes to the codebase. Update regularly to maintain project history.**
