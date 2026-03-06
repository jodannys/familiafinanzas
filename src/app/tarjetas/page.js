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
  const [tarjetas, setTarjetas] = useState([])
  const [deudas, setDeudas] = useState([]) // NUEVO: Para guardar el desglose
  const [usadoPorTarjeta, setUsadoPorTarjeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [form, setForm] = useState({
    nombre_tarjeta: '', banco: '', limite_credito: '',
    dia_corte: '', dia_pago: '', estado: 'activa', color: '#4A6FA5'
  })

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

      const { data: movs } = await supabase
        .from('deuda_movimientos')
        .select('deuda_id, tipo, monto')
        .in('deuda_id', ids)

      const { data: deudasTarjeta } = await supabase
        .from('deudas')
        .select('id, nombre, perfil_tarjeta_id, pendiente, estado') // Traemos el nombre también
        .eq('tipo_deuda', 'tarjeta')
        .neq('estado', 'pagada')

      setDeudas(deudasTarjeta || []) // GUARDAMOS EN EL ESTADO

      const usado = {}
      tarjetasData.forEach(t => { usado[t.id] = 0 })

      ;(movs || []).forEach(m => {
        if (m.tipo === 'cargo') usado[m.deuda_id] = (usado[m.deuda_id] || 0) + m.monto
        if (m.tipo === 'pago') usado[m.deuda_id] = (usado[m.deuda_id] || 0) - m.monto
      })

      tarjetasData.forEach(t => {
        const deudasEsa = (deudasTarjeta || []).filter(d => d.perfil_tarjeta_id === t.id)
        const pendienteSuma = deudasEsa.reduce((s, d) => s + (d.pendiente || 0), 0)
        usado[t.id] = (usado[t.id] || 0) + pendienteSuma
      })

      Object.keys(usado).forEach(k => { usado[k] = Math.max(0, usado[k]) })
      setUsadoPorTarjeta(usado)
    }

    setLoading(false)
  }

  // ... funciones openModal, closeModal, handleSubmit, handleToggleEstado, handleDelete igual que antes ...
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
    e.preventDefault(); setSaving(true)
    const payload = { ...form, limite_credito: parseFloat(form.limite_credito) || 0 }
    if (editingId) {
      await supabase.from('perfiles_tarjetas').update(payload).eq('id', editingId)
      setTarjetas(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t))
    } else {
      const { data } = await supabase.from('perfiles_tarjetas').insert([payload]).select()
      setTarjetas(prev => [data[0], ...prev])
    }
    setSaving(false); closeModal()
  }
  async function handleToggleEstado(tarjeta) {
    const nuevoEstado = tarjeta.estado === 'activa' ? 'pausada' : 'activa'
    await supabase.from('perfiles_tarjetas').update({ estado: nuevoEstado }).eq('id', tarjeta.id)
    setTarjetas(prev => prev.map(t => t.id === tarjeta.id ? { ...t, estado: nuevoEstado } : t))
  }
  async function handleDelete(id) {
    if (!confirm('¿Seguro?')) return
    await supabase.from('perfiles_tarjetas').delete().eq('id', id)
    setTarjetas(prev => prev.filter(t => t.id !== id))
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tarjetas.map((t, i) => {
            const isSelected = selectedId === t.id
            const usado = usadoPorTarjeta[t.id] || 0
            const limite = t.limite_credito || 0
            const disponible = Math.max(0, limite - usado)
            const pctUsado = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0

            return (
              <Card key={t.id}
                onClick={() => setSelectedId(isSelected ? null : t.id)}
                className={`cursor-pointer transition-all ${t.estado === 'pausada' ? 'opacity-60' : ''}`}
                style={{ 
                   border: isSelected ? `1px solid ${t.color}80` : '1px solid transparent',
                   padding: '16px' 
                }}>
                
                {/* Cabecera Tarjeta */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${t.color}20`, color: t.color }}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-stone-400 leading-none mb-1">{t.banco}</p>
                      <h3 className="font-black text-stone-800 text-sm leading-none">{t.nombre_tarjeta}</h3>
                    </div>
                  </div>
                </div>

                {/* Barra de Progreso */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-black uppercase text-stone-400">Usado</span>
                    <span className="text-sm font-black" style={{ color: t.color }}>{formatCurrency(usado)}</span>
                  </div>
                  <ProgressBar value={usado} max={limite} color={pctUsado > 80 ? '#C0605A' : t.color} />
                  <div className="flex justify-between text-[10px] font-bold text-stone-500">
                    <span>{pctUsado}% usado</span>
                    <span className="text-emerald-600">Disp: {formatCurrency(disponible)}</span>
                  </div>
                </div>

                {/* Info Corte/Pago + Botones */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-[11px] font-bold text-stone-600">
                    <span>Corte: {t.dia_corte}</span>
                    <span>Pago: {t.dia_pago}</span>
                  </div>
                  {isSelected && (
                    <div className="flex gap-1">
                      <IconBtn onClick={e => { e.stopPropagation(); handleToggleEstado(t) }} bg="var(--bg-secondary)" color={t.color}>
                        {t.estado === 'pausada' ? <Play size={14} /> : <Pause size={14} />}
                      </IconBtn>
                      <IconBtn onClick={e => { e.stopPropagation(); openModal(t) }} bg="var(--bg-secondary)" color="stone-400">
                        <Pencil size={14} />
                      </IconBtn>
                      <IconBtn onClick={e => { e.stopPropagation(); handleDelete(t.id) }} bg="#C0605A15" color="#C0605A">
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  )}
                </div>

                {/* DETALLE DE DEUDAS (AHORA SÍ, DENTRO DEL MAP) */}
                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-2 animate-in slide-in-from-top-2">
                    <p className="text-[10px] font-black uppercase text-stone-400">Compras a plazos:</p>
                    {deudas.filter(d => d.perfil_tarjeta_id === t.id).length === 0 ? (
                      <p className="text-[11px] text-stone-400 italic">No hay compras activas</p>
                    ) : (
                      deudas.filter(d => d.perfil_tarjeta_id === t.id).map(deuda => (
                        <div key={deuda.id} className="flex justify-between items-center bg-stone-50 p-2 rounded-lg">
                          <span className="text-[11px] font-bold text-stone-700">{deuda.nombre}</span>
                          <span className="text-[11px] font-black text-stone-600">{formatCurrency(deuda.pendiente)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal - Igual que antes */}
      <Modal open={modal} onClose={closeModal} title={editingId ? 'Editar Tarjeta' : 'Nueva Tarjeta'}>
        {/* ... form contenido ... */}
      </Modal>
    </AppShell>
  )
}