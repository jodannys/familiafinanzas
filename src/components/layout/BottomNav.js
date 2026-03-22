'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, PieChart, Target,
  TrendingUp, Wallet, CircleDollarSign,
  CreditCard, Settings2, BarChart3, X
} from 'lucide-react'
import { useState } from 'react'

const MORE_ITEMS = [
  { href: '/',            label: 'Inicio',        icon: LayoutDashboard },
  { href: '/gastos',      label: 'Registro',      icon: ArrowLeftRight },
  { href: '/presupuesto', label: 'Presupuesto',   icon: PieChart },
  { href: '/metas',       label: 'Metas',         icon: Target },
  { href: '/inversiones', label: 'Inversiones',   icon: TrendingUp },
  { href: '/sobres',      label: 'Sobres',        icon: Wallet },
  { href: '/deudas',      label: 'Deudas',        icon: CircleDollarSign },
  { href: '/tarjetas',    label: 'Mis Tarjetas',  icon: CreditCard },
  { href: '/reportes',    label: 'Reportes',      icon: BarChart3 },
  { href: '/ajustes',     label: 'Configuración', icon: Settings2 },
]

export default function BottomNav({ onFABClick }) {
  const pathname   = usePathname()
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      {/* Sheet "Más" */}
      {showMore && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-[90]"
            style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowMore(false)}
          />
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] rounded-t-3xl overflow-hidden"
            style={{ background: 'var(--bg-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-3"
              style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <p className="font-script" style={{ fontSize: 25, color: 'var(--text-primary)' }}>Más módulos</p>
              <button onClick={() => setShowMore(false)}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-px p-1" style={{ background: 'var(--border-glass)' }}>
              {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
                const active = pathname === href
                return (
                  <Link key={href} href={href}
                    onClick={() => setShowMore(false)}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--accent-green) 10%, var(--bg-card))' : 'var(--bg-card)',
                      textDecoration: 'none',
                      color: active ? 'var(--accent-green)' : 'var(--text-muted)',
                    }}>
                    <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                    <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Bottom Nav Bar — solo botón cerrar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-[80] flex items-stretch justify-center"
        style={{
          background: 'var(--bg-card)',
          borderTop: '1px solid var(--border-glass)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          height: 'calc(64px + env(safe-area-inset-bottom))',
        }}>
        <button
          onClick={() => setShowMore(v => !v)}
          className="flex flex-col items-center justify-center gap-0.5 px-8 active:scale-95 transition-transform"
          style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={22} strokeWidth={2} />
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.02em' }}>Menú</span>
        </button>
      </nav>
    </>
  )
}
