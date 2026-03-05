'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Pencil, Pause, Play, CreditCard, Calendar, Banknote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

// Componente interno para los botones de acción
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
    const [saving, setSaving] = useState(false)
    const [selectedId, setSelectedId] = useState(null)
    const [modal, setModal] = useState(false)
    const [editingId, setEditingId] = useState(null)

    // Formulario
    const [form, setForm] = useState({
        nombre_tarjeta: '', banco: '', limite_credito: '', dia_corte: '', dia_pago: '', estado: 'activa'
    })

    useEffect(() => { cargar() }, [])

    async function cargar() {
        setLoading(true)
        const { data, error } = await supabase
            .from('perfiles_tarjetas')
            .select('*')
            .order('created_at', { ascending: false })
        if (!error) setTarjetas(data || [])
        setLoading(false)
    }

    const openModal = (tarjeta = null) => {
        if (tarjeta) {
            setEditingId(tarjeta.id)
            setForm({ ...tarjeta })
        } else {
            setEditingId(null)
            setForm({ nombre_tarjeta: '', banco: '', limite_credito: '', dia_corte: '', dia_pago: '', estado: 'activa' })
        }
        setModal(true)
    }

    const closeModal = () => {
        setModal(false)
        setEditingId(null)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)

        // Forzamos la conversión de tipos para que Supabase no dé error 400
        const payload = {
            nombre_tarjeta: form.nombre_tarjeta,
            banco: form.banco,
            limite_credito: parseFloat(form.limite_credito) || 0, // Convertir a decimal
            dia_corte: parseInt(form.dia_corte),                // Convertir a entero
            dia_pago: parseInt(form.dia_pago),                 // Convertir a entero
            estado: form.estado || 'activa'
        }

        if (editingId) {
            const { error } = await supabase.from('perfiles_tarjetas').update(payload).eq('id', editingId)
            if (error) {
                console.error("Error al actualizar:", error.message)
                alert("Error: " + error.message) // Para ver el detalle exacto si falla
            } else {
                setTarjetas(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t))
                closeModal()
            }
        } else {
            const { data, error } = await supabase.from('perfiles_tarjetas').insert([payload]).select()
            if (error) {
                console.error("Error al insertar:", error.message)
                alert("Error: " + error.message) // Esto nos dirá qué columna falla
            } else {
                setTarjetas(prev => [data[0], ...prev])
                closeModal()
            }
        }
        setSaving(false)
    }
    async function handleToggleEstado(tarjeta) {
        const nuevoEstado = tarjeta.estado === 'activa' ? 'pausada' : 'activa'
        const { error } = await supabase.from('perfiles_tarjetas').update({ estado: nuevoEstado }).eq('id', tarjeta.id)
        if (!error) {
            setTarjetas(prev => prev.map(t => t.id === tarjeta.id ? { ...t, estado: nuevoEstado } : t))
        }
    }

    async function handleDelete(id) {
        if (!confirm('¿Seguro que quieres eliminar esta tarjeta?')) return
        const { error } = await supabase.from('perfiles_tarjetas').delete().eq('id', id)
        if (!error) {
            setTarjetas(prev => prev.filter(t => t.id !== id))
            setSelectedId(null)
        }
    }

    return (
        <AppShell>
            {/* HEADER */}
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

            {/* LISTADO */}
            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-stone-400" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tarjetas.map((t, i) => {
                        const isSelected = selectedId === t.id
                        const isPausada = t.estado === 'pausada'

                        return (
                            <Card
                                key={t.id}
                                onClick={() => setSelectedId(isSelected ? null : t.id)}
                                className={`animate-enter cursor-pointer transition-all duration-300 ${isPausada ? 'opacity-60' : ''}`}
                                style={{
                                    animationDelay: `${i * 0.05}s`,
                                    border: isSelected ? `1px solid var(--accent-blue)40` : '1px solid transparent',
                                    background: isSelected ? 'var(--bg-secondary)' : '',
                                    padding: '16px'
                                }}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{ background: isPausada ? 'var(--bg-secondary)' : 'rgba(74,111,165,0.1)', color: '#4A6FA5' }}>
                                            <CreditCard size={20} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-stone-400 tracking-wider leading-none mb-1">{t.banco}</p>
                                            <h3 className="font-black text-stone-800 text-sm leading-none">{t.nombre_tarjeta}</h3>
                                        </div>
                                    </div>
                                    {isPausada && <span className="text-[9px] font-black bg-amber-100 text-amber-600 px-2 py-1 rounded-lg uppercase">Desactivada</span>}
                                </div>

                                <div className="space-y-1.5 mb-4">
                                    <div className="flex justify-between text-[10px] font-bold text-stone-500">
                                        <span>Disponible</span>
                                        <span>{formatCurrency(t.limite_credito)}</span>
                                    </div>
                                    <ProgressBar value={0} max={t.limite_credito} color={isPausada ? '#A8A29E' : '#10b981'} />
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
                                                onClick={(e) => { e.stopPropagation(); handleToggleEstado(t); }}
                                                bg={isPausada ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'}
                                                color={isPausada ? '#10b981' : '#f59e0b'}
                                            >
                                                {isPausada ? <Play size={14} /> : <Pause size={14} />}
                                            </IconBtn>
                                            <IconBtn onClick={(e) => { e.stopPropagation(); openModal(t); }} bg="var(--bg-secondary)" color="var(--text-muted)">
                                                <Pencil size={14} />
                                            </IconBtn>
                                            <IconBtn onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }} bg="rgba(192,96,90,0.1)" color="#C0605A">
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

            {/* MODAL FORMULARIO */}
            <Modal open={modal} onClose={closeModal} title={editingId ? 'Editar Tarjeta' : 'Configurar Nueva Tarjeta'}>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="ff-label">Banco</label>
                            <input
                                className="ff-input"
                                required
                                value={form.banco}
                                onChange={e => setForm({ ...form, banco: e.target.value })}
                                placeholder="Ej: BBVA"
                            />
                        </div>
                        <div>
                            <label className="ff-label">Nombre Tarjeta</label>
                            <input
                                className="ff-input"
                                required
                                value={form.nombre_tarjeta}
                                onChange={e => setForm({ ...form, nombre_tarjeta: e.target.value })}
                                placeholder="Ej: Visa Jodannys"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="ff-label">Límite de Crédito (€)</label>
                        <input
                            className="ff-input"
                            type="number"
                            required
                            value={form.limite_credito}
                            onChange={e => setForm({ ...form, limite_credito: e.target.value })}
                            placeholder="0.00"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="ff-label">Día de Corte</label>
                            <input
                                className="ff-input"
                                type="number"
                                min="1" max="31"
                                required
                                value={form.dia_corte}
                                onChange={e => setForm({ ...form, dia_corte: e.target.value })}
                                placeholder="1-31"
                            />
                        </div>
                        <div>
                            <label className="ff-label">Día de Pago</label>
                            <input
                                className="ff-input"
                                type="number"
                                min="1" max="31"
                                required
                                value={form.dia_pago}
                                onChange={e => setForm({ ...form, dia_pago: e.target.value })}
                                placeholder="1-31"
                            />
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