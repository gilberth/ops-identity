# OpsIdentity

**Enterprise Active Directory Hygiene, Architecture & Configuration Drift Platform**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://react.dev/)
[![Bun](https://img.shields.io/badge/Bun-Runtime-f9f1e1)](https://bun.sh/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://www.docker.com/)

OpsIdentity detects **administrative disorder, architectural debt, and suboptimal configurations** in Active Directory environments. It identifies what deviates from best practices — not attack vectors.

> _"No busco hackers. Busco desorden administrativo, mala arquitectura y configuraciones suboptimas."_

## Features

- **AI-Powered Analysis**: Multi-provider AI (Anthropic Claude, OpenAI, Gemini, DeepSeek) with specialized prompts per category
- **48 AD Categories**: From Users and GPOs to DC Services Health, SYSVOL State, and Duplicate SPNs
- **Anti-Hallucination Engine**: 3-layer validation with 194+ rules ensures findings are grounded in source data
- **Professional Reports**: DOCX with compliance mappings (CIS, NIST, ISO 27001, PCI-DSS, SOX, GDPR) and implementation roadmaps
- **Raw Data PDF Export**: Complete AD inventory with all collected data
- **Real-Time Progress**: Live analysis tracking with per-category status
- **Multi-Tenant**: Client isolation with separate assessments per organization
- **OAuth2 SSO**: Authentik integration for enterprise authentication

## Assessment Categories

### Core Hygiene (Sonnet)
| Category | Focus |
|----------|-------|
| **Users** | Inactive accounts, password never expires, privilege creep |
| **Groups** | Empty groups, excessive privileges, Domain Admins sprawl |
| **Computers** | Stale machines, legacy OS, unconstrained delegation |
| **GPOs** | Unlinked policies, disabled settings, permission issues |
| **OUs** | Empty OUs, excessive nesting, blocked inheritance |
| **DNS** | Public forwarders, scavenging misconfigured, stale records |
| **DHCP** | Rogue servers, scope exhaustion, options audit |
| **Password Policies** | Weak length, no complexity, reversible encryption |

### Infrastructure Health (Sonnet)
| Category | Focus |
|----------|-------|
| **DC Health** | Services status, disk space, replication errors |
| **DC Services Health** | NTDS, DNS, KDC, DFSR, Netlogon stopped |
| **DC Disk Space** | Low disk = SYSVOL stops replicating |
| **SYSVOL Replication** | FRS (deprecated) vs DFSR, sync state |
| **Sites & Topology** | Empty sites, multi-site links, bridgehead servers |
| **DC Connectivity** | Port matrix (RPC, LDAP, SMB, Kerberos) |
| **DC DNS Resolution** | Loopback, mismatch, resolution failures |
| **Replication Latency** | replsummary deltas, operational errors |
| **FSMO Roles** | Single point of failure, RID pool exhaustion |

### Complex Analysis (Opus)
| Category | Focus |
|----------|-------|
| **Kerberos** | KRBTGT rotation, weak encryption types |
| **Kerberos Auth Failures** | Event 4771, brute force patterns |
| **Secure Channel** | Machine account staleness, DC isolation |
| **Security** | NTLM levels, SMB protocols, LAPS deployment |
| **ACLs** | Broken inheritance, dangerous permissions |
| **Certificate Services** | ESC1-ESC8, CA placement, template permissions |
| **Trust Health** | DNS/nltest verification, SID filtering |
| **Orphaned DCs** | Unreachable DCs, failed replication |
| **Orphaned Metadata** | Post-decommission residual objects |

### GPO & SPN Hygiene (Sonnet)
| Category | Focus |
|----------|-------|
| **GPO Complexity** | Monolithic GPOs (>50 settings), empty, unlinked, DS/Sysvol mismatch |
| **Duplicate SPNs** | SPNs registered on multiple accounts = silent auth failures |

## Architecture

```
client/                  React 18 + TypeScript + Vite (SWC)
  src/
    components/          shadcn/ui + Radix UI primitives
    pages/               Dashboard, AssessmentDetail, NewAssessment, Admin
    lib/                 reportGenerator.ts (DOCX), rawDataPdfGenerator.ts (PDF)

server/
  server.js              Express backend (~8000 lines)
                         - 48 category prompts with anti-hallucination rules
                         - 194+ ATTRIBUTE_VALIDATION_RULES
                         - Smart pre-filtering (70% token reduction)
                         - Multi-provider AI client
  copilot.js             AI provider wrapper (Anthropic, OpenAI, Gemini, DeepSeek)
  analyzers/             Deterministic rule analyzers (userRules.js)
  init.sql               PostgreSQL schema (auto-init on startup)

docker-compose.yml       App + PostgreSQL 15
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.3, TypeScript 5.8, Vite 5.4, Tailwind CSS, shadcn/ui, TanStack Query v5 |
| **Backend** | Bun runtime, Express, PostgreSQL 15 |
| **AI Providers** | Anthropic (Opus/Sonnet), OpenAI, Google Gemini, DeepSeek |
| **Reports** | docx 9.5 (Word), jspdf (PDF), pako (gzip) |
| **Auth** | Passport OAuth2, Authentik SSO |
| **Deploy** | Docker Compose, GitHub Actions CI/CD |

## Quick Start

### Docker (Production)

```bash
git clone https://github.com/gilberth/ops-identity.git
cd ops-identity
cp env.example .env
# Edit .env: set OPENAI_API_KEY or ANTHROPIC_API_KEY
docker compose up -d --build
```

Access: `http://localhost:3000`

### Local Development

```bash
# Start database
docker compose up -d db

# Backend (Terminal 1)
cd server && bun --watch server.js

# Frontend (Terminal 2)
cd client && npm run dev
```

Access: Frontend `http://localhost:8080`, Backend `http://localhost:3000`

## Usage

1. **Generate Script**: Select AD modules and generate a PowerShell collection script
2. **Run on DC**: Execute the PS1 script on a Domain Controller (requires RSAT/AD module)
3. **Upload JSON**: Upload the collected JSON file (up to 500MB, supports resumable uploads)
4. **AI Analysis**: System analyzes 48 categories with specialized prompts per category
5. **Review Findings**: Dashboard with security score, severity breakdown, and category analysis
6. **Export Reports**: Download DOCX (executive report), PDF (scorecard), CSV (raw data)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key (recommended) |
| `OPENAI_API_KEY` | Yes* | OpenAI API key (*one AI key required) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AI_PROVIDER` | No | `anthropic` / `openai` / `gemini` / `deepseek` |
| `AI_MODEL` | No | Model override |
| `POSTGRES_PASSWORD` | No | Database password (default: changeme) |
| `VITE_VPS_ENDPOINT` | No | Frontend API endpoint (empty = relative paths) |

## Model Selection

Complex categories use **Claude Opus** for deeper analysis. Standard categories use **Claude Sonnet** for efficiency.

| Model | Categories |
|-------|-----------|
| **Opus** | Kerberos, Security, ACLs, CertServices, TrustHealth, FSMORoles, KerberosAuthFailures, SecureChannel, ReplicationHealthAllDCs, DCDiagHealth, OrphanedDCs, OrphanedMetadata, TrustHealthDetailed, DCServicesHealth |
| **Sonnet** | All other categories (34) |

## Anti-Hallucination System

Every finding is validated against source data through 3 layers:

1. **Per-chunk validation**: Verify affected objects exist in the data chunk
2. **Post-merge validation**: Verify objects exist in the full assessment dataset
3. **Attribute validation**: 194+ rules verify objects actually have the claimed issue

All prompts include: _"Solo reporta objetos que aparezcan EXPLICÍTAMENTE en los datos. NO inventes nombres."_

## Deployment

- **Production**: `10.10.10.232`, path `/data/activeinsight`
- **CI/CD**: GitHub Actions builds and pushes `ghcr.io/gilberth/ops-identity:latest` on push to `main`
- **Deploy**: `ssh root@10.10.10.232 "cd /data/activeinsight && docker compose pull app && docker compose up -d app"`

## License

Proprietary and confidential. All rights reserved.
