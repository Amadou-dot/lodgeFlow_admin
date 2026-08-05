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
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <CabinsListClient initialCabins={cabins} />
    </>
  );
}
