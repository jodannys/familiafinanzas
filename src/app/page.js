'use client'
import { useState, useEffect, useMemo } from 'react'
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
  deseo: 'var(--accent-violet)',
  ahorro: 'var(--accent-green)',
  inversion: 'var(--accent-gold)',
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
  if (dias <= 3) return {
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'var(--accent-rose)',
    text: 'var(--accent-rose)',
    label: dias === 0 ? '¡Hoy!' : `${dias}d`
  }
  return {
    bg: 'rgba(193, 122, 58, 0.1)',
    border: 'var(--accent-terra)',
    text: 'var(--accent-terra)',
    label: `${dias}d`
  }
}

export default function Dashboard() {
  const [movs, setMovs] = useState([])
  const [metas, setMetas] = useState([])
  const [deudas, setDeudas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  // 1. CARGAR DATOS
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
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  // 2. CÁLCULOS (Deben ir ANTES de cualquier return condicional)
  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  const movsMes = useMemo(() => {
    return movs.filter(m => {
      const [year, month] = m.fecha.split('-').map(Number)
      return month - 1 === mesActual && year === añoActual
    })
  }, [movs, mesActual, añoActual])

  // SUSTITUYE POR:
  const dataGraficoReal = useMemo(() => {
    if (!movs || movs.length === 0) return []

    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    const porMes = Array.from({ length: 12 }, (_, i) => ({
      name: MESES[i],
      gastos: 0,
      ingresos: 0,
    }))

    movs.forEach(mov => {
      const mes = parseInt(mov.fecha.split('-')[1], 10) - 1  // 0-11, sin UTC
      const año = parseInt(mov.fecha.split('-')[0], 10)
      if (año !== añoActual || mes < 0 || mes > 11) return
      if (mov.tipo === 'egreso') {
        porMes[mes].gastos += (mov.monto || 0)
      } else if (mov.tipo === 'ingreso') {
        porMes[mes].ingresos += (mov.monto || 0)
      }
    })

    return porMes
  }, [movs, añoActual])

  // Lógica de KPIs y Alertas
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

  // 3. RETURNS CONDICIONALES (Siempre al final de los Hooks)
  if (!mounted) return null

  if (loading) return (
    <AppShell>
      <div className="flex h-[70vh] items-center justify-center flex-col gap-6">
        <Loader2 className="animate-spin" size={48} style={{ color: 'var(--accent-green)' }} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Actualizando Patrimonio...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <h1 className="text-3xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
          Resumen General
        </h1>
        <p className="text-[11px] font-bold opacity-50 uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-secondary)' }}>
          {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {alertasDeuda.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {alertasDeuda.map(d => {
            const urg = urgenciaAlerta(d.dias)
            return (
              <div key={d.id}
                className="relative flex items-center gap-4 p-5 rounded-[30px] border shadow-sm transition-transform hover:scale-[1.01]"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: urg.text }} />
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-inner" style={{ background: urg.bg }}>{d.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-black uppercase opacity-40">Vence en {urg.label}</p>
                    <span className="text-sm font-black tabular-nums" style={{ color: urg.text }}>{formatCurrency(d.cuota)}</span>
                  </div>
                  <p className="text-base font-bold truncate tracking-tight" style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Ingresos', val: ingresosMes, icon: ArrowUpRight, col: 'var(--accent-green)' },
          { label: 'Gastos', val: gastosMes, icon: ArrowDownRight, col: 'var(--accent-rose)' },
          { label: 'Metas', val: totalAhorrado, icon: Target, col: 'var(--accent-terra)' },
          { label: 'Saldo Libre', val: saldo, icon: Wallet, col: 'var(--accent-blue)' },
        ].map((kpi, i) => (
          <div key={i} className="p-6 rounded-[35px] border shadow-sm flex flex-col justify-between min-h-[140px]"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-2 opacity-60">
              <div className="p-1.5 rounded-lg" style={{ background: `${kpi.col}15` }}>
                <kpi.icon size={14} style={{ color: kpi.col }} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">{kpi.label}</p>
            </div>
            <p className="text-2xl font-black tabular-nums tracking-tighter mt-4" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(kpi.val)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-2">
          <FinanceChart data={dataGraficoReal} />
        </div>

        <div className="p-8 rounded-[40px] border shadow-sm flex flex-col"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
          <h3 className="font-black text-[11px] uppercase tracking-[0.2em] opacity-40 mb-8" style={{ color: 'var(--text-secondary)' }}>
            Distribución
          </h3>
          <div className="space-y-7 flex-1 flex flex-col justify-center">
            {distribucionReal.length > 0 ? distribucionReal.map(d => (
              <div key={d.name} className="group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold capitalize opacity-70" style={{ color: 'var(--text-primary)' }}>{d.name}</span>
                  <span className="text-[11px] font-black" style={{ color: 'var(--text-primary)' }}>{d.value}%</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${d.value}%`, background: d.color }} />
                </div>
              </div>
            )) : (
              <p className="text-center text-[10px] opacity-30 font-bold uppercase italic">Sin egresos este mes</p>
            )}
          </div>
        </div>
      </div>

      <div className="p-8 rounded-[40px] border shadow-sm"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-black text-[11px] uppercase tracking-[0.2em] opacity-40" style={{ color: 'var(--text-secondary)' }}>
            Objetivos de Ahorro
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-10">
          {metas.map(m => (
            <div key={m.id} className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getFlagEmoji(m.emoji)}</span>
                  <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{m.nombre}</span>
                </div>
                <span className="text-[10px] font-black opacity-40 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {formatCurrency(m.actual)} / {formatCurrency(m.meta)}
                </span>
              </div>
              <ProgressBar value={m.actual} max={m.meta} color={m.color} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}