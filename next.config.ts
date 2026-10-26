import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Emits a self-contained server for the container image instead of shipping node_modules.
  output: 'standalone',
  poweredByHeader: false,
  // AGENTS.md carries the "read the bundled docs" instruction itself (item 6), so next dev
  // must not keep re-inserting its own managed copy of it.
  agentRules: false,

  // Fixed headers live here; the Content-Security-Policy cannot, because its nonce changes
  // on every response (see src/proxy.ts). Next types this as a promise with nothing to await.
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          // Duplicates frame-ancestors for older browsers that ignore the CSP directive.
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
    ]);
  },
};

export default nextConfig;
