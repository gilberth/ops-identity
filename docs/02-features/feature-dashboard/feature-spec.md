# Feature Specification: Dashboard & Visualization

**Status**: Implemented  
**Priority**: High  
**Owner**: Engineering Team

---

## Overview

The Dashboard provides a visual overview of Active Directory health assessments, including security scores, category analysis, and assessment history. It serves as the primary landing page for users to understand their AD security posture at a glance.

---

## User Stories

### US-D1: View Security Score
**As a** security administrator  
**I want to** see an overall security grade for my AD environment  
**So that** I can quickly understand my security posture

**Acceptance Criteria**:
- [x] Display letter grade (A-F) prominently
- [x] Show numeric score (0-100)
- [x] Grade calculated from finding severities
- [x] Grade updates when new assessment completes

### US-D2: View Category Breakdown
**As a** security administrator  
**I want to** see how each AD category scores  
**So that** I can identify which areas need attention

**Acceptance Criteria**:
- [x] Radar chart showing all 17 categories
- [x] Category scores normalized to 0-100 scale
- [x] Clickable categories to drill into details
- [x] Visual indication of problem areas

### US-D3: View Finding Summary
**As a** security administrator  
**I want to** see a breakdown of findings by severity  
**So that** I can prioritize remediation

**Acceptance Criteria**:
- [x] Severity bar showing Critical/High/Medium/Low/Info counts
- [x] Top findings carousel with most important issues
- [x] Total object counts (users, computers, groups, etc.)
- [x] Filtering by severity level

### US-D4: View Assessment History
**As a** security administrator  
**I want to** see all past assessments  
**So that** I can track progress over time

**Acceptance Criteria**:
- [x] Table with assessment list
- [x] Status indicators (pending/analyzing/completed/failed)
- [x] Click to view assessment details
- [x] Filter by status
- [x] Filter by client (multi-tenant)

---

## Technical Design

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| Dashboard.tsx | `client/src/pages/` | Main dashboard page |
| LetterGrade | `client/src/components/` | A-F grade display |
| CategoryRadar | `client/src/components/` | Radar chart visualization |
| SeverityBar | `client/src/components/` | Finding count bars |
| TopFindings | `client/src/components/` | Findings carousel |
| ObjectsAnalyzed | `client/src/components/` | Object count badges |

### Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Dashboard.tsx  │────►│  GET /api/       │────►│   PostgreSQL    │
│                 │     │  assessments     │     │   assessments   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ AssessmentDetail│────►│  GET /api/       │────►│ assessment_data │
│                 │     │  assessment/:id  │     │    (JSONB)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Score Calculation

```typescript
function calculateSecurityGrade(findings: Finding[]): { grade: string; score: number } {
  const weights = {
    Critical: 10,
    High: 5,
    Medium: 2,
    Low: 1,
    Info: 0
  };
  
  const totalDeductions = findings.reduce((sum, f) => sum + weights[f.severity], 0);
  const score = Math.max(0, 100 - totalDeductions);
  
  const grade = 
    score >= 90 ? 'A' :
    score >= 80 ? 'B' :
    score >= 70 ? 'C' :
    score >= 60 ? 'D' : 'F';
    
  return { grade, score };
}
```

### Category Radar Data

```typescript
const categoryScores = categories.map(cat => {
  const catFindings = findings.filter(f => f.category === cat);
  const deductions = catFindings.reduce((sum, f) => sum + weights[f.severity], 0);
  return {
    category: cat,
    score: Math.max(0, 100 - deductions * 2), // Per-category scaling
    findingCount: catFindings.length
  };
});
```

---

## API Endpoints

### GET /api/assessments
Returns list of assessments for current client.

**Response**:
```json
{
  "assessments": [
    {
      "id": "uuid",
      "domain_name": "example.com",
      "status": "completed",
      "created_at": "2026-01-13T10:00:00Z",
      "security_score": 75,
      "finding_count": 42,
      "client_id": "uuid"
    }
  ]
}
```

### GET /api/assessment/:id/summary
Returns dashboard summary for specific assessment.

**Response**:
```json
{
  "grade": "B",
  "score": 82,
  "findings": {
    "critical": 2,
    "high": 8,
    "medium": 15,
    "low": 12,
    "info": 5
  },
  "objects": {
    "users": 1250,
    "computers": 340,
    "groups": 89,
    "gpos": 45
  },
  "categories": [
    { "name": "Users", "score": 75, "findings": 8 },
    { "name": "Computers", "score": 90, "findings": 3 }
  ]
}
```

---

## UI/UX Specifications

### Layout
```
┌────────────────────────────────────────────────────────────────┐
│  OpsIdentity              [Client Selector ▼]        [Admin]   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────┐  ┌────────────────────────────────────────────┐  │
│  │    A     │  │           Category Radar Chart             │  │
│  │  Score   │  │                                            │  │
│  │   85     │  │                                            │  │
│  └──────────┘  └────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Critical: 2  High: 8  Medium: 15  Low: 12  Info: 5        │ │
│  │ ███████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Top Findings                                    [< >]      │ │
│  │ ┌────────────────────────────────────────────────────────┐ │ │
│  │ │ CRITICAL: Kerberos delegation misconfigured            │ │ │
│  │ │ 5 accounts with unconstrained delegation...            │ │ │
│  │ └────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
│  Assessment History                                            │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Domain        Status      Score   Date           Actions  │ │
│  │ example.com   Completed   B (82)  Jan 13, 2026   [View]   │ │
│  │ corp.local    Analyzing   -       Jan 12, 2026   [View]   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Color Scheme
| Element | Color | Hex |
|---------|-------|-----|
| Critical | Red | #EF4444 |
| High | Orange | #F97316 |
| Medium | Yellow | #EAB308 |
| Low | Blue | #3B82F6 |
| Info | Gray | #6B7280 |
| Grade A | Green | #22C55E |
| Grade B | Blue | #3B82F6 |
| Grade C | Yellow | #EAB308 |
| Grade D | Orange | #F97316 |
| Grade F | Red | #EF4444 |

---

## Test Plan

### Unit Tests
- [ ] Score calculation with various finding distributions
- [ ] Grade boundaries (89→B, 90→A)
- [ ] Category score normalization
- [ ] Empty findings handling

### Integration Tests
- [ ] Dashboard loads with assessment data
- [ ] Client filtering works correctly
- [ ] Status filters apply properly
- [ ] Assessment detail navigation works

### E2E Tests
- [ ] Complete flow: upload → analyze → view dashboard
- [ ] Multi-client switching
- [ ] Real-time progress updates

---

## Dependencies

- **shadcn/ui**: Card, Table, Badge components
- **recharts**: Radar chart visualization
- **ClientContext**: Multi-tenant filtering
- **AuthContext**: User authentication

---

## Related Documents

- [PRD](/docs/01-product/prd.md)
- [AI Analysis Feature](/docs/02-features/feature-ai-analysis/feature-spec.md)
- [Reports Feature](/docs/02-features/feature-reports/feature-spec.md)
