'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'var(--accent-blue)' },
      { href: '/reportes', label: 'Reporte Anual', icon: BarChart3, color: 'var(--accent-violet)' },
    ]
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart, color: 'var(--accent-green)' },
      { href: '/gastos', label: 'Registro', icon: ArrowLeftRight, color: 'var(--accent-terra)' },
      { href: '/sobres', label: 'Sobres', icon: Wallet, color: '#06b6d4' },
    ]
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas', label: 'Ahorro', icon: Target, color: '#ec4899' },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp, color: 'var(--accent-green)' },
      { href: '/deudas', label: 'Deudas', icon: CreditCard, color: '#ef4444' },
    ]
  }
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()

  return (
    <aside className="h-full w-20 flex flex-col items-center py-8 shadow-2xl lg:shadow-none"
      style={{
        /* COLOR SÓLIDO: Usamos el fondo de tarjeta para que pegue con el tema */
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border-glass)',
        zIndex: 100
      }}>

      {/* Navegación */}
      <nav className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center">
        <div className="w-full flex flex-col items-center gap-4">
          {MENU_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="w-full flex flex-col items-center gap-4 relative">
              {gIdx > 0 && (
                <div className="w-6 h-px mb-1" style={{ background: 'var(--border-glass)' }} />
              )}
              {group.items.map(({ href, label, icon: Icon, color }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} onClick={onClose}
                    className="group relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200"
                    style={{
                      background: active
                        ? 'var(--text-primary)'
                        : 'transparent',
                      color: active
                        ? 'var(--bg-primary)'
                        : 'var(--text-muted)',
                      border: active
                        ? '1px solid transparent'
                        : '1px solid transparent',
                    }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.background = 'var(--bg-secondary)'
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.5 : 1.8}
                      className="transition-transform duration-200 group-hover:scale-110"
                    />
                    <span className="hidden lg:block absolute left-[3.5rem] scale-0 group-hover:scale-100 transition-all z-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white pointer-events-none shadow-2xl whitespace-nowrap"
                      style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {label}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-6 flex flex-col items-center gap-6 w-full">
        <ThemeSwitcher />

        <button
          onClick={() => { }}
          className="w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-200"
          style={{
            color: 'var(--accent-rose)',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.1)'
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}