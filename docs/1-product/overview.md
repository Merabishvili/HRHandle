# HRHandle — Product Overview

_Last updated: 2026-05-08_

## Changelog

- 🆕 AI-assisted CV parsing surfaces structured candidate fields on both public-apply and internal "New Candidate" forms
- 🆕 Candidate background (work history + education) is now first-class
- 🆕 LinkedIn integration (manual page-ID) lets owners/admins re-post vacancies from within the app

---

## Purpose

HRHandle is a SaaS applicant tracking system (ATS) for small-to-medium businesses and recruiting teams. It centralises the end-to-end recruitment workflow: creating job vacancies, sourcing and tracking candidates, managing applications through a pipeline, scheduling interviews, and communicating with candidates via email.

## Target Users

- **Founders / HR leads** at small companies who need a simple ATS without enterprise complexity.
- **Recruiters / talent acquisition teams** at medium-sized organisations managing multiple concurrent vacancies.
- **Hiring managers** who need visibility into candidate pipelines for their teams.

## Core Modules

| Module | Description |
|--------|-------------|
| **Vacancies** | Create and manage job postings with status tracking (Draft, Open, On Hold, Closed, Archived). Supports public job listing page and application form link. |
| **Candidates** | Central talent pool. Stores professional details, documents, notes, status, custom fields. |
| **Applications** | Links candidates to vacancies. Tracks pipeline stage (Applied → Screening → Interview → Offer → Hired / Rejected). |
| **Pipeline** | Kanban-style board per vacancy. Drag-and-drop application stage movement. |
| **Interviews** | Schedule video/phone/on-site interviews. Integrates Google Meet, Zoom, and Microsoft Teams for meeting creation. Sends email invitations to candidates. |
| **Notifications** | In-app bell notifications for interview schedules and new public-form applications. |
| **Team** | Invite colleagues as Admin or Member. Role-based access controls. |
| **Subscription** | Trial (7 days), Individual ($20/mo), Organization ($40/mo) plans. Usage limits enforced on vacancies, candidates, and members. |
| **Settings** | Profile, organisation, rejection templates, email templates, custom fields, integrations, team. |
| **Public Apply** | Public-facing application form per vacancy (via token link). Includes CV upload and optional custom questions. |
| **Public Jobs Page** | Organisation's public job board listing all open vacancies at `/jobs/[slug]`. |
| **Guides** | Public feature walkthroughs at `/guide` and `/guide/[slug]`. Same URL is opened from the dashboard "Help" link and shared with prospects. |

## Key User Journeys

### 1. New Organisation Sign-Up
1. User registers at `/auth/sign-up` with name, company name, email, password.
2. Confirms email via link → `/auth/confirm?token_hash=…&type=signup`.
3. First dashboard hit triggers `runOnboarding()`: creates organisation, profile (role=owner), 7-day trial subscription, seed rejection reason and template.
4. User lands on `/dashboard`.

### 2. Post a Vacancy & Receive Applications
1. Owner/admin creates vacancy at `/vacancies/new` (title, description, start date required).
2. Enables "Show on public page" → a shareable apply link is generated (`/apply/[token]`).
3. Candidates submit public application form with name, email, phone, LinkedIn, CV (PDF/Word up to 10 MB).
4. Application appears in pipeline at "Applied" stage.
5. Owner/admin receives in-app notification of new application.

### 3. Interview Scheduling
1. From vacancy pipeline or candidate detail, user clicks "Schedule Interview".
2. Selects candidate, vacancy, date/time, duration, type (video/phone/on-site).
3. Optionally creates Google Meet, Zoom, or Teams meeting.
4. Optionally sends email invitation to candidate.
5. Interviewer and creator receive in-app notifications.

### 4. Reject a Candidate
1. From kanban board, drag card to "Rejected" column (triggers rejection dialog).
2. Select rejection reason and template.
3. Optionally send rejection email using template with `{{candidate_name}}`, `{{role}}`, `{{company}}` variables.

### 5. Team Invitation
1. Owner/admin visits `/settings/team`, enters email + role.
2. System sends invitation email with secure token link to `/join?token=…`.
3. Invitee signs up (or logs in) → invitation accepted → profile linked to organisation.

### 6. Subscription Upgrade
1. User visits `/subscription` (trial users auto-redirected there when trial expires).
2. Views plan cards: Trial, Individual ($20/mo), Organization ($40/mo).
3. Clicks "Upgrade" — **payment wiring is not yet implemented** (LemonSqueezy planned).
