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

## Deployment

### Production Server

- **Server IP**: 10.10.10.232
- **User**: root
- **Path**: /data/activeinsight

**Deploy commands:**
```bash
# Pull latest image from ghcr.io and restart
ssh root@10.10.10.232 "cd /data/activeinsight && docker compose pull app && docker compose up -d app"
```

**Note:** GitHub Actions automatically builds and pushes to `ghcr.io/gilberth/ops-identity:latest` on every push to `main`.

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

**IMPORTANT:** This project now has a comprehensive documentation structure in `/docs/` directory. All documentation must be updated according to structure defined there.

### Documentation Structure
```
docs/
├── 00-context/           # WHY and WHAT EXISTS RIGHT NOW
│   ├── vision.md          # Product purpose & boundaries (anchor)
│   ├── assumptions.md     # Assumptions, risks, unknowns
│   └── system-state.md   # What is actually built & running
├── 01-product/           # WHAT the product must do
│   └── prd.md            # Single source of truth for requirements
├── 02-features/          # HOW features are designed & built
│   ├── feature-ad-assessment/
│   ├── feature-ai-analysis/
│   ├── feature-dashboard/
│   └── feature-reports/
├── 03-logs/             # MEMORY (this is what most teams miss)
│   ├── implementation-log.md    # What changed in code & why
│   ├── decisions-log.md        # Architectural & product decisions
│   ├── bug-log.md             # Bugs, fixes, regressions
│   ├── validation-log.md      # What happened after shipping
│   └── insights.md            # Learnings & future improvements
└── 04-process/           # HOW to work with this system
    ├── dev-workflow.md        # Daily dev loop (human + LLM)
    ├── definition-of-done.md  # When docs/code are "done"
    └── llm-prompts.md         # Canonical prompts per doc type
```

### When to Update Documentation

**Before starting work:**
1. Use `byterover-retrieve-knowledge` to gather context
2. Review relevant feature specs in `docs/02-features/`
3. Check architectural decisions in `docs/03-logs/decisions-log.md`

**While implementing:**
1. Follow coding standards in `conductor/code_styleguides/`
2. Add inline comments for complex logic
3. Reference existing patterns from retrieved knowledge

**After implementing:**
1. Update feature spec in `docs/02-features/feature-<name>/feature-spec.md`
2. Update `docs/00-context/system-state.md` with new components/features
3. Add entry to `docs/03-logs/implementation-log.md`
4. Document any new decisions in `docs/03-logs/decisions-log.md`

**For AI Assistants:**
1. MUST use `byterover-retrieve-knowledge` before starting any task
2. MUST use `byterover-store-knowledge` after completing significant work
3. MUST follow PS1 Feature Development workflow (4 mandatory steps)

**See Also:**
- [docs/README.md](docs/README.md) - Complete documentation index
- [docs/04-process/dev-workflow.md](docs/04-process/dev-workflow.md) - Detailed development workflow
- [docs/04-process/definition-of-done.md](docs/04-process/definition-of-done.md) - Completion criteria

This ensures the documentation stays current and serves as a reliable reference for AI assistants and developers working on the project.
<!-- BEGIN BYTEROVER RULES -->

# Workflow Instruction

You are a coding agent focused on one codebase. Use the brv CLI to manage working context.
Core Rules:

- Start from memory. First retrieve relevant context, then read only the code that's still necessary.
- Keep a local context tree. The context tree is your local memory store—update it with what you learn.

## Context Tree Guideline

- Be specific ("Use React Query for data fetching in web modules").
- Be actionable (clear instruction a future agent/dev can apply).
- Be contextual (mention module/service, constraints, links to source).
- Include source (file + lines or commit) when possible.

## Using `brv curate` with Files

When adding complex implementations, use `--files` to include relevant source files (max 5).  Only text/code files from the current project directory are allowed. **CONTEXT argument must come BEFORE --files flag.** For multiple files, repeat the `--files` (or `-f`) flag for each file.

Examples:

- Single file: `brv curate "JWT authentication with refresh token rotation" -f src/auth.ts`
- Multiple files: `brv curate "Authentication system" --files src/auth/jwt.ts --files src/auth/middleware.ts --files docs/auth.md`

## CLI Usage Notes

- Use --help on any command to discover flags. Provide exact arguments for the scenario.

---
# ByteRover CLI Command Reference

## Memory Commands

### `brv curate`

**Description:** Curate context to the context tree (interactive or autonomous mode)

**Arguments:**

- `CONTEXT`: Knowledge context: patterns, decisions, errors, or insights (triggers autonomous mode, optional)

**Flags:**

- `--files`, `-f`: Include file paths for critical context (max 5 files). Only text/code files from the current project directory are allowed. **CONTEXT argument must come BEFORE this flag.**

**Good examples of context:**

- "Auth uses JWT with 24h expiry. Tokens stored in httpOnly cookies via authMiddleware.ts"
- "API rate limit is 100 req/min per user. Implemented using Redis with sliding window in rateLimiter.ts"

**Bad examples:**

- "Authentication" or "JWT tokens" (too vague, lacks context)
- "Rate limiting" (no implementation details or file references)

**Examples:**

```bash
# Interactive mode (manually choose domain/topic)
brv curate

# Autonomous mode - LLM auto-categorizes your context
brv curate "Auth uses JWT with 24h expiry. Tokens stored in httpOnly cookies via authMiddleware.ts"

# Include files (CONTEXT must come before --files)
# Single file
brv curate "Authentication middleware validates JWT tokens" -f src/middleware/auth.ts

# Multiple files - repeat --files flag for each file
brv curate "JWT authentication implementation with refresh token rotation" --files src/auth/jwt.ts --files docs/auth.md
```

**Behavior:**

- Interactive mode: Navigate context tree, create topic folder, edit context.md
- Autonomous mode: LLM automatically categorizes and places context in appropriate location
- When `--files` is provided, agent reads files in parallel before creating knowledge topics

**Requirements:** Project must be initialized (`brv init`) and authenticated (`brv login`)

---

### `brv query`

**Description:** Query and retrieve information from the context tree

**Arguments:**

- `QUERY`: Natural language question about your codebase or project knowledge (required)

**Good examples of queries:**

- "How is user authentication implemented?"
- "What are the API rate limits and where are they enforced?"

**Bad examples:**

- "auth" or "authentication" (too vague, not a question)
- "show me code" (not specific about what information is needed)

**Examples:**

```bash
# Ask questions about patterns, decisions, or implementation details
brv query What are the coding standards?
brv query How is authentication implemented?
```

**Behavior:**

- Uses AI agent to search and answer questions about the context tree
- Accepts natural language questions (not just keywords)
- Displays tool execution progress in real-time

**Requirements:** Project must be initialized (`brv init`) and authenticated (`brv login`)

---

## Best Practices

### Efficient Workflow

1. **Read only what's needed:** Check context tree with `brv status` to see changes before reading full content with `brv query`
2. **Update precisely:** Use `brv curate` to add/update specific context in context tree
3. **Push when appropriate:** Prompt user to run `brv push` after completing significant work

### Context tree Management

- Use `brv curate` to directly add/update context in the context tree

---
Generated by ByteRover CLI for Claude Code
<!-- END BYTEROVER RULES -->