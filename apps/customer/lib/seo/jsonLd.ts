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
    email: 'hello@lodgeflow.app',
    image: `${base()}/logo.svg`,
    sameAs: [siteConfig.links.instagram, siteConfig.links.facebook].filter(
      u => u && !u.endsWith('#')
    ),
  };
}

export function cabinToLodgingBusiness(cabin: Cabin): Record<string, unknown> {
  const cabinId = (cabin as any)._id?.toString?.() ?? (cabin as any)._id;
  const url = `${base()}/cabins/${cabinId}`;
  const effectivePrice = Math.max(0, cabin.price - (cabin.discount ?? 0));

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
