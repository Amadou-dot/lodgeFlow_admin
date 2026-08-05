import '@testing-library/jest-dom';

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    };
  },
}));

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock @clerk/nextjs
jest.mock('@clerk/nextjs', () => ({
  auth: jest.fn(() => ({
    userId: 'test-user-id',
    sessionId: 'test-session-id',
  })),
  currentUser: jest.fn(() => ({
    id: 'test-user-id',
    firstName: 'Test',
    lastName: 'User',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  })),
  ClerkProvider: ({ children }) => children,
  SignInButton: ({ children }) => children,
  SignUpButton: ({ children }) => children,
  SignOutButton: ({ children }) => children,
  UserButton: () => <div data-testid='clerk-user-button'>UserButton</div>,
  useAuth: jest.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    userId: 'test-user-id',
    sessionId: 'test-session-id',
    signOut: jest.fn(),
  })),
  useUser: jest.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: 'test-user-id',
      firstName: 'Test',
      lastName: 'User',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
  })),
}));

// Note: @tanstack/react-query is NOT mocked globally
// This allows hook tests to use the real React Query implementation
// For component tests that need specific query states, mock locally in the test file

// Mock fetch
global.fetch = jest.fn();

// Mock window.matchMedia (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    takeRecords() {
      return [];
    }
    unobserve() {}
  };

  // Mock ResizeObserver
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    disconnect() {}
    observe() {}
    unobserve() {}
  };
}

// Suppress console errors during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: useLayoutEffect') ||
        args[0].includes(
          'Not implemented: HTMLFormElement.prototype.requestSubmit'
        ))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
