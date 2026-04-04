'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Target,
  MoreHorizontal, TrendingUp, Wallet, CircleDollarSign,
  CreditCard, Settings2, BarChart3, X, CalendarDays, Plus, Home
} from 'lucide-react'
import { useState } from 'react'

const LEFT_TABS = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/gastos', label: 'Gastos', icon: ArrowLeftRight },
]
const RIGHT_TABS = [
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
]
const MORE_SECTIONS = [
  {
    title: 'Finanzas',
    items: [
      { href: '/sobres',    label: 'Sobres',    icon: Wallet },
      { href: '/tarjetas',  label: 'Tarjetas',  icon: CreditCard },
      { href: '/deudas',    label: 'Deudas',    icon: CircleDollarSign },
    ],
  },
  {
    title: 'Crecer',
    items: [
      { href: '/metas',      label: 'Metas',      icon: Target },
      { href: '/inversiones',label: 'Inversiones',icon: TrendingUp },
      { href: '/inmuebles',  label: 'Inmuebles',  icon: Home },
    ],
  },
  {
    title: 'Ver',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
      { href: '/reportes',    label: 'Reportes',    icon: BarChart3 },
      { href: '/ajustes',     label: 'Ajustes',     icon: Settings2 },
    ],
  },
]

// Lista plana para la lógica del botón "Más" (smart routing)
const MORE_ITEMS = MORE_SECTIONS.flatMap(s => s.items)

function NavTab({ href, label, icon: Icon, active }) {
  return (
    <Link href={href}
      className="flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-90"
      style={{ textDecoration: 'none', height: 64 }}>
      <Icon size={20} strokeWidth={active ? 2.5 : 1.8}
        style={{ color: active ? 'var(--accent-main)' : 'var(--text-muted)', transition: 'color 0.2s' }} />
      <span style={{
        fontSize: 9, fontWeight: active ? 800 : 500,
        color: active ? 'var(--accent-main)' : 'var(--text-muted)',
        letterSpacing: '0.02em', transition: 'color 0.2s',
      }}>
        {label}
      </span>
      {/* Dot indicator */}
      <div style={{
        width: active ? 4 : 0, height: 4, borderRadius: 9999,
        background: 'var(--accent-main)',
        transition: 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        marginTop: 1,
      }} />
    </Link>
  )
}

export default function BottomNav({ onFABClick }) {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {showMore && (
        <>
          <div className="lg:hidden fixed inset-0 z-[90]"
            style={{ background: 'color-mix(in srgb, var(--bg-dark-card), transparent 55%)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowMore(false)} />

          <div className="lg:hidden fixed bottom-4 left-3 right-3 z-[100] animate-enter"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid var(--border-glass)',
              borderRadius: 28,
              boxShadow: 'var(--shadow-xl)',
              overflow: 'hidden',
            }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-1 pb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Módulos
              </p>
              <button onClick={() => setShowMore(false)}
                style={{
                  width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>

            {/* Secciones */}
            <div className="px-3 pb-5 flex flex-col gap-4">
              {MORE_SECTIONS.map(section => (
                <div key={section.title}>
                  <p style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--text-muted)',
                    marginBottom: 8, paddingLeft: 4,
                  }}>
                    {section.title}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {section.items.map(({ href, label, icon: Icon }) => {
                      const active = pathname === href
                      return (
                        <Link key={href} href={href} onClick={() => setShowMore(false)}
                          className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-90"
                          style={{
                            background: active ? `color-mix(in srgb, var(--accent-main) 10%, var(--bg-secondary))` : 'var(--bg-secondary)',
                            border: `1px solid ${active ? 'color-mix(in srgb, var(--accent-main) 30%, transparent)' : 'transparent'}`,
                            textDecoration: 'none',
                          }}>
                          <Icon size={20} strokeWidth={active ? 2.5 : 2}
                            style={{ color: active ? 'var(--accent-main)' : 'var(--text-secondary)' }} />
                          <span style={{
                            fontSize: 9.5, fontWeight: active ? 700 : 500,
                            color: active ? 'var(--accent-main)' : 'var(--text-muted)',
                            textAlign: 'center', lineHeight: 1.2,
                          }}>
                            {label}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Barra inferior flotante */}
      <div className="lg:hidden fixed z-[80]" style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        left: 12, right: 12,
      }}>
        <div className="flex items-center justify-around"
          style={{
            background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-glass)',
            borderRadius: 28,
            boxShadow: 'var(--shadow-xl)',
            height: 64,
          }}>

          <div className="flex flex-1 justify-around">
            {LEFT_TABS.map(tab => (
              <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
            ))}
          </div>

          {/* FAB central */}
          <div className="relative -top-5 flex flex-col items-center flex-shrink-0">
            <button
              onClick={onFABClick}
              className="active:scale-90 transition-all flex items-center justify-center rounded-full"
              style={{
                width: 58,
                height: 58,
                background: 'var(--accent-main)',
                color: 'var(--text-on-dark)',
                border: '3px solid color-mix(in srgb, var(--bg-card) 85%, transparent)',
                boxShadow: `var(--shadow-md), 0 6px 20px color-mix(in srgb, var(--accent-main) 50%, transparent)`,
                cursor: 'pointer',
              }}>
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-1 justify-around">
            {RIGHT_TABS.map(tab => (
              <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
            ))}

            {/* Botón Más — muestra el módulo activo si estás en uno del drawer */}
            {(() => {
              const activeMore = MORE_ITEMS.find(item => pathname === item.href)
              const Icon = activeMore ? activeMore.icon : MoreHorizontal
              const label = activeMore ? activeMore.label : 'Más'
              const isActive = !!activeMore || showMore

              return (
                <button
                  onClick={() => setShowMore(s => !s)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', height: 64 }}>
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8}
                    style={{ color: isActive ? 'var(--accent-main)' : 'var(--text-muted)', transition: 'color 0.2s' }} />
                  <span style={{
                    fontSize: 9, fontWeight: isActive ? 800 : 500,
                    color: isActive ? 'var(--accent-main)' : 'var(--text-muted)',
                    letterSpacing: '0.02em', transition: 'color 0.2s',
                  }}>{label}</span>
                  <div style={{
                    width: isActive ? 4 : 0, height: 4, borderRadius: 9999,
                    background: 'var(--accent-main)',
                    transition: 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    marginTop: 1,
                  }} />
                </button>
              )
            })()}</div>


        </div>
      </div>
    </>
  )
}
