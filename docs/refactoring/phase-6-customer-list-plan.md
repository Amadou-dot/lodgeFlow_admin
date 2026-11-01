# Phase 6 customer list validation implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded slice.

**Goal:** Validate customer list JSON before either admin client cache accepts it,
while preserving valid profiles, pagination and existing cache behavior.

**Architecture:** Extract the existing cache's customer JSON shape into a pure
schema, derive `CustomerJson` from it, and keep server date revival in the cache
adapter. Validate list success responses at one fetch boundary used by SWR and
TanStack Query. Validate known fields without stripping additive response fields.

**Tech stack:** Node 22, pnpm 11.17.0, existing Zod 4/Jest/SWR/TanStack Query.

**Spec:** [Phase 6](plan.md#phase-6--remaining-debt-and-milestone-verification),
V03 in [inventory.md](inventory.md), and the root `AGENTS.md`.

## Scope and choices

The approved milestone calls for runtime validation at untrusted boundaries.
This slice follows the customer list from Clerk/cache through serialization and
the list route into both hooks. Reusing the established read schema avoids
copying creation limits onto legacy profiles. Broad generic response middleware
would require unrelated resource contracts; it stays outside this slice.

Malformed success bodies intentionally become the existing safe fetch error
before caching, instead of being accepted or failing during rendering. No API,
database, authorization, money, provider or URL/query behavior changes are planned.
Customer detail/mutations, other resources, webhook contracts, O01 and full
browser acceptance remain separate work. No new dependencies or type escapes.

## Review focus

- Sparse legacy profiles, null identity fields, empty email/image strings, old
  national IDs, long metadata and finite legacy price precision remain accepted.
- All serialized timestamps stay strings in client responses; only the server
  cache adapter revives Dates. Deleted-user null cache entries remain valid.
- Valid empty lists keep zero total pages; pagination names and number semantics
  stay unchanged. Additive fields survive validation at every response level.
- A malformed later page or revalidation cannot replace previously valid data;
  retries and older/newer search completion preserve existing query isolation.
- One malformed customer rejects the whole page with the safe fetch error;
  raw payloads, JSON parser details and provider errors are not shown to users.

## Task 1: Validate the shared customer list fetch boundary

**Files:**

- Create `apps/admin/lib/validations/customer-json.ts`,
  `lib/validations/customer-list.ts`, and `lib/customer-list.ts`.
- Modify admin `types/customer-json.ts`, `types/customer-responses.ts`,
  `lib/validations/customer-cache.ts`, `hooks/useCustomers.ts`, and
  `hooks/useInfiniteCustomers.ts`.
- Add `__tests__/hooks/customer-list-boundary.test.tsx` and unit response-schema
  coverage, a checked JSON fixture and a test-local jsdom environment exposing
  native Node Response parsing; extend `__tests__/integration/api/customer-json.test.ts` to check
  actual route responses against the client boundary.
- Update `AGENTS.md`, the plan/inventory and ignored handoff with #199 delivery
  evidence, this slice's validation and concrete remaining work.

**Interfaces:** `customerJsonSchema` describes the existing JSON projection;
`CustomerJson` is its inferred output. `customersSuccessResponseSchema` validates
the existing list envelope; `CustomersSuccessResponse` is inferred from it.
`isCustomersSuccessResponse(value: unknown)` validates known fields while
narrowing the original object, retaining additive fields. `fetchCustomersList(url)`
checks HTTP success, reads JSON as unknown, validates once and returns the original
success object; malformed JSON/envelopes use `Failed to fetch customers`.

- [x] Run current customer route/cache/hook/compiler suites before edits; expect
      all pass. Add valid-response characterizations and run them before edits.
- [x] Add meaningful failing regressions through real SWR and TanStack providers:
      invalid customer fields/flags, pagination, malformed JSON, mixed valid/invalid
      rows, failed revalidation/next page and successful retry. Observe the failures.
- [x] Extract the JSON schema, derive types and preserve cache Date adaptation.
      Add the validated fetch boundary and migrate both list consumers.
- [x] Verify original sparse/full route JSON satisfies the new boundary; validate
      unknown-field retention and safe errors. Expect focused suites and strict
      compilation of all touched admin tests to pass without suppressions.
- [x] Run full `pnpm ci:check`, both app types, `pnpm test:http`, frozen install and
      clean builds; compare build inputs and check documentation links/whitespace.
- [ ] Obtain one fresh whole-branch review and resolve actionable findings with
      failing-before/passing-after regressions. Commit, push and open the next PR.

**Delivery:** Link with `Part of #150`. Update tracker and milestone; keep both
open. The user's current acceptance authorizes #199 delivery and this next review
checkpoint; the new PR remains available for their review before merge.
