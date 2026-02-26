import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@phork/shared'],
  devIndicators: false,
};

export default nextConfig;
