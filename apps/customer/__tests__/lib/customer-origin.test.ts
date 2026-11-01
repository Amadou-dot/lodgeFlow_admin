/** @jest-environment node */

const originalOrigin = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalOrigin === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalOrigin;
});

function configuredSiteUrl(): string {
  let result = '';
  jest.isolateModules(() => {
    const {
      siteConfig,
    }: typeof import('@/config/site') = require('@/config/site');
    result = siteConfig.url;
  });
  return result;
}

test('metadata defaults to the customer production origin without app configuration', () => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  expect(configuredSiteUrl()).toBe('https://lodgeflow.app');
});

test.each([
  ['lodgeflow.app/', 'https://lodgeflow.app'],
  ['localhost:3002', 'http://localhost:3002'],
  ['preview.example.com', 'https://preview.example.com'],
])(
  'metadata preserves deliberate origin override %s',
  (configured, expected) => {
    process.env.NEXT_PUBLIC_APP_URL = configured;
    expect(configuredSiteUrl()).toBe(expected);
  }
);

test.each([
  '',
  'https://example.com/path',
  'https://admin.lodgeflow.app',
  'https://ADMIN.LODGEFLOW.APP:443',
  'https://%61dmin.lodgeflow.app:443',
  'https://admin.lodgeflow.app.',
])('metadata rejects an unusable customer origin: %s', configured => {
  process.env.NEXT_PUBLIC_APP_URL = configured;
  expect(configuredSiteUrl).toThrow();
});
