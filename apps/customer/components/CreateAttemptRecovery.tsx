import Link from 'next/link';
import type { CreateRecovery } from '@/hooks/useCreateAttempt';

export function CreateAttemptRecovery({
  recovery,
}: {
  recovery: CreateRecovery | null;
}) {
  if (!recovery) return null;
  if (recovery.kind === 'confirmation')
    return (
      <Link
        className='text-primary underline'
        href={recovery.href}
        prefetch={false}
      >
        View confirmation
      </Link>
    );
  return (
    <div role='status'>
      <p>{recovery.notice}</p>
      {/* A document navigation starts fresh, unfiltered queries with the current Clerk session. */}
      <a className='text-primary underline' href='/bookings'>
        Load current bookings
      </a>
    </div>
  );
}
