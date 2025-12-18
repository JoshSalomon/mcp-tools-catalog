import '@testing-library/jest-dom';

// Cleanup after each test to prevent memory leaks
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Force cleanup on test completion
afterAll(() => {
  jest.useRealTimers();
});