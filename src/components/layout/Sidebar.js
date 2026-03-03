'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, Coins, ChevronRight
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: '#4A6FA5' },
  { href: '/presupuesto', label: 'Mi Presupuesto', icon: PieChart, color: '#2D7A5F' },
  { href: '/gastos', label: 'Ingresos & Egresos', icon: ArrowLeftRight, color: '#7A5FA5' },
  { href: '/sobres', label: 'Sobres Diarios', icon: Wallet, color: '#2D7A5F' },
  { href: '/metas', label: 'Metas de Ahorro', icon: Target, color: '#C17A3A' },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp, color: '#2D7A5F' },
  { href: '/deudas', label: 'Deudas', icon: CreditCard, color: '#C0605A' },
  { href: '/reportes', label: 'Reportes', icon: BarChart3, color: '#4A6FA5' },
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()

  return (
    <aside className="h-full w-64 flex flex-col"
      style={{ background: 'var(--sidebar-bg)', borderRight: 'none', boxShadow: '2px 0 16px rgba(0,0,0,0.06)' }}>

      {/* Logo */}
      <div className="px-6 py-7 flex items-center gap-3" style={{ borderBottom: 'none' }}>
        <img src="/icon.svg" alt="Familia Finanzas" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
        <div>
          <p className="text-sm leading-tight" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Familia</p>
          <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--accent-green)' }}>Quintero Brito</p>
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
      <div className="p-4" style={{ borderTop: 'none' }}>
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
          style={{
            color: 'var(--accent-rose)', // <--- Cambiado a rosa/rojo para que se vea como acción de salida
            background: 'rgba(192, 96, 90, 0.05)',
            border: 'none',
            cursor: 'pointer',
            marginTop: '8px'
          }}>
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}