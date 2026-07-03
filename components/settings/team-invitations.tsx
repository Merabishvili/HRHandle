'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  inviteTeamMember,
  revokeInvitation,
  resendInvitation,
  updateMemberRole,
  removeMember,
} from '@/lib/actions/invitations'
import { adminResetUserFactors } from '@/lib/actions/mfa'
import { Loader2, Mail, MoreHorizontal, RefreshCw, Shield, ShieldOff, X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [isPending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)

  const handleInvite = () => {
    startTransition(async () => {
      const result = await inviteTeamMember(email, role)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      // Dismissable toast (not a persistent inline banner) + refresh so the
      // new invite appears in the Pending invitations list below.
      toast.success(`Invitation sent to ${email}`)
      setEmail('')
      setRole('member')
      router.refresh()
    })
  }

  const handleRevoke = (id: string, inviteeEmail: string) => {
    startTransition(async () => {
      const result = await revokeInvitation(id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Invitation to ${inviteeEmail} revoked.`)
      router.refresh()
    })
  }

  const handleResend = (id: string, inviteeEmail: string) => {
    setBusyId(id)
    startTransition(async () => {
      const result = await resendInvitation(id)
      setBusyId(null)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`Invitation resent to ${inviteeEmail}.`)
    })
  }

  const handleRoleChange = (member: TeamMember, next: 'admin' | 'member') => {
    startTransition(async () => {
      const result = await updateMemberRole(member.id, next)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${member.full_name} is now ${next === 'admin' ? 'an admin' : 'a member'}.`)
      router.refresh()
    })
  }

  const handleRemove = (member: TeamMember) => {
    startTransition(async () => {
      const result = await removeMember(member.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(`${member.full_name} removed from the team.`)
      router.refresh()
    })
  }

  const handleReset2fa = async (member: TeamMember) => {
    const res = await adminResetUserFactors(member.id)
    if (res.success) toast.success(`2FA reset for ${member.full_name}`)
    else toast.error(res.error)
  }

  const multipleMembers = teamMembers.length > 1

  return (
    <div className="space-y-6">
      {/* Current team members */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Team members</h3>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {teamMembers.map((member) => {
            const isSelf = member.id === currentUserId
            const isOwner = member.role === 'owner'
            // Owner/admins manage everyone except themselves and the owner.
            const canManage = multipleMembers && !isSelf && !isOwner
            return (
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
                  {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          aria-label={`Manage ${member.full_name}`}
                          disabled={isPending}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {member.role === 'member' ? (
                          <DropdownMenuItem onSelect={() => handleRoleChange(member, 'admin')}>
                            Make admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => handleRoleChange(member, 'member')}>
                            Make member
                          </DropdownMenuItem>
                        )}
                        {member.mfa_enrolled && (
                          <DropdownMenuItem onSelect={() => handleReset2fa(member)}>
                            Reset 2FA
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => e.preventDefault()}
                            >
                              Remove from team
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove {member.full_name}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                They&apos;ll lose access to this organization immediately. Their
                                account isn&apos;t deleted — you can re-invite them later.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => handleRemove(member)}
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </li>
            )
          })}
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
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Pending invitations</h3>
        {pendingInvitations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No pending invitations.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {pendingInvitations.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="capitalize">{inv.role}</span> · expires{' '}
                    {formatDistanceToNow(new Date(inv.expires_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleResend(inv.id, inv.email)}
                    disabled={isPending}
                  >
                    {busyId === inv.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-3 w-3" aria-hidden />
                    )}
                    Resend
                  </Button>
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
                          The invitation to <strong>{inv.email}</strong> will be revoked and the
                          link will stop working. You can send a new invitation later.
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
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
