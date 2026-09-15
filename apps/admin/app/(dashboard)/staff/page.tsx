'use client';
import { useEffect, useState } from 'react';
import { useStaffAccess } from '@/components/AuthGuard';
import type { StaffRole } from '@/lib/permissions';
type Member = { userId: string; name: string; role: StaffRole | null };
export default function StaffPage() {
  const access = useStaffAccess();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch('/api/staff', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to load staff');
    setMembers(result.data);
  }
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, []);
  async function change(member: Member, role: string) {
    setBusy(true);
    setError('');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update access');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className='space-y-6'>
      <h1 className='text-2xl font-semibold'>Staff access</h1>
      <p>
        Assign access to members of the LodgeFlow organization. Front desk staff
        manage bookings; managers also manage catalogs, settings, and refunds.
        Administrators manage staff access.
      </p>
      <p className='text-sm text-default-500'>
        Add new organization members in Clerk, then assign their access here.
        Your own access cannot be changed from this page.
      </p>
      {error && (
        <p role='alert' className='text-danger'>
          {error}
        </p>
      )}
      <table className='w-full text-left'>
        <thead>
          <tr>
            <th className='p-3'>Member</th>
            <th className='p-3'>Access</th>
          </tr>
        </thead>
        <tbody>
          {members.map(member => (
            <tr key={member.userId} className='border-t border-default-200'>
              <td className='p-3'>
                {member.name || member.userId}
                {member.userId === access?.userId ? ' (you)' : ''}
              </td>
              <td className='p-3'>
                <select
                  aria-label={`Access for ${member.name || member.userId}`}
                  value={member.role ?? ''}
                  disabled={busy || member.userId === access?.userId}
                  onChange={e => void change(member, e.target.value)}
                  className='rounded border bg-background p-2'
                >
                  <option value=''>No staff access</option>
                  <option value='front_desk'>Front desk</option>
                  <option value='manager'>Manager</option>
                  <option value='admin'>Administrator</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
