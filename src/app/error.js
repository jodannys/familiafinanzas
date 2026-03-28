'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    // Error ya manejado por el boundary — sin console.error
  }, [error])

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          background: 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
        }}
      >
        ⚠️
      </div>

      <p
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em',
          textAlign: 'center',
        }}
      >
        Algo salió mal
      </p>

      <p
        style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          textAlign: 'center',
          maxWidth: 280,
          lineHeight: 1.5,
        }}
      >
        Ocurrió un error inesperado. Intenta recargar la página.
      </p>

      <button
        onClick={reset}
        className="ff-btn-primary"
        style={{ marginTop: 8, paddingLeft: 28, paddingRight: 28 }}
      >
        Reintentar
      </button>
    </div>
  )
}
