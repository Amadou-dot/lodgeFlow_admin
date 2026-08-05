const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

// Shared settings
const baseConfig = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'models/**/*.{ts,tsx}',
    'utils/**/*.{ts,tsx}',
    'types/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
};

// Shared settings for the two node-environment projects
const nodeBase = {
  ...baseConfig,
  testEnvironment: 'node',
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^zod$': '<rootDir>/node_modules/zod/index.cjs',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        diagnostics: false,
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.pnpm|@clerk|@heroui|@faker-js)/)',
  ],
};

// Unit project — pure functions, no database. Fast: no MongoDB Memory Server.
const nodeUnitProject = {
  ...nodeBase,
  displayName: 'unit',
  testMatch: ['<rootDir>/__tests__/unit/**/*.test.ts'],
  testTimeout: 10000,
};

// Integration project — API routes, models, scripts against MongoDB Memory Server
const nodeIntegrationProject = {
  ...nodeBase,
  displayName: 'integration',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.node.ts'],
  globalSetup: '<rootDir>/__tests__/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/__tests__/setup/globalTeardown.ts',
  testMatch: ['<rootDir>/__tests__/integration/**/*.test.ts'],
  testTimeout: 30000,
};

// JSDOM project — components, hooks, validations, mock-based API tests
const jsdomConfig = {
  ...baseConfig,
  displayName: 'jsdom',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.jsdom.ts'],
  testMatch: [
    '<rootDir>/__tests__/validations/**/*.test.ts',
    '<rootDir>/__tests__/api/**/*.test.ts',
    '<rootDir>/__tests__/hooks/**/*.test.ts',
    '<rootDir>/__tests__/hooks/**/*.test.tsx',
    '<rootDir>/__tests__/components/**/*.test.tsx',
    '<rootDir>/__tests__/utils/**/*.test.ts',
    '<rootDir>/__tests__/*.test.ts',
    '<rootDir>/__tests__/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/__tests__/__mocks__/',
    '<rootDir>/__tests__/setup/',
    '<rootDir>/__tests__/unit/',
    '<rootDir>/__tests__/integration/',
  ],
  testTimeout: 15000,
};

// next/jest createJestConfig returns an async function
// We resolve the jsdom config and combine with the node projects
module.exports = async () => {
  const resolveJsdomConfig = createJestConfig(jsdomConfig);
  const resolvedJsdom = await resolveJsdomConfig();

  return {
    // Integration suites share a single MongoDB Memory Server instance, so
    // they must not run in parallel with each other.
    maxWorkers: 1,
    projects: [nodeUnitProject, nodeIntegrationProject, resolvedJsdom],
  };
};
