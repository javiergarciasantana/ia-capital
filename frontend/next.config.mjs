/** @type {import('next').NextConfig} */
const API_ORIGIN = 'https://ia-capital-web-iacapital.fn24pb.easypanel.host';
export default {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  pageExtensions: ['tsx','ts','jsx','js'],
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/api/:path*',     destination: `${API_ORIGIN}/api/:path*` },
        { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
      ],
    };
  },
};
