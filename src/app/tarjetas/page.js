'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Pencil, Pause, Play, CreditCard, Calendar, Banknote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 36, height: 36, flexShrink: 0 }}>
      {children}
    </button>
  )
}

export default function TarjetasPage() {
  const [tarjetas, setTarjetas]             = useState([])
  const [usadoPorTarjeta, setUsadoPorTarjeta] = useState({})
  const [loading, setLoading]               = useState(true)
  const [saving, setSaving]                 = useState(false)
  const [selectedId, setSelectedId]         = useState(null)
  const [modal, setModal]                   = useState(false)
  const [editingId, setEditingId]           = useState(null)

  const [form, setForm] = useState({
    nombre_tarjeta: '', banco: '', limite_credito: '',
    dia_corte: '', dia_pago: '', estado: 'activa', color: '#4A6FA5'
  })

  // Cargar al montar Y cada vez que la página vuelve a ser visible
  // (por ej. al volver desde gastos/deudas después de borrar un movimiento)
  useEffect(() => {
    cargar()

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') cargar()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  async function cargar() {
    setLoading(true)

    const { data: tarjetasData, error: e1 } = await supabase
      .from('perfiles_tarjetas').select('*').order('created_at', { ascending: false })
    if (e1) { setLoading(false); return }

    setTarjetas(tarjetasData || [])

    if (tarjetasData?.length) {
      const ids = tarjetasData.map(t => t.id)

      // A) Cargos directos en deuda_movimientos cuyo deuda_id = id del perfil
      const { data: movs } = await supabase
        .from('deuda_movimientos')
        .select('deuda_id, tipo, monto')
        .in('deuda_id', ids)

      // B) Pendiente de compras a plazos (deudas tipo 'tarjeta' activas),
      //    agrupadas por color ya que no hay FK explícita hacia perfiles_tarjetas
      const { data: deudasTarjeta } = await supabase
        .from('deudas')
        .select('id, color, pendiente, estado')
        .eq('tipo_deuda', 'tarjeta')
        .neq('estado', 'pagada')

      const usado = {}
      tarjetasData.forEach(t => { usado[t.id] = 0 })

      // Sumar cargos directos
      ;(movs || []).forEach(m => {
        if (ids.includes(m.deuda_id)) {
          if (m.tipo === 'cargo') usado[m.deuda_id] = (usado[m.deuda_id] || 0) + m.monto
          if (m.tipo === 'pago')  usado[m.deuda_id] = (usado[m.deuda_id] || 0) - m.monto
        }
      })

      // Sumar pendiente de compras a plazos agrupado por color
      tarjetasData.forEach(t => {
        const deudasEsa   = (deudasTarjeta || []).filter(d => d.color === t.color)
        const pendienteSuma = deudasEsa.reduce((s, d) => s + (d.pendiente || 0), 0)
        usado[t.id] = (usado[t.id] || 0) + pendienteSuma
      })

      // No puede ser negativo
      Object.keys(usado).forEach(k => { usado[k] = Math.max(0, usado[k]) })

      setUsadoPorTarjeta(usado)
    }

    setLoading(false)
  }

  const openModal = (tarjeta = null) => {
    if (tarjeta) {
      setEditingId(tarjeta.id)
      setForm({ ...tarjeta })
    } else {
      setEditingId(null)
      setForm({ nombre_tarjeta: '', banco: '', limite_credito: '', dia_corte: '', dia_pago: '', estado: 'activa', color: '#4A6FA5' })
    }
    setModal(true)
  }

  const closeModal = () => { setModal(false); setEditingId(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre_tarjeta: form.nombre_tarjeta,
      banco: form.banco,
      limite_credito: parseFloat(form.limite_credito) || 0,
      dia_corte: parseInt(form.dia_corte),
      dia_pago: parseInt(form.dia_pago),
      estado: form.estado || 'activa',
      color: form.color || '#4A6FA5'
    }

    if (editingId) {
      const { error } = await supabase.from('perfiles_tarjetas').update(payload).eq('id', editingId)
      if (error) alert('Error al actualizar: ' + error.message)
      else { setTarjetas(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t)); closeModal() }
    } else {
      const { data, error } = await supabase.from('perfiles_tarjetas').insert([payload]).select()
      if (error) alert('Error al insertar: ' + error.message)
      else { setTarjetas(prev => [data[0], ...prev]); closeModal() }
    }
    setSaving(false)
  }

  async function handleToggleEstado(tarjeta) {
    const nuevoEstado = tarjeta.estado === 'activa' ? 'pausada' : 'activa'
    const { error } = await supabase.from('perfiles_tarjetas').update({ estado: nuevoEstado }).eq('id', tarjeta.id)
    if (!error) setTarjetas(prev => prev.map(t => t.id === tarjeta.id ? { ...t, estado: nuevoEstado } : t))
  }

  async function handleDelete(id) {
    if (!confirm('¿Seguro que quieres eliminar esta tarjeta?')) return
    const { error } = await supabase.from('perfiles_tarjetas').delete().eq('id', id)
    if (!error) { setTarjetas(prev => prev.filter(t => t.id !== id)); setSelectedId(null) }
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 animate-enter">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Configuración</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight">Mis Tarjetas</h1>
        </div>
        <button onClick={() => openModal()} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} strokeWidth={3} />
          <span className="text-sm font-bold">Nueva tarjeta</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-stone-400" /></div>
      ) : tarjetas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">No hay tarjetas configuradas</p>
          <button onClick={() => openModal()} className="ff-btn-primary">Añadir primera tarjeta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tarjetas.map((t, i) => {
            const isSelected = selectedId === t.id
            const isPausada  = t.estado === 'pausada'
            const usado      = usadoPorTarjeta[t.id] || 0
            const limite     = t.limite_credito || 0
            const disponible = Math.max(0, limite - usado)
            const pctUsado   = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0

            return (
              <Card key={t.id}
                onClick={() => setSelectedId(isSelected ? null : t.id)}
                className={`animate-enter cursor-pointer transition-all duration-300 ${isPausada ? 'opacity-60' : ''}`}
                style={{
                  animationDelay: `${i * 0.05}s`,
                  border: isSelected ? `1px solid ${t.color || '#4A6FA5'}80` : '1px solid transparent',
                  background: isSelected ? 'var(--bg-secondary)' : '',
                  padding: '16px'
                }}>

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: isPausada ? 'var(--bg-secondary)' : `${t.color || '#4A6FA5'}20`, color: t.color || '#4A6FA5' }}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider leading-none mb-1">{t.banco}</p>
                      <h3 className="font-black text-stone-800 text-sm leading-none">{t.nombre_tarjeta}</h3>
                    </div>
                  </div>
                  {isPausada && (
                    <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-2 py-1 rounded-lg uppercase">Desactivada</span>
                  )}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase text-stone-400">Usado</span>
                    <div className="text-right">
                      <span className="text-sm font-black" style={{ color: pctUsado > 80 ? '#C0605A' : (t.color || '#4A6FA5') }}>
                        {formatCurrency(usado)}
                      </span>
                      <span className="text-[10px] text-stone-400 ml-1">/ {formatCurrency(limite)}</span>
                    </div>
                  </div>
                  <ProgressBar
                    value={usado} max={limite}
                    color={isPausada ? '#A8A29E' : (pctUsado > 80 ? '#C0605A' : (t.color || '#10b981'))}
                  />
                  <div className="flex justify-between text-[10px] font-bold">
                    <span style={{ color: pctUsado > 80 ? '#C0605A' : '#78716c' }}>{pctUsado}% usado</span>
                    <span style={{ color: '#2D7A5F' }}>Disponible: {formatCurrency(disponible)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-stone-400" />
                      <span className="text-[11px] font-bold text-stone-600">Corte: {t.dia_corte}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Banknote size={12} className="text-stone-400" />
                      <span className="text-[11px] font-bold text-stone-600">Pago: {t.dia_pago}</span>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="flex gap-1 animate-in fade-in zoom-in-95 duration-200">
                      <IconBtn
                        onClick={e => { e.stopPropagation(); handleToggleEstado(t) }}
                        bg={isPausada ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}
                        color={isPausada ? '#10b981' : '#f59e0b'}>
                        {isPausada ? <Play size={14} /> : <Pause size={14} />}
                      </IconBtn>
                      <IconBtn onClick={e => { e.stopPropagation(); openModal(t) }} bg="var(--bg-secondary)" color="var(--text-muted)">
                        <Pencil size={14} />
                      </IconBtn>
                      <IconBtn onClick={e => { e.stopPropagation(); handleDelete(t.id) }} bg="rgba(192,96,90,0.1)" color="#C0605A">
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={closeModal} title={editingId ? 'Editar Tarjeta' : 'Configurar Nueva Tarjeta'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Banco</label>
              <input className="ff-input" required value={form.banco}
                onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="Ej: BBVA" />
            </div>
            <div>
              <label className="ff-label">Nombre Tarjeta</label>
              <input className="ff-input" required value={form.nombre_tarjeta}
                onChange={e => setForm({ ...form, nombre_tarjeta: e.target.value })} placeholder="Ej: Visa Jodannys" />
            </div>
          </div>
          <div>
            <label className="ff-label">Límite de Crédito (€)</label>
            <input className="ff-input" type="number" required value={form.limite_credito}
              onChange={e => setForm({ ...form, limite_credito: e.target.value })} placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Día de Corte</label>
              <input className="ff-input" type="number" min="1" max="31" required value={form.dia_corte}
                onChange={e => setForm({ ...form, dia_corte: e.target.value })} placeholder="1-31" />
            </div>
            <div>
              <label className="ff-label">Día de Pago</label>
              <input className="ff-input" type="number" min="1" max="31" required value={form.dia_pago}
                onChange={e => setForm({ ...form, dia_pago: e.target.value })} placeholder="1-31" />
            </div>
          </div>
          <div>
            <label className="ff-label">Color Distintivo</label>
            <div className="flex gap-2 mt-2">
              {['#4A6FA5', '#10b981', '#f59e0b', '#8b5cf6', '#C0605A', '#818CF8', '#C17A3A'].map(c => (
                <button key={c} type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : 'opacity-50'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={closeModal} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Guardar Cambios' : 'Crear Tarjeta'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}