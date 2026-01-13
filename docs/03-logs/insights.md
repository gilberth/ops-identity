# Insights Log

This log captures patterns, discoveries, and learnings from development and production that can inform future work.

---

## 2026-01-13: JSON Structure Variance

**Type**: Data Structure Pattern  
**Impact**: Medium  
**Components Affected**: Report generators, data extractors

### Observation
PowerShell data collection scripts produce varying JSON structures depending on:
1. AD environment configuration
2. Module selection during assessment
3. PowerShell version and available cmdlets
4. Network connectivity during collection

### Examples
```javascript
// Some environments return arrays
ReplicationHealthAllDCs: [ { SourceDC, DestinationDC, Status } ]

// Others return nested objects with summary
ReplicationHealthAllDCs: {
  Summary: { HealthyDCs, DegradedDCs, FailedLinks, TotalDCs },
  DomainControllers: [ { DCName, InboundPartners: [...] } ]
}
```

### Recommendation
- Always check for both array and object structures
- Use defensive patterns: `Array.isArray(data) ? data : data?.items || []`
- Document expected structures in `JSON_SCHEMA.md`
- Consider normalizing data on upload in `server.js`

---

## 2026-01-13: Report Generation Patterns

**Type**: Code Quality  
**Impact**: High  
**Components Affected**: `reportGenerator.ts`, `pdfGenerator.ts`

### Observation
Report generators have repeated patterns for:
1. Checking if data exists
2. Adding section headers
3. Building tables with row limits
4. Handling empty data states

### Current Pattern (Repeated)
```typescript
if (data && Array.isArray(data) && data.length > 0) {
  children.push(new Paragraph({ text: "Section Title", heading: HeadingLevel.HEADING_2 }));
  // ... build table
  if (data.length > 20) {
    children.push(new Paragraph({ text: `Showing 20 of ${data.length}` }));
  }
} else {
  children.push(new Paragraph({ text: "No data available" }));
}
```

### Recommendation
Create helper functions:
- `addSectionWithTable(title, data, columns, rowLimit)`
- `formatEmptyState(sectionName)`
- `extractTableData(data, keyMapping)`

This would reduce `reportGenerator.ts` from ~3000 lines to ~1500 lines.

---

## 2026-01-12: Smart Filtering Effectiveness

**Type**: Performance  
**Impact**: High  
**Components Affected**: `server.js` extractCategoryData()

### Observation
Smart filtering in 11 categories reduces token usage by ~70% while maintaining analysis quality.

| Category | Before Filter | After Filter | Reduction |
|----------|---------------|--------------|-----------|
| Users | 450KB | deterministic | 100% |
| Computers | 380KB | 45KB | 88% |
| Groups | 120KB | 25KB | 79% |
| GPOs | 200KB | 40KB | 80% |
| Sites | 85KB | 15KB | 82% |

### Key Filtering Strategies
1. **Include only risky objects** - Skip disabled, clean, compliant items
2. **Limit array samples** - Take first N representatives
3. **Remove verbose fields** - Drop Description, Notes, large text
4. **Focus on flags** - Keep boolean/enum risk indicators

### Recommendation
Extend smart filtering to remaining categories:
- DNS (filter healthy zones)
- DHCP (filter active scopes only)
- ReplicationStatus (filter successful replications)
- Security (already compact)

---

## 2026-01-10: Anti-Hallucination Effectiveness

**Type**: Quality  
**Impact**: Critical  
**Components Affected**: `server.js` validation functions

### Observation
3-layer validation catches AI hallucinations at different stages:

| Validation Layer | Catches | False Positive Rate |
|------------------|---------|---------------------|
| Per-chunk validation | Object existence | 15% hallucinations caught |
| Post-merge validation | Duplicate findings | 8% duplicates removed |
| Attribute validation | Invented attributes | 12% attribute claims rejected |

### Common Hallucination Patterns
1. **Invented users/computers** - AI creates objects that don't exist
2. **Wrong attribute values** - AI misremembers values from prompt
3. **Cross-category contamination** - AI applies findings from one category to another
4. **Severity inflation** - AI marks Medium issues as Critical

### Recommendation
- Continue enforcing all 3 validation layers
- Add logging for rejected findings to monitor hallucination patterns
- Consider adding 4th layer: severity consistency validation

---

## Insight Template

**Type**: [Data Structure | Code Quality | Performance | Quality | UX | Security]  
**Impact**: [Critical | High | Medium | Low]  
**Components Affected**: [file paths]

### Observation
[What did you notice?]

### Evidence
[Data, examples, metrics]

### Recommendation
[What should we do about it?]

---

**This log captures learnings and patterns. Document insights as they emerge to build organizational knowledge.**
