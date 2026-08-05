# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (Turbopack). Customer portal convention is port 3002 to avoid the admin dashboard on 3000 — set PORT in .env.local.
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
Page/Component → Custom Hook (hooks/) → API Route (app/api/) → Mongoose Model (models/)
```

Custom hooks in `hooks/` use React Query to fetch from internal API routes. API routes connect to MongoDB via `connectDB()` from `lib/mongodb.ts`.

### Key Directories

- `app/api/` - API routes: bookings, cabins, dining, dining-reservations, experiences, experience-bookings, payments, settings, send (email)
- `models/` - Mongoose schemas: Booking, Cabin, Dining, DiningReservation, Experience, ExperienceBooking, ProcessedStripeEvent, Settings
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
- **ProcessedStripeEvent** stores Stripe webhook event IDs for idempotency — check this before processing a webhook to avoid double-handling

### API Response Format

All API routes return `ApiResponse<T>`:

```typescript
{ success: boolean; data?: T; error?: string; message?: string }
```

### Testing

Tests live in `__tests__/` organized by feature (bookings, cabins, lib, shared). Jest 30 with React Testing Library. Framer-motion is mocked in `__tests__/__mocks__/`.

- HeroUI components need manual mocks in `__tests__/__mocks__/@heroui/` — add one per package (e.g. `skeleton.js`, `tooltip.js`).
- Components that use React Query hooks (`useX`) must mock those hooks in page-level tests to avoid needing `QueryClientProvider`. `BookingForm` in particular pulls in `useSettings` — any test that renders it must `jest.mock('@/hooks/useSettings', …)` even if it doesn't assert on settings.
- Hook-level tests use `customRender` from `__tests__/shared/test-utils.tsx`, which wraps with a real `QueryClient` configured for tests (no retries, no caching).
- Mongoose document types (`Cabin`, `Booking`, etc. re-exported from `types/index.ts`) extend `mongoose.Document` and **cannot be satisfied by plain mock objects** (53+ required fields, including `$assertPopulated` etc.). Cast at the fixture boundary: `const mockCabin = { … } as unknown as Cabin`. Spread variants like `{ ...mockCabin, capacity: 1 }` need their own cast — TS does not propagate the cast through spreads.
- A `.worktrees/` directory is in `testPathIgnorePatterns`; jest still warns about haste-map collisions if a worktree is left behind. The warnings are noise.

### ESLint Rules

- JSX props must be sorted alphabetically (`react/jsx-sort-props`)
- `no-console` warns except for `warn` and `error`
- Unused vars with `_` prefix are ignored
