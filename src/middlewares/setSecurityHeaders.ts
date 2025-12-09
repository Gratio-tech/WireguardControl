import type { NextFunction, Request, Response } from 'express';

export const setSecurityHeaders = (_: Request, res: Response, next: NextFunction): void => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Expect-CT': 'enforce, max-age=86400',
    'Content-Security-Policy':
      "default-src 'self' 'unsafe-inline' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'",
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Cache-Control': 'no-store',
  });
  next();
};
