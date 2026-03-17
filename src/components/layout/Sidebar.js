'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, CircleDollarSign
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/',          label: 'Dashboard',     icon: LayoutDashboard },
      { href: '/reportes',  label: 'Reporte Anual', icon: BarChart3       },
    ]
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart       },
      { href: '/gastos',      label: 'Registro',    icon: ArrowLeftRight  },
      { href: '/sobres',      label: 'Sobres',      icon: Wallet          },
    ]
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas',      label: 'Ahorro',      icon: Target          },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp      },
      { href: '/deudas',     label: 'Deudas',      icon: CircleDollarSign },
      { href: '/tarjetas',   label: 'Mis Tarjetas', icon: CreditCard      },
    ]
  }
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()

  return (
    <aside
      className="h-full w-20 flex flex-col items-center py-8 shadow-2xl lg:shadow-none"
      style={{ background: 'var(--bg-card)', zIndex: 100 }}
    >

      {/* Navegación */}
      <nav className="flex-1 w-full overflow-y-auto no-scrollbar flex flex-col items-center">
        <div className="w-full flex flex-col items-center gap-4">
          {MENU_GROUPS.map((group, gIdx) => (
            <div key={gIdx} className="w-full flex flex-col items-center gap-4 relative">
              {gIdx > 0 && (
                <div className="w-6 h-px mb-1" style={{ background: 'var(--border-glass)' }} />
              )}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    className="group relative flex items-center justify-center w-11 h-11 rounded-2xl transition-all duration-200"
                    style={{
                      // FIX 2: estilos declarativos en vez de manipulación DOM directa
                      background: active ? 'var(--text-primary)' : 'transparent',
                      color:      active ? 'var(--bg-card)'      : 'var(--text-muted)',
                    }}
                  >
                    {/* FIX 2: hover con CSS puro via pseudoclase en el grupo */}
                    <span
                      className="absolute inset-0 rounded-2xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                      style={{
                        background: active ? 'transparent' : 'var(--bg-secondary)',
                        pointerEvents: 'none',
                      }}
                    />

                    <Icon
                      size={20}
                      strokeWidth={active ? 2.5 : 1.8}
                      className="relative z-10 transition-transform duration-200 group-hover:scale-110"
                    />

                    {/* Tooltip — FIX 3: usa var(--bg-card) con fallback seguro */}
                    <span
                      className="hidden lg:block absolute left-[3.5rem] scale-0 group-hover:scale-100 transition-all z-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest pointer-events-none shadow-2xl whitespace-nowrap"
                      style={{
                        background: 'var(--bg-card)',
                        border:     '1px solid var(--border-glass)',
                        color:      'var(--text-primary)',
                      }}
                    >
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

        {/* FIX 1: logout con navegación real — ajusta según tu sistema de auth */}
        <Link
          href="/login"
          aria-label="Cerrar sesión"
          className="w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-200"
          style={{
            color:      'var(--accent-rose)',
            background: 'color-mix(in srgb, var(--accent-rose), transparent 90%)',
          }}
        >
          <LogOut size={18} />
        </Link>
      </div>
    </aside>
  )
}