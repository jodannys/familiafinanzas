'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, ChevronRight
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: '#6366f1' },
      { href: '/reportes', label: 'Reporte Anual', icon: BarChart3, color: '#8b5cf6' },
    ]
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart, color: '#10b981' },
      { href: '/gastos', label: 'Registro', icon: ArrowLeftRight, color: '#f59e0b' },
      { href: '/sobres', label: 'Sobres', icon: Wallet, color: '#06b6d4' },
    ]
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas', label: 'Ahorro', icon: Target, color: '#ec4899' },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp, color: '#10b981' },
      { href: '/deudas', label: 'Deudas', icon: CreditCard, color: '#ef4444' },
      { href: '/tarjetas', label: 'Tarjetas', icon: CreditCard, color: '#3b82f6' },
    ]
  }
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()

  return (
    <aside className="h-full w-64 flex flex-col"
      style={{ 
        background: 'var(--sidebar-bg)', 
        borderRight: '1px solid var(--border-glass)'
      }}>

      {/* Logo: Elegante pero compacto */}
      <div className="px-6 py-7">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="Logo" className="w-9 h-9 rounded-xl shadow-sm" />
          <div>
            <p className="text-sm font-black tracking-tight leading-none" style={{ color: 'var(--text-primary)' }}>Familia</p>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase mt-1" style={{ color: 'var(--accent-green)' }}>Quintero Brito</p>
          </div>
        </div>
      </div>

      {/* Nav: Agrupado y limpio */}
      <nav className="flex-1 px-3 space-y-6 overflow-y-auto no-scrollbar">
        {MENU_GROUPS.map((group, idx) => (
          <div key={idx} className="space-y-1">
            <p className="px-3 text-[9px] font-black uppercase tracking-widest opacity-30 mb-2">
              {group.title}
            </p>
            {group.items.map(({ href, label, icon: Icon, color }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href} onClick={onClose}
                  className="group flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200"
                  style={{
                    background: active ? `${color}10` : 'transparent',
                    color: active ? color : 'var(--text-secondary)',
                  }}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${active ? '' : 'group-hover:bg-black/5'}`}
                    style={{ 
                      background: active ? color : 'var(--bg-secondary)',
                      color: active ? '#fff' : 'var(--text-muted)'
                    }}>
                    <Icon size={15} strokeWidth={active ? 2.5 : 2} />
                  </div>
                  <span className={`text-[13px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
                  {active && <div className="ml-auto w-1 h-4 rounded-full" style={{ background: color }}></div>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer: Ultra-limpio y sin distracciones */}
      <div className="p-4 mt-auto border-t border-dashed" style={{ borderColor: 'var(--border-glass)' }}>
        
        {/* Perfil simplificado (Sin el "Sincronizado") */}
        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))' }}>
            QB
          </div>
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Gestión Familiar</p>
        </div>

        {/* ThemeSwitcher solo (sin etiquetas molestas) */}
        <div className="scale-90 origin-left opacity-80 hover:opacity-100 transition-opacity">
          <ThemeSwitcher />
        </div>

        <button className="w-full mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-3 py-2.5 rounded-lg transition-all"
          style={{
            color: 'var(--accent-rose)',
            background: 'rgba(239, 68, 68, 0.05)',
          }}>
          <LogOut size={12} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}