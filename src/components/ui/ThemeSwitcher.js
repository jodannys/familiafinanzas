'use client'
import { useState } from 'react'
import { Palette, Check } from 'lucide-react'
import { THEMES, useTheme } from '@/lib/themes'

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
console.log('Tema actual:', theme)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-secondary)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          marginBottom: 8,
        }}>
        {/* Preview dots */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {THEMES[theme].preview.slice(0, 3).map((c, i) => (
            <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
          ))}
        </div>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left' }}>
          {THEMES[theme].name}
        </span>
        <Palette size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: 14,
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            zIndex: 50,
            overflow: 'hidden',
            padding: 6,
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 10px 8px' }}>
              Seleccionar tema
            </p>
            {Object.entries(THEMES).map(([key, t]) => {
              const active = theme === key
              return (
                <button
                  key={key}
                  onClick={() => { console.log('Tema seleccionado:', key); setTheme(key); setOpen(false) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 10px',
                    borderRadius: 10,
                    border: 'none',
                    background: active ? 'var(--bg-secondary)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}>
                  {/* Color preview */}
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    {t.preview.map((c, i) => (
                      <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: '1px solid rgba(0,0,0,0.1)' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>
                    {t.emoji} {t.name}
                  </span>
                  {active && <Check size={13} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
