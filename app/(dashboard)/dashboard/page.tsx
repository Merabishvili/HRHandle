import { redirect } from 'next/navigation'

/**
 * Dashboard retired — Pipeline is the home surface.
 *
 * Per the 2026-06-24 IA decision, the standalone Dashboard was
 * removed because its content overlapped with surfaces that already
 * exist as dedicated pages: Interviews has its own day-grouped list
 * (A-11b), Vacancies has its own list, and the cross-vacancy Pipeline
 * shows live candidates per stage. The Dashboard's "Needs your
 * attention" tile (A-1 partial) is the only piece that didn't have a
 * home elsewhere — folding it into the Pipeline header is a follow-
 * up; for now it goes away with the rest of the dashboard.
 *
 * The route stays as a server redirect so external links + browser
 * back-history continue to work.
 */
export default function DashboardPage() {
  redirect('/pipeline')
}
