# Guest identity troubleshooting

Cabin bookings store a Clerk user ID in `Booking.customer`. Dashboard activity,
the bookings list and the reservations inbox resolve that ID through
`apps/admin/lib/clerk-users.ts`. A missing identity displays **Unavailable guest**
on all three reads, and on dining/experience reservation details. A present
Clerk account with no profile name still uses the existing name conversion rules.

The Guests page lists accounts directly from the configured Clerk instance, then
joins their IDs to MongoDB bookings for booking counts and spending. Names on that
page with zero bookings, alongside unavailable guests on bookings, can indicate
that the stored IDs belong to a different Clerk instance.

## Confirmed incident: 2026-10-31

A read-only MongoDB audit found 500 demo bookings referencing 50 development Clerk
users. All 50 IDs existed in development; none existed among the 52 production
users. Production Vercel logs recorded Clerk `404 resource_not_found` responses
for the same stored IDs. The active admin deployment was Ready at
`37b792869a311bd15de085804fd14c99fe468c06`.

Local environment files selected development Clerk keys and the affected database.
At the time of the incident, `apps/admin/scripts/seed.ts` loaded `.env.local` from
the working directory. `apps/admin/lib/seed-database.ts` obtains guest IDs using
that environment's
`CLERK_SECRET_KEY`. This combination can replace shared demo data with identities
that the production application cannot resolve. The audit establishes the
identity mismatch; it does not independently establish which seed invocation
wrote those records.

The inconsistent labels were separate fallbacks in the dashboard, bookings and
reservations routes. They now share `apps/admin/lib/guest-display.ts`. This display
correction does not repair persisted guest references.

After explicit user approval, a targeted repair committed at
`2026-10-31T19:07:44Z`. One MongoDB transaction changed only `Booking.customer` on
the 500 snapshotted demo bookings, redistributing them to 50 existing production
guests and excluding the two production staff accounts. A fresh read after commit
verified zero unresolved guest references, zero staff guest references, and all
500 bookings joining to production Guests statistics. Every other booking field
matched the rollback snapshot exactly; catalog, settings, reservation and staff
collection fingerprints were unchanged. The rollback snapshot and repair reports
are saved under `/tmp/lodgeflow-guest-repair-*`. Hosted browser rendering was not
verified.

## Local seed status

The local admin command (`pnpm --filter @lodgeflow/admin seed`) is disabled until a
separate testing database is configured. Its entry point prints a notice and exits
successfully without importing the seed operation, loading `.env.local`, or
opening a database connection. There is no environment flag to bypass this pause.

Live demo seeding is managed by the owner's n8n workflow. The shared
`seedDatabase()` implementation and authenticated `/api/cron/seed` endpoint are
unchanged. Re-enable the local entry point only after its database is separate
from the live database and its Clerk instance matches the intended test users.

## Diagnosis and repair

1. Identify the active deployment and its commit. Compare local and deployed Clerk
   environments without printing secret values.
2. Read distinct `Booking.customer` values and compare them with the intended
   Clerk instance's paginated user list. Verify production lookup errors in
   runtime logs. Do not interpret a Clerk outage as a deleted identity.
3. Confirm the database target before any seed operation. Development and
   production Clerk instances need separate demo databases when their user IDs
   differ. Do not run the local seed against the production database using
   development identities.
4. Obtain explicit scope before repairing records or resetting demo data, as
   required by `AGENTS.md`. A full seed replaces settings, catalogs and
   reservations. For this synthetic dataset, a narrower repair can redistribute
   only booking guest references to existing non-staff production guests, with a
   reviewed mapping and rollback snapshot. This is a reassignment of demo data,
   not an identity match between the two Clerk instances.
5. After an approved repair, verify that all stored guest references resolve in
   the intended instance, staff accounts have no demo reservations, and dates,
   pricing, receipts and other fields remain unchanged. Check all three staff
   pages and Guests statistics. Missing-user cache entries expire after five
   minutes; a reassignment to different IDs does not reuse those entries.

Never resolve a production booking by silently looking up its ID in a different
Clerk instance or by guessing an account from its display name.
