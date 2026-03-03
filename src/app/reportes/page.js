'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const COLORES_CAT = { basicos: '#38bdf8', deseo: '#a78bfa', ahorro: '#34d399', inversion: '#fbbf24', deuda: '#fb7185', remesa: '#fb923c' }

export default function ReportesPage() {
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('todos')
  const [año, setAño] = useState(new Date().getFullYear())

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.from('movimientos').select('*').order('fecha')
      setMovs(data || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const movsFiltrados = movs.filter(m => {
    const d = new Date(m.fecha)
    if (d.getFullYear() !== año) return false
    if (filtro === 'todos') return m.tipo === 'egreso'
    return m.tipo === 'egreso' && m.categoria === filtro
  })

  // Gastos por mes
  const porMes = MESES.map((mes, i) => {
    const total = movsFiltrados.filter(m => new Date(m.fecha).getMonth() === i).reduce((s, m) => s + m.monto, 0)
    return { mes, total }
  })

  // Gastos por categoría
  const porCat = {}
  movs.filter(m => m.tipo === 'egreso' && new Date(m.fecha).getFullYear() === año).forEach(m => {
    porCat[m.categoria] = (porCat[m.categoria] || 0) + m.monto
  })
  const catList = Object.entries(porCat).map(([cat, total]) => ({ cat, total, color: COLORES_CAT[cat] || '#94a3b8' })).sort((a, b) => b.total - a.total)
  const grandTotal = catList.reduce((s, c) => s + c.total, 0)

  // Ingresos vs gastos por mes
  const resumenMes = MESES.map((mes, i) => {
    const movsM = movs.filter(m => { const d = new Date(m.fecha); return d.getMonth() === i && d.getFullYear() === año })
    return {
      mes,
      ingresos: movsM.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
      gastos: movsM.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
    }
  })

  const totalIngresos = resumenMes.reduce((s, m) => s + m.ingresos, 0)
  const totalGastos = resumenMes.reduce((s, m) => s + m.gastos, 0)

  const maxMes = porMes.reduce((max, m) => m.total > max.total ? m : max, porMes[0])
  const minMes = porMes.filter(m => m.total > 0).reduce((min, m) => m.total < min.total ? m : min, porMes.find(m => m.total > 0) || porMes[0])

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Reportes & Analítica</h1>
          <p className="text-sm text-stone-400 mt-1">Año {año}</p>
        </div>
        <select className="ff-input w-auto" value={año} onChange={e => setAño(parseInt(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin text-stone-400" />
          <span className="text-sm text-stone-400">Cargando reportes...</span>
        </div>
      ) : movs.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm">Aún no hay movimientos registrados</p>
          <a href="/gastos" className="ff-btn-primary mt-4 inline-block">Ir a Ingresos & Egresos</a>
        </div>
      ) : (
        <>
          {/* Resumen anual */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Ingresos año', value: formatCurrency(totalIngresos), color: '#10b981' },
              { label: 'Gastos año', value: formatCurrency(totalGastos), color: '#C0605A' },
              { label: 'Balance año', value: formatCurrency(totalIngresos - totalGastos), color: totalIngresos >= totalGastos ? '#10b981' : '#C0605A' },
            ].map((s, i) => (
              <div key={i} className="glass-card p-5">
                <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-2">{s.label}</p>
                <p className="text-2xl font-bold" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Categorías */}
            <div>
              <div className="flex gap-2 mb-4 flex-wrap">
                {[{ v: 'todos', l: 'Todos' }, { v: 'basicos', l: 'Básicos' }, { v: 'deseo', l: 'Deseo' }, { v: 'inversion', l: 'Inversión' }].map(f => (
                  <button key={f.v} onClick={() => setFiltro(f.v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: filtro === f.v ? 'var(--bg-secondary)' : 'transparent',
                      color: filtro === f.v ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}>
                    {f.l}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {catList.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-8">Sin gastos este año</p>
                ) : catList.map(c => (
                  <div key={c.cat} className="glass-card p-3 cursor-pointer hover:border-white/15 transition-all"
                    onClick={() => setFiltro(c.cat === filtro ? 'todos' : c.cat)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                        <span className="text-sm font-semibold text-stone-800 capitalize">{c.cat}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: c.color }}>{formatCurrency(c.total)}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(c.total / grandTotal) * 100}%`, background: c.color }} />
                    </div>
                    <p className="text-xs text-stone-400 mt-1">{((c.total / grandTotal) * 100).toFixed(1)}% del total</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gráfico mensual */}
            <div className="col-span-1 lg:col-span-2 space-y-5">
              <Card>
                <h3 className="font-bold text-stone-800 mb-1">Gastos por mes</h3>
                <p className="text-xs text-stone-400 mb-5">
                  {maxMes?.total > 0 && `Mayor gasto: ${maxMes.mes} (${formatCurrency(maxMes.total)})`}
                  {minMes?.total > 0 && ` · Menor gasto: ${minMes.mes} (${formatCurrency(minMes.total)})`}
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={porMes} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatCurrency(v)} labelStyle={{ color: 'var(--text-primary)' }} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 12 }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {porMes.map((m, i) => (
                        <Cell key={i} fill={m.mes === maxMes?.mes ? '#C0605A' : m.mes === minMes?.mes ? '#2D7A5F' : '#4A6FA5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <h3 className="font-bold text-stone-800 mb-4">Ingresos vs Gastos por mes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-400 uppercase tracking-wider">
                        <th className="pb-3 font-semibold text-left">Mes</th>
                        <th className="pb-3 font-semibold text-right">Ingresos</th>
                        <th className="pb-3 font-semibold text-right">Gastos</th>
                        <th className="pb-3 font-semibold text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumenMes.filter(m => m.ingresos > 0 || m.gastos > 0).map(m => {
                        const bal = m.ingresos - m.gastos
                        return (
                          <tr key={m.mes} className="border-t transition-colors hover:bg-stone-50" style={{ borderColor: 'var(--border-glass)' }}>
                            <td className="py-2.5 font-semibold text-stone-600">{m.mes}</td>
                            <td className="py-2.5 text-right font-semibold" style={{ color: '#10b981' }}>{formatCurrency(m.ingresos)}</td>
                            <td className="py-2.5 text-right" style={{ color: '#C0605A' }}>{formatCurrency(m.gastos)}</td>
                            <td className="py-2.5 text-right font-bold" style={{ color: bal >= 0 ? '#10b981' : '#C0605A' }}>{formatCurrency(bal)}</td>
                          </tr>
                        )
                      })}
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