import './globals.css'
import { ThemeProvider } from '@/lib/themes'

export const metadata = {
  title: 'Familia Finanzas',
  description: 'Gestión financiera familiar inteligente',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent', // ← era 'default'
    title: 'Familia Finanzas',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}
// 1. AÑADE EL THEME COLOR AQUÍ (Para Android y navegadores modernos)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Familia Finanzas" />
        <link rel="apple-touch-icon" href="/icon.svg" />

        {/* ← AÑADE ESTO: aplica theme-color antes de que React hidrate */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var COLORS = {
              linen:    '#B3A89D',
              obsidian: '#0F1115',
              ocean:    '#E8F4F6',
              forest:   '#F1F5F1',
            };
            var saved = localStorage.getItem('ff-theme');
            var color = COLORS[saved] || '#B3A89D';
            var meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = color;
            document.head.appendChild(meta);
            document.documentElement.style.backgroundColor = color;
          })();
        `}} />
      </head>

      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}