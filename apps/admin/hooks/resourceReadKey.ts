// Match only a resource endpoint, its query variants, and child routes.
// SWR's provider-scoped mutate then revalidates mounted reads in that family.
export const resourceReadKey = (resource: string) => (key: unknown) =>
  typeof key === 'string' &&
  (key === resource ||
    key.startsWith(`${resource}?`) ||
    key.startsWith(`${resource}/`));
