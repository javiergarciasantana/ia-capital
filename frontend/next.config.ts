// next.config.ts
import type { NextConfig } from 'next';
// si usas i18n:
const { i18n } = require('./next-i18next.config.js');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // quita si no usas i18n
  i18n,
  eslint: {
    // ⬇️ evita que el build falle por errores de ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
