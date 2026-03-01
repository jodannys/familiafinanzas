import './globals.css'
import Providers from './providers'

export const metadata = {
  title: 'Familia Finanzas',
  description: 'Gestión financiera familiar inteligente',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
