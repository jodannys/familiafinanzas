'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'

/**
 * Modal de confirmación con estilo propio — reemplaza window.confirm().
 * Uso: const { confirmProps, showConfirm } = useConfirm()
 *      showConfirm('¿Eliminar esto?', () => handleDelete(id))
 *      <ConfirmDialog {...confirmProps} />
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, message: '', onConfirm: null })

  function showConfirm(message, onConfirm) {
    setState({ open: true, message, onConfirm })
  }

  function handleConfirm() {
    state.onConfirm?.()
    setState({ open: false, message: '', onConfirm: null })
  }

  function handleCancel() {
    setState({ open: false, message: '', onConfirm: null })
  }

  return {
    confirmProps: { open: state.open, message: state.message, onConfirm: handleConfirm, onCancel: handleCancel },
    showConfirm,
  }
}

export default function ConfirmDialog({ open, message, onConfirm, onCancel, labelConfirm = 'Eliminar', labelCancel = 'Cancelar' }) {
  useEffect(() => {
    if (!open) return
    // Bloquear scroll del body y compensar el ancho del scrollbar para evitar layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'color-mix(in srgb, var(--bg-dark-card), transparent 50%)', backdropFilter: 'blur(4px)' }}
        onClick={onCancel}
      />
      <div
        className="relative w-full max-w-xs animate-enter"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-glass)',
          borderRadius: 20,
          padding: '28px 24px 24px',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Icono */}
        <div className="flex justify-center mb-4">
          <div style={{
            width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
          }}>
            <Trash2 size={22} style={{ color: 'var(--accent-rose)' }} />
          </div>
        </div>

        {/* Mensaje */}
        <p style={{
          textAlign: 'center', fontSize: 14, fontWeight: 600, lineHeight: 1.5,
          color: 'var(--text-primary)', marginBottom: 20,
        }}>
          {message}
        </p>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, border: '1px solid var(--border-glass)',
              background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {labelCancel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '11px 0', borderRadius: 12, border: 'none',
              background: 'var(--accent-rose)', color: 'var(--text-on-dark)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {labelConfirm}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
