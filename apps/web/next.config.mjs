/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  transpilePackages: ['@wpd/shared'],
};

export default nextConfig;
