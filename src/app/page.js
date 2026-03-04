'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { StatCard, Card, ProgressBar } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Wallet, Target, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

// Colores usando variables CSS para compatibilidad con temas
const COLORES_CAT = {
  basicos:   'var(--accent-blue)',
  deseo:     'var(--accent-violet, #a78bfa)',
  ahorro:    'var(--accent-green)',
  inversion: 'var(--accent-gold, #f59e0b)',
  deuda:     'var(--accent-rose)',
}

function generarHistorico(movimientos) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5 + i)
    const mesNum = d.getMonth()
    const añoNum = d.getFullYear()
    const filtrados = movimientos.filter(m => {
      const [year, month] = m.fecha.split('-').map(Number)
      return month - 1 === mesNum && year === añoNum
    })
    return {
      mes: MESES_LABEL[mesNum],
      ingresos: filtrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
      gastos: filtrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
    }
  })
}

export default function Dashboard() {
  const [movs, setMovs] = useState([])
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    async function cargar() {
      try {
        const [{ data: m }, { data: mt }] = await Promise.all([
          supabase.from('movimientos').select('*').order('fecha', { ascending: false }),
          supabase.from('metas').select('*').order('created_at'),
        ])
        setMovs(m || [])
        setMetas(mt || [])
      } catch (err) {
        console.error('Error cargando base de datos:', err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  if (!mounted) return null

  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  const movsMes = movs.filter(m => {
    const [year, month] = m.fecha.split('-').map(Number)
    return month - 1 === mesActual && year === añoActual
  })

  const ingresosMes  = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0)
  const gastosMes    = movsMes.filter(m => m.tipo === 'egreso' && ['deseo', 'basicos', 'deuda'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const ahorroMes    = movsMes.filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const egresosMes   = gastosMes + ahorroMes
  const saldo        = ingresosMes - egresosMes
  const totalAhorrado = metas.reduce((s, m) => s + (m.actual || 0), 0)

  const catTotales = {}
  movsMes.filter(m => m.tipo === 'egreso').forEach(m => {
    catTotales[m.categoria] = (catTotales[m.categoria] || 0) + m.monto
  })
  const distribucionReal = Object.entries(catTotales).map(([name, value]) => ({
    name,
    value: Math.round((value / (egresosMes || 1)) * 100),
    color: COLORES_CAT[name] || 'var(--text-muted)',
  }))

  if (loading) return (
    <AppShell>
      <div className="flex h-[60vh] items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin" size={36} style={{ color: 'var(--accent-green)' }} />
        <p className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>Sincronizando datos...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* Header — mobile safe */}
      <div className="flex items-start justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--text-muted)' }}>
            Resumen Real
          </p>
          <h1 className="text-lg font-black truncate"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex-shrink-0"
          style={{
            color: 'var(--accent-green)',
            background: 'rgba(45,122,95,0.1)',
            border: '1px solid rgba(45,122,95,0.2)'
          }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)' }} />
          En vivo
        </div>
      </div>

      {/* KPI Cards — 2 cols mobile, 4 desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Ingresos"          value={formatCurrency(ingresosMes)}   icon={TrendingUp}   color="var(--accent-green)" />
        <StatCard label="Gastos"            value={formatCurrency(gastosMes)}     icon={TrendingDown} color="var(--accent-rose)" />
        <StatCard label="Ahorrado"          value={formatCurrency(totalAhorrado)} icon={Target}       color="var(--accent-terra)" />
        <StatCard label="Saldo libre"       value={formatCurrency(saldo)}         icon={Wallet}       color="var(--accent-blue)" />
      </div>

      {/* Gráfico + Distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Flujo mensual */}
        <Card className="col-span-1 lg:col-span-2 overflow-hidden">
          <h3 className="font-black text-sm mb-4 truncate" style={{ color: 'var(--text-primary)' }}>
            Flujo Mensual
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={generarHistorico(movs)} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#fb7185" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" fontSize={10} axisLine={false} tickLine={false}
                tick={{ fill: 'var(--text-muted)' }} />
              <YAxis fontSize={10} axisLine={false} tickLine={false}
                tick={{ fill: 'var(--text-muted)' }}
                tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 12,
                  fontSize: 11,
                }}
                formatter={v => formatCurrency(v)}
              />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} fill="url(#gIng)" name="Ingresos" />
              <Area type="monotone" dataKey="gastos"   stroke="#fb7185" strokeWidth={2} fill="url(#gGas)" name="Gastos" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Distribución */}
        <Card className="overflow-hidden">
          <h3 className="font-black text-sm mb-4 uppercase tracking-wide truncate"
            style={{ color: 'var(--text-primary)' }}>
            Distribución
          </h3>
          {distribucionReal.length > 0 ? (
            <div className="space-y-3">
              {distribucionReal.map(d => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs capitalize truncate" style={{ color: 'var(--text-secondary)' }}>
                        {d.name}
                      </span>
                    </div>
                    <span className="text-xs font-black flex-shrink-0 ml-2" style={{ color: 'var(--text-primary)' }}>
                      {d.value}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${d.value}%`, background: d.color }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs italic py-10 text-center" style={{ color: 'var(--text-muted)' }}>
              Sin gastos este mes
            </p>
          )}
        </Card>
      </div>

      {/* Metas */}
      <Card className="overflow-hidden">
        <h3 className="font-black text-sm mb-4 truncate" style={{ color: 'var(--text-primary)' }}>
          Progreso de Metas
        </h3>
        {metas.length > 0 ? (
          <div className="space-y-4">
            {metas.map(m => {
              const pct = Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100))
              return (
                <div key={m.id}>
                  {/* Nombre + montos — no se rompen */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-black truncate flex-1"
                      style={{ color: 'var(--text-primary)' }}>
                      {getFlagEmoji(m.emoji)} {m.nombre}
                    </span>
                    <span className="text-[10px] font-bold flex-shrink-0 tabular-nums whitespace-nowrap"
                      style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency(m.actual || 0)} / {formatCurrency(m.meta || 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <ProgressBar value={m.actual || 0} max={m.meta || 1} color={m.color} />
                    </div>
                    <span className="text-[10px] font-black flex-shrink-0 tabular-nums"
                      style={{ color: m.color, minWidth: 32, textAlign: 'right' }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs italic py-10 text-center" style={{ color: 'var(--text-muted)' }}>
            Crea tu primera meta en la sección de Metas
          </p>
        )}
      </Card>
    </AppShell>
  )
}