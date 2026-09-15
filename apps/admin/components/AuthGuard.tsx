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
  const { isLoaded, isSignedIn, orgId, userId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState<Access | null>(null);
  useEffect(() => {
    setAccess(null);
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
        if (!data.permissions.includes(pagePermission(pathname)))
          throw new Error('Page access denied');
        if (!controller.signal.aborted) setAccess(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) router.replace('/unauthorized');
      });
    return () => controller.abort();
  }, [isLoaded, isSignedIn, orgId, userId, pathname, router]);
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
