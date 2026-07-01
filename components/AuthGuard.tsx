'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { hasAuthorizedRole } from '@/lib/auth-helpers';

interface AuthGuardProps {
  children: React.ReactNode;
}

const isTestMode =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_TESTING === 'true';

export function AuthGuard({ children }: AuthGuardProps) {
  if (isTestMode) return <TestModeGuard>{children}</TestModeGuard>;
  return <ClerkAuthGuard>{children}</ClerkAuthGuard>;
}

function TestModeGuard({ children }: AuthGuardProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

function ClerkAuthGuard({ children }: AuthGuardProps) {
  const { isLoaded, isSignedIn, has, orgId } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to load
    if (!isLoaded) return;

    // If user is not signed in, redirect to sign-in page
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Check user role - only allow admins of the allowed organization
    if (!hasAuthorizedRole(has, orgId)) {
      router.replace('/unauthorized');
      return;
    }
  }, [isLoaded, isSignedIn, has, orgId, router]);

  // Show loading state while auth is loading
  if (!isLoaded) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading state while redirecting
  if (!isSignedIn) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  // Check role before rendering
  if (!hasAuthorizedRole(has, orgId)) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>Checking permissions...</p>
        </div>
      </div>
    );
  }

  // User is authenticated and has valid role, show the protected content
  return <>{children}</>;
}
