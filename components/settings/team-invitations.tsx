'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { inviteTeamMember, revokeInvitation } from '@/lib/actions/invitations'
import { adminResetUserFactors } from '@/lib/actions/mfa'
import { Shield, ShieldOff } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
  mfa_enrolled?: boolean
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
        toast.error(result.error)
        return
      }
      setInvitations((prev) => prev.filter((inv) => inv.id !== id))
      toast.success(`Invitation to ${inviteeEmail} revoked.`)
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
              <div className="flex items-center gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">{member.email || '—'}</p>
                </div>
                {member.mfa_enrolled ? (
                  <Shield className="h-3.5 w-3.5 text-emerald-600" aria-label="2FA enabled" />
                ) : (
                  <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" aria-label="2FA off" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {member.role}
                </Badge>
                {member.id === currentUserId && (
                  <span className="text-xs text-muted-foreground">(you)</span>
                )}
                {member.id !== currentUserId && member.role !== 'owner' && member.mfa_enrolled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Reset 2FA for ${member.full_name}? They'll need to re-enroll on their next sign-in.`)) return
                      const res = await adminResetUserFactors(member.id)
                      if (res.success) toast.success(`2FA reset for ${member.full_name}`)
                      else toast.error(res.error)
                    }}
                  >
                    Reset 2FA
                  </Button>
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
                  <p className="text-xs text-muted-foreground">
                    <span className="capitalize">{inv.role}</span> · expires{' '}
                    {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      disabled={isPending}
                      aria-label={`Revoke invitation to ${inv.email}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The invitation to <strong>{inv.email}</strong> will be revoked
                        and the link will stop working. You can send a new invitation
                        later.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleRevoke(inv.id, inv.email)}>
                        Revoke
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
