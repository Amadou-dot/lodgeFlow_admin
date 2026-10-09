import { render, screen } from '@testing-library/react';
import ExperiencesPage from '@/app/experiences/page';
jest.mock('@/hooks/useExperiences', () => ({
  useExperiences: () => ({
    data: [],
    isLoading: false,
    error: new Error('offline'),
  }),
}));
test('a failed experiences request does not render a successful empty catalog', () => {
  render(<ExperiencesPage />);
  expect(
    screen.getByText(/Error loading experiences: offline/)
  ).toBeInTheDocument();
  expect(screen.queryByText('Available Experiences')).not.toBeInTheDocument();
  expect(screen.queryByText('Experience Categories')).not.toBeInTheDocument();
});
