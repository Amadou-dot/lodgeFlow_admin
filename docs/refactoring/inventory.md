# Refactoring debt inventory

Baseline: `07670932f0b8349fa826802a6ee27f20b3501908` (2026-09-15).
This inventory assigns work; it does not authorize skipping the Phase 0B/0C gates.
All confirmed items below remain open unless their status explicitly says otherwise.
The owning phase is an execution dependency, not an assigned person.

## Phase 4 review handoff (2026-10-09)

S01 is implemented on `refactor/phase4-ui-state` from Phase 3 merge `9f8b1a8`.
The [UI state/cache inventory](phase-4-ui-state.md) covers admin forms and caches,
catalog/action workflows, reservation/staff requests, customer confirmations,
booking dialogs and affected mutation caches. It records preserved contracts,
intentional fixes and the new confirmation-cache access guard verified in review.

Final local gates pass formatting/read-only lint, 2,497 tests, both app type
checks, strict compilation of all 20 changed admin tests, isolated HTTP checks,
frozen installation and all credential-free production builds. The three slices
have independent spec/quality approval. Representative browser, hosted-auth and
visual checks remain unrun: connected CUA is unavailable and this checkout has
no existing Playwright runner. The Phase 4 browser acceptance stays unchecked.
Remote checks and final integration review
belong to the draft PR. Phases 5–6 and the milestone remain open.

## Historical Phase 3 review handoff (2026-10-09)

Subsequently merged in [PR #194](https://github.com/Amadou-dot/lodgeFlow_admin/pull/194)
at `9f8b1a8`. The following records the evidence at its review handoff.

M01–M03 are implemented on `refactor/phase3-money` from `2aa8756`. The complete
[money boundary inventory](phase-3-money.md) maps catalog/settings prices, cabin
and reservation accounting, checkout/webhook/refund conversions, input and display
adapters across both apps. Validated major-unit and cents types retain numeric
storage/JSON, existing price/deposit rounding, quote checks, locks, capacity
transactions, version retries and legacy reconciliation safeguards.

Focused corrections reject unsafe/sub-cent receipt or refund inputs before
effects, validate provider cents and persisted monetary state, reject mismatched
completed reservation checkout retries, and make the cabin Half preset display
and submit the same exact cent amount. Invalid guest-count drafts remain editable;
request validation still rejects them. No data migration, provider operation,
Phase 4 workflow refactor or unrelated feature is included.

Final local evidence: `pnpm ci:check` passes formatting, read-only lint and 2,387
tests (admin 1,520; customer 771; database 93; email 3). Both app/shared production
builds, frozen installation, strict compilation of all eight touched admin
test files and the expanded isolated HTTP gate pass. Independent review has no
remaining findings. The implementation is prepared for PR review; remote CI and
preview status are recorded on the PR. Merge and production verification remain
pending. Historical evidence below is retained. The existing syntax JSON
remains the dated Phase 1–2 snapshot, not a fresh Phase 3 scan.

## Historical review checkpoint (2026-10-07)

Customer browser-review follow-up: cabin requests now submit all five controlled
extra choices and complete nonblank special-request lines. The form receives
the persisted extra-guest fee on mobile and desktop and includes its existing
per-guest, per-night charge in the preview. Cabin stay dates display their UTC
calendar day in confirmation, history and details; cancellation timestamps retain
local display. Confirmation consumes the shared nullable booking DTO, handles
sparse optional fields and renders removed cabins without crashing. Confirmation
and history suppress checkout for removed cabins, matching the server's 404.
No persistence, authorization, pricing service or provider contract changes.

Regression coverage adds 21 customer cases, including real HeroUI checkbox
submission, LF/CRLF requests, one/multiple guests, absent fees, Denver/Tokyo date
display, sparse/null references and existing payment controls. Workspace checks
pass 2,224 tests; both app type checks, the isolated HTTP gate, frozen installation
and credential-free production builds pass. Live payment processing, hosted login
and inbox delivery are separate verification boundaries.

Review follow-up to PR #190: guest updates again accept legacy national ID
strings verbatim, including spaces, punctuation and older lengths; creation
validation and null/omission semantics remain unchanged. Dining catalog updates
now validate the effective minimum/maximum guest range inside the catalog
transaction, including single-field updates with no reservations. Invalid ranges
return 400 without persisting other fields or advancing `reservationVersion`.
Regression coverage spans the guest form/request/provider boundaries, both dining
update routes, shared transaction rollback and the HTTP gate.

The remaining Phase 1–2 implementation is complete on the review branch
`refactor/admin-cabin-availability`, based on `4d3590b`. Final local gates pass and
the Phase 1–2 acceptance checklists are complete. The branch is ready for review;
this checkpoint does not claim a merge or verified deployment. Historical PR evidence below
continues to describe the earlier delivered slices only. The requested Phase 3
review boundary was subsequently lifted on 2026-10-08; the overall refactoring
milestone remains open.

The [current candidate review](inventory-current.json) supersedes the baseline
candidate list for outstanding work. It covers 655 source/test/script files:
81 generic test-infrastructure `any` candidates remain assigned to Phase 6, while
49 findings are reviewed persistence, legacy transport or external/value-shape
exceptions. The baseline JSON retains its original
locations and counts for comparison. Every current syntax candidate has a
specific disposition: valid persistence/framework/legacy transport boundary or
Phase 6 test infrastructure debt (O01). No runtime `any`, double cast, ambiguous
same-primitive positional signature or Record cast over typed data remains in the
scanned scope. This is a bounded syntax review, not proof that all Phase 3–6 work
is finished.

Legacy cabin/booking read DTOs preserve explicit nulls separately from omitted
fields, including sparse lean rows. This is the existing transport compatibility
exception, tested against hydrated and lean JSON; new internal component inputs
use one absence representation. Mongoose `Document` inheritance remains only at
the persistence layer. URL filter primitives and StatsGrid display values are
intentional heterogeneous values, not ambiguous date or money representations.

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
| T01 | `apps/customer/types/index.ts`: `Cabin`, `Booking`, `PopulatedBooking`                                           | Transport/UI aliases reuse document interfaces; booking dates mix strings and Dates.         | 1        | Complete locally: all resource aliases now describe JSON; unused Booking/model/event aliases are removed. Booking, cabin, dining, experience, reservation and Settings consumers use string IDs/dates and explicit missing-reference types. |
| T02 | `apps/customer/app/api/bookings/[id]/route.ts`: `GET`                                                            | `ApiResponse<any>` returns a populated document without an explicit DTO contract.            | 1        | Complete in PR #152: explicit detail DTO/serializer with owner/missing/foreign, ID/date and missing-cabin coverage.                                                                 |
| T03 | `apps/customer/app/api/payments/create-checkout/route.ts`: cabin name extraction                                 | Double cast conceals the populated-reference shape.                                          | 1        | Implemented in Phase 1 slice 6 below: nullable cabin population, missing-reference denial and characterized quote/session behavior.                                                                           |
| T04 | `apps/customer/app/api/payments/webhook/route.ts`: confirmation payload                                          | Double cast converts a populated booking to the UI/email type.                               | 1        | Implemented in Phase 1 slice 4 below: explicit payment email inputs, nullable cabin population and preserved settlement/delivery boundaries.                                        |
| T05 | `apps/admin/types/api.ts` and `apps/admin/types/index.ts`                                                        | Query/aggregation/transport types coexist; serialization contracts need per-flow separation. | 1        | Complete locally in slices 15–21 and 26: booking/customer/reporting/staff/audit/calendar/reservation/statistics queries and DTOs are separated, with serializers and checked consumer fixtures. |
| T06 | `packages/database/src/models/*`: nine `Document`-extending interfaces                                           | Persistence interfaces are re-exported across app boundaries.                                | 1        | Reviewed boundary exception: all nine Document interfaces stay within persistence. UI imports use serializable projections; no document methods cross JSON. |
| T07 | `apps/admin/__tests__/integration/api/bookings.test.ts`: fixture overrides; remaining candidate fixtures         | Fixture `any` hides missing/invalid fields.                                                  | 1        | Complete for migrated booking/DTO fixtures and all touched test files compile in a separate strict check. Remaining generic mocks and model-test infrastructure are itemized as O01 in inventory-current.json. |
| T08 | `apps/admin/components/BookingForm/PaymentInformation.tsx`, `PriceBreakdown.tsx`; cabin/dining/experience modals | Props permit both omitted and null absence.                                                  | 1        | Complete locally: booking Settings and catalog modal props use optional absence; callers normalize missing selections without changing legacy PATCH semantics. |
| T09 | `apps/admin/lib/clerk-users.ts`: `reviveCustomerDates`                                                           | Cache boundary uses assertions to reconstruct dates.                                         | 1        | Implemented in Phase 1 slice 8: validated unknown cache payloads and dates, per-entry misses for malformed data, preserved negative cache and transient failures.                                                              |
| T10 | Admin `app/api/cabins/bulk/route.ts`: `handleBulkDelete` | Populated cabin-name projection is concealed behind a double cast. | 1 | Implemented in Phase 1 slice 11: nullable sparse name projection with preserved active-booking denial, deduplication, Unknown fallback, history, counts and audit attribution. |
| T11 | Admin cabin catalog/detail/create/update routes, `types/index.ts`, `hooks/useCabins.ts` and cabin UI | JSON cabin responses are typed as Mongoose documents. | 1 | Implemented in Phase 1 slice 12: shared existing cabin DTO/serializer, plain admin read/mutation types, checked fixtures and normalized editor absence. Admin availability is complete in T12 / V08. |
| T12 / V08 | Admin cabin availability route and booking calendar | Untyped date projection, unvalidated queries and unchecked calendar responses. | 1–2 | Completed locally in the availability slice below: typed query/projection, validation before database access, safe logging and validated calendar JSON. |
| T13 | Both dining catalog APIs, aliases, hooks and modal | JSON IDs/dates inherit persistence field types; detail uses an untyped JSON round trip. | 1 | Complete locally in slices 13 and 23–27: shared dining JSON, explicit editable fields, validated writes and queries, typed sort/rendering and normalized modal absence. |
| T14 | Both experience catalogs, aliases, hooks and modal | JSON IDs/dates and sparse defaulted arrays are described as persistence fields. | 1 | Complete locally in slices 14 and 23–27: shared experience JSON, strict editable inputs, typed read filters, checked fixtures and sparse-page regressions. |
| F01 | `packages/database/src/booking-payments.ts`: `paymentSummary`                                                    | Adjacent major-unit numeric positionals can be reversed.                                     | 2        | Implemented in Phase 2 slice 2: named inputs at all six call sites; characterization and shared/app accounting gates pass.                                                                                          |
| F02 | `packages/database/src/reservation-capacity.ts`: create/update reservation helpers                               | Same-type ID/customer positionals and inferred `cancel = false` switch.                      | 2        | Implemented in Phase 2 slice 12: named guest create inputs and tagged update/cancel operations at all callers, with owner/payment/terminal guards and catalog transaction writes preserved.                                    |
| F03 | `apps/admin/lib/staff-access.ts`: `isOrganizationMember`, `resolveStaffRole`                                     | Organization/user string inputs can be confused.                                             | 2        | Implemented in Phase 2 slice 4: named identity inputs, canonical absent organization and passing membership/assignment/permission gates.                                                                                |
| F04 | `apps/admin/lib/api-utils.ts`: pagination helpers; booking-table status callbacks                                | Same-type positional values recur across utilities and component contracts.                  | 2        | Implemented in Phase 2 slices 5 and 11: unused pagination builders removed; named booking-table status inputs, string JSON IDs and checked action-menu data replace ambiguous callback signatures.                                                         |
| F05 | `packages/database/src/customer-bookings.ts`: `updateCustomerBooking` | Booking and customer string IDs can be confused. | 2 | Implemented in Phase 2 slice 3: named identity/update inputs, exact denial/no-write and paid-update accounting characterization. |
| F06 | `packages/database/src/models/Booking.ts`: `findOverlapping`, unused `overlaps` | Date positionals and string/ObjectId alternatives obscure the overlap contract. | 2 | Implemented in Phase 2 slice 8: named string IDs and Date inputs at all callers; preserve strict boundaries, status selection, self-exclusion and booking locks. |
| F07 | `packages/database/src/reservation-capacity.ts`: catalog/staff helpers and `validateCount` | Catalog IDs, status transitions and count bounds retain positional inputs. | 2 | Implemented in Phase 2 slices 14–15: named catalog, private identity/count and staff status inputs, with typed editable fields and a validated status request boundary. Transaction, guard ordering and audit attribution are characterized; response/native-status DTO debt remains separate. |
| F08 | Admin `lib/rate-limit.ts`: `createRateLimitKey` and API callers | Adjacent user/endpoint strings can be reversed. | 2 | Implemented in Phase 2 slice 20: named inputs at all three runtime callers; anonymous fallback, user/endpoint namespaces, rate limits and retry headers preserved. |
| F09 | Admin `lib/validations/cabin.ts`: `isDiscountValid` | Discount and price numbers can be swapped. | 2 | Completed alongside Phase 1 slice 12: named inputs at both routes and all three test calls, with unchanged comparison and stored-price validation. |
| V01 | Admin `app/api/bookings/route.ts` and `app/api/bookings/[id]/route.ts`: `cancellationFields`                     | Cast-based field indexing erases typed update keys.                                          | 2        | Implemented in Phase 2 slice 13: checked literal field keys replace the two Record casts, with exact denial order, falsy value presence and no-write characterization.                                                                   |
| V02 | `apps/admin/lib/validations/booking.ts` and corresponding booking routes                                         | Payload rules and database-dependent rules span layers.                                      | 2        | Complete locally in slice 24: payload-only date/refund/payment rules live in schemas; IDs/JSON/unknown fields validate before writes. Existing lock, Settings, receipts, refund authorization and stored-state rules remain server-side. |
| V03 | Admin `lib/api-utils.ts` vs customer `types/index.ts`, resource/email/webhook routes                             | Response envelopes and error contracts differ.                                               | 2        | Complete for Phase 1–2 resource/email/refund boundaries. Preserve existing envelopes and signed webhook acknowledgements; known errors narrow by class and unexpected errors log safely. General response consolidation remains Phase 6. |
| V04 | Customer `app/api/experiences/route.ts` and `hooks/useExperiences.ts` | Untyped catalog query and truthy price checks drop explicit zero bounds. | 2 | Complete locally: typed filters, explicit zero bounds and shared experience JSON; route/hook/HTTP regressions preserve query/cache behavior. |
| V05 | Customer `app/api/dining/route.ts` and `hooks/useDining.ts` | Untyped available-only query and truthy price checks drop explicit zero bounds. | 2 | Complete locally: typed available-only queries, explicit zero bounds and shared dining JSON; route/hook/HTTP regressions preserve query/cache behavior. |
| V06 | Admin `lib/api-utils.ts`: `ApiAuthResult`, route/audit consumers and auth fixtures | Boolean plus optional identity, role and error permits invalid result states. | 2 | Implemented in Phase 2 slice 21: discriminated success/denial result, checked auth fixtures and narrowed consumers. Characterization protects the full permission matrix/default admin-only policy, exact errors, bypass protection and audit attribution/failure policy; no HTTP or authorization behavior change. |
| V07 | Admin `app/api/cabins/bulk/route.ts` and `lib/validations/bulk-cabin.ts` | Raw payloads, raw exception messages and unawaited operations escape the request boundary. | 2 | Implemented in Phase 2 slice 22: validated tagged operations, preserved legacy denial precedence, safe logged failures and rejected contradictory/unknown fields. |
| M01 | `packages/database/src/booking-pricing.ts`: price/deposit calculation                                            | Prices are raw major-unit numbers; deposit rounding has business meaning.                    | 3        | Completed locally in Phase 3: validated major-unit calculations with characterized rounding/clamping; see phase-3-money.md.                                                          |
| M02 | `booking-payments.ts` vs `reservation-payment-state.ts`/`reservation-payments.ts`                                | Cabin receipt `amount` is major units while reservation `amountCents` is cents.              | 3        | Completed locally in Phase 3: boundary inventory, validated unit types, receipt/refund limits and retry/concurrency regressions; see phase-3-money.md.                                                               |
| M03 | Customer checkout/webhook routes and admin `utils/utilityFunctions.ts`: Stripe conversion/formatting             | Raw `* 100`, `/ 100` and display formatting encode units implicitly.                         | 3        | Completed locally in Phase 3: shared conversion/formatting helpers and precision/sign/range/display regressions; see phase-3-money.md.                                                                                        |
| S01 | Admin/customer page, form and mutation hooks; see `phase-4-ui-state.md` | Derived form/query state, exclusive workflows and actual SWR/TanStack reader refresh | 4 | Implemented and independently reviewed with success/failure/retry/cache regressions. Independent extras remain valid options. Browser acceptance remains blocked and unchecked. |
| E01 | Both apps' existing send routes and customer email helpers                                                       | Ten sender sites migrated to validated `@lodgeflow/email` configuration.                     | 5 / #132 | Complete in PR #155 / merge `9a9c296`: tests, both production deployments, Resend delivery and user inbox confirmation verified. No #139 features.                                  |
| O01 | Scripts, test helpers and unmatched remaining candidates                                                         | Admin compiler excludes scripts/tests; passing Jest does not prove their type safety.        | 6        | Open for Phase 6: inventory-current.json lists remaining generic test mocks, schema-test fixtures and the test setup factories by path/line. All modified admin tests receive a separate strict type check; no compiler/lint settings are weakened. |
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

## Phase 1 slice 11: admin bulk-delete cabin population (T10)

- The active-booking query now declares its nullable cabin-name projection.
  Sparse legacy names remain optional and keep the existing `Unknown` fallback;
  deleted references remain null. Removed the double cast without changing
  filter semantics, encounter-order name deduplication or denial text.
- Eleven new real-Mongo characterization cases and 26 existing cabin-hook cases
  pass before the runtime edit. Coverage protects auth-before-parse/DB ordering,
  every active/terminal booking status, scope, sparse/deleted references,
  duplicate/missing IDs, deletion counts, retained booking history and audit
  attribution/redaction. Hook request, toasts and invalidation stay unchanged.
- Expanded HTTP characterization passes before the edit with real Clerk role
  checks, missing-reference no-write denial and allowed manager deletion/audit.
  Services are disposable and providers controlled; no live operations run.
- Final local validation: the same 37 focused checks, both app type checks and
  a strict check of the new integration test pass. `pnpm ci:check` passes
  formatting, read-only lint and 1,781 tests (admin 1,179, customer 540,
  database 59, email 3). Expanded HTTP passes after the edit, and a clean
  frozen installation and all workspace builds pass using CI's public key.
- Broader bulk payload validation and error handling are addressed in Phase 2
  slice 22 below.
  Existing deletion/concurrent-booking behavior is unchanged; this slice does
  not establish atomic serialization between catalog deletion and booking writes.

## Phase 2 slice 22: admin bulk cabin request and error boundary (V07)

- The request reader returns a schema-derived delete/discount operation. It
  retains the established required-fields, ID-format, maximum-count, action and
  discount-error precedence. The route retains authorization before DB/parsing,
  and price-dependent discount checks remain against current stored cabins.
- Intentional fixes: malformed/null bodies, non-string actions, non-finite
  discounts, contradictory delete/discount payloads and unknown fields now return
  safe 400 responses. Strict operation schemas reject operator/dotted/immutable
  and server-owned fields; only parsed IDs/discounts reach the named handlers.
- The route awaits each operation inside its error boundary. Unexpected failures
  are logged and return `Bulk operation failed`/500, including asynchronous
  read/delete/update failures that previously escaped the catch or disclosed raw
  exception text. Successful counts, audit attribution, retained history and
  cancellation-status behavior remain unchanged.
- Before runtime edits, 57 route/hook characterization checks passed and all 16
  new regressions failed. Real HTTP reproduced null-body 500. After the edit all
  73 focused checks pass; the strict new-test type check passes without casts.
- Final local gates pass: formatting/read-only lint and 1,817 tests (admin 1,215,
  customer 540, database 59, email 3), admin runtime/test types, expanded HTTP,
  and a clean frozen installation/all workspace builds using CI's public key.
  HTTP verifies safe write failure without mutation, retry and discount audits.
- This slice preserves existing check/write sequencing and audit failure policy.
  It does not claim new concurrency guarantees for catalog deletion or discount
  changes. No live provider or database operations are used for verification.

## Phase 1 slice 12: shared cabin JSON and admin catalog callers (T11, F09)

- Moved the existing customer cabin DTOs and serializers into exported
  `packages/database/src/cabin-json.ts`. Both apps use that module; all former
  customer imports are migrated and the two superseded app-local files removed.
  Type-only client imports keep Mongoose runtime code on the server.
- Admin catalog/detail/create/update routes now serialize explicit cabin JSON.
  Admin `Cabin`, query and mutation results are plain DTOs with string IDs/dates;
  the cabin information card accepts only displayed fields. Required/optional
  fields, virtuals, sparse hydrated defaults, legacy null/omission and envelopes
  remain unchanged. Cabin-modal absence is explicitly null, addressing that
  component's part of T08; dining/experience/settings props remain open.
- Related editor fix: legacy null bedroom/bathroom/size/minimum-night fields
  previously crashed edit rendering at `toString()`. Normalize those values to
  omitted form fields without changing read JSON or PATCH clearing semantics.
  The editor sends writable form fields and the string ID, omitting response
  metadata that the server already ignored. View/create/edit interaction checks
  include the failing-before legacy-null case.
- Named `isDiscountValid({ discount, price })` replaces both numeric-position
  route calls and all test callers. The predicate and database-dependent
  discount/price checks are unchanged; this introduces no money-unit changes.
- Before runtime changes, 124 admin route/schema/hook cases, all 540 customer
  tests and expanded HTTP pass. Replacing captured hook callbacks with 24 real
  query/mutation tests also passes before edits; these protect requests, JSON
  values, disabled queries, failure behavior, toasts and exact cache invalidation.
  Query fixtures now represent ObjectIds/Dates and typed cabin projections;
  integration request fixtures use unknown transport input rather than `any`.
- Final local gates pass: formatting/read-only lint and 1,828 tests (admin 1,226,
  customer 540, database 59, email 3), both app types and strict affected-test
  types, expanded HTTP and clean frozen installation/all workspace builds. The
  122 route/schema/hook checks and three modal interactions pass after migration.
- Admin booking/customer/reporting DTOs and the cabin availability query remain
  separate work. This slice does not mark the broader Phase 1–2 checkpoint done.

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

## Phase 2 slice 12: named guest reservation operations (F02)

- `createDiningReservation` / `createExperienceReservation` take named listing ID,
  Clerk customer ID and selection inputs. `updateDiningReservation` /
  `updateExperienceReservation` require a tagged `update` or `cancel` operation;
  cancellation cannot include an updates object.
- Migrate the four customer route files, both route adapters' internal operation
  switches, shared capacity tests and admin reservation integration callers.
  HTTP payloads, Zod allowlists/defaults, status codes, errors, populated JSON and
  success messages are unchanged. DELETE still ignores its request body.
- Preserve both ownership lookups, terminal/paid/receipt/checkout/refund guards,
  saved selections, price calculation and receipt state. Capacity check/write
  stays inside the same transaction with the catalog `reservationVersion` write
  and session propagation. Dining retains date/seating capacity; experience
  retains daily capacity with descriptive time slots.
- Before runtime edits: 22 route and 13 replica-set operation/capacity tests pass,
  along with database/customer type checks and expanded `pnpm test:http`.
  The eight new domain cases cover owner/missing denial, unpaid repricing,
  cancellation, protected states, receipt preservation and no-write rollback.
  Existing competing create/move/capacity-reduction tests remain in place.
- HTTP adds real guest POST/PATCH/DELETE flows for both resources, including
  server identity, trusted price/status, foreign/missing 404s, preserved fields,
  rejected repeated cancellation and catalog rollback, without provider calls.
  Hosted login and live Stripe/Resend operations are not exercised.
- After migration: 47 database tests, 22 customer route tests and 11 admin
  reservation integration tests pass. Both app checks, database build, the
  migrated admin test type check and compile-only contradictory-input checks
  pass. `pnpm ci:check` passes formatting/read-only lint and 1,578 tests (admin
  1,065/customer 463/database 47/email 3); expanded `pnpm test:http` also passes.
- Clean frozen installation and all builds pass in an isolated credential-free
  copy using CI's public Clerk key; ten runtime/test files match the build input.
  Initial full-gate attempts hit `/tmp` inode exhaustion; removing this task's
  obsolete disposable build copies resolved it. Successful checks above ran
  afterward. Existing optional Sharp, absent-MongoDB and dynamic-render build
  diagnostics remain non-blocking. Remote delivery gates follow.
- No schema, storage, rounding, UI or cache invalidation changes. Remaining
  response DTOs and JSON/date validation are separate boundary slices; admin
  catalog/status and private count helpers remain F07. This is focused protection
  for the changed shared helpers, not #136's broad dining coverage program.

## Phase 2 slice 13: typed cancellation-field guards (V01)

- Admin `PUT /api/bookings` and `PATCH /api/bookings/[id]` inspect typed literal
  keys on their parsed Zod output, replacing both `Record<string, unknown>` casts.
  The compiler now checks every field without erasing the input contract.
- Preserve field order and presence checks (`!== undefined`, including empty
  reasons and zero refunds), effective booking status and exact denial text.
  PUT retains its five-field guard; PATCH retains its existing four-field guard
  and separate handling of `cancelledAt`. No validation/accounting rule changes.
- Before runtime edits: eight new real-MongoDB cases and 69 existing booking
  PUT/PATCH integration cases pass. New cases assert ordered denial messages,
  unchanged booking/audit snapshots and permitted cancelled-record metadata
  updates with unchanged receipts. The new test also passes a separate type
  check because admin's normal TypeScript configuration excludes tests.
- After the typed-key change: `pnpm ci:check` passes formatting/read-only lint
  and 1,586 tests (admin 1,073/customer 463/database 47/email 3). Admin/new-test
  type checks, isolated HTTP, clean frozen installation and all builds pass.
  All three runtime/test files match validated build inputs. Existing optional
  Sharp, absent-MongoDB and dynamic-render diagnostics remain non-blocking.
- Tests construct actual Mongoose documents with explicit fixture fields. The
  shared `__tests__/setup/factories.ts` could not load its installed Faker ESM
  dependency in this integration project; runner/dependency changes remain
  separate O01 fixture debt. No application behavior was implicated.

## Phase 2 slice 14: named catalog operations (F07 partial)

- `updateCapacityCatalog` and `deleteCapacityCatalog` take named resource kind
  and listing ID inputs. Updates use a discriminated resource kind and explicit
  editable model fields, replacing `Record<string, unknown>`. IDs, timestamps
  and contention versions are excluded from editable fields.
- Migrate all six admin PUT/DELETE callers and their assertions. Private
  `withCatalog` identity and `validateCount` bounds also use named inputs;
  guest/staff callers retain their existing transaction and guard ordering.
- Preserve parsed Zod allowlists, path-ID precedence, partial-update omissions,
  response envelopes/status/messages and hydrated helper return values. Capacity
  remains per dining seating and per experience day. The same catalog version
  write, transaction session, history guard and rollback behavior remain intact.
- Before runtime edits: 17 replica-set catalog/capacity cases and 69 affected
  admin API/integration cases pass, along with the database type check and
  expanded isolated HTTP gate. Twelve new domain cases protect unused deletion,
  cancelled historical references, capacity/party/time conflicts, unchanged
  reservation prices, omitted fields and concurrent creation/deletion.
- HTTP now covers all six admin catalog write endpoints: front-desk denial,
  allowed partial updates, ignored body IDs on detail routes, stripped server
  fields, unchanged reservation prices, capacity rollback, cancelled-history
  deletion denial and successful unused deletion. Provider counts stay unchanged.
- After migration: all 59 database tests and 69 affected admin tests pass;
  database/both app type checks and compile-only invalid-input checks pass.
  `pnpm ci:check` passes formatting/read-only lint and 1,598 tests (admin
  1,073/customer 463/database 59/email 3). Expanded `pnpm test:http`, clean frozen
  installation and all builds pass using CI's public Clerk key with no app or
  provider credentials. Final runtime/test files match the validated copy.
  Existing module-type, absent-MongoDB and dynamic-render build diagnostics are
  non-blocking. Hosted login and live provider operations were not exercised.
- Staff status inputs remain F07; catalog/model response DTOs remain Phase 1.
  No schema, storage, money, UI or cache contract changes. This is focused
  protection for changed catalog helpers, not #136's broad coverage program.

## Phase 2 slice 15: named staff status operations (F07)

- `transitionCapacityReservation` takes named kind, reservation ID and requested
  expected/next statuses. `reservationDetails` and `changeReservationStatus`
  also take named inputs; migrate both admin GET/PATCH wrappers and every shared
  operation test caller.
- Parse unknown request bodies through `lib/validations/reservation-status.ts`.
  Keep the exact malformed-JSON and strict-field 400 responses. A refinement
  rejects an own `__proto__` key because installed Zod otherwise drops it even
  for strict objects; the old route rejected it. Operator/dotted/extra keys,
  missing fields and non-string values remain rejected before database access.
- Requested status strings stay untrimmed and are compared/validated inside the
  existing transaction. Early enum parsing would change the characterized
  invalid-ID/missing 404 and stale-state 409 precedence. Preserve same-status
  no-ops, lifecycle rules, paid/receipt/checkout/refund guards, the catalog version
  write, transactional retries, saved selections/receipts and audit attribution.
- Unexpected server errors are logged through the existing logger and retain the
  safe 500 envelopes. Audit recording keeps its existing non-transactional policy;
  this slice does not change failure recovery or claim atomic audit persistence.
- Before runtime edits: 14 new integration cases plus 11 existing reservation
  operation cases pass, with the new/migrated tests separately type-checked.
  Coverage includes auth before body/ID handling, strict fields, response order,
  allowed changes, no-op retries, protected transactions, competing status writes,
  detail fields, safe failures and unchanged reservation/catalog/audit snapshots.
- Expanded real HTTP covers both admin detail/PATCH paths, front-desk access,
  denied assignment/payloads, stale-state rollback, preserved JSON/prices/receipts,
  exact actor/role/organization audit fields and no duplicate audit on a no-op.
  It passes before runtime changes and makes no live provider calls.
- After migration: the same 25 integration cases and their separate type check
  pass; both app checks and database build pass. `pnpm ci:check` passes formatting,
  read-only lint and 1,612 tests (admin 1,087/customer 463/database 59/email 3).
  Expanded HTTP, clean frozen installation and all builds pass in an isolated
  copy using CI's public Clerk key without app/provider credentials. Final
  runtime/test files match the build snapshot. Existing optional Sharp,
  module-type, absent-MongoDB and dynamic-render diagnostics are non-blocking.
- Reservation response DTOs/native statuses remain a Phase 1 boundary slice:
  `ReservationDetail.tsx` still uses string statuses and date-bearing shared payment
  state; `models/DiningReservation.ts` omits schema-supported `seated` from its
  interface union. Those representations need their own compatibility coverage.

## Phase 2 slice 16: typed experience queries and zero-price limits (V04)

- `GET /api/experiences` constructs a typed `FilterQuery<IExperience>` from its
  existing parsed query schema, replacing the query `any`. Unexpected failures
  use the shared logger and preserve the safe 500 response.
- Related bug fix: the route and `useExperiences` retain explicit zero lower or
  upper price bounds. Previously `maxPrice=0` returned paid listings because both
  layers treated zero as an absent filter. No price/storage/rounding changes.
- Preserve category/difficulty/popularity/tag semantics, unknown-query stripping,
  final repeated-query values, popular-first/price-second sorting, full hydrated
  JSON, response envelopes and validation/database failure order. The hook retains
  query keys, five-minute freshness, ten-minute retention and existing error/empty
  response behavior. The current page's unfiltered invocation is unchanged.
- Before runtime edits: 20 route/hook characterizations and customer type checks
  pass. Seven focused zero-bound regressions fail as expected. Expanded real HTTP
  passes existing filter/sort/JSON/error cases, then reproduces `maxPrice=0`
  returning all three free/paid fixtures instead of only the free one.
- After the fix: all 27 focused cases and customer type checks pass.
  `pnpm ci:check` passes formatting/read-only lint and 1,639 tests (admin
  1,087/customer 490/database 59/email 3). Expanded HTTP now passes, including
  free-only zero upper bounds, unchanged catalog snapshots and no provider calls.
  Clean frozen installation and all builds pass with CI's public Clerk key and
  no app/provider credentials; all five final runtime/test files match the build
  inputs. Existing optional Sharp, module-type, absent-MongoDB and dynamic-render
  diagnostics remain non-blocking. Hosted login/live delivery were not exercised.
- Catalog response DTOs and other resources' filters remain separate slices.
  No new filter controls, features, provider operations or schema migrations.

## Phase 2 slice 17: typed dining queries and zero-price limits (V05)

- `GET /api/dining` constructs `FilterQuery<IDining>` from the existing parsed
  schema, replacing the query `any`. Unexpected failures use the shared logger;
  the safe 500 response retains its existing `message` field.
- Related bug fix: retain explicit zero lower/upper price bounds in the route and
  `useDining`. Previously `maxPrice=0` returned paid listings because both layers
  treated zero as absent. This changes no prices, storage or rounding rules.
- Preserve available-only visibility, type/meal/category/popularity/dietary
  filters, raw CSV spacing, case-insensitive regex search across the same three
  fields, duplicate-query handling, unknown-query stripping and meal/type/name
  sorting. Full hydrated JSON, error order and envelopes stay intact. The hook
  retains its query keys, five-minute freshness and ten-minute retention; the
  current page's filter/search controls are unchanged.
- Before runtime edits: 21 route/hook characterizations and customer type checks
  pass; seven zero-price regressions fail as expected. Expanded real HTTP passes
  availability/filter/search/sort/JSON/error cases before reproducing `maxPrice=0`
  returning three available free/paid fixtures instead of only the free one.
- After the fix: all 28 focused cases and customer type checks pass.
  `pnpm ci:check` passes formatting/read-only lint and 1,667 tests (admin
  1,087/customer 518/database 59/email 3). Expanded HTTP passes, including free-only
  zero upper bounds, unavailable-item exclusion, unchanged catalog snapshots and
  no provider calls. Clean frozen installation and all builds pass with CI's public
  Clerk key without app/provider credentials. Existing optional Sharp, module-type,
  absent-MongoDB and dynamic-render diagnostics remain non-blocking. Hosted login
  and live delivery were not exercised.
- Dining response DTOs and remaining page/select/sort type escapes need their own
  compatibility slices. This focused changed-path coverage does not implement the
  excluded #136 broad dining test program or add new filters/features.

## Phase 2 slice 18: customer welcome-email failure boundary (V03)

- Keep authentication, current-user lookup and lazy email dispatch inside one
  `unknown` error boundary. Use the shared server logger for provider rejection
  and unexpected failures, matching the migrated confirmation routes.
- Intentional fix: failures return 500 JSON with the safe string
  `Failed to send welcome email`. Previously provider objects/serialized exceptions
  were exposed and Clerk auth/profile exceptions escaped the handler. Missing auth
  remains 401 before profile/provider work; missing/invalid first email remains 400.
- Preserve first-email selection rather than primary-email selection, the Guest
  name fallback, notification sender/default/override, subject, rendered template,
  message-ID success body and successful retry. The existing hook still posts
  without recipient input and raises the same generic client error on failure.
- Before runtime edits, 14 route/hook characterizations and customer type checks
  pass. All eight focused failure regressions fail as expected; real HTTP exposes
  the provider error object instead of the intended safe string. Jest uses the
  established React static renderer; actual Resend SDK rendering remains in HTTP.
- After the fix, all 31 welcome/sender checks and customer type checks pass.
  `pnpm ci:check` passes formatting/read-only lint and 1,689 tests (admin
  1,087/customer 540/database 59/email 3). Expanded HTTP passes safe provider and
  real Clerk SDK profile failures, authenticated recipient/name selection, actual
  rendered greeting, no-send denial and unchanged receipt snapshots. Clean frozen
  installation and all builds pass using CI's public Clerk key without app/provider
  credentials. Existing optional Sharp, module-type, absent-MongoDB and dynamic-render
  diagnostics remain non-blocking. Hosted login/live delivery were not exercised.
- Provider-origin review found no application links in the existing email
  templates; customer checkout URLs use `lib/url.ts`, with intentional configured
  and request-origin fallbacks. Reservation checkout origin assertions, admin
  welcome/confirmation payload/error boundaries and internal email-result errors
  remain separate work. No new emails, recipients, triggers or live operations.

## Phase 2 slice 19: admin welcome-email payload/error boundary (V03)

- Parse unknown request JSON with `lib/validations/welcome-email.ts`. The successful
  schema output contains string recipient/name fields; normalize legacy omitted or
  null names to an empty greeting. Preserve recipient case, unknown-field stripping,
  existing email validation and invalid-email precedence when both fields fail.
- `useSendWelcomeEmail` takes named schema-derived inputs instead of adjacent
  strings. All callers are migrated; dedicated checked hook fixtures replace the
  superseded welcome tests. The raw success result remains `unknown` until consumed.
- Intentional fixes: malformed/invalid bodies and non-string recipient/name values
  return safe 400 JSON before dispatch; unexpected helper/configuration/provider
  failures return safe string-error 500 rather than exposing exceptions/provider
  objects or escaping the handler. Log unexpected failures with the shared logger.
- Preserve administrator-only `requireApiAuth()` and auth → rate limit → payload
  order. Keep the per-user welcome key, five-request/minute limit, 429 body/retry
  headers, notification sender/override, subject/template, message ID and retry.
- Before edits: 15 route characterizations, all 11 existing/new email-hook checks
  and changed-test types pass. All 17 focused regressions fail as expected. Real
  HTTP first confirms manager/front-desk denial, then reproduces an empty body
  escaping as 500 instead of safe 400 JSON.
- After edits, all 40 affected route/hook checks, admin types and an explicit
  type check of all three changed test files pass. `pnpm ci:check` passes
  formatting/read-only lint and 1,722 tests (admin 1,120/customer 540/database
  59/email 3). Expanded HTTP passes exact role restrictions, invalid payloads,
  safe provider failure/retry, rendered greeting, the retained five-request limit
  and unchanged booking snapshots. Clean frozen installation and all builds pass
  with CI's public Clerk key and no app/provider credentials. Existing optional
  Sharp, module-type, absent-MongoDB and dynamic-render diagnostics remain
  non-blocking. Hosted login and live delivery were not exercised.
- Admin confirmation DTO/payload/error work, rate-limit key inputs (F08), internal
  email result errors and reservation checkout origin checks remain separate slices.
  No new emails, recipients, triggers or live provider operations.

## Phase 2 slice 20: named rate-limit key inputs (F08)

- `createRateLimitKey` takes named `userId`/`endpoint` fields at all three runtime
  callers: admin welcome, booking confirmation and customer creation. Undefined
  or empty legacy user IDs retain the existing anonymous namespace; generated
  strings, Redis/local-limit behavior, quotas and HTTP retry headers are unchanged.
- Before runtime edits, 50 rate-limit/welcome checks and affected-test types pass.
  Added cases protect empty-user fallback and generated-key isolation across users
  and endpoints. Expanded HTTP confirms that customer creation retains its separate
  ten-request limit after email requests exhaust their own allowance, with no Clerk
  mutation attempts or email/payment calls. Customer data lives in Clerk, not a
  MongoDB customer collection; the assertion observes that actual write boundary.
- After migration, the same 50 focused checks, admin types and affected-test
  types pass. `pnpm ci:check` passes formatting/read-only lint and 1,724 tests
  (admin 1,122/customer 540/database 59/email 3). Expanded HTTP and clean frozen
  installation/builds pass with CI's public Clerk key and no app/provider secrets.
  Existing optional Sharp, module-type, absent-MongoDB and dynamic-render diagnostics
  remain non-blocking. No rate policy or authorization behavior intentionally changes;
  hosted login/live provider operations were not exercised.
- Preserve the full tracker body through #182 in `delivery-history.md`, including
  its recorded CI/deployment identifiers and limitations. The archive is byte-for-byte
  equal to the captured body beneath its explanatory header, and local links resolve.
  PR #183 merged the archive at `5f1d1b7562e22fab0fe7d97a91574386a9226a24`.
  Before tracker compaction, its fresh body was verified equal to the archived
  snapshot; the tracker can link that history without losing delivery evidence.
- Delivery is complete: reviewed `dedad1cb72b3a4d7aedb7b5b01466ebec03412a2`;
  [PR CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36871366008)
  and [main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36872529404)
  passed all five jobs. Both previews were Ready at the reviewed SHA. Production
  customer `dpl_RMMuLZTDta585HYaSnUPuTMxBCLu` and admin
  `dpl_7jVm4jUWBWR1EiVrWe67FVxYTtxw` were verified Ready at the merge SHA,
  with matching configured roots, built routes and production aliases.
- Work stopped here at the user's request. The 2026-10-02 resume implements
  V06 in the following slice.

## Phase 2 slice 21: explicit admin authorization result (V06)

- `ApiAuthResult` now requires `userId` and `StaffRole` on success, or a typed
  error response on denial. Existing route/audit guards narrow the result;
  staff-access, payment attribution and dashboard redirects no longer need
  auth-field assertions or optional error access. Runtime authorization is
  unchanged, including the default administrator-only policy.
- Characterization covers every role/permission pair, omitted options, exact
  denial envelopes, active-organization normalization, Clerk/lookup errors,
  local-only bypass and production rejection. Real-Mongo audit tests preserve
  attribution for all roles, missing-organization/denial no-ops, redaction and
  logged audit failure without rolling back successful writes.
- Migrated incomplete auth fixtures to checked success/denial objects. Replaced
  the responsibility's double-cast Clerk mocks with narrow dependency shapes and
  removed unused `__tests__/setup/auth-helpers.ts`. Two legacy constructor mocks
  and unused bindings were corrected so all touched test files can be checked
  using the unchanged strict compiler settings.
- Before changing the contract, 232 checks passed across 11 focused suites.
  App and affected-test type checks are separate from Jest, whose node projects
  disable diagnostics. The existing HTTP gate protects real SDK authorization,
  permission denials and audit writes using disposable services; it does not
  prove hosted login or live provider delivery.
- Local validation passed: `pnpm ci:check` (formatting, read-only lint and 1,770
  tests: admin 1,168/customer 540/database 59/email 3), both app type checks and
  all nine touched test-file type checks, `pnpm test:http`, and clean frozen
  installation/all builds with CI's throwaway public Clerk key. Existing
  module-type, absent-MongoDB and dynamic-render build diagnostics remain
  non-blocking. Runtime/test/config inputs match the validated clean copy.
- Remaining debt stays in the existing inventory: other API/DTO boundaries,
  validation and money work are open. Audit snapshot casts, bulk-cabin request
  validation/population and unrelated error helpers are not rewritten here.

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
- Delivered in PR #174 at `911fcae`: all five PR/main CI jobs and exact-SHA
  previews/production deployments pass, including HTTP and builds. F02 follows
  in Phase 2 slice 12.

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

## Phase 1–2: admin cabin availability boundary (T12 / V08)

- Validate cabin/excluded booking IDs and the effective date range before database
  access. Preserve the first query value, empty-value six-month defaults, timestamp
  parsing, UTC date-only output, exclusion-error precedence, strict overlap rules,
  all non-cancelled statuses and the absence of a cabin-existence lookup.
- Replace the double-cast date projection with a typed lean result and typed
  Mongoose filter. Keep `bookings:read` authorization before query validation.
- Intentional fixes: invalid cabin IDs/dates and non-increasing ranges return safe
  400 errors; unexpected reads retain the existing 500 envelope and are logged.
  The booking calendar validates unknown response JSON and surfaces HTTP/malformed
  response errors before date rendering. Remove its unnecessary date-picker cast.
- Before runtime changes, 13 route and five calendar characterizations passed;
  six route and three calendar regressions failed. Afterward all 27 pass, along
  with admin application and both changed-test strict type checks.
- Workspace formatting, read-only lint and all 1,855 tests pass (admin 1,253,
  customer 540, database 59, email 3). Expanded isolated HTTP passes admin date JSON,
  exclusion, invalid-input no-write denial and existing authorization/accounting
  checks. This does not exercise hosted login or live provider delivery.
- Clean frozen installation passes with Node 22 and pnpm 11.17.0. Both credential-free
  production app builds and shared package builds pass. The broader Phase 1–2 checkpoint
  remains open; no Phase 3 implementation is included.

## Phase 1 slice 13: dining catalog JSON (T13)

- Both apps' catalog/detail responses and admin create/update responses use an
  explicit serializer with string ObjectIds and ISO timestamps. Existing hooks,
  cards and forms consume the shared data-only type, without live database dates.
  Normalize the modal's absent selection at its caller.
- Preserve hydrated list/admin defaults versus lean customer-detail omissions,
  nested beverage IDs, sparse timestamps, existing legacy nulls, version fields,
  and the creation-only selected `reservationVersion`. Keep response envelopes,
  filter/sort behavior, permissions, catalog transaction writes and cache keys.
  Narrow the updater's union at each dining response boundary; domain code is
  unchanged. Route fixtures now supply checked ObjectIds/Dates and a narrow save
  dependency rather than JSON-shaped persistence or constructor casts.
- Before runtime edits, seven new full-JSON characterizations and ten existing
  integration cases pass. After edits, all 17 pass, along with 38 mocked route/hook
  cases, 28 customer query/hook cases, and 61 database tests. Serializer tests
  compare against actual hydrated/lean JSON, including sparse legacy rows, and
  verify that copied arrays/nested objects do not mutate source data.
- Both application types and strict checks of the two changed admin tests pass.
  `pnpm ci:check` passes formatting, lint and 1,864 tests (admin 1,260/customer 540/
  database 61/email 3). Both production apps and shared packages build with the
  throwaway public Clerk key and no provider/application credentials.
- HTTP adds complete JSON comparisons for both list/detail flows and catalog
  updates. The first run passed these reads then exposed an existing redirect
  assertion that did not explicitly request HTML navigation. Clerk's installed
  protection code distinguishes page redirects from API not-found responses;
  the fixture now explicitly requests JSON and accepts only the known sign-in
  redirect or a 404 bearing Clerk's `protect-rewrite` marker. Unit probes reject
  unrelated 404s, successes, server errors and unexpected redirects. The expanded
  HTTP gate passes, including all existing reservation/accounting checks.
- Remaining dining work: request/detail error boundaries, reservation DTOs and
  the unused filter/sort handlers in `apps/customer/app/dining/page.tsx`. No UI
  controls, permissions, capacity behavior or live provider operations are added.

## Phase 1 slice 14: experience catalog JSON (T14)

- Both apps' catalog/detail routes and admin create/update responses use the shared
  explicit experience serializer. Both apps' hooks, pages, forms and modal consume
  string IDs/dates. Read sources distinguish lean omitted defaults from hydrated
  defaults; dining's sparse minimum-party field receives the same accurate typing.
- Preserve every existing schema field, timestamps/version, creation-only selected
  reservationVersion, nullable legacy values, response envelopes and transaction
  behavior. Normalize absent modal selection at the caller. No filters or controls
  are added. Model schemas, capacity operations and storage remain unchanged.
- Before runtime edits, six new full-JSON cases and ten existing integrations pass.
  Afterward, 52 admin and 31 customer focused cases pass, including four page cases.
  Two sparse experience page cases failed before rendering fallbacks were added;
  missing includes/availability arrays now render without crashing. This intentional
  bug fix leaves the wire's omitted fields intact. Populated pages remain covered.
- Application and changed-test type checks pass. `pnpm ci:check` passes formatting,
  read-only lint and 1,876 tests (admin 1,266/customer 544/database 63/email 3).
  Expanded isolated HTTP passes exact catalog JSON and existing protected flows.
  Both production apps and shared packages build with the throwaway public Clerk
  key and no application/provider credentials. Hosted login/live delivery untested.
- Remaining work includes catalog request/error boundaries, reservation DTOs and
  the pre-existing unused filter/sort handlers. The broader Phase 1–2 review
  checkpoint remains open; Phase 3 is untouched.


## Phase 1 slice 15: admin booking JSON and customer booking primitives

- Moved the characterized customer booking DTOs/serializers to the shared
  `booking-json` export, retaining app compatibility re-exports. Admin list,
  detail, create/update and status responses now use explicit serialized fields
  and typed nullable cabin populations. List projections and minimal missing-user
  fallback remain distinct from full detail and its null customer.
- Preserved receipt values/dates, financial flags, virtuals, legacy omissions,
  string identifiers and complete response envelopes. The booking form, detail,
  table, print and email consumers use JSON types rather than Mongoose methods.
  Missing cabin/customer/extras now render safely in print and form consumers;
  these corrections have failing-before regressions. Date formatting uses named
  inputs at every caller with unchanged output.
- Validation: seven real-Mongo response/authorization characterizations; existing
  route/mutation/hooks; print and missing-reference component regressions; all
  date-formatting tests; both app and touched-test type checks. Full checks pass
  1,887 tests (admin 1,277/customer 544/database 63/email 3). Both production
  builds and isolated HTTP pass, including exact admin list/detail JSON and
  no-write checks. A new HTTP snapshot helper initially had the wrong scope;
  it was corrected and the complete gate rerun successfully.
- Local changes only. Customer records, Settings, staff/audit,
  reservations/calendar/reporting and remaining validation remain separate work.


## Phase 1-2 slice 16: Settings JSON, request boundary and named range inputs

- Both Settings APIs now serialize an explicit shared Settings JSON shape.
  Database identifiers/dates are converted at the route boundary; nested
  minimization, null contact information, timestamps and fullAddress remain
  compatible. Hooks and booking/settings forms consume data fields without
  document methods. Payment and price components use narrow optional props.
- Booking-length comparisons use named inputs. Payload-only rules remain in the
  schema; effective min/max checks still use stored Settings. Metadata stripping
  accepts unknown input without turning arrays into update objects. Invalid
  JSON and invalid payloads now return 400 before database access; this is an
  intentional correction, protected by seven failing-before regressions.
  Unexpected errors use the server logger and safe messages.
- Characterization: 15 existing/new integration checks passed before and after
  serialization. Focused route/schema/hook checks pass (58 tests), both app and
  touched-test type checks pass. Full checks pass 1,905 tests (admin 1,293,
  customer 544, database 65, email 3); both isolated production builds and HTTP
  pass. HTTP compares complete admin/customer JSON and checks rejected fields,
  cross-field failures, denied writes, persisted values and audit attribution.
- Default creation/reset behavior is unchanged and exercised only in disposable
  databases. No live Settings operation or external delivery was performed.


## Phase 1-2 slice 17: customer JSON and validated provider operations

- Customer list/detail/create/update responses use explicit JSON dates and typed
  aggregates; recent history preserves complete booking fields and nullable cabin
  projections. UI and hooks no longer claim server-side Date objects. Clerk
  lookups retain a distinct server Customer type and a narrow SDK read source;
  converter fixtures no longer cast incomplete objects to SDK users.
- Create/update schemas now accept the guest form's existing emergency-contact
  and preference fields, alongside previously supported legacy fields. Previously
  dropped form values are preserved. Strict payloads reject unknown/server-owned
  fields, dotted paths, operators and malformed values before provider mutation.
  Omitted metadata is unchanged; explicit null clears whole or nested keys through
  named internal change operations and Clerk's existing merge endpoint. Ignored
  legacy form identity/email/phone/password fields remain ignored on update.
- Provider errors use typed not-found/conflict/failure states and safe route
  messages. Duplicate detection uses Clerk's documented `form_identifier_exists`
  code; lock/unlock no longer match exception text. Unexpected failures are logged.
  Search pagination uses named inputs. Cache invalidation remains after successful
  mutations, and create/public/private metadata placement is preserved.
- Twelve JSON/auth/statistics characterizations passed before DTO changes.
  Thirteen request/metadata/error regressions failed before the fixes; focused
  route/schema/provider/cache/hook coverage now passes (166 tests before the final
  fixture cleanup). Strict app and touched-test types pass. Full checks pass 1,957
  tests (including the next reporting characterization), isolated HTTP and both
  credential-free builds pass. The HTTP Clerk fixture now correctly implements
  the installed SDK's separate user-list and count requests; customer reads and
  rejected update/no-provider-side-effect assertions pass.
- This is local validation with controlled providers. It does not exercise hosted
  login or live Clerk user mutation. Existing nontransactional create-then-metadata
  behavior is preserved; no compensating deletion workflow was added.


## Phase 1-2 slice 18: reporting JSON and typed queries

- Dashboard, booking analytics and sales aggregates now declare their actual
  result shapes. Removed the dashboard population double cast and array-result
  assertions. Shared reporting DTOs use string IDs/dates and shared status unions;
  hooks and charts consume these types without importing route runtime code.
- Preserved paid-only revenue, cancellation/occupancy scope, historical popular
  cabin totals, aggregation bucket definitions, zero-filled windows, rounding and
  the bare sales-array response. Analytics validates periods before database
  access. Unexpected failures retain safe envelopes and now use the server logger.
  An analytics error envelope now rejects instead of entering the cache as report
  data; bare legacy data remains supported.
- Twelve real-Mongo characterizations pass before/after. Four API regressions and
  one hook regression failed before correction; all pass now. Typed analytics
  fixtures replace query mock `any`. Full checks pass 1,963 tests (admin 1,351,
  customer 544, database 65, email 3), strict app/touched-test types pass, expanded
  HTTP verifies report dates/windows/envelopes and no writes, and both isolated
  production builds pass. No report calculation or accounting definition changed.

## Phase 1-2 slice 19: staff access and audit history

- Staff member and audit event JSON now have explicit transport types; the
  serializer preserves sparse Clerk profiles, nullable roles, IDs, ISO dates,
  version metadata and opaque redacted snapshots. Both admin pages consume these
  types without persistence methods.
- Staff requests parse into assign/revoke operations before provider/database
  access. Malformed JSON, null and unknown/server-owned fields now return 400.
  The actor revision write, transaction retries, self-change denial, current
  membership checks and audit attribution remain intact. Audit query schemas
  retain pagination, filter/date error messages and inclusive date endpoints.
- Unexpected failures retain safe 503 responses and now log the underlying error.
  Six failing-before regressions pass, alongside 28 characterization/access/audit
  checks. App and strict touched-test types, formatting/lint, all 1,979 tests
  (1,367 admin, 544 customer, 65 database, 3 email), expanded isolated HTTP and
  credential-free builds pass. Evidence: `/tmp/lodgeflow-staff-audit-*`.
- Local implementation only; no PR, CI or deployment is asserted. Reservations
  and calendars remain the next Phase 1-2 boundary.

## Phase 1-2 slice 20: reservation inbox and calendars

- Typed aggregate/projection sources and explicit JSON serializers now cover the
  unified inbox and all three calendars. Shared UI types include string IDs,
  ISO timestamps, nullable end dates/times, the existing `seated` dining status,
  removed-listing/guest fallbacks and omitted uncapped capacity. The native status
  and lifecycle filter behavior are preserved; no new transition is added.
- Named date-window inputs replace calendar positionals. Zod schemas preserve
  pagination/filter errors, strict inbox date endpoints, UTC midnight calendar
  normalization and the 180-day cap. Routes map typed query failures and log
  unexpected errors with safe existing 500 messages.
- Nineteen before-refactor characterizations pass; two failing-before logging
  regressions now pass. The expanded focused set has 29 checks. Full validation
  evidence is recorded in the local handoff; detail/receipt DTOs remain separate.

## Phase 1-2 slice 21: capacity reservation JSON and callers

- Dining/experience reservation schemas remain unchanged; persistence interfaces
  now use ObjectIds and shared native status unions, including existing `seated`.
  Shared JSON types/serializers cover all guest create/read/history/update/cancel
  responses and staff detail/status/receipt responses. IDs, dates, receipt arrays,
  checkout/refund state, virtual IDs, sparse lean fields and null populations are
  characterized through MongoDB and real local HTTP.
- Customer hooks distinguish projected history from full details. Both apps use
  string payment timestamps and plain response types. Two previously crashing
  deleted-listing confirmation views retain reservation and checkout details with
  an explicit missing-listing label; history transforms no longer use `any`.
- Narrow Stripe model dependencies retain the same queries and writes. The
  settlement update uses the already validated checkout reference. Test fixtures
  assert query existence and use checked sources; concurrency/accounting checks
  remain passing. Request hardening is the following slice.
- Validation: full format/lint, 2,002 tests, app/shared/strict touched-test types,
  exact before/after expanded HTTP and credential-free builds pass. Local evidence
  `/tmp/lodgeflow-reservation-json-*`; no CI/deployment has been asserted.

## Phase 1-2 slice 22: reservation requests and safe failures

- Guest create/update schemas now reject unknown, operator, dotted, prototype and
  server-owned fields; transport dates are strings and parsed domain dates remain
  Dates. Creation IDs, detail/mutation IDs and collection/history status filters
  validate before connection. Invalid reads preserve each missing-resource error;
  malformed JSON now returns 400. Cancellation still ignores its request body.
- Forms send ISO date strings; request aliases derive from the schemas. Obsolete
  guest payment/status PATCH schemas were removed. Server identity, receipt/capacity
  rules and successful envelopes remain unchanged. These are intentional rejected-
  input behavior changes, separate from the preceding DTO migration.
- Staff receipt validation lives in `lib/validations`; receipt/status handlers
  distinguish malformed JSON from unexpected stream failures. Unexpected errors
  log safely. Staff/receipt strict objects also reject explicit prototype keys.
- Thirty-three failing-before regressions cover JSON, IDs/statuses, forbidden
  fields, prototype keys and diagnostics. The expanded focused customer set has
  74 checks. Full format/lint, 2,053 tests (1,390 admin, 594 customer, 66 database,
  3 email), app/touched-test types, HTTP rejection/no-write cases and all builds
  pass. Evidence `/tmp/lodgeflow-reservation-boundary-*`; local implementation.

## Local Phase 1–2 slices 23–29: remaining boundaries and inventory closure

These changes follow the local slices above and have no new delivery/production
claim. Existing behavior is characterized before each refactor; intentional fixes
are listed separately from type-only changes.

### Slice 23: catalog requests

- All six admin catalog route families parse JSON and writable fields before
  database work. Path IDs retain authority; invalid IDs, non-object JSON,
  malformed JSON, prototype/operator/dotted keys and server metadata are rejected.
- Dining payload-only minimum/maximum rules live in Zod. Partial updates that need
  stored values retain the existing capacity transaction and rollback behavior.
- Hooks project full editor DTOs to explicit editable fields; cache keys and
  invalidation remain unchanged. Public invalid detail IDs return the same 404
  as missing resources. Unexpected failures use the server logger.
- Before/after regressions cover catalog validation, safe prototype-key error
  formatting, no writes on denial and editor metadata removal. Focused catalog
  and hook checks pass; full gates are also included in later slice totals.

### Slice 24: cabin booking requests

- Both apps use strict request fields, string transport dates, validated IDs and
  guarded object parsing. Admin forms send choices instead of ignored derived
  prices/payment flags. Customer cancellation retains its optional empty-body
  behavior while rejecting malformed nonempty JSON.
- Authorized staff PATCH receipt/payment metadata remains supported. Payload-only
  contradictory refunds are rejected by the schema; authorization precedence,
  locks, overlap checks, pricing and receipt-dependent rules remain server-side.
- Removed error-text overlap guessing; unexpected PATCH errors return a safe
  message. Invalid customer booking IDs return 404 before database access.
- New regressions fail before the fixes, including forged pricing/flags,
  contradictory refunds and malformed bodies. Full checks pass 2,132 tests, both
  app types and production builds; the next HTTP run verifies the corrected 404.

### Slice 25: confirmation emails

- Admin confirmation validates a narrow read-only projection of the legacy full
  booking/cabin payload; the template and hook receive only their real fields.
  Existing extra DTO metadata is ignored here because this endpoint sends an
  email and does not update a document. Sender, recipient, subject, rate limit,
  permission and bare provider-success response remain unchanged.
- Dining confirmation validates IDs before reads, preserves ownership/payment
  denial and paid/free sender choice, handles missing listings, and maps provider
  and authentication failures safely. No new notifications or triggers are added.
- Fifteen failing-before cases pass after the changes. Full checks pass 2,159
  tests, app/touched-test types, isolated HTTP and credential-free builds.

### Slice 26: provider metadata, statistics and public availability

- Clerk metadata is validated field by field. Supported partial legacy profiles
  survive the cache; malformed fields are omitted without dropping other valid
  fields. Cached recent-booking dates are JSON strings.
- Four statistics aggregates and their hooks have explicit result types; empty
  values, nullable averages, rounding, permission checks and envelopes remain.
- Dining/experience availability parses IDs and day/range queries before reads,
  retaining date precedence, local boundaries, the 180-day cap, capacity grouping
  and unlimited capacity as JSON null. Named inputs replace availability/time
  positionals; an unused experience availability hook is removed.
- The dining form now treats null remaining capacity as unlimited instead of
  coercing it to zero. A component regression reproduces the previous disabled
  reservation form. Full checks pass 2,195 tests, types, HTTP and builds.

### Slice 27: remaining UI and helper inputs

- Guest form changes are typed named operations with immutable nested updates.
  The previous implementation mutated the shared empty form, leaking address,
  emergency contact and preferences into a new guest. A failing-before remount
  regression and an editing/normalization characterization protect the fix.
- URL updates no longer need double casts. Booking date formatters, stay length,
  retry options and cabin filters have canonical/named inputs. Booking form
  callbacks retain the relationship between field keys and value types.
- Cabin sorting, IDs, icons, date-picker callbacks and sitemap projections are
  typed. Unrendered dining filter state and unused document aliases are removed;
  actual name ordering, grouping, links, sitemap visibility and fallbacks remain.
- Focused UI/helper checks and both app type checks pass. All modified admin test
  files also receive a strict check beyond the app tsconfig's test exclusion.

### Slice 28: safe error contracts

- Refund results are discriminated success/failure objects and refund inputs are
  named. Provider failures log internally and return `Failed to create refund`;
  currency conversions, idempotency keys and pending/completed accounting remain.
- Real Mongoose validation errors narrow with `instanceof`. Existing 400 envelopes
  retain a field map containing safe message/path feedback, excluding stored
  values, validator properties and raw database messages. Lookalike errors are
  unexpected server failures. This is an intentional disclosure fix.
- Removed unused error-text status guessing, raw-update sanitization and required-
  field helpers; schemas and explicit route error mapping are authoritative.
  `createErrorResponse` accepts safe strings rather than raw Error objects.
- Webhook/refund-estimate/sitemap failures use the shared logger. Invalid refund-
  estimate IDs return the existing missing-resource 404 before reads. Seed-route
  errors are safe and its secret/header inputs are named; verification mocks the
  seed operation and never resets demo or live data.
- Five disclosure/validation/logging regressions fail before the fixes. Existing
  signed webhook retries, durable receipts and cancellation recovery remain gated.

### Slice 29: query compatibility and current review

- Admin catalog and booking list queries use schemas to normalize existing scalar
  filters and allowlisted sorting. Unknown capacity/discount filters remain
  ignored, unmatched status/category values remain equality filters, and legacy
  sort/pagination defaults are preserved. These reads do not adopt write-schema
  restrictions. Literal search remains escaped and database filters are typed.
- Three real-Mongo characterizations pass before and after parsing migration;
  existing list, authorization, pricing, overlap and form regressions also pass.
- The refreshed candidate review records all remaining exceptions and Phase 6
  test infrastructure debt. Money units/storage/rounding, workflow state, provider
  origins and broader test infrastructure remain their original later-phase work.

Final local validation and the review checkpoint are recorded in plan.md and the
ignored progress.md handoff. No hosted login, live provider delivery, CI or new
production deployment is inferred from these local gates.


### Final local gates (2026-10-07)

- Node 22.23.2 / pnpm 11.17.0. `pnpm ci:check` passes formatting, read-only lint
  and all **2,192 tests**: admin 1,465 (93 suites), customer 658 (57 suites),
  database 66 and email 3. A new customer prop-order lint warning was corrected;
  the read-only customer lint and its three affected interaction tests pass.
- The total is three lower than slice 26: twenty tests for removed unused helpers
  were removed, and seventeen new behavior/regression cases were added. This is
  not skipped coverage; no tests are disabled to achieve the gate.
- `pnpm --filter @lodgeflow/admin exec tsc --noEmit` and the customer equivalent
  pass. A temporary config extending the unchanged strict admin tsconfig compiles
  all 47 modified/new admin test files, including their dependency graph and Jest
  DOM declarations. It does not enable blanket diagnostics for all old tests.
- `pnpm test:http` passes, including ownership denial, no-write validation,
  transaction rollback, audit attribution, real local Clerk signature checks,
  signed settlement, refund recovery and rendered email failure/retry cases.
- `pnpm install --frozen-lockfile --offline` and `pnpm build` pass in the isolated
  source copy, using CI's public Clerk key and no app secrets. Expected missing
  database/auth prerender diagnostics use existing fallbacks; no live database or
  provider is contacted. Both app and shared package builds complete.
- Evidence logs are `/tmp/lodgeflow-phase12-final-{check,http,install,build}.log`,
  the final app/test type logs and customer lint/interaction logs. Tracked tests,
  HTTP assertions and this inventory preserve the reviewable evidence if temporary
  logs are cleaned up. The final source scan is captured in inventory-current.json.
- No browser/hosted-login E2E, live provider delivery, remote CI or production
  deployment is claimed. Phase 3 is unstarted; wait for the requested review.
