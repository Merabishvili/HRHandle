# Claude Code Workflow Process

> This document defines the mandatory process for working with Claude Code on this project — from the initial analytical prompt through to final, merged changes. Following this process ensures docs stay current, tests stay green, and nothing gets missed.

---

## Core Principle

**Every change touches four things: code, docs, tests, and a ripple-check.**  
Claude Code must never change one without checking the other three.

---

## The 5-Phase Workflow

```
PHASE 1: Analytical Prompt
        ↓
PHASE 2: Impact Analysis (read docs first)
        ↓
PHASE 3: Implementation Plan (confirm before coding)
        ↓
PHASE 4: Execution (code + docs + tests together)
        ↓
PHASE 5: Final Verification Checklist
```

---

## Phase 1 — Analytical Prompt

Before writing a single line of code, frame the request clearly.

**A good prompt includes:**
- What needs to change and why
- Which part of the system it affects (frontend, backend, DB, integration, API)
- Any constraints or decisions already made

**Example prompt structure:**
```
Context: [What area of the app / which doc section this relates to]
Goal: [What outcome is needed]
Constraint: [Any decisions, patterns, or rules to follow]
Question / Task: [The actual request]
```

**Claude Code must respond with a plan — not code — first.**  
If it jumps straight to code, push back and ask for Phase 2 first.

---

## Phase 2 — Impact Analysis (Read Docs First)

Before touching any code, Claude Code reads the relevant docs files.

### Docs reading order:
1. `docs/3-architecture/overview.md` — always read first for context
2. The specific area file (e.g. `frontend.md`, `backend.md`, `database.md`)
3. Any relevant integration file under `docs/4-integrations/`
4. `docs/2-business/roles-permissions.md` — if the change touches auth or access
5. `docs/7-api/endpoints.md` — if the change touches any API surface
6. `docs/8-decisions.md` — check if a relevant architectural decision already exists

### Claude Code must then identify:

| Category | Question to answer |
|---|---|
| **Direct files** | Which files are directly modified? |
| **Dependent files** | What else imports or depends on those files? |
| **Type/interface changes** | Does a shared type or interface need updating? |
| **API surface** | Does an endpoint signature or response shape change? |
| **DB schema** | Does a migration need to be added? |
| **Environment variables** | Does `docs/5-environment/variables.md` need updating? |
| **Integrations** | Is a third-party integration affected? |
| **UI texts** | Does `docs/ui-texts.md` need updating? |
| **Docs affected** | Which docs/*.md files are now out of date? |
| **Tests affected** | Which unit/integration tests need to change or be added? |

**Claude Code must output this as a numbered impact list before proceeding.**

---

## Phase 3 — Implementation Plan

Claude Code presents a plan and waits for approval.

### Plan format:
```
## Implementation Plan

### Files to change:
1. [file path] — [what changes and why]
2. ...

### Docs to update:
1. [doc path] — [what section changes]
2. ...

### Tests to add/update:
1. [test file] — [what scenario is covered]
2. ...

### Decisions to record (if any):
- [Any new architectural decision for docs/8-decisions.md]

### Risks / open questions:
- [Anything that needs clarification before proceeding]
```

**Do not proceed to Phase 4 until the plan is confirmed.**

---

## Phase 4 — Execution

Work in this order, not code-first:

### 4a. Code changes
- Implement the feature/fix
- Follow existing patterns (check `docs/3-architecture/` for conventions)
- Do not introduce new patterns without recording them in docs

### 4b. Docs update (immediately after code, same session)

Mandatory docs to check after every change:

| Change type | Docs to update |
|---|---|
| New endpoint | `docs/7-api/endpoints.md` |
| New/changed DB table or field | `docs/3-architecture/database.md` |
| New frontend component or pattern | `docs/3-architecture/frontend.md` |
| New backend service or pattern | `docs/3-architecture/backend.md` |
| New integration or config change | `docs/4-integrations/[service].md` |
| New env variable | `docs/5-environment/variables.md` + `local.md` |
| New deployment step or config | `docs/6-deployment/deployment.md` |
| New role or permission | `docs/2-business/roles-permissions.md` |
| New UI string | `docs/ui-texts.md` |
| New business rule or process | `docs/2-business/processes.md` |
| Architectural decision made | `docs/8-decisions.md` |

> Rule: if you had to think about how something works while implementing it, that thinking belongs in the docs.

### 4c. Tests update (same session, never deferred)

- Update any existing tests that now fail due to the change
- Add new unit tests for new logic
- Add/update integration tests for new API endpoints
- If a test is deleted, document why in a code comment
- Aim for: every public function has a test; every API endpoint has at least one happy-path and one error-path test

---

## Phase 5 — Final Verification Checklist

Before declaring the task done, run through this checklist:

```
CODE
[ ] The feature/fix works as described
[ ] No existing functionality is broken
[ ] No console errors or type errors
[ ] Code follows existing conventions (see architecture docs)

DOCS
[ ] All affected docs/*.md files are updated
[ ] docs/8-decisions.md updated if any architectural decision was made
[ ] No doc references a file, endpoint, or variable that no longer exists

TESTS
[ ] All existing tests pass
[ ] New tests are added for new logic
[ ] Test descriptions clearly state what is being tested

RIPPLE CHECK
[ ] Searched codebase for other usages of changed functions/types/endpoints
[ ] Checked that no other feature silently depends on changed behavior
[ ] If a shared utility changed, all callers were reviewed
```

**If any checkbox is unchecked, the task is not done.**

---

## Ripple-Check Patterns

These are the most commonly missed ripple effects. Claude Code must check these explicitly:

### 1. Type / interface changes
If a TypeScript type or interface changes, search for every file that imports it. Each one may need updating.

### 2. Renamed or moved functions
Search for all call sites. Update import paths across the codebase.

### 3. API response shape changes
If the shape of an API response changes:
- Update `docs/7-api/endpoints.md`
- Find all frontend code that consumes that endpoint
- Find all tests that mock that response

### 4. Database schema changes
- Ensure migration file is created
- Update `docs/3-architecture/database.md`
- Check seed data and factory files used in tests

### 5. Environment variable changes
- Update `docs/5-environment/variables.md`
- Update `docs/5-environment/local.md` if local dev setup changes
- Notify team to update their `.env` files

### 6. Third-party integration changes
- Update the relevant file under `docs/4-integrations/`
- Check if webhook handlers, event listeners, or SDK versions are affected

---

## Keeping Docs Accurate Long-Term

### Rule: Docs are part of the Definition of Done
A task is not complete if docs are not updated. Treat a stale doc as a bug.

### Suggested: Add a docs review to PR checklist
Before merging any PR, verify:
- Were any of the 8 doc sections affected by this PR?
- Are they updated?

### Suggested: Periodic docs audit
Every few sprints, run through `docs/` and verify:
- Every endpoint in `7-api/endpoints.md` still exists in the codebase
- Every env variable in `5-environment/variables.md` is still used
- Every integration in `4-integrations/` is still active

---

## Quick Reference Card

```
New task arrives
    → Read relevant docs first
    → Output impact list
    → Write plan, wait for approval
    → Code + docs + tests (together, same session)
    → Run verification checklist
    → Done
```

---

## Anti-Patterns to Avoid

| Anti-pattern | Why it's a problem |
|---|---|
| Code first, docs later | "Later" never comes; docs drift from reality |
| Skip tests for "small changes" | Small changes break things quietly |
| Only update the file you're editing | Ripple effects cause subtle bugs |
| Ask Claude Code to "just fix this one thing" | Claude needs full context to avoid missing impacts |
| Merge without checking docs checklist | One stale doc makes the whole docs folder less trustworthy |
