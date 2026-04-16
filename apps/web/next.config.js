/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { externalDir: true },
  transpilePackages: ['@gatekeep/shared-types'],
};
module.exports = nextConfig;
