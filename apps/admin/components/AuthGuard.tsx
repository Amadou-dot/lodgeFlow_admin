'use client';

import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  pagePermission,
  PERMISSIONS,
  type Permission,
  type StaffRole,
} from '@/lib/permissions';

type Access = {
  userId: string;
  role: StaffRole;
  permissions: readonly Permission[];
};
const AccessContext = createContext<Access | null>(null);
export function useStaffAccess() {
  return useContext(AccessContext);
}
export function usePermission(permission: Permission) {
  return useStaffAccess()?.permissions.includes(permission) ?? false;
}
const isTestMode =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_TESTING === 'true';
export function AuthGuard({ children }: { children: React.ReactNode }) {
  if (isTestMode)
    return (
      <AccessContext.Provider
        value={{ userId: 'test-user', role: 'admin', permissions: PERMISSIONS }}
      >
        {children}
      </AccessContext.Provider>
    );
  return <ClerkAuthGuard>{children}</ClerkAuthGuard>;
}
function ClerkAuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, orgId, userId, sessionId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [verified, setVerified] = useState<{
    access: Access;
    userId: typeof userId;
    orgId: typeof orgId;
    sessionId: typeof sessionId;
  } | null>(null);
  // Never reuse permissions across users, organizations, or sessions.
  const access =
    isLoaded &&
    isSignedIn &&
    verified?.userId === userId &&
    verified?.orgId === orgId &&
    verified?.sessionId === sessionId
      ? verified?.access
      : null;
  useEffect(() => {
    setVerified(null);
  }, [isLoaded, isSignedIn, orgId, userId, sessionId]);
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace('/sign-in');
      return;
    }
    const controller = new AbortController();
    fetch('/api/staff/access', { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Staff access denied');
        const { data } = await response.json();
        if (!controller.signal.aborted)
          setVerified({ access: data, userId, orgId, sessionId });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setVerified(null);
          router.replace('/unauthorized');
        }
      });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, orgId, userId, sessionId, pathname, router]);
  // Route checks run immediately using verified permissions while the server
  // revalidates in the background, without unmounting the dashboard shell.
  useEffect(() => {
    if (access && !access.permissions.includes(pagePermission(pathname)))
      router.replace('/unauthorized');
  }, [access, pathname, router]);
  if (
    !access ||
    !isSignedIn ||
    !access.permissions.includes(pagePermission(pathname))
  ) {
    return <div className='p-8 text-center'>Checking staff access…</div>;
  }
  return (
    <AccessContext.Provider value={access}>{children}</AccessContext.Provider>
  );
}
