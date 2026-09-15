import type { CancellationDeadlines as DomainDeadlines } from '@/lib/cancellation';
import type { CancellationDeadlines } from '@/types/cancellation';

export function serializeCancellationDeadlines(
  deadlines: DomainDeadlines
): CancellationDeadlines {
  return {
    fullRefundDeadline: deadlines.fullRefundDeadline?.toISOString() ?? null,
    partialRefundDeadline:
      deadlines.partialRefundDeadline?.toISOString() ?? null,
    partialRefundPercentage: deadlines.partialRefundPercentage,
    policy: deadlines.policy,
  };
}
