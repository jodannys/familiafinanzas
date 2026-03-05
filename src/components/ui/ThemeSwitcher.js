'use client'
import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { THEMES, useTheme } from '@/lib/themes'

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative w-full">
      {/* Trigger button - Más alto para móvil */}
      <button
        onClick={() => setOpen(o => !o)}
        className="transition-all active:scale-[0.98]"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px', // Más espacio para el pulgar
          borderRadius: 14,
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          marginBottom: 8,
        }}>
        
        {/* Preview dots - Un poco más grandes */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {THEMES[theme].preview.slice(0, 3).map((c, i) => (
            <div key={i} style={{ 
              width: 12, 
              height: 12, 
              borderRadius: '50%', 
              background: c, 
              border: '1.5px solid rgba(0,0,0,0.05)' 
            }} />
          ))}
        </div>

        <span style={{ 
          flex: 1, 
          fontSize: 14, // Fuente más legible
          fontWeight: 700, 
          color: 'var(--text-primary)', 
          textAlign: 'left' 
        }}>
          {THEMES[theme].name}
        </span>
        <Palette size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop - Cubre toda la pantalla para cerrar al tocar fuera */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setOpen(false)} 
            style={{ background: 'transparent' }}
          />

          {/* Panel - Animado y con sombra dinámica */}
          <div 
            className="animate-enter"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              borderRadius: 18,
              boxShadow: '0 12px 40px var(--shadow-color)',
              zIndex: 101,
              overflow: 'hidden',
              padding: 8,
            }}>
            
            <p style={{ 
              fontSize: 10, 
              fontWeight: 800, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.1em', 
              padding: '8px 12px 10px' 
            }}>
              Temas - App
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
                    className="transition-colors"
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 12px', // Altura cómoda para tocar
                      borderRadius: 12,
                      border: 'none',
                      background: active ? 'var(--bg-secondary)' : 'transparent',
                      cursor: 'pointer',
                    }}>
                    
                    {/* Color preview circle */}
                    <div style={{ 
                      width: 20, 
                      height: 20, 
                      borderRadius: '50%', 
                      background: t.preview[0], // Color principal del tema
                      border: '2px solid var(--border-glass)',
                      flexShrink: 0 
                    }} />

                    <span style={{ 
                      fontSize: 14, 
                      fontWeight: active ? 700 : 500, 
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)', 
                      flex: 1, 
                      textAlign: 'left' 
                    }}>
                      {t.emoji} {t.name}
                    </span>

                    {active && (
                      <div style={{
                        background: 'var(--accent-green)',
                        borderRadius: '50%',
                        padding: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
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