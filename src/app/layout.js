import './globals.css'
import { ThemeProvider } from '@/lib/themes'

export const metadata = {
  title: 'Familia Finanzas',
  description: 'Gestión financiera familiar inteligente',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
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
  themeColor: '#F7F3EE',
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        
        {/* 2. ESTA LÍNEA ES LA QUE QUITA EL VERDE DE ARRIBA */}
        <meta name="theme-color" content="#F7F3EE" />
        
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Familia Finanzas" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}