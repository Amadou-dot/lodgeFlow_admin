import AuditLog, {
  type AuditAction,
  type IAuditLog,
} from '@lodgeflow/database/models/AuditLog';
import type { ApiAuthResult } from './api-utils';
import { logger } from './logger';
import { isStaffRole } from './permissions';
import { staffOrganizationId } from './staff-access';

export const BOOKING_AUDIT_FIELDS = [
  'status',
  'cabin',
  'checkInDate',
  'checkOutDate',
  'numGuests',
  'totalPrice',
  'amountPaid',
  'remainingAmount',
  'depositAmount',
  'refundAmount',
  'refundStatus',
  'hasBreakfast',
  'hasPets',
  'hasParking',
  'hasEarlyCheckIn',
  'hasLateCheckOut',
] as const;
export const CABIN_AUDIT_FIELDS = [
  'name',
  'capacity',
  'price',
  'discount',
  'status',
  'minNights',
  'amenities',
  'extraGuestFee',
  'bedrooms',
  'bathrooms',
  'size',
  'description',
  'image',
  'images',
] as const;
export const SETTINGS_AUDIT_FIELDS = [
  'minBookingLength',
  'maxBookingLength',
  'maxGuestsPerBooking',
  'breakfastPrice',
  'currency',
  'depositPercentage',
  'petFee',
  'parkingFee',
  'earlyCheckInFee',
  'lateCheckOutFee',
  'cancellationPolicy',
  'requireDeposit',
  'allowPets',
  'smokingAllowed',
  'wifiIncluded',
  'parkingIncluded',
  'checkInTime',
  'checkOutTime',
  'timezone',
  'businessHours',
  'notifications',
  'contactInfo',
] as const;

export function auditSnapshot(
  document: unknown,
  fields: readonly string[]
): Record<string, unknown> {
  if (!document || typeof document !== 'object') return {};
  const data = document as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    let value = data[field];
    if (field === 'cabin' && value && typeof value === 'object')
      value = (value as Record<string, unknown>)._id ?? value;
    // JSON conversion detaches snapshots from mutable documents and normalizes dates/ObjectIds.
    result[field] =
      value === undefined ? null : JSON.parse(JSON.stringify(value));
  }
  return result;
}
export function auditDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const previous: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  for (const key of Array.from(
    new Set([...Object.keys(before), ...Object.keys(after)])
  )) {
    if (
      JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)
    ) {
      const redact = ['description', 'image', 'images', 'contactInfo'].includes(
        key
      );
      previous[key] = redact ? '[redacted]' : (before[key] ?? null);
      next[key] = redact ? '[redacted]' : (after[key] ?? null);
    }
  }
  return { before: previous, after: next };
}
export async function recordAudit(
  access: ApiAuthResult,
  event: {
    action: AuditAction;
    resourceType: IAuditLog['resourceType'];
    resourceId: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  }
) {
  try {
    const organizationId = staffOrganizationId();
    if (
      !access.authenticated ||
      !access.userId ||
      !isStaffRole(access.role) ||
      !organizationId
    )
      return;
    const changes = auditDiff(event.before, event.after);
    if (!Object.keys(changes.after).length) return;
    await AuditLog.create({
      ...event,
      ...changes,
      organizationId,
      actor: access.userId,
      actorRole: access.role,
    });
  } catch {
    // Portfolio availability policy: report audit failure without undoing a successful operation.
    logger.error('Audit write failed', undefined, {
      action: event.action,
      resourceId: event.resourceId,
    });
  }
}
export async function recordBookingAudit(
  access: ApiAuthResult,
  id: string,
  before: Record<string, unknown>,
  document: unknown
) {
  const after = auditSnapshot(document, BOOKING_AUDIT_FIELDS);
  const diff = auditDiff(before, after);
  const keys = Object.keys(diff.after);
  if (!keys.length) return;
  const actions: AuditAction[] = [];
  if (keys.includes('status'))
    actions.push(
      after.status === 'cancelled' ? 'booking.cancel' : 'booking.status_change'
    );
  if (keys.includes('totalPrice')) actions.push('booking.reprice');
  if (keys.includes('amountPaid')) actions.push('payment.record');
  if (keys.includes('refundAmount') || keys.includes('refundStatus'))
    actions.push('refund.record');
  if (!actions.length) actions.push('booking.update');
  for (const action of actions) {
    await recordAudit(access, {
      action,
      resourceType: 'booking',
      resourceId: id,
      before,
      after,
    });
  }
}
