'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function SobresPage() {
  const [sobres, setSobres] = useState([])
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [modalSobre, setModalSobre] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [formSobre, setFormSobre] = useState({ nombre:'', emoji:'💰', asignado:'', color:'#10b981' })
  const [formGasto, setFormGasto] = useState({ descripcion:'', monto:'', fecha: new Date().toISOString().slice(0,10) })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from('sobres').select('*').order('created_at'),
      supabase.from('sobres_movimientos').select('*').order('fecha', { ascending: false }),
    ])
    setSobres(s || [])
    setMovimientos(m || [])
    if (s && s.length > 0) setSelected(s[0])
    setLoading(false)
  }

  async function handleAddSobre(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('sobres')
      .insert([{ nombre: formSobre.nombre, emoji: formSobre.emoji, asignado: parseFloat(formSobre.asignado), color: formSobre.color }])
      .select()
    if (error) setError(error.message)
    else {
      setSobres(prev => [...prev, data[0]])
      if (!selected) setSelected(data[0])
      setModalSobre(false)
      setFormSobre({ nombre:'', emoji:'💰', asignado:'', color:'#10b981' })
    }
    setSaving(false)
  }

  async function handleAddGasto(e) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    const { data, error } = await supabase
      .from('sobres_movimientos')
      .insert([{ sobre_id: selected.id, descripcion: formGasto.descripcion, monto: parseFloat(formGasto.monto), fecha: formGasto.fecha }])
      .select()
    if (error) setError(error.message)
    else {
      setMovimientos(prev => [data[0], ...prev])
      setModalGasto(false)
      setFormGasto({ descripcion:'', monto:'', fecha: new Date().toISOString().slice(0,10) })
    }
    setSaving(false)
  }

  async function handleDeleteSobre(id) {
    const { error } = await supabase.from('sobres').delete().eq('id', id)
    if (!error) {
      setSobres(prev => prev.filter(s => s.id !== id))
      setMovimientos(prev => prev.filter(m => m.sobre_id !== id))
      setSelected(sobres.find(s => s.id !== id) || null)
    }
  }

  function gastadoSobre(sobreId) {
    return movimientos.filter(m => m.sobre_id === sobreId).reduce((s, m) => s + m.monto, 0)
  }

  const sobreActual = selected ? sobres.find(s => s.id === selected.id) : null
  const movsActuales = selected ? movimientos.filter(m => m.sobre_id === selected.id) : []
  const gastado = sobreActual ? gastadoSobre(sobreActual.id) : 0
  const disponible = sobreActual ? sobreActual.asignado - gastado : 0

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing:'-0.03em' }}>Sobres Digitales</h1>
        </div>
        <button onClick={() => setModalSobre(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo sobre
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin text-stone-400" />
          <span className="text-sm text-stone-400">Cargando sobres...</span>
        </div>
      ) : sobres.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">No hay sobres aún</p>
          <button onClick={() => setModalSobre(true)} className="ff-btn-primary">Crear primer sobre</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista sobres */}
          <div className="space-y-3">
            {sobres.map(s => {
              const gast = gastadoSobre(s.id)
              const pct = Math.min(100, Math.round((gast / s.asignado) * 100))
              const disp = s.asignado - gast
              const isSelected = selected?.id === s.id
              return (
                <div key={s.id} onClick={() => setSelected(s)}
                  className="glass-card p-4 cursor-pointer transition-all group"
                  style={{ borderColor: isSelected ? `${s.color}40` : undefined, boxShadow: isSelected ? `0 0 16px ${s.color}15` : undefined }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-800 truncate">{s.nombre}</p>
                      <p className="text-xs text-stone-400">Asignado: {formatCurrency(s.asignado)}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteSobre(s.id) }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-opacity"
                      style={{ color: '#C0605A' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <ProgressBar value={gast} max={s.asignado} color={pct > 90 ? '#C0605A' : s.color} className="mb-2" />
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Gastado: {formatCurrency(gast)}</span>
                    <span className="font-bold" style={{ color: disp >= 0 ? s.color : '#C0605A' }}>
                      {disp >= 0 ? `Disponible: ${formatCurrency(disp)}` : `Excedido: ${formatCurrency(Math.abs(disp))}`}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detalle sobre seleccionado */}
          {sobreActual && (
            <div className="col-span-1 lg:col-span-2 space-y-4">
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{sobreActual.emoji}</span>
                    <div>
                      <h3 className="font-bold text-stone-800 text-lg">{sobreActual.nombre}</h3>
                      <p className="text-xs text-stone-400">Presupuesto mensual</p>
                    </div>
                  </div>
                  <button onClick={() => setModalGasto(true)} className="ff-btn-primary flex items-center gap-2">
                    <Plus size={14} /> Gasto
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label:'Asignado', value: formatCurrency(sobreActual.asignado), color:'var(--text-primary)' },
                    { label:'Gastado',  value: formatCurrency(gastado), color:'#C0605A' },
                    { label:'Disponible', value: formatCurrency(disponible), color: disponible >= 0 ? '#2D7A5F' : '#C0605A' },
                  ].map((s,i) => (
                    <div key={i} className="text-center p-3 rounded-xl" style={{ background:'var(--bg-secondary)' }}>
                      <p className="text-xs text-stone-400 mb-1">{s.label}</p>
                      <p className="text-base font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <ProgressBar value={gastado} max={sobreActual.asignado} color={gastado/sobreActual.asignado > 0.9 ? '#C0605A' : sobreActual.color} />
              </Card>

              {/* Movimientos del sobre */}
              <Card>
                <h3 className="font-bold text-stone-800 mb-4">Movimientos</h3>
                {movsActuales.length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-8">Sin gastos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {movsActuales.map(m => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                        style={{ background:'var(--bg-secondary)' }}>
                        <div>
                          <p className="text-sm font-semibold text-stone-800">{m.descripcion}</p>
                          <p className="text-xs text-stone-400">{m.fecha}</p>
                        </div>
                        <p className="text-sm font-bold" style={{ color:'#C0605A' }}>-{formatCurrency(m.monto)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Modal nuevo sobre */}
      <Modal open={modalSobre} onClose={() => setModalSobre(false)} title="Nuevo Sobre">
        <form onSubmit={handleAddSobre} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2} value={formSobre.emoji}
                onChange={e => setFormSobre({...formSobre, emoji:e.target.value})} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre</label>
              <input className="ff-input" placeholder="Ej: Comida, Transporte..." required
                value={formSobre.nombre} onChange={e => setFormSobre({...formSobre, nombre:e.target.value})} />
            </div>
          </div>
          <div>
            <label className="ff-label">Presupuesto mensual</label>
            <input className="ff-input" type="number" min="0.01" step="0.01" placeholder="0.00" required
              value={formSobre.asignado} onChange={e => setFormSobre({...formSobre, asignado:e.target.value})} />
          </div>
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#10b981','#f59e0b','#8b5cf6','#38bdf8','#fb7185','#fb923c'].map(c => (
                <button type="button" key={c} onClick={() => setFormSobre({...formSobre, color:c})}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{ background:c, outline: formSobre.color===c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalSobre(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : 'Crear sobre'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal nuevo gasto */}
      <Modal open={modalGasto} onClose={() => setModalGasto(false)} title={`Gasto en ${sobreActual?.nombre || ''}`}>
        <form onSubmit={handleAddGasto} className="space-y-4">
          <div>
            <label className="ff-label">Descripción</label>
            <input className="ff-input" placeholder="Ej: Supermercado, Gasolina..." required
              value={formGasto.descripcion} onChange={e => setFormGasto({...formGasto, descripcion:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Monto</label>
              <input className="ff-input" type="number" min="0.01" step="0.01" placeholder="0.00" required
                value={formGasto.monto} onChange={e => setFormGasto({...formGasto, monto:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Fecha</label>
              <input className="ff-input" type="date" required
                value={formGasto.fecha} onChange={e => setFormGasto({...formGasto, fecha:e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalGasto(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : 'Registrar gasto'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}