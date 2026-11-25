# Phase 4 approved browser fixes

**Goal:** Address the three fixes authorized on 2026-11-05: one booking print/download entry point, private booking history across authentication changes, and current cabin listing links.

**Spec:** [Browser findings](phase-4-browser-review.md), checks 1, 2 and 9, plus the user's decision to keep the preview's Print and Download PDF controls.

**Architecture:** Keep the existing preview and PDF/print implementations. Scope the three customer history queries to the Clerk user and session, cancel obsolete requests, clear obsolete history caches at the mounted Clerk boundary, and remount history dialogs on session changes. Require a live request before server-side cabin catalog reads so both the homepage and catalog render current links.

**Constraints:** Preserve route authorization, response shapes, filters, mutation invalidation prefixes, payment/accounting guards and persisted data. No live mutations, dependency changes, Settings/date fixes or mobile redesign. Preserve the user's untracked notes and browser report. Work on `fix/phase4-browser-acceptance` in the authorized checkout; existing unrelated managed worktree remains untouched.

## Task 1: Print preview entry point

- [x] Add a component regression using the real print hook and template: the single button opens preview, PDF export receives the mounted template, failures remain retryable and closing/reopening works.
- [x] Watch it fail before replacing the dropdown; remove unused whole-page print API and update affected existing tests.
- [x] Run the admin print/component subset and admin type checks.

Files: `apps/admin/components/BookingDetails/QuickActionsCard.tsx`, `apps/admin/hooks/usePrintBooking.ts`, affected admin print tests.

## Task 2: Customer booking history privacy

- [x] Add real QueryClient/history-hook regressions for all three resources: auth loading/sign-out prevents reads; user/session switches immediately hide old results; delayed old reads cannot populate a new session; invalidation still refreshes the active history.
- [x] Add page regressions for sign-out with a details/edit dialog open, account switch and same-account new-session remount. Exercise the shared cache boundary with navigation away from history and preserve public catalog caches.
- [x] Implement a Clerk-aware history cache boundary beneath the existing Clerk provider, session-scoped history keys and abortable fetches. Guard and key the history page before mounting its stateful content.
- [x] Run customer suites and type checks. Retain confirmation denial coverage and existing mutation behavior.

Files: customer `components/DynamicClerkProvider.tsx`, new history cache boundary, `app/bookings/page.tsx`, three history hooks and focused tests.

## Task 3: Cabin catalog freshness

- [x] Add a production-mode, disposable-database regression: render homepage/catalog, replace fixture cabins, then verify HTML links and detail pages use the new records. Run it against the old implementation and observe stale links.
- [x] Require a live request before catalog database reads, outside error handling, preserving React's per-request deduplication and safe database error fallbacks.
- [x] Run the production regression again and the customer catalog tests and HTTP gate.

Files: `apps/customer/lib/data/cabins.ts`, `apps/customer/app/page.tsx` (its separate featured-cabin read), isolated production catalog regression under `scripts/http-smoke`.

## Review focus and final validation

- Session changes while a history read or edit is pending must not restore old data or close a new account's dialog.
- Same-user sign-out/sign-in uses a new session and must not reuse old history.
- Public caches and current-session filtered history must survive cleanup/invalidation correctly.
- PDF rendering must use the mounted real template and recover after failure.
- Catalog freshness must hold in a production build after records are replaced, not only in Next development mode.

- [x] Run formatting, read-only workspace lint, all package tests, both app types, affected admin-test types, isolated HTTP, frozen install and builds.
- [x] Review the full slice independently, address the pending-edit test gap and prepare the evidence for a draft PR. Merge remains subject to user review.
- [x] Record browser verification limits and the remaining Phase 4 findings explicitly.
- [ ] Retest the affected flows in the production browsers after reviewed delivery.

## Local evidence

Node 22.23.2 and pnpm 11.17.0 were used. Sixteen added component/hook regressions
fail against the old implementation and pass with these changes. The production
catalog regression independently failed on the old stale homepage link and now
passes after fixture replacement. No live data or provider operations were used.

| Command                                                                                     | Result                                                                                 |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm --filter @lodgeflow/admin test`                                                       | 121 suites / 1,708 tests pass                                                          |
| `pnpm --filter @lodgeflow/customer test`                                                    | 70 suites / 936 tests pass                                                             |
| `pnpm --filter @lodgeflow/database test`                                                    | 96 tests pass                                                                          |
| `pnpm --filter @lodgeflow/email test`                                                       | 3 tests pass; package total 2,743                                                      |
| `pnpm format:check` and `pnpm -r exec eslint .`                                             | Pass; lint is read-only                                                                |
| Both apps: `pnpm --filter @lodgeflow/<app> exec tsc --noEmit --incremental false`           | Pass; customer includes tests                                                          |
| Admin `tsc` with a temporary strict config including the four changed test files            | Pass; inherited compiler rules retained                                                |
| `pnpm test:http`                                                                            | Pass with local signed Clerk sessions, disposable MongoDB and controlled Stripe/Resend |
| `pnpm --filter @lodgeflow/database exec tsx ../../scripts/http-smoke/catalog-freshness.mjs` | Pass with a real production customer build and disposable catalog                      |
| `pnpm install --frozen-lockfile` and `pnpm build` in a clean copy                           | Pass; no app env files, only CI's throwaway public Clerk build key                     |

The frozen install emitted an optional Sharp source-rebuild warning; installation
exited successfully, the installed native Sharp/libvips runtime loaded, and both
production builds passed. No dependency or lockfile change was needed. The builds
retain expected credential-free fallback diagnostics.

Independent review found no runtime defects. Its one coverage gap was an edit
finishing after an account switch. Two additional tests resolve or reject the old
edit while a new account's edit dialog is open; both fail with the old page and
pass with the keyed page. Public query caches and prefix invalidation remain
covered. Evidence logs are under `/tmp/lodgeflow-phase4-browser-evidence` locally.

The fixtures do not establish hosted Clerk cookies/session transitions, native
Back/bfcache behavior, visual PDF pagination or responsive layout. The three-step
[browser retest list](phase-4-browser-review.md#approved-follow-up-implemented-for-review-2026-11-05)
and the remaining Settings/date/mobile findings keep Phase 4 acceptance open.
Remote CI and deployment evidence belong to the exact pushed PR commit.
