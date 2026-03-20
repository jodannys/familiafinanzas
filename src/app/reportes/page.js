'use client'
import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell, Legend
} from 'recharts'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_CORTO = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function getCatVars(col) {
  return {
    basicos:   { label: 'Básicos',   color: col.blue,  grupo: 'necesidades' },
    deuda:     { label: 'Deuda',     color: col.rose,  grupo: 'necesidades' },
    deseo:     { label: 'Deseo',     color: col.terra, grupo: 'deseos'      },
    remesa:    { label: 'Remesa',    color: col.terra, grupo: 'deseos'      },
    ahorro:    { label: 'Ahorro',    color: col.green, grupo: 'futuro'      },
    inversion: { label: 'Inversión', color: col.green, grupo: 'futuro'      },
  }
}

// FIX 5: usar el campo bloque (id estable) en vez del nombre
function grupoDeBloque(bloqueId) {
  const id = (bloqueId || '').toLowerCase()
  if (id === 'necesidades') return 'necesidades'
  if (id === 'futuro')      return 'futuro'
  if (id === 'estilo')      return 'deseos'
  // fallback legacy por nombre
  if (id.includes('necesid') || id.includes('basic') || id.includes('esencial')) return 'necesidades'
  if (id.includes('ahorro')  || id.includes('invers') || id.includes('meta') || id.includes('futuro')) return 'futuro'
  if (id.includes('estilo')  || id.includes('deseo')  || id.includes('ocio')) return 'deseos'
  return null
}

function normCat(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Tooltip — recibe colores como prop
function ChartTooltip({ active, payload, label, colores }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: colores.card,
      border: `1px solid ${colores.border}`,
      borderRadius: 12,
      padding: '10px 14px',
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, color: colores.muted, textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 11, fontWeight: 700, color: p.fill || p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function ReportesPage() {
  const [movs, setMovs]       = useState([])
  const [bloques, setBloques] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('todos')
  const [año, setAño]         = useState(new Date().getFullYear())
  const [colores, setColores] = useState({
    green: '', rose: '', blue: '', terra: '', violet: '',
    muted: '', border: '', card: '', track: '',
  })

  // ── Colores del tema ──────────────────────────────────────────────────────
  useEffect(() => {
    function leer() {
      const s = getComputedStyle(document.documentElement)
      const v = (n) => s.getPropertyValue(n).trim()
      setColores({
        green:  v('--accent-green'),
        rose:   v('--accent-rose'),
        blue:   v('--accent-blue'),
        terra:  v('--accent-terra'),
        violet: v('--accent-violet'),
        muted:  v('--text-muted'),
        border: v('--border-glass'),
        card:   v('--bg-card'),
        track:  v('--progress-track'),
      })
    }
    leer()
    window.addEventListener('theme-change', leer)
    return () => window.removeEventListener('theme-change', leer)
  }, [])

  const CAT_VARS = useMemo(() => getCatVars(colores), [colores])

  const GRUPOS_BASE = useMemo(() => ({
    necesidades: { label: 'Necesidades',     color: colores.blue,  targetDefault: 50 },
    deseos:      { label: 'Deseos / Estilo', color: colores.terra, targetDefault: 30 },
    futuro:      { label: 'Ahorro / Inv.',   color: colores.green, targetDefault: 20 },
  }), [colores])

  // FIX 1: presupuesto_bloques no tiene mes/año — quitar esos filtros
  useEffect(() => {
    async function cargar() {
      setLoading(true)
      try {
        const [{ data: movData, error: movErr }, { data: blqData }] = await Promise.all([
          supabase.from('movimientos').select('*')
            .gte('fecha', `${año}-01-01`)
            .lte('fecha', `${año}-12-31`)
            .order('fecha'),
          supabase.from('presupuesto_bloques').select('*'),
        ])
        if (movErr) throw movErr
        setMovs(movData || [])
        setBloques(blqData || [])
      } catch (err) {
        console.error('Error cargando reportes:', err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [año])

  // FIX 4: todos los cálculos derivados memoizados
  const movsAño = useMemo(() =>
    movs.filter(m => new Date(m.fecha).getFullYear() === año)
  , [movs, año])

  const totalIngresos = useMemo(() =>
    movsAño.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  , [movsAño])

  // FIX 2: separar gastos corrientes de ahorro
  const totalGastosCorrientes = useMemo(() =>
    movsAño
      .filter(m => m.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(normCat(m.categoria)))
      .reduce((s, m) => s + m.monto, 0)
  , [movsAño])

  const totalAhorro = useMemo(() =>
    movsAño
      .filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(normCat(m.categoria)))
      .reduce((s, m) => s + m.monto, 0)
  , [movsAño])

  // FIX 2: balance incluye todo; tasa de ahorro = ahorro / ingresos
  const totalGastos = totalGastosCorrientes + totalAhorro
  const balance     = totalIngresos - totalGastos
  const tasaAhorro  = totalIngresos > 0 ? (totalAhorro / totalIngresos) * 100 : 0

  const totalPresupuesto = useMemo(() =>
    bloques.reduce((s, b) => s + (b.monto || 0), 0)
  , [bloques])

  const grupoMetas = useMemo(() => {
    const gm = { necesidades: 50, deseos: 30, futuro: 20 }
    if (totalPresupuesto > 0) {
      const montosPorGrupo = { necesidades: 0, deseos: 0, futuro: 0 }
      bloques.forEach(b => {
        // FIX 5: usar b.bloque (id estable) en vez de b.nombre
        const g = grupoDeBloque(b.bloque)
        if (g) montosPorGrupo[g] += (b.monto || 0)
      })
      Object.keys(gm).forEach(g => {
        if (montosPorGrupo[g] > 0)
          gm[g] = Math.round((montosPorGrupo[g] / totalPresupuesto) * 100)
      })
    }
    return gm
  }, [bloques, totalPresupuesto])

  const catList = useMemo(() => {
    const porCat = {}
    movsAño.filter(m => m.tipo === 'egreso').forEach(m => {
      const key = normCat(m.categoria)
      porCat[key] = (porCat[key] || 0) + m.monto
    })
    return Object.entries(porCat)
      .map(([cat, total]) => {
        const meta = CAT_VARS[cat] || { label: cat, color: colores.muted, grupo: 'deseos' }
        return { cat, total, label: meta.label, color: meta.color, grupo: meta.grupo }
      })
      .sort((a, b) => b.total - a.total)
  }, [movsAño, CAT_VARS, colores.muted])

  const grandTotal = useMemo(() =>
    catList.reduce((s, c) => s + c.total, 0)
  , [catList])

  const grupoTotales = useMemo(() => {
    const gt = { necesidades: 0, deseos: 0, futuro: 0 }
    catList.forEach(c => { if (gt[c.grupo] !== undefined) gt[c.grupo] += c.total })
    return gt
  }, [catList])

  const catsConDatos = useMemo(() => [...new Set(
    movsAño.filter(m => m.tipo === 'egreso').map(m => normCat(m.categoria))
  )], [movsAño])

  const filtroOpciones = useMemo(() => [
    { v: 'todos',     l: 'Todos',     color: colores.muted  },
    { v: 'basicos',   l: 'Básicos',   color: colores.blue   },
    { v: 'deuda',     l: 'Deuda',     color: colores.rose   },
    { v: 'deseo',     l: 'Deseo',     color: colores.terra  },
    { v: 'ahorro',    l: 'Ahorro',    color: colores.green  },
    { v: 'inversion', l: 'Inversión', color: colores.green  },
    ...catsConDatos
      .filter(cat => !['basicos','deuda','deseo','ahorro','inversion','remesa'].includes(cat))
      .map(cat => ({ v: cat, l: cat, color: colores.muted }))
  ], [catsConDatos, colores])

  const movsFiltrados = useMemo(() =>
    movsAño.filter(m => {
      if (m.tipo !== 'egreso') return false
      return filtro === 'todos' || normCat(m.categoria) === filtro
    })
  , [movsAño, filtro])

  // FIX 3: resumenMes excluye ahorro/inversión de Gastos
  const resumenMes = useMemo(() =>
    MESES.map((mes, i) => {
      const mm = movsAño.filter(m => new Date(m.fecha).getMonth() === i)
      return {
        mes,
        mesCorto: MESES_CORTO[i],
        Ingresos: mm.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
        Gastos: mm
          .filter(m => m.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(normCat(m.categoria)))
          .reduce((s, m) => s + m.monto, 0),
      }
    })
  , [movsAño])

  const porMes = useMemo(() =>
    MESES.map((mes, i) => ({
      mes,
      mesCorto: MESES_CORTO[i],
      total: movsFiltrados
        .filter(m => new Date(m.fecha).getMonth() === i)
        .reduce((s, m) => s + m.monto, 0),
    }))
  , [movsFiltrados])

  const maxMes = useMemo(() =>
    porMes.reduce((mx, m) => m.total > mx.total ? m : mx, porMes[0])
  , [porMes])

  const minMes = useMemo(() => {
    const conDatos = porMes.filter(m => m.total > 0)
    return conDatos.reduce(
      (mn, m) => m.total < mn.total ? m : mn,
      conDatos[0] || porMes[0]
    )
  }, [porMes])

  // Tooltip con colores inyectados
  const TooltipConColores = (props) => <ChartTooltip {...props} colores={colores} />

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center glass-card"
        style={{ background: 'var(--bg-secondary)' }}>
        <BarChart3 size={36} style={{ color: colores.muted, opacity: 0.5 }} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Sin movimientos en {año}
        </p>
        <p className="text-sm" style={{ color: colores.muted }}>
          Registra ingresos y egresos para ver tus reportes
        </p>
      </div>
      <a href="/gastos" className="ff-btn-primary mt-2">Ir a Ingresos &amp; Egresos</a>
    </div>
  )

  return (
    <AppShell>

      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: colores.muted }}>Módulo</p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Reportes</h1>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0"
          style={{
            background: 'var(--bg-secondary)',
            border: `1px solid ${colores.border}`,
            borderRadius: 12,
            padding: '3px 4px',
          }}>
          <button onClick={() => setAño(a => a - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: colores.muted }}>
            <ChevronLeft size={13} strokeWidth={3} />
          </button>
          <span className="text-sm font-semibold w-11 text-center" style={{ color: 'var(--text-primary)' }}>
            {año}
          </span>
          <button onClick={() => setAño(a => a + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: colores.muted }}>
            <ChevronRight size={13} strokeWidth={3} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin" style={{ color: colores.muted }} />
          <span className="text-sm" style={{ color: colores.muted }}>Cargando reportes...</span>
        </div>
      ) : movsAño.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 animate-enter">
            {[
              { label: 'Ingresos año',  value: formatCurrency(totalIngresos), icon: <TrendingUp size={14} />,  color: colores.green },
              { label: 'Gastos año',    value: formatCurrency(totalGastos),   icon: <TrendingDown size={14} />, color: colores.rose  },
              {
                label: 'Balance año', value: formatCurrency(balance),
                icon: <Wallet size={14} />,
                color: balance >= 0 ? colores.green : colores.rose,
              },
              {
                label: 'Tasa de ahorro',
                value: `${tasaAhorro.toFixed(1)}%`,
                icon: <PiggyBank size={14} />,
                color: tasaAhorro >= grupoMetas.futuro ? colores.green : tasaAhorro >= grupoMetas.futuro / 2 ? colores.terra : colores.rose,
                sub: tasaAhorro >= grupoMetas.futuro
                  ? '✓ Meta cumplida'
                  : tasaAhorro >= grupoMetas.futuro / 2
                    ? 'Casi llegas a la meta'
                    : `Meta: ${grupoMetas.futuro}%`,
              },
            ].map((s, i) => (
              <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: colores.muted }}>{s.label}</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</p>
                {s.sub  && <p className="text-[9px] font-bold mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.sub}</p>}
                {s.hint && <p className="text-[8px] mt-0.5" style={{ color: colores.muted, opacity: 0.6 }}>{s.hint}</p>}
              </div>
            ))}
          </div>

          {/* DISTRIBUCIÓN */}
          {grandTotal > 0 && (
            <Card className="mb-4 animate-enter" style={{ padding: '14px 16px', animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase" style={{ color: colores.muted }}>
                  Distribución del presupuesto
                </p>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: `color-mix(in srgb, ${colores.green} 10%, transparent)`,
                    color: colores.green,
                  }}>
                  {totalPresupuesto > 0 ? 'Metas de tu presupuesto' : ''}
                </span>
              </div>
              <div className="space-y-3">
                {Object.entries(GRUPOS_BASE).map(([key, g]) => {
                  const gastado    = grupoTotales[key] || 0
                  const target     = grupoMetas[key]
                  const montoBucket = totalIngresos * (target / 100)
                  const pct        = montoBucket > 0 ? Math.min(100, (gastado / montoBucket) * 100) : 0
                  const cumple     = key === 'futuro' ? pct >= 80 : pct <= 100
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
                          <p className="text-[10px] font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
                            {g.label}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <p className="text-[10px] font-semibold"
                            style={{ color: cumple ? colores.green : colores.rose }}>
                            {pct.toFixed(1)}%
                          </p>
                          <span style={{ color: cumple ? colores.green : colores.rose, fontSize: 12 }}>
                            {cumple ? '✓' : '✗'}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: colores.track }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, pct)}%`, background: cumple ? g.color : colores.rose }} />
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: colores.muted }}>
                        {formatCurrency(gastado)} de {formatCurrency(montoBucket)} ({target}% asignado)
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* CATEGORÍAS */}
            <div className="animate-enter" style={{ animationDelay: '0.15s' }}>
              <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1">
                {filtroOpciones.map(f => (
                  <button key={f.v} onClick={() => setFiltro(f.v)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase transition-all"
                    style={{
                      background: filtro === f.v ? `color-mix(in srgb, ${f.color} 12%, var(--bg-secondary))` : 'transparent',
                      color:      filtro === f.v ? f.color : colores.muted,
                      border:     `1px solid ${filtro === f.v ? `color-mix(in srgb, ${f.color} 35%, transparent)` : 'transparent'}`,
                    }}>
                    {f.l}
                  </button>
                ))}
              </div>

              {catList.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Calendar size={24} className="mx-auto mb-2" style={{ color: colores.muted, opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: colores.muted }}>Sin gastos este año</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {catList.map(c => (
                    <div key={c.cat}
                      onClick={() => setFiltro(c.cat === filtro ? 'todos' : c.cat)}
                      className="glass-card cursor-pointer transition-all"
                      style={{
                        padding: '10px 12px',
                        border:     filtro === c.cat ? `1px solid color-mix(in srgb, ${c.color} 35%, transparent)` : '',
                        background: filtro === c.cat ? `color-mix(in srgb, ${c.color} 5%, ${colores.card})` : '',
                      }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
                            {c.label}
                          </span>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: c.color }}>
                          {formatCurrency(c.total)}
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full" style={{ background: colores.track }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(c.total / grandTotal) * 100}%`, background: c.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* GRÁFICOS */}
            <div className="col-span-1 lg:col-span-2 space-y-4 animate-enter" style={{ animationDelay: '0.2s' }}>

              <Card style={{ padding: '14px 16px' }}>
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: colores.muted }}>
                  Ingresos vs Gastos — {año}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={resumenMes} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="20%" barGap={1}>
                    <XAxis dataKey="mesCorto" tick={{ fill: colores.muted, fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: colores.muted, fontSize: 9 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip content={<TooltipConColores />} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }}
                      formatter={v => <span style={{ color: colores.muted }}>{v}</span>}
                    />
                    <Bar dataKey="Ingresos" fill={colores.green} radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="Gastos"   fill={colores.rose}  radius={[3, 3, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card style={{ padding: '14px 16px' }}>
                <p className="text-[10px] font-semibold uppercase mb-1" style={{ color: colores.muted }}>
                  Gastos por mes
                  {filtro !== 'todos' && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[8px]"
                      style={{ background: 'var(--bg-secondary)', color: colores.green }}>
                      {CAT_VARS[filtro]?.label || filtro}
                    </span>
                  )}
                </p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={porMes} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="25%">
                    <XAxis dataKey="mesCorto" tick={{ fill: colores.muted, fontSize: 9, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: colores.muted, fontSize: 9 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip content={<TooltipConColores />} />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={20}>
                      {porMes.map((m, i) => (
                        <Cell key={i}
                          fill={
                            m.total === 0       ? colores.border :
                            m.mes === maxMes?.mes ? colores.rose   :
                            m.mes === minMes?.mes ? colores.green  :
                            colores.blue
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* TABLA */}
              <Card style={{ padding: '14px 16px' }}>
                <p className="text-[10px] font-semibold uppercase mb-3" style={{ color: colores.muted }}>
                  Detalle mensual
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${colores.border}` }}>
                        {['Mes', 'Ingresos', 'Gastos', 'Balance'].map((h, i) => (
                          <th key={h} className="pb-2 font-semibold uppercase"
                            style={{ color: colores.muted, fontSize: 9, letterSpacing: '0.08em', textAlign: i === 0 ? 'left' : 'right' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumenMes.filter(m => m.Ingresos > 0 || m.Gastos > 0).map(m => {
                        const bal = m.Ingresos - m.Gastos
                        return (
                          <tr key={m.mes} style={{ borderBottom: `1px solid ${colores.border}` }}>
                            <td className="py-2 font-semibold" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{m.mes}</td>
                            <td className="py-2 text-right font-bold" style={{ color: colores.green, fontSize: 11 }}>{formatCurrency(m.Ingresos)}</td>
                            <td className="py-2 text-right font-bold" style={{ color: colores.rose,  fontSize: 11 }}>{formatCurrency(m.Gastos)}</td>
                            <td className="py-2 text-right font-semibold" style={{ fontSize: 11, color: bal >= 0 ? colores.green : colores.rose }}>
                              {bal >= 0 ? '+' : ''}{formatCurrency(bal)}
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ borderTop: `2px solid ${colores.border}` }}>
                        <td className="pt-2.5 font-semibold text-[10px] uppercase" style={{ color: colores.muted }}>Total</td>
                        <td className="pt-2.5 text-right font-semibold" style={{ color: colores.green, fontSize: 12 }}>{formatCurrency(totalIngresos)}</td>
                        <td className="pt-2.5 text-right font-semibold" style={{ color: colores.rose,  fontSize: 12 }}>{formatCurrency(totalGastos)}</td>
                        <td className="pt-2.5 text-right font-semibold" style={{ fontSize: 12, color: balance >= 0 ? colores.green : colores.rose }}>
                          {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}