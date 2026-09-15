# Shared database and booking reconciliation

## Current state

Step 1 is deployed from the monorepo. The independent lazy Resend fix is PR 140.
This plan breaks Step 2 into reviewable changes; it does not require a large simultaneous
rewrite. Each change must build and pass both apps' tests before deployment.

The database audit found 500 cabin bookings, 1 dining reservation, and 2 experience
bookings. Among cabin bookings, 339 are marked paid with an outstanding balance, 30
have an unpaid deposit due, and 398 have a paid-deposit flag without a Stripe reference.
These are overlapping counts, not proof of received payments.

**Data decision:** the user explicitly authorized replacing all data on 2026-09-14,
superseding their preceding request to preserve it. Replace reservation/payment demo
records only after the new rules and seed generator pass tests. Rebuild the demo catalogs and settings together with reservations in one transaction,
so a failed replacement leaves the prior dataset intact. No real payment or email is necessary to create demo data.

## Delivery sequence

- [x] Extract `@lodgeflow/database`: eight domain models, private lock infrastructure,
  connection cache, shared schema enums, logger, settings defaults, and booking pricing.
  Keep app-facing helpers as small re-exports where useful; remove both app `models/`
  directories. Export individual model subpaths for existing default imports, but do not
  export the lock storage module.
- [x] Reconcile schemas with explicit tests: admin booking validation/hook, a single
  non-partial overlap index, settings caps/defaults with `max >= min`, query-safe cabin
  discounts and the 20-amenity cap. Use a targeted, explicit index migration rather than
  letting two apps independently synchronize indexes. Test concurrent singleton seeding.
- [x] Reconcile payment accounting: keep required deposit separate from payments received;
  use received payments for balances and paid flags. Share creation/repricing calculations.
  Update admin payment recording and the existing customer checkout/webhook together.
  Reject price-changing edits during checkout or after payment unless a supported
  settlement policy handles the change. Do not add an admin webhook or refund UI.
- [x] Adopt shared cabin locking and trusted pricing in customer creation and edits. Cover
  ownership, overlapping concurrent requests, immutable paid amounts, raw fee tampering,
  and stale/duplicate checkout events in integration tests.
- [x] Serialize dining capacity through shared state and test competing last-seat requests
  on a replica set. Include all capacity-changing mutations; audit experience capacity too.
- [x] Seed coherent demo reservations using the shared pricing/payment rules, with explicit
  demo provenance and no Stripe-looking payment IDs. Audit the resulting data and indexes.
- [x] Deploy both apps, verify production and update this record before Step 3 permissions.

## Preserved customer work

Original PR 73 is preserved on `archive/customer-pr-73`; it implements the unfinished
dining/experience Stripe checkout tracked by monorepo issues 138 and 137. Original PR 78
is preserved on `archive/customer-pr-78`; port useful security fixes after checking each
against the shared implementation. Its transaction-only cabin race fix is insufficient
and must not replace the shared cabin lock. The archived PR discussion remains readable.

The current customer app creates dining/experience reservations but does not yet complete
Stripe checkout for those products. The original design's claim that customers already
paid for them is inaccurate. The admin reservations inbox is still useful for unpaid
reservations; payment enablement remains explicit work rather than an assumed capability.

## Verification

Run workspace lint/tests, both app builds with SDK keys absent, and package type checking.
Schema/concurrency tests use disposable local MongoDB. Production checks read data or
reject invalid requests; seed writes are limited to the authorized demo-data replacement.

## Extraction validation

Both app builds and all 1,090 existing tests pass; the package adds five tests for
schema rules, the overlap index, and concurrent singleton creation. Shared source has
its own CI matrix leg. The read-only hydration/validation audit reports zero invalid
records across 500 bookings, 15 cabins, 1 settings document, 14 dining listings,
8 experiences, 1 dining reservation, and 2 experience bookings. This does not certify
payment accounting, which still uses the legacy semantics until the next change.

The live overlap index already has the desired non-partial definition. Retain its
existing name explicitly instead of dropping/recreating a correct index. Keep both
status indexes for current query compatibility. Settings now uses a real unique
`singleton` index instead of the invalid empty-key declaration; existing single-record
settings remain readable, and concurrent first creation is tested.

## Accounting implementation (deployed)

PR 141 merged as `0f105aa`; both apps now consume the same model definitions.
The next change introduces explicit receipt entries (`amountPaid` is their sum),
with `depositAmount` representing only the deposit requirement. Offline payment
recording rejects overpayments and uses receipt IDs; version comparisons prevent
concurrent writers from overwriting each other. Customer creates use the shared
cabin lock, and edits use trusted pricing and ownership checks.

Checkout reserves a versioned quote before calling Stripe. Paid bookings and active
checkouts cannot be repriced. Signed completion events validate the reserved amount,
currency, and token; duplicate receipts are harmless and failed processing remains
retryable. Cancellation claims the booking before requesting per-receipt refunds.
Requested refunds and completed refunds are separate; offline refunds stay pending
for staff. Unresolved Stripe refund requests older than 23 hours require reconciliation
because provider idempotency keys expire after at least 24 hours.

The replacement seed creates 500 non-overlapping stays with simulated cash receipts,
uses the shared pricing helper, and clears dining/experience reservations alongside
their catalogs. It fetches Clerk users and validates all data before transactional
replacement. A rollback test injects a write failure. The nightly reset is removed;
the bearer-protected reset and CLI remain available for intentional demo refreshes.
The old metadata backfill is retired because it inferred money received from deposit
due and would corrupt the new accounting.

Validation covers competing cabin requests, stale payment saves, duplicate Stripe
settlement, signed webhook failure/retry, out-of-order refund events, 500 generated
reservations, and transactional reset rollback. These checks do not replace an
end-to-end authenticated Stripe Checkout test on the deployed customer app.

## Production accounting and reset verification

PR 142 merged as `6fac178`. Both Vercel production deployments are Ready:
customer `lodgeflow-6yyahbanf-asecklabs.vercel.app` and admin
`lodgeflowadmin-kapzvjfp8-asecklabs.vercel.app`. Preview home/sign-in return 200;
an unsigned webhook request returns 400. A real browser loads `https://lodgeflow.app`
and Clerk sign-in successfully.

The authorized production reset succeeded with 500 bookings, 15 cabins, 14 dining
listings, 8 experiences, and 1 settings record, using 52 existing Clerk identities.
Dining/experience reservations were cleared with their catalogs. The subsequent
read-only audit found zero schema failures, inconsistent financial totals, missing
cabin references, overlapping active stays, or invalid receipts. The overlap index
has the expected non-partial definition. No real charges were created by seeding.

## Capacity implementation (deployed)

All dining and experience reservation creates, edits, and cancellations now write
a shared version field on the relevant catalog document within their transaction.
This creates a real write conflict and forces competing transactions to retry with
fresh capacity; a transaction containing only independent reservation inserts was
insufficient. Admin capacity edits and listing deletions use the same transaction
boundary. Lowering capacity below existing future reservations is rejected, and
listings referenced by reservation history cannot be deleted.

Dining capacity remains per UTC date and exact time; experience capacity remains
per UTC date across all descriptive time slots. Guest PATCH requests validate party
sizes/dates, scope ownership, and recompute prices. Paid reservations cannot be
repriced or moved; cancelling paid dining/experience reservations requires staff
until those products have an implemented refund flow.

Replica-set tests cover competing last-seat requests, simultaneous slot moves,
cancellation releasing capacity, experience repricing, and an admin reducing
capacity during a booking request. No additional database collection or index
migration is required for the catalog version field.

## Guest authentication configuration (resolved)

A browser test on the production customer site authenticated an isolated test account,
but Clerk reported `session.status = pending` and
`session.currentTask.key = choose-organization`. The protected booking API returned
an HTML 404 because pending sessions are treated as signed out. Preview and production
Clerk keys were compared without exposing values and match; this is an instance
configuration requirement, not a key mismatch.

The production Clerk instance needs **Organizations → Settings → Membership optional**
(Personal Accounts enabled), so customers can book without joining the staff
organization. Staff access remains controlled by the admin app's role checks.
The supported Backend API's organization-settings update does not expose this setting;
the project owner needs to change it in the Clerk Dashboard. References:
[organization configuration](https://clerk.com/docs/guides/organizations/configure#personal-accounts),
[session task behavior](https://clerk.com/docs/guides/configure/session-tasks), and
[supported settings API](https://clerk.com/docs/reference/backend/instance/update-organization-settings).

After that change, repeat guest booking → hosted Stripe test checkout → receipt
settlement → balance payment/refund verification. The isolated account created for
this test is removed at handoff. No test reservation or charge was created because
Clerk rejected the booking request. Proceed with Step 3 permissions after this gate.

## Latest checkpoint

PR 143 merged as `03e33d1`. Both production deployments are Ready:
customer `lodgeflow-p1fmw7n7t-asecklabs.vercel.app` and admin
`lodgeflowadmin-h1lfoxg3o-asecklabs.vercel.app`. Its customer preview returned 200
with all 14 dining listings and 8 experiences. All 1,104 tests pass (953 admin,
135 customer, 16 shared database), and both application builds pass.

The project owner enabled optional Organization membership. A fresh browser test
confirmed the guest session is now **active** and the booking API returns **201**.
The previous `choose-organization` blocker is resolved.

Hosted checkout then returned 500. A direct, read-only Stripe API probe confirmed
**401 / `api_key_expired`** for the configured `STRIPE_SECRET_KEY`; it is a test-mode
key. The owner needs to replace that variable in the customer Vercel project's
Preview and Production environments. Redeploy after the replacement, then repeat
checkout/receipt/refund verification. Never put the replacement secret in Git or
chat. A temporary isolated reservation is retained only while this smoke test is
in progress and must be removed with its test account at completion or handoff.

## Stripe verification (resolved)

The replacement Preview and Production secrets both authenticated successfully against
Stripe's balance API and reported `livemode: false`. Both environments were redeployed
through the Vercel CLI from `b30389e`.

The Stripe test account had no LodgeFlow webhook destination. Created
`https://www.lodgeflow.app/api/payments/webhook` for checkout completion, asynchronous
payment success, checkout expiration, and charge refunds. Stored its signing secret
directly in both Vercel environments and redeployed again. Final deployments are Ready:

- Production: `lodgeflow-lo0q345q8-asecklabs.vercel.app`
- Preview: `lodgeflow-np8o35bxz-asecklabs.vercel.app`

An isolated Clerk guest account exercised the production application with Stripe's
[documented test card](https://docs.stripe.com/testing):

1. Guest booking creation returned 201; hosted Checkout creation returned 200.
2. A $90 deposit on a $360 stay settled through the real Stripe webhook. The booking
   became confirmed with one receipt, $90 received, and $270 outstanding.
3. A second hosted checkout collected the $270 balance. The ledger showed two
   receipts, $360 received, and zero outstanding.
4. Customer cancellation returned 200 and requested a full refund. Both Stripe
   payments were independently verified fully refunded. Refund webhooks recorded
   `refundAmount: 360` and `refundStatus: full` on the cancelled booking.
5. Removed only the verified, fully refunded temporary booking and its Clerk account.
   The database again contains 500 demo bookings. Stripe retains the refunded test
   transactions as provider history.

This was a test-mode payment exercise on the production deployment. No real money
was charged. Browser observation ended on Stripe's success indicator; the automatic
return navigation to LodgeFlow was not asserted. Receipt and refund settlement were
verified independently against both Stripe and MongoDB. Step 2's settlement gate is
complete; existing unit/integration checks remain 1,104 passing tests.

## Step 3 prerequisite and proposed revision

Clerk currently exposes `org:admin` and `org:customer`. Attempting to create the
planned `org:front_desk` role returned **HTTP 402** with
`unsupported_subscription_plan_features`. No role or membership was changed.
Clerk's [custom role documentation](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions)
requires its B2B Authentication add-on for production custom roles. Do not upgrade
the subscription without the project owner's choice.

Recommended alternative for this personal project, pending that choice:

- Keep Clerk for identity and organization membership; store front-desk and manager
  assignments in a shared LodgeFlow staff-access collection, keyed by organization
  and Clerk user ID, with a unique compound index.
- Bind staff access to the designated LodgeFlow staff organization. Creating an
  unrelated organization must never grant access to LodgeFlow administration.
- Keep the planned permission matrix and server-side enforcement. Resolve staff
  assignments on the server and require active membership of the trusted organization.
  Preserve its existing administrators' access; only they may manage assignments.
- Keep the coarse proxy gate separate from database-backed authorization. Every
  protected API must enforce staff access and its operation-specific permission;
  sidebar visibility is only presentation. Unannotated API routes remain admin-only
  while the route migration is in progress.
- Deny personal guest accounts, customer memberships, unknown roles, and missing
  assignments. Fail closed when authorization cannot be resolved. The previous
  assumption that every guest has `org:customer` is obsolete: personal guests work.
- Test the full permission matrix, organization isolation, revocation, membership
  removal, and default-deny behavior before deploying the expanded staff access.

The other option is for the owner to enable Clerk's required paid feature, retaining
the planned custom-role source. Implementation and deployment of Step 3 wait for this
architecture/billing choice; checkout and refund verification no longer block it.
