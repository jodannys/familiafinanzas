'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp,
  CreditCard, Wallet, BarChart3, LogOut, Coins, ChevronRight
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'

const NAV = [
  { href: '/',            label: 'Dashboard',          icon: LayoutDashboard, color: '#4A6FA5' },
  { href: '/gastos',      label: 'Ingresos & Egresos',  icon: ArrowLeftRight,  color: '#7A5FA5' },
  { href: '/sobres',      label: 'Sobres Diarios',      icon: Wallet,          color: '#2D7A5F' },
  { href: '/metas',       label: 'Metas de Ahorro',     icon: Target,          color: '#C17A3A' },
  { href: '/inversiones', label: 'Inversiones',         icon: TrendingUp,      color: '#2D7A5F' },
  { href: '/deudas',      label: 'Deudas',              icon: CreditCard,      color: '#C0605A' },
  { href: '/reportes',    label: 'Reportes',            icon: BarChart3,       color: '#4A6FA5' },
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()

  return (
    <aside className="h-full w-64 flex flex-col"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)', boxShadow: '2px 0 16px rgba(0,0,0,0.06)' }}>

      {/* Logo */}
      <div className="px-6 py-7 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <Coins size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm leading-tight" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Familia</p>
          <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--accent-green)' }}>FINANZAS</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, color }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12,
                textDecoration: 'none', fontSize: 14, fontWeight: 500,
                transition: 'all 0.15s',
                background: active ? `${color}10` : 'transparent',
                color: active ? color : 'var(--text-secondary)',
                borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
              }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? `${color}18` : 'var(--bg-secondary)',
              }}>
                <Icon size={15} style={{ color: active ? color : 'var(--text-muted)' }} />
              </div>
              <span style={{ flex: 1 }}>{label}</span>
              {active && <ChevronRight size={13} style={{ color }} />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))' }}>
            FF
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Cuenta Familiar</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>2 miembros</p>
          </div>
        </div>

        <ThemeSwitcher />

        <button className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
