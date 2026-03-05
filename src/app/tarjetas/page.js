'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Pencil, Pause, Play, CreditCard, Calendar, Banknote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

// Reutilizamos tu componente de botones
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
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  
  const [form, setForm] = useState({ 
    nombre: '', banco: '', limite: '', dia_corte: '', dia_pago: '', estado: 'activa' 
  })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('perfiles_tarjetas').select('*').order('created_at')
    setTarjetas(data || [])
    setLoading(false)
  }

  const closeModal = () => {
    setModal(false)
    setEditingId(null)
    setForm({ nombre: '', banco: '', limite: '', dia_corte: '', dia_pago: '', estado: 'activa' })
  }

  async function handleEstado(id, nuevoEstado) {
    const { error } = await supabase.from('perfiles_tarjetas').update({ estado: nuevoEstado }).eq('id', id)
    if (!error) setTarjetas(prev => prev.map(t => t.id === id ? { ...t, estado: nuevoEstado } : t))
  }

  return (
    <AppShell>
      {/* Header idéntico a tu app */}
      <div className="flex items-center justify-between mb-6 animate-enter">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Configuración</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight">Mis Tarjetas</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-bold">Nueva tarjeta</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-stone-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tarjetas.map((tarjeta, i) => {
            const isSelected = selectedId === tarjeta.id
            const isPausada = tarjeta.estado === 'pausada'
            
            return (
              <Card 
                key={tarjeta.id}
                onClick={() => setSelectedId(isSelected ? null : tarjeta.id)}
                className={`animate-enter cursor-pointer transition-all duration-300 ${isPausada ? 'opacity-60' : ''}`}
                style={{ 
                  animationDelay: `${i * 0.05}s`,
                  border: isSelected ? `1px solid var(--accent-blue)40` : '1px solid transparent',
                  background: isSelected ? 'var(--bg-secondary)' : '',
                  padding: '16px'
                }}
              >
                {/* Cabecera Tarjeta */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" 
                         style={{ background: isPausada ? 'var(--bg-secondary)' : 'rgba(74,111,165,0.1)', color: '#4A6FA5' }}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider leading-none mb-1">{tarjeta.banco}</p>
                      <h3 className="font-black text-stone-800 text-sm leading-none">{tarjeta.nombre}</h3>
                    </div>
                  </div>
                  {isPausada && <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-2 py-1 rounded-lg uppercase">Desactivada</span>}
                </div>

                {/* Barra de Crédito */}
                <div className="space-y-1.5 mb-4">
                   <div className="flex justify-between text-[10px] font-bold text-stone-500">
                      <span>Uso de crédito</span>
                      <span>0€ / {formatCurrency(tarjeta.limite)}</span>
                   </div>
                   <ProgressBar value={0} max={tarjeta.limite} color={isPausada ? '#A8A29E' : '#10b981'} />
                </div>

                {/* Fechas y Botones */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-stone-400" />
                      <span className="text-[11px] font-bold text-stone-600">Corte: {tarjeta.dia_corte}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Banknote size={12} className="text-stone-400" />
                      <span className="text-[11px] font-bold text-stone-600">Pago: {tarjeta.dia_pago}</span>
                    </div>
                  </div>

                  {/* BOTONES: Solo aparecen si haces clic en la tarjeta */}
                  {isSelected && (
                    <div className="flex gap-1 animate-in fade-in zoom-in-95 duration-200">
                      <IconBtn 
                        onClick={(e) => { e.stopPropagation(); handleEstado(tarjeta.id, isPausada ? 'activa' : 'pausada') }}
                        bg={isPausada ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'} 
                        color={isPausada ? '#10b981' : '#f59e0b'}
                      >
                        {isPausada ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                      </IconBtn>
                      
                      <IconBtn onClick={(e) => { e.stopPropagation(); /* lógica editar */ }} bg="var(--bg-secondary)" color="var(--text-muted)">
                        <Pencil size={14} />
                      </IconBtn>

                      <IconBtn onClick={(e) => { e.stopPropagation(); /* lógica borrar */ }} bg="rgba(192,96,90,0.1)" color="#C0605A">
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

      {/* Modal - Reutilizando tus clases ff-input y ff-label */}
      <Modal open={modal} onClose={closeModal} title={editingId ? 'Editar Tarjeta' : 'Configurar Nueva Tarjeta'}>
        <form className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Banco</label>
              <input className="ff-input" placeholder="Ej: Santander" />
            </div>
            <div>
              <label className="ff-label">Nombre Tarjeta</label>
              <input className="ff-input" placeholder="Ej: Visa Jodannys" />
            </div>
          </div>
          <div>
            <label className="ff-label">Límite de Crédito</label>
            <input className="ff-input" type="number" placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Día de Corte</label>
              <input className="ff-input" type="number" placeholder="1-31" />
            </div>
            <div>
              <label className="ff-label">Día de Pago</label>
              <input className="ff-input" type="number" placeholder="1-31" />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={closeModal} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">Guardar Tarjeta</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}