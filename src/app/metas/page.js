'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Pencil, Pause, Play, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'

function mesesRestantes(actual, meta, pctMensual, montoDisponible = 0) {
  const aporteMensual = (pctMensual / 100) * montoDisponible
  if (aporteMensual <= 0) return '—'
  const restante = meta - actual
  const meses = Math.ceil(restante / aporteMensual)
  if (meses <= 0) return 'Completada'
  if (meses < 12) return `${meses}m`
  const anos = Math.floor(meses / 12)
  const m = meses % 12
  return m > 0 ? `${anos}a ${m}m` : `${anos}a`
}

const ESTADO_CONFIG = {
  activa: { label: 'Activa', bg: 'rgba(16,185,129,0.1)', text: '#10b981' },
  pausada: { label: 'Pausada', bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
  completada: { label: '✓ Lista', bg: 'rgba(56,189,248,0.1)', text: '#38bdf8' },
}

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 36, height: 36, flexShrink: 0 }}>
      {children}
    </button>
  )
}

export default function MetasPage() {
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: '#10b981' })
  const [selectedMetaId, setSelectedMetaId] = useState(null)

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
  }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('metas').select('*').order('created_at')
    if (error) setError(error.message)
    else setMetas(data || [])
    setLoading(false)
  }

  function prepareEdit(meta) {
    setEditingId(meta.id)
    setForm({ nombre: meta.nombre, emoji: meta.emoji, meta: meta.meta, pct_mensual: meta.pct_mensual, color: meta.color })
    setModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre: form.nombre,
      emoji: form.emoji,
      meta: parseFloat(form.meta),
      pct_mensual: parseFloat(form.pct_mensual),
      color: form.color
    }
    if (editingId) {
      const { error } = await supabase.from('metas').update(payload).eq('id', editingId)
      if (error) setError(error.message)
      else {
        setMetas(prev => prev.map(m => m.id === editingId ? { ...m, ...payload } : m))
        closeModal()
      }
    } else {
      const { data, error } = await supabase.from('metas').insert([{ ...payload, actual: 0, estado: 'activa' }]).select()
      if (error) setError(error.message)
      else {
        setMetas(prev => [...prev, data[0]])
        closeModal()
      }
    }
    setSaving(false)
  }

  function closeModal() {
    setModal(false)
    setEditingId(null)
    setForm({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: '#10b981' })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta meta?')) return
    const { error } = await supabase.from('metas').delete().eq('id', id)
    if (!error) setMetas(prev => prev.filter(m => m.id !== id))
  }

  async function handleAgregarDinero(id, montoActual, nombreMeta, pctMeta) {
    if (!presupuesto || !presupuesto.montoMetas) {
      alert("Primero define un presupuesto para el bloque de metas.")
      return
    }

    const montoAuto = (pctMeta / 100) * presupuesto.montoMetas

    // Calcular disponible considerando otras metas activas
    const totalAsignadoActivas = metas.filter(m => m.estado === 'activa')
      .reduce((s, m) => s + (m.pct_mensual || 0), 0)
    const maxDisponible = (100 - totalAsignadoActivas + pctMeta) / 100 * presupuesto.montoMetas

    if (montoAuto > maxDisponible) {
      alert(`No puedes aportar más de lo disponible: ${formatCurrency(maxDisponible)}`)
      return
    }

    if (!confirm(`¿Aportar ${formatCurrency(montoAuto)} automáticamente a "${nombreMeta}"?`)) return

    const nuevoMonto = montoActual + montoAuto

    // Actualizar meta
    const { error: metaError } = await supabase.from('metas').update({ actual: nuevoMonto }).eq('id', id)
    if (metaError) {
      setError("Error al actualizar la meta")
      return
    }

    // Crear movimiento en historial
    const { error: movError } = await supabase.from('movimientos').insert([{
      tipo: 'egreso',
      monto: montoAuto,
      descripcion: nombreMeta,
      categoria: 'ahorro',
      fecha: new Date().toISOString().slice(0, 10),
      quien: 'Ambos'
    }])
    if (movError) console.error("Error al crear el movimiento:", movError)

    // Actualizar UI
    setMetas(prev => prev.map(m => m.id === id ? { ...m, actual: nuevoMonto } : m))
  }

  async function handleEstado(id, estado) {
    const { error } = await supabase.from('metas').update({ estado }).eq('id', id)
    if (!error) setMetas(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
  }

  const activas = metas.filter(m => m.estado === 'activa')
  const totalAhorrado = metas.reduce((s, m) => s + (m.actual || 0), 0)

  const totalPctAsignado = metas.filter(m => m.estado === 'activa')
    .reduce((s, m) => s + (m.pct_mensual || 0), 0)
  const pctDisponible = Math.max(0, 100 - totalPctAsignado)

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6 animate-enter">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Módulo</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight">Metas de Ahorro</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-bold">Nueva meta</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-6">
        {[
          { label: 'Ahorrado', value: formatCurrency(totalAhorrado), color: 'var(--accent-green)' },
          { label: 'Destinado', value: presupuesto ? formatCurrency(presupuesto.montoMetas) : '—', color: 'var(--accent-terra)', badge: presupuesto ? `${presupuesto.pctMetas}%` : null },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter relative" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] text-stone-400 uppercase tracking-wider font-bold mb-1 truncate">{s.label}</p>
            <p className="text-sm font-extrabold leading-tight" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
            {s.badge && (
              <span className="absolute top-2 right-2 text-[8px] font-black px-1 py-0.5 rounded-full"
                style={{ background: 'rgba(193,122,58,0.15)', color: 'var(--accent-terra)' }}>
                {s.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {pctDisponible > 0 && (
        <div className="mb-4 px-3 py-2 rounded-xl border border-dashed border-stone-200 flex items-center justify-between">
          <p className="text-[10px] font-bold text-stone-500 uppercase">Espacio para nuevas metas</p>
          <span className="text-xs font-black text-stone-400">{pctDisponible}% libre</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin text-stone-400" />
          <span className="text-sm text-stone-400">Cargando metas...</span>
        </div>
      ) : metas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">No hay metas aún</p>
          <button onClick={() => setModal(true)} className="ff-btn-primary">Crear primera meta</button>
        </div>
      ) : (
        <div className="space-y-3">
          {metas.map((meta, i) => {
            const isSelected = selectedMetaId === meta.id
            const pct = Math.min(100, Math.round(((meta.actual || 0) / meta.meta) * 100))
            const tiempo = mesesRestantes(meta.actual || 0, meta.meta, meta.pct_mensual || 0, presupuesto?.montoMetas || 0)
            const estado = ESTADO_CONFIG[meta.estado] || ESTADO_CONFIG.activa

            return (
              <Card
                key={meta.id}
                className="animate-enter cursor-pointer transition-all duration-300"
                onClick={() => setSelectedMetaId(isSelected ? null : meta.id)}
                style={{
                  animationDelay: `${i * 0.04}s`,
                  padding: '12px 14px',
                  border: isSelected ? `1px solid ${meta.color}40` : '1px solid transparent',
                  background: isSelected ? `${meta.color}05` : ''
                }}
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${meta.color}18` }}>
                    {getFlagEmoji(meta.emoji)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-stone-800 truncate text-sm leading-tight mb-0.5">
                      {meta.nombre}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                        style={{ background: estado.bg, color: estado.text, minWidth: 48, display: 'inline-block', textAlign: 'center' }}>
                        {estado.label}
                      </span>
                      {tiempo !== '—' && meta.estado !== 'completada' && (
                        <span className="text-[9px] text-stone-400 font-semibold">⏱ {tiempo}</span>
                      )}
                      {meta.pct_mensual > 0 && meta.estado !== 'pausada' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${meta.color}12`, color: meta.color }}>
                          {meta.pct_mensual}%/mes
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xl font-black tabular-nums"
                    style={{ color: meta.color, letterSpacing: '-0.03em', minWidth: 44, textAlign: 'right', flexShrink: 0 }}>
                    {pct}%
                  </span>
                </div>

                <ProgressBar value={meta.actual || 0} max={meta.meta} color={meta.color} className="mb-2.5" />

                <div className="flex items-center justify-between min-h-[36px]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-black tabular-nums" style={{ color: meta.color }}>
                      {formatCurrency(meta.actual || 0)}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      / {formatCurrency(meta.meta)}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 flex-shrink-0 animate-in fade-in zoom-in-95 duration-200">
                      <IconBtn
                        onClick={(e) => { e.stopPropagation(); handleAgregarDinero(meta.id, meta.actual || 0, meta.nombre, meta.pct_mensual); }}
                        title="Agregar dinero"
                        bg="rgba(16,185,129,0.1)"
                        color="#10b981"
                      >
                        <Plus size={14} strokeWidth={3} />
                      </IconBtn>

                      {meta.estado === 'activa' && (
                        <IconBtn onClick={(e) => { e.stopPropagation(); handleEstado(meta.id, 'pausada'); }}
                          title="Pausar" bg="rgba(245,158,11,0.1)" color="#f59e0b">
                          <Pause size={13} strokeWidth={2.5} />
                        </IconBtn>
                      )}
                      {meta.estado === 'pausada' && (
                        <IconBtn onClick={(e) => { e.stopPropagation(); handleEstado(meta.id, 'activa'); }}
                          title="Activar" bg="rgba(16,185,129,0.1)" color="#10b981">
                          <Play size={13} strokeWidth={2.5} />
                        </IconBtn>
                      )}

                      {meta.estado !== 'completada' && (
                        <IconBtn onClick={(e) => { e.stopPropagation(); handleEstado(meta.id, 'completada'); }}
                          title="Completada" bg="rgba(56,189,248,0.1)" color="#38bdf8">
                          <Check size={13} strokeWidth={2.5} />
                        </IconBtn>
                      )}

                      <IconBtn onClick={(e) => { e.stopPropagation(); prepareEdit(meta); }}
                        title="Editar" bg="var(--bg-secondary)" color="var(--text-muted)">
                        <Pencil size={12} />
                      </IconBtn>

                      <IconBtn onClick={(e) => { e.stopPropagation(); handleDelete(meta.id); }}
                        title="Eliminar" bg="rgba(192,96,90,0.08)" color="#C0605A">
                        <Trash2 size={12} />
                      </IconBtn>
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Modal open={modal} onClose={closeModal} title={editingId ? 'Editar Meta' : 'Nueva Meta de Ahorro'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2} value={form.emoji}
                onChange={e => setForm({ ...form, emoji: e.target.value })} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre</label>
              <input className="ff-input" placeholder="Ej: Casa, Vacaciones..." required
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Monto objetivo</label>
              <input className="ff-input" type="number" min="1" step="0.01" placeholder="0.00" required
                value={form.meta} onChange={e => setForm({ ...form, meta: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">% presupuesto metas</label>
              <input
                className="ff-input"
                type="number"
                min="0"
                max="100"
                placeholder="10"
                required
                value={form.pct_mensual}
                onChange={e => setForm({ ...form, pct_mensual: e.target.value })}
              />
              {/* Monto equivalente del input */}
              {presupuesto && (
                <p className="text-[10px] mt-1 pl-1" style={{ color: 'var(--text-muted)' }}>
                  = {formatCurrency((parseFloat(form.pct_mensual || 0) / 100) * presupuesto.montoMetas)}/mes
                </p>
              )}
            </div>

            {/* Aviso fijo de porcentaje libre */}
            {presupuesto && (
              <div className="text-[10px] mt-1 pl-1 text-stone-500">
                🛈 Te queda{' '}
                {Math.max(0, pctDisponible + (editingId ? parseFloat(form.pct_mensual || 0) : 0))}%
                libre = {formatCurrency((Math.max(0, pctDisponible + (editingId ? parseFloat(form.pct_mensual || 0) : 0)) / 100) * presupuesto.montoMetas)}/mes
              </div>
            )}
          </div>
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#10b981', '#f59e0b', '#8b5cf6', '#38bdf8', '#C0605A', '#C17A3A'].map(c => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{ background: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2, opacity: form.color === c ? 1 : 0.6 }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear meta'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}