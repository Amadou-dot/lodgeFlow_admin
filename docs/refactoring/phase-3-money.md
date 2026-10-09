# Phase 3 money implementation and boundary inventory

**Goal:** Complete [Phase 3](plan.md#phase-3--explicit-money-units-and-protected-accounting)
without changing persisted units, transport shapes, valid monetary values, or
accounting and concurrency guarantees.

**Design:** A browser-safe `@lodgeflow/database/money` module owns validated
`MajorCurrencyAmount` and `Cents` values, conversion, rounding and formatting.
MongoDB and JSON retain numeric fields. Each boundary validates those numbers
before passing them to unit-specific operations. Exact receipt validation is
separate from explicitly preserving legacy price precision and rounding.

## Constraints and decisions

- Cabin prices, deposits, receipts, refunds and JSON remain major units.
- Dining/experience totals remain major units; receipts, checkout and refunds
  remain integer cents. Stripe amounts are integer cents.
- Cabin price arithmetic currently retains fractional precision. Do not add
  rounding to pricing or reject legacy sub-cent catalog values as a type cleanup.
- Deposits use `Math.round(totalPrice * (percentage / 100))`, then clamp to the
  total. Cabin receipt summaries use epsilon-assisted nearest-cent rounding.
  Reservation totals and Stripe use ordinary nearest-cent rounding.
- Constructors reject non-finite values, unsafe cent magnitudes and disallowed
  signs. Exact-cent constructors reject sub-cent input instead of rounding it.
  These invalid-value checks are intentional hardening, covered separately.
- Keep authorization, quote token/amount/currency checks, receipt idempotency,
  optimistic retries, legacy reconciliation guards and lock/transaction scopes.
- Node 22, pnpm 11.17.0; no dependency or storage migration, seeding or live
  provider operations. Work is on `refactor/phase3-money` from `2aa8756`.

## Implementation checklist

- [x] Inventory price, deposit, receipt, refund, display and provider boundaries.
- [x] Characterize existing rounding before modifying domain operations.
- [x] Implement and test shared money constructors, conversions and formatting.
- [x] Migrate cabin pricing, receipts and checkout settlement.
- [x] Migrate dining/experience accounting, checkout and refund boundaries.
- [x] Migrate customer provider, cancellation and webhook boundaries.
- [x] Migrate app input/display adapters while preserving strings and units.
- [x] Run affected suites, strict types, full checks, isolated HTTP and builds.
- [x] Independent review; update plan, inventory and local handoff with evidence.

## Boundary inventory

The inventory was checked against source before the monetary migrations. Plain
model/JSON numbers remain transport and persistence adapters; they do not assert
that unvalidated data is a branded amount.

| Boundary                       | Files and preserved contract                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catalog/settings writes        | Admin `lib/validations/{cabin,dining,experience,settings,bulk-cabin}.ts` validates finite, bounded major units. Accepted sub-cent prices, optional fields and defaults remain. `confirmation-email.ts` validates its read-only monetary projection.                                                                                                                                     |
| Cabin pricing/deposits         | Shared `booking-pricing.ts`, `customer-bookings.ts`, `demo-bookings.ts`; admin booking routes and `hooks/useBookingForm.ts`. Night/guest multipliers retain arithmetic order; selected fees come from server catalog/settings. Deposits round to whole units before clamping.                                                                                                           |
| Cabin receipts/settlement      | Shared `booking-payments.ts`, `checkout-settlement.ts`, `models/Booking.ts`; admin `lib/validations/booking.ts` and booking PATCH. Storage/history remain major units. New receipts validate exact positive cents; summaries retain gross receipts and epsilon rounding.                                                                                                                |
| Reservation pricing/capacity   | Shared `reservation-capacity.ts`; catalog price times guests/participants rounds once with epsilon. Capacity transactions still write `reservationVersion` and propagate their session. Paid/receipt-bearing rows cannot reprice.                                                                                                                                                       |
| Reservation receipts/refunds   | Shared `reservation-payment-state.ts`, `reservation-payments.ts`, `reservation-stripe.ts`; admin `lib/{reservation-payment-route,reservation-status-route}.ts`, `lib/validations/reservation-payment.ts`. Receipt/checkout/refund cents are positive safe integers; total-to-cents uses ordinary rounding. Gross payment balance and tender-specific refundable balances stay separate. |
| Customer checkout              | `app/api/payments/create-checkout/route.ts`, `lib/stripe.ts`, `lib/reservation-checkout-route.ts`. Cabin quotes remain major units and freeze amount/currency/token; Stripe receives cents. Reservation quotes already store cents. Provider failure retains the reserved quote.                                                                                                        |
| Customer webhook               | `app/api/payments/webhook/route.ts`: signed cabin amounts convert once to major units; reservation amounts stay cents. Failed accounting does not mark the event processed. Cumulative cabin refunds retain monotonicity and version retries.                                                                                                                                           |
| Customer cancellation          | `lib/cancellation.ts`, `app/api/bookings/[id]/route.ts`, refund-estimate route. Received money, less prior refunds, determines entitlement. Percentage/receipt allocation uses ordinary cent rounding; persisted plans and stable keys preserve retry behavior.                                                                                                                         |
| Staff amount entry             | `components/{RecordPaymentModal,ReservationPayments}.tsx`: text validates before conversion/request; cabin submits major units, reservation submits cents. Existing request IDs/pending refund tokens remain stable on retry.                                                                                                                                                           |
| Currency/fixed formatting      | Admin `utils/utilityFunctions.ts`, booking hook, `components/BookingForm/PaymentInformation.tsx`, payment components; customer `components/{CabinPricingCalculator,EmailTemplates}.tsx`, `lib/email.ts`. Unit-aware helpers preserve locale, currency fallback, grouping and fixed decimal strings.                                                                                     |
| Existing formatter consumers   | Admin booking details, PDF, email templates and reservation list consume the major-unit formatter. Customer confirmation/payment email serializers pass numeric major-unit DTOs to validated formatting. No DTO unit or envelope changes.                                                                                                                                               |
| Numeric display/read consumers | Both apps' cabin/dining/experience cards, details, booking/reservation forms, confirmation/history pages, statistics, CSV exports, SEO/JSON-LD and price filters use major-unit numbers only. They perform no cents crossing. Raw dollar interpolation, chart thousand abbreviations and aggregate report rounding are unchanged.                                                       |

The last row includes admin `Cabin{Card,TableView,Modal,Stats}`, equivalent dining
and experience components, `BookingsTable/*`, `BookingDetails/*`, reporting/guest
components and analytics CSV; customer `Cabin{Card,Details,Filters}`, `PricingGrid`,
`CabinsListClient`, `BookingForm`, dining/experience forms and pages,
`app/bookings/page.tsx`, confirmation pages, `lib/seo/jsonLd.ts` and
`lib/validations/query-params.ts`. Existing whole-number editor parsing in cabin
and Settings forms remains an independent UI behavior issue. Admin nightly-price
subtotal labels remain separate display-semantic debt. Neither changes units.

No monetary `* 100`, `/ 100`, `Intl.NumberFormat`, or `.toFixed(2)` remains outside
the shared money module in migrated runtime flows. Remaining `/ 100` expressions
apply percentages; other matches represent occupancy, chart percentages or time.

## Review focus

1. Sub-cent catalog prices must keep their existing arithmetic and rounding;
   sub-cent receipt requests must be rejected without a write or provider call.
2. Decimal values such as 0.29 must pass exact-cent validation despite binary
   floating point; 1.005 must remain distinct across legacy rounding rules.
3. Aggregate overflow and provider NaN/infinity/fractional cents must fail before
   an external mutation or receipt write.
4. Duplicate and concurrent payments/refunds must retain idempotency, version
   retries, quote validation and refund limits.
5. Cents displayed as currency must be converted once; preview, email and PDF
   formatting must retain existing locale, grouping and fraction digits.

## Validation evidence

- Baseline `pnpm ci:check`: formatting, lint and 2,224 tests passed before edits.
- Final `pnpm ci:check` (refreshed 2026-10-09): formatting, read-only lint and 2,387 tests passed
  (admin 1,520; customer 771; database 93; email 3).
- Both app `tsc --noEmit` checks and the database build/type check passed.
  A temporary strict config compiled all eight touched admin test files, including
  component mocks, without weakening the repository compiler configuration.
- `pnpm test:http` passed with disposable app copies and MongoDB, real local Clerk
  signatures, and controlled Stripe/Resend transport. Added invalid monetary
  request checks assert no booking/provider effects. The full HTTP gate was
  refreshed on the final implementation before the PR review handoff.
- `pnpm install --frozen-lockfile` and `pnpm build` passed in a clean
  disposable copy without app secrets, using CI's throwaway public Clerk key.
  The final source digest matches the built snapshot. Existing no-database
  prerender fallbacks and config warnings remain; they are not live-service tests.
- Independent whole-change review has no remaining findings. Review regressions
  were reproduced before fixes; focused checks and the full gate pass afterward.
- Evidence logs use `/tmp/lodgeflow-phase3-*`; the strict test config is
  `/tmp/lodgeflow-phase3-admin-tests-tsconfig.json`. These are disposable evidence,
  while tests and this inventory remain in the repository.

Browser E2E, hosted Clerk login and live Stripe/email delivery were not exercised.
The implementation is prepared for PR review; remote CI and preview status are
recorded on the PR. Merge and production verification remain pending. Phase 4 and
the overall refactoring milestone remain open.

## Intentional corrections and error contracts

- Exact receipt/refund request validation rejects sub-cent input instead of
  rounding it. Admin request failures return the existing validation envelope
  with 400 before database effects; direct cabin domain failures retain
  `BookingPaymentError` and reservation failures retain `ReservationRuleError`.
- Non-finite, unsafe, incorrectly signed and fractional-cent provider/receipt
  amounts fail before financial writes/provider requests. Invalid persisted
  reservation accounting returns a typed error; no data is automatically repaired.
  Lossless cents-to-major conversion rejects amounts that numeric major storage
  cannot represent. Exact major-to-cents conversion parses decimal digits to avoid
  introducing a cent near the safe integer limit.
- Completed reservation checkout retries compare the reserved quote and original
  receipt details. Matching retries remain no-ops; mismatched deliveries cannot
  be acknowledged as the original payment.
- Cabin Half presets round the integer-cent balance once and use the same value
  for the label, input and request: 10.01 becomes 5.01; 0.29 becomes 0.15. Existing
  fractional balance display is preserved, while new submitted receipts must be
  exact, positive and no greater than the outstanding balance.
- Provider failures retain the existing safe checkout/webhook errors and refund
  failure result. Cancellation retains durable pending accounting and its saved
  refund plan. Successful financial writes are not undone by email failures.

Characterization covers ordinary versus epsilon half-cent rounding, rounding
after reservation quantity multiplication, fractional catalog values, deposit
rounding before clamping (including fractional totals and safe-range limits),
gross receipts versus deposit obligations, mixed tender refunds, repeated and
concurrent settlement and retry tokens. Review regressions cover exact conversion
near the integer limit and the historical deposit clamp order.

The staff booking preview accepts signed temporary draft calculations so typing
an invalid guest count does not throw from an effect or render. Form and request
validation still reject the draft, and correcting the count restores pricing.
