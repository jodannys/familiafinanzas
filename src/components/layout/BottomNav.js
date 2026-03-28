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
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/gastos', label: 'Gastos', icon: ArrowLeftRight },
]
const RIGHT_TABS = [
  { href: '/agenda', label: 'Agenda', icon: CalendarDays },
]
const MORE_ITEMS = [
  { href: '/presupuesto', label: 'Presup.', icon: PieChart },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
  { href: '/sobres', label: 'Sobres', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: CircleDollarSign },
  { href: '/tarjetas', label: 'Mis Tarjetas', icon: CreditCard },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/ajustes', label: 'Configuración', icon: Settings2 },
]

function NavTab({ href, label, icon: Icon, active }) {
  return (
    <Link href={href}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
      style={{ textDecoration: 'none', color: active ? 'var(--accent-main)' : 'var(--text-muted)', height: 64 }}>
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
      {showMore && (
        <>
          {/* Overlay original con blur */}
          <div className="lg:hidden fixed inset-0 z-[90]"
            style={{ background: 'color-mix(in srgb, var(--bg-dark-card), transparent 55%)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowMore(false)} />

          {/* Menú de Módulos original (Redondeado y con estilo Glassmorphism) */}
          <div className="lg:hidden fixed bottom-4 left-4 right-4 z-[100] rounded-[32px] overflow-hidden shadow-2xl"
            style={{
              background: 'var(--bg-card)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid var(--border-glass)',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              paddingBottom: '12px',
            }}>

            <div className="w-10 h-1 rounded-full mx-auto mt-3 mb-1 shrink-0" style={{ background: 'var(--border-glass)' }} />

            <div className="flex items-center justify-between px-6 pt-2 pb-3 shrink-0">
              <div className="flex flex-col">
                <p className="font-script" style={{ fontSize: 26, color: 'var(--text-primary)', lineHeight: 1 }}>
                  Módulos
                </p>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                  Panel de control
                </span>
              </div>
              <button onClick={() => setShowMore(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5"
                style={{ color: 'var(--text-muted)', border: 'none' }}>
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 px-4 pb-4 overflow-y-auto no-scrollbar">
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href} onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-1 py-3 rounded-2xl transition-all active:scale-90"
                    style={{
                      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                      border: active ? '1px solid var(--border-glass)' : '1px solid transparent',
                      textDecoration: 'none',
                    }}>

                    <div className="p-2.5 rounded-xl shadow-sm"
                      style={{
                        background: 'var(--bg-secondary)',
                        color: active ? 'var(--accent-main)' : 'var(--text-muted)'
                      }}>
                      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                    </div>

                    <span style={{
                      fontSize: 10,
                      fontWeight: active ? 700 : 500,
                      color: 'var(--text-primary)',
                      textAlign: 'center'
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

      {/* Barra de navegación inferior */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[80] flex justify-center">

        <div className="relative w-full h-[68px] flex items-center justify-around border-t"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-glass)',
            paddingBottom: 'env(safe-area-inset-bottom)'
          }}>

          <div className="flex flex-1 justify-around">
            {LEFT_TABS.map(tab => (
              <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
            ))}
          </div>

          {/* Botón central (FAB) SIN BRILLO y SÓLIDO */}
          <div className="relative -top-6 flex flex-col items-center">
            <button
              onClick={onFABClick}
              className="active:scale-95 transition-all flex items-center justify-center rounded-full"
              style={{
                width: 60,
                height: 60,
                background: 'var(--accent-main)',
                color: 'var(--text-on-dark)',
                border: '4px solid var(--bg-card)', // Crea ese efecto de recorte limpio
                boxShadow: 'none', // Quitamos el brillo
                cursor: 'pointer',
              }}>
              <Plus size={32} strokeWidth={3} />
            </button>
          </div>

          <div className="flex flex-1 justify-around">
            {RIGHT_TABS.map(tab => (
              <NavTab key={tab.href} {...tab} active={pathname === tab.href} />
            ))}

            <button
              onClick={() => setShowMore(true)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
              style={{ 
                color: showMore ? 'var(--accent-main)' : 'var(--text-muted)', 
                background: 'none', 
                border: 'none', 
                height: 64 
              }}>
              <MoreHorizontal size={21} strokeWidth={1.8} />
              <span style={{ fontSize: 9, fontWeight: 600 }}>Más</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}