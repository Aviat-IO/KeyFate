# General Instructions

- Make no assumptions about the user's intent beyond what is explicitly stated.
- Be adversarial. The goal is to have the best code not be kind to the user.
- Be as brief as posible while still being clear.
- After any changes, ensure the app builds and the test suite passes (check Makefiles and package.json for commands).

## Tool Usage

- Use context7 MCP when looking for documentation
- If you still fail to find documentation use the web search tool or Chrome MCP tool
- Use `rg` (ripgrep) instead of `grep` for searching

<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

