'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  User,
  Building2,
  Users,
  LayoutGrid,
  Mail,
  XCircle,
  Plug,
  CreditCard,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  adminOnly?: boolean
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/settings/profile',           label: 'Profile',           icon: User },
  { href: '/settings/organization',      label: 'Organization',      icon: Building2,  ownerOnly: true },
  { href: '/settings/team',              label: 'Team',              icon: Users,      adminOnly: true },
  { href: '/settings/custom-fields',     label: 'Custom Fields',     icon: LayoutGrid, adminOnly: true },
  { href: '/settings/email-templates',   label: 'Email Templates',   icon: Mail,       adminOnly: true },
  { href: '/settings/rejection-reasons', label: 'Rejection Reasons', icon: XCircle,    adminOnly: true },
  { href: '/settings/integrations',      label: 'Integrations',      icon: Plug },
  { href: '/settings/billing',           label: 'Billing',           icon: CreditCard, ownerOnly: true },
]

interface SettingsNavProps {
  role: 'owner' | 'admin' | 'member'
}

export function SettingsNav({ role }: SettingsNavProps) {
  const pathname = usePathname()
  const isAdmin = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'

  const visible = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly && !isOwner) return false
    if (item.adminOnly && !isAdmin) return false
    return true
  })

  return (
    <nav className="w-52 shrink-0">
      <ul className="space-y-0.5">
        {visible.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-foreground font-medium'
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
    </nav>
  )
}
