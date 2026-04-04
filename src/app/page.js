'use client'
import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import {
  Target, TrendingUp, CircleDollarSign, ChevronRight, AlertTriangle,
  CheckCircle2, Info, XCircle, TriangleAlert, Gauge,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getFlagEmoji, diasHastaPago } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { FinanceChart } from '@/components/ui/FinanceChart'
import AgendaWidget from '@/components/agenda/AgendaWidget'
import Link from 'next/link'
import { generarInsights } from '@/lib/insights'

// ── Constantes ────────────────────────────────────────────────────────────────

const COLORES_CAT = {
  basicos:   'var(--accent-blue)',
  deseo:     'var(--accent-violet)',
  ahorro:    'var(--accent-green)',
  inversion: 'var(--accent-gold)',
  deuda:     'var(--accent-rose)',
}

const NOMBRES_CAT = {
  basicos:   'Básicos',
  deseo:     'Estilo de vida',
  deuda:     'Deudas',
  ahorro:    'Ahorro',
  inversion: 'Inversión',
}

const EMOJI_CAT = {
  basicos:   '🏠',
  deseo:     '✨',
  ahorro:    '💰',
  inversion: '📈',
  deuda:     '💳',
  ingreso:   '💵',
}

const MESES_NOMBRE = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function saludoBase(nombre) {
  const h = new Date().getHours()
  let saludo = ''
  let emoji = ''
  if (h >= 6 && h < 12)       { saludo = 'buenos días';   emoji = '☕' }
  else if (h >= 12 && h < 20) { saludo = 'buenas tardes'; emoji = '☀️' }
  else                         { saludo = 'buenas noches'; emoji = (h >= 20 || h < 5) ? '🌙' : '✨' }
  return nombre
    ? `Hola ${nombre}, ${saludo} ${emoji}`
    : `${saludo.charAt(0).toUpperCase() + saludo.slice(1)} ${emoji}`
}

function groupByDay(movs) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const ayer = new Date(today); ayer.setDate(today.getDate() - 1)
  const groups = {}
  movs.forEach(m => {
    const d = new Date(m.fecha + 'T00:00:00'); d.setHours(0, 0, 0, 0)
    let label
    if (d.getTime() === today.getTime()) label = 'Hoy'
    else if (d.getTime() === ayer.getTime()) label = 'Ayer'
    else label = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
    if (!groups[label]) groups[label] = []
    groups[label].push(m)
  })
  return groups
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ w = '100%', h = 16, r = 10, style = {} }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-3">
        <Sk w="120px" h={10} />
        <Sk w="220px" h={28} r={8} />
      </div>

      {/* Health bar */}
      <Sk w="100%" h={36} r={16} />

      {/* Patrimonio strip */}
      <div className="grid grid-cols-3 gap-2.5">
        {[1,2,3].map(i => <Sk key={i} h={72} r={24} />)}
      </div>

      {/* Hero card */}
      <Sk h={130} r={32} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(i => <Sk key={i} h={118} r={24} />)}
      </div>

      {/* Agenda */}
      <Sk h={90} r={24} />

      {/* Gráfico + movimientos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Sk style={{ gridColumn: 'span 2' }} h={260} r={28} />
        <Sk h={260} r={28} />
      </div>

      {/* Distribución + metas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Sk h={200} r={28} />
        <Sk style={{ gridColumn: 'span 2' }} h={200} r={28} />
      </div>
    </div>
  )
}

// ── Panel de Insights ─────────────────────────────────────────────────────────

const INSIGHT_ICON = {
  ok:     CheckCircle2,
  warn:   TriangleAlert,
  danger: XCircle,
  info:   Info,
}

const INSIGHT_COLOR = {
  ok:     'var(--accent-green)',
  warn:   'var(--accent-gold)',
  danger: 'var(--accent-rose)',
  info:   'var(--accent-blue)',
}

function InsightRow({ insight }) {
  const Icon  = INSIGHT_ICON[insight.type] || Info
  const color = INSIGHT_COLOR[insight.type] || 'var(--text-muted)'
  return (
    <div
      className="flex items-start gap-3 px-5 py-3.5"
      style={{ borderBottom: '1px solid var(--border-glass)' }}
    >
      <div
        className="flex-shrink-0 mt-0.5"
        style={{
          width: 28, height: 28, borderRadius: 9,
          background: `color-mix(in srgb, ${color} 12%, var(--bg-secondary))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon size={13} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
          {insight.titulo}
        </p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
          {insight.detalle}
        </p>
        {insight.accion && insight.href && (
          <Link
            href={insight.href}
            style={{
              display: 'inline-block', marginTop: 5,
              fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
              letterSpacing: '0.1em', color,
              textDecoration: 'none',
            }}
          >
            {insight.accion} →
          </Link>
        )}
      </div>
    </div>
  )
}

function InsightsPanel({ movsMes, metas, deudas, inversiones }) {
  const { insights, score, label, color } = useMemo(
    () => generarInsights({ movsMes, metas, deudas, inversiones }),
    [movsMes, metas, deudas, inversiones]
  )

  return (
    <div
      className="rounded-[28px] overflow-hidden mb-7 animate-enter"
      style={{
        animationDelay: '0.25s',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
      }}
    >
      {/* Cabecera con score */}
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border-glass)' }}
      >
        <div className="flex items-center gap-2">
          <Gauge size={13} style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
            Salud financiera
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            style={{
              height: 4, width: 64, borderRadius: 999,
              background: 'var(--progress-track)', overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%', width: `${score}%`,
                background: color, borderRadius: 999,
                transition: 'width 1.2s cubic-bezier(0.2,0,0.2,1)',
              }}
            />
          </div>
          <span style={{ fontSize: 11, fontWeight: 900, color, letterSpacing: '-0.02em' }}>
            {score}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {label}
          </span>
        </div>
      </div>

      {/* Lista de insights */}
      <div>
        {insights.map(ins => (
          <InsightRow key={ins.id} insight={ins} />
        ))}
      </div>
    </div>
  )
}

// ── Barra de salud financiera ─────────────────────────────────────────────────

function HealthBar({ pctGastos, pctAhorro, pctDisp, saldoLibre, ingresosMes }) {
  if (ingresosMes === 0) return null
  const pctLibre = Math.max(0, 100 - pctGastos - pctAhorro)
  const libreColor = saldoLibre >= 0 ? 'var(--accent-blue)' : 'var(--accent-rose)'

  return (
    <div className="mb-7 animate-enter" style={{ animationDelay: '0.08s' }}>
      {/* Barra segmentada */}
      <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', display: 'flex', gap: 2, background: 'var(--bg-secondary)' }}>
        <div style={{ width: `${pctGastos}%`, background: 'var(--accent-rose)', borderRadius: 999, transition: 'width 1s ease-out', flexShrink: 0 }} />
        <div style={{ width: `${pctAhorro}%`, background: 'var(--accent-gold)',  borderRadius: 999, transition: 'width 1s ease-out 0.1s', flexShrink: 0 }} />
        <div style={{ width: `${pctLibre}%`,  background: libreColor,            borderRadius: 999, transition: 'width 1s ease-out 0.2s', flexShrink: 0 }} />
      </div>
      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-2">
        {[
          { label: 'Gastos',  pct: pctGastos, color: 'var(--accent-rose)' },
          { label: 'Ahorro',  pct: pctAhorro, color: 'var(--accent-gold)' },
          { label: 'Libre',   pct: pctLibre,  color: libreColor },
        ].map(({ label, pct, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              {label} <span style={{ color, fontWeight: 900 }}>{pct}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [movs, setMovs]             = useState([])
  const [metas, setMetas]           = useState([])
  const [deudas, setDeudas]         = useState([])
  const [inversiones, setInversiones] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [mounted, setMounted]       = useState(false)
  const [nombre, setNombre]         = useState('')

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setNombre(session?.user?.user_metadata?.nombre || '')
    })
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
        console.error('Error cargando dashboard:', err)
        setError('No se pudieron cargar los datos. Revisa tu conexión e intenta de nuevo.')
        toast('Error cargando datos del dashboard')
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const now       = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()
  const mesNombre = MESES_NOMBRE[mesActual]

  const movsMes = useMemo(() =>
    movs.filter(m => {
      if (!m.fecha) return false
      const [year, month] = m.fecha.split('-').map(Number)
      return month - 1 === mesActual && year === añoActual
    }), [movs, mesActual, añoActual])

  const ultimosMovs = useMemo(() => movsMes.slice(0, 6), [movsMes])

  const dataGrafico = useMemo(() => {
    if (!movs.length) return []
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const porMes = Array.from({ length: 12 }, (_, i) => ({ name: MESES[i], gastos: 0, ingresos: 0 }))
    movs.forEach(mov => {
      if (!mov.fecha) return
      const mes = parseInt(mov.fecha.split('-')[1], 10) - 1
      const año = parseInt(mov.fecha.split('-')[0], 10)
      if (año !== añoActual || mes < 0 || mes > 11) return
      if (mov.tipo === 'ingreso') porMes[mes].ingresos += (mov.monto || 0)
      else if (['basicos', 'deseo', 'deuda'].includes(mov.categoria)) porMes[mes].gastos += (mov.monto || 0)
    })
    return porMes
  }, [movs, añoActual])

  const ingresosMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const gastosMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'egreso' && ['deseo', 'basicos', 'deuda'].includes(m.categoria))
      .reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const ahorroMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria))
      .reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const saldoLibre = ingresosMes - gastosMes - ahorroMes

  const distribucionReal = useMemo(() => {
    const totales = {}
    movsMes.filter(m => m.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(m.categoria))
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
      .map(d => ({ ...d, dias: diasHastaPago(d) }))
      .filter(d => d.dias !== null && d.dias <= 7 && !deudasPagadas.has(d.id))
      .sort((a, b) => a.dias - b.dias)
  , [deudas, deudasPagadas])

  const totalAhorro      = useMemo(() => metas.reduce((s, m) => s + (m.actual || 0), 0), [metas])
  const totalInversiones = useMemo(() => inversiones.reduce((s, i) => s + (i.capital || 0), 0), [inversiones])
  const totalDeudas      = useMemo(() => deudas.reduce((s, d) => s + (d.pendiente || 0), 0), [deudas])

  const pctGastos = ingresosMes > 0 ? Math.min(100, Math.round((gastosMes / ingresosMes) * 100)) : 0
  const pctAhorro = ingresosMes > 0 ? Math.min(100, Math.round((ahorroMes / ingresosMes) * 100)) : 0
  const pctDisp   = ingresosMes > 0 ? Math.min(100, Math.round((Math.abs(saldoLibre) / ingresosMes) * 100)) : 0

  const movsAgrupados = useMemo(() => groupByDay(ultimosMovs), [ultimosMovs])

  if (!mounted) return null
  if (loading) return <AppShell><DashboardSkeleton /></AppShell>

  if (error) return (
    <AppShell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, padding: 24, textAlign: 'center' }}>
        <AlertTriangle size={48} style={{ color: 'var(--accent-rose)' }} />
        <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 16 }}>{error}</p>
        <button
          onClick={() => { setError(null); setLoading(true); location.reload() }}
          style={{ padding: '10px 24px', borderRadius: 12, background: 'var(--accent-blue)', color: '#fff', fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </div>
    </AppShell>
  )

  return (
    <AppShell>

      {/* ── Header ── */}
      <div className="mb-6 animate-enter">
        <p className="uppercase tracking-[0.3em] font-black mb-2"
          style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.7 }}>
          {now.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="font-script" style={{
          fontSize: 32, color: 'var(--text-primary)',
          fontWeight: 400, lineHeight: 1.1,
          fontFamily: "'Sacramento', cursive",
        }}>
          {saludoBase(nombre)}
        </h1>
      </div>

      {/* ── Barra de salud financiera ── */}
      <HealthBar
        pctGastos={pctGastos}
        pctAhorro={pctAhorro}
        pctDisp={pctDisp}
        saldoLibre={saldoLibre}
        ingresosMes={ingresosMes}
      />

      {/* ── Strip de patrimonio ── */}
      <div className="grid grid-cols-3 gap-2.5 mb-7 animate-enter" style={{ animationDelay: '0.1s' }}>
        {[
          { label: 'En metas',  val: totalAhorro,      color: 'var(--accent-green)',  Icon: Target,          href: '/metas' },
          { label: 'Invertido', val: totalInversiones,  color: 'var(--accent-violet)', Icon: TrendingUp,      href: '/inversiones' },
          { label: 'Deudas',    val: totalDeudas,       color: 'var(--accent-rose)',   Icon: CircleDollarSign,href: '/deudas' },
        ].map(({ label, val, color, Icon, href }) => (
          <Link key={label} href={href}
            className="flex flex-col gap-2 p-3.5 rounded-[24px] transition-all active:scale-95 border"
            style={{
              background: `color-mix(in srgb, ${color} 6%, var(--bg-card))`,
              borderColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              textDecoration: 'none',
            }}>
            <div className="flex items-center gap-1.5" style={{ opacity: 0.6 }}>
              <Icon size={10} style={{ color }} />
              <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>{label}</span>
            </div>
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              {formatCurrency(val)}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Hero card: Balance del mes ── */}
      <div className="mb-7 animate-enter" style={{
        animationDelay: '0.15s',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        padding: 24,
        boxShadow: 'var(--shadow-sm)',
      }}>
        <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: 6 }}>
          Ingresos — {mesNombre}
        </p>
        <p style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: 'var(--text-primary)', marginBottom: 20 }}>
          {formatCurrency(ingresosMes)}
        </p>
        <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border-glass)', paddingTop: 16 }}>
          {[
            { label: 'Gastos', val: gastosMes,            color: 'var(--accent-rose)',                                                prefix: '−' },
            { label: 'Ahorro', val: ahorroMes,            color: 'var(--accent-gold)',                                                prefix: ''  },
            { label: 'Libre',  val: Math.abs(saldoLibre), color: saldoLibre >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',      prefix: saldoLibre < 0 ? '−' : '' },
          ].map(({ label, val, color, prefix }, i) => (
            <div key={label} style={{ flex: 1, paddingRight: i < 2 ? 16 : 0, borderRight: i < 2 ? '1px solid var(--border-glass)' : 'none', marginRight: i < 2 ? 16 : 0 }}>
              <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-0.03em', color }}>{prefix}{formatCurrency(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Alerta saldo negativo ── */}
      {saldoLibre < 0 && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-7 animate-enter"
          style={{
            background: 'color-mix(in srgb, var(--accent-rose) 8%, var(--bg-card))',
            border: '1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)',
          }}>
          <AlertTriangle size={16} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
          <div className="flex-1">
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-rose)' }}>Saldo en rojo este mes</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
              Estás {formatCurrency(Math.abs(saldoLibre))} por encima de tus ingresos.
            </p>
          </div>
        </div>
      )}

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
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                  <p style={{ fontSize: 10, color }}>
                    {d.dias === 0 ? '¡Vence hoy!' : `Vence en ${d.dias} día${d.dias !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, flexShrink: 0, color }}>{formatCurrency(d.cuota)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Agenda widget ── */}
      <div className="mb-7">
        <AgendaWidget />
      </div>

      {/* ── Gráfico + Últimos movimientos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">

        <div className="lg:col-span-2">
          <FinanceChart data={dataGrafico} />
        </div>

        {/* Movimientos agrupados por día */}
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

          {ultimosMovs.length === 0 ? (
            <p className="text-center text-xs italic py-8" style={{ color: 'var(--text-muted)' }}>Sin movimientos este mes</p>
          ) : (
            <div className="flex-1">
              {Object.entries(movsAgrupados).map(([dayLabel, items]) => (
                <div key={dayLabel}>
                  {/* Separador de día */}
                  <div className="px-5 py-1.5" style={{ background: 'var(--bg-secondary)' }}>
                    <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                      {dayLabel}
                    </p>
                  </div>
                  {items.map((m, idx) => {
                    const catColor = m.tipo === 'ingreso' ? 'var(--accent-green)' : (COLORES_CAT[m.categoria] || 'var(--text-muted)')
                    const emoji = m.tipo === 'ingreso' ? EMOJI_CAT.ingreso : (EMOJI_CAT[m.categoria] || '💸')
                    return (
                      <div key={m.id} className="flex items-center gap-3 px-5 py-2.5"
                        style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        <div className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: 32, height: 32, borderRadius: 12, fontSize: 15,
                            background: `color-mix(in srgb, ${catColor} 10%, var(--bg-secondary))`,
                          }}>
                          {emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {m.descripcion || NOMBRES_CAT[m.categoria] || m.categoria}
                          </p>
                          <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {NOMBRES_CAT[m.categoria] || m.categoria}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 900, flexShrink: 0, color: m.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                          {m.tipo === 'ingreso' ? '+' : '−'}{formatCurrency(m.monto)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel de Insights ── */}
      <InsightsPanel
        movsMes={movsMes}
        metas={metas}
        deudas={deudas}
        inversiones={inversiones}
      />

      {/* ── Distribución + Metas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

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
                <div style={{ height: 4, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
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
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 1, background: 'var(--border-glass)' }}>
            {metas.filter(m => m.estado !== 'pausada' && (m.actual || 0) < m.meta).length === 0 ? (
              <div style={{ background: 'var(--bg-card)', padding: '28px 20px', textAlign: 'center', gridColumn: 'span 2' }}>
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
                  <div style={{ height: 4, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
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
