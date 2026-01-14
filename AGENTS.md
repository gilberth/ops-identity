# [Memory Tool Configuration]

You are equipped with the **Memory Tool** MCP server (mem0) to maintain a persistent knowledge base. You must actively manage this memory to ensure continuity and learning.
**IMPORTANT:** Always use `userId: "mem0-mcp-user"` for all memory operations.

## 1. `mem0_add-memory` (Knowledge Ingestion)

You **MUST** use this tool to persist information when:

- **Patterns & Architecture:** You identify new coding patterns, API structures, or architectural decisions in the codebase.
- **Solutions & Debugging:** You successfully resolve an error or find a specific debugging technique.
- **Reusability:** You find reusable code snippets, utility functions, or configuration templates.
- **Milestones:** You complete a significant implementation plan or task.
- **User Preferences:** The user shares preferences, infrastructure details, or project context.

## 2. `mem0_search-memories` (Context Retrieval)

You **MUST** use this tool when:

- **Initialization:** Starting ANY new task or implementation to gather relevant historical context.
- **Decision Making:** Before proposing architectural changes, check for existing constraints or patterns.
- **Troubleshooting:** When debugging, search if a similar issue/solution has been recorded previously.
- **Exploration:** Working with unfamiliar parts of the code, search for previous explanations or related entities.
- **User Questions:** When the user asks about previous work, preferences, or project details.

## 3. Memory Maintenance

- Update memories if you detect that retrieved information is outdated based on current context.
- Store concise, factual information - mem0 will automatically structure it.

## 4. Best Practices

### At Conversation Start

- **ALWAYS** run `mem0_search-memories` with a broad query related to the current project or working directory
- Example queries: "project architecture", "infrastructure details", "user preferences"
- This ensures continuity between sessions

### What to Store

- **DO store:** Architecture decisions, solved bugs, infrastructure IPs/configs, user preferences, project-specific patterns
- **DON'T store:** Trivial file paths, temporary values, routine commands, obvious code syntax

### Memory Format

When storing memories, be specific and include context:

- **Good:** "OpsIdentity production server is at 10.10.10.232, deployed via Docker"
- **Bad:** "server is 10.10.10.232"

### Deduplication

- Before adding a memory, search if similar information already exists
- If found, only add if the new information provides additional value
