# Reservations inbox and occupancy calendar

Continue the approved roadmap after the staff role and audit releases. Use one
server-side union for the inbox, separate per-product status endpoints, and read-only
calendar views. Keep existing product statuses and payment rules.

## Inbox

- Normalize cabin, dining, and experience reservations in MongoDB with `$unionWith`.
  Filter, sort, and paginate the union once. Use a deterministic date/time/type/ID
  order. Look up catalog names only for rows on the selected page; batch Clerk names.
- Preserve native status and add lifecycle filters: pending, confirmed, active,
  completed, cancelled, no_show. Dining time and experience time slot remain visible.
- Staff use `/reservations` for the combined inbox. Cabin rows link to the existing
  booking detail page. Dining and experience get detail pages and their own PATCH
  routes with explicit transition maps and expected-current-status checks.
- Status changes use the shared catalog transaction protocol, including cancellation
  and dining no-show capacity release. Terminal statuses cannot reopen. Paid dining
  and experience cancellation remains blocked until their refund flow exists.
- Each successful reservation status change writes its corresponding audit event.

## Calendar

- All date windows are UTC, half-open [start, end), clamped to 180 days server-side.
  The UI presents one month at a time, with previous/next navigation and product tabs.
- Cabin occupancy includes stays crossing either window boundary, excludes cancelled
  bookings, and treats checkout day as free. Click a stay to open its booking.
- Correct the older plan's dining display: capacity is per exact seating time, not
  per whole day. Each day shows occupied seat counts by time against listing capacity.
  Summing all seatings and comparing that total with one seating's capacity is wrong.
- Experiences aggregate participants per UTC date. Missing capacity displays as
  uncapped, never zero. Filters match the shared capacity service's consumed statuses.
- Read routes require bookings:read. New status routes require bookings:manage and
  never accept arbitrary pricing, payment, customer, or catalog changes.

## Verification

Use real MongoDB integration tests for cross-product global ordering/pagination,
filtering, date boundaries, all calendars, native transitions, concurrency, capacity
release, and audit events. Then test preview and production with isolated reservations
and remove fixtures after verification. Existing demo data must remain intact.

## Implementation checkpoint

Steps 5 and 6 are delivered together because they share the reservation read model
and status/capacity semantics. All 1,148 tests pass (997 admin, 135 customer, 16
shared database). Formatting and lint pass.

- [x] Global union pagination and filtered reservation inbox.
- [x] Per-product detail/status routes, stale-state checks, and audit events.
- [x] Cabin, dining, and experience month calendars with server range clamp.
- [x] MongoDB integration coverage for union semantics, date boundaries, per-seating
  capacity, uncapped experiences, native transitions, and concurrent edits.
- [x] Production builds and deployed preview checks.
- [ ] Merge, verify production pages/APIs, and remove all temporary fixtures.

Paid dining/experience cancellations remain blocked pending their future payment and
refund implementation (preserved customer work). This release does not add payment
collection to those products.

## Preview evidence

At `1019ba2`, admin preview `lodgeflowadmin-g8ir9e5fm-asecklabs.vercel.app` is Ready.
An isolated user created dining and experience reservations through the production
customer APIs (both 201). Both appeared in the admin union inbox and capacity calendars.
Staff detail/status APIs returned 200; a stale status edit returned 409; dining no-show
and experience cancellation released their capacity. Matching audit events were verified.
Both temporary reservation records were removed. Follow-up fixes correct the dining
`isAvailable` label and route unsigned admin home visits to sign-in.
