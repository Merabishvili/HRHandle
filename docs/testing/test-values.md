# Test Values

_Last updated: 2026-07-20_

## Changelog

- 🆕 **(2026-07-20/21 audit) Edge-case values now pinned by unit tests** (see `docs/testing/new-tests.md`): CSV formula-injection leading chars (`= + - @` tab CR), offer expiry YMD boundaries (expires-today vs yesterday vs future; urgency 1/≤7/normal), knockout number ranges (lte/gte/between) + case-insensitive select, `normalizeQuery` min-length + ilike-escaping (`% _ \\`), audit-filter date/UUID validation, import `years_of_experience` comma-decimal, empty-cell → null normalisation, `defaultMergeChoice` empty/whitespace precedence.
- 🆕 CV-parsing edge cases (file types, magic bytes, size)
- 🆕 LinkedIn page-ID accepted / rejected inputs
- 🆕 Candidate experience & education edge cases (open-ended dates, future end dates, very long strings)
- 🆕 Boundary values for new `candidates` columns (`location`, `timezone`, `languages`, `salary_expectation`, `notice_period`)

---

## CV Parse (added 2026-05-08)

| Case | Value | Expected |
|---|---|---|
| Valid PDF | `<5 MB application/pdf>` starting with `%PDF-` | 200 + parsed JSON |
| Valid DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` starting with `PK..` | 200 + parsed JSON |
| Valid DOC | `application/msword` with OLE2 header | 200 + parsed JSON |
| Wrong MIME | `cv.txt` `text/plain` | 400 `parse_failed` |
| Too large | 11 MB PDF | 400 `parse_failed` |
| Empty file | `cv.pdf` size 0 | 400 `parse_failed` |
| Magic-byte mismatch | `text/plain` renamed to `cv.pdf` | 400 `parse_failed` |
| Same IP, 11th call within hour | n/a | 429 `rate_limited` |
| Parser timeout | n/a (simulate Gemini > 25 s) | 504 `timeout` |

## LinkedIn Page ID (added 2026-05-08)

| Case | Value | Expected |
|---|---|---|
| Numeric | `12345` | `?linkedin=connected` |
| Full URL | `https://www.linkedin.com/company/12345/` | `?linkedin=connected` |
| Shortened URL | `linkedin.com/company/acme-inc/` | `?linkedin=invalid_page_id` |
| Plain text | `acme` | `?linkedin=invalid_page_id` |
| Empty | `""` | `?linkedin=invalid_page_id` |

## Candidate Profile (added 2026-05-08)

| Field | Valid examples | Invalid examples |
|---|---|---|
| `location` (max 200) | `"Lisbon, Portugal"`, `""` (null OK) | 201-char string |
| `timezone` (max 100) | `"Europe/London"`, `"UTC"` | Non-IANA strings still accepted (no enum check) |
| `languages` (text[]) | `["en","pt"]`, `[]` | None (free-form) |
| `salary_expectation` (max 200) | `"$80k–$100k"` | 201-char string |
| `notice_period` (max 100) | `"2 weeks"`, `"1 month"` | 101-char string |

## Candidate Experience (added 2026-05-08)

| Case | Value | Expected |
|---|---|---|
| Current job | `start_date='2024-01-01'`, `end_date=null`, `is_current=true` | Insert OK |
| Past job | `start_date='2022-01-01'`, `end_date='2023-12-31'`, `is_current=false` | Insert OK |
| `YYYY-MM` form input | `"2024-01"` | Padded to `"2024-01-01"` by `padDate` helper |
| Open-ended (no dates) | both null, `is_current=false` | Insert OK |
| End before start | `start_date='2024-05-01'`, `end_date='2024-01-01'` | **Not currently rejected** — see `F-007` |

## Plan Limits (added 2026-05-08)

| Plan | vacancy_limit | candidate_limit | member_limit | Notes |
|---|---|---|---|---|
| trial | 5 | 100 | **2** | Was incorrectly 3 in earlier docs |
| individual | 500 | 10 000 | 3 | $20/mo, $16/mo annual |
| organization | 1 000 | 20 000 | 50 | $40/mo, $32/mo annual |

---

## Emails

| Value | Type | Notes |
|---|---|---|
| `user@example.com` | Valid | Standard email |
| `user+tag@example.com` | Valid | Plus-addressing |
| `user@subdomain.example.com` | Valid | Subdomain |
| `USER@EXAMPLE.COM` | Valid | Case-insensitive |
| `u@e.co` | Valid | Minimal valid email |
| `` (empty) | Valid (candidate) | Optional on candidate; treated as null |
| `notanemail` | Invalid | No @ or domain |
| `@example.com` | Invalid | Missing local part |
| `user@` | Invalid | Missing domain |
| `user @example.com` | Invalid | Space in local part |
| `user@example` | Invalid | No TLD (depends on validator) |

---

## Passwords

| Value | Type | Notes |
|---|---|---|
| `Password1!` | Valid | 8 chars, mixed |
| `12345678` | Valid | Exactly 8 chars (minimum) |
| `a`.repeat(72) | Valid | Long password |
| `1234567` | Invalid | 7 chars — too short |
| `` (empty) | Invalid | Required |
| `       ` (7 spaces) | Invalid | 7 chars |
| `        ` (8 spaces) | Boundary valid | Exactly 8 chars (whitespace-only passes length check) |

---

## Candidate — First Name / Last Name

| Value | Type | Notes |
|---|---|---|
| `John` | Valid | Standard |
| `Mary-Jane` | Valid | Hyphenated |
| `Jöhn` | Valid | Unicode character |
| `J` | Valid | Single character |
| `A`.repeat(100) | Valid (boundary) | Exactly max(100) |
| `A`.repeat(101) | Invalid | Exceeds max(100) |
| `` (empty) | Invalid | Required |
| `   ` (whitespace only) | Invalid | Required (after trim) |

---

## Candidate — Phone

| Value | Type | Notes |
|---|---|---|
| `+995 555 123456` | Valid | International format |
| `555-123-4567` | Valid | US format |
| `+1 (800) 555-0100` | Valid | US with country code |
| `` (empty) | Valid | Optional |
| `A`.repeat(30) | Valid (boundary) | Exactly max(30) |
| `A`.repeat(31) | Invalid | Exceeds max(30) |

---

## Candidate — Years of Experience

| Value | Type | Notes |
|---|---|---|
| `0` | Valid (boundary) | Min |
| `1` | Valid | Standard |
| `30` | Valid | Mid-range |
| `60` | Valid (boundary) | Max |
| `-1` | Invalid | Below min(0) |
| `61` | Invalid | Above max(60) |
| `0.5` | Invalid | Not integer (schema uses int()) |

---

## Candidate — LinkedIn URL

| Value | Type | Notes |
|---|---|---|
| `https://linkedin.com/in/johndoe` | Valid | Standard |
| `https://www.linkedin.com/in/johndoe` | Valid | With www |
| `http://linkedin.com/in/johndoe` | Valid | HTTP also valid URL |
| `` (empty) | Valid | Optional — transformed to null |
| `linkedin.com/in/johndoe` | Invalid | Missing scheme |
| `not-a-url` | Invalid | Not a URL |
| `ftp://linkedin.com/in/johndoe` | Valid URL (passes schema) | Schema validates URL format, not scheme |

---

## Candidate — Date of Birth

Today = 2026-05-05

| Value | Type | Notes |
|---|---|---|
| `2010-05-05` | Valid (boundary) | Exactly 16 years ago today |
| `2010-05-04` | Valid | 16 years + 1 day ago |
| `1990-01-01` | Valid | Adult |
| `2010-05-06` | Invalid | 1 day short of 16 years |
| `2020-01-01` | Invalid | 6 years old |
| `2026-05-05` | Invalid | Born today — 0 years old |
| `1900-01-01` | Edge case | Very old date — may pass schema but unrealistic |
| `2026-05-06` | Invalid | Future date |

---

## Vacancy — Title

| Value | Type | Notes |
|---|---|---|
| `Software Engineer` | Valid | Standard |
| `A` | Valid | Single character |
| `A`.repeat(200) | Valid (boundary) | Exactly max(200) |
| `A`.repeat(201) | Invalid | Exceeds max(200) |
| `` (empty) | Invalid | Required |

---

## Vacancy — Salary

| Value | Type | Notes |
|---|---|---|
| min=1000, max=5000 | Valid | Normal range |
| min=0, max=0 | Valid | Both zero (equal) |
| min=5000, max=5000 | Valid (boundary) | Equal values (max >= min) |
| min=5000, max=4999 | Invalid | max < min |
| min=0, max=1 | Valid | Minimal positive range |

---

## Vacancy — Openings Count

| Value | Type | Notes |
|---|---|---|
| `1` | Valid (boundary) | Min and default |
| `10` | Valid | Normal |
| `0` | Invalid | Below min(1) |
| `-1` | Invalid | Negative |

---

## Vacancy — Dates

Today = 2026-05-05

| start_date | end_date | Type | Notes |
|---|---|---|---|
| 2026-05-05 | 2026-06-01 | Valid | End after start |
| 2026-05-05 | 2026-05-05 | Valid (boundary) | Same day (end == start) |
| 2026-05-05 | 2026-05-04 | Invalid | end < start |
| null | null | Valid | Dates optional |
| 2026-05-05 | null | Valid | Only start date set |

---

## Interview — scheduled_at

Now = 2026-05-05T12:00:00Z (example)

| Value | Type | Notes |
|---|---|---|
| `2026-05-06T09:00:00Z` | Valid | Tomorrow |
| `2026-05-05T13:00:00Z` | Valid | 1 hour from now |
| `2026-05-05T12:00:01Z` | Valid (boundary) | 1 second from now |
| `2026-05-05T12:00:00Z` | Invalid | Exactly now — not > now |
| `2026-05-04T09:00:00Z` | Invalid | Yesterday |
| `2025-01-01T00:00:00Z` | Invalid | Past date |
| `not-a-date` | Invalid | Non-parseable string |

---

## Interview — Duration Minutes

| Value | Type | Notes |
|---|---|---|
| `15` | Valid (boundary) | Min |
| `60` | Valid | Default |
| `480` | Valid (boundary) | Max (8 hours) |
| `14` | Invalid | Below min(15) |
| `481` | Invalid | Above max(480) |
| `0` | Invalid | Zero |
| `-1` | Invalid | Negative |

---

## Interview — Type

| Value | Type | Notes |
|---|---|---|
| `phone` | Valid | Phone screen |
| `video` | Valid | Video call |
| `onsite` | Valid | In-person |
| `online` | Invalid | Not in enum |
| `` (empty) | Invalid | Required |
| `PHONE` | Invalid | Case-sensitive enum |

---

## UUIDs

| Value | Type | Notes |
|---|---|---|
| `550e8400-e29b-41d4-a716-446655440000` | Valid | Standard UUIDv4 |
| `00000000-0000-0000-0000-000000000000` | Valid (format) | Nil UUID — may fail FK checks |
| `not-a-uuid` | Invalid | Random string |
| `550e8400-e29b-41d4-a716-44665544000` | Invalid | Too short |
| `550e8400e29b41d4a716446655440000` | Invalid | Missing hyphens |

---

## Email Template Variables

| Template text | vars | Result | Notes |
|---|---|---|---|
| `Hello {{name}}` | `{ name: 'Alice' }` | `Hello Alice` | Standard substitution |
| `Hello {{name}}` | `{ name: '' }` | `Hello ` | Empty string value |
| `Hello {{name}}` | `{}` | `Hello ` | Missing key → empty string |
| `Hello {{name}}` | `{ name: '<script>' }` | `Hello &lt;script&gt;` | HTML escaped |
| `Hello {{name}}` | `{ name: '&"\'>' }` | `Hello &amp;&quot;&#x27;&gt;` | All special chars escaped |
| `No vars here` | `{}` | `No vars here` | No substitution needed |
| `{{a}} {{b}}` | `{ a: 'X', b: 'Y' }` | `X Y` | Multiple vars |

---

## Rate Limits

### Public Apply (IP-based, database-backed)

| Scenario | Result |
|---|---|
| 1st–5th submission from IP in 1 hour | Accepted |
| 6th submission from IP in 1 hour | Rejected (rate limit) |
| 5th submission, then 61 minutes later another | Accepted (window reset) |

### Onboarding API (in-memory, resets on server restart)

| Scenario | Result |
|---|---|
| 1st–5th POST /api/onboarding per user in 60 seconds | Accepted |
| 6th POST /api/onboarding per user in 60 seconds | 429 Too Many Requests |

---

## File Uploads (Documents / CV)

| File | Type | Notes |
|---|---|---|
| Valid 1KB PDF | Valid | Small file |
| Valid 9.9MB PDF | Valid (boundary) | Just under 10MB limit |
| Valid 10MB PDF | Valid (boundary) | Exactly 10MB |
| 10.1MB PDF | Invalid | Exceeds 10MB limit |
| `.docx` file | Valid | MIME: application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| `.doc` file | Valid | MIME: application/msword |
| `.txt` file | Invalid | Unsupported type |
| `.exe` file | Invalid | Unsupported type |
| `.pdf` with wrong magic bytes | Invalid | Magic byte validation rejects spoofed extension |

---

## Subscription Limits (Trial Plan)

| Resource | Limit |
|---|---|
| Vacancies | 5 |
| Candidates | 100 |
| Members | 3 |

---

## Public Apply — Vacancy Capacity

| Applications count | Submit result |
|---|---|
| 0–499 | Accepted |
| 500 | Rejected (MAX_APPLICATIONS_PER_VACANCY reached) |

---

## Organization Slug

| Value | Type | Notes |
|---|---|---|
| `my-company` | Valid | Lowercase hyphenated |
| `mycompany` | Valid | No separator |
| `my-company-2` | Valid | With number |
| `` (empty) | Invalid | Required |
| `My Company` | Edge case | Spaces — should be sanitized to slug format |

---

## Turnstile Token

| Value | Type | Notes |
|---|---|---|
| Valid token from Cloudflare | Valid | Normal flow |
| `` (empty) | Invalid | Button disabled until token present |
| `XXXX.DUMMY.TOKEN.XXXX` | Valid (test) | Cloudflare test token for always-pass |
| `1x0000000000000000000000000000000AA` | Valid (test) | Cloudflare test token for always-fail |
