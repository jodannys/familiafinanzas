'use client'
import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import {
  Wallet, Target, Loader2, ArrowUpRight, ArrowDownRight,
  TrendingUp, CircleDollarSign, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'
import { FinanceChart } from '@/components/ui/FinanceChart'
import Link from 'next/link'

const COLORES_CAT = {
  basicos: 'var(--accent-blue)',
  deseo: 'var(--accent-violet)',
  ahorro: 'var(--accent-green)',
  inversion: 'var(--accent-gold)',
  deuda: 'var(--accent-rose)',
}

const NOMBRES_CAT = {
  basicos: 'Necesidades',
  deseo: 'Estilo de vida',
  deuda: 'Deudas',
  ahorro: 'Ahorro',
  inversion: 'Inversión',
}

function saludo() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  if (diaPago >= hoy) return diaPago - hoy
  const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  return (ultimoDiaMes - hoy) + diaPago
}

export default function Dashboard() {
  const [movs, setMovs]           = useState([])
  const [metas, setMetas]         = useState([])
  const [deudas, setDeudas]       = useState([])
  const [inversiones, setInversiones] = useState([])
  const [loading, setLoading]     = useState(true)
  const [mounted, setMounted]     = useState(false)

  useEffect(() => {
    setMounted(true)
    async function cargar() {
      try {
        const [{ data: m }, { data: mt }, { data: d }, { data: inv }] = await Promise.all([
          supabase.from('movimientos').select('*')
            .gte('fecha', `${new Date().getFullYear()}-01-01`)
            .order('fecha', { ascending: false }),
          supabase.from('metas').select('*').order('created_at'),
          supabase.from('deudas').select('*').eq('estado', 'activa'),
          supabase.from('inversiones').select('*').order('created_at'),
        ])
        setMovs(m || [])
        setMetas(mt || [])
        setDeudas(d || [])
        setInversiones(inv || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const now        = new Date()
  const mesActual  = now.getMonth()
  const añoActual  = now.getFullYear()

  const movsMes = useMemo(() =>
    movs.filter(m => {
      const [year, month] = m.fecha.split('-').map(Number)
      return month - 1 === mesActual && year === añoActual
    }), [movs, mesActual, añoActual])

  const ultimosMovs = useMemo(() => movsMes.slice(0, 6), [movsMes])

  const dataGrafico = useMemo(() => {
    if (!movs.length) return []
    const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const porMes = Array.from({ length: 12 }, (_, i) => ({ name: MESES[i], gastos: 0, ingresos: 0 }))
    movs.forEach(mov => {
      const mes = parseInt(mov.fecha.split('-')[1], 10) - 1
      const año = parseInt(mov.fecha.split('-')[0], 10)
      if (año !== añoActual || mes < 0 || mes > 11) return
      if (mov.tipo === 'ingreso') porMes[mes].ingresos += (mov.monto || 0)
      else if (['basicos','deseo','deuda'].includes(mov.categoria)) porMes[mes].gastos += (mov.monto || 0)
    })
    return porMes
  }, [movs, añoActual])

  const ingresosMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const gastosMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'egreso' && ['deseo','basicos','deuda'].includes(m.categoria))
      .reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const ahorroMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'egreso' && ['ahorro','inversion'].includes(m.categoria))
      .reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const saldoLibre = ingresosMes - gastosMes - ahorroMes

  const distribucionReal = useMemo(() => {
    const totales = {}
    movsMes.filter(m => m.tipo === 'egreso' && ['basicos','deseo','deuda'].includes(m.categoria))
      .forEach(m => { totales[m.categoria] = (totales[m.categoria] || 0) + m.monto })
    return Object.entries(totales)
      .map(([name, monto]) => ({
        name, monto,
        pct: Math.round((monto / (gastosMes || 1)) * 100),
        color: COLORES_CAT[name] || 'var(--text-muted)',
      }))
      .sort((a, b) => b.monto - a.monto)
  }, [movsMes, gastosMes])

  const deudasPagadas = useMemo(() => new Set(
    movsMes.filter(m => m.tipo === 'egreso' && m.categoria === 'deuda' && m.deuda_id).map(m => m.deuda_id)
  ), [movsMes])

  const alertas = useMemo(() =>
    deudas
      .map(d => ({ ...d, dias: diasHastaPago(d.dia_pago) }))
      .filter(d => d.dias !== null && d.dias <= 7 && !deudasPagadas.has(d.id))
      .sort((a, b) => a.dias - b.dias)
  , [deudas, deudasPagadas])

  // Patrimonio
  const totalAhorro      = useMemo(() => metas.reduce((s, m) => s + (m.actual || 0), 0), [metas])
  const totalInversiones = useMemo(() => inversiones.reduce((s, i) => s + (i.capital || 0), 0), [inversiones])
  const totalDeudas      = useMemo(() => deudas.reduce((s, d) => s + (d.cuota || 0), 0), [deudas])

  const pctGastos   = ingresosMes > 0 ? Math.min(100, Math.round((gastosMes  / ingresosMes) * 100)) : 0
  const pctAhorro   = ingresosMes > 0 ? Math.min(100, Math.round((ahorroMes  / ingresosMes) * 100)) : 0
  const pctDisp     = ingresosMes > 0 ? Math.min(100, Math.round((Math.abs(saldoLibre) / ingresosMes) * 100)) : 0

  if (!mounted) return null
  if (loading) return (
    <AppShell>
      <div className="flex h-[70vh] items-center justify-center flex-col gap-6">
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-green)' }} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-40">Cargando patrimonio...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
 
      {/* ── Header ── */}
      <div className="mb-7 animate-enter">
        <p className="text-[5px] uppercase tracking-widest font-bold mb-0.5"  style={{ fontSize: 8, color: 'var(--text-muted)' }}>
          {saludo()} · {now.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-2xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Resumen General
        </h1>

        {/* Strip patrimonio */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'En metas',  val: totalAhorro,      color: 'var(--accent-green)',  Icon: Target,          href: '/metas'      },
            { label: 'Invertido', val: totalInversiones,  color: 'var(--accent-violet)', Icon: TrendingUp,      href: '/inversiones' },
            { label: 'Deudas',    val: totalDeudas,       color: 'var(--accent-rose)',   Icon: CircleDollarSign, href: '/deudas'     },
          ].map(({ label, val, color, Icon, href }) => (
            <Link key={label} href={href}
              className="flex flex-col gap-1.5 p-3 rounded-2xl transition-all hover:scale-[1.02]"
              style={{
                background: `color-mix(in srgb, ${color} 7%, var(--bg-card))`,
                border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
                textDecoration: 'none',
              }}>
              <div className="flex items-center gap-1">
                <Icon size={9} style={{ color }} />
                <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color }}>{label}</span>
              </div>
              <p className="font-semibold tracking-tight" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {formatCurrency(val)}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Alertas deuda ── */}
      {alertas.length > 0 && (
        <div className="space-y-2 mb-7">
          {alertas.map(d => {
            const color = d.dias <= 3 ? 'var(--accent-rose)' : 'var(--accent-terra)'
            return (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{
                  background: `color-mix(in srgb, ${color} 7%, var(--bg-card))`,
                  border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
                }}>
                <span className="text-base flex-shrink-0">{d.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                  <p style={{ fontSize: 10, color }}>
                    {d.dias === 0 ? '¡Vence hoy!' : `Vence en ${d.dias} día${d.dias !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <span className="text-sm font-semibold flex-shrink-0" style={{ color }}>{formatCurrency(d.cuota)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        {[
          { label: 'Ingresos',   val: ingresosMes, col: 'var(--accent-green)',                                         Icon: ArrowUpRight,   signo: '+', pct: 100   },
          { label: 'Gastos',     val: gastosMes,   col: 'var(--accent-rose)',                                          Icon: ArrowDownRight, signo: '-', pct: pctGastos },
          { label: 'Futuro',     val: ahorroMes,   col: 'var(--accent-terra)',                                         Icon: Target,         signo: '',  pct: pctAhorro },
          { label: 'Disponible', val: saldoLibre,  col: saldoLibre >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', Icon: Wallet,         signo: '',  pct: pctDisp   },
        ].map((k, i) => (
          <div key={i} className="animate-enter"
            style={{
              background: 'var(--bg-card)', borderRadius: 24, padding: '18px 18px 14px',
              minHeight: 118, border: '1px solid var(--border-glass)',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              animationDelay: `${i * 0.06}s`,
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>
                {k.label}
              </span>
              <div style={{
                width: 26, height: 26, borderRadius: 9, flexShrink: 0,
                background: `color-mix(in srgb, ${k.col} 12%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <k.Icon size={12} style={{ color: k.col }} strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <p className="font-serif" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 8 }}>
                {k.signo}{formatCurrency(Math.abs(k.val))}
              </p>
              <div style={{ height: 3, borderRadius: 999, background: `color-mix(in srgb, ${k.col} 12%, transparent)`, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${k.pct}%`, background: k.col, borderRadius: 999 }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Gráfico + Últimos movimientos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">

        <div className="lg:col-span-2">
          <FinanceChart data={dataGrafico} />
        </div>

        {/* Últimos movimientos */}
        <div className="flex flex-col rounded-[28px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
              Últimos movimientos
            </p>
            <Link href="/gastos" style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex-1">
            {ultimosMovs.length === 0 ? (
              <p className="text-center text-xs italic py-8" style={{ color: 'var(--text-muted)' }}>Sin movimientos este mes</p>
            ) : ultimosMovs.map((m, idx) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5"
                style={{ borderBottom: idx < ultimosMovs.length - 1 ? '1px solid var(--border-glass)' : 'none' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${m.tipo === 'ingreso' ? 'var(--accent-green)' : COLORES_CAT[m.categoria] || 'var(--text-muted)'} 12%, transparent)` }}>
                  {m.tipo === 'ingreso'
                    ? <ArrowUpRight size={12} style={{ color: 'var(--accent-green)' }} />
                    : <ArrowDownRight size={12} style={{ color: COLORES_CAT[m.categoria] || 'var(--text-muted)' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                    {m.descripcion || NOMBRES_CAT[m.categoria] || m.categoria}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, flexShrink: 0, color: m.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                  {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Distribución + Metas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Distribución */}
        <div className="rounded-[28px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
              Distribución del mes
            </p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {distribucionReal.length > 0 ? distribucionReal.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {NOMBRES_CAT[d.name] || d.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCurrency(d.monto)}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-primary)' }}>{d.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 3, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${d.pct}%`, background: d.color, borderRadius: 999, transition: 'width 1s cubic-bezier(0.2,0,0.2,1)' }} />
                </div>
              </div>
            )) : (
              <p className="text-center text-xs italic py-6" style={{ color: 'var(--text-muted)' }}>Sin egresos este mes</p>
            )}
          </div>
        </div>

        {/* Metas */}
        <div className="lg:col-span-2 rounded-[28px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
              Metas de Ahorro
            </p>
            <Link href="/metas" style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <ChevronRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1, background: 'var(--border-glass)' }}>
            {metas.filter(m => m.estado !== 'pausada' && (m.actual || 0) < m.meta).length === 0 ? (
              <div style={{ background: 'var(--bg-card)', padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin metas activas</p>
              </div>
            ) : metas.filter(m => m.estado !== 'pausada' && (m.actual || 0) < m.meta).map(m => {
              const pct = Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100))
              return (
                <div key={m.id} style={{ background: 'var(--bg-card)', padding: '18px 20px' }}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div style={{
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                      background: `${m.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                    }}>
                      {getFlagEmoji(m.emoji)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{m.nombre}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {formatCurrency(m.actual || 0)} / {formatCurrency(m.meta)}
                      </p>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.04em', color: m.color, flexShrink: 0 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 999, transition: 'width 1.2s cubic-bezier(0.2,0,0.2,1)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </AppShell>
  )
}
