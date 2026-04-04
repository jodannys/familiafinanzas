'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'

export default function CustomSelect({ value, onChange, options, placeholder = '— Seleccionar —', color }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)
  const selected = options.filter(o => !o.header).find(o => o.id === value)
  const accent = color || 'var(--accent-main)'

  function openDropdown() {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropH = Math.min(240, options.length * 40)
    const top = spaceBelow < dropH && rect.top > dropH
      ? rect.top - dropH - 4
      : rect.bottom + 4
    setCoords({ top, left: rect.left, width: rect.width })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [open])

  // Reposiciona al hacer scroll; solo cierra si el trigger sale del viewport
  useEffect(() => {
    if (!open) return
    function handleScroll() {
      if (!triggerRef.current) { setOpen(false); return }
      const rect = triggerRef.current.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return }
      const spaceBelow = window.innerHeight - rect.bottom
      const dropH = Math.min(240, options.filter(o => !o.header).length * 42 + 44)
      const top = spaceBelow < dropH && rect.top > dropH
        ? rect.top - dropH - 4
        : rect.bottom + 4
      setCoords({ top, left: rect.left, width: rect.width })
    }
    window.addEventListener('scroll', handleScroll, true)
    return () => window.removeEventListener('scroll', handleScroll, true)
  }, [open, options])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => open ? setOpen(false) : openDropdown()}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
          background: selected ? `color-mix(in srgb, ${accent} 8%, var(--bg-secondary))` : 'var(--bg-secondary)',
          border: `1px solid ${selected ? accent : 'var(--border-subtle)'}`,
          color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
          fontWeight: selected ? 600 : 400, fontSize: 12,
          transition: 'all 0.12s',
        }}
      >
        {selected?.dot && (
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.dot, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        {selected?.sub && (
          <span style={{ fontSize: 10, color: accent, opacity: 0.8, flexShrink: 0 }}>{selected.sub}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" style={{
          flexShrink: 0, opacity: 0.4,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.15s',
        }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            zIndex: 99999,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 14,
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false) }}
            style={{
              width: '100%', padding: '10px 14px', textAlign: 'left',
              background: !value ? 'var(--bg-secondary)' : 'transparent',
              border: 'none', borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
            }}
          >{placeholder}</button>

          {options.map((o, i) => {
            if (o.header) return (
              <div key={`h-${i}`} style={{
                padding: '6px 14px 4px',
                fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'var(--text-muted)',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
              }}>{o.label}</div>
            )
            const isSel = o.id === value
            return (
              <button
                type="button"
                key={o.id}
                onClick={() => { onChange(o.id); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', textAlign: 'left', cursor: 'pointer', border: 'none',
                  borderBottom: i < options.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  background: isSel ? `color-mix(in srgb, ${accent} 10%, var(--bg-secondary))` : 'transparent',
                  color: isSel ? accent : 'var(--text-primary)',
                  fontWeight: isSel ? 700 : 400, fontSize: 12,
                  transition: 'background 0.1s',
                }}
              >
                {o.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: o.dot, flexShrink: 0 }} />}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {o.sub && <span style={{ fontSize: 10, opacity: 0.5, flexShrink: 0 }}>{o.sub}</span>}
                {isSel && <Check size={13} style={{ color: accent, flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
