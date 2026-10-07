# Customer booking review fixes

> **For agentic workers:** Use `superpowers:executing-plans` for this bounded fix.

**Goal:** Correct the five customer cabin defects reproduced in the October 7 browser review.

**Architecture:** Keep persistence, server pricing, authorization and payment operations unchanged. Correct the form payload and preview, and render the existing booking DTO safely with UTC calendar stay dates.

**Tech Stack:** Next.js 16, React 18, HeroUI, TypeScript, Jest and Testing Library.

**Spec:** The five findings approved in the conversation; root `AGENTS.md` governs implementation and delivery.

## Constraints and review focus

- No features, migrations, dependency changes or credential changes.
- Real HeroUI checkbox interaction must preserve checked and unchecked choices.
- Preview includes the existing per-extra-guest, per-night charge; cover one guest, multiple guests and an absent fee.
- Preserve ISO request dates and display the UTC stay date in Denver and Tokyo, including history details. Cancellation timestamps remain local.
- Preserve complete request lines, trim whitespace and omit blank lines.
- A removed cabin and sparse optional fields must not crash confirmation or imply checkout is available for a removed listing.

## Task 1: Correct form submission and price preview

Files: `components/BookingForm.tsx`, `components/CabinDetailClient.tsx`, `components/CabinMobileTabs.tsx` under `apps/customer`; new `__tests__/bookings/BookingFormSubmission.test.tsx`.

- [x] Add failing real-checkbox submit tests for all five choices, toggling off, complete LF/CRLF request lines and unchanged ISO dates. Add one/multiple guest pricing cases and a parent-to-form propagation check.
- [x] Run the focused Jest suite; confirm failures reproduce the review.
- [x] Submit controlled booleans, split request text on newlines and pass/include `extraGuestFee` in the breakdown.
- [x] Rerun the focused tests; expect all passing.

## Task 2: Correct booking displays

Files: customer cabin confirmation page, bookings page, new `lib/booking-date.ts`, new confirmation tests and existing `BookingsPage.test.tsx`.

- [x] Add failing date display tests and a null-cabin confirmation case using typed `BookingDetail` fixtures. Characterize normal pricing/payment controls and sparse fields.
- [x] Run with `TZ=America/Denver`; confirm wrong dates/null dereference before edits.
- [x] Use the shared DTO, normalize optional fields for display, render a removed-cabin fallback, and format only stay dates in UTC through `formatBookingStayDate({ date, weekday? })`.
- [x] Run the affected suite in Denver and Tokyo; expect correct dates and usable confirmation/history.

## Task 3: Verify and deliver

- [x] Format touched files; run `pnpm ci:check`, both app type checks, `pnpm test:http`, frozen install and credential-free workspace builds.
- [x] Inspect the complete diff and obtain one independent review. Resolve actionable findings with regression coverage.
- [x] Update refactoring documentation with the intentional behavior changes and actual evidence.
- [ ] Create the PR, verify CI and exact-SHA deployments, merge under the existing authorization, then verify main CI and production.
- [ ] Repeat the five browser reproductions against the deployed fix with disposable test bookings and remove them. Report any blocked or unverified checks precisely.
