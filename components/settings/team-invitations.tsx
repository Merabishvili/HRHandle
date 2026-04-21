'use client'

import { useState, useTransition } from 'react'
import { inviteTeamMember, revokeInvitation } from '@/lib/actions/invitations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Mail, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  created_at: string
  expires_at: string
}

interface TeamMember {
  id: string
  full_name: string
  email: string | null
  role: string
}

interface TeamInvitationsProps {
  pendingInvitations: Invitation[]
  teamMembers: TeamMember[]
  currentUserId: string
}

export function TeamInvitations({
  pendingInvitations,
  teamMembers,
  currentUserId,
}: TeamInvitationsProps) {
  const [invitations, setInvitations] = useState<Invitation[]>(pendingInvitations)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleInvite = () => {
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await inviteTeamMember(email, role)
      if (!result.success) {
        setError(result.error)
        return
      }
      setSuccess(`Invitation sent to ${email}`)
      setEmail('')
      setRole('member')
    })
  }

  const handleRevoke = (id: string, inviteeEmail: string) => {
    setError(null)
    startTransition(async () => {
      const result = await revokeInvitation(id)
      if (!result.success) {
        setError(result.error)
        return
      }
      setInvitations((prev) => prev.filter((inv) => inv.id !== id))
      setSuccess(`Invitation to ${inviteeEmail} revoked.`)
    })
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Current team members */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Team Members</h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {teamMembers.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{member.full_name}</p>
                <p className="text-xs text-muted-foreground">{member.email || '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {member.role}
                </Badge>
                {member.id === currentUserId && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Invite form */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-foreground">Invite a team member</h3>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="invite-email" className="sr-only">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as 'member' | 'admin')} disabled={isPending}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleInvite} disabled={isPending || !email.trim()}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Invite
          </Button>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">Pending Invitations</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{inv.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {inv.role} · expires{' '}
                    {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRevoke(inv.id, inv.email)}
                  disabled={isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
