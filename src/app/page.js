'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { StatCard, Card, ProgressBar, Badge } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Wallet, Target, ArrowUpRight, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase' // Quitamos getFlagEmoji de aquí
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency, getFlagEmoji } from '@/lib/utils' // Se queda solo aquí

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

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
        console.error("Error cargando base de datos:", err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  if (!mounted) return null

  // ─── LÓGICA DE TIEMPO REAL ──────────────────────────────────────────────────
  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  // Movimientos de este mes
  const movsMes = movs.filter(m => {
    const d = new Date(m.fecha)
    return d.getMonth() === mesActual && d.getFullYear() === añoActual
  })

  const ingresosMes = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0)
  const egresosMes = movsMes.filter(m => m.tipo === 'egreso').reduce((s, m) => s + (m.monto || 0), 0)
  const saldo = ingresosMes - egresosMes
  const totalAhorrado = metas.reduce((s, m) => s + (m.actual || 0), 0)

  // Distribución por categorías (Real)
  const catTotales = {}
  movsMes.filter(m => m.tipo === 'egreso').forEach(m => {
    catTotales[m.categoria] = (catTotales[m.categoria] || 0) + m.monto
  })
  const COLORES_CAT = { basicos: '#38bdf8', deseo: '#a78bfa', ahorro: '#34d399', inversion: '#fbbf24', deuda: '#fb7185' }
  const distribucionReal = Object.entries(catTotales).map(([name, value]) => ({
    name,
    value: Math.round((value / (egresosMes || 1)) * 100),
    color: COLORES_CAT[name] || '#94a3b8'
  }))

  if (loading) return (
    <AppShell>
      <div className="flex h-[60vh] items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-stone-400 font-medium">Sincronizando datos reales...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-sm font-medium mb-1 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
            Resumen Real
          </p>
          <h1 className="text-xl md:text-3xl font-bold capitalize" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Datos en vivo
        </div>
      </div>

      {/* KPI Cards REALES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Ingresos" value={formatCurrency(ingresosMes)} icon={TrendingUp} color="#10b981" />
        <StatCard label="Gastos" value={formatCurrency(egresosMes)} icon={TrendingDown} color="#fb7185" />
        <StatCard label="Total ahorrado" value={formatCurrency(totalAhorrado)} icon={Target} color="#f59e0b" />
        <StatCard label="Saldo libre" value={formatCurrency(saldo)} icon={Wallet} color="#38bdf8" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Gráfico de flujo real (últimos 6 meses) */}
        <Card className="col-span-1 lg:col-span-2">
          <h3 className="font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Flujo Mensual
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={generarHistorico(movs)} margin={{ left: -20 }}>
              <XAxis dataKey="mes" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis fontSize={11} axisLine={false} tickLine={false} tickFormatter={v => `€${v / 1000}k`} />
              <Tooltip />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" fill="#10b98120" />
              <Area type="monotone" dataKey="gastos" stroke="#fb7185" fill="#fb718520" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Distribución real */}
        <Card>
          <h3 className="font-bold mb-4 text-sm uppercase" style={{ color: 'var(--text-primary)' }}>
            Distribución de Gastos
          </h3>
          {distribucionReal.length > 0 ? (
            <div className="space-y-4">
              {distribucionReal.map(d => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs text-stone-500 capitalize">{d.name}</span>
                  </div>
                 <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{d.value}%</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-stone-400 italic py-10 text-center">Sin gastos este mes</p>}
        </Card>
      </div>

      {/* Metas REALES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <h3 className="font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Progreso de Metas</h3>
          <div className="space-y-6">
            {metas.length > 0 ? metas.map(m => {
              const pct = Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100))
              return (
                <div key={m.id}>
                  <div className="flex justify-between text-xs mb-2 font-bold uppercase tracking-tighter">
                    <span style={{ color: 'var(--text-primary)' }}>
                      {getFlagEmoji(m.emoji)} {m.nombre}
                    </span>
                   <span style={{ color: 'var(--text-muted)' }}>{formatCurrency(m.actual)} / {formatCurrency(m.meta)}</span>
                  </div>
                  <ProgressBar value={m.actual || 0} max={m.meta || 1} color={m.color} />
                </div>
              )
            }) : <p className="text-xs text-stone-400 py-10 text-center italic">Crea tu primera meta en la sección de Metas</p>}
          </div>
        </Card>
      </div>
    </AppShell>
  )
}

// Función para calcular los últimos 6 meses desde los datos de Supabase
function generarHistorico(movimientos) {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5 + i)
    const mesNum = d.getMonth()
    const añoNum = d.getFullYear()
    const filtrados = movimientos.filter(m => {
      const fm = new Date(m.fecha)
      return fm.getMonth() === mesNum && fm.getFullYear() === añoNum
    })
    return {
      mes: MESES_LABEL[mesNum],
      ingresos: filtrados.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0),
      gastos: filtrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
    }
  })
}