import { vi } from 'vitest';

// A test that needs the network is flaky and can cost money, so any attempt fails loudly.
vi.stubGlobal('fetch', (): never => {
  throw new Error(
    'Network access is blocked in tests: they must run offline. Inject a fake instead of calling fetch.',
  );
});
