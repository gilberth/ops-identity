# PowerShell Functions Reference

Ready-to-use implementations following OpsIdentity anti-null patterns.

---

## Mandatory Pattern

```powershell
function Get-FunctionName {
    $results = @()  # ALWAYS initialize empty
    try {
        $items = @(Get-ADObject -Filter * -ErrorAction Stop)  # FORCE array
        foreach ($item in $items) {
            try {
                $results += @{ Name = $item.Name; IsProblematic = $false }
            } catch { Write-Host "[!] $_" -ForegroundColor Yellow }
        }
        return @($results)  # ALWAYS return array
    } catch {
        Write-Host "[!] CRITICAL: $_" -ForegroundColor Red
        return @()  # NEVER return null
    }
}
```

---

## Critical Functions

### Get-KRBTGTPasswordAge

```powershell
function Get-KRBTGTPasswordAge {
    $list = @()
    try {
        $krbtgt = Get-ADUser -Identity "krbtgt" -Properties PasswordLastSet -ErrorAction Stop
        $age = (New-TimeSpan -Start $krbtgt.PasswordLastSet -End (Get-Date)).Days
        $list += @{
            Account = "krbtgt"
            PasswordLastSet = $krbtgt.PasswordLastSet.ToString("yyyy-MM-dd")
            AgeDays = $age
            IsCritical = ($age -gt 180)
            IsWarning = ($age -gt 90 -and $age -le 180)
            IsProblematic = ($age -gt 90)
        }
        return @($list)
    } catch { return @() }
}
```

### Get-DCSecurityConfig

```powershell
function Get-DCSecurityConfig {
    $results = @()
    try {
        $dcs = @(Get-ADDomainController -Filter * -ErrorAction Stop)
        foreach ($dc in $dcs) {
            try {
                $config = @{ Name = $dc.HostName; Site = $dc.Site }
                
                # SMBv1
                try {
                    $smb = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                        (Get-SmbServerConfiguration).EnableSMB1Protocol
                    } -ErrorAction SilentlyContinue
                    $config.SMBv1Enabled = $smb
                } catch { $config.SMBv1Enabled = "Unknown" }
                
                # Print Spooler
                try {
                    $svc = Get-Service Spooler -ComputerName $dc.HostName -ErrorAction SilentlyContinue
                    $config.SpoolerRunning = ($svc.Status -eq "Running")
                } catch { $config.SpoolerRunning = "Unknown" }
                
                # LDAP Signing
                try {
                    $ldap = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                        (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\NTDS\Parameters" -EA SilentlyContinue).LDAPServerIntegrity
                    } -ErrorAction SilentlyContinue
                    $config.LDAPSigningRequired = ($ldap -eq 2)
                } catch { $config.LDAPSigningRequired = "Unknown" }
                
                $config.IsProblematic = ($config.SMBv1Enabled -eq $true -or $config.SpoolerRunning -eq $true -or $config.LDAPSigningRequired -eq $false)
                $results += $config
            } catch { Write-Host "[!] Error DC $($dc.HostName): $_" -ForegroundColor Yellow }
        }
        return @($results)
    } catch { return @() }
}
```

### Get-GPOCPassword

```powershell
function Get-GPOCPassword {
    $results = @()
    try {
        $domain = (Get-ADDomain).DNSRoot
        $path = "\\$domain\SYSVOL\$domain\Policies"
        $files = @(Get-ChildItem $path -Recurse -Filter "*.xml" -EA SilentlyContinue)
        
        foreach ($f in $files) {
            try {
                $content = Get-Content $f.FullName -Raw -EA SilentlyContinue
                if ($content -match 'cpassword') {
                    $guid = ($f.FullName -split '\\' | Where-Object { $_ -match '^\{' }) -join ''
                    $gpoName = (Get-GPO -Guid $guid.Trim('{}') -EA SilentlyContinue).DisplayName
                    $results += @{
                        GPOName = if($gpoName){$gpoName}else{"Unknown"}
                        GPOGUID = $guid
                        FilePath = $f.FullName
                        HasCPassword = $true
                        IsProblematic = $true
                    }
                }
            } catch {}
        }
        return @($results)
    } catch { return @() }
}
```

### Get-SiteTopologyIssues

```powershell
function Get-SiteTopologyIssues {
    $results = @()
    try {
        $sites = @(Get-ADReplicationSite -Filter * -ErrorAction Stop)
        foreach ($site in $sites) {
            try {
                $subnets = @(Get-ADReplicationSubnet -Filter "Site -eq '$($site.DistinguishedName)'" -EA SilentlyContinue)
                $dcs = @(Get-ADDomainController -Filter "Site -eq '$($site.Name)'" -EA SilentlyContinue)
                
                $results += @{
                    SiteName = $site.Name
                    SubnetCount = $subnets.Count
                    Subnets = @($subnets.Name)
                    DCCount = $dcs.Count
                    DomainControllers = @($dcs.HostName)
                    HasNoSubnets = ($subnets.Count -eq 0)
                    HasNoDCs = ($dcs.Count -eq 0)
                    IsProblematic = ($subnets.Count -eq 0)
                }
            } catch {}
        }
        
        # Orphaned subnets
        $allSubnets = @(Get-ADReplicationSubnet -Filter * -EA SilentlyContinue)
        foreach ($s in $allSubnets) {
            if (-not $s.Site) {
                $results += @{ Type = "OrphanedSubnet"; SubnetName = $s.Name; IsProblematic = $true }
            }
        }
        return @($results)
    } catch { return @() }
}
```

### Get-TokenSizeEstimation

```powershell
function Get-TokenSizeEstimation {
    $results = @()
    try {
        $users = @(Get-ADUser -Filter {Enabled -eq $true} -Properties MemberOf, SIDHistory -ErrorAction Stop)
        foreach ($u in $users) {
            try {
                $groups = @(Get-ADPrincipalGroupMembership $u -EA SilentlyContinue)
                $sidHist = if($u.SIDHistory){@($u.SIDHistory).Count}else{0}
                $size = 1200 + ($groups.Count * 40) + ($sidHist * 28)
                
                if ($size -gt 6144) {
                    $results += @{
                        UserName = $u.SamAccountName
                        TotalGroups = $groups.Count
                        SIDHistoryCount = $sidHist
                        EstimatedTokenBytes = $size
                        EstimatedTokenKB = [math]::Round($size/1024,2)
                        IsCritical = ($size -gt 12288)
                        IsWarning = ($size -gt 8192)
                        IsProblematic = ($size -gt 8192)
                    }
                }
            } catch {}
        }
        return @($results | Sort-Object EstimatedTokenBytes -Descending)
    } catch { return @() }
}
```

### Get-LAPSCoverage

```powershell
function Get-LAPSCoverage {
    $results = @()
    try {
        $schema = Get-ADObject -SearchBase (Get-ADRootDSE).schemaNamingContext `
            -Filter "name -eq 'ms-Mcs-AdmPwd'" -EA SilentlyContinue
        
        if (-not $schema) {
            return @(@{ Status = "LAPS Not Installed"; IsProblematic = $true })
        }
        
        $computers = @(Get-ADComputer -Filter {Enabled -eq $true} `
            -Properties ms-Mcs-AdmPwd -EA Stop | 
            Where-Object { $_.DistinguishedName -notlike "*Domain Controllers*" })
        
        $total = $computers.Count
        $laps = @($computers | Where-Object { $_.'ms-Mcs-AdmPwd' }).Count
        $pct = if($total -gt 0){[math]::Round(($laps/$total)*100,2)}else{0}
        
        $results += @{
            TotalComputers = $total
            LAPSEnabled = $laps
            CoveragePercent = $pct
            IsProblematic = ($pct -lt 80)
        }
        return @($results)
    } catch { return @() }
}
```

### Get-EmptyGroupsAnalysis

```powershell
function Get-EmptyGroupsAnalysis {
    $results = @()
    try {
        $groups = @(Get-ADGroup -Filter * -Properties Members, ManagedBy, Description -ErrorAction Stop)
        foreach ($g in $groups) {
            try {
                $count = if($g.Members){@($g.Members).Count}else{0}
                $hasManager = ($g.ManagedBy -ne $null)
                
                if ($count -eq 0 -or -not $hasManager) {
                    $results += @{
                        Name = $g.Name
                        SamAccountName = $g.SamAccountName
                        GroupScope = $g.GroupScope.ToString()
                        MemberCount = $count
                        IsEmpty = ($count -eq 0)
                        HasManager = $hasManager
                        IsProblematic = $true
                    }
                }
            } catch {}
        }
        return @($results)
    } catch { return @() }
}
```

### Get-ServiceAccountsInAdminGroups

```powershell
function Get-ServiceAccountsInAdminGroups {
    $results = @()
    try {
        $adminGroups = @("Domain Admins", "Enterprise Admins", "Administrators")
        
        foreach ($groupName in $adminGroups) {
            try {
                $members = @(Get-ADGroupMember -Identity $groupName -Recursive -EA SilentlyContinue)
                foreach ($m in $members) {
                    if ($m.objectClass -eq "user") {
                        $user = Get-ADUser $m -Properties ServicePrincipalName, Description -EA SilentlyContinue
                        $isSvc = ($user.ServicePrincipalName -or $user.SamAccountName -match "^svc|^service|_svc|_service")
                        
                        if ($isSvc) {
                            $results += @{
                                UserName = $user.SamAccountName
                                DisplayName = $user.Name
                                AdminGroup = $groupName
                                HasSPN = ($user.ServicePrincipalName -ne $null)
                                Description = $user.Description
                                IsProblematic = $true
                            }
                        }
                    }
                }
            } catch {}
        }
        return @($results)
    } catch { return @() }
}
```

---

## Integration Notes

### Adding to NewAssessment.tsx

```powershell
Write-Host "[*] Collecting KRBTGT Password Age..." -ForegroundColor Cyan
$results.KRBTGTHealth = Get-KRBTGTPasswordAge

Write-Host "[*] Collecting DC Security Config..." -ForegroundColor Cyan
$results.DCSecurityConfig = Get-DCSecurityConfig
```

### Smart Filtering in server.js

```javascript
case 'KRBTGTHealth':
  return data.filter(item => item.IsProblematic === true);

case 'DCSecurityConfig':
  return data.filter(item => 
    item.SMBv1Enabled === true ||
    item.SpoolerRunning === true ||
    item.LDAPSigningRequired === false
  );
```

### Validation Rules

```javascript
'KRBTGT_PASSWORD_STALE': {
  category: 'KRBTGTHealth',
  identifierField: 'Account',
  validate: (obj) => obj.AgeDays > 90
},
'DC_SECURITY_SMBV1': {
  category: 'DCSecurityConfig',
  identifierField: 'Name',
  validate: (obj) => obj.SMBv1Enabled === true
}
```
