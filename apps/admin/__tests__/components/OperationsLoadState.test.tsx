import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { OperationsSelect } from '@/components/OperationsPage';
import type { StaffMemberJson } from '@/types/staff-audit';
import type { ReservationInboxJson } from '@/types/reservation-calendar';
import ReservationsPage from '@/app/(dashboard)/reservations/page';
import StaffPage from '@/app/(dashboard)/staff/page';
jest.mock('@/components/AuthGuard', () => ({
  useStaffAccess: () => ({ userId: 'self' }),
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: undefined }),
}));
jest.mock('@/components/OperationsPage', () => {
  const actual = jest.requireActual<
    typeof import('@/components/OperationsPage')
  >('@/components/OperationsPage');
  return {
    ...actual,
    OperationsSelect: ({
      label,
      value,
      onChange,
      options,
      isDisabled,
    }: ComponentProps<typeof OperationsSelect>) => (
      <label>
        {label}
        <select
          value={value}
          disabled={isDisabled}
          onChange={event => onChange(event.target.value)}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    ),
  };
});
const fetchMock = jest.fn();
const originalFetch = global.fetch;
const staff: StaffMemberJson[] = [
  { userId: 'self', name: 'You', role: 'admin' },
  { userId: 'other', name: 'Avery', role: 'front_desk' },
];
const inbox: ReservationInboxJson = {
  page: 1,
  limit: 25,
  total: 1,
  rows: [
    {
      _id: 'one',
      type: 'dining',
      date: '2040-01-01T00:00:00Z',
      endDate: null,
      time: '18:00',
      partySize: 2,
      resourceId: 'dining',
      resourceName: 'Supper',
      customer: 'customer',
      customerName: 'Avery',
      status: 'confirmed',
      lifecycle: 'confirmed',
      totalPrice: 10,
      isPaid: false,
      createdAt: '2040-01-01T00:00:00Z',
    },
  ],
};
function ok(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
});
test('staff initial load failure is retryable and clears errors while preserving own access restriction', async () => {
  fetchMock
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(ok(staff));
  render(<StaffPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Avery');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Access for You')).toBeDisabled();
  expect(screen.getByLabelText('Access for Avery')).toHaveValue('front_desk');
});
test('staff save failure keeps loaded rows; successful retry posts same role and refreshes', async () => {
  fetchMock
    .mockResolvedValueOnce(ok(staff))
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Access denied' }),
    })
    .mockResolvedValueOnce(ok(null))
    .mockResolvedValueOnce(ok([{ ...staff[1], role: 'manager' }]));
  render(<StaffPage />);
  await screen.findByText('Avery');
  fireEvent.change(screen.getByLabelText('Access for Avery'), {
    target: { value: 'manager' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
  expect(screen.getByText('Avery')).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  fireEvent.change(screen.getByLabelText('Access for Avery'), {
    target: { value: 'manager' },
  });
  await waitFor(() =>
    expect(screen.getByLabelText('Access for Avery')).toHaveValue('manager')
  );
  expect(fetchMock.mock.calls[1]).toEqual([
    '/api/staff',
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'other', role: 'manager' }),
    },
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('inbox retry keeps page/limit filters and clears a failed load', async () => {
  fetchMock
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(ok(inbox));
  render(<ReservationsPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Offline');
  const url = String(fetchMock.mock.calls[0][0]);
  expect(url).toContain('page=1&limit=25&from=');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Supper');
  expect(String(fetchMock.mock.calls[1][0])).toBe(url);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
test('changing inbox filters aborts and ignores a late response for the previous filters', async () => {
  let finish: (value: ReturnType<typeof ok>) => void = () => {
    throw new Error('not started');
  };
  fetchMock
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    )
    .mockResolvedValueOnce(
      ok({
        ...inbox,
        rows: [{ ...inbox.rows[0], resourceName: 'Current listing' }],
      })
    );
  render(<ReservationsPage />);
  fireEvent.change(screen.getByLabelText('Type'), {
    target: { value: 'experience' },
  });
  await screen.findByText('Current listing');
  expect(String(fetchMock.mock.calls[1][0])).toContain('type=experience');
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => {
    finish(ok(inbox));
  });
  expect(screen.queryByText('Supper')).not.toBeInTheDocument();
  expect(screen.getByText('Current listing')).toBeInTheDocument();
});
