# Phase 6 customer lock boundary implementation plan

> **For agentic workers:** Use superpowers:executing-plans for this bounded slice.

**Goal:** Make successful customer lock/unlock operations visible to subsequent
reads and validate their acknowledgements before the UI reports success.

**Architecture:** Keep the existing Clerk operations and their named hooks. Await
the existing server cache invalidation after provider success, and share a pure
Zod response contract between route types and one client request boundary.

**Tech stack:** Node 22, pnpm 11.17.0, existing Zod 4/Jest/SWR/TanStack Query.

**Spec:** [Phase 6](plan.md#phase-6--remaining-debt-and-milestone-verification),
V03 in [inventory.md](inventory.md), and root `AGENTS.md`.

## Scope and choices

The approved milestone permits focused fixes on the contract being refactored.
Tracing the reported lock-button problem found that `lockClerkUser` and
`unlockClerkUser` omit the invalidation already used by profile update/delete.
Revalidating SWR therefore reads the previous server-cached status. Fix that
source and characterize both Redis and process-local caches; a UI-only optimistic
flag would leave other readers stale. A broader customer detail/mutation parser
would obscure this bounded operation and remains a later slice.

Preserve administrator-only route authorization, provider methods, IDs, response
messages, timestamp keys, cache TTL/failure policy, and the hooks' existing
customer-only refreshes. No live provider operations, new audit events, storage
changes, dependencies, unsafe casts or unrelated UI changes. The user-owned
untracked notes file stays unchanged and uncommitted.

The intentional corrections are stale lock status after a successful operation
and malformed lock acknowledgements previously accepted as success. Existing
server error strings remain visible; invalid JSON and invalid error values use
the existing per-operation fallback. Detail/create/update/delete responses,
other V03 boundaries, O01 and full hosted/browser acceptance remain open.

## Review focus

- Lock and unlock must both evict only the affected user, after provider success;
  cached single and batch reads must observe the new status.
- Failed or pending provider operations must not evict valid cached profiles;
  Redis eviction failures retain the established logged, best-effort policy.
- The two success payloads retain distinct literal flags and ISO timestamp keys;
  missing/wrong data must not run success handlers or refresh client caches.
- Malformed/primitive/null JSON and non-string errors produce safe fallbacks;
  actual API error strings, additive fields, HTTP methods and URLs remain valid.
- Real client caches refresh on successful lock/unlock and recover after failure;
  denied HTTP requests never reach the provider and successful HTTP rereads agree.

## Task 1: Complete the customer lock response and cache boundary

**Files:**

- Modify `apps/admin/lib/clerk-users.ts`, `hooks/useCustomers.ts`, and
  `types/customer-responses.ts`.
- Create `apps/admin/lib/validations/customer-lock.ts` and `lib/customer-lock.ts`.
- Add `__tests__/unit/lib/clerk-users.lock-cache.test.ts` and
  `__tests__/hooks/customer-lock-boundary.test.tsx`; extend existing lock route and
  mutation fixtures with the full acknowledged payload.
- Extend `scripts/http-smoke/clerk-fixture.mjs` and `run.mjs` for isolated
  provider lock/unlock and authorization/read-after-mutation verification.
- Update `AGENTS.md`, plan/inventory, HTTP guide and local handoff; record #200
  delivery and remaining debt without committing user notes.

**Interfaces:** `customerLockSuccessResponseSchema` and
`customerUnlockSuccessResponseSchema` infer the existing success types in
`types/customer-responses.ts`. `changeCustomerLock({ id, action })`, with action
`'lock' | 'unlock'`, returns `Promise<{ success: true }>` after HTTP/JSON validation.
The two hooks keep their exported signatures and cache refresh policy.
`lockClerkUser(userId)` / `unlockClerkUser(userId)` keep their provider User result
and await `invalidateCache(userId)` only after provider success.

- [x] Run existing customer baseline: 165 tests in 11 suites pass before edits.
      Add passing valid-response/provider-error characterizations first.
- [x] Add regressions for cached reads after lock/unlock and malformed client
      acknowledgements; run them against unchanged production code and observe
      stale status or incorrect success/parser errors.
- [x] Add schema-derived lock types, one validated client request boundary and
      post-success server cache invalidation; migrate both hooks and full fixtures.
- [x] Expand isolated HTTP to prime a real server cache, deny non-admin requests,
      lock/read/unlock/read through the real Clerk SDK, and verify wire shapes.
      Run the new sequence before the service fix to prove it detects stale reads.
- [x] Run focused suites, strict changed-test types, both app types, full
      `pnpm ci:check`, `pnpm test:http`, frozen install and clean builds. Expect
      all pass; compare build inputs and verify document links/whitespace.
- [ ] Commit the verified slice and obtain a fresh whole-branch review. Resolve
      actionable findings with regressions, then push and open a review PR.

**Delivery:** Use `Part of #150`. Keep tracker/milestone open. The current approval
authorizes #200 delivery and continuation to this next review checkpoint; the new
PR awaits user acceptance before merge.
