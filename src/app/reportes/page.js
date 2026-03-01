'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import { TrendingDown, TrendingUp, BarChart3 } from 'lucide-react'
import { formatCurrency, getMonthName } from '@/lib/utils'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, CartesianGrid, Cell
} from 'recharts'

// ── Demo data ──────────────────────────────────────────────────────────────────
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const DATOS_ANUALES = {
  Arriendo:     [800,800,800,800,800,800,800,800,800,800,800,800],
  Mercado:      [320,340,290,380,360,420,310,350,330,300,370,450],
  Luz:          [45,48,51,38,35,32,30,31,38,44,55,78],
  Internet:     [40,40,40,40,40,40,40,40,40,40,40,40],
  Remesas:      [200,200,200,200,200,200,200,200,200,200,200,200],
  Restaurantes: [80,65,120,90,150,200,180,95,110,75,130,210],
  Ocio:         [50,30,80,60,90,150,200,100,70,40,60,120],
  Ropa:         [0,0,150,0,0,200,0,0,0,0,300,0],
}

const CATS = {
  'Arriendo':     { cat:'basicos',   color:'#38bdf8' },
  'Mercado':      { cat:'basicos',   color:'#38bdf8' },
  'Luz':          { cat:'basicos',   color:'#38bdf8' },
  'Internet':     { cat:'basicos',   color:'#38bdf8' },
  'Remesas':      { cat:'remesa',    color:'#fb923c' },
  'Restaurantes': { cat:'deseo',     color:'#a78bfa' },
  'Ocio':         { cat:'deseo',     color:'#a78bfa' },
  'Ropa':         { cat:'deseo',     color:'#a78bfa' },
}

const CustomBar = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-glass))', borderRadius:12, padding:'10px 14px' }}>
      <p className="text-xs text-stone-400 mb-1">{label}</p>
      <p className="text-sm font-bold text-stone-800">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function ReportesPage() {
  const [subcatSelected, setSubcatSelected] = useState('Luz')
  const [filtro, setFiltro] = useState('todos')

  const datos = DATOS_ANUALES[subcatSelected]
  const total = datos.reduce((s,v) => s+v, 0)
  const prom = total / 12
  const max  = Math.max(...datos)
  const min  = Math.min(...datos)
  const maxMes = MESES[datos.indexOf(max)]
  const minMes = MESES[datos.indexOf(min)]

  const chartData = MESES.map((m, i) => ({
    mes: m,
    monto: datos[i],
    fill: datos[i] === max ? '#fb7185' : datos[i] === min ? '#10b981' : '#38bdf8',
  }))

  // Annual summary per subcategory
  const subcats = Object.entries(DATOS_ANUALES)
    .filter(([k]) => filtro === 'todos' || CATS[k]?.cat === filtro)
    .map(([nombre, vals]) => ({
      nombre,
      total: vals.reduce((s,v) => s+v, 0),
      prom: vals.reduce((s,v) => s+v, 0) / 12,
      color: CATS[nombre]?.color || '#94a3b8',
      cat: CATS[nombre]?.cat,
    }))
    .sort((a,b) => b.total - a.total)

  const grandTotal = subcats.reduce((s,c) => s+c.total, 0)

  return (
    <AppShell>
      <div className="mb-8 animate-enter">
        <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
        <h1 className="text-3xl font-bold text-stone-800" style={{ letterSpacing:'-0.03em' }}>Reportes & Analítica</h1>
        <p className="text-sm text-stone-400 mt-1">Año 2026 — análisis completo de tu gasto</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subcategory list */}
        <div>
          <div className="flex gap-2 mb-4 flex-wrap">
            {[{v:'todos',l:'Todos'},{v:'basicos',l:'Básicos'},{v:'deseo',l:'Deseo'},{v:'remesa',l:'Remesas'}].map(f => (
              <button key={f.v} onClick={() => setFiltro(f.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filtro===f.v ? 'bg-stone-100 text-stone-800' : 'text-stone-400 hover:text-stone-800'
                }`}>{f.l}</button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="px-3 py-2 text-xs text-stone-400 font-semibold uppercase tracking-wider">
              Total: {formatCurrency(grandTotal)}
            </div>
            {subcats.map(sc => {
              const pct = Math.round((sc.total/grandTotal)*100)
              const isSelected = subcatSelected === sc.nombre
              return (
                <div key={sc.nombre} onClick={() => setSubcatSelected(sc.nombre)}
                  className="p-3 rounded-xl cursor-pointer hover:bg-stone-50 transition-all"
                  style={{ background: isSelected ? 'rgba(255,255,255,0.07)' : undefined, borderLeft: isSelected ? `3px solid ${sc.color}` : '3px solid transparent' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-stone-800">{sc.nombre}</span>
                    <span className="text-xs font-bold" style={{ color:sc.color }}>{pct}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-400">
                    <span>{formatCurrency(sc.total)}/año</span>
                    <span>≈{formatCurrency(sc.prom)}/mes</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detail chart */}
        <div className="col-span-1 lg:col-span-2 space-y-5">
          {/* KPIs for selected subcat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { l:'Total anual',     v:formatCurrency(total),   c:'#f1f5f9' },
              { l:'Promedio/mes',    v:formatCurrency(prom),    c:'#94a3b8' },
              { l:'Mes más caro',    v:`${maxMes} (${formatCurrency(max)})`, c:'#fb7185' },
              { l:'Mes más barato',  v:`${minMes} (${formatCurrency(min)})`, c:'#10b981' },
            ].map((s,i) => (
              <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay:`${i*0.04}s` }}>
                <p className="text-xs text-stone-400 mb-1">{s.l}</p>
                <p className="text-sm font-bold" style={{ color:s.c }}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-stone-800">{subcatSelected} — por mes</h3>
                <p className="text-xs text-stone-400">🔴 Mes más caro · 🟢 Mes más barato</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top:5, right:5, left:-10, bottom:0 }}>
                <XAxis dataKey="mes" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                <Tooltip content={<CustomBar />} />
                <Bar dataKey="monto" radius={[6,6,0,0]}>
                  {chartData.map((d,i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Tabla mensual */}
          <Card>
            <h3 className="font-bold text-stone-800 mb-4">Detalle mensual — {subcatSelected}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {MESES.map((m, i) => {
                const v = datos[i]
                const isMax = v === max
                const isMin = v === min
                return (
                  <div key={m} className="p-3 rounded-xl text-center"
                    style={{ background: isMax ? 'rgba(251,113,133,0.08)' : isMin ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)' }}>
                    <p className="text-xs text-stone-400 mb-1">{m}</p>
                    <p className={`text-sm font-bold ${isMax ? 'text-rose-400' : isMin ? 'text-emerald-400' : 'text-stone-800'}`}>
                      {formatCurrency(v)}
                    </p>
                    {v > prom
                      ? <p className="text-xs text-rose-400/60 mt-0.5">+{formatCurrency(v-prom)}</p>
                      : <p className="text-xs text-emerald-400/60 mt-0.5">-{formatCurrency(prom-v)}</p>}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
