'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, ReceiptText
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
      { href: '/sobres', label: 'Sobres', icon: Wallet, color: 'var(--accent-blue)' }, // Cambiado a variable
    ]
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas', label: 'Ahorro', icon: Target, color: 'var(--accent-rose)' }, // Cambiado a variable
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp, color: 'var(--accent-green)' },
      { href: '/deudas', label: 'Deudas', icon: ReceiptText, color: 'var(--accent-danger)' }, // Usando accent-danger para deudas
      { href: '/tarjetas', label: 'Mis Tarjetas', icon: CreditCard, color: 'var(--accent-gold)'},
    ]
  }
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()

  return (
    <aside className="h-full w-20 flex flex-col items-center py-8 shadow-2xl lg:shadow-none"
      style={{
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border-glass)',
        zIndex: 100
      }}>

      {/* Navegación con no-scrollbar para que sea invisible */}
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
                    title={label}
                    className="group relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200"
                    style={{
                      /* El fondo cuando está activo es el color de texto principal */
                      background: active ? 'var(--text-primary)' : 'transparent',
                      /* El icono toma su color asignado, o el color de fondo si está activo */
                      color: active ? 'var(--bg-card)' : color, 
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
                      strokeWidth={active ? 2.5 : 2}
                      className="transition-transform duration-200 group-hover:scale-110"
                    />
                    
                    {/* Tooltip Editorial */}
                    <span className="hidden lg:block absolute left-[3.5rem] scale-0 group-hover:scale-100 transition-all z-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white pointer-events-none shadow-2xl whitespace-nowrap"
                      style={{ background: 'var(--bg-dark-card)', border: '1px solid var(--border-glass)' }}>
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
            color: 'var(--accent-danger)',
            background: 'color-mix(in srgb, var(--accent-danger), transparent 92%)',
            border: '1px solid color-mix(in srgb, var(--accent-danger), transparent 80%)'
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}