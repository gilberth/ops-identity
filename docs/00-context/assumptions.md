# Assumptions, Risks, and Unknowns

## Technical Assumptions

### Active Directory Environment
| Assumption | Impact if Wrong | Mitigation |
|------------|-----------------|------------|
| PowerShell 5.1+ is available on DCs | Script generation fails | Version check with graceful error handling |
| RSAT/AD module is installed | Cmdlets not available | Import-Module with error handling |
- User has sufficient privileges to run AD cmdlets | Assessment incomplete | Clear error message about required permissions |
| Domain Controller is reachable from user machine | Upload fails | Offline mode with ZIP export |
| JSON serialization works for AD objects | Data loss during upload | Try-catch with detailed error logging |

### AI Providers
| Assumption | Impact if Wrong | Mitigation |
|------------|-----------------|------------|
| OpenAI/Anthropic APIs are available | Analysis fails | Fallback to alternative provider |
| API keys are valid and funded | Analysis fails | Clear error message with API key guidance |
| Rate limits are not exceeded | Analysis stalls | Retry logic with exponential backoff |
| JSON response format is stable | Parsing errors | Multiple fallback parsing strategies |

### Database
| Assumption | Impact if Wrong | Mitigation |
|------------|-----------------|------------|
| PostgreSQL 15 is available | Application fails | Docker ensures consistent environment |
| Connection pool is sufficient | Connection timeouts | Configurable pool size (default 20) |
| Disk space is adequate | Database writes fail | Monitoring and alerts |

### Network
| Assumption | Impact if Wrong | Mitigation |
|------------|-----------------|------------|
| Client can reach API endpoints | Analysis fails | Offline mode with ZIP upload |
| Upload bandwidth > 5 Mbps | Large files timeout | Chunked upload with progress tracking |
| Latency < 500ms (p95) | Poor UX | Optimistic UI updates |

## Business Assumptions

### User Behavior
| Assumption | Impact if Wrong | Mitigation |
|------------|-----------------|------------|
| Users have AD admin privileges | Cannot run assessment | Clear permission requirements in docs |
| Users understand AD basics | Misinterpreted findings | Educational tooltips and remediation guidance |
| Users prefer web UI over CLI | Low adoption | Consider PowerShell-only option |
| Users will run assessments quarterly | Drift detection limited | Automated scheduling in Phase 2 |

### Market
| Assumption | Impact if Wrong | Mitigation |
|------------|-----------------|------------|
| Competitors remain static | Lost market share | Continuous feature development |
| OpenAI pricing remains stable | Cost increases | Multi-provider support |
| Organizations care about hygiene | Low adoption | Emphasize business impact |

### Compliance
| Assumption | Impact if Wrong | Mitigation |
|------------|-----------------|------------|
| CIS/NIST frameworks don't change | Outdated mappings | Yearly framework review |
| Customers need SOC2 | Limited enterprise adoption | SOC2 readiness in Phase 2 |
| GDPR applies to all customers | Regional restrictions | GDPR-specific features |

## Known Risks

### High Severity

#### 1. AI Hallucination
**Risk**: AI invents findings that don't exist in source data
**Impact**: False positives, lost trust
**Probability**: Medium
**Mitigation**:
- Multi-layer validation (per-chunk, post-merge, attribute validation)
- Smart filtering to reduce noise before AI processing
- Deterministic rules for obvious findings (Users category)
- Validation rules in ATTRIBUTE_VALIDATION_RULES for all type_ids

#### 2. Data Privacy
**Risk**: AD assessment data contains sensitive information
**Impact**: Regulatory violation, data breach
**Probability**: Low
**Mitigation**:
- Data-at-rest encryption (PostgreSQL)
- TLS 1.2 for all network traffic
- No logging of sensitive fields (passwords, tokens)
- Data retention policies (configurable)

#### 3. API Key Exposure
**Risk**: API keys compromised in logs or client-side code
**Impact**: Cost overrun, unauthorized access
**Probability**: Medium
**Mitigation**:
- Keys only on server-side (never in client code)
- No API keys in git (env.example only)
- Secure key storage in system_config table
- Regular key rotation policies

### Medium Severity

#### 4. Large File Uploads
**Risk**: 500MB+ JSON files timeout or crash server
**Impact**: Assessment failure, poor UX
**Probability**: Medium
**Mitigation**:
- Chunked upload with progress tracking
- ZIP support for offline mode
- Configurable max file size (default 5GB)
- Streaming upload to disk (not memory)

#### 5. Analysis Time
**Risk**: 15+ categories take > 15 minutes to analyze
**Impact**: Poor UX, abandoned assessments
**Probability**: Low
**Mitigation**:
- Real-time progress tracking
- Smart filtering reduces data by 70%
- Parallel processing (future enhancement)
- Cached results for similar assessments

#### 6. False Positives
**Risk**: Validation rules miss edge cases
**Impact**: User frustration, ignored findings
**Probability**: Medium
**Mitigation**:
- Continuous validation rule refinement
- User feedback loop (flag false positives)
- Severity adjustment based on organization context
- Confidence scoring for findings

### Low Severity

#### 7. Provider Outages
**Risk**: OpenAI/Anthropic API downtime
**Impact**: Analysis blocked
**Probability**: Low
**Mitigation**:
- Multi-provider support (fallback to Gemini/DeepSeek)
- Cached results from previous assessments
- Clear error messages with retry guidance

#### 8. Database Scaling
**Risk**: PostgreSQL hits limits with large datasets
**Impact**: Slow queries, timeouts
**Probability**: Low
**Mitigation**:
- Proper indexing (created_at, client_id, assessment_id)
- Gzip compression for JSONB storage
- Configurable connection pool
- Query optimization monitoring

## Unknowns

### Technical
- **Maximum assessment size**: What's the realistic limit before performance degrades?
- **Concurrent users**: How many users can analyze simultaneously before resource exhaustion?
- **Model selection accuracy**: Are Opus 4.5 vs Sonnet 4.5 choices optimal per category?

### Business
- **Pricing model**: How should we charge for AI-powered analysis (per assessment, per user, per organization)?
- **Enterprise features**: What do large enterprises need (SSO, RBAC, audit logs, data residency)?
- **Competitor response**: How will PingCastle/Quest respond to AI-powered assessment?

### User
- **Adoption rate**: Will users prefer AI analysis over traditional rule-based tools?
- **False positive tolerance**: What's the acceptable threshold for false positives vs missed findings?
- **Remediation behavior**: Do users actually implement recommended changes?

## Decision Points (To Be Resolved)

### TBD 1: Multi-Language Support
**Question**: Should we support languages other than English/Spanish?
**Options**:
1. No (current state)
2. AI-generated translations (cost overhead)
3. Community translations (low quality risk)
**Decision**: Not blocking Phase 1

### TBD 2: Self-Hosted AI
**Question**: Should we support local LLMs (Ollama, LocalAI)?
**Options**:
1. No (cloud-only)
2. Yes (Ollama integration)
3. Plugin architecture for custom providers
**Decision**: Not blocking Phase 1

### TBD 3: Assessment Comparison
**Question**: Should we support comparing multiple assessments over time?
**Options**:
1. No (single assessment focus)
2. Side-by-side comparison (UI complexity)
3. Trend analysis with charts (better UX)
**Decision**: Planned for Phase 2

## Risk Mitigation Strategy

### Monitoring
- **Health checks**: /health endpoint with DB connectivity
- **Error tracking**: Sentry or similar (future)
- **Performance metrics**: Response time, analysis duration, success rate
- **Business metrics**: DAU, assessments per day, completion rate

### Testing
- **Unit tests**: Validation rules, data extraction, parsing logic
- **Integration tests**: API endpoints, database operations
- **E2E tests**: Full assessment workflow
- **Golden master tests**: Known good assessment outputs

### Incident Response
1. **Service outage**: Fallback to offline mode (ZIP upload)
2. **AI provider outage**: Switch to alternative provider
3. **Data breach**: Immediate notification, forensic analysis, remediation
4. **False positive outbreak**: Hotfix validation rules, communicate to users

---

**This document is living. Update as assumptions are validated or invalidated through real-world usage.**
