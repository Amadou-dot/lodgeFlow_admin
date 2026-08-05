# API Testing Documentation

## Experiences API Tests

This document describes the comprehensive test suite for the `/api/experiences` endpoints.

### Test Coverage

The test suite covers all CRUD operations with comprehensive error handling:

#### `/api/experiences` (Collection Routes)
- **GET** - Retrieve all experiences
  - ✅ Returns all experiences successfully
  - ✅ Handles database errors gracefully

- **POST** - Create new experience
  - ✅ Creates new experience with valid data
  - ✅ Handles creation errors
  - ✅ Handles invalid JSON input

#### `/api/experiences/[id]` (Individual Resource Routes)
- **GET** - Retrieve specific experience
  - ✅ Returns specific experience by ID
  - ✅ Returns 404 for non-existent experience
  - ✅ Handles database errors

- **PUT** - Update existing experience
  - ✅ Updates experience with valid data
  - ✅ Returns 404 for non-existent experience
  - ✅ Handles update errors
  - ✅ Handles invalid JSON input

- **DELETE** - Remove experience
  - ✅ Deletes existing experience
  - ✅ Returns 404 for non-existent experience
  - ✅ Handles deletion errors

### Running Tests

```bash
# Run all API tests
pnpm test api

# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run with coverage
pnpm test --coverage
```

### Test Structure

Each test follows this pattern:
1. **Arrange** - Set up mocks and data
2. **Act** - Execute the API endpoint
3. **Assert** - Verify the response and side effects

### Mock Strategy

- **Database**: MongoDB connection and Experience model are mocked
- **Requests**: Uses `NextRequest` with realistic data
- **Responses**: Validates both success and error scenarios

### Key Features

- **Isolation**: Each test is independent
- **Realistic Data**: Uses proper experience data structure
- **Error Scenarios**: Tests all failure paths
- **Type Safety**: Full TypeScript support
- **Node Environment**: Uses correct Jest environment for API testing

### Test Results Summary

- **Total Tests**: 15
- **Passing**: 15 ✅
- **Failing**: 0 ❌
- **Coverage**: 100% of API routes
