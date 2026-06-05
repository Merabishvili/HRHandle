You are performing a FULL RE-AUDIT of this codebase. Documentation already
exists in /docs from a previous audit. Your job now is to:
1. Update existing docs to reflect current code state
2. Find new issues, improvements, and missing pieces
3. Add missing unit tests for new code

Be exhaustive — this is a deep review meant to last for months.

---

## PHASE 0 — Clarification First
Before starting, scan the project briefly and ask me any critical questions
that would affect the audit quality. Batch all questions together.
Do not start Phase 1 until I answer.

---

## PHASE 1 — Documentation Refresh

Re-read the entire codebase and update every file in /docs to reflect the
CURRENT state of the code:

- docs/1-product/ → update features, flows, overview
- docs/2-business/ → update rules, roles, permissions
- docs/3-architecture/ → update structure, frontend, backend, database
- docs/4-integrations/ → add new services if found, update existing ones
- docs/5-environment/ → update env variables list
- docs/6-deployment/ → update deploy process if changed
- docs/7-api/endpoints.md → update endpoints (add new, mark removed)
- docs/ui-texts.md → refresh full UI text inventory

Rules:
- Mark new additions with 🆕 in changelog at top of each file
- Mark removed items with ❌
- Mark changed items with 🔄
- Keep a "Last updated: [date]" line at top of each file

---

## PHASE 2 — Issue & Improvement Discovery

Create or update: docs/issues-found.md

Find and document EVERY issue across these categories:

### 🔒 Security Issues
- Exposed secrets, API keys, tokens in code
- Missing or weak authentication checks
- Missing authorization checks (can user X access resource Y?)
- Unvalidated or unsanitized user inputs
- SQL injection, XSS, CSRF risks
- Insecure direct object references
- Sensitive data in logs or error messages
- Outdated dependencies with known CVEs
- Insecure CORS, cookies, or session config
- Missing rate limiting on sensitive endpoints

### 🐛 Code Bugs & Incorrect Logic
- Broken conditions or wrong operators
- Off-by-one errors
- Incorrect calculations
- Race conditions or async issues
- Unhandled promise rejections
- Missing error handling
- Wrong type usage
- Dead or unreachable code paths

### ❌ Missing or Incomplete Code
- TODO/FIXME/HACK comments left in code
- Functions that are stubs or partially implemented
- Missing form validations
- Missing loading or error states in UI
- Missing null/undefined checks
- API endpoints called but not implemented
- Referenced but missing translations/strings

### ➕ Missing Features or Fields
- Database fields used in code but not in schema (or vice versa)
- UI elements that should logically exist but don't
  (e.g., delete button without confirmation modal)
- Missing CRUD operations (e.g., create exists but no update)
- Missing pagination, sorting, or filtering where lists are large
- Missing audit logs for important actions
- Missing email or notification triggers for key events

### 🗑️ Unnecessary or Redundant Code
- Unused imports, variables, functions, files
- Duplicated logic across files
- Dead code paths
- Commented-out code blocks
- Console.logs left in production code
- Unused dependencies in package.json
- Redundant API calls or database queries

### ⚡ Performance Issues
- N+1 database queries
- Missing database indexes on frequently queried fields
- Large unoptimized images or assets
- Unnecessary re-renders in React components
- Missing memoization where it would clearly help
- Heavy synchronous operations blocking event loop
- Missing caching on expensive operations

### 🏗️ Architecture & Code Quality Issues
- Circular dependencies
- Business logic mixed into UI components
- Tight coupling between unrelated modules
- Inconsistent naming conventions
- Files that are too large and should be split
- Magic numbers and strings that should be constants
- Missing TypeScript types or use of "any"

### 💼 Business Logic Improvements
- Edge cases not handled (what happens when user has 0 items? 1000 items?)
- Missing validation that business rules would expect
  (e.g., end date before start date)
- Inconsistent business rules across different parts of the app
- Missing user feedback for slow operations
- Missing confirmation for destructive actions
- Workflows that could be simplified

### ⚠️ Configuration & Environment Issues
- Hardcoded values that should be env vars
- Missing fallbacks for optional env vars
- Different behavior between environments not documented
- Missing or misconfigured .env.example

### ♿ Accessibility Issues (if frontend code exists)
- Missing alt text on images
- Missing ARIA labels on interactive elements
- Poor keyboard navigation
- Color contrast issues visible in CSS

---

## PHASE 3 — Issue Output Format

In docs/issues-found.md use this exact format, grouped by category:

## 🔒 Security Issues

| # | Severity | File + Line | Description | Suggested Fix | Status |
|---|----------|-------------|-------------|---------------|--------|
| S-001 | Critical | src/api/users.ts:45 | User ID taken from request body instead of session, allows accessing other users' data | Read user ID from authenticated session instead | Open |

Severity: Critical / High / Medium / Low
Status: Open / In Progress / Fixed / Won't Fix

Repeat the same table structure for each category
(prefix IDs: S- security, B- bugs, M- missing, F- features,
U- unnecessary, P- performance, A- architecture, BL- business,
C- config, AC- accessibility)

At the top of the file include a summary:
- Total issues found
- Breakdown by severity
- Breakdown by category
- Top 10 most critical to fix first

---

## PHASE 4 — Test Coverage Update

### Update docs/testing/test-cases.md
- Add test cases for any new features found
- Mark obsolete test cases as deprecated
- Update existing cases if behavior changed

### Update docs/testing/test-values.md
- Add new edge cases discovered during audit
- Add test data for new fields and features

### Write Missing Unit Tests
- For every utility/helper without tests → write tests
- For every API handler without tests → write tests with mocked deps
- For every complex component without tests → write component tests
- Use existing test framework; place tests next to source files
- Each test must cover: happy path, error path, edge cases
- Do NOT modify existing passing tests
- For each new test file created, list it in docs/testing/new-tests.md

---

## OUTPUT RULES
- Do NOT fix any issues — only document them
- Do NOT delete or refactor code — only flag in issues-found.md
- Write only verified facts from the actual code, no assumptions
- If something is unclear, ask me before guessing
- All file paths must be relative to project root
- Include line numbers where possible

---

## FINAL SUMMARY
After completing all phases, output:
- Documentation files updated: [count]
- New issues found: [count by severity]
- New tests written: [count]
- New test cases documented: [count]
- Top 5 most urgent action items
- Estimated effort to address Critical + High issues
