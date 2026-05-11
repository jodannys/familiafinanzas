export default function manifest() {
  return {
    name: 'Economía del Hogar',
    short_name: 'Finanzas',
    description: 'Control financiero familiar',
    start_url: '/',
    display: 'standalone',
    background_color: '#2d7a5b',
    theme_color: '#2d7a5b',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
