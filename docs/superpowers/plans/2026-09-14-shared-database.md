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
- [ ] Serialize dining capacity through shared state and test competing last-seat requests
  on a replica set. Include all capacity-changing mutations; audit experience capacity too.
- [ ] Seed coherent demo reservations using the shared pricing/payment rules, with explicit
  demo provenance and no Stripe-looking payment IDs. Audit the resulting data and indexes.
- [ ] Deploy both apps, verify production and update this record before Step 3 permissions.

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

## Accounting implementation (deployment pending)

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
