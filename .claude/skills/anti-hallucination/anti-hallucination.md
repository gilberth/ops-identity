# Anti-Hallucination Validation Skill for OpsIdentity

## Overview

This skill validates that AI prompts and LLM analysis implementations follow anti-hallucination best practices. Use when:

1. Adding new analysis prompts to `server.js`
2. Reviewing existing prompts for hallucination risks
3. Implementing validation rules in `ATTRIBUTE_VALIDATION_RULES`
4. Auditing findings validation logic

## Prompt Validation Checklist

### 1. Anti-Hallucination Statement (REQUIRED)

Every category prompt MUST include:

```
**⚠️ REGLA ANTI-ALUCINACIÓN:** Solo reporta objetos que aparezcan EXPLÍCITAMENTE en los datos. NO inventes nombres.
```

### 2. Grounding Instructions (REQUIRED)

```
- "affected_objects con nombres REALES (máximo 10, luego '...y X más')"
- "affected_count preciso"
- "Solo genera finding SI hay evidencia en los datos"
```

### 3. Type ID Definition (REQUIRED)

```
- **type_id**: Identificador ÚNICO en MAYÚSCULAS_CON_GUIONES (ej: PASSWORD_NEVER_EXPIRES)
```

## Validation Rules Checklist

### 1. ATTRIBUTE_VALIDATION_RULES Entry

For each `type_id` in a prompt, add corresponding rule:

```javascript
'TYPE_ID_NAME': {
  category: 'CategoryName',
  identifierField: 'Name',
  validate: (obj) => obj.Enabled && obj.RiskyAttribute === true
}
```

### 2. Nested Data Validation (for DCHealth, etc.)

```javascript
'GHOST_COMPUTER_ACCOUNTS': {
  category: 'DCHealth',
  identifierField: 'Name',
  validate: (obj) => obj.HygieneAnalysis?.GhostComputers?.length > 0,
  validateAffectedObject: (objName, dcData) => {
    return dcData.HygieneAnalysis?.GhostComputers?.some(ghost =>
      ghost.toLowerCase().includes(objName.toLowerCase())
    );
  }
}
```

## Audit Commands

```bash
# Check anti-hallucination coverage
grep -c "ANTI-ALUCINACIÓN" server/server.js

# List validation rules
grep "'[A-Z_]*':" server/server.js | head -30

# Check validation calls
grep -c "validateFindings\|validateAttributes" server/server.js

# Check hallucination logging
grep "HALLUCINATION" server/server.js
```

## Hallucination Patterns to Block

| Pattern | Example | Action |
|---------|---------|--------|
| Invented names | "Admin_Test123" not in data | BLOCK finding |
| Inflated counts | Claims 50, lists 3 | FIX count |
| Generic names | "ejemplo", "test123" | FLAG suspicious |
| Attribute mismatch | Says PasswordNeverExpires but it's false | BLOCK finding |

## New Category Checklist

- [ ] Add to `CATEGORIES` array
- [ ] Add `extractCategoryData` logic
- [ ] Add smart filtering (if high-volume)
- [ ] Create prompt with anti-hallucination rules
- [ ] Add `ATTRIBUTE_VALIDATION_RULES` entries
- [ ] Add DOCX section in `reportGenerator.ts`
- [ ] Test validation with real data

## Validation Rule Template

```javascript
'NEW_TYPE_ID': {
  category: 'CategoryName',
  identifierField: 'Name',
  validate: (obj) => {
    // Return true if object should be flagged
    return obj.Enabled && obj.HasRiskyCondition;
  },
  // Optional: for nested structures
  validateAffectedObject: (objName, parentObj) => {
    return parentObj.NestedArray?.some(item =>
      item.toLowerCase().includes(objName.toLowerCase())
    );
  }
}
```

## Severity Levels

| Level | Action | When |
|-------|--------|------|
| 🛑 BLOCK | Discard finding | All objects invented |
| ⚠️ PARTIAL FIX | Remove invalid objects | Some objects valid |
| ℹ️ WARNING | Log only | Count mismatch |

## Integration

This skill enforces CLAUDE.md Step 4: Anti-Hallucination Validation.
