export type StaffRole = 'front_desk' | 'manager' | 'admin';
export const PERMISSIONS = [
  'bookings:read',
  'bookings:manage',
  'cabins:write',
  'settings:write',
  'refunds:issue',
  'audit:read',
  'staff:manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
const matrix: Record<StaffRole, readonly Permission[]> = {
  front_desk: ['bookings:read', 'bookings:manage'],
  manager: [
    'bookings:read',
    'bookings:manage',
    'cabins:write',
    'settings:write',
    'refunds:issue',
    'audit:read',
  ],
  admin: PERMISSIONS,
};
export function isStaffRole(role: unknown): role is StaffRole {
  return role === 'front_desk' || role === 'manager' || role === 'admin';
}
export function hasPermission(role: unknown, permission?: Permission): boolean {
  if (!isStaffRole(role)) return false;
  // Unmigrated operations remain restricted to administrators.
  return permission ? matrix[role].includes(permission) : role === 'admin';
}
export function permissionsFor(role: StaffRole): readonly Permission[] {
  return matrix[role];
}
export function pagePermission(path: string): Permission {
  if (path === '/audit' || path.startsWith('/audit/')) return 'audit:read';
  if (path === '/staff' || path.startsWith('/staff/')) return 'staff:manage';
  if (path === '/settings' || path.startsWith('/settings/'))
    return 'settings:write';
  if (/^\/(cabins|dining|experiences)\/(new|[^/]+\/edit)(\/|$)/.test(path))
    return 'cabins:write';
  return 'bookings:read';
}
