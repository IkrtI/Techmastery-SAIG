import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    hookTimeout: 120000,
    testTimeout: 30000,
    fileParallelism: false,
  },
});
