# JSON Schema - Active Directory Assessment Data

Este documento describe la estructura JSON esperada para los datos de assessment de Active Directory.

## Formatos Soportados

El sistema soporta tres formatos de estructura JSON:

### Formato 1: Data Wrapper (Recomendado)

```json
{
  "Users": {
    "Data": [
      { "SamAccountName": "user1", "Enabled": true, ... },
      { "SamAccountName": "user2", "Enabled": false, ... }
    ]
  },
  "Computers": {
    "Data": [
      { "Name": "PC1", "OperatingSystem": "Windows 10", ... }
    ]
  }
}
```

### Formato 2: Array Directo

```json
{
  "Users": [
    { "SamAccountName": "user1", ... }
  ],
  "Computers": [
    { "Name": "PC1", ... }
  ]
}
```

### Formato 3: Objeto Simple (No recomendado)

```json
{
  "Users": { "SamAccountName": "user1", ... }
}
```

---

## Categorías Soportadas

| Categoría | Descripción | Campos Clave |
|-----------|-------------|--------------|
| Users | Usuarios de AD | SamAccountName, Enabled, PasswordNeverExpires |
| Computers | Equipos de AD | Name, OperatingSystem, Enabled |
| Groups | Grupos de AD | Name, MemberCount, IsPrivileged |
| GPOs | Políticas de Grupo | DisplayName, GpoStatus, Links |
| OUs | Unidades Organizativas | Name, BlockInheritance, LinkedGPOs |
| Domains | Información del dominio | Name, DomainMode, ForestMode |
| DCHealth | Salud de DCs | Name, OverallHealth, ServicesStatus |
| DNS | Configuración DNS | ZoneName, ScavengingEnabled, DynamicUpdate |
| DHCP | Configuración DHCP | ServerName, ScopeId, Options |
| Kerberos | Configuración Kerberos | MaxTicketAge, SupportedETypes |
| Security | Configuración de seguridad | MinPasswordLength, LDAPSigning |
| Sites | Sitios de AD | Name, Subnets, SiteLinkCost |
| ACLs | Listas de control de acceso | DistinguishedName, Permissions |
| CertServices | Servicios de certificados | CAName, Templates |
| FSMORolesHealth | Salud de roles FSMO | RoleName, Holder, Health |
| ReplicationHealthAllDCs | Replicación entre DCs | SourceDC, DestDC, Status |
| TrustHealth | Salud de trusts | TrustName, TrustType, ValidationStatus |

---

## Estructura Detallada por Categoría

### Users

```json
{
  "SamAccountName": "string (requerido)",
  "DistinguishedName": "string",
  "Enabled": "boolean",
  "PasswordNeverExpires": "boolean",
  "PasswordNotRequired": "boolean",
  "PasswordLastSet": "date",
  "LastLogonDate": "date (formatos: /Date(ms)/, ISO 8601, Unix timestamp)",
  "AdminCount": "number (0 o 1)",
  "TrustedForDelegation": "boolean",
  "DoNotRequirePreAuth": "boolean",
  "IsASREPRoastable": "boolean",
  "IsKerberoastable": "boolean",
  "IsPrivileged": "boolean",
  "AccountNotDelegated": "boolean",
  "ServicePrincipalNames": ["string"] | "string",
  "MemberOf": ["string"]
}
```

### Computers

```json
{
  "Name": "string (requerido)",
  "DNSHostName": "string",
  "OperatingSystem": "string",
  "OperatingSystemVersion": "string",
  "Enabled": "boolean",
  "IsStale": "boolean",
  "TrustedForDelegation": "boolean",
  "LastLogonDate": "date",
  "LAPSEnabled": "boolean",
  "SupportedEncryptionTypes": "string"
}
```

### Groups

```json
{
  "Name": "string (requerido)",
  "DistinguishedName": "string",
  "GroupCategory": "string (Security|Distribution)",
  "GroupScope": "string (DomainLocal|Global|Universal)",
  "MemberCount": "number",
  "Members": ["string"],
  "IsPrivileged": "boolean"
}
```

### GPOs

```json
{
  "DisplayName": "string (requerido)",
  "Id": "string (GUID)",
  "GpoStatus": "string (AllSettingsEnabled|AllSettingsDisabled|UserSettingsDisabled|ComputerSettingsDisabled)",
  "Links": ["string"] | null,
  "LinksTo": ["string"] | null,
  "SettingsCount": "number",
  "TotalSettings": "number",
  "UserVersionDS": "number",
  "UserVersionSysvol": "number",
  "ComputerVersionDS": "number",
  "ComputerVersionSysvol": "number",
  "WmiFilter": "string",
  "ModificationTime": "date",
  "Permissions": [
    {
      "Trustee": "string",
      "Permission": "string"
    }
  ]
}
```

### DCHealth

```json
{
  "Name": "string (requerido)",
  "OperatingSystem": "string",
  "OverallHealth": "string (Healthy|Warning|Critical)",
  "Health": "string",
  "Errors": ["string"],
  "Warnings": ["string"],
  "ServicesStatus": {
    "NTDS": "string (Running|Stopped)",
    "DNS": "string",
    "Netlogon": "string"
  },
  "FreeDiskSpaceGB": "number",
  "UptimeDays": "number",
  "IsGlobalCatalog": "boolean"
}
```

### DNS

```json
{
  "ZoneName": "string",
  "ZoneType": "string (Primary|Secondary|Stub)",
  "ScavengingEnabled": "boolean",
  "AgingEnabled": "boolean",
  "DynamicUpdate": "string (None|Secure|NonsecureAndSecure|Nonsecure)",
  "ZoneTransfer": "string (None|Any|List)",
  "Forwarders": ["string (IP addresses)"],
  "SecurityIssues": ["string"],
  "StaleRecordCount": "number"
}
```

### Security

```json
{
  "MinPasswordLength": "number",
  "MaxPasswordAge": "number (días, 0 = nunca expira)",
  "PasswordComplexity": "boolean",
  "LDAPSigning": "string (None|Required)",
  "SMBv1Enabled": "boolean",
  "NTLMRestriction": "string (None|Audit|Deny)",
  "AuditPolicyConfigured": "boolean",
  "LAPSDeployed": "boolean",
  "CredentialGuardEnabled": "boolean"
}
```

### Kerberos

```json
{
  "MaxTicketAge": "number (horas)",
  "MaxRenewAge": "number (días)",
  "SupportedETypes": ["string (AES256|AES128|RC4|DES)"],
  "DelegationIssues": ["string"],
  "PreAuthNotRequired": "boolean"
}
```

### Sites

```json
{
  "Name": "string (requerido)",
  "Subnets": ["string (CIDR notation)"],
  "DomainControllers": ["string"],
  "SiteLinkCost": "number",
  "Issues": ["string"],
  "HasManualBridgehead": "boolean"
}
```

### TrustHealth

```json
{
  "TrustName": "string (requerido)",
  "TrustType": "string (Forest|External|Transitive)",
  "TrustDirection": "string (Inbound|Outbound|Bidirectional)",
  "ValidationStatus": "string (Healthy|Warning|Failed)",
  "SIDFilteringEnabled": "boolean",
  "SIDFilteringQuarantined": "boolean",
  "SelectiveAuthentication": "boolean",
  "PasswordAgeDays": "number",
  "Status": "string",
  "Issues": ["string"]
}
```

### FSMORolesHealth

```json
{
  "RoleName": "string",
  "Holder": "string (DC name)",
  "Health": "string (Healthy|Warning|Critical)",
  "AllFSMOOnSingleDC": "boolean",
  "PDCTimeSyncSource": "string",
  "RIDPoolStatus": {
    "PercentUsed": "number"
  },
  "Reachable": "boolean",
  "InfrastructureMasterOnGC": "boolean",
  "IsMultiDomain": "boolean",
  "Issues": ["string"]
}
```

### ReplicationHealthAllDCs

```json
{
  "SourceDC": "string",
  "DestinationDC": "string",
  "NamingContext": "string",
  "LastReplicationResult": "number (0 = success)",
  "LastReplicationSuccess": "date",
  "ConsecutiveFailures": "number",
  "LatencyMinutes": "number",
  "Status": "string (Success|Failed|Error)",
  "USNRollbackDetected": "boolean"
}
```

---

## Formatos de Fecha Soportados

El sistema soporta múltiples formatos de fecha:

1. **WCF/Microsoft JSON**: `/Date(1234567890000)/`
2. **ISO 8601**: `2024-12-20T10:30:00Z`
3. **Unix Timestamp (ms)**: `1703079000000`
4. **Unix Timestamp (s)**: `1703079000`

---

## Validación

El sistema valida automáticamente:

1. **Existencia de objetos**: Los nombres en `affected_objects` deben existir en los datos
2. **Atributos**: Los objetos deben tener los atributos que el sistema reclama (v1.7.0+)
3. **Estructura**: Los campos requeridos deben estar presentes
4. **Tipos de datos**: Los valores deben coincidir con los tipos esperados

---

## Ejemplo Completo

```json
{
  "Users": {
    "Data": [
      {
        "SamAccountName": "admin",
        "DistinguishedName": "CN=Admin,OU=Users,DC=contoso,DC=com",
        "Enabled": true,
        "PasswordNeverExpires": true,
        "AdminCount": 1,
        "LastLogonDate": "/Date(1703079000000)/",
        "IsPrivileged": true
      },
      {
        "SamAccountName": "svc_backup",
        "Enabled": true,
        "ServicePrincipalNames": ["MSSQLSvc/server.contoso.com:1433"],
        "TrustedForDelegation": true
      }
    ]
  },
  "Computers": {
    "Data": [
      {
        "Name": "DC01",
        "OperatingSystem": "Windows Server 2019",
        "Enabled": true,
        "IsStale": false
      },
      {
        "Name": "LEGACY-SRV",
        "OperatingSystem": "Windows Server 2008 R2",
        "Enabled": true,
        "IsStale": true
      }
    ]
  },
  "GPOs": {
    "Data": [
      {
        "DisplayName": "Default Domain Policy",
        "GpoStatus": "AllSettingsEnabled",
        "Links": ["DC=contoso,DC=com"],
        "SettingsCount": 45
      }
    ]
  },
  "DCHealth": {
    "Data": [
      {
        "Name": "DC01",
        "OverallHealth": "Healthy",
        "FreeDiskSpaceGB": 50,
        "UptimeDays": 30,
        "IsGlobalCatalog": true
      }
    ]
  }
}
```

---

## Notas de Implementación

- Los campos son case-insensitive para la búsqueda de categorías
- Los valores null/undefined son filtrados automáticamente
- Los arrays vacíos se consideran como "sin datos"
- El Smart Filtering reduce automáticamente los datos antes de enviar al LLM
