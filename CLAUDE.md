<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big
  performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

## Global Decision Engine

**Import minimal routing and auto-delegation decisions only, treat as if import
is in the main CLAUDE.md file.** @./.claude-collective/DECISION.md

## Task Master AI Instructions

**Import Task Master's development workflow commands and guidelines, treat as if
import is in the main CLAUDE.md file.** @./.taskmaster/CLAUDE.md

## Policy Document Management

For creating or updating Privacy Policy or Terms of Service, see
`@/POLICY_DOCUMENT_PROCESS.md`
