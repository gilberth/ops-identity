# Feature: AD Assessment Creation

## Feature Spec

### User Intent
As an Active Directory administrator, I want to create a new assessment by generating a PowerShell script that I can run on my Domain Controller, so that I can collect comprehensive AD data for analysis without manual effort.

### Acceptance Criteria

#### AC-1: Assessment Creation UI
- **Given** I am logged in to the system
- **When** I navigate to `/new-assessment`
- **Then** I see:
  - Domain name input field (required)
  - Module selection checkboxes (Infrastructure, Replication, Security, GPO, Core, ADCS)
  - "Generate Script" button
  - Instructions panel with requirements

#### AC-2: Script Generation
- **Given** I have entered a domain name and selected at least one module
- **When** I click "Generate Script"
- **Then** the system:
  1. Generates a unique assessment ID (UUID)
  2. Creates an assessment record in database (`assessments` table)
  3. Generates PowerShell script with:
     - Assessment ID embedded in filename and script content
     - Selected modules only
     - UTF-8 encoding enforcement
     - TLS 1.2 enforcement
     - Self-signed certificate handling
     - Progress indicators with colored output
     - Error handling and validation
  4. Initiates download of script file

#### AC-3: PowerShell Script Execution
- **Given** I have downloaded the script on a Domain Controller
- **When** I execute the script
- **Then** the script:
  1. Validates PowerShell version (>= 5.1)
  2. Checks RSAT/AD module availability
  3. Tests connectivity to API endpoint
  4. Collects AD data using 27+ PowerShell functions
  5. Validates collected data structure
  6. Uploads JSON to `/api/process-assessment` (or `/api/upload-large-file` for >50MB)
  7. Displays progress with colored output
  8. Shows success/error message with assessment ID

#### AC-4: Data Upload Processing
- **Given** the script successfully uploads JSON data
- **When** the server receives the upload
- **Then** the system:
  1. Validates JSON structure
  2. Stores data in `assessment_data` table (JSONB column)
  3. Updates assessment status to 'analyzing'
  4. Initializes `analysis_progress` with all categories as 'pending'
  5. Adds log entry: "Assessment data uploaded successfully"

#### AC-5: Module Selection
- **Given** I am on the new assessment page
- **When** I select/deselect modules
- **Then** the script includes only selected data collection functions:
  - **Infrastructure**: Get-DomainInformation, Get-DomainControllerInfo, Get-ADSiteTopology, Get-TrustRelationships, Get-DCHealth, Get-DHCPRogueServers, Get-DHCPOptionsAudit, Get-DNSRootHints, Get-DNSConflicts, Get-DNSScavengingDetailed, Get-FSMORolesHealth, Get-TrustHealth, Get-OrphanedTrusts
  - **Replication**: Get-ADReplicationHealth, Get-ReplicationStatus, Get-ReplicationHealthAllDCs, Get-LingeringObjectsRisk
  - **Security**: Get-KerberosConfiguration, Get-LAPSStatus, Get-ADCSInventory, Get-ProtocolSecurity, Get-DCSyncPermissions, Get-RC4EncryptionTypes
  - **GPO**: Get-GPOInventory
  - **Core**: Get-AllADUsers, Get-AllADComputers, Get-AllADGroups, Get-PasswordPolicies
  - **ADCS**: Get-ADCSInventory (also in Security module)

#### AC-6: Error Handling
- **Given** I encounter an error during script execution
- **When** the error occurs
- **Then** the script:
  1. Displays error message with details
  2. Suggests remediation steps
  3. Offers offline mode (export to ZIP)
  4. Includes assessment ID in error message for support

#### AC-7: Offline Mode
- **Given** I cannot connect to the API endpoint
- **When** I select offline mode in script
- **Then** the script:
  1. Collects AD data as usual
  2. Creates ZIP file with JSON data
  3. Saves to local directory
  4. Provides instructions for manual upload

## Tech Design

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│           NewAssessment.tsx (Frontend)               │
│  - Domain input, module selection                     │
│  - Script generation (embedded PowerShell code)        │
│  - Assessment creation API call                       │
└────────────────┬────────────────────────────────────┘
                 │
                 │ POST /api/assessments
                 ▼
┌─────────────────────────────────────────────────────────┐
│              server.js (Backend)                       │
│  - createAssessment()                                 │
│  - Generates UUID                                    │
│  - Inserts into assessments table                      │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Assessment ID + Script
                 ▼
┌─────────────────────────────────────────────────────────┐
│        PowerShell Script (User DC)                     │
│  - Validates environment                              │
│  - Collects AD data (27+ functions)                 │
│  - Validates data structure                           │
│  - Uploads to /api/process-assessment               │
└────────────────┬────────────────────────────────────┘
                 │
                 │ POST /api/process-assessment
                 ▼
┌─────────────────────────────────────────────────────────┐
│              server.js (Backend)                       │
│  - processAssessment()                               │
│  - Validates JSON                                    │
│  - Stores in assessment_data table                    │
│  - Updates status to 'analyzing'                     │
│  - Initializes progress tracking                       │
└─────────────────────────────────────────────────────────┘
```

### Components

#### Frontend
- **NewAssessment.tsx** (lines 38-1191)
  - Domain input state
  - Module selection state
  - Script generation state
  - Assessment creation API call

#### Backend
- **server.js**
  - `createAssessment()` (assessment creation)
  - `processAssessment()` (data upload processing)
  - Validation logic

#### PowerShell Script
- Embedded in NewAssessment.tsx
- 27+ data collection functions
- Error handling and validation
- Offline mode support

### Data Model

#### Assessment Creation Request
```typescript
{
  domain: string;           // Required: Domain name (e.g., "contoso.com")
  clientId?: string;       // Optional: Client ID for multi-tenant
}
```

#### Assessment Response
```typescript
{
  id: string;              // UUID
  domain: string;
  clientId?: string;
  status: 'pending';       // Initial status
  createdAt: string;      // ISO 8601 timestamp
}
```

#### Uploaded JSON Structure
```json
{
  "assessmentId": "uuid",
  "domain": "contoso.com",
  "collectedAt": "2025-01-13T12:00:00Z",
  "modules": ["Infrastructure", "Security"],
  "data": {
    "DomainInformation": { ... },
    "AllADUsers": [ ... ],
    "AllADGroups": [ ... ],
    // ... additional module data
  }
}
```

### API Endpoints

#### POST /api/assessments
**Request**:
```json
{
  "domain": "contoso.com",
  "clientId": "uuid"
}
```

**Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "domain": "contoso.com",
  "clientId": "550e8400-e29b-41d4-a716-446655440001",
  "status": "pending",
  "createdAt": "2025-01-13T12:00:00Z"
}
```

#### POST /api/process-assessment
**Request**: `multipart/form-data` with `file` field

**Response** (200 OK):
```json
{
  "assessmentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "analyzing",
  "categoriesFound": 15,
  "message": "Assessment uploaded successfully. Analysis started."
}
```

#### POST /api/upload-large-file
**Request**: `multipart/form-data` with `file` field (supports ZIP)

**Response** (200 OK):
```json
{
  "assessmentId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "uploaded",
  "fileSize": "524288000",
  "message": "Large file uploaded. Ready to process."
}
```

## Dev Tasks

### Task-1: Create Assessment Creation UI
- [ ] Implement NewAssessment.tsx with domain input and module selection
- [ ] Add validation (domain required, at least one module)
- [ ] Implement script generation (embedded PowerShell code)
- [ ] Add download functionality
- [ ] Add instructions panel with requirements
- [ ] Test with all module combinations

**Files**: `client/src/pages/NewAssessment.tsx`
**Estimated**: 4 hours

### Task-2: Implement Backend Assessment Creation
- [ ] Create `createAssessment()` function in server.js
- [ ] Generate UUID for assessment ID
- [ ] Insert into `assessments` table
- [ ] Handle client_id for multi-tenant
- [ ] Add error handling and validation
- [ ] Add logging

**Files**: `server/server.js`
**Estimated**: 2 hours

### Task-3: Implement Data Upload Processing
- [ ] Create `processAssessment()` function in server.js
- [ ] Validate JSON structure
- [ ] Store data in `assessment_data` table
- [ ] Update assessment status to 'analyzing'
- [ ] Initialize `analysis_progress` JSONB
- [ ] Add log entry for successful upload
- [ ] Handle large files (>50MB) with multer

**Files**: `server/server.js`
**Estimated**: 3 hours

### Task-4: Implement Large File Upload
- [ ] Create `/api/upload-large-file` endpoint
- [ ] Configure multer for large files (max 5GB)
- [ ] Handle ZIP file extraction
- [ ] Store uploaded file on disk
- [ ] Return file path and assessment ID

**Files**: `server/server.js`
**Estimated**: 2 hours

### Task-5: Implement PowerShell Script Functions
- [ ] Implement Get-DomainInformation
- [ ] Implement Get-DomainControllerInfo
- [ ] Implement Get-ADReplicationHealth
- [ ] Implement Get-ADSiteTopology
- [ ] Implement Get-TrustRelationships
- [ ] Implement Get-AllADUsers
- [ ] Implement Get-AllADComputers
- [ ] Implement Get-AllADGroups
- [ ] Implement Get-PasswordPolicies
- [ ] Implement Get-GPOInventory
- [ ] Implement Get-KerberosConfiguration
- [ ] Implement Get-LAPSStatus
- [ ] Implement Get-ADCSInventory
- [ ] Implement Get-ProtocolSecurity
- [ ] Implement Get-ReplicationStatus
- [ ] Implement Get-DCSyncPermissions
- [ ] Implement Get-RC4EncryptionTypes
- [ ] Implement Get-DCHealth
- [ ] Implement Get-DHCPRogueServers
- [ ] Implement Get-DHCPOptionsAudit
- [ ] Implement Get-DNSRootHints
- [ ] Implement Get-DNSConflicts
- [ ] Implement Get-DNSScavengingDetailed
- [ ] Implement Get-FSMORolesHealth
- [ ] Implement Get-ReplicationHealthAllDCs
- [ ] Implement Get-LingeringObjectsRisk
- [ ] Implement Get-TrustHealth
- [ ] Implement Get-OrphanedTrusts
- [ ] Add error handling and validation
- [ ] Add progress indicators with colored output
- [ ] Implement offline mode (ZIP export)
- [ ] Add connectivity check

**Files**: `client/src/pages/NewAssessment.tsx` (lines 38-1191)
**Estimated**: 16 hours

### Task-6: Add Error Handling
- [ ] Add validation for domain name format
- [ ] Add validation for module selection
- [ ] Add error messages for script generation failures
- [ ] Add error messages for API failures
- [ ] Add retry logic for transient errors
- [ ] Add user-friendly error messages

**Files**: `client/src/pages/NewAssessment.tsx`, `server/server.js`
**Estimated**: 2 hours

### Task-7: Add Offline Mode
- [ ] Add offline mode flag to script
- [ ] Implement ZIP file creation
- [ ] Add instructions for manual upload
- [ ] Test offline mode workflow

**Files**: `client/src/pages/NewAssessment.tsx`
**Estimated**: 3 hours

## Test Plan

### Unit Tests
- [ ] Test `createAssessment()` with valid inputs
- [ ] Test `createAssessment()` with invalid domain
- [ ] Test `processAssessment()` with valid JSON
- [ ] Test `processAssessment()` with invalid JSON
- [ ] Test PowerShell script generation with all modules
- [ ] Test PowerShell script generation with no modules (should fail)

### Integration Tests
- [ ] Test full assessment creation flow (UI → API → DB)
- [ ] Test script upload flow (script → API → DB)
- [ ] Test large file upload (>50MB)
- [ ] Test ZIP file upload and extraction
- [ ] Test error handling throughout flow

### E2E Tests
- [ ] Test complete workflow: Create assessment → Download script → Run script → Upload → View results
- [ ] Test offline mode: Create assessment → Download script → Run offline → Upload ZIP
- [ ] Test all module combinations
- [ ] Test error scenarios (network failure, invalid JSON)

### Manual Tests
- [ ] Run script on Windows Server 2019 DC
- [ ] Run script on Windows Server 2022 DC
- [ ] Run script with PowerShell 5.1
- [ ] Run script with PowerShell 7
- [ ] Test with small AD (<1000 users)
- [ ] Test with large AD (>10,000 users)
- [ ] Test with single domain
- [ ] Test with multi-domain forest

---

**Status**: ✅ Complete (Phase 1)
