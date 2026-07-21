'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  User,
  Bell,
  Lock,
  Building2,
  Users,
  LayoutGrid,
  Mail,
  XCircle,
  Plug,
  CreditCard,
  ListChecks,
  Trash2,
  GitBranch,
  Sparkles,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  ownerOnly?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

/**
 * Settings nav — 4 logical groups per redesign Wave 1.2 / S07.
 *
 * Personal           — own user (Profile, Security)
 * Organization       — org-scoped owner/admin config
 * Hiring workflow    — content templates + integrations admins manage
 * Data               — audit + recovery
 *
 * Notifications (Personal) and /settings/billing consolidation (replacing
 * the standalone /subscription route) are scheduled follow-ups — the nav
 * structure was the user-visible win and ships independently.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Personal',
    items: [
      { href: '/settings/profile',       label: 'Profile',       icon: User },
      { href: '/settings/notifications', label: 'Notifications', icon: Bell },
      { href: '/settings/security',      label: 'Security',      icon: Lock },
    ],
  },
  {
    label: 'Organization',
    items: [
      { href: '/settings/organization', label: 'Organization', icon: Building2,  ownerOnly: true },
      { href: '/settings/team',         label: 'Team',         icon: Users,      adminOnly: true },
      { href: '/settings/billing',      label: 'Billing',      icon: CreditCard, ownerOnly: true },
    ],
  },
  {
    label: 'Hiring workflow',
    items: [
      { href: '/settings/pipeline-stages',   label: 'Pipeline stages',   icon: GitBranch,  adminOnly: true },
      { href: '/settings/custom-fields',     label: 'Custom fields',     icon: LayoutGrid, adminOnly: true },
      { href: '/settings/email-templates',   label: 'Email templates',   icon: Mail,       adminOnly: true },
      { href: '/settings/rejection-reasons', label: 'Rejection reasons', icon: XCircle,    adminOnly: true },
      { href: '/settings/integrations',      label: 'Integrations',      icon: Plug },
    ],
  },
  {
    label: 'Data',
    items: [
      { href: '/settings/audit-log', label: 'Audit log',    icon: ListChecks, adminOnly: true },
      { href: '/settings/ai-fit',    label: 'AI oversight', icon: Sparkles,   adminOnly: true },
      { href: '/settings/trash',     label: 'Trash',        icon: Trash2,     adminOnly: true },
    ],
  },
]

interface SettingsNavProps {
  role: 'owner' | 'admin' | 'member'
}

export function SettingsNav({ role }: SettingsNavProps) {
  const pathname = usePathname()
  const isAdmin = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (item.ownerOnly && !isOwner) return false
      if (item.adminOnly && !isAdmin) return false
      return true
    }),
  })).filter((section) => section.items.length > 0)

  return (
    // Sidebar chrome per Settings.dc.html — slight bg tint + right border so
    // the nav reads as a discrete left rail, and width 232px to match the
    // design's left-rail spec. Tier 2 of fidelity-audit.md.
    <nav className="w-[232px] shrink-0 self-stretch border-r border-[oklch(0.92_0.01_250)] bg-[oklch(0.985_0.002_247)] px-3 py-3.5">
      <ul className="space-y-5">
        {visibleSections.map((section) => (
          <li key={section.label}>
            <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                        // Pale brand-blue tint per Settings.dc.html `.navon` —
                        // theme `bg-accent` was rendering green in the user's
                        // screenshot. Tier 1 of fidelity-audit.md.
                        isActive
                          ? 'bg-[oklch(0.93_0.05_250)] text-[oklch(0.25_0.14_250)] font-semibold'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}
