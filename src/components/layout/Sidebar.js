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
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-glass)',
        backdropFilter: 'blur(20px)', // Desenfoque de fondo para el aside completo
        zIndex: 100
      }}>


      {/* Logo - Sólido y Destacado */}
      <div className="flex justify-center w-full mb-12">

        <img src="/icon.svg" alt="Logo" className="w-7 h-7" />
      </div>


      {/* Navegación - Botones de Cristal Ahumado */}
      <nav className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center">
        <div className="w-full flex flex-col items-center gap-10">
          {MENU_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="w-full flex flex-col items-center gap-5">

              {group.items.map(({ href, label, icon: Icon, color }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} onClick={onClose}
                    className="group relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300"
                    style={{
                      /* FONDO: 'Glass Ahumado' dinámico */
                      /* Si está activo brilla, si no es una burbuja muy tenue pero visible */
                      background: active ? `${color}25` : 'rgba(0,0,0,0.03)',

                      /* BORDE: Un toque de luz tenue siempre presente para definir el círculo */
                      border: active ? `2px solid ${color}60` : '1px solid rgba(255,255,255,0.04)',

                      color: active ? color : 'var(--text-muted)',

                      /* SOMBRA: Efecto de glow suave en activo */
                      boxShadow: active ? `0 6px 20px -5px ${color}30` : '0 1px 3px rgba(0,0,0,0.02)',
                    }}>

                    <Icon
                      size={20}
                      strokeWidth={active ? 2.5 : 2}
                      className="transition-transform group-hover:scale-110"
                    />

                    {/* Tooltip */}
                    <span className="hidden lg:block absolute left-16 scale-0 group-hover:scale-100 transition-all z-50 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white pointer-events-none shadow-2xl whitespace-nowrap"
                      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
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
    
        {/* Botón Logout */}
        <button
          onClick={() => { }}
          className="w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200"
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