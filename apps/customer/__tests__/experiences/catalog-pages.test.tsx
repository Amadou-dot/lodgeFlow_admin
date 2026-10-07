import { render, screen } from '@testing-library/react';
import type { Experience } from '@/types';
import ExperiencePage from '@/app/experiences/[id]/page';
import ExperienceBookPage from '@/app/experiences/[id]/book/page';

let mockExperience: Experience;
jest.mock('@/hooks/useExperience', () => ({
  useExperience: () => ({
    data: mockExperience,
    isLoading: false,
    error: null,
  }),
}));
jest.mock('@/components/ExperienceBookingForm', () => ({
  __esModule: true,
  default: () => <div>Booking form</div>,
}));

const fixture: Experience = {
  _id: '507f1f77bcf86cd799439011',
  name: 'Forest walk',
  price: 25,
  duration: '2 hours',
  difficulty: 'Easy',
  category: 'Nature',
  description: 'Explore the forest',
  image: '/images/forest.jpg',
  ctaText: 'Book now',
};

test.each([
  { name: 'detail', Page: ExperiencePage, title: 'Forest walk' },
  { name: 'booking', Page: ExperienceBookPage, title: 'Book: Forest walk' },
])(
  '$name renders populated includes without changing booking identity',
  async ({ Page, title }) => {
    mockExperience = {
      ...fixture,
      includes: ['Local guide'],
      available: ['Monday'],
    };
    render(<Page params={Promise.resolve({ id: fixture._id })} />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText(/Local guide/)).toBeInTheDocument();
  }
);

test.each([
  { name: 'detail', Page: ExperiencePage, title: 'Forest walk' },
  { name: 'booking', Page: ExperienceBookPage, title: 'Book: Forest walk' },
])(
  '$name renders sparse legacy catalogs without defaulted arrays',
  async ({ Page, title }) => {
    mockExperience = fixture;
    render(<Page params={Promise.resolve({ id: fixture._id })} />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByText(/Local guide/)).not.toBeInTheDocument();
  }
);
