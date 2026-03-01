'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

export default function DeudasPage() {
  const [deudas, setDeudas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ tipo:'debo', nombre:'', entidad:'', monto:'', pendiente:'', cuota:'', estado:'activa', color:'#fb7185' })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('deudas').select('*').order('created_at')
    if (error) setError(error.message)
    else setDeudas(data || [])
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('deudas')
      .insert([{ ...form, monto: parseFloat(form.monto), pendiente: parseFloat(form.pendiente), cuota: parseFloat(form.cuota || 0) }])
      .select()
    if (error) setError(error.message)
    else { setDeudas(prev => [...prev, data[0]]); setModal(false); setForm({ tipo:'debo', nombre:'', entidad:'', monto:'', pendiente:'', cuota:'', estado:'activa', color:'#fb7185' }) }
    setSaving(false)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('deudas').delete().eq('id', id)
    if (!error) setDeudas(prev => prev.filter(d => d.id !== id))
  }

  async function marcarPagada(id) {
    const { error } = await supabase.from('deudas').update({ estado: 'pagada' }).eq('id', id)
    if (!error) setDeudas(prev => prev.map(d => d.id === id ? { ...d, estado: 'pagada' } : d))
  }

  const debo    = deudas.filter(d => d.tipo === 'debo' && d.estado !== 'pagada')
  const medeben = deudas.filter(d => d.tipo === 'medeben' && d.estado !== 'pagada')
  const totalDebo    = debo.reduce((s, d) => s + d.pendiente, 0)
  const totalMedeben = medeben.reduce((s, d) => s + d.pendiente, 0)

  const estadoColor = { activa: 'rose', pagada: 'emerald', mora: 'gold' }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Deudas</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva deuda
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={16} style={{ color: '#C0605A' }} />
            <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Lo que debo</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#C0605A', letterSpacing:'-0.02em' }}>{formatCurrency(totalDebo)}</p>
          <p className="text-xs text-stone-400 mt-1">{debo.length} deuda{debo.length !== 1 ? 's' : ''} activa{debo.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} style={{ color: '#2D7A5F' }} />
            <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold">Me deben</p>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#2D7A5F', letterSpacing:'-0.02em' }}>{formatCurrency(totalMedeben)}</p>
          <p className="text-xs text-stone-400 mt-1">{medeben.length} pendiente{medeben.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin text-stone-400" />
          <span className="text-sm text-stone-400">Cargando deudas...</span>
        </div>
      ) : deudas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">No hay deudas registradas</p>
          <button onClick={() => setModal(true)} className="ff-btn-primary">Agregar deuda</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {deudas.map((d, i) => {
            const pct = Math.min(100, Math.round(((d.monto - d.pendiente) / d.monto) * 100))
            return (
              <Card key={d.id} className="animate-enter group" style={{ animationDelay:`${i*0.05}s` }}>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${d.color}18` }}>
                    {d.tipo === 'debo' ? <TrendingDown size={16} style={{ color: d.color }} /> : <TrendingUp size={16} style={{ color: '#2D7A5F' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-stone-800">{d.nombre}</h3>
                      {d.entidad && <span className="text-xs text-stone-400">· {d.entidad}</span>}
                      <Badge color={estadoColor[d.estado]}>{d.estado}</Badge>
                      <Badge color={d.tipo === 'debo' ? 'rose' : 'emerald'}>{d.tipo === 'debo' ? 'Debo' : 'Me deben'}</Badge>
                    </div>
                    {/* Barra progreso pago */}
                    <div className="w-full h-1.5 rounded-full mb-2" style={{ background: 'var(--progress-track)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.tipo === 'debo' ? d.color : '#2D7A5F' }} />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-stone-400">
                      <span>Pendiente: <span className="font-bold" style={{ color: d.tipo === 'debo' ? d.color : '#2D7A5F' }}>{formatCurrency(d.pendiente)}</span></span>
                      <span>Total: {formatCurrency(d.monto)}</span>
                      {d.cuota > 0 && <span>Cuota: {formatCurrency(d.cuota)}/mes</span>}
                      <span>{pct}% pagado</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {d.estado !== 'pagada' && (
                      <button onClick={() => marcarPagada(d.id)}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(45,122,95,0.1)', color: '#2D7A5F' }}>
                        ✓ Pagada
                      </button>
                    )}
                    <button onClick={() => handleDelete(d.id)} className="p-1.5 rounded-lg" style={{ color: '#C0605A' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Deuda">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {['debo','medeben'].map(t => (
              <button type="button" key={t} onClick={() => setForm({...form, tipo:t})}
                className="py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: form.tipo===t ? (t==='debo' ? 'rgba(192,96,90,0.12)' : 'rgba(45,122,95,0.12)') : 'var(--bg-secondary)',
                  color: form.tipo===t ? (t==='debo' ? '#C0605A' : '#2D7A5F') : 'var(--text-secondary)',
                  border: `1px solid ${form.tipo===t ? (t==='debo' ? 'rgba(192,96,90,0.3)' : 'rgba(45,122,95,0.3)') : 'var(--border-glass)'}`,
                }}>
                {t === 'debo' ? '↑ Yo debo' : '↓ Me deben'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Nombre</label>
              <input className="ff-input" placeholder="Ej: Préstamo banco" required
                value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Entidad / Persona</label>
              <input className="ff-input" placeholder="Ej: Banco, Juan..."
                value={form.entidad} onChange={e => setForm({...form, entidad:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="ff-label">Monto total</label>
              <input className="ff-input" type="number" min="0.01" step="0.01" placeholder="0.00" required
                value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Pendiente</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                value={form.pendiente} onChange={e => setForm({...form, pendiente:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Cuota /mes</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.cuota} onChange={e => setForm({...form, cuota:e.target.value})} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}