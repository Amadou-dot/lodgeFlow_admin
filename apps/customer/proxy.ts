import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedApiRoute = createRouteMatcher([
  '/api/bookings(.*)',
  '/api/dining-reservations(.*)',
  '/api/experience-bookings(.*)',
  '/api/payments(.*)',
  '/api/send(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Stripe webhook is verified by signature, not Clerk session.
  if (req.nextUrl.pathname === '/api/payments/webhook') {
    return;
  }
  if (isProtectedApiRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
