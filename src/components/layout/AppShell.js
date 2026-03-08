'use client'
import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { Menu } from 'lucide-react'
import { usePathname } from 'next/navigation'
// cada vez que cambia pathname → mostrar spinner breve

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* Overlay móvil - Solo oscurece un poco para dar contraste */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden"
          style={{
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)'
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Contenedor Fijo */}
      <div className={`
        fixed left-0 top-0 h-full z-[70] transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 w-20
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content - SIN EFECTOS DE ESCALA O TRANSPARENCIA */}
      <main className="flex-1 min-h-screen lg:ml-20 flex flex-col transition-all duration-300"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div
          className="lg:hidden"
          style={{
            height: 'env(safe-area-inset-top)',
            background: 'var(--bg-primary)',
            position: 'sticky',
            top: 0,
            zIndex: 51,
          }}
        />
        {/* Header móvil */}
        <div className="lg:hidden flex items-center gap-3 px-5 sticky top-0 z-50 w-full"
          // En el div del header móvil, cambia el style a:
          style={{
            background: 'var(--bg-primary)',
            borderBottom: '1px solid transparent', // ← evita el corte visual
            paddingTop: 'calc(env(safe-area-inset-top) + 1rem)',
            paddingBottom: '1rem',
          }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center justify-center active:scale-95 transition-all"
            style={{
              width: 42, height: 42, borderRadius: 14,
              border: '1px solid var(--border-glass)',
              background: 'var(--bg-card)',
            }}>
            <Menu size={20} style={{ color: 'var(--text-primary)' }} />
          </button>

          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
            <span className="font-black text-base tracking-tighter" style={{ color: 'var(--text-primary)' }}>
              Familia Finanzas
            </span>
          </div>
        </div>

        {/* Background decorativo */}
        <div className="fixed inset-0 lg:ml-20 pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-5%', right: '-5%',
            width: '600px', height: '600px',
            background: 'radial-gradient(circle, var(--accent-main) 0%, transparent 70%)',
            opacity: 0.07
          }} />
        </div>

        {/* Contenido Real */}
        <div className="relative z-10 p-4 md:p-10 lg:p-12 max-w-[1600px] mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}