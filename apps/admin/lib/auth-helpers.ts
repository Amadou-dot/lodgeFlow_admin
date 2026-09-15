type HasFunction = (params: { role: string }) => boolean;

/**
 * Check if a user has an authorized role (admin)
 * @param has - Clerk's has() function from auth()
 * @returns true if user has admin role, false otherwise
 */
export function hasAuthorizedRole(has: HasFunction | undefined): boolean {
  if (!has) return false;

  return has({ role: 'org:admin' });
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

/**
 * Determines whether the server-side auth bypass is active.
 *
 * SECURITY: this gate is deliberately NOT driven by a `NEXT_PUBLIC_*`
 * variable. Public env vars are inlined into the client bundle at build
 * time, are trivially discoverable by an attacker, and previously meant
 * the entire auth stack could be disabled by a single build-time flag —
 * failing OPEN if a non-production deploy was ever internet-reachable.
 *
 * The bypass now requires a server-only `TESTING_AUTH_BYPASS=true` AND a
 * non-production `NODE_ENV`. It fails CLOSED: any missing/mismatched
 * condition returns false, and it can never activate in production.
 *
 * This is for LOCAL development/testing only. Never set
 * `TESTING_AUTH_BYPASS` in a deployed (staging or production) environment.
 */
export function isAuthBypassEnabled(): boolean {
  // Never bypass in production, regardless of any other flag.
  if (process.env.NODE_ENV === 'production') return false;

  return process.env.TESTING_AUTH_BYPASS === 'true';
}
