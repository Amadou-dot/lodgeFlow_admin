# Copilot Instructions for LodgeFlow

## Build, test, and lint commands

Use `pnpm` for all project scripts.

- `pnpm dev` - Start the Next.js dev server (port 3002, Turbopack)
- `pnpm build` - Create a production build
- `pnpm lint` - Run ESLint with `--fix` (this command can modify files)
- `pnpm test` - Run the full Jest suite
- `pnpm test -- --testPathPattern="cabins"` - Run one feature slice of tests
- `pnpm test -- __tests__/bookings/useBooking.test.tsx` - Run a single test file
- `pnpm ci:check` - Run format check + lint + tests

## High-level architecture

- The app follows this flow: **Page/Component -> hook in `hooks/` -> API route in `app/api/` -> Mongoose model in `models/`**.
- `app/providers.tsx` wires global client providers (React Query, HeroUI, toast provider, and theme provider); these are mounted in `app/layout.tsx`.
- API routes call `await connectDB()` from `lib/mongodb.ts` before model operations and return typed payloads using `ApiResponse<T>` from `types/index.ts`.
- Clerk handles authentication/authorization:
  - `proxy.ts` protects booking pages and booking API routes.
  - Route handlers also enforce ownership checks with `auth()` and `booking.customer`.
- Stripe payment flow is split between checkout and webhook routes:
  - `/api/payments/create-checkout` creates checkout sessions and stores `stripeSessionId` on bookings.
  - `/api/payments/webhook` finalizes booking/payment state and uses `ProcessedStripeEvent` for idempotent webhook processing.
- Email notifications are handled in `lib/email.ts` and `/api/send/*` routes (booking confirmations, payment confirmations, cancellation confirmations).

## Key repository conventions

- Data modeling convention: relational fields (`cabin`, `dining`, `experience`) are ObjectId refs, but `customer` is a Clerk user ID string.
- Mongoose models use the singleton pattern (`mongoose.models.X || mongoose.model(...)`) to prevent recompilation in dev.
- Reuse booking domain helpers instead of re-implementing logic:
  - `Booking.findOverlapping(...)` for availability/conflict checks.
  - `Settings.getSettings()` for default-backed global settings.
- Client-side server state uses React Query hooks in `hooks/`; after mutations, invalidate related query keys (for example `bookings`, `bookings-history`, `payment-status`).
- Keep API responses in this shape across routes: `{ success: boolean; data?: T; error?: string; message?: string }`.
- Use `@/*` import aliases (configured in `tsconfig.json`) for internal modules.
- Jest setup uses `next/jest` and maps `framer-motion` to `__tests__/__mocks__/framer-motion.js`.
- ESLint conventions enforced here include `react/jsx-sort-props` and allowing only `console.warn` / `console.error`.
- Preserve `.npmrc` setting `public-hoist-pattern[]=*@heroui/*` for HeroUI package resolution.
