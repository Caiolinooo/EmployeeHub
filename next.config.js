const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Desativar a verificação de tipos durante o build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Desativar a verificação de ESLint durante o build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Configurar pacotes para transpilação (não pode incluir pacotes em serverExternalPackages)
  transpilePackages: [],

  // Configurar o webpack para lidar com módulos problemáticos
  webpack: (config, { isServer, dev }) => {
    if (isServer) {
      // Manter googleapis como external para reduzir bundle
      config.externals = [...config.externals || [], 'bcryptjs', 'nodemailer', 'googleapis'];
    }

    // Fix webpack cache issues
    if (dev) {
      // Use a custom cache directory to avoid permission issues
      config.cache = {
        type: 'filesystem',
        cacheDirectory: path.join(process.cwd(), '.next/cache/webpack'),
        buildDependencies: {
          config: [__filename],
        },
      };
    }

    // Otimizar o tamanho do bundle
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        chunks: 'all',
        cacheGroups: {
          ...config.optimization?.splitChunks?.cacheGroups,
          supabase: {
            name: 'supabase',
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          libs: {
            name: 'libs',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            priority: 10,
          },
          commons: {
            name: 'commons',
            chunks: 'all',
            minChunks: 2,
            priority: 5,
          },
        },
      },
    };

    return config;
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
    // Otimizar carregamento de imagens
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },

  // Permitir origens de desenvolvimento
  experimental: {
    // Otimizar CSS
    optimizeCss: true,
    // Permitir origens de desenvolvimento específicas
    allowedDevOrigins: ['localhost:3000', '127.0.0.1:3000']
  },

  // External packages for server components (moved from experimental)
  // Inclui googleapis para reduzir bundle size
  serverExternalPackages: ['bcryptjs', 'nodemailer', 'twilio', 'googleapis'],

  // Configurar o comportamento de build
  poweredByHeader: false,
  reactStrictMode: true, // Ativar o modo estrito para melhor detecção de erros

  // Configuração do SWC (substitui o Babel)
  compiler: {
    styledComponents: true,
    // Configurações adicionais do SWC
    reactRemoveProperties: process.env.NODE_ENV === 'production',
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'] // Manter apenas logs importantes em produção
    } : false,
  },

  // Otimizações de output
  output: 'standalone',

  // Configurações de segurança
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Configurações para lidar com erros 404
  async rewrites() {
    return [];
  },

  // Configurações de redirecionamento
  async redirects() {
    return [];
  },
};

module.exports = nextConfig;
