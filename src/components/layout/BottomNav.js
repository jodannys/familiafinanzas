'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Target,
  MoreHorizontal, TrendingUp, Wallet, CircleDollarSign,
  CreditCard, Settings2, BarChart3, X, CalendarDays, Plus, Home, Users,
} from 'lucide-react'

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
    emoji: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v12M9 9h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" />
      </svg>
    ),
    items: [
      { href: '/sobres', label: 'Sobres', icon: Wallet },
      { href: '/tarjetas', label: 'Tarjetas', icon: CreditCard },
      { href: '/deudas', label: 'Deudas', icon: CircleDollarSign },
    ],
  },
  {
    title: 'Crecer',
    emoji: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    items: [
      { href: '/metas', label: 'Metas', icon: Target },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
      { href: '/inmuebles', label: 'Inmuebles', icon: Home },
    ],
  },
  {
    title: 'Ver mas',
    emoji: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
      { href: '/reportes', label: 'Reportes', icon: BarChart3 },
      { href: '/familia', label: 'Familia', icon: Users },
      { href: '/ajustes', label: 'Ajustes', icon: Settings2 },
    ],
  },
]



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
      <div style={{
        width: active ? 4 : 0, height: 4, borderRadius: 9999,
        background: 'var(--accent-main)',
        transition: 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        marginTop: 1,
      }} />
    </Link>
  )
}

export default function BottomNav({ onFABClick, paisUsuario = 'ES' }) {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const MORE_ITEMS = MORE_SECTIONS
    .flatMap(s => s.items)
    .filter(item => item.href !== '/inmuebles' || paisUsuario === 'ES')

  const activeMoreItem = MORE_ITEMS.find(item => pathname === item.href)
  const MoreIcon = activeMoreItem ? activeMoreItem.icon : MoreHorizontal
  const moreLabel = activeMoreItem ? activeMoreItem.label : 'Más'
  const isMoreActive = !!activeMoreItem || showMore

  return (
    <>
      {/* ── Sheet iOS-style ── */}
      {showMore && (
        <>
          {/* Overlay con blur */}
          <div
            className="lg:hidden fixed inset-0 z-[90]"
            style={{
              background: 'color-mix(in srgb, var(--bg-dark-card), transparent 40%)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}
            onClick={() => setShowMore(false)}
          />

          {/* Sheet */}
          <div
            className="lg:hidden fixed left-0 right-0 z-[100]"
            style={{
              bottom: 0,
              borderRadius: '28px 28px 0 0',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              borderBottom: 'none',
              boxShadow: '0 -8px 40px color-mix(in srgb, var(--bg-dark-card) 30%, transparent)',
              animation: 'sheet-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
              <div style={{
                width: 44, height: 5, borderRadius: 99,
                background: 'color-mix(in srgb, var(--text-muted) 25%, transparent)',
              }} />
            </div>

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 20px 16px',
            }}>
              <p style={{
                fontSize: 20, fontWeight: 800, color: 'var(--text-primary)',
                letterSpacing: '-0.03em',
              }}>
                Módulos
              </p>
              <button
                onClick={() => setShowMore(false)}
                style={{
                  width: 32, height: 32, borderRadius: 99, border: 'none',
                  background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>

            {/* Secciones */}
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              {MORE_SECTIONS.map(section => {
                // 1. Filtramos los items de esta sección según el país
                const filteredItems = section.items.filter(
                  item => item.href !== '/inmuebles' || paisUsuario === 'ES'
                );

                // 2. Si después de filtrar la sección se queda vacía, no la renderizamos
                if (filteredItems.length === 0) return null;

                return (
                  <div key={section.title}>
                    {/* Título de sección */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, paddingLeft: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{section.emoji}</span>
                      <p style={{
                        fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
                        textTransform: 'uppercase', color: 'var(--text-muted)',
                      }}>
                        {section.title}
                      </p>
                    </div>

                    {/* Grid de items */}
                    <div style={{
                      display: 'grid',
                      // Usamos filteredItems.length para que las columnas cuadren si se oculta un item
                      gridTemplateColumns: `repeat(${filteredItems.length <= 3 ? filteredItems.length : 4}, 1fr)`,
                      gap: 10,
                    }}>
                      {filteredItems.map((item) => {
                        const { href, label, icon: Icon } = item
                        const active = pathname === href

                        return (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setShowMore(false)}
                            style={{
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', gap: 8,
                              padding: '16px 8px 14px',
                              borderRadius: 20,
                              textDecoration: 'none',
                              background: active
                                ? 'color-mix(in srgb, var(--accent-main) 12%, var(--bg-secondary))'
                                : 'var(--bg-secondary)',
                              border: `1.5px solid ${active
                                ? 'color-mix(in srgb, var(--accent-main) 35%, transparent)'
                                : 'transparent'}`,
                              transition: 'all 0.15s',
                            }}
                            className="active:scale-95"
                          >
                            {/* Icono con fondo */}
                            <div style={{
                              width: 46, height: 46, borderRadius: 14,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: active
                                ? 'color-mix(in srgb, var(--accent-main) 18%, transparent)'
                                : 'color-mix(in srgb, var(--text-muted) 8%, transparent)',
                              transition: 'background 0.15s',
                            }}>
                              <Icon
                                size={22}
                                strokeWidth={active ? 2.5 : 1.8}
                                style={{ color: active ? 'var(--accent-main)' : 'var(--text-secondary)' }}
                              />
                            </div>

                            {/* Label */}
                            <span style={{
                              fontSize: 11, fontWeight: active ? 700 : 500,
                              color: active ? 'var(--accent-main)' : 'var(--text-secondary)',
                              textAlign: 'center', lineHeight: 1.2,
                            }}>
                              {label}
                            </span>

                            {/* Dot activo */}
                            {active && (
                              <div style={{
                                width: 4, height: 4, borderRadius: 99,
                                background: 'var(--accent-main)',
                                marginTop: -4,
                              }} />
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        </>
      )}

      {/* ── Barra inferior ── */}
      <div className="lg:hidden fixed z-[80]" style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 10px)',
        left: 12, right: 12,
      }}>
        <div className="flex items-center justify-around"
          style={{
            background: 'color-mix(in srgb, var(--bg-card) 85%, transparent)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-glass)', borderRadius: 28,
            boxShadow: 'var(--shadow-xl)', height: 64,
          }}>

          <div className="flex flex-1 justify-around">
            {LEFT_TABS.map(tab => (
              <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
            ))}
          </div>

          {/* FAB central */}
          <div className="relative -top-5 flex-shrink-0">
            <button
              onClick={onFABClick}
              className="active:scale-90 transition-all flex items-center justify-center rounded-full"
              style={{
                width: 58, height: 58, background: 'var(--accent-main)',
                color: 'var(--text-on-dark)', border: '3px solid var(--bg-card)',
                boxShadow: `var(--shadow-md), 0 6px 20px color-mix(in srgb, var(--accent-main) 50%, transparent)`,
              }}>
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-1 justify-around">
            {RIGHT_TABS.map(tab => (
              <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
            ))}

            {/* Botón Más */}
            <button
              onClick={() => setShowMore(s => !s)}
              className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
              style={{ background: 'none', border: 'none', cursor: 'pointer', height: 64 }}>
              <MoreIcon size={20} strokeWidth={isMoreActive ? 2.5 : 1.8}
                style={{ color: isMoreActive ? 'var(--accent-main)' : 'var(--text-muted)', transition: 'color 0.2s' }} />
              <span style={{
                fontSize: 9, fontWeight: isMoreActive ? 800 : 500,
                color: isMoreActive ? 'var(--accent-main)' : 'var(--text-muted)',
                letterSpacing: '0.02em', transition: 'color 0.2s',
              }}>{moreLabel}</span>
              <div style={{
                width: isMoreActive ? 4 : 0, height: 4, borderRadius: 9999,
                background: 'var(--accent-main)',
                transition: 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)', marginTop: 1,
              }} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sheet-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </>
  )
}