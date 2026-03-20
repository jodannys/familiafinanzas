'use client'
import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { THEMES, useTheme } from '@/lib/themes'

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      {/* Botón Circular Compacto */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Cambiar tema"
        className="group transition-all active:scale-90 flex items-center justify-center"
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden'
        }}>

        {/* Mini previa de colores en el botón */}
        <div className="grid grid-cols-2 gap-0.5 p-1 transition-transform group-hover:rotate-12">
          {THEMES[theme].preview.slice(0, 4).map((c, i) => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: 2, background: c }} />
          ))}
        </div>

        {/* Icono de paleta flotante pequeño */}
        <div className="absolute bottom-1 right-1 bg-[var(--bg-card)] rounded-full p-0.5 shadow-sm border border-[var(--border-glass)]">
          <Palette size={8} className="text-[var(--text-muted)]" />
        </div>
      </button>

      {/* Dropdown Desplegable */}
      {open && (
        <>
          {/* Backdrop invisible para cerrar */}
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setOpen(false)}
          />

          {/* Panel de Selección - Posicionado a la derecha del sidebar */}
          <div
            style={{
              position: 'fixed',           // fixed en vez de absolute para no salirse
              bottom: 80,
              left: 88,                    // ancho del sidebar (w-20 = 80px) + gap
              width: 180,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              borderRadius: 20,
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              zIndex: 101,
              padding: 6,
              backdropFilter: 'blur(12px)',
            }}>
            <p className="px-3 py-2 text-[9px] font-black uppercase tracking-widest opacity-40">
              Temas
            </p>

            <div className="flex flex-col gap-1">
              {Object.entries(THEMES).map(([key, t]) => {
                const active = theme === key
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setTheme(key);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 w-full p-2.5 rounded-xl transition-colors hover:bg-[var(--bg-secondary)]"
                    style={{
                      background: active ? 'var(--bg-secondary)' : 'transparent',
                    }}>

                    {/* Círculo de color */}
                    <div style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: t.preview[0],
                      border: '2px solid var(--border-glass)',
                      flexShrink: 0
                    }} />

                    <span className="flex-1 text-left text-[12px] font-semibold"
                      style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {t.name}
                    </span>

                    {active && (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: 'var(--accent-green)' }}>
                        <Check size={10} color="white" strokeWidth={4} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}