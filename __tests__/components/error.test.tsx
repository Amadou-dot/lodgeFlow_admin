import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Error from '@/app/error';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

describe('Error Component', () => {
  const mockReset = jest.fn();
  const mockError = {
    name: 'Error',
    message: 'Test error message',
    stack: 'Error stack trace',
  } as Error;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
  });

  it('renders error component with correct content', () => {
    render(<Error error={mockError} reset={mockReset} />);

    expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(/We encountered an unexpected error/)
    ).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('calls reset function when Try Again button is clicked', () => {
    render(<Error error={mockError} reset={mockReset} />);

    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('navigates to home when Go Home button is clicked', () => {
    render(<Error error={mockError} reset={mockReset} />);

    const goHomeButton = screen.getByText('Go Home');
    fireEvent.click(goHomeButton);

    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('logs error to console', () => {
    render(<Error error={mockError} reset={mockReset} />);

    expect(console.error).toHaveBeenCalledWith('Application Error:', mockError);
  });

  it('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'development',
      writable: true,
    });

    render(<Error error={mockError} reset={mockReset} />);

    expect(
      screen.getByText('Error Details (Development Only)')
    ).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
    });
  });

  it('hides error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production',
      writable: true,
    });

    render(<Error error={mockError} reset={mockReset} />);

    expect(
      screen.queryByText('Error Details (Development Only)')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Test error message')).not.toBeInTheDocument();

    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
    });
  });

  it('displays error ID', () => {
    render(<Error error={mockError} reset={mockReset} />);

    expect(screen.getByText(/Error ID:/)).toBeInTheDocument();
  });

  it('renders the alert and button icons', () => {
    const { container } = render(<Error error={mockError} reset={mockReset} />);

    // lucide-react icons render as SVGs without an accessible role
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(3);
  });
});
