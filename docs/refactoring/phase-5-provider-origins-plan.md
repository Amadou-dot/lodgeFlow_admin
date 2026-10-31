# Phase 5 provider origins implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this
> plan task by task. The existing milestone plan is the approved specification.

**Goal:** Finish the existing provider configuration and application-origin
review without adding email features or changing settlement behavior.

**Architecture:** Keep customer URL policy in the existing customer `lib/url.ts`.
Use one lazy resolver for configured, request-fallback and production-default
origins. Keep staff navigation relative to the admin app, the existing admin
customer-site shortcut explicit, and sender configuration in `@lodgeflow/email`.

**Tech stack:** Node 22, pnpm 11.17.0, Next.js, TypeScript, Jest and the existing
isolated HTTP gate.

**Spec:** [Milestone Phase 5](plan.md#phase-5--provider-configuration-and-existing-email-repair).

## Global constraints

- Preserve response envelopes, status codes, receipt accounting, quote retries,
  provider idempotency keys, recipients, templates and send triggers.
- Customer production origin is `https://lodgeflow.app`; staff production origin
  is `https://admin.lodgeflow.app`.
- Preserve bare hostnames, HTTP loopback, explicit HTTP/HTTPS, preview overrides,
  and checkout request-origin fallback when configuration is absent.
- Reject explicit empty or malformed configuration with a typed, redacted error.
  Do not reinterpret paths, credentials, query strings or fragments as origins.
- Resolve new checkout origins before reserving a quote. Preserve reuse of an
  already-open provider session and existing ownership/payability denials in all
  three checkout families; reservation checkout uses a lazy `getReturnUrl` input.
- No new dependencies, live sends/charges, seeding, storage migration or #139 work.
- Phase 4 browser acceptance and Phase 6 remain independently tracked.

## Review focus

- Invalid URL configuration must not freeze a new quote or create a Stripe session.
- Both dining and experience checkout must retain owner scoping and route shape.
- Configured origins must not inherit request query strings or use the staff host.
- Missing/invalid provider configuration must remain lazy and safely retryable.
- Email delivery failures must preserve durable payments and retry markers.

## Task 1: Customer origin boundary and checkout migration

**Files:** `apps/customer/lib/url.ts`, `config/site.ts`,
`app/api/payments/create-checkout/route.ts`, `lib/reservation-checkout-route.ts`,
`__tests__/lib/url.test.ts`, `__tests__/api/create-checkout.test.ts`, and new
`__tests__/api/reservation-checkout.test.ts` (all relative to `apps/customer`).
Final review also updates `packages/database/src/reservation-stripe.ts` and its
real-Mongo tests to defer URL resolution until after open-session/owner checks.

**Interfaces:** Retain `normalizeBaseUrl(url: string): string`; add
`ApplicationOriginConfigurationError` and
`getCustomerOrigin({ requestOrigin }?: { requestOrigin?: string }): string`.
Precedence is explicit `NEXT_PUBLIC_APP_URL`, request origin, production default.

- [x] Run the existing URL, checkout, email sender and provider-failure tests as
      characterization before changing production code.
- [x] Add regressions for empty/credential/path/query/fragment/non-HTTP origins,
      the admin host, normalization, default/override/fallback precedence, and
      unchanged denied/open-session checkout behavior. Run and observe failures.
- [x] Add reservation checkout route tests for both kinds: exact return URL,
      local/preview configuration, absent configuration, denied auth, typed domain
      error, safe unexpected error, and no new quote/provider session on bad config.
- [x] Implement the boundary, migrate metadata and all checkout consumers, and
      validate new origins before quote writes. Change shared reservation checkout
      from `returnUrl: string` to `getReturnUrl: () => string` and migrate all callers.
- [x] Run the affected customer tests and customer TypeScript check; expect pass.

## Task 2: Existing provider and HTTP contracts

**Files:** new provider lifecycle tests in each app; existing
`scripts/http-smoke/run.mjs` and `docs/refactoring/http-smoke.md` if coverage needs
extension. Existing sender tests and webhook tests remain the source of truth.

**Interfaces:** Existing `getResend(): Resend`, sender selection and checkout
provider payloads remain unchanged.

- [x] Characterize both real Resend wrappers: import without secrets, failure at
      first use without a key, successful retry after configuration, singleton reuse.
      Do not send email or replace the SDK constructor with a no-op mock.
- [x] Exercise current sender invalid-configuration and provider-rejection tests.
      Verify delivery markers/idempotency and committed accounting remain protected.
- [x] Extend real HTTP assertions for dining/experience return origins where
      missing; preserve the existing cabin payload and failure/retry assertions.
- [x] Run the isolated HTTP gate with disposable MongoDB and controlled providers.

## Task 3: Reconcile evidence, validate and deliver a reviewable PR

**Files:** `AGENTS.md`, `apps/customer/.env.example`, `docs/refactoring/plan.md`,
`inventory.md`, `phase-4-ui-state.md`, new `phase-5-provider-origins.md`, and the
local ignored `progress.md`. Preserve historical delivery evidence in the tracker.

- [x] Record PR #190/#194/#195 delivery and keep Phase 4 full-browser acceptance
      unresolved until independently supported. Record current Phase 5 work honestly.
- [x] Document URL precedence, intentional validation fixes, audited link/sender
      sites, existing delivery evidence and verification limits.
- [x] Run frozen installation, formatting, read-only lint, all package tests,
      both app type checks, HTTP smoke, both app/shared builds and `git diff --check`.
- [x] Obtain a fresh whole-branch review and fix actionable in-scope findings.

**Delivery:** Commit, push and open a PR under #150 after the required checks
pass. Update the tracker/milestone status without closing #150 or the milestone.

The user authorized continuing the existing milestone. This slice ends at a
reviewable Phase 5 PR; merging requires approval of that concrete PR.
