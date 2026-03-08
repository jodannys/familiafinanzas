'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(44,32,22,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full sm:rounded-2xl animate-enter ${sizes[size]}`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid #E4D9CE',
          boxShadow: '0 -4px 40px rgba(100,70,30,0.15)',
          borderRadius: '20px 20px 0 0',
          maxHeight: '92dvh',
          display: 'flex',
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
          style={{ borderBottom: '1px solid #F0E9DF' }}
        >
          <h3
            className="text-base font-black"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-secondary)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
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