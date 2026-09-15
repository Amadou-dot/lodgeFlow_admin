import { createSuccessResponse, requireApiAuth } from '@/lib/api-utils';
import { permissionsFor } from '@/lib/permissions';
export async function GET() {
  const access = await requireApiAuth({ permission: 'bookings:read' });
  if (!access.authenticated) return access.error;
  return createSuccessResponse({
    userId: access.userId,
    role: access.role,
    permissions: permissionsFor(access.role!),
  });
}
