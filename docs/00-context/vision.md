# Vision Statement

## Product Purpose

**OpsIdentity** is an Enterprise Active Directory Hygiene, Architecture & Configuration Drift Assessment Platform.

### Core Mission
To identify and help remediate **administrative disorder, architectural debt, and configuration drift** in Active Directory environments. This is **NOT** a penetration testing tool - security is a secondary outcome of maintaining good operational hygiene.

### What We Do
- Detect misconfigurations that make AD infrastructure inefficient and unstable
- Identify architectural patterns that violate best practices
- Surface configuration drift from established baselines
- Provide actionable remediation with implementation roadmaps
- Enable continuous health monitoring across 15+ AD categories

### What We DON'T Do
- Penetration testing or exploit identification (use Purple Knight for that)
- Vulnerability scanning (use commercial scanners)
- Real-time attack detection (use SIEM/SOAR solutions)
- Incident response workflows

## Product Boundaries

### In Scope
| Category | Focus |
|----------|-------|
| **Users** | Inactive accounts, privilege escalation, password policies, kerberoasting risks |
| **Groups** | Domain Admins, Protected Users, Tier 0/1 separation, excessive privileges |
| **GPOs** | Unlinked policies, monolithic GPOs, permission issues, version conflicts |
| **Kerberos** | KRBTGT rotation, Golden Ticket detection, weak encryption types |
| **Security** | NTLM levels, SMB protocols, LAPS deployment, LDAP signing |
| **DNS** | Public forwarders, zone transfers, scavenging, dynamic updates |
| **DHCP** | Rogue servers, scope exhaustion, weak configurations |
| **DC Health** | Replication failures, legacy OS, FSMO role issues, disk space |
| **Replication** | Lingering objects, USN rollback, high latency, topology issues |
| **Trusts** | Broken trusts, SID filtering, orphaned trusts, password freshness |
| **Sites** | Default-First-Site-Name, missing subnets, high link costs |
| **FSMO Roles** | Role concentration, latency issues, RID pool exhaustion |
| **Protocol Security** | LDAP signing, NTLM restrictions, channel binding |
| **Password Policies** | Weak passwords, no expiration, reversible encryption, complexity disabled |
| **ADCS** | ESC1-ESC8 vulnerabilities, CA placement, template permissions |

### Out of Scope
- Active Directory attacks exploitation (Golden Ticket, DCSync, etc.)
- Real-time security monitoring
- Forensics and incident response
- Application-level assessments
- Cloud AD assessments (Azure AD/Azure AD Connect)
- Third-party integrations (MFA, PAM, DLP tools)

## Target Audience

### Primary Users
- **Active Directory Administrators**: Daily AD operations and maintenance
- **System Architects**: Designing AD topology and trust structures
- **Security Engineers**: Hardening AD infrastructure
- **IT Managers**: Executive reporting and compliance tracking

### Use Cases
1. **Health Assessment**: Regular quarterly AD health checks
2. **M&A Integration**: Assessing acquired company AD infrastructure
3. **Migration Planning**: Preparing for AD upgrades or forest consolidation
4. **Compliance Audits**: CIS, NIST 800-53, ISO 27001, PCI-DSS, SOX, GDPR readiness
5. **Configuration Drift**: Detecting unauthorized changes over time
6. **Architecture Review**: Validating AD topology and design decisions

## Competitive Positioning

### Direct Competitors
- **PingCastle Health Check**: Similar health assessment focus
- **Quest Active Directory Manager**: AD health modules
- **ManageEngine AD360**: Audit and health capabilities

### Differentiation
- **AI-Powered**: Specialized prompts per category with 4-5 phase roadmaps
- **Anti-Hallucination**: Multi-layer validation ensures findings are grounded in source data
- **Multi-Provider AI**: OpenAI, Anthropic, Gemini, DeepSeek support
- **Enterprise Reports**: Professional DOCX generation with compliance mappings
- **Operational Focus**: Prioritizes hygiene over pure security exploitation

### NOT Like
- **Purple Knight**: Heavily focused on security attack vectors and exploits
- **BloodHound**: Graph-based privilege escalation path visualization
- **ADExplorer**: Read-only AD exploration tool

## Success Metrics

### Product Health
- Assessment completion rate > 95%
- Analysis accuracy (validated findings / total findings) > 90%
- User engagement (monthly active assessments) > 100

### Technical Metrics
- Analysis time per assessment < 15 minutes (15+ categories)
- Report generation < 30 seconds
- API response time < 500ms (p95)
- Database query time < 1s (p95)

### Business Impact
- Reduced AD incident rate (target: 30% reduction after implementation)
- Faster remediation cycles (target: 50% reduction in time to remediate)
- Improved compliance posture (target: 25% increase in compliance scores)

## Anti-Patterns

### What We Avoid
- **Security Theater**: Reporting findings without actionable remediation
- **Alert Fatigue**: Low-severity findings that don't impact operations
- **One-Size-Fits-All**: Ignoring organizational context and risk tolerance
- **Vendor Lock-in**: Tying to specific AD versions or third-party tools
- **Black Box**: Opaque AI outputs without validation

### What We Embrace
- **Ground Truth**: All findings must be validated against source data
- **Contextual Awareness**: Risk assessment based on organizational maturity
- **Operational Excellence**: Security as outcome of good hygiene
- **Transparency**: Clear methodology and validation rules
- **Continuous Improvement**: Learning from user feedback and false positives

## Future Vision

### Phase 1 (Current)
- 15+ AD categories with AI analysis
- Multi-provider AI support
- Professional report generation
- Anti-hallucination validation
- Multi-tenant client support

### Phase 2 (Next 6 months)
- Historical trend analysis
- Configuration drift detection
- Automated remediation orchestration
- Assessment templates and presets
- API for third-party integrations

### Phase 3 (6-12 months)
- Scheduled automated assessments
- Real-time monitoring alerts
- Mobile app for quick assessments
- Knowledge base integration
- Community prompt library

---

**This document is the single source of truth for product vision and boundaries. All feature decisions must align with this vision.**
