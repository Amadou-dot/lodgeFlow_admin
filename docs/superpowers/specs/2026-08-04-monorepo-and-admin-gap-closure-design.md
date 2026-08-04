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

The Mongoose schemas themselves are currently *in sync* — same fields, same status enums, same
defaults. The large line-level diff between the two `models/` directories is formatting (the
admin imports enums from `lib/config.ts`; the customer inlines them). There is no data
corruption today. The duplication's real cost is the divergence above: fixes land in one app and
silently fail to reach the other.

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
- **Dining seat capacity.** Dining currently validates a serving window but caps nothing. Giving
  it a real capacity model requires schema and enforcement work in the customer booking flow.
  Out of scope; consequently dining is absent from the occupancy calendar.
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

Both apps move in via `git subtree add`, preserving all 483 commits (296 admin + 187 customer).
A portfolio repository that begins with a single squashed "initial commit" discards the evidence
that the work was done.

## Components

### `packages/database`

**Exports:** the 8 Mongoose models, `connectDB`, the status enums the schemas depend on
(`BOOKING_STATUSES`, `REFUND_STATUSES`, `PAYMENT_METHODS`, `CABIN_STATUSES`, `DINING_TYPES`,
`MEAL_TYPES`, `DINING_CATEGORIES`, `BEVERAGE_CATEGORIES`, `DIETARY_OPTIONS`,
`EXPERIENCE_DIFFICULTIES`), plus `withCabinBookingLock()` and `calculateBookingPricing()`.

Extracting the enums is not optional: the admin's schemas import them from `lib/config.ts` while
the customer inlines them, so moving the models drags the enums along. The upshot is that they
stop being two lists that happen to agree.

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
access. The three existing call sites of `hasAuthorizedRole()` (`proxy.ts:35`,
`lib/api-utils.ts:139`, `components/AuthGuard.tsx:50`) are the only places that change.

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
| `partySize` | `numGuests` | `numGuests` | `numParticipants` |
| `resourceName` | cabin name | dining name | experience name |
| `customer` | Clerk user ID | Clerk user ID | Clerk user ID |
| `status` | native | native | native |
| `totalPrice`, `isPaid`, `createdAt` | direct | direct | direct |

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

Customer names are resolved through the existing `getClerkUser()` / `getClerkUsersBatch()`
helpers, which already cache resolved `Customer` objects in Redis or an in-memory map.

### Occupancy calendar

Two views on one page, because the products have different capacity models:

| | Availability model | Capacity limit |
| --- | --- | --- |
| Cabins | Exclusive date-range occupancy per unit | One booking blocks the span |
| Experiences | Participants per date vs `maxParticipants` | Real, enforced |
| Dining | Serving-window validation only | None — out of scope |

**Cabins** — month grid of cabins × dates, occupancy bars spanning check-in to check-out,
color-coded by status, click-through to the existing booking detail page. Backed by
`/api/calendar/cabins?start=&end=`, served by the existing `{ cabin, checkInDate, checkOutDate }`
compound index.

**Experiences** — per-date capacity fill (e.g. `7/12`), aggregating `numParticipants` per
`(experience, date)` against `maxParticipants`. Backed by
`/api/calendar/experiences?start=&end=`.

Both endpoints clamp the requested range server-side, reusing the convention already established
at `apps/customer/app/api/experiences/[id]/availability/route.ts:83` rather than inventing a
second one.

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
semantics are precisely what mocks get wrong), both calendar aggregations, audit records written
on each mutation, customer-side lock adoption preventing the overlap race.

**Migration safety net:** both apps' existing suites must pass unchanged after step 1. This is
what makes the move verifiable rather than hopeful.

## Build order

1. **Monorepo skeleton.** Both apps move in via `git subtree`, unchanged. Each keeps its own
   `models/`, `lib/`, `tsconfig.json`, and `@/*` alias, so every existing import keeps working.
   *Done when:* both apps build locally, CI passes, both Vercel projects deploy green with root
   directories repointed at `apps/*`.
2. **`packages/database`.** Extract models, `connectDB`, enums, `withCabinBookingLock()`, and
   `calculateBookingPricing()`; customer app adopts the lock and the pricing calculator.
   *Done when:* both apps import from `@lodgeflow/database`, no `models/` directory remains in
   either app, and an integration test proves the customer-side race is closed.
3. **Permission layer.** Clerk roles, permission matrix, `requireApiAuth({ permission })`,
   updated call sites, conditional sidebar.
4. **Audit log.** Model, `recordAudit()` helper, `/audit` page.
5. **Reservations inbox.** Union read endpoint, three write routes, list and detail UI.
6. **Occupancy calendar.** Cabin grid and experience capacity fill.

Permissions and audit precede the features so the inbox's three write routes record audit
entries from birth; reversing the order ships untracked mutations that then need retrofitting.
The calendar is last because it is read-only and blocks nothing.

### Plan decomposition

This spec is a roadmap, not a single unit of work. Each numbered step above is independently
shippable, has its own done condition, and warrants its own implementation plan. Steps 1 and 2
are tightly coupled — the skeleton is not useful on its own and the extraction cannot precede
it — so they are planned together as the migration. Steps 3–6 are planned individually, each
after the previous has shipped, so that later plans can respond to what the earlier work
actually revealed.

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
