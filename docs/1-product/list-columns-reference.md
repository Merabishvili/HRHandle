# List columns — Candidates & Vacancies (field reference)

What each column on the **Candidates** and **Vacancies** list means, how it gets
populated, and its i18n status. "Data" = user/org-entered value shown verbatim
(never translated by design). "Localized" = rendered through next-intl.

## Candidates list

Fixed columns (always shown):

| Column | What it is | How it's filled | i18n |
|---|---|---|---|
| **Candidate** | Name + "via {source}" subline | Name from the candidate record; source from `candidates.source` (apply form / import / manual) | Name = data; "via {source}" localized (source value is data) |
| **Status** | Candidate **general status**: Active / Hired / Archived | **Auto-derived**, not user-editable — synced from application stage transitions (hired→Hired; otherwise Active; Archived is a lifecycle state) | Localized (`candStatus.*`) |
| **Linked vacancy** | The candidate's first application's vacancy (+"N more") | From `applications` → vacancy | Localized ("Not linked", "Unknown vacancy", "+N more") |

Optional columns (Manage columns):

| Column | What it is | How it's filled | i18n |
|---|---|---|---|
| **Stage** | Current **pipeline stage** on the candidate's active application (Applied→…→Hired/Rejected/Withdrawn, incl. custom) | Derived from the application's `pipeline_stage_id` | **Fixed →** now localized (default stages translated, custom names kept) |
| **Fit score** | Avg of **submitted scorecards** on the active application, as `N%` | Filled only when reviewers submit scorecards → "—" until then | Numeric (`N%`) |
| **Current position / company** | Candidate's current job/company | Create wizard (Personal step), candidate edit form, CV parse (auto-fills), and CSV import. (Apply form still doesn't collect it.) | Data |
| **Added date** | When the candidate was created | `created_at`, shown as relative time | Localized (locale-aware relative time) |
| **Email / Phone** | Contact details | Candidate fields | Data |
| **Experience** | `years_of_experience` (a single number) | **Only set via CSV import** (and read by AI Fit/summary). Not captured in the create wizard → usually "—". Note: this is *not* the work-history entries from the wizard's Experience step. | **Fixed →** now localized (`N yr(s)` / `N წელი`) |
| **Location / Salary expectation / Notice period** | Candidate fields | Free-text candidate fields | Data |
| **Languages** | Comma-joined list | `candidates.languages` | Data (endonyms) |
| **Source** | Where the candidate came from | `candidates.source` | Data |
| **Custom fields** (`cf_*`) | Org-defined field values | Custom field values | Data; checkbox Yes/No **now localized** |

## Vacancies list

Fixed columns:

| Column | What it is | How it's filled | i18n |
|---|---|---|---|
| **Vacancy** | Title + "employment · opened Nd ago" | Vacancy record | Title = data; employment type + recency localized |
| **Status** | Vacancy status: Draft / Open / On hold / Closed / Archived | Set on the vacancy | Localized (`vacStatus.*`) |
| **Candidates** | Application count | Count of applications | Numeric |

Optional columns:

| Column | What it is | How it's filled | i18n |
|---|---|---|---|
| **Department / Location / Hiring manager** | Vacancy fields | Vacancy form | Data (Location falls back to a localized "Remote") |
| **End date / Start date** | Dates | Vacancy form | Locale-formatted date |
| **Employment type** | Full-time / Part-time / Contract / Internship | Vacancy form (enum) | Localized (`enum.employment.*`) |
| **Work mode** | Remote / Hybrid / On-site | Vacancy form (enum) | Localized (`enum.workMode.*`) |
| **Sector** | Industry sector | Vacancy form (org/seeded list) | Data (seeded names may be English) |
| **Salary** | Range / From / Up to `{cur}` | Vacancy form | "From/Up to" localized; numbers + currency literal |
| **Health** | Good / Watch / Stale (activity heuristic) | Derived from recent stage movement | Localized (`vacOverview.health*`) |
| **Openings** | Number of openings | Vacancy form | Numeric |
| **Custom fields** (`cf_*`) | Org-defined field values | Custom field values | Data; checkbox Yes/No localized |

## Status vs Stage (why both)

- **Status** is the coarse candidate lifecycle (Active / Hired / Archived) and drives the quick-filter tabs. It's a rollup, auto-synced from stages.
- **Stage** is the fine-grained pipeline position on the candidate's active application.

They overlap only at the hired end (both read "Hired"); for an active candidate they differ (Status = Active, Stage = Interview). Stage is an *optional* column — a team that finds it redundant can simply not add it.
