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

| ID  | Source / symbol                                                                                                  | Rule or observed mismatch                                                                    | Phase    | Next action and validation                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T01 | `apps/customer/types/index.ts`: `Cabin`, `Booking`, `PopulatedBooking`                                           | Transport/UI aliases reuse document interfaces; booking dates mix strings and Dates.   | 1                                                                                                                                                               | Start with cabin booking read DTOs; test JSON dates/IDs and absent populated cabins, then migrate hooks/components/fixtures. |
| T02 | `apps/customer/app/api/bookings/[id]/route.ts`: `GET`                                                            | `ApiResponse<any>` returns a populated document without an explicit DTO contract.            | 1        | Type and serialize the owner-scoped response; assert owner/missing/foreign behavior remains intact.                                                             |
| T03 | `apps/customer/app/api/payments/create-checkout/route.ts`: cabin name extraction                                 | Double cast conceals the populated-reference shape.                                          | 1        | Narrow/serialize the populated cabin explicitly and test a missing reference without creating a checkout.                                                       |
| T04 | `apps/customer/app/api/payments/webhook/route.ts`: confirmation payload                                          | Double cast converts a populated booking to the UI/email type.                               | 1        | Define an email DTO at settlement-to-email boundary; keep signature, retry and delivery-failure regressions passing.                                            |
| T05 | `apps/admin/types/api.ts` and `apps/admin/types/index.ts`                                                        | Query/aggregation/transport types coexist; serialization contracts need per-flow separation. | 1        | Begin with booking output and its actual callers; test IDs, dates and null references. Do not rewrite every reporting query in one PR.                          |
| T06 | `packages/database/src/models/*`: nine `Document`-extending interfaces                                           | Persistence interfaces are re-exported across app boundaries.                                | 1        | Keep persistence behavior tested; add lean/populate/DTO types as each consumer migrates. Inheritance alone is not slated for deletion.                          |
| T07 | `apps/admin/__tests__/integration/api/bookings.test.ts`: fixture overrides; remaining candidate fixtures         | Fixture `any` hides missing/invalid fields.                                                  | 1        | Replace with checked input/DTO builders or real documents according to each test's responsibility; preserve behavioral assertions.                              |
| T08 | `apps/admin/components/BookingForm/PaymentInformation.tsx`, `PriceBreakdown.tsx`; cabin/dining/experience modals | Props permit both omitted and null absence.                                                  | 1        | Choose one internal absence representation per component, adapting callers without changing PATCH semantics.                                                    |
| T09 | `apps/admin/lib/clerk-users.ts`: `reviveCustomerDates`                                                           | Cache boundary uses assertions to reconstruct dates.                                         | 1        | Validate cached payloads and normalize dates once; retain deleted-user negative cache and transient-failure semantics.                                          |
| F01 | `packages/database/src/booking-payments.ts`: `paymentSummary`                                                    | Adjacent major-unit numeric positionals can be reversed.                                     | 2        | Named options object, migrate both apps/model hooks, retain accounting regression results.                                                                      |
| F02 | `packages/database/src/reservation-capacity.ts`: create/update reservation helpers                               | Same-type ID/customer positionals and inferred `cancel = false` switch.                      | 2        | Named inputs and tagged update/cancel operation, preserving owner filters, transactions and terminal-state checks. No broad #136 test expansion.                |
| F03 | `apps/admin/lib/staff-access.ts`: `isOrganizationMember`, `resolveStaffRole`                                     | Organization/user string inputs can be confused.                                             | 2        | Named identity inputs; verify membership removal, missing assignment and wrong-organization denials.                                                            |
| F04 | `apps/admin/lib/api-utils.ts`: pagination helpers; booking-table status callbacks                                | Same-type positional values recur across utilities and component contracts.                  | 2        | Migrate one helper/callback family with all callers; assert pagination/status behavior rather than argument implementation.                                     |
| V01 | Admin `app/api/bookings/route.ts` and `app/api/bookings/[id]/route.ts`: `cancellationFields`                     | Cast-based field indexing erases typed update keys.                                          | 2        | Typed field construction with invalid cross-field payload tests; preserve paid/refund and state-dependent checks.                                               |
| V02 | `apps/admin/lib/validations/booking.ts` and corresponding booking routes                                         | Payload rules and database-dependent rules span layers.                                      | 2        | Classify each rule first; move payload-only cross-field checks into the schema, keeping ownership/capacity/payment checks in their protected operation.         |
| V03 | Admin `lib/api-utils.ts` vs customer `types/index.ts`, resource/email/webhook routes                             | Response envelopes and error contracts differ.                                               | 2        | Consolidate within one flow at a time; characterize statuses/body shapes and keep webhook acknowledgements explicit.                                            |
| M01 | `packages/database/src/booking-pricing.ts`: price/deposit calculation                                            | Prices are raw major-unit numbers; deposit rounding has business meaning.                    | 3        | Characterize current arithmetic/rounding before introducing validated unit types; no silent storage or rounding migration.                                      |
| M02 | `booking-payments.ts` vs `reservation-payment-state.ts`/`reservation-payments.ts`                                | Cabin receipt `amount` is major units while reservation `amountCents` is cents.              | 3        | Inventory every reader/writer, introduce explicit constructors/conversions and retain duplicate/overpay/refund tests.                                           |
| M03 | Customer checkout/webhook routes and admin `utils/utilityFunctions.ts`: Stripe conversion/formatting             | Raw `* 100`, `/ 100` and display formatting encode units implicitly.                         | 3        | Centralize boundary conversions after M01/M02; test precision/sign/range and display values.                                                                    |
| S01 | `apps/admin/hooks/useBookingForm.ts` and booking UI hooks/components                                             | Local derived price/form state and SWR/mutation invalidation require coordinated review.     | 4        | Identify redundant state and exclusive workflow states in one form; test error/retry/cache refresh. Independent extras booleans remain valid options.           |
| E01 | Both apps' existing send routes and customer email helpers                                                       | Sandbox sender is repeated despite the configured Resend domain.                             | 5 / #132 | Centralize validated sender configuration for existing flows; retain Phase 0C failures/retry coverage and validate authorized delivery later. No #139 features. |
| O01 | Scripts, test helpers and unmatched remaining candidates                                                         | Admin compiler excludes scripts/tests; passing Jest does not prove their type safety.        | 6        | Resolve candidate findings by symbol and add appropriate targeted checks after the code passes; do not blanket-disable diagnostics or rewrite every script now. |
| D01 | Both `CLAUDE.md` files                                                                                           | Stale model paths, deposit accounting, fixture cast advice, domains and CI description.      | 0A       | Corrected in this Phase 0 tree against source; final format/read-through verification required before review completion.                                        |

## Phase 1 slice 1: customer cabin booking reads

Implementation: `types/booking-read.ts`, `lib/serializers/booking-read.ts`,
`GET /api/bookings/history`, `GET /api/bookings/[id]`, the two read hooks and
cabin booking selection/rendering in `apps/customer/app/bookings/page.tsx`.
All unqualified implementation paths above are within `apps/customer`.

- **T02 implemented:** detail response uses an explicit JSON DTO and serializer.
  Its existing hydrated virtuals and full populated cabin remain intact.
- **T01 partially implemented:** history/detail read hooks and their booking-page
  consumers use plain JSON types. History retains its lean selected cabin shape;
  missing populated cabins remain null. `Booking`, `Cabin` and `PopulatedBooking`
  aliases in `types/index.ts` remain debt for mutation, catalog and email slices.
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
- Remaining same-flow work: mutation response/input DTOs, cancellation/confirmation
  email payloads, checkout population, and refund-estimate date DTOs. The editor
  still submits dates/observations that its existing PATCH schema strips; address
  that UX/API mismatch in a separately tested validation slice.

Characterization: `scripts/http-smoke/run.mjs` compares full response JSON against
real hydrated and lean Mongoose results, including raw legacy rows, null populated
cabins, status filters, ownership and database failures. These assertions passed
against original runtime at `26d09e3` before final review of the refactor, and pass
against the new serializers. Focused serializer, hook and UI tests accompany the
slice. Final command and commit evidence is recorded on tracking issue #150.
The candidate JSON remains the original baseline snapshot; this section records
slice dispositions without claiming every match in an affected file is resolved.

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
