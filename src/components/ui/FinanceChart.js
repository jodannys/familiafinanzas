'use client'
import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

function leerColores() {
  if (typeof window === 'undefined') return {}
  const s = getComputedStyle(document.documentElement)
  const v = (name) => s.getPropertyValue(name).trim()
  return {
    ingresos: v('--accent-green'),
    gastos: v('--accent-rose'),
    bgCard: v('--bg-dark-card'),
    bgPrimary: v('--bg-primary'),
    borderColor: v('--border-glass'),
    tickColor: v('--text-secondary'),
    tooltipBg: v('--bg-card'),
    tooltipText: v('--text-primary'),
    tooltipBorder: v('--border-glass'),
  }
}

function CustomTooltip({ active, payload, label, colores }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: colores.tooltipBg,
      border: `1px solid ${colores.tooltipBorder}`,
      borderRadius: 16,
      padding: '12px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      backdropFilter: 'blur(12px)',
    }}>
      <p style={{ color: colores.tickColor, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
          <span style={{ color: colores.tooltipText, fontSize: 12, fontWeight: 700 }}>
            {p.name}: {p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k€` : `${p.value}€`}
          </span>
        </div>
      ))}
    </div>
  )
}

export function FinanceChart({ data = [] }) {
  const [colores, setColores] = useState(leerColores)

  useEffect(() => {
    setColores(leerColores())
    const handler = () => setColores(leerColores())
    window.addEventListener('theme-change', handler)
    return () => window.removeEventListener('theme-change', handler)
  }, [])

  // Fondo: versión muy transparente del bg-dark-card mezclado con bg-primary
  const bgGrafico = colores.bgCard
    ? `${colores.bgCard}18`
    : 'rgba(255,255,255,0.08)'

  return (
    <div
      className="h-[380px] w-full flex flex-col rounded-[40px] overflow-hidden"
      style={{
        background: bgGrafico,
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        border: `1px solid ${colores.borderColor || 'rgba(255,255,255,0.1)'}`,
        boxShadow: '0 2px 24px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '28px 28px 0 28px' }}>
        <p style={{
          fontSize: 9,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.25em',
          color: colores.tickColor,
          opacity: 0.7,
          marginBottom: 4,
        }}>
          Progreso Financiero
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {[
            { label: 'Ingresos', color: colores.ingresos },
            { label: 'Gastos', color: colores.gastos },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 20, height: 3, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: colores.tickColor, opacity: 0.6 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, padding: '16px 12px 16px 4px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colores.ingresos} stopOpacity={0.25} />
                <stop offset="100%" stopColor={colores.ingresos} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colores.gastos} stopOpacity={0.2} />
                <stop offset="100%" stopColor={colores.gastos} stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="2 6"
              vertical={false}
              stroke={colores.tickColor}
              strokeOpacity={0.12}
            />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: colores.tickColor || '#918479',
                fontSize: 10,
                fontWeight: 700,
                fillOpacity: 0.6
              }}
              dy={12}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              width={48}
              tick={{
                fill: colores.tickColor || '#918479',
                fontSize: 10,
                fontWeight: 700,
                textAnchor: 'end',
                fillOpacity: 0.6
              }}
              tickFormatter={(v) => v === 0 ? '0' : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              dx={-4}
            />

            <Tooltip
              content={<CustomTooltip colores={colores} />}
              cursor={{ stroke: colores.tickColor, strokeWidth: 1, strokeOpacity: 0.2, strokeDasharray: '4 4' }}
            />

            <Area
              type="monotone"
              dataKey="ingresos"
              stroke={colores.ingresos}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#gradIngresos)"
              dot={false}
              activeDot={{ r: 5, fill: colores.ingresos, strokeWidth: 0 }}
              animationDuration={1200}
              name="Ingresos"
            />

            <Area
              type="monotone"
              dataKey="gastos"
              stroke={colores.gastos}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#gradGastos)"
              dot={false}
              activeDot={{ r: 5, fill: colores.gastos, strokeWidth: 0 }}
              animationDuration={1200}
              name="Gastos"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}