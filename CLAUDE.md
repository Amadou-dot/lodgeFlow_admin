# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LodgeFlow is a modern hotel management dashboard built with Next.js 15, featuring comprehensive cabin management, booking system, customer profiles, and business analytics. The application uses MongoDB for business data and Clerk for authentication.

**Tech Stack:**
- Frontend: Next.js 15 (App Router), HeroUI v2, Tailwind CSS, TypeScript
- Backend: MongoDB with Mongoose ODM
- Auth: Clerk (role-based: admin, customer)
- Data Fetching: SWR for client-side, TanStack Query for mutations
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
pnpm ci:check         # Run all checks (format, lint, test)
pnpm check:types      # TypeScript type checking via script
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
pnpm verify:bookings       # Verify booking user IDs
pnpm summary              # Display data summary
```

## Architecture

### Directory Structure

```
app/
├── (auth)/              # Auth routes (sign-in, sign-up)
├── (dashboard)/         # Protected dashboard routes
│   ├── bookings/       # Booking management pages
│   ├── cabins/         # Cabin management
│   ├── dining/         # Restaurant/menu management
│   ├── experiences/    # Activities/tours management
│   ├── guests/         # Customer profiles
│   └── settings/       # Business configuration
├── api/                # API route handlers
│   ├── bookings/
│   ├── cabins/
│   ├── customers/
│   ├── dashboard/
│   ├── dining/
│   ├── experiences/
│   ├── settings/
│   └── send/          # Email sending endpoints
└── providers.tsx      # Global providers (HeroUI, Theme, Query)

components/            # Reusable UI components
hooks/                # Custom React hooks (SWR-based)
models/               # Mongoose schemas (MongoDB)
types/                # TypeScript type definitions
utils/                # Shared utility functions
  ├── utilityFunctions.ts  # formatCurrency, getLoyaltyTier, calcNumNights, etc.
  ├── bookingUtils.ts      # getStatusColor, formatBookingDates, getStatusLabel
  └── toastUtils.ts        # displayToast helper for hooks
lib/                  # Core libraries & configuration
  ├── mongodb.ts      # DB connection with caching
  ├── config.ts       # App-wide constants (SWR_CONFIG, DB_CONFIG, CURRENCY, LOYALTY_TIERS)
  ├── api-utils.ts    # API helpers (auth, responses, pagination, rate limiting)
  ├── auth-helpers.ts # Role-based access helpers
  └── clerk-users.ts  # Clerk API utilities
```

### Authentication Architecture

**Clerk-Based Auth** (Clerk manages users, MongoDB stores business data):
- Users are stored in Clerk with roles: `org:admin`, `org:customer`
- Bookings reference Clerk user IDs (string) instead of MongoDB ObjectIds
- Customer statistics are calculated on-demand using Clerk user data
- Protected routes use `AuthGuard` component (client-side)
- API routes check auth using `@/lib/auth-helpers`

**Key Auth Patterns:**
```typescript
// Check authorization in API routes
import { hasAuthorizedRole } from '@/lib/auth-helpers';
import { auth } from '@clerk/nextjs/server';

const { has } = await auth();
if (!hasAuthorizedRole(has)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

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
- `useBookings()` - Fetch bookings with filters/pagination (SWR)
- `useCabins()` - Fetch cabins with filters (SWR)
- `useCustomers()` - Fetch Clerk users with customer stats (SWR)
- `useSettings()` - Fetch app settings (SWR)
- Mutations use TanStack Query's `useMutation`

### MongoDB Models & Relationships

**Core Collections:**
- `Booking` - References `Cabin` (ObjectId) and stores `customer` as Clerk user ID (string)
- `Cabin` - Accommodation inventory with amenities, pricing, capacity
- `Dining` - Restaurant items with categories, pricing, images
- `Experience` - Activities/tours with difficulty, duration, participants
- `Settings` - Business rules, pricing policies (singleton - DO NOT modify directly)

**Important Indexes:**
- Bookings: Compound indexes on `{ cabin, checkInDate, checkOutDate }`, `{ customer, createdAt }`
- Bookings: Single indexes on `status`, `isPaid`, date fields

**Schema Validation:**
- Mongoose schemas include validation rules and pre-save middleware
- `Booking` schema auto-calculates `numNights` and `remainingAmount`
- Static method `Booking.findOverlapping()` prevents double-bookings

### Configuration & Constants

**Centralized Config** (`lib/config.ts`):
- `SWR_CONFIG` - Deduping intervals, revalidation rules
- `DB_CONFIG` - Connection pool, timeouts
- `CURRENCY` - Default currency settings
- `LOYALTY_TIERS` - Customer tier thresholds

**API Utilities** (`lib/api-utils.ts`):
- `API_CONFIG` - Pagination defaults (DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
- `requireApiAuth()` - Authentication for API routes
- `createSuccessResponse()` / `createErrorResponse()` - Standardized responses
- `parsePagination()` / `buildPaginationMeta()` - Pagination helpers

### State Management

- **Server State:** SWR (data fetching) + TanStack Query (mutations)
- **UI State:** React hooks (useState, useReducer)
- **Theme:** next-themes provider
- **Forms:** Controlled components with custom validation
- **URL State:** Custom `useURLFilters` hook for filters/pagination

### Styling Approach

- **Tailwind CSS** for utility classes
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

### Clerk Rate Limiting
API has concurrent call limits. Clerk user batch fetching uses `CLERK_API_CONCURRENT_LIMIT` env var (defaults to 3) in `lib/clerk-users.ts`.

### Environment Variables Required
```bash
MONGODB_URI=mongodb+srv://...
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

### Auth Bypass for Testing
Set `NEXT_PUBLIC_TESTING=true` in `.env.local` to bypass all auth in non-production environments. This disables three layers:
1. **Middleware** (`proxy.ts`) — skips Clerk session check and sign-in redirect
2. **AuthGuard** (`components/AuthGuard.tsx`) — skips client-side redirect
3. **API routes** (`lib/api-utils.ts` `requireApiAuth()`) — returns `userId: 'test-user'`

All three check: `process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_TESTING === 'true'`. Requires dev server restart after changing the env var.

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
│   └── api/                   # API route handlers with real DB
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

2. **Database Changes:**
   - Update Mongoose model schema
   - Add indexes for query performance
   - Test with seed data (`pnpm seed`)
   - Consider migration scripts for existing data

3. **API Development:**
   - Follow consistent response format
   - Include proper error handling
   - Validate input data
   - Use auth helpers for access control
   - Add pagination for list endpoints

4. **Before Committing:**
   - Run `pnpm ci:check` to verify format, lint, and tests
   - Test locally with `pnpm dev`
   - Verify database operations with seed data
   - Check TypeScript types compile

## Additional Documentation

- `CLERK_SETUP.md` - Clerk authentication configuration
- `SEEDING_GUIDE.md` - Database seeding and data extraction
- `ROLE_BASED_ACCESS_CONTROL.md` - RBAC implementation details
- `PRINTING_FUNCTIONALITY.md` - PDF generation features
- `DATABASE_SETUP.md` - MongoDB configuration
