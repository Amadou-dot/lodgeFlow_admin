import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { hasAuthorizedRole } from '@/lib/auth-helpers';

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/',
  '/unauthorized(.*)',
  '/api/cron/seed',
]);

export default clerkMiddleware(async (auth, req) => {
  // Bypass auth in non-production environments when TESTING=true
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_TESTING === 'true'
  ) {
    return;
  }

  // Allow public routes without any checks
  if (isPublicRoute(req)) {
    return;
  }

  // Protect all other routes - require authentication
  const { has, orgId, redirectToSignIn, sessionClaims } = await auth();

  // Check if user is authenticated
  if (!sessionClaims) {
    return redirectToSignIn();
  }

  // Only allow admins of the allowed organization to access the application
  if (!hasAuthorizedRole(has, orgId)) {
    const unauthorizedUrl = new URL('/unauthorized', req.url);
    return NextResponse.redirect(unauthorizedUrl);
  }

  // User has valid role (admin), allow access
  return;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
