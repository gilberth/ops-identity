# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**OpsIdentity** is an Enterprise Active Directory Hygiene & Configuration Drift Assessment Platform. It is NOT a penetration testing tool - it identifies administrative disorder, poor architecture, configuration drift, and technical debt that make AD infrastructure inefficient and unstable.

## Build and Development Commands

### Frontend (client/)

```bash
cd client
npm run dev          # Start Vite dev server (port 5173)
npm run build        # Production build
npm run build:dev    # Development build with source maps
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend (server/)

```bash
cd server
bun server.js          # Run production server (port 3000)
bun --watch server.js  # Dev mode with auto-reload
```

### Full Stack Development

```bash
# Start database first
docker compose up -d db

# Then in separate terminals:
cd client && npm run dev     # Frontend: http://localhost:5173
cd server && bun --watch server.js  # Backend: http://localhost:3000
```

### Docker Deployment

```bash
docker compose up -d --build    # Build and start all services
docker compose logs -f app      # View application logs
```

## Architecture

```
├── client/                 # React 18 + TypeScript + Vite frontend
│   └── src/
│       ├── components/     # shadcn/ui components + custom components
│       ├── pages/          # Route pages (Dashboard, AssessmentDetail, etc.)
│       └── lib/            # Utilities (reportGenerator.ts, pdfGenerator.ts)
├── server/
│   ├── server.js           # Main Express backend (~4600 lines)
│   │                       # - API endpoints, AI analysis engine
│   │                       # - Data chunking, multi-provider AI integration
│   ├── analyzers/          # Deterministic rule analyzers (e.g., userRules.js)
│   └── init.sql            # PostgreSQL schema
├── conductor/              # Product documentation and workflow guides
└── docker-compose.yml      # Multi-service orchestration (app + postgres)
```

## Key Technical Patterns

### AI Model Selection (Anthropic)

The backend dynamically selects models based on category complexity:

- **Opus 4.5**: Complex categories (Kerberos, Security, ACLs, TrustHealth, CertServices, FSMORoles)
- **Sonnet 4.5**: Standard categories (Users, Groups, GPOs, DNS, DHCP, etc.)

### Data Processing Pipeline

1. JSON upload → Validation → createAssessment()
2. For each AD category (15+):
   - Extract data → Chunk (50 items max) → Select AI model
   - Build specialized prompt → Call AI API → Parse findings
   - **Validate against source data** (anti-hallucination)
   - Store in findings table
3. Generate Word report → Mark completed

### Anti-Hallucination Rules

- Smart pre-filtering: Only send anomalies to AI (reduces tokens by 70%)
- Post-AI validation: Every finding verified against original data
- Deterministic analyzers in `server/analyzers/` for obvious issues

## API Endpoints

Core assessment APIs are at `/api/`:

- `POST /api/process-assessment` - Start analysis pipeline
- `GET /api/assessments/:id/findings` - Get findings (ordered by severity)
- `GET /api/assessments/:id/logs` - Get processing logs
- `POST /api/upload-large-file` - Upload assessment JSON (500MB limit)
- `GET /api/config/ai` - Get AI provider/model configuration

## Environment Configuration

Required in `.env`:

- `OPENAI_API_KEY` - For AI analysis (critical)

Recommended:

- `POSTGRES_PASSWORD` - Database security

Optional:

- `VITE_VPS_ENDPOINT` - Frontend API endpoint (empty = relative paths)
- `AI_PROVIDER` - openai/anthropic/gemini/deepseek
- `AI_MODEL` - Model selection

## Assessment Categories (15+)

| Category     | Focus                                                      | Model    |
| ------------ | ---------------------------------------------------------- | -------- |
| Users        | Inactive accounts, privilege escalation, password policies | Sonnet   |
| Groups       | Domain Admins, Protected Users, Tier 0 separation          | Sonnet   |
| GPOs         | Unlinked policies, disabled settings, permission issues    | Sonnet   |
| Kerberos     | KRBTGT rotation, Golden Ticket detection, encryption       | **Opus** |
| Security     | NTLM levels, SMB protocols, LAPS deployment                | **Opus** |
| ACLs         | Privilege escalation paths, excessive permissions          | **Opus** |
| CertServices | PKI vulnerabilities (ESC1-ESC8)                            | **Opus** |
| FSMORoles    | Role distribution, SPOF analysis                           | **Opus** |
| TrustHealth  | Domain trust health, password freshness                    | **Opus** |
| DNS/DHCP     | Zone transfers, forwarders, scavenging, rogue servers      | Sonnet   |
| Sites        | Replication topology, connectivity                         | Sonnet   |
| Computers    | Stale objects, Ghost records                               | Sonnet   |
| OUs          | Nesting, GPO application, Block Inheritance                | Sonnet   |
| DC Health    | Replication, services, disk space                          | Sonnet   |

## Commit Message Convention

Format: `type(scope): vX.Y.Z - description`

Examples:

- `fix(ui): v3.6.7 - Fix progress display in assessment history`
- `feat(analysis): v3.6.0 - Hygiene analysis for Sites and Replication`

## AI Development Rules

### PS1 Feature Development (MANDATORY WORKFLOW)

**CRITICAL:** When adding ANY new feature, data collection, or analysis capability to the PowerShell script (PS1), you MUST complete ALL four steps:

1. **PS1 Data Collection** (NewAssessment.tsx)
   - Add PowerShell code to collect the new data
   - Structure output as a proper object with meaningful property names
   - Include counts and arrays of affected items for hygiene analysis

2. **LLM Analysis Prompt** (server.js)
   - Add a new prompt or extend existing category prompt in `server.js`
   - Follow guidelines in `./guiaprompt.md` for prompt style
   - Ensure the prompt focuses on operational hygiene (NOT security pentesting)
   - Include anti-hallucination rules in the prompt (see step 4)

3. **DOCX Report Generation** (reportGenerator.ts)
   - **MUST use the docx skill** - Read `.claude/skills/docx/docx-js.md` completely
   - Add section to display LLM findings in the Word report
   - Use proper docx-js patterns:
     - `numbering` config for ordered lists (NOT manual "1.", "2." text)
     - `Table` with `columnWidths` for structured data display
     - `ShadingType.CLEAR` for table cell backgrounds
   - Include remediation recommendations with proper formatting

4. **Anti-Hallucination Validation** (server.js - `ATTRIBUTE_VALIDATION_RULES`)
   - **MUST use the anti-hallucination skill** - Read `.claude/skills/anti-hallucination/SKILL.md`
   - **MANDATORY**: Add validation rule in `ATTRIBUTE_VALIDATION_RULES` for each `type_id`
   - Every `affected_object` reported by the LLM MUST exist in the original JSON
   - Validation rule template:
     ```javascript
     // In server.js ATTRIBUTE_VALIDATION_RULES object:
     'NEW_TYPE_ID': {
       category: 'CategoryName',
       identifierField: 'Name',
       validate: (obj) => obj.Enabled && obj.RiskyAttribute === true,
       // For nested data (like HygieneAnalysis):
       validateAffectedObject: (objName, parentObj) => {
         return parentObj.NestedArray?.some(item =>
           item.toLowerCase().includes(objName.toLowerCase())
         );
       }
     }
     ```
   - Add to the prompt itself: `"⚠️ REGLA ANTI-ALUCINACIÓN: Solo reporta objetos que aparezcan EXPLÍCITAMENTE en los datos. NO inventes nombres."`
   - Validation happens automatically via `validateFindings()` and `validateAttributes()`

**Example flow for new feature "X":**
```
PS1: Collect X data → $result.XAnalysis = @{ Items = [...]; Count = N }
Server: Add X prompt → "Analyze X for hygiene issues... ⚠️ ANTI-ALUCINACIÓN: Solo reporta objetos reales"
Server: Validate → validateFindings(llmFindings, rawData, 'XAnalysis')
DOCX: Add X section → new Table({ rows: [...], columnWidths: [3120, 3120, 3120] })
```

**NEVER skip any step.** Incomplete implementations create data that is collected but never analyzed, reported, or validated.

### Prompt Engineering

All AI prompt modifications must follow guidelines in `./guiaprompt.md` (source of truth for style, structure, and tone).

### GitHub Operations

Use the GitHub MCP server for all remote repository operations (commits, PRs, issues, searches) rather than local git commands when interacting with GitHub platform.

### Frontend Design

For frontend design changes, layout, or image generation, invoke the "Nano Banana Pro" model (latest version).

## Byterover MCP Tools

When working in this codebase:

**Use `byterover-store-knowledge`** when:

- Learning new patterns, APIs, or architectural decisions
- Encountering error solutions or debugging techniques
- Finding reusable code patterns or utility functions
- Completing any significant task or plan implementation

**Use `byterover-retrieve-knowledge`** when:

- Starting any new task or implementation
- Before making architectural decisions
- When debugging issues to check for previous solutions
- Working with unfamiliar parts of the codebase

## Documentation Requirements

**IMPORTANT:** Whenever implementing changes, improvements, or new features in this codebase, you MUST update this CLAUDE.md file to document:

- New commands or scripts added
- Architecture changes or new components
- New API endpoints
- Configuration changes or new environment variables
- New patterns or conventions adopted
- Any significant implementation details that future developers should know

This ensures the documentation stays current and serves as a reliable reference for AI assistants and developers working on the project.
