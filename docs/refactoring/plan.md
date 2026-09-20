# LodgeFlow refactoring plan

[Milestone](https://github.com/Amadou-dot/lodgeFlow_admin/milestone/2) ·
[Tracking issue #150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150)

## Problem

The two applications share business data but still expose Mongoose document types
through API/UI boundaries, duplicate response and provider contracts, and mix money
units. Existing helpers also accept ambiguous positional arguments and boolean
switches. These patterns make incremental changes difficult to validate safely.

Concrete starting points include `apps/customer/types/index.ts`,
`apps/admin/types/api.ts`, `apps/admin/lib/api-utils.ts`,
`packages/database/src/booking-payments.ts`,
`packages/database/src/reservation-capacity.ts`, and
`apps/customer/app/api/payments/create-checkout/route.ts`.

This plan applies the root `AGENTS.md` standards across both apps and the shared
package. It is an ordered work queue, not a claim that implementation or full
baseline validation has already happened.

## Scope (decided)

- Build the testing foundation before substantive refactoring: baseline and debt
  inventory (Phase 0A), an isolated HTTP smoke harness (Phase 0B), then high-risk
  regression coverage (Phase 0C). Harness-enabling changes and focused bug fixes
  may land within these phases with their own validation.
- Refactor existing behavior in small PRs. New features remain frozen until the
  milestone's completion criteria are met.
- Prioritize behavioral coverage by risk, not a blanket coverage-percentage target.
  Add characterization tests before each later slice; do not exhaustively test
  implementation details or preserve known bugs as the desired behavior.
- Customer site: `https://lodgeflow.app` (`apps/customer`).
- Admin portal: `https://admin.lodgeflow.app` (`apps/admin`).
- Include an existing bug fix when it concerns the same contract being refactored
  and has a focused regression test. Explain intentional behavior changes
  separately from mechanical cleanup.
- Issues #136 (broad dining test coverage) and #139 (email notification system)
  are explicitly excluded. Do not assign them to this milestone or implement their
  feature/test programs indirectly. Focused regression tests needed to protect a
  changed dining/shared operation remain part of that operation's refactor.
- Preserve persisted values, payment history, permission boundaries, public API
  shapes, date semantics, concurrency protection, and existing integrations.
- Storage migrations, dependency/framework upgrades, new notification types,
  redesigns, and new business flows are outside this plan. A necessary migration
  needs a separate, explicit scope and rollback/reconciliation plan.
- No deadline is assumed. Sequence by dependencies and completion evidence.

## Existing issue triage

Verified on 2026-09-15 against local and GitHub `main` at
`07670932f0b8349fa826802a6ee27f20b3501908`. GitHub had no open PRs at review time.
Recheck state and source before implementation or closure.

| Issue                                                                                    | Verified evidence                                                                                                                                                                                                                                                                                                                      | Planned disposition                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#132](https://github.com/Amadou-dot/lodgeFlow_admin/issues/132) sandbox sender          | Ten existing send sites now use `@lodgeflow/email` and the user-approved domain mailboxes. Both apps include the renderer required by Resend's React email path. Live welcome/payment route checks were accepted and reported delivered by Resend on 2026-09-20; user inbox confirmation and deployed-SHA verification remain pending. | Phase 5: centralize and validate sender configuration for existing email flows. The user confirms `lodgeflow.app` is already set up in Resend. Reuse that domain and keep open until the configured sender works through existing send paths; code cleanup alone is insufficient. |
| [#133](https://github.com/Amadou-dot/lodgeFlow_admin/issues/133) workflow formatting     | Both named, tracked workflow files pass installed Prettier 3.9.6 with the root configuration.                                                                                                                                                                                                                                          | Phase 0A: recheck at implementation HEAD, then close with evidence if still resolved. Do not reformat files unnecessarily.                                                                                                                                                        |
| [#134](https://github.com/Amadou-dot/lodgeFlow_admin/issues/134) missing lockfile        | `pnpm-lock.yaml` is tracked; the workspace overrides `@internationalized/date` to 3.12.2; the lock resolves that version; CI uses frozen installation and builds all three packages.                                                                                                                                                   | Phase 0A: verify a clean frozen install and both app builds, then close with evidence. Do not recreate the lockfile or upgrade dependencies.                                                                                                                                      |
| [#135](https://github.com/Amadou-dot/lodgeFlow_admin/issues/135) checkout ownership leak | Customer cabin checkout queries `Booking.findOne({ _id: bookingId, customer: userId })` and returns `Booking not found`/404 when absent. The reported 403 branch is gone.                                                                                                                                                              | Phase 0C: add/verify a route regression for foreign and missing booking IDs returning identical responses, without provider calls or writes, then close.                                                                                                                          |
| [#136](https://github.com/Amadou-dot/lodgeFlow_admin/issues/136) dining coverage         | Excluded by user direction.                                                                                                                                                                                                                                                                                                            | Leave outside the milestone.                                                                                                                                                                                                                                                      |
| [#139](https://github.com/Amadou-dot/lodgeFlow_admin/issues/139) notification system     | Excluded by user direction.                                                                                                                                                                                                                                                                                                            | Leave outside the milestone; #132 repairs existing senders only.                                                                                                                                                                                                                  |

No issue is considered completed solely because it is assigned to this milestone.
The initial planning review did not run application suites. A subsequent API
readiness check passed 150 admin API tests, 8 customer webhook tests and 25 shared
database tests; full HTTP verification remained unresolved. See
`docs/refactoring/api-testing-readiness.md` for commands, scope and blockers.
These results do not establish a clean installation, passing builds, complete
endpoint coverage or live provider delivery.

## Phases and acceptance criteria

The checklists below define the gates. Current execution status and named-commit
CI evidence are maintained on [tracking issue #150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150).
Phase 0's implementation is documented in [baseline.md](baseline.md),
[inventory.md](inventory.md), [http-smoke.md](http-smoke.md) and
[priority-api-matrix.md](priority-api-matrix.md).

Each phase may take several PRs. Select one resource/operation at a time, migrate
its callers in both apps as needed, and finish validation before starting the next
slice. Split a phase into an implementation issue only when the bounded scope is
known; reuse existing issues rather than opening duplicates.

### Phase 0A — Reproducible baseline and debt inventory

Dependencies: none. Existing issues: #133, #134.

- Record Node 22/pnpm 11.17.0 baseline commands and failures at a named commit:
  frozen install, root formatting, read-only lint, three package test suites, and
  builds using the CI public Clerk key.
- Inventory unsafe casts, explicit `any`, document-shaped UI types, ambiguous
  signatures, optional-plus-null fields, raw error-message matching, duplicated
  response shapes, and unit/date conversions. Cover runtime code, tests and
  scripts in both apps and the database package; exclude generated output.
- Maintain a checked inventory in `docs/refactoring/inventory.md` when implementation
  starts: path/symbol, violated rule, owning phase, status, and validation evidence.
  A text search is a starting point; inspect each match and affected caller.
- Reconcile stale `CLAUDE.md` guidance with `AGENTS.md`, including model paths,
  payment accounting, fixture casts, domains, and validation commands.

Acceptance:

- [ ] Baseline results and environment blockers are recorded without weakening checks.
- [ ] Each confirmed debt item has an owning phase and a bounded next action.
- [ ] #133/#134 are either closed with verification evidence or have specific remaining work recorded.
- [ ] Both apps' documentation uses the correct customer/admin domains.

### Phase 0B — Isolated HTTP smoke harness

Dependencies: baseline/environment findings from Phase 0A. Complete this gate
before substantive refactoring; inventory work can continue alongside it.

- Start both apps through Next.js against a disposable MongoDB replica set, with
  isolated build output and explicit test configuration. Resolve the observed
  Turbopack cache and HTTP proxy/timeout failures before calling the harness ready.
- Exercise routing and middleware as well as handlers. Use controlled test
  identities for customers and staff roles; do not rely on production accounts or
  disable the application permission checks. Prefer a dedicated Clerk test setup
  for full authentication verification and document any mocked boundary accurately.
- Control Stripe/Resend responses with test doubles for deterministic checks; do
  not require live sends, charges, or production credentials in routine CI.
- Cover public customer reads, authenticated customer booking/checkout, foreign
  resource denial, and allowed/denied staff operations. Use application origins
  appropriate to the customer/admin app while preserving local harness URLs.
- Add the harness to CI alongside existing tests/builds. Bound startup and request
  times, clean up on success/failure, and retain useful redacted diagnostics.

Acceptance:

- [ ] A documented command starts isolated dependencies and both apps, exercises requests over HTTP, and cleans up reliably.
- [ ] Each smoke case asserts the expected status, JSON/envelope or explicitly expected redirect, and relevant persisted effects.
- [ ] Unexpected redirects, non-JSON responses, timeouts, wrong response bodies and incorrect writes fail the CI job.
- [ ] Deliberately injecting a response failure or timeout proves the harness gate fails rather than silently passing.
- [ ] Authentication coverage and any mocked boundaries are explicit; dummy credentials, bypass mode or server readiness alone cannot satisfy the authenticated smoke cases.
- [ ] The harness passes on a named commit in CI; outstanding environment or credential blockers remain open gate items.

### Phase 0C — High-risk behavior and failure coverage

Dependencies: Phase 0B and baseline inventory. Existing issue: #135.

- Build a route/method matrix for the priority flows, linking each case to its test
  and recording remaining gaps. Reuse passing tests where sufficient instead of
  duplicating the existing 150 admin API, 8 webhook and 25 database tests.
- Prioritize customer booking/checkout, staff permissions, payment retry/refund
  behavior, and failure handling in existing email flows. Keep #136's broad dining
  coverage program and all #139 notification features excluded.
- Assert outcomes and persisted effects, not internal function layout: valid and
  invalid requests, absent authentication, denied permissions/ownership, missing
  resources, applicable capacity conflicts, and provider/database failures.
- Verify duplicate webhook/payment requests cannot duplicate receipts or exceed
  payment/refund limits. Email failures must not masquerade as successful delivery
  or roll back durable payment accounting.
- Add the #135 route regression for identical missing/foreign booking 404 responses,
  with no provider call or write. Close the existing issue with evidence if it passes.
- Preserve intended behavior with characterization tests. If a test exposes a real
  bug, make the expected outcome the corrected contract and ship a focused tested
  fix; do not enshrine the bug in a passing baseline or proceed with a failing gate.

Acceptance:

- [ ] Every priority route/method has mapped success and applicable denial/failure cases with observable assertions.
- [ ] Checkout ownership, receipt retry/refund limits and existing email failure handling have passing regressions.
- [ ] Tests verify failed requests have no unintended database/provider side effects and cannot return false success.
- [ ] The priority suites and HTTP smoke gate pass in CI before Phase 1 or Phase 5 implementation begins.
- [ ] Remaining lower-risk gaps have owning refactoring slices; no blanket percentage threshold substitutes for the listed outcomes.

### Phase 1 — Separate persistence, transport, and UI types

Dependencies: Phases 0A–0C completed.

Start with cabin booking reads: shared model/query output → route response → hook
→ component props. Then repeat for cabins, dining, experiences, customer records,
Settings, staff/audit, reservations/calendar, and reporting. Inventory entries
ensure lesser-used routes, scripts, and fixtures are not forgotten.

- Build explicit DTOs and typed serializers; distinguish hydrated, lean,
  populated, and JSON representations. Validate nullable populated references.
- Normalize identifiers and dates at boundaries. Preserve wire compatibility;
  do not make clients expect live `Date` values from JSON.
- Replace double casts and `any` transforms with typed construction; narrow
  component dependencies and use checked DTO fixture builders.

Acceptance:

- [ ] Migrated UI/response types no longer inherit Mongoose document methods.
- [ ] Serializers cover missing references, identifiers, dates, and existing response fields.
- [ ] Both apps' affected callers and fixtures compile and relevant tests pass.
- [ ] Inventory accounts for all remaining boundary/type violations.

### Phase 2 — Explicit operations, validation, authorization, and errors

Dependencies: Phase 1 for the flow being changed. Preserve the #135 regression established in Phase 0C.

- Replace ambiguous signatures in `booking-payments.ts`, `reservation-capacity.ts`,
  admin staff/auth helpers and other inventoried operations with named options.
  Replace boolean operation switches with discriminated inputs.
- Put payload-only cross-field rules in Zod; use typed allowlisted updates.
  Keep ownership, Settings-dependent rules, and capacity checks in server operations.
- Consolidate typed domain error mapping and response construction within each
  flow while preserving HTTP contracts, webhook acknowledgements, and permissions.
- Keep the Phase 0C cabin checkout ownership regression passing. Check all
  refactored mutation paths retain server identity and permission enforcement.

Acceptance:

- [ ] No caller can swap same-type positional inputs or select contradictory operations in migrated APIs.
- [ ] Schema tests cover cross-field failures; route tests cover denied access and rejected fields.
- [ ] Missing and foreign cabin checkout bookings have the same 404 response and cause no provider call or write.
- [ ] Expected errors use typed narrowing, unexpected errors are safely logged, and audit attribution/redaction remain intact.

### Phase 3 — Explicit money units and protected accounting

Dependencies: Phases 1–2 for payment flows.

- Inventory all price, deposit, receipt, refund, display and Stripe conversion
  boundaries across both apps before changing monetary types.
- Introduce shared validated major-unit and cents types, constructors, conversion
  and formatting helpers. Retain existing storage and transport units.
- Characterize existing deposit and price rounding before wrapping it; distinguish
  exact-cent validation from intentional business rounding.
- Migrate cabin pricing/payments first, then dining/experience receipts and
  checkout/refund flows. Preserve quote checks, receipt idempotency, version retries,
  legacy reconciliation guards, and capacity locks/transactions.

Acceptance:

- [ ] Money crossings are explicit and typed; no scattered raw conversion remains in migrated flows.
- [ ] Tests cover precision, non-finite values, safe-integer bounds and sign rules.
- [ ] Deposit due remains distinct from received money; retries cannot duplicate receipts or exceed balances/refunds.
- [ ] Existing amounts and rounding remain unchanged; database tests and both app suites/builds pass.

### Phase 4 — UI state, hooks, and cache consistency

Dependencies: Phases 1–2 for each flow; Phase 3 for payment UI.

- Refactor one page/form family at a time. Replace mutually exclusive boolean
  combinations with state unions and derive redundant state from query results.
- Preserve SWR/TanStack Query behavior, query keys, mutation invalidation, filters,
  pagination, URL state, loading/error handling, and permission-aware navigation.
- Remove unused components/helpers only after checking imports and runtime entry
  points. Preserve established HeroUI, responsive and accessibility behavior.

Acceptance:

- [ ] Invalid workflow-state combinations cannot be constructed in migrated components.
- [ ] Focused hook/component tests cover success, failure, retry and cache refresh.
- [ ] Representative customer/staff interactions are checked in-browser where credentials permit; blockers remain explicit.

### Phase 5 — Provider configuration and existing email repair

Dependencies: Phases 0A–0C completed; migrated boundary types where applicable. Existing issue: #132.
This phase can proceed independently of unrelated UI refactors.

- Centralize sender configuration across both apps' existing email paths without
  adding notification features or placing email-specific concerns in the database
  package. Keep provider initialization lazy.
- Define explicit application origins: customer links and checkout return URLs
  resolve to `https://lodgeflow.app`; staff links resolve to
  `https://admin.lodgeflow.app`. Preserve deliberate local/preview overrides.
- Validate sender configuration at the sending boundary and handle provider errors
  consistently without undoing durable payment accounting.
- Reuse `lodgeflow.app`, which the user confirms is already configured for sending
  in Resend. The user approved `payments@lodgeflow.app` for payment-related email
  and `notifications@lodgeflow.app` for other messages, retaining `LodgeFlow` as the
  display name. No new domain verification or DNS setup is planned.
- Implemented in `@lodgeflow/email`: approved mailbox defaults and optional
  `LODGEFLOW_PAYMENT_EMAIL_FROM` / `LODGEFLOW_NOTIFICATION_EMAIL_FROM` overrides,
  validated lazily at send time. Deployment needs no newly required sender setting.
  Empty or malformed overrides fail closed with a typed configuration error.
- Classify payment receipts and cancellation/refund notices as payment; generic
  cabin confirmations and welcome messages as notifications. Dining/experience
  confirmations use payment for positive totals and notification for free bookings,
  including the post-settlement helper.
- Both apps declare `@react-email/render` for Resend's React template path; the
  isolated HTTP fixture exercises real SDK rendering with intercepted transport.
  Live checks on 2026-09-20 invoked existing customer welcome/payment-confirm
  handlers with synthetic identity/booking dependencies and actual templates plus
  Resend. Both sends were accepted; provider readback reported `delivered` for both.
  Phase 5 remains active pending user inbox confirmation and deployed-SHA
  verification. The approved private test recipient is not recorded here.
- Preserve existing templates, recipients, send triggers, and retry semantics.

Local verification on 2026-09-20: `pnpm ci:check` passed 1,207 tests (admin 1,014,
customer 165, database 25, email 3), formatting and lint. `pnpm test:http` passed
with actual email rendering and controlled transport. These checks do not establish
a deployed commit or a hosted login-to-email flow. Frozen installation, both clean
isolated production app builds and shared package builds also passed.

Acceptance:

- [ ] Existing production send paths use centralized validated configuration, not hardcoded sandbox senders.
- [ ] Tests cover missing/invalid configuration, sender reuse, provider failure and correct customer/staff link origins.
- [x] Builds still work without Stripe/Resend secrets (clean isolated app builds and shared package builds passed on 2026-09-20).
- [ ] #132 closes after existing send paths use the configured `lodgeflow.app` sender and delivery is validated; no #139 features are added.

### Phase 6 — Remaining debt and milestone verification

Dependencies: Phases 0A–0C and 1–5.

- Resolve the remaining inventory across routes, components, hooks, utilities,
  scripts, tests and shared models. Do not define completion as finishing only the
  example files named above.
- Remove superseded adapters once all callers have migrated. Consolidate duplicate
  contracts where semantics match, retaining genuine domain differences.
- Confirm all helper signatures, string unions, nullability, error handling,
  validation and serialization meet the relevant `AGENTS.md` rules.
- Tighten targeted enforcement where it catches meaningful recurrence. Check the
  existing gap around excluded admin tests/scripts; do not blindly broaden compiler
  configuration without making the affected code pass.

Acceptance:

- [ ] Inventory has no unresolved applicable `AGENTS.md` violations; externally imposed signatures/boundaries have documented rationale.
- [ ] All migrated callers and obsolete adapters are accounted for; no new unsafe casts or lint/type suppressions were used to pass checks.
- [ ] Frozen install, formatting, read-only lint, tests, HTTP smoke checks and builds pass on the final commit.
- [ ] Customer booking/checkout and authorized staff workflows have recorded smoke-test evidence; unavailable credentials are unresolved verification work.
- [ ] Existing in-scope issues are closed with evidence, including #132's existing-flow delivery validation.
- [ ] Documentation matches final contracts; #136 and #139 remain outside this milestone.

## Working and validation rules

Before each later refactoring slice, add or verify characterization tests for the
intended behavior at risk. Keep tests stable across internal restructuring and add
focused regressions for discovered defects. The testing foundation is a prerequisite,
not a replacement for this continuing coverage.

For each slice, record the observed behavior, exact scope, linked issue, invariant
at risk, test commands/results, and remaining work. A related bug fix should have a
failing-before/passing-after regression where practical. Reproduce stale reports
before changing code; close already-fixed issues with evidence instead of rewriting
working code. Do not close excluded issues as part of this effort.

Use the commands and test locations in `AGENTS.md` and CI. App `lint` scripts write
fixes, so use `exec eslint .` for verification. Root `ci:check` does not include
builds. Shared changes require the database suite plus both apps' suites/builds.
Run targeted tests during a slice and the required broader checks, including the
HTTP smoke gate, before its PR.
Use disposable MongoDB infrastructure; never seed or test against production.

Production provider changes and live sends need a concrete operational task
and explicit authorization; preparing configuration, tests, and runbooks can proceed.
Do not treat elapsed time or missing credentials as completion evidence.

## Milestone completion

The milestone is complete when Phase 6 acceptance criteria pass and every in-scope
issue is resolved. New feature work remains frozen until then. If credentials or delivery validation block completion, report the specific
dependency while continuing independent refactoring; do not silently waive the gate
or expand into #139. The existing Resend domain setup is not a blocker.
