/** @type {import('next').NextConfig} */
const API_ORIGIN =
    process.env.NEXT_API_PROXY_ORIGIN ||
    'https://ia-capital-web-iacapital.fn24pb.easypanel.host';

const nextConfig = {
    reactStrictMode: true,
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
    pageExtensions: ['tsx', 'ts', 'jsx', 'js'],

    // Rewrites ANTES de comprobar rutas de Next (incluidas /api)
    async rewrites() {
        return {
            beforeFiles: [
                { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
                { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
            ],
        };
    },

    // Cabecera de prueba para verificar que esta config se está cargando
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [{ key: 'x-next-config', value: 'loaded' }],
            },
        ];
    },
};

export default nextConfig;
