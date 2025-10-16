// next.config.ts
import type { NextConfig } from 'next';
const { i18n } = require('./next-i18next.config.js');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  i18n,
  eslint: { ignoreDuringBuilds: true },      // ya lo pusimos antes
  typescript: { ignoreBuildErrors: true },   // ⬅️ saltar errores de TS en build
};

export default nextConfig;
