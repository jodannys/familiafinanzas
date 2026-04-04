'use client'
import { LogOut, X } from 'lucide-react'

export default function ConfirmLogoutModal({ open, onCancel, onConfirm }) {
  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
    }}>
      {/* Clic fuera cancela */}
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0 }} />

      <div className="animate-enter" style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 320,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        borderRadius: 28,
        padding: '28px 24px 24px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>

        {/* Botón cerrar */}
        <button onClick={onCancel} style={{
          position: 'absolute', top: 14, right: 14,
          width: 28, height: 28, borderRadius: 8, border: 'none',
          background: 'var(--bg-secondary)', color: 'var(--text-muted)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <X size={13} />
        </button>

        {/* Ícono */}
        <div style={{
          width: 52, height: 52, borderRadius: '50%', marginBottom: 16,
          background: 'color-mix(in srgb, var(--accent-rose) 12%, var(--bg-secondary))',
          border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LogOut size={20} style={{ color: 'var(--accent-rose)' }} />
        </div>

        {/* Texto */}
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, textAlign: 'center' }}>
          ¿Cerrar sesión?
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, textAlign: 'center', lineHeight: 1.5 }}>
          Tendrás que volver a iniciar sesión para acceder a tu cuenta.
        </p>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px 0', borderRadius: 14, border: 'none',
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: '11px 0', borderRadius: 14, border: 'none',
            background: 'color-mix(in srgb, var(--accent-rose) 14%, var(--bg-secondary))',
            color: 'var(--accent-rose)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>
            Cerrar sesión
          </button>
        </div>

      </div>
    </div>
  )
}
