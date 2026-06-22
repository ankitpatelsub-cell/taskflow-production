import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      JWT_SECRET: 'test_jwt_secret_32chars_long_key',
      JWT_REFRESH_SECRET: 'test_refresh_secret_32chars_long',
      BACKUP_ENCRYPTION_KEY: 'test_backup_key_32chars_longxxx',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      NODE_ENV: 'test',
    },
    include: ['src/test/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/test/**', 'index.js'],
    },
  },
});
