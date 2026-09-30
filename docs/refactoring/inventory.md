# Refactoring debt inventory

Baseline: `07670932f0b8349fa826802a6ee27f20b3501908` (2026-09-15).
This inventory assigns work; it does not authorize skipping the Phase 0B/0C gates.
All confirmed items below remain open unless their status explicitly says otherwise.
The owning phase is an execution dependency, not an assigned person.

## Scope and evidence

A TypeScript syntax-tree scan covered 522 tracked JS/TS files across both apps and
`packages/database`, including scripts and tests, excluding generated output,
declarations and dependencies. It identified 267 syntax candidates in 122 files:

| Candidate                                                 | Count | Default owning phase                       |
| --------------------------------------------------------- | ----- | ------------------------------------------ |
| Explicit `any`                                            | 164   | 1; scripts in 6                            |
| Adjacent same-type primitive positional parameters        | 38    | 2; scripts in 6                            |
| `as unknown as` double casts                              | 28    | 1                                          |
| Broad string/date or string/number unions                 | 21    | 1; inspect whether units actually conflict |
| Mongoose `Document` interface inheritance                 | 9     | 1; persistence use itself can be valid     |
| Optional-plus-null fields                                 | 5     | 1                                          |
| Typed data indexed after a `Record<string, unknown>` cast | 2     | 2                                          |

[The full candidate list](inventory-candidates.json) records every matched
path/line/symbol, rule, owning phase, status and next action at the baseline commit.
A candidate is not automatically a bug: generic filters may legitimately accept
strings/numbers, document interfaces may remain within persistence, and framework
callbacks can have required signatures. Inferred boolean switches and semantic
money/response/state problems require manual review beyond this syntactic scan.
No message-equality or explicitly typed multi-boolean train was found by these
specific AST checks; this is not proof no stringly error handling or boolean switch
exists. Refresh against the current tree before a slice, and record dispositions
rather than treating counts as the completion gate.

## Confirmed work, ownership and bounded next steps

| ID  | Source / symbol                                                                                                  | Rule or observed mismatch                                                                    | Phase    | Next action and validation                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | `apps/customer/types/index.ts`: `Cabin`, `Booking`, `PopulatedBooking`                                           | Transport/UI aliases reuse document interfaces; booking dates mix strings and Dates.         | 1        | Partially complete: booking reads, mutations, cancellation and cabin emails use explicit inputs; `PopulatedBooking` is removed. Cabin catalog migration is recorded in slice 10; other resource aliases remain. |
| T02 | `apps/customer/app/api/bookings/[id]/route.ts`: `GET`                                                            | `ApiResponse<any>` returns a populated document without an explicit DTO contract.            | 1        | Complete in PR #152: explicit detail DTO/serializer with owner/missing/foreign, ID/date and missing-cabin coverage.                                                                 |
| T03 | `apps/customer/app/api/payments/create-checkout/route.ts`: cabin name extraction                                 | Double cast conceals the populated-reference shape.                                          | 1        | Implemented in Phase 1 slice 6 below: nullable cabin population, missing-reference denial and characterized quote/session behavior.                                                                           |
| T04 | `apps/customer/app/api/payments/webhook/route.ts`: confirmation payload                                          | Double cast converts a populated booking to the UI/email type.                               | 1        | Implemented in Phase 1 slice 4 below: explicit payment email inputs, nullable cabin population and preserved settlement/delivery boundaries.                                        |
| T05 | `apps/admin/types/api.ts` and `apps/admin/types/index.ts`                                                        | Query/aggregation/transport types coexist; serialization contracts need per-flow separation. | 1        | Begin with booking output and its actual callers; test IDs, dates and null references. Do not rewrite every reporting query in one PR.                                              |
| T06 | `packages/database/src/models/*`: nine `Document`-extending interfaces                                           | Persistence interfaces are re-exported across app boundaries.                                | 1        | Keep persistence behavior tested; add lean/populate/DTO types as each consumer migrates. Inheritance alone is not slated for deletion.                                              |
| T07 | `apps/admin/__tests__/integration/api/bookings.test.ts`: fixture overrides; remaining candidate fixtures         | Fixture `any` hides missing/invalid fields.                                                  | 1        | Replace with checked input/DTO builders or real documents according to each test's responsibility; preserve behavioral assertions.                                                  |
| T08 | `apps/admin/components/BookingForm/PaymentInformation.tsx`, `PriceBreakdown.tsx`; cabin/dining/experience modals | Props permit both omitted and null absence.                                                  | 1        | Choose one internal absence representation per component, adapting callers without changing PATCH semantics.                                                                        |
| T09 | `apps/admin/lib/clerk-users.ts`: `reviveCustomerDates`                                                           | Cache boundary uses assertions to reconstruct dates.                                         | 1        | Implemented in Phase 1 slice 8: validated unknown cache payloads and dates, per-entry misses for malformed data, preserved negative cache and transient failures.                                                              |
| F01 | `packages/database/src/booking-payments.ts`: `paymentSummary`                                                    | Adjacent major-unit numeric positionals can be reversed.                                     | 2        | Implemented in Phase 2 slice 2: named inputs at all six call sites; characterization and shared/app accounting gates pass.                                                                                          |
| F02 | `packages/database/src/reservation-capacity.ts`: create/update reservation helpers                               | Same-type ID/customer positionals and inferred `cancel = false` switch.                      | 2        | Named inputs and tagged update/cancel operation, preserving owner filters, transactions and terminal-state checks. No broad #136 test expansion.                                    |
| F03 | `apps/admin/lib/staff-access.ts`: `isOrganizationMember`, `resolveStaffRole`                                     | Organization/user string inputs can be confused.                                             | 2        | Implemented in Phase 2 slice 4: named identity inputs, canonical absent organization and passing membership/assignment/permission gates.                                                                                |
| F04 | `apps/admin/lib/api-utils.ts`: pagination helpers; booking-table status callbacks                                | Same-type positional values recur across utilities and component contracts.                  | 2        | Implemented in Phase 2 slices 5 and 11: unused pagination builders removed; named booking-table status inputs, string JSON IDs and checked action-menu data replace ambiguous callback signatures.                                                         |
| F05 | `packages/database/src/customer-bookings.ts`: `updateCustomerBooking` | Booking and customer string IDs can be confused. | 2 | Implemented in Phase 2 slice 3: named identity/update inputs, exact denial/no-write and paid-update accounting characterization. |
| F06 | `packages/database/src/models/Booking.ts`: `findOverlapping`, unused `overlaps` | Date positionals and string/ObjectId alternatives obscure the overlap contract. | 2 | Implemented in Phase 2 slice 8: named string IDs and Date inputs at all callers; preserve strict boundaries, status selection, self-exclusion and booking locks. |
| V01 | Admin `app/api/bookings/route.ts` and `app/api/bookings/[id]/route.ts`: `cancellationFields`                     | Cast-based field indexing erases typed update keys.                                          | 2        | Typed field construction with invalid cross-field payload tests; preserve paid/refund and state-dependent checks.                                                                   |
| V02 | `apps/admin/lib/validations/booking.ts` and corresponding booking routes                                         | Payload rules and database-dependent rules span layers.                                      | 2        | Classify each rule first; move payload-only cross-field checks into the schema, keeping ownership/capacity/payment checks in their protected operation.                             |
| V03 | Admin `lib/api-utils.ts` vs customer `types/index.ts`, resource/email/webhook routes                             | Response envelopes and error contracts differ.                                               | 2        | Partially implemented in Phase 2 slices 1, 6 and 9: validated requests for customer confirmations, cabin checkout and public availability search. Continue per flow; preserve webhook acknowledgements.                                                                |
| M01 | `packages/database/src/booking-pricing.ts`: price/deposit calculation                                            | Prices are raw major-unit numbers; deposit rounding has business meaning.                    | 3        | Characterize current arithmetic/rounding before introducing validated unit types; no silent storage or rounding migration.                                                          |
| M02 | `booking-payments.ts` vs `reservation-payment-state.ts`/`reservation-payments.ts`                                | Cabin receipt `amount` is major units while reservation `amountCents` is cents.              | 3        | Inventory every reader/writer, introduce explicit constructors/conversions and retain duplicate/overpay/refund tests.                                                               |
| M03 | Customer checkout/webhook routes and admin `utils/utilityFunctions.ts`: Stripe conversion/formatting             | Raw `* 100`, `/ 100` and display formatting encode units implicitly.                         | 3        | Centralize boundary conversions after M01/M02; test precision/sign/range and display values.                                                                                        |
| S01 | `apps/admin/hooks/useBookingForm.ts` and booking UI hooks/components                                             | Local derived price/form state and SWR/mutation invalidation require coordinated review.     | 4        | Identify redundant state and exclusive workflow states in one form; test error/retry/cache refresh. Independent extras booleans remain valid options.                               |
| E01 | Both apps' existing send routes and customer email helpers                                                       | Ten sender sites migrated to validated `@lodgeflow/email` configuration.                     | 5 / #132 | Complete in PR #155 / merge `9a9c296`: tests, both production deployments, Resend delivery and user inbox confirmation verified. No #139 features.                                  |
| O01 | Scripts, test helpers and unmatched remaining candidates                                                         | Admin compiler excludes scripts/tests; passing Jest does not prove their type safety.        | 6        | Resolve candidate findings by symbol and add appropriate targeted checks after the code passes; do not blanket-disable diagnostics or rewrite every script now.                     |
| D01 | Both `CLAUDE.md` files                                                                                           | Stale model paths, deposit accounting, fixture cast advice, domains and CI description.      | 0A       | Corrected in this Phase 0 tree against source; final format/read-through verification required before review completion.                                                            |

## Phase 1 slice 1: customer cabin booking reads

Implementation: `types/booking-read.ts`, `lib/serializers/booking-read.ts`,
`GET /api/bookings/history`, `GET /api/bookings/[id]`, the two read hooks and
cabin booking selection/rendering in `apps/customer/app/bookings/page.tsx`.
All unqualified implementation paths above are within `apps/customer`.

- **T02 implemented:** detail response uses an explicit JSON DTO and serializer.
  Its existing hydrated virtuals and full populated cabin remain intact.
- **T01 partially implemented:** history/detail read hooks and their booking-page
  consumers use plain JSON types. History retains its lean selected cabin shape;
  missing populated cabins remain null. Subsequent slices migrate mutations and
  cabin emails and remove `PopulatedBooking`. Remaining `Booking`/`Cabin` aliases
  in `types/index.ts` need per-flow review.
- History query `any` and cabin booking-page read casts are removed. Other resource
  tabs in the same page remain separate slices; no #136/#139 work is included.
- The edit guest limit now reads `cabin.capacity`; `maxCapacity` was not a schema
  field, so the old UI always fell back to ten guests and omitted the capacity hint.
  The server's existing guest validation and request allowlist remain authoritative.
- Verified legacy boundary exception: sparse lean rows omit newer receipt/checkout
  fields and may explicitly store nulls. DTO optional/null fields preserve that
  wire distinction; serializers do not add defaults, fabricate receipts or change
  money units. Keep this exception at the existing transport boundary; new domain
  operations should use one absence representation.
- Subsequent same-flow work: create/PATCH boundaries are addressed in slice 2
  below. Cancellation/confirmation email payloads, checkout population and
  refund-estimate date DTOs remain open.

Characterization: `scripts/http-smoke/run.mjs` compares full response JSON against
real hydrated and lean Mongoose results, including raw legacy rows, null populated
cabins, status filters, ownership and database failures. These assertions passed
against original runtime at `26d09e3` before final review of the refactor, and pass
against the new serializers. Focused serializer, hook and UI tests accompany the
slice. Final command and commit evidence is recorded on tracking issue #150.
The candidate JSON remains the original baseline snapshot; this section records
slice dispositions without claiming every match in an affected file is resolved.

## Phase 1 slice 2: customer booking creation and updates

- **T01 further migrated:** `useCreateBooking` and `useUpdateBooking` return plain
  `BookingDetail` JSON. POST/PATCH reuse the characterized detail serializer.
  Shared `customer-bookings.ts` annotates population at the actual queries.
  `addBookingPayment` now accepts only the booking fields it reads/writes so
  populated bookings remain valid callers; payment logic is unchanged. Database
  operations, pricing, locking and persisted values are unchanged.
- `CreateBookingRequest` derives payload fields from the existing Zod schema with
  explicit string dates. `BookingForm` preserves the previous UTC serialization
  while constructing JSON inputs directly. The unused `CreateBookingData` type
  is removed. PATCH callers use `UpdateBookingDetailsInput`, not `Partial<Booking>`.
- **Related bug fixed:** the booking editor no longer presents date/observation
  controls whose changes the server silently discarded. It clearly edits guest
  count and submits only `numGuests`. The API's existing allowlist remains intact;
  special requests/extras remain supported at the API without adding UI features.
- Mutation fixtures use checked response/input shapes. Hook tests preserve create
  and update cache invalidations, including no invalidation on failure. The editor
  regression was verified against original code before the fix.
- HTTP tests characterize complete create/PATCH JSON envelopes against real
  populated documents, prove ignored fields remain ignored, and cover auth,
  invalid input/capacity, missing IDs and database write failure without unintended
  writes/provider calls. The expanded gate passes against original `bddff06`
  runtime and the refactored routes.

Subsequent slices completed cancellation/refund-estimate DTOs and cabin email
inputs. Checkout population and unrelated resource boundaries remain. This slice does not alter provider behavior,
receipt accounting or add #136/#139 scope. Final command and named-commit CI
results are maintained on tracker #150; Phase 1 is not complete.

## Phase 1 slice 3: cancellation and refund estimates

- Cancellation responses use `BookingDetail | null` with an explicit refund DTO;
  refund-estimate deadline DTOs contain ISO strings/null, while domain calculations
  retain Dates. Existing import paths reexport the transport types.
- DELETE population is typed at the query. Its cancellation email dependency now
  accepts only customer identity, stay Dates, total price and cabin name; the
  fake `PopulatedBooking` cast is removed without changing sender or send behavior.
- `calculateRefund` takes only its booking/settings field dependencies. Arithmetic
  fixtures are plain checked inputs instead of double-cast Mongoose documents.
- **Related fixes:** foreign refund estimates return the same 404 as missing
  bookings; active checkout reports `canCancel: false` with the existing DELETE
  guard reason. Policy estimates, amounts, terminal-status responses and timezone
  calculations remain unchanged. Both bugs reproduce against original `ea57bd1`.
- Route/hook tests and HTTP assertions cover deadline JSON, eligibility, ownership,
  full cancellation response booking JSON, received-money refund limits, retries
  and provider failures. Payment and generic cabin email inputs are addressed in
  slices 4–5; checkout population and other resource boundaries remain future slices.

## Phase 1 slice 4: customer cabin payment email inputs

- Manual `app/api/send/payment-confirm/route.ts` and the payment webhook use typed
  nullable cabin population and `lib/serializers/payment-email.ts`. The email
  helper/template accept `types/payment-email.ts` inputs containing string IDs,
  ISO timestamps, cabin name and major-unit amounts, without document methods or
  whole booking/cabin payloads. Both unsafe populated-booking casts are removed.
- Preserved latest-receipt selection, signed webhook amounts/deposit flags,
  first-email recipient selection, Guest fallback, subjects, senders, date display,
  authorization and response envelopes. Duplicate events/unchanged settlements
  still do not resend; failed delivery cannot mark a confirmation sent or undo
  durable receipts. No payment persistence, quote, lock or settlement code changes.
- **Related fixes:** a missing cabin returns `Cabin not found`/404 from the manual
  route, while the webhook acknowledges its durable settlement without dispatching
  or marking delivery. Deposit emails display the receipt-derived `remainingAmount`
  instead of subtracting only the latest receipt from the total. Both regressions
  failed against the pre-refactor implementation.
- Coverage includes actual template content, absent/foreign bookings, missing
  recipients/receipts, Clerk/provider failures, serialized field allowlists,
  webhook signature/retry/delivery markers, and an isolated HTTP multi-receipt and
  missing-cabin settlement scenario with actual SDK rendering.
- Validation on 2026-09-23: 43 focused checks pass; `pnpm ci:check` passes
  formatting, lint and 1,233 tests (admin 1,014; customer 191; database 25; email 3).
  Both app TypeScript checks and `pnpm test:http` pass. A clean temporary copy
  passes frozen installation and `pnpm build` for both apps/shared packages using
  CI's public Clerk key without app/provider credentials. Installation retains the
  baseline optional Sharp build warning; builds pass. Hosted login and live
  delivery were not rerun for this slice.
- Subsequent slice 5 migrates generic cabin confirmation and removes
  `PopulatedBooking`. Checkout cabin population and other resource flows remain
  separate slices. Phase 2 owns manual email request
  validation and legacy raw provider/error response contracts (V03). Phase 5 still
  needs its remaining origin/contract review; closing #132 did not finish it.

## Phase 1 slice 5: generic cabin confirmation email inputs

- `app/api/send/confirm/route.ts` uses typed nullable cabin population and the
  explicit booking/cabin serializers in `lib/serializers/booking-email.ts`.
  `BookingConfirmationEmail` consumes `types/booking-email.ts` with string IDs,
  ISO timestamps and only rendered stay, cabin, pricing and extras fields.
  Nested extras and amenities are copied into plain inputs without documents.
- Removed the last `PopulatedBooking` consumer and its obsolete declaration in
  `types/index.ts`. The existing `useSendConfirmationEmail` caller retains its
  booking-ID request and message-ID/error response handling; no UI or trigger
  changes were needed.
- Preserved notification sender selection, first-email recipient, Guest fallback,
  subject, date display, plural guests, cabin details, all five extras, pricing,
  required deposit versus received-money balance, auth/ownership and retry behavior.
  Request validation and safe errors are addressed in Phase 2 slice 1 below.
- **Related fixes:** a deleted cabin returns `Cabin not found`/404 before rendering
  or dispatching a confirmation. The regression fails with 500 before the fix;
  ownership denial still runs first and returns the existing 403. Neither success,
  provider failure/retry nor missing cabin changes booking state.
- The HTTP gate also reproduced a mislabeled subtotal: a three-night $300 stay
  showed `Cabin (3 nights): $100`because persisted`cabinPrice`is nightly.
Email input now exposes`cabinSubtotal`from saved`totalPrice - extrasPrice`;
  no storage values, quote calculation, rounding or current catalog prices change.
  A focused regression covers multiple nights and a changed catalog price.
- Twelve characterization cases pass before runtime edits. Route rendering and
  serializer tests cover all rendered fields, branches, sender overrides, failures,
  explicit allowlists, real hydrated defaults and detached nested data. The HTTP
  gate checks actual SDK-rendered content and missing-cabin no-send/no-write effects.
- Validation on 2026-09-23: 60 focused checks pass; `pnpm ci:check` passes
  formatting, lint and 1,250 tests (admin 1,014; customer 208; database 25; email 3).
  Both app TypeScript checks, the expanded `pnpm test:http`, frozen installation
  and clean app/shared production builds pass. Builds use CI's public Clerk key
  without app/provider credentials; the baseline optional Sharp install warning
  remains non-blocking. Hosted login and live delivery were not exercised.
- Checkout population is addressed in slice 6 below. Experience confirmation
  and resource interfaces retain model aliases; do not expand into #136/#139.

## Phase 1 slice 6: customer checkout cabin population

- `app/api/payments/create-checkout/route.ts` uses the same explicit nullable
  cabin population type for the owner-scoped lookup and quote reservation result.
  Only the cabin's name crosses into the Stripe payload; the double cast is removed.
- **Related fix:** an owned payable booking with a missing cabin returns
  `{ success: false, error: 'Cabin not found' }`/404 before quote writes or Stripe
  calls. This also denies reopening an existing session for a deleted cabin,
  leaving its quote/session fields intact. Missing/foreign bookings still return
  the identical `Booking not found`/404; paid/cancelled bookings retain their 400.
- If the cabin disappears between lookup and reservation population, the handler
  returns the same cabin 404 without creating a Stripe session. The already-written
  quote is retained, just as after a provider failure; this branch is not a
  no-write guarantee or an atomic constraint against later catalog deletion.
- Preserved deposit/balance selection, currency/cents conversion, full Stripe
  metadata/return URLs, quote version contention, open/expired/completing sessions,
  provider retry keys, and the success/error envelopes. `hooks/usePayment.ts` and
  `components/PaymentButton.tsx` keep their existing response/error handling and
  cache invalidation; no caller changes were required.
- Before runtime edits, 20 characterization cases passed and all four missing-cabin
  regressions failed. The real HTTP gate also reproduced the null-cabin 500.
  After the fix, all 24 focused cases, both app TypeScript checks and the expanded
  HTTP gate pass. HTTP asserts owner/foreign missing-cabin denial without writes or
  provider calls for new, retained and session-backed quotes, the complete valid
  Stripe payload, and an unchanged booking when reusing an open session.
- Local validation on 2026-09-30: `pnpm ci:check` passes formatting, read-only
  lint and 1,274 tests (admin 1,014; customer 232; database 25; email 3).
  Both app `tsc --noEmit` checks and `pnpm test:http` pass. A clean temporary copy
  passes `pnpm install --frozen-lockfile` and `pnpm build` with CI's public Clerk
  key and no app/provider credentials. Changed runtime/test files match those
  build inputs. The existing optional Sharp install warning remains non-blocking;
  database-dependent prerender fallbacks log the deliberately absent MongoDB URI.
  Hosted login and live provider operations were not run for this slice.
- Delivered in [PR #158](https://github.com/Amadou-dot/lodgeFlow_admin/pull/158),
  reviewed `953f0c9`, merged as `80a2cc9` on 2026-09-30. All five
  [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36762984859)
  and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36763670779)
  pass. Both previews and production deployments are Ready at their respective
  exact SHAs. Configured roots are `apps/customer` and `apps/admin`; deployment
  build logs confirm the matching app routes. Production aliases are `lodgeflow.app`
  / `www.lodgeflow.app` and `admin.lodgeflow.app`.
- Experience confirmation is addressed in slice 7 below. Remaining boundaries:
  customer `types/index.ts` catalog/resource aliases and admin booking DTOs (T05).
  Checkout request validation/error normalization remains Phase 2/V03; money
  constructors/conversions remain Phase 3/M03. Phase 1 and the milestone remain open.

## Phase 1 slice 7: experience confirmation email inputs

- `types/experience-email.ts` and `lib/serializers/experience-email.ts` define
  explicit rendered fields, string IDs and ISO dates. The manual confirmation
  route and post-settlement helper use typed, nullable populated lean records;
  `ExperienceBookingConfirmationEmail` no longer accepts the catalog model alias.
  Arrays are copied, and omitted legacy arrays retain empty-section behavior.
- **Related fix:** the manual route returns `Experience not found`/404 for an
  owned, payable booking whose experience was deleted, before provider calls or
  writes. Existing 403 ownership and 409 unpaid denials still take precedence.
  Twenty-two characterization cases passed before runtime changes; the missing
  reference regression failed with the previous 500 and passes after the fix.
- Preserved rendered content and saved totals, paid/free sender selection,
  manual first-email and settlement primary-email selection, Guest fallback,
  provider response envelopes, triggers and idempotency keys. No UI caller or
  request contract changed. The shared helper retains dining rendering and guards.
- Experience settlement still returns a retryable 500 when confirmation fails,
  including a missing experience. One durable receipt remains; delivery and
  processed-event markers are absent until a successful retry. This is distinct
  from the cabin webhook's existing acknowledgement behavior. Duplicate events
  after success neither resend nor add a receipt.
- HTTP coverage exercises actual SDK rendering, primary versus first recipients,
  paid/free confirmations, sparse catalog rows, auth/ownership/unpaid denial,
  failed delivery/retry, missing-reference recovery, receipt idempotency and the
  dining branch of the shared helper against disposable MongoDB.
- Local validation on 2026-09-30: 51 focused checks pass; `pnpm ci:check` passes
  formatting, read-only lint and 1,302 tests (admin 1,014; customer 260; database 25;
  email 3). Both app `tsc --noEmit` checks, `pnpm test:http`, a clean frozen install
  and all app/shared builds pass. Build inputs use CI's public Clerk key without
  app/provider credentials. Existing optional Sharp install warnings and expected
  missing-MongoDB prerender fallbacks remain non-blocking. Hosted login and live
  provider delivery were not exercised.
- Delivered in [PR #159](https://github.com/Amadou-dot/lodgeFlow_admin/pull/159),
  reviewed `50903a8`, merged as `0ec23d4`. All five
  [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36766407060)
  and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36766670826)
  pass. Both previews and production deployments are Ready at the respective exact
  SHAs. Configured app roots and deployment build routes match; production aliases
  are `lodgeflow.app` / `www.lodgeflow.app` and `admin.lodgeflow.app`.
- Remaining Phase 1 work includes customer catalog/resource aliases in
  `types/index.ts` and admin booking DTOs (T05). The three migrated manual
  confirmation request/error boundaries are addressed below. No #136/#139 scope is added.

## Phase 1 slice 8: validated customer cache boundary (T09)

- `apps/admin/lib/validations/customer-cache.ts` parses unknown Redis entries,
  validates the known customer shape and converts validated ISO timestamp strings
  to server-side Dates. `clerk-users.ts` removes the asserted JSON-as-Customer shape
  and `reviveCustomerDates` casts. The same parser serves single and batch reads;
  a positive hit must match the requested Clerk user ID. Extra fields are stripped.
- **Related fix:** malformed wrappers, invalid fields/timestamps and mismatched
  identities are misses rather than false deleted users or invalid customer data.
  Valid entries before and after a malformed batch item remain hits. Warning logs
  contain only the requested user ID, without the cached payload or validation data.
- Preserved the JSON write envelope and five-minute TTL, explicit `{ data: null }`
  negative hits, genuine 404 caching, transient failure propagation/counting and
  retry behavior, in-memory fallback, invalidation and provider call pacing. No
  routes, hooks, customer page fields, persisted records or authorization change.
- Six new characterization cases pass against the original reader; all 18 initial
  regressions fail before runtime changes and pass afterward. Tests use narrow
  mocked SDK inputs and schema-derived cached JSON fixtures without type escapes.
  Coverage includes complete metadata/dates, sparse nullable fields, mixed batches,
  unknown-field removal and retry after invalid cache plus transient failure.
- Broader customer response/UI date types remain in `types/clerk.ts`,
  `types/api.ts`, `hooks/useCustomers.ts` and guest components. Clerk metadata
  producer validation also remains: `extractMetadata`, `createCompleteCustomer`
  and `updateCompleteCustomer` still assert metadata shapes, and request schemas
  in `lib/validations/customer.ts` differ from those shapes. Invalid cached metadata
  now causes a fresh lookup; this slice does not normalize provider metadata.
- Local validation on 2026-09-30: `pnpm ci:check` passes formatting, read-only lint
  and 1,415 tests (admin 1,054; customer 322; database 36; email 3). Both app type
  checks and a dedicated new-test type check pass. `pnpm test:http`, clean frozen
  installation and all app/shared builds pass; runtime/test files match the
  validated build snapshot. Existing optional Sharp and absent-MongoDB build
  warnings remain non-blocking.
- Delivered in PR #164, reviewed `e3a1b059ec7a529fa72c80afdeca56b3300abb8c`,
  merged `1fdd52aff1fa8b6ab3c903daba898b63cec8cb48`. All five PR CI jobs
  (`36773886286`) and main CI jobs (`36774132724`) pass. Exact-SHA previews and
  both production deployments are Ready; configured roots, built routes and
  production aliases are verified.
- The HTTP gate exercises existing routes with the in-memory fallback. Malformed
  Redis entries use controlled unit dependencies, not a hosted Redis instance.
  Hosted login and live provider operations were not exercised.

## Phase 1 slice 9: customer payment-status read boundary

- `app/api/payments/[bookingId]/route.ts` uses `BookingPaymentStatus`, a projection
  of the existing booking JSON fields, and `serializeBookingPaymentStatus`.
  Timestamps become ISO strings explicitly; legacy nulls and omission remain
  unchanged. Hydrated defaults, amounts in major units, response fields/envelopes,
  and identical missing/foreign 404s are preserved. Reads do not recalculate or
  write accounting values.
- `hooks/usePayment.ts` drops the unused `usePaymentStatus` export and its duplicate
  Date-shaped response type after a workspace-wide caller/re-export search. The
  active checkout hook, payment button and invalidation keys remain unchanged.
- **Related fix:** authenticate first, validate path IDs with a Zod schema, then
  access MongoDB. Malformed IDs return `Invalid booking ID`/400 rather than a
  database-cast 500. Valid uppercase IDs remain supported. Unexpected failures
  use the server logger and retain the safe existing 500 response.
- Eleven characterization cases pass before runtime changes, covering real
  hydrated documents, ISO dates, omitted/null optional fields, money values,
  cancelled bookings, ownership/auth and failure responses. Four ID regressions
  fail before the change; HTTP independently reproduces the same invalid-ID 500
  after passing read/ownership/database-failure checks without writes/provider calls.
- Local validation on 2026-09-30: 61 focused cases and customer type checking pass.
  `pnpm ci:check` passes formatting, read-only lint and 1,443 tests (admin 1,048;
  customer 356; database 36; email 3). Expanded HTTP smoke, clean frozen installation
  and all app/shared builds pass. All seven runtime/test files match validated
  build inputs. Existing optional Sharp and absent-MongoDB build warnings remain
  non-blocking.
- HTTP also checks receipt-backed amounts and ISO timestamps after the existing
  webhook settlement scenario. Hosted login and live provider operations remain
  outside this gate.
- Remaining catalog/resource/admin DTOs and broader request families are separate
  slices; #136/#139 remain excluded.

- Delivered in PR #167, reviewed `ed699b51e33e1933aa080968225c2f0072f89517`,
  merged `b74e0670a1b5101847bc50f4c3c8fa889926de86`. All five PR CI jobs
  (`36782922813`) and main CI jobs (`36783233130`) pass. Both exact-SHA previews
  and production deployments are Ready, with configured roots, built routes and
  production aliases verified.

## Phase 1 slice 10: customer cabin catalog JSON boundaries

- Move the already-characterized cabin JSON fields and source types out of the
  booking module into `types/cabin-read.ts` and `lib/serializers/cabin-read.ts`.
  Booking history/detail reuse the same projections. Catalog list/detail,
  server-rendered loaders and availability output now serialize explicit DTOs;
  client `Cabin`/`AvailableCabin` types no longer inherit Mongoose documents.
- Preserve IDs, ISO dates, hydrated defaults, price/discount virtuals, optional
  fields and legacy null/omission behavior. Serializers clone primitive arrays
  and omit undefined optional keys so server-rendered props match the prior JSON
  round trip. The shared Cabin model export is typed, with its ObjectId and
  existing discounted-price virtual declared; schemas/storage are unchanged.
- Remove the unused `hooks/useCabin.ts` after a complete caller/re-export search.
  Five component fixture files and list-hook fixtures use checked JSON builders;
  seven double casts and one `any` fixture are removed. Existing component layout,
  positive filters, regex search, price sorting and query/cache keys are preserved.
- **Related fixes:** the server detail loader now applies the API's existing
  inactive/maintenance denial; invalid detail IDs are rejected before DB access
  (API 400, page-loader null). Explicit zero-price bounds are retained across the
  API query, list hook and URL-driven client filter. Unexpected read failures use
  the server logger with existing safe API/page fallbacks.
- Before runtime changes: 15 new characterization cases pass; seven regressions
  fail across route/loaders/hook/listing. HTTP independently reproduces the
  inactive page's 200 after its API returns 404. The initial invalid image-domain
  fixture was corrected before collecting that evidence; image config is unchanged.
- After migration, 94 focused cases, both app type checks, the database build and
  expanded HTTP gate pass. HTTP compares complete list/detail/availability JSON,
  verifies inactive-page 404/noindex, checks zero-price/invalid-ID errors, and
  confirms available/occupied results without changing cabin/booking records or
  provider counts. `pnpm ci:check` passes formatting, read-only lint and 1,465 tests
  (admin 1,048; customer 378; database 36; email 3). Clean frozen installation and
  all app/shared builds pass. Existing optional Sharp and absent-MongoDB build
  warnings remain non-blocking.
- Remaining cabin debt: `app/page.tsx:getFeaturedCabins` and
  `app/api/cabins/availability/route.ts` still lack the active-catalog filter; take
  a focused visibility follow-up with HTTP regressions. Availability request
  parsing/date types, calendar endpoint inputs, client sorting assertions and
  icon-map types remain separate responsibilities. Pricing, overlap calculation,
  booking writes and their locks are unchanged. No #136/#139 scope is added.

- Delivered in PR #168: reviewed `b0cabe92a193d47ea0546bf55cad1d2ee5ca986a`,
  merged `4af083475fe4937be6deaf762b1272212aa1e5c8`. All five PR CI jobs
  (`36785129808`) and main CI jobs (`36785374090`) pass. Both exact-SHA previews
  and production deployments are Ready, with configured roots, built routes and
  production aliases verified.

## Phase 2 slice 1: manual customer confirmation request/error boundaries

- `lib/validations/confirmation-email.ts` parses unknown request bodies using
  Zod and derives the input type. `app/api/send/{confirm,payment-confirm,
  experience-confirm}/route.ts` authenticate before parsing and validate before
  database access. IDs must be 24 hexadecimal characters; extra fields remain
  ignored. `useSendConfirmationEmail` constructs the schema-derived request.
- **Related fixes:** malformed JSON now returns `Invalid JSON body`/400;
  non-object bodies return `Invalid request body`/400; malformed IDs and operator
  objects return `Invalid booking ID`/400. Missing IDs retain their existing 400.
  These cases previously escaped handlers, reached database queries or produced
  misleading responses. No database/provider calls occur for rejected input.
- Unexpected authentication/database/identity/provider failures now return
  `{ error: 'Failed to send confirmation email' }`/500 and use the existing server
  logger. This deliberately replaces raw provider/error objects in those three
  routes. Successful provider-ID responses and ownership/missing-resource/receipt/
  unpaid denials, senders, recipients and retry behavior are preserved.
- Twelve new characterization cases pass before runtime edits; all 48 new boundary
  regressions fail before and pass after. Existing rendered-content suites and two
  hook cases retain success/error/retry behavior. The expanded HTTP gate verifies
  malformed JSON/bodies/IDs, injected database and provider failures, safe envelopes,
  unchanged bookings and no provider effects for validation/database failures.
- Local validation on 2026-09-30: 120 focused tests pass; `pnpm ci:check` passes
  formatting, lint and 1,364 tests (admin 1,014; customer 322; database 25; email 3).
  Both app type checks, `pnpm test:http`, clean frozen install and all app/shared
  builds pass. Runtime/test files match validated build inputs. No hosted login or
  live provider delivery; existing optional Sharp and missing-MongoDB build warnings
  remain non-blocking.
- Delivered in [PR #160](https://github.com/Amadou-dot/lodgeFlow_admin/pull/160),
  reviewed `5a63126`, merged as `9d35897`. All five
  [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36768066652)
  and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36768366982)
  pass. Both previews and production deployments are Ready at the respective exact
  SHAs; configured app roots, built routes and production aliases match.
- Remaining V03 work includes customer `app/api/send/{welcome,dining-confirm}`,
  admin send routes and checkout validation/errors. Catalog/resource/admin DTOs
  remain Phase 1; receipt accounting and settlement delivery are unchanged.

## Phase 2 slice 2: named booking payment summary inputs (F01)

- `packages/database/src/booking-payments.ts` takes one named object containing
  `totalPrice`, `depositAmount` and read-only receipt amounts. The summary no longer
  requires receipt IDs, methods or dates it does not read. The positional API is removed.
- All six callers migrated: both `addBookingPayment` calls, the Booking validation
  hook, admin booking repricing, `buildDemoBookings` and the read-only audit script.
  Both apps use the shared model/domain paths. API responses and UI consumers retain
  the existing `amountPaid`, `remainingAmount`, `isPaid` and `depositPaid` fields.
- Eight characterization cases pass before the signature change, covering unpaid,
  partial/deposit/full receipts, decimal summation, free stays, zero deposit and
  unchanged gross receipt/refund history. The calculation body, rounding, numeric
  major-unit values and persistence behavior are unchanged. Existing integration
  and HTTP gates protect quote locks, idempotency and concurrent receipt writes.
- This implements F01's helper contract only. Money constructors/conversions remain
  M01–M03 in Phase 3; audit query typing and other positional helper APIs remain
  separate inventory work. No seed, audit against live data or storage migration is run.
- Local validation on 2026-09-30: `pnpm ci:check` passes formatting, lint and 1,372
  tests (admin 1,014; customer 322; database 33; email 3). Both app type checks,
  database type check (including scripts/tests), `pnpm test:http`, clean frozen
  install and all app/shared builds pass. All six runtime/script calls use one
  object; runtime/test inputs match the validated build. No hosted login, live
  providers, seeding or live audit. Existing optional Sharp/missing-MongoDB build
  warnings remain non-blocking.
- Delivered in [PR #161](https://github.com/Amadou-dot/lodgeFlow_admin/pull/161),
  reviewed `5f44055`, merged as `bf57e71`. All five
  [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36769174761)
  and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36769414531)
  pass. Both previews and production deployments are Ready at the exact respective
  SHAs, with matching configured roots, built routes and production domains.

## Phase 2 slice 3: named customer booking update inputs (F05)

- `updateCustomerBooking({ bookingId, customerId, updates })` replaces adjacent
  identity strings. Its only runtime caller, customer `PATCH /api/bookings/[id]`,
  passes the route booking ID, server-authenticated customer ID and parsed updates
  explicitly. All test callers migrate; the positional signature is removed.
- Traced the operation through shared Booking/Cabin/Settings models, server
  pricing, the PATCH serializer, `useUpdateBooking` and `app/bookings/page.tsx`.
  The existing `BookingDetail` response, error mapping, editable fields and
  booking/history cache invalidation are unchanged; no UI changes are required.
- The existing six database payment/domain cases plus three new characterization
  cases pass before the signature change. New assertions cover invalid/missing/
  foreign identities returning the same 404 without writes, checked-in/checked-out/
  cancelled bookings denying updates without writes, and permitted paid special
  requests retaining the saved quote and receipt accounting. Existing cases protect
  capacity, unpaid pricing, checkout/paid repricing guards and optimistic saves.
- Local validation on 2026-09-30: all nine focused database cases pass before and
  after; `pnpm ci:check` passes formatting, lint and 1,375 tests (admin 1,014;
  customer 322; database 36; email 3). Both app type checks, database type check,
  `pnpm test:http`, clean frozen install and all app/shared builds pass. Runtime/
  test files match the validated build inputs. Existing optional Sharp and absent-
  MongoDB build warnings remain non-blocking; no hosted login or live providers.
- Delivered in [PR #162](https://github.com/Amadou-dot/lodgeFlow_admin/pull/162),
  reviewed `d27017d`, merged as `dc9b593`. All five
  [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36770425926)
  and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36770837180)
  pass. Both exact-SHA previews and production deployments are Ready, with matching
  configured app roots, built routes and production aliases.
- Other customer query error/validation normalization, catalog/admin DTOs and
  reservation helper APIs remain separate slices; no #136/#139 scope is added.

## Phase 2 slice 4: named staff identity inputs (F03)

- `isOrganizationMember({ organizationId, userId })` and
  `resolveStaffRole({ userId, activeOrganizationId })` remove adjacent identity
  strings. All three runtime callers and the existing integration tests migrate.
  `requireApiAuth` normalizes Clerk's absent organization to null; the internal
  resolver accepts string or null, with no optional/undefined absence variant.
- Preserved the configured-organization match, bounded fresh Clerk membership
  lookup, exact member identity check, organization/user-scoped MongoDB assignment,
  valid application roles and failure propagation. Default administrator-only
  permissions, staff assignment/revocation transactions and response contracts
  are unchanged. Neither Clerk role claims nor membership alone grant a role.
- Fifteen new unit characterization cases pass before runtime changes. Narrow
  provider/database fixtures cover requested identity, missing/wrong organization,
  missing/unrelated member data, all application roles, absent/invalid assignment
  and dependency failure. The new test file also passes a dedicated TypeScript
  check; admin's standard app check still excludes legacy tests.
- The 88 focused unit/integration cases pass after migration, including current
  membership removal, permissions, assignment/revocation, reciprocal-admin
  concurrency and denied refund writes.
- Local validation on 2026-09-30: `pnpm ci:check` passes formatting, lint and 1,390
  tests (admin 1,029; customer 322; database 36; email 3). Both app type checks,
  the separate new-test type check, `pnpm test:http`, clean frozen install and
  all app/shared builds pass. All five runtime/test files match validated build
  inputs. The HTTP gate covers actual route/proxy organization, membership,
  assignment, permission and audit behavior using controlled Clerk identities.
  Hosted login/live provider operations were not run. Existing optional Sharp and
  absent-MongoDB build warnings remain non-blocking.
- Delivered in PR #163, reviewed `52c456168c9557a64bfeb8f949a16374ec37b6a5`,
  merged `cee2226fb22cb6ff646c851829fefbb57f91f60e`. All five PR CI jobs
  (`36772338049`) and main CI jobs (`36772643284`) pass. Both exact-SHA previews
  and production deployments are Ready, with matching configured app roots,
  built routes and production aliases.
- Remaining Phase 1 staff/audit DTO and cache work, staff request validation and
  other helper families stay separate; this slice changes no permission or role.

## Phase 2 slice 5: remove unused pagination builders (F04)

- Caller and export review confirmed `buildPaginationMeta`, `createPaginatedResponse`
  and their `PaginationMeta` interface had no runtime consumers. Remove these
  unused exports and their six tests rather than maintaining an unused positional
  API. The historical inventory snapshot still records the original symbols.
- Retain `parsePagination`, its six behavior tests and all route/hook coverage.
  Booking responses use `totalBookings`; customer responses use `totalCustomers`.
  No routes are migrated to the obsolete `totalItems` envelope. Authorization,
  default/clamped page sizes, query keys and resource response shapes are unchanged.
- Before cleanup, 120 focused unit, booking integration and customer-hook tests
  pass; 114 remain and pass after removing the six obsolete tests. Active behavior
  already has characterization coverage, so no new tests accompany this removal.
- Local validation on 2026-09-30: `pnpm ci:check` passes formatting, read-only lint
  and 1,409 tests (admin 1,048; customer 322; database 36; email 3). Admin type
  checking, HTTP smoke, clean frozen installation and all app/shared builds pass.
  Runtime/test files match validated build inputs. Interrupted full gates were
  rerun after temporary logs were lost. Existing optional Sharp and absent-MongoDB
  build warnings remain non-blocking.
- Delivered in PR #165, reviewed `ca44521b3ef99d82d9a7f86bebeff9a3eb6e9143`,
  merged `8e752de1dcab9ce2be8c9360b2527671625fbba3`. All five PR CI jobs
  (`36780171843`) and main CI jobs (`36780455638`) pass. Both exact-SHA previews
  and production deployments are Ready, with matching configured roots, built
  routes and production aliases.
- The booking-table status callback family remains F04 debt. Consolidating live
  response contracts belongs to its own characterized resource slice.

## Phase 2 slice 6: cabin checkout request boundary

- `apps/customer/app/api/payments/create-checkout/route.ts` validates unknown
  parsed JSON with `lib/validations/checkout.ts`. The only accepted identifier is
  a 24-character hexadecimal string. Authentication precedes body parsing, and
  invalid requests return before connecting to MongoDB or accessing Stripe.
  `useCreateCheckoutSession` constructs the schema-derived request type.
- **Related fixes:** malformed JSON and null request bodies return 400 instead of
  500. Numeric values previously accepted by Mongoose's ObjectId check are rejected
  before lookup/reservation. Preserve `Invalid booking ID` for invalid body/ID
  shapes, the success/error envelope, uppercase IDs and ignored extra fields.
- Extract the existing confirmation JSON reader to `lib/validations/request-body.ts`
  for reuse. Stream errors remain unexpected server failures, including stream
  errors that happen to be SyntaxErrors; only local JSON parsing maps syntax errors
  to 400. Checkout uses the server logger and retains its safe unexpected-error
  message. The three confirmation routes retain their existing error messages.
- Preserved owner scoping and identical missing/foreign 404s, persisted quotes,
  server-calculated deposit/balance, session reuse, Stripe metadata/URLs/idempotency,
  retry behavior and payment/history cache invalidation. The payment button and
  payment-status read interface are unchanged.
- Before runtime changes, 37 focused cases pass (13 newly added), including real
  React Query hook success/failure/retry behavior. All six input regressions fail.
  The HTTP gate independently reproduces the null-body 500. After the change,
  154 focused checkout/confirmation/hook tests and customer type checking pass.
- Local validation on 2026-09-30: `pnpm ci:check` passes formatting, read-only lint
  and 1,428 tests (admin 1,048; customer 341; database 36; email 3). Customer type
  checking, expanded HTTP smoke, clean frozen installation and all app/shared
  builds pass. All eight runtime/test inputs match the validated build snapshot.
  Existing optional Sharp and absent-MongoDB build warnings remain non-blocking;
  remote delivery gates are recorded below.
- HTTP checks invalid JSON and body/ID types with unchanged booking records and
  payment/email call counts. Hosted login and live provider operations remain
  outside this gate.
- Delivered in PR #166: reviewed `a83447a54e7d604d2a4c07544914dcfacb96fb53`,
  merged `cc7bbeb68b89690f2c7319e3534daa880524ccd3`. All five PR CI jobs
  (`36781424711`) and main CI jobs (`36781957487`) pass. Both exact-SHA previews
  and production deployments are Ready, with configured roots, built routes and
  production aliases verified.
- Customer payment-status DTO/date types in `app/api/payments/[bookingId]/route.ts`
  and `hooks/usePayment.ts`, other request families and money unit conversions
  remain separate slices. No #136/#139 scope is added.

## Phase 2 slice 7: public cabin catalog visibility

- `apps/customer/app/page.tsx:getFeaturedCabins` and
  `app/api/cabins/availability/route.ts` now select `status: active`, matching the
  existing catalog list, detail, calendar and sitemap rules. This fixes inactive
  and maintenance cabins appearing in public homepage cards/availability results.
- Preserve the homepage's three-card limit, price ordering, display arithmetic
  and empty-catalog fallback. Remove its query-result `any` annotation using the
  typed Cabin model and log unexpected failures through the server logger.
  Availability retains capacity/overlap predicates, date semantics, response
  DTOs and conflict identifiers. No booking or catalog data is changed by reads.
- Before changes, all 19 existing catalog tests pass and the new active-selection
  regression fails. The HTTP gate independently reproduces the homepage rendering
  an inactive fixture; active detail rendering and inactive calendar 404s pass.
  After changes, all 20 focused cases, customer type checking and HTTP smoke pass.
- Expanded HTTP checks both inactive and maintenance fixtures across homepage and
  availability, active detail rendering/structured data, the homepage's safe
  database-failure fallback, and unchanged catalog/provider state. These checks
  run through real Next server rendering with controlled local dependencies.
- `pnpm ci:check` passes formatting, read-only lint and 1,466 tests (admin 1,048;
  customer 379; database 36; email 3). Clean frozen installation and all app/shared
  builds pass; all four runtime/test files match validated inputs. Existing optional
  Sharp and absent-MongoDB build warnings remain non-blocking. Remote delivery
  gates are recorded below. Availability request validation/date types, calendar
  request parsing, other resource/admin DTOs and money/UI work remain separate
  slices. #136/#139 remain excluded.
- Delivered in PR #169: reviewed `d862a5ef4fccebd3ebe623ba2497c86b41460c22`,
  merged `28b0da6a72866ddaa9342a04cf2c0463fceee965`. All five PR CI jobs
  (`36786112913`) and main CI jobs (`36786459376`) pass. Both exact-SHA previews
  and production deployments are Ready, with configured roots, built routes and
  production aliases verified.


## Phase 2 slice 8: named booking overlap inputs (F06)

- `packages/database/src/models/Booking.ts:findOverlapping` accepts a named
  `BookingOverlapInput` with database ID strings and validated `Date` values.
  Migrated all four runtime callers: customer booking creation, admin creation
  and update, and the public cabin calendar. Removed the unused document
  `overlaps` method after checking source, scripts and tests for consumers.
- Preserved strict overlap comparisons (adjacent stays do not conflict), every
  non-cancelled status, cabin filtering, optional self-exclusion, hydrated results
  and read-only behavior. Admin/customer writes still check availability inside
  their existing cabin locks; no lock, pricing, receipt or persistence changes.
- Added three real-MongoDB characterization tests before changing the helper;
  these and all 24 existing booking-model tests passed on the positional contract.
  After migration, the three shared tests and 62 model/booking-route integration
  tests pass. Expanded HTTP smoke checks the calendar's existing date-only ranges
  against a real booking, alongside availability reads and unchanged stored data.
- `pnpm ci:check` passes formatting, read-only lint and 1,469 tests (admin 1,048;
  customer 379; database 39; email 3). Both app type checks, the shared database
  build, a targeted TypeScript check of the migrated admin model test, expanded
  HTTP smoke, clean frozen installation and all app/shared builds pass. All seven
  runtime/test inputs match the clean build snapshot. Existing optional Sharp,
  absent-MongoDB and dynamic-render build diagnostics remain non-blocking; remote
  delivery gates are recorded below.
- Delivered in PR #170: reviewed `06f5e97eb00e4504b9e09a89472b8500cc671195`,
  merged `7f263c373d46d8bcfd36ec28e585b85148b9bda1`. All five PR CI jobs
  (`36787430829`) and main CI jobs (`36787622549`) pass. Both exact-SHA previews
  and production deployments are Ready, with configured roots, built routes and
  production aliases verified.
- Calendar and availability request parsing remain separate validation work in
  `apps/customer/app/api/cabins/[id]/availability/route.ts` and
  `apps/customer/app/api/cabins/availability/route.ts`. This slice preserves their
  current request and response contracts. #136/#139 remain excluded.


## Phase 2 slice 9: public availability request boundary

- `apps/customer/lib/validations/cabin.ts:cabinAvailabilitySchema` validates
  unknown search JSON, converts string dates once, enforces a positive integer
  guest count and attaches the date-order rule to `checkOutDate`. Removed the
  unused `AvailabilityQuery` declaration that claimed JSON contained `Date`s.
- `app/api/cabins/availability/route.ts` now uses the shared JSON parser and the
  schema before connecting or querying. Malformed JSON, non-object bodies,
  invalid date/guest types and unparseable dates return safe 400 responses.
  Body-stream and unexpected database failures retain the logged, safe 500.
- Preserved active-only cabin selection, capacity/price ordering, exact time and
  offset semantics, strict overlap comparisons, conflict identifiers and complete
  serialized cabin output. Existing missing-field and date-order messages remain;
  unknown payload fields do not affect queries. No booking/provider writes occur.
- Before changes, 13 new characterization cases pass and 22 regressions fail.
  The real HTTP gate independently reproduces null JSON returning 500. After the
  change, all 55 availability/catalog tests and customer type checking pass.
  Expanded HTTP cases cover null/malformed JSON, invalid dates, numeric date input,
  operator-shaped/fractional guest counts, and unchanged booking/provider state.
- `pnpm ci:check` passes formatting, read-only lint and 1,504 tests (admin 1,048;
  customer 414; database 39; email 3). Expanded HTTP smoke, customer type checking,
  clean frozen installation and all app/shared builds pass. All five runtime/test
  inputs match the clean build snapshot. Existing optional Sharp, absent-MongoDB
  and dynamic-render diagnostics remain non-blocking; delivery gates are below.
- Delivered in PR #171: reviewed `6fd2195209bba86f0d29f584301f76908c94e20c`,
  merged `8b26f4f0d8035b8b1c07d7506a6d181fe5300d22`. All five PR CI jobs
  (`36788028318`) and main CI jobs (`36788313943`) pass. Both exact-SHA previews
  and production deployments are Ready, with configured roots, built routes and
  production aliases verified.
- Calendar path/query parsing remains separate work in
  `apps/customer/app/api/cabins/[id]/availability/route.ts`; its six-month defaults,
  date-only output and both UI consumers need their own characterization.
  #136/#139 remain excluded.


## Phase 2 slice 10: public cabin calendar request boundary

- Calendar request validation is implemented in
  `apps/customer/lib/validations/cabin.ts` and
  `app/api/cabins/[id]/availability/route.ts`. Path IDs and effective date ranges
  are validated before database access; unexpected failures use the existing
  server logger and retain the safe 500 response.
- Before runtime edits, 15 characterization cases pass: exact query instants,
  UTC date-only output, six-calendar-month defaults including month-end rollover,
  empty/partial/repeated parameters, sparse status fallback, missing/nonpublic
  cabin 404s and safe database failures. Twelve regression cases fail for malformed
  IDs/dates, reversed/equal effective ranges and missing server logging. HTTP
  independently reproduces the invalid-ID 500. After migration, all 88 focused
  calendar/availability/catalog/preview component cases and customer type checking
  pass. The expanded HTTP gate now passes invalid-ID/date/range cases with unchanged
  booking/provider state and the existing positive calendar/date-only response.
- `pnpm ci:check` passes formatting, read-only lint and 1,531 tests (admin 1,048;
  customer 441; database 39; email 3). Customer type checking, expanded HTTP smoke,
  clean frozen installation and all app/shared builds pass. All four runtime/test
  files match validated build inputs. Existing optional Sharp, absent-MongoDB and
  dynamic-render diagnostics remain non-blocking; delivery gates are below.
- Delivered in PR #172: reviewed `0f498454e77ea0fbacec58ad20bcb0c369e7eb41`,
  merged `2a4ef2f8054e890b306c5e5a20d2adc6d79de3c3`. All five PR CI jobs
  (`36788834805`) and main CI jobs (`36789214346`) pass. Both exact-SHA previews
  and production deployments are Ready, with configured roots, built routes and
  production aliases verified.
- The existing `useCabinAvailability` hook, `CabinAvailabilityPreview` and
  `BookingForm` consume the unchanged date-only range envelope. Their query keys,
  refresh timing, end-exclusive date disabling and UI behavior remain untouched.
  Broader component state/DTO cleanup remains separately tracked; #136/#139 stay
  excluded.


## Phase 2 slice 11: named booking-table status actions (F04)

- `apps/admin/types/booking-actions.ts` defines the named booking ID/status input
  and callback, using the existing shared `BookingStatus` union. Migrated the
  page handler and all six table component props; removed the page's unchecked
  status cast. Request payloads, success/failure toasts and SWR refresh timing
  retain their existing behavior; the mutation hook/cache keys are unchanged.
- `BookingActionsMenu` now needs only a string ID and status, while retaining
  each caller's complete record for view/edit/delete callbacks. The admin
  `PopulatedBooking._id` declaration now matches its existing JSON string output;
  the broader document/date/customer/cabin declarations remain T05 debt.
- Related fix: show Check In for confirmed bookings, matching the existing API
  transition matrix and detail-page action. The old unconfirmed-to-checked-in
  action always failed server validation. Other menu visibility stays unchanged;
  this slice adds no new action or reservation workflow.
- Before runtime edits, 14 new menu/page characterization cases and 22 existing
  mutation-hook cases pass; two check-in regressions fail. The initial fixture
  type check exposes the menu's unnecessary document props. After migration,
  51 focused menu/page/read-hook/mutation-hook cases, admin type checking and a
  targeted check of both new UI test files pass without casts or disabled rules.
- The 38 real-MongoDB booking API tests pass, including an explicit string-ID
  response assertion. `pnpm ci:check` passes formatting, read-only lint and 1,547
  tests (admin 1,064; customer 441; database 39; email 3). Expanded type checks,
  HTTP smoke, clean frozen installation and all app/shared builds pass. All 12
  runtime/test files match validated build inputs. Existing optional Sharp,
  absent-MongoDB and dynamic-render diagnostics remain non-blocking; remote
  delivery gates follow.
- Component tests adapt HeroUI menu primitives to native buttons; they assert
  callback identity, action availability, exact mutation input and refresh/error
  behavior. They do not claim browser layout, hosted login or live provider proof.
  Full admin booking DTOs and other state/menu policy work remain separate slices.

## Cache test reliability follow-up (T09)

PR #173's main CI run `36790525172` exposed an order-dependent fixture in
`apps/admin/__tests__/unit/lib/clerk-users.cache-boundary.test.ts`: two concurrent
Clerk lookups used sequential 404/500 mock responses. The requests can arrive in
either order after rate limiting, so the test could cache the wrong fixture ID
without any application defect. The other four main CI jobs passed, and both
production apps were verified Ready at merge `c6d79a0` with the expected app roots,
built routes and aliases.

- Assign mock failures by requested user ID and exercise both batch orders with
  controlled timers. Preserve the assertion that only the deleted user is cached
  and that the transient error is counted. No production code changed.
- The reversed-order case failed before the fixture correction (25 other cache
  checks passed). All 67 Clerk/cache checks pass after correction; admin and
  changed-test type checks pass. `pnpm ci:check` passes formatting, read-only lint
  and 1,548 tests (admin 1,065/customer 441/database 39/email 3).
- HTTP and clean builds passed for #173's unchanged runtime. This test-only
  follow-up does not repeat those local checks; PR CI runs all five jobs.
- F02 guest reservation helper work remains next after this gate is repaired.

## Phase 5 implementation: existing sender repair (#132)

All ten existing `emails.send` sites now resolve senders through `@lodgeflow/email`:
admin `app/api/send/{confirm,welcome}`, customer
`app/api/send/{confirm,payment-confirm,welcome,dining-confirm,experience-confirm}`,
both customer `lib/email.ts` functions and `lib/reservation-confirmation-email.ts`.

The user approved `payments@lodgeflow.app` and `notifications@lodgeflow.app`, keeping
`LodgeFlow` as the display name. These are defaults, so no newly required deployment
setting can disable existing sends. Optional server-only
`LODGEFLOW_PAYMENT_EMAIL_FROM` / `LODGEFLOW_NOTIFICATION_EMAIL_FROM` replace only
one mailbox each. Validation runs at send time and rejects empty/malformed values,
including header injection, with `EmailSenderConfigurationError`.

Payment receipts and cancellation/refund notices use the payment sender. Generic
cabin confirmations and welcome messages use notifications. Paid dining/experience
confirmations use payment; free confirmations use notifications, consistently in
manual routes and the post-settlement helper. Templates, recipients, triggers and
idempotency keys are preserved.

Review also found the missing `@react-email/render` optional peer: the installed
Resend SDK requires it before dispatching React templates. Both apps now declare
the React 18 compatible renderer, and HTTP fixtures use actual SDK rendering with
intercepted transport. Focused regressions cover defaults, overrides, invalid
configuration, sender classification, provider failure and delivery-marker retry.

Verification on 2026-09-20: `pnpm ci:check` passed formatting/lint and all 1,207 tests
(admin 1,014, customer 165, database 25, email 3). `pnpm test:http` passed with real
SDK template rendering and intercepted delivery transport. Frozen installation,
both clean isolated production app builds and shared package builds also passed.

Authorized live verification invoked the existing customer welcome and
payment-confirm handlers using synthetic identity/booking dependencies, actual
templates and actual Resend delivery. Both sends were accepted; provider readback
reported `delivered` for each. This validates the selected mailboxes and templates,
not deployed application authentication or live database behavior.

Issue #132 is closed: the user confirmed both emails arrived and the welcome
rendered correctly. Both production deployments were verified Ready at merge
`9a9c2963c54266cbc563259905a9048791580f3c`, with matching app roots and domains.
The private test recipient and message IDs are intentionally omitted. The separate
Phase 5 origin/contract review remains open.
#136/#139 remain excluded; this repair adds no notification features.

## Triage rules for subsequent slices

1. Pick a confirmed item and inspect its listed candidates/callers on current HEAD.
2. Link each applicable finding to the slice and its regression/characterization
   test. Keep genuine external-boundary exceptions explicit with a rationale.
3. Update the inventory status and evidence when the slice lands; do not claim
   unrelated candidates are resolved because a parent type was renamed.
4. Add newly discovered semantic debt with an owner and bounded next action.
5. At Phase 6, review all remaining candidates, including scripts/tests and rarely
   used routes. Completion requires dispositions, migrated callers and passing
   checks, not reaching an arbitrary count or percentage.

#136's broad dining coverage and #139's notification features remain excluded.
