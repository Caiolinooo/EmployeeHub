/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configurações básicas
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['pages', 'utils', 'src'],
  },

  // Configurações de imagens
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'abzgroup.com.br',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'arzvingdtnttiejcvucs.supabase.co',
      },
    ],
  },

  // Configurações experimentais
  experimental: {
    optimizeCss: true,
  },

  // Configurações básicas de segurança
  poweredByHeader: false,
  reactStrictMode: true,

  // Configurações de headers de segurança
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
