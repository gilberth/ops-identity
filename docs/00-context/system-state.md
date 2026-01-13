# System State

## What Exists Right Now

### Deployment Status

#### Production
- **Environment**: Docker-based deployment on 10.10.10.232
- **Path**: /data/activeinsight
- **Deploy Command**: `docker compose pull app && docker compose up -d app`
- **Image**: ghcr.io/gilberth/ops-identity:latest
- **Deployment**: GitHub Actions (auto-push on main branch)

#### Development
- **Frontend**: Vite dev server (http://localhost:5173)
- **Backend**: Bun/Node.js (http://localhost:3000)
- **Database**: PostgreSQL 15-Alpine (Docker)
- **Start**: `docker compose up -d db && npm run dev`

### Component Status

#### Frontend (React 18.3 + TypeScript)
| Component | Status | Notes |
|-----------|--------|-------|
| App.tsx | ✅ Complete | Routing, providers, ProtectedRoute |
| Dashboard.tsx | ✅ Complete | Security score, findings, history |
| NewAssessment.tsx | ✅ Complete | Script generation, module selection |
| AssessmentDetail.tsx | ✅ Complete | Progress tracking, findings, logs |
| AdminPanel.tsx | ✅ Complete | Assessment management, AI config |
| ClientSelector.tsx | ✅ Complete | Multi-tenant support |
| AuthentikSetup.tsx | ✅ Complete | OAuth2 integration |
| reports/* | ✅ Complete | DOCX/PDF generation |
| components/dashboard/* | ✅ Complete | 8 dashboard components |
| components/assessment/* | ✅ Complete | 13 assessment components |
| components/ui/* | ✅ Complete | 50+ shadcn/ui components |
| utils/api.ts | ✅ Complete | API client with gzip decompression |

#### Backend (Express + Node.js 18)
| Component | Status | Notes |
|-----------|--------|-------|
| server.js | ✅ Complete | ~4600 lines, all endpoints |
| analyzers/userRules.js | ✅ Complete | Deterministic Users analysis |
| init.sql | ✅ Complete | PostgreSQL schema |
| authentik-setup.js | ✅ Complete | OAuth2 automation |
| AI Integration | ✅ Complete | Multi-provider (OpenAI, Anthropic, Gemini, DeepSeek) |
| Validation Engine | ✅ Complete | Multi-layer anti-hallucination |

#### Database (PostgreSQL 15)
| Table | Status | Records | Notes |
|-------|--------|---------|-------|
| clients | ✅ Active | N/A | Multi-tenant support |
| assessments | ✅ Active | N/A | CASCADE delete to findings/logs |
| assessment_data | ✅ Active | N/A | JSONB with gzip |
| findings | ✅ Active | N/A | Severity-ordered, compliance mappings |
| assessment_logs | ✅ Active | N/A | Real-time progress |
| system_config | ✅ Active | N/A | AI provider, API keys |

### Feature Implementation Status

#### Core Features
| Feature | Status | Completeness | Notes |
|---------|--------|---------------|-------|
| AD Assessment Creation | ✅ Complete | 100% | PowerShell script generation |
| AI Analysis Engine | ✅ Complete | 100% | 15+ categories, smart filtering |
| Multi-Provider AI | ✅ Complete | 100% | OpenAI, Anthropic, Gemini, DeepSeek |
| Anti-Hallucination | ✅ Complete | 100% | 3-layer validation |
| Real-time Progress | ✅ Complete | 100% | Polling every 5s |
| Dashboard | ✅ Complete | 100% | Security score, radar, findings |
| Report Generation | ✅ Complete | 100% | DOCX, PDF, CSV |
| Multi-Tenant | ✅ Complete | 100% | Client isolation |
| Authentik OAuth2 | ✅ Complete | 100% | Automated setup |

#### Category-Specific Analysis
| Category | Status | Model | Smart Filtering | Notes |
|----------|--------|-------|----------------|-------|
| Users | ✅ Complete | Deterministic | Yes | userRules.js |
| Computers | ✅ Complete | Sonnet 4.5 | Yes | Stale, legacy OS, delegation |
| Groups | ✅ Complete | Sonnet 4.5 | Yes | Privileged, empty, excessive |
| GPOs | ✅ Complete | Sonnet 4.5 | Yes | Unlinked, disabled, monolithic |
| DNS | ✅ Complete | Sonnet 4.5 | Yes | Public forwarders, scavenging |
| DHCP | ✅ Complete | Sonnet 4.5 | Yes | Rogue servers, scope issues |
| DCHealth | ✅ Complete | Sonnet 4.5 | Yes | Replication, legacy OS |
| ReplicationStatus | ✅ Complete | Sonnet 4.5 | Yes | Failures, lingering objects |
| TrustHealth | ✅ Complete | Sonnet 4.5 | Yes | Broken, SID filtering |
| OrphanedTrusts | ✅ Complete | Sonnet 4.5 | Yes | Orphaned, suspicious |
| FSMORolesHealth | ✅ Complete | Sonnet 4.5 | Yes | Latency, concentration |
| Sites | ✅ Complete | Sonnet 4.5 | Yes | Default site, missing subnets |
| Kerberos | ✅ Complete | Opus 4.5 | N/A | KRBTGT, weak encryption |
| Security | ✅ Complete | Opus 4.5 | N/A | NTLM, SMB, LAPS |
| PasswordPolicies | ✅ Complete | Sonnet 4.5 | N/A | Weak policies, reversible encryption |
| ProtocolSecurity | ✅ Complete | Sonnet 4.5 | N/A | LDAP signing, NTLM restrictions |
| ADCSInventory | ✅ Complete | Sonnet 4.5 | N/A | ESC1-ESC8, CA placement |

### API Endpoints Status

| Endpoint | Method | Status | Implementation |
|----------|--------|--------|----------------|
| /health | GET | ✅ Live | Health check |
| /api/config/ai | GET | ✅ Live | Get AI config |
| /api/config/ai | POST | ✅ Live | Update AI config |
| /api/clients | GET | ✅ Live | List clients |
| /api/clients | POST | ✅ Live | Create client |
| /api/assessments | GET | ✅ Live | List assessments |
| /api/assessments | POST | ✅ Live | Create assessment |
| /api/assessments/:id | GET | ✅ Live | Get assessment |
| /api/assessments/:id/findings | GET | ✅ Live | Get findings |
| /api/assessments/:id/logs | GET | ✅ Live | Get logs |
| /api/assessments/:id/data | GET | ✅ Live | Get raw data |
| /api/assessments/:id | DELETE | ✅ Live | Delete assessment |
| /api/assessments/:id/reset | POST | ✅ Live | Reset assessment |
| /api/process-assessment | POST | ✅ Live | Process JSON |
| /api/upload-large-file | POST | ✅ Live | Upload ZIP/large files |
| /auth | GET/POST | ✅ Live | OAuth2 flow |
| /callback | GET | ✅ Live | OAuth redirect |
| /api/auth/callback | POST | ✅ Live | OAuth callback |

### Configuration State

#### Environment Variables (.env)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| OPENAI_API_KEY | ✅ Yes | - | OpenAI API key |
| ANTHROPIC_API_KEY | No | - | Anthropic API key |
| GEMINI_API_KEY | No | - | Google Gemini API key |
| DEEPSEEK_API_KEY | No | - | DeepSeek API key |
| POSTGRES_PASSWORD | No | changeme | PostgreSQL password |
| VITE_VPS_ENDPOINT | No | - | API endpoint URL |
| AI_PROVIDER | No | openai | Default AI provider |
| AI_MODEL | No | gpt-4o-mini | Default AI model |
| AUTHENTIK_BASE_URL | No | - | Authentik URL |
| AUTHENTIK_CLIENT_ID | No | - | OAuth2 client ID |
| AUTHENTIK_CLIENT_SECRET | No | - | OAuth2 client secret |
| AUTHENTIK_SLUG | No | - | Authentik app slug |

#### AI Provider Configuration
| Provider | Status | Models Available | Default Model |
|----------|--------|------------------|---------------|
| OpenAI | ✅ Configured | gpt-4o, gpt-4o-mini, gpt-4-turbo | gpt-4o-mini |
| Anthropic | ✅ Configured | claude-opus-4-5, claude-sonnet-4-5 | auto (category-based) |
| Gemini | ✅ Configured | gemini-1.5-pro, gemini-1.5-flash | gemini-1.5-pro |
| DeepSeek | ✅ Configured | deepseek-chat, deepseek-coder | deepseek-chat |

### Data Collection Status

#### PowerShell Script Functions (NewAssessment.tsx)
| Function | Status | Module | Lines |
|----------|--------|--------|-------|
| Get-DomainInformation | ✅ Implemented | Core | ~50 |
| Get-DomainControllerInfo | ✅ Implemented | Infrastructure | ~40 |
| Get-ADReplicationHealth | ✅ Implemented | Replication | ~60 |
| Get-ADSiteTopology | ✅ Implemented | Infrastructure | ~50 |
| Get-TrustRelationships | ✅ Implemented | Infrastructure | ~40 |
| Get-AllADUsers | ✅ Implemented | Core | ~80 |
| Get-AllADComputers | ✅ Implemented | Core | ~70 |
| Get-AllADGroups | ✅ Implemented | Core | ~60 |
| Get-PasswordPolicies | ✅ Implemented | Core | ~50 |
| Get-GPOInventory | ✅ Implemented | GPO | ~100 |
| Get-KerberosConfiguration | ✅ Implemented | Security | ~60 |
| Get-LAPSStatus | ✅ Implemented | Security | ~50 |
| Get-ADCSInventory | ✅ Implemented | ADCS | ~80 |
| Get-ProtocolSecurity | ✅ Implemented | Security | ~50 |
| Get-ReplicationStatus | ✅ Implemented | Replication | ~70 |
| Get-DCSyncPermissions | ✅ Implemented | Security | ~60 |
| Get-RC4EncryptionTypes | ✅ Implemented | Security | ~40 |
| Get-DCHealth | ✅ Implemented | Infrastructure | ~80 |
| Get-DHCPRogueServers | ✅ Implemented | Infrastructure | ~40 |
| Get-DHCPOptionsAudit | ✅ Implemented | Infrastructure | ~50 |
| Get-DNSRootHints | ✅ Implemented | Infrastructure | ~40 |
| Get-DNSConflicts | ✅ Implemented | Infrastructure | ~40 |
| Get-DNSScavengingDetailed | ✅ Implemented | Infrastructure | ~50 |
| Get-FSMORolesHealth | ✅ Implemented | Infrastructure | ~60 |
| Get-ReplicationHealthAllDCs | ✅ Implemented | Replication | ~80 |
| Get-LingeringObjectsRisk | ✅ Implemented | Replication | ~50 |
| Get-TrustHealth | ✅ Implemented | Infrastructure | ~60 |
| Get-OrphanedTrusts | ✅ Implemented | Infrastructure | ~40 |

### Known Issues

#### Backend
- **Rate limiting**: 20s delay between categories to avoid API limits (hardcoded in server.js)
- **Chunking**: Fixed 40 items per chunk (configurable but not exposed in UI)
- **Error handling**: Some AI errors don't provide detailed context to users

#### Frontend
- **Progress polling**: Fixed 5s interval (not user-configurable)
- **Large files**: Progress bar can be inaccurate for very large uploads
- **CSV exports**: No support for custom column selection

#### Documentation
- Missing inline code comments in server.js (critical sections documented in prompts)
- No API documentation (Swagger/OpenAPI not implemented)
- Limited deployment documentation for custom environments

### Technical Debt

#### High Priority
1. **Hardcoded values**: Rate limits, chunk sizes, polling intervals should be configurable
2. **Error messages**: Generic error messages need to be more actionable
3. **Test coverage**: No automated tests (unit, integration, E2E)
4. **Type safety**: Some any types in TypeScript (server/client interop)

#### Medium Priority
5. **Logging**: Structured logging (Winston/Pino) not implemented
6. **Monitoring**: No metrics collection (Prometheus/Datadog)
7. **Caching**: No Redis caching for frequent queries
8. **Background jobs**: No job queue (Bull/BullMQ) for long-running tasks

#### Low Priority
9. **UI performance**: Virtualization for large lists (TanStack Virtual)
10. **Bundle size**: Not optimized (code splitting, lazy loading)
11. **Accessibility**: Limited ARIA labels and keyboard navigation
12. **Internationalization**: No i18n support (hardcoded English/Spanish)

### Performance Characteristics

#### Current Metrics (Estimated)
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Assessment analysis time | 10-15 min (15 categories) | < 15 min | ✅ On target |
| Report generation time | 10-30 sec | < 30 sec | ✅ On target |
| API response time | 200-500ms (p95) | < 500ms | ✅ On target |
| Database query time | 50-200ms (p95) | < 1s | ✅ On target |
| Frontend load time | 2-4s | < 3s | ⚠️ Slightly over |
| Upload speed | 1-5 MB/s | > 5 MB/s | ⚠️ Dependent on network |

#### Resource Usage
| Component | CPU | Memory | Disk |
|-----------|-----|--------|------|
| Frontend (build) | 2 cores | 4 GB | 2 GB |
| Backend (idle) | 0.5 cores | 1 GB | 500 MB |
| Backend (analyzing) | 2 cores | 2 GB | 1 GB |
| PostgreSQL | 1 core | 2 GB | 10 GB (max) |

### Integration Status

#### Third-Party Services
| Service | Status | Purpose | Configured |
|---------|--------|---------|------------|
| OpenAI | ✅ Live | AI analysis | ✅ Yes |
| Anthropic | ✅ Live | AI analysis | ✅ Yes |
| Google Gemini | ✅ Live | AI analysis | ✅ Yes |
| DeepSeek | ✅ Live | AI analysis | ✅ Yes |
| Authentik | ✅ Live | OAuth2 SSO | ⚠️ Optional |
| GitHub Actions | ✅ Live | CI/CD | ✅ Yes |
| Docker Hub | ✅ Live | Image registry | ✅ Yes |

#### External Dependencies
| Dependency | Version | Status | Notes |
|------------|---------|--------|-------|
| React | 18.3.1 | ✅ Latest | Stable |
| TypeScript | 5.8.3 | ✅ Latest | Stable |
| Vite | 5.4.19 | ✅ Latest | Stable |
| Express | 4.18.2 | ✅ Latest | Stable |
| PostgreSQL | 15 | ✅ Latest | Stable |
| docx | 9.5.1 | ✅ Latest | Stable |
| jspdf | 3.0.4 | ✅ Latest | Stable |
| Recharts | 2.15.4 | ✅ Latest | Stable |

---

**Last Updated**: 2025-01-13
**Next Review**: 2025-02-13 (monthly)

**This document reflects the current state of the system. Update as changes are deployed.**
