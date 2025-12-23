# Project Workflow - OpsIdentity

## Development Process
This project follows a structured development process managed by Conductor.

## Workflow Rules
1.  **Test-Driven Development:** Every feature implementation task must be preceded by a task to write the corresponding tests.
2.  **Test Coverage:** A minimum of **80%** code test coverage is required for all new code.
3.  **Atomic Commits:** Changes must be committed **after each task** is completed.
4.  **Task Summaries:** Use **Git Notes** to record a concise summary of the work performed in each task.
5.  **Phase Completion:** After all tasks in a phase are complete, perform a manual verification and checkpointing protocol.

## Phase Completion Verification and Checkpointing Protocol
Before marking a phase as complete:
1.  Verify that all tasks in the phase are finished and tests pass.
2.  Ensure documentation is updated if necessary.
3.  Execute the task: `Task: Conductor - User Manual Verification '<Phase Name>'`.