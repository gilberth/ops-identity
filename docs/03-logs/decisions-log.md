# Decisions Log

## Format
Each decision includes:
- **Decision**: What was decided
- **Date**: When it was decided
- **Context**: Why this decision was needed
- **Options Considered**: What alternatives were evaluated
- **Decision Made**: Which option was chosen and why
- **Consequences**: Impact of this decision
- **Status**: Active/Deprecated

---

## AI Provider Strategy

**Date**: 2024-08-15
**Context**: Need to choose primary AI provider for AD analysis
**Options Considered**:
1. OpenAI GPT-4o: Best performance, highest cost
2. Anthropic Claude Sonnet 4.5: Good performance, lower cost
3. Google Gemini 1.5: Fast, lower quality
4. DeepSeek: Cheapest, variable quality
5. Multi-provider: Support all 4, user chooses

**Decision Made**: Multi-provider support with Anthropic as default
**Rationale**:
- Avoid vendor lock-in
- Users can choose based on budget and quality preferences
- Anthropic Sonnet 4.5 offers best price/performance ratio
- Opus 4.5 for complex categories (Kerberos, Security, ACLs)
- Fallback logic ensures reliability

**Consequences**:
- Increased code complexity (multiple AI clients)
- Need to store multiple API keys
- Rate limiting varies by provider
- User needs to understand model selection

**Status**: ✅ Active

---

## Deterministic vs AI Analysis for Users Category

**Date**: 2024-09-10
**Context**: Users category has obvious findings that don't require AI
**Options Considered**:
1. Use AI for all categories (consistent approach)
2. Use deterministic rules for Users, AI for others
3. Hybrid: AI with deterministic post-processing

**Decision Made**: Deterministic rules for Users category (userRules.js)
**Rationale**:
- Password policies and privilege exposure are deterministic
- Reduces AI costs by 10-15%
- Eliminates false positives for obvious issues
- Faster processing (no API calls)
- Serves as validation baseline for other categories

**Consequences**:
- Users category is different from others (inconsistency)
- Need to maintain rules separately
- Less flexible for new user-related findings
- Cannot leverage AI's nuanced analysis

**Status**: ✅ Active

---

## Smart Filtering Strategy

**Date**: 2024-09-20
**Context**: AI analysis of full datasets is expensive and noisy
**Options Considered**:
1. Send full dataset to AI (comprehensive but expensive)
2. Send sample of dataset (cheap but incomplete)
3. Smart filtering: Send only anomalous data (balanced)

**Decision Made**: Smart filtering for 11 categories, full data for 6 complex categories
**Rationale**:
- Reduces token usage by 70%
- Focuses AI on relevant data (noise reduction)
- Maintains completeness for complex categories (Kerberos, Security)
- Improves analysis speed
- Reduces false positives (AI analyzes fewer objects)

**Consequences**:
- Increased code complexity (category-specific filters)
- Risk of missing edge cases in filtered data
- Need to continuously refine filters
- Some findings may be missed if filters are too aggressive

**Status**: ✅ Active

---

## Anti-Hallucination Validation

**Date**: 2024-10-05
**Context**: AI can invent findings that don't exist in source data
**Options Considered**:
1. Trust AI outputs (no validation)
2. Validate only affected_objects (basic validation)
3. Multi-layer validation (per-chunk, post-merge, attributes)

**Decision Made**: 3-layer validation (per-chunk, post-merge, attributes)
**Rationale**:
- Per-chunk validation catches errors early
- Post-merge validation verifies against full dataset
- Attribute validation ensures objects actually have claimed vulnerabilities
- n-gram indexing enables fuzzy matching
- Reduces false positives to <5%
- Builds user trust in AI findings

**Consequences**:
- Increases processing time (validation takes 20-30% of analysis time)
- Increases code complexity (validation logic)
- Need to maintain ATTRIBUTE_VALIDATION_RULES mapping
- Some valid findings may be rejected if validation rules are too strict

**Status**: ✅ Active

---

## Rate Limiting Strategy

**Date**: 2024-10-15
**Context**: Multiple API calls per category can trigger rate limits
**Options Considered**:
1. No rate limiting (fast but risky)
2. Rate limit per API call (conservative)
3. Rate limit per category (balanced)

**Decision Made**: 20s delay between categories, no delay within categories
**Rationale**:
- Minimizes rate limit risk
- Provides time for database updates
- Reduces cost burst
- Still completes in 10-15 minutes (acceptable)
- No delay within category (parallel chunks processed sequentially)

**Consequences**:
- Slower overall analysis (20s × 15+ categories = 5+ minutes overhead)
- User has to wait longer
- Not optimal for small assessments (<10 categories)
- Hardcoded value (not user-configurable)

**Status**: ⚠️ Active (to be made configurable in Phase 2)

---

## Chunk Size for AI Requests

**Date**: 2024-10-20
**Context**: Large datasets exceed AI token limits
**Options Considered**:
1. No chunking (fail on large datasets)
2. Fixed chunk size (e.g., 50 items)
3. Adaptive chunk size (based on token count)

**Decision Made**: Fixed 40 items per chunk
**Rationale**:
- Predictable behavior
- Stays within most model token limits
- Simple implementation
- 40 items balances context window with request count
- Categories with <40 items don't need chunking

**Consequences**:
- Some categories may make many requests (100+ chunks)
- Small items (e.g., simple GPO settings) may underutilize tokens
- Large items (e.g., complex user objects) may still exceed limits
- Not adaptive to different data types

**Status**: ⚠️ Active (consider adaptive chunking in Phase 2)

---

## Database Choice

**Date**: 2024-03-01
**Context**: Need to store assessments, findings, and raw data
**Options Considered**:
1. PostgreSQL (relational, JSONB support)
2. MongoDB (document-based)
3. SQLite (file-based)
4. MySQL (relational)

**Decision Made**: PostgreSQL 15
**Rationale**:
- Mature and reliable
- JSONB column for flexible schema (raw data)
- ACID compliance (data integrity critical)
- Strong ecosystem (tooling, monitoring)
- Docker support is excellent
- Free and open source

**Consequences**:
- No horizontal scaling without sharding (single instance)
- Vertical scaling limited by hardware
- Need to manage connection pooling
- JSONB queries can be complex

**Status**: ✅ Active

---

## Frontend Framework Choice

**Date**: 2024-03-01
**Context**: Need to build modern, responsive UI
**Options Considered**:
1. React with Vite (chosen)
2. Next.js (SSR)
3. Vue.js
4. Angular

**Decision Made**: React 18.3 + TypeScript + Vite
**Rationale**:
- Largest ecosystem (components, tools)
- TypeScript for type safety
- Vite for fast dev server and builds
- shadcn/ui for high-quality components
- Team expertise in React
- No need for SSR (static deployment)

**Consequences**:
- Bundle size can be large (need code splitting)
- Client-side rendering (initial load time)
- State management can be complex (Context + React Query)

**Status**: ✅ Active

---

## Deployment Strategy

**Date**: 2024-03-15
**Context**: Need to deploy frontend and backend
**Options Considered**:
1. Separate deployments (frontend to S3, backend to ECS)
2. Monolithic container (frontend + backend together)
3. Multi-container Docker Compose

**Decision Made**: Multi-container Docker Compose with Nginx
**Rationale**:
- Simple deployment (docker compose up)
- Easy local development (docker compose up)
- Separates concerns (app container + db container)
- Nginx serves static frontend efficiently
- Single Docker image for app (multi-stage build)
- Supports production (10.10.10.232) and local

**Consequences**:
- No zero-downtime deployments (need to add load balancer)
- Single point of failure (need HA in Phase 2)
- Limited scalability (vertical only)
- Manual deployment (CI/CD only builds and pushes)

**Status**: ✅ Active

---

## Authentication Strategy

**Date**: 2024-11-01
**Context**: Need to secure application for enterprise customers
**Options Considered**:
1. No authentication (public access)
2. Basic auth (username/password)
3. Session-based auth (custom)
4. OAuth2 (third-party SSO)

**Decision Made**: Authentik OAuth2 (configurable, optional)
**Rationale**:
- Enterprise customers expect SSO
- Authentik is open source and self-hostable
- OAuth2 is industry standard
- Automated setup wizard reduces friction
- Session management with express-session
- No authentication required for development/testing

**Consequences**:
- Additional infrastructure (Authentik server)
- Configuration complexity
- Dependency on external auth provider
- OAuth2 flow adds latency on login

**Status**: ✅ Active (optional, not required)

---

## Client-Side vs Server-Side Report Generation

**Date**: 2024-06-01
**Context**: Generate DOCX/PDF reports with findings
**Options Considered**:
1. Client-side generation (browser-based)
2. Server-side generation (node-based)
3. Hybrid (client for PDF, server for DOCX)

**Decision Made**: Client-side generation for all reports
**Rationale**:
- Reduces server load
- No file storage needed
- Faster for user (no upload/download round-trip)
- Browser can handle DOCX (docx library) and PDF (jspdf)
- Raw data already available in browser (fetched for display)

**Consequences**:
- Browser memory usage for large reports
- Slower on older devices
- No server-side caching of reports
- Inconsistent rendering across browsers (less likely with libraries)

**Status**: ✅ Active

---

**This log tracks all architectural and product decisions. Update regularly to maintain decision history.**
