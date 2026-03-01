'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, SectionHeader, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, ArrowUpRight, ArrowDownRight, Filter, Search } from 'lucide-react'
import { formatCurrency, CATEGORY_CONFIG } from '@/lib/utils'

const DEMO = [
  { id:1, tipo:'ingreso',  monto:3200, descripcion:'Sueldo principal',  categoria:'basicos',   fecha:'2026-02-01', quien:'Yo' },
  { id:2, tipo:'ingreso',  monto:2300, descripcion:'Sueldo pareja',     categoria:'basicos',   fecha:'2026-02-01', quien:'Pareja' },
  { id:3, tipo:'egreso',   monto:900,  descripcion:'Arriendo',          categoria:'basicos',   fecha:'2026-02-02', quien:'Yo' },
  { id:4, tipo:'egreso',   monto:320,  descripcion:'Mercado semana 1',  categoria:'basicos',   fecha:'2026-02-04', quien:'Pareja' },
  { id:5, tipo:'egreso',   monto:85,   descripcion:'Restaurante sábado',categoria:'deseo',     fecha:'2026-02-08', quien:'Ambos' },
  { id:6, tipo:'egreso',   monto:200,  descripcion:'Remesa a Mamá',     categoria:'remesa',    fecha:'2026-02-10', quien:'Yo' },
  { id:7, tipo:'egreso',   monto:55,   descripcion:'Luz',               categoria:'basicos',   fecha:'2026-02-10', quien:'Yo' },
  { id:8, tipo:'egreso',   monto:550,  descripcion:'Fondo Emergencia',  categoria:'ahorro',    fecha:'2026-02-01', quien:'Ambos' },
  { id:9, tipo:'egreso',   monto:825,  descripcion:'Inversión mes',     categoria:'inversion', fecha:'2026-02-01', quien:'Ambos' },
]

const CATS = [
  { value: 'basicos',   label: 'Gastos Básicos' },
  { value: 'deseo',     label: 'Gastos Deseo' },
  { value: 'ahorro',    label: 'Ahorro / Metas' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'deuda',     label: 'Deudas' },
  { value: 'remesa',    label: 'Remesas' },
]

const catColor = { basicos:'sky', deseo:'violet', ahorro:'emerald', inversion:'gold', deuda:'rose', remesa:'orange' }

export default function GastosPage() {
  const [movs, setMovs] = useState(DEMO)
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [form, setForm] = useState({ tipo:'egreso', monto:'', descripcion:'', categoria:'basicos', fecha: new Date().toISOString().slice(0,10), quien:'Yo' })

  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s,m) => s+m.monto, 0)
  const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((s,m) => s+m.monto, 0)

  const filtered = movs
    .filter(m => filtro === 'todos' || m.tipo === filtro || m.categoria === filtro)
    .filter(m => !search || m.descripcion.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => new Date(b.fecha) - new Date(a.fecha))

  function handleAdd(e) {
    e.preventDefault()
    setMovs(prev => [{ ...form, id: Date.now(), monto: parseFloat(form.monto) }, ...prev])
    setModal(false)
    setForm({ tipo:'egreso', monto:'', descripcion:'', categoria:'basicos', fecha: new Date().toISOString().slice(0,10), quien:'Yo' })
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Ingresos & Egresos</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo registro
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label:'Ingresos del mes', value: formatCurrency(ingresos), icon: ArrowUpRight, color:'#10b981' },
          { label:'Egresos del mes',  value: formatCurrency(egresos),  icon: ArrowDownRight, color:'#fb7185' },
          { label:'Balance',          value: formatCurrency(ingresos-egresos), icon: null, color: ingresos-egresos>=0 ? '#10b981' : '#fb7185' },
        ].map((s,i) => (
          <div key={i} className="glass-card p-5 animate-enter" style={{ animationDelay: `${i*0.05}s` }}>
            <div className="flex items-center gap-2 mb-2">
              {s.icon && <s.icon size={16} style={{ color: s.color }} />}
              <span className="text-xs text-stone-400 uppercase tracking-wider font-semibold">{s.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="ff-input pl-9 h-10" placeholder="Buscar movimiento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { v:'todos',    l:'Todos' },
            { v:'ingreso',  l:'Ingresos' },
            { v:'egreso',   l:'Egresos' },
            { v:'remesa',   l:'Remesas' },
          ].map(f => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                filtro === f.v
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'ff-btn-ghost'
              }`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="space-y-1">
          {filtered.map((m, i) => (
            <div key={m.id}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-stone-100 transition-colors animate-enter"
              style={{ animationDelay: `${i*0.03}s` }}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${m.tipo==='ingreso' ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                {m.tipo==='ingreso'
                  ? <ArrowUpRight size={14} className="text-emerald-400" />
                  : <ArrowDownRight size={14} className="text-rose-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 truncate">{m.descripcion}</p>
                <p className="text-xs text-stone-400">{new Date(m.fecha).toLocaleDateString('es-ES')} · {m.quien}</p>
              </div>
              <Badge color={catColor[m.categoria] || 'slate'}>
                {CATS.find(c=>c.value===m.categoria)?.label || m.categoria}
              </Badge>
              <p className={`text-sm font-bold w-24 text-right ${m.tipo==='ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {m.tipo==='ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
              </p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-stone-400 py-12 text-sm">No hay registros con ese filtro</p>
          )}
        </div>
      </Card>

      {/* Add modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Registro">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Tipo</label>
              <select className="ff-input" value={form.tipo} onChange={e => setForm({...form, tipo:e.target.value})}>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
            </div>
            <div>
              <label className="ff-label">Monto (€)</label>
              <input className="ff-input" type="number" step="0.01" min="0" placeholder="0.00" required
                value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} />
            </div>
          </div>
          <div>
            <label className="ff-label">Descripción</label>
            <input className="ff-input" placeholder="Ej: Arriendo, Sueldo, Mercado..." required
              value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Categoría</label>
              <select className="ff-input" value={form.categoria} onChange={e => setForm({...form, categoria:e.target.value})}>
                {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="ff-label">Registrado por</label>
              <select className="ff-input" value={form.quien} onChange={e => setForm({...form, quien:e.target.value})}>
                <option>Yo</option>
                <option>Pareja</option>
                <option>Ambos</option>
              </select>
            </div>
          </div>
          <div>
            <label className="ff-label">Fecha</label>
            <input className="ff-input" type="date" value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
