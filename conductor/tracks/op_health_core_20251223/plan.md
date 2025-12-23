# Plan: Operational Health Core Implementation

## Phase 1: PowerShell Script Enhancement (FSMO & Trusts)
- [ ] Task: Implement `Get-FSMOHealthCheck` function in `NewAssessment.tsx`
    - Create the PowerShell function string.
    - Logic to check role accessibility and PDC time sync source.
    - Logic to detect single point of failure.
- [ ] Task: Implement `Get-TrustHealthValidation` function in `NewAssessment.tsx`
    - Create the PowerShell function string.
    - Logic to validate trusts (Test-ComputerSecureChannel).
    - Logic to check trust password age.
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: PowerShell Script Enhancement (Topology & Integration)
- [ ] Task: Update `Get-ADSiteTopology` in `NewAssessment.tsx`
    - Refine logic for Sites without Subnets and Subnets without Sites.
    - Add connection analysis (Manual vs KCC).
- [ ] Task: Integrate new functions into `generateScript`
    - Ensure new functions are called in the main script execution flow.
    - Ensure output is added to the final JSON object.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Verification
- [ ] Task: Verify Backend Mapping
    - Review `server/server.js` `extractCategoryData` to confirm it matches the new JSON keys.
    - (Optional) Create a test JSON payload to simulate the new script output and verify backend processing.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
