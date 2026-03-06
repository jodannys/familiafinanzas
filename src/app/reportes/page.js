'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Loader2, TrendingUp, TrendingDown, Wallet, PiggyBank, BarChart3, Calendar } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Cell, Legend
} from 'recharts'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Categorías mapeadas a variables CSS del tema → cambian con el tema automáticamente
const CAT_VARS = {
  basicos:   { label: 'Básicos',   color: 'var(--accent-blue)',  grupo: '50%' },
  deseo:     { label: 'Deseo',     color: 'var(--accent-terra)', grupo: '30%' },
  ahorro:    { label: 'Ahorro',    color: 'var(--accent-green)', grupo: '20%' },
  inversion: { label: 'Inversión', color: 'var(--accent-green)', grupo: '20%' },
  deuda:     { label: 'Deuda',     color: 'var(--accent-rose)',  grupo: '50%' },
  remesa:    { label: 'Remesa',    color: 'var(--accent-terra)', grupo: '30%' },
}

// Grupos 50/30/20
const GRUPOS = {
  '50%': { label: 'Necesidades',      target: 50, color: 'var(--accent-blue)' },
  '30%': { label: 'Deseos',           target: 30, color: 'var(--accent-terra)' },
  '20%': { label: 'Ahorro/Inversión', target: 20, color: 'var(--accent-green)' },
}

// Tooltip compartido compatible con tema
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
  const [movs, setMovs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro]   = useState('todos')
  const [año, setAño]         = useState(new Date().getFullYear())

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('movimientos').select('*').order('fecha')
      setMovs(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  // ── Datos del año seleccionado ──────────────────────────────────────────────

  const movsAño = movs.filter(m => new Date(m.fecha).getFullYear() === año)

  const totalIngresos = movsAño.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const totalGastos   = movsAño.filter(m => m.tipo === 'egreso' ).reduce((s, m) => s + m.monto, 0)
  const balance       = totalIngresos - totalGastos
  const tasaAhorro    = totalIngresos > 0 ? ((balance / totalIngresos) * 100) : 0

  // Gastos por categoría
  const porCat = {}
  movsAño.filter(m => m.tipo === 'egreso').forEach(m => {
    porCat[m.categoria] = (porCat[m.categoria] || 0) + m.monto
  })
  const catList = Object.entries(porCat)
    .map(([cat, total]) => ({
      cat, total,
      label: CAT_VARS[cat]?.label || cat,
      color: CAT_VARS[cat]?.color || 'var(--text-muted)',
      grupo: CAT_VARS[cat]?.grupo || '30%',
    }))
    .sort((a, b) => b.total - a.total)
  const grandTotal = catList.reduce((s, c) => s + c.total, 0)

  // Grupos 50/30/20
  const grupoTotales = {}
  catList.forEach(c => {
    grupoTotales[c.grupo] = (grupoTotales[c.grupo] || 0) + c.total
  })

  // Ingresos vs Gastos por mes
  const resumenMes = MESES.map((mes, i) => {
    const mm = movsAño.filter(m => new Date(m.fecha).getMonth() === i)
    return {
      mes,
      Ingresos: mm.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
      Gastos:   mm.filter(m => m.tipo === 'egreso' ).reduce((s, m) => s + m.monto, 0),
    }
  })

  // Gastos filtrados por mes (para el gráfico de barras simple)
  const movsFiltrados = movsAño.filter(m => {
    if (m.tipo !== 'egreso') return false
    return filtro === 'todos' ? true : m.categoria === filtro
  })
  const porMes = MESES.map((mes, i) => ({
    mes,
    total: movsFiltrados.filter(m => new Date(m.fecha).getMonth() === i).reduce((s, m) => s + m.monto, 0),
  }))
  const maxMes = porMes.reduce((max, m) => m.total > max.total ? m : max, porMes[0])
  const minMes = porMes.filter(m => m.total > 0).reduce(
    (min, m) => m.total < min.total ? m : min,
    porMes.find(m => m.total > 0) || porMes[0]
  )

  // ── Empty State ─────────────────────────────────────────────────────────────

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
      <a href="/gastos" className="ff-btn-primary mt-2">Ir a Ingresos & Egresos</a>
    </div>
  )

  // ── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Reportes</h1>
        </div>
        <select className="ff-input w-auto" value={año} onChange={e => setAño(parseInt(e.target.value))}
          style={{ padding: '8px 12px', fontSize: 13, fontWeight: 700 }}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
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
          {/* ── KPIs: Ingresos / Gastos / Balance / Tasa Ahorro ── */}
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
                icon: <Wallet size={14} />, color: balance >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
              },
              {
                label: 'Tasa de ahorro', value: `${tasaAhorro.toFixed(1)}%`,
                icon: <PiggyBank size={14} />,
                color: tasaAhorro >= 20 ? 'var(--accent-green)' : tasaAhorro >= 10 ? 'var(--accent-terra)' : 'var(--accent-rose)',
                sub: tasaAhorro >= 20 ? '✓ Meta cumplida' : tasaAhorro >= 10 ? 'Casi allí' : 'Meta: 20%',
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
                {s.sub && (
                  <p className="text-[9px] font-bold mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{s.sub}</p>
                )}
              </div>
            ))}
          </div>

          {/* ── Regla 50/30/20 ── */}
          {grandTotal > 0 && (
            <Card className="mb-4 animate-enter" style={{ padding: '14px 16px', animationDelay: '0.1s' }}>
              <p className="text-[10px] font-black uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                Regla 50 / 30 / 20
              </p>
              <div className="space-y-2.5">
                {Object.entries(GRUPOS).map(([key, g]) => {
                  const gastado  = grupoTotales[key] || 0
                  const pct      = totalIngresos > 0 ? (gastado / totalIngresos) * 100 : 0
                  const cumple   = pct <= g.target
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                          <p className="text-[10px] font-black" style={{ color: 'var(--text-secondary)' }}>{g.label}</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: `color-mix(in srgb, ${g.color} 12%, transparent)`, color: g.color }}>
                            Meta ≤{g.target}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black" style={{ color: cumple ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
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
              {/* Filtros */}
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {[{ v: 'todos', l: 'Todos' }, ...Object.entries(CAT_VARS).map(([v, c]) => ({ v, l: c.label }))].map(f => (
                  <button key={f.v} onClick={() => setFiltro(f.v)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all"
                    style={{
                      background: filtro === f.v ? 'var(--bg-secondary)' : 'transparent',
                      color:      filtro === f.v ? 'var(--text-primary)' : 'var(--text-muted)',
                      border:     `1px solid ${filtro === f.v ? 'var(--border-glass)' : 'transparent'}`,
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
                        border: filtro === c.cat ? `1px solid color-mix(in srgb, ${c.color} 35%, transparent)` : '',
                        background: filtro === c.cat ? `color-mix(in srgb, ${c.color} 5%, var(--bg-card))` : '',
                      }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
                          <span className="text-xs font-black capitalize" style={{ color: 'var(--text-primary)' }}>{c.label}</span>
                        </div>
                        <span className="text-xs font-black" style={{ color: c.color }}>{formatCurrency(c.total)}</span>
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

              {/* Ingresos vs Gastos por mes */}
              <Card style={{ padding: '14px 16px' }}>
                <p className="text-[10px] font-black uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                  Ingresos vs Gastos — {año}
                </p>
                <p className="text-[9px] mb-4" style={{ color: 'var(--text-muted)' }}>
                  Barras verdes = margen positivo ese mes
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={resumenMes} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                    <XAxis dataKey="mes"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', paddingTop: 8 }}
                      formatter={v => <span style={{ color: 'var(--text-muted)' }}>{v}</span>}
                    />
                    <Bar dataKey="Ingresos" fill="var(--accent-green)" radius={[4, 4, 0, 0]} maxBarSize={18} />
                    <Bar dataKey="Gastos"   fill="var(--accent-rose)"  radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Gastos por mes (filtrado por categoría) */}
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
                {maxMes?.total > 0 && (
                  <p className="text-[9px] mb-4" style={{ color: 'var(--text-muted)' }}>
                    Mayor: {maxMes.mes} ({formatCurrency(maxMes.total)})
                    {minMes?.total > 0 && ` · Menor: ${minMes.mes} (${formatCurrency(minMes.total)})`}
                  </p>
                )}
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={porMes} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis dataKey="mes"
                      tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                      axisLine={false} tickLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {porMes.map((m, i) => (
                        <Cell key={i}
                          fill={
                            m.total === 0             ? 'var(--border-glass)' :
                            m.mes === maxMes?.mes     ? 'var(--accent-rose)'  :
                            m.mes === minMes?.mes     ? 'var(--accent-green)' :
                                                        'var(--accent-blue)'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Tabla Ingresos vs Gastos */}
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
                              color: 'var(--text-muted)',
                              fontSize: 9,
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
                      {/* Fila de totales */}
                      <tr style={{ borderTop: `2px solid var(--border-glass)` }}>
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