import { act, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { PERMISSIONS } from '@/lib/permissions';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));
const replace = jest.fn();
const identity = {
  isLoaded: true,
  isSignedIn: true,
  userId: 'staff-1',
  orgId: 'org-1',
  sessionId: 'session-1',
};
const auth = useAuth as jest.Mock;
const pathname = usePathname as jest.Mock;
const request = global.fetch as jest.Mock;
function response(permissions: readonly string[] = PERMISSIONS) {
  return {
    ok: true,
    json: async () => ({
      data: { userId: 'staff-1', role: 'admin', permissions },
    }),
  };
}
function dashboard() {
  return (
    <AuthGuard>
      <div>Dashboard shell</div>
    </AuthGuard>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockReturnValue(identity);
  pathname.mockReturnValue('/reservations');
  (useRouter as jest.Mock).mockReturnValue({ replace });
  request.mockResolvedValue(response());
});
it('keeps the same dashboard mounted while navigation revalidates access', async () => {
  const view = render(dashboard());
  const shell = await screen.findByText('Dashboard shell');
  let resolve!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  pathname.mockReturnValue('/calendar');
  view.rerender(dashboard());
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByText('Dashboard shell')).toBe(shell);
  expect(screen.queryByText('Checking staff access…')).not.toBeInTheDocument();
  await act(async () => resolve(response()));
  expect(screen.getByText('Dashboard shell')).toBe(shell);
});
it.each([
  { userId: 'staff-2' },
  { orgId: 'org-2' },
  { sessionId: 'session-2' },
])('does not reuse access after identity changes: %j', async changed => {
  const view = render(dashboard());
  await screen.findByText('Dashboard shell');
  request.mockImplementationOnce(() => new Promise(() => {}));
  auth.mockReturnValue({ ...identity, ...changed });
  view.rerender(dashboard());
  expect(screen.queryByText('Dashboard shell')).not.toBeInTheDocument();
  expect(screen.getByText('Checking staff access…')).toBeInTheDocument();
});
it('blocks a restricted route immediately using known permissions', async () => {
  request.mockResolvedValueOnce(response(['bookings:read']));
  const view = render(dashboard());
  await screen.findByText('Dashboard shell');
  request.mockImplementationOnce(() => new Promise(() => {}));
  pathname.mockReturnValue('/staff');
  view.rerender(dashboard());
  expect(screen.queryByText('Dashboard shell')).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith('/unauthorized');
});
it('clears access when background revalidation is denied', async () => {
  const view = render(dashboard());
  await screen.findByText('Dashboard shell');
  request.mockResolvedValueOnce({ ok: false });
  pathname.mockReturnValue('/calendar');
  view.rerender(dashboard());
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/unauthorized'));
  expect(screen.queryByText('Dashboard shell')).not.toBeInTheDocument();
});
it('hides the dashboard and redirects after sign-out', async () => {
  const view = render(dashboard());
  await screen.findByText('Dashboard shell');
  auth.mockReturnValue({ ...identity, isSignedIn: false });
  view.rerender(dashboard());
  expect(screen.queryByText('Dashboard shell')).not.toBeInTheDocument();
  expect(replace).toHaveBeenCalledWith('/sign-in');
});

it('ignores an old request after switching organizations', async () => {
  let resolve!: (value: unknown) => void;
  request.mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      })
  );
  const view = render(dashboard());
  request.mockImplementationOnce(() => new Promise(() => {}));
  auth.mockReturnValue({ ...identity, orgId: 'org-2' });
  view.rerender(dashboard());
  await act(async () => resolve(response()));
  expect(screen.queryByText('Dashboard shell')).not.toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});
