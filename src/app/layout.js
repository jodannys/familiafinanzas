import './globals.css'
import { ThemeProvider } from '@/lib/themes'

export const metadata = {
  title: 'Familia Finanzas',
  description: 'Gestión financiera familiar inteligente',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Familia Finanzas',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

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

        <script dangerouslySetInnerHTML={{
          __html: `
(function() {
  var THEMES = {
    linen:    { bg: '#B3A89D' },
    obsidian: { bg: '#0F1115' },
    ocean:    { bg: '#E8F4F6' },
    forest:   { bg: '#F1F5F1' },
  };
  var saved = localStorage.getItem('ff-theme') || 'linen';
  var t = THEMES[saved] || THEMES.linen;

  // ← ESTA es la línea que faltaba: activa todas las CSS vars del tema
  document.documentElement.setAttribute('data-theme', saved);

  // Fondo inmediato para evitar destello blanco
  document.documentElement.style.backgroundColor = t.bg;
  document.documentElement.style.setProperty('--bg-primary', t.bg);

  // theme-color para la barra del navegador / PWA
  var meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = t.bg;
  document.head.appendChild(meta);
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