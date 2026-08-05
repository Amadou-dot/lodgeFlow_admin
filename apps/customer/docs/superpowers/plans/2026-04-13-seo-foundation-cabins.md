# SEO Foundation & Cabin Indexability Implementation Plan

> [!WARNING]
> **Superseded — do not copy the env var or domain from this plan.** Code blocks
> below are preserved as a record of what was planned in April 2026. Two things
> have since changed:
>
> - `NEXT_PUBLIC_SITE_URL` no longer exists. `config/site.ts` reads
>   `NEXT_PUBLIC_APP_URL`, which is the var actually set in Vercel.
> - `lodgeflow.com` was a placeholder used before the real domain was bought.
>   The site is `lodgeflow.app`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LodgeFlow's core product pages (home + cabins list + cabin detail) fully crawlable, indexable, and rich-result-ready by converting them to server components with proper metadata, auth removal, and crawlability infrastructure.

**Architecture:** Three coordinated shifts: (1) unblock crawling by dropping the auth gate on public cabin detail URLs, (2) install SEO plumbing (metadataBase, robots.ts, sitemap.ts, JSON-LD helpers), (3) convert cabin pages from client-only React Query fetches to server components that render real HTML with per-page metadata, using a shared `lib/data/cabins.ts` fetcher wrapped in React `cache()`. Interactive client logic (filters, tabs, booking form) moves into `*Client` components that receive server-fetched data as props.

**Tech Stack:** Next.js 16 App Router, Mongoose 8 (existing `Cabin` model with `toJSON: { virtuals: true }`), React 18 `cache()`, Clerk auth (`proxy.ts`), schema.org JSON-LD (LodgingBusiness, BreadcrumbList), `@heroui/*` components, TypeScript 5.9.

---

## Background

An SEO audit found:

1. `/cabins/[id]` pages are auth-gated in `proxy.ts` line 21-23 — Googlebot cannot reach them.
2. `app/cabins/[id]/page.tsx` and `app/cabins/page.tsx` are `'use client'` components that fetch via React Query after hydration — crawlers see a loading skeleton, not product content.
3. No `robots.ts` / `sitemap.ts` / `metadataBase` exists — no discovery path, relative URLs in metadata resolve incorrectly.
4. No JSON-LD — no rich results eligibility.
5. No per-page titles or descriptions on the two most commercially-valuable URL patterns.

This plan addresses all five issues for the home page, cabins list, and cabin detail. Dining and experiences follow the **exact same pattern** and are scoped out as a follow-on plan (see closing section) to keep this plan's code examples concrete and non-repetitive.

## Out of Scope (Follow-On Plan)

- Server-conversion of `app/experiences/page.tsx`, `app/experiences/[id]/page.tsx`, `app/dining/page.tsx`, `app/dining/[id]/page.tsx`. (Their URLs **are** included in this plan's `sitemap.ts` so they get discovered — the server conversion itself comes next.)
- `app/opengraph-image.tsx` (dynamic OG image generation). A static PNG can be dropped at `app/opengraph-image.png` by a designer to activate the file-convention route; we do not block the plan on it.
- Per-cabin `app/cabins/[id]/opengraph-image.tsx`. Cabin-level OG metadata in this plan uses the existing `cabin.image` URL, which is sufficient.

## Safety note on JSON-LD injection

The plan emits JSON-LD via a `<script type="application/ld+json">` tag. In Next.js there are two options: the React-style element approach (`<script type="application/ld+json">{JSON.stringify(data)}</script>`) or the explicit inner-HTML approach. The React-style approach is preferred in this plan because the body is a `<script>` element (not HTML) and the content is `JSON.stringify(...)` of a plain object built from our own database — there is no user-supplied string. If your lint config or CSP flags the explicit inner-HTML pattern, swap to the React-style form; they produce identical output.

## File Structure

**Created:**

- `app/robots.ts` — robots directives (disallow private routes, reference sitemap)
- `app/sitemap.ts` — sitemap listing home, cabins list, each cabin detail, dining list, each dining detail, experiences list, each experience detail
- `lib/data/cabins.ts` — server-side cabin fetchers wrapped in React `cache()` so metadata + page share one DB round-trip
- `lib/seo/jsonLd.ts` — pure functions that map domain objects to schema.org JSON-LD objects (`cabinToLodgingBusiness`, `siteToLodgingBusiness`, `buildBreadcrumbList`)
- `components/CabinDetailClient.tsx` — the interactive parts of the current `app/cabins/[id]/page.tsx` (gallery, tabs, booking form, settings hook) — receives `cabin` as a serialized prop
- `components/CabinsListClient.tsx` — the interactive parts of the current `app/cabins/page.tsx` (filters, sort, search) — receives `initialCabins` as a serialized prop

**Modified:**

- `.env.local.example` — add `NEXT_PUBLIC_SITE_URL`
- `.env.local` — add `NEXT_PUBLIC_SITE_URL` (local dev value)
- `config/site.ts` — add `url`, `twitterHandle`, `defaultOgImageAlt`
- `app/layout.tsx` — set `metadataBase`, default `openGraph`, `twitter`, `robots`, `alternates`
- `proxy.ts` — drop the `/cabins/[id]` auth gate (one block deleted)
- `app/cabins/[id]/page.tsx` — rewritten as a server component: fetches cabin server-side, exports `generateMetadata`, emits JSON-LD, renders `<CabinDetailClient cabin={cabin} />`
- `app/cabins/page.tsx` — rewritten as a server component: fetches cabin list, exports static `metadata`, renders `<CabinsListClient initialCabins={cabins} />`
- `app/page.tsx` — adds a LodgingBusiness JSON-LD `<script>` tag near the top of the rendered tree
- `__tests__/cabins/CabinPageLayout.test.tsx` — retargeted to test `CabinDetailClient` with a cabin prop instead of mocking `useCabin`

**Unchanged (reference only):**

- `app/api/cabins/route.ts` and `app/api/cabins/[id]/route.ts` — still used by `useCabins` for client-side filtering; we do not remove them because other consumers (admin, internal tools, potential mobile app) may depend on them, and they are already public in `proxy.ts`.
- `models/Cabin.ts` — we rely on its existing `toJSON: { virtuals: true }` config. **Important:** use `JSON.parse(JSON.stringify(doc))` for serialization across the server/client boundary; do **not** use `.lean()` because that skips virtuals (e.g. `discountedPrice`).
- `hooks/useCabin.ts`, `hooks/useCabins.ts` — left in place; not used by the refactored pages but kept for any remaining consumers.

---

## Phase 1: SEO Foundation

### Task 1: Add site URL environment variable

**Files:**

- Modify: `.env.local.example`
- Modify: `.env.local`

- [ ] **Step 1: Append the variable to `.env.local.example`**

Append to the end of `/home/yzel/github/LodgeFlow/.env.local.example`:

```bash

# Public origin of the site. Used by Next.js metadataBase, sitemap.ts, robots.ts,
# and any absolute-URL generation. Set this in Vercel production env too.
NEXT_PUBLIC_SITE_URL=https://lodgeflow.com
```

- [ ] **Step 2: Append the variable to `.env.local`**

Append to `/home/yzel/github/LodgeFlow/.env.local`:

```bash

NEXT_PUBLIC_SITE_URL=http://localhost:3002
```

- [ ] **Step 3: Verify the variable is readable**

Run:

```bash
cd /home/yzel/github/LodgeFlow
grep NEXT_PUBLIC_SITE_URL .env.local .env.local.example
```

Expected output: two lines, one per file.

- [ ] **Step 4: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add .env.local.example
# Note: do NOT add .env.local (it is gitignored by default)
git commit -m "chore: document NEXT_PUBLIC_SITE_URL env var for SEO foundation"
```

---

### Task 2: Expand `siteConfig` with SEO-relevant fields

**Files:**

- Modify: `config/site.ts`

- [ ] **Step 1: Add SEO fields to `siteConfig`**

Replace the current `siteConfig` object in `/home/yzel/github/LodgeFlow/config/site.ts` with:

```ts
export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: 'LodgeFlow',
  description:
    'Welcome to paradise. Escape to luxury in the heart of nature at LodgeFlow.',
  // SEO / social fields
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lodgeflow.com',
  twitterHandle: '@lodgeflow',
  defaultOgImageAlt: 'LodgeFlow — luxury cabins in nature',
  navItems: [
    { label: 'Home', href: '/' },
    { label: 'Cabins', href: '/cabins' },
    { label: 'Experiences', href: '/experiences' },
    { label: 'Dining', href: '/dining' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
  navMenuItems: [
    { label: 'My Bookings', href: '/bookings' },
    { label: 'Profile', href: '/profile' },
    { label: 'Preferences', href: '/preferences' },
    { label: 'Help & Support', href: '/help' },
    { label: 'Logout', href: '/logout' },
  ],
  links: {
    reservations: 'tel:+1-800-LODGEFLOW',
    email: 'mailto:hello@lodgeflow.com',
    instagram: 'https://instagram.com/#',
    facebook: 'https://facebook.com/#',
  },
};
```

- [ ] **Step 2: Type-check**

Run:

```bash
cd /home/yzel/github/LodgeFlow
npx tsc --noEmit
```

Expected: no new errors related to `siteConfig`. If existing errors appear, they are pre-existing and unrelated — note and proceed.

- [ ] **Step 3: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add config/site.ts
git commit -m "feat(seo): add url, twitterHandle, defaultOgImageAlt to siteConfig"
```

---

### Task 3: Enhance root layout metadata

**Files:**

- Modify: `app/layout.tsx`

- [ ] **Step 1: Replace the `metadata` export with the enhanced version**

Replace lines 13-22 of `/home/yzel/github/LodgeFlow/app/layout.tsx` (the current `export const metadata: Metadata = { ... }` block) with:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  icons: {
    icon: '/logo.svg',
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: 'summary_large_image',
    site: siteConfig.twitterHandle,
    creator: siteConfig.twitterHandle,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};
```

Notes about this block:

- `metadataBase` resolves relative OG / canonical URLs in child pages.
- No explicit `openGraph.images` — Next.js picks up `app/opengraph-image.png` automatically when a designer drops the file in. If you want a placeholder immediately, copy `public/logo.svg` → export to PNG, but this is not required to land this task.
- `alternates.canonical: '/'` is the root canonical; child pages that need their own canonical will override it.

- [ ] **Step 2: Start the dev server**

Run in a separate terminal:

```bash
cd /home/yzel/github/LodgeFlow
pnpm dev
```

Wait for `Ready in Xs`.

- [ ] **Step 3: Verify the home page emits the new meta tags**

Run:

```bash
curl -s http://localhost:3002 | grep -iE '(og:|twitter:|canonical|robots)' | head -20
```

Expected: output includes `og:title`, `og:description`, `twitter:card`, `canonical`, `robots` meta tags with values from `siteConfig`.

- [ ] **Step 4: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add app/layout.tsx
git commit -m "feat(seo): set metadataBase, OG/Twitter defaults, and robots directives in root layout"
```

---

## Phase 2: Unblock Crawling

### Task 4: Remove auth gate from `/cabins/[id]`

**Files:**

- Modify: `proxy.ts`

**Why first (of the behavioral changes):** Cabin detail pages are commercially the most valuable URLs on the site. They are public content (no personal data on the page itself) and the auth gate prevents Googlebot from seeing them at all. This is a one-block change with zero architectural risk. Everything else builds on this being unblocked.

- [ ] **Step 1: Delete the cabin-booking auth-protect block**

In `/home/yzel/github/LodgeFlow/proxy.ts`, delete lines 20-23 (the comment and the match/protect block):

Remove:

```ts
// Protect cabin booking pages - require login to book
if (req.nextUrl.pathname.match(/^\/cabins\/[^/]+$/)) {
  await auth.protect();
}
```

The resulting middleware body should be:

```ts
export default clerkMiddleware(async (auth, req) => {
  // Protect API routes that create bookings or user-specific data
  if (req.nextUrl.pathname.startsWith('/api/bookings')) {
    await auth.protect();
  }
});
```

`isPublicRoute` already lists `/cabins` as public, so this change leaves `/cabins/[id]` reachable to unauthenticated visitors. The booking form itself (inside the page) already handles unauthenticated state — sign-in is prompted at booking submission time, not at page view time.

- [ ] **Step 2: Restart dev server if running**

In your dev terminal, stop and restart `pnpm dev` so middleware reloads cleanly.

- [ ] **Step 3: Verify unauthenticated access works**

Pick any cabin ID from the database. If you don't have one handy:

```bash
curl -s http://localhost:3002/api/cabins | head -80
```

Grab an `_id` from the response.

Then (without Clerk session cookies):

```bash
curl -sI "http://localhost:3002/cabins/<THAT_ID>" | head -5
```

Expected: `HTTP/1.1 200 OK` (not 302/307 redirect to sign-in).

- [ ] **Step 4: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add proxy.ts
git commit -m "fix(seo): remove auth gate on cabin detail pages so they are crawlable"
```

---

## Phase 3: Crawlability Infrastructure

### Task 5: Create `app/robots.ts`

**Files:**

- Create: `app/robots.ts`

- [ ] **Step 1: Write the file**

Create `/home/yzel/github/LodgeFlow/app/robots.ts`:

```ts
import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/bookings',
          '/profile',
          '/preferences',
          '/sign-in',
          '/sign-up',
          '/logout',
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
```

- [ ] **Step 2: Verify the route responds**

With dev server running:

```bash
curl -s http://localhost:3002/robots.txt
```

Expected: plain text robots response containing `User-Agent: *`, `Allow: /`, `Disallow: /api/`, `Sitemap: http://localhost:3002/sitemap.xml`, `Host: http://localhost:3002`.

- [ ] **Step 3: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add app/robots.ts
git commit -m "feat(seo): add robots.ts with public allow list and sitemap reference"
```

---

### Task 6: Create `app/sitemap.ts`

**Files:**

- Create: `app/sitemap.ts`

- [ ] **Step 1: Write the sitemap**

Create `/home/yzel/github/LodgeFlow/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next';

import { siteConfig } from '@/config/site';
import { connectDB, Cabin, Dining, Experience } from '@/models';

export const revalidate = 3600; // Regenerate sitemap hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${base}/cabins`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${base}/experiences`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/dining`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${base}/contact`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  try {
    await connectDB();
    const [cabins, experiences, dining] = await Promise.all([
      Cabin.find({ status: 'active' }).select('_id updatedAt').lean(),
      Experience.find({}).select('_id updatedAt').lean(),
      Dining.find({}).select('_id updatedAt').lean(),
    ]);

    const cabinEntries: MetadataRoute.Sitemap = cabins.map((c: any) => ({
      url: `${base}/cabins/${c._id}`,
      lastModified: c.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    const experienceEntries: MetadataRoute.Sitemap = experiences.map(
      (e: any) => ({
        url: `${base}/experiences/${e._id}`,
        lastModified: e.updatedAt ?? now,
        changeFrequency: 'weekly',
        priority: 0.7,
      })
    );

    const diningEntries: MetadataRoute.Sitemap = dining.map((d: any) => ({
      url: `${base}/dining/${d._id}`,
      lastModified: d.updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    return [
      ...staticEntries,
      ...cabinEntries,
      ...experienceEntries,
      ...diningEntries,
    ];
  } catch (error) {
    console.error('sitemap: failed to fetch dynamic entries', error);
    return staticEntries;
  }
}
```

Notes:

- `.lean()` is fine here because we only read `_id` and `updatedAt`, not virtuals.
- The `try/catch` degrades to static-only if the DB is unreachable at build time. A hard failure would prevent the whole build; the audit values the sitemap as best-effort rather than load-bearing.
- `Promise.all` keeps the three reads parallel so sitemap regeneration stays fast.

- [ ] **Step 2: Verify the route responds with XML**

With dev server running:

```bash
curl -s http://localhost:3002/sitemap.xml | head -30
```

Expected: `<?xml version="1.0" ...>` followed by `<urlset>` and one `<url>` per static + dynamic entry, including `http://localhost:3002/cabins/<some-id>` lines.

- [ ] **Step 3: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add app/sitemap.ts
git commit -m "feat(seo): add sitemap.ts covering cabins, experiences, and dining URLs"
```

---

## Phase 4: Cabin Server-Side Data Plumbing

### Task 7: Create server-side cabin fetchers

**Files:**

- Create: `lib/data/cabins.ts`

- [ ] **Step 1: Write the fetcher module**

Create `/home/yzel/github/LodgeFlow/lib/data/cabins.ts`:

```ts
import { cache } from 'react';

import { Cabin, connectDB } from '@/models';
import type { Cabin as CabinType } from '@/types';

/**
 * Fetch a single active cabin by id. Wrapped in React cache() so the page
 * component and generateMetadata share one DB round-trip per request.
 *
 * Returns a fully-serialized plain object (ObjectId -> string, virtuals
 * included) so it can cross the RSC -> Client Component boundary as a prop.
 */
export const getCabinById = cache(
  async (id: string): Promise<CabinType | null> => {
    if (!id || typeof id !== 'string') return null;
    try {
      await connectDB();
      const doc = await Cabin.findById(id);
      if (!doc) return null;
      // JSON.parse(JSON.stringify(...)) preserves virtuals (toJSON: { virtuals: true })
      // and converts ObjectId to string. .lean() would skip virtuals.
      return JSON.parse(JSON.stringify(doc));
    } catch (error) {
      console.error(`getCabinById(${id}): failed`, error);
      return null;
    }
  }
);

/**
 * Fetch all active cabins for the listing page. Sorted by price ascending
 * to match the client-side default. Wrapped in cache() for request-scoped
 * deduplication.
 */
export const getAllActiveCabinsForListing = cache(
  async (): Promise<CabinType[]> => {
    try {
      await connectDB();
      const docs = await Cabin.find({ status: 'active' }).sort({ price: 1 });
      return JSON.parse(JSON.stringify(docs));
    } catch (error) {
      console.error('getAllActiveCabinsForListing: failed', error);
      return [];
    }
  }
);
```

- [ ] **Step 2: Type-check**

Run:

```bash
cd /home/yzel/github/LodgeFlow
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add lib/data/cabins.ts
git commit -m "feat(seo): add cached server-side cabin fetchers for SSR + metadata"
```

---

### Task 8: Create JSON-LD helpers

**Files:**

- Create: `lib/seo/jsonLd.ts`

- [ ] **Step 1: Write the helper module**

Create `/home/yzel/github/LodgeFlow/lib/seo/jsonLd.ts`:

```ts
import { siteConfig } from '@/config/site';
import type { Cabin } from '@/types';

const base = () => siteConfig.url.replace(/\/$/, '');

export function siteToLodgingBusiness(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: siteConfig.name,
    description: siteConfig.description,
    url: base(),
    telephone: '+1-800-LODGEFLOW',
    email: 'hello@lodgeflow.com',
    image: `${base()}/logo.svg`,
    sameAs: [siteConfig.links.instagram, siteConfig.links.facebook].filter(
      u => u && !u.endsWith('#')
    ),
  };
}

export function cabinToLodgingBusiness(cabin: Cabin): Record<string, unknown> {
  const cabinId = (cabin as any)._id?.toString?.() ?? (cabin as any)._id;
  const url = `${base()}/cabins/${cabinId}`;
  const effectivePrice = cabin.price - (cabin.discount ?? 0);

  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': url,
    name: cabin.name,
    description: cabin.description,
    image: [cabin.image, ...(cabin.images ?? [])].filter(Boolean),
    url,
    priceRange: `$${effectivePrice} per night`,
    maximumAttendeeCapacity: cabin.capacity,
    numberOfRooms: cabin.bedrooms,
    amenityFeature: (cabin.amenities ?? []).map(name => ({
      '@type': 'LocationFeatureSpecification',
      name,
      value: true,
    })),
    offers: {
      '@type': 'Offer',
      price: effectivePrice,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url,
    },
  };
}

export function buildBreadcrumbList(
  items: Array<{ name: string; url?: string }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: `${base()}${item.url}` } : {}),
    })),
  };
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
cd /home/yzel/github/LodgeFlow
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add lib/seo/jsonLd.ts
git commit -m "feat(seo): add JSON-LD helpers for LodgingBusiness and BreadcrumbList"
```

---

### Task 9: Extract `CabinDetailClient` component

**Files:**

- Create: `components/CabinDetailClient.tsx`

This task creates the client component in isolation (not yet wired into the page). Task 10 will wire it in.

- [ ] **Step 1: Create the component file**

Create `/home/yzel/github/LodgeFlow/components/CabinDetailClient.tsx`:

```tsx
'use client';

import { Button } from '@heroui/button';
import { Tooltip } from '@heroui/tooltip';
import { useUser } from '@clerk/nextjs';
import { ArrowLeft, Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';

import BookingForm from '@/components/BookingForm';
import Breadcrumb from '@/components/Breadcrumb';
import CabinAvailabilityPreview from '@/components/CabinAvailabilityPreview';
import CabinBookingSteps from '@/components/CabinBookingSteps';
import CabinDetails from '@/components/CabinDetails';
import CabinGallery from '@/components/CabinGallery';
import CabinMobileTabs from '@/components/CabinMobileTabs';
import CabinPricingCalculator from '@/components/CabinPricingCalculator';
import CabinShareButton from '@/components/CabinShareButton';
import CabinSimilar from '@/components/CabinSimilar';
import CabinTestimonials from '@/components/CabinTestimonials';
import CabinTrustIndicators from '@/components/CabinTrustIndicators';
import { useSettings } from '@/hooks/useSettings';
import type { Cabin } from '@/types';

interface CabinDetailClientProps {
  cabin: Cabin;
}

export default function CabinDetailClient({ cabin }: CabinDetailClientProps) {
  const { data: settings, isError: settingsError } = useSettings();
  const { user } = useUser();
  const router = useRouter();

  const cabinId = (cabin as any)._id?.toString?.() ?? (cabin as any)._id;

  const userData = user
    ? {
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.emailAddresses[0]?.emailAddress || '',
        phone: user.phoneNumbers[0]?.phoneNumber || '',
      }
    : undefined;

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Cabins', href: '/cabins' },
    { label: cabin.name },
  ];

  const bookingCabin = {
    _id: cabinId,
    discount: cabin.discount,
    image: cabin.image,
    maxCapacity: cabin.capacity,
    name: cabin.name,
    regularPrice: cabin.price,
  };

  return (
    <div className='container mx-auto px-4 py-8 max-w-7xl'>
      {/* Breadcrumb Navigation */}
      <div className='mb-6'>
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Back Button */}
      <div className='mb-8'>
        <Button
          className='gap-2'
          startContent={<ArrowLeft size={18} />}
          variant='light'
          onPress={() => router.push('/cabins')}
        >
          Back to Cabins
        </Button>
      </div>

      {/* Main Content */}
      <div className='space-y-8'>
        <CabinGallery
          images={[cabin.image, ...(cabin.images || [])].filter(Boolean)}
        />

        <div className='flex gap-2'>
          <CabinShareButton cabinName={cabin.name} />
          <Tooltip content='Coming soon'>
            <Button
              aria-label='Add to wishlist (coming soon)'
              isDisabled
              variant='light'
            >
              <Heart size={18} />
            </Button>
          </Tooltip>
        </div>

        {/* Mobile Layout: tabbed interface (< lg) */}
        <div className='lg:hidden' id='booking'>
          <CabinMobileTabs
            cabin={cabin}
            userData={userData}
            bookingCabin={bookingCabin}
          />
        </div>

        {/* Desktop Layout: vertical stack (lg+) */}
        <div className='hidden lg:block space-y-8'>
          {settings?.cancellationPolicy ? (
            <CabinTrustIndicators
              cancellationPolicy={
                settings.cancellationPolicy as
                  'flexible' | 'moderate' | 'strict'
              }
            />
          ) : settingsError ? (
            <p className='text-sm text-foreground-400'>
              Trust information temporarily unavailable.
            </p>
          ) : null}

          <CabinDetails cabin={cabin} />

          <CabinTestimonials />

          <CabinAvailabilityPreview cabinId={cabinId} />

          <CabinBookingSteps />

          <div className='lg:max-w-3xl lg:mx-auto' id='booking'>
            <BookingForm userData={userData} cabin={bookingCabin} />
          </div>
        </div>
      </div>

      {/* Price Calculator - mobile only */}
      <div className='mt-8 lg:hidden'>
        <CabinPricingCalculator discount={cabin.discount} price={cabin.price} />
      </div>

      {/* Similar Cabins */}
      <div className='mt-8'>
        <CabinSimilar capacity={cabin.capacity} currentCabinId={cabinId} />
      </div>
    </div>
  );
}
```

Notes:

- All existing child components are unchanged — this is a pure extraction.
- `useUser` and `useSettings` still run on the client. The cabin object is now a prop instead of coming from `useCabin`.
- The loading skeleton and the error states disappear from this file — they were only needed because data was fetched client-side. Now the server guarantees cabin is present (or the page renders `notFound()`).

- [ ] **Step 2: Type-check**

Run:

```bash
cd /home/yzel/github/LodgeFlow
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit (component created, not yet wired)**

```bash
cd /home/yzel/github/LodgeFlow
git add components/CabinDetailClient.tsx
git commit -m "refactor(cabins): extract CabinDetailClient from cabin detail page"
```

---

### Task 10: Rewrite `app/cabins/[id]/page.tsx` as a server component

**Files:**

- Modify: `app/cabins/[id]/page.tsx`
- Modify: `__tests__/cabins/CabinPageLayout.test.tsx`

- [ ] **Step 1: Replace the page file**

Fully replace the contents of `/home/yzel/github/LodgeFlow/app/cabins/[id]/page.tsx` with:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import CabinDetailClient from '@/components/CabinDetailClient';
import { siteConfig } from '@/config/site';
import { getCabinById } from '@/lib/data/cabins';
import { buildBreadcrumbList, cabinToLodgingBusiness } from '@/lib/seo/jsonLd';

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const cabin = await getCabinById(id);

  if (!cabin) {
    return {
      title: 'Cabin not found',
      description: 'This cabin is unavailable or has been removed.',
      robots: { index: false, follow: false },
    };
  }

  const url = `/cabins/${id}`;
  const effectivePrice = cabin.price - (cabin.discount ?? 0);
  const title = `${cabin.name} — $${effectivePrice}/night`;
  const description = cabin.description.slice(0, 160);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title,
      description,
      siteName: siteConfig.name,
      images: cabin.image ? [{ url: cabin.image, alt: cabin.name }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: cabin.image ? [cabin.image] : undefined,
    },
  };
}

export default async function CabinDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const cabin = await getCabinById(id);

  if (!cabin) notFound();

  const jsonLd = [
    cabinToLodgingBusiness(cabin),
    buildBreadcrumbList([
      { name: 'Home', url: '/' },
      { name: 'Cabins', url: '/cabins' },
      { name: cabin.name },
    ]),
  ];

  return (
    <>
      <script type='application/ld+json'>{JSON.stringify(jsonLd)}</script>
      <CabinDetailClient cabin={cabin} />
    </>
  );
}
```

Notes:

- `getCabinById` is called twice (once in `generateMetadata`, once in the page body), but React `cache()` deduplicates so only one DB round-trip happens per request.
- `notFound()` triggers Next.js's 404 boundary (render `not-found.tsx` or the default). The old `<div className='text-lg'>Cabin not found</div>` block goes away.
- The old loading skeleton goes away entirely — SSR means no client-side fetch flash.
- JSON-LD is emitted as an array of two objects in one script tag. Google accepts this form. Using `<script>{...}</script>` rather than `dangerouslySetInnerHTML` keeps the React-style form; the content is `JSON.stringify(...)` of server-built objects with no user input, so there's no injection surface either way.

- [ ] **Step 2: Update `__tests__/cabins/CabinPageLayout.test.tsx`**

The existing test imports `CabinPage` from `@/app/cabins/[id]/page` and mocks `useCabin`. That no longer matches the code: the page is now async server code, and `useCabin` is not used. Retarget the test to `CabinDetailClient`:

Replace the top of `/home/yzel/github/LodgeFlow/__tests__/cabins/CabinPageLayout.test.tsx`. Change the import line:

```tsx
import CabinPage from '@/app/cabins/[id]/page';
```

to:

```tsx
import CabinDetailClient from '@/components/CabinDetailClient';
```

Remove the `jest.mock('@/hooks/useCabin');` line and the associated `useCabin` mock setup. Replace every `render(<CabinPage params={...} />)` with `render(<CabinDetailClient cabin={mockCabin} />)`, where `mockCabin` is a plain object matching `Cabin` shape (reuse any fixture already present in the test; if none, define a minimal one inline with fields: `_id`, `name`, `description`, `image`, `images`, `capacity`, `price`, `discount`, `amenities`).

Also remove the assertions that depend on the loading skeleton (`page-loading-skeleton` test-id) and the "cabin not found" branch — those states are no longer owned by this component. If the test file contains tests for those states, delete those individual test cases; the server component's 404/not-found behavior is outside this test's concern.

- [ ] **Step 3: Run the updated test**

```bash
cd /home/yzel/github/LodgeFlow
pnpm test -- --testPathPattern="CabinPageLayout"
```

Expected: all tests pass. If failures surface because of other mocks that still reference `useCabin`-specific behavior, adjust them — do not bypass by skipping.

- [ ] **Step 4: Verify the page renders server-side HTML**

Restart `pnpm dev`. Grab a cabin id:

```bash
curl -s http://localhost:3002/api/cabins | head -60
```

Then:

```bash
CABIN_ID=<paste-id-here>
curl -s "http://localhost:3002/cabins/$CABIN_ID" | grep -oE '<title>[^<]+</title>'
curl -s "http://localhost:3002/cabins/$CABIN_ID" | grep -c '"@type":"LodgingBusiness"'
curl -s "http://localhost:3002/cabins/$CABIN_ID" | grep -c '"@type":"BreadcrumbList"'
```

Expected:

- Title contains the cabin name and `$XX/night`.
- Two matches total for `@type` (one LodgingBusiness, one BreadcrumbList).

- [ ] **Step 5: Verify the full page still renders interactively in a browser**

Open `http://localhost:3002/cabins/$CABIN_ID` in a real browser. Confirm:

- Gallery loads, breadcrumb present, back button works, booking form renders.
- Mobile tabs appear at narrow widths.
- View source shows cabin name, description, price inside the HTML (not just a skeleton).

- [ ] **Step 6: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add app/cabins/[id]/page.tsx __tests__/cabins/CabinPageLayout.test.tsx
git commit -m "feat(seo): server-render /cabins/[id] with generateMetadata and JSON-LD"
```

---

## Phase 5: Cabins List Server Conversion

### Task 11: Extract `CabinsListClient` component

**Files:**

- Create: `components/CabinsListClient.tsx`

- [ ] **Step 1: Create the client component**

Create `/home/yzel/github/LodgeFlow/components/CabinsListClient.tsx`:

```tsx
'use client';

import { Button } from '@heroui/button';
import { Select, SelectItem } from '@heroui/select';
import { useEffect, useState } from 'react';

import CabinCard from '@/components/CabinCard';
import StandardFilters from '@/components/StandardFilters';
import { PageHeader } from '@/components/ui';
import type { Cabin, CabinsQueryParams } from '@/types';

interface CabinsFilters extends CabinsQueryParams {}

interface CabinsListClientProps {
  initialCabins: Cabin[];
}

export default function CabinsListClient({
  initialCabins,
}: CabinsListClientProps) {
  const [filters, setFilters] = useState<CabinsFilters>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sortOptions = [
    { key: 'name', label: 'Name', value: 'name' },
    { key: 'price', label: 'Price', value: 'price' },
    { key: 'capacity', label: 'Capacity', value: 'capacity' },
  ];

  // Apply filters client-side against initialCabins (already fetched on server).
  const filtered = initialCabins.filter(c => {
    if (filters.capacity && c.capacity < filters.capacity) return false;
    if (filters.minPrice && c.price < filters.minPrice) return false;
    if (filters.maxPrice && c.price > filters.maxPrice) return false;
    if (searchTerm) {
      const needle = searchTerm.toLowerCase();
      const hay =
        `${c.name} ${c.description} ${(c.amenities ?? []).join(' ')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });

  const sortedCabins = [...filtered].sort((a, b) => {
    let aValue: any = a[sortBy as keyof Cabin];
    let bValue: any = b[sortBy as keyof Cabin];
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    if (sortOrder === 'asc') return aValue > bValue ? 1 : -1;
    return aValue < bValue ? 1 : -1;
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setFilters({
      capacity: urlParams.get('capacity')
        ? parseInt(urlParams.get('capacity')!)
        : undefined,
      minPrice: urlParams.get('minPrice')
        ? parseInt(urlParams.get('minPrice')!)
        : undefined,
      maxPrice: urlParams.get('maxPrice')
        ? parseInt(urlParams.get('maxPrice')!)
        : undefined,
    });
  }, []);

  const additionalFilters = (
    <div className='flex flex-wrap gap-2'>
      <Select
        className='w-40'
        placeholder='Capacity'
        selectedKeys={filters.capacity ? [filters.capacity.toString()] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          const capacity = selected ? parseInt(selected) : undefined;
          setFilters(prev => ({ ...prev, capacity }));
        }}
      >
        <SelectItem key='1'>1+ guests</SelectItem>
        <SelectItem key='2'>2+ guests</SelectItem>
        <SelectItem key='4'>4+ guests</SelectItem>
        <SelectItem key='6'>6+ guests</SelectItem>
        <SelectItem key='8'>8+ guests</SelectItem>
      </Select>

      <Select
        className='w-40'
        placeholder='Min Price'
        selectedKeys={filters.minPrice ? [filters.minPrice.toString()] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          const minPrice = selected ? parseInt(selected) : undefined;
          setFilters(prev => ({ ...prev, minPrice }));
        }}
      >
        <SelectItem key='50'>$50+</SelectItem>
        <SelectItem key='100'>$100+</SelectItem>
        <SelectItem key='150'>$150+</SelectItem>
        <SelectItem key='200'>$200+</SelectItem>
      </Select>

      <Select
        className='w-40'
        placeholder='Max Price'
        selectedKeys={filters.maxPrice ? [filters.maxPrice.toString()] : []}
        size='sm'
        onSelectionChange={keys => {
          const selected = Array.from(keys)[0] as string;
          const maxPrice = selected ? parseInt(selected) : undefined;
          setFilters(prev => ({ ...prev, maxPrice }));
        }}
      >
        <SelectItem key='100'>Up to $100</SelectItem>
        <SelectItem key='150'>Up to $150</SelectItem>
        <SelectItem key='200'>Up to $200</SelectItem>
        <SelectItem key='300'>Up to $300</SelectItem>
      </Select>

      <Button
        size='sm'
        variant='bordered'
        onPress={() => {
          setFilters({});
          setSearchTerm('');
        }}
      >
        Clear Filters
      </Button>
    </div>
  );

  return (
    <div className='max-w-7xl mx-auto py-8'>
      <div className='text-center mb-8'>
        <PageHeader
          subtitle='Discover our collection of beautiful cabins, each offering unique experiences in the heart of nature. From cozy retreats to spacious family accommodations.'
          title='Our'
          titleAccent='Cabins'
        />
      </div>

      <StandardFilters
        additionalFilters={additionalFilters}
        currentSort={sortBy}
        itemName='cabin'
        searchPlaceholder='Search cabins by name, amenities, or description...'
        searchValue={searchTerm}
        sortOptions={sortOptions}
        sortOrder={sortOrder}
        totalCount={sortedCabins.length}
        onSearchChange={setSearchTerm}
        onSortChange={setSortBy}
        onSortOrderChange={setSortOrder}
      />

      {sortedCabins.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {sortedCabins.map(cabin => (
            <CabinCard key={(cabin as any)._id.toString()} cabin={cabin} />
          ))}
        </div>
      ) : (
        <div className='text-center py-12'>
          <h3 className='text-xl font-semibold mb-2'>No cabins found</h3>
          <p className='text-default-500 mb-4'>
            Try adjusting your search or filters to see more options.
          </p>
        </div>
      )}
    </div>
  );
}
```

Behavioral change worth flagging: the original page fetched via API with filter params (server-filtered); this version filters locally on the pre-fetched list. For a small catalog this is fine and eliminates a round-trip per filter change. If the catalog later grows past ~200 cabins, re-introduce server filtering (route through the existing `/api/cabins` handler).

- [ ] **Step 2: Type-check**

Run:

```bash
cd /home/yzel/github/LodgeFlow
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add components/CabinsListClient.tsx
git commit -m "refactor(cabins): extract CabinsListClient from cabins list page"
```

---

### Task 12: Rewrite `app/cabins/page.tsx` as a server component

**Files:**

- Modify: `app/cabins/page.tsx`

- [ ] **Step 1: Replace the page file**

Fully replace the contents of `/home/yzel/github/LodgeFlow/app/cabins/page.tsx` with:

```tsx
import type { Metadata } from 'next';

import CabinsListClient from '@/components/CabinsListClient';
import { siteConfig } from '@/config/site';
import { getAllActiveCabinsForListing } from '@/lib/data/cabins';
import { buildBreadcrumbList } from '@/lib/seo/jsonLd';

export const metadata: Metadata = {
  title: 'All Cabins',
  description:
    'Browse all LodgeFlow cabins. Filter by capacity and price to find the perfect wilderness retreat for your group.',
  alternates: { canonical: '/cabins' },
  openGraph: {
    type: 'website',
    url: '/cabins',
    title: `All Cabins — ${siteConfig.name}`,
    description:
      'Browse all LodgeFlow cabins. Filter by capacity and price to find the perfect wilderness retreat for your group.',
    siteName: siteConfig.name,
  },
};

export default async function CabinsPage() {
  const cabins = await getAllActiveCabinsForListing();

  const jsonLd = buildBreadcrumbList([
    { name: 'Home', url: '/' },
    { name: 'Cabins' },
  ]);

  return (
    <>
      <script type='application/ld+json'>{JSON.stringify(jsonLd)}</script>
      <CabinsListClient initialCabins={cabins} />
    </>
  );
}
```

- [ ] **Step 2: Verify the page renders server-side**

Restart dev server, then:

```bash
curl -s http://localhost:3002/cabins | grep -oE '<title>[^<]+</title>'
curl -s http://localhost:3002/cabins | grep -c '<h4'
```

Expected:

- Title contains "All Cabins".
- Match count for `<h4` is `>= 1` (each CabinCard renders a heading; the exact tag depends on the CabinCard implementation — if zero, inspect CabinCard and swap the grep for an existing heading selector).

- [ ] **Step 3: Verify a cabin name is in the HTML**

Pick any cabin name you know is in the DB (e.g. from the API dump earlier):

```bash
curl -s http://localhost:3002/cabins | grep -c "<KNOWN_CABIN_NAME>"
```

Expected: `>= 1`.

- [ ] **Step 4: Browser smoke test**

Open `http://localhost:3002/cabins` in a browser. Confirm filters, sort, search, and clear still work against the pre-fetched list. Verify URL filter params still initialize state.

- [ ] **Step 5: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add app/cabins/page.tsx
git commit -m "feat(seo): server-render /cabins with static metadata and breadcrumb JSON-LD"
```

---

## Phase 6: Home Page JSON-LD

### Task 13: Add LodgingBusiness JSON-LD to the home page

**Files:**

- Modify: `app/page.tsx`

- [ ] **Step 1: Import the helper**

In `/home/yzel/github/LodgeFlow/app/page.tsx`, update the imports at the top. Add after the existing imports:

```tsx
import { siteToLodgingBusiness } from '@/lib/seo/jsonLd';
```

- [ ] **Step 2: Emit the JSON-LD at the top of the rendered tree**

In the same file, locate the `return (` statement in the `Home` component (line 55 in the current file). Immediately after `<div className='space-y-16 py-8'>`, insert:

```tsx
<script type='application/ld+json'>
  {JSON.stringify(siteToLodgingBusiness())}
</script>
```

So the return now begins:

```tsx
  return (
    <div className='space-y-16 py-8'>
      <script type='application/ld+json'>
        {JSON.stringify(siteToLodgingBusiness())}
      </script>
      {/* Hero Section */}
      <HeroSection
        ...
```

- [ ] **Step 3: Verify**

```bash
curl -s http://localhost:3002/ | grep -c '"@type":"LodgingBusiness"'
```

Expected: `1`.

- [ ] **Step 4: Commit**

```bash
cd /home/yzel/github/LodgeFlow
git add app/page.tsx
git commit -m "feat(seo): emit LodgingBusiness JSON-LD on home page"
```

---

## Phase 7: End-to-End Verification

### Task 14: Run the full SEO smoke suite

- [ ] **Step 1: Ensure a clean build**

Stop any running dev server. Then:

```bash
cd /home/yzel/github/LodgeFlow
pnpm build
```

Expected: build completes without errors. Build log should show `/cabins` and `/cabins/[id]` as server-rendered routes, `sitemap.xml` and `robots.txt` listed as generated routes.

- [ ] **Step 2: Start production server**

```bash
cd /home/yzel/github/LodgeFlow
pnpm start
```

(This runs on port 3000 by default for `next start`, not 3002 — use whatever port is reported.)

- [ ] **Step 3: Run the smoke checks**

Let `PORT` be the port reported by `next start`. Run:

```bash
PORT=3000
# robots.txt
curl -s http://localhost:$PORT/robots.txt
# sitemap.xml includes dynamic cabin URLs
curl -s http://localhost:$PORT/sitemap.xml | grep -c '<loc>.*cabins/.*</loc>'
# home page has JSON-LD
curl -s http://localhost:$PORT/ | grep -c '"@type":"LodgingBusiness"'
# cabins list has title and at least one cabin-card heading in the HTML
curl -s http://localhost:$PORT/cabins | grep -oE '<title>[^<]+</title>'
# cabin detail returns 200 unauthenticated and has JSON-LD
CABIN_ID=$(curl -s http://localhost:$PORT/api/cabins | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['_id'])")
curl -sI "http://localhost:$PORT/cabins/$CABIN_ID" | head -1
curl -s "http://localhost:$PORT/cabins/$CABIN_ID" | grep -c '"@type":"LodgingBusiness"'
curl -s "http://localhost:$PORT/cabins/$CABIN_ID" | grep -c '"@type":"BreadcrumbList"'
```

Expected:

- `robots.txt` returns rules + sitemap reference
- sitemap count: `>= 1` (depends on how many active cabins in DB)
- home page JSON-LD count: `1`
- cabins list title: `All Cabins - LodgeFlow` (or similar per template)
- cabin detail: `HTTP/1.1 200 OK`, LodgingBusiness count `1`, BreadcrumbList count `1`

- [ ] **Step 4: Validate structured data externally (manual, optional)**

With dev server exposed or after a preview deploy, paste the cabin detail URL into https://search.google.com/test/rich-results — confirm no errors on the LodgingBusiness and BreadcrumbList markup. (Not runnable from local unless exposed via tunnel; document the result in a PR comment if landing to main.)

- [ ] **Step 5: Run the full CI check**

```bash
cd /home/yzel/github/LodgeFlow
pnpm ci:check
```

Expected: format, lint, and test suite all pass. If any cabin-related test other than `CabinPageLayout` fails because it depended on the old page's loading skeleton or error branch, update it the same way Task 10 Step 2 updated `CabinPageLayout.test.tsx`: retarget to `CabinDetailClient` or delete the now-irrelevant case.

- [ ] **Step 6: Final commit if any test updates were needed**

```bash
cd /home/yzel/github/LodgeFlow
git add __tests__/
git commit -m "test: update cabin tests for server component refactor"
```

(Skip if no additional changes were needed.)

---

## Follow-On: Dining & Experiences

Dining and experiences follow the same three-step pattern established for cabins:

1. **Data:** add `getDiningById`, `getAllDining`, `getExperienceById`, `getAllExperiences` to `lib/data/` (new `dining.ts`, `experiences.ts`), each wrapped in `cache()` and using `JSON.parse(JSON.stringify(doc))` serialization (check each model file for virtuals — if none, `.lean()` is acceptable).
2. **SEO helpers:** extend `lib/seo/jsonLd.ts` with `experienceToTouristAttraction` (schema.org `TouristAttraction` or `Event`) and `diningToRestaurant` (schema.org `Restaurant` or `Menu`).
3. **Pages:** convert `app/dining/page.tsx`, `app/dining/[id]/page.tsx`, `app/experiences/page.tsx`, `app/experiences/[id]/page.tsx` — each gets a thin server component (fetch + `generateMetadata` + JSON-LD) and a co-located `*Client.tsx` that owns the interactive logic.

The sitemap in this plan already lists all dining and experience URLs, so they will be discovered by crawlers as soon as the server-rendering work lands.

A separate plan should be written for that work because (a) it triples the code volume of this plan, and (b) experiences and dining have their own auth/booking flows worth reviewing independently before a blanket refactor.
