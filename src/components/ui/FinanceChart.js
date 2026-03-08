'use client'
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

function cssVar(name) {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function leerColores() {
  if (typeof window === 'undefined') return {}
  const s = getComputedStyle(document.documentElement)
  const v = (name) => s.getPropertyValue(name).trim()
  return {
    ingresos: v('--accent-green'),
    gastos: v('--accent-rose'),
    bgCard: v('--bg-dark-card'),
    borderColor: v('--border-glass'),
    tickColor: v('--text-muted'),
    gridColor: v('--border-glass'),
    tooltipBg: v('--bg-dark-card'),
    tooltipText: v('--text-primary'),
  }
}

export function FinanceChart({ data = [] }) {
  const [colores, setColores] = useState(leerColores)

  // Se re-ejecuta cada vez que cambia el tema (el atributo data-theme en <html>)
  useEffect(() => {
    setColores(leerColores())

    const handler = () => setColores(leerColores())
  window.addEventListener('theme-change', handler)
  return () => window.removeEventListener('theme-change', handler)
}, [])
  

  const { ingresos: colorIngresos, gastos: colorGastos, bgCard } = colores

  return (
    <div
      className="h-[380px] w-full flex flex-col p-8 rounded-[40px] border shadow-2xl"
      style={{
        background: colores.bgCard || 'var(--bg-dark-card)',
        borderColor: colores.borderColor || 'var(--border-glass)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: 'none',
      }}
    >
      <div className="mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          Progreso Financiero
        </h3>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: -10, left: -20, bottom: 0 }}>

            <defs>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorIngresos} stopOpacity={0.4} />
                <stop offset="95%" stopColor={colorIngresos} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colorGastos} stopOpacity={0.4} />
                <stop offset="95%" stopColor={colorGastos} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colores.gridColor || 'rgba(255,255,255,0.05)'} />

            <XAxis
              dataKey="name"
              axisLine={false} tickLine={false}
              tick={{ fill: colores.tickColor || 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700 }}
              dy={15} minTickGap={20}
            />

            <YAxis
              width={40} axisLine={false} tickLine={false}
              tick={{ fill: colores.tickColor || 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 700 }}
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}
              dx={5}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: colores.tooltipBg || 'rgba(20,14,10,0.85)',
                border: `1px solid ${colores.borderColor || 'rgba(255,255,255,0.1)'}`,
                borderRadius: 16,
                color: colores.tooltipText || '#fff',
                backdropFilter: 'blur(12px)',
              }}
              itemStyle={{ fontWeight: 700 }}
              cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 2 }}
            />

            <Area type="monotone" dataKey="ingresos"
              stroke={colorIngresos} strokeWidth={3}
              fillOpacity={1} fill="url(#colorIngresos)"
              animationDuration={1500} name="Ingresos" />

            <Area type="monotone" dataKey="gastos"
              stroke={colorGastos} strokeWidth={3}
              fillOpacity={1} fill="url(#colorGastos)"
              animationDuration={1500} name="Gastos" />

          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}