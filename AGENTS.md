# Agent guide

## Mission: incremental refactoring

This project is in a refactoring phase. **Do not add new features until the
refactoring is complete**, unless the user explicitly changes that direction.
Make functions easy to use correctly and hard to use incorrectly.

Complete the Phase 0 baseline, HTTP smoke harness and high-risk regression gates
in `docs/refactoring/plan.md` before substantive refactoring. Add characterization
tests for intended behavior before each later slice; do not preserve known bugs
or chase a blanket coverage percentage.

- Work in small, reviewable slices. Follow the affected path from schema/model
  through service, route, hook, and UI before changing a contract.
- Preserve observable behavior, API contracts, persisted data, authorization,
  accounting, and concurrency guarantees. Separate intentional bug fixes or
  migrations from mechanical cleanup and explain their behavior changes.
- Apply the standards below to new code and the responsibility being refactored.
  Existing violations are debt, not precedents. Avoid unrelated rewrites, bulk
  formatting, framework migrations, and speculative abstractions.
- Finish each slice: update callers, remove obsolete code, run relevant checks,
  and update documentation. Record remaining debt with concrete paths; do not
  turn a local cleanup into an unbounded rewrite.
- Preserve unrelated working-tree changes. Inspect `git status` before editing.

## Scope and source of truth

This file covers the entire workspace. All paths below are relative to the repo
root. Apply any more-specific `AGENTS.md` when working beneath it.

Use source code, package manifests, configuration, and tests to verify claims in
documentation. `apps/admin/CLAUDE.md` and `apps/customer/CLAUDE.md` contain useful
context and stale instructions; the corrections and refactoring standards here
take precedence over their conflicting examples. Do not copy a pattern solely
because it already exists. Keep this guide current when verified contracts change.

## Workspace map

Production domains: `lodgeflow.app` is the customer site;
`admin.lodgeflow.app` is the admin portal. Use the matching origin for each app's
links and redirects. See `docs/refactoring/plan.md` for the phased refactoring
plan and existing-issue triage; issues #136 and #139 are outside that effort.

| Area                           | Responsibility                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `apps/admin`                   | Staff dashboard, administration APIs, permissions, audit logging                    |
| `apps/customer`                | Public browsing, customer reservations, checkout, Stripe webhook                    |
| `packages/database/src/models` | Shared Mongoose schemas and model interfaces                                        |
| `packages/database/src`        | Shared pricing, receipts, settlement, capacity, booking locks, connection and enums |
| `docs`                         | API/operations documentation, issue and PR templates, historical plans              |

- Both apps use Next.js 16 App Router, React 18, TypeScript, HeroUI v2,
  Tailwind CSS v4, Clerk, and Zod v4. Persistence is MongoDB/Mongoose.
- Admin hooks commonly use SWR for reads and TanStack Query for mutations;
  customer hooks commonly use TanStack Query for both. Preserve and test the
  relevant cache invalidation behavior when refactoring mutations.
- `@/` resolves within each app. Import shared models/helpers through
  `@lodgeflow/database` or subpaths declared in its `package.json` exports.
  App-local connection/pricing/lock files include compatibility re-exports.
  There is no app-local `models/` directory.
- Keep database and provider runtime code on the server. Use `import type` for
  type-only dependencies. Client components should consume explicit serializable
  data shapes, not Mongoose documents.
- Both Next configs transpile `@lodgeflow/database` and trace from the workspace
  root. Preserve this configuration when moving shared code.

## Code style and type safety

These are refactoring requirements; they are not claims that the legacy code
already complies.

### Function contracts

- **No adjacent positional parameters of the same type.** Replace ambiguous
  strings, numbers, or booleans with a named options object. For example, migrate
  `paymentSummary(totalPrice, depositAmount, payments)` toward
  `paymentSummary({ totalPrice, depositAmount, payments })`, updating every caller.
  The latter is a target signature, not the current API.
- **No boolean parameter trains.** Use tagged options such as
  `{ action: 'update', changes } | { action: 'cancel' }` instead of a `cancel`
  switch paired with loosely related arguments. Independent choices such as
  breakfast and parking may remain named booleans in an options object.
- **One canonical representation per boundary.** Do not accept dates as
  `string | Date | number`, or identifiers interchangeably as a slug, database
  ID, or Clerk ID. Parse transport strings at the boundary; use validated `Date`
  values in date calculations and explicit strings in JSON DTOs (data transfer
  objects). Keep calendar dates distinct from timestamps; preserve existing
  timezone and stay-length semantics during cleanup.
- Framework-required callback signatures are external contracts. Adapt them to
  explicit internal inputs rather than changing the framework signature.

### Validation and errors

- Treat request bodies, query strings, provider payloads, and cache entries as
  untrusted. Parse with the relevant app's Zod schemas in `lib/validations` and
  infer input/output types from those schemas.
- Put cross-field rules that depend only on the payload in `.superRefine()` or
  `.refine()`, with errors attached to the relevant fields. A successful parse
  must not require a forgotten `assertParsedInput()` afterward.
- Rules needing current database state (ownership, capacity, Settings, payment
  balance) belong in the server domain operation and its lock/transaction where
  required. A Zod schema cannot establish availability or authorization.
- Build explicit allowlisted updates from parsed data. Do not spread raw request
  bodies into MongoDB updates; reject operator keys, dotted paths, immutable
  fields, and server-owned pricing/payment fields.
- Use typed domain errors and `instanceof`, not message comparisons or sentinel
  strings. Existing examples include `BookingPricingError`, `BookingPaymentError`,
  `BookingRuleError`, `ReservationRuleError`, and `CabinBookingLockTimeoutError`.
  Preserve working error prototypes under the admin's ES5 compilation target.
- Catch `unknown`, narrow it, and map known errors to the existing HTTP contract.
  Log unexpected server failures with the server logger and return a safe message.
  Do not expose raw database/provider exceptions or secrets to clients.

### Data and state types

- **Never use `as unknown as T` to satisfy a type**, including test fixtures.
  Construct the correct object, validate it, narrow the dependency, or fix the
  boundary type. Use `satisfies` for checked object construction where useful.
- **No `any` in database transformations.** Use the shared Mongoose interfaces,
  typed query/populate results, explicit aggregation result types, and small
  DTO builders. A generic annotation alone does not validate runtime data.
- Distinguish hydrated documents, lean results, populated references (including
  missing references), and serialized responses. Do not claim that JSON has
  document methods, ObjectIds, or live `Date` objects. Existing model interfaces
  often extend `Document`; do not pass that burden into UI props or plain fixtures.
- **No `(x as Record<string, unknown>)[field]` loops over typed domain objects.**
  Use explicit construction or a typed field map tied to schema/model keys.
  `Record<string, unknown>` is appropriate for genuinely unknown boundary data,
  followed by validation, not for erasing a known type.
- **Do not introduce `field?: T | null`.** Choose optional absence or explicit
  nullability. If a legacy PATCH distinguishes omission (unchanged) from `null`
  (clear), preserve that wire contract in its boundary adapter and normalize to
  an explicit internal operation; do not silently remove a supported behavior.
- Tighten strings to actual unions: derive statuses/categories from shared
  constants in `packages/database/src/config.ts`; use `StaffRole` and `Permission`
  from `apps/admin/lib/permissions.ts`. Preserve domain-specific differences.
- Represent mutually exclusive component states with discriminated unions,
  e.g. `{ kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string }`.
  Keep independent state independent and derive values available from query state
  instead of maintaining duplicate booleans.
- Preserve response envelopes, pagination and status codes during a type cleanup.
  Admin `lib/api-utils.ts` already has a discriminated `ApiResponse<T>`; other
  response declarations and routes are inconsistent and need deliberate migration.

### Money: preserve units and accounting

**Verified current contracts:**

- Shared prices and cabin payment `amount` values are numeric major currency
  units. `booking-payments.ts` supplies `roundMoney`, `paymentSummary`, and
  `addBookingPayment`.
- Dining/experience receipts and reservation checkout use integer `amountCents`;
  their `totalPrice` remains in major units. See `reservation-payment-state.ts`,
  `reservation-payments.ts`, and `reservation-stripe.ts`.
- `apps/admin/utils/utilityFunctions.ts` exposes `formatCurrency` for major-unit
  values. Do not feed cents directly into it. Stripe conversions belong at the
  provider boundary, not scattered throughout renders.

**Refactoring target:** money carries its unit in its type. Introduce shared,
validated branded types (for example `Cents` and `MajorCurrencyAmount`) and named
conversion/formatting functions when taking on a money slice. Validate finite
values, safe integer cents, supported precision, and the operation's sign rules.
Reject sub-cent input where the contract requires exact cents; distinguish that
from an explicit business rounding rule. Keep unit casts inside validated
constructors. Use typed money errors and translate them at route boundaries.

Do not silently reinterpret existing numeric fields, change deposit rounding, or
migrate storage as part of a type-only edit. Inventory all readers/writers across
both apps, characterize current rounding, and plan compatibility and reconciliation
before a storage change. This repo has no Prisma/`decimalToCents`/cart action error
framework from the supplied philosophy; do not invent imports for those examples.

## Domain invariants to preserve

### Authorization

- Admin authorization combines the configured `LODGEFLOW_STAFF_ORG_ID`, current
  Clerk membership, MongoDB `StaffAccess`, and the application permission matrix.
  Roles are `front_desk`, `manager`, and `admin`. Clerk organization administrator
  status or editable user metadata alone does not grant application permissions.
- Use `requireApiAuth({ permission })` in admin routes. Omission currently means
  application administrators only; making a permission explicit must not
  inadvertently widen access. Check `lib/staff-access.ts` and `lib/permissions.ts`.
- Both apps use `proxy.ts`. Proxy/UI checks do not replace route authorization.
  Customer operations derive the customer ID from server-side Clerk auth and scope
  reads/writes to that customer; foreign resources return 404 as existing routes do.
- The customer webhook is `/api/payments/webhook`; verify the Stripe signature on
  the raw body. Its proxy exemption does not make the handler unverified.
- `TESTING_AUTH_BYPASS` is server-only and disabled in production;
  `NEXT_PUBLIC_TESTING` is a client UX flag, not authorization. Keep bypasses local.

### Availability, pricing, and receipts

- Keep cabin overlap check-and-write operations inside `withCabinBookingLock`.
  `Booking.findOverlapping()` alone is insufficient. The lock model is private;
  preserve its token-aware release and public wrapper, rather than exporting raw
  lock CRUD. Keep critical sections short; the lock has a finite lease.
- Dining/experience capacity operations in `reservation-capacity.ts` use a
  transaction that writes the shared catalog's `reservationVersion` to create
  contention. Preserve this write and session propagation; read/count alone is
  insufficient. Dining capacity is per date/seating; experience capacity is per
  day, with `timeSlot` descriptive in the current implementation.
- Compute cabin prices and deposit requirements server-side from Cabin and
  Settings through `calculateBookingPricing` and `calculateDepositAmount`.
  Client-selected extras are choices, not trusted fee amounts.
- `depositAmount` is the obligation, **not money received**. Cabin `payments`
  receipts determine `amountPaid`, `remainingAmount`, `isPaid`, and `depositPaid`.
  Unpaid quotes may recompute deposits; payment or active checkout blocks repricing.
- Preserve receipt idempotency, mismatched-retry rejection, overpayment/refund
  limits, quote token/amount/currency checks, and optimistic-concurrency retries.
  Use existing shared payment/settlement operations instead of direct flag writes.
  `ProcessedStripeEvent` is useful deduplication, not a substitute for idempotent
  settlement under concurrent events.
- Legacy paid reservations without receipts require reconciliation; do not invent
  refundable receipt history. Preserve pending-checkout/refund and cancellation
  guards when reorganizing reservation code.
- Preserve audit attribution, field allowlists and redaction through
  `apps/admin/lib/audit.ts`. Audit recording currently logs failures without
  rolling back a successful operation; do not describe it as transactional.

## Commands and validation

Run workspace commands from the repo root. CI pins **Node 22 and pnpm 11.17.0**
(`.github/workflows/ci.yml`). Use pnpm and the committed `pnpm-lock.yaml`; preserve
the `@internationalized/date` override in `pnpm-workspace.yaml`, which prevents
incompatible duplicate date-picker types.

| Purpose                                   | Command                                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Install                                   | `pnpm install --frozen-lockfile`                                                                    |
| Admin dev                                 | `pnpm dev:admin`                                                                                    |
| Customer dev on a separate port           | `pnpm --filter @lodgeflow/customer dev --port 3002`                                                 |
| Admin without MongoDB tests               | `pnpm --filter @lodgeflow/admin test:fast`                                                          |
| Admin integration tests                   | `pnpm --filter @lodgeflow/admin test:integration`                                                   |
| Customer tests                            | `pnpm --filter @lodgeflow/customer test`                                                            |
| Database tests                            | `pnpm --filter @lodgeflow/database test`                                                            |
| One Jest subset                           | `pnpm --filter @lodgeflow/admin exec jest --selectProjects unit --testPathPatterns=booking-pricing` |
| Workspace format/lint/tests               | `pnpm ci:check`                                                                                     |
| Read-only app lint                        | `pnpm --filter @lodgeflow/admin exec eslint .` (substitute `customer` as needed)                    |
| App type check                            | `pnpm --filter @lodgeflow/admin exec tsc --noEmit` (substitute `customer` as needed)                |
| All builds, including database type check | `pnpm build`                                                                                        |

- App `lint` scripts use `--fix`; use `exec eslint .` for verification.
  Root `ci:check` is read-only but **does not include builds**. CI runs formatting,
  read-only lint, tests, and build separately for admin, customer, and database.
- Run `pnpm test:http` for the isolated HTTP gate as well. It starts disposable
  app copies and MongoDB, uses real Clerk signature verification against local
  test identities, and controls external payment/email responses. See
  `docs/refactoring/http-smoke.md` for commands and limitations; this does not
  exercise hosted Clerk login or live provider delivery.
- Admin Jest has unit, integration and jsdom projects. Integration uses
  `MongoMemoryReplSet` and one worker; preserve isolation/serialization. Customer
  uses Jest/jsdom. Database uses `tsx --test` with Node's test runner and real
  in-memory MongoDB servers, including replica sets for transactional tests.
- MongoDB Memory Server may need a binary download and permission to start local
  processes/listeners. Use disposable databases. Never substitute a live database
  to make a test pass. Admin `test:fast` does not validate database behavior.
- Use existing admin factories in `__tests__/setup/factories.ts` and the app's
  test setup/mocks. Test observable behavior and boundaries; use actual Mongoose
  documents for document behavior and typed DTO factories for component tests.
- Passing Jest is not proof of type safety: admin node projects disable ts-jest
  diagnostics, and admin `tsconfig.json` excludes tests and scripts. Run relevant
  type checks and builds separately; do not weaken compiler/lint rules to pass.
- For a behavioral refactor, add characterization/regression coverage where it
  protects meaningful behavior, then run the affected suite and type check.
  Shared schema/domain changes require database tests and both app suites/builds.
  Cover invalid inputs, denied access, duplicate requests and concurrent writes
  when those contracts are affected. UI changes need relevant component and
  interaction checks. Documentation-only changes need formatting and path checks.
- Builds need a Clerk publishable key for prerendering. CI supplies a throwaway
  public key in its workflow; use that setup for credential-free build validation.
  Keep Stripe/Resend clients lazy so builds do not require their secrets.
- Report actual commands/results and distinguish failures from blocked or unrun
  checks. Do not claim browser E2E, a clean baseline, or a passing full suite based
  on static inspection or a subset. Fix in-scope failures; describe pre-existing
  failures without hiding them or expanding into unrelated repair work.

## Operational discipline

- Configure app-local `.env.local`; inspect variable names in code and the customer
  `.env.example`. Admin staff access requires `LODGEFLOW_STAFF_ORG_ID` in addition
  to Clerk keys and `MONGODB_URI`. Never print or commit secret values.
- `pnpm seed` and `/api/cron/seed` reset demo data; they are not ordinary validation
  commands. The cron endpoint requires `SEED_SECRET` bearer authentication even
  though it is exempt from Clerk. Do not run seeding, bootstrap, backfills, live
  Settings edits, or provider mutations without explicit scope and a known target.
- Use the existing server logger. Preserve lazy provider setup and optional Redis
  handling. Admin rate limiting/cache can fall back to process-local state; that
  fallback is not a distributed correctness mechanism for reservations/payments.
- Format touched files with the root Prettier config. Follow each package's ESLint
  config; do not assume their rule sets are identical.
- Before creating an issue or PR, read `docs/issues_template.md` or
  `docs/pull_requests_template.md`. Include the concrete problem, final scope,
  and actual validation. Run the required checks before opening a PR; if blocked,
  finish reviewable local work and report what prevents satisfying the gate.

## Verified corrections to older guidance

Checked against source/configuration on 2026-09-15; reverify when touching an area.

| Older claim/example                                                  | Current evidence and instruction                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| App-local `models/` or `@/models` imports                            | Shared models and package exports live in `packages/database`; import from the workspace package.                                         |
| `depositAmount` accumulates payments and is always frozen on update  | `booking-payments.ts`, `models/Booking.ts`, and admin booking routes separate required deposit from receipts and permit unpaid repricing. |
| `ProcessedStripeEvent` is unexported/unused; webhook work is absent  | Exported in `packages/database/src/index.ts`; used by `apps/customer/app/api/payments/webhook/route.ts`.                                  |
| Staff organization configuration is optional for normal admin access | `apps/admin/lib/staff-access.ts` fails closed without it.                                                                                 |
| CI covers only both apps; quality script is the entire gate          | `.github/workflows/ci.yml` also covers database and runs builds.                                                                          |
| Cast plain component fixtures through `unknown` into Mongoose models | Refactor props/DTOs and use typed fixture builders; do not perpetuate that customer `CLAUDE.md` advice.                                   |
| Every route returns the same `ApiResponse<T>`                        | Response declarations differ, and webhook responses have their own contract. Inspect route and caller before normalization.               |
| Seed the database to validate ordinary changes                       | Seeding resets data. Use isolated test infrastructure for routine verification.                                                           |

## Suggested sequence for future refactoring slices

1. Separate model/document types from API and UI DTOs; remove double casts in one
   end-to-end flow at a time (`apps/customer/types/index.ts` is a starting point).
2. Replace ambiguous helper signatures and boolean switches, including shared
   payment/reservation helpers; update both apps' callers in the same slice.
3. Consolidate payload validation and typed updates; keep database-dependent
   business rules within their concurrency boundaries.
4. Introduce explicit money units and conversion boundaries with accounting tests;
   treat storage or rounding changes as distinct migrations.
5. Simplify component state and cache synchronization, then consolidate duplicated
   error/response contracts with compatibility tests.

Choose a bounded slice based on risk and dependencies. Completion means preserved
behavior, migrated callers, relevant passing checks, and no newly introduced type
escapes—not merely fewer lines or a broad claim that the codebase is modernized.
