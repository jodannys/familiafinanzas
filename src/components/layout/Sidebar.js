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
    <aside className="h-full w-20 flex flex-col items-center py-6 shadow-2xl lg:shadow-none"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1.5px solid var(--accent-main)', // He usado el color principal del tema para que resalte
        opacity: 0.95,
        backdropFilter: 'blur(10px)'
      }}>

      {/* Logo - Centrado con margen inferior fijo */}
      <div className="flex justify-center w-full mb-10">
        <img src="/icon.svg" alt="Logo" className="w-10 h-10 rounded-2xl shadow-md" />
      </div>

      {/* Navegación - overflow-y-auto pero ocultando scrollbar */}
      <nav className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center">
        <div className="w-full flex flex-col items-center gap-8">
          {MENU_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="w-full flex flex-col items-center gap-3">
              {/* Divisor sutil */}
              {gIdx !== 0 && (
                <div className="w-8 h-[1px] opacity-10 mb-2" style={{ backgroundColor: 'var(--text-muted)' }} />
              )}

              {group.items.map(({ href, label, icon: Icon, color }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} onClick={onClose}
                    className="group relative flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300"
                    style={{
                      background: active ? `${color}15` : 'transparent',
                      color: active ? color : 'var(--text-muted)',
                    }}>

                    {/* Indicador lateral activo */}
                    {active && (
                      <div className="absolute -left-1 w-1 h-6 rounded-r-full"
                        style={{ background: color }} />
                    )}

                    <Icon size={20} strokeWidth={active ? 2.5 : 2} className="transition-transform group-hover:scale-110" />

                    {/* Tooltip Pro (Solo visible en desktop) */}
                    <span className="hidden lg:block absolute left-16 scale-0 group-hover:scale-100 transition-all z-50 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white pointer-events-none shadow-xl whitespace-nowrap"
                      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
                      {label}
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Footer - Fijo abajo */}
      <div className="mt-auto pt-6 flex flex-col items-center gap-5 w-full">

        {/* Switcher de tema */}
        <div className="flex justify-center w-full">
          <ThemeSwitcher />
        </div>

        {/* Avatar QB */}
        <div className="w-9 h-9 rounded-full p-0.5 border border-zinc-500/20 shadow-sm">
          <div className="w-full h-full rounded-full flex items-center justify-center text-[9px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))' }}>
            QB
          </div>
        </div>

        {/* Botón Logout */}
        <button
          onClick={() => {/* Lógica de logout */ }}
          className="w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200"
          style={{
            color: 'var(--accent-rose)',
            background: 'var(--accent-rose)10',
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}