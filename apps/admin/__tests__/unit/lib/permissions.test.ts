import { hasPermission, PERMISSIONS } from '@/lib/permissions';

describe('staff permission matrix', () => {
  test.each(PERMISSIONS)('admin may %s', permission => {
    expect(hasPermission('admin', permission)).toBe(true);
  });
  test.each(PERMISSIONS)('manager permission %s', permission => {
    expect(hasPermission('manager', permission)).toBe(
      permission !== 'staff:manage'
    );
  });
  test.each(PERMISSIONS)('front desk permission %s', permission => {
    expect(hasPermission('front_desk', permission)).toBe(
      ['bookings:read', 'bookings:manage'].includes(permission)
    );
  });
  test.each([
    null,
    undefined,
    'org:admin',
    'org:customer',
    'owner',
    '__proto__',
  ])('unknown role %s fails closed', role => {
    for (const permission of PERMISSIONS)
      expect(hasPermission(role, permission)).toBe(false);
  });
  it('unannotated operations are admin-only', () => {
    expect(hasPermission('admin')).toBe(true);
    expect(hasPermission('manager')).toBe(false);
    expect(hasPermission('front_desk')).toBe(false);
  });
});
