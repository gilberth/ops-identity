# AD Health Coverage Matrix

**Current coverage: 37% of 87 industry metrics**
**Target: 80%+**

---

## Coverage by Category

### Users (12 metrics) - 50% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Password Never Expires | ✅ | `Get-AllADUsers` | - |
| 2 | Password Not Required flag | ✅ | `Get-AllADUsers` | - |
| 3 | Inactive accounts (>90 days) | ✅ | `Get-StaleUsers` | - |
| 4 | Stale accounts (>180 days) | ✅ | `Get-StaleUsers` | - |
| 5 | Kerberoastable (SPN on users) | ✅ | `Get-AllADUsers` | - |
| 6 | AS-REP Roastable (PreAuth disabled) | ✅ | `Get-AllADUsers` | - |
| 7 | Unconstrained Delegation | ❌ | `Get-DelegationIssues` | 🔴 Critical |
| 8 | Constrained Delegation misconfigured | ❌ | `Get-DelegationIssues` | 🔴 Critical |
| 9 | AdminSDHolder orphans | ❌ | `Get-AdminSDHolderOrphans` | ⚠️ High |
| 10 | Protected Users membership | ❌ | `Get-ProtectedUsersAudit` | ⚠️ High |
| 11 | Reversible Encryption enabled | ❌ | `Get-AllADUsers` | ⚠️ High |
| 12 | DES Encryption enabled | ❌ | `Get-AllADUsers` | ℹ️ Medium |

### Computers (10 metrics) - 40% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Obsolete OS (2008, 2003, XP, 7) | ✅ | `Get-AllADComputers` | - |
| 2 | Legacy OS (2012, 2012 R2) | ✅ | `Get-AllADComputers` | - |
| 3 | Stale computers (>90 days) | ✅ | `Get-StaleComputers` | - |
| 4 | Unconstrained Delegation (non-DC) | ✅ | `Get-AllADComputers` | - |
| 5 | LAPS coverage percentage | ❌ | `Get-LAPSCoverage` | 🔴 Critical |
| 6 | BitLocker recovery keys in AD | ❌ | `Get-BitLockerRecovery` | ⚠️ High |
| 7 | Supported Encryption Types | ❌ | `Get-EncryptionTypes` | ⚠️ High |
| 8 | Trust account password age | ❌ | `Get-TrustAccountHealth` | ⚠️ High |
| 9 | Computer password age >30 days | ❌ | `Get-ComputerPasswordAge` | ℹ️ Medium |
| 10 | Servers without antimalware | ❌ | `Get-ServerSecurityStatus` | ℹ️ Medium |

### Groups (10 metrics) - 30% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Tier 0 overpopulated | ✅ | `Get-PrivilegedGroupMembers` | - |
| 2 | Nested groups depth >3 | ❌ | `Get-NestedGroupDepth` | 🔴 Critical |
| 3 | Circular group membership | ❌ | `Get-CircularGroupNesting` | 🔴 Critical |
| 4 | Empty groups | ❌ | `Get-EmptyGroupsAnalysis` | ⚠️ High |
| 5 | Groups without manager | ❌ | `Get-EmptyGroupsAnalysis` | ⚠️ High |
| 6 | Privileged groups with standard users | ✅ | `Get-PrivilegedGroupMembers` | - |
| 7 | Service accounts in Domain Admins | ❌ | `Get-ServiceAccountsInAdminGroups` | 🔴 Critical |
| 8 | Token bloat risk (>40 groups) | ❌ | `Get-TokenSizeEstimation` | 🔴 Critical |
| 9 | AdminSDHolder orphaned objects | ❌ | `Get-AdminSDHolderOrphans` | ⚠️ High |
| 10 | Distribution groups with security perms | ✅ | `Get-GroupAnalysis` | - |

### GPOs (12 metrics) - 25% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Unlinked GPOs | ❌ | `Get-GPOHealthAnalysis` | 🔴 Critical |
| 2 | Disabled GPOs | ✅ | `Get-GPOAnalysis` | - |
| 3 | Monolithic GPOs (>50 settings) | ❌ | `Get-GPOHealthAnalysis` | 🔴 Critical |
| 4 | Version mismatch (AD vs SYSVOL) | ✅ | `Get-GPOAnalysis` | - |
| 5 | Complex WMI Filters | ❌ | `Get-GPOHealthAnalysis` | ⚠️ High |
| 6 | Authenticated Users can edit | ❌ | `Get-GPOPermissions` | 🔴 Critical |
| 7 | No security filtering applied | ❌ | `Get-GPOPermissions` | ⚠️ High |
| 8 | Conflicting settings | ❌ | `Get-GPOConflicts` | ℹ️ Medium |
| 9 | Weak password policy | ✅ | `Get-PasswordPolicy` | - |
| 10 | Weak lockout policy | ❌ | `Get-LockoutPolicy` | ⚠️ High |
| 11 | Audit policy not configured | ❌ | `Get-AuditPolicyStatus` | ⚠️ High |
| 12 | Preference passwords (cpassword) | ❌ | `Get-GPOCPassword` | 🔴 Critical |

### Domain Controllers (14 metrics) - 43% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | OS version consistency | ✅ | `Get-DCHealthStatus` | - |
| 2 | FSMO roles distribution | ✅ | `Get-FSMORoleInfo` | - |
| 3 | FSMO accessibility | ❌ | `Get-FSMOHealthCheck` | 🔴 Critical |
| 4 | KRBTGT password age | ❌ | `Get-KRBTGTPasswordAge` | 🔴 Critical |
| 5 | PDC time sync config | ❌ | `Get-FSMOHealthCheck` | 🔴 Critical |
| 6 | SMBv1 enabled | ❌ | `Get-DCSecurityConfig` | 🔴 Critical |
| 7 | NTLM LmCompatibilityLevel | ❌ | `Get-DCSecurityConfig` | ⚠️ High |
| 8 | LDAP Signing not required | ❌ | `Get-LDAPSecurityConfig` | 🔴 Critical |
| 9 | LDAP Channel Binding | ❌ | `Get-LDAPSecurityConfig` | 🔴 Critical |
| 10 | Print Spooler running | ❌ | `Get-DCSecurityConfig` | 🔴 Critical |
| 11 | AD Recycle Bin disabled | ✅ | `Get-ADRecycleBinStatus` | - |
| 12 | Tombstone lifetime | ✅ | `Get-DomainInfo` | - |
| 13 | Backup age >7 days | ❌ | `Get-ADBackupStatus` | ⚠️ High |
| 14 | Free disk space | ✅ | `Get-DCHealthStatus` | - |

### Replication (8 metrics) - 25% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Replication failures | ✅ | `Get-ReplicationStatus` | - |
| 2 | Replication latency | ❌ | `Get-ReplicationLatencyAnalysis` | 🔴 Critical |
| 3 | Lingering objects | ❌ | `Get-LingeringObjects` | 🔴 Critical |
| 4 | USN rollback risk | ❌ | `Get-USNRollbackCheck` | 🔴 Critical |
| 5 | DFSR vs FRS | ✅ | `Get-DomainInfo` | - |
| 6 | SYSVOL accessible | ❌ | `Get-SYSVOLHealth` | ⚠️ High |
| 7 | Site link costs | ❌ | `Get-SiteTopologyIssues` | ℹ️ Medium |
| 8 | Bridgehead servers | ❌ | `Get-SiteTopologyIssues` | ℹ️ Medium |

### DNS (8 metrics) - 12% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Scavenging enabled | ❌ | `Get-DNSHealthAnalysis` | ⚠️ High |
| 2 | Forwarders configured | ❌ | `Get-DNSHealthAnalysis` | ℹ️ Medium |
| 3 | Zone transfer security | ❌ | `Get-DNSSecurityConfig` | ⚠️ High |
| 4 | Stale DNS records | ❌ | `Get-DNSHealthAnalysis` | ⚠️ High |
| 5 | Duplicate A records | ❌ | `Get-DNSHealthAnalysis` | ℹ️ Medium |
| 6 | Orphaned CNAME | ❌ | `Get-DNSHealthAnalysis` | ℹ️ Medium |
| 7 | Root hints updated | ✅ | `Get-DNSInfo` | - |
| 8 | Secure dynamic updates | ❌ | `Get-DNSSecurityConfig` | ⚠️ High |

### DHCP (6 metrics) - 0% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Rogue DHCP servers | ❌ | `Get-DHCPAudit` | 🔴 Critical |
| 2 | Scope exhaustion | ❌ | `Get-DHCPHealthAnalysis` | ⚠️ High |
| 3 | Failover configured | ❌ | `Get-DHCPHealthAnalysis` | ⚠️ High |
| 4 | Option 6 (DNS) correct | ❌ | `Get-DHCPHealthAnalysis` | ⚠️ High |
| 5 | Option 15 (Domain) correct | ❌ | `Get-DHCPHealthAnalysis` | ⚠️ High |
| 6 | Audit logging enabled | ❌ | `Get-DHCPHealthAnalysis` | ℹ️ Medium |

### Sites & Topology (7 metrics) - 28% covered

| # | Metric | Status | Function | Priority |
|---|--------|--------|----------|----------|
| 1 | Orphaned subnets | ❌ | `Get-SiteTopologyIssues` | 🔴 Critical |
| 2 | Sites without DCs | ❌ | `Get-SiteTopologyIssues` | ⚠️ High |
| 3 | Sites without subnets | ❌ | `Get-SiteTopologyIssues` | 🔴 Critical |
| 4 | Site link costs | ❌ | `Get-SiteTopologyIssues` | ℹ️ Medium |
| 5 | Manual bridgehead | ❌ | `Get-SiteTopologyIssues` | ℹ️ Medium |
| 6 | Replication schedule | ✅ | `Get-ReplicationStatus` | - |
| 7 | UGMC enabled | ✅ | `Get-SiteInfo` | - |

---

## Sprint Planning

### Sprint 1: 🔴 CRITICAL (12 items) - 2 weeks

| Metric | Category | Function |
|--------|----------|----------|
| KRBTGT password age | DCs | `Get-KRBTGTPasswordAge` |
| LDAP Signing | DCs | `Get-LDAPSecurityConfig` |
| LDAP Channel Binding | DCs | `Get-LDAPSecurityConfig` |
| SMBv1 enabled | DCs | `Get-DCSecurityConfig` |
| Print Spooler running | DCs | `Get-DCSecurityConfig` |
| Sites without subnets | Topology | `Get-SiteTopologyIssues` |
| Replication latency | Replication | `Get-ReplicationLatencyAnalysis` |
| GPO cpassword | GPOs | `Get-GPOCPassword` |
| Unlinked GPOs | GPOs | `Get-GPOHealthAnalysis` |
| Token bloat | Groups | `Get-TokenSizeEstimation` |
| Service accounts in DA | Groups | `Get-ServiceAccountsInAdminGroups` |
| LAPS coverage | Computers | `Get-LAPSCoverage` |

### Sprint 2: ⚠️ HIGH (15 items) - 2 weeks

| Metric | Category | Function |
|--------|----------|----------|
| FSMO health | DCs | `Get-FSMOHealthCheck` |
| Backup age | DCs | `Get-ADBackupStatus` |
| Empty groups | Groups | `Get-EmptyGroupsAnalysis` |
| Nested depth | Groups | `Get-NestedGroupDepth` |
| Circular nesting | Groups | `Get-CircularGroupNesting` |
| AdminSDHolder orphans | Groups | `Get-AdminSDHolderOrphans` |
| GPO permissions | GPOs | `Get-GPOPermissions` |
| Lockout policy | GPOs | `Get-LockoutPolicy` |
| Audit policy | GPOs | `Get-AuditPolicyStatus` |
| DNS scavenging | DNS | `Get-DNSHealthAnalysis` |
| DNS zone security | DNS | `Get-DNSSecurityConfig` |
| DHCP exhaustion | DHCP | `Get-DHCPHealthAnalysis` |
| DHCP Options | DHCP | `Get-DHCPHealthAnalysis` |
| Lingering objects | Replication | `Get-LingeringObjects` |
| SYSVOL health | Replication | `Get-SYSVOLHealth` |

### Sprint 3: ℹ️ MEDIUM (remaining) - 3 weeks

All remaining 28 metrics.

---

## Summary

| Category | Total | Covered | Coverage |
|----------|-------|---------|----------|
| Users | 12 | 6 | 50% |
| Computers | 10 | 4 | 40% |
| Groups | 10 | 3 | 30% |
| GPOs | 12 | 3 | 25% |
| DCs | 14 | 6 | 43% |
| Replication | 8 | 2 | 25% |
| DNS | 8 | 1 | 12% |
| DHCP | 6 | 0 | 0% |
| Sites | 7 | 2 | 28% |
| **TOTAL** | **87** | **32** | **37%** |
