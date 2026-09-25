const packageJson = require('./package.json');
const {
  PHONE_REWRITE_UA_VALUE,
  TABLET_UA_VALUE,
} = require('./src/lib/mobile-ui/ua-patterns');
const { productionMobilePreviewRewrites } = require('./src/lib/mobile-ui/preview-block');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expor versão do app como variável de ambiente
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  // Configurações básicas
  typescript: {
    // Skip TS errors only on Netlify to avoid failing builds; keep strict locally
    // Temporariamente ignorando para testar build do Next.js 15
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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

  // Pacotes externos no servidor (estabilizado no Next 15; antes era experimental.serverComponentsExternalPackages)
  // pdfkit: externo porque carrega fontes AFM via fs a partir de node_modules
  // (bundle webpack quebra com ENOENT em vendor-chunks/data/*.afm).
  serverExternalPackages: ['tesseract.js', 'pdfjs-dist', 'canvas', 'pdf-parse', 'pdfkit'],

  // Configurações experimentais
  experimental: {
    optimizeCss: true,
  },

  // Configurações do webpack para polyfill de módulos Node.js
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Não empacotar essas dependências nativas/pesadas no bundle do servidor
      config.externals = config.externals || [];
      config.externals.push({
        'canvas': 'commonjs canvas',
        'pdfjs-dist': 'commonjs pdfjs-dist',
      });
    }
    if (!isServer) {
      // Polyfill para módulos Node.js no cliente
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: require.resolve('stream-browserify'),
        tls: require.resolve('stream-browserify'),
        dns: require.resolve('stream-browserify'),
        fs: false,
        child_process: false,
        // crypto-browserify pulled elliptic (GHSA-848j-6mx2-7j84, no fix ≤6.6.1).
        // App crypto usage is server-only; client uses Web Crypto. Do not re-enable without a patched elliptic.
        crypto: false,
        path: require.resolve('path-browserify'),
        os: require.resolve('os-browserify/browser'),
        util: require.resolve('util'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        events: require.resolve('events'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        url: require.resolve('url'),
        zlib: require.resolve('browserify-zlib'),
      };
      
      // Adiciona os polyfills aos plugins
      config.plugins = config.plugins || [];
      
      // Fornece as variáveis globais para buffer e process
      config.plugins.push(
        new (require('webpack').ProvidePlugin)({
          Buffer: ['buffer', 'Buffer'],
          process: 'process/browser',
        })
      );
      
      // Define o ambiente
      config.plugins.push(
        new (require('webpack').DefinePlugin)({
          'global': 'globalThis',
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
        })
      );
    }
    return config;
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
          {
            key: 'Permissions-Policy',
            value: 'clipboard-read=*, clipboard-write=*',
          },
        ],
      },
    ];
  },

  // Proxy para o Guacamole (WKRadar) para permitir acesso Same-Origin e Auto-Login.
  // beforeFiles: fallback do P0 `/login` (cookie `ui` + CH + UA).
  // A detecção já corre no middleware (`applyMobileSurface`) agora que o
  // Edge volta a entrar no bundle. Não mover o rewrite só para o middleware:
  // `ui=desktop` (cookie e query) está em `missing` aqui (override intacto); Next.js
  // `userAgent().device.type` e o regex de telefone podem discordar; se o
  // Edge falhar de novo, `/login` mobile quebra sem este fallback.
  // Cookie `ui=desktop` vence. Tablet (iPad + Android) = desktop. Desktop UA não casa.
  async rewrites() {
    return {
      beforeFiles: [
        ...(process.env.NODE_ENV === 'production' ? productionMobilePreviewRewrites() : []),
        {
          source: '/login',
          has: [{ type: 'cookie', key: 'ui', value: 'mobile' }],
          destination: '/m/login',
        },
        {
          source: '/login',
          has: [{ type: 'header', key: 'sec-ch-ua-mobile', value: '\\?1' }],
          missing: [
            { type: 'cookie', key: 'ui', value: 'desktop' },
            { type: 'query', key: 'ui', value: 'desktop' },
            { type: 'header', key: 'user-agent', value: TABLET_UA_VALUE },
          ],
          destination: '/m/login',
        },
        {
          source: '/login',
          has: [{ type: 'header', key: 'user-agent', value: PHONE_REWRITE_UA_VALUE }],
          missing: [
            { type: 'cookie', key: 'ui', value: 'desktop' },
            { type: 'query', key: 'ui', value: 'desktop' },
            { type: 'header', key: 'user-agent', value: TABLET_UA_VALUE },
          ],
          destination: '/m/login',
        },
      ],
      afterFiles: [
        {
          source: '/guacamole/:path*',
          destination: 'https://vm.groupabz.com/guacamole/:path*',
        },
        {
          source: '/poliweb-external/:path*',
          destination: 'https://poliweb.policlinicamacae.com.br/:path*',
        },
      ],
    };
  },
};

module.exports = nextConfig;
