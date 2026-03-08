'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { StatCard, Card, ProgressBar } from '@/components/ui/Card'
import { 
  TrendingUp, TrendingDown, Wallet, Target, Loader2, 
  Bell, ChevronRight, ArrowUpRight, ArrowDownRight 
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'

const MESES_LABEL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const COLORES_CAT = {
  basicos:   'var(--accent-blue)',
  deseo:     'var(--accent-violet, #a78bfa)',
  ahorro:    'var(--accent-green)',
  inversion: 'var(--accent-gold, #f59e0b)',
  deuda:     'var(--accent-rose)',
}

// --- Funciones Auxiliares ---
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
      gastos:   filtrados.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
    }
  })
}

function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  if (diaPago >= hoy) return diaPago - hoy
  // Si ya pasó este mes, calculamos para el siguiente (aprox 30 días)
  const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  return (ultimoDiaMes - hoy) + diaPago
}

function urgenciaAlerta(dias) {
  if (dias <= 3) return { bg: 'rgba(192,96,90,0.1)', border: 'rgba(192,96,90,0.3)', text: 'var(--accent-rose)', label: dias === 0 ? '¡Hoy!' : `${dias}d` }
  return { bg: 'rgba(193,122,58,0.1)', border: 'rgba(193,122,58,0.3)', text: 'var(--accent-terra)', label: `${dias}d` }
}

export default function Dashboard() {
  const [movs, setMovs] = useState([])
  const [metas, setMetas] = useState([])
  const [deudas, setDeudas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    async function cargar() {
      try {
        const [{ data: m }, { data: mt }, { data: d }] = await Promise.all([
          supabase.from('movimientos').select('*').order('fecha', { ascending: false }),
          supabase.from('metas').select('*').order('created_at'),
          supabase.from('deudas').select('*').eq('estado', 'activa'),
        ])
        setMovs(m || [])
        setMetas(mt || [])
        setDeudas(d || [])
      } catch (err) {
        console.error('Error cargando:', err)
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

  // Cálculos de Totales
  const movsMes = movs.filter(m => {
    const [year, month] = m.fecha.split('-').map(Number)
    return month - 1 === mesActual && year === añoActual
  })

  const ingresosMes = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0)
  const gastosMes   = movsMes.filter(m => m.tipo === 'egreso' && ['deseo', 'basicos', 'deuda'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const ahorroMes   = movsMes.filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria)).reduce((s, m) => s + (m.monto || 0), 0)
  const egresosMes  = gastosMes + ahorroMes
  const saldo       = ingresosMes - egresosMes
  const totalAhorrado = metas.reduce((s, m) => s + (m.actual || 0), 0)

  // Distribución
  const catTotales = {}
  movsMes.filter(m => m.tipo === 'egreso').forEach(m => {
    catTotales[m.categoria] = (catTotales[m.categoria] || 0) + m.monto
  })
  const distribucionReal = Object.entries(catTotales).map(([name, value]) => ({
    name,
    value: Math.round((value / (egresosMes || 1)) * 100),
    color: COLORES_CAT[name] || 'var(--text-muted)',
  }))

  // Alertas de deudas
  const alertasDeuda = deudas
    .map(d => ({ ...d, dias: diasHastaPago(d.dia_pago) }))
    .filter(d => d.dias !== null && d.dias <= 7)
    .sort((a, b) => a.dias - b.dias)

  if (loading) return (
    <AppShell>
      <div className="flex h-[70vh] items-center justify-center flex-col gap-4">
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-green)' }} />
        <p className="text-xs font-black uppercase tracking-widest opacity-50">Sincronizando datos familiares</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>
      {/* --- HEADER --- */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 animate-enter">
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Estado de Cuentas
          </h1>
          <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em] mt-1" style={{ color: 'var(--text-muted)' }}>
             {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })} • Quintero Brito
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter w-fit shadow-sm"
          style={{ 
            color: 'var(--accent-green)', 
            background: 'var(--bg-card)', 
            border: '1px solid var(--border-glass)' 
          }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-green)' }} />
          Datos en Tiempo Real
        </div>
      </div>

      {/* --- ALERTAS DE DEUDAS (NUEVO DISEÑO PRO) --- */}
      {alertasDeuda.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8 animate-enter">
          {alertasDeuda.map(d => {
            const urg = urgenciaAlerta(d.dias)
            return (
              <div key={d.id} className="relative flex items-center gap-4 p-4 rounded-2xl transition-all border shadow-sm overflow-hidden"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
                <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: urg.text }} />
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-inner" style={{ background: urg.bg }}>
                  {d.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-50" style={{ color: 'var(--text-muted)' }}>Vence en {urg.label}</p>
                    <span className="text-xs font-black tabular-nums" style={{ color: urg.text }}>{formatCurrency(d.cuota)}</span>
                  </div>
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* --- KPI CARDS (DISEÑO LIMPIO) --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Ingresos', val: ingresosMes, icon: ArrowUpRight, col: 'var(--accent-green)' },
          { label: 'Gastos', val: gastosMes, icon: ArrowDownRight, col: 'var(--accent-rose)' },
          { label: 'Metas', val: totalAhorrado, icon: Target, col: 'var(--accent-terra)' },
          { label: 'Saldo Libre', val: saldo, icon: Wallet, col: 'var(--accent-blue)' },
        ].map((kpi, i) => (
          <div key={i} className="p-5 rounded-3xl border transition-all hover:translate-y-[-2px] shadow-sm" 
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg" style={{ background: `color-mix(in srgb, ${kpi.col} 12%, transparent)` }}>
                <kpi.icon size={14} style={{ color: kpi.col }} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.1em] opacity-50" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
            </div>
            <p className="text-xl font-black tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {formatCurrency(kpi.val)}
            </p>
          </div>
        ))}
      </div>

      {/* --- GRÁFICO + DISTRIBUCIÓN --- */}
   <div className="lg:col-span-2 p-6 rounded-3xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
  <div className="flex items-center justify-between mb-8">
    <h3 className="font-black text-xs uppercase tracking-widest opacity-70">Flujo de Efectivo</h3>
    <div className="flex gap-4">
      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-green)' }} /> <span className="text-[10px] font-bold opacity-60">Ingresos</span></div>
      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-rose)' }} /> <span className="text-[10px] font-bold opacity-60">Gastos</span></div>
    </div>
  </div>
  
  <div className="h-[240px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart 
        data={generarHistorico(movs)} 
        // Aumentamos bottom para que no se corten las etiquetas de los meses
        margin={{ top: 10, right: 10, left: -15, bottom: 20 }} 
      >
        <defs>
          <linearGradient id="gIng" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.15}/>
            <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-glass)" opacity={0.4} />
        
        <XAxis 
          dataKey="mes" 
          fontSize={10} 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--text-muted)', fontWeight: '700' }}
          dy={15} // Empujamos el nombre del mes hacia abajo para que respire la gráfica
        />
        
        <YAxis 
          fontSize={10} 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--text-muted)' }} 
          tickFormatter={v => `${v}€`}
          width={40} // Ancho fijo para evitar que los números se coman la línea
        />
        
        <Tooltip 
          cursor={{ stroke: 'var(--border-glass)', strokeWidth: 2 }} 
          contentStyle={{ 
            borderRadius: '16px', 
            border: 'none', 
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', 
            fontSize: '12px', 
            background: 'var(--bg-card)', 
            color: 'var(--text-primary)' 
          }} 
        />
        
        {/* Usamos monotone para curvas suaves y añadimos los puntos (dots) para mayor claridad */}
        <Area 
          type="monotone" 
          dataKey="ingresos" 
          stroke="var(--accent-green)" 
          strokeWidth={3} 
          fill="url(#gIng)" 
          dot={{ r: 4, fill: 'var(--accent-green)', strokeWidth: 2, stroke: 'var(--bg-card)' }} 
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
        
        <Area 
          type="monotone" 
          dataKey="gastos" 
          stroke="var(--accent-rose)" 
          strokeWidth={3} 
          fill="transparent" 
          strokeDasharray="6 6" 
          dot={{ r: 4, fill: 'var(--accent-rose)', strokeWidth: 2, stroke: 'var(--bg-card)' }} 
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
</div>

      {/* --- METAS --- */}
      <div className="p-6 rounded-3xl border shadow-sm" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-black text-xs uppercase tracking-widest opacity-70">Progreso de Metas</h3>
          <Target size={14} className="opacity-30" />
        </div>
        {metas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
            {metas.map(m => {
              const pct = Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100))
              return (
                <div key={m.id} className="group">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-black truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                      {getFlagEmoji(m.emoji)} {m.nombre}
                    </span>
                    <span className="text-[10px] font-bold opacity-50 tabular-nums">
                      {formatCurrency(m.actual || 0)} / {formatCurrency(m.meta || 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <ProgressBar value={m.actual || 0} max={m.meta || 1} color={m.color} />
                    </div>
                    <span className="text-[10px] font-black w-8 text-right" style={{ color: m.color }}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs italic py-8 text-center opacity-40">No hay metas activas</p>
        )}
      </div>
    </AppShell>
  )
}