# 🔒 AD Security Assessment AI

**Enterprise Active Directory Security Assessment Platform with AI-powered analysis**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18-green)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://www.docker.com/)

## 🚀 Features

- 🤖 **AI-Powered Analysis**: Advanced security assessment using OpenAI GPT models
- 🎯 **MITRE ATT&CK Mapping**: Automated threat technique identification and mapping
- 📊 **Compliance Frameworks**: CIS Controls, NIST 800-53, ISO 27001, PCI-DSS, SOX, GDPR
- 📄 **Professional Reports**: Generate comprehensive Word documents with implementation roadmaps
- 🔐 **15+ AD Categories**: Users, Groups, GPOs, Kerberos, DNS, DHCP, Security, and more
- 🛡️ **Enterprise-Grade Prompts**: Specialized AI prompts for each category with 4-5 phase implementation roadmaps
- 🐳 **Self-Hosted Solution**: Complete Docker Compose deployment with PostgreSQL backend
- 📈 **Real-Time Analysis**: Live progress tracking and detailed logging

## 📋 Assessment Categories

| Category      | Focus Areas                                                | Severity Levels        |
| ------------- | ---------------------------------------------------------- | ---------------------- |
| **Users**     | Inactive accounts, privileged users, password policies     | CRITICAL, HIGH, MEDIUM |
| **Groups**    | Domain Admins, Protected Users, Tier 0 separation          | CRITICAL, HIGH         |
| **GPOs**      | Unlinked policies, disabled settings, permission issues    | HIGH, MEDIUM           |
| **Kerberos**  | KRBTGT rotation, Golden Ticket detection, encryption types | CRITICAL, HIGH         |
| **Security**  | NTLM levels, SMB protocols, LAPS deployment                | CRITICAL, HIGH         |
| **DNS**       | Zone transfers, forwarders, scavenging                     | HIGH, MEDIUM           |
| **DHCP**      | Rogue servers, scope security, auditing                    | CRITICAL, MEDIUM       |
| **DC Health** | Replication, services, disk space                          | HIGH, MEDIUM           |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + TS)                    │
│  • Assessment Dashboard • Report Generation • Real-time Logs │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
┌──────────────────────▼──────────────────────────────────────┐
│                   Backend (Node.js 18)                       │
│  • AI Analysis Engine • Category Processing • Data Chunking  │
│  • OpenAI Integration • PostgreSQL Queries                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ SQL
┌──────────────────────▼──────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  • Assessments • Findings • Raw Data (gzip) • Logs           │
└──────────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

### Frontend

- **React 18.3** - UI framework
- **TypeScript 5.8** - Type safety
- **Vite 5.4** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **docx 9.5** - Word report generation
- **pako** - Gzip decompression

### Backend

- **Node.js 18** - Runtime
- **Express** - Web framework
- **PostgreSQL** - Database
- **OpenAI API** - AI analysis
- **zlib** - Data compression

### DevOps

- **Docker Compose** - Container orchestration
- **Nginx** - Frontend web server
- **GitHub Actions** (ready for CI/CD)

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- OpenAI API Key

### Installation

```bash
# Clone the repository
git clone https://github.com/gilberth/ad-security-assessment-ai.git
cd ad-security-assessment-ai

# Configure environment
cd vps-deploy
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Deploy with Docker Compose
docker compose up -d

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost:3000
```

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## 📖 Usage

1. **Upload AD Assessment Data**: Upload JSON file from PowerShell assessment script
2. **AI Analysis**: System automatically analyzes 15+ categories using specialized AI prompts
3. **Review Findings**: View categorized findings with severity levels and MITRE mapping
4. **Generate Report**: Download comprehensive Word document with:
   - Executive Summary
   - AD Forest/Domain Summary
   - GPO Analysis
   - Findings by Severity (Critical, High, Medium, Low)
   - Implementation Roadmaps (4-5 phases)
   - Compliance Mapping
   - Remediation Commands (PowerShell)

## 🔐 Security Features

- **Secret Management**: Environment variables for API keys
- **Data Compression**: Gzip compression for large datasets
- **Input Sanitization**: SQL injection and XSS prevention
- **Error Handling**: Comprehensive error logging without exposing sensitive data
- **Access Control**: Ready for authentication integration

## 📊 Example Findings

### Critical: KRBTGT Password Never Rotated

```
Título: Cuenta KRBTGT sin renovar por 3537 días (9.7 años) - Riesgo de Golden Ticket
Severidad: CRITICAL
MITRE ATT&CK: T1558.001 - Golden Ticket
CIS Control: 5.2.1, 5.4
Timeline: 7 días (procedimiento dual con 10h de espera)

Roadmap 5 Fases:
FASE 1 - PRE-VALIDACIÓN (Día 0)
FASE 2 - PRIMERA ROTACIÓN (Día 1, 2 AM)
FASE 3 - PERIODO ESPERA (10+ horas)
FASE 4 - SEGUNDA ROTACIÓN (Día 2)
FASE 5 - POST-VALIDACIÓN (Día 3)

Comandos PowerShell: New-CtmADKrbtgtKeys.ps1 -Confirm:$false
```

## 🤝 Contributing

This is a private repository. For collaboration:

1. Request access from repository owner
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m '✨ Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 License

This project is proprietary and confidential. All rights reserved.

## 🔗 GitHub MCP Integration

This repository supports **GitHub Model Context Protocol (MCP)** for AI-assisted development:

### Available MCP Tools

- ✅ `github-pull-request_formSearchQuery` - Build GitHub search queries
- ✅ `github-pull-request_doSearch` - Execute searches on issues and PRs
- ✅ `github-pull-request_renderIssues` - Display issues in markdown tables

### MCP Server Configuration

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

### Usage with AI Assistants

```typescript
// Search for open security issues
const query = await github.formSearchQuery({
  naturalLanguageString: "open security findings with critical severity",
  repo: { owner: "gilberth", name: "ad-security-assessment-ai" },
});

const results = await github.doSearch(query);
```

## 📞 Support

For support and inquiries:

- **Repository**: [github.com/gilberth/ad-security-assessment-ai](https://github.com/gilberth/ad-security-assessment-ai)
- **Issues**: [GitHub Issues](https://github.com/gilberth/ad-security-assessment-ai/issues)

## 🏆 Credits

Developed with AI assistance using:

- GitHub Copilot
- Claude Sonnet 4.5
- Model Context Protocol (MCP)

---

**⚠️ CONFIDENTIAL**: This repository contains proprietary security assessment tools. Unauthorized access or distribution is prohibited.
