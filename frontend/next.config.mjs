/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  pageExtensions: ['tsx','ts','jsx','js'],
  async headers() {
    return [
      { source: '/:path*', headers: [{ key: 'x-next-config', value: 'loaded' }] },
    ]
  },
}
export default nextConfig
