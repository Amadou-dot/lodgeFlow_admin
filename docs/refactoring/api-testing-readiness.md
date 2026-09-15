# API testing readiness

**Historical investigation.** The Phase 0 implementation subsequently resolved
the local HTTP setup problem and added the passing isolated gate described in
[http-smoke.md](http-smoke.md). Keep the findings below as the original evidence;
current review/CI status is tracked in
[#150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150).

Checked on 2026-09-15 at `07670932f0b8349fa826802a6ee27f20b3501908`.
This is a local execution report, not production verification or a full test run.

## Result

Agents can execute existing route-handler tests and real MongoDB integration tests.
They do not currently have demonstrated end-to-end HTTP coverage for all endpoints.
A passing handler suite cannot establish that Next.js routing, Clerk middleware,
external providers, or deployed configuration work together.

| Check actually run              | Result                              | What it establishes                                                                                                                                                            |
| ------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin integration API selection | 11 suites, 150 tests passed         | Route handlers with disposable MongoDB; most auth/provider calls mocked. Staff-access tests also exercise real application permission resolution with mocked Clerk membership. |
| Customer payment webhook suite  | 1 suite, 8 tests passed             | Handler behavior and real Stripe signature verification using synthetic signatures; persistence, settlement and email mocked.                                                  |
| Shared database suite           | 25 tests passed                     | Shared schema, payment, settlement and capacity behavior against disposable MongoDB instances.                                                                                 |
| Customer HTTP smoke check       | Unresolved: timeout/proxy-level 500 | No passing HTTP endpoint result was established.                                                                                                                               |

The test selections were run with Node 22.23.2. No production endpoint was probed,
no live database was used for fixtures, and no real payment or email was requested.
Temporary HTTP-test server/database processes were stopped afterward.

## Reproducible handler test commands

Normal workspace commands:

```sh
pnpm --filter @lodgeflow/admin exec jest --selectProjects integration --testPathPatterns=integration/api --runInBand
pnpm --filter @lodgeflow/customer exec jest --runInBand --testPathPatterns=__tests__/api/payment-webhook
pnpm --filter @lodgeflow/database test
```

In this agent environment, `pnpm exec` failed with `unable to open database file`.
The installed test runners worked directly. These are the successful fallback
commands, each run from the indicated directory:

```sh
# apps/admin
/home/yzel/.nvm/versions/node/v22.23.2/bin/node node_modules/jest/bin/jest.js --selectProjects integration --testPathPatterns=integration/api --runInBand

# apps/customer
/home/yzel/.nvm/versions/node/v22.23.2/bin/node node_modules/jest/bin/jest.js --runInBand --testPathPatterns=__tests__/api/payment-webhook

# packages/database
/home/yzel/.nvm/versions/node/v22.23.2/bin/node node_modules/tsx/dist/cli.mjs --test tests/*.test.ts
```

The default sandbox denied local socket binding (`listen EPERM`), so MongoDB tests
required execution permission outside that restriction. Once permitted, both the
admin API and database selections passed. The MongoDB binary was already cached;
a fresh agent environment may additionally need permission to download it.

## Coverage gaps

A static inventory found direct test imports for **17 of 36 admin route files**
and **1 of 31 customer route files**. This counts route files, not HTTP methods,
branches or assertions; it is not a coverage percentage. Shared-helper and hook
coverage does not replace calling the corresponding route handler.

Examples without direct route-test imports:

- Customer cabin checkout creation, bookings CRUD/history, public cabin routes,
  payment lookup, Settings and email routes.
- Admin customer routes, dashboard/reporting, several stats/calendar routes,
  reservation payment routes, and email routes.

The existing CI runs Jest/Node tests and builds. No checked-in HTTP/E2E smoke runner
was found. Customer Jest declares coverage thresholds, but CI's normal test command
is not a coverage run. No route-by-method completeness gate was found.

The user-excluded #136 dining coverage program and #139 notification system remain
outside this work. Regression tests required by an actual refactor still apply.

## Outstanding HTTP and provider verification

The exploratory HTTP setup used a disposable MongoDB, dummy Clerk credentials,
disabled Stripe/Resend credentials and local loopback addresses. It did not use
real authenticated sessions.

- The initial development-server check encountered a Turbopack persisted-cache
  panic (`Failed to restore task data`, `ArrayLengthMismatch`).
- A retry through the standard Next.js CLI with `--webpack` reached readiness,
  but `/api/cabins` timed out or produced a non-JSON proxy-level 500/socket reset.
  An independent loopback `curl` timed out after 12 seconds with no response bytes.
- The first custom-server attempt also had a temporary port mismatch, which was
  corrected before the CLI retry. None of these attempts establish a production
  application defect. The remaining proxy/timeout cause was not diagnosed.
- Both apps' `.env.local` files contain MongoDB, Clerk, Stripe and Resend settings;
  admin also has a staff organization setting. Values were not printed. Presence
  does not prove validity, test-mode safety, or usable test identities. No app-local
  `.env.test` or `.env.test.local` was present.
- `lodgeflow.app` is already configured in Resend according to the user. Domain
  verification is not a blocker. Real send-path delivery was not tested.

## Recommended gate before refactoring API flows

1. **Make the HTTP harness reliable first.** Use isolated build output, a disposable
   MongoDB replica set and fixed readiness/request timeouts. Diagnose the local
   proxy/cache failure without changing application security behavior. A server
   being ready is insufficient; require a known endpoint/body assertion.
2. **Separate deterministic tests from real-provider checks.** Keep normal route
   tests credential-free with mocked provider clients, but exercise application
   permissions. For authenticated HTTP checks, provision known test customers and
   staff roles in a dedicated Clerk test setup, with auth bypass disabled. Do not
   assume an existing key or production staff account is a safe fixture.
3. **Track routes and methods.** For each changed endpoint, identify its test and
   cover valid requests, malformed input, unauthenticated/unauthorized access,
   missing resources, and applicable conflict/provider/database failures. Check
   response JSON and database effects, including absence of effects on failure.
4. **Protect side effects.** Test duplicate payment/webhook requests and injected
   provider failures. Verify that failures cannot be reported as successful delivery
   or duplicate charges, and that best-effort email does not undo committed receipts.
5. **Run smoke checks in CI.** Start both apps with isolated data/configuration;
   cover a public customer read, authenticated customer booking/checkout with a
   test provider, denied foreign access, and a permitted/denied staff operation.
   Fail on timeout, unexpected redirect, non-JSON response, wrong envelope or
   unexpected write. Do not use production seeding to establish readiness.
6. **Verify production detection separately.** Repo logging exists, but logging
   alone is not an alert. Confirm deployed error monitoring/request failure alerts
   and Stripe/Resend event visibility. Tests cannot guarantee providers never fail
   after deployment; the deployment's current monitoring was not inspected here.

Live sends, payment-provider mutations and external configuration changes need a
concrete test task, a known test target and authorization. Preparing an isolated
harness and deterministic regression tests does not require using live services.
