'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, CircleDollarSign, Settings2,
  CalendarDays, Home, ChevronRight,
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'
import { supabase, signOut } from '@/lib/supabase'

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/',          label: 'Dashboard',     icon: LayoutDashboard },
      { href: '/reportes',  label: 'Reporte Anual', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
      { href: '/gastos',      label: 'Registro',    icon: ArrowLeftRight },
      { href: '/agenda',      label: 'Agenda',      icon: CalendarDays },
      { href: '/sobres',      label: 'Sobres',      icon: Wallet },
    ],
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas',       label: 'Metas de Ahorro',      icon: Target },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
      { href: '/deudas',      label: 'Deudas',      icon: CircleDollarSign, deudaBadge: true },
      { href: '/inmuebles',   label: 'Inmuebles',   icon: Home },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/tarjetas', label: 'Mis Tarjetas',  icon: CreditCard },
      { href: '/ajustes',  label: 'Configuración', icon: Settings2 },
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
  const router = useRouter()
  const [deudasAlert, setDeudasAlert] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setNombre(session?.user?.user_metadata?.nombre || session?.user?.email?.split('@')[0] || '')
    })
    supabase.from('deudas').select('dia_pago').eq('estado', 'activa').then(({ data }) => {
      if (data) setDeudasAlert(data.some(d => {
        const dias = diasHastaPago(d.dia_pago)
        return dias !== null && dias <= 7
      }))
    })
  }, [])

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  return (
    <aside className="h-full flex flex-col"
      style={{
        width: 240,
        background: 'var(--sidebar-bg, var(--bg-card))',
        borderRight: '1px solid var(--border-glass)',
        zIndex: 100,
      }}>

      {/* ── Header / Perfil ── */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: 'color-mix(in srgb, var(--accent-terra) 14%, transparent)' }}>
            <img src="/icon.svg" alt="Logo" className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-script leading-none" style={{ fontSize: 20, color: 'var(--text-primary)' }}>
              Familia Quintero
            </p>
          </div>
        </div>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-3">
        {MENU_GROUPS.map((group, gIdx) => (
          <div key={gIdx} style={{ marginTop: gIdx > 0 ? 18 : 0 }}>

            {/* Etiqueta de grupo */}
            <div className="flex items-center gap-2 px-3 mb-1">
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.11em', textTransform: 'uppercase', color: 'var(--text-muted)', opacity: 0.55 }}>
                {group.title}
              </p>
            </div>

            {/* Items */}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon, deudaBadge }) => {
                const active = pathname === href
                const showBadge = deudaBadge && deudasAlert
                return (
                  <Link key={href} href={href}
                    className="group relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150"
                    style={{
                      textDecoration: 'none',
                      background: active
                        ? 'color-mix(in srgb, var(--accent-main) 10%, transparent)'
                        : 'transparent',
                    }}>
                    {/* Hover */}
                    {!active && (
                      <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'var(--bg-secondary)' }} />
                    )}

                    {/* Icono */}
                    <div className="relative flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                      style={{
                        background: active
                          ? 'color-mix(in srgb, var(--accent-main) 16%, transparent)'
                          : 'transparent',
                      }}>
                      <Icon size={15} strokeWidth={active ? 2.5 : 1.8}
                        style={{ color: active ? 'var(--accent-main)' : 'var(--text-muted)' }} />
                      {showBadge && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border-2"
                          style={{ background: 'var(--accent-rose)', borderColor: 'var(--bg-card)' }} />
                      )}
                    </div>

                    {/* Label */}
                    <span className="relative z-10 flex-1 text-xs font-semibold"
                      style={{ color: active ? 'var(--accent-main)' : 'var(--text-secondary)' }}>
                      {label}
                    </span>

                    {/* Chevron activo */}
                    {active && (
                      <ChevronRight size={12} style={{ color: 'var(--accent-main)', opacity: 0.6, flexShrink: 0 }} />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="px-3 py-3 flex-shrink-0 space-y-0.5"
        style={{ borderTop: '1px solid color-mix(in srgb, var(--border-glass) 60%, transparent)' }}>

        {/* Tema */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl"
          style={{ background: 'transparent' }}>
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <ThemeSwitcher />
          </div>
          <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Tema</span>
        </div>

        {/* Salir */}
        <div className="relative">
          <button onClick={() => setConfirmLogout(true)}
            className="group w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)' }} />
            <div className="relative w-7 h-7 flex items-center justify-center flex-shrink-0">
              <LogOut size={15} style={{ color: 'var(--accent-rose)' }} />
            </div>
            <span className="relative text-xs font-semibold" style={{ color: 'var(--accent-rose)' }}>Cerrar sesión</span>
          </button>

          {confirmLogout && (
            <>
              <div className="fixed inset-0 z-[200]" onClick={() => setConfirmLogout(false)} />
              <div className="absolute bottom-full left-0 mb-2 z-[201]"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 16,
                  boxShadow: 'var(--shadow-lg)',
                  padding: '14px 16px',
                  width: 210,
                }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>¿Cerrar sesión?</p>
                <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>Tendrás que volver a iniciar sesión.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmLogout(false)}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-xl transition-all active:scale-95"
                    style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    Cancelar
                  </button>
                  <button onClick={handleLogout}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-xl transition-all active:scale-95"
                    style={{ background: 'color-mix(in srgb, var(--accent-rose) 15%, transparent)', border: 'none', cursor: 'pointer', color: 'var(--accent-rose)' }}>
                    Salir
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
