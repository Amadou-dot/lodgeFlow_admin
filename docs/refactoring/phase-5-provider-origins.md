# Phase 5 provider origins and existing email contracts

Status: [PR #198](https://github.com/Amadou-dot/lodgeFlow_admin/pull/198) merged on
2026-11-01 as `79ecabc9ab7bfe9ba2370d98936d45179f4f920f`, from reviewed head
`4275012956e80d06fe6e070acb9353a7ae51aed2`.
Part of [#150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150).
See the [implementation plan](phase-5-provider-origins-plan.md).

## Audited boundaries

| Boundary                                                                  | Contract                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer `config/site.ts`, metadata, sitemap, robots and JSON-LD          | `getCustomerOrigin()` uses `NEXT_PUBLIC_APP_URL` or `https://lodgeflow.app`.                                                                                                                 |
| Customer cabin checkout                                                   | The same resolver receives the request origin as fallback. Success/cancel paths, session placeholder, booking ID and Stripe idempotency key remain unchanged.                                |
| Customer dining/experience checkout                                       | The same resolver supplies the matching customer confirmation path. Ownership stays in the shared domain operation.                                                                          |
| Admin navigation and authorization redirect                               | Staff links are relative to the admin app; `proxy.ts` resolves `/unauthorized` against that app's request URL. The existing customer-site shortcut explicitly opens `https://lodgeflow.app`. |
| Both apps' `components/EmailTemplates.tsx` and customer cancellation HTML | Existing templates contain no application links. No new links or notification features were added.                                                                                           |
| Both `lib/resend.ts` modules                                              | SDK construction is lazy, requires a nonempty key at first use, can recover after missing configuration, and reuses its successful instance.                                                 |
| Ten existing send sites                                                   | Sender selection remains in `@lodgeflow/email`; defaults, overrides, recipients, templates, triggers and idempotency keys are unchanged.                                                     |

## Origin policy and intentional corrections

`apps/customer/lib/url.ts` retains `normalizeBaseUrl` and adds a lazy
`getCustomerOrigin({ requestOrigin })` resolver. Selection order is explicit
`NEXT_PUBLIC_APP_URL`, optional checkout request origin, then the production
customer origin. Metadata has no request fallback. Hosted checkout should set
its public origin explicitly; the request fallback preserves existing local and
preview behavior and is not a new host allowlist.

Bare hostnames use HTTPS; bare `localhost`, `127.0.0.1` and `[::1]` use HTTP.
Explicit HTTP/HTTPS overrides remain supported. Leading/trailing whitespace and
trailing slashes are normalized. URL parsing validates the result, while the
returned text preserves legacy spelling, including explicit default ports, host
case and encoding. Canonical host parsing still rejects the known staff host.
This distinction protects Stripe retries: a retained quote whose original
session response was lost must send the same redirect strings with its existing
idempotency key, including when the quote predates deployment.

Explicit empty values, malformed URLs, embedded whitespace/backslashes,
credentials, paths, queries and fragments now throw
`ApplicationOriginConfigurationError` without echoing configuration. A customer
origin cannot use the known `admin.lodgeflow.app` hostname. Previously these
values could produce broken return URLs, and an empty checkout setting silently
fell back to the request URL while metadata treated it differently.

New cabin origins are validated after the existing ownership/payability and
open-session checks but before a quote is reserved. Invalid configuration cannot
freeze a new quote. Retained open sessions remain reusable; provider failures
still retain their quote for idempotent retries. Reservation checkout supplies
`getReturnUrl: () => string` to the shared domain operation, which resolves it
after ownership/payability/open-session checks and before quote writes. This
preserves existing open-session reuse even when new return-URL configuration is
invalid. Unexpected failures now use the existing server logger. HTTP envelopes
and safe error messages are unchanged.

## Evidence and limits

Initial PR checkpoint at `252ad61`:

- Before production edits: six customer characterization suites passed 85 tests;
  all three shared sender tests passed.
- New regressions failed 36 cases before fixes: 26 URL/metadata/cabin cases and
  10 dining/experience cases. They exposed invalid-origin acceptance and missing
  unexpected-error logging. Supported origins, ownership and retry behavior had
  passing characterizations throughout.
- Focused validation passes 149 customer tests and 48 admin tests. Both real
  Resend wrappers are exercised without invoking their send methods. The customer
  type check passes separately from Jest.
- Expanded `pnpm test:http` passes with real Next routing, signed local Clerk
  identities, disposable MongoDB and controlled Stripe/Resend transport. It
  verifies exact customer return origins for all three checkout families,
  foreign/missing reservation denial without effects, unchanged unpaid receipts
  and open-session reuse. Existing email rendering, sender classification,
  rejection, webhook durability and delivery-marker retry assertions also pass.
- Final review identified the need to preserve reservation open-session reuse
  under invalid origin configuration. Four route regressions and two real-Mongo
  tests failed before the correction. All 24 reservation route tests and 15
  reservation payment database tests pass afterward, including unchanged quote
  snapshots on validation failure, owner denial and existing-session reuse.
- Final `pnpm ci:check` passes formatting, read-only lint and 2,600 tests: admin
  1,590, customer 911, database 96, email 3. Both app `tsc --noEmit` checks and
  separate strict compilation of the new admin test pass. Database `tsc --noEmit`
  includes its tests. The clean build caught a new test's Mongoose union call;
  narrowing the model before the query fixed it, and its 15 tests, lint and type
  checks passed again. No compiler settings or type escapes were added.
- `pnpm test:http` passes again after the shared-domain review correction.
- `pnpm install --frozen-lockfile` and `pnpm build` pass in a clean `/tmp` source
  copy with no app/provider/database credentials and CI's throwaway public Clerk
  key. The offline install initially lacked Husky; the frozen online install
  succeeded with the existing optional sharp source-build warning. Sandboxed
  builds could not fetch existing Google fonts; approved network-enabled builds
  succeeded. Existing static-generation/absent-database diagnostics remain.
- Fresh independent review checked URL canonicalization and adjacent callers.
  Its reservation-boundary concern was corrected with the failing-before/passing-
  after tests above. `git diff --check`, root formatting, explicit new-document
  formatting and all 24 local Markdown links pass. Remote CI/previews belong to
  the PR; these local results do not claim merge or deployment.

Review correction for [the retained-quote finding](https://github.com/Amadou-dot/lodgeFlow_admin/pull/198#issuecomment-6548916210):

- Seven new URL regressions failed before the fix because parsing rewrote ports,
  host case/encoding or IPv6 spelling. The HTTP gate independently reproduced a
  500 when a retained cabin quote retried a pre-deployment accepted payload with
  different redirect strings under the same idempotency key.
- Validation now preserves legacy URL text. The parsed hostname still rejects
  encoded, mixed-case and trailing-dot variants of the staff host. All 134
  focused URL/metadata/checkout tests pass after the correction.
- The expanded HTTP gate passes for cabin, dining and experience recovery of
  pre-deployment sessions with lost responses. Its controlled provider rejects
  changed parameters under the same key; fixtures use the literal legacy
  `https://lodgeflow.app:443` origin. Receipts remain unpaid and quote tokens and
  amounts remain intact.
- Fresh `pnpm ci:check` passes formatting, read-only lint and 2,610 tests: admin
  1,590, customer 921, database 96, email 3. Customer TypeScript and all clean-copy
  builds pass. No dependency changes required another install. These local
  results supplement the initial PR evidence above; current CI/preview evidence
  is recorded on the PR.
- The PR description uses an ongoing-tracker reference. GitHub reports no
  automatic issue closures. The PR template now warns that negating a closing
  keyword does not prevent GitHub from recognizing it.

## Delivery

All five [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/41325115321)
passed at the merge SHA. Both exact-SHA production deployments are Ready:
customer `dpl_GmaB2dkZxz9cq2eD4FeHrp8KfKj6` and admin
`dpl_HHCA5gcNysq24QYfjdHBKbQs7v5R`. Project roots remain `apps/customer` and
`apps/admin`, with shared workspace sources enabled. Production aliases point to
these deployments: `lodgeflow.app` / `www.lodgeflow.app` and `admin.lodgeflow.app`.
Read-only smoke checks returned 200 for the customer home/catalog and admin
sign-in; the unauthenticated admin cabin API redirected to Clerk as expected.
Issue #150 and milestone #2 remain open.

The sender repair and separately authorized delivery/inbox evidence in #155/#132
remain historical evidence; this slice sends no live email and performs no live
payment or database mutation. Hosted login and full browser workflows were not
rerun. Phase 4 browser acceptance and Phase 6 remain open. #136/#139 stay excluded.
