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
  { href: '/',       label: 'Inicio',    icon: LayoutDashboard },
  { href: '/gastos', label: 'Registro',  icon: ArrowLeftRight },
]
const RIGHT_TABS = [
  { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
  { href: '/metas',       label: 'Metas',       icon: Target },
]

const MORE_ITEMS = [
  { href: '/inversiones', label: 'Inversiones',  icon: TrendingUp },
  { href: '/sobres',      label: 'Sobres',       icon: Wallet },
  { href: '/deudas',      label: 'Deudas',       icon: CircleDollarSign },
  { href: '/tarjetas',    label: 'Mis Tarjetas', icon: CreditCard },
  { href: '/agenda',      label: 'Agenda',       icon: CalendarDays },
  { href: '/reportes',    label: 'Reportes',     icon: BarChart3 },
  { href: '/ajustes',     label: 'Configuración',icon: Settings2 },
]

export default function BottomNav({ onFABClick }) {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {/* Sheet "Más" */}
      {showMore && (
        <>
          {/* Overlay con Blur */}
          <div
            className="lg:hidden fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowMore(false)}
          />

          {/* Contenedor del Sheet */}
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] rounded-t-[40px] overflow-hidden transition-all duration-300 shadow-2xl"
            style={{
              background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid var(--border-glass)',
              borderBottom: 'none',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
            }}>
            
            {/* Indicador visual de arrastre (Handle) */}
            <div className="w-12 h-1.5 rounded-full mx-auto mt-3 mb-1" style={{ background: 'var(--border-glass)' }} />

            {/* Cabecera con Aire */}
            <div className="flex items-center justify-between px-7 pt-4 pb-6">
              <div className="flex flex-col">
                <p className="font-script" style={{ fontSize: 32, color: 'var(--text-primary)', lineHeight: 1 }}>
                  Más módulos
                </p>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>
                  Explora todas las funciones
                </span>
              </div>
              <button 
                onClick={() => setShowMore(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full transition-colors"
                style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* Grid de Items Mejorado */}
            <div className="grid grid-cols-3 gap-4 px-6 pb-8">
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link 
                    key={href} 
                    href={href}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-3 py-5 rounded-[28px] transition-all active:scale-95"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--accent-green) 8%, var(--bg-secondary))' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-glass)',
                      textDecoration: 'none'
                    }}>
                    <div 
                      className="p-3.5 rounded-2xl shadow-sm" 
                      style={{ 
                        background: 'var(--bg-card)',
                        color: active ? 'var(--accent-green)' : 'var(--text-muted)'
                      }}>
                      <Icon size={24} strokeWidth={active ? 2.2 : 1.5} />
                    </div>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: active ? 700 : 500, 
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)' 
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

      {/* Bottom Nav Bar Principal */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[80] flex items-end"
        style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-glass)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          height: 'calc(64px + env(safe-area-inset-bottom))',
        }}>

        {/* Tabs izquierda */}
        {LEFT_TABS.map((tab) => {
          const active = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link key={tab.href} href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform pb-2"
              style={{ textDecoration: 'none', color: active ? 'var(--text-primary)' : 'var(--text-muted)', height: 64 }}>
              <div className="relative flex items-center justify-center">
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: 'var(--accent-green)' }} />
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, letterSpacing: '0.02em' }}>
                {tab.label}
              </span>
            </Link>
          )
        })}

        {/* Botón + central elevado */}
        <div className="flex-1 flex flex-col items-center justify-end pb-3" style={{ height: 64 }}>
          <button
            onClick={onFABClick}
            className="flex items-center justify-center rounded-full shadow-xl active:scale-90 transition-all"
            style={{
              width: 52, height: 52,
              background: 'var(--accent-green)',
              color: 'white',
              border: '3px solid var(--bg-primary)',
              marginBottom: -6,
              transform: 'translateY(-10px)',
            }}>
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* Tabs derecha */}
        {RIGHT_TABS.map((tab) => {
          const active = pathname === tab.href
          const Icon = tab.icon
          return (
            <Link key={tab.href} href={tab.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform pb-2"
              style={{ textDecoration: 'none', color: active ? 'var(--text-primary)' : 'var(--text-muted)', height: 64 }}>
              <div className="relative flex items-center justify-center">
                <Icon size={21} strokeWidth={active ? 2.5 : 1.8} />
                {active && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: 'var(--accent-green)' }} />
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, letterSpacing: '0.02em' }}>
                {tab.label}
              </span>
            </Link>
          )
        })}

        {/* Botón "Más" */}
        <button
          onClick={() => setShowMore(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform pb-2"
          style={{ color: showMore ? 'var(--text-primary)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', height: 64 }}>
          <MoreHorizontal size={21} strokeWidth={1.8} />
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.02em' }}>Más</span>
        </button>
      </nav>
    </>
  )
}