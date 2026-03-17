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
    label: dias === 0 ? '¡Hoy!' : `${dias}d`,
  }
  return {
    bg: 'rgba(193, 122, 58, 0.1)',
    border: 'var(--accent-terra)',
    text: 'var(--accent-terra)',
    label: `${dias}d`,
  }
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
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  // ── Movimientos del mes actual ────────────────────────────────────────────
  const movsMes = useMemo(() =>
    movs.filter(m => {
      const [year, month] = m.fecha.split('-').map(Number)
      return month - 1 === mesActual && year === añoActual
    })
    , [movs, mesActual, añoActual])

  // ── Gráfico anual — solo gastos corrientes (sin ahorro/inversión) ─────────
  const dataGraficoReal = useMemo(() => {
    if (!movs || movs.length === 0) return []
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const porMes = Array.from({ length: 12 }, (_, i) => ({ name: MESES[i], gastos: 0, ingresos: 0 }))
    movs.forEach(mov => {
      const mes = parseInt(mov.fecha.split('-')[1], 10) - 1
      const año = parseInt(mov.fecha.split('-')[0], 10)
      if (año !== añoActual || mes < 0 || mes > 11) return
      if (mov.tipo === 'ingreso') {
        porMes[mes].ingresos += (mov.monto || 0)
      } else if (mov.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(mov.categoria)) {
        porMes[mes].gastos += (mov.monto || 0)
      }
    })
    return porMes
  }, [movs, añoActual])

  // ── KPIs del mes ──────────────────────────────────────────────────────────
  const ingresosMes = movsMes
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + (m.monto || 0), 0)

  const gastosMes = movsMes
    .filter(m => m.tipo === 'egreso' && ['deseo', 'basicos', 'deuda'].includes(m.categoria))
    .reduce((s, m) => s + (m.monto || 0), 0)

  const ahorroMes = movsMes
    .filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria))
    .reduce((s, m) => s + (m.monto || 0), 0)

  const egresosMes = gastosMes + ahorroMes
  const saldoLibre = ingresosMes - egresosMes

  // ── Distribución — solo sobre gastos corrientes ───────────────────────────
  const distribucionReal = useMemo(() => {
    const catTotales = {}
    movsMes
      .filter(m => m.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(m.categoria))
      .forEach(m => { catTotales[m.categoria] = (catTotales[m.categoria] || 0) + m.monto })
    return Object.entries(catTotales).map(([name, value]) => ({
      name,
      value: Math.round((value / (gastosMes || 1)) * 100),
      color: COLORES_CAT[name] || 'var(--text-muted)',
    }))
  }, [movsMes, gastosMes])

  // ── Alertas de deuda — excluir las ya pagadas este mes ───────────────────
  const deudasPagadasEsteMes = useMemo(() => new Set(
    movsMes
      .filter(m => m.tipo === 'egreso' && m.categoria === 'deuda' && m.deuda_id)
      .map(m => m.deuda_id)
  ), [movsMes])

  const alertasDeuda = useMemo(() =>
    deudas
      .map(d => ({ ...d, dias: diasHastaPago(d.dia_pago) }))
      .filter(d => d.dias !== null && d.dias <= 7 && !deudasPagadasEsteMes.has(d.id))
      .sort((a, b) => a.dias - b.dias)
    , [deudas, deudasPagadasEsteMes])

  // ── Barras KPI con porcentajes reales ─────────────────────────────────────
  const pctIngresos = ingresosMes > 0 ? 100 : 0
  const pctGastos = ingresosMes > 0 ? Math.min(100, Math.round((gastosMes / ingresosMes) * 100)) : 0
  const pctAhorro = ingresosMes > 0 ? Math.min(100, Math.round((ahorroMes / ingresosMes) * 100)) : 0
  const pctSaldoLibre = ingresosMes > 0 ? Math.min(100, Math.round((Math.abs(saldoLibre) / ingresosMes) * 100)) : 0

  const KPI_CONFIG = [
    { label: 'Ingresos', val: ingresosMes, col: 'var(--accent-green)', icon: ArrowUpRight, signo: '+', pct: pctIngresos },
    { label: 'Gastos', val: gastosMes, col: 'var(--accent-rose)', icon: ArrowDownRight, signo: '-', pct: pctGastos },
    { label: 'Ahorro mes', val: ahorroMes, col: 'var(--accent-terra)', icon: Target, signo: '', pct: pctAhorro },
    { label: 'Saldo Libre', val: saldoLibre, col: saldoLibre >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', icon: Wallet, signo: '', pct: pctSaldoLibre },
  ]

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
      <div className="mb-10 animate-enter">
        <h1 className="text-[20px] font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
          Resumen General
        </h1>
        <p className="text-[11px] font-bold opacity-50 uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-secondary)' }}>
          {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Alertas de deuda ── */}
      {alertasDeuda.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {alertasDeuda.map(d => {
            const urg = urgenciaAlerta(d.dias)
            return (
              <div key={d.id}
                className="relative flex items-center gap-4 p-5 rounded-[30px] border shadow-sm transition-transform hover:scale-[1.01]"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
                <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-[30px]" style={{ background: urg.text }} />
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{ background: urg.bg }}>
                  {d.emoji}
                </div>
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

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {KPI_CONFIG.map((kpi, i) => (
          <div key={i}
            className="relative overflow-hidden flex flex-col justify-between animate-enter"
            style={{
              background: 'var(--bg-card)',
              borderRadius: 28,
              padding: '20px 20px 16px',
              minHeight: 130,
              border: '1px solid var(--border-glass)',
              animationDelay: `${i * 0.06}s`,
            }}>

            {/* Label + icono */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                letterSpacing: '0.18em', color: 'var(--text-muted)',
              }}>
                {kpi.label}
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: 10,
                background: `color-mix(in srgb, ${kpi.col} 12%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <kpi.icon size={13} style={{ color: kpi.col }} strokeWidth={2.5} />
              </div>
            </div>

            {/* Valor + barra */}
            <div>
              <p style={{
                fontSize: 20, fontWeight: 900, letterSpacing: '-0.04em',
                color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 10,
              }}>
                {kpi.signo}{formatCurrency(Math.abs(kpi.val))}
              </p>
              <div style={{
                height: 3, borderRadius: 999,
                background: `color-mix(in srgb, ${kpi.col} 15%, transparent)`,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${kpi.pct}%`,
                  background: kpi.col, borderRadius: 999,
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Gráfico + Distribución ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
        <div className="lg:col-span-2">
          <FinanceChart data={dataGraficoReal} />
        </div>

        {/* Distribución */}
        <div className="flex flex-col rounded-[40px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>

          <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border-glass)' }}>
            <p style={{
              fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
              letterSpacing: '0.2em', color: 'var(--text-muted)',
            }}>
              Distribución
            </p>
          </div>

          <div style={{ padding: '20px 28px 28px', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {distribucionReal.length > 0 ? distribucionReal.map(d => (
              <div key={d.name}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      {d.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    {d.value}%
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${d.value}%`,
                    background: d.color, borderRadius: 999,
                    transition: 'width 1s cubic-bezier(0.2,0,0.2,1)',
                  }} />
                </div>
              </div>
            )) : (
              <p style={{
                textAlign: 'center', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', opacity: 0.3, fontStyle: 'italic',
                color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto',
              }}>Sin egresos este mes</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Metas ── */}
      <div className="rounded-[40px] overflow-hidden mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>

        <div style={{ padding: '24px 32px 20px', borderBottom: '1px solid var(--border-glass)' }}>
          <p style={{
            fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
            letterSpacing: '0.2em', color: 'var(--text-muted)',
          }}>
            Objetivos de Ahorro
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 1,
          background: 'var(--border-glass)',
        }}>
          {metas
            .filter(m => m.estado !== 'pausada' && (m.actual || 0) < m.meta)
            .map(m => {
              const pct = Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100))
              return (
                <div key={m.id} style={{ background: 'var(--bg-card)', padding: '24px 28px' }}>

                  {/* Top: emoji + nombre + porcentaje */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                        background: `${m.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                      }}>
                        {getFlagEmoji(m.emoji)}
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: 800, letterSpacing: '-0.02em',
                        color: 'var(--text-primary)', lineHeight: 1.2,
                      }}>
                        {m.nombre}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 18, fontWeight: 900, letterSpacing: '-0.04em',
                      color: m.color, flexShrink: 0, marginLeft: 8,
                    }}>
                      {pct}%
                    </span>
                  </div>

                  {/* Barra */}
                  <div style={{
                    height: 5, borderRadius: 999,
                    background: 'var(--progress-track)',
                    overflow: 'hidden', marginBottom: 12,
                  }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: m.color, borderRadius: 999,
                      transition: 'width 1.2s cubic-bezier(0.2,0,0.2,1)',
                    }} />
                  </div>

                  {/* Montos */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '-0.02em', color: m.color }}>
                      {formatCurrency(m.actual || 0)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                      / {formatCurrency(m.meta)}
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </AppShell>
  )
}