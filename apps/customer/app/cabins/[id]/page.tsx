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
  const effectivePrice = Math.max(0, cabin.price - (cabin.discount ?? 0));
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
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <CabinDetailClient cabin={cabin} />
    </>
  );
}
