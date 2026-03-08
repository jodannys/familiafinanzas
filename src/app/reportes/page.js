'use client'
import { useState, useEffect } from 'react'
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

// ── Categorías → CSS vars del tema ────────────────────────────────────────────
const CAT_VARS = {
  basicos: { label: 'Básicos', color: 'var(--accent-blue)', grupo: 'necesidades' },
  deuda: { label: 'Deuda', color: 'var(--accent-rose)', grupo: 'necesidades' },
  deseo: { label: 'Deseo', color: 'var(--accent-terra)', grupo: 'deseos' },
  remesa: { label: 'Remesa', color: 'var(--accent-terra)', grupo: 'deseos' },
  ahorro: { label: 'Ahorro', color: 'var(--accent-green)', grupo: 'futuro' },
  inversion: { label: 'Inversión', color: 'var(--accent-green)', grupo: 'futuro' },
}

// Grupos base — los targets se sobreescriben con el presupuesto real del usuario
const GRUPOS_BASE = {
  necesidades: { label: 'Necesidades', color: 'var(--accent-blue)', targetDefault: 50 },
  deseos: { label: 'Deseos / Estilo', color: 'var(--accent-terra)', targetDefault: 30 },
  futuro: { label: 'Ahorro / Inversión', color: 'var(--accent-green)', targetDefault: 20 },
}

// Clasifica un bloque de presupuesto en uno de los 3 grupos
function grupoDeBloque(nombre) {
  const n = (nombre || '').toLowerCase()
  if (n.includes('necesid') || n.includes('basic') || n.includes('esencial')) return 'necesidades'
  if (n.includes('ahorro') || n.includes('invers') || n.includes('meta') || n.includes('futuro')) return 'futuro'
  if (n.includes('estilo') || n.includes('deseo') || n.includes('ocio')) return 'deseos'
  return null
}

// Normaliza categoría: minúsculas sin tildes
function normCat(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Tooltip compartido
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-glass)',
      borderRadius: 12, padding: '10px 14px',
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
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
  const [movs, setMovs] = useState([])
  const [bloques, setBloques] = useState([])   // presupuesto_bloques del mes actual
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [año, setAño] = useState(new Date().getFullYear())

  useEffect(() => {
    async function cargar() {
      const [{ data: movData }, { data: blqData }] = await Promise.all([
        supabase.from('movimientos').select('*').order('fecha'),
        supabase.from('presupuesto_bloques')
          .select('*')
          .eq('mes', new Date().getMonth() + 1)
          .eq('año', new Date().getFullYear()),
      ])
      setMovs(movData || [])
      setBloques(blqData || [])
      setLoading(false)
    }
    cargar()
  }, [])

  // ── Datos del año seleccionado ──────────────────────────────────────────────
  const movsAño = movs.filter(m => new Date(m.fecha).getFullYear() === año)

  const totalIngresos = movsAño.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalGastos = movsAño.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
  const balance = totalIngresos - totalGastos

  // ── FIX 1: Tasa de ahorro = solo ahorro + inversión / ingresos ────────────
  const totalAhorro = movsAño
    .filter(m => m.tipo === 'egreso' && (normCat(m.categoria) === 'ahorro' || normCat(m.categoria) === 'inversion'))
    .reduce((s, m) => s + m.monto, 0)
  const tasaAhorro = totalIngresos > 0 ? (totalAhorro / totalIngresos) * 100 : 0

  // ── FIX 2: Targets desde presupuesto real del usuario ─────────────────────
  const totalPresupuesto = bloques.reduce((s, b) => s + (b.monto || 0), 0)
  const grupoMetas = { necesidades: 50, deseos: 30, futuro: 20 }  // fallback 50/30/20
  if (totalPresupuesto > 0) {
    const montosPorGrupo = { necesidades: 0, deseos: 0, futuro: 0 }
    bloques.forEach(b => {
      const g = grupoDeBloque(b.nombre)
      if (g) montosPorGrupo[g] += (b.monto || 0)
    })
    Object.keys(grupoMetas).forEach(g => {
      if (montosPorGrupo[g] > 0)
        grupoMetas[g] = Math.round((montosPorGrupo[g] / totalPresupuesto) * 100)
    })
  }

  // Gastos por categoría (normalizado)
  const porCat = {}
  movsAño.filter(m => m.tipo === 'egreso').forEach(m => {
    const key = normCat(m.categoria)
    porCat[key] = (porCat[key] || 0) + m.monto
  })
  const catList = Object.entries(porCat)
    .map(([cat, total]) => {
      const meta = CAT_VARS[cat] || { label: cat, color: 'var(--text-muted)', grupo: 'deseos' }
      return { cat, total, label: meta.label, color: meta.color, grupo: meta.grupo }
    })
    .sort((a, b) => b.total - a.total)
  const grandTotal = catList.reduce((s, c) => s + c.total, 0)

  // Totales por grupo
  const grupoTotales = { necesidades: 0, deseos: 0, futuro: 0 }
  catList.forEach(c => {
    if (grupoTotales[c.grupo] !== undefined) grupoTotales[c.grupo] += c.total
  })

  // ── FIX 3: Filtros — Ahora incluimos las categorías que pediste ────────────────────
  const catsConDatos = [...new Set(
    movsAño.filter(m => m.tipo === 'egreso').map(m => normCat(m.categoria))
  )]

  const filtroOpciones = [
    { v: 'todos', l: 'Todos', color: 'var(--text-muted)' },
    { v: 'basicos', l: 'Básicos', color: 'var(--accent-blue)' },
    { v: 'deuda', l: 'Deuda', color: 'var(--accent-rose)' },
    { v: 'deseo', l: 'Deseo', color: 'var(--accent-terra)' },
    { v: 'ahorro', l: 'Ahorro', color: 'var(--accent-green)' },
    { v: 'inversion', l: 'Inversión', color: 'var(--accent-green)' },
    // Esto agrega cualquier otra categoría que tengas en la base de datos y no esté arriba
    ...catsConDatos
      .filter(cat => !['basicos', 'deuda', 'deseo', 'ahorro', 'inversion', 'remesa'].includes(cat))
      .map(cat => ({ v: cat, l: cat, color: 'var(--text-muted)' }))
  ]
  const movsFiltrados = movsAño.filter(m => {
    if (m.tipo !== 'egreso') return false
    return filtro === 'todos' || normCat(m.categoria) === filtro
  })

  // Ingresos vs Gastos por mes
  const resumenMes = MESES.map((mes, i) => {
    const mm = movsAño.filter(m => new Date(m.fecha).getMonth() === i)
    return {
      mes,
      mesCorto: MESES_CORTO[i],
      Ingresos: mm.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
      Gastos: mm.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
    }
  })

  const porMes = MESES.map((mes, i) => ({
    mes,
    mesCorto: MESES_CORTO[i],
    total: movsFiltrados.filter(m => new Date(m.fecha).getMonth() === i).reduce((s, m) => s + m.monto, 0),
  }))
  const maxMes = porMes.reduce((mx, m) => m.total > mx.total ? m : mx, porMes[0])
  const minMes = porMes.filter(m => m.total > 0).reduce(
    (mn, m) => m.total < mn.total ? m : mn,
    porMes.find(m => m.total > 0) || porMes[0]
  )

  // ── Empty State ───────────────────────────────────────────────────────────
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center glass-card"
        style={{ background: 'var(--bg-secondary)' }}>
        <BarChart3 size={36} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
      </div>
      <div className="text-center">
        <p className="font-black text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Sin movimientos en {año}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Registra ingresos y egresos para ver tus reportes
        </p>
      </div>
      <a href="/gastos" className="ff-btn-primary mt-2">Ir a Ingresos &amp; Egresos</a>
    </div>
  )

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <AppShell>

      {/* ── FIX 4: Header — selector de año con flechas (compacto) ── */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
            style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Reportes</h1>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 12,
            padding: '3px 4px',
          }}>
          <button onClick={() => setAño(a => a - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={13} strokeWidth={3} />
          </button>
          <span className="text-sm font-black w-11 text-center"
            style={{ color: 'var(--text-primary)' }}>
            {año}
          </span>
          <button onClick={() => setAño(a => a + 1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ color: 'var(--text-muted)' }}>
            <ChevronRight size={13} strokeWidth={3} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando reportes...</span>
        </div>
      ) : movsAño.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 animate-enter">
            {[
              {
                label: 'Ingresos año', value: formatCurrency(totalIngresos),
                icon: <TrendingUp size={14} />, color: 'var(--accent-green)',
              },
              {
                label: 'Gastos año', value: formatCurrency(totalGastos),
                icon: <TrendingDown size={14} />, color: 'var(--accent-rose)',
              },
              {
                label: 'Balance año', value: formatCurrency(balance),
                icon: <Wallet size={14} />,
                color: balance >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
              },
              {
                label: 'Tasa de ahorro',
                value: `${tasaAhorro.toFixed(1)}%`,
                icon: <PiggyBank size={14} />,
                color: tasaAhorro >= grupoMetas.futuro ? 'var(--accent-green)' : tasaAhorro >= grupoMetas.futuro / 2 ? 'var(--accent-terra)' : 'var(--accent-rose)',
                sub: tasaAhorro >= grupoMetas.futuro ? '✓ Meta cumplida' : tasaAhorro >= grupoMetas.futuro / 2 ? 'Casi allí' : `Meta: ${grupoMetas.futuro}%`,
                hint: 'Ahorro + Inversión / Ingresos',
              },
            ].map((s, i) => (
              <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: s.color }}>{s.icon}</span>
                  <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>
                    {s.label}
                  </p>
                </div>
                <p className="text-sm font-black" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
                {s.sub && <p className="text-[9px] font-bold mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.sub}</p>}
                {s.hint && <p className="text-[8px] mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{s.hint}</p>}
              </div>
            ))}
          </div>

          {/* ── FIX 2: Distribución con targets del presupuesto real ── */}
          {grandTotal > 0 && (
            <Card className="mb-4 animate-enter" style={{ padding: '14px 16px', animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase" style={{ color: 'var(--text-muted)' }}>
                  Distribución del presupuesto
                </p>
                {totalPresupuesto > 0 ? (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                      color: 'var(--accent-green)',
                    }}>
                    Metas de tu presupuesto
                  </span>
                ) : (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'color-mix(in srgb, var(--text-muted) 10%, transparent)',
                      color: 'var(--text-muted)',
                    }}>
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {Object.entries(GRUPOS_BASE).map(([key, g]) => {
                  const gastado = grupoTotales[key] || 0
                  const target = grupoMetas[key]
                  const pct = totalIngresos > 0 ? (gastado / totalIngresos) * 100 : 0
                 const cumple = key === 'futuro' ? pct >= target : pct <= target
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: g.color }} />
                          <p className="text-[10px] font-black truncate" style={{ color: 'var(--text-secondary)' }}>
                            {g.label}
                          </p>

                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <p className="text-[10px] font-black"
                            style={{ color: cumple ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                            {pct.toFixed(1)}%
                          </p>
                          <span style={{ color: cumple ? 'var(--accent-green)' : 'var(--accent-rose)', fontSize: 12 }}>
                            {cumple ? '✓' : '✗'}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(100, pct)}%`,
                            background: cumple ? g.color : 'var(--accent-rose)',
                          }} />
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(gastado)} de {formatCurrency(totalIngresos)}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* ── Categorías ── */}
            <div className="animate-enter" style={{ animationDelay: '0.15s' }}>

              {/* FIX 3: Filtros dinámicos — solo lo que hay en los datos */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto no-scrollbar pb-1">
                {filtroOpciones.map(f => (
                  <button key={f.v} onClick={() => setFiltro(f.v)}
                    className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all"
                    style={{
                      background: filtro === f.v
                        ? `color-mix(in srgb, ${f.color} 12%, var(--bg-secondary))`
                        : 'transparent',
                      color: filtro === f.v ? f.color : 'var(--text-muted)',
                      border: `1px solid ${filtro === f.v
                        ? `color-mix(in srgb, ${f.color} 35%, transparent)`
                        : 'transparent'}`,
                    }}>
                    {f.l}
                  </button>
                ))}
              </div>

              {catList.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Calendar size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin gastos este año</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {catList.map(c => (
                    <div key={c.cat}
                      onClick={() => setFiltro(c.cat === filtro ? 'todos' : c.cat)}
                      className="glass-card cursor-pointer transition-all"
                      style={{
                        padding: '10px 12px',
                        border: filtro === c.cat
                          ? `1px solid color-mix(in srgb, ${c.color} 35%, transparent)` : '',
                        background: filtro === c.cat
                          ? `color-mix(in srgb, ${c.color} 5%, var(--bg-card))` : '',
                      }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="text-xs font-black capitalize" style={{ color: 'var(--text-primary)' }}>
                            {c.label}
                          </span>
                        </div>
                        <span className="text-xs font-black" style={{ color: c.color }}>
                          {formatCurrency(c.total)}
                        </span>
                      </div>
                      <div className="w-full h-1 rounded-full" style={{ background: 'var(--progress-track)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${(c.total / grandTotal) * 100}%`, background: c.color }} />
                      </div>
                      <p className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                        {((c.total / grandTotal) * 100).toFixed(1)}% del total
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Gráficos ── */}
            <div className="col-span-1 lg:col-span-2 space-y-4 animate-enter" style={{ animationDelay: '0.2s' }}>

              {/* FIX 4: meses cortos para que entren en móvil */}
              <Card style={{ padding: '14px 16px' }}>
                <p className="text-[10px] font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                  Ingresos vs Gastos — {año}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={resumenMes}
                    margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    barCategoryGap="20%"
                    barGap={1}>
                    <XAxis dataKey="mesCorto"
                      tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 700 }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, fontWeight: 700, paddingTop: 8 }}
                      formatter={v => <span style={{ color: 'var(--text-muted)' }}>{v}</span>}
                    />
                    <Bar dataKey="Ingresos" fill="var(--accent-green)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="Gastos" fill="var(--accent-rose)" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card style={{ padding: '14px 16px' }}>
                <p className="text-[10px] font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                  Gastos por mes
                  {filtro !== 'todos' && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-[8px]"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--accent-green)' }}>
                      {CAT_VARS[filtro]?.label || filtro}
                    </span>
                  )}
                </p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart
                    data={porMes}
                    margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                    barCategoryGap="25%">
                    <XAxis dataKey="mesCorto"
                      tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 700 }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="total" radius={[3, 3, 0, 0]} maxBarSize={20}>
                      {porMes.map((m, i) => (
                        <Cell key={i}
                          fill={
                            m.total === 0 ? 'var(--border-glass)' :
                              m.mes === maxMes?.mes ? 'var(--accent-rose)' :
                                m.mes === minMes?.mes ? 'var(--accent-green)' :
                                  'var(--accent-blue)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Tabla detalle mensual */}
              <Card style={{ padding: '14px 16px' }}>
                <p className="text-[10px] font-black uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                  Detalle mensual
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ fontSize: 11 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
                        {['Mes', 'Ingresos', 'Gastos', 'Balance'].map((h, i) => (
                          <th key={h} className="pb-2 font-black uppercase"
                            style={{
                              color: 'var(--text-muted)', fontSize: 9,
                              letterSpacing: '0.08em',
                              textAlign: i === 0 ? 'left' : 'right',
                            }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {resumenMes.filter(m => m.Ingresos > 0 || m.Gastos > 0).map(m => {
                        const bal = m.Ingresos - m.Gastos
                        return (
                          <tr key={m.mes} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                            <td className="py-2 font-black" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{m.mes}</td>
                            <td className="py-2 text-right font-bold" style={{ color: 'var(--accent-green)', fontSize: 11 }}>
                              {formatCurrency(m.Ingresos)}
                            </td>
                            <td className="py-2 text-right font-bold" style={{ color: 'var(--accent-rose)', fontSize: 11 }}>
                              {formatCurrency(m.Gastos)}
                            </td>
                            <td className="py-2 text-right font-black" style={{
                              fontSize: 11,
                              color: bal >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                            }}>
                              {bal >= 0 ? '+' : ''}{formatCurrency(bal)}
                            </td>
                          </tr>
                        )
                      })}
                      <tr style={{ borderTop: '2px solid var(--border-glass)' }}>
                        <td className="pt-2.5 font-black text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>Total</td>
                        <td className="pt-2.5 text-right font-black" style={{ color: 'var(--accent-green)', fontSize: 12 }}>
                          {formatCurrency(totalIngresos)}
                        </td>
                        <td className="pt-2.5 text-right font-black" style={{ color: 'var(--accent-rose)', fontSize: 12 }}>
                          {formatCurrency(totalGastos)}
                        </td>
                        <td className="pt-2.5 text-right font-black" style={{
                          fontSize: 12,
                          color: balance >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                        }}>
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