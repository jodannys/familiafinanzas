import Link from 'next/link'

export default function NotFound() {
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
          background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 26,
        }}
      >
        404
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
        Página no encontrada
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
        La página que buscas no existe o fue movida.
      </p>

      <Link
        href="/"
        className="ff-btn-primary"
        style={{ marginTop: 8, paddingLeft: 28, paddingRight: 28 }}
      >
        Volver al inicio
      </Link>
    </div>
  )
}
