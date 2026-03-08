'use client'
import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { Menu } from 'lucide-react'

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* Overlay móvil - Ahora con un desenfoque más elegante */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-[60] lg:hidden" // Subimos z-index para estar sobre todo
          style={{ 
            background: 'rgba(0,0,0,0.2)', 
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)' 
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Contenedor con ancho fijo */}
      <div className={`
        fixed left-0 top-0 h-full z-[70] transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 w-20
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content - Ajuste de margen y transición */}
     <main 
  className={`flex-1 min-h-screen lg:ml-20 transition-all duration-500 ease-in-out flex flex-col
    ${sidebarOpen ? 'scale-[0.96] opacity-50 rounded-[32px] overflow-hidden' : 'scale-100 opacity-100'}
  `}
  style={{ 
    background: 'var(--bg-primary)',
    transformOrigin: 'left center' // Hace que se encoja hacia la derecha
  }}
>
  {/* Header móvil */}
  <div className="lg:hidden flex items-center gap-3 px-5 sticky top-0 z-50 w-full"
    style={{
      background: 'var(--bg-primary)',
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
      {/* CORRECCIÓN: Color dinámico basado en el tema */}
      <Menu size={20} style={{ color: 'var(--text-primary)' }} />
    </button>

    <div className="flex items-center gap-2">
      <img src="/icon.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
      <span className="font-black text-base tracking-tighter" style={{ color: 'var(--text-primary)' }}>
        Familia Finanzas
      </span>
    </div>
  </div>

        {/* Background decorativo - Movido ligeramente para que no choque con el menú */}
        <div className="fixed inset-0 lg:ml-20 pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-5%', right: '-5%',
            width: '600px', height: '600px',
            background: 'radial-gradient(circle, var(--accent-main) 0%, transparent 70%)',
            opacity: 0.07
          }} />
        </div>

        {/* Contenido Real - Centrado y con padding extra en móvil */}
        <div className="relative z-10 p-4 md:p-10 lg:p-12 max-w-[1600px] mx-auto w-full flex-1">
          {children}
        </div>
      </main>
    </div>
  )
}