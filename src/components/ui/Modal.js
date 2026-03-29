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
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
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
    <div className="fixed inset-0 z-[9999] flex flex-col justify-center items-center p-4"
      style={{ opacity: closing ? undefined : undefined }}>

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

      {/* Panel */}
      <div
        className={`relative w-full sm:rounded-2xl ${closing ? 'animate-leave' : 'animate-enter'} ${sizes[size]}`}
        style={{
          background:   'var(--bg-card)',
          border:       '1px solid var(--border-glass)',
          boxShadow:    'var(--shadow-xl)',
          borderRadius: '20px',
          maxHeight:    '92dvh',
          display:      'flex',
          flexDirection: 'column',
        }}
      >

        {/* Handle móvil */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-glass)' }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-glass)' }}
        >
          <h3
            className="text-base font-semibold"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            {title}
          </h3>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                width:        32,
                height:       32,
                borderRadius: 10,
                flexShrink:   0,
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                background:   'var(--bg-secondary)',
                border:       'none',
                cursor:       'pointer',
              }}
            >
              <X size={16} style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1" style={{ padding: '24px 24px 40px' }}>
          {children}
        </div>

      </div>
    </div>,
    document.body
  )
}
