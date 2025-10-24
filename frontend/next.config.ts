/** @type {import('next').NextConfig} */
const API_ORIGIN =
  process.env.NEXT_API_PROXY_ORIGIN ||
  'https://ia-capital-web-iacapital.fn24pb.easypanel.host'

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
    ]
  },
}

module.exports = nextConfig
