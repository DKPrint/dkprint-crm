import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep docs/user-guides available on Vercel serverless for /help (SoT + mirror).
  outputFileTracingIncludes: {
    '/help': ['./docs/user-guides/**/*', './src/content/user-guides/**/*'],
  },
};

export default nextConfig;
