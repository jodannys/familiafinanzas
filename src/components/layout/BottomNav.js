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
const MORE_ITEMS = [
  { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
  { href: '/inmuebles', label: 'Inmuebles', icon: Home },
  { href: '/sobres', label: 'Sobres', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: CircleDollarSign },
  { href: '/tarjetas', label: 'Tarjetas', icon: CreditCard },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/ajustes', label: 'Ajustes', icon: Settings2 },
]

function NavTab({ href, label, icon: Icon, active }) {
  return (
    <Link href={href}
      className="flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-90"
      style={{ textDecoration: 'none', height: 64 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 28, borderRadius: 10,
        background: active ? `color-mix(in srgb, var(--accent-main) 12%, transparent)` : 'transparent',
        transition: 'background 0.2s',
      }}>
        <Icon size={20} strokeWidth={active ? 2.5 : 1.8}
          style={{ color: active ? 'var(--accent-main)' : 'var(--text-muted)' }} />
      </div>
      <span style={{
        fontSize: 9, fontWeight: active ? 800 : 500,
        color: active ? 'var(--accent-main)' : 'var(--text-muted)',
        letterSpacing: '0.02em',
      }}>
        {label}
      </span>
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

          <div className="lg:hidden fixed bottom-4 left-3 right-3 z-[100]"
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
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-glass)' }} />
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

            {/* Grid */}
            <div className="grid grid-cols-3 gap-1.5 px-3 pb-5">
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
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
        </>
      )}

      {/* Barra inferior */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[80]">
        <div className="flex items-center justify-around"
          style={{
            background: 'var(--bg-card)',
            borderTop: '1px solid var(--border-glass)',
            boxShadow: '0 -4px 24px color-mix(in srgb, var(--bg-dark-card), transparent 88%)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            height: 68,
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
                border: '4px solid var(--bg-card)',
                boxShadow: 'var(--shadow-md)',
                cursor: 'pointer',
              }}>
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-1 justify-around">
            {RIGHT_TABS.map(tab => (
              <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
            ))}

            <button
              onClick={() => setShowMore(s => !s)}
              className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-90 transition-all"
              style={{ background: 'none', border: 'none', cursor: 'pointer', height: 64 }}>
              <div style={{
                width: 36, height: 28, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: showMore ? `color-mix(in srgb, var(--accent-main) 12%, transparent)` : 'transparent',
                transition: 'background 0.2s',
              }}>
                <MoreHorizontal size={20} strokeWidth={1.8}
                  style={{ color: showMore ? 'var(--accent-main)' : 'var(--text-muted)' }} />
              </div>
              <span style={{
                fontSize: 9, fontWeight: showMore ? 800 : 500,
                color: showMore ? 'var(--accent-main)' : 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}>Más</span>
            </button>
          </div>


        </div>
      </div>
    </>
  )
}
