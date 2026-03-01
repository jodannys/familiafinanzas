'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const DEMO = [
  { id:1, tipo:'debo',   nombre:'Tarjeta VISA',        monto:3500, pendiente:2800, cuota:350, tasa:18, venceDia:15, estado:'activa',   color:'#fb7185', entidad:'Banco Nacional' },
  { id:2, tipo:'debo',   nombre:'Préstamo personal',   monto:8000, pendiente:5200, cuota:420, tasa:9,  venceDia:5,  estado:'activa',   color:'#fb7185', entidad:'Caja de Ahorros' },
  { id:3, tipo:'medeben',nombre:'Préstamo a hermano',  monto:600,  pendiente:400,  cuota:100, tasa:0,  venceDia:1,  estado:'activa',   color:'#10b981', entidad:'Carlos R.' },
  { id:4, tipo:'medeben',nombre:'Deuda trabajo',       monto:250,  pendiente:0,    cuota:0,   tasa:0,  venceDia:0,  estado:'pagada',   color:'#34d399', entidad:'Empresa ABC' },
]

export default function DeudasPage() {
  const [deudas, setDeudas] = useState(DEMO)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ tipo:'debo', nombre:'', entidad:'', monto:'', cuota:'', tasa:'', venceDia:'', tieneInteres:false })
  const [tab, setTab] = useState('debo')

  const activas = deudas.filter(d => d.estado === 'activa')
  const totalDebo = activas.filter(d=>d.tipo==='debo').reduce((s,d)=>s+d.pendiente,0)
  const totalMeDeben = activas.filter(d=>d.tipo==='medeben').reduce((s,d)=>s+d.pendiente,0)

  const filtradas = deudas.filter(d => d.tipo === tab)

  function handleAdd(e) {
    e.preventDefault()
    setDeudas(prev => [...prev, {
      ...form,
      id: Date.now(),
      monto: parseFloat(form.monto),
      pendiente: parseFloat(form.monto),
      cuota: parseFloat(form.cuota || 0),
      tasa: form.tieneInteres ? parseFloat(form.tasa || 0) : 0,
      venceDia: parseInt(form.venceDia || 0),
      estado: 'activa',
      color: form.tipo === 'debo' ? '#fb7185' : '#10b981',
    }])
    setModal(false)
    setForm({ tipo:'debo', nombre:'', entidad:'', monto:'', cuota:'', tasa:'', venceDia:'', tieneInteres:false })
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-3xl font-bold text-white" style={{ letterSpacing:'-0.03em' }}>Deudas</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Registrar deuda
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-5 animate-enter" style={{ borderColor:'rgba(251,113,133,0.2)' }}>
          <p className="text-xs text-rose-400 uppercase tracking-wider font-semibold mb-2">Total que debo</p>
          <p className="text-3xl font-bold text-rose-400" style={{ letterSpacing:'-0.03em' }}>{formatCurrency(totalDebo)}</p>
          <p className="text-xs text-slate-500 mt-1">{activas.filter(d=>d.tipo==='debo').length} deudas activas</p>
        </div>
        <div className="glass-card p-5 animate-enter animate-enter-delay-1" style={{ borderColor:'rgba(16,185,129,0.2)' }}>
          <p className="text-xs text-emerald-400 uppercase tracking-wider font-semibold mb-2">Total que me deben</p>
          <p className="text-3xl font-bold text-emerald-400" style={{ letterSpacing:'-0.03em' }}>{formatCurrency(totalMeDeben)}</p>
          <p className="text-xs text-slate-500 mt-1">{activas.filter(d=>d.tipo==='medeben').length} pendientes de cobro</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[{ v:'debo', l:'Lo que debo' }, { v:'medeben', l:'Lo que me deben' }].map(t => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab===t.v ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Debt cards */}
      <div className="space-y-4">
        {filtradas.map((d, i) => {
          const pct = Math.round(((d.monto - d.pendiente) / d.monto) * 100)
          const interesAnual = d.tasa > 0 ? d.pendiente * (d.tasa/100) : 0
          const isOverdue = d.estado === 'mora'
          return (
            <Card key={d.id} className="animate-enter" style={{ animationDelay:`${i*0.05}s` }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background:`${d.color}18` }}>
                  {d.estado === 'pagada'
                    ? <CheckCircle size={18} style={{ color:d.color }} />
                    : isOverdue
                      ? <AlertCircle size={18} className="text-rose-400" />
                      : <Clock size={18} style={{ color:d.color }} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-0.5">
                    <h3 className="font-bold text-white">{d.nombre}</h3>
                    <Badge color={d.estado==='pagada' ? 'sky' : d.tipo==='medeben' ? 'emerald' : 'rose'}>
                      {d.estado==='pagada' ? 'Pagada ✓' : d.tipo==='medeben' ? 'Me deben' : 'Activa'}
                    </Badge>
                    {d.tasa > 0 && <Badge color="gold">{d.tasa}% interés</Badge>}
                  </div>
                  <p className="text-xs text-slate-500 mb-4">{d.entidad}{d.venceDia > 0 && ` · Pago el día ${d.venceDia} de cada mes`}</p>

                  <div className="grid grid-cols-4 gap-4 mb-4 text-xs">
                    <div><p className="text-slate-500 mb-1">Original</p><p className="font-bold text-white">{formatCurrency(d.monto)}</p></div>
                    <div><p className="text-slate-500 mb-1">Pendiente</p><p className="font-bold" style={{ color:d.color }}>{formatCurrency(d.pendiente)}</p></div>
                    <div><p className="text-slate-500 mb-1">Cuota/mes</p><p className="font-bold text-white">{formatCurrency(d.cuota)}</p></div>
                    {d.tasa > 0 && <div><p className="text-slate-500 mb-1">Interés anual</p><p className="font-bold text-amber-400">≈{formatCurrency(interesAnual)}</p></div>}
                  </div>

                  <div className="flex items-center gap-3">
                    <ProgressBar value={d.monto - d.pendiente} max={d.monto} color={d.color} className="flex-1" />
                    <span className="text-xs font-bold text-slate-400 w-10 text-right">{pct}%</span>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
        {filtradas.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-lg mb-1">No hay registros</p>
            <p className="text-sm">Agrega una deuda para empezar a controlarla</p>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Registrar Deuda">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Tipo</label>
              <select className="ff-input" value={form.tipo} onChange={e => setForm({...form, tipo:e.target.value})}>
                <option value="debo">Lo que debo</option>
                <option value="medeben">Lo que me deben</option>
              </select>
            </div>
            <div>
              <label className="ff-label">Nombre</label>
              <input className="ff-input" placeholder="Ej: Tarjeta VISA" required
                value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
            </div>
          </div>
          <div>
            <label className="ff-label">Entidad / Persona</label>
            <input className="ff-input" placeholder="Ej: Banco Nacional, Carlos..."
              value={form.entidad} onChange={e => setForm({...form, entidad:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Monto total (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01" required
                value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Cuota mensual (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01"
                value={form.cuota} onChange={e => setForm({...form, cuota:e.target.value})} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="interes" checked={form.tieneInteres}
              onChange={e => setForm({...form, tieneInteres:e.target.checked})}
              className="w-4 h-4 accent-amber-400" />
            <label htmlFor="interes" className="text-sm text-slate-300 cursor-pointer">¿Tiene interés?</label>
          </div>
          {form.tieneInteres && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ff-label">Tasa anual (%)</label>
                <input className="ff-input" type="number" min="0" step="0.1"
                  value={form.tasa} onChange={e => setForm({...form, tasa:e.target.value})} />
              </div>
              <div>
                <label className="ff-label">Día de pago mensual</label>
                <input className="ff-input" type="number" min="1" max="31"
                  value={form.venceDia} onChange={e => setForm({...form, venceDia:e.target.value})} />
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">Registrar</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
