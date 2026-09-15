# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Monorepo layout.** This app lives at `apps/customer/` in the LodgeFlow
> workspace. Every path in this document is relative to that directory unless
> it starts with `docs/`, `.github/`, or `packages/`, which are repo-root paths.
> Scripts below run from within `apps/customer/`, or from the repo root as
> `pnpm --filter @lodgeflow/customer <script>`.

## Refactoring direction

The workspace-root `AGENTS.md` governs code quality and the current refactoring
freeze. Follow `docs/refactoring/plan.md`: complete the baseline, HTTP smoke harness
and high-risk regression gates before substantive refactoring. Issues #136 and
#139 remain excluded. Use intended behavior, not legacy casts or comments, as the
contract when writing characterization tests.

Production origins are `https://lodgeflow.app` for customers and
`https://admin.lodgeflow.app` for staff. This app is the customer site.
Resend is already configured for the `lodgeflow.app` domain; existing sender
configuration cleanup is tracked separately in #132.

### Shared database

Models now live in `packages/database/src/models` at the workspace root. Import
`@lodgeflow/database` or an exported model subpath; there is no app-local `models/`
directory. Schema enums and connection/pricing helpers have shared implementations.
The lock storage module is private; app routes use `withCabinBookingLock()`.
See `docs/superpowers/plans/2026-09-14-shared-database.md` for remaining payment
and capacity reconciliation work.

## Commands

```bash
pnpm dev --port 3002  # Customer dev server; admin convention is port 3000
pnpm build            # Production build
pnpm lint             # ESLint with auto-fix
pnpm test             # Run all tests
pnpm test:watch       # Run tests in watch mode
pnpm exec jest --testPathPatterns=cabins # Run a subset (jest 30 renamed the flag — plural, and `pnpm test --` forwards arguments unreliably)
pnpm format           # Format with Prettier
pnpm ci:check         # Full CI check (format + lint + test)
```

## Architecture

### Tech Stack

- **Next.js 16** with App Router and Turbopack
- **MongoDB/Mongoose** for data persistence
- **Clerk** for authentication (user ID stored as string in `customer` field)
- **HeroUI v2** component library with Tailwind CSS
- **React Query** for server state management
- **Resend** for transactional emails
- **Stripe** for payments (`lib/stripe.ts`, webhook handler at `app/api/payments/`)

### Data Flow Pattern

```
Page/Component → Custom Hook (hooks/) → API Route (app/api/) → Mongoose Model (@lodgeflow/database)
```

Custom hooks in `hooks/` use React Query to fetch from internal API routes. API routes connect to MongoDB via `connectDB()` from `lib/mongodb.ts`.

### Key Directories

- `app/api/` - API routes: bookings, cabins, dining, dining-reservations, experiences, experience-bookings, payments, settings, send (email)
- `packages/database/src/models/` (repo root) - Mongoose schemas: Booking, Cabin, Dining, DiningReservation, Experience, ExperienceBooking, ProcessedStripeEvent, Settings
- `hooks/` - React Query hooks matching API resources (useCabin, useBooking, etc.)
- `types/index.ts` - Centralized TypeScript types, re-exports model interfaces
- `components/ui/` - Reusable UI components
- `lib/validations/` - Zod schemas validated at API boundaries (booking, dining-reservation, experience-booking)

### Auth Routing (`proxy.ts`)

Next.js 16 replaces `middleware.ts` with `proxy.ts`. Clerk middleware uses `createRouteMatcher` to gate these API surfaces:

- `/api/bookings(.*)`
- `/api/dining-reservations(.*)`
- `/api/experience-bookings(.*)`
- `/api/payments(.*)` — **except** `/api/payments/webhook`, which is verified by Stripe signature. The handler short-circuits with an explicit early return for that path.
- `/api/send(.*)`

Public API routes (no auth): `/api/cabins`, `/api/experiences`, `/api/dining`, `/api/settings`. Pages are not gated — users can browse cabins anonymously and only need to sign in to book.

When adding a new mutating API route, extend the `createRouteMatcher` list in `proxy.ts` — not a file named `middleware.ts`.

### Auth conventions inside route handlers

- **Derive `customer` from `await auth().userId` server-side.** Never accept a customer / user id from the request body — bodies are attacker-controlled. Booking/reservation create endpoints all follow this.
- **Mutations and reads scoped to a specific resource** (e.g. `GET|PATCH|DELETE /api/bookings/[id]`) must verify `resource.customer.toString() === userId` after `findById`. On mismatch, return **404 with a "not found" body** — 403 leaks the existence of the resource.
- The proxy is the primary gate; in-handler `await auth()` checks remain as defense in depth for any route that could be hit if the matcher list ever drifts.
- Stripe webhook handler must use `stripe.webhooks.constructEvent` and check `ProcessedStripeEvent` for idempotency _before_ mutating booking state.

### Model Relationships

- **Booking.cabin** references Cabin via ObjectId
- **ExperienceBooking.experience** references Experience via ObjectId
- **DiningReservation.dining** references Dining via ObjectId
- **\*.customer** stores Clerk user ID as string (not ObjectId)
- All models extend Mongoose `Document` interface
- **ProcessedStripeEvent** stores Stripe event IDs; preserve receipt-level idempotency and concurrency checks in shared settlement helpers as well

### API Response Format

Most resource routes use the following legacy `ApiResponse<T>` shape. Webhook and some email responses differ; verify each route and its caller before normalizing contracts:

```typescript
{ success: boolean; data?: T; error?: string; message?: string }
```

### Workspace verification

CI uses Node 22 and pnpm 11.17.0. From the repo root, `pnpm ci:check` runs
formatting, read-only lint and tests; builds remain a separate `pnpm build` gate.
App-local `lint`/`ci:check` scripts use auto-fixing lint, so use
`pnpm exec eslint .` for read-only app validation. Shared model/domain changes
require database tests and both app suites/builds. See the root `AGENTS.md` and
`docs/refactoring/api-testing-readiness.md` for the baseline and its limitations.

### Testing

Tests live in `__tests__/` organized by feature (bookings, cabins, lib, shared). Jest 30 with React Testing Library. Framer-motion is mocked in `__tests__/__mocks__/`.

- HeroUI components need manual mocks in `__tests__/__mocks__/@heroui/` — add one per package (e.g. `skeleton.js`, `tooltip.js`).
- Components that use React Query hooks (`useX`) must mock those hooks in page-level tests to avoid needing `QueryClientProvider`. `BookingForm` in particular pulls in `useSettings` — any test that renders it must `jest.mock('@/hooks/useSettings', …)` even if it doesn't assert on settings.
- Hook-level tests use `customRender` from `__tests__/shared/test-utils.tsx`, which wraps with a real `QueryClient` configured for tests (no retries, no caching).
- Existing model interfaces often extend Mongoose `Document`; plain API/UI fixtures must not pretend to be documents. Use explicit DTO props and checked fixture builders; use real Mongoose documents when testing document behavior. Never add `as unknown as` casts to satisfy fixtures. See root `AGENTS.md` and Phase 1 of the refactoring plan.
- A `.worktrees/` directory is in `testPathIgnorePatterns`; jest still warns about haste-map collisions if a worktree is left behind. The warnings are noise.

### ESLint Rules

- JSX props must be sorted alphabetically (`react/jsx-sort-props`)
- `no-console` warns except for `warn` and `error`
- Unused vars with `_` prefix are ignored
