'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { StatCard, Card, ProgressBar, Badge } from '@/components/ui/Card'
import { TrendingUp, TrendingDown, Wallet, Target, Loader2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

const MESES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Dashboard() {
  const [movs, setMovs] = useState([])
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false) // <-- ESTO FALTABA

  useEffect(() => {
    setMounted(true) // Ahora sí existe
    async function cargar() {
      try {
        const [{ data: m }, { data: mt }] = await Promise.all([
          supabase.from('movimientos').select('*').order('fecha', { ascending: false }),
          supabase.from('metas').select('*').order('created_at'),
        ])
        setMovs(m || [])
        setMetas(mt || [])
      } catch (error) {
        console.error("Error cargando datos:", error)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  // 1. Evitar renderizado hasta que esté montado (Fix Hydration)
  if (!mounted) return null

  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  // 2. Filtrar movimientos con seguridad
  const movsMesActual = movs.filter(m => {
    if (!m.fecha) return false
    const d = new Date(m.fecha)
    return d.getMonth() === mesActual && d.getFullYear() === añoActual
  })

  // 3. Totales (siempre con fallback a 0)
  const ingresosMes = movsMesActual.filter(m => m.tipo === 'ingreso').reduce((s,m) => s + (m.monto || 0), 0)
  const egresosMes  = movsMesActual.filter(m => m.tipo === 'egreso').reduce((s,m) => s + (m.monto || 0), 0)
  const saldo = ingresosMes - egresosMes
  const totalAhorrado = metas.reduce((s,m) => s + (m.actual || 0), 0)

  // 4. Distribución por Categorías
  const catTotales = {}
  movsMesActual.filter(m => m.tipo === 'egreso').forEach(m => {
    catTotales[m.categoria] = (catTotales[m.categoria] || 0) + m.monto
  })
  
  const COLORES_CAT = { basicos:'#38bdf8', deseo:'#a78bfa', ahorro:'#34d399', inversion:'#fbbf24', deuda:'#fb7185', remesa:'#fb923c' }
  const distribucion = Object.entries(catTotales).map(([name, value]) => ({ 
    name, 
    value, 
    color: COLORES_CAT[name] || '#94a3b8' 
  }))

  if (loading) return (
    <AppShell>
      <div className="flex h-[60vh] items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin text-emerald-500" size={40} />
        <p className="text-stone-400 font-medium">Sincronizando con vuestra cuenta...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1">Resumen Real</p>
          <h1 className="text-2xl font-black text-stone-800 tracking-tight capitalize">
            {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </h1>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          NUBE ACTIVA
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Ingresos" value={formatCurrency(ingresosMes)} icon={TrendingUp} color="#10b981" />
        <StatCard label="Gastos" value={formatCurrency(egresosMes)} icon={TrendingDown} color="#fb7185" />
        <StatCard label="Saldo Libre" value={formatCurrency(saldo)} icon={Wallet} color="#38bdf8" />
        <StatCard label="Ahorro Total" value={formatCurrency(totalAhorrado)} icon={Target} color="#f59e0b" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
           <h3 className="font-bold text-stone-800 text-sm mb-4 px-2">Evolución (Últimos 6 meses)</h3>
           <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={flujoSimulado(movs)} margin={{ left: -20, right: 10 }}>
                  <XAxis dataKey="mes" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={v => `€${v/1000}k`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="ingresos" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                  <Area type="monotone" dataKey="gastos" stroke="#fb7185" fill="#fb718520" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
           </div>
        </Card>

        <Card>
          <h3 className="font-bold text-stone-800 text-sm mb-6">Gastos por Categoría</h3>
          {distribucion.length > 0 ? (
            <div className="space-y-4">
              {distribucion.map(d => (
                <div key={d.name}>
                  <div className="flex justify-between text-[11px] mb-1.5 font-bold">
                    <span className="text-stone-500 uppercase">{d.name}</span>
                    <span className="text-stone-800">{formatCurrency(d.value)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${egresosMes > 0 ? (d.value / egresosMes) * 100 : 0}%`, 
                        backgroundColor: d.color 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-xs text-stone-400 italic">No hay gastos este mes</p>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

function flujoSimulado(movs) {
  const labels = []
  const d = new Date()
  for(let i=5; i>=0; i--) {
    const temp = new Date()
    temp.setMonth(d.getMonth() - i)
    labels.push({ mes: MESES_LABEL[temp.getMonth()], num: temp.getMonth(), año: temp.getFullYear() })
  }

  return labels.map(l => {
    const filtrados = movs.filter(mov => {
      const f = new Date(mov.fecha)
      return f.getMonth() === l.num && f.getFullYear() === l.año
    })
    return {
      mes: l.mes,
      ingresos: filtrados.filter(mov => mov.tipo === 'ingreso').reduce((s,m) => s + (m.monto || 0), 0),
      gastos: filtrados.filter(mov => mov.tipo === 'egreso').reduce((s,m) => s + (m.monto || 0), 0),
    }
  })
}