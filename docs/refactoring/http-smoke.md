# Isolated HTTP smoke gate

Run from the repository root with Node 22 and pnpm 11.17.0:

```sh
pnpm install --frozen-lockfile
pnpm test:http
```

The command first verifies that the HTTP assertions reject injected errors,
redirects, HTML, malformed JSON and timeouts. It then starts a disposable MongoDB
replica set, local provider fixtures, and both actual Next.js applications. The
`http-smoke` CI job runs the same command alongside the existing tests/builds.
Local execution needs permission to open listeners and may need the MongoDB
Memory Server binary download. No application credentials are required.

## What runs for real

- Next.js routing and both original `proxy.ts` files, using Webpack development
  compilation with isolated output in a temporary workspace.
- The actual Clerk SDK verifies RSA-signed Bearer sessions using a local JWKS
  endpoint. Missing, expired and tampered sessions are rejected. The local Clerk
  backend fixture supplies users and current organization membership; membership
  revocation, MongoDB StaffAccess assignments and application permissions remain
  independently enforced. No auth bypass flag or replacement `auth()` is used.
- Shared Mongoose schemas, pricing, booking lock, checkout quote writes, payment
  settlement, settings writes and audit persistence against disposable MongoDB.
- The real Stripe webhook signature verifier, with locally signed payloads.
- The installed Resend SDK and `@react-email/render` template rendering, with
  transport intercepted before live delivery.

Hosted Clerk login, browser cookies/session refresh, and production identity
configuration are not exercised. This is real SDK token verification against a
controlled identity provider, not evidence of a hosted Clerk browser E2E run.

## Controlled boundaries and safety

The runner copies app source into a temporary workspace and excludes `.env*`,
existing `.next` output and dependency directories. Installed dependencies are
linked read-only by convention; source configuration is never modified. The child
environment uses an explicit allowlist plus throwaway configuration. Database and
provider URLs always come from local fixtures; app `.env.local` cannot redirect
this test toward production.

Only copied Next configs alias Stripe and Resend to controlled fixtures. Stripe
operations return deterministic responses while signature verification uses the
installed SDK. The Resend fixture subclasses the installed SDK and intercepts its
`post` transport: React rendering remains real, so a missing renderer or template
failure cannot be hidden by a no-op send double. Email payloads are recorded and
return controlled success/failure through the loopback server. Unsupported
operations fail. These email/payment paths cannot make live sends or charges.

Production link assertions use `https://lodgeflow.app`; admin configuration uses
`https://admin.lodgeflow.app`. HTTP requests themselves use local origins. Resend's
already-configured production domain needs no setup for this test. Sender selection
uses `@lodgeflow/email` and the approved payment/notification defaults. Live provider
acceptance and inbox receipt remain separate Phase 5/#132 checks; local success is
not evidence of delivery. See [the inventory](inventory.md#phase-5-implementation-existing-sender-repair-132)
for the separately authorized live checks and their limits.

## Failure detection and cleanup

Every JSON request has a timeout, an exact expected status, content-type check,
JSON parsing and case-specific response/persistence assertions. Redirect following
is disabled. The only accepted redirects are explicitly checked Clerk sign-in
redirects for rejected authentication. Readiness text only starts the request
sequence; it cannot pass a smoke case.

App startup is bounded at 90 seconds and each request at 60 seconds, including
first-use route compilation. The CI job has a 15-minute outer deadline. App logs
are bounded in memory and printed on failure with the control secret redacted.
The runner stops Next processes, disconnects Mongoose, stops the replica set,
closes the provider server and deletes copied output in `finally`, also handling
SIGINT/SIGTERM. SIGKILL or machine termination cannot execute JavaScript cleanup;
CI's disposable worker is the final containment boundary.

**Localhost matters:** Next normalizes numeric loopback URLs to `localhost`.
Clerk propagates auth headers using an internal rewrite. Using a `127.0.0.1`
request/listener with the resulting `localhost` rewrite caused the earlier
proxy-level 500/socket hang-up. The harness consistently binds and requests
`localhost`; fixture servers may use numeric loopback independently.

## Coverage and status

See [the priority matrix](priority-api-matrix.md) for the specific assertions and
existing suites reused by Phase 0C. This bounded gate does not claim all routes or
all production provider behavior are covered. The existing full suite and build
jobs remain required. A local pass does not establish a named-commit CI pass;
record the workflow run after these changes are committed and pushed.

## Sender repair verification (2026-09-20)

`pnpm test:http` passed with actual SDK rendering and intercepted transport.
`pnpm ci:check` passed formatting/lint and 1,207 tests: admin 1,014, customer 165,
database 25 and email 3. Separately authorized live welcome/payment-confirm route
checks were accepted by Resend and reported `delivered`; those checks used
synthetic identity/booking dependencies and do not prove the deployed application
flow. User inbox confirmation and deployed-SHA verification remain pending.
