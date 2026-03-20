'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, CircleDollarSign, Settings2
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'
import { supabase, signOut } from '@/lib/supabase'

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/reportes', label: 'Reporte Anual', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
      { href: '/gastos', label: 'Registro', icon: ArrowLeftRight },
      { href: '/sobres', label: 'Sobres', icon: Wallet },
    ],
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas', label: 'Ahorro', icon: Target },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
      { href: '/deudas', label: 'Deudas', icon: CircleDollarSign, deudaBadge: true },
      { href: '/tarjetas', label: 'Mis Tarjetas', icon: CreditCard },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/ajustes', label: 'Configuración', icon: Settings2 },
    ],
  },
]

function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  if (diaPago >= hoy) return diaPago - hoy
  const ultimo = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  return (ultimo - hoy) + diaPago
}

export default function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [deudasAlert, setDeudasAlert] = useState(false)

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  useEffect(() => {
    supabase.from('deudas').select('dia_pago').eq('estado', 'activa').then(({ data }) => {
      if (data) setDeudasAlert(data.some(d => {
        const dias = diasHastaPago(d.dia_pago)
        return dias !== null && dias <= 7
      }))
    })
  }, [])

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="h-full flex flex-col py-6 shadow-none transition-all duration-300 ease-in-out overflow-hidden"
      style={{ background: 'var(--bg-card)', zIndex: 100, width: expanded ? 220 : 80 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 mb-6 overflow-hidden flex-shrink-0">
        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)' }}>
          <img src="/icon.svg" alt="Logo" className="w-6 h-6" />
        </div>
        <span
          className="font-script whitespace-nowrap transition-all duration-200"
          style={{
            fontSize: 20, color: 'var(--text-primary)',
            opacity: expanded ? 1 : 0,
            transform: expanded ? 'translateX(0)' : 'translateX(-8px)',
          }}>
          Familia Quintero
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 space-y-5">
        {MENU_GROUPS.map((group, gIdx) => (
          <div key={gIdx}>
            {gIdx > 0 && (
              <div className="h-px mx-1 mb-3" style={{ background: 'var(--border-glass)' }} />
            )}

            {/* Group title */}
            <p className="font-script px-2 mb-1.5 whitespace-nowrap transition-all duration-200 overflow-hidden"
              style={{
                fontSize: 23,
                color: 'var(--text-muted)',
                opacity: expanded ? 0.7 : 0,
                // SUBIMOS EL ALTO: 26px para que la letra de 18px respire y no se corte
                height: expanded ? 26 : 0,
                // LINE-HEIGHT: Al ponerlo igual al height, el texto se alinea solo
                lineHeight: expanded ? '26px' : '0px',
                marginBottom: expanded ? 6 : 0,
              }}>
              {group.title}
            </p>

            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, deudaBadge }) => {
                const active = pathname === href
                const showBadge = deudaBadge && deudasAlert

                return (
                  <Link
                    key={href}
                    href={href}
                    aria-label={label}
                    aria-current={active ? 'page' : undefined}
                    className="group/item relative flex items-center gap-3 px-2 py-2.5 rounded-xl transition-all duration-150 overflow-hidden"
                    style={{
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: active
                        ? 'color-mix(in srgb, var(--text-primary) 7%, transparent)'
                        : 'transparent',
                    }}
                  >
                    {/* Hover bg */}
                    <span className="absolute inset-0 rounded-xl opacity-0 group-hover/item:opacity-100 transition-opacity duration-150"
                      style={{ background: active ? 'transparent' : 'var(--bg-secondary)', pointerEvents: 'none' }} />

                    {/* Active left bar */}
                    {active && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full"
                        style={{ background: 'var(--accent-green)' }} />
                    )}

                    {/* Icon */}
                    <div className="relative flex-shrink-0 w-9 h-9 flex items-center justify-center">
                      <Icon
                        size={19}
                        strokeWidth={active ? 2.5 : 1.8}
                        className="relative z-10 transition-transform duration-200 group-hover/item:scale-110"
                      />
                      {showBadge && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full z-20 border-2"
                          style={{ background: 'var(--accent-rose)', borderColor: 'var(--bg-card)' }} />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className="relative z-10 text-xs font-semibold whitespace-nowrap transition-all duration-200 overflow-hidden"
                      style={{
                        opacity: expanded ? 1 : 0,
                        maxWidth: expanded ? 140 : 0,
                        transform: expanded ? 'translateX(0)' : 'translateX(-6px)',
                      }}>
                      {label}
                    </span>

                    {/* Tooltip (solo cuando colapsado) */}
                    {!expanded && (
                      <span
                        className="hidden lg:block absolute left-[3.8rem] scale-0 group-hover/item:scale-100 transition-all z-50 px-3 py-1.5 rounded-xl text-[10px] font-semibold uppercase tracking-widest pointer-events-none shadow-2xl whitespace-nowrap"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-glass)',
                          color: 'var(--text-primary)',
                        }}>
                        {label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pt-4 space-y-1 flex-shrink-0" style={{ borderTop: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center">
            <ThemeSwitcher />
          </div>
          <span className="text-xs font-semibold whitespace-nowrap transition-all duration-200"
            style={{ opacity: expanded ? 1 : 0, color: 'var(--text-muted)', maxWidth: expanded ? 140 : 0 }}>
            Tema
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-2 py-2 rounded-xl w-full transition-all duration-150"
          style={{ color: 'var(--accent-rose)', background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)', border: 'none', cursor: 'pointer' }}>
          <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center">
            <LogOut size={17} />
          </div>
          <span className="text-xs font-semibold whitespace-nowrap transition-all duration-200"
            style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? 140 : 0 }}>
            Salir
          </span>
        </button>
      </div>
    </aside>
  )
}
