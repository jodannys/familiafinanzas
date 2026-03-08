'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { ProgressBar } from '@/components/ui/Card'
import { 
  Wallet, Target, Loader2, ArrowUpRight, ArrowDownRight 
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const COLORES_CAT = {
  basicos:   'var(--accent-blue)',
  deseo:     'var(--accent-violet, #a78bfa)',
  ahorro:    'var(--accent-green)',
  inversion: 'var(--accent-gold, #f59e0b)',
  deuda:     'var(--accent-rose)',
}

function generarHistorico(movimientos) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5 + i)
    const mesNum = d.getMonth()
    const añoNum = d.getFullYear()
    const filtrados = movimientos.filter(m => {
      const [year, month] = m.fecha.split('-').map(Number)
      return month - 1 === mesNum && year === añoNum
    })
    return {
      mes: MESES_LABEL[mesNum],
      ingresos: filtrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
      gastos:   filtrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
    }
  })
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
  const gastosMes   = movsMes.filter(m => m.tipo === 'egreso' && ['deseo', 'basicos', 'deuda'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const ahorroMes   = movsMes.filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const egresosMes  = gastosMes + ahorroMes
  const saldo       = ingresosMes - egresosMes
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
      {/* HEADER LIMPIO */}
      <div className="mb-8 animate-enter">
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Estado de Cuentas
        </h1>
        <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
           {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ALERTAS */}
      {alertasDeuda.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 animate-enter">
          {alertasDeuda.map(d => {
            const urg = urgenciaAlerta(d.dias)
            return (
              <div key={d.id} className="relative flex items-center gap-4 p-4 rounded-2xl border shadow-sm overflow-hidden"
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
          <div key={i} className="p-5 rounded-3xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
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
        <div className="lg:col-span-2 p-6 rounded-3xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
          <h3 className="font-black text-xs uppercase tracking-widest opacity-70 mb-8">Flujo de Efectivo</h3>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={generarHistorico(movs)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <defs>
                  <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.15}/><stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-glass)" opacity={0.4} />
                <XAxis dataKey="mes" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontWeight: '700' }} dy={15} />
                <YAxis fontSize={10} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)' }} tickFormatter={v => `${v}€`} width={45} />
                <Tooltip cursor={{stroke: 'var(--border-glass)'}} contentStyle={{ borderRadius: '16px', border: 'none', background: 'var(--bg-card)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="ingresos" stroke="var(--accent-green)" strokeWidth={3} fill="url(#gIng)" dot={{ r: 4, fill: 'var(--accent-green)', stroke: 'var(--bg-card)' }} />
                <Area type="monotone" dataKey="gastos" stroke="var(--accent-rose)" strokeWidth={3} fill="transparent" strokeDasharray="6 6" dot={{ r: 4, fill: 'var(--accent-rose)', stroke: 'var(--bg-card)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DISTRIBUCIÓN LATERAL (COMO ANTES) */}
        <div className="p-6 rounded-3xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
          <h3 className="font-black text-xs uppercase tracking-widest opacity-70 mb-6">Distribución</h3>
          <div className="space-y-5">
            {distribucionReal.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold capitalize opacity-70">{d.name}</span>
                  <span className="text-xs font-black">{d.value}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${d.value}%`, background: d.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* METAS */}
      <div className="p-6 rounded-3xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
        <h3 className="font-black text-xs uppercase tracking-widest opacity-70 mb-6">Metas de Ahorro</h3>
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