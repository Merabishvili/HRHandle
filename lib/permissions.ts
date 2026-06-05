export type OrgRole = 'owner' | 'admin' | 'member'

export function isOrgAdmin(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin'
}
