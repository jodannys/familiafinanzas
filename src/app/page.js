'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { ProgressBar } from '@/components/ui/Card'
import {
  Wallet, Target, Loader2, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'
import { FinanceChart } from '@/components/ui/FinanceChart'

const COLORES_CAT = {
  basicos: 'var(--accent-blue)',
  deseo: 'var(--accent-violet, #a78bfa)',
  ahorro: 'var(--accent-green)',
  inversion: 'var(--accent-gold, #f59e0b)',
  deuda: 'var(--accent-rose)',
}

function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  if (diaPago >= hoy) return diaPago - hoy
  const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  return (ultimoDiaMes - hoy) + diaPago
}

function urgenciaAlerta(dias) {
  if (dias <= 3) return { bg: 'rgba(192,96,90,0.1)', border: 'rgba(192,96,90,0.3)', text: 'var(--accent-rose)', label: dias === 0 ? '¡Hoy!' : `${dias}d` }
  return { bg: 'rgba(193,122,58,0.1)', border: 'rgba(193,122,58,0.3)', text: 'var(--accent-terra)', label: `${dias}d` }
}

export default function Dashboard() {
  const [movs, setMovs] = useState([])
  const [metas, setMetas] = useState([])
  const [deudas, setDeudas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    async function cargar() {
      try {
        const [{ data: m }, { data: mt }, { data: d }] = await Promise.all([
          supabase.from('movimientos').select('*').order('fecha', { ascending: false }),
          supabase.from('metas').select('*').order('created_at'),
          supabase.from('deudas').select('*').eq('estado', 'activa'),
        ])
        setMovs(m || [])
        setMetas(mt || [])
        setDeudas(d || [])
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    cargar()
  }, [])

  if (!mounted) return null

  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  const movsMes = movs.filter(m => {
    const [year, month] = m.fecha.split('-').map(Number)
    return month - 1 === mesActual && year === añoActual
  })

  const ingresosMes = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0)
  const gastosMes = movsMes.filter(m => m.tipo === 'egreso' && ['deseo', 'basicos', 'deuda'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const ahorroMes = movsMes.filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const egresosMes = gastosMes + ahorroMes
  const saldo = ingresosMes - egresosMes
  const totalAhorrado = metas.reduce((s, m) => s + (m.actual || 0), 0)

  const catTotales = {}
  movsMes.filter(m => m.tipo === 'egreso').forEach(m => {
    catTotales[m.categoria] = (catTotales[m.categoria] || 0) + m.monto
  })
  const distribucionReal = Object.entries(catTotales).map(([name, value]) => ({
    name,
    value: Math.round((value / (egresosMes || 1)) * 100),
    color: COLORES_CAT[name] || 'var(--text-muted)',
  }))

  const alertasDeuda = deudas
    .map(d => ({ ...d, dias: diasHastaPago(d.dia_pago) }))
    .filter(d => d.dias !== null && d.dias <= 7)
    .sort((a, b) => a.dias - b.dias)

  if (loading) return (
    <AppShell>
      <div className="flex h-[70vh] items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-green)' }} />
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* HEADER */}
      <div className="mb-8 animate-enter">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Estado de Cuentas
        </h1>
        <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
          {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ALERTAS DE DEUDA */}
      {alertasDeuda.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 animate-enter">
          {alertasDeuda.map(d => {
            const urg = urgenciaAlerta(d.dias)
            return (
              <div key={d.id} className="relative flex items-center gap-4 p-4 rounded-[24px] border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: urg.text }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: urg.bg }}>{d.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-[9px] font-black uppercase opacity-50">Vence en {urg.label}</p>
                    <span className="text-xs font-black tabular-nums" style={{ color: urg.text }}>{formatCurrency(d.cuota)}</span>
                  </div>
                  <p className="text-sm font-bold truncate">{d.nombre}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Ingresos', val: ingresosMes, icon: ArrowUpRight, col: 'var(--accent-green)' },
          { label: 'Gastos', val: gastosMes, icon: ArrowDownRight, col: 'var(--accent-rose)' },
          { label: 'Metas', val: totalAhorrado, icon: Target, col: 'var(--accent-terra)' },
          { label: 'Saldo Libre', val: saldo, icon: Wallet, col: 'var(--accent-blue)' },
        ].map((kpi, i) => (
          <div key={i} className="p-5 rounded-[32px] border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-2 mb-3 opacity-50">
              <kpi.icon size={14} style={{ color: kpi.col }} />
              <p className="text-[10px] font-black uppercase tracking-[0.1em]">{kpi.label}</p>
            </div>
            <p className="text-xl font-black tabular-nums tracking-tight">{formatCurrency(kpi.val)}</p>
          </div>
        ))}
      </div>

      {/* GRÁFICO + DISTRIBUCIÓN (UNIFICADO) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* GRÁFICA OSCURA (Componente externo) */}
        <div className="lg:col-span-2">
          <FinanceChart />
        </div>

        {/* DISTRIBUCIÓN LATERAL */}
        <div className="p-6 rounded-[32px] border shadow-sm flex flex-col justify-center" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
          <h3 className="font-black text-[10px] uppercase tracking-widest opacity-70 mb-6">Distribución</h3>
          <div className="space-y-6">
            {distribucionReal.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold capitalize opacity-70">{d.name}</span>
                  <span className="text-xs font-black">{d.value}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.value}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* METAS DE AHORRO */}
      <div className="p-6 rounded-[32px] border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
        <h3 className="font-black text-[10px] uppercase tracking-widest opacity-70 mb-6">Metas de Ahorro</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
          {metas.map(m => (
            <div key={m.id}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black">{getFlagEmoji(m.emoji)} {m.nombre}</span>
                <span className="text-[10px] font-bold opacity-50">{formatCurrency(m.actual)} / {formatCurrency(m.meta)}</span>
              </div>
              <ProgressBar value={m.actual} max={m.meta} color={m.color} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}