# Definition of Done

## Overview
This document defines when a feature, task, or project is considered "done" in the OpsIdentity codebase. It applies to all work done by human developers and AI assistants.

## Code Quality Criteria

### [CQ-1] Code Review
- [ ] Code has been reviewed by at least one peer
- [ ] All review comments have been addressed or explicitly deferred
- [ ] Code follows project coding standards (see `conductor/code_styleguides/`)

### [CQ-2] Testing
- [ ] Unit tests added for new logic (functions, utilities)
- [ ] Integration tests added for new API endpoints
- [ ] E2E tests added for new user workflows
- [ ] All tests pass locally
- [ ] Code coverage has not decreased below previous baseline

### [CQ-3] Linting and Type Checking
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run typecheck` passes with 0 errors (or equivalent for backend)
- [ ] No new warnings introduced

### [CQ-4] Code Style
- [ ] Follows TypeScript/JavaScript style guides in `conductor/code_styleguides/`
- [ ] No commented-out code blocks
- [ ] No console.log or debugger statements in production code
- [ ] Consistent formatting with existing code (use Prettier if configured)

## Documentation Criteria

### [DC-1] Code Comments
- [ ] Complex functions have JSDoc/TypeDoc comments
- [ ] Non-obvious logic is explained with inline comments
- [ ] No "magic numbers" or hardcoded values without explanation
- [ ] Edge cases and error scenarios are documented

### [DC-2] User Documentation
- [ ] Feature documented in `docs/02-features/feature-<name>/feature-spec.md`
- [ ] User-facing changes documented in CLAUDE.md
- [ ] API changes documented (if applicable)
- [ ] New environment variables documented in env.example

### [DC-3] Developer Documentation
- [ ] Architecture changes documented in `docs/00-context/system-state.md`
- [ ] Tech design decisions documented in `docs/03-logs/decisions-log.md`
- [ ] Implementation log updated in `docs/03-logs/implementation-log.md`

## Functional Criteria

### [FC-1] Acceptance Criteria
- [ ] All acceptance criteria in feature-spec.md are met
- [ ] User story is fully implemented
- [ ] Edge cases and error scenarios are handled

### [FC-2] Testing Manual
- [ ] Manual testing performed in development environment
- [ ] Manual testing performed in staging environment (if available)
- [ ] Feature tested on all supported browsers (Chrome, Firefox, Edge, Safari)
- [ ] Feature tested on different screen sizes (desktop, tablet, mobile)

### [FC-3] Error Handling
- [ ] All API errors are handled with user-friendly messages
- [ ] Network errors have retry logic (where appropriate)
- [ ] Validation errors show clear guidance
- [ ] Errors are logged for debugging (no sensitive data)

### [FC-4] Performance
- [ ] API response time < 500ms (p95)
- [ ] Database query time < 1s (p95)
- [ ] Frontend load time < 3s
- [ ] No memory leaks (test with Chrome DevTools memory profiler)

## Security Criteria

### [SC-1] Input Validation
- [ ] All user inputs are validated on both client and server
- [ ] No SQL injection vulnerabilities (use prepared statements)
- [ ] No XSS vulnerabilities (use DOMPurify, React escaping)
- [ ] File uploads validated (type, size, content)

### [SC-2] Data Privacy
- [ ] No sensitive data (passwords, tokens, keys) in logs
- [ ] No sensitive data in client-side code
- [ ] API keys stored in environment variables only
- [ ] Data at rest encrypted (PostgreSQL encryption configured)

### [SC-3] Authentication/Authorization
- [ ] Protected routes check authentication
- [ ] API endpoints validate user permissions
- [ ] Session management is secure (httpOnly cookies, HTTPS only)
- [ ] CSRF protection enabled

## Accessibility Criteria

### [AC-1] Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Tab order is logical
- [ ] No keyboard traps

### [AC-2] Screen Reader Support
- [ ] All images have alt text
- [ ] Forms have associated labels
- [ ] ARIA labels for non-text content
- [ ] Semantic HTML elements used

### [AC-3] Visual Clarity
- [ ] Color contrast ratio ≥ 4.5:1 for normal text
- [ ] Color contrast ratio ≥ 3:1 for large text
- [ ] Text can be resized to 200% without loss of functionality
- [ ] No reliance on color alone to convey information

## Deployment Criteria

### [DC-1] Deployment Testing
- [ ] Feature tested in local development environment
- [ ] Feature tested in Docker environment
- [ ] Database migrations tested (if applicable)
- [ ] Rollback plan documented

### [DC-2] Configuration
- [ ] New environment variables documented in env.example
- [ ] Configuration is backward compatible
- [ ] Default configuration values are safe
- [ ] No hardcoded configuration in production code

### [DC-3] Monitoring
- [ ] Relevant metrics are logged (performance, errors, business events)
- [ ] Health checks updated (if applicable)
- [ ] Error tracking configured (Sentry, etc.)
- [ ] Alert rules defined (if applicable)

## Anti-Hallucination Criteria (AI Features Only)

### [AH-1] Validation Rules
- [ ] All new `type_id` values have validation rules in `ATTRIBUTE_VALIDATION_RULES`
- [ ] Validation rules check both object existence and attributes
- [ ] Validation rules are tested against real data
- [ ] Validation rules documented in server.js comments

### [AH-2] Prompts
- [ ] Anti-hallucination rules included in prompt: "⚠️ REGLA ANTI-ALUCINACIÓN: Solo reporta objetos que aparezcan EXPLÍCITAMENTE en los datos"
- [ ] Prompt follows guidelines in `guiaprompt.md`
- [ ] Prompt includes compliance mappings (CIS, NIST, ISO 27001, etc.)
- [ ] Prompt includes PowerShell remediation commands
- [ ] Prompt includes 4-5 phase implementation roadmap

### [AH-3] Validation Testing
- [ ] Test with known good data (should produce 0 findings)
- [ ] Test with known bad data (should detect all issues)
- [ ] Manual verification of AI findings against source data
- [ ] False positive rate < 5%
- [ ] False negative rate < 10%

## PS1 Feature Development (Mandatory Workflow)

### [PS-1] Data Collection
- [ ] PowerShell function added to NewAssessment.tsx
- [ ] Function collects structured data with meaningful property names
- [ ] Function includes counts and arrays for hygiene analysis
- [ ] Function has error handling and validation
- [ ] Function tested on actual AD environment

### [PS-2] LLM Analysis Prompt
- [ ] Prompt added/extended in server.js
- [ ] Prompt follows `guiaprompt.md` guidelines
- [ ] Prompt focuses on operational hygiene (NOT security pentesting)
- [ ] Prompt includes anti-hallucination rules
- [ ] Prompt includes compliance mappings

### [PS-3] DOCX Report Generation
- [ ] Section added to reportGenerator.ts
- [ ] Uses docx library patterns (numbering, Table with columnWidths)
- [ ] Includes remediation recommendations
- [ ] Includes tables for structured data
- [ ] Professional formatting (colors, fonts)

### [PS-4] Anti-Hallucination Validation
- [ ] Validation rule added to `ATTRIBUTE_VALIDATION_RULES`
- [ ] Rule checks both object existence and attributes
- [ ] Rule tested against real data
- [ ] Rule includes validateAffectedObject for nested data
- [ ] Validation happens automatically via validateFindings()

## Git and Version Control

### [VC-1] Commit Messages
- [ ] Commit message follows format: `type(scope): vX.Y.Z - description`
- [ ] Commit message is concise and descriptive
- [ ] Commit message explains "why" not just "what"
- [ ] No merge commits in feature branch history

### [VC-2] Branching
- [ ] Feature branch created from main
- [ ] Branch name follows convention: `feature/description` or `fix/description`
- [ ] Branch is up-to-date with main before merging
- [ ] No direct commits to main (except hotfixes)

### [VC-3] Pull Request
- [ ] PR description includes summary of changes
- [ ] PR includes link to issue/feature spec
- [ ] PR includes screenshots for UI changes
- [ ] PR includes test results (if applicable)
- [ ] PR passes all CI checks

## Definition of Done vs. Definition of Ready

### Definition of Ready (Before Starting Work)
- [ ] Feature spec exists in `docs/02-features/`
- [ ] Acceptance criteria are clear and testable
- [ ] Technical design is documented
- [ ] Dependencies are identified
- [ ] Work is estimated
- [ ] Team has capacity

### Definition of Done (After Completing Work)
- [ ] All criteria above are met
- [ ] Feature is merged to main
- [ ] Feature is deployed to staging
- [ ] Feature is tested in staging
- [ ] Feature is approved by product owner

## Checklist for Different Work Types

### New Feature
- [ ] Feature spec created (feature-spec.md, tech-design.md, dev-tasks.md, test-plan.md)
- [ ] Design reviewed with team
- [ ] Implementation completed
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Code reviewed
- [ ] Deployed to staging
- [ ] Tested in staging
- [ ] Approved for production

### Bug Fix
- [ ] Bug reproduced in development environment
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Regression tests added
- [ ] Fix tested in development environment
- [ ] Fix tested in staging environment
- [ ] Documentation updated (if applicable)

### Refactoring
- [ ] Refactoring goal defined
- [ ] Existing tests continue to pass
- [ ] New tests added for refactored code
- [ ] No new functionality introduced
- [ ] Performance tested (if applicable)
- [ ] Code reviewed

### Documentation Update
- [ ] Documentation is accurate and complete
- [ ] Screenshots are up-to-date
- [ ] Code examples are tested
- [ ] Links are valid
- [ ] Spelling and grammar checked
- [ ] Reviewed by subject matter expert

---

**This document applies to ALL work in the codebase. All tasks must meet these criteria before being considered done.**
