# LodgeFlow: Monorepo Consolidation & Admin Gap Closure

**Date:** 2026-08-04
**Status:** Approved design, ready for implementation planning

> **Path convention.** File paths in this document use their **post-migration** location
> (`apps/admin/...`, `apps/customer/...`). Line numbers cite the code as it exists today in the
> pre-migration repositories.

## Problem

LodgeFlow is two Next.js applications — an admin dashboard (`admin.lodgeflow.app`) and a
customer-facing booking site (`lodgeflow.app`) — living in separate repositories while sharing
a single MongoDB database (`lodgeflow`) and a single Clerk tenant. They have drifted apart in
two ways that matter.

### The admin app cannot see two thirds of the business

The customer site sells three products:

| Product | Customer can book it | Admin can manage it |
| --- | --- | --- |
| Cabin stays | Yes | Yes |
| Dining reservations | Yes (`DiningReservation`) | **No** |
| Experience bookings | Yes (`ExperienceBooking`) | **No** |

The admin's `/dining` and `/experiences` routes are catalog editors — they manage menu items and
tour listings. No screen anywhere shows a dining reservation or experience booking that a
customer actually paid for.

### Hardening applied to one app never reached the other

Five issues (#121, #123, #124, #125, #126) hardened booking creation in the admin app. The
customer app writes to the same `bookings` collection and received none of it:

- **Live TOCTOU race.** `apps/customer/app/api/bookings/route.ts` calls
  `Booking.findOverlapping()` (line 71) then `Booking.create()` (line 157) with no lock. The
  admin closed this exact race with `withCabinBookingLock()`. Two guests booking the same cabin
  for overlapping dates simultaneously can both succeed.
- **Client-influenced pricing.** The customer computes `const totalPrice = cabinPrice +
  extrasPrice` inline (line 151). The admin derives all pricing server-side via
  `lib/booking-pricing.ts` and freezes `depositAmount` after creation.

### The schemas themselves have diverged

The two `models/` directories share field *names* but not field *semantics*. `Dining`,
`Experience`, and `ProcessedStripeEvent` are equivalent; `Booking`, `Cabin`, and `Settings` are
not.

**`Booking` — the `pre('save')` hooks are different programs.**

```typescript
// admin/models/Booking.ts — conditional, clamped, also recomputes numNights
if (this.isNew || this.isModified('totalPrice') || this.isModified('depositAmount')) {
  this.remainingAmount = Math.max(0, this.totalPrice - this.depositAmount);
}
```

```typescript
// customer/models/Booking.ts — unconditional, unclamped, no numNights
BookingSchema.pre('save', function () {
  this.remainingAmount = this.totalPrice - this.depositAmount;
});
```

Mongoose runs `pre('save')` *after* validation, so the customer path can persist a negative
`remainingAmount` straight past its own `min: [0]` rule. The customer model also never computes
`numNights`, relying on the route to supply it. The admin sets `min: 0` on every `extras.*Fee`
and a default of `0` on `remainingAmount`; the customer does neither.

**`Booking` — the index definitions conflict on the same collection.**

| Index | admin | customer |
| --- | --- | --- |
| `{cabin, checkInDate, checkOutDate}` | plain | `partialFilterExpression: {status: {$nin: ['cancelled']}}` |
| status index | `{status: 1}` | `{status: 1, checkInDate: 1}` |

Same key pattern, different options, no distinct names — whichever app calls `syncIndexes` or
runs with `autoIndex` second hits an options conflict. (The customer's comment labels that
partial index "Prevent overlapping bookings for the same cabin," but it is not `unique`, so it
prevents nothing.)

**`Settings` — different validation and different seeding.** The admin caps
`minBookingLength ≤ 30`, `maxBookingLength ≤ 365`, `maxGuestsPerBooking ≤ 50`; the customer has
no caps but adds defaults (2 / 30 / 8). The cross-field rule differs in kind: admin permits
`max >= min`, the customer's `pre('validate')` requires `max > min` strictly. And `getSettings()`
seeds differently — admin from `lib/data/seed-data.ts`, customer from a bare `this.create({})`.
The singleton document differs depending on which app touches an empty database first.

**`Cabin` — the discount validator.** The admin's was deliberately hardened to work in Query
context (`findByIdAndUpdate`); the customer's naive `this.price` version evaluates
`discount < undefined` → always `false` under `runValidators`. The customer caps `amenities` at
20 and validates `images` at array level; the admin does neither but validates `images`
per element.

So there *is* latent data risk today, not merely a maintenance smell: documents written through
the customer app can violate rules the admin app believes are enforced. This makes Step 2 a
semantic merge with per-field decisions, not a file move — see "Schema reconciliation" below.

## Goals

Make admin and customer a coherent single product: anything a customer can do, an admin can see
and manage; and hardening applied once applies everywhere.

### Non-goals

- **Stripe refunds and the admin-side webhook.** Deferred by explicit decision. The audit action
  vocabulary includes `refund.issue` and `payment.record` from day one so this is a later
  addition, not a redesign.
- **Drag-to-reschedule on the calendar.** Moving a booking requires re-running overlap detection
  under the cabin lock, recomputing pricing, and resolving what happens to a paid deposit when
  the total changes. That is its own spec.
- **Housekeeping / room status**, and the housekeeping role that would depend on it.
- **Shared UI, validations, or API-utility packages.** Extracted only when a second consumer
  proves the boundary.

## Architecture

### Target layout

```
lodgeflow/
├── apps/
│   ├── admin/          # was lodgeFlow_admin  → admin.lodgeflow.app
│   └── customer/       # was lodgeFlow        → lodgeflow.app
├── packages/
│   └── database/       # models + connectDB + shared enums + booking safety
├── pnpm-workspace.yaml
└── package.json        # scripts delegate to apps
```

### Why the migration comes first

The unified reservations inbox needs `DiningReservation` and `ExperienceBooking`, which the admin
app does not have. Building the inbox before the monorepo means copying two more models across
repos — going from 5 duplicated models to 7, deepening duplication that is already slated for
deletion, and rewriting import paths twice.

### Migration compatibility

The two apps are more compatible than their separate histories suggest:

- Both already use pnpm and carry a `pnpm-workspace.yaml` (currently only for `allowBuilds` and
  `overrides`, not as real workspaces).
- Versions align: React `18.3.1` both, `@clerk/nextjs` `^6.36.7` both, SWR `^2.3.8` both, Zod
  `^4.3.5` vs `^4.3.6`, Mongoose `^8.20.1` vs `^8.21.0`, Next `16.2.10` vs `^16.1.1`.
- Both use the same `@/*` → `./*` TypeScript path alias and the same granular HeroUI package
  style.
- The customer repo's `@internationalized/date` pin to `3.12.2` (documented at length in its
  `pnpm-workspace.yaml`) becomes simpler in a monorepo: one override covers both apps.

The real migration costs are CI, two Vercel projects, and environment variables — not dependency
resolution.

### Git history

Both apps move in via `git subtree add`, preserving all 484 commits (297 admin + 187 customer).
A portfolio repository that begins with a single squashed "initial commit" discards the evidence
that the work was done.

## Components

### `packages/database`

**Exports:** the 8 Mongoose models, `connectDB`, the status enums the schemas depend on, plus
`withCabinBookingLock()` and `calculateBookingPricing()`.

From `admin/lib/config.ts`: `BOOKING_STATUSES`, `REFUND_STATUSES`, `PAYMENT_METHODS`,
`CABIN_STATUSES`, `DINING_TYPES`, `MEAL_TYPES`, `DINING_CATEGORIES`, `BEVERAGE_CATEGORIES`,
`DIETARY_OPTIONS`, `EXPERIENCE_DIFFICULTIES`.

From `customer/lib/config.ts`, required once `DiningReservation` and `ExperienceBooking` move
into the package: `DINING_RESERVATION_STATUSES`, `EXPERIENCE_BOOKING_STATUSES`,
`TABLE_PREFERENCES`. The lifecycle mapping and the per-type `VALID_TRANSITIONS` work both depend
on the first two.

Extracting the enums is not optional — the models reference them, so moving the models drags them
along. It also resolves a three-way duplication rather than a two-way one: the customer app
already holds these enums twice, with its *models* inlining the literals while its *validations*
import from `customer/lib/config.ts`.

**Transitive dependencies that come along.** `lib/cabin-booking-lock.ts` imports `@/lib/logger`,
and the admin's `lib/mongodb.ts` imports both `DB_CONFIG` and `logger`. Those move into the
package too. Note that the two `connectDB` implementations differ — the admin configures
`maxPoolSize`, `serverSelectionTimeoutMS`, and `socketTimeoutMS` from `DB_CONFIG`, while the
customer calls a bare `mongoose.connect` with only `bufferCommands: false`. Unifying them changes
connection behavior for the customer app. **The admin's configured version wins**, on the general
rule that where the two apps differ, the more defensive implementation is adopted.

**Stays out:** `lib/api-utils.ts`, Zod validations, UI components, and hooks remain app-local.
The two apps' validation directories are complementary rather than overlapping (admin has
`cabin`/`customer`/`settings`; customer has `dining-reservation`/`experience-booking`/
`query-params`), so there is no proven shared boundary yet.

**The `CabinBookingLock` boundary.** `models/CabinBookingLock.ts` keeps its Mongoose model
module-private and exposes only `acquire(cabin, token, ttlMs)` and `release(cabin, token)`; it is
deliberately absent from the `models/index.ts` barrel so raw lock CRUD is not one autocomplete
away from every route (issue #126). That constraint becomes *more* important in a shared package,
not less. The package therefore exports `withCabinBookingLock()` only, with no barrel entry for
the model.

`calculateBookingPricing()` ships alongside it. It is arguably application logic rather than
database code, but shipping the lock without the pricing calculator would leave half the
customer-side divergence in place, and the two fixes belong to the same hardening effort.

**Customer adoption** (part of this step, not a follow-up):

```typescript
// apps/customer/app/api/bookings/route.ts — after
import { withCabinBookingLock, calculateBookingPricing } from '@lodgeflow/database';

const result = await withCabinBookingLock(cabinId, async () => {
  const overlapping = await Booking.findOverlapping(cabinId, checkInDate, checkOutDate);
  if (overlapping.length > 0) return { ok: false as const };
  const pricing = calculateBookingPricing({
    cabin, settings, checkInDate, checkOutDate, numGuests, extras,
  });
  return { ok: true as const, booking: await Booking.create({ ...pricing }) };
});
```

This makes the extraction close a production bug rather than merely move files.

**The customer's `PATCH` hole.** Adopting `calculateBookingPricing()` in `POST` alone does not
close client-influenced pricing on the customer side. `updateBookingDetailsSchema`
(`apps/customer/lib/validations/booking.ts:76`) accepts an `extras` object carrying raw fee
amounts — `breakfastPrice`, `petFee`, `parkingFee`, `earlyCheckInFee`, `lateCheckOutFee` — and
`PATCH /api/bookings/[id]` writes them via `findByIdAndUpdate(id, updates)` with no repricing
(line 131). `numGuests` is editable on the same path, also without repricing.

`findByIdAndUpdate` does not fire `pre('save')`, so `totalPrice` and `remainingAmount` are left
untouched; a customer cannot directly lower what they owe. The defect is integrity rather than
theft: `extras.*Fee` silently desynchronizes from `totalPrice`, so an admin reading the booking
sees fees that do not sum to the total, and any future recompute from `extras` inherits the
corruption. Fixing it means stripping fee amounts from the customer-editable schema and
repricing on change. In Step 2 scope.

### Schema reconciliation

Because the schemas have diverged in semantics (see Problem), Step 2 is a semantic merge, not a
move. It requires an explicit winner per divergence:

| Divergence | Resolution |
| --- | --- |
| `Booking` `pre('save')` | Admin's — conditional, clamped, recomputes `numNights` |
| `Booking` `extras.*Fee` `min: 0` | Admin's — keep the floor |
| `Booking` `remainingAmount` default | Admin's — default `0` |
| `Booking` `{cabin, checkIn, checkOut}` index | Single definition, named explicitly; decide partial-filter on/off once |
| `Booking` status index | Admin's `{status: 1}` plus customer's `{status: 1, checkInDate: 1}` if query patterns justify both |
| `Settings` caps | Admin's — keep the upper bounds |
| `Settings` defaults | Customer's — the admin has none |
| `Settings` min/max rule | Decide `max > min` vs `max >= min` explicitly; a 1-night minimum equal to maximum is legitimate, so admin's `>=` is the likely winner |
| `Settings.getSettings()` seed | Admin's — seeds from `lib/data/seed-data.ts` rather than bare defaults |
| `Cabin` discount validator | Admin's — the Query-context-safe version |
| `Cabin` `amenities` cap | Customer's — a cap beats no cap |
| `Cabin` `images` validation | Admin's per-element validation |

**Two additional work items this creates:**

1. **Index migration.** The conflicting definitions must be dropped and recreated under explicit
   names, since same-key-different-options is what produces the conflict.
2. **Data audit.** Documents written under the looser customer schema may not validate under the
   merged stricter one — negative `remainingAmount`, missing `numNights`, `Settings` outside the
   admin's caps. A read-only audit script runs before the merge lands, and a backfill follows if
   it finds violations (`scripts/backfill-*.ts` is the established pattern).

The existing test suites will **not** catch these divergences — the differing rules are mostly
uncovered by either suite. Reconciliation needs its own tests, written against the merged schema.

### Permission layer

Roles live in Clerk (`org:front_desk`, `org:manager`, `org:admin`). The role → permission matrix
lives in `apps/admin/lib/permissions.ts`, keeping membership in the Clerk dashboard while the
matrix stays version-controlled, reviewable, and unit-testable.

| Permission | front_desk | manager | admin |
| --- | :-: | :-: | :-: |
| `bookings:read` | ✓ | ✓ | ✓ |
| `bookings:manage` | ✓ | ✓ | ✓ |
| `cabins:write` | | ✓ | ✓ |
| `settings:write` | | ✓ | ✓ |
| `refunds:issue` | | ✓ | ✓ |
| `audit:read` | | ✓ | ✓ |
| `staff:manage` | | | ✓ |

**Layering.** `proxy.ts` stays coarse — "is this any staff role?" Per-route permission checks in
middleware would require a second copy of the route → permission map that would drift from the
real one. Fine-grained enforcement lives in `requireApiAuth({ permission })`, which is the actual
security boundary. `components/AuthGuard.tsx` and the sidebar hide what the user cannot use;
that is UX, not enforcement.

"Any staff role" means exactly `org:front_desk`, `org:manager`, or `org:admin`. `org:customer` —
the role every customer-site user holds — must remain denied at the middleware gate. The check
is an explicit allow-list of staff roles, never a deny-list or a "has any role" test, so a role
added in the Clerk dashboard grants no admin access until it is added to the matrix in code.

```typescript
const authResult = await requireApiAuth({ permission: 'settings:write' });
if (!authResult.authenticated) return authResult.error;
```

The `permission` argument is optional and defaults to current behavior, so all existing routes
keep working untouched and are tightened one at a time. Existing `org:admin` users lose no
access. There are **four** existing call sites of `hasAuthorizedRole()` — `proxy.ts:35`,
`lib/api-utils.ts:139`, and *two* in `components/AuthGuard.tsx` (line 50 in the effect, line 81
in the render path). `__tests__/unit/lib/auth-helpers.test.ts` also needs updating.

### Audit log

`AuditLog` model in `packages/database`:

| Field | Notes |
| --- | --- |
| `actor` | Clerk user ID |
| `actorRole` | Role at time of action |
| `action` | Enum (below) |
| `resourceType` | `booking` \| `dining_reservation` \| `experience_booking` \| `cabin` \| `settings` \| `staff` |
| `resourceId` | |
| `before` / `after` | Changed fields only, never whole documents |
| `metadata` | Free-form context |
| `createdAt` | Indexed, alongside `actor` and `resourceId` |

No TTL — unlike `ProcessedStripeEvent`, audit records persist.

**Action vocabulary:** `booking.status_change`, `booking.cancel`, `booking.reprice`,
`payment.record`, `refund.issue`, `dining_reservation.status_change`,
`experience_booking.status_change`, `cabin.create`, `cabin.update`, `cabin.delete`,
`settings.update`, `staff.role_change`.

`refund.issue` and `payment.record` are included now despite Stripe being out of scope, so
wiring the webhook later is an addition rather than a redesign.

**Recording is explicit**, via a `recordAudit()` helper called from each mutation route — not
middleware. Middleware can observe that a PATCH occurred but not that it was a refund rather
than a note edit, and a meaningful before/after diff requires domain knowledge.

**Failure mode.** An audit write that throws logs via `logger.error` and is swallowed; it does
not fail the mutation. This matches how `lib/redis.ts` and `lib/rate-limit.ts` already treat
infrastructure. The cost is that a MongoDB hiccup can silently lose a record, which in a real
compliance setting would be unacceptable — there the request would fail closed. This is a
deliberate availability-over-completeness choice for a portfolio application.

**UI:** `/audit`, gated on `audit:read`, filterable by actor, action, resource, and date.

### Unified reservations inbox

Three collections with different field names, date semantics, and status vocabularies must
become one sortable, filterable, paginated list. Merging three API calls client-side breaks on
the first sort or pagination — page 1 of each is not page 1 of the union.

**Read path: a single `$unionWith` aggregation.** `Booking` unions `DiningReservation` and
`ExperienceBooking`, each `$project`ed into a common shape, then sorted and paginated once
across the union.

| Normalized field | Booking | DiningReservation | ExperienceBooking |
| --- | --- | --- | --- |
| `type` | `cabin` | `dining` | `experience` |
| `date` | `checkInDate` | `date` | `date` |
| `endDate` | `checkOutDate` | `null` | `null` |
| `time` | `null` | `time` (`HH:MM`, required) | `timeSlot` (nullable) |
| `partySize` | `numGuests` | `numGuests` | `numParticipants` |
| `resourceName` | cabin name | dining name | experience name |
| `customer` | Clerk user ID | Clerk user ID | Clerk user ID |
| `status` | native | native | native |
| `totalPrice`, `isPaid`, `createdAt` | direct | direct | direct |

The nullable `time` column is not optional detail: a front desk that cannot distinguish a 12:00
from a 19:00 seating cannot use the inbox for dining at all.

**Statuses stay native; a derived `lifecycle` field drives cross-type filtering.** The
vocabularies genuinely differ — only dining has `no-show`, only cabins have `checked-in`.
Flattening them would lose real information.

| `lifecycle` | Booking | DiningReservation | ExperienceBooking |
| --- | --- | --- | --- |
| `pending` | `unconfirmed` | `pending` | `pending` |
| `confirmed` | `confirmed` | `confirmed` | `confirmed` |
| `active` | `checked-in` | — | — |
| `completed` | `checked-out` | `completed` | `completed` |
| `cancelled` | `cancelled` | `cancelled` | `cancelled` |
| `no_show` | — | `no-show` | — |

Each row keeps its native `status` for display and mutation; the filter bar drives `lifecycle`.

**Write path stays per-type.** A single polymorphic mutation endpoint would need a status machine
that is the union of three different ones. `/api/bookings/[id]` already exists; dining and
experience reservations get their own routes, each with its own `VALID_TRANSITIONS` map
alongside the existing booking map in `lib/config.ts`.

One read surface, three write surfaces, is the core architectural claim of this feature.

**Performance properties, acknowledged.** Sorting across a `$unionWith` is a blocking in-memory
sort — no index can serve it, and it is subject to MongoDB's 100 MB limit without
`allowDiskUse`. The correctness argument for unioning server-side still holds (client-side
merging breaks pagination outright), and at this application's scale the sort is comfortably
within limits, but it is a real ceiling rather than a free abstraction. `resourceName` requires
`$lookup` into three collections; those stages must come **after** `$skip`/`$limit` so only the
current page is joined.

Customer names are resolved through the existing `getClerkUser()` / `getClerkUsersBatch()`
helpers, which already cache resolved `Customer` objects in Redis or an in-memory map.

### Occupancy calendar

Three views on one page. All three products have a real capacity model:

| | Availability model | Capacity field | Enforcement today |
| --- | --- | --- | --- |
| Cabins | Exclusive date-range occupancy per unit | — (one booking blocks the span) | `findOverlapping()` + `withCabinBookingLock()` (admin only) |
| Dining | Guests per date + serving window | `maxPeople`, **required** | Per-reservation cap, plus aggregate cap inside `session.withTransaction()` → 409 |
| Experiences | Participants per date | `maxParticipants`, **optional** | Conditional — guarded by `if (experience.maxParticipants)` |

Note the ranking: dining is the *best*-guarded of the three flows, being the only one using a
real MongoDB transaction. Experiences are the weakest, since `maxParticipants` is optional and
enforcement is skipped when it is unset.

**Cabins** — month grid of cabins × dates, occupancy bars spanning check-in to check-out,
color-coded by status, click-through to the existing booking detail page. Backed by
`/api/calendar/cabins?start=&end=`.

The right index is the existing `BookingSchema.index({ checkInDate: 1, checkOutDate: 1 })`, *not*
the `{ cabin, checkInDate, checkOutDate }` compound. A month view queries all cabins across a
date range, leaving the leading `cabin` field unconstrained, which the compound index cannot
serve efficiently.

**Dining** — per-date capacity fill against `maxPeople`, aggregating `numGuests` per
`(dining, date)`. The read-side logic already exists in
`apps/customer/app/api/dining/[id]/availability/route.ts` (`seatsRemaining`, `fullyBookedDates`)
and generalizes to a range query against `DiningReservationSchema.index({ status: 1, date: 1 })`.
Backed by `/api/calendar/dining?start=&end=`.

**Experiences** — per-date capacity fill (e.g. `7/12`) against `maxParticipants`. Rows where
`maxParticipants` is unset render as uncapped rather than as `n/0`. Backed by
`/api/calendar/experiences?start=&end=`.

All three endpoints clamp the requested range server-side, reusing the convention already
established at `apps/customer/app/api/experiences/[id]/availability/route.ts:83` rather than
inventing a second one.

## Error handling

| Condition | Behavior |
| --- | --- |
| Aggregation failure | Existing `getErrorMessage()` + `createErrorResponse()`, HTTP 500 |
| Permission denied | HTTP 403 via `createErrorResponse()`, matching current `requireApiAuth` |
| Audit write failure | `logger.error` and swallow; mutation succeeds |
| Calendar range too wide | Silent server-side clamp, matching existing convention |
| Invalid status transition | HTTP 400, per-type `VALID_TRANSITIONS` |
| Lock acquisition timeout | `CabinBookingLockTimeoutError` → HTTP 409, as today |

## Testing

Per-app Jest configs survive the move unchanged — the admin's three-project split
(`unit` / `integration` / `jsdom`) and the customer's single project — with a root script running
both.

**Unit:** permission matrix, `requireApiAuth` permission branches, per-type `VALID_TRANSITIONS`,
status → `lifecycle` mapping.

**Integration:** the `$unionWith` pipeline against real MongoDB (union, sort, and pagination
semantics are precisely what mocks get wrong), all three calendar aggregations, audit records
written on each mutation, customer-side lock adoption preventing the overlap race, and the
`PATCH` repricing fix.

**Schema reconciliation (step 2a) needs its own tests.** Every resolved divergence gets a test
against the merged schema: `remainingAmount` clamping, `numNights` computation on the customer
path, `extras.*Fee` floors, `Settings` caps and defaults, and the `Cabin` discount validator
under `runValidators` in Query context.

**Migration safety net, and its limits.** Both apps' existing suites must pass unchanged after
step 1, which is what makes the *move* verifiable. It does **not** verify step 2: the divergent
schema rules are largely uncovered by either suite, so green tests would say nothing about
whether the merge preserved behavior. That is precisely why 2a carries its own tests and 2b
audits real data.

`$unionWith` requires MongoDB 4.4+; `mongodb-memory-server` is on 11.2.0, so the integration
project supports it.

## Build order

1. **Monorepo skeleton.** Both apps move in via `git subtree`, unchanged. Each keeps its own
   `models/`, `lib/`, `tsconfig.json`, and `@/*` alias, so every existing import keeps working.
   *Done when:* both apps build locally, CI passes, both Vercel projects deploy green with root
   directories repointed at `apps/*`.
2. **`packages/database`.** The largest and riskiest step. It contains four distinct pieces of
   work, and is a semantic merge rather than a file move:
   - **2a. Schema reconciliation** — resolve every divergence in the table above, drop and
     recreate the conflicting indexes under explicit names, write tests against the merged
     schema.
   - **2b. Data audit** — read-only script checking existing documents against the merged
     stricter schema; backfill if it finds violations.
   - **2c. Extraction** — models, `connectDB` (admin's configured version), enums from both
     apps' `lib/config.ts`, `logger`, `DB_CONFIG`, `withCabinBookingLock()`,
     `calculateBookingPricing()`.
   - **2d. Customer adoption** — `POST /api/bookings` wraps its check-then-write in the lock and
     uses the pricing calculator; `PATCH /api/bookings/[id]` stops accepting raw fee amounts and
     reprices on change.

   *Done when:* both apps import from `@lodgeflow/database`, no `models/` directory remains in
   either app, the data audit reports clean, and integration tests prove both the customer-side
   race and the `PATCH` pricing hole are closed.
3. **Permission layer.** Clerk roles, permission matrix, `requireApiAuth({ permission })`,
   updated call sites, conditional sidebar.
4. **Audit log.** Model, `recordAudit()` helper, `/audit` page.
5. **Reservations inbox.** Union read endpoint, three write routes, list and detail UI.
6. **Occupancy calendar.** Cabin grid, plus dining and experience capacity fill.

Permissions and audit precede the features so the inbox's three write routes record audit
entries from birth; reversing the order ships untracked mutations that then need retrofitting.
The calendar is last because it is read-only and blocks nothing.

### Plan decomposition

This spec is a roadmap, not a single unit of work. Each numbered step above is independently
shippable, has its own done condition, and warrants its own implementation plan.

**Step 1 is planned and shipped on its own.** It is mechanical, fully verifiable ("both apps
build, CI green, both Vercel projects deploy"), and carries no semantic risk. Getting it merged
before step 2 begins means the schema merge happens against a stable base.

**Step 2 gets its own plan**, and is the one to write carefully. The original framing bundled it
with step 1 as "the migration," which was only defensible while the schemas looked identical.
Now that 2a and 2b involve per-field semantic decisions and a data audit against production
documents, it is the highest-risk work in the spec and deserves undivided planning attention.
Sub-steps 2a and 2b may warrant landing ahead of 2c/2d, since reconciling the schemas is valuable
even if the extraction slips.

**Steps 3–6 are planned individually**, each after the previous has shipped, so later plans can
respond to what the earlier work revealed.

## Decisions worth defending

These were deliberate calls, not defaults:

- **Skeleton-first over big-bang migration.** Extracting every shared package up front would mean
  designing `packages/ui` and `packages/validations` speculatively. Shared UI between an admin
  dashboard and a marketing-flavored booking site is exactly the abstraction that looks obvious
  and turns out wrong.
- **`calculateBookingPricing()` in `packages/database`.** Impure as a boundary; justified because
  it is the other half of the hardening the customer app is missing.
- **Native statuses preserved over a flattened vocabulary.** Losing `no-show` and `checked-in`
  would make the inbox tidier and the data poorer.
- **Audit failures swallowed rather than failing closed.** Availability over completeness, valid
  for this application and not for a compliance setting.
- **The stricter schema wins each divergence, with defaults taken from wherever they exist.**
  The alternative — keeping both variants behind a flag — would preserve exactly the ambiguity
  the extraction exists to remove.
- **Dining is on the calendar.** An earlier draft excluded it on the false premise that dining had
  no capacity model. `Dining.maxPeople` is required and transactionally enforced, so the third
  view costs one aggregation against an index that already exists.
