import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DiningConfirmation from '@/app/dining/confirmation/[id]/page';
import ExperienceConfirmation from '@/app/experiences/confirmation/[id]/page';
jest.mock('@clerk/nextjs', () => ({
  useUser: () => ({ user: { id: 'guest' }, isLoaded: true }),
}));
jest.mock('@heroui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardBody: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
const common = {
  _id: 'reservation',
  customer: 'guest',
  date: '2030-06-01',
  status: 'confirmed',
  totalPrice: 50,
  isPaid: false,
  specialRequests: [],
};
beforeEach(() => {
  global.fetch = jest.fn();
});
for (const kind of ['dining', 'experience'] as const) {
  it(`offers checkout on the authorized ${kind} confirmation`, async () => {
    const data =
      kind === 'dining'
        ? {
            ...common,
            dining: {
              name: 'Dinner',
              image: '/dining.jpg',
              price: 25,
              servingTime: { start: '12:00', end: '22:00' },
            },
            time: '19:00',
            numGuests: 2,
            dietaryRequirements: [],
          }
        : {
            ...common,
            experience: {
              name: 'Hike',
              image: '/hike.jpg',
              price: 25,
              duration: '2 hours',
            },
            numParticipants: 2,
          };
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data }),
    });
    const Component =
      kind === 'dining' ? DiningConfirmation : ExperienceConfirmation;
    render(<Component params={Promise.resolve({ id: 'reservation' })} />);
    expect(
      await screen.findByRole('button', { name: 'Pay outstanding balance' })
    ).toBeInTheDocument();
  });
}

for (const kind of ['dining', 'experience'] as const) {
  it(`keeps the ${kind} confirmation usable after its listing is deleted`, async () => {
    const data =
      kind === 'dining'
        ? {
            ...common,
            dining: null,
            time: '19:00',
            numGuests: 2,
            dietaryRequirements: [],
            tablePreference: 'no-preference',
          }
        : { ...common, experience: null, numParticipants: 2 };
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data }),
    });
    const Component =
      kind === 'dining' ? DiningConfirmation : ExperienceConfirmation;
    render(<Component params={Promise.resolve({ id: 'reservation' })} />);
    expect(await screen.findByText('Removed listing')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Pay outstanding balance' })
    ).toBeInTheDocument();
  });
}
