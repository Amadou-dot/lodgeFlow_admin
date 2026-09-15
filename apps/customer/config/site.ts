import { normalizeBaseUrl } from '@/lib/url';

export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: 'LodgeFlow',
  description:
    'Welcome to paradise. Escape to luxury in the heart of nature at LodgeFlow.',
  // SEO / social fields
  url: normalizeBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://lodgeflow.app'
  ),
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
    email: 'mailto:hello@lodgeflow.app',
    instagram: 'https://instagram.com/#',
    facebook: 'https://facebook.com/#',
  },
};
