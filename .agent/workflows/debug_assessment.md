---
description: Run full debug suite on an assessment (Validate, Dashboard Data, Word Data, JSON, Trigger Analysis)
---

This workflow executes the 5 debug APIs created to validate assessments and detect hallucinations.

1. **Verify Assessment ID**: Ensure you have the Target Assessment ID.
2. **Run Validation (Hallucination Check)**:
   `curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/validate"`
3. **Check Dashboard Data**:
   `curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/dashboard-data"`
4. **Check Word Report Data**:
   `curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/word-data"`
5. **Check Raw JSON Structure (Head)**:
   `curl -s "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/json" | head -c 1000`
6. **Trigger Re-Analysis (OPTIONAL)**:
   > **WARNING**: This action resets the assessment and overwrites findings.
   `curl -X POST "https://ad360.gytech.com.pe/api/debug/assessments/<ASSESSMENT_ID>/analyze"`
