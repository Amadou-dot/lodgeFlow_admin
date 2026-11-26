# Remaining Phase 4 functional fixes implementation plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` task by task. Implement only the task brief supplied by the controller. Do not spawn other agents.

**Goal:** Finish the reproducible remaining Phase 4 functional fixes while preserving the established refactor contracts.

**Architecture:** Keep the current Next.js, HeroUI, Clerk and cache architecture. Project editable Settings requests, format stay dates at display boundaries, initialize booking forms from loaded records, and constrain existing mobile layouts. This is a continuation of the authorized refactor plan, not a redesign.

**Tech Stack:** Node 22, pnpm 11.17.0, TypeScript, Next.js 16, React 18, HeroUI v2, SWR/TanStack Query, Jest, MongoDB/Mongoose.

**Spec:** `AGENTS.md`, `docs/refactoring/plan.md` and `docs/refactoring/phase-4-browser-review.md`; user authorized remaining slices on 2026-11-25 after accepting and merging #202.

## Global Constraints

- Preserve observable behavior, API contracts, persisted data, authorization, accounting, and concurrency guarantees except the explicitly documented functional corrections.
- No new features or visual redesign. Browser-test automation infrastructure is deferred by the user; focused characterization/regression tests remain required.
- Preserve payment/active-checkout repricing guards. Never mutate live databases, Settings, Clerk identities, Stripe or email providers.
- No `as unknown as T`, new explicit `any`, disabled compiler/lint rules, or raw-body update spreading. Use named options and explicit browser-safe shapes.
- Calendar stay dates and actual event timestamps are different contracts. Do not rewrite stored timestamps, change stay length, pricing, timezone rules in calculations, or normalize transport values.
- Work only in the isolated continuation worktree. Do not touch the source checkout's `notes.md` or `phase4_browser_sign_off.md`.
- Preserve b190f44's Stripe diagnostics. Source mutations are serial; every task gets a fresh independent review before the next task.
- Use `/tmp/lodgeflow-pnpm` for the Node 22/pnpm 11.17 runner. The isolated worktree has no app-local environment files. Require escalated execution when filesystem/process sandbox rules prevent editing or running disposable tests there.
- Run focused tests while iterating, the affected suite and app types once the task is ready, and strict compiler checks for changed admin tests. The controller owns the final full workspace/HTTP/build gates.
- Commit only the task's files. No push or merge by an implementer. Reports and logs belong in the plan workspace or `/tmp`, not source.

## Review Focus

- A realistic Settings read DTO includes immutable/computed fields and legacy nullable nested values; editing one supported value must still save.
- Edits and reverts made during a pending save/reset must remain drafts after completion and survive a failed request.
- UTC-midnight and non-midnight legacy stay dates must retain their UTC calendar day across negative/positive viewer timezones; actual event times stay local.
- A booking loaded after first render and a selected customer outside the first search page must retain the saved identity without overwriting newer form edits.
- A reduced mobile visual viewport must leave every Dining field reachable; horizontal Calendar scrolling must not obscure narrow-screen dates.

### Task 1: Submit editable Settings changes

**Ownership:** `apps/admin/components/SettingsForm.tsx`, relevant handler types beneath `components/SettingsForm/`, `apps/admin/hooks/useSettings.ts`, focused Settings form/mutation tests. Add a small app-local typed adapter only if needed; do not change the database model, serializer, route permission, server allowlist or response envelope.

**Context:** `/tmp/lodgeflow-phase4-contract-audit.md` section 1 contains the verified full path. The form currently sends its entire AppSettings read DTO, which the strict PUT schema rejects for `singleton`/`fullAddress`; untouched `contactInfo:null` is another incompatible read representation.

**Interfaces:** Consume `UpdateSettingsInput` from the existing Settings validation module. The update hook accepts that request shape and returns `AppSettings`. Build a new sparse payload from editable revisioned changes. Successful saves adopt the returned full DTO as the baseline, while retaining changes newer than the submitted revision.

- [ ] Add a failing realistic form regression: edit breakfast price on a read DTO containing metadata, singleton, fullAddress and untouched null contactInfo; the submitted body must be exactly the changed editable field and pass the real update schema.
- [ ] Pin existing failure/retry/discard and save/reset pending-edit/revert behavior; assert the next save carries the retained edit, and the response rather than the submitted snapshot becomes the server baseline.
- [ ] Implement the typed sparse request boundary and migrate the only PUT hook caller. Preserve deep equality, revision tracking, min/max state validation, cache refresh and reset behavior.
- [ ] Run Settings component/hooks/cache/validation tests and relevant route tests; run admin types and strict compilation of changed tests. Record RED and GREEN evidence. Format only touched files.
- [ ] Update this plan's task checklist and commit the bounded change. Report files, test commands/results, caveats and commit.

### Task 2: Keep cabin stay labels on the intended calendar date

**Ownership:** New `apps/admin/lib/booking-stay-date.ts`; `apps/admin/utils/bookingUtils.ts`; `components/BookingDetails/BookingStatusDates.tsx`; `components/BookingDetails/BookingPDFTemplate.tsx`; `app/(dashboard)/guests/[id]/page.tsx`; `components/EmailTemplates.tsx`; focused date/booking/print/email tests. Do not change calendar occupancy, forms' wire dates, relative status wording, stored dates, calculations or actual event renderers.

**Context:** `/tmp/lodgeflow-phase4-contract-audit.md` section 2 inventories all relevant consumers. Existing editor/calendar/inbox consumers already use UTC date keys. Other absolute stay labels format UTC-midnight values in the viewer timezone and display the previous day in Denver.

**Interfaces:** Export `formatBookingStayDate({ date, style })`, accepting only the serialized string and a small union of the existing presentation variants. Use a fixed en-US/UTC calendar formatter and preserve each caller's existing month/day padding and malformed-date fallback. Apply only to planned stay labels. Admin booking confirmation email shares the label formatter without changing sending behavior.

- [ ] Reproduce March 20–23, 2027 displaying a day early in Denver using failing helper/component assertions before implementation.
- [ ] Cover UTC midnight, a non-midnight legacy ISO instant, month/year or DST boundary and existing invalid-input fallbacks. Assert unchanged strings/stay lengths and local actual event timestamps.
- [ ] Implement the one browser-safe formatting boundary and migrate the inventoried absolute stay-label consumers.
- [ ] Run focused tests in separate processes under `TZ=America/Denver`, `TZ=UTC`, `TZ=Asia/Tokyo`; run affected booking/print/email suites, admin types and strict changed-test types. Preserve passing UTC picker/transport coverage.
- [ ] Record the display-only behavior correction, format touched files and commit the slice.

### Task 3: Preserve booking edit initialization and selected customer

**Ownership:** Admin booking edit page, `hooks/useBookingForm.ts` and `components/BookingForm/CustomerSelection.tsx` plus directly related types and tests. Determine exact files from `/tmp/lodgeflow-phase4-mobile-audit.md`; no booking request/domain/payment changes.

**Interfaces:** The form initializes from the fetched booking before user editing, or explicitly hydrates once per booking identity without overwriting subsequent edits. A selected customer with known identity remains an option even if absent from the first twenty/search results. Missing/deleted customer references remain explicit; never invent an identity or bypass guest eligibility.

- [ ] Add a regression for a cold detail fetch resolving after initial render and for the saved customer being absent from a paginated/search list.
- [ ] Cover user edits while data revalidates, switching record identity, and a legitimate missing populated customer.
- [ ] Fix the initialization and selected-option boundaries with the smallest state change. Preserve submit/reset semantics, search pagination and request types.
- [ ] Run focused form/page/selector tests, surrounding mutation tests, admin types and strict changed-test types. Preserve unpaid versus paid/active-checkout guards; characterize any relevant eligible edit path with existing fixtures rather than changing policy.
- [ ] Format touched files, document the correction and commit the slice.

### Task 4: Make existing mobile Dining and Calendar controls reachable

**Ownership:** Dining add/edit modal layout and Calendar header/row styles, their focused interaction tests and the documented disposable responsive fixture. Exact paths and evidence are in `/tmp/lodgeflow-phase4-mobile-audit.md`. Toast investigation is read-only unless a reproduced defect identifies a narrow correction; seek a controller ruling before adding source scope.

**Interfaces:** Keep HeroUI's modal shell and one vertical scroll owner. Constrain the mobile Dining modal to the available visual viewport, not a competing static viewport height. Calendar's Listing header and row header use consistent mobile positioning while preserving desktop sticky behavior and occupancy/date semantics.

- [ ] Reuse the explorer's compiled-CSS/browser fixture to reproduce reduced visual viewport Dining clipping and Calendar horizontal overlap. Record both phone and desktop results before edits.
- [ ] Make the narrow layout corrections, without changing fields, validation, mutations, calendar data or redesigning the Reservations table.
- [ ] Verify all Dining fields/actions remain reachable at the phone viewport and reduced visual viewport; verify horizontal Calendar dates are exposed and desktop listing stickiness remains. Exercise toast provider/rendering in the fixture and report actual evidence rather than inventing a cause.
- [ ] Run affected component tests and admin types; use browser measurements/screenshots for the CSS behavior instead of tests that merely mirror class strings.
- [ ] Format touched files and commit with responsive verification limits explicitly recorded.

### Task 5: Reconcile Phase 4 evidence and remaining acceptance

**Ownership:** `docs/refactoring/phase-4-browser-review.md`, `phase-4-browser-fixes-plan.md`, `phase-4-ui-state.md`, `plan.md`, `inventory.md`, this continuation plan, and any focused eligible-booking/non-JSON payment-error regression required by a confirmed gap. No production data/provider writes and no browser automation framework.

**Interfaces:** Consume Tasks 1–4 reports and the accepted #202 delivery. Preserve dated original browser findings as historical evidence, record each implemented fix and actual checks, and keep genuine hosted/device/payment acceptance gaps explicit.

- [ ] Record #202 user acceptance and b190f44 base, and update stale statements that no browser retest occurred.
- [ ] Verify existing regression/HTTP coverage for allowed guest edits on unpaid records with no active checkout, and denial on paid/pending-checkout records. Reproduce any actual uncovered failure before proposing a code correction; preserve accounting policy.
- [ ] Inspect signed-out/non-JSON checkout error handling with controlled fetch responses. If a real raw parser error remains, obtain a controller ruling for a bounded safe-error fix with a failing regression and unchanged success/provider behavior.
- [ ] Reconcile toast and native/mobile/booking/payment verification limits. Do not label Phase 4 complete solely because code/tests pass.
- [ ] Update documentation with paths/results and remaining Phase 6 work; run formatting/path checks and commit. The controller then performs the whole-plan review and continues the separately scoped Phase 6 plan.
