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
          // Two years, subdomains included. No preload token: that is a registry submission the
          // owner makes on purpose, and the .app suffix is already preloaded as HTTPS-only.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // Nothing the app serves is loaded by another origin or opens a cross-origin window,
          // so both can be strict. Revisit them before adding an embed, a font CDN or a widget.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
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
