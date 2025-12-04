import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Shield, Terminal, ArrowLeft } from "lucide-react";
import Header from "@/components/layout/Header";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { api, getApiEndpoint } from "@/utils/api";

const NewAssessment = () => {
    const [domain, setDomain] = useState("");
    const [scriptGenerated, setScriptGenerated] = useState(false);
    const [assessmentId, setAssessmentId] = useState<string | null>(null);
    const navigate = useNavigate();

    const [selectedModules, setSelectedModules] = useState<string[]>(["Core", "Infrastructure", "Security", "GPO", "Replication"]);

    const modules = [
        { id: "Core", label: "Core Identity (Users, Groups, Computers)", description: "Essential AD inventory and basic security checks." },
        { id: "Infrastructure", label: "Infrastructure (DNS, DHCP, Sites)", description: "Network services and physical topology." },
        { id: "Security", label: "Advanced Security (Kerberos, LAPS, ACLs)", description: "Deep security analysis including delegation and encryption." },
        { id: "GPO", label: "Group Policy Objects", description: "Analysis of GPO configurations and permissions." },
        { id: "Replication", label: "Replication Health", description: "Deep analysis of replication topology and failures." },
        { id: "ADCS", label: "Certificates & Protocols", description: "ADCS vulnerabilities (ESC1) and protocol hardening (LDAP Signing)." }
    ];

    const toggleModule = (id: string) => {
        setSelectedModules(prev =>
            prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
        );
    };

    const generateScript = async () => {
        if (!domain.trim()) {
            toast.error("Por favor ingresa un nombre de dominio");
            return;
        }

        try {
            // Create assessment in database
            const data = await api.createAssessment(domain.trim());

            setAssessmentId(data.id);
            setScriptGenerated(true);
            toast.success("Script PowerShell generado exitosamente");
        } catch (error) {
            console.error('Error creating assessment:', error);
            toast.error("Error al crear el assessment");
        }
    };

    const downloadScript = () => {
        let uploadEndpoint = getApiEndpoint();

        // Ensure absolute URL for PowerShell script (which runs outside the browser)
        if (uploadEndpoint.startsWith('/') || uploadEndpoint === '') {
            uploadEndpoint = `${window.location.origin}${uploadEndpoint}`;
        }

        const apiUrl = `${uploadEndpoint}/api/process-assessment`;

        // PowerShell script template with ALL advanced security functions
        const script = `# =============================================================================
# Active Directory Security Assessment - Data Collection Script
# Generated for: ${domain}
# Assessment ID: ${assessmentId}
# Generated on: ${new Date().toISOString()}
# =============================================================================
# IMPORTANT:
# 1. Run this script from a Domain Controller or a member server with
#    Active Directory PowerShell Module installed.
# 2. Execute with an account that has Domain Admins or equivalent privileges
#    to ensure all necessary data can be collected.
# 3. For DCs without internet: Use -OfflineMode to save JSON locally only
#    Example: .\\script.ps1 -OfflineMode
# =============================================================================

# --- Parameters ---
param(
    [switch]$OfflineMode
)

# --- Configuration ---
$ApiEndpoint = "${apiUrl}"
$AssessmentId = "${assessmentId}"
$DomainName = "${domain}"

# --- Script Start ---
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Active Directory Security Assessment" -ForegroundColor Cyan
Write-Host "Domain: $DomainName" -ForegroundColor Cyan
Write-Host "Assessment ID: $AssessmentId" -ForegroundColor Cyan
if ($OfflineMode) {
    Write-Host "Mode: OFFLINE (Save JSON locally only)" -ForegroundColor Yellow
} else {
    Write-Host "Mode: ONLINE (Send to API)" -ForegroundColor Green
    Write-Host "Target: $ApiEndpoint" -ForegroundColor Gray
}
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Connectivity Check
if (-not $OfflineMode) {
    Write-Host "[*] Testing connectivity to API..." -ForegroundColor Cyan
    try {
        $test = Invoke-WebRequest -Uri "$ApiEndpoint" -Method Options -TimeoutSec 5 -ErrorAction SilentlyContinue
        Write-Host "[+] Connection successful" -ForegroundColor Green
    } catch {
        Write-Host "[!] WARNING: Could not connect to API endpoint ($ApiEndpoint)" -ForegroundColor Yellow
        Write-Host "    The server might be unreachable from this machine." -ForegroundColor Yellow
        Write-Host "    If this machine has restricted internet access, use Offline Mode:" -ForegroundColor Yellow
        Write-Host "    Example: .\AD-Assessment.ps1 -OfflineMode" -ForegroundColor White
        Write-Host ""
        Write-Host "    Continuing in 5 seconds... (Press Ctrl+C to stop)" -ForegroundColor Gray
        Start-Sleep -Seconds 5
    }
}

# Configurar codificacion UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

# Force TLS 1.2 (Crucial for older Windows Servers)
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# Check PowerShell version
Write-Host "[*] Checking PowerShell version..." -ForegroundColor Green
$psVersion = $PSVersionTable.PSVersion
Write-Host "[+] PowerShell version: $($psVersion.Major).$($psVersion.Minor)" -ForegroundColor Green

if ($psVersion.Major -lt 5) {
    Write-Host "[!] WARNING: PowerShell 5.0+ recommended. Current version: $($psVersion.Major).$($psVersion.Minor)" -ForegroundColor Yellow
}

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: Script is not running as Administrator. Some data may not be collected." -ForegroundColor Yellow
}

# Import Active Directory Module
Write-Host "[*] Importing Active Directory module..." -ForegroundColor Green
try {
    Import-Module ActiveDirectory -ErrorAction Stop
    Write-Host "[+] Active Directory module loaded successfully" -ForegroundColor Green
} catch {
    Write-Host "[!] ERROR: Active Directory module not found. Please install RSAT tools." -ForegroundColor Red
    Write-Host "    Install with: Add-WindowsFeature RSAT-AD-PowerShell" -ForegroundColor Yellow
    exit 1
}

# Check for GroupPolicy module (optional)
$gpModuleAvailable = $false
Write-Host "[*] Checking for GroupPolicy module..." -ForegroundColor Green
try {
    Import-Module GroupPolicy -ErrorAction Stop
    $gpModuleAvailable = $true
    Write-Host "[+] GroupPolicy module loaded successfully" -ForegroundColor Green
} catch {
    Write-Host "[!] WARNING: GroupPolicy module not available. Using alternative methods for GPO analysis." -ForegroundColor Yellow
    Write-Host "    For full GPO analysis, install with: Add-WindowsFeature GPMC" -ForegroundColor Yellow
}

# Check for DNSServer module (optional)
$dnsModuleAvailable = $false
Write-Host "[*] Checking for DNSServer module..." -ForegroundColor Green
try {
    Import-Module DnsServer -ErrorAction Stop
    $dnsModuleAvailable = $true
    Write-Host "[+] DNSServer module loaded successfully" -ForegroundColor Green
} catch {
    Write-Host "[!] WARNING: DNSServer module not available. DNS scavenging analysis will be limited." -ForegroundColor Yellow
}

# =============================================================================
# DATA COLLECTION FUNCTIONS
# =============================================================================

function Get-DomainInformation {
    Write-Host "\`n[*] Collecting Domain Information..." -ForegroundColor Green
    try {
        $domain = Get-ADDomain
        $forest = Get-ADForest

        $domainInfo = @{
            DomainDNS = $domain.DNSRoot
            DomainNetBIOS = $domain.NetBIOSName
            ForestName = $forest.Name
            DomainFunctionalLevel = $domain.DomainMode.ToString()
            ForestFunctionalLevel = $forest.ForestMode.ToString()
            DomainSID = $domain.DomainSID.Value
            SchemaVersion = (Get-ADObject (Get-ADRootDSE).schemaNamingContext -Property objectVersion).objectVersion
        }

        Write-Host "[+] Domain information collected" -ForegroundColor Green
        return $domainInfo
    } catch {
        Write-Host "[!] Error collecting domain information: $_" -ForegroundColor Red
        return $null
    }
}

function Get-DomainControllerInfo {
    Write-Host "\`n[*] Collecting Domain Controllers..." -ForegroundColor Green
    try {
        $dcs = Get-ADDomainController -Filter * | ForEach-Object {
            @{
                Name = $_.Name
                HostName = $_.HostName
                IPv4Address = $_.IPv4Address
                OperatingSystem = $_.OperatingSystem
                OperatingSystemVersion = $_.OperatingSystemVersion
                IsGlobalCatalog = $_.IsGlobalCatalog
                IsReadOnly = $_.IsReadOnly
                Site = $_.Site
                Enabled = $_.Enabled
                Roles = @($_.OperationMasterRoles)
            }
        }

        Write-Host "[+] Collected $($dcs.Count) Domain Controllers" -ForegroundColor Green
        return $dcs
    } catch {
        Write-Host "[!] Error collecting DCs: $_" -ForegroundColor Red
        return @()
    }
}

function Get-ADReplicationHealth {
    Write-Host "\`n[*] Collecting AD Replication Health..." -ForegroundColor Green
    $replData = @{
        Connections = @()
        Partners = @()
        Sites = @()
        Subnets = @()
    }
    
    try {
        # 1. Replication Connections (Check for duplicates and deleted servers)
        Write-Host "[*] Analyzing replication connections..." -ForegroundColor Cyan
        $replData.Connections = Get-ADReplicationConnection -Filter * | Select-Object Name, ReplicateFromDirectoryServer, ReplicateToDirectoryServer, AutoGenerated, Enabled, @{N='IsDeleted';E={$_.ReplicateFromDirectoryServer -like '*\\0ADEL*'}}

        # 2. Replication Status (Partner Metadata) - Local DC only to avoid remote errors
        Write-Host "[*] Checking replication status for current DC..." -ForegroundColor Cyan
        $replData.Partners = Get-ADReplicationPartnerMetadata -Target $env:COMPUTERNAME -PartnerType Inbound -ErrorAction SilentlyContinue | Select-Object Partner, LastReplicationSuccess, LastReplicationAttempt, LastReplicationResult, ConsecutiveFailureCount

        # 3. Sites and Subnets
        Write-Host "[*] Mapping sites and subnets..." -ForegroundColor Cyan
        $replData.Sites = Get-ADReplicationSite -Filter * | Select-Object Name, InterSiteTopologyGenerator
        $replData.Subnets = Get-ADReplicationSubnet -Filter * | Select-Object Name, Site

        return $replData
    } catch {
        Write-Host "[!] Error collecting replication data: $_" -ForegroundColor Red
        return $null
    }
}

function Get-ADSiteTopology {
    Write-Host "\`n[*] Collecting Site Topology..." -ForegroundColor Green
    try {
        $sites = Get-ADReplicationSite -Filter * | ForEach-Object {
            @{
                Name = $_.Name
                Description = $_.Description
                Location = $_.Location
                ISTG = $_.InterSiteTopologyGenerator
            }
        }

        $subnets = Get-ADReplicationSubnet -Filter * | ForEach-Object {
            @{
                Name = $_.Name
                Site = $_.Site
                Description = $_.Description
            }
        }

        Write-Host "[+] Collected $($sites.Count) sites and $($subnets.Count) subnets" -ForegroundColor Green
        return @{
            Sites = $sites
            Subnets = $subnets
        }
    } catch {
        Write-Host "[!] Error collecting site topology: $_" -ForegroundColor Red
        return $null
    }
}

function Get-TrustRelationships {
    Write-Host "\`n[*] Collecting Trust Relationships..." -ForegroundColor Green
    try {
        $trusts = Get-ADTrust -Filter * | ForEach-Object {
            @{
                Name = $_.Name
                Direction = $_.Direction.ToString()
                TrustType = $_.TrustType.ToString()
                Source = $_.Source
                Target = $_.Target
                SelectiveAuthentication = $_.SelectiveAuthentication
                SIDFilteringQuarantined = $_.SIDFilteringQuarantined
                DisallowTransivity = $_.DisallowTransivity
            }
        }

        Write-Host "[+] Collected $($trusts.Count) trust relationships" -ForegroundColor Green
        return $trusts
    } catch {
        Write-Host "[!] Error collecting trust relationships: $_" -ForegroundColor Red
        return @()
    }
}

function Get-AllADUsers {
    Write-Host "\`n[*] Collecting Active Directory Users (this may take a while)..." -ForegroundColor Green
    try {
        $users = Get-ADUser -Filter * -Properties \`
            DisplayName, UserPrincipalName, Enabled, PasswordLastSet, PasswordNeverExpires, \`
            PasswordNotRequired, LastLogonDate, whenCreated, ServicePrincipalName, \`
            DoesNotRequirePreAuth, TrustedForDelegation, TrustedToAuthForDelegation, \`
            MemberOf, msDS-SupportedEncryptionTypes, \`
            msDS-AllowedToDelegateTo, msDS-AllowedToActOnBehalfOfOtherIdentity | ForEach-Object {

            $privilegedGroups = @(
                "Domain Admins", "Enterprise Admins", "Schema Admins", "Administrators",
                "Account Operators", "Backup Operators", "Server Operators", "Print Operators",
                "DnsAdmins", "Group Policy Creator Owners",
                "Admins. del dominio", "Administradores de empresas", "Administradores de esquema", "Administradores",
                "Operadores de cuentas", "Operadores de copia de seguridad", "Operadores de servidores", "Operadores de impresión",
                "Administradores de DNS", "Propietarios creadores de directivas de grupo"
            )

            $userGroups = $_.MemberOf | ForEach-Object {
                (Get-ADGroup $_ -ErrorAction SilentlyContinue).Name
            }

            $isPrivileged = ($userGroups | Where-Object { $privilegedGroups -contains $_ }).Count -gt 0

            $isStale = $false
            if ($_.LastLogonDate) {
                $daysSinceLogon = (Get-Date) - $_.LastLogonDate
                $isStale = $daysSinceLogon.Days -gt 90
            } elseif ($_.whenCreated) {
                $daysSinceCreation = (Get-Date) - $_.whenCreated
                $isStale = $daysSinceCreation.Days -gt 90
            }

            @{
                SamAccountName = $_.SamAccountName
                DisplayName = $_.DisplayName
                UserPrincipalName = $_.UserPrincipalName
                DistinguishedName = $_.DistinguishedName
                Enabled = $_.Enabled
                PasswordLastSet = $_.PasswordLastSet
                PasswordNeverExpires = $_.PasswordNeverExpires
                PasswordNotRequired = $_.PasswordNotRequired
                LastLogonDate = $_.LastLogonDate
                WhenCreated = $_.whenCreated
                IsPrivileged = $isPrivileged
                PrivilegedGroups = @($userGroups | Where-Object { $privilegedGroups -contains $_ })
                ServicePrincipalNames = @($_.ServicePrincipalName)
                IsKerberoastable = ($_.ServicePrincipalName.Count -gt 0)
                DoNotRequirePreAuth = $_.DoesNotRequirePreAuth
                IsASREPRoastable = $_.DoesNotRequirePreAuth
                TrustedForDelegation = $_.TrustedForDelegation
                TrustedToAuthForDelegation = $_.TrustedToAuthForDelegation
                AllowedToDelegateTo = @($_.'msDS-AllowedToDelegateTo')
                IsStale = $isStale
            }
        }

        Write-Host "[+] Collected $($users.Count) users" -ForegroundColor Green
        return $users
    } catch {
        Write-Host "[!] Error collecting users: $_" -ForegroundColor Red
        return @()
    }
}

function Get-AllADComputers {
    Write-Host "\`n[*] Collecting Active Directory Computers..." -ForegroundColor Green
    try {
        $computers = Get-ADComputer -Filter * -Properties \`
            DNSHostName, Enabled, OperatingSystem, OperatingSystemVersion, \`
            LastLogonDate, PasswordLastSet, whenCreated, TrustedForDelegation, \`
            PrimaryGroupID | ForEach-Object {

            $isDC = $_.PrimaryGroupID -eq 516

            $isStale = $false
            if ($_.LastLogonDate) {
                $daysSinceLogon = (Get-Date) - $_.LastLogonDate
                $isStale = $daysSinceLogon.Days -gt 90
            }

            @{
                Name = $_.Name
                DNSHostName = $_.DNSHostName
                DistinguishedName = $_.DistinguishedName
                Enabled = $_.Enabled
                OperatingSystem = $_.OperatingSystem
                OperatingSystemVersion = $_.OperatingSystemVersion
                LastLogonDate = $_.LastLogonDate
                PasswordLastSet = $_.PasswordLastSet
                WhenCreated = $_.whenCreated
                IsDomainController = $isDC
                TrustedForDelegation = $_.TrustedForDelegation
                IsStale = $isStale
            }
        }

        Write-Host "[+] Collected $($computers.Count) computers" -ForegroundColor Green
        return $computers
    } catch {
        Write-Host "[!] Error collecting computers: $_" -ForegroundColor Red
        return @()
    }
}

function Get-AllADGroups {
    Write-Host "\`n[*] Collecting Active Directory Groups..." -ForegroundColor Green
    try {
        $groups = Get-ADGroup -Filter * -Properties Members, Description | ForEach-Object {
            $memberCount = if ($_.Members) { $_.Members.Count } else { 0 }

            $privilegedGroups = @(
                "Domain Admins", "Enterprise Admins", "Schema Admins", "Administrators",
                "Admins. del dominio", "Administradores de empresas", "Administradores de esquema", "Administradores"
            )
            $isPrivileged = $privilegedGroups -contains $_.Name

            $privilegeLevel = $null
            if ($_.Name -in @("Domain Admins", "Enterprise Admins", "Schema Admins", "Administrators", "Admins. del dominio", "Administradores de empresas", "Administradores de esquema", "Administradores")) {
                $privilegeLevel = "TIER0"
            } elseif ($_.Name -in @("Account Operators", "Backup Operators", "Server Operators", "Operadores de cuentas", "Operadores de copia de seguridad", "Operadores de servidores")) {
                $privilegeLevel = "TIER1"
            }

            @{
                Name = $_.Name
                DistinguishedName = $_.DistinguishedName
                GroupCategory = $_.GroupCategory.ToString()
                GroupScope = $_.GroupScope.ToString()
                Description = $_.Description
                MemberCount = $memberCount
                Members = @($_.Members)
                IsPrivileged = $isPrivileged
                PrivilegeLevel = $privilegeLevel
            }
        }

        Write-Host "[+] Collected $($groups.Count) groups" -ForegroundColor Green
        return $groups
    } catch {
        Write-Host "[!] Error collecting groups: $_" -ForegroundColor Red
        return @()
    }
}

function Get-PasswordPolicies {
    Write-Host "\`n[*] Collecting Password Policies..." -ForegroundColor Green
    try {
        $defaultPolicy = Get-ADDefaultDomainPasswordPolicy

        $policyInfo = @{
            ComplexityEnabled = $defaultPolicy.ComplexityEnabled
            LockoutDuration = $defaultPolicy.LockoutDuration.TotalMinutes
            LockoutObservationWindow = $defaultPolicy.LockoutObservationWindow.TotalMinutes
            LockoutThreshold = $defaultPolicy.LockoutThreshold
            MaxPasswordAge = $defaultPolicy.MaxPasswordAge.Days
            MinPasswordAge = $defaultPolicy.MinPasswordAge.Days
            MinPasswordLength = $defaultPolicy.MinPasswordLength
            PasswordHistoryCount = $defaultPolicy.PasswordHistoryCount
            ReversibleEncryptionEnabled = $defaultPolicy.ReversibleEncryptionEnabled
        }

        try {
            $fgpp = Get-ADFineGrainedPasswordPolicy -Filter * | ForEach-Object {
                @{
                    Name = $_.Name
                    Precedence = $_.Precedence
                    ComplexityEnabled = $_.ComplexityEnabled
                    LockoutThreshold = $_.LockoutThreshold
                    MinPasswordLength = $_.MinPasswordLength
                    PasswordHistoryCount = $_.PasswordHistoryCount
                    AppliesTo = @($_.AppliesTo)
                }
            }
            $policyInfo.FineGrainedPolicies = $fgpp
        } catch {
            $policyInfo.FineGrainedPolicies = @()
        }

        Write-Host "[+] Password policies collected" -ForegroundColor Green
        return $policyInfo
    } catch {
        Write-Host "[!] Error collecting password policies: $_" -ForegroundColor Red
        return $null
    }
}

function Get-GPOInventory {
    Write-Host "\`n[*] Collecting Group Policy Objects..." -ForegroundColor Green
    
    # Fix encoding for console output
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

    try {
        if ($gpModuleAvailable) {
            # 1. Pre-fetch GPO Links from OUs (Much faster/reliable than Get-GPOReport per GPO)
            Write-Host "[*] Mapping GPO links from OUs..." -ForegroundColor Cyan
            $gpoLinksMap = @{}
            
            # Get Domain Links
            $domain = Get-ADDomain
            if ($domain.LinkedGroupPolicyObjects) {
                foreach ($link in $domain.LinkedGroupPolicyObjects) {
                    # Format: cn={GUID},cn=policies,...
                    if ($link -match "cn={([^}]+)}") {
                        $guid = $matches[1]
                        if (-not $gpoLinksMap.ContainsKey($guid)) { $gpoLinksMap[$guid] = @() }
                        $gpoLinksMap[$guid] += "Domain: $($domain.Name)"
                    }
                }
            }

            # Get OU Links
            $ous = Get-ADOrganizationalUnit -Filter * -Properties LinkedGroupPolicyObjects
            foreach ($ou in $ous) {
                if ($ou.LinkedGroupPolicyObjects) {
                    foreach ($link in $ou.LinkedGroupPolicyObjects) {
                        if ($link -match "cn={([^}]+)}") {
                            $guid = $matches[1]
                            if (-not $gpoLinksMap.ContainsKey($guid)) { $gpoLinksMap[$guid] = @() }
                            $gpoLinksMap[$guid] += "OU: $($ou.Name)"
                        }
                    }
                }
            }
            
            Write-Host "[*] Found links for $($gpoLinksMap.Count) GPOs" -ForegroundColor Cyan

            # 2. Get GPOs
            $gpos = Get-GPO -All | ForEach-Object {
                $id = $_.Id.ToString()
                
                # Get links from our pre-calculated map
                $linkInfo = @()
                if ($gpoLinksMap.ContainsKey($id)) {
                    foreach ($linkName in $gpoLinksMap[$id]) {
                        $linkInfo += @{
                            SOMPath = $linkName
                            SOMName = $linkName
                            Enabled = $true # Assumed true from linkage
                            NoOverride = $false
                        }
                    }
                }

                # Get permissions (Keep this as is, or optimize if needed)
                $permissions = @()
                try {
                    $perms = Get-GPPermission -Guid $_.Id -All -ErrorAction SilentlyContinue
                    foreach ($perm in $perms) {
                        $permissions += @{
                            Trustee = $perm.Trustee.Name
                            Permission = $perm.Permission.ToString()
                        }
                    }
                } catch {}

                @{
                    DisplayName = $_.DisplayName
                    GpoId = $_.Id.ToString()
                    GpoStatus = $_.GpoStatus.ToString()
                    CreationTime = if ($_.CreationTime) { $_.CreationTime.ToString("yyyy-MM-ddTHH:mm:ss") } else { $null }
                    ModificationTime = if ($_.ModificationTime) { $_.ModificationTime.ToString("yyyy-MM-ddTHH:mm:ss") } else { $null }
                    Owner = $_.Owner
                    Description = $_.Description
                    UserVersionDS = $_.User.DSVersion
                    UserVersionSysvol = $_.User.SysvolVersion
                    ComputerVersionDS = $_.Computer.DSVersion
                    ComputerVersionSysvol = $_.Computer.SysvolVersion
                    Links = $linkInfo
                    Permissions = $permissions
                    WmiFilterApplied = ($_.WmiFilter.Name -ne $null)
                    WmiFilterName = if ($_.WmiFilter.Name) { $_.WmiFilter.Name } else { "None" }
                }
            }
            return $gpos
        } else {
            # Use AD queries as fallback
            $domain = Get-ADDomain
            $gpoContainer = "CN=Policies,CN=System," + $domain.DistinguishedName
            $gpos = Get-ADObject -Filter {objectClass -eq "groupPolicyContainer"} -SearchBase $gpoContainer -Properties displayName, gPCFileSysPath, whenCreated, whenChanged | ForEach-Object {
                @{
                    DisplayName = $_.displayName
                    DN = $_.DistinguishedName
                    CreationTime = $_.whenCreated
                    ModificationTime = $_.whenChanged
                    Path = $_.gPCFileSysPath
                    Note = "Limited information - GroupPolicy module not available"
                }
            }
        }

        Write-Host "[+] Collected $($gpos.Count) GPOs with detailed information" -ForegroundColor Green
        return $gpos
    } catch {
        Write-Host "[!] Error collecting GPOs: $_" -ForegroundColor Red
        return @()
    }
}

function Get-KerberosConfiguration {
    Write-Host "\`n[*] Collecting Kerberos Configuration..." -ForegroundColor Green
    try {
        $krbtgt = Get-ADUser krbtgt -Properties PasswordLastSet

        $kerberosInfo = @{
            KRBTGTPasswordLastSet = $krbtgt.PasswordLastSet
            KRBTGTPasswordAge = ((Get-Date) - $krbtgt.PasswordLastSet).Days
        }

        Write-Host "[+] Kerberos configuration collected" -ForegroundColor Green
        return $kerberosInfo
    } catch {
        Write-Host "[!] Error collecting Kerberos config: $_" -ForegroundColor Red
        return $null
    }
}

function Get-LAPSStatus {
    Write-Host "\`n[*] Checking LAPS Deployment..." -ForegroundColor Green
    try {
        $lapsSchema = Get-ADObject -SearchBase (Get-ADRootDSE).schemaNamingContext -Filter "name -eq 'ms-Mcs-AdmPwd'" -ErrorAction SilentlyContinue

        $lapsInfo = @{
            SchemaExtended = ($lapsSchema -ne $null)
            GPOConfigured = $false
            ComputersWithLAPS = 0
        }

        if ($lapsSchema) {
            $computersWithLAPS = (Get-ADComputer -Filter * -Properties ms-Mcs-AdmPwd | Where-Object { $_.'ms-Mcs-AdmPwd' -ne $null }).Count
            $lapsInfo.ComputersWithLAPS = $computersWithLAPS
        }

        Write-Host "[+] LAPS status collected" -ForegroundColor Green
        return $lapsInfo
    } catch {
        Write-Host "[!] Error checking LAPS: $_" -ForegroundColor Red
    }
}

function Get-ADCSInventory {
    Write-Host "\`n[*] Collecting ADCS Inventory..." -ForegroundColor Green
    try {
        $configNC = (Get-ADRootDSE).configurationNamingContext
        $pkiPath = "CN=Public Key Services,CN=Services,$configNC"
        
        # 1. Enterprise CAs
        $cas = Get-ADObject -SearchBase "CN=Enrollment Services,$pkiPath" -Filter {objectClass -eq "pKIEnrollmentService"} -Properties dNSHostName
        
        # 2. Certificate Templates (Basic Check for ESC1 candidates)
        # CT_FLAG_ENROLLEE_SUPPLIES_SUBJECT = 0x00000001 in msPKI-Certificate-Name-Flag
        $templates = Get-ADObject -SearchBase "CN=Certificate Templates,$pkiPath" -Filter {objectClass -eq "pKICertificateTemplate"} -Properties displayName, msPKI-Certificate-Name-Flag, nTSecurityDescriptor
        
        $vulnerable = @()
        foreach ($tpl in $templates) {
            if ($tpl.'msPKI-Certificate-Name-Flag' -band 1) {
                $vulnerable += @{
                    Name = $tpl.Name
                    DisplayName = $tpl.DisplayName
                    Reason = "EnrolleeSuppliesSubject flag is set (Potential ESC1)"
                }
            }
        }
        
        return @{
            CertificationAuthorities = $cas | Select-Object Name, dNSHostName
            TemplatesCount = $templates.Count
            PotentiallyVulnerableTemplates = $vulnerable
        }
    } catch {
        Write-Host "[!] ADCS not found or error: $_" -ForegroundColor Yellow
        return $null
    }
}

function Get-ProtocolSecurity {
    Write-Host "\`n[*] Checking Protocol Security..." -ForegroundColor Green
    $results = @{}
    
    # LDAP Signing
    try {
        $reg = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\NTDS\Parameters" -Name "LDAPServerIntegrity" -ErrorAction SilentlyContinue
        $results.LDAPSigning = if ($reg.LDAPServerIntegrity -eq 2) { "Enforced" } else { "Not Enforced (Value: $($reg.LDAPServerIntegrity))" }
    } catch { $results.LDAPSigning = "Unknown" }
    
    # LDAP Channel Binding
    try {
        $reg = Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Services\NTDS\Parameters" -Name "LdapEnforceChannelBinding" -ErrorAction SilentlyContinue
        $results.LDAPChannelBinding = if ($reg.LdapEnforceChannelBinding -eq 2) { "Enforced" } else { "Not Enforced (Value: $($reg.LdapEnforceChannelBinding))" }
    } catch { $results.LDAPChannelBinding = "Unknown" }

    return $results
}

function Get-ReplicationStatus {
    Write-Host "\`n[*] Analyzing AD Replication Status & Topology..." -ForegroundColor Green
    $replInfo = @{
        Partners = @()
        Connections = @()
        Errors = @()
    }

    try {
        # 1. Replication Partners (Status)
        try {
            $replData = Get-ADReplicationPartnerMetadata -Target $env:COMPUTERNAME -PartnerType Inbound -ErrorAction SilentlyContinue
            foreach ($repl in $replData) {
                $replInfo.Partners += @{
                    Partner = $repl.Partner
                    LastSuccess = $repl.LastReplicationSuccess
                    LastResult = $repl.LastReplicationResult
                    Failures = $repl.ConsecutiveReplicationFailures
                }
            }
        } catch {
            Write-Host "[!] Error getting replication metadata: $_" -ForegroundColor Yellow
        }

        # 2. Replication Connections (Topology & Lingering Objects)
        try {
            $connections = Get-ADReplicationConnection -Filter *
            foreach ($conn in $connections) {
                $isDeleted = $conn.ReplicateFromDirectoryServer -like '*\\0ADEL*'
                $replInfo.Connections += @{
                    Name = $conn.Name
                    From = $conn.ReplicateFromDirectoryServer
                    To = $conn.ReplicateToDirectoryServer
                    AutoGenerated = $conn.AutoGenerated
                    IsDeleted = $isDeleted
                }
            }
            Write-Host "[*] Analyzed $($connections.Count) replication connections" -ForegroundColor Cyan
        } catch {
             Write-Host "[!] Error getting replication connections: $_" -ForegroundColor Yellow
        }

        return $replInfo
    } catch {
        Write-Host "[!] Critical error in replication analysis: $_" -ForegroundColor Red
        return $null
    }
}

function Get-DCSyncPermissions {
    Write-Host "\`n[*] Analyzing DCSync Attack Permissions (CRITICAL)..." -ForegroundColor Green
    try {
        $domainDN = (Get-ADDomain).DistinguishedName
        $acl = Get-Acl "AD:$domainDN"

        $dangerousPermissions = @()

        foreach ($access in $acl.Access) {
            if ($access.ActiveDirectoryRights -like "*Replication*" -and
                ($access.ObjectType -eq "1131f6ad-9c07-11d1-f79f-00c04fc2dcd2" -or
                 $access.ObjectType -eq "1131f6aa-9c07-11d1-f79f-00c04fc2dcd2")) {

                $dangerousPermissions += @{
                    IdentityReference = $access.IdentityReference.ToString()
                    ActiveDirectoryRights = $access.ActiveDirectoryRights.ToString()
                    AccessControlType = $access.AccessControlType.ToString()
                    ObjectType = $access.ObjectType.ToString()
                    IsInherited = $access.IsInherited
                    RiskLevel = "CRITICAL"
                    AttackTechnique = "DCSync (MITRE T1003.006)"
                }
            }
        }

        Write-Host "[+] Found $($dangerousPermissions.Count) potentially dangerous replication permissions" -ForegroundColor $(if ($dangerousPermissions.Count -gt 0) { "Red" } else { "Green" })
        return $dangerousPermissions
    } catch {
        Write-Host "[!] Error analyzing DCSync permissions: $_" -ForegroundColor Red
        return @()
    }
}

function Get-RC4EncryptionTypes {
    Write-Host "\`n[*] Detecting RC4 Kerberos Encryption (Weak Crypto)..." -ForegroundColor Green
    try {
        $usersWithRC4 = @()

        $kerberoastableUsers = Get-ADUser -Filter {ServicePrincipalName -like "*"} -Properties \`
            ServicePrincipalName, "msDS-SupportedEncryptionTypes", PasswordLastSet, Enabled

        foreach ($user in $kerberoastableUsers) {
            $encTypes = $user."msDS-SupportedEncryptionTypes"
            $usesRC4 = ($null -eq $encTypes) -or (($encTypes -band 4) -ne 0)

            if ($usesRC4) {
                $usersWithRC4 += @{
                    SamAccountName = $user.SamAccountName
                    DistinguishedName = $user.DistinguishedName
                    Enabled = $user.Enabled
                    PasswordLastSet = $user.PasswordLastSet
                    EncryptionTypes = $encTypes
                    UsesRC4 = $true
                    ServicePrincipalNames = @($user.ServicePrincipalName)
                    RiskLevel = "HIGH"
                    Vulnerability = "RC4_HMAC vulnerable to offline cracking"
                }
            }
        }

        Write-Host "[+] Found $($usersWithRC4.Count) users with RC4 encryption enabled" -ForegroundColor $(if ($usersWithRC4.Count -gt 0) { "Yellow" } else { "Green" })
        return $usersWithRC4
    } catch {
        Write-Host "[!] Error detecting RC4 encryption: $_" -ForegroundColor Red
        return @()
    }
}

function Get-OldPasswords {
    Write-Host "\`n[*] Identifying Users with Old Passwords (>365 days)..." -ForegroundColor Green
    try {
        $oldPasswordUsers = @()

        $users = Get-ADUser -Filter {Enabled -eq $true} -Properties PasswordLastSet, PasswordNeverExpires

        foreach ($user in $users) {
            if ($user.PasswordLastSet) {
                $passwordAge = ((Get-Date) - $user.PasswordLastSet).Days

                if ($passwordAge -gt 365) {
                    $oldPasswordUsers += @{
                        SamAccountName = $user.SamAccountName
                        DistinguishedName = $user.DistinguishedName
                        PasswordLastSet = $user.PasswordLastSet
                        PasswordAgeDays = $passwordAge
                        PasswordNeverExpires = $user.PasswordNeverExpires
                        RiskLevel = if ($passwordAge -gt 730) { "HIGH" } elseif ($passwordAge -gt 365) { "MEDIUM" } else { "LOW" }
                    }
                }
            }
        }

        Write-Host "[+] Found $($oldPasswordUsers.Count) users with passwords older than 365 days" -ForegroundColor $(if ($oldPasswordUsers.Count -gt 0) { "Yellow" } else { "Green" })
        return $oldPasswordUsers
    } catch {
        Write-Host "[!] Error identifying old passwords: $_" -ForegroundColor Red
        return @()
    }
}

function Get-RecycleBinStatus {
    Write-Host "\`n[*] Checking AD Recycle Bin Status..." -ForegroundColor Green
    try {
        $recycleBinInfo = @{
            FeatureName = "Recycle Bin Feature"
            IsEnabled = $false
            EnabledScopes = @()
            FeatureGUID = "766ddcd8-acd0-445e-f3b9-a7f9b6744f2a"
            RiskLevel = "HIGH"
            Method = "AD Module"
        }

        try {
            $recycleBin = Get-ADOptionalFeature -Filter {name -like "Recycle Bin Feature"} -Properties * -ErrorAction Stop
            
            $recycleBinInfo.IsEnabled = ($recycleBin.EnabledScopes.Count -gt 0)
            $recycleBinInfo.EnabledScopes = @($recycleBin.EnabledScopes)
            $recycleBinInfo.FeatureGUID = $recycleBin.FeatureGUID.ToString()
            $recycleBinInfo.RiskLevel = if ($recycleBin.EnabledScopes.Count -eq 0) { "HIGH" } else { "LOW" }
        } catch {
            Write-Host "[*] Get-ADOptionalFeature failed. Attempting fallback check..." -ForegroundColor Yellow
            $recycleBinInfo.Method = "AD Attribute Check"
            
            # Fallback: Check msDS-EnabledFeature on the Partitions container
            try {
                $configNC = (Get-ADRootDSE).configurationNamingContext
                $partitionsContainer = "CN=Partitions,$configNC"
                $partitions = Get-ADObject -Identity $partitionsContainer -Properties "msDS-EnabledFeature"
                
                if ($partitions."msDS-EnabledFeature" -contains "CN=766ddcd8-acd0-445e-f3b9-a7f9b6744f2a,CN=Optional Features,CN=Directory Service,CN=Windows NT,CN=Services,$configNC") {
                    $recycleBinInfo.IsEnabled = $true
                    $recycleBinInfo.RiskLevel = "LOW"
                    $recycleBinInfo.EnabledScopes = @("Domain (Inferred)")
                }
            } catch {
                Write-Host "[!] Fallback check failed: $_" -ForegroundColor Red
            }
        }

        Write-Host "[+] AD Recycle Bin status: $(if ($recycleBinInfo.IsEnabled) { 'ENABLED' } else { 'DISABLED - CRITICAL' })" -ForegroundColor $(if ($recycleBinInfo.IsEnabled) { "Green" } else { "Red" })
        return $recycleBinInfo
    } catch {
        Write-Host "[!] Error checking Recycle Bin status: $_" -ForegroundColor Red
        return @{
            IsEnabled = $false
            RiskLevel = "UNKNOWN"
        }
    }
}

function Get-AdminCountObjects {
    Write-Host "\`n[*] Collecting Objects with AdminCount=1 (Protected Accounts)..." -ForegroundColor Green
    try {
        $adminCountObjects = @()

        $objects = Get-ADObject -LDAPFilter "(adminCount=1)" -Properties adminCount, whenCreated, whenChanged, objectClass

        foreach ($obj in $objects) {
            $adminCountObjects += @{
                Name = $obj.Name
                DistinguishedName = $obj.DistinguishedName
                ObjectClass = $obj.objectClass
                WhenCreated = $obj.whenCreated
                WhenChanged = $obj.whenChanged
                AdminCount = $obj.adminCount
            }
        }

        Write-Host "[+] Found $($adminCountObjects.Count) objects with AdminCount=1" -ForegroundColor Green
        return $adminCountObjects
    } catch {
        Write-Host "[!] Error collecting AdminCount objects: $_" -ForegroundColor Red
        return @()
    }
}

function Get-SMBv1Status {
    Write-Host "\`n[*] Checking SMBv1 Protocol Status..." -ForegroundColor Green
    try {
        $smbv1Status = @{
            IsEnabled = $false
            DomainControllers = @()
        }

        $dcs = Get-ADDomainController -Filter *
        foreach ($dc in $dcs) {
            try {
                $isSMBv1Enabled = $false
                $checkMethod = "Unknown"

                # Method 1: Check Windows Feature (ServerManager)
                try {
                    $smb = Get-WindowsFeature -Name FS-SMB1 -ComputerName $dc.HostName -ErrorAction Stop
                    if ($smb -and $smb.Installed) {
                        $isSMBv1Enabled = $true
                        $checkMethod = "Windows Feature"
                    }
                } catch {
                    # Method 2: Registry Check (Fallback)
                    try {
                        $regKey = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                            Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" -Name "SMB1" -ErrorAction SilentlyContinue
                        } -ErrorAction Stop
                        
                        if ($regKey) {
                            if ($regKey.SMB1 -eq 1) {
                                $isSMBv1Enabled = $true
                            }
                            $checkMethod = "Registry"
                        } else {
                            # If key doesn't exist, default depends on OS, but usually implies enabled on older, disabled on newer.
                            # We'll assume disabled if not explicitly enabled in registry for newer OS, but let's check OS version if possible.
                            # For safety, if we can't confirm it's disabled, we might flag it? No, let's stick to positive confirmation.
                        }
                    } catch {}
                }

                if ($isSMBv1Enabled) {
                    $smbv1Status.IsEnabled = $true
                    $smbv1Status.DomainControllers += @{
                        Name = $dc.Name
                        HostName = $dc.HostName
                        SMBv1Installed = $true
                        Method = $checkMethod
                    }
                }
            } catch {
                Write-Host "[!] Could not check SMBv1 on $($dc.Name)" -ForegroundColor Yellow
            }
        }

        Write-Host "[+] SMBv1 status collected" -ForegroundColor Green
        return $smbv1Status
    } catch {
        Write-Host "[!] Error checking SMBv1 status: $_" -ForegroundColor Red
        return $null
    }
}

function Get-ProtectedUsersGroup {
    Write-Host "\`n[*] Checking Protected Users Group..." -ForegroundColor Green
    try {
        $protectedGroup = Get-ADGroup "Protected Users" -Properties Members, WhenCreated

        $protectedUsersInfo = @{
            Exists = $true
            MemberCount = $protectedGroup.Members.Count
            Members = @()
            WhenCreated = $protectedGroup.WhenCreated
        }

        foreach ($member in $protectedGroup.Members) {
            $user = Get-ADUser $member -Properties DisplayName, Enabled, LastLogonDate -ErrorAction SilentlyContinue
            if ($user) {
                $protectedUsersInfo.Members += @{
                    SAMAccountName = $user.SAMAccountName
                    DisplayName = $user.DisplayName
                    Enabled = $user.Enabled
                    LastLogonDate = $user.LastLogonDate
                }
            }
        }

        Write-Host "[+] Protected Users group analyzed: $($protectedUsersInfo.MemberCount) members" -ForegroundColor Green
        return $protectedUsersInfo
    } catch {
        Write-Host "[!] Error getting Protected Users group: $_" -ForegroundColor Red
        return @{ Exists = $false; MemberCount = 0 }
    }
}

function Get-UnconstrainedDelegation {
    Write-Host "\`n[*] Checking for Unconstrained Delegation..." -ForegroundColor Green
    try {
        $unconstrainedComputers = Get-ADComputer -Filter {
            (TrustedForDelegation -eq $true) -and (PrimaryGroupID -ne 516) -and (PrimaryGroupID -ne 521)
        } -Properties TrustedForDelegation, ServicePrincipalNames, OperatingSystem, LastLogonDate

        $unconstrainedUsers = Get-ADUser -Filter {
            TrustedForDelegation -eq $true
        } -Properties TrustedForDelegation, ServicePrincipalNames, LastLogonDate

        $delegationInfo = @{
            ComputersCount = $unconstrainedComputers.Count
            UsersCount = $unconstrainedUsers.Count
            Computers = @()
            Users = @()
        }

        foreach ($computer in $unconstrainedComputers) {
            $delegationInfo.Computers += @{
                Name = $computer.Name
                DNSHostName = $computer.DNSHostName
                OperatingSystem = $computer.OperatingSystem
                SPNs = @($computer.ServicePrincipalNames)
                LastLogonDate = $computer.LastLogonDate
            }
        }

        foreach ($user in $unconstrainedUsers) {
            $delegationInfo.Users += @{
                SAMAccountName = $user.SAMAccountName
                DisplayName = $user.DisplayName
                SPNs = @($user.ServicePrincipalNames)
                LastLogonDate = $user.LastLogonDate
            }
        }

        Write-Host "[+] Unconstrained Delegation: $($delegationInfo.ComputersCount) computers, $($delegationInfo.UsersCount) users" -ForegroundColor Green
        return $delegationInfo
    } catch {
        Write-Host "[!] Error checking unconstrained delegation: $_" -ForegroundColor Red
        return $null
    }
}

function Get-AdminSDHolderProtection {
    Write-Host "\`n[*] Checking AdminSDHolder Protection..." -ForegroundColor Green
    try {
        $protectedObjects = @{
            Users = @()
            Groups = @()
            Total = 0
        }

        $usersWithAdminCount = Get-ADUser -Filter {adminCount -eq 1} -Properties adminCount, whenChanged, LastLogonDate
        $groupsWithAdminCount = Get-ADGroup -Filter {adminCount -eq 1} -Properties adminCount, whenChanged

        foreach ($user in $usersWithAdminCount) {
            $protectedObjects.Users += @{
                SAMAccountName = $user.SAMAccountName
                DistinguishedName = $user.DistinguishedName
                WhenChanged = $user.whenChanged
                LastLogonDate = $user.LastLogonDate
            }
        }

        foreach ($group in $groupsWithAdminCount) {
            $protectedObjects.Groups += @{
                Name = $group.Name
                DistinguishedName = $group.DistinguishedName
                WhenChanged = $group.whenChanged
            }
        }

        $protectedObjects.Total = $protectedObjects.Users.Count + $protectedObjects.Groups.Count

        Write-Host "[+] AdminSDHolder protected objects: $($protectedObjects.Total)" -ForegroundColor Green
        return $protectedObjects
    } catch {
        Write-Host "[!] Error checking AdminSDHolder: $_" -ForegroundColor Red
        return $null
    }
}

function Get-NTLMSettings {
    Write-Host "\`n[*] Checking NTLM Authentication Settings..." -ForegroundColor Green
    try {
        $ntlmSettings = @{
            DomainControllers = @()
        }

        $dcs = Get-ADDomainController -Filter *

        foreach ($dc in $dcs) {
            try {
                $lmCompatLevel = $null

                try {
                    $reg = [Microsoft.Win32.RegistryKey]::OpenRemoteBaseKey('LocalMachine', $dc.HostName)
                    $regKey = $reg.OpenSubKey("SYSTEM\\CurrentControlSet\\Control\\Lsa")
                    $lmCompatLevel = $regKey.GetValue("LmCompatibilityLevel")
                    $regKey.Close()
                    $reg.Close()
                } catch {
                    $lmCompatLevel = "Unable to query"
                }

                $ntlmSettings.DomainControllers += @{
                    Name = $dc.Name
                    HostName = $dc.HostName
                    LMCompatibilityLevel = $lmCompatLevel
                }
            } catch {
                Write-Host "[!] Could not check NTLM settings on $($dc.Name)" -ForegroundColor Yellow
            }
        }

        Write-Host "[+] NTLM settings collected from $($ntlmSettings.DomainControllers.Count) DCs" -ForegroundColor Green
        return $ntlmSettings
    } catch {
        Write-Host "[!] Error checking NTLM settings: $_" -ForegroundColor Red
        return $null
    }
}

function Get-BackupStatus {
    Write-Host "\`n[*] Checking Domain Backup Status..." -ForegroundColor Green
    try {
        $backupInfo = @{
            DomainControllers = @()
        }

        $dcs = Get-ADDomainController -Filter *

        foreach ($dc in $dcs) {
            try {
                $backupInfo.DomainControllers += @{
                    Name = $dc.Name
                    HostName = $dc.HostName
                    LastBackup = "Manual verification required"
                }
            } catch {
                Write-Host "[!] Could not check backup status on $($dc.Name)" -ForegroundColor Yellow
            }
        }

        Write-Host "[+] Backup status information collected" -ForegroundColor Green
        return $backupInfo
    } catch {
        Write-Host "[!] Error checking backup status: $_" -ForegroundColor Red
        return $null
    }
}

function Get-GPOPermissions {
    Write-Host "\`n[*] Analyzing GPO Permissions..." -ForegroundColor Green
    try {
        if ($gpModuleAvailable) {
            # Use GroupPolicy module if available
            $gpos = Get-GPO -All
            $gpoPermissions = @{
                TotalGPOs = $gpos.Count
                GPOsWithIssues = @()
                AuthenticatedUsersHasPermissions = 0
                Method = "GroupPolicy Module"
            }

            foreach ($gpo in $gpos) {
                $perms = Get-GPPermission -Guid $gpo.Id -All

                $issues = @()

                foreach ($perm in $perms) {
                    if ($perm.Trustee.Name -eq "Authenticated Users" -and $perm.Permission -eq "GpoEdit") {
                        $issues += "Authenticated Users can edit GPO"
                        $gpoPermissions.AuthenticatedUsersHasPermissions++
                    }

                    if ($perm.Trustee.Name -eq "Domain Users" -and ($perm.Permission -eq "GpoEdit" -or $perm.Permission -eq "GpoEditDeleteModifySecurity")) {
                        $issues += "Domain Users have edit permissions"
                    }
                }

                if ($issues.Count -gt 0) {
                    $gpoPermissions.GPOsWithIssues += @{
                        Name = $gpo.DisplayName
                        Id = $gpo.Id
                        Issues = $issues
                    }
                }
            }
        } else {
            # Use AD queries as fallback
            $domain = Get-ADDomain
            $gpoContainer = "CN=Policies,CN=System," + $domain.DistinguishedName
            $gpos = Get-ADObject -Filter {objectClass -eq "groupPolicyContainer"} -SearchBase $gpoContainer -Properties displayName, gPCFileSysPath
            
            $gpoPermissions = @{
                TotalGPOs = $gpos.Count
                GPOList = @()
                Method = "AD Query (Limited)"
                Note = "Install GroupPolicy module for detailed permissions analysis"
            }

            foreach ($gpo in $gpos) {
                $gpoPermissions.GPOList += @{
                    Name = $gpo.displayName
                    DN = $gpo.DistinguishedName
                    Path = $gpo.gPCFileSysPath
                }
            }
        }

        Write-Host "[+] GPO analysis completed using $($gpoPermissions.Method)" -ForegroundColor Green
        return $gpoPermissions
    } catch {
        Write-Host "[!] Error analyzing GPO permissions: $_" -ForegroundColor Red
        return $null
    }
}

function Get-DNSScavengingStatus {
    Write-Host "\`n[*] Checking DNS Scavenging Settings..." -ForegroundColor Green
    try {
        $dnsSettings = @{
            DomainControllers = @()
            ScavengingEnabled = 0
            ScavengingDisabled = 0
            Method = if ($dnsModuleAvailable) { "DNSServer Module" } else { "WMI/Limited" }
        }

        $dcs = Get-ADDomainController -Filter *

        foreach ($dc in $dcs) {
            if ($dc.IsGlobalCatalog) {
                try {
                    $scavengingEnabled = $false
                    $scavengingInterval = 0
                    $checkMethod = "Unknown"

                    if ($dnsModuleAvailable) {
                        $dnsServer = Get-DnsServer -ComputerName $dc.HostName -ErrorAction SilentlyContinue
                        if ($dnsServer) {
                            $scavengingEnabled = $dnsServer.ServerSetting.ScavengingInterval.TotalHours -gt 0
                            $scavengingInterval = $dnsServer.ServerSetting.ScavengingInterval.TotalHours
                            $checkMethod = "DNSServer Module"
                        }
                    } 
                    
                    # Fallback to WMI if module failed or not available
                    if ($checkMethod -eq "Unknown") {
                        try {
                            $wmiServer = Get-WmiObject -Namespace root\MicrosoftDNS -Class MicrosoftDNS_Server -ComputerName $dc.HostName -ErrorAction SilentlyContinue
                            if ($wmiServer) {
                                $scavengingInterval = $wmiServer.ScavengingInterval
                                $scavengingEnabled = $scavengingInterval -gt 0
                                $checkMethod = "WMI"
                            }
                        } catch {}
                    }

                    if ($checkMethod -ne "Unknown") {
                        if ($scavengingEnabled) {
                            $dnsSettings.ScavengingEnabled++
                        } else {
                            $dnsSettings.ScavengingDisabled++
                        }

                        $dnsSettings.DomainControllers += @{
                            Name = $dc.Name
                            HostName = $dc.HostName
                            ScavengingEnabled = $scavengingEnabled
                            ScavengingInterval = $scavengingInterval
                            Method = $checkMethod
                        }
                    } else {
                        $dnsSettings.DomainControllers += @{
                            Name = $dc.Name
                            HostName = $dc.HostName
                            Note = "Could not determine scavenging status (Module/WMI failed)"
                        }
                    }
                } catch {
                    Write-Host "[!] Could not check DNS scavenging on $($dc.Name)" -ForegroundColor Yellow
                }
            }
        }

        Write-Host "[+] DNS scavenging status collected" -ForegroundColor Green
        return $dnsSettings
    } catch {
        Write-Host "[!] Error checking DNS scavenging: $_" -ForegroundColor Red
        return $null
    }
}

function Get-DefaultDomainControllerPolicy {
    Write-Host "\`n[*] Analyzing Default Domain Controllers Policy..." -ForegroundColor Green
    try {
        if ($gpModuleAvailable) {
            $dcPolicyGuid = (Get-GPO -Name "Default Domain Controllers Policy").Id

            $policyReport = @{
                Name = "Default Domain Controllers Policy"
                Id = $dcPolicyGuid
                KeySettings = @{
                    AuditPolicyConfigured = $true
                    UserRightsAssignments = @()
                }
                Method = "GroupPolicy Module"
            }
        } else {
            # Use AD query as fallback
            $domain = Get-ADDomain
            $gpoContainer = "CN=Policies,CN=System," + $domain.DistinguishedName
            $dcPolicy = Get-ADObject -Filter {displayName -eq "Default Domain Controllers Policy"} -SearchBase $gpoContainer -Properties displayName
            
            $policyReport = @{
                Name = "Default Domain Controllers Policy"
                DN = $dcPolicy.DistinguishedName
                Note = "Install GroupPolicy module for detailed policy analysis"
                Method = "AD Query (Limited)"
            }
        }

        Write-Host "[+] Default Domain Controllers Policy analyzed" -ForegroundColor Green
        return $policyReport
    } catch {
        Write-Host "[!] Error analyzing Default DC Policy: $_" -ForegroundColor Red
        return $null
    }
}

function Get-DCHealthDetails {
    Write-Host "\`n[*] Collecting DC Health Details (Patches, Logs, Time Sync, AV)..." -ForegroundColor Green
    try {
        $dcHealthInfo = @{
            DomainControllers = @()
        }

        $dcs = Get-ADDomainController -Filter *

        foreach ($dc in $dcs) {
            try {
                Write-Host "[*] Checking DC: $($dc.Name)" -ForegroundColor Cyan

                # Hotfixes and patches
                $hotfixes = @()
                try {
                    $hotfixes = Get-HotFix -ComputerName $dc.HostName -ErrorAction SilentlyContinue | Select-Object -First 10 -Property HotFixID, Description, InstalledOn
                } catch {}

                # Time configuration
                $timeConfig = $null
                try {
                    $w32tm = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                        w32tm /query /status /verbose
                    } -ErrorAction SilentlyContinue
                    $timeConfig = $w32tm
                } catch {}

                # Event logs - critical errors
                $criticalEvents = @()
                try {
                    $events = Get-WinEvent -ComputerName $dc.HostName -FilterHashtable @{
                        LogName = 'System', 'Application'
                        Level = 1, 2
                        StartTime = (Get-Date).AddDays(-7)
                    } -MaxEvents 20 -ErrorAction SilentlyContinue
                    
                    $criticalEvents = $events | ForEach-Object {
                        @{
                            TimeCreated = $_.TimeCreated
                            Level = $_.LevelDisplayName
                            Message = $_.Message.Substring(0, [Math]::Min(200, $_.Message.Length))
                            Source = $_.ProviderName
                        }
                    }
                } catch {}

                # BitLocker status
                $bitlockerStatus = "Unknown"
                try {
                    # Try modern cmdlet first
                    $bitlocker = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                        Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue | Select-Object ProtectionStatus, EncryptionPercentage
                    } -ErrorAction SilentlyContinue
                    
                    if ($bitlocker) {
                        $bitlockerStatus = @{
                            ProtectionStatus = $bitlocker.ProtectionStatus.ToString()
                            EncryptionPercentage = $bitlocker.EncryptionPercentage
                            Method = "BitLocker Module"
                        }
                    } else {
                        # Fallback to manage-bde
                        $manageBde = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                            manage-bde -status C:
                        } -ErrorAction SilentlyContinue
                        
                        if ($manageBde) {
                            $protectionStatus = if ($manageBde -match "Protection On") { "On" } else { "Off" }
                            $bitlockerStatus = @{
                                ProtectionStatus = $protectionStatus
                                EncryptionPercentage = "Unknown (Legacy)"
                                Method = "manage-bde"
                            }
                        }
                    }
                } catch {}

                # Antivirus status
                $avStatus = "Unknown"
                try {
                    # Try Defender module first
                    $av = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                        Get-MpComputerStatus -ErrorAction SilentlyContinue | Select-Object AntivirusEnabled, RealTimeProtectionEnabled, AntivirusSignatureLastUpdated
                    } -ErrorAction SilentlyContinue
                    
                    if ($av) {
                        $avStatus = @{
                            Enabled = $av.AntivirusEnabled
                            RealTimeEnabled = $av.RealTimeProtectionEnabled
                            SignatureLastUpdated = $av.AntivirusSignatureLastUpdated
                            Method = "Defender Module"
                        }
                    } else {
                        # Fallback to WMI SecurityCenter2 (Client) or Service Check (Server)
                        $avService = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                            Get-Service -Name "WinDefend", "SepMasterService", "McAfeeFramework" -ErrorAction SilentlyContinue | Where-Object {$_.Status -eq "Running"}
                        } -ErrorAction SilentlyContinue
                        
                        if ($avService) {
                             $avStatus = @{
                                Enabled = $true
                                RealTimeEnabled = "Assumed (Service Running)"
                                SignatureLastUpdated = "Unknown"
                                ServiceName = $avService.Name
                                Method = "Service Check"
                            }
                        }
                    }
                } catch {}

                $dcHealthInfo.DomainControllers += @{
                    Name = $dc.Name
                    HostName = $dc.HostName
                    RecentHotfixes = $hotfixes
                    TimeConfiguration = $timeConfig
                    CriticalEvents = $criticalEvents
                    BitLocker = $bitlockerStatus
                    Antivirus = $avStatus
                }

                Write-Host "[+] Health data collected for $($dc.Name)" -ForegroundColor Green
            } catch {
                Write-Host "[!] Could not collect full health data from $($dc.Name): $_" -ForegroundColor Yellow
            }
        }

        Write-Host "[+] DC health details collected from $($dcHealthInfo.DomainControllers.Count) DCs" -ForegroundColor Green
        return $dcHealthInfo
    } catch {
        Write-Host "[!] Error collecting DC health details: $_" -ForegroundColor Red
        return $null
    }
}

function Get-OUStructure {
    Write-Host "\`n[*] Analyzing OU Structure and Design..." -ForegroundColor Green
    try {
        $domain = Get-ADDomain
        $ous = Get-ADOrganizationalUnit -Filter * -Properties Description, ProtectedFromAccidentalDeletion, gPLink, whenCreated, whenChanged

        $ouInfo = @{
            TotalOUs = $ous.Count
            ProtectedCount = 0
            UnprotectedCount = 0
            OUs = @()
        }

        foreach ($ou in $ous) {
            $isProtected = $ou.ProtectedFromAccidentalDeletion
            if ($isProtected) {
                $ouInfo.ProtectedCount++
            } else {
                $ouInfo.UnprotectedCount++
            }

            $linkedGPOs = @()
            if ($ou.gPLink) {
                $linkedGPOs = $ou.gPLink -split '\\[' | Where-Object { $_ -match 'LDAP' } | ForEach-Object {
                    $_.Split(';')[0].Replace('LDAP://CN=', '').Split(',')[0]
                }
            }

            $ouInfo.OUs += @{
                Name = $ou.Name
                DistinguishedName = $ou.DistinguishedName
                Description = $ou.Description
                ProtectedFromDeletion = $isProtected
                LinkedGPOs = $linkedGPOs
                WhenCreated = $ou.whenCreated
                WhenChanged = $ou.whenChanged
            }
        }

        Write-Host "[+] OU structure analyzed: $($ouInfo.TotalOUs) OUs ($($ouInfo.ProtectedCount) protected)" -ForegroundColor Green
        return $ouInfo
    } catch {
        Write-Host "[!] Error analyzing OU structure: $_" -ForegroundColor Red
        return $null
    }
}

function Get-TombstoneLifetime {
    Write-Host "\`n[*] Checking Tombstone Lifetime..." -ForegroundColor Green
    try {
        $configNC = (Get-ADRootDSE).configurationNamingContext
        $directoryService = Get-ADObject "CN=Directory Service,CN=Windows NT,CN=Services,$configNC" -Properties tombstoneLifetime

        $tombstoneInfo = @{
            TombstoneLifetime = $directoryService.tombstoneLifetime
            RecommendedMinimum = 180
            IsCompliant = $directoryService.tombstoneLifetime -ge 180
            RiskLevel = if ($directoryService.tombstoneLifetime -lt 180) { "MEDIUM" } else { "LOW" }
        }

        Write-Host "[+] Tombstone Lifetime: $($tombstoneInfo.TombstoneLifetime) days" -ForegroundColor $(if ($tombstoneInfo.IsCompliant) { "Green" } else { "Yellow" })
        return $tombstoneInfo
    } catch {
        Write-Host "[!] Error checking tombstone lifetime: $_" -ForegroundColor Red
        return $null
    }
}

    function Get-TimeSyncConfiguration {
        Write-Host "\`n[*] Analyzing Time Synchronization(NTP)..." -ForegroundColor Green
        try {
            $timeInfo = @{
                PDCEmulator = ""
                DomainControllers = @()
                Status = "Unknown"
            }

            # Identify PDC Emulator
            $domain = Get-ADDomain
            $pdc = $domain.PDCEmulator
            $timeInfo.PDCEmulator = $pdc

            $dcs = Get-ADDomainController -Filter *

            foreach($dc in $dcs) {
                $dcTime = @{
                    Name = $dc.Name
                    HostName = $dc.HostName
                    IsPDC = ($dc.HostName -eq $pdc) -or ($dc.Name -eq $pdc)
                    Source = "Unknown"
                    Stratum = "Unknown"
                    Type = "Unknown"
                    LastSuccessfulSyncTime = "Unknown"
                    Skew = 0
                }

                try {
                    # Use w32tm /query /status /verbose to get details
                    $w32tmStatus = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                        w32tm /query /status /verbose
                    } -ErrorAction SilentlyContinue

                    if ($w32tmStatus) {
                        # Parse w32tm output
                        if ($w32tmStatus -match "Source: (.*)") { $dcTime.Source = $matches[1].Trim() }
                        if ($w32tmStatus -match "Stratum: (.*)") { $dcTime.Stratum = $matches[1].Trim() }
                        if ($w32tmStatus -match "Last Successful Sync Time: (.*)") { $dcTime.LastSuccessfulSyncTime = $matches[1].Trim() }
                        
                        # Determine Sync Type (NTP vs NT5DS)
                        # Usually indicated in Source or by registry, but Source is best indicator
                        if ($dcTime.Source -match "VM IC Time Sync Provider") {
                            $dcTime.Type = "Virtual Machine Host (Not Recommended for PDC)"
                        } elseif ($dcTime.Source -match "Local CMOS Clock") {
                            $dcTime.Type = "Local CMOS Clock (Not Recommended)"
                        } elseif ($dcTime.Source -match "LOCL") {
                            $dcTime.Type = "Local (Internal)"
                        } elseif ($dcTime.Source -match "Free-running System Clock") {
                            $dcTime.Type = "Free-running (Critical Issue)"
                        } else {
                            $dcTime.Type = "NTP/External"
                        }
                    }

                    # Check registry for specific flags (Type)
                    try {
                        $regType = Invoke-Command -ComputerName $dc.HostName -ScriptBlock {
                            Get-ItemPropertyValue -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" -Name "Type" -ErrorAction SilentlyContinue
                        } -ErrorAction SilentlyContinue

                        if ($regType) {
                            $dcTime.RegistryType = $regType # NT5DS, NTP, NoSync, AllSync
                        }
                    } catch { }

                } catch {
                    $dcTime.Note = "Could not query w32tm on this host"
                }

                $timeInfo.DomainControllers += $dcTime
            }

            Write-Host "[+] Time sync configuration collected from $($timeInfo.DomainControllers.Count) DCs" -ForegroundColor Green
            return $timeInfo
        } catch {
            Write-Host "[!] Error analyzing time sync: $_" -ForegroundColor Red
            return $null
        }
    }

function Get-DNSConfiguration {
    Write-Host "\`n[*] Analyzing DNS Configuration and Security..." -ForegroundColor Green
    try {
        $dnsInfo = @{
            Zones = @()
            Forwarders = @()
            GlobalSettings = @()
            SecurityIssues = @()
            ScavengingStatus = @()
            Method = if($dnsModuleAvailable) { "DNSServer Module" } else { "Limited" }
        }

        $dcs = Get-ADDomainController -Filter * | Where-Object { $_.IsGlobalCatalog }
            
        # Check if we need WMI fallback (if module not available)
        $useWmi = -not $dnsModuleAvailable
        if ($useWmi) {
            Write - Host "[!] DNSServer module not found. Attempting WMI fallback..." - ForegroundColor Yellow
            $dnsInfo.Method = "WMI (Legacy)"
        }

        foreach($dc in $dcs) {
            try {
                Write-Host "[*] Analyzing DNS on $($dc.Name)..." -ForegroundColor Cyan

                if ($useWmi) {
                        # WMI FALLBACK FOR LEGACY SYSTEMS (Server 2008 R2 / No RSAT)
                    try {
                        $wmiZones = Get-WmiObject -Namespace root\MicrosoftDNS -Class MicrosoftDNS_Zone -ComputerName $dc.HostName -ErrorAction SilentlyContinue

                        if ($wmiZones) {
                            foreach($zone in $wmiZones) {
                                    # Map WMI properties to standard structure
                                $zoneType = switch ($zone.ZoneType) {
                                        0 { "Cache" }
                                1 { "Primary" }
                                2 { "Secondary" }
                                3 { "Stub" }
                                4 { "Forwarder" }
                                        default { "Unknown" }
                            }

                            $dnsInfo.Zones += @{
                                DCName = $dc.Name
                                        ZoneName = $zone.Name
                                        ZoneType = $zoneType
                                        IsReverseLookupZone = $zone.Reverse
                                        DynamicUpdate = if($zone.AllowUpdate -eq 2) { "Secure" } elseif($zone.AllowUpdate -eq 1) { "NonsecureAndSecure" } else { "None" }
                            IsDSIntegrated = $zone.DsIntegrated
                            IsAutoCreated = $zone.AutoCreated
                            IsPaused = $zone.Paused
                            IsShutdown = $zone.Shutdown
                            ZoneFile = $zone.DataFile
                            Method = "WMI"
                        }
                    }
                            }
                            
                            # Get Server Settings via WMI
                $wmiServer = Get-WmiObject -Namespace root\MicrosoftDNS -Class MicrosoftDNS_Server -ComputerName $dc.HostName -ErrorAction SilentlyContinue
                if ($wmiServer) {
                    $dnsInfo.GlobalSettings += @{
                        DCName = $dc.Name
                                    RecursionDisabled = $wmiServer.NoRecursion
                                    RoundRobinEnabled = $wmiServer.RoundRobin
                                    SecureResponses = $wmiServer.SecureResponses
                                    Forwarders = @($wmiServer.Forwarders)
                    }
                }
            } catch {
                Write-Host "[!] Could not query DNS via WMI on $($dc.Name): $_" -ForegroundColor Yellow
            }
        } else {
                        # MODERN POWERSHELL (RSAT)
                        # Get DNS Server Settings
            $dnsServer = Get-DnsServer -ComputerName $dc.HostName -ErrorAction SilentlyContinue

            if ($dnsServer) {
                        # Global DNS Server Settings
                $globalSettings = @{
                    DCName = $dc.Name
                            Recursion = $dnsServer.ServerSetting.DisableRecursion
                            RecursionTimeout = $dnsServer.ServerSetting.RecursionTimeout
                            SecureResponses = $dnsServer.ServerSetting.SecureResponses
                            BindSecondaries = $dnsServer.ServerSetting.BindSecondaries
                            RoundRobin = $dnsServer.ServerSetting.RoundRobin
                            LocalNetPriority = $dnsServer.ServerSetting.LocalNetPriority
                            AddressAnswerLimit = $dnsServer.ServerSetting.AddressAnswerLimit
                            AllowUpdate = $dnsServer.ServerSetting.AllowUpdate
                            AutoCacheUpdate = $dnsServer.ServerSetting.AutoCacheUpdate
                            BootMethod = $dnsServer.ServerSetting.BootMethod.ToString()
                            DefaultAgingState = $dnsServer.ServerSetting.DefaultAgingState
                            DefaultNoRefreshInterval = $dnsServer.ServerSetting.DefaultNoRefreshInterval
                            DefaultRefreshInterval = $dnsServer.ServerSetting.DefaultRefreshInterval
                            ScavengingInterval = $dnsServer.ServerSetting.ScavengingInterval
                            EnableDnsSec = $dnsServer.ServerSetting.EnableDnsSec
                            EnableEDnsProbes = $dnsServer.ServerSetting.EnableEDnsProbes
                            EventLogLevel = $dnsServer.ServerSetting.EventLogLevel
                            ListenAddresses = @($dnsServer.ServerSetting.ListenAddresses.IPAddressToString)
                }
                        
                        # Security Checks
                $securityIssues = @()
                        
                        # Check 1: Recursion enabled (potential DNS amplification attacks)
                if (-not $dnsServer.ServerSetting.DisableRecursion) {
                    $securityIssues += "Recursion is ENABLED - Risk of DNS amplification attacks"
                }
                        
                        # Check 2: DNSSEC not enabled
                if (-not $dnsServer.ServerSetting.EnableDnsSec) {
                    $securityIssues += "DNSSEC is DISABLED - Risk of cache poisoning"
                }
                        
                        # Check 3: Scavenging not configured
                if ($dnsServer.ServerSetting.ScavengingInterval -eq 0) {
                    $securityIssues += "DNS Scavenging is DISABLED - Stale records accumulate"
                }
                        
                        # Check 4: Event logging too low
                if ($dnsServer.ServerSetting.EventLogLevel -lt 4) {
                    $securityIssues += "Event logging level too low - Insufficient audit trail"
                }

                $globalSettings.SecurityIssues = $securityIssues
                $dnsInfo.GlobalSettings += $globalSettings
                        
                        # Get DNS zones with detailed security analysis
                $zones = Get-DnsServerZone -ComputerName $dc.HostName -ErrorAction SilentlyContinue

                foreach($zone in $zones) {
                    $zoneIssues = @()
                            
                            # Check zone transfer settings
                    $zoneTransfer = "Unknown"
                    $zoneTransferRisk = "UNKNOWN"

                    try {
                        if ($zone.SecureSecondaries -eq "NoTransfer") {
                            $zoneTransfer = "Disabled"
                            $zoneTransferRisk = "LOW"
                        } elseif ($zone.SecureSecondaries -eq "TransferAnyServer") {
                            $zoneTransfer = "Any Server (INSECURE)"
                            $zoneTransferRisk = "CRITICAL"
                            $zoneIssues += "Zone transfers allowed to ANY server - CRITICAL security risk"
                        } elseif ($zone.SecureSecondaries -eq "TransferToZoneNameServer") {
                            $zoneTransfer = "Only to Name Servers"
                            $zoneTransferRisk = "LOW"
                        } else {
                            $zoneTransfer = "Restricted to specific servers"
                            $zoneTransferRisk = "LOW"
                        }
                    } catch {
                        $zoneTransfer = "Error checking"
                    }
                            
                            # Check dynamic updates
                    $dynamicUpdateRisk = "LOW"
                    if ($zone.DynamicUpdate -eq "NonsecureAndSecure") {
                        $dynamicUpdateRisk = "HIGH"
                        $zoneIssues += "Non-secure dynamic updates allowed - Risk of DNS poisoning"
                    } elseif ($zone.DynamicUpdate -eq "None" -and -not $zone.IsReverseLookupZone) {
                        $dynamicUpdateRisk = "MEDIUM"
                        $zoneIssues += "Dynamic updates disabled - May cause operational issues"
                    }
                            
                            # Check DNSSEC
                    $dnssecStatus = "Not Signed"
                    $dnssecRisk = "HIGH"
                    try {
                        if ($zone.IsSigned) {
                            $dnssecStatus = "Signed"
                            $dnssecRisk = "LOW"
                        } else {
                            $zoneIssues += "Zone not signed with DNSSEC - Vulnerable to spoofing"
                        }
                    } catch { }
                            
                            # Check aging / scavenging
                    $agingEnabled = $zone.Aging
                    if (-not $agingEnabled -and -not $zone.IsReverseLookupZone -and -not $zone.IsAutoCreated) {
                        $zoneIssues += "Aging/Scavenging disabled - Stale records will accumulate"
                    }
                            
                            # Get zone statistics if available
                            $zoneStats = $null
                    try {
                        $zoneStats = Get-DnsServerStatistics -ComputerName $dc.HostName -ZoneName $zone.ZoneName -ErrorAction SilentlyContinue
                    } catch { }

                    $dnsInfo.Zones += @{
                        DCName = $dc.Name
                                ZoneName = $zone.ZoneName
                                ZoneType = $zone.ZoneType.ToString()
                                IsReverseLookupZone = $zone.IsReverseLookupZone
                                DynamicUpdate = $zone.DynamicUpdate.ToString()
                                DynamicUpdateRisk = $dynamicUpdateRisk
                                SecureSecondaries = $zoneTransfer
                                ZoneTransferRisk = $zoneTransferRisk
                                IsDSIntegrated = $zone.IsDsIntegrated
                                IsAutoCreated = $zone.IsAutoCreated
                                IsPaused = $zone.IsPaused
                                IsReadOnly = $zone.IsReadOnly
                                IsShutdown = $zone.IsShutdown
                                IsSigned = $zone.IsSigned
                                DNSSECStatus = $dnssecStatus
                                DNSSECRisk = $dnssecRisk
                                AgingEnabled = $agingEnabled
                                NotifyServers = @($zone.NotifyServers)
                                MasterServers = @($zone.MasterServers.IPAddressToString)
                                SecurityIssues = $zoneIssues
                                ZoneFile = $zone.ZoneFile
                    }
                }

                        # Get forwarders and conditional forwarders
                if ($dnsServer.ServerSetting.Forwarders) {
                    $forwarderInfo = @{
                        DCName = $dc.Name
                                Forwarders = @($dnsServer.ServerSetting.Forwarders.IPAddressToString)
                                ForwardingTimeout = $dnsServer.ServerSetting.ForwardingTimeout
                                IsSlave = $dnsServer.ServerSetting.IsSlave
                    }
                            
                            # Check if using public DNS (potential data leakage)
                    $publicDNS = @("8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1", "208.67.222.222", "208.67.220.220")
                    $usesPublicDNS = $false
                    foreach($fwd in $dnsServer.ServerSetting.Forwarders.IPAddressToString) {
                        if ($publicDNS -contains $fwd) {
                            $usesPublicDNS = $true
                            break
                        }
                    }

                    if ($usesPublicDNS) {
                        $forwarderInfo.SecurityWarning = "Using public DNS forwarders - Potential data leakage risk"
                    }

                    $dnsInfo.Forwarders += $forwarderInfo
                }
                        
                        # Get conditional forwarders
                try {
                    $conditionalForwarders = Get-DnsServerZone -ComputerName $dc.HostName | Where-Object { $_.ZoneType -eq "Forwarder" }
                    if ($conditionalForwarders) {
                        foreach($cf in $conditionalForwarders) {
                            $dnsInfo.Forwarders += @{
                                DCName = $dc.Name
                                        Type = "Conditional"
                                        ZoneName = $cf.ZoneName
                                        MasterServers = @($cf.MasterServers.IPAddressToString)
                            }
                        }
                    }
                } catch { }
                        
                        # Check DNS cache
                try {
                    $cacheStats = Get-DnsServerStatistics -ComputerName $dc.HostName -ErrorAction SilentlyContinue
                    if ($cacheStats) {
                        $dnsInfo.GlobalSettings[-1].CacheStats = @{
                            CacheHits = $cacheStats.CacheHits
                                    CacheMisses = $cacheStats.CacheMisses
                                    CacheFlushes = $cacheStats.CacheFlushes
                        }
                    }
                } catch { }
            }
        }
    } catch {
        Write-Host "[!] Could not query DNS on $($dc.Name): $_" -ForegroundColor Yellow
    }
}

Write-Host "[+] DNS configuration collected: $($dnsInfo.Zones.Count) zones, $($dnsInfo.SecurityIssues.Count) security issues" -ForegroundColor Green
return $dnsInfo
        } catch {
    Write-Host "[!] Error analyzing DNS configuration: $_" -ForegroundColor Red
    return $null
}
    }
function Get-DHCPConfiguration {
    Write-Host "\`n[*] Analyzing DHCP Configuration..." -ForegroundColor Green
    try {
        $dhcpInfo = @{
            AuthorizedServers = @()
                Scopes = @()
                FailoverConfig = @()
                Method = if($dhcpModuleAvailable) { "DHCPServer Module" } else { "Limited" }
        }

            # Check if we need Netsh fallback
        $useNetsh = -not $dhcpModuleAvailable
        if ($useNetsh) {
            Write-Host "[!] DHCPServer module not found. Attempting Netsh fallback..." -ForegroundColor Yellow
            $dhcpInfo.Method = "Netsh (Legacy)"
        }

        if ($useNetsh) {
                # NETSH FALLBACK FOR LEGACY SYSTEMS
            try {
                    # Get authorized servers from AD
                $config = Get-ADObject -Filter 'objectClass -eq "dHCPClass"' -SearchBase "CN=NetServices,CN=Services,CN=Configuration,$((Get-ADRootDSE).rootDomainNamingContext)" -Properties dhcpServers

                if ($config.dhcpServers) {
                    foreach($serverString in $config.dhcpServers) {
                            # Parse server string (format: i.p.a.d.d.r.e.s.s$name)
                        if ($serverString -match "(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})") {
                            $ip = $matches[1]
                            $dhcpInfo.AuthorizedServers += @{
                                IPAddress = $ip
                                    Method = "AD Configuration"
                            }
                                
                                # Try to get scopes via netsh from this server
                            try {
                                $netshOutput = Invoke-Command -ComputerName $ip -ScriptBlock { netsh dhcp server show scope } -ErrorAction SilentlyContinue

                                if ($netshOutput) {
                                    foreach($line in $netshOutput) {
                                        if ($line -match "(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(.+)\s+(Active|Inactive)") {
                                            $dhcpInfo.Scopes += @{
                                                ServerName = $ip
                                                    ScopeId = $matches[1]
                                                    SubnetMask = $matches[2]
                                                    Name = $matches[3].Trim()
                                                    State = $matches[4]
                                                    Method = "Netsh"
                                            }
                                        }
                                    }
                                }
                            } catch {
                                Write-Host "[!] Could not query DHCP via netsh on $ip" -ForegroundColor Yellow
                            }
                        }
                    }
                }
            } catch {
                Write-Host "[!] Error querying AD for DHCP servers: $_" -ForegroundColor Yellow
            }
        } else {
                # MODERN POWERSHELL (RSAT)
                # Get authorized DHCP servers
            try {
                $authorizedServers = Get-DhcpServerInDC -ErrorAction SilentlyContinue
                foreach($server in $authorizedServers) {
                    $dhcpInfo.AuthorizedServers += @{
                        DNSName = $server.DNSName
                            IPAddress = $server.IPAddress.ToString()
                    }

                        # Get scopes from each server
                    try {
                        $scopes = Get-DhcpServerv4Scope -ComputerName $server.DNSName -ErrorAction SilentlyContinue
                        foreach($scope in $scopes) {
                            $scopeStats = Get-DhcpServerv4ScopeStatistics -ComputerName $server.DNSName -ScopeId $scope.ScopeId -ErrorAction SilentlyContinue
                            
                                # Get reservations
                            $reservations = Get-DhcpServerv4Reservation -ComputerName $server.DNSName -ScopeId $scope.ScopeId -ErrorAction SilentlyContinue

                                # Check for security issues
                                $scopeIssues = @()
                                
                                # Check 1: DNS Dynamic Updates credentials
                            try {
                                $dnsCreds = Get-DhcpServerv4DnsSetting -ComputerName $server.DNSName -ScopeId $scope.ScopeId -ErrorAction SilentlyContinue
                                if ($dnsCreds.DynamicUpdate -eq "Always") {
                                    $scopeIssues += "Dynamic DNS updates set to ALWAYS - Potential security risk"
                                }
                            } catch { }

                            $dhcpInfo.Scopes += @{
                                ServerName = $server.DNSName
                                    ScopeId = $scope.ScopeId.ToString()
                                    Name = $scope.Name
                                    SubnetMask = $scope.SubnetMask.ToString()
                                    StartRange = $scope.StartRange.ToString()
                                    EndRange = $scope.EndRange.ToString()
                                    LeaseDuration = $scope.LeaseDuration.ToString()
                                    State = $scope.State.ToString()
                                    PercentageInUse = if($scopeStats) { $scopeStats.PercentageInUse } else { 0 }
                                    AddressesInUse = if($scopeStats) { $scopeStats.AddressesInUse } else { 0 }
                                    AddressesFree = if($scopeStats) { $scopeStats.AddressesFree } else { 0 }
                                    ReservationCount = if($reservations) { $reservations.Count } else { 0 }
                                    SecurityIssues = $scopeIssues
                            }
                        }

                            # Get failover configuration
                        $failovers = Get-DhcpServerv4Failover -ComputerName $server.DNSName -ErrorAction SilentlyContinue
                        foreach($failover in $failovers) {
                            $dhcpInfo.FailoverConfig += @{
                                ServerName = $server.DNSName
                                    Name = $failover.Name
                                    PartnerServer = $failover.PartnerServer
                                    Mode = $failover.Mode.ToString()
                                    State = $failover.State.ToString()
                                    ScopeIds = @($failover.ScopeId)
                            }
                        }
                            
                            # Check Audit Logs
                        try {
                            $auditLog = Get-DhcpServerAuditLog -ComputerName $server.DNSName -ErrorAction SilentlyContinue
                            if (-not $auditLog.Enable) {
                                $dhcpInfo.AuthorizedServers[-1].SecurityWarning = "DHCP Audit Logging is DISABLED"
                            }
                        } catch { }

                    } catch {
                        Write-Host "[!] Could not query scopes from $($server.DNSName)" -ForegroundColor Yellow
                    }
                }
            } catch {
                $dhcpInfo.Note = "DHCP cmdlets not available or no authorized servers found"
            }
        }

        Write-Host "[+] DHCP configuration collected: $($dhcpInfo.AuthorizedServers.Count) servers, $($dhcpInfo.Scopes.Count) scopes" -ForegroundColor Green
        return $dhcpInfo
    } catch {
        Write-Host "[!] Error analyzing DHCP configuration: $_" -ForegroundColor Red
        return $null
    }
}

# =============================================================================
# MAIN DATA COLLECTION
# =============================================================================

    Write-Host "\`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "Starting Data Collection" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan

    # Check for available modules (Global Scope)
    $dnsModuleAvailable = Get-Module -ListAvailable -Name DnsServer
$dhcpModuleAvailable = Get-Module -ListAvailable -Name DhcpServer

if (-not $dnsModuleAvailable) {
    Write-Host "[!] DnsServer module not found. Will use WMI fallback." -ForegroundColor Yellow
}
if (-not $dhcpModuleAvailable) {
    Write-Host "[!] DhcpServer module not found. Will use Netsh fallback." -ForegroundColor Yellow
}

$collectedData = @{
    AssessmentId = $AssessmentId
    DomainName = $DomainName
    CollectionDate = (Get-Date).ToUniversalTime()
    CollectorHostname = $env:COMPUTERNAME
    CollectorUsername = $env:USERNAME
}

# Collect data based on selected modules
${selectedModules.includes('Core') ? `
Write-Host "\`n[MODULE] Running Core Identity Checks..." -ForegroundColor Magenta
$collectedData.DomainInfo = Get-DomainInformation
$collectedData.DomainControllers = Get-DomainControllerInfo
$collectedData.Users = Get-AllADUsers
$collectedData.Computers = Get-AllADComputers
$collectedData.Groups = Get-AllADGroups
$collectedData.PasswordPolicies = Get-PasswordPolicies
$collectedData.RecycleBinStatus = Get-RecycleBinStatus
$collectedData.AdminCountObjects = Get-AdminCountObjects
` : ''}

${selectedModules.includes('Infrastructure') ? `
Write-Host "\`n[MODULE] Running Infrastructure Checks..." -ForegroundColor Magenta
$collectedData.SiteTopology = Get-ADSiteTopology
$collectedData.Trusts = Get-TrustRelationships
$collectedData.DNSConfiguration = Get-DNSConfiguration
$collectedData.DHCPConfiguration = Get-DHCPConfiguration
$collectedData.TimeSyncConfig = Get-TimeSyncConfiguration
$collectedData.DNSScavenging = Get-DNSScavengingStatus
$collectedData.DCHealth = Get-DCHealthDetails
$collectedData.OUStructure = Get-OUStructure
$collectedData.TombstoneLifetime = Get-TombstoneLifetime
` : ''}

${selectedModules.includes('GPO') ? `
Write-Host "\`n[MODULE] Running GPO Analysis..." -ForegroundColor Magenta
$collectedData.GPOs = Get-GPOInventory
$collectedData.GPOPermissions = Get-GPOPermissions
$collectedData.DCPolicy = Get-DefaultDomainControllerPolicy
` : ''}

${selectedModules.includes('Security') ? `
Write-Host "\`n[MODULE] Running Advanced Security Checks..." -ForegroundColor Magenta
$collectedData.KerberosConfig = Get-KerberosConfiguration
$collectedData.LAPS = Get-LAPSStatus
$collectedData.DCSyncPermissions = Get-DCSyncPermissions
$collectedData.RC4EncryptionTypes = Get-RC4EncryptionTypes
$collectedData.OldPasswords = Get-OldPasswords
$collectedData.SMBv1Status = Get-SMBv1Status
$collectedData.ProtectedUsers = Get-ProtectedUsersGroup
$collectedData.UnconstrainedDelegation = Get-UnconstrainedDelegation
$collectedData.AdminSDHolder = Get-AdminSDHolderProtection
$collectedData.NTLMSettings = Get-NTLMSettings
$collectedData.BackupStatus = Get-BackupStatus
` : ''}

${selectedModules.includes('Replication') ? `
Write-Host "\`n[MODULE] Running Replication Health Analysis..." -ForegroundColor Magenta
$collectedData.ReplicationStatus = Get-ReplicationStatus
` : ''}

${selectedModules.includes('ADCS') ? `
Write-Host "\`n[MODULE] Running ADCS & Protocol Security Analysis..." -ForegroundColor Magenta
$collectedData.ADCSInventory = Get-ADCSInventory
$collectedData.ProtocolSecurity = Get-ProtocolSecurity
` : ''}

# =============================================================================
# SEND DATA TO API
# =============================================================================

    Write-Host "\`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "Preparing to send data to Assessment Platform" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan

try {
    Write-Host "[*] Converting data to JSON..." -ForegroundColor Green
    $jsonPayload = $collectedData | ConvertTo-Json -Depth 10 -Compress

    Write-Host "[*] Payload size: $([math]::Round($jsonPayload.Length / 1MB, 2)) MB" -ForegroundColor Green

    # Save data locally before sending
    Write-Host "\`n[*] Saving data locally..." -ForegroundColor Green
    $localPath = "C:\\AD-Assessments"
    
    # Create directory if it doesn't exist
    if (-not (Test-Path $localPath)) {
        try {
            New-Item -Path $localPath -ItemType Directory -Force | Out-Null
            Write-Host "[+] Created directory: $localPath" -ForegroundColor Green
        } catch {
            Write-Host "[!] WARNING: Could not create directory $localPath : $_" -ForegroundColor Yellow
            $localPath = $PSScriptRoot  # Fallback to script directory
        }
    }
    
    # Save JSON file locally
    $localFileName = "AD-Assessment-$DomainName-$AssessmentId-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $localFilePath = Join-Path $localPath $localFileName

    try {
            # Save without BOM (Byte Order Mark) to avoid JSON parsing errors
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($localFilePath, $jsonPayload, $utf8NoBom)

        Write-Host "[+] Data saved locally: $localFilePath" -ForegroundColor Green
        Write-Host "[+] File size: $([math]::Round((Get-Item $localFilePath).Length / 1MB, 2)) MB" -ForegroundColor Green
    } catch {
        Write-Host "[!] WARNING: Could not save local file: $_" -ForegroundColor Yellow
    }

    # Skip API upload in offline mode
    if ($OfflineMode) {
        Write-Host "\`n[*] OFFLINE MODE: Skipping API upload" -ForegroundColor Yellow
        Write-Host "[+] JSON file saved to: $localFilePath" -ForegroundColor Green
            
            # Compress JSON file for easier transport
            Write-Host "\`n[*] Compressing file for transport..." -ForegroundColor Yellow
        $zipPath = $localFilePath -replace '\.json$', '.zip'

        try {
            Compress-Archive -Path $localFilePath -DestinationPath $zipPath -Force
            $zipSizeMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
            $compressionRatio = [math]::Round((1 - ((Get-Item $zipPath).Length / (Get-Item $localFilePath).Length)) * 100, 1)

            Write-Host "[+] File compressed successfully!" -ForegroundColor Green
            Write-Host "[+] Compressed file: $zipPath" -ForegroundColor Green
            Write-Host "[+] Compressed size: $zipSizeMB MB (reduced $compressionRatio%)" -ForegroundColor Green
            Write-Host "\`n[*] INSTRUCTIONS FOR UPLOAD:" -ForegroundColor Cyan
            Write-Host "  1. Transfer the ZIP file to a machine with internet access" -ForegroundColor White
            Write-Host "  2. Go to: https://your-saas-domain.com/assessment/$AssessmentId" -ForegroundColor White
            Write-Host "  3. Upload the ZIP file (no need to unzip)" -ForegroundColor White
            Write-Host "\`n[+] Zip file location: $zipPath" -ForegroundColor Green
        } catch {
            Write-Host "[!] WARNING: Could not compress file: $_" -ForegroundColor Yellow
            Write-Host "[*] You can still upload the JSON file: $localFilePath" -ForegroundColor Yellow
        }
    } else {
        Write-Host "\`n[*] Sending data to API endpoint..." -ForegroundColor Green
        $headers = @{
            "Content-Type" = "application/json"
        }

        $finalPayload = @{
            assessmentId = $AssessmentId
            jsonData = $collectedData
            domainName = $DomainName
        } | ConvertTo-Json -Depth 10 -Compress

        $response = Invoke-RestMethod -Uri $ApiEndpoint -Method POST -Body $finalPayload -Headers $headers -TimeoutSec 300

        Write-Host "[+] SUCCESS! Data successfully sent to Assessment Platform" -ForegroundColor Green
    }

} catch {
    Write-Host "[!] ERROR: $_" -ForegroundColor Red
    Write-Host "[!] Full error: $($_.Exception.Message)" -ForegroundColor Red

    $backupFile = "AD-Assessment-$AssessmentId-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    Write-Host "[*] Saving data to backup file: $backupFile" -ForegroundColor Yellow
        
        # Save without BOM
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($backupFile, $jsonPayload, $utf8NoBom)
        Write-Host "[+] Data saved to: $backupFile" -ForegroundColor Yellow
    } catch {
            # Fallback to Out-File if WriteAllText fails
        $jsonPayload | Out-File -FilePath $backupFile -Encoding UTF8
        Write-Host "[+] Data saved to: $backupFile (with BOM)" -ForegroundColor Yellow
    }

    Write-Host "[*] Please manually upload this file to the Assessment Platform" -ForegroundColor Yellow
}

Write-Host "\`n" + ("=" * 80) -ForegroundColor Cyan
Write-Host "Data Collection Complete" -ForegroundColor Cyan
Write-Host ("=" * 80) -ForegroundColor Cyan
Write-Host ""
`;

        // Create blob and download
        const blob = new Blob([script], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `AD - Assessment - ${domain} -${Date.now()}.ps1`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Script descargado correctamente");
    };

    return (
        <div className="min-h-screen bg-gradient-subtle">
            <Header />

            <main className="container py-8">
                <div className="mb-6">
                    <Link to="/">
                        <Button variant="ghost" size="sm">
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Volver al Dashboard
                        </Button>
                    </Link>
                </div>

                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-8">
                        <Shield className="h-16 w-16 text-primary mx-auto mb-4" />
                        <h1 className="text-4xl font-bold mb-2">Nuevo Assessment</h1>
                        <p className="text-muted-foreground text-lg">
                            Genera el script PowerShell para recolectar información de seguridad
                        </p>
                    </div>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle>Configuración del Assessment</CardTitle>
                            <CardDescription>
                                Ingresa el nombre del dominio para generar el script personalizado
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="domain">Nombre del Dominio</Label>
                                <Input
                                    id="domain"
                                    placeholder="ejemplo: contoso.local"
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    className="text-lg"
                                />
                                <p className="text-sm text-muted-foreground">
                                    Este será el dominio de Active Directory a evaluar
                                </p>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-base">Módulos de Auditoría</Label>
                                <div className="grid gap-3">
                                    {modules.map((module) => (
                                        <div
                                            key={module.id}
                                            className={`flex items-start space-x-3 p-3 border rounded-md transition-all cursor-pointer ${selectedModules.includes(module.id) ? 'bg-primary/5 border-primary/50' : 'hover:bg-accent/50'}`}
                                            onClick={() => toggleModule(module.id)}
                                        >
                                            <div className={`mt-1 h-4 w-4 rounded border flex items-center justify-center ${selectedModules.includes(module.id) ? 'bg-primary border-primary' : 'border-input'}`}>
                                                {selectedModules.includes(module.id) && <div className="h-2 w-2 bg-primary-foreground rounded-full" />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="font-medium leading-none">{module.label}</div>
                                                <p className="text-sm text-muted-foreground">{module.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {!scriptGenerated ? (
                                <Button
                                    onClick={generateScript}
                                    className="w-full bg-gradient-primary"
                                    size="lg"
                                >
                                    <Terminal className="h-5 w-5 mr-2" />
                                    Generar Script PowerShell
                                </Button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-muted p-4 rounded-lg border border-border">
                                        <div className="flex items-start space-x-3">
                                            <Terminal className="h-5 w-5 text-primary mt-0.5" />
                                            <div className="flex-1">
                                                <h3 className="font-semibold mb-1">Script Generado</h3>
                                                <p className="text-sm text-muted-foreground mb-3">
                                                    El script está listo para descargar. Ejecútalo en el controlador de dominio
                                                    con privilegios de Domain Admin.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={downloadScript}
                                        className="w-full"
                                        size="lg"
                                        variant="default"
                                    >
                                        <Download className="h-5 w-5 mr-2" />
                                        Descargar Script PowerShell
                                    </Button>

                                    <div className="bg-severity-info/10 border border-severity-info/30 rounded-lg p-4">
                                        <h4 className="font-semibold mb-2 text-sm">Instrucciones:</h4>
                                        <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
                                            <li>Descarga el script PowerShell</li>
                                            <li>Cópialo al controlador de dominio</li>
                                            <li>Ejecuta PowerShell como administrador</li>
                                            <li>
                                                <strong>Con Internet:</strong> <code className="bg-muted px-1 rounded">.\AD-Assessment-{domain}.ps1</code>
                                            </li>
                                            <li>
                                                <strong>Sin Internet (DC aislado):</strong> <code className="bg-muted px-1 rounded">.\AD-Assessment-{domain}.ps1 -OfflineMode</code>
                                            </li>
                                            <li>Si usaste -OfflineMode: Copia el JSON generado a una PC con internet y súbelo manualmente desde el dashboard</li>
                                        </ol>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default NewAssessment;
