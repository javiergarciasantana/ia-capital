// next.config.ts
import type { NextConfig } from 'next'

// Usa el servicio del backend en Docker o el que tengas en el panel.
// Puedes sobreescribirlo con la env NEXT_API_PROXY_ORIGIN en despliegue.
const API_ORIGIN =
  process.env.NEXT_API_PROXY_ORIGIN || 'http://ia-capital_web-iacapital:5000'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

  async rewrites() {
    return [
      // Todo lo que empiece con /api -> backend
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      // Archivos subidos
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
    ]
  },
}

export default nextConfig
