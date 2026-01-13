# OpsIdentity Documentation

Welcome to the comprehensive documentation for OpsIdentity - Enterprise Active Directory Hygiene, Architecture & Configuration Drift Assessment Platform.

## Quick Navigation

### 🚀 Getting Started
1. **[Project Vision](00-context/vision.md)** - Product purpose, boundaries, and success metrics
2. **[Product Requirements](01-product/prd.md)** - Features, user stories, and technical requirements
3. **[Developer Workflow](04-process/dev-workflow.md)** - How to set up and develop locally

### 📋 Documentation Structure

```
docs/
├── 00-context/           # WHY and WHAT EXISTS RIGHT NOW
│   ├── vision.md          # Product purpose & boundaries (anchor)
│   ├── assumptions.md     # Assumptions, risks, unknowns
│   └── system-state.md   # What is actually built & running
│
├── 01-product/           # WHAT the product must do
│   └── prd.md            # Single source of truth for requirements
│
├── 02-features/          # HOW features are designed & built
│   ├── feature-ad-assessment/
│   ├── feature-ai-analysis/
│   ├── feature-dashboard/
│   └── feature-reports/
│
├── 03-logs/             # MEMORY (this is what most teams miss)
│   ├── implementation-log.md    # What changed in code & why
│   ├── decisions-log.md        # Architectural & product decisions
│   ├── bug-log.md             # Bugs, fixes, regressions
│   ├── validation-log.md      # What happened after shipping
│   └── insights.md            # Learnings & future improvements
│
└── 04-process/           # HOW to work with this system
    ├── dev-workflow.md        # Daily dev loop (human + LLM)
    ├── definition-of-done.md  # When docs/code are "done"
    └── llm-prompts.md         # Canonical prompts per doc type
```

## 📖 Reading Guide

### For New Developers
1. Start with **[Project Vision](00-context/vision.md)** to understand what we're building
2. Read **[Product Requirements](01-product/prd.md)** to understand features and user stories
3. Follow **[Developer Workflow](04-process/dev-workflow.md)** to set up your development environment
4. Review **[Definition of Done](04-process/definition-of-done.md)** to understand completion criteria

### For Product Owners
1. Review **[Project Vision](00-context/vision.md)** to understand product boundaries
2. Check **[Assumptions & Risks](00-context/assumptions.md)** for known constraints
3. Read **[Product Requirements](01-product/prd.md)** for feature specifications
4. Monitor **[Implementation Log](03-logs/implementation-log.md)** for progress

### For AI Assistants
1. Use **[byterover-retrieve-knowledge]** before starting any task to gather context
2. Review **[Developer Workflow](04-process/dev-workflow.md)** for development patterns
3. Check **[Decisions Log](03-logs/decisions-log.md)** for architectural context
4. Use **[byterover-store-knowledge]** after completing tasks to store learnings

### For Security Auditors
1. Review **[System State](00-context/system-state.md)** for current security posture
2. Check **[Assumptions & Risks](00-context/assumptions.md)** for known security risks
3. Review **[Product Requirements](01-product/prd.md)** for security features
4. Monitor **[Decisions Log](03-logs/decisions-log.md)** for security-related decisions

## 🎯 Key Documents

### Must-Read
- **[Project Vision](00-context/vision.md)** - Single source of truth for product direction
- **[Product Requirements](01-product/prd.md)** - Complete feature specifications
- **[Developer Workflow](04-process/dev-workflow.md)** - How to contribute code
- **[Definition of Done](04-process/definition-of-done.md)** - When work is complete

### Important References
- **[Assumptions & Risks](00-context/assumptions.md)** - Known constraints and mitigation strategies
- **[System State](00-context/system-state.md)** - Current implementation status
- **[Decisions Log](03-logs/decisions-log.md)** - Architectural decision records
- **[Implementation Log](03-logs/implementation-log.md)** - Change history

### Feature Documentation
Each feature has its own directory with:
- `feature-spec.md` - User intent and acceptance criteria
- `tech-design.md` - Architecture and implementation approach
- `dev-tasks.md` - LLM-executable tasks
- `test-plan.md` - Validation strategy

**Current Features**:
- [AD Assessment Creation](02-features/feature-ad-assessment/feature-spec.md)
- [AI Analysis Engine](02-features/feature-ai-analysis/feature-spec.md)
- [Dashboard](02-features/feature-dashboard/feature-spec.md)
- [Report Generation](02-features/feature-reports/feature-spec.md)

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git
- PowerShell 5.1+ (for running assessments)

### 2. Clone and Install
```bash
git clone https://github.com/gilberth/ops-identity.git
cd ops-identity
npm install
```

### 3. Configure Environment
```bash
cp env.example .env
nano .env
# Add your OPENAI_API_KEY and other configuration
```

### 4. Start Development
```bash
# Start database
docker compose up -d db

# Start backend (Terminal 1)
cd server && bun --watch server.js

# Start frontend (Terminal 2)
cd client && npm run dev
```

### 5. Access Application
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- Database Admin: http://localhost:5050 (pgAdmin)

## 📝 Contributing

### For Humans
1. Create a feature branch: `git checkout -b feature/description`
2. Follow **[Developer Workflow](04-process/dev-workflow.md)**
3. Meet **[Definition of Done](04-process/definition-of-done.md)**
4. Submit Pull Request with template

### For AI Assistants
1. **Retrieve Knowledge** before starting any task
2. Review existing patterns and decisions
3. Implement following coding standards
4. **Store Knowledge** after completing work
5. Update relevant documentation files

### Code Quality
- Follow style guides in `conductor/code_styleguides/`
- Use TypeScript for type safety
- Add tests for new functionality
- Write clear, concise comments

## 🔍 Finding Information

### Search Strategy
1. **Feature Information**: Check `docs/02-features/feature-<name>/`
2. **Architecture Decisions**: Check `docs/03-logs/decisions-log.md`
3. **Implementation History**: Check `docs/03-logs/implementation-log.md`
4. **Current System State**: Check `docs/00-context/system-state.md`
5. **Product Requirements**: Check `docs/01-product/prd.md`

### AI-Specific Search
Use Byterover MCP tools to query stored knowledge:
```bash
# Before starting work
byterover-retrieve-knowledge --topic="react-component-patterns"
byterover-retrieve-knowledge --topic="ai-prompt-structure"

# After completing work
byterover-store-knowledge --topic="new-pattern-learned" --file="MyComponent.tsx"
```

## 📚 External Documentation

### Project-Level
- [CLAUDE.md](../CLAUDE.md) - Claude Code instructions
- [README.md](../README.md) - Project overview and setup
- [AGENTS.md](../AGENTS.md) - AI assistant instructions
- [guiaprompt.md](../guiaprompt.md) - AI prompt guidelines

### Technical Guides
- `conductor/` - Product documentation and workflow guides
- `conductor/code_styleguides/` - Coding standards
- `conductor/tech-stack.md` - Technology stack details
- `conductor/product.md` - Product guidelines

### Skills (AI-Specific)
- `.claude/skills/anti-hallucination/` - Anti-hallucination validation
- `.claude/skills/docx/` - DOCX report generation
- `.claude/skills/pdf/` - PDF generation
- `.claude/skills/ad-assessment-documents-skill/` - Professional report templates

## 🔄 Documentation Maintenance

### When to Update
- **Before implementing**: Review relevant docs for context
- **While implementing**: Add inline comments for complex logic
- **After implementing**: Update feature specs and tech design
- **After deploying**: Update implementation log and system state
- **When making decisions**: Update decisions log

### Update Frequency
- **Vision**: Monthly (or as product strategy changes)
- **PRD**: Per release (or as features change)
- **System State**: Weekly (or after significant deployments)
- **Implementation Log**: Continuous (after each change)
- **Decisions Log**: Continuous (after each decision)
- **Dev Workflow**: Quarterly (or as processes change)

### Review Cycle
- **Monthly**: Review vision, assumptions, and risks
- **Quarterly**: Review PRD, tech stack, and workflows
- **Semi-annually**: Complete documentation audit and cleanup

## 📊 Documentation Metrics

### Coverage
- ✅ Project Vision: 100%
- ✅ Product Requirements: 100% (Phase 1)
- ✅ Feature Specifications: 100% (4 features documented)
- ✅ Implementation Log: 100% (from inception)
- ✅ Decisions Log: 100% (key decisions)
- ✅ Validation Log: 100% (initial validation)
- ✅ Bug Log: 100% (BUG-001 documented)
- ✅ Insights Log: 100% (initial insights captured)

### Quality
- All docs have clear structure and formatting
- All docs are version-controlled
- All docs are linked and cross-referenced
- All docs are up-to-date as of last deployment

## 🤝 Support

### Questions or Issues?
- Check **[Assumptions & Risks](00-context/assumptions.md)** for known issues
- Review **[Decisions Log](03/decisions-log.md)** for rationale
- Search existing issues on GitHub
- Create new issue with detailed description

### Documentation Errors?
- If you find outdated or incorrect documentation:
  1. Note the specific error
  2. Propose correction
  3. Create pull request with update
  4. Reference this README

## 📜 License & Confidentiality

This documentation is part of the OpsIdentity project. All rights reserved.

**⚠️ CONFIDENTIAL**: This documentation contains proprietary information about security assessment tools. Unauthorized access or distribution is prohibited.

---

**Last Updated**: 2026-01-13
**Documentation Version**: 1.0
**Maintained By**: Product Team

**This README is the entry point for all OpsIdentity documentation. Start here and navigate to relevant sections.**
