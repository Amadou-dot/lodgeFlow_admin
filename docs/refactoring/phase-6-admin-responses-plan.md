# Phase 6 admin response contracts implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this
> bounded slice of the approved milestone plan.

**Goal:** Give existing admin response envelopes one accurate type definition
and migrate the customer route-to-hook flow without changing its JSON or effects.

**Architecture:** Put data-success, error and acknowledgement types in a pure
`types/api-response.ts` module. Keep customer pagination and lock/unlock payloads
in `types/customer-responses.ts`. Server response builders and browser consumers
share these declarations; existing route logic, HTTP statuses and caches remain.

**Tech stack:** Node 22, pnpm 11.17.0, Next.js, TypeScript, Jest, existing HTTP gate.

**Spec:** [Phase 6](plan.md#phase-6--remaining-debt-and-milestone-verification),
inventory item V03, and the governing `AGENTS.md`.

## Global constraints

- Preserve envelopes, pagination keys, omitted fields, nulls, error messages,
  headers/statuses, permission defaults, provider calls and cache invalidation.
- Keep customer-app responses, webhook acknowledgements, raw reporting replies
  and remaining test infrastructure debt separate; do not standardize their wires.
- This slice consolidates static contracts. Do not claim that response type
  annotations validate untrusted JSON; broader runtime parsing remains V03 debt.
- No new dependencies, storage/provider mutations, product features, unsafe casts
  or compiler/lint suppressions. No blanket compiler expansion for admin tests.
- Phase 4 browser acceptance and the rest of Phase 6 remain open.

## Review focus

- Customer deletion omits `data`; lock/unlock replies contain a boolean and their
  distinct timestamp key. Preserve all three shapes and the hook result values.
- List errors have no data/pagination; successful empty lists still carry the
  existing `totalCustomers`, `limit` and `hasPrevPage` pagination names.
- Auth denials and provider failures retain status, safe text and no-write order;
  omitted permissions continue to mean admin-only for delete/lock/unlock.
- Customer create/update missing-data fallbacks and server error text remain;
  SWR/TanStack refreshes and populated booking refreshes remain unchanged.
- Client imports must be type-only and must not pull Clerk/server helpers into
  browser modules. No obsolete duplicate response declarations remain in scope.

## Task 1: Consolidate the admin contract and migrate customer consumers

**Files:**

- Create `apps/admin/types/api-response.ts` and `types/customer-responses.ts`.
- Modify admin `lib/api-utils.ts`, `types/index.ts`, `hooks/useCustomers.ts`,
  `hooks/useInfiniteCustomers.ts`, `hooks/useData.ts`, `hooks/useBookingAnalytics.ts`
  and the staff/audit/reservations/calendar pages' type imports.
- Add explicit response construction types to admin `app/api/customers/route.ts`,
  `app/api/customers/[id]/route.ts` and `app/api/customers/[id]/lock/route.ts`.
- Test admin `__tests__/unit/lib/api-utils.test.ts`, new
  `__tests__/unit/lib/api-response-wire.test.ts`, new
  `__tests__/unit/types/api-response.test.ts`, customer route/hook suites and
  `__tests__/hooks/cacheRefresh.test.tsx`.
- Update `AGENTS.md`, `docs/refactoring/plan.md`, `inventory.md`, Phase 5 delivery
  notes and ignored `progress.md`; retain historical evidence.

**Interfaces:** `ApiSuccessResponse<T>` requires `success: true` and `data: T`;
`ApiErrorResponse` requires `success: false` and `error: string`, with optional
`details: unknown`. `ApiResponse<T>` is their union. `ApiAcknowledgement` allows
the existing success/message-only reply or the same error envelope. Customer
list success extends the data response with the existing pagination object;
detail/mutation/lock/unlock aliases describe their actual serialized payloads.

- [x] Run current helper, customer route/hook, infinite-list and cache suites as
      characterization before runtime edits; expected: all pass.
- [x] Add characterization for complete lock/unlock success bodies, acknowledgement
      omission, falsy/null data and error details, and customer mutation fallback
      behavior. Run against the existing implementation; expected: all pass.
- [x] Add compiler-backed contract assertions: successful data access narrows;
      missing success data, missing failure errors and contradictory envelopes
      are rejected. Demonstrate the existing broad type fails these assertions.
- [x] Extract canonical pure types, remove duplicate declarations and migrate all
      imports. Distinguish customer acknowledgements and timestamped lock replies;
      annotate route construction without changing JSON. Preserve fallback guards.
- [x] Run the focused suites and admin TypeScript. Strictly compile every new or
      modified admin test separately; expected: pass without suppressions.
- [x] Run `pnpm ci:check`, `pnpm test:http`, both app type checks, clean-copy builds,
      source/build comparison, documentation formatting/links and `git diff --check`.
- [ ] Obtain one fresh whole-branch review, resolve actionable findings with
      regressions, and document remaining V03/O01 and browser acceptance debt.

**Delivery:** Commit, push and open a review PR linked with `Part of #150`.
Update the tracker and milestone without an automatic closing reference. Stop
at that concrete review checkpoint; the user's current merge approval covers #198.
