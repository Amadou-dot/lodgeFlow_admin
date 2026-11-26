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
import CalendarPage from '@/app/(dashboard)/calendar/page';
import ReservationsPage from '@/app/(dashboard)/reservations/page';
import AuditPage from '@/app/(dashboard)/audit/page';
import StaffPage from '@/app/(dashboard)/staff/page';
import type { AppSettings } from '@/types';
import { legacyCurrencySettings } from '../setup/settings-fixture';
jest.mock('@/components/AuthGuard', () => ({
  useStaffAccess: () => ({ userId: 'self' }),
}));
let mockSettings: AppSettings | undefined;
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ data: mockSettings }),
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
      _id: '507f1f77bcf86cd799439011',
      type: 'dining',
      date: '2040-01-01T00:00:00.000Z',
      endDate: null,
      time: '18:00',
      partySize: 2,
      resourceId: '507f1f77bcf86cd799439012',
      resourceName: 'Supper',
      customer: 'customer',
      customerName: 'Avery',
      status: 'confirmed',
      lifecycle: 'confirmed',
      totalPrice: 10,
      isPaid: false,
      createdAt: '2040-01-01T00:00:00.000Z',
    },
  ],
};
function ok(data: unknown) {
  return { ok: true, json: async () => ({ success: true, data }) };
}
beforeEach(() => {
  mockSettings = undefined;
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
    .mockResolvedValueOnce(ok({ userId: 'other', role: 'manager' }))
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
test('staff rejects an invalid role before showing roster rows', async () => {
  fetchMock.mockResolvedValueOnce(ok([{ ...staff[1], role: 'owner' }]));
  render(<StaffPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load staff'
  );
  expect(screen.queryByText('Avery')).not.toBeInTheDocument();
});

test.each([
  ['a missing acknowledgement', null],
  ['a different target', { userId: 'self', role: null }],
  ['a different role', { userId: 'other', role: 'manager' }],
])(
  'staff does not refresh on %s and can retry a revocation',
  async (_label, acknowledgement) => {
    const revoked = { ...staff[1], role: null };
    fetchMock
      .mockResolvedValueOnce(ok(staff))
      .mockResolvedValueOnce(ok(acknowledgement))
      .mockResolvedValueOnce(ok({ userId: 'other', role: null }))
      .mockResolvedValueOnce(ok([revoked]));
    render(<StaffPage />);
    const select = await screen.findByLabelText('Access for Avery');
    fireEvent.change(select, { target: { value: '' } });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to update access'
    );
    expect(select).toHaveValue('front_desk');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(select).toHaveValue(''));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }
);

const auditEvent = {
  _id: '507f1f77bcf86cd799439011',
  organizationId: 'org_lodgeflow',
  actor: 'user_admin',
  actorRole: 'admin',
  action: 'staff.role_change',
  resourceType: 'staff',
  resourceId: 'user_guest',
  before: { role: null },
  after: { role: 'manager' },
  createdAt: '2030-01-01T00:00:00.000Z',
};
const auditHistory = {
  events: [auditEvent],
  total: 1,
  page: 1,
  limit: 25,
  actions: ['staff.role_change'],
};

test.each([
  ['an invalid event', { events: [{ ...auditEvent, actorRole: 'owner' }] }],
  ['an invalid total', { total: '1' }],
  ['an unknown action option', { actions: ['unknown'] }],
])('audit rejects %s before showing history', async (_label, fields) => {
  fetchMock.mockResolvedValueOnce(ok({ ...auditHistory, ...fields }));
  render(<AuditPage />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load history'
  );
  expect(screen.queryByText('1 events')).not.toBeInTheDocument();
});

test('audit ignores late history after changing filters', async () => {
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
    .mockResolvedValueOnce(ok(auditHistory));
  render(<AuditPage />);
  fireEvent.change(screen.getByLabelText('Through'), {
    target: { value: '2030-01-01' },
  });
  await screen.findByText('user_admin (admin) · staff: user_guest');
  expect(fetchMock).toHaveBeenNthCalledWith(
    2,
    '/api/audit?page=1&limit=25&to=2030-01-01T23%3A59%3A59.999Z',
    { cache: 'no-store', signal: expect.any(AbortSignal) }
  );
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  await act(async () => finish(ok({ ...auditHistory, total: 0, events: [] })));
  expect(screen.getByText('1 events')).toBeInTheDocument();
  expect(screen.queryByText('0 events')).not.toBeInTheDocument();
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
test.each([
  [legacyCurrencySettings.currency, '10 A1!'],
  ['JPY', '¥10'],
  [null, '$10.00'],
])(
  'inbox renders a reservation in Settings currency %s',
  async (currency, displayed) => {
    mockSettings = { ...legacyCurrencySettings, currency };
    fetchMock.mockResolvedValueOnce(ok(inbox));
    render(<ReservationsPage />);

    expect(await screen.findByText(displayed)).toBeInTheDocument();
    expect(screen.getByText('Balance due')).toBeInTheDocument();
  }
);

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
        rows: [
          {
            ...inbox.rows[0],
            type: 'experience',
            time: null,
            resourceName: 'Current listing',
          },
        ],
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

test.each([
  ['invalid pagination', { page: '1' }],
  [
    'a status from another reservation type',
    { rows: [{ ...inbox.rows[0], status: 'checked-in', lifecycle: 'active' }] },
  ],
  [
    'an invalid lifecycle',
    { rows: [{ ...inbox.rows[0], lifecycle: 'active' }] },
  ],
])('inbox rejects %s before rendering rows', async (_case, fields) => {
  fetchMock.mockResolvedValueOnce(ok({ ...inbox, ...fields }));
  render(<ReservationsPage />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load reservations'
  );
  expect(screen.queryByText('Supper')).not.toBeInTheDocument();
});

test('inbox retries a malformed envelope and accepts an empty page', async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: inbox }) })
    .mockResolvedValueOnce(ok({ ...inbox, rows: [], total: 0 }));
  render(<ReservationsPage />);

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to load reservations'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('0 reservations')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

const calendarWindow = {
  start: '2040-01-01T00:00:00.000Z',
  end: '2040-01-03T00:00:00.000Z',
};
const cabinId = '507f1f77bcf86cd799439013';
const bookingId = '507f1f77bcf86cd799439014';
const cabinMonth = {
  ...calendarWindow,
  resources: [{ _id: cabinId, name: 'Creek cabin', status: null }],
  reservations: [
    {
      _id: bookingId,
      cabin: cabinId,
      customer: 'user_guest',
      checkInDate: '2039-12-31T00:00:00.000Z',
      checkOutDate: '2040-01-02T00:00:00.000Z',
      status: 'confirmed',
    },
  ],
};
const diningMonth = {
  ...calendarWindow,
  resources: [
    {
      _id: inbox.rows[0].resourceId,
      name: 'Dinner',
      isAvailable: false,
      maxPeople: 4,
      servingTime: { start: '12:00', end: '22:00' },
    },
  ],
  usage: [],
};
const experienceMonth = {
  ...calendarWindow,
  resources: [{ _id: '507f1f77bcf86cd799439015', name: 'Local hike' }],
  usage: [],
};

test.each([
  [
    'cabin',
    'cabins',
    {
      ...cabinMonth,
      reservations: [{ ...cabinMonth.reservations[0], checkOutDate: 'soon' }],
    },
  ],
  [
    'dining',
    'dining',
    {
      ...diningMonth,
      resources: [{ ...diningMonth.resources[0], maxPeople: '4' }],
    },
  ],
  [
    'experience',
    'experiences',
    {
      ...experienceMonth,
      usage: [
        {
          _id: {
            resourceId: experienceMonth.resources[0]._id,
            date: '2040-01-01',
          },
          used: '3',
        },
      ],
    },
  ],
])(
  'calendar rejects malformed %s data for the active view',
  async (_name, view, payload) => {
    if (view === 'cabins') fetchMock.mockResolvedValueOnce(ok(payload));
    else
      fetchMock
        .mockResolvedValueOnce(ok(cabinMonth))
        .mockResolvedValueOnce(ok(payload));
    render(<CalendarPage />);
    if (view !== 'cabins') {
      await screen.findByText('Creek cabin');
      fireEvent.change(screen.getByLabelText('View'), {
        target: { value: view },
      });
    }

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load calendar'
    );
    expect(
      screen.queryByRole('table', { name: 'Occupancy calendar' })
    ).not.toBeInTheDocument();
  }
);

test('calendar preserves checkout-day availability in the UTC window', async () => {
  fetchMock.mockResolvedValueOnce(ok(cabinMonth));
  render(<CalendarPage />);

  expect(
    await screen.findByRole('link', { name: 'confirmed' })
  ).toHaveAttribute('href', '/bookings/' + bookingId);
  expect(
    screen.getByTitle('Creek cabin: available 2040-01-02')
  ).toBeInTheDocument();
  expect(
    screen.queryByTitle('Creek cabin: available 2040-01-01')
  ).not.toBeInTheDocument();
});

test.each([
  ['valid', cabinMonth],
  ['malformed', { ...cabinMonth, start: 'bad' }],
])(
  'calendar ignores a late %s body after switching views',
  async (_label, late) => {
    let finish: (value: { success: true; data: unknown }) => void = () => {
      throw new Error('body not read');
    };
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      })
      .mockResolvedValueOnce(ok(diningMonth));
    render(<CalendarPage />);
    await act(async () => {});
    fireEvent.change(screen.getByLabelText('View'), {
      target: { value: 'dining' },
    });

    expect(await screen.findByText('Dinner')).toBeInTheDocument();
    expect(screen.getAllByText('0 booked')).toHaveLength(2);
    expect(
      screen.getByText('Unavailable for new bookings')
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: '0 booked' })[0]
    ).toHaveAttribute(
      'href',
      '/reservations?type=dining&from=2040-01-01&to=2040-01-02&resourceId=' +
        inbox.rows[0].resourceId
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/^\/api\/calendar\/dining\?start=.*&end=/),
      { cache: 'no-store', signal: expect.any(AbortSignal) }
    );
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);

    await act(async () => finish({ success: true, data: late }));

    expect(screen.getByText('Dinner')).toBeInTheDocument();
    expect(screen.queryByText('Creek cabin')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  }
);
