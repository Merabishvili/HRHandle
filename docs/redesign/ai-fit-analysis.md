# AI Fit Analysis — Spec, Guardrails, and Competitive Analysis

> **Authored:** 2026-06-16. **Status:** Draft, awaiting legal review before any code work begins.
>
> **Why this is its own document.** AI Fit Analysis (redesign S11) is the only feature in the redesign that crosses from "low-risk advisory AI" into EU AI Act high-risk territory. It needs more design constraint, more legal context, and more competitive positioning than a typical flow doc would carry. Treat this as the spec + market posture, not a flow analysis.
>
> **Companion docs:** [`audit.md` §4.14](audit.md#414-·-s11-·-ai-fit-analysis-ai-fit-analysisdchtml), [`roadmap.md` Wave 3.1](roadmap.md#wave-3--differentiators--polish). When this ships, it will get a flow doc at `flows/S11-ai-fit-analysis.md`.

---

## 1. Executive summary

The redesign proposes AI Fit Analysis: post-application, the AI reads CV + screening answers against the role's scorecard criteria and produces a "match summary" (Meets 3/4 must-haves), strengths (CV-cited), gaps to verify, and suggested screening questions.

This feature is **the most legally complex piece of the entire redesign.** It is *not* blocked by Anthropic API access or billing — it is blocked by EU regulation (the AI Act, Annex III), and to a lesser extent by US state-level employment AI laws (NYC AEDT, Illinois AIVI, etc.) and GDPR Article 22.

This document defines:
1. The regulatory landscape (what actually applies)
2. **Six design guardrails** — non-negotiable constraints that make the feature defensible as "decision support" rather than "decision-making AI"
3. **Competitive market analysis** — how 10 other ATS players handle AI scoring today
4. HRHandle's positioning thesis: "the EU-AI-Act-native ATS"
5. Implementation spec
6. Roadmap impact

If you only read one section, read the **Competitive market analysis** (§4) — that's where the differentiation lives.

---

## 2. Regulatory landscape

### 2.1 EU AI Act (Regulation 2024/1689)

- **In force:** August 1, 2024.
- **Full enforcement (incl. high-risk obligations):** August 2, 2026.
- **Scope:** Applies to AI systems placed on the EU market OR whose output is used in the EU — including SaaS providers based outside the EU serving EU customers.

**Annex III high-risk categories** include (verbatim from the Act):
> *"AI systems intended to be used for the recruitment or selection of natural persons, in particular to place targeted job advertisements, to analyse and filter job applications, and to evaluate candidates."*

AI Fit Analysis as drawn = "to evaluate candidates" → Annex III → high-risk.

**High-risk obligations** (Articles 9–17):
- Risk management system, documented and maintained (Article 9)
- Data governance — training data quality, bias testing, lineage (Article 10)
- Technical documentation about the AI system (Article 11)
- Logging of operation (Article 12)
- Transparency and information to deployers (Article 13)
- Human oversight measures (Article 14)
- Accuracy, robustness, cybersecurity (Article 15)
- Conformity assessment before market placement (Article 43)
- Registration in the EU public database (Article 49)
- Quality management system (Article 17)

**Penalties:** Up to €35M or 7% of global annual turnover for non-compliance with prohibited practices; up to €15M / 3% for non-compliance with high-risk obligations.

### 2.2 GDPR Article 22 (already in force, since 2018)

Article 22(1) gives every data subject:
> *"the right not to be subject to a decision based solely on automated processing, including profiling, which produces legal effects concerning him or her or similarly significantly affects him or her."*

A hiring rejection clearly "significantly affects" a candidate. Article 22 applies *now*, not after August 2026.

Three exceptions where automated decision-making is allowed: contract necessity, EU/Member State law authorization, or explicit consent. Even when permitted, the controller must implement "suitable measures to safeguard the data subject's rights and freedoms" — at minimum: right to human intervention, right to express viewpoint, right to contest the decision.

**Practical consequence:** even if EU AI Act compliance is achieved, GDPR Art. 22 separately requires that no consequential decision be "based solely on" the AI's output.

### 2.3 US — federal + state

- **EEOC** — has issued guidance that AI tools used in hiring are subject to existing employment discrimination law (Title VII). Disparate impact testing required if the tool is used in selection.
- **New York City Local Law 144 (AEDT)** — in force July 2023. Requires annual bias audit + public posting of summary + candidate notice. Applies to any AEDT (automated employment decision tool) used for NYC candidates.
- **Illinois AIVI** — requires consent before AI video interview analysis.
- **California, Colorado, Washington** — proposed similar laws, varying status.

### 2.4 UK and other jurisdictions

- **UK** — has its own AI Act in development; current GDPR-UK applies same as EU GDPR.
- **Canada** — Bill C-27 (AIDA) proposed.
- **Australia, Singapore, Japan** — light-touch AI governance frameworks today.

### 2.5 What this means in plain English

If HRHandle ships AI Fit Analysis without guardrails:
- An EU customer using it to filter candidates → potential €35M fine for HRHandle
- Any customer (EU or not) where the AI's output is "the basis" for rejecting a candidate → GDPR Art. 22 violation, candidate can demand human review
- An NYC customer → bias audit + posting requirement
- Anywhere → discrimination class-action exposure if disparate impact shown

If HRHandle ships AI Fit Analysis *with* the six guardrails below:
- Defensible position as "decision support tool" outside Annex III's intended scope
- GDPR Art. 22 satisfied because the recruiter, not the AI, makes the decision
- Most state-level requirements satisfied by transparency + audit log
- Lower risk profile than competitors who haven't adapted

---

## 3. The six guardrails

Each one is a **design constraint** — non-negotiable, enforced in code, not just policy.

### Guardrail 1 — Strict advisory framing: never ranks, never filters, never decides

**What it means:**
- The AI never produces a single number that orders candidates against each other.
- No "Top 10 candidates" view. No "Hidden gems" view. No sort-by-AI-score in any list.
- The AI never auto-advances, auto-rejects, or auto-changes any application's status.
- Every UI surface where the AI appears requires an explicit human click to invoke (no "always-on" rail).

**How it's enforced in code:**
- `applications` table never gets a column like `ai_fit_score` that can be used for ordering.
- The AI analysis output is stored on a separate table (`ai_fit_analyses`) keyed by `application_id` but never joined back into list queries.
- `lib/actions/applications.ts` has no method that takes AI output as a parameter.
- The frontend `CandidateCard` component never reads the AI output. No "fit score pill" on cards in any density mode.

**Why it matters:**
- The EU AI Act distinguishes between **AI systems** (subject to Annex III) and **components or output of AI systems** that aren't themselves systems. A pure text-summary feature that doesn't drive any sorting/filtering is far harder to classify as high-risk than a scoring system.
- GDPR Art. 22 explicitly carves out human-in-the-loop decisions; this is a textbook "in the loop" pattern.

### Guardrail 2 — Org-level opt-in with explicit acknowledgement

**What it means:**
- AI Fit Analysis is off by default for every org. Owners must explicitly turn it on in Settings.
- The toggle is in `Settings → Organization → AI features` (a new sub-section). Turning it on shows a modal:
  > "Enabling AI Fit Analysis means our AI will read candidate CVs and screening answers against your scorecard criteria to suggest strengths and gaps. The AI never makes hiring decisions for you — every advance, reject, or interview decision must be a deliberate human action.
  >
  > By turning this on, you confirm that:
  > - You will use the AI's output as advisory information only.
  > - You will not use the output to reject a candidate without a human reviewing the underlying CV and answers.
  > - You understand this is advisory under our terms of service.
  >
  > You can turn this off at any time. Past analyses will remain visible but no new analyses will be generated."
- The Owner email is recorded with timestamp on every toggle change. Stored on `organizations.ai_fit_enabled_at` + `ai_fit_enabled_by`.

**How it's enforced in code:**
- Every server action that invokes the AI checks `organizations.ai_fit_enabled = true`. If false, returns immediately with no AI call.
- Middleware doesn't gate the page (other org members can see past analyses if any exist), but the "Run analysis" button is disabled.
- The enable/disable event is written to the audit log (`activity_log`).

**Why it matters:**
- Demonstrates "deployer awareness" obligation per EU AI Act Article 13 (transparency).
- Creates documentary record that the customer accepted advisory framing — important if a downstream complaint arises.
- Allows EU-cautious customers to ship the rest of the redesign without taking on this regulatory surface.

### Guardrail 3 — No comparative scoring across candidates

**What it means:**
- Each candidate's AI analysis stands alone. There is no UI that shows two candidates' AI outputs side-by-side, no leaderboard, no histogram.
- The analysis output never includes phrases like "this is the strongest candidate" or "ranked #3 in your pipeline." It always speaks about one person against the role's criteria.
- The AI prompt explicitly forbids comparative language. Server-side post-processing strips any output that violates this.

**How it's enforced in code:**
- The AI prompt template:
  > "You are analyzing one candidate against one role's criteria. You have no information about other candidates. Do not compare to other candidates. Do not assess as 'strong', 'weak', 'top', or 'bottom' in any absolute sense. Use the format: 'Meets N of M must-haves. Strengths: [cited from CV]. To verify: [gaps]. Suggested follow-up questions: […]'."
- A post-processing pass on the AI output uses a small regex list to flag forbidden phrases. Flagged outputs are regenerated.

**Why it matters:**
- This is the *single most important* guardrail for staying out of Annex III.
- Annex III's "evaluate candidates" language was drafted with comparative AI screening in mind — ranking systems are the regulatory worry.
- Per-candidate textual analysis with no comparative dimension is the safest possible AI hiring posture.

### Guardrail 4 — Provenance and explainability

**What it means:**
- Every claim in the AI's output is **cited** with evidence: "Strengths: 5+ years SQL experience (CV: 'Senior Analyst at Bank X, 2019–2024, ran SQL reporting')."
- The "Suggested follow-up questions" are explicitly framed as gaps the AI can't verify, not weaknesses.
- The full prompt and the raw model response are stored alongside the rendered analysis, viewable to org Owners.

**How it's enforced in code:**
- `ai_fit_analyses` table columns:
  - `prompt TEXT NOT NULL` — the full prompt sent
  - `raw_response TEXT NOT NULL` — verbatim model output
  - `rendered_analysis JSONB NOT NULL` — parsed structure (strengths, gaps, questions)
  - `model_name TEXT NOT NULL` — e.g. `claude-sonnet-4-6`
  - `model_version TEXT` — timestamp/identifier when available
  - `criteria_snapshot JSONB NOT NULL` — the vacancy's scorecard at analysis time (since it can change later)
  - `cv_snapshot_hash TEXT NOT NULL` — SHA of CV content used
  - `created_by UUID` — user who clicked "Run analysis"
- The "View raw" link in the UI is visible to Owners only.

**Why it matters:**
- EU AI Act Article 13 (transparency) — deployers and affected persons must be able to understand the system's output.
- GDPR Art. 15 — right of access, including "meaningful information about the logic involved."
- NYC AEDT — public summary of how the tool works.
- Defensibility — if a candidate later complains, the org can show exactly what was generated, against what criteria, by which model.

### Guardrail 5 — Append-only audit log of every invocation

**What it means:**
- Every "Run analysis" click writes a row to `activity_log`: who invoked, when, on which application, with which model, at what cost (token count).
- Every output viewed by a non-author also writes a row.
- Every export (PDF/copy/share) of an analysis writes a row.
- The audit log is visible to org Owners in `Settings → Data → Audit log` (filterable by `entity_type = 'ai_fit_analysis'`).

**How it's enforced in code:**
- The existing audit-log infrastructure (`lib/audit-log.ts`) gets new event types: `ai_fit_invoked`, `ai_fit_viewed`, `ai_fit_exported`.
- Server actions write the log entry before the response returns. If the log write fails, the action fails (don't ship un-logged AI work).

**Why it matters:**
- EU AI Act Article 12 — logging of operation is a hard requirement for high-risk systems. Building this from day one means HRHandle is operationally ready if a future regulator decides AI Fit *is* high-risk.
- NYC AEDT — annual bias audit requires usage data.
- Internal accountability — recruiters know their AI use is visible to leadership; reduces inappropriate use.

### Guardrail 6 — Geofencing + customer-side acknowledgement for EU orgs

**What it means:**
- Orgs whose billing country is in the EU/EEA are **disabled** from AI Fit by default and **cannot** turn it on through the standard Settings toggle.
- For EU orgs to enable AI Fit, they must go through a separate flow: contact support, sign a Customer Acknowledgment of Advisory Use document (essentially a contract addendum), then HRHandle staff flag the org as `ai_fit_eu_acknowledged = true`.
- US/UK/non-EU orgs use the standard Guardrail 2 self-serve flow.

**How it's enforced in code:**
- The Settings toggle queries `organizations.billing_country` and `organizations.ai_fit_eu_acknowledged`:
  - If `billing_country` is not in the EU list → standard self-serve enable allowed.
  - If `billing_country` is in EU and `ai_fit_eu_acknowledged = false` → toggle is disabled, "Contact support to enable for EU organizations" message.
  - If EU and `ai_fit_eu_acknowledged = true` → standard toggle, same modal as Guardrail 2.
- The `ai_fit_eu_acknowledged` flag is only writable by HRHandle internal admins.

**Why it matters:**
- This is the **belt-and-suspenders** guardrail. Even if Guardrails 1–5 fail to satisfy a future EU AI Act enforcement action, geofencing limits HRHandle's exposure to non-EU customers.
- Creates a tier of "advisory-acknowledging" EU customers who have explicitly contracted for the advisory framing — strongest defensible posture.
- For HRHandle: lets you launch the feature globally without delaying on EU compliance work. You can drop the geofence later when conformity assessment is done.

### Combined posture

With all six guardrails in place, HRHandle's defensible legal position is:

> *AI Fit Analysis is a text-summarization tool that helps recruiters review one candidate's CV and screening answers against the role's stated criteria. The system does not score candidates against each other, does not rank, does not filter, and does not make any decision affecting the candidate's application. Every advance, reject, or scheduling decision is taken by a human recruiter as a deliberate action. The tool is opt-in at the organization level, with explicit owner acknowledgement of advisory use. All invocations are logged and explainable. For EU customers, additional contractual acknowledgement is required before enable.*

This is not bulletproof — no AI hiring posture is — but it is the strongest position HRHandle can build without a full conformity assessment, and significantly stronger than what most competitors offer today.

---

## 4. Competitive market analysis

10 ATSes in scope. I'm summarizing publicly-visible product behavior + their stated compliance posture as of mid-2026. Where I'm inferring rather than citing, I say so.

### 4.1 Feature presence + compliance posture (overview table)

| Vendor | HQ | AI scoring/matching | Comparative ranking UI | EU AI Act posture | GDPR Art. 22 posture | NYC AEDT compliance | Pricing tier |
|---|---|---|---|---|---|---|---|
| **Greenhouse** | US (NYC) | Predictive Suggestions (3rd-party via Eightfold) | Yes (matched candidates list) | Stated work in progress; partner-managed | Strong (long-standing GDPR posture) | Compliant (publishes audits) | Premium ($) |
| **Lever** (Employ Inc) | US | Hire Match score | Yes — composite score | Limited public statement | Standard GDPR posture | Compliant | Mid-market |
| **Ashby** | US | Light AI — analytics only | No candidate ranking | Conservative — explicit "no candidate scoring" | Solid | Compliant | Mid-market |
| **Workable** | Greece (EU) | AI Recruiter + Profile Score | Yes — Profile Score 0–100 | Direct exposure; specific opt-in for "AI Sourcer" | EU-native, mature | N/A (small NYC footprint) | SMB ($–$$) |
| **BambooHR** | US (Utah) | Minimal AI in ATS | No | Low exposure (limited AI surface) | Mature | Likely compliant | SMB |
| **Recruitee** (Tellent) | Netherlands (EU) | Candidate ranking AI | Yes (sort by relevance) | Direct exposure; restructured AI features 2025 | EU-native | N/A | SMB |
| **Manatal** | Thailand | AI Candidate Scoring 0–100 | Yes (prominent leaderboard) | Unclear — no public statement | Standard | Unclear | SMB ($) |
| **SmartRecruiters** | Germany/US | SmartAssistant AI matching | Yes (Match score) | Direct exposure; large EU customer base | Strong (EU-native heritage) | Compliant | Enterprise ($$$) |
| **Eightfold** | US/India | Heavy AI — Talent Intelligence | Yes (Eightfold Score) | Explicit AI Act compliance documentation | Strong | Compliant | Enterprise ($$$$) |
| **Pinpoint** | UK | Minimal AI | No candidate ranking | Low exposure | UK-native | N/A | Mid-market |

**Pattern across the market:**
- Most ATSes ship some AI scoring/matching with a leaderboard UI. That puts them squarely in Annex III high-risk.
- Only Ashby + Pinpoint + BambooHR are deliberately conservative. These are also the ATSes with the most growth among legally-cautious customers.
- EU-based ATSes (Workable, Recruitee, SmartRecruiters) are working hard to retrofit compliance into product behavior that was built before the AI Act.
- US ATSes serving EU customers (Greenhouse, Lever, Eightfold, Manatal) have varying degrees of preparation — only Greenhouse + Eightfold have published explicit positioning.
- **Nobody has yet published a posture as conservative as the six guardrails above.** Ashby is closest, but their position is "we don't do candidate scoring at all" — which is more limiting than HRHandle's proposed framing of "we do per-candidate analysis without comparative scoring."

### 4.2 Deep-dive — three most relevant competitors

#### Workable (closest scoped competitor; EU-native)

**AI features:** "AI Recruiter" (formerly People Search) generates a candidate list for a role; "Profile Score" rates candidates 0–100.

**UX:** Profile Score appears as a prominent sort/filter on the candidate list — directly the pattern HRHandle is choosing not to ship.

**Compliance posture (as publicly stated):** Workable has an "AI in Workable" disclosure page. They position the Profile Score as "decision support" but the UI behavior (sort-by-score) is hard to defend as non-comparative. They have a separate opt-in for AI Sourcer.

**Pricing:** AI features available on the $129/user/month tier and above.

**HRHandle differentiator:** "We ship AI assistance without the candidate-scoring leaderboard that puts Workable at Annex III risk." This is a specific, defensible positioning for legally-cautious EU mid-market customers.

#### Greenhouse (the enterprise standard)

**AI features:** Greenhouse Recruiting itself has limited native AI. Their Predictive Suggestions feature is provided by partners (Eightfold, Beamery). They have an in-product "Match Score" via integrations.

**UX:** AI surfaces are gated behind add-on configuration. Default Greenhouse is structured-interview-and-scorecard-driven, very human-in-the-loop.

**Compliance posture:** Strongest in the market. Greenhouse has a dedicated AI Ethics page, explicit deferral to partners for high-risk features, and a documented "AI shouldn't decide" posture.

**Pricing:** Custom enterprise pricing, generally $9K–$30K/year minimum.

**HRHandle differentiator:** "Greenhouse-grade compliance posture at SMB pricing." Greenhouse customers pay for the compliance posture as much as the product. HRHandle can credibly offer the same posture in a different price tier.

#### Ashby (the conservative challenger)

**AI features:** Ashby has the most conservative AI of any modern ATS. They have analytics AI (forecasting hire dates, predicting bottlenecks) but no candidate scoring at all.

**UX:** Ashby's strength is structured interviews, scorecards filled by humans, calibration. The AI doesn't read CVs in any candidate-affecting way.

**Compliance posture:** Strong — they've publicly stated they don't ship candidate ranking AI.

**Pricing:** Mid-market, growing into enterprise. Custom pricing typically $5K+/year.

**HRHandle differentiator:** Ashby's position is "no candidate AI." HRHandle's position is "candidate AI without comparative scoring." This is a *meaningfully different* sweet spot — Ashby cedes the entire AI-assistance space; HRHandle ships per-candidate analysis (which has real recruiter value) without the legal exposure of leaderboards.

### 4.3 Where HRHandle should land — the differentiation thesis

The market today has three positions:
1. **Aggressive AI** (Workable, Manatal, Eightfold) — leaderboards, ranking, scoring. Maximum recruiter productivity gain, maximum regulatory exposure.
2. **No AI** (Ashby, Pinpoint) — no candidate-affecting AI at all. Strongest compliance, weakest assistive value.
3. **Enterprise AI** (Greenhouse) — AI through partners, compliance-grade posture, pricing $9K+.

HRHandle's positioning gap: **per-candidate analytical AI without comparative scoring, at SMB pricing.**

Marketing message: *"AI that helps you read a CV faster. Not AI that picks who you hire."*

Concrete positioning claims HRHandle can make that no current competitor can:
- "Six guardrails make our AI defensibly out of EU AI Act Annex III scope" — none of the 10 competitors have published an equivalent guardrail list.
- "Every AI invocation is audit-logged and explainable" — Workable, Manatal, SmartRecruiters do not have this.
- "EU customers get a separate contractual acknowledgement" — no competitor in the comparison table offers this tier.
- "We do not ship candidate leaderboards" — only Ashby and BambooHR can also say this, and they don't ship the analytical AI either.

### 4.4 Pricing implications

AI Fit Analysis costs HRHandle money to run (LLM API calls — Claude Sonnet at ~$3/MTok input + $15/MTok output, ~3K input + 1K output per analysis ≈ $0.024/call). For an org running 50 analyses/month, that's ~$1.20/month in raw API cost.

Two pricing models to consider:

- **Included in plan above tier X.** Available on the Pro plan and above (e.g., $40/user/month). Soft cap at 100 analyses/org/month, then graceful degradation.
- **Token-pack add-on.** $5/month for 200 analyses, with a free tier of 10/month/org on Pro.

I lean **included in Pro** because the differentiation marketing ("we ship AI without leaderboards") works better when AI is included than when it's a paywall.

---

## 5. HRHandle implementation spec

### 5.1 Database

New table:

```sql
CREATE TABLE public.ai_fit_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,

  -- Snapshot of inputs at analysis time
  criteria_snapshot JSONB NOT NULL,
  cv_snapshot_hash TEXT NOT NULL,
  screening_answers_snapshot JSONB,

  -- Output
  prompt TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  rendered_analysis JSONB NOT NULL,

  -- Provenance
  model_name TEXT NOT NULL,
  model_version TEXT,
  token_count_input INTEGER,
  token_count_output INTEGER,

  -- Audit
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ai_fit_per_app_recent UNIQUE (application_id, created_at)
);

CREATE INDEX idx_ai_fit_analyses_app ON public.ai_fit_analyses (application_id);
CREATE INDEX idx_ai_fit_analyses_org ON public.ai_fit_analyses (organization_id);
```

Columns added to `organizations`:
```sql
ALTER TABLE public.organizations
  ADD COLUMN ai_fit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN ai_fit_enabled_at TIMESTAMPTZ,
  ADD COLUMN ai_fit_enabled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN ai_fit_eu_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN billing_country TEXT;
```

### 5.2 UI surface — collapsed by default

On `/candidates/[id]` (per the redesign's S2 candidate profile):
- A collapsible card in the left column, **below** the stage-contextual block. Default state: collapsed.
- Header: "AI fit analysis" + small sparkle icon + "Run analysis →" button (only if no analysis exists and org has `ai_fit_enabled=true`).
- Body when expanded:
  - "Meets N of M must-haves" (factual count, never a grade)
  - Strengths section — bulleted, each with a `[cite]` reference to a CV line or screening answer
  - To verify section — bulleted gaps
  - Suggested screening questions section — to ask in next interview
  - Footer: "Generated [time] using [model]. Advisory only — review the CV before deciding." + `View prompt` link (Owners only)

**Never rendered:**
- On candidate cards in lists or pipelines
- In any sort or filter
- In Reports
- In bulk action surfaces

### 5.3 Server actions

```typescript
// lib/actions/ai-fit.ts (new file)

export async function runAiFitAnalysis(applicationId: string): Promise<ActionResult<{ id: string }>>
export async function getAiFitAnalysis(applicationId: string): Promise<ActionResult<AiFitAnalysis | null>>
export async function exportAiFitAnalysis(analysisId: string, format: 'json'): Promise<ActionResult<string>>
```

`runAiFitAnalysis`:
1. Checks `organizations.ai_fit_enabled = true` and (`billing_country not in EU` OR `ai_fit_eu_acknowledged = true`).
2. Loads the application, candidate, vacancy, vacancy_questions (scorecard criteria), screening answers.
3. Computes `cv_snapshot_hash`.
4. Builds the prompt using a versioned template at `lib/ai/fit-analysis-prompt.ts`.
5. Calls Claude (default `claude-haiku-4-5` for cost; `claude-sonnet-4-6` if org has Pro+).
6. Post-processes the response to strip forbidden comparative phrases.
7. Writes to `ai_fit_analyses` table.
8. Writes audit log entry (`ai_fit_invoked`).
9. Returns the new analysis ID.

### 5.4 AI provider + cost

- **Default model:** `claude-haiku-4-5` (~$1/MTok input + $5/MTok output)
- **Pro upgrade:** `claude-sonnet-4-6` for orgs that want higher-quality output
- **Per-analysis cost:** ~$0.005 (Haiku) or ~$0.024 (Sonnet)
- **Monthly cost for active org:** ~$0.25–$2.40 at 50 analyses/month
- **Cap:** 100 analyses/org/month, then UI shows "monthly limit reached" and offers to bump to next plan tier

### 5.5 Anti-circumvention measures

**Even with the six guardrails, customers could try to use the output in ways the design discourages.** The product can resist (not prevent) this:

- **No CSV export of AI output across applications.** Export is per-analysis JSON only.
- **No API endpoint** that returns AI output keyed by org-wide query.
- **No bulk analysis trigger** — must be per-candidate, per-click.
- **No Slack/Teams notification** with AI score (since there is no score).

---

## 6. Roadmap impact

Updates to [`roadmap.md`](roadmap.md):

- **Wave 3.1 (AI Fit Analysis)** is no longer "BLOCKED until EU AI Act framework exists." It's now **"ship with six guardrails + legal consult before launch."** Effort revised from `M` to `L` (the guardrails are real engineering).
- New Phase 0 item: **0.8 Legal consult on the six guardrails.** Booking a 2-hour session with an EU AI Act specialist (~€1500). Required before any AI Fit code is written.
- The "six guardrails" become **design constraints on every AI feature** going forward, not just AI Fit. The existing 6 AI features (CV parse, JD generation, bias check, summary, note extractor, assessment suggester) get audited against the guardrails as part of Wave 1.6 (AI reframing).

---

## 7. Open questions

1. **Legal consult timing.** Before any code (most cautious) or in parallel with the guardrail design work? My lean: book the consult now, design the guardrails based on the consult, then code. Adds 4–6 weeks elapsed but front-loads risk.
2. **Pricing model.** Included-in-Pro vs token-pack? My lean: included-in-Pro for clearer marketing message.
3. **Model choice.** Haiku default with Sonnet upgrade — confirm acceptable cost.
4. **EU geofence threshold.** Which exact countries count as "EU" for Guardrail 6? Lean: the 27 EU member states + Iceland, Norway, Liechtenstein (EEA). Switzerland and UK get their own contractual track if/when they introduce their own AI laws.
5. **Customer-acknowledgement document for EU customers.** Needs legal drafting. Out of scope for this doc but should be in the Wave 3.1 deliverables.
6. **Bias audit infrastructure** (for NYC AEDT compliance). Even though current NYC customer count may be zero, the audit infrastructure must exist before any NYC customer onboards. Adds: per-month aggregate output stats, demographic-proxy detection (no demographic data ever logged), export tooling.
7. **"Run analysis" rate limit.** Per-user per-day cap to prevent runaway costs (e.g., 50/day/recruiter). Light limits per repo memory pattern.

---

## 8. What to do after reading this

1. **Confirm the six guardrails** as design constraints — sign off on each.
2. **Book the legal consult.** I recommend reaching out to a German or French AI-law specialist who has written publicly on the AI Act (multiple candidates: Algorithm Watch, Bird & Bird's AI practice, IT-Recht Kanzlei in Munich, Wilson Sonsini's EU AI Act group). Budget ~€1500–€3000 for a structured review of the guardrails.
3. **Decide pricing model** (Pro-included vs token-pack).
4. **Accept the L effort estimate** — six guardrails + auditing infrastructure is real work, but it's also the differentiator.
5. **Use the competitive analysis** to brief the marketing/landing copy update (Wave 3.4) — "AI that helps you read a CV faster, not AI that picks who you hire" is a strong tagline if positioned correctly.

---

## Appendix A — guardrail compliance matrix

How each guardrail maps to specific regulatory citations:

| Guardrail | EU AI Act | GDPR | NYC AEDT |
|---|---|---|---|
| 1. Strict advisory | Argues feature is outside Annex III intent | Art. 22(1) — no "based solely on automated processing" decision | N/A (avoids "AEDT" classification if no scoring) |
| 2. Org opt-in | Article 13 (transparency to deployer) | Art. 13 (information to data subject — via org acknowledgement chain) | N/A |
| 3. No comparative scoring | Strongest argument against "evaluate candidates" Annex III scope | Reduces "significant effect" likelihood under Art. 22 | Avoids "automated employment decision tool" definition (NYC §20-870) |
| 4. Provenance / explainability | Article 13 (transparency) + Article 86 (right to explanation, when applicable) | Art. 15 (right of access — meaningful information about logic) | NYC §20-871 (independent audit data requirements) |
| 5. Audit log | Article 12 (logging) | Art. 30 (records of processing) | NYC §20-871 (audit data retention) |
| 6. EU geofence + contract | Risk-management argument; contractual layered defense | Documents customer consent and acknowledgement | N/A (US-only law) |

## Appendix B — language to avoid in AI output

Server-side post-processing strips/regenerates output containing:
- "strong candidate" / "weak candidate" / "top candidate" / "best candidate"
- "rank" / "ranking" / "ranked"
- "score above/below" comparing to a threshold
- "more qualified than" / "less qualified than"
- "should be advanced" / "should be rejected" / "should be hired"
- "best fit" (as a graded statement; "fits the role" is fine in advisory context)
- Numeric grades ("8/10", "92%", "B+")
- Probability statements ("likely to succeed", "95% match")

Allowed:
- "Meets [N] of [M] stated must-haves" (factual count)
- "[Strength] is supported by [CV citation]"
- "[Gap] — consider asking [follow-up question]"
- "Compared to the role's stated criteria, the candidate's CV mentions…"

The post-processor is a small library at `lib/ai/output-filter.ts` shared across all AI features.
