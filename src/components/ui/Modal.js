'use client'
import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    // z-[9999] garantiza que supera sidebar (z-40) y header (z-50) del AppShell
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">

      {/* Overlay */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(44,32,22,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Panel flotante centrado */}
      <div
        className={`relative w-full rounded-2xl animate-enter ${sizes[size]}`}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid #E4D9CE',
          boxShadow: '0 20px 60px rgba(100,70,30,0.22)',
          maxHeight: '90dvh',
          display: 'flex',
          flexDirection: 'column',
        }}>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #F0E9DF' }}>
          <h3 className="text-base font-black" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-primary)', border: '1px solid #E4D9CE', cursor: 'pointer',
            }}>
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Contenido — scrolleable */}
        <div className="overflow-y-auto flex-1" style={{ padding: '24px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}