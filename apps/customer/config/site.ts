export type SiteConfig = typeof siteConfig;

// NEXT_PUBLIC_APP_URL is stored in Vercel as a bare hostname ("lodgeflow.app"),
// but metadataBase runs `new URL()` on this and robots/sitemap concatenate
// paths onto it — both need a scheme. Normalize instead of relying on how the
// env var happens to be written.
function withScheme(url: string): string {
  return /^https?:\/\//.test(url) ? url : `https://${url}`;
}

export const siteConfig = {
  name: 'LodgeFlow',
  description:
    'Welcome to paradise. Escape to luxury in the heart of nature at LodgeFlow.',
  // SEO / social fields
  url: withScheme(process.env.NEXT_PUBLIC_APP_URL ?? 'https://lodgeflow.app'),
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
