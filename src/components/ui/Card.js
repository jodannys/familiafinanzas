import { cn } from '@/lib/utils'

export function Card({ children, className, glow, ...props }) {
  return (
    <div
      className={cn(
        'glass-card p-6 transition-all duration-300',
        glow === 'green' && 'glow-green',
        glow === 'gold' && 'glow-gold',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function StatCard({ label, value, sub, icon: Icon, color = '#10b981', delta, className }) {
  const isPositive = delta === undefined ? true : delta >= 0
  return (
    <div className={cn('glass-card p-5 animate-enter', className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          {Icon && <Icon size={18} style={{ color }} />}
        </div>
        {delta !== undefined && (
          <span className={cn(
            'text-xs font-semibold px-2 py-1 rounded-lg',
            isPositive ? 'text-emerald-400 bg-emerald-400/10' : 'text-rose-400 bg-rose-400/10'
          )}>
            {isPositive ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-white mb-1" style={{ letterSpacing: '-0.02em' }}>{value}</p>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

export function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-white" style={{ letterSpacing: '-0.02em' }}>{title}</h2>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Badge({ children, color = 'emerald', className }) {
  const colors = {
    emerald: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    gold:    'bg-amber-400/10 text-amber-400 border-amber-400/20',
    rose:    'bg-rose-400/10 text-rose-400 border-rose-400/20',
    sky:     'bg-sky-400/10 text-sky-400 border-sky-400/20',
    violet:  'bg-violet-400/10 text-violet-400 border-violet-400/20',
    orange:  'bg-orange-400/10 text-orange-400 border-orange-400/20',
    slate:   'bg-slate-400/10 text-slate-400 border-slate-400/20',
  }
  return (
    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-lg border', colors[color] || colors.emerald, className)}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, max, color = '#10b981', className }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className={cn('w-full h-2 rounded-full bg-white/8', className)}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }} />
    </div>
  )
}
