import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Portal ABZ',
    short_name: 'Portal ABZ',
    description: 'Portal corporativo unificado para gestão de pessoas, processos e comunicação da ABZ Group',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0B72E7',
    theme_color: '#0B72E7',
    orientation: 'any',
    icons: [
      {
        src: '/images/LC1_Azul.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/LC1_Azul.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/images/LC1_Azul.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
