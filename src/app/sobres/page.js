'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { StatCard, Card, ProgressBar, Badge } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Wallet, Target, ArrowUpRight } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'

const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-glass)', borderRadius:12, padding:'10px 14px' }}>
      <p className="text-xs font-semibold mb-2" style={{ color:'var(--text-secondary)' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-sm font-semibold" style={{ color:p.color }}>
          {p.name === 'ingresos' ? '↑' : '↓'} {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [movs, setMovs] = useState([])
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function cargar() {
      const [{ data: m }, { data: mt }] = await Promise.all([
        supabase.from('movimientos').select('*').order('fecha', { ascending: false }),
        supabase.from('metas').select('*').order('created_at'),
      ])
      setMovs(m || [])
      setMetas(mt || [])
      setLoading(false)
    }
    cargar()
  }, [])

  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  const movsMes = movs.filter(m => {
    const d = new Date(m.fecha)
    return d.getMonth() === mesActual && d.getFullYear() === añoActual
  })

  const ingresosMes = movsMes.filter(m => m.tipo === 'ingreso').reduce((s,m) => s+m.monto, 0)
  const egresosMes  = movsMes.filter(m => m.tipo === 'egreso').reduce((s,m) => s+m.monto, 0)
  const saldo = ingresosMes - egresosMes
  const totalAhorrado = metas.reduce((s,m) => s+(m.actual||0), 0)

  // Flujo últimos 6 meses
  const flujo = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(añoActual, mesActual - 5 + i, 1)
    const mes = d.getMonth()
    const año = d.getFullYear()
    const filtrados = movs.filter(m => { const f = new Date(m.fecha); return f.getMonth()===mes && f.getFullYear()===año })
    return {
      mes: MESES_LABEL[mes],
      ingresos: filtrados.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0),
      gastos:   filtrados.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0),
    }
  })

  // Distribución por categoría (mes actual)
  const catTotales = {}
  movsMes.filter(m=>m.tipo==='egreso').forEach(m => {
    catTotales[m.categoria] = (catTotales[m.categoria]||0) + m.monto
  })
  const COLORES_CAT = { basicos:'#38bdf8', deseo:'#a78bfa', ahorro:'#34d399', inversion:'#fbbf24', deuda:'#fb7185', remesa:'#fb923c' }
  const distribucion = Object.entries(catTotales).map(([name, value]) => ({ name, value, color: COLORES_CAT[name]||'#94a3b8' }))

  // Alertas reales
  const alertas = []
  const metasActivas = metas.filter(m=>m.estado==='activa')
  metasActivas.forEach(m => {
    const pct = Math.round(((m.actual||0)/m.meta)*100)
    if (pct >= 90) alertas.push({ tipo:'success', texto:`Meta "${m.nombre}" casi completa — ${pct}%` })
  })
  if (egresosMes > ingresosMes) alertas.push({ tipo:'warning', texto:'Los gastos superan los ingresos este mes' })
  if (alertas.length === 0 && ingresosMes > 0) alertas.push({ tipo:'info', texto:`Saldo libre este mes: ${formatCurrency(saldo)}` })

  const monthName = now.toLocaleString('es-ES', { month:'long', year:'numeric' })

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-8 animate-enter">
        <div>
          <p className="text-sm text-stone-400 font-medium mb-1 uppercase tracking-wider">Resumen</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800 capitalize" style={{ letterSpacing:'-0.03em' }}>
            {monthName}
          </h1>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background:'rgba(45,122,95,0.1)', border:'1px solid rgba(45,122,95,0.2)', color:'#2D7A5F' }}>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          En línea
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Ingresos del mes" value={formatCurrency(ingresosMes)} icon={TrendingUp}  color="#10b981" className="animate-enter animate-enter-delay-1" />
        <StatCard label="Gastos del mes"   value={formatCurrency(egresosMes)}  icon={TrendingDown} color="#fb7185" className="animate-enter animate-enter-delay-2" />
        <StatCard label="Saldo libre"      value={formatCurrency(saldo)}       icon={Wallet}       color="#38bdf8" className="animate-enter animate-enter-delay-3" />
        <StatCard label="Total ahorrado"   value={formatCurrency(totalAhorrado)} icon={Target}     color="#f59e0b" className="animate-enter animate-enter-delay-4" />
      </div>

      {/* Gráfico + distribución */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="col-span-1 lg:col-span-2 animate-enter animate-enter-delay-1">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-stone-800">Flujo Mensual</h3>
              <p className="text-xs text-stone-400 mt-0.5">Ingresos vs Gastos — últimos 6 meses</p>
            </div>
            {saldo >= 0 && <Badge color="emerald">+{formatCurrency(saldo)} saldo</Badge>}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={flujo} margin={{ top:5, right:5, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#fb7185" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'var(--text-muted)', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v/1000}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} fill="url(#gI)" />
              <Area type="monotone" dataKey="gastos"   stroke="#fb7185" strokeWidth={2} fill="url(#gG)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="animate-enter animate-enter-delay-2">
          <h3 className="font-bold text-stone-800 mb-1">Distribución</h3>
          <p className="text-xs text-stone-400 mb-4">Gastos del mes por categoría</p>
          {distribucion.length === 0 ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-xs text-stone-400">Sin gastos este mes</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <PieChart width={160} height={160}>
                  <Pie data={distribucion} cx={75} cy={75} innerRadius={50} outerRadius={72} dataKey="value" strokeWidth={0}>
                    {distribucion.map((d,i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </div>
              <div className="space-y-2">
                {distribucion.map(d => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background:d.color }} />
                      <span className="text-xs text-stone-400 capitalize">{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-stone-800">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Metas + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2 animate-enter animate-enter-delay-3">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-stone-800">Progreso de Metas</h3>
            <a href="/metas" className="text-xs font-semibold flex items-center gap-1" style={{ color:'#2D7A5F' }}>
              Ver todas <ArrowUpRight size={12} />
            </a>
          </div>
          {metas.filter(m=>m.estado==='activa').length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-stone-400 mb-3">No hay metas activas</p>
              <a href="/metas" className="ff-btn-primary text-xs px-4 py-2">Crear meta</a>
            </div>
          ) : (
            <div className="space-y-5">
              {metas.filter(m=>m.estado==='activa').slice(0,4).map(m => {
                const pct = Math.min(100, Math.round(((m.actual||0)/m.meta)*100))
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-stone-800">{m.emoji} {m.nombre}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-stone-400">{formatCurrency(m.actual||0)} / {formatCurrency(m.meta)}</span>
                        <span className="text-xs font-bold" style={{ color:m.color }}>{pct}%</span>
                      </div>
                    </div>
                    <ProgressBar value={m.actual||0} max={m.meta} color={m.color} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="animate-enter animate-enter-delay-4">
          <h3 className="font-bold text-stone-800 mb-4">Alertas</h3>
          {alertas.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-8">Todo en orden 🎉</p>
          ) : (
            <div className="space-y-3">
              {alertas.map((a, i) => {
                const c = {
                  warning: { bg:'rgba(251,191,36,0.08)', border:'rgba(251,191,36,0.2)', dot:'#fbbf24' },
                  success: { bg:'rgba(45,122,95,0.08)',  border:'rgba(45,122,95,0.2)',  dot:'#2D7A5F' },
                  info:    { bg:'rgba(74,111,165,0.08)', border:'rgba(74,111,165,0.2)', dot:'#4A6FA5' },
                }[a.tipo]
                return (
                  <div key={i} className="flex gap-3 p-3 rounded-xl"
                    style={{ background:c.bg, border:`1px solid ${c.border}` }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background:c.dot }} />
                    <p className="text-xs text-stone-600 leading-relaxed">{a.texto}</p>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}