'use client'
import { ThemeProvider } from '@/lib/themes'
import { CurrencyProvider } from '@/lib/CurrencyContext'

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <CurrencyProvider>
        {children}
      </CurrencyProvider>
    </ThemeProvider>
  )
}