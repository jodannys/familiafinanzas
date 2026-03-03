'use client'
import { useState } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import { Menu } from 'lucide-react'

export default function AppShell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — oculto en móvil, visible en desktop */}
      <div className={`
        fixed left-0 top-0 h-full z-40 transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <main className="flex-1 min-h-screen lg:ml-64">

        {/* Header móvil con hamburguesa — CORREGIDO */}
        {/* Header móvil con z-index más alto y sin bordes */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-4 sticky top-0 z-50"
          style={{
            background: 'var(--bg-primary)',
            border: 'none',
            boxShadow: 'none',
            // Esto asegura que el color beige cubra incluso detrás de la hora
            paddingTop: 'env(safe-area-inset-top)'
          }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              width: 40, height: 40, borderRadius: 12,
              border: 'none', // <--- QUITA LA LÍNEA GRIS AQUÍ
              background: 'var(--bg-card)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)' // Sombra suave en lugar de borde gris
            }}>
            <Menu size={18} style={{ color: 'var(--text-primary)' }} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <img src="/icon.svg" alt="Logo" style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Finanzas Personales
            </span>
          </div>
        </div>
        {/* Background decorativo */}
        <div className="fixed inset-0 lg:ml-64 pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-10%', right: '0',
            width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(193,122,58,0.05) 0%, transparent 70%)',
          }} />
        </div>

        <div className="relative z-10 p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}