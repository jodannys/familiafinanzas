'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Wallet, ShoppingCart, Coffee, Zap } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

const DEMO_SOBRES = [
  { id:1, nombre:'Gastos Libres',  emoji:'💰', asignado:150, gastado:62.30, color:'#10b981', movs:[
    { id:1, desc:'Dulces super',   monto:3.50, fecha:'2026-02-12' },
    { id:2, desc:'Café',           monto:1.80, fecha:'2026-02-13' },
    { id:3, desc:'Libro',          monto:12.00,fecha:'2026-02-14' },
    { id:4, desc:'',               monto:45.00,fecha:'2026-02-15' },
  ]},
  { id:2, nombre:'Salidas / Ocio', emoji:'🎉', asignado:200, gastado:145.00, color:'#8b5cf6', movs:[
    { id:1, desc:'Cine pareja',    monto:22.00,fecha:'2026-02-09' },
    { id:2, desc:'Cena sábado',    monto:68.00,fecha:'2026-02-15' },
    { id:3, desc:'Parque acuático',monto:55.00,fecha:'2026-02-20' },
  ]},
  { id:3, nombre:'Antojos / Comida', emoji:'🍕', asignado:80, gastado:80.00, color:'#fb923c', movs:[
    { id:1, desc:'Pizza viernes',  monto:24.00,fecha:'2026-02-07' },
    { id:2, desc:'Sushi',          monto:31.00,fecha:'2026-02-14' },
    { id:3, desc:'Helados',        monto:9.50, fecha:'2026-02-16' },
    { id:4, desc:'Snacks semana',  monto:15.50,fecha:'2026-02-21' },
  ]},
]

export default function SobresPage() {
  const [sobres, setSobres] = useState(DEMO_SOBRES)
  const [selected, setSelected] = useState(DEMO_SOBRES[0])
  const [modalSobre, setModalSobre] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [formSobre, setFormSobre] = useState({ nombre:'', emoji:'💰', asignado:'', color:'#10b981' })
  const [formGasto, setFormGasto] = useState({ desc:'', monto:'', fecha: new Date().toISOString().slice(0,10) })

  function handleAddSobre(e) {
    e.preventDefault()
    const nuevo = { ...formSobre, id:Date.now(), asignado:parseFloat(formSobre.asignado), gastado:0, movs:[] }
    setSobres(prev => [...prev, nuevo])
    setSelected(nuevo)
    setModalSobre(false)
    setFormSobre({ nombre:'', emoji:'💰', asignado:'', color:'#10b981' })
  }

  function handleAddGasto(e) {
    e.preventDefault()
    const nuevoMov = { id:Date.now(), ...formGasto, monto:parseFloat(formGasto.monto) }
    setSobres(prev => prev.map(s => {
      if (s.id !== selected.id) return s
      const updated = { ...s, movs:[...s.movs, nuevoMov], gastado: s.gastado + nuevoMov.monto }
      setSelected(updated)
      return updated
    }))
    setModalGasto(false)
    setFormGasto({ desc:'', monto:'', fecha: new Date().toISOString().slice(0,10) })
  }

  const sobreActual = sobres.find(s => s.id === selected?.id) || sobres[0]
  const disponible = sobreActual.asignado - sobreActual.gastado
  const pct = Math.min(100, Math.round((sobreActual.gastado / sobreActual.asignado) * 100))

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-3xl font-bold text-stone-800" style={{ letterSpacing:'-0.03em' }}>Sobres Digitales</h1>
          <p className="text-sm text-stone-400 mt-1">Control de gastos diarios por categoría</p>
        </div>
        <button onClick={() => setModalSobre(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo sobre
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Sobre list */}
        <div className="space-y-3">
          {sobres.map(s => {
            const pct = Math.min(100, Math.round((s.gastado/s.asignado)*100))
            const isActive = sobreActual.id === s.id
            const agotado = s.gastado >= s.asignado
            return (
              <div key={s.id} onClick={() => setSelected(s)}
                className="glass-card p-4 cursor-pointer hover:border-white/15 transition-all duration-200"
                style={{ borderColor: isActive ? `${s.color}40` : undefined }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{s.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-stone-800">{s.nombre}</p>
                    <div className="flex items-center gap-2">
                      {agotado
                        ? <span className="text-xs text-rose-400 font-semibold">Agotado</span>
                        : <span className="text-xs font-semibold" style={{ color:s.color }}>€{(s.asignado-s.gastado).toFixed(2)} libres</span>}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-stone-400">{pct}%</span>
                </div>
                <ProgressBar value={s.gastado} max={s.asignado}
                  color={agotado ? '#fb7185' : s.color} />
                <div className="flex justify-between text-xs text-stone-400 mt-2">
                  <span>€{s.gastado.toFixed(2)} gastado</span>
                  <span>de €{s.asignado.toFixed(2)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail */}
        <div className="col-span-2 space-y-5">
          {/* Header card */}
          <div className="glass-card p-6" style={{ borderColor:`${sobreActual.color}30` }}>
            <div className="flex items-center gap-4 mb-5">
              <span className="text-4xl">{sobreActual.emoji}</span>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-stone-800">{sobreActual.nombre}</h2>
                <p className="text-sm text-stone-400">Presupuesto mensual: {formatCurrency(sobreActual.asignado)}</p>
              </div>
              <button onClick={() => setModalGasto(true)} className="ff-btn-primary flex items-center gap-2">
                <Plus size={14} /> Anotar gasto
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-stone-400 mb-1">Gastado</p>
                <p className="text-xl font-bold text-rose-400">{formatCurrency(sobreActual.gastado)}</p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">Disponible</p>
                <p className="text-xl font-bold" style={{ color: disponible < 0 ? '#fb7185' : sobreActual.color }}>
                  {formatCurrency(disponible)}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-400 mb-1">Uso</p>
                <p className="text-xl font-bold text-stone-800">{pct}%</p>
              </div>
            </div>
            <ProgressBar value={sobreActual.gastado} max={sobreActual.asignado}
              color={pct >= 100 ? '#fb7185' : sobreActual.color} />
          </div>

          {/* Movimientos */}
          <Card>
            <h3 className="font-bold text-stone-800 mb-4">Gastos registrados ({sobreActual.movs.length})</h3>
            {sobreActual.movs.length === 0
              ? <p className="text-center text-stone-400 py-8 text-sm">No hay gastos registrados en este sobre</p>
              : (
                <div className="space-y-1">
                  {[...sobreActual.movs].reverse().map((m, i) => (
                    <div key={m.id} className="flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-stone-100 transition-colors">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background:`${sobreActual.color}18` }}>
                        <ShoppingCart size={12} style={{ color:sobreActual.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-stone-800 font-medium">
                          {m.desc || <span className="text-stone-400 italic">Sin descripción</span>}
                        </p>
                        <p className="text-xs text-stone-400">{new Date(m.fecha).toLocaleDateString('es-ES')}</p>
                      </div>
                      <p className="text-sm font-bold text-rose-400">-{formatCurrency(m.monto)}</p>
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </div>
      </div>

      {/* Add sobre modal */}
      <Modal open={modalSobre} onClose={() => setModalSobre(false)} title="Nuevo Sobre Digital">
        <form onSubmit={handleAddSobre} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2} value={formSobre.emoji}
                onChange={e => setFormSobre({...formSobre, emoji:e.target.value})} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre del sobre</label>
              <input className="ff-input" placeholder="Ej: Gastos Libres, Antojos..." required
                value={formSobre.nombre} onChange={e => setFormSobre({...formSobre, nombre:e.target.value})} />
            </div>
          </div>
          <div>
            <label className="ff-label">Monto mensual asignado (€)</label>
            <input className="ff-input" type="number" min="1" step="0.01" placeholder="0.00" required
              value={formSobre.asignado} onChange={e => setFormSobre({...formSobre, asignado:e.target.value})} />
          </div>
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#10b981','#f59e0b','#8b5cf6','#38bdf8','#fb7185','#fb923c'].map(c => (
                <button type="button" key={c} onClick={() => setFormSobre({...formSobre, color:c})}
                  className="w-8 h-8 rounded-full" style={{ background:c, boxShadow: formSobre.color===c ? `0 0 0 3px rgba(255,255,255,0.3)` : 'none' }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalSobre(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">Crear sobre</button>
          </div>
        </form>
      </Modal>

      {/* Add gasto modal */}
      <Modal open={modalGasto} onClose={() => setModalGasto(false)} title={`Anotar gasto — ${sobreActual.nombre}`} size="sm">
        <form onSubmit={handleAddGasto} className="space-y-4">
          <div>
            <label className="ff-label">Monto (€)</label>
            <input className="ff-input text-2xl font-bold text-center" type="number" min="0.01" step="0.01" placeholder="0.00" required
              value={formGasto.monto} onChange={e => setFormGasto({...formGasto, monto:e.target.value})} />
          </div>
          <div>
            <label className="ff-label">Descripción <span className="text-stone-400 normal-case font-normal">(opcional)</span></label>
            <input className="ff-input" placeholder="Ej: Dulces, Café, Revista..."
              value={formGasto.desc} onChange={e => setFormGasto({...formGasto, desc:e.target.value})} />
          </div>
          <div>
            <label className="ff-label">Fecha</label>
            <input className="ff-input" type="date" value={formGasto.fecha}
              onChange={e => setFormGasto({...formGasto, fecha:e.target.value})} />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModalGasto(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">Guardar</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
