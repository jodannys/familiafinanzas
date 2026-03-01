'use client'
import AppShell from '@/components/layout/AppShell'
import { StatCard, Card, ProgressBar, Badge } from '@/components/ui/Card'
import {
  TrendingUp, TrendingDown, Wallet, Target, CreditCard,
  ArrowUpRight, ArrowDownRight, Send, AlertCircle
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell
} from 'recharts'

// ─── Demo data ────────────────────────────────────────────────────────────────
const monthlyFlow = [
  { mes: 'Sep', ingresos: 4800, gastos: 3200 },
  { mes: 'Oct', ingresos: 5200, gastos: 3800 },
  { mes: 'Nov', ingresos: 5000, gastos: 3400 },
  { mes: 'Dic', ingresos: 5800, gastos: 4200 },
  { mes: 'Ene', ingresos: 5200, gastos: 3600 },
  { mes: 'Feb', ingresos: 5500, gastos: 3900 },
]

const distribucion = [
  { name: 'Básicos',   value: 45, color: '#38bdf8' },
  { name: 'Deseo',     value: 20, color: '#a78bfa' },
  { name: 'Ahorro',    value: 20, color: '#34d399' },
  { name: 'Inversión', value: 15, color: '#fbbf24' },
]

const metas = [
  { nombre: 'Fondo Emergencia', actual: 3200, meta: 5000, color: '#10b981' },
  { nombre: 'Casa',             actual: 8500, meta: 30000, color: '#f59e0b' },
  { nombre: 'Vacaciones',       actual: 650,  meta: 2000, color: '#8b5cf6' },
]

const alertas = [
  { tipo: 'warning', texto: 'Tarjeta VISA vence pago el día 15' },
  { tipo: 'success', texto: 'Meta Emergencia al 64% — ¡vas bien!' },
  { tipo: 'info',    texto: 'Sobre "Gastos Libres" tiene €18.20 disponibles' },
]

// ─── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    // Error 1: Tenías un paréntesis de más en 'var(--border-glass))'
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 12, padding: '10px 14px' }}>
      
      {/* Error 2: Faltaba una coma después de 'var(--text-secondary)' */}
      <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', fontWeight: 'semibold' }}>
        {label}
      </p>

      {payload.map((p) => (
        <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name === 'ingresos' ? '↑' : '↓'} {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}
// ─── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const saldo = 5500 - 3900
  const now = new Date()
  const monthName = now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 animate-enter">
        <div>
          <p className="text-sm text-stone-400 font-medium mb-1 uppercase tracking-wider">Resumen</p>
          <h1 className="text-3xl font-bold text-stone-800 capitalize" style={{ letterSpacing: '-0.03em' }}>
            {monthName}
          </h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-400"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Cuenta activa
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Ingresos del mes"
          value={formatCurrency(5500)}
          icon={TrendingUp}
          color="#10b981"
          delta={5.8}
          className="animate-enter animate-enter-delay-1"
        />
        <StatCard
          label="Gastos del mes"
          value={formatCurrency(3900)}
          icon={TrendingDown}
          color="#fb7185"
          delta={-2.1}
          className="animate-enter animate-enter-delay-2"
        />
        <StatCard
          label="Saldo libre"
          value={formatCurrency(saldo)}
          icon={Wallet}
          color="#38bdf8"
          className="animate-enter animate-enter-delay-3"
        />
        <StatCard
          label="Total ahorrado"
          value={formatCurrency(12350)}
          icon={Target}
          color="#f59e0b"
          delta={8.2}
          className="animate-enter animate-enter-delay-4"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">

        {/* Flow chart */}
        <Card className="col-span-2 animate-enter animate-enter-delay-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-stone-800">Flujo Mensual</h3>
              <p className="text-xs text-stone-400 mt-0.5">Ingresos vs. Gastos — últimos 6 meses</p>
            </div>
            <Badge color="emerald">+{formatCurrency(1600)} saldo</Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyFlow} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb7185" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v/1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} fill="url(#gradIngresos)" />
              <Area type="monotone" dataKey="gastos"   stroke="#fb7185" strokeWidth={2} fill="url(#gradGastos)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Distribution pie */}
        <Card className="animate-enter animate-enter-delay-2">
          <h3 className="font-bold text-stone-800 mb-1">Distribución</h3>
          <p className="text-xs text-stone-400 mb-4">% del ingreso mensual</p>
          <div className="flex justify-center mb-4">
            <PieChart width={160} height={160}>
              <Pie data={distribucion} cx={75} cy={75} innerRadius={50} outerRadius={72}
                dataKey="value" strokeWidth={0}>
                {distribucion.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2">
            {distribucion.map((d) => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs text-stone-400">{d.name}</span>
                </div>
                <span className="text-xs font-semibold text-stone-800">{d.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-3 gap-6">

        {/* Metas de ahorro */}
        <Card className="col-span-2 animate-enter animate-enter-delay-3">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-stone-800">Progreso de Metas</h3>
            <a href="/metas" className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1">
              Ver todas <ArrowUpRight size={12} />
            </a>
          </div>
          <div className="space-y-5">
            {metas.map((m) => {
              const pct = Math.round((m.actual / m.meta) * 100)
              return (
                <div key={m.nombre}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-stone-800">{m.nombre}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-400">{formatCurrency(m.actual)} / {formatCurrency(m.meta)}</span>
                      <span className="text-xs font-bold" style={{ color: m.color }}>{pct}%</span>
                    </div>
                  </div>
                  <ProgressBar value={m.actual} max={m.meta} color={m.color} />
                </div>
              )
            })}
          </div>
        </Card>

        {/* Alertas */}
        <Card className="animate-enter animate-enter-delay-4">
          <h3 className="font-bold text-stone-800 mb-4">Alertas</h3>
          <div className="space-y-3">
            {alertas.map((a, i) => {
              const colorMap = {
                warning: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)', dot: '#fbbf24' },
                success: { bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', dot: '#10b981' },
                info:    { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.2)', dot: '#38bdf8' },
              }
              const c = colorMap[a.tipo]
              return (
                <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: c.dot }} />
                  <p className="text-xs text-stone-600 leading-relaxed">{a.texto}</p>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
