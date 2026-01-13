# Feature Specification: Report Generation

**Status**: Implemented  
**Priority**: High  
**Owner**: Engineering Team

---

## Overview

The Report Generation feature allows users to export AD assessment results to professional document formats (DOCX, PDF) for sharing with stakeholders, compliance audits, and executive briefings. Reports include executive summaries, detailed findings, compliance matrices, and remediation roadmaps.

---

## User Stories

### US-R1: Generate Executive Report (DOCX)
**As a** security consultant  
**I want to** generate a professional Word document  
**So that** I can share results with client executives

**Acceptance Criteria**:
- [x] DOCX format with professional formatting
- [x] Executive summary with key metrics
- [x] Finding details by category
- [x] Compliance mapping matrix
- [x] Remediation roadmap (4 phases)
- [x] Data tables for AD objects

### US-R2: Generate Technical Report (PDF)
**As a** security administrator  
**I want to** generate a PDF report  
**So that** I have a printable, non-editable document

**Acceptance Criteria**:
- [x] PDF format with consistent rendering
- [x] All findings with technical details
- [x] Compliance references
- [x] MITRE ATT&CK mappings
- [x] Charts and visualizations

### US-R3: Export Raw Data (PDF)
**As a** security analyst  
**I want to** export raw AD data as PDF  
**So that** I can review source data alongside findings

**Acceptance Criteria**:
- [x] All JSON data formatted as tables
- [x] Category grouping
- [x] Searchable text
- [x] Pagination for large datasets

### US-R4: Select Report Sections
**As a** user  
**I want to** choose which sections to include  
**So that** I can customize reports for different audiences

**Acceptance Criteria**:
- [x] Export modal with format selection
- [x] Section checkboxes (findings, compliance, data)
- [x] Preview of report contents
- [x] Download progress indicator

---

## Technical Design

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| ExportModal | `client/src/components/` | Report options UI |
| reportGenerator.ts | `client/src/lib/` | DOCX generation |
| pdfGenerator.ts | `client/src/lib/` | PDF generation |
| rawDataPdfGenerator.ts | `client/src/lib/` | Raw data PDF |

### Report Structure (DOCX)

```
1. Cover Page
   - Client name, domain, date
   - Security grade (A-F)
   - OpsIdentity branding

2. Executive Summary
   - Overall score and grade
   - Finding counts by severity
   - Key risk areas
   - Immediate actions required

3. Findings by Category
   - Category overview
   - Finding cards with:
     - Title, severity, description
     - Affected objects
     - Remediation steps
     - Compliance references
     - MITRE ATT&CK mapping

4. Data Tables
   - Users (privileged, stale, disabled)
   - Computers (by OS, stale)
   - Groups (nested, empty)
   - GPOs (unlinked, orphaned)
   - Domain Controllers
   - Replication status
   - DNS zones
   - DHCP scopes
   - Trusts
   - Sites and subnets
   - ADCS certificates

5. Compliance Matrix
   - CIS Benchmarks mapping
   - NIST 800-53 controls
   - ISO 27001 controls
   - PCI-DSS requirements
   - SOX compliance
   - GDPR considerations

6. Remediation Roadmap
   - Phase 1: Immediate (0-30 days)
   - Phase 2: Short-term (30-90 days)
   - Phase 3: Medium-term (90-180 days)
   - Phase 4: Long-term (180+ days)

7. Appendix
   - Methodology
   - Tool versions
   - Data collection timestamp
```

### DOCX Generation Flow

```typescript
// reportGenerator.ts
export async function generateReport(
  assessment: Assessment,
  findings: Finding[],
  rawData: RawData,
  options: ReportOptions
): Promise<Blob> {
  
  const doc = new Document({
    sections: [
      buildCoverPage(assessment),
      buildExecutiveSummary(findings),
      buildFindingsSection(findings),
      buildDataTables(rawData),
      buildComplianceMatrix(findings),
      buildRoadmap(findings),
      buildAppendix(assessment)
    ]
  });
  
  return Packer.toBlob(doc);
}
```

### Data Table Generation

```typescript
function buildTable(
  title: string,
  headers: string[],
  rows: any[],
  columns: ColumnDef[],
  maxRows: number = 30
): Table {
  
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      children: [new Paragraph({ text: h, bold: true })],
      shading: { fill: "E5E7EB" }
    }))
  });
  
  const dataRows = rows.slice(0, maxRows).map(row =>
    new TableRow({
      children: columns.map(col => new TableCell({
        children: [new Paragraph({ text: String(row[col.key] ?? "") })]
      }))
    })
  );
  
  return new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
}
```

---

## Report Sections Detail

### Replication Section (Recently Fixed)

**Data Source**: `ReplicationHealthAllDCs`

**Structure**:
```json
{
  "Summary": {
    "HealthyDCs": 5,
    "DegradedDCs": 0,
    "FailedLinks": 0,
    "TotalDCs": 5
  },
  "DomainControllers": [
    {
      "DCName": "DC1",
      "InboundPartners": [
        {
          "PartnerDC": "CN=NTDS Settings,CN=DC2,...",
          "Status": "OK",
          "ReplicationLagMinutes": 0.26,
          "ConsecutiveFailures": 0
        }
      ]
    }
  ]
}
```

**Table Output**:
| DC | Partner | Status | Lag |
|----|---------|--------|-----|
| DC1 | DC2 | OK (0.26 min) | 0.26 |
| DC1 | DC3 | OK (1.50 min) | 1.50 |

**Summary Paragraph**: "5 DCs sanos, 0 degradados, 0 enlaces fallidos"

### Compliance Matrix

```typescript
const complianceFrameworks = [
  { name: "CIS", version: "8.0", controls: ["5.1", "5.2", "6.1", "6.2"] },
  { name: "NIST", version: "800-53 r5", controls: ["AC-2", "AC-6", "IA-5"] },
  { name: "ISO 27001", version: "2022", controls: ["A.9.2", "A.9.4"] },
  { name: "PCI-DSS", version: "4.0", controls: ["8.2", "8.3"] },
  { name: "SOX", version: "", controls: ["Section 404"] },
  { name: "GDPR", version: "", controls: ["Article 32"] }
];
```

---

## API Endpoints

### GET /api/assessment/:id/export
Returns assessment data formatted for report generation.

**Query Parameters**:
- `format`: "docx" | "pdf" | "raw"
- `sections`: comma-separated list

**Response**: Assessment data with findings and raw AD data.

---

## File Size Considerations

| Report Type | Typical Size | Max Size |
|-------------|--------------|----------|
| DOCX (full) | 2-5 MB | 15 MB |
| PDF (findings) | 1-3 MB | 10 MB |
| PDF (raw data) | 5-20 MB | 50 MB |

### Optimization Strategies
- Row limits per table (30 rows default)
- Image compression for charts
- Lazy loading of large data sections
- Progress indicator for generation

---

## UI/UX Specifications

### Export Modal

```
┌─────────────────────────────────────────────────────────┐
│  Export Assessment Report                           [X] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Format:                                                │
│  ○ DOCX (Microsoft Word) - Recommended                  │
│  ○ PDF (Portable Document)                              │
│  ○ Raw Data PDF                                         │
│                                                         │
│  Sections:                                              │
│  ☑ Executive Summary                                    │
│  ☑ Findings by Category                                 │
│  ☑ Data Tables                                          │
│  ☑ Compliance Matrix                                    │
│  ☑ Remediation Roadmap                                  │
│  ☐ Appendix (Methodology)                               │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Preview                                          │  │
│  │  - 42 findings (2 Critical, 8 High, ...)         │  │
│  │  - 15 data tables                                 │  │
│  │  - Estimated size: 3.2 MB                         │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│                              [Cancel]  [Generate Report] │
└─────────────────────────────────────────────────────────┘
```

### Progress Indicator

```
Generating Report...
[████████████░░░░░░░░░░░░░░░░░░] 40%
Building data tables...
```

---

## Test Plan

### Unit Tests
- [ ] DOCX structure validation
- [ ] Table generation with various data shapes
- [ ] Compliance matrix mapping accuracy
- [ ] Empty data handling

### Integration Tests
- [ ] Full DOCX generation from assessment
- [ ] PDF generation completes without error
- [ ] Large assessment (10k users) performance

### Manual Tests
- [ ] DOCX opens in Microsoft Word
- [ ] DOCX opens in Google Docs
- [ ] PDF renders correctly in browsers
- [ ] All tables have correct data

---

## Known Issues

### BUG-001: Replication Table Empty (RESOLVED)
- **Fix Date**: 2026-01-13
- **Location**: `reportGenerator.ts:1734-1850`
- **Cause**: Expected array, got nested object structure
- **Resolution**: Added support for `DomainControllers.InboundPartners` structure

---

## Dependencies

- **docx**: DOCX generation library
- **pdfmake**: PDF generation library
- **file-saver**: Browser file download
- **Assessment data**: From `/api/assessment/:id`

---

## Related Documents

- [PRD](/docs/01-product/prd.md)
- [Dashboard Feature](/docs/02-features/feature-dashboard/feature-spec.md)
- [Bug Log](/docs/03-logs/bug-log.md)
