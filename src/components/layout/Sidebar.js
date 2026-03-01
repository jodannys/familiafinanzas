'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp,
  CreditCard, Wallet, BarChart3, LogOut, Coins, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/',            label: 'Dashboard',    icon: LayoutDashboard, color: 'text-sky-400' },
  { href: '/gastos',      label: 'Ingresos & Egresos', icon: ArrowLeftRight, color: 'text-violet-400' },
  { href: '/sobres',      label: 'Sobres Diarios', icon: Wallet,          color: 'text-emerald-400' },
  { href: '/metas',       label: 'Metas de Ahorro', icon: Target,         color: 'text-gold-400' },
  { href: '/inversiones', label: 'Inversiones',   icon: TrendingUp,      color: 'text-emerald-400' },
  { href: '/deudas',      label: 'Deudas',        icon: CreditCard,      color: 'text-rose-400' },
  { href: '/reportes',    label: 'Reportes',      icon: BarChart3,       color: 'text-sky-400' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-40"
      style={{ background: 'linear-gradient(180deg, #0d1526 0%, #0a0f1e 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo */}
      <div className="px-6 py-7 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 0 20px rgba(16,185,129,0.4)' }}>
          <Coins size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-800 text-white leading-tight" style={{ fontWeight: 800 }}>Familia</p>
          <p className="text-xs text-emerald-400 font-semibold tracking-wider">FINANZAS</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon, color }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'bg-white/8 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}>
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200',
                active ? 'bg-white/10' : 'bg-white/5 group-hover:bg-white/10'
              )}>
                <Icon size={16} className={active ? color : 'text-slate-500 group-hover:' + color.split('-')[1]} />
              </div>
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-slate-600" />}
            </Link>
          )
        })}
      </nav>

      {/* User / Month indicator */}
      <div className="p-4 m-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #10b981, #0ea5e9)' }}>
            FF
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Cuenta Familiar</p>
            <p className="text-xs text-slate-500">2 miembros</p>
          </div>
        </div>
        <button className="w-full flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5">
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
