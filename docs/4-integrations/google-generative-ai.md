# Google Generative AI (Gemini) — CV Parsing 🆕

_Last updated: 2026-05-08_

## Purpose

Parses uploaded CVs (PDF / DOCX / DOC) into structured candidate data so the
"New Candidate" form and the public apply form can auto-fill fields.

## SDK & Models

- Package: `@google/generative-ai` v0.24.1
- Primary model: `gemini-2.5-flash`
- Fallback model: `gemini-2.0-flash` (used on `503` from primary)

## Code Locations

| File | Role |
|---|---|
| `lib/cv-parser.ts` | Extracts text from file (via `pdfjs-dist` for PDFs and `mammoth` for DOCX), prompts Gemini, validates the response with `ParsedCVSchema`, then `backfillCurrentRole()` derives `current_position`/`current_company` from the most recent experience entry when the model left them null (#3) |
| `app/api/parse-cv/route.ts` | Public HTTP entry point (multipart upload, IP rate-limit, MIME + magic-byte validation, 25 s timeout) |
| `lib/validations/candidate-background.ts` | `ParsedCVSchema` (and `ExperienceEntrySchema` / `EducationEntrySchema`) |
| `components/apply/apply-form.tsx` | Public form — calls the endpoint on CV upload, displays "Parsing CV…" / failure states |
| `components/candidates/candidate-form.tsx` | Internal "New Candidate" form — same flow |

## Environment Variables

| Name | Required | Notes |
|---|---|---|
| `GOOGLE_GEMINI_API_KEY` | yes (for the feature to work) | Read directly from `process.env`. Currently **not validated in `lib/env.ts`** — missing key returns `parse_failed` silently. |

## Endpoint Summary

`POST /api/parse-cv` — see [`docs/7-api/endpoints.md`](../7-api/endpoints.md#cv-parsing-) for full schema.

- Rate-limit: 10 requests per IP per hour (in-memory map; resets on cold start — see issue `S-rate-limit-inmemory`)
- Region: `fra1` (Frankfurt) — Vercel route segment config, avoids US-region Google blocks
- Max duration: 90 seconds
- Max upload size: 10 MB
- Allowed MIME: PDF, DOCX, DOC (magic-byte verified)

## Error Modes

| HTTP | `reason` | Cause |
|---|---|---|
| 400 | `invalid_file` | Bad MIME / magic bytes / size |
| 400 | `parse_failed` | Gemini returned malformed JSON or schema validation failed |
| 422 | `<specific>` | Specific Zod field error |
| 429 | `rate_limited` | More than 10 requests from same IP in last hour |
| 504 | `timeout` | 25 s parse window exceeded |

## Known Limitations

- In-memory rate limiter is **not durable** — Redis/Vercel KV should replace it before relying on it for abuse prevention.
- API key is silently optional; consider promoting it to `lib/env.ts` so missing key fails fast.
- Failures on the apply form show only a generic "could not auto-fill" — there is no telemetry on parse success rate today.
