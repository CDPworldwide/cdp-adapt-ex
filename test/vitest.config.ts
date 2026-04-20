import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'pac-api-integration',
    globals: true,
    environment: 'node',
    setupFiles: ['./setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.config.ts',
      ],
    },
  },
});
