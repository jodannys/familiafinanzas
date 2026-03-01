'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, ArrowUpRight, ArrowDownRight, Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const DEMO = [
  { id:1, tipo:'ingreso',  monto:3200, descripcion:'Sueldo principal',  categoria:'basicos',   fecha:'2026-02-01', quien:'Yo' },
  { id:2, tipo:'ingreso',  monto:2300, descripcion:'Sueldo pareja',     categoria:'basicos',   fecha:'2026-02-01', quien:'Pareja' },
  { id:3, tipo:'egreso',   monto:900,  descripcion:'Arriendo',           categoria:'basicos',   fecha:'2026-02-02', quien:'Yo' },
  { id:4, tipo:'egreso',   monto:320,  descripcion:'Mercado semana 1',   categoria:'basicos',   fecha:'2026-02-04', quien:'Pareja' },
  { id:5, tipo:'egreso',   monto:85,   descripcion:'Restaurante sábado', categoria:'deseo',     fecha:'2026-02-08', quien:'Ambos' },
  { id:6, tipo:'egreso',   monto:200,  descripcion:'Remesa a Mamá',     categoria:'remesa',    fecha:'2026-02-10', quien:'Yo' },
  { id:7, tipo:'egreso',   monto:55,   descripcion:'Luz',               categoria:'basicos',   fecha:'2026-02-10', quien:'Yo' },
  { id:8, tipo:'egreso',   monto:550,  descripcion:'Fondo Emergencia',   categoria:'ahorro',    fecha:'2026-02-01', quien:'Ambos' },
  { id:9, tipo:'egreso',   monto:825,  descripcion:'Inversión mes',      categoria:'inversion', fecha:'2026-02-01', quien:'Ambos' },
]

const CATS = [
  { value: 'basicos',   label: 'Básicos' },
  { value: 'deseo',     label: 'Deseos' },
  { value: 'ahorro',    label: 'Ahorro' },
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
    if(!form.monto || !form.descripcion) return
    setMovs(prev => [{ ...form, id: Date.now(), monto: parseFloat(form.monto) }, ...prev])
    setModal(false)
    setForm({ tipo:'egreso', monto:'', descripcion:'', categoria:'basicos', fecha: new Date().toISOString().slice(0,10), quien:'Yo' })
  }

  return (
    <AppShell>
      {/* Header Responsivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-enter">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest mb-1">Control de Flujo</p>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Ingresos & Egresos</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center justify-center gap-2 py-3 sm:py-2">
          <Plus size={18} /> <span>Nuevo registro</span>
        </button>
      </div>

      {/* Totales: Grid 1 col en móvil, 3 en desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {[
          { label:'Ingresos', value: formatCurrency(ingresos), icon: ArrowUpRight, color:'#10b981', bg:'bg-emerald-500/5' },
          { label:'Egresos',  value: formatCurrency(egresos),  icon: ArrowDownRight, color:'#fb7185', bg:'bg-rose-500/5' },
          { label:'Balance',  value: formatCurrency(ingresos-egresos), icon: null, color: (ingresos-egresos)>=0 ? '#10b981' : '#fb7185', bg:'bg-stone-500/5' },
        ].map((s,i) => (
          <div key={i} className={`glass-card p-4 sm:p-5 animate-enter ${s.bg}`} style={{ animationDelay: `${i*0.05}s` }}>
            <div className="flex items-center gap-2 mb-1">
              {s.icon && <s.icon size={14} style={{ color: s.color }} />}
              <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">{s.label}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Buscador y Filtros con Scroll Lateral */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input 
            className="ff-input pl-10 w-full h-11 text-base sm:text-sm" 
            placeholder="Buscar descripción..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
        
        {/* Filtros deslizables en móvil */}
        <div className="flex gap-2 overflow-x-auto pb-2 flex-nowrap -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar">
          {[
            { v:'todos',   l:'Todos' },
            { v:'ingreso', l:'Ingresos' },
            { v:'egreso',  l:'Egresos' },
            { v:'remesa',  l:'Remesas' },
          ].map(f => (
            <button 
              key={f.v} 
              onClick={() => setFiltro(f.v)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                filtro === f.v 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : 'bg-white text-stone-500 border-stone-200'
              }`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Movimientos */}
      <Card className="overflow-hidden border-none sm:border-solid">
        <div className="divide-y divide-stone-100">
          {filtered.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-stone-50 active:bg-stone-100 transition-colors">
              {/* Icono pequeño */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${m.tipo==='ingreso' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {m.tipo==='ingreso' 
                  ? <ArrowUpRight size={16} className="text-emerald-600" /> 
                  : <ArrowDownRight size={16} className="text-rose-600" />}
              </div>

              {/* Info Central */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-800 truncate leading-none mb-1">{m.descripcion}</p>
                <div className="flex items-center gap-2">
                   <p className="text-[10px] text-stone-400 font-medium">
                    {new Date(m.fecha).toLocaleDateString('es-ES', { day:'2-digit', month:'short' })} · {m.quien}
                  </p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold bg-${catColor[m.categoria]}-100 text-${catColor[m.categoria]}-600`}>
                    {m.categoria}
                  </span>
                </div>
              </div>

              {/* Monto a la derecha */}
              <div className="text-right">
                <p className={`text-sm font-black ${m.tipo==='ingreso' ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {m.tipo==='ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                </p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-stone-400 text-sm italic">No se encontraron movimientos</p>
            </div>
          )}
        </div>
      </Card>

      {/* Modal Ajustado para Móvil (Formulario de abajo hacia arriba) */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Registro">
        <form onSubmit={handleAdd} className="space-y-5 pb-6">
          <div className="flex bg-stone-100 p-1 rounded-xl">
            {['egreso', 'ingreso'].map(t => (
              <button 
                key={t} type="button"
                onClick={() => setForm({...form, tipo: t})}
                className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-all ${form.tipo === t ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400'}`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Monto (€)</label>
              <input 
                className="ff-input mt-1 text-lg font-bold" 
                type="number" 
                inputMode="decimal"
                placeholder="0.00" 
                required
                value={form.monto} 
                onChange={e => setForm({...form, monto: e.target.value})} 
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Fecha</label>
              <input 
                className="ff-input mt-1" 
                type="date" 
                value={form.fecha} 
                onChange={e => setForm({...form, fecha: e.target.value})} 
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Descripción</label>
            <input 
              className="ff-input mt-1" 
              placeholder="Ej: Compra Mercadona..." 
              required
              value={form.descripcion} 
              onChange={e => setForm({...form, descripcion: e.target.value})} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Categoría</label>
              <select className="ff-input mt-1" value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">¿Quién?</label>
              <select className="ff-input mt-1" value={form.quien} onChange={e => setForm({...form, quien: e.target.value})}>
                <option>Yo</option>
                <option>Pareja</option>
                <option>Ambos</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1 py-4 text-sm font-bold">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1 py-4 text-sm font-bold">Guardar</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}