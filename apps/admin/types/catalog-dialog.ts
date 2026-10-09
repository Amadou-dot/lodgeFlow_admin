export type CatalogDialog<T> =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'view' | 'edit' | 'delete'; item: T };
