# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LodgeFlow is a modern hotel management dashboard built with Next.js 16, featuring comprehensive cabin management, booking system, customer profiles, and business analytics. The application uses MongoDB for business data and Clerk for authentication.

**Tech Stack:**
- Frontend: Next.js 16 (App Router), HeroUI v2, Tailwind CSS v4, TypeScript
- Backend: MongoDB with Mongoose ODM
- Auth: Clerk (role-based: admin, customer)
- Validation: Zod v4 (`lib/validations/`)
- Data Fetching: SWR for client-side, TanStack Query for mutations
- Email: Resend (booking confirmation & welcome emails)
- Charts: Recharts

## Essential Commands

### Development
```bash
pnpm dev              # Start development server with Turbopack
pnpm build            # Build for production
pnpm start            # Start production server
```

### Code Quality
```bash
pnpm lint             # Run ESLint with auto-fix
pnpm format           # Format all files with Prettier
pnpm format:check     # Check formatting without changes
pnpm format:fix       # Format only files that differ from Prettier's output
pnpm ci:check         # Run all checks (format, lint, test)
pnpm check:types      # TypeScript type checking via script
pnpm pre-commit       # lint-staged (runs via Husky on commit)
```

### Testing
```bash
pnpm test             # Run all Jest projects (unit, integration, jsdom)
pnpm test:fast        # Unit + jsdom only (no MongoDB binary required)
pnpm test:unit        # Pure-function unit tests only
pnpm test:integration # MongoDB Memory Server integration tests only
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Generate coverage report
```

### Database & Seeding
```bash
pnpm seed             # Seed database with sample data
pnpm tsx scripts/test-connection.ts  # Test MongoDB connection

# Data extraction (backup/migration)
pnpm extract:all      # Extract all data types
pnpm extract:cabins   # Extract cabin data only
pnpm extract:dining   # Extract dining data only
pnpm extract:experiences
pnpm extract:settings

# User management
pnpm clerk:list       # Get existing Clerk users
pnpm clerk:users      # Create new Clerk test users
```

### Utilities
```bash
pnpm verify:bookings           # Verify booking user IDs
pnpm summary                 # Display data summary
pnpm backfill:booking-metadata  # Backfill booking payment/refund metadata
```

## Agent Workflow (Issues, PRs & CI)

**These rules are mandatory for all agents.** Do not skip them.

### Before creating an issue

1. **Read `docs/issues_template.md` in full** — it is the source of truth for issue structure in this repo.
2. Pick the correct flavor:
   - **Bug** — broken behavior with steps to reproduce
   - **Gap / launch blocker** — infrastructure exists but isn't wired up
   - **Feature / scope** — net-new functionality
3. Follow the template skeleton for that flavor. Required discipline across all flavors: **Problem first → Scope second → Acceptance criteria third**.
4. Use concrete file paths and code references in `## Problem`. Backtick every identifier.
5. Write acceptance criteria as verifiable checkboxes, including test coverage when applicable.

### Before opening a pull request

1. **Read `docs/pull_requests_template.md` in full** — it is the source of truth for PR structure in this repo.
2. **Run `pnpm ci:check` and confirm it passes** (format, lint, and all tests). This is a hard gate — **do not open a PR with failing tests, lint errors, or format violations.**
3. Structure the PR body per the template:
   - Header: `Closes #N.` (with dependency chains when applicable)
   - `## Summary` — terse bullets, one per discrete change, inline code for paths/identifiers
   - `## Test plan` — checkboxes with **actual commands run** and **inline results** (e.g. `` `pnpm test` — 142 passing ``)
   - Optional sections (`## Details`, `## Why`, `## Notes`, `## Out of scope`, `## Follow-up`) only when they earn their place
4. Cross-reference `CLAUDE.md` patterns when the change touches established invariants.
5. If `pnpm ci:check` fails, **fix the failures first**. If you cannot fix them, or you are unsure how to proceed (ambiguous scope, pre-existing failures, flaky tests, missing env/secrets), **stop and ask the user how to proceed** — do not open the PR and hope CI sorts it out.

### When uncertain

- Do not guess. Do not open issues or PRs with placeholder sections.
- Do not open a PR to "get feedback" on broken tests.
- Ask the user explicitly: what failed, what you tried, and what decision you need.

## Architecture

### Directory Structure

```
app/
├── (auth)/              # Auth routes (sign-in, sign-up, unauthorized)
├── (dashboard)/         # Protected dashboard routes
│   ├── bookings/       # Booking management (list, detail, edit, analytics)
│   ├── cabins/         # Cabin management
│   ├── dining/         # Restaurant/menu management
│   ├── experiences/    # Activities/tours management
│   ├── guests/         # Customer profiles
│   └── settings/       # Business configuration
├── api/                # API route handlers
│   ├── bookings/       # CRUD, stats, analytics, by-email
│   ├── cabins/         # CRUD, stats, availability, bulk
│   ├── customers/      # CRUD, lock
│   ├── dashboard/      # Dashboard aggregates
│   ├── dining/         # CRUD, stats
│   ├── experiences/    # CRUD, stats
│   ├── sales/          # Revenue time-series
│   ├── settings/       # Singleton settings (GET/PUT/POST reset)
│   ├── cron/seed/      # Bearer-token-protected re-seed endpoint
│   └── send/           # Email sending (confirm, welcome)
└── providers.tsx       # Global providers (HeroUI, Theme, Query)

components/             # Reusable UI components
hooks/                  # Custom React hooks (SWR-based)
models/                 # Mongoose schemas (MongoDB)
types/                  # TypeScript type definitions
utils/                  # Shared utility functions
  ├── utilityFunctions.ts  # formatCurrency, getLoyaltyTier, calcNumNights, etc.
  ├── bookingUtils.ts      # getStatusColor, formatBookingDates, getStatusLabel
  └── toastUtils.ts        # displayToast helper for hooks
lib/                    # Core libraries & configuration
  ├── mongodb.ts        # DB connection with caching
  ├── config.ts         # App-wide constants (SWR_CONFIG, DB_CONFIG, CURRENCY, enums)
  ├── api-utils.ts      # API helpers (auth, responses, pagination, Zod errors)
  ├── auth-helpers.ts   # Role-based access helpers
  ├── clerk-users.ts    # Clerk API utilities
  ├── logger.ts         # Structured logging (suppressed in test env)
  ├── rate-limit.ts     # In-memory rate limiter for mutation/email endpoints
  ├── booking-pricing.ts # Server-side pricing calculator (see Booking Pricing below)
  ├── validations/      # Zod schemas per domain (booking, cabin, customer, etc.)
  └── data/seed-data.ts # Default seed payloads (settings, etc.)
config/                 # Site-wide constants (fonts.ts, site.ts) — not lib/config.ts
proxy.ts                # Clerk middleware (Next.js 16 — auth gate for all routes)
```

### Authentication Architecture

**Clerk-Based Auth** (Clerk manages users, MongoDB stores business data):
- Users are stored in Clerk with roles: `org:admin`, `org:customer`
- Only `org:admin` may access the admin dashboard (enforced in `proxy.ts` and API routes)
- Bookings reference Clerk user IDs (string) instead of MongoDB ObjectIds
- Customer statistics are calculated on-demand using Clerk user data
- Protected routes use `AuthGuard` component (client-side)
- API routes check auth using `requireApiAuth()` from `@/lib/api-utils`

**Public routes** (no Clerk session required): `/sign-in`, `/sign-up`, `/unauthorized`, `/`, `/api/cron/seed`, `/api/webhooks/*`

**Key Auth Patterns:**
```typescript
// Check authorization in API routes
import { requireApiAuth } from '@/lib/api-utils';

const authResult = await requireApiAuth();
if (!authResult.authenticated) return authResult.error;

// Get Clerk user data
import { getClerkUser } from '@/lib/clerk-users';
const user = await getClerkUser(clerkUserId);
```

### Data Flow Pattern

**Client → API → Database**
1. Client components use custom hooks (SWR/TanStack Query)
2. Hooks call `/api/*` route handlers
3. API routes connect to MongoDB via `connectDB()`
4. API routes fetch Clerk user data when needed
5. Responses follow consistent format:
```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  pagination?: { ... };
}
```

**Key Data Fetching Hooks:**
- `useBookings()` / `useBookingStats()` / `useBookingAnalytics()` — bookings (SWR)
- `useCabins()` / `useCabinStats()` — cabins (SWR)
- `useCustomers()` / `useInfiniteCustomers()` — Clerk users with customer stats (SWR)
- `useDining()` / `useDiningStats()` — dining items (SWR)
- `useExperiences()` / `useExperienceStats()` — experiences (SWR)
- `useSettings()` — app settings (SWR)
- `useData()` — dashboard overview aggregates (SWR)
- `useSendEmail()` / `usePrintBooking()` — mutations & PDF generation
- Mutations use TanStack Query's `useMutation`

### Request Validation (Zod)

Schemas live in `lib/validations/` and share enum constants from `lib/config.ts` (`BOOKING_STATUSES`, `PAYMENT_METHODS`, `REFUND_STATUSES`, `VALID_TRANSITIONS`).

**Currently wired in API routes:** bookings (create/update/patch), cabins (create/update), dining (create/update), experiences (create/update), customers (create), settings (PUT).

**Schemas exist but not yet wired to a route:** `updateCustomerSchema` (`lib/validations/customer.ts`) — customer updates go through Clerk helper functions (`updateCompleteCustomer`) instead. Delete/bulk endpoints (e.g. `app/api/cabins/bulk`) also use manual validation rather than Zod.

**Pattern:**
```typescript
import { createValidationErrorResponse } from '@/lib/api-utils';
import { createBookingSchema } from '@/lib/validations';

const validationResult = createBookingSchema.safeParse(body);
if (!validationResult.success) {
  return createValidationErrorResponse(validationResult.error);
}
const data = validationResult.data;
```

### MongoDB Models & Relationships

**Core Collections:**
- `Booking` — References `Cabin` (ObjectId), stores `customer` as Clerk user ID (string). Includes payment/refund metadata (`stripePaymentIntentId`, `stripeSessionId`, `refundStatus`, `paidAt`, etc.) aligned with the customer portal.
- `Cabin` — Accommodation inventory with amenities, pricing, capacity
- `Dining` — Restaurant items with categories, pricing, images
- `Experience` — Activities/tours with difficulty, duration, participants
- `Settings` — Business rules, pricing policies (singleton — DO NOT modify directly)
- `ProcessedStripeEvent` — Idempotency store for Stripe webhook events (TTL index, 30-day expiry). Not yet exported from `models/index.ts` or referenced anywhere — `proxy.ts` allow-lists `/api/webhooks/*` as a public route, but no `app/api/webhooks/` handler exists yet. Wire this model in when the Stripe webhook route is built.

**Important Indexes:**
- Bookings: Compound indexes on `{ cabin, checkInDate, checkOutDate }`, `{ customer, createdAt }`
- Bookings: Single indexes on `status`, `isPaid`, date fields

**Schema Validation:**
- Mongoose schemas include validation rules and pre-save middleware
- `Booking` schema auto-calculates `numNights` and `remainingAmount`
- Static method `Booking.findOverlapping()` prevents double-bookings
- Booking status transitions enforced via `VALID_TRANSITIONS` in `lib/config.ts`

### Configuration & Constants

**Centralized Config** (`lib/config.ts`):
- `SWR_CONFIG` — Deduping intervals, revalidation rules
- `DB_CONFIG` — Connection pool, timeouts
- `CURRENCY` — Default currency settings
- `LOYALTY_TIERS` — Customer tier thresholds
- `BOOKING_STATUSES`, `REFUND_STATUSES`, `PAYMENT_METHODS`, `CABIN_STATUSES`, `DINING_TYPES`, `MEAL_TYPES`, `DINING_CATEGORIES`, `BEVERAGE_CATEGORIES`, `DIETARY_OPTIONS`, `EXPERIENCE_DIFFICULTIES` — Single source of truth for TypeScript, Zod, and Mongoose

**API Utilities** (`lib/api-utils.ts`):
- `API_CONFIG` — Pagination defaults (DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
- `requireApiAuth()` — Authentication for API routes
- `createSuccessResponse()` / `createErrorResponse()` — Standardized responses
- `createValidationErrorResponse()` / `formatZodErrors()` — Zod error formatting
- `createRateLimitResponse()` — 429 responses with `Retry-After` header
- `parsePagination()` / `buildPaginationMeta()` / `createPaginatedResponse()` — Pagination helpers
- `sanitizeUpdatePayload()` — Strip Mongo operator keys (`$...`), dotted keys, `_id`, `__v` from PATCH/PUT bodies (not a pricing guard — see "Booking Pricing Is Always Server-Computed" below)
- `escapeRegex()` — Escape user input before building Mongo regex queries (prevents regex injection)
- `HTTP_STATUS` — Named status code constants

**Rate Limiting** (`lib/rate-limit.ts`):
- In-memory limiter suitable for single-instance / dev deployments
- Preset configs: `MUTATION`, `EMAIL`, `CUSTOMER_CREATE`, `BOOKING_CREATE`, `AUTH`
- Applied on email send (`app/api/send/confirm`, `app/api/send/welcome`) and customer-create (`app/api/customers` POST); use `checkRateLimit()` + `createRateLimitKey()` for new sensitive routes. Note: the `BOOKING_CREATE` preset exists but is not yet wired into `app/api/bookings` — apply it there if booking creation needs rate limiting.

**Logging** (`lib/logger.ts`):
- Use `logger.info/warn/error/debug()` instead of raw `console.*` in server code
- Automatically suppressed when `NODE_ENV === 'test'`

### State Management

- **Server State:** SWR (data fetching) + TanStack Query (mutations)
- **UI State:** React hooks (useState, useReducer)
- **Theme:** next-themes provider
- **Forms:** Controlled components with custom validation
- **URL State:** Custom `useURLFilters` hook for filters/pagination

### Styling Approach

- **Tailwind CSS v4** for utility classes (`@tailwindcss/postcss`)
- **HeroUI v2** component library (customized theme)
- **CSS-in-JS:** tailwind-variants for component variants
- Dark mode via `next-themes` with HeroUI integration
- Responsive design: mobile-first approach

## Important Patterns

### Path Alias
Use `@/` for absolute imports:
```typescript
import { Booking } from '@/models';
import { useBookings } from '@/hooks/useBookings';
import { hasAuthorizedRole } from '@/lib/auth-helpers';
```

### Error Handling
```typescript
// API routes
import { getErrorMessage } from '@/types/errors';

try {
  // ... operation
} catch (error) {
  return NextResponse.json(
    { success: false, error: getErrorMessage(error) },
    { status: 500 }
  );
}
```

### MongoDB Connection
Always use the cached connection:
```typescript
import connectDB from '@/lib/mongodb';
await connectDB();
// Now use Mongoose models
```

### Type Safety
- Use exported types from `@/types` or `@/types/api`
- Models export interfaces: `IBooking`, `ICabin`, etc.
- API responses use `ApiResponse<T>` generic
- Populated documents use `PopulatedBooking`, etc.

### Shared Utilities — Avoid Duplicating These
```typescript
// Currency formatting — use the shared helper, don't create inline Intl.NumberFormat calls
import { formatCurrency } from '@/utils/utilityFunctions';

// Booking status colors — single canonical source
import { getStatusColor } from '@/utils/bookingUtils';

// Toast notifications — shared helper for hooks
import { displayToast } from '@/utils/toastUtils';
```

### Customer Data Pattern
```typescript
// Bookings store Clerk user ID as string
booking.customer = "user_2abc123def";

// Fetch full customer data via Clerk API
import { getClerkUser } from '@/lib/clerk-users';
const customer = await getClerkUser(booking.customer);

// Customer stats are calculated from bookings
const bookings = await Booking.find({ customer: clerkUserId });
const totalSpent = bookings.reduce((sum, b) => sum + b.totalPrice, 0);
```

## Critical Notes

### DO NOT Modify Settings Collection Directly
The `Settings` collection contains critical business rules and pricing. Only modify through the admin interface or extraction scripts. Use `extract:settings` to backup before any changes.

### Booking Validation
The `Booking` model includes overlap detection. Always check for conflicts:
```typescript
const overlapping = await Booking.findOverlapping(
  cabinId,
  checkInDate,
  checkOutDate,
  excludeBookingId
);
if (overlapping.length > 0) {
  // Handle conflict
}
```

Settings is the single source of truth for booking business rules (min/max nights, deposit %, etc.). Booking API validation reads from the Settings document at request time.

### Booking Pricing Is Always Server-Computed
Pricing fields are never trusted from the client. `lib/booking-pricing.ts` exports
`calculateBookingPricing({ cabin, settings, checkInDate, checkOutDate, numGuests, extras })`,
which derives `numNights`, `cabinPrice`, each `extras.*Fee`, `extrasPrice`, and `totalPrice`
from the `Cabin` and `Settings` documents — never from the request body. It throws
`BookingPricingError` (caught and returned as HTTP 400) for invalid night counts or guest counts.

- `POST /api/bookings` calls `calculateBookingPricing()` and overwrites the validated body's
  pricing fields before `Booking.create()`.
- `PUT /api/bookings` explicitly deletes any client-supplied `numNights`, `cabinPrice`,
  `extrasPrice`, `totalPrice`, and `remainingAmount`, then recomputes them via
  `calculateBookingPricing()` whenever a pricing-relevant field (`cabin`, `checkInDate`,
  `checkOutDate`, `numGuests`, `extras`) changed.
- The Zod schemas in `lib/validations/booking.ts` still type these fields for compatibility, but
  they are always ignored/recomputed at the route layer — don't rely on client-submitted values.

### Clerk Rate Limiting
API has concurrent call limits. Clerk user batch fetching uses `CLERK_API_CONCURRENT_LIMIT` env var (defaults to 3) in `lib/clerk-users.ts`.

### Environment Variables Required
No `.env.example` is checked into the repo (`.env*` is gitignored) — set these directly in `.env.local`. Minimum for local development:
```bash
MONGODB_URI=mongodb+srv://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
RESEND_API_KEY=re_...          # Email sending (/api/send/*)
SEED_SECRET=...                # Bearer token for /api/cron/seed
```

Optional:
```bash
CLERK_API_CONCURRENT_LIMIT=3   # Clerk batch fetch concurrency (default: 3)
TESTING_AUTH_BYPASS=true       # Server-only auth bypass (dev only)
NEXT_PUBLIC_TESTING=true       # Client UX bypass for AuthGuard (dev only)
```

### Auth Bypass for Testing
Auth bypass for local development is split across two flags so that the
**security-critical** server layers can never be disabled by a client-inlined
(`NEXT_PUBLIC_*`) variable, and can never activate in production.

**Server enforcement (security boundary)** — set the server-only
`TESTING_AUTH_BYPASS=true` in `.env.local`. Gated by `isAuthBypassEnabled()`
(`lib/auth-helpers.ts`), which returns `false` in production regardless of any
flag. This disables:
1. **Middleware** (`proxy.ts`) — skips Clerk session check and sign-in redirect
2. **API routes** (`lib/api-utils.ts` `requireApiAuth()`) — returns `userId: 'test-user'`
3. **Settings reset** (`app/api/settings/route.ts` `POST`) — skips the extra admin check

**Client UX only (not a security boundary)** — set `NEXT_PUBLIC_TESTING=true` so
`components/AuthGuard.tsx` renders the dashboard without a configured Clerk
provider. This flag grants no access to protected data; the server gates above
still apply.

For a fully bypassed local session, set **both**. Never set `TESTING_AUTH_BYPASS`
in any deployed (staging/production) environment. Requires a dev server restart
after changing either var.

### Date Handling
- Bookings use ISO date strings in API responses
- Use `date-fns` for formatting (not moment.js)
- `@internationalized/date` for HeroUI date pickers

## Testing

### Overview
- Tests in `__tests__/` directory using Jest + React Testing Library
- **Three-project config** (`jest.config.js`):
  - `unit` — node env, pure functions, no database (fast, runs in <1s)
  - `integration` — node env, real MongoDB via Memory Server (downloads a mongod binary on first run, needs network)
  - `jsdom` — hooks, validations, components, mock-based API tests
- Run `pnpm test` before committing, `pnpm test:coverage` for coverage report
- `pnpm test:fast` runs unit + jsdom only (no MongoDB binary needed) — use this in sandboxed/offline environments
- `pnpm test:unit` / `pnpm test:integration` select a single node project
- CI runs `pnpm ci:check` on every push/PR to `main` (`.github/workflows/ci.yml`)

### Test Structure
```
__tests__/
├── setup/                     # Test infrastructure
│   ├── globalSetup.ts         # MongoDB Memory Server startup (integration only)
│   ├── globalTeardown.ts      # MongoDB Memory Server cleanup
│   ├── jest.setup.node.ts     # Node env: DB connection, auth mocks
│   ├── jest.setup.jsdom.ts    # Browser env: router, SWR, Clerk, framer-motion mocks
│   ├── framer-motion.mock.js  # Renders motion.* as plain tags (see below)
│   ├── factories.ts           # Faker-based test data factories
│   ├── auth-helpers.ts        # Auth mocking utilities
│   └── mongodb.setup.ts       # DB cleanup helpers
├── unit/                      # Pure function tests, no DB (unit project)
│   ├── lib/                   # auth, api-utils, clerk-users, logger
│   ├── utils/                 # utilityFunctions, bookingUtils
│   └── types/                 # error type guards
├── integration/               # Real MongoDB via Memory Server
│   ├── models/                # Mongoose schema validation, CRUD, indexes
│   ├── api/                   # API route handlers with real DB
│   └── scripts/               # Migration/backfill script tests
├── validations/               # Zod schema tests (no DB)
├── hooks/                     # SWR/TanStack Query hook tests
├── api/                       # Mock-based API route tests (jsdom)
└── components/                # Component render tests
```

### Key Testing Patterns

**SWR hooks**: Mock `useSWR` to capture the key (URL) and verify query parameter building.

**TanStack Query hooks**: Mock `useQuery`/`useMutation` to capture config, then test `queryFn`/`mutationFn` directly with mocked `global.fetch`. Test `onSuccess` callbacks for cache invalidation and toast notifications (see `__tests__/hooks/useBookings.mutations.test.ts`).

**Components**: framer-motion is mocked globally in `jest.setup.jsdom.ts` — its real animation loop recurses under jsdom until the process runs out of memory. Any HeroUI component (Accordion, Button, Modal, …) renders fine with the mock in place. HeroUI Selects render a hidden native `<select>` plus a visible trigger that share the same aria-label, so use `getAllByLabelText` for them.

**Integration tests**: Use MongoDB Memory Server for real Mongoose operations. Auth is auto-mocked in `jest.setup.node.ts`.

**Factories**: Use `createCabinInput()`, `createBookingInput()`, `createDiningInput()`, `createExperienceInput()`, `createSettingsInput()`, `createMockClerkUser()` from `__tests__/setup/factories.ts`.

### Writing New Tests
1. **Pure function tests** → `__tests__/unit/` (unit project, no DB)
2. **Hook tests** → `__tests__/hooks/` (jsdom project)
3. **Model tests** → `__tests__/integration/models/` (integration project)
4. **API route tests** → `__tests__/integration/api/` (integration, real DB) or `__tests__/api/` (jsdom, mocked)
5. **Validation tests** → `__tests__/validations/` (jsdom project)
6. **Component tests** → `__tests__/components/` (jsdom project)

## Development Workflow

1. **Feature Development:**
   - Check existing patterns in similar features
   - Use custom hooks for data fetching
   - Follow HeroUI component patterns
   - Ensure type safety with TypeScript strict mode
   - Add Zod schemas in `lib/validations/` for new mutation endpoints

2. **Database Changes:**
   - Update Mongoose model schema
   - Add indexes for query performance
   - Test with seed data (`pnpm seed`)
   - Consider migration scripts for existing data (`scripts/backfill-*.ts`)

3. **API Development:**
   - Follow consistent response format
   - Include proper error handling
   - Validate input with Zod schemas + `createValidationErrorResponse()`
   - Use auth helpers for access control
   - Add pagination for list endpoints
   - Apply rate limiting on sensitive mutation/email endpoints

4. **Before Committing / Opening a PR:**
   - Follow **Agent Workflow (Issues, PRs & CI)** above — read the issue/PR templates and run `pnpm ci:check` before any PR
   - Test locally with `pnpm dev`
   - Verify database operations with seed data
   - Check TypeScript types compile
   - Update this file (`CLAUDE.md`) if the change invalidates documented patterns

## Additional Documentation

- `README.md` — Quick start, env setup, project overview
- `docs/api.md` — Full API endpoint reference (auth, rate limits, request/response shapes)
- `docs/issues_template.md` — **Required reading before creating issues** (bug / gap / feature skeletons)
- `docs/pull_requests_template.md` — **Required reading before opening PRs** (summary, test plan, conventions)
- `__tests__/API_TESTING.md` — API test coverage notes
