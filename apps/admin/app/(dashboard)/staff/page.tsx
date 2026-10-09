'use client';
import {
  OperationsPage,
  OperationsSelect,
  OperationsError,
} from '@/components/OperationsPage';
import { useResourceLoad } from '@/hooks/useResourceLoad';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { useCallback, useState } from 'react';
import { useStaffAccess } from '@/components/AuthGuard';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/table';
import { Spinner } from '@heroui/spinner';
import type { StaffMemberJson as Member } from '@/types/staff-audit';
import type { ApiResponse } from '@/lib/api-utils';
export default function StaffPage() {
  const access = useStaffAccess();
  return <StaffContent key={access?.userId ?? ''} access={access} />;
}
function StaffContent({
  access,
}: {
  access: ReturnType<typeof useStaffAccess>;
}) {
  const [action, setAction] = useState<
    { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });
  const request = useCallback(
    async (signal: AbortSignal): Promise<Member[]> => {
      const response = await fetch('/api/staff', { cache: 'no-store', signal });
      const result: ApiResponse<Member[]> = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          !result.success ? result.error : 'Unable to load staff'
        );
      return result.data;
    },
    []
  );
  const { state, reload: load } = useResourceLoad({
    resourceKey: access?.userId ?? '',
    request,
  });
  const members = state.data ?? [];
  const loading = state.kind === 'loading';
  const busy = action.kind === 'saving';
  const error =
    action.kind === 'error'
      ? action.message
      : state.kind === 'error'
        ? state.message
        : '';
  async function change(member: Member, role: string) {
    if (!member.userId || busy) return;
    setAction({ kind: 'saving' });
    try {
      const response = await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: member.userId, role: role || null }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'Unable to update access');
      await load();
      setAction({ kind: 'idle' });
    } catch (e) {
      setAction({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Unable to update access',
      });
    }
  }
  return (
    <OperationsPage
      title='Staff access'
      description='Manage organization roles and permissions for your team.'
    >
      <Card>
        <CardBody className='gap-3 p-5'>
          <h2 className='font-semibold'>Organization access</h2>
          <p className='text-sm text-default-600'>
            Front desk staff manage bookings. Managers also manage catalogs,
            settings, and refunds. Administrators manage staff access.
          </p>
          <p className='text-sm text-default-500'>
            Add new organization members in Clerk, then assign their access
            here. Your own access cannot be changed from this page.
          </p>
        </CardBody>
      </Card>
      <OperationsError message={error} />
      {state.kind === 'error' && (
        <Button
          onPress={() => {
            setAction({ kind: 'idle' });
            void load().catch(() => {});
          }}
        >
          Retry
        </Button>
      )}
      <Table
        aria-label='Staff access'
        classNames={{
          wrapper: 'border border-divider',
          th: 'bg-default-100 text-default-600',
          td: 'py-3',
        }}
      >
        <TableHeader>
          <TableColumn>Member</TableColumn>
          <TableColumn>Access</TableColumn>
        </TableHeader>
        <TableBody
          isLoading={loading}
          loadingContent={<Spinner label='Loading staff…' />}
          emptyContent={
            error
              ? 'Staff could not be loaded.'
              : 'No organization members found.'
          }
        >
          {members.map((member, index) => (
            <TableRow
              key={member.userId ?? `missing-${index}`}
              className='border-t border-default-200'
            >
              <TableCell className='p-3'>
                {member.name || member.userId}
                {member.userId === access?.userId ? ' (you)' : ''}
              </TableCell>
              <TableCell className='p-3'>
                <OperationsSelect
                  label={`Access for ${member.name || member.userId}`}
                  value={member.role ?? ''}
                  isDisabled={
                    busy || !member.userId || member.userId === access?.userId
                  }
                  className='min-w-48 max-w-xs'
                  onChange={value => void change(member, value)}
                  options={[
                    { value: '', label: 'No staff access' },
                    { value: 'front_desk', label: 'Front desk' },
                    { value: 'manager', label: 'Manager' },
                    { value: 'admin', label: 'Administrator' },
                  ]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </OperationsPage>
  );
}
