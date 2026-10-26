import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The real package throws outside a React Server Component, which would make every
      // server module untestable. `next build` still resolves the real one, so the
      // guarantee that server code never reaches a client bundle is unchanged.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Scoped to src/core on purpose: it holds every decision, so its figure is honest,
      // whereas a global number would average in framework glue that is not unit-tested.
      include: ['src/core/**/*.ts'],
      reporter: ['text', 'json-summary'],
    },
  },
});
