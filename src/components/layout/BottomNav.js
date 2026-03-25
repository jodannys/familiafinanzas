'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Target,
  MoreHorizontal, TrendingUp, Wallet, CircleDollarSign,
  CreditCard, Settings2, BarChart3, X, CalendarDays, Plus
} from 'lucide-react'
import { useState } from 'react'

const LEFT_TABS = [
  { href: '/',       label: 'Inicio',   icon: LayoutDashboard },
  { href: '/gastos', label: 'Gastos',   icon: ArrowLeftRight },
]
const RIGHT_TABS = [
  { href: '/agenda',      label: 'Agenda', icon: CalendarDays },
  { href: '/presupuesto', label: 'Presup.', icon: PieChart },
]
const MORE_ITEMS = [
  { href: '/metas',       label: 'Metas',         icon: Target },
  { href: '/inversiones', label: 'Inversiones',   icon: TrendingUp },
  { href: '/sobres',      label: 'Sobres',         icon: Wallet },
  { href: '/deudas',      label: 'Deudas',         icon: CircleDollarSign },
  { href: '/tarjetas',    label: 'Mis Tarjetas',   icon: CreditCard },
  { href: '/reportes',    label: 'Reportes',       icon: BarChart3 },
  { href: '/ajustes',     label: 'Configuración',  icon: Settings2 },
]

function NavTab({ href, label, icon: Icon, active }) {
  return (
    <Link href={href}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
      style={{ textDecoration: 'none', color: active ? 'var(--accent-main)' : 'var(--text-muted)', height: 64, paddingBottom: 8 }}>
      <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
      <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, letterSpacing: '0.02em' }}>
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
      {/* Sheet "Más módulos" */}
      {showMore && (
        <>
          <div className="lg:hidden fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowMore(false)} />

          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] rounded-t-[40px] overflow-hidden shadow-2xl"
            style={{
              background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid var(--border-glass)',
              borderBottom: 'none',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
            }}>

            <div className="w-12 h-1.5 rounded-full mx-auto mt-3 mb-1" style={{ background: 'var(--border-glass)' }} />

            <div className="flex items-center justify-between px-7 pt-4 pb-6">
              <div className="flex flex-col">
                <p className="font-script" style={{ fontSize: 32, color: 'var(--text-primary)', lineHeight: 1 }}>
                  Más módulos
                </p>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                  Explora todas las funciones
                </span>
              </div>
              <button onClick={() => setShowMore(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 px-6 pb-8">
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-3 py-5 rounded-[28px] transition-all active:scale-95"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--accent-green) 8%, var(--bg-secondary))' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-glass)',
                      textDecoration: 'none',
                    }}>
                    <div className="p-3.5 rounded-2xl shadow-sm"
                      style={{ background: 'var(--bg-card)', color: active ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                      <Icon size={24} strokeWidth={active ? 2.2 : 1.5} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {label}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Barra principal con notch */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[80]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>

        {/* SVG fondo con notch */}
        <svg
          viewBox="0 0 200 64"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: -20, left: 0, width: '100%', height: 84, display: 'block', zIndex: 0 }}>
          <path
            d="M0,20 H75 C85,20 89,38 100,38 C111,38 115,20 125,20 H200 V84 H0 Z"
            fill="var(--bg-card)"
          />
          {/* borde superior sutil */}
          <path
            d="M0,20 H75 C85,20 89,38 100,38 C111,38 115,20 125,20 H200"
            fill="none"
            stroke="var(--border-glass)"
            strokeWidth="0.5"
          />
        </svg>

        {/* Botón + en el notch */}
        <button
          onClick={onFABClick}
          className="active:scale-90 transition-all flex items-center justify-center rounded-full"
          style={{
            position: 'absolute',
            top: -10,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            width: 54,
            height: 54,
            background: 'var(--accent-green)',
            color: 'white',
            border: 'none',
            boxShadow: '0 4px 20px color-mix(in srgb, var(--accent-green) 45%, transparent)',
            cursor: 'pointer',
          }}>
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* Tabs */}
        <div style={{ position: 'relative', zIndex: 5, display: 'flex', height: 64 }}>
          {LEFT_TABS.map(tab => (
            <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
          ))}

          {/* Espacio central para el notch */}
          <div style={{ flex: 1 }} />

          {RIGHT_TABS.map(tab => (
            <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
          ))}

          {/* Botón Más */}
          <button
            onClick={() => setShowMore(true)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
            style={{ color: showMore ? 'var(--accent-main)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', height: 64, paddingBottom: 8 }}>
            <MoreHorizontal size={21} strokeWidth={1.8} />
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.02em' }}>Más</span>
          </button>
        </div>
      </div>
    </>
  )
}
