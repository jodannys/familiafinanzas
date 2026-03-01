import { cn } from '@/lib/utils'

export function Card({ children, className, glow, ...props }) {
  return (
    <div
      className={cn('glass-card p-6 transition-all duration-300', className)}
      style={glow === 'green' ? { boxShadow: '0 0 24px rgba(45,122,95,0.14)' } : glow === 'gold' ? { boxShadow: '0 0 24px rgba(193,122,58,0.14)' } : undefined}
      {...props}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = '#2D7A5F', delta, className }) {
  const isPositive = delta === undefined ? true : delta >= 0
  return (
    <div className={cn('glass-card p-5 animate-enter', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
          {Icon && <Icon size={18} style={{ color }} />}
        </div>
        {delta !== undefined && (
          <span className="text-xs font-semibold px-2 py-1 rounded-lg"
            style={{
              color: isPositive ? '#2D7A5F' : '#C0605A',
              background: isPositive ? 'rgba(45,122,95,0.1)' : 'rgba(192,96,90,0.1)',
            }}>
            {isPositive ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{title}</h2>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Badge({ children, color = 'green', className }) {
  const colors = {
    green:  { bg: 'rgba(45,122,95,0.1)',   text: '#2D7A5F',  border: 'rgba(45,122,95,0.2)'   },
    gold:   { bg: 'rgba(193,122,58,0.1)',  text: '#C17A3A',  border: 'rgba(193,122,58,0.2)'  },
    rose:   { bg: 'rgba(192,96,90,0.1)',   text: '#C0605A',  border: 'rgba(192,96,90,0.2)'   },
    sky:    { bg: 'rgba(74,111,165,0.1)',  text: '#4A6FA5',  border: 'rgba(74,111,165,0.2)'  },
    violet: { bg: 'rgba(122,95,165,0.1)',  text: '#7A5FA5',  border: 'rgba(122,95,165,0.2)'  },
    orange: { bg: 'rgba(193,122,58,0.1)',  text: '#C17A3A',  border: 'rgba(193,122,58,0.2)'  },
    slate:  { bg: 'rgba(181,165,146,0.15)', text: 'var(--text-secondary)', border: 'rgba(181,165,146,0.3)' },
    emerald:{ bg: 'rgba(45,122,95,0.1)',   text: '#2D7A5F',  border: 'rgba(45,122,95,0.2)'   },
  }
  const c = colors[color] || colors.green
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${className || ''}`}
      style={{ background: c.bg, color: c.text, borderColor: c.border }}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, max, color = '#2D7A5F', className }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className={`w-full h-2 rounded-full ${className || ''}`} style={{ background: 'var(--progress-track)' }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
    </div>
  )
}
