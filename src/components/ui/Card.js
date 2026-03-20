import { cn } from '@/lib/utils'

// Mapa de acentos para que coincidan con tus variables de globals.css
const ACCENT_MAP = {
  green: 'var(--accent-green)',
  gold: 'var(--accent-gold)',
  terra: 'var(--accent-terra)',
  rose: 'var(--accent-rose)',
  blue: 'var(--accent-blue)',
  violet: 'var(--accent-violet)',
}

export function Card({ children, className, glow, ...props }) {
  // Sombra dinámica basada en la variable del tema
  const shadowColor = glow ? ACCENT_MAP[glow] : null
  const shadowStyle = shadowColor 
    ? { boxShadow: `0 8px 24px color-mix(in srgb, ${shadowColor}, transparent 86%)` } 
    : undefined

  return (
    <div
      className={cn('glass-card p-6 transition-all duration-300', className)}
      style={shadowStyle}
      {...props}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = 'var(--accent-green)', delta, className }) {
  const isPositive = delta === undefined ? true : delta >= 0
  const statusColor = isPositive ? 'var(--accent-green)' : 'var(--accent-rose)'

  return (
    <div className={cn('glass-card p-5 animate-enter', className)}>
      <div className="flex items-start justify-between mb-4">
        {/* Fondo del icono dinámico con color-mix */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ 
            background: `color-mix(in srgb, ${color}, transparent 90%)`, 
            border: `1px solid color-mix(in srgb, ${color}, transparent 80%)` 
          }}>
          {Icon && <Icon size={18} style={{ color }} />}
        </div>
        
        {delta !== undefined && (
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
            style={{
              color: statusColor,
              background: `color-mix(in srgb, ${statusColor}, transparent 92%)`,
              borderColor: `color-mix(in srgb, ${statusColor}, transparent 85%)`,
            }}>
            {isPositive ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</p>
      <p className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

export function Badge({ children, color = 'green', className }) {
  const c = ACCENT_MAP[color] || 'var(--accent-green)'
  
  return (
    <span className={cn('text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wider', className)}
      style={{ 
        background: `color-mix(in srgb, ${c}, transparent 90%)`, 
        color: c, 
        borderColor: `color-mix(in srgb, ${c}, transparent 80%)` 
      }}>
      {children}
    </span>
  )
}

// FIX 1 y 2: ProgressBar robusto
export function ProgressBar({ value, max, color = 'var(--accent-green)', className }) {
  // FIX 1: evitar división por cero
  // FIX 2: evitar porcentaje negativo
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0

  return (
    <div className={cn('w-full h-2 rounded-full overflow-hidden', className)}
         style={{ background: 'var(--progress-track)' }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color}, white 20%))`,
        }} />
    </div>
  )
}