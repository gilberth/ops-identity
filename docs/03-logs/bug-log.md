# Bug Log

## BUG-001: Replication Table Empty in DOCX Report

**Status**: RESOLVED  
**Date Reported**: 2026-01-13  
**Date Fixed**: 2026-01-13  
**Severity**: High  
**Component**: `client/src/lib/reportGenerator.ts`

### Description
The DOCX report generator was producing an empty replication table even when the JSON data contained valid replication information.

### Steps to Reproduce
1. Upload AD assessment JSON containing `ReplicationHealthAllDCs` data
2. Generate DOCX report
3. Navigate to replication section
4. Table is empty despite JSON having data

### Root Cause Analysis
The code at line 1738 expected `ReplicationHealthAllDCs` to be a flat array:
```javascript
// Expected structure (WRONG)
ReplicationHealthAllDCs: [
  { SourceDC: "DC1", DestinationDC: "DC2", Status: "OK" }
]

// Actual structure (CORRECT)
ReplicationHealthAllDCs: {
  Summary: { HealthyDCs: 5, DegradedDCs: 0, FailedLinks: 0, TotalDCs: 5 },
  DomainControllers: [
    {
      DCName: "TLSCH-AD2",
      InboundPartners: [
        { PartnerDC: "CN=NTDS Settings,CN=TLSCH-AD1,...", Status: "OK", ReplicationLagMinutes: 0.26 }
      ]
    }
  ]
}
```

### Resolution
Updated `reportGenerator.ts` lines 1734-1850:
- Added support for nested `DomainControllers` structure
- Extract DC name from Distinguished Name using regex
- Display replication lag in status column
- Added summary statistics paragraph
- Increased row limit from 20 to 30

### Testing
- Verified with `AD-Assessment-grupotls.edu-*.json`
- Confirmed replication table now displays correctly
- Build passes without errors

### Lessons Learned
- Always verify JSON structure before assuming array vs object
- PowerShell collection script may have different data shapes than expected
- Add defensive checks for both array and object structures

---

## BUG-002: [Template]

**Status**: OPEN | IN PROGRESS | RESOLVED  
**Date Reported**: YYYY-MM-DD  
**Date Fixed**: YYYY-MM-DD  
**Severity**: Critical | High | Medium | Low  
**Component**: file/path.ts

### Description
[What is the bug?]

### Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

### Root Cause Analysis
[Why did this happen?]

### Resolution
[How was it fixed?]

### Testing
[How was the fix verified?]

### Lessons Learned
[What can we do to prevent this in the future?]

---

**This log tracks all bugs encountered and their resolutions. Document every bug to build institutional knowledge.**
