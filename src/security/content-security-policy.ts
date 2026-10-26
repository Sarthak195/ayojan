export interface PolicyOptions {
  /** Fresh per response; a nonce that repeats can be copied from one page onto an injected script. */
  readonly nonce: string;
  readonly isDevelopment: boolean;
}

/**
 * Built per request because script-src carries the nonce. 'strict-dynamic' lets the nonced
 * bootstrap script load Next's chunks without listing each one.
 */
export function buildContentSecurityPolicy({ nonce, isDevelopment }: PolicyOptions): string {
  const scriptSrc = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  // React's dev overlay rebuilds server stack traces with eval; production never needs it.
  if (isDevelopment) scriptSrc.push("'unsafe-eval'");

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    // Inline style attributes cannot carry a nonce; default-src 'self' still blocks exfiltration.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Plain-http localhost development would break if every request were upgraded to https.
  if (!isDevelopment) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}
