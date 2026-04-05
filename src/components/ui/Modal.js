'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)

  // Sync open → visible, with leave animation on close
  useEffect(() => {
    if (open) {
      setClosing(false)
      setVisible(true)
    } else if (visible) {
      setClosing(true)
      const t = setTimeout(() => {
        setClosing(false)
        setVisible(false)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (visible) {
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
    }
    return () => { document.documentElement.style.overflow = '' }
  }, [visible])

  useEffect(() => {
    if (!visible || !onClose) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [visible, onClose])

  if (!visible) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col justify-center items-center"
      style={{
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
      }}
    >

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'color-mix(in srgb, var(--bg-dark-card), transparent 55%)',
          backdropFilter: 'blur(4px)',
          animation: closing ? 'overlay-out 0.2s ease forwards' : 'overlay-in 0.3s ease forwards',
        }}
        onClick={onClose}
      />

      {/* Panel — overflow:hidden contiene la scrollbar dentro del border-radius */}
      <div
        className={`ff-sheet relative w-full ${closing ? 'animate-leave' : 'animate-enter'} ${sizes[size]}`}
        style={{
          maxHeight:     'min(88dvh, calc(100dvh - max(32px, env(safe-area-inset-top) + env(safe-area-inset-bottom) + 32px)))',
          display:       'flex',
          flexDirection: 'column',
        }}
      >

        {/* Handle móvil */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-subtle)' }} />
        </div>

        {/* Header — no scrollea */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              letterSpacing: '0.01em',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {title}
          </p>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width:          32,
                height:         32,
                borderRadius:   10,
                flexShrink:     0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     'var(--bg-secondary)',
                border:         'none',
                cursor:         'pointer',
              }}
            >
              <X size={16} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {/* Contenido scrollable — scrollbar queda dentro del border-radius */}
        <div className="custom-scroll flex-1" style={{ overflowY: 'auto', padding: '24px 24px 32px' }}>
          {children}
        </div>

      </div>
    </div>,
    document.body
  )
}
