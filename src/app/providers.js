'use client'
import { ThemeProvider } from '@/lib/themes'

export default function Providers({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>
}