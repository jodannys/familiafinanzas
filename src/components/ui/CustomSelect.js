'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'

export default function CustomSelect({ value, onChange, options, placeholder = '— Seleccionar —', color }) {
  const [open, setOpen]       = useState(false)
  const [coords, setCoords]   = useState({ top: 0, left: 0, width: 0 })
  const [hovered, setHovered] = useState(null)
  const triggerRef    = useRef(null)
  const dropdownRef   = useRef(null)
  const selectedRef   = useRef(null)
  const selected = options.filter(o => !o.header).find(o => o.id === value)
  const accent   = color || 'var(--accent-main)'

  function calcCoords() {
    if (!triggerRef.current) return null
    const rect       = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropH      = Math.min(240, options.filter(o => !o.header).length * 42 + 44)
    const top        = spaceBelow < dropH && rect.top > dropH
      ? rect.top - dropH - 4
      : rect.bottom + 4
    // Clamp left para no salirse de pantalla en móvil
    const vw    = window.innerWidth
    const left  = Math.max(8, Math.min(rect.left, vw - rect.width - 8))
    return { top, left, width: rect.width }
  }

  function openDropdown() {
    const c = calcCoords()
    if (!c) return
    setCoords(c)
    setOpen(true)
  }

  // Scroll al item seleccionado al abrir
  useEffect(() => {
    if (open && selectedRef.current) {
      setTimeout(() => selectedRef.current?.scrollIntoView({ block: 'nearest' }), 0)
    }
  }, [open])

  // Cerrar al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) setOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  // Reposicionar al hacer scroll
  useEffect(() => {
    if (!open) return
    function handleScroll() {
      if (!triggerRef.current) { setOpen(false); return }
      const rect = triggerRef.current.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return }
      const c = calcCoords()
      if (c) setCoords(c)
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
          border: `1px solid ${selected ? accent : 'var(--border-subtle, color-mix(in srgb, var(--text-muted) 20%, transparent))'}`,
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
            border: '1px solid var(--border-subtle, color-mix(in srgb, var(--text-muted) 20%, transparent))',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            maxHeight: 240,
          }}
        >
          <div style={{ overflowY: 'auto', maxHeight: 240 }}>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false) }}
              onMouseEnter={() => setHovered('__placeholder__')}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: '100%', padding: '10px 14px', textAlign: 'left',
                background: hovered === '__placeholder__'
                  ? 'var(--bg-secondary)'
                  : !value ? 'var(--bg-secondary)' : 'transparent',
                border: 'none', borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)',
                color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                transition: 'background 0.1s',
              }}
            >{placeholder}</button>

            {options.map((o, i) => {
              if (o.header) return (
                <div key={`h-${i}`} style={{
                  padding: '6px 14px 4px',
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'var(--text-muted)',
                  borderBottom: '1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)',
                  background: 'var(--bg-secondary)',
                }}>{o.label}</div>
              )
              const isSel = o.id === value
              return (
                <button
                  type="button"
                  key={o.id}
                  ref={isSel ? selectedRef : null}
                  onClick={() => { onChange(o.id); setOpen(false) }}
                  onMouseEnter={() => setHovered(o.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', textAlign: 'left', cursor: 'pointer', border: 'none',
                    borderBottom: i < options.length - 1
                      ? '1px solid color-mix(in srgb, var(--text-muted) 15%, transparent)'
                      : 'none',
                    background: isSel
                      ? `color-mix(in srgb, ${accent} 12%, var(--bg-secondary))`
                      : hovered === o.id
                      ? 'var(--bg-secondary)'
                      : 'transparent',
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
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
