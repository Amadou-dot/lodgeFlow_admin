type HasFunction = (params: { role: string }) => boolean;

/**
 * The only Clerk organization whose admins may access this application.
 * Role checks must be pinned to this org: Clerk's has({ role }) evaluates
 * against the session's *active* organization, so without this pin any user
 * who creates their own organization (becoming its org:admin) would pass.
 */
export const ADMIN_ORG_ID =
  process.env.NEXT_PUBLIC_CLERK_ADMIN_ORG_ID ??
  'org_3ABTHyAkAA9jjvi4W3nBYGuT55u';

/**
 * Check if a user has an authorized role (admin of the allowed organization)
 * @param has - Clerk's has() function from auth()
 * @param orgId - The session's active organization ID from auth()/useAuth()
 * @returns true if the active org is the allowed org and the user is its admin
 */
export function hasAuthorizedRole(
  has: HasFunction | undefined,
  orgId: string | null | undefined
): boolean {
  if (!has || !orgId) return false;

  return orgId === ADMIN_ORG_ID && has({ role: 'org:admin' });
}

/**
 * Authorized role constants for reuse
 */
export const AUTHORIZED_ROLES = {
  ADMIN: 'org:admin',
  CUSTOMER: 'org:customer',
} as const;

export type AuthorizedRole =
  (typeof AUTHORIZED_ROLES)[keyof typeof AUTHORIZED_ROLES];
