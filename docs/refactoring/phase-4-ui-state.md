# Phase 4 UI state and cache consistency

**Scope:** [Phase 4](plan.md#phase-4--ui-state-hooks-and-cache-consistency)
of [tracking issue #150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150),
starting from `9f8b1a8` with Phases 0–3 merged. The user authorized this phase
and a draft PR; Phase 5 provider-origin work and Phase 6 remain separate.

## Preserved contracts

- Keep request/response shapes, ownership and staff permissions, payment and
  reservation invariants, money units/rounding, and existing query keys.
- Keep filters, pagination, URL behavior, navigation, responsive layouts,
  HeroUI controls and accessibility semantics.
- Keep editable drafts and independent choices such as booking extras separate.
  Use tagged state for mutually exclusive workflows and query results for
  fetched data and request status.
- Refresh the caches actually consumed after successful writes. A failed
  write must not invalidate data or appear successful. Checkout creation does
  not prove payment settlement.
- Do not add notification flows, change providers, migrate data, seed a live
  database, upgrade dependencies, merge or deploy.

## Flow inventory

| Family | State or cache responsibility | Intended verification |
| --- | --- | --- |
| Admin booking form | Derive current pricing from the draft, cabin and Settings; retain arithmetic and payload choices | Rate/Settings refresh, draft edits, precision, validation |
| Admin booking mutations | Refresh SWR lists/details and existing TanStack reporting data, including sales and durations | Success, failure/retry, provider-scoped caches, filtered keys |
| Admin customer selection | Derive infinite pages/search/loading from query state; discard obsolete search results; refresh populated booking profiles after edits | Search/clear races, pagination, failed load/retry and mutation refresh |
| Admin Settings form | Derive dirty state while preserving independent edits through refresh | Nested values, save/reset, failure/retry, edits and reverts during pending writes |
| Admin catalog and booking action dialogs | Represent closed/create/view/edit or action modes exclusively | Modal transitions, failure/retry, permission and filter behavior |
| Admin reservation/staff requests | Represent load/action state explicitly and ignore stale requests | Initial failure, retry, changed resource/filter and successful refresh |
| Customer confirmations | Consume ID-keyed query state without showing a previous resource or private data after loss of access | Loading, errors, retry, route changes, cache refresh, sign-out and definitive denial |
| Customer booking dialogs | Store one active dialog context and use current query data | Details/edit/cancel transitions, refreshed records and date behavior |
| Customer mutations | Refresh affected history/detail/availability caches on success | No refresh on failure, successful retry, SWR and TanStack readers |

Already valid independent state remains: cabin extras, catalog filters and view
modes, committed-versus-draft search fields, gallery/menu disclosure and the
existing reservation checkout/payment unions. No change to customer catalog URL
synchronization is included. The plan requires preserving current URL behavior.

## Intentional behavior fixes

The state refactors also correct these observed inconsistencies; they are not
presented as behavior-neutral cleanup:

- Admin Settings edits, including reverting a value while save/reset is pending,
  survive the response and subsequent cache refresh. Nested-value dirty checks
  compare values rather than object identity.
- The admin customer selector ignores late results from old searches, resets pagination
  when search is cleared, and permits retry after a next-page failure. Customer
  profile edits refresh populated booking reads.
- Successful booking writes refresh actual SWR list/detail readers and TanStack
  reporting readers, including sales/durations; cabin writes refresh affected
  detail readers as well as catalog/statistics caches.
- Catalog and bulk-action dialogs cannot overlap. Old completions cannot close
  a newer dialog or clear a changed bulk selection. Failed experience creation
  and booking deletion retain their appropriate draft/retry context.
- Reservation/staff requests ignore obsolete responses and permit retry. Valid
  unsaved status choices survive payment refresh; choices made invalid by the
  refreshed statuses/payment constraints are cleared and cannot be submitted.
- Payment pending comes from its mutation, image validation belongs to the
  current URL, and print/PDF operations are exclusive. PDF failure remains
  retryable, and closing a loading print popup releases its busy state and timers.
- Customer confirmations stop displaying the previous resource when route params
  change, ignore obsolete completions and allow failed reads to be retried. Their
  existing detail queries supply current data without duplicate request state.
- Customer booking dialogs use refreshed records, retain context when a filter
  hides the selection and preserve newer dialogs or guest drafts when an earlier
  update finishes. Error/loading/catalog content is exclusive on the experience
  listing.
- Customer mutations refresh the affected history, detail and existing availability
  readers only after success, including cabin availability in both SWR and
  TanStack Query. Checkout creation refreshes authoritative detail; it never
  writes paid state. There is no experience availability reader to invalidate.

The confirmation cache migration retains owned data on transient background
failures. Review caught and corrected a regression in that new retention path:
sign-out and definitive HTTP 401/403/404 must hide cached private detail. All three
pages now enforce that distinction while preserving their server/fallback error
messages, ownership checks and original immediate-failure retry policy. This is
a guard on the new cache behavior, not a claim that server authorization changed.

## Validation record

Baseline on `9f8b1a8`: `pnpm ci:check` passed formatting, read-only lint and
2,387 tests (admin 1,520; customer 771; database 93; email 3) with Node 22.23.2
and pnpm 11.17.0.

The first admin form/cache slice passes 11 focused suites / 95 tests, read-only
lint, the admin app type check and separate strict compilation of its eight
touched test files. Independent review found and verified fixes for pending
Settings reverts, next-page search retry, sales/duration refresh and populated
booking profiles after customer edits. These are intentional behavior fixes;
price arithmetic and request payloads remain unchanged.

The second admin slice passes 15 focused suites / 96 tests before review fixes.
Independent review then reproduced two regressions: a retained status draft could
become invalid after payment refresh, and closing the print popup before load
could leave it busy indefinitely. Six additional regressions failed before the
fixes, then the affected two suites / 14 tests passed. Scoped re-review approves
both fixes and independently verifies the tests and popup retry. Post-fix admin
app typing and strict compilation of all 20 admin test files changed across the
two slices pass. Tests model popup lifecycle in jsdom, not a real browser.

The reviewed admin production build and shared package build/type checks pass in
the isolated frozen-install copy with an explicit credential-free environment and
CI's throwaway public Clerk key. The isolated HTTP gate passes with local signed
Clerk sessions, real application authorization/disposable MongoDB and controlled
Stripe/Resend responses. It does not exercise hosted login or browser UI.

The customer slice passes 66 suites / 824 tests, its app/test type check and
touched-file read-only lint. Fifteen confirmation cases cover cached sign-out,
401/403/404 and transient failures across all three resources. The exact dialog
test that review found dependent on earlier tests also passes independently after
moving fixture/reset hooks to file scope. Scoped re-review approves both fixes.

Final automated gates on the reviewed source:

| Gate | Result |
| --- | --- |
| `pnpm ci:check` | Pass: formatting, read-only workspace lint and 2,497 tests (admin 1,577; customer 824; database 93; email 3) |
| Both app `exec tsc --noEmit` checks | Pass; customer includes its tests |
| Separate strict compilation of changed admin tests | Pass: all 20 changed files; no compiler settings weakened |
| `pnpm test:http` | Pass: isolated signed Clerk sessions, application authorization, disposable MongoDB and controlled provider transport |
| Offline frozen dependency installation | Pass in a separate clean source copy; manifests and lockfile unchanged |
| Admin/customer production builds and shared package build/type checks | Pass in that copy with a credential-free environment and throwaway public Clerk key |
| `git diff --check` | Pass |

The customer build logs missing-`MONGODB_URI` fallbacks during static generation
and completes successfully without a database connection. No server/API, shared
runtime, proxy, dependency, configuration or HTTP-harness source changed in this
phase. The HTTP result therefore covers the unchanged server contracts consumed
by the final client code.

## Review and verification boundary

Each of the three implementation slices received independent spec and quality
review, followed by a bounded fix round and scoped re-review. Final integration
review is recorded with the draft PR. Remote CI and preview status belong to the
exact pushed commit; the local results above do not assert those outcomes.

Representative browser interactions remain unchecked. The connected CUA workflow
exposes no browser, and opening its in-app browser reports that it is unavailable.
This is not a finding that all browser testing on the computer is unavailable:
Chromium is cached locally. This checkout has no Playwright configuration, test
script or installed Playwright runner; the lockfile mentions only Next's optional
peer. No runner was installed or security setting changed. Hosted Clerk
login/sign-out, real popup behavior, responsive layout, keyboard/focus behavior
and visual rendering still need browser review. jsdom and the HTTP harness cover
their stated local boundaries only.

The unchanged `apps/customer/app/payments/success/page.tsx` displays static payment
success wording without checking settlement; correcting that page is separate
work. This phase introduces no settlement inference. No live payment/email
operation, merge or production deployment was performed. Phases 5–6 and the
overall milestone remain open; issues #136 and #139 remain excluded.
