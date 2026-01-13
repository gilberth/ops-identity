# Developer Workflow

## Overview
This document describes the daily development workflow for both human developers and AI assistants working on the OpsIdentity codebase.

## Prerequisites

### Local Development
1. **Clone Repository**
   ```bash
   git clone https://github.com/gilberth/ops-identity.git
   cd ops-identity
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start Database**
   ```bash
   docker compose up -d db
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd server && bun --watch server.js

   # Terminal 2: Frontend
   cd client && npm run dev
   ```

6. **Access Application**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3000

### Development Tools
- **IDE**: VS Code with recommended extensions
- **Git**: GitHub CLI for PR operations
- **Database**: pgAdmin (http://localhost:5050)
- **API Testing**: Postman or Thunder Client

## Daily Workflow

### 1. Plan Work
- [ ] Check `docs/02-features/` for assigned features
- [ ] Review `docs/03-logs/decisions-log.md` for context
- [ ] Review `docs/04-process/definition-of-done.md` for completion criteria
- [ ] Create branch: `git checkout -b feature/description`

### 2. Retrieve Knowledge (AI Assistants Only)
- [ ] Use `byterover-retrieve-knowledge` before starting
- [ ] Gather context about existing patterns
- [ ] Check for previous solutions to similar problems

### 3. Implement Changes
- [ ] Follow coding standards in `conductor/code_styleguides/`
- [ ] Write tests alongside code (TDD preferred)
- [ ] Add JSDoc/TypeDoc comments for complex functions
- [ ] Update relevant documentation files

### 4. Test Changes
- [ ] Run unit tests: `npm test` (if configured)
- [ ] Run integration tests: `npm run test:integration`
- [ ] Run E2E tests: `npm run test:e2e`
- [ ] Manual testing in development environment
- [ ] Test on multiple browsers

### 5. Code Quality Checks
- [ ] Run linting: `npm run lint`
- [ ] Run type checking: `npm run typecheck`
- [ ] Fix all errors and warnings

### 6. Code Review
- [ ] Self-review changes
- [ ] Request peer review via GitHub PR
- [ ] Address review comments
- [ ] Ensure all acceptance criteria met

### 7. Commit Changes
- [ ] Follow commit message format: `type(scope): vX.Y.Z - description`
- [ ] Stage relevant files: `git add`
- [ ] Commit: `git commit -m "feat(auth): v3.6.0 - Add Authentik OAuth2 integration"`

### 8. Push and Deploy
- [ ] Push to remote: `git push origin feature/description`
- [ ] Create Pull Request via GitHub CLI
- [ ] Wait for CI/CD checks to pass
- [ ] Merge to main
- [ ] Verify deployment to staging

### 9. Production Deployment
- [ ] Test in staging environment
- [ ] Get approval from product owner
- [ ] Deploy to production: `ssh root@10.10.10.232 "cd /data/activeinsight && docker compose pull app && docker compose up -d app"`
- [ ] Verify deployment success

### 10. Store Knowledge (AI Assistants Only)
- [ ] Use `byterover-store-knowledge` after completing work
- [ ] Document patterns learned
- [ ] Document error solutions
- [ ] Document architectural decisions

## PS1 Feature Development Workflow (Mandatory)

### Step 1: PowerShell Data Collection
**File**: `client/src/pages/NewAssessment.tsx`

1. Add new PowerShell function:
   ```powershell
   function Get-NewFeature {
       param()
       # Validate requirements
       # Collect data
       # Return structured object
   }
   ```

2. Include in module selection:
   ```typescript
   if (selectedModules.includes('NewFeature')) {
       script += Get-NewFeature.toString();
   }
   ```

3. Add to function list (lines 38-1191)

### Step 2: LLM Analysis Prompt
**File**: `server/server.js` (lines 1543-3543)

1. Add category prompt:
   ```javascript
   case 'NewFeature':
       return `You are an Active Directory expert. Analyze NewFeature data...
       ⚠️ REGLA ANTI-ALUCINACIÓN: Solo reporta objetos que aparezcan EXPLÍCITAMENTE en los datos.`;
   ```

2. Follow `guiaprompt.md` guidelines:
   - Clear analysis instructions
   - Compliance mappings (CIS, NIST, ISO 27001, etc.)
   - PowerShell remediation commands
   - 4-5 phase implementation roadmap

### Step 3: DOCX Report Generation
**File**: `client/src/lib/reportGenerator.ts`

1. Add report section:
   ```typescript
   // New Feature Findings
   const newFeatureFindings = findings.filter(f => f.category === 'NewFeature');
   if (newFeatureFindings.length > 0) {
       doc.addSection({
           properties: {},
           children: [
               new Paragraph({
                   text: "New Feature Analysis",
                   heading: HeadingLevel.HEADING_2,
                   spacing: { after: 200 }
               }),
               new Table({
                   rows: [...],
                   columnWidths: [3120, 3120, 3120]
               })
           ]
       });
   }
   ```

2. Use docx patterns:
   - `numbering` config for ordered lists
   - `Table` with `columnWidths`
   - `ShadingType.CLEAR` for table cells

### Step 4: Anti-Hallucination Validation
**File**: `server/server.js` (lines 862-1483)

1. Add validation rule:
   ```javascript
   'NEW_TYPE_ID': {
       category: 'NewFeature',
       identifierField: 'Name',
       validate: (obj) => obj.Enabled && obj.RiskyAttribute === true,
       validateAffectedObject: (objName, parentObj) => {
           return parentObj.NestedArray?.some(item =>
               item.toLowerCase().includes(objName.toLowerCase())
           );
       }
   }
   ```

2. Test validation:
   - Verify objects exist in source data
   - Verify attributes match claimed vulnerability
   - Test with known good/bad data

### Step 5: Update Documentation
**Files**: `docs/02-features/feature-new-feature/`

1. Create `feature-spec.md`:
   - User intent
   - Acceptance criteria
   - Tech design
   - Dev tasks
   - Test plan

2. Create `tech-design.md`:
   - Architecture diagram
   - Component breakdown
   - Data model
   - API endpoints

3. Update `docs/00-context/system-state.md`:
   - Add new feature to feature implementation status
   - Update component status table

4. Update `docs/03-logs/implementation-log.md`:
   - Add entry with date and changes

## AI-Specific Workflow

### Before Starting
```bash
# Retrieve knowledge about codebase patterns
byterover-retrieve-knowledge --topic="react-component-structure"
byterover-retrieve-knowledge --topic="ai-prompt-patterns"
byterover-retrieve-knowledge --topic="database-schema"
```

### During Development
1. **Code Generation**:
   - Follow existing patterns from retrieved knowledge
   - Match code style (indentation, naming conventions)
   - Use existing utility functions when possible

2. **Error Handling**:
   - Check retrieved knowledge for similar errors
   - Apply previously successful solutions
   - If new error, document resolution for future use

3. **Refactoring**:
   - Check retrieved knowledge before making changes
   - Understand existing patterns and rationale
   - Preserve architectural decisions

### After Completing
```bash
# Store learned patterns for future reference
byterover-store-knowledge --topic="react-component-patterns" --file="MyComponent.tsx"
byterover-store-knowledge --topic="ai-optimization" --description="Reduced token usage by 70% with smart filtering"
```

## Human-Specific Workflow

### Branch Naming
- Features: `feature/description`
- Bug fixes: `fix/description`
- Refactoring: `refactor/description`
- Documentation: `docs/description`

### Commit Message Format
```
type(scope): vX.Y.Z - description

Examples:
feat(auth): v3.6.0 - Add Authentik OAuth2 integration
fix(ui): v3.6.7 - Fix progress display in assessment history
refactor(api): v3.6.2 - Consolidate AI client logic
docs(readme): v3.6.0 - Update deployment instructions
```

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type
- [ ] Feature
- [ ] Bug Fix
- [ ] Refactoring
- [ ] Documentation
- [ ] Tests

## Related Issue
Closes #123

## Changes Made
- [ ] Feature spec created (if applicable)
- [ ] Implementation completed
- [ ] Tests added
- [ ] Documentation updated
- [ ] Definition of Done checklist met

## Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Tested on Chrome, Firefox, Edge, Safari

## Screenshots
(if UI changes)

## Checklist
- [ ] Code follows style guides
- [ ] No linting errors
- [ ] No type errors
- [ ] All tests passing
- [ ] Documentation updated
```

## Troubleshooting

### Common Issues

#### Issue: Frontend won't start
**Solution**:
```bash
# Check if port 5173 is in use
lsof -i :5173

# Kill process if needed
kill -9 <PID>

# Clear cache and restart
rm -rf node_modules/.vite
npm run dev
```

#### Issue: Backend won't start
**Solution**:
```bash
# Check if PostgreSQL is running
docker compose ps db

# Start database if not running
docker compose up -d db

# Check database logs
docker compose logs db
```

#### Issue: Database connection failed
**Solution**:
```bash
# Check environment variables
cat .env | grep POSTGRES

# Verify database is accessible
docker compose exec db psql -U postgres -d opsidentity -c "SELECT 1;"

# Reset database (caution: deletes all data)
docker compose down -v
docker compose up -d
```

#### Issue: AI API errors
**Solution**:
```bash
# Check API key is set
echo $OPENAI_API_KEY

# Test API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Update API key in admin panel
```

#### Issue: Build fails
**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version (must be 18+)
node --version

# Update Node.js if needed
nvm install 18
nvm use 18
```

## Development Best Practices

### Code Organization
1. **Components**: Keep components focused and reusable
2. **Utilities**: Extract common logic to `lib/utils.ts`
3. **API Calls**: Use centralized `lib/api.ts`
4. **Types**: Define types in shared locations

### Performance
1. **Lazy Loading**: Use React.lazy() for routes
2. **Memoization**: Use React.memo() for expensive components
3. **Debouncing**: Use lodash.debounce for search inputs
4. **Code Splitting**: Use dynamic imports for large libraries

### Security
1. **Validation**: Validate all inputs on client and server
2. **Sanitization**: Use DOMPurify for user-generated content
3. **Escaping**: Use React's built-in escaping
4. **Auth**: Check authentication on protected routes
5. **Secrets**: Never commit API keys or secrets

### Accessibility
1. **Semantic HTML**: Use proper elements (nav, main, button)
2. **ARIA Labels**: Add labels for non-text content
3. **Keyboard Navigation**: Ensure all elements are accessible
4. **Focus Management**: Manage focus in modals and dialogs
5. **Color Contrast**: Ensure WCAG AA compliance

---

**This workflow applies to both human developers and AI assistants. Follow these steps consistently.**
