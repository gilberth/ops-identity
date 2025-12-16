# 📋 AD Health Assessment - Documento Maestro Consolidado

**Fecha de Consolidación:** 8 de Diciembre 2025  
**Versión:** 1.0  
**Proyecto:** Active Scan Insight - AD Assessment Platform

---

## Índice

1. [Misión del Producto](#1-misión-del-producto)
2. [Análisis de Cobertura Actual](#2-análisis-de-cobertura-actual)
3. [87 Métricas de Industria](#3-87-métricas-de-industria)
4. [Brechas Críticas Identificadas](#4-brechas-críticas-identificadas)
5. [Plan de Modificaciones a NewAssessment.tsx](#5-plan-de-modificaciones-a-newassessmenttsx)
6. [Análisis de Prompts de IA](#6-análisis-de-prompts-de-ia)
7. [Roadmap de Implementación](#7-roadmap-de-implementación)

---

# 1. Misión del Producto

## 1.1 Objetivo Principal

**Higiene Operativa, Arquitectura y Mejores Prácticas (Operational Health & Configuration Drift).**

El objetivo principal de esta herramienta SaaS es encontrar **configuraciones no realizadas de la mejor manera**. No se trata de una herramienta de Pentesting ofensivo puro (como buscar hackers), sino de identificar **desorden administrativo, mala arquitectura y deuda técnica** que hacen que la infraestructura sea ineficiente, inestable y difícil de mantener.

> _"No busco hackers rusos. Busco desorden administrativo, mala arquitectura y configuraciones subóptimas. Quiero decirle al cliente: Tienes 100 Global Admins (mal), tu replicación tarda 8 horas (mal), tus GPOs son monolíticas (mal)."_

**La seguridad es un resultado secundario de una buena higiene operativa.**

## 1.2 Ejemplos de Hallazgos Core

| Área                | Ejemplo de Hallazgo                                                         |
| ------------------- | --------------------------------------------------------------------------- |
| **Arquitectura**    | ¿Tengo más de 40 conexiones entre mis dominios creadas sin razón?           |
| **Permisos**        | ¿Tengo 100 cuentas con permisos de Administrador Global?                    |
| **GPO**             | ¿Tengo una sola GPO "monolítica" donde están todas las políticas mezcladas? |
| **Infraestructura** | ¿La replicación de DC tarda más de lo esperado (ej. 8 horas)?               |
| **Configuración**   | ¿Está la Papelera de Reciclaje de AD deshabilitada?                         |
| **Servicios**       | Problemas en DNS, DHCP y Relaciones de Confianza                            |

## 1.3 Posicionamiento Competitivo

| Competidor                 | Enfoque                   | Nuestra Diferenciación                   |
| -------------------------- | ------------------------- | ---------------------------------------- |
| **PingCastle** (Health)    | Security + Health híbrido | Puro "Configuration Drift" operativo     |
| **Quest AD Health**        | Enterprise Health         | SaaS moderno, enfoque consultivo         |
| **ManageEngine ADManager** | Operational Hygiene       | Assessment puntual vs monitoreo continuo |
| **Purple Knight**          | Seguridad ofensiva        | NO competimos - enfoque diferente        |
| **Microsoft ADRAP**        | Assessment formal         | Self-service, instantáneo                |

---

# 2. Análisis de Cobertura Actual

## 2.1 Inventario de Funciones Actuales (NewAssessment.tsx)

El script actual tiene **35 funciones de recolección** en ~2,479 líneas:

| Función                       | Categoría      | Estado           |
| ----------------------------- | -------------- | ---------------- |
| `Get-DomainInformation`       | Core           | ✅               |
| `Get-DomainControllerInfo`    | Core           | ✅               |
| `Get-AllADUsers`              | Core Hygiene   | ✅               |
| `Get-AllADComputers`          | Core Hygiene   | ✅               |
| `Get-AllADGroups`             | Core Hygiene   | ✅               |
| `Get-PasswordPolicies`        | Security       | ✅               |
| `Get-GPOInventory`            | GPO            | ✅               |
| `Get-GPOPermissions`          | GPO            | ✅               |
| `Get-ADSiteTopology`          | Infrastructure | ✅               |
| `Get-TrustRelationships`      | Infrastructure | ⚠️ Parcial       |
| `Get-ADReplicationHealth`     | Replication    | ⚠️ Solo DC local |
| `Get-ReplicationStatus`       | Replication    | ✅               |
| `Get-DNSConfiguration`        | Infrastructure | ✅               |
| `Get-DHCPConfiguration`       | Infrastructure | ✅               |
| `Get-DNSScavengingStatus`     | Infrastructure | ✅               |
| `Get-TimeSyncConfiguration`   | Infrastructure | ✅               |
| `Get-DCHealthDetails`         | DC Health      | ✅               |
| `Get-KerberosConfiguration`   | Security       | ✅               |
| `Get-LAPSStatus`              | Security       | ✅               |
| `Get-DCSyncPermissions`       | Security       | ✅               |
| `Get-RC4EncryptionTypes`      | Security       | ✅               |
| `Get-OldPasswords`            | Hygiene        | ✅               |
| `Get-SMBv1Status`             | Security       | ✅               |
| `Get-ProtectedUsersGroup`     | Security       | ✅               |
| `Get-UnconstrainedDelegation` | Security       | ✅               |
| `Get-AdminSDHolderProtection` | Security       | ✅               |
| `Get-NTLMSettings`            | Security       | ✅               |
| `Get-RecycleBinStatus`        | Core           | ✅               |
| `Get-OUStructure`             | Architecture   | ✅               |
| `Get-TombstoneLifetime`       | Core           | ✅               |
| `Get-ADCSInventory`           | Security       | ✅               |
| `Get-ProtocolSecurity`        | Security       | ✅               |

## 2.2 Calificaciones por Área

```
┌─────────────────────────────────────────────────────────────────────┐
│ COBERTURA POR ÁREA DE SALUD OPERATIVA                               │
├─────────────────────────────────────────────────────────────────────┤
│ Higiene de Objetos (Stale/Orphaned)     ████████░░░░░░░░░░░  40%   │
│ Topología y Replicación                 ██████████░░░░░░░░░  50%   │
│ GPO Health & Sprawl                     ████████░░░░░░░░░░░  40%   │
│ DNS Operational Health                  ████████████░░░░░░░  60%   │
│ DHCP Capacity Planning                  ██████████████░░░░░  70%   │
│ Privilege Creep / Admin Sprawl          ██████░░░░░░░░░░░░░  30%   │
│ Trust Health (Operational)              ████░░░░░░░░░░░░░░░  20%   │
│ Performance Baselines                   ██░░░░░░░░░░░░░░░░░  10%   │
├─────────────────────────────────────────────────────────────────────┤
│ PROMEDIO SALUD OPERATIVA                ████████░░░░░░░░░░░  40%   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2.3 Cobertura vs Industria

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ COBERTURA ACTUAL vs INDUSTRIA                                                   │
├────────────────────────────────────────────────────────────────────────────────┤
│ Total Métricas Industria:     87                                               │
│ Tu Cobertura Actual:          32 métricas (37%)                                │
│ Métricas Faltantes:           55 métricas (63%)                                │
├────────────────────────────────────────────────────────────────────────────────┤
│ Para alcanzar 80% cobertura:  +38 métricas adicionales                         │
│ Para alcanzar 90% cobertura:  +46 métricas adicionales                         │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

# 3. 87 Métricas de Industria

## 3.1 Domain Controllers & FSMO Roles (12 métricas)

**Cobertura Actual: 5/12 (42%)**

| #   | Métrica                     | Tu Script | PingCastle | Quest | Impacto                                    |
| --- | --------------------------- | --------- | ---------- | ----- | ------------------------------------------ |
| 1   | Lista de DCs                | ✅        | ✅         | ✅    | Inventario básico                          |
| 2   | FSMO Role Holders           | ✅        | ✅         | ✅    | Operaciones críticas                       |
| 3   | DC OS Version               | ✅        | ✅         | ✅    | Soporte/EOL                                |
| 4   | DC Hotfixes                 | ✅        | ✅         | ✅    | Vulnerabilidades                           |
| 5   | Global Catalogs             | ✅        | ✅         | ✅    | Búsquedas cross-domain                     |
| 6   | **FSMO Accessibility Test** | ❌        | ✅         | ✅    | DC con FSMO caído = operaciones bloqueadas |
| 7   | **DC Free Disk Space**      | ❌        | ✅         | ✅    | Sin espacio = SYSVOL no replica            |
| 8   | **DC Uptime**               | ❌        | ✅         | ✅    | Reboots frecuentes = inestabilidad         |
| 9   | **DC Time Sync Status**     | ❌        | ✅         | ✅    | Desync >5min = Kerberos falla              |
| 10  | **DC Services Health**      | ❌        | ✅         | ✅    | NTDS/DNS/KDC stopped                       |
| 11  | **DC Memory/CPU Usage**     | ❌        | ❌         | ✅    | Baseline de rendimiento                    |
| 12  | **Schema Version**          | ❌        | ✅         | ✅    | 88=2019, 91=2025                           |

## 3.2 Replication Health (14 métricas)

**Cobertura Actual: 4/14 (29%)**

| #   | Métrica                           | Tu Script | PingCastle | Quest | Impacto                   |
| --- | --------------------------------- | --------- | ---------- | ----- | ------------------------- |
| 1   | Replication Partners              | ✅        | ✅         | ✅    | Topología                 |
| 2   | Last Replication Success          | ✅        | ✅         | ✅    | Estado actual             |
| 3   | Replication Failures              | ✅        | ✅         | ✅    | Errores activos           |
| 4   | Connection Objects                | ✅        | ✅         | ✅    | Topología KCC             |
| 5   | **Replication Latency (minutos)** | ❌        | ✅         | ✅    | "Tu replicación tarda 8h" |
| 6   | **All DCs Replication Status**    | ❌        | ✅         | ✅    | No solo DC local          |
| 7   | **Lingering Objects Detection**   | ❌        | ✅         | ✅    | Objetos fantasma          |
| 8   | **USN Rollback Detection**        | ❌        | ✅         | ✅    | Corrupción crítica        |
| 9   | **Replication Queue Length**      | ❌        | ✅         | ✅    | Backlog                   |
| 10  | **Inbound/Outbound Failures**     | ❌        | ✅         | ✅    | Direccionalidad           |
| 11  | **SYSVOL Replication State**      | ❌        | ✅         | ✅    | DFSR vs FRS               |
| 12  | **Intersite vs Intrasite**        | ❌        | ✅         | ✅    | WAN vs LAN issues         |
| 13  | **Replication Partitions**        | ❌        | ✅         | ✅    | Schema/Config/Domain      |
| 14  | **AD Replication Metadata**       | ❌        | ✅         | ✅    | Histórico de cambios      |

## 3.3 Site Topology (10 métricas)

**Cobertura Actual: 3/10 (30%)**

| #   | Métrica                             | Tu Script | PingCastle | Quest | Impacto                 |
| --- | ----------------------------------- | --------- | ---------- | ----- | ----------------------- |
| 1   | Sites List                          | ✅        | ✅         | ✅    | Inventario              |
| 2   | Subnets List                        | ✅        | ✅         | ✅    | Mapping                 |
| 3   | Site Links                          | ✅        | ✅         | ✅    | Conectividad            |
| 4   | **Sites Without Subnets**           | ❌        | ✅         | ✅    | Clientes "perdidos"     |
| 5   | **Subnets Without Sites**           | ❌        | ✅         | ✅    | Config incompleta       |
| 6   | **Site Link Costs Analysis**        | ❌        | ✅         | ✅    | Rutas subóptimas        |
| 7   | **Site Link Bridges**               | ❌        | ✅         | ✅    | Transitividad           |
| 8   | **Bridgehead Servers**              | ❌        | ✅         | ✅    | Single point of failure |
| 9   | **Inter-Site Replication Schedule** | ❌        | ✅         | ✅    | Ventanas de replicación |
| 10  | **DCs Per Site Distribution**       | ❌        | ✅         | ✅    | Balanceo                |

## 3.4 Object Hygiene (12 métricas)

**Cobertura Actual: 3/12 (25%)**

| #   | Métrica                                  | Tu Script | PingCastle | Quest | Impacto            |
| --- | ---------------------------------------- | --------- | ---------- | ----- | ------------------ |
| 1   | Stale Users (>90 days)                   | ✅        | ✅         | ✅    | Seguridad          |
| 2   | Stale Computers                          | ✅        | ✅         | ✅    | Seguridad          |
| 3   | Tombstone Lifetime                       | ✅        | ✅         | ✅    | Restore capability |
| 4   | **Empty Groups**                         | ❌        | ✅         | ✅    | Clutter/cleanup    |
| 5   | **Groups Without Managers**              | ❌        | ✅         | ✅    | Accountability     |
| 6   | **Orphaned Foreign Security Principals** | ❌        | ✅         | ✅    | ACLs rotas         |
| 7   | **Duplicate SPNs**                       | ❌        | ✅         | ✅    | Kerberos failures  |
| 8   | **Circular Group Nesting**               | ❌        | ✅         | ✅    | Performance        |
| 9   | **Users Without Email**                  | ❌        | ❌         | ✅    | Datos incompletos  |
| 10  | **Computers Without OS Info**            | ❌        | ❌         | ✅    | Inventario         |
| 11  | **Disabled Objects Count**               | ❌        | ✅         | ✅    | Cleanup candidates |
| 12  | **Objects in Default Containers**        | ❌        | ✅         | ✅    | Desorganización    |

## 3.5 GPO Health (11 métricas)

**Cobertura Actual: 4/11 (36%)**

| #   | Métrica                        | Tu Script | PingCastle | Quest | Impacto           |
| --- | ------------------------------ | --------- | ---------- | ----- | ----------------- |
| 1   | GPO List                       | ✅        | ✅         | ✅    | Inventario        |
| 2   | GPO Links                      | ✅        | ✅         | ✅    | Aplicación        |
| 3   | GPO Version (DS/Sysvol)        | ✅        | ✅         | ✅    | Sync status       |
| 4   | WMI Filters                    | ✅        | ✅         | ✅    | Conditional       |
| 5   | **Unlinked GPOs**              | ❌        | ✅         | ✅    | Basura            |
| 6   | **GPO Size/Complexity**        | ❌        | ✅         | ✅    | Logon lento       |
| 7   | **DS vs Sysvol Mismatch**      | ❌        | ✅         | ✅    | Replication issue |
| 8   | **Empty GPOs**                 | ❌        | ✅         | ✅    | Basura            |
| 9   | **OUs with Block Inheritance** | ❌        | ✅         | ✅    | Shadow IT         |
| 10  | **Enforced GPOs**              | ❌        | ✅         | ✅    | Override analysis |
| 11  | **GPO Permissions Audit**      | ❌        | ✅         | ✅    | Security          |

## 3.6 DNS Health (9 métricas)

**Cobertura Actual: 5/9 (56%)**

| #   | Métrica                           | Tu Script | PingCastle | Quest | Impacto             |
| --- | --------------------------------- | --------- | ---------- | ----- | ------------------- |
| 1   | DNS Zones                         | ✅        | ✅         | ✅    | Inventario          |
| 2   | Scavenging Status                 | ✅        | ✅         | ✅    | Cleanup             |
| 3   | Dynamic Updates                   | ✅        | ✅         | ✅    | Seguridad           |
| 4   | Forwarders                        | ✅        | ✅         | ✅    | External resolution |
| 5   | Zone Transfers                    | ✅        | ✅         | ✅    | Seguridad           |
| 6   | **Stale DNS Records Count**       | ❌        | ❌         | ✅    | Cleanup backlog     |
| 7   | **Root Hints Validation**         | ❌        | ❌         | ✅    | Internet resolution |
| 8   | **Forwarders Reachability**       | ❌        | ❌         | ✅    | Functionality       |
| 9   | **Conditional Forwarders Health** | ❌        | ❌         | ✅    | Trust DNS           |

## 3.7 DHCP Health (8 métricas)

**Cobertura Actual: 5/8 (63%)**

| #   | Métrica                          | Tu Script | PingCastle | Quest | Impacto       |
| --- | -------------------------------- | --------- | ---------- | ----- | ------------- |
| 1   | Authorized Servers               | ✅        | ✅         | ✅    | Seguridad     |
| 2   | Scope Statistics                 | ✅        | ✅         | ✅    | Capacity      |
| 3   | Failover Config                  | ✅        | ✅         | ✅    | HA            |
| 4   | Lease Duration                   | ✅        | ✅         | ✅    | Optimization  |
| 5   | Reservations                     | ✅        | ✅         | ✅    | Static IPs    |
| 6   | **DHCP Options Audit (6,15,42)** | ❌        | ❌         | ✅    | Client config |
| 7   | **Rogue DHCP Detection**         | ❌        | ❌         | ✅    | Security      |
| 8   | **Scope Exhaustion Prediction**  | ❌        | ❌         | ✅    | Proactive     |

## 3.8 Trust Relationships (7 métricas)

**Cobertura Actual: 4/7 (57%)**

| #   | Métrica                   | Tu Script | PingCastle | Quest | Impacto       |
| --- | ------------------------- | --------- | ---------- | ----- | ------------- |
| 1   | Trust List                | ✅        | ✅         | ✅    | Inventario    |
| 2   | Trust Direction           | ✅        | ✅         | ✅    | Access flow   |
| 3   | SID Filtering             | ✅        | ✅         | ✅    | Security      |
| 4   | Selective Auth            | ✅        | ✅         | ✅    | Security      |
| 5   | **Trust Validation Test** | ❌        | ✅         | ✅    | Functionality |
| 6   | **Orphaned Trusts**       | ❌        | ✅         | ✅    | Cleanup       |
| 7   | **Trust Password Age**    | ❌        | ✅         | ❌    | Health        |

## 3.9 Privileged Access (10 métricas)

**Cobertura Actual: 3/10 (30%)**

| #   | Métrica                             | Tu Script | PingCastle | Quest | Impacto         |
| --- | ----------------------------------- | --------- | ---------- | ----- | --------------- |
| 1   | Domain Admins Count                 | ✅        | ✅         | ✅    | Privilegio      |
| 2   | AdminCount=1 Objects                | ✅        | ✅         | ✅    | SDProp          |
| 3   | Privileged Users List               | ✅        | ✅         | ✅    | Audit           |
| 4   | **Enterprise Admins Count**         | ❌        | ✅         | ✅    | Forest-level    |
| 5   | **Schema Admins Count**             | ❌        | ✅         | ✅    | Schema changes  |
| 6   | **Nested Group Depth Analysis**     | ❌        | ✅         | ✅    | Shadow admins   |
| 7   | **Service Accounts in Priv Groups** | ❌        | ✅         | ✅    | Risk            |
| 8   | **Stale Privileged Accounts**       | ❌        | ✅         | ✅    | Ex-employees    |
| 9   | **Protected Users Membership**      | ❌        | ✅         | ✅    | Modern security |
| 10  | **Token Size / Group Count**        | ❌        | ✅         | ✅    | Auth failures   |

## 3.10 Performance & Capacity (8 métricas)

**Cobertura Actual: 1/8 (13%)**

| #   | Métrica                     | Tu Script | PingCastle | Quest | Impacto            |
| --- | --------------------------- | --------- | ---------- | ----- | ------------------ |
| 1   | DC Event Logs               | ✅        | ✅         | ✅    | Troubleshooting    |
| 2   | **DIT File Size**           | ❌        | ✅         | ✅    | Capacity           |
| 3   | **SYSVOL Size**             | ❌        | ✅         | ✅    | GPO bloat          |
| 4   | **LDAP Query Performance**  | ❌        | ❌         | ✅    | Speed              |
| 5   | **AD Database Whitespace**  | ❌        | ✅         | ✅    | Defrag needed      |
| 6   | **Functional Level**        | ❌        | ✅         | ✅    | Features available |
| 7   | **Object Count by Class**   | ❌        | ✅         | ✅    | Growth tracking    |
| 8   | **DC Performance Counters** | ❌        | ❌         | ✅    | Baseline           |

---

# 4. Brechas Críticas Identificadas

## 4.1 Top 20 Métricas Faltantes por Impacto

| #   | Métrica                   | Impacto                    | Prioridad |
| --- | ------------------------- | -------------------------- | --------- |
| 1   | Sites sin Subnets         | 🔴 Clientes autentican mal | CRÍTICA   |
| 2   | PDC con VM IC Time Sync   | 🔴 Kerberos failures       | CRÍTICA   |
| 3   | Trust Validation Status   | 🔴 Trust roto silencioso   | CRÍTICA   |
| 4   | GPO Settings Count        | 🔴 Logon lento             | CRÍTICA   |
| 5   | Replication Latency (hrs) | 🔴 Métrica vital           | CRÍTICA   |
| 6   | Token Size Estimation     | 🟡 Login failures          | ALTA      |
| 7   | FSMO en un solo DC        | 🟡 SPOF                    | ALTA      |
| 8   | Lingering Objects         | 🟡 Data corruption         | ALTA      |
| 9   | DHCP Options 6/15         | 🟡 Client misconfig        | ALTA      |
| 10  | DNS \_msdcs Records       | 🟡 Replication breaks      | ALTA      |
| 11  | Trust Password Age        | 🟡 Rotation failures       | ALTA      |
| 12  | GPOs sin Links            | 🟡 SYSVOL bloat            | ALTA      |
| 13  | DCs en Default-First-Site | 🟡 Orphaned DCs            | MEDIA     |
| 14  | Manual Connection Ratio   | 🟡 Config drift            | MEDIA     |
| 15  | DNS Root Hints            | 🟢 Internet resolution     | MEDIA     |
| 16  | SYSVOL DFSR Status        | 🟢 Legacy detection        | MEDIA     |
| 17  | Duplicate SPNs            | 🟢 Kerberos silent fail    | MEDIA     |
| 18  | Schema Version            | 🟢 Upgrade planning        | BAJA      |
| 19  | DC Disk Space             | 🟢 Capacity planning       | BAJA      |
| 20  | OUs con Block Inheritance | 🟢 Shadow IT               | BAJA      |

## 4.2 Brechas por Área

### Active Directory Core

- ❌ Grupos vacíos / sin uso
- ❌ Token Size / Group Membership Depth
- ❌ Circular Group Nesting
- ❌ Orphaned Foreign Security Principals
- ❌ Duplicate SPNs
- ❌ Schema Extensions Analysis

### Topología y Replicación

- ❌ Sitios sin Subnets Asignadas
- ❌ Conexiones Manuales vs KCC (ratio)
- ❌ Site Link Cost Analysis
- ❌ Bridgehead Server Health
- ❌ Replication Latency (Time-Based)

### GPO Health

- ❌ GPO Size Analysis (Monolíticas)
- ❌ Unlinked GPOs (Orphaned)
- ❌ GPO Processing Time
- ❌ WMI Filter Complexity
- ❌ Sysvol vs DS Version Mismatch
- ❌ GPO Inheritance Blocking

### DNS/DHCP

- ❌ Stale DNS Records Count
- ❌ DNS Query Statistics
- ❌ DNS \_msdcs Zone Health
- ❌ DHCP Options Audit
- ❌ Rogue DHCP Detection

### Trusts

- ❌ Trust Validation (Ping)
- ❌ Trust Password Age
- ❌ Trust Ticket Size Issues

---

# 5. Plan de Modificaciones a NewAssessment.tsx

## 5.1 Resumen de Cambios

| Tipo de Cambio             | Cantidad | Impacto             |
| -------------------------- | -------- | ------------------- |
| **Funciones Nuevas**       | 12       | +~800 líneas        |
| **Funciones Modificadas**  | 8        | Mejoras in-place    |
| **Módulos Nuevos**         | 1        | "OperationalHealth" |
| **Líneas Estimadas Final** | ~3,300   | +33%                |

## 5.2 Nuevas Funciones a Agregar

### Funciones Críticas (Sprint 1)

#### 1. `Get-SiteTopologyIssues`

**Propósito:** Detectar Sites sin Subnets, DCs huérfanos, conexiones manuales excesivas

```powershell
function Get-SiteTopologyIssues {
    Write-Host "`n[*] Analyzing Site Topology Issues..." -ForegroundColor Green
    try {
        $issues = @{
            SitesWithoutSubnets = @()
            OrphanedDCs = @()
            ManualConnectionRatio = 0
            ExplicitBridgeheads = @()
            SiteLinksAnalysis = @()
        }

        # 1. Sites sin subnets (CRÍTICO - PingCastle S-DC-SubnetMissing)
        $sites = Get-ADReplicationSite -Filter *
        $subnets = Get-ADReplicationSubnet -Filter *

        foreach ($site in $sites) {
            $siteSubnets = $subnets | Where-Object {
                $_.Site -and $_.Site.Split(',')[0] -replace 'CN=' -eq $site.Name
            }
            if ($siteSubnets.Count -eq 0) {
                $issues.SitesWithoutSubnets += @{
                    SiteName = $site.Name
                    Description = $site.Description
                    Impact = "Clients may authenticate to wrong DC"
                }
            }
        }

        # 2. DCs en Default-First-Site-Name
        $dcs = Get-ADDomainController -Filter *
        foreach ($dc in $dcs) {
            if ($dc.Site -eq "Default-First-Site-Name") {
                $issues.OrphanedDCs += @{
                    DCName = $dc.Name
                    HostName = $dc.HostName
                    Site = $dc.Site
                    Impact = "DC not properly placed in topology"
                }
            }
        }

        # 3. Ratio de conexiones manuales vs KCC
        $connections = Get-ADReplicationConnection -Filter *
        $totalConnections = $connections.Count
        $manualConnections = ($connections | Where-Object { $_.AutoGenerated -eq $false }).Count
        if ($totalConnections -gt 0) {
            $issues.ManualConnectionRatio = [math]::Round(($manualConnections / $totalConnections) * 100, 2)
        }

        return $issues
    } catch {
        Write-Host "[!] Error analyzing site topology: $_" -ForegroundColor Red
        return $null
    }
}
```

#### 2. `Get-FSMOHealthCheck`

**Propósito:** Validar FSMO accessibility, PDC Time Sync, distribución de roles

```powershell
function Get-FSMOHealthCheck {
    Write-Host "`n[*] Checking FSMO Roles Health..." -ForegroundColor Green
    try {
        $fsmoHealth = @{
            Roles = @()
            Issues = @()
            PDCTimeSyncSource = ""
            AllFSMOOnSingleDC = $false
        }

        $domain = Get-ADDomain
        $forest = Get-ADForest

        # Collect all FSMO holders
        $fsmoHolders = @{
            PDCEmulator = $domain.PDCEmulator
            RIDMaster = $domain.RIDMaster
            InfrastructureMaster = $domain.InfrastructureMaster
            SchemaMaster = $forest.SchemaMaster
            DomainNamingMaster = $forest.DomainNamingMaster
        }

        # Check if all FSMO on single DC (SPOF)
        $uniqueHolders = $fsmoHolders.Values | Select-Object -Unique
        if ($uniqueHolders.Count -eq 1) {
            $fsmoHealth.AllFSMOOnSingleDC = $true
            $fsmoHealth.Issues += @{
                Severity = "HIGH"
                Issue = "All FSMO roles on single DC - Single Point of Failure"
                AffectedDC = $uniqueHolders[0]
            }
        }

        # Check PDC Time Sync
        try {
            $timeSource = Invoke-Command -ComputerName $domain.PDCEmulator -ScriptBlock {
                w32tm /query /source 2>$null
            } -ErrorAction SilentlyContinue

            $fsmoHealth.PDCTimeSyncSource = $timeSource

            if ($timeSource -like "*VM IC*" -or $timeSource -like "*Hyper-V*") {
                $fsmoHealth.Issues += @{
                    Severity = "CRITICAL"
                    Issue = "PDC syncing with VM Integration Services"
                    AffectedDC = $domain.PDCEmulator
                }
            }
        } catch { }

        return $fsmoHealth
    } catch {
        Write-Host "[!] Error checking FSMO health: $_" -ForegroundColor Red
        return $null
    }
}
```

#### 3. `Get-GPOHealthAnalysis`

**Propósito:** Detectar GPOs monolíticas, sin links, con version mismatch

```powershell
function Get-GPOHealthAnalysis {
    Write-Host "`n[*] Analyzing GPO Health..." -ForegroundColor Green
    try {
        $gpoHealth = @{
            TotalGPOs = 0
            MonolithicGPOs = @()
            OrphanedGPOs = @()
            VersionMismatch = @()
            Summary = @{}
        }

        $allGPOs = Get-GPO -All
        $gpoHealth.TotalGPOs = $allGPOs.Count

        foreach ($gpo in $allGPOs) {
            [xml]$report = Get-GPOReport -Guid $gpo.Id -ReportType XML -ErrorAction SilentlyContinue

            # Count settings
            $computerSettings = 0
            $userSettings = 0
            if ($report.GPO.Computer.ExtensionData) {
                $computerSettings = ($report.GPO.Computer.ExtensionData.Extension |
                    ForEach-Object { $_.ChildNodes.Count } | Measure-Object -Sum).Sum
            }
            if ($report.GPO.User.ExtensionData) {
                $userSettings = ($report.GPO.User.ExtensionData.Extension |
                    ForEach-Object { $_.ChildNodes.Count } | Measure-Object -Sum).Sum
            }
            $totalSettings = [int]$computerSettings + [int]$userSettings

            # Monolithic detection (>50 settings)
            if ($totalSettings -gt 50) {
                $gpoHealth.MonolithicGPOs += @{
                    Name = $gpo.DisplayName
                    TotalSettings = $totalSettings
                    Severity = if ($totalSettings -gt 100) { "HIGH" } else { "MEDIUM" }
                }
            }

            # Orphaned detection (no links)
            $hasLinks = $report.GPO.LinksTo -ne $null -and $report.GPO.LinksTo.Count -gt 0
            if (-not $hasLinks) {
                $gpoHealth.OrphanedGPOs += @{
                    Name = $gpo.DisplayName
                    GpoId = $gpo.Id.ToString()
                }
            }

            # Version mismatch
            if ($gpo.User.DSVersion -ne $gpo.User.SysvolVersion -or
                $gpo.Computer.DSVersion -ne $gpo.Computer.SysvolVersion) {
                $gpoHealth.VersionMismatch += @{
                    Name = $gpo.DisplayName
                    Issue = "Sysvol replication may be broken"
                }
            }
        }

        return $gpoHealth
    } catch {
        Write-Host "[!] Error analyzing GPO health: $_" -ForegroundColor Red
        return $null
    }
}
```

#### 4. `Get-TrustHealthValidation`

**Propósito:** Validar trusts funcionalmente, password age

```powershell
function Get-TrustHealthValidation {
    Write-Host "`n[*] Validating Trust Relationships..." -ForegroundColor Green
    try {
        $trustHealth = @{
            Trusts = @()
            HealthyCount = 0
            BrokenCount = 0
        }

        $trusts = Get-ADTrust -Filter *

        foreach ($trust in $trusts) {
            $trustStatus = @{
                Name = $trust.Name
                Direction = $trust.Direction.ToString()
                ValidationStatus = "Unknown"
                PasswordAgeDays = -1
            }

            # Trust validation
            try {
                $validation = Test-ComputerSecureChannel -Server $trust.Name -ErrorAction Stop
                $trustStatus.ValidationStatus = if ($validation) { "Healthy" } else { "Broken" }
            } catch {
                $trustStatus.ValidationStatus = "Broken-Unreachable"
            }

            # Password age
            try {
                $trustAccountName = "$($trust.Name.Split('.')[0])$"
                $trustAccount = Get-ADObject -Filter "name -eq '$trustAccountName'" -Properties pwdLastSet
                if ($trustAccount.pwdLastSet) {
                    $pwdLastSet = [DateTime]::FromFileTime($trustAccount.pwdLastSet)
                    $trustStatus.PasswordAgeDays = ((Get-Date) - $pwdLastSet).Days
                }
            } catch { }

            $trustHealth.Trusts += $trustStatus
            if ($trustStatus.ValidationStatus -eq "Healthy") {
                $trustHealth.HealthyCount++
            } else {
                $trustHealth.BrokenCount++
            }
        }

        return $trustHealth
    } catch {
        Write-Host "[!] Error validating trusts: $_" -ForegroundColor Red
        return $null
    }
}
```

### Funciones Alta Prioridad (Sprint 2)

| Función                          | Propósito                                  |
| -------------------------------- | ------------------------------------------ |
| `Get-ReplicationLatencyAnalysis` | Calcular latencia de replicación entre DCs |
| `Get-TokenSizeEstimation`        | Estimar tamaño de token Kerberos           |
| `Get-DNSCriticalRecords`         | Validar registros \_msdcs y SRV            |
| `Get-DHCPOptionsAudit`           | Auditar opciones DHCP críticas             |

### Funciones Media Prioridad (Sprint 3)

| Función                       | Propósito                          |
| ----------------------------- | ---------------------------------- |
| `Get-SYSVOLHealth`            | Verificar estado de SYSVOL y DFSR  |
| `Get-DITDatabaseInfo`         | Obtener tamaño de NTDS.dit         |
| `Get-EmptyGroupsAnalysis`     | Analizar grupos vacíos             |
| `Get-OUsWithBlockInheritance` | Detectar OUs con Block Inheritance |

## 5.3 Modificaciones a Funciones Existentes

| Función                   | Modificación                           |
| ------------------------- | -------------------------------------- |
| `Get-ADSiteTopology`      | Agregar detección de Sites sin Subnets |
| `Get-TrustRelationships`  | Agregar validación y password age      |
| `Get-GPOInventory`        | Agregar conteo de settings             |
| `Get-AllADUsers`          | Agregar estimación de Token Size       |
| `Get-ADReplicationHealth` | Agregar cálculo de latencia            |
| `Get-DHCPConfiguration`   | Agregar alertas de scope exhaustion    |

---

# 6. Análisis de Prompts de IA

## 6.1 Evaluación de Prompts Actuales (server.js)

### Fortalezas ✅

| Aspecto                  | Calificación | Observaciones                                    |
| ------------------------ | ------------ | ------------------------------------------------ |
| Estructura Consistente   | 9/10         | Formato: instrucciones + severidad + MITRE + CIS |
| Referencias MITRE ATT&CK | 8/10         | Bien mapeadas a tácticas                         |
| Controles CIS            | 8/10         | Alineados con CIS Controls                       |
| Comandos PowerShell      | 9/10         | Verificación específica                          |
| Criterios de Severidad   | 8/10         | Clasificación clara                              |

### Áreas de Mejora ⚠️

1. Enfoque predominantemente de seguridad sobre salud operativa
2. Falta de métricas baseline de industria
3. Ausencia de detección de Configuration Drift
4. Sin análisis de tendencias históricas

### Calificación por Prompt

| Prompt              | Calidad | Enfoque   |
| ------------------- | ------- | --------- |
| `Users`             | 8/10    | Seguridad |
| `GPOs`              | 7/10    | Seguridad |
| `ReplicationStatus` | 9/10    | Operativa |
| `DCHealth`          | 9/10    | Operativa |
| `DNS`               | 8/10    | Mixto     |
| `Security`          | 9/10    | Seguridad |
| `Sites`             | 7/10    | Operativa |

## 6.2 Nuevos Prompts Requeridos

| Nueva Función                  | Prompt Necesario           | Enfoque             |
| ------------------------------ | -------------------------- | ------------------- |
| Get-SiteTopologyIssues         | SiteTopologyIssues         | Infraestructura     |
| Get-FSMOHealthCheck            | FSMOHealthCheck            | Disponibilidad      |
| Get-GPOHealthAnalysis          | GPOHealthAnalysis          | Configuration Drift |
| Get-TrustHealthValidation      | TrustHealthValidation      | Conectividad        |
| Get-ReplicationLatencyAnalysis | ReplicationLatencyAnalysis | Rendimiento         |
| Get-TokenSizeEstimation        | TokenSizeEstimation        | Operativa           |
| Get-DNSCriticalRecords         | DNSCriticalRecords         | Infraestructura     |
| Get-DHCPOptionsAudit           | DHCPOptionsAudit           | Configuración       |
| Get-SYSVOLHealth               | SYSVOLHealth               | Replicación         |
| Get-DITDatabaseInfo            | DITDatabaseInfo            | Capacidad           |
| Get-EmptyGroupsAnalysis        | EmptyGroupsAnalysis        | Governance          |
| Get-OUsWithBlockInheritance    | OUsWithBlockInheritance    | Configuration Drift |

---

# 7. Roadmap de Implementación

## 7.1 Sprint 1 - Críticas (1-2 semanas)

### Funciones

1. ✅ `Get-SiteTopologyIssues`
2. ✅ `Get-FSMOHealthCheck`
3. ✅ `Get-GPOHealthAnalysis`
4. ✅ `Get-TrustHealthValidation`
5. ✅ Modificar `Get-TrustRelationships`

### Impacto Esperado

- Cobertura: 37% → 55%
- Nuevas métricas: +15

## 7.2 Sprint 2 - Alta Prioridad (1-2 semanas)

### Funciones

6. `Get-ReplicationLatencyAnalysis`
7. `Get-TokenSizeEstimation`
8. `Get-DNSCriticalRecords`
9. `Get-DHCPOptionsAudit`
10. Modificar `Get-ADReplicationHealth`

### Impacto Esperado

- Cobertura: 55% → 70%
- Nuevas métricas: +12

## 7.3 Sprint 3 - Media Prioridad (1-2 semanas)

### Funciones

11. `Get-SYSVOLHealth`
12. `Get-DITDatabaseInfo`
13. `Get-EmptyGroupsAnalysis`
14. `Get-OUsWithBlockInheritance`
15. Modificaciones restantes

### Impacto Esperado

- Cobertura: 70% → 85%
- Nuevas métricas: +10

## 7.4 Sprint 4 - Enterprise Features (2+ semanas)

### Funciones Avanzadas

- All DCs Replication Status
- Bridgehead Server Analysis
- Protected Users Membership
- DC Performance Counters
- Object Count Trending

### Impacto Esperado

- Cobertura: 85% → 95%

## 7.5 Tabla de Impacto Final

| Métrica                          | Antes | Después |
| -------------------------------- | ----- | ------- |
| **Cobertura vs PingCastle**      | 60%   | 90%     |
| **Cobertura de Salud Operativa** | 40%   | 85%     |
| **Métricas "Vital Signs"**       | 3/10  | 9/10    |
| **Detección de Config Drift**    | 30%   | 85%     |
| **Líneas de Código**             | 2,479 | ~3,300  |
| **Funciones de Recolección**     | 35    | 47      |

---

## Apéndice A: Implementación de Funciones PowerShell

_Ver sección 5 para código completo de cada función._

## Apéndice B: Prompts de IA Detallados

_Los 12 nuevos prompts están documentados en detalle en el archivo original `MODIFICACIONES_NEWASSESSMENT.md` sección 7._

---

_Documento consolidado el 8 de Diciembre de 2025_  
_Fuentes: ANALISIS_INFRAESTRUCTURA_AUDIT.md, ANALISIS_SALUD_OPERATIVA_AD.md, METRICAS_INDUSTRIA_COMPLETAS.md, AUDITORIA_SALUD_OPERATIVA_AD.md, COMPARATIVA_AUDITORIAS_CONSOLIDADA.md, MODIFICACIONES_NEWASSESSMENT.md_  
_Para: Active Scan Insight - AD Assessment Platform_

---

# 8. Sistema Anti-Alucinaciones (Smart Filtering)

## 8.1 Implementación (v1.5.0)

Para evitar que el LLM invente hallazgos falsos, se implementó un sistema de **pre-filtrado inteligente** que solo envía datos relevantes/problemáticos a la IA.

### Filtros Implementados

| Categoría | Criterios de Filtrado | Resultado |
|-----------|----------------------|-----------|
| **Users** | PasswordNeverExpires, PasswordNotRequired, Disabled, Delegación, AdminCount, AS-REP/Kerberoastable | Solo usuarios de riesgo |
| **Computers** | Stale, Delegación, Disabled, OS Legacy (2008, XP, Vista, Win7) | Solo equipos problemáticos |
| **Groups** | Privileged, Empty (MemberCount=0) | Solo grupos administrativos o vacíos |
| **GPOs** | Sin links, Disabled, Version mismatch, Monolíticas (>50 settings), Permisos peligrosos | Solo GPOs problemáticas |
| **DNS** | SecurityIssues, ScavengingEnabled=false, DynamicUpdate inseguro | Solo configuraciones de riesgo |
| **DCHealth** | Errors, Warnings, Unhealthy, Services stopped, LowDisk (<10GB), HighLatency (>500ms) | Solo DCs con problemas |
| **Replication** | Failed (Result≠0), ConsecutiveFailures>0, Latency>15min | Solo fallos de replicación |
| **Trusts** | Broken, No SID Filtering, Orphaned, PasswordAge>180d | Solo trusts problemáticos |
| **FSMO** | Issues, AllOnSingleDC, VM Time Sync, RID Pool>80% | Solo problemas de roles |
| **Sites** | Sin subnets, Default-First-Site-Name, Sin DCs | Solo sitios mal configurados |

### Beneficios

1. **Reducción de Tokens:** De ~10,000 objetos a ~50-200 objetos relevantes
2. **Eliminación de Ruido:** La IA solo ve problemas reales
3. **Prevención de Alucinaciones:** Sin datos "normales" que la IA pueda malinterpretar
4. **Mejor Precisión:** El LLM se enfoca en analizar patterns de riesgo, no en inventar

### Logs de Diagnóstico

```
[SmartFilter] 'Users' category reduced from 5000 to 47 items (keeping only high-risk objects)
[SmartFilter] 'GPOs' category reduced from 200 to 12 items (keeping only problematic GPOs)
[SmartFilter] 'DCHealth' category reduced from 10 to 2 items (keeping only unhealthy DCs)
```

## 8.2 Prompt Engineering (v1.4.0)

Los prompts del sistema incluyen la **Regla de Oro de Grounding**:

```
⚠️ REGLA DE ORO - GROUNDING OBLIGATORIO:
Los nombres en "affected_objects" DEBEN existir TEXTUALMENTE en el JSON de entrada.
El sistema VALIDA y RECHAZA automáticamente cualquier nombre inventado.
Si inventas nombres → Tu finding será ELIMINADO.
```

## 8.3 Validación Post-IA (Deep Grounding)

Después de recibir los findings de la IA, el sistema valida recursivamente:

1. Extrae TODOS los strings del JSON original (valores + claves)
2. Compara cada `affected_object` del finding contra esta lista
3. Si un objeto no existe en los datos originales → **FINDING ELIMINADO**

---

_Última actualización: 15 de Diciembre de 2025 - v1.5.0_
