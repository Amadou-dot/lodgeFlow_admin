# Refactoring delivery history through PR #182

Historical snapshot of [tracking issue #150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150),
captured on 2026-10-01 after PR #182 passed main CI and both production deployments
were verified. Use [the plan](plan.md), [the inventory](inventory.md) and the current
tracker for active work and acceptance gates. This snapshot preserves the original
wording, per-commit CI/deployment evidence and verification limits; its remaining-work
statements describe the state at capture time.

<!-- Original tracker body follows unchanged. -->

# LodgeFlow refactoring plan

[Milestone](https://github.com/Amadou-dot/lodgeFlow_admin/milestone/2) ·
[Tracking issue #150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150)

## Current execution status

Phase 0 is complete. Phase 1 has ten merged slices through #168; Phase 2 has
nineteen through #182, plus #174's test-only cache-fixture repair. PR #182 is
merged at `bee9d7b` with all five main CI jobs passing and both production apps
verified Ready at that SHA. Customer/admin welcome-email boundaries are delivered;
admin requests now validate typed payloads and return safe errors while preserving
administrator-only access, rate limiting and existing send behavior. Next is the
named rate-limit key helper (F08), plus preserving the growing delivery history in
the repository. Other DTOs, validation, money, UI and origin checks remain open;
#136/#139 remain excluded. The governing
[repository plan](https://github.com/Amadou-dot/lodgeFlow_admin/blob/main/docs/refactoring/plan.md)
and inventory retain scope and acceptance criteria. This milestone remains open.

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

## Phase 0 execution result

Phase 0A–0C is implemented and independently reviewed in PR #151 at commit
`26d09e363097f77a63a1cd75f7db8de39323ba6c`. All four [CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/34965701942)
passed: admin, customer, database and the new HTTP smoke gate. Both Vercel previews
also passed. PR #151 merged as `3223bd566d2d424b517a196e4dadfbfffff964e7`; PR #152 merged after it as `bddff06c8315785d89c74afe6266cbd76ff3e3c8`. Phase 1 remains in progress.

- Clean frozen-install baseline, formatting/lint, both builds and all existing
  tests passed: 1,014 admin, 141 customer, 25 database.
- The independently rerun HTTP harness passes actual Next routing, real Clerk SDK
  verification against local signed identities, application permissions and real
  disposable MongoDB behavior. Provider/database failures, ownership, receipts,
  refunds, email handling and audit effects are asserted. Failure probes exit nonzero.
- No production route or authorization bypass was introduced. Hosted Clerk browser
  login/session refresh and live provider delivery remain separate deployment checks.
- #133/#134 were already resolved on main and verified; #135's owner-scoped query
  now has the passing no-write/no-provider-call HTTP regression. #132 remains Phase 5;
  #136 and #139 remain excluded.

Evidence: [baseline](https://github.com/Amadou-dot/lodgeFlow_admin/blob/26d09e363097f77a63a1cd75f7db8de39323ba6c/docs/refactoring/baseline.md),
[inventory](https://github.com/Amadou-dot/lodgeFlow_admin/blob/26d09e363097f77a63a1cd75f7db8de39323ba6c/docs/refactoring/inventory.md),
[HTTP harness](https://github.com/Amadou-dot/lodgeFlow_admin/blob/26d09e363097f77a63a1cd75f7db8de39323ba6c/docs/refactoring/http-smoke.md),
[priority matrix](https://github.com/Amadou-dot/lodgeFlow_admin/blob/26d09e363097f77a63a1cd75f7db8de39323ba6c/docs/refactoring/priority-api-matrix.md).

## Phase 1 slice 1 execution result

Implemented by a subagent and independently reviewed in [PR #152](https://github.com/Amadou-dot/lodgeFlow_admin/pull/152), commit `9f30eebea04c25047f21d16607a170e0fc82a469`.
Merged after #151 on 2026-09-15 as `bddff06c8315785d89c74afe6266cbd76ff3e3c8`. The PR was retargeted to `main` and its reviewed diff/checks were verified before merge.

- Customer booking history/detail routes now serialize plain JSON DTOs; read hooks and cabin booking page consumers no longer claim Mongoose document methods.
- Full JSON characterization preserves lean selected fields versus hydrated virtuals, IDs/ISO dates, null cabins, sparse legacy rows, receipt values, ownership and status filters. Real database failures still produce safe errors without writes/provider calls.
- Fixed the related guest-limit typo (`maxCapacity` → `capacity`), with independently verified failing-before/passing-after UI regression.
- Local validation passed: `pnpm ci:check` (1,014 admin + 146 customer + 25 database tests), customer TypeScript, full `pnpm test:http`, clean frozen install and all builds without app secrets. All four [remote CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/34991052394) passed on this commit, and both Vercel previews passed. PR #152 is merged.
- Review found and corrected sparse-row serialization and unsafe generic fixture typing before publication. No outstanding code findings remain; remaining mutation/email/catalog DTO debt is explicitly recorded in the inventory.

## Phase 1 slice 2 execution result

[PR #153](https://github.com/Amadou-dot/lodgeFlow_admin/pull/153), reviewed commit `6dea8868c9aa45226ec14f4067f00cd071003e4d`, completes customer booking create/PATCH boundaries. Merge status: merged on 2026-09-15 as `ea57bd12f52a403d5747af72405b9bcf09e03c8d`.

- POST/PATCH reuse the characterized `BookingDetail` serializer; hooks use schema-derived request types and canonical ISO date strings. Shared changes correct population and payment-helper parameter types without changing accounting or persistence.
- Fixed misleading date/observation edit controls: the booking editor clearly edits guest count and submits only supported fields. Independently verified failing-before/passing-after UI regression.
- Full quality gate passes: 1,014 admin + 147 customer + 25 database tests, formatting and read-only lint. Customer TypeScript, all builds without app secrets and isolated HTTP checks pass. A full-build type mismatch was corrected and all builds rerun successfully.
- HTTP characterization passes on original `bddff06` and refactored routes: full response envelopes, ignored fields, ownership, invalid inputs/capacity, missing IDs and write failure without unintended database/provider effects. Mutation cache invalidations and failure behavior are covered.
- Remote validation: [CI run](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/34995338783). All four jobs passed on the reviewed commit, and both deployment previews passed.

## Phase 1 slice 3 execution result

[PR #154](https://github.com/Amadou-dot/lodgeFlow_admin/pull/154), reviewed commit `42280fef4265477783416346d1ee19517174735d`, completes cancellation/refund response boundaries. Merge status: merged on 2026-09-15 as `458682314f7fa976ff235b7ddf84feab9b288f8f`.

- Cancellation responses serialize `BookingDetail | null`; refund-estimate deadlines explicitly use ISO strings/null. Calculation and cancellation-email inputs are narrowed to actual field dependencies without changing accounting, timezone calculations or provider behavior.
- Fixed foreign refund-estimate disclosure (identical missing/foreign404) and active-checkout cancellation eligibility. Four original valid-output cases pass; both bug regressions fail on original `ea57bd1` and pass after correction. Original HTTP also reproduces the pending-checkout bug.
- Independent validation passes: full quality gate with 1,014 admin + 156 customer + 25 database tests, customer TypeScript, isolated HTTP gate and all builds without app secrets. Hook response fixtures and cache behavior are covered.
- Remote validation: [CI run](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/34998695778). All four jobs passed on the reviewed commit, and both deployment previews passed.

Phase 1 remains in progress. Existing payment/welcome email payload types, checkout population and other resource boundaries remain inventoried follow-ups. #136/#139 remain excluded.

## Phase 1 slice 4 execution result

[PR #156](https://github.com/Amadou-dot/lodgeFlow_admin/pull/156), reviewed commit `0d38d55aaf735b07400d732b22987d6931907c11`, merged with explicit user approval on 2026-09-23 as `79b8d25d1db7894cb8d0853554e701acab51d003`.

- Payment confirmation inputs now contain explicit fields, string IDs and ISO timestamps across the manual route, webhook, helper and template. Both populated-booking double casts are removed; payment accounting and persistence are unchanged.
- Related fixes: deposit emails use the receipt-derived remaining balance after multiple payments; missing cabins return `Cabin not found`/404 for manual confirmation while webhook settlement remains durable without dispatching or marking email delivery. Both regressions failed before correction.
- Preserved latest receipt selection, signed webhook amounts/deposit flags, recipients, subjects, senders, date display, ownership checks, duplicate-event behavior and best-effort delivery.
- Local validation passed: 43 focused checks; `pnpm ci:check` with 1,233 tests (admin 1,014; customer 191; database 25; email 3), formatting/lint; both app TypeScript checks; expanded `pnpm test:http`; clean frozen install and production builds without app/provider credentials using CI's public Clerk key. The baseline optional Sharp installation warning remains non-blocking.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/35904799286) and both previews passed at the reviewed commit. All five [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/35905608944) passed at the merge commit.
- Both production deployments verified Ready at merge `79b8d25d1db7894cb8d0853554e701acab51d003`: customer `dpl_8pMiTcub4iriT8bMMtc4u3fQ6eiB` with `lodgeflow.app`/`www.lodgeflow.app`, admin `dpl_FHwZLoUTSRsxHomSKRhcn1NdyVdg` with `admin.lodgeflow.app`. Project roots verified as `apps/customer` and `apps/admin`.
- Hosted Clerk login and live payment/email operations were not rerun. The HTTP gate uses real application routes/auth/database with isolated identities, disposable MongoDB and intercepted provider transport.

Phase 1 remains in progress. Next bounded candidates are generic cabin confirmation inputs (`app/api/send/confirm/route.ts`, `BookingConfirmationEmail`, remaining `PopulatedBooking`) or checkout populated-cabin typing. Manual email request validation and legacy raw error contracts remain Phase 2/V03; the remaining Phase 5 origin/contract review is separate from closed #132. Issues #136/#139 remain excluded.


## Phase 1 slice 5 execution result

[PR #157](https://github.com/Amadou-dot/lodgeFlow_admin/pull/157), reviewed commit `f53f2160dce211f7dc38611aca18b8c2fedd9fd4`, merged with explicit user approval on 2026-09-23 as `b4459cd06e2265cbdb0a820a36a2a6c57d64e323`.

- Generic cabin confirmation now receives explicit booking/cabin inputs with string IDs, ISO dates and detached extras/amenities. The last `PopulatedBooking` consumer and declaration are removed. Persisted pricing, payment accounting and email triggers remain unchanged.
- Related fixes: deleted cabins return `Cabin not found`/404 before dispatch; the cabin stay subtotal uses saved `totalPrice - extrasPrice` rather than the nightly `cabinPrice`. Both defects have failing-before/passing-after regressions; the real HTTP gate reproduced the three-night $300 stay previously displaying $100.
- Preserved first-email recipient, Guest fallback, notification sender/overrides, subject, date display, all five extras, required deposit and remaining balance, auth/foreign-booking 403, provider retry and no-write behavior.
- Local validation passed: 60 focused checks; `pnpm ci:check` with 1,250 tests (admin 1,014; customer 208; database 25; email 3), formatting/lint; both app TypeScript checks; expanded `pnpm test:http`; clean frozen install and app/shared builds without app/provider credentials using CI's public Clerk key. The optional Sharp installation warning remains non-blocking.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/35909903051) and both previews passed at the reviewed commit. All five [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/35910979830) passed at the merge commit.
- Both production deployments verified Ready at merge `b4459cd06e2265cbdb0a820a36a2a6c57d64e323`: customer `dpl_Bcjrrt5MpSfEg5bjrwyTWyqzLDwR` with `lodgeflow.app`/`www.lodgeflow.app`, admin `dpl_HP5AmVqfmmmkJcvpJwzbVQ7EpWRZ` with `admin.lodgeflow.app`. Project roots verified as `apps/customer` and `apps/admin`.
- Hosted Clerk login and live payment/email operations were not rerun. The HTTP gate uses real routes/auth/database, disposable MongoDB and actual SDK email rendering with intercepted provider transport.

Phase 1 remains in progress. The next bounded candidate is checkout's populated-cabin boundary in `apps/customer/app/api/payments/create-checkout/route.ts`, preserving ownership, active quotes, idempotency and provider retries. Experience/catalog/admin boundaries remain inventoried. Manual email request validation and legacy error envelopes remain Phase 2/V03; issues #136/#139 remain excluded.

## Phase 1 slice 6 execution result

[PR #158](https://github.com/Amadou-dot/lodgeFlow_admin/pull/158), reviewed commit `953f0c92783646336e4663eae11fe5e6df331580`, merged under the user's explicit ongoing authorization on 2026-09-30 as `80a2cc90c7132379517169574990a54854b4ef5a`.

- Checkout uses explicit nullable cabin population for both booking queries. Missing cabins return a clear 404 before new quote writes or provider calls; existing quotes/sessions remain intact. A cabin disappearing during reservation retains the already-written quote without creating a Stripe session.
- Preserved ownership denials, amount/currency selection, full Stripe payload and return URLs, quote contention, session reuse and provider retry keys. Added 24 focused tests; 20 characterization cases passed before runtime edits and four regressions failed before correction. The HTTP gate reproduced the original null-cabin 500.
- Local validation: `pnpm ci:check` passed formatting/lint and 1,274 tests; both app TypeScript checks, expanded `pnpm test:http`, clean frozen install and all builds passed without app/provider credentials using CI's public Clerk key.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36762984859) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36763670779) passed. Both previews were Ready at the reviewed SHA.
- Both production deployments are Ready at the merge SHA: customer `dpl_GBkV9ab8MWKbgPQCE1UnjLHpXL1o` serves `lodgeflow.app`/`www.lodgeflow.app`; admin `dpl_Xs2LCnYCkNZv3dc9nDV5q31SzaWn` serves `admin.lodgeflow.app`. Configured roots are `apps/customer` and `apps/admin`; deployment build logs confirm the matching app routes. Vercel omits rootDirectory from the deployment snapshot, so no snapshot-root claim is made.
- Hosted login and live provider operations were not run. Phase 1 remains open; the next bounded slice is experience-confirmation email inputs. #136/#139 remain excluded.

## Sender activation and delivery verified

PR #155 is merged and both production domains serve the verified merge SHA. The user confirmed receipt of the synthetic $1.00 payment email and receipt/correct rendering of the welcome email. No real charge was made. The #132 sender blocker is resolved; broader refactoring remains in progress.

## Phase 1 slice 7 execution result

[PR #159](https://github.com/Amadou-dot/lodgeFlow_admin/pull/159), reviewed `50903a80761857ffeaea8660344c57c7174abcf7`, merged as `0ec23d4f803c4082f1a5df67e3caf1f2c150f04a` on 2026-09-30. Explicit experience email DTOs/serializers now serve both manual and settlement sends. Missing manual references return 404 after ownership/unpaid guards. Settlement email failures retain one durable receipt and retryable 500, with no delivery/event marker until success; shared dining behavior is preserved.

Local validation: 51 focused checks; `pnpm ci:check` with 1,302 tests, formatting and lint; both app type checks; expanded HTTP gate; clean frozen install and all app/shared builds. No hosted login or live provider delivery. All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36766407060) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36766670826) pass. Both previews and production deployments are Ready at their exact reviewed/merged SHAs. Configured roots and built routes match `apps/customer` and `apps/admin`; production aliases are `lodgeflow.app` / `www.lodgeflow.app` and `admin.lodgeflow.app`.

Phase 1 has seven merged slices and remains open. The next bounded slice follows Phase 2 for these migrated confirmation flows: parse request bodies and return safe errors. Customer catalog/resource aliases and admin boundaries remain in Phase 1. #136/#139 remain excluded.

## Phase 2 slice 1 execution result

[PR #160](https://github.com/Amadou-dot/lodgeFlow_admin/pull/160), reviewed `5a631262d7ccca55d98659ba38ae04fc2ae52b22`, merged as `9d35897f2ac25a7e5cf5d665503d8e812ad37c13` on 2026-09-30. The three migrated customer confirmation routes validate unknown bodies/IDs after authentication and before database access. Intentional fixes return 400 for malformed input and safe logged string-error 500 for server/provider failures, while preserving success IDs, ownership/payment denials, send behavior and booking state.

Local gates pass: 120 focused tests (12 characterization cases passed before edits; 48 regressions failed before fixes), `pnpm ci:check` with 1,364 tests plus formatting/lint, both app type checks, expanded HTTP checks, clean frozen install and all app/shared builds. All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36768066652) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36768366982) pass. Both exact-SHA previews and production deployments are Ready with matching configured roots, built routes and production aliases. No hosted login or live provider delivery.

Next: F01's bounded `paymentSummary` named-input migration across all six call sites, preserving numeric units, rounding and receipt/accounting behavior. Phase 1 catalog/resource/admin boundaries and other Phase 2 flows remain; #136/#139 remain excluded.

## Phase 2 slice 2 execution result (F01)

[PR #161](https://github.com/Amadou-dot/lodgeFlow_admin/pull/161), reviewed `5f44055b53f6bf24d519ad6ada3121710347b63b`, merged as `bf57e712b5472071197426be67b8db2e07ba2c78` on 2026-09-30. `paymentSummary` now takes named total/deposit/receipt inputs; all six runtime/script callers migrated. Calculations, rounding, major-unit numbers, receipt history and response fields are unchanged. The guide reflects the actual signature.

Eight new characterization cases passed before and after; `pnpm ci:check` passes formatting/lint and 1,372 tests, both app type checks, database type check including scripts/tests, HTTP and clean frozen install/all builds pass. All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36769174761) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36769414531) pass. Both exact-SHA previews and production deployments Ready, with matching configured roots, built routes and production aliases. No live providers, seeding or audit against live data.

Next bounded slice: named identity inputs for `updateCustomerBooking`, already listed in the Phase 2 candidate inventory and covered by the completed cabin mutation DTO flow. Money constructors/conversions remain Phase 3; Phase 1 catalog/resource/admin boundaries remain. #136/#139 remain excluded.

## Phase 2 slice 3 execution result (F05)

[PR #162](https://github.com/Amadou-dot/lodgeFlow_admin/pull/162), reviewed `d27017db69717d70ca2592d855c742cd9c636a80`, merged as `dc9b593ade279c7fca293b22682a955bb870f13f` on 2026-09-30. `updateCustomerBooking` takes explicit booking/customer identity and updates; its PATCH caller and all test calls migrated. Ownership/status denials, paid/pending repricing guards, receipt accounting, response/error envelopes and UI cache behavior are unchanged.

Nine database cases pass before/after, including three new denial/no-write and paid-request characterization cases. `pnpm ci:check` passes formatting/lint and 1,375 tests; database and both app type checks, HTTP, clean frozen install and all builds pass. All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36770425926) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36770837180) pass. Both exact-SHA previews and production deployments Ready, matching configured roots, built routes and production aliases. No hosted login or live provider operations.

Next bounded slice: F03 named staff identity inputs, preserving current membership, configured organization, MongoDB assignment and permission checks. The remaining Phase 1 boundaries and other phase requirements stay open. #136/#139 remain excluded.

## Phase 2 slice 4 execution result — staff identity inputs (F03)

- Delivered in [PR #163](https://github.com/Amadou-dot/lodgeFlow_admin/pull/163), reviewed `52c456168c9557a64bfeb8f949a16374ec37b6a5`, merged `cee2226fb22cb6ff646c851829fefbb57f91f60e`.
- Named organization/user inputs replace positional strings; absent Clerk organization normalizes to null at API auth. Current membership, scoped staff assignment, app roles, permission defaults, mutation transactions and response contracts remain unchanged.
- Fifteen characterization cases pass before and after; 88 focused cases pass. Full local formatting/lint and 1,390 tests, both app type checks, new-test type check, HTTP smoke, clean frozen install and all builds pass.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36772338049) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36772643284) pass. Both exact-SHA previews and production deployments are Ready; configured roots, built routes and production aliases verified.
- Production customer `dpl_jXQxPYBd84EXJwZB1S2Kp9CEYVrd`; admin `dpl_AdwcqtsQiSHsV4f2WEdFTYUpsmjm`. Hosted login and live provider operations were not exercised.
- Next bounded slice: T09 cached customer payload/date validation. The milestone remains open; #136/#139 remain excluded.

## Phase 1 slice 8 execution result — customer cache boundary (T09)

- Delivered in [PR #164](https://github.com/Amadou-dot/lodgeFlow_admin/pull/164), reviewed `e3a1b059ec7a529fa72c80afdeca56b3300abb8c`, merged `1fdd52aff1fa8b6ab3c903daba898b63cec8cb48`.
- Validated unknown cached JSON and ISO timestamps replace shape/date assertions. Malformed entries and mismatched identities become per-entry misses; valid batch hits, deleted-user caching, transient failure propagation/counting, TTL/write envelope and in-memory fallback remain intact.
- Six characterization cases passed before runtime edits; all 18 initial regressions failed before and pass after. Full local formatting/lint and 1,415 tests, both app/new-test type checks, HTTP, clean frozen installation and all builds pass.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36773886286) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36774132724) pass. Exact-SHA previews and both production deployments are Ready; configured app roots, built routes and aliases verified.
- Production customer `dpl_DpBb96sPgopowo2SuGSGXy92ddr7`; admin `dpl_D7tHcQDMbbgYGfyYxZ7P4F1eBygQ`. Malformed Redis coverage uses mocked dependencies; HTTP uses the in-memory fallback. No hosted login/live provider operations.
- Next: remove F04's confirmed-unused pagination response helpers. Customer metadata producer validation and broader API/UI DTOs remain inventoried debt. The milestone stays open; #136/#139 remain excluded.

## Phase 2 slice 5 execution result — unused pagination builders (F04 partial)

- Delivered in [PR #165](https://github.com/Amadou-dot/lodgeFlow_admin/pull/165), reviewed `ca44521b3ef99d82d9a7f86bebeff9a3eb6e9143`, merged `8e752de1dcab9ce2be8c9360b2527671625fbba3`.
- Removed two pagination response builders and their unused interface after confirming no runtime consumers/reexports. Removed six obsolete tests; retained active parser, resource response fields and route/hook behavior.
- 120 focused cases passed before; 114 remaining cases pass after. Full local format/lint and 1,409 tests, admin type check, HTTP smoke, clean frozen install and all builds pass. Interrupted full gates were rerun.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36780171843) and [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36780455638) pass. Exact-SHA previews and both production apps are Ready; configured roots, built routes and production aliases verified.
- Production customer `dpl_CH8n6JoW2ED4fv6YaG2STSoDiY3q`; admin `dpl_2v3LbmLifk5B3UHozfy7V7K95H7Y`. No hosted login or live provider operations were exercised.
- Next: checkout request JSON/ID validation, preserving auth, ownership, quote and payment behavior. F04 booking-table status callbacks remain separate debt. The milestone stays open; #136/#139 remain excluded.

## Phase 2 slice 6 execution result — checkout request boundary

- Delivered in [PR #166](https://github.com/Amadou-dot/lodgeFlow_admin/pull/166): reviewed `a83447a54e7d604d2a4c07544914dcfacb96fb53`, merged `cc7bbeb68b89690f2c7319e3534daa880524ccd3`.
- Checkout authenticates first, parses unknown JSON and validates a canonical string booking ID before database/provider access. The hook request is schema-derived; shared JSON reading preserves the three confirmation contracts. Related fixes return 400 for malformed JSON/null bodies and reject numeric IDs previously accepted by the ObjectId helper. Quotes, ownership, payment units and Stripe behavior are unchanged.
- Before changes: 37 focused cases pass, six input regressions fail; HTTP independently reproduces null-body 500. After changes: 154 focused cases and customer type checking pass. `pnpm ci:check` passes formatting/lint and 1,428 tests (admin 1,048; customer 341; database 36; email 3). Expanded HTTP, clean frozen installation and all builds pass.
- All five PR CI jobs ([run 36781424711](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36781424711)) and all five main jobs ([run 36781957487](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36781957487)) pass. Both previews and production deployments are Ready at the exact respective SHAs, with configured app roots, built routes and production aliases verified. Production customer `dpl_9uT9eNo92itWYzmhDyLkWikDZL1M`; admin `dpl_BSikKLBDmw8p4xpqUUXkvpttajQY`.
- HTTP uses real routes, disposable MongoDB and controlled identity/provider boundaries; hosted login and live delivery remain separate. Remaining DTOs, request families, money and UI work stay open; #136/#139 remain excluded.

## Phase 1 slice 9 execution result — payment-status JSON boundary

- Delivered in [PR #167](https://github.com/Amadou-dot/lodgeFlow_admin/pull/167): reviewed `ed699b51e33e1933aa080968225c2f0072f89517`, merged `b74e0670a1b5101847bc50f4c3c8fa889926de86`.
- The endpoint has an explicit JSON projection/serializer, preserving amounts, hydrated defaults, legacy null/omission, ownership and safe failures. The unused payment-status hook and duplicate Date-shaped response type are removed. Related fix: invalid path IDs return 400 after authentication and before database access.
- Eleven characterization cases pass before edits; four regressions fail before/pass after; HTTP independently reproduces the original invalid-ID 500. After: 61 focused tests, customer type checking, full format/lint and 1,443 tests (admin 1,048; customer 356; database 36; email 3), expanded HTTP, clean frozen installation and all builds pass.
- All five PR CI jobs ([run 36782922813](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36782922813)) and main jobs ([run 36783233130](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36783233130)) pass. Both previews and production apps are Ready at the exact respective SHAs; configured roots, built app routes and production aliases verified. Production customer `dpl_GZg6sK54kjpk18BV1v7RFU4VyQXQ`; admin `dpl_AsQBk8ThPMLXkBzpX55jBmwqxEor`.
- HTTP proves controlled route/auth/database behavior, including receipt-backed balances and no read side effects. Hosted login/live providers remain separate. The milestone remains open; #136/#139 stay excluded.

## Phase 1 slice 10 execution result — customer cabin catalog

- Delivered in [PR #168](https://github.com/Amadou-dot/lodgeFlow_admin/pull/168): reviewed `b0cabe92a193d47ea0546bf55cad1d2ee5ca986a`, merged `4af083475fe4937be6deaf762b1272212aa1e5c8`.
- Catalog APIs, server page loaders, availability output and populated booking reads reuse explicit cabin JSON DTOs/serializers. Client aliases and fixtures no longer require documents; the shared model export is typed without schema changes. Removed unused `useCabin`, seven double casts and one `any` fixture.
- Related fixes: inactive/maintenance page denial matches the API, malformed IDs are validated before database access, and explicit zero-price filters are preserved in API/hook/listing. Existing wire fields, null/omission, amounts, defaults, virtuals, dates and availability calculations remain intact.
- Fifteen new characterization cases pass before edits; seven regressions fail before/pass after. HTTP independently reproduces inactive page 200 versus API 404. After: 94 focused cases; both app/database type checks; full format/lint and 1,465 tests (admin 1,048; customer 378; database 36; email 3); expanded HTTP; clean frozen installation and all builds pass.
- All five PR CI jobs ([run 36785129808](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36785129808)) and main jobs ([run 36785374090](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36785374090)) pass. Both exact-SHA previews and production deployments are Ready; configured roots, built routes and production aliases verified. Production customer `dpl_AZwbb7tAdL49C8BDHDM1HyYwnqx9`; admin `dpl_8AgZZvfdahy5Hzym5UN7q1TihWJw`.
- Next: homepage/availability catalog visibility, then remaining input/date and resource/admin DTO work. Server rendering is covered; hosted login/browser interaction/live providers remain separate evidence. #136/#139 stay excluded and the milestone remains open.

## Phase 2 slice 7 execution result — public cabin visibility

- Delivered in [PR #169](https://github.com/Amadou-dot/lodgeFlow_admin/pull/169): reviewed `d862a5ef4fccebd3ebe623ba2497c86b41460c22`, merged `28b0da6a72866ddaa9342a04cf2c0463fceee965`.
- Homepage cards and public availability queries select the active catalog. Preserve the three-card limit, price order/display, capacity/overlap predicates, dates, response DTOs and conflict IDs. The homepage uses typed model inference/server logging with its existing safe empty-card fallback; no data/schema changes.
- Nineteen existing tests pass before edits; the new availability regression fails. HTTP independently reproduces inactive homepage content. After: 20 focused tests, customer type checking, full formatting/lint and 1,466 tests (admin 1,048; customer 379; database 36; email 3), expanded HTTP, clean frozen installation and all builds pass.
- All five PR CI jobs ([run 36786112913](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36786112913)) and main jobs ([run 36786459376](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36786459376)) pass. Both exact-SHA previews and production deployments are Ready; configured roots, built routes and production aliases verified. Production customer `dpl_13y6t5xjNmMEbztWUPdnYiK8xreb`; admin `dpl_FZML7MJ6v7oAXHkMzab6s5pKb9Tw`.
- Actual server rendering checks cover active detail/structured data, inactive/maintenance exclusion, safe homepage database failure and unchanged catalog/provider state. Hosted login/browser interactions/live providers remain separate. #136/#139 stay excluded; the milestone remains open.

## Phase 2 slice 8 execution result — named overlap inputs (F06)

- PR #170, reviewed `06f5e97eb00e4504b9e09a89472b8500cc671195`, merged `7f263c373d46d8bcfd36ec28e585b85148b9bda1`.
- `Booking.findOverlapping` now uses named string IDs and Date inputs across customer creation, admin creation/update and public calendar reads. Removed its unused document companion. Preserved strict overlap boundaries, non-cancelled status selection, self-exclusion, hydrated reads and cabin lock boundaries.
- Three new real-MongoDB characterization tests and 24 model tests passed before edits; 62 focused integration tests pass after migration. Full quality gate: 1,469 tests, formatting/lint, both app types, database build, targeted admin test types, expanded calendar HTTP smoke, clean frozen install and all builds passed.
- All five PR CI jobs (`36787430829`) and main CI jobs (`36787622549`) passed. Both exact-SHA previews and production apps are Ready, with current configured roots, built routes and correct production aliases verified.
- Production: customer `dpl_6LmDX4TFb9QhjUHqYLXWFkL3DzrF`; admin `dpl_Fi8tw4kE6478gBCRB34mn4vY5Gdj`. No hosted login or live provider operations were exercised.
- Next: validate availability search and calendar request boundaries; continue remaining resource/admin DTOs, reservation operations, money and UI work. #136/#139 remain excluded; milestone stays open.

## Phase 2 slice 9 execution result — public availability request boundary

- PR #171, reviewed `6fd2195209bba86f0d29f584301f76908c94e20c`, merged `8b26f4f0d8035b8b1c07d7506a6d181fe5300d22`.
- Availability search now validates unknown JSON, string dates, positive integer guests and date ordering before database access. Malformed inputs return 400; valid query instants/offsets, catalog/capacity/overlap rules, DTOs and existing missing/order errors are preserved. Stream/database failures retain safe logged 500s.
- Before changes: 13 characterization cases passed and 22 regressions failed; HTTP reproduced the null-body 500. After changes: 55 focused tests, customer types, 1,504 full-suite tests, formatting/lint, expanded HTTP, clean frozen install and all builds passed.
- All five PR CI jobs (`36788028318`) and main CI jobs (`36788313943`) passed. Both exact-SHA previews and production deployments are Ready, with configured roots, built routes and correct domains verified. Customer `dpl_DP75E217m54b7UtAaUfJSduL5Git`; admin `dpl_DszPVtn5y4gWQhtw5iKtrktVLVuE`.
- Next: public calendar request validation, then remaining resource/admin DTOs, operations, money and UI work. No hosted login or live provider operations were exercised. #136/#139 remain excluded; milestone stays open.

## Phase 2 slice 10 execution result — public cabin calendar requests

- PR #172, reviewed `0f498454e77ea0fbacec58ad20bcb0c369e7eb41`, merged `2a4ef2f8054e890b306c5e5a20d2adc6d79de3c3`.
- Calendar IDs and effective date ranges are validated before database access. Malformed IDs/dates and reversed/equal ranges return 400; unexpected errors retain a safe 500 and now use the server logger. Exact query instants, UTC date-only output, six-calendar-month/default/partial/repeated queries and valid missing/nonpublic-cabin 404s are preserved.
- Before changes: 15 characterization cases passed, 12 regressions failed, and HTTP reproduced invalid-ID 500. After: 88 focused cases, customer types, 1,531 full-suite tests, formatting/lint, expanded HTTP, clean frozen install and all builds passed.
- All five PR CI jobs (`36788834805`) and main CI jobs (`36789214346`) passed. Both exact-SHA previews and production deployments are Ready with configured roots, built routes and correct domain aliases. Customer `dpl_AKqZyeLyjAjBEjuDjwa6G7Rir472`; admin `dpl_D1vo3oHSTF5Gs4sfAn5PQD4AFLUJ`.
- Next: named booking-table status callbacks and the related invalid check-in action, then remaining resource/admin DTOs, operations, money and UI work. Hosted login and live provider operations were not exercised. #136/#139 remain excluded; milestone stays open.

### Phase 2 slice 11 — booking status actions

- PR #173, reviewed `e6a0a4d47ed3b87100d72a3e52fe7b12778e00c8`, merged `c6d79a0346a4a4ac638dd69984de1f9a1983bed0`.
- Named booking/status callbacks migrate the page and six table components. Menu inputs use string JSON IDs and the shared status union. Related tested correction: Check In appears for confirmed bookings, matching the API; existing cancellation visibility is preserved.
- 51 focused menu/page/hooks checks, 38 real-MongoDB booking API cases, admin/new-test type checks, `pnpm ci:check` (1,547 tests), `pnpm test:http`, clean frozen install/all builds passed locally. All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36789931763) and exact-SHA previews passed.
- Both production apps verified Ready at merge SHA, with configured app roots, built routes and aliases: customer `dpl_3kSD4bsTZpHera5YPsiNi6Zfv7Vx`; admin `dpl_EAi8PPT96gnSkKEMYDyQ6Te55dTQ`.
- [Main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36790525172) passed four jobs; admin failed the existing cache test that assigns 404/500 mock errors by arrival order. A separate test-only repair is in progress before the reservation helper slice. Production status-action checks passed; this is not a clean main CI claim.

### Cache test reliability follow-up — PR #174

- Reviewed `cf326318456354f18ffc474aab95e8661667a7ee`, merged `911fcaed7bf445dcebb148f9a21e8064f7438754`. The confirmed #173 main-CI fixture failure is resolved: mock Clerk errors now follow the requested ID, with both batch orders checked. No application code changed.
- Reversed-order test failed before correction; 67 Clerk/cache checks, admin and changed-test type checks, formatting/read-only lint and all 1,548 tests pass afterward.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36790952542), exact-SHA previews and all five [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36791152119) passed, including HTTP and builds.
- Both production apps verified Ready at the exact merge SHA with matching configured roots, built routes and aliases: customer `dpl_8EkKGSwuS2t5CKZgqgE39E1KLeqB`, admin `dpl_Hnyk7xVWEDbGKhN4Nvt7tGsDKMHa`. Guest reservation helper inputs (F02) are next.

### Phase 2 slice 12 — named guest reservation operations (F02)

- PR #175, reviewed `b73c30f4d563c52a4615456a27f6ec138991971c`, merged `60b7b731ff92aac73ba1ab9106668c720d21b0d3`.
- All four guest dining/experience helpers take named IDs/selection and tagged update/cancel inputs. Four customer route files and all shared/admin test callers migrated; authorization, response contracts, pricing, receipts and capacity transaction contention writes are preserved.
- Before runtime edits: 22 route + 13 replica-set operation/capacity checks and expanded HTTP passed. After: 47 database, 22 route and 11 admin integration checks; app/shared/migrated-test types and invalid-input compiler checks; full formatting/lint/1,578 tests; HTTP; clean frozen installation/all builds passed. A temporary inode exhaustion was resolved by removing obsolete task-owned build copies before the successful full gates.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36792259004), exact-SHA previews and all five [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36792581777) passed.
- Both production apps verified Ready at exact merge SHA, with matching configured roots, built routes and aliases: customer `dpl_R7HTFcGSGYMzWT5NDAXJccra2fFt`, admin `dpl_HVkidysk9Bp2WYZTzEjx4tebJRdy`. Next: V01's typed admin cancellation-field guards. F07 staff/catalog operations and remaining DTO/validation boundaries are separate work.

### Phase 2 slice 13 — typed booking cancellation-field guards (V01)

- PR #176, reviewed `238c114310c3d655e17616b834317b318b8f4392`, merged `22af71ba7f113f7af511fca94109a2ca45c22f93`.
- Both admin booking guards use compiler-checked literal keys on parsed Zod output. Field ordering, zero/empty-value presence checks, status rules and denial responses are unchanged; PUT/PATCH retain their existing `cancelledAt` differences.
- Before runtime edits: 77 real-MongoDB booking cases (eight new) and new-test types passed. Final formatting/lint/1,586 tests, admin/new-test types, HTTP, clean frozen installation and all builds passed. Tests use real documents after the legacy shared fixture module failed to load its Faker dependency in the integration runner; no dependency/configuration change.
- All five [PR CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36793544579), exact-SHA previews and all five [main CI jobs](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36793761365) passed.
- Both production apps Ready at exact merge SHA with configured roots, built routes and aliases verified: customer `dpl_G1nK1yKSYxY3SPf5UCrL9REuJ8M4`, admin `dpl_GbVYuxvxaTJk36nEUr6kUrMyno9N`. Next: catalog operation inputs (F07).

## Phase 2 slice 14 delivered — catalog operation inputs (#177)

- Reviewed `b67a0590b7015a6d04f40c50ea7daa49b75d34e0`; merged `a8ea33b2a4b7b7f7c5150099b922cb85d09f3ed6`. Named catalog update/delete and private identity/count inputs; typed resource-specific editable fields; all six admin write callers migrated. Transactions, capacity, historical references, saved prices and response contracts preserved.
- Twelve new replica-set cases and expanded real HTTP protect rollback, concurrent creation/deletion, permissions, body/path IDs, partial edits and cancelled history. Before: 17 domain/capacity + 69 admin cases and HTTP pass. After: 59 database + 69 admin cases, both app/shared types, invalid-input compile checks, `pnpm ci:check` (1,598 tests plus format/lint), HTTP, clean frozen installation and all builds pass. Nine final runtime/test files match the clean build snapshot.
- [PR CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36795297056) and [main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36795502686): all five jobs pass. Both previews Ready at the reviewed SHA.
- Production Ready at merge SHA: customer `dpl_DVx7giTWxPpPKP5pwR54XaYBxDEz`, admin `dpl_38ogTrs6zsFLEHZq1zK58kyjDLVx`. Configured roots `apps/customer`/`apps/admin`, built app-specific routes and `lodgeflow.app`/`admin.lodgeflow.app` aliases verified.
- Evidence prefix `/tmp/lodgeflow-catalog-operations-`; inventory records details and remaining F07 staff inputs. No live provider operations or hosted login checks. No schema/storage/UI changes.

## Phase 2 slice 15 delivered — staff reservation status inputs (#178)

- Reviewed `3699b1d600690267f016a33e9d5e5ccfac565a78`; merged `af5b389a44c3b18d7043be5bb4c1e951ecc012f9`. Named status/detail helpers and callers; unknown request bodies parsed with strict Zod, including the prior own-`__proto__` rejection. Missing/stale/lifecycle/payment/no-op order, capacity transaction, safe errors and audit attribution preserved.
- Fourteen new integration cases plus 11 existing cases pass before/after, with separate integration type checks. Both app/shared types, `pnpm ci:check` (1,612 tests plus format/lint), expanded real HTTP, clean frozen installation and all builds pass. Eight final runtime/test files match the clean build snapshot.
- [PR CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36796900078) and [main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36797114411): all five jobs pass. Both previews Ready at the reviewed SHA.
- Production Ready at merge SHA: customer `dpl_GaJnrHhWdS3PaT4UQx5yonWwE5Bu`, admin `dpl_BxcL32LbSP24ZfeQFoFgYqwnrB3X`. Configured roots `apps/customer`/`apps/admin`, built app-specific routes and `lodgeflow.app`/`admin.lodgeflow.app` aliases verified.
- Evidence prefix `/tmp/lodgeflow-staff-status-`; inventory records remaining response/native-status DTO debt. No live provider operations or hosted login checks. No lifecycle, schema/storage, money or UI changes.

## Phase 2 slice 16 delivered — experience query boundary (#179)

- Reviewed `1a2a0ca0664d4a0fddaa81f9b092a1334fc6afa0`; merged `a86bb1f69bbf23c97bc51734500c3ff3dd4fb3e9`. Typed parsed experience queries and shared logging. Related fix: API/hook preserve zero price bounds, so `maxPrice=0` returns free listings instead of paid ones. Other filters, sorting, JSON, failure order and query caching preserved.
- Before: 20 characterizations and customer types pass; seven zero-price regressions and real HTTP reproduce the bug. After: all 27 focused cases, customer types, `pnpm ci:check` (1,639 tests plus format/lint), expanded HTTP, clean frozen install and all builds pass. Five final runtime/test inputs match the validated build copy.
- [PR CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36798394148) and [main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36798602671): all five jobs pass. Both previews Ready at the reviewed SHA.
- Production Ready at merge SHA: customer `dpl_Ube78mwFxv32yA3PffqMCYtqtRoE`, admin `dpl_8EWqf16NVY41VcccCneP9T1gxwf8`. Configured roots `apps/customer`/`apps/admin`, built app-specific routes and `lodgeflow.app`/`admin.lodgeflow.app` aliases verified.
- Evidence prefix `/tmp/lodgeflow-experience-query-`; response DTOs remain separate. No schema/storage, rounding or UI changes; no live provider operations or hosted login checks.

## Phase 2 slice 17 delivered — dining query boundary (#180)

- Reviewed `372ea53f67e2caa39f7bfacac108751869eed62b`; merged `7e009b0edd4bd3b8b82c2dd548067b754958db92`. Typed available-only dining queries and shared logging. Related fix: route/hook retain explicit zero price bounds. Search/filter/sort behavior, full JSON, safe `message` envelope and query caching preserved.
- Before: 21 characterizations and customer types pass; seven regressions and real HTTP reproduce dropped zero limits. After: all 28 focused cases, customer types, `pnpm ci:check` (1,667 tests plus format/lint), expanded HTTP, clean frozen installation and builds pass. Five final runtime/test inputs match the clean build.
- [PR CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36799874853) and [main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36800093575): all five jobs pass. Both previews Ready at reviewed SHA.
- Production Ready at merge SHA: customer `dpl_8D7BhG6WZbhPnDuc188eG1hLNk2S`, admin `dpl_BZALcu2XxifniQYhv6AmwUGuM4rK`. Configured roots `apps/customer`/`apps/admin`, built app-specific routes and production domain aliases verified.
- Evidence prefix `/tmp/lodgeflow-dining-query-`; response DTOs remain separate. No new UI, schema/storage or rounding changes. Focused changed-path regressions do not implement #136. No hosted login or live provider operations.

## Phase 2 slice 18 delivered — customer welcome-email failures (#181)

- Reviewed `47f9cbfb6428737b2133bb536cac8582abc8e088`; merged `fd023149fd5504d60c4b32dd046b485791b7f64d`. Auth/profile/lazy send failures are contained and logged. Intentional fix: safe string-error 500 JSON replaces leaked provider errors and escaping Clerk exceptions. Auth/recipient validation order, first-email/Guest selection, sender/template/subject, message ID and retry preserved.
- Before: 14 route/hook characterizations and customer types pass; eight regressions and real HTTP reproduce unsafe failures. After: 31 focused welcome/sender checks, customer types, `pnpm ci:check` (1,689 tests plus format/lint), expanded HTTP, clean frozen installation and builds pass. Four final runtime/test inputs match the clean build.
- [PR CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36866993675) and [main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36867380569): all five jobs pass. Both previews Ready at reviewed SHA.
- Production Ready at merge SHA: customer `dpl_9GCkp5iKzUvn18SHrr6PWMppcVYE`, admin `dpl_5SdG59dXXZ28BCXbcEY7uWFLem5U`. Configured roots `apps/customer`/`apps/admin`, built app-specific routes and production aliases verified.
- Evidence prefix `/tmp/lodgeflow-customer-welcome-`; HTTP includes real SDK profile failure without email dispatch, authenticated recipient/name despite untrusted body fields, actual greeting rendering and unchanged receipts. Existing CLI session refreshed successfully for Vercel verification. No hosted login/live provider operations.

## Phase 2 slice 19 delivered — admin welcome-email boundary (#182)

- Reviewed `de330ab63da194ad9e9727fee1db3855ed005901`; merged `bee9d7bd8cf9bde8abe2fba5e2568a8d1b903c66`. Validated recipient/name payload, normalized legacy blank greetings and named hook inputs. Intentional fixes: safe 400 for malformed/non-string inputs and safe 500 for unexpected errors. Administrator-only auth, rate limit/order/headers, email validation precedence, recipient case, sender/template/subject, message ID and retry preserved.
- Before: 15 route and 11 existing/new hook checks plus test types pass; 17 regressions fail, and HTTP reproduces malformed-body 500 after role denials pass. After: 40 affected checks, admin and changed-test types, `pnpm ci:check` (1,722 tests plus format/lint), expanded HTTP, clean frozen install and builds pass. Seven final runtime/test inputs match the clean build.
- [PR CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36869201471) and [main CI](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/36869586415): all five jobs pass. Both previews Ready at reviewed SHA.
- Production Ready at merge SHA: customer `dpl_26a78EqoPNKHoBka4NVtyiAveUJ3`, admin `dpl_5cMaQp7oqkbcEXFE6cSYKjmQsGfb`. Configured roots `apps/customer`/`apps/admin`, built app-specific routes and production aliases verified.
- Evidence prefix `/tmp/lodgeflow-admin-welcome-`; HTTP includes manager/front-desk denial, invalid payloads with no send, actual greeting, safe provider retry, unchanged bookings and sixth-request 429. F08 records the shared rate-limit key's three remaining positional callers. No hosted login/live provider operations.

## Existing issue triage

Verified on 2026-09-15 against local and GitHub `main` at
`07670932f0b8349fa826802a6ee27f20b3501908`. GitHub had no open PRs at review time.
Recheck state and source before implementation or closure.

| Issue                                                                                    | Verified evidence                                                                                                                                                                                             | Planned disposition                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#132](https://github.com/Amadou-dot/lodgeFlow_admin/issues/132) sandbox sender          | Resolved in PR #155: all ten sender sites migrated; both production deployments verified and both test emails confirmed received by the user. | Phase 5: centralize and validate sender configuration for existing email flows. The user confirms `lodgeflow.app` is already set up in Resend. Reuse that domain and keep open until the configured sender works through existing send paths; code cleanup alone is insufficient. |
| [#133](https://github.com/Amadou-dot/lodgeFlow_admin/issues/133) workflow formatting     | Both named, tracked workflow files pass installed Prettier 3.9.6 with the root configuration.                                                                                                                 | Phase 0A: recheck at implementation HEAD, then close with evidence if still resolved. Do not reformat files unnecessarily.                                                                                                                                                        |
| [#134](https://github.com/Amadou-dot/lodgeFlow_admin/issues/134) missing lockfile        | `pnpm-lock.yaml` is tracked; the workspace overrides `@internationalized/date` to 3.12.2; the lock resolves that version; CI uses frozen installation and builds all three packages.                          | Phase 0A: verify a clean frozen install and both app builds, then close with evidence. Do not recreate the lockfile or upgrade dependencies.                                                                                                                                      |
| [#135](https://github.com/Amadou-dot/lodgeFlow_admin/issues/135) checkout ownership leak | Customer cabin checkout queries `Booking.findOne({ _id: bookingId, customer: userId })` and returns `Booking not found`/404 when absent. The reported 403 branch is gone.                                     | Phase 0C: add/verify a route regression for foreign and missing booking IDs returning identical responses, without provider calls or writes, then close.                                                                                                                          |
| [#136](https://github.com/Amadou-dot/lodgeFlow_admin/issues/136) dining coverage         | Excluded by user direction.                                                                                                                                                                                   | Leave outside the milestone.                                                                                                                                                                                                                                                      |
| [#139](https://github.com/Amadou-dot/lodgeFlow_admin/issues/139) notification system     | Excluded by user direction.                                                                                                                                                                                   | Leave outside the milestone; #132 repairs existing senders only.                                                                                                                                                                                                                  |

No issue is considered completed solely because it is assigned to this milestone.
The initial planning review did not run application suites. A subsequent API
readiness check passed 150 admin API tests, 8 customer webhook tests and 25 shared
database tests; full HTTP verification remained unresolved. See
`docs/refactoring/api-testing-readiness.md` for commands, scope and blockers.
These results do not establish a clean installation, passing builds, complete
endpoint coverage or live provider delivery.

## Phases and acceptance criteria

Phase 0A–0C is complete; its execution evidence is retained above. The detailed
baseline, HTTP harness and regression-gate criteria are maintained in the
[repository plan](https://github.com/Amadou-dot/lodgeFlow_admin/blob/main/docs/refactoring/plan.md#phase-0a--reproducible-baseline-and-debt-inventory).
This avoids duplicating the completed checklists as delivery evidence grows.
The active phase criteria follow.

### Remaining phase acceptance criteria

Phases 1–6 remain governed by the [repository plan](https://github.com/Amadou-dot/lodgeFlow_admin/blob/main/docs/refactoring/plan.md#phase-1--separate-persistence-transport-and-ui-types).
Their unchanged detailed checklists are maintained there to avoid duplicating the
plan in this tracker. Per-slice validation and delivery evidence above is retained.

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






## Phase 5 sender repair status — 2026-09-20

[PR #155](https://github.com/Amadou-dot/lodgeFlow_admin/pull/155), reviewed commit `6be9d241171b0764405dfea695a49350b971cfc2`, implements all ten sender sites and restores the missing React email renderer. Local quality checks pass: 1,207 tests, actual-rendering HTTP smoke, both app type checks, frozen install and both app/shared builds without provider credentials. Authorized synthetic welcome/payment route sends were accepted and read back as delivered by Resend. All five CI jobs and both exact-SHA previews passed. PR #155 merged as `9a9c2963c54266cbc563259905a9048791580f3c`; both production deployments are Ready at that SHA with `lodgeflow.app` / `admin.lodgeflow.app` assigned and matching app roots. The user confirmed receipt of the synthetic $1.00 payment email and correct rendering of the welcome email. Issue #132 is resolved. Issues #136/#139 remain excluded.




