export default function manifest() {
  return {
    name: 'Economía del Hogar',
    short_name: 'Finanzas',
    description: 'Control financiero familiar',
    start_url: '/',
    display: 'standalone',
  background_color: "#2D7A5F",
  theme_color: "#2D7A5F",

    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
    ],
  }
}
