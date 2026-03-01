'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Target, CheckCircle, Pause, ChevronRight, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const DEMO_METAS = [
  { id:1, nombre:'Fondo de Emergencia', emoji:'🛡️', meta:5000,  actual:3200, pct_mensual:10, estado:'activa',    color:'#10b981', prioridad:1 },
  { id:2, nombre:'Casa',                emoji:'🏠', meta:30000, actual:8500, pct_mensual:15, estado:'activa',    color:'#f59e0b', prioridad:2 },
  { id:3, nombre:'Vacaciones',          emoji:'✈️', meta:2000,  actual:650,  pct_mensual:5,  estado:'activa',    color:'#8b5cf6', prioridad:3 },
  { id:4, nombre:'Carro',              emoji:'🚗', meta:15000, actual:1200, pct_mensual:5,  estado:'pausada',   color:'#38bdf8', prioridad:4 },
  { id:5, nombre:'Laptop nueva',        emoji:'💻', meta:1200,  actual:1200, pct_mensual:0,  estado:'completada',color:'#34d399', prioridad:5 },
]

function mesesRestantes(actual, meta, pctMensual, ingresoMensual = 5500) {
  const aporteMensual = (pctMensual / 100) * ingresoMensual
  if (aporteMensual <= 0) return '—'
  const restante = meta - actual
  const meses = Math.ceil(restante / aporteMensual)
  if (meses <= 0) return 'Completada'
  if (meses < 12) return `${meses} meses`
  const años = Math.floor(meses / 12)
  const m = meses % 12
  return `${años}a ${m}m`
}

export default function MetasPage() {
  const [metas, setMetas] = useState(DEMO_METAS)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre:'', emoji:'🎯', meta:'', pct_mensual:'', color:'#10b981' })

  const activas = metas.filter(m => m.estado === 'activa')
  const totalPct = activas.reduce((s,m) => s+m.pct_mensual, 0)
  const totalAhorrado = metas.reduce((s,m) => s+m.actual, 0)

  function handleAdd(e) {
    e.preventDefault()
    setMetas(prev => [...prev, {
      ...form,
      id: Date.now(),
      meta: parseFloat(form.meta),
      pct_mensual: parseFloat(form.pct_mensual),
      actual: 0,
      estado: 'activa',
      prioridad: prev.length + 1,
    }])
    setModal(false)
    setForm({ nombre:'', emoji:'🎯', meta:'', pct_mensual:'', color:'#10b981' })
  }

  const estadoBadge = { activa:'emerald', pausada:'gold', completada:'sky' }
  const estadoLabel = { activa:'Activa', pausada:'Pausada', completada:'Completada ✓' }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
       <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Metas de Ahorro</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva meta
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        {[
          { label:'Total ahorrado',   value: formatCurrency(totalAhorrado), color:'#10b981' },
          { label:'% del ingreso destinado', value: `${totalPct}%`, color: totalPct > 30 ? '#10b981' : '#f59e0b' },
          { label:'Metas activas',    value: `${activas.length}`, color:'#38bdf8' },
        ].map((s,i) => (
          <div key={i} className="glass-card p-5 animate-enter" style={{ animationDelay:`${i*0.05}s` }}>
            <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color:s.color, letterSpacing:'-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-1 gap-4">
        {metas.map((meta, i) => {
          const pct = Math.min(100, Math.round((meta.actual / meta.meta) * 100))
          const restante = meta.meta - meta.actual
          return (
            <Card key={meta.id} className={`animate-enter group hover:border-white/15 transition-all cursor-pointer`}
              style={{ animationDelay:`${i*0.05}s`, borderColor: meta.estado==='completada' ? 'rgba(52,211,153,0.2)' : undefined }}>
              <div className="flex items-center gap-4">
                {/* Emoji */}
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background:`${meta.color}18` }}>
                  {meta.emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-stone-800">{meta.nombre}</h3>
                    <Badge color={estadoBadge[meta.estado]}>{estadoLabel[meta.estado]}</Badge>
                  </div>
                  <div className="flex items-center gap-4 mb-3">
                    <span className="text-sm font-bold" style={{ color:meta.color }}>{formatCurrency(meta.actual)}</span>
                    <span className="text-sm text-stone-400">de {formatCurrency(meta.meta)}</span>
                    {meta.estado !== 'completada' && (
                      <span className="text-xs text-stone-400">• Faltan {formatCurrency(restante)}</span>
                    )}
                  </div>
                  <ProgressBar value={meta.actual} max={meta.meta} color={meta.color} />
                </div>

                {/* Right stats */}
                <div className="text-right flex-shrink-0 ml-6 space-y-1">
                  <p className="text-2xl font-bold text-stone-800" style={{ letterSpacing:'-0.02em' }}>{pct}%</p>
                  <p className="text-xs text-stone-400">{meta.pct_mensual}% ingreso/mes</p>
                  <p className="text-xs" style={{ color:meta.color }}>
                    {mesesRestantes(meta.actual, meta.meta, meta.pct_mensual)}
                  </p>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Add modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Meta de Ahorro">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2} value={form.emoji}
                onChange={e => setForm({...form, emoji:e.target.value})} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre de la meta</label>
              <input className="ff-input" placeholder="Ej: Casa, Vacaciones, Carro..." required
                value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Monto objetivo (€)</label>
              <input className="ff-input" type="number" min="1" step="0.01" placeholder="0.00" required
                value={form.meta} onChange={e => setForm({...form, meta:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">% del ingreso mensual</label>
              <input className="ff-input" type="number" min="1" max="100" placeholder="10" required
                value={form.pct_mensual} onChange={e => setForm({...form, pct_mensual:e.target.value})} />
            </div>
          </div>
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#10b981','#f59e0b','#8b5cf6','#38bdf8','#fb7185','#fb923c'].map(c => (
                <button type="button" key={c} onClick={() => setForm({...form, color:c})}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{ background:c, boxShadow: form.color===c ? `0 0 0 3px rgba(255,255,255,0.3)` : 'none' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">Crear meta</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
