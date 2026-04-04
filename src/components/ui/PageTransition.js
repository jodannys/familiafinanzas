'use client'
import { usePathname } from 'next/navigation'

/**
 * Wrapper de transición de página.
 * Usa `key={pathname}` para forzar remount en cada navegación,
 * lo que dispara la animación CSS `animate-enter` automáticamente.
 */
export default function PageTransition({ children }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-enter">
      {children}
    </div>
  )
}
