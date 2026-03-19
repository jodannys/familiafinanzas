'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Pencil, Pause, Play, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'
import { useTheme, getThemeColors } from '@/lib/themes'

function fechaHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mesesRestantes(actual, meta, pctMensual, montoDisponible = 0) {
  // FIX 5: si ya llegó o superó la meta, mostrar completada
  if (actual >= meta) return 'Completada'

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
// Colores de estado usando CSS vars del tema
const ESTADO_CONFIG = {
  activa: { label: 'Activa', bg: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', text: 'var(--accent-green)' },
  pausada: { label: 'Pausada', bg: 'color-mix(in srgb, var(--accent-terra) 10%, transparent)', text: 'var(--accent-terra)' },
  completada: { label: '✓ Lista', bg: 'color-mix(in srgb, var(--accent-blue)  10%, transparent)', text: 'var(--accent-blue)' },
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
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)

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
    setError(null)
    const pctActual = parseFloat(form.pct_mensual) || 0
    const pctUsado = metas
      .filter(m => m.id !== editingId && m.estado === 'activa')
      .reduce((s, m) => s + (m.pct_mensual || 0), 0)

    if (pctActual + pctUsado > 100) {
      setError(`El porcentaje excede el 100%. Solo tienes un ${100 - pctUsado}% disponible.`)
      setSaving(false)
      return
    }
    const payload = {
      nombre: form.nombre,
      emoji: form.emoji,
      meta: parseFloat(form.meta),
      pct_mensual: parseFloat(form.pct_mensual),
      color: form.color,
    }
    if (editingId) {
      const { error } = await supabase.from('metas').update(payload).eq('id', editingId)
      if (error) setError(error.message)
      else { setMetas(prev => prev.map(m => m.id === editingId ? { ...m, ...payload } : m)); closeModal() }
    } else {
      const { data, error } = await supabase.from('metas').insert([{ ...payload, actual: 0, estado: 'activa' }]).select()
      if (error) setError(error.message)
      else { setMetas(prev => [...prev, data[0]]); closeModal() }
    }
    setSaving(false)
  }

  function closeModal() {
    setModal(false)
    setEditingId(null)
    setForm({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: '#10b981' })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta meta y todos sus registros?')) return

    // FIX 3: borrar movimientos asociados a esta meta por meta_id
    await supabase.from('movimientos').delete().eq('meta_id', id)

    const { error } = await supabase.from('metas').delete().eq('id', id)
    if (!error) setMetas(prev => prev.filter(m => m.id !== id))
    else setError(error.message)
  }

  async function handleAgregarDinero(id, montoActual, nombreMeta, pctMeta) {
    if (!presupuesto || !presupuesto.montoMetas) {
      alert('Primero define un presupuesto para el bloque de metas.')
      return
    }

    // BUG FIX: obtener el objeto meta del estado para acceder a meta.meta
    const metaObj = metas.find(m => m.id === id)
    if (!metaObj) return

    const montoAuto = (pctMeta / 100) * presupuesto.montoMetas

    const totalAsignadoOtras = metas
      .filter(m => m.id !== id && m.estado === 'activa')
      .reduce((s, m) => s + (m.pct_mensual || 0), 0)
    const maxDisponible = (100 - totalAsignadoOtras) / 100 * presupuesto.montoMetas

    if (montoAuto > maxDisponible) {
      alert(`No puedes aportar más de lo disponible: ${formatCurrency(maxDisponible)}`)
      return
    }

    if (!confirm(`¿Aportar ${formatCurrency(montoAuto)} automáticamente a "${nombreMeta}"?`)) return

    // BUG FIX: deshabilitar botón durante la operación
    setSaving(true)

    const nuevoMonto = montoActual + montoAuto
    const completada = nuevoMonto >= metaObj.meta

    // BUG FIX: actualizar meta y movimiento antes de tocar estado
    const { error: metaError } = await supabase.from('metas').update({
      actual: nuevoMonto,
      ...(completada && { estado: 'completada' }),
    }).eq('id', id)

    if (metaError) {
      setError('Error al actualizar la meta')
      setSaving(false)
      return
    }

    // FIX 1: guardar meta_id para poder revertir correctamente desde Gastos
    await supabase.from('movimientos').insert([{
      tipo: 'egreso',
      monto: montoAuto,
      descripcion: nombreMeta,
      categoria: 'ahorro',
      fecha: fechaHoy(),
      quien: 'Ambos',
      meta_id: id,
    }])

    // BUG FIX: una sola actualización de estado (eliminada la duplicada)
    setMetas(prev => prev.map(m => m.id === id
      ? { ...m, actual: nuevoMonto, ...(completada && { estado: 'completada' }) }
      : m
    ))

    setSaving(false)

    if (completada) {
      setTimeout(() => alert(`🎉 ¡Meta "${nombreMeta}" completada!`), 300)
    }
  }

  async function handleEstado(id, estado) {
    // FIX 4: si intenta marcar completada, verificar que llegó al 100%
    if (estado === 'completada') {
      const meta = metas.find(m => m.id === id)
      if (meta && (meta.actual || 0) < meta.meta) {
        const pct = Math.round(((meta.actual || 0) / meta.meta) * 100)
        if (!confirm(`Esta meta solo tiene ${pct}% completado. ¿Marcarla como completada de todas formas?`)) return
      }
    }

    const { error } = await supabase.from('metas').update({ estado }).eq('id', id)
    if (!error) setMetas(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
  }

  const totalAhorrado = metas.reduce((s, m) => s + (m.actual || 0), 0)
  const totalPctAsignado = metas.filter(m => m.estado === 'activa').reduce((s, m) => s + (m.pct_mensual || 0), 0)
  const pctDisponible = Math.max(0, 100 - totalPctAsignado)

  return (
    <AppShell>

      {/* Header */}
      <div className="flex items-center justify-between mb-6 animate-enter">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
            style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl font-black tracking-tight"
            style={{ color: 'var(--text-primary)' }}>Metas de Ahorro</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-bold">Nueva meta</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold"
          style={{
            background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)',
            color: 'var(--accent-rose)',
          }}>
          {error}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {[
          { label: 'Ahorrado', value: formatCurrency(totalAhorrado), color: 'var(--accent-green)', badge: null },
          { label: 'Destinado', value: presupuesto ? formatCurrency(presupuesto.montoMetas) : '—', color: 'var(--accent-terra)', badge: presupuesto ? `${presupuesto.pctMetas}%` : null },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter relative" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] uppercase tracking-wider font-bold mb-1 truncate"
              style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-sm font-extrabold leading-tight" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
            {s.badge && (
              <span className="absolute top-2 right-2 text-[8px] font-black px-1 py-0.5 rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--accent-terra) 15%, transparent)',
                  color: 'var(--accent-terra)',
                }}>
                {s.badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Espacio libre */}
      {pctDisponible > 0 && (
        <div className="mb-4 px-3 py-2 rounded-xl border border-dashed flex items-center justify-between"
          style={{ borderColor: 'var(--border-glass)' }}>
          <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>
            Espacio para nuevas metas
          </p>
          <span className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>{pctDisponible}% libre</span>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando metas...</span>
        </div>
      ) : metas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No hay metas aún</p>
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
              <Card key={meta.id}
                className="animate-enter cursor-pointer transition-all duration-300"
                onClick={() => setSelectedMetaId(isSelected ? null : meta.id)}
                style={{
                  animationDelay: `${i * 0.04}s`,
                  padding: '12px 14px',
                  border: isSelected ? `1px solid ${meta.color}40` : '1px solid transparent',
                  background: isSelected ? `${meta.color}05` : '',
                }}>

                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${meta.color}18` }}>
                    {getFlagEmoji(meta.emoji)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate text-sm leading-tight mb-0.5"
                      style={{ color: 'var(--text-primary)' }}>
                      {meta.nombre}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                        style={{ background: estado.bg, color: estado.text, minWidth: 48, display: 'inline-block', textAlign: 'center' }}>
                        {estado.label}
                      </span>
                      {tiempo !== '—' && meta.estado !== 'completada' && (
                        <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>⏱ {tiempo}</span>
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
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      / {formatCurrency(meta.meta)}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 flex-shrink-0 animate-in fade-in zoom-in-95 duration-200">

                      <IconBtn
                        onClick={e => { e.stopPropagation(); handleAgregarDinero(meta.id, meta.actual || 0, meta.nombre, meta.pct_mensual) }}
                        title="Agregar dinero"
                        bg="color-mix(in srgb, var(--accent-green) 10%, transparent)"
                        color="var(--accent-green)">
                        <Plus size={14} strokeWidth={3} />
                      </IconBtn>

                      {meta.estado === 'activa' && (
                        <IconBtn onClick={e => { e.stopPropagation(); handleEstado(meta.id, 'pausada') }}
                          title="Pausar"
                          bg="color-mix(in srgb, var(--accent-terra) 10%, transparent)"
                          color="var(--accent-terra)">
                          <Pause size={13} strokeWidth={2.5} />
                        </IconBtn>
                      )}
                      {meta.estado === 'pausada' && (
                        <IconBtn onClick={e => { e.stopPropagation(); handleEstado(meta.id, 'activa') }}
                          title="Activar"
                          bg="color-mix(in srgb, var(--accent-green) 10%, transparent)"
                          color="var(--accent-green)">
                          <Play size={13} strokeWidth={2.5} />
                        </IconBtn>
                      )}
                      {meta.estado !== 'completada' && (
                        <IconBtn onClick={e => { e.stopPropagation(); handleEstado(meta.id, 'completada') }}
                          title="Completada"
                          bg="color-mix(in srgb, var(--accent-blue) 10%, transparent)"
                          color="var(--accent-blue)">
                          <Check size={13} strokeWidth={2.5} />
                        </IconBtn>
                      )}
                      <IconBtn onClick={e => { e.stopPropagation(); prepareEdit(meta) }}
                        title="Editar"
                        bg="var(--bg-secondary)"
                        color="var(--text-muted)">
                        <Pencil size={12} />
                      </IconBtn>
                      <IconBtn onClick={e => { e.stopPropagation(); handleDelete(meta.id) }}
                        title="Eliminar"
                        bg="color-mix(in srgb, var(--accent-rose) 8%, transparent)"
                        color="var(--accent-rose)">
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

      {/* MODAL */}
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
              <input className="ff-input" type="number" min="0" max="100" placeholder="10" required
                value={form.pct_mensual} onChange={e => setForm({ ...form, pct_mensual: e.target.value })} />
            </div>
          </div>

          {/* Indicador visual de % disponible */}
          {presupuesto && (() => {
            const pctUsado = metas
              .filter(m => m.id !== editingId && m.estado === 'activa')
              .reduce((s, m) => s + (m.pct_mensual || 0), 0)
            const pctLibre = Math.max(0, 100 - pctUsado)
            const pctActual = parseFloat(form.pct_mensual) || 0
            const pctRestante = Math.max(0, pctLibre - pctActual)
            const pctTotalSimulado = pctUsado + pctActual
            const montoActual = (pctActual / 100) * presupuesto.montoMetas
            const montoRestante = (pctRestante / 100) * presupuesto.montoMetas
            const excede = pctActual > pctLibre
            const lleno = pctRestante === 0 && !excede
            const barUsado = Math.min(100, pctUsado)
            const barActual = Math.min(100 - barUsado, pctActual)

            // Colores semáforo usando CSS vars
            const color = excede ? 'var(--accent-rose)' : lleno ? 'var(--accent-terra)' : 'var(--accent-green)'

            return (
              <div className="rounded-xl overflow-hidden"
                style={{
                  border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                  background: `color-mix(in srgb, ${color} 6%, transparent)`,
                }}>
                <div className="h-1.5 flex" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full transition-all duration-300"
                    style={{ width: `${barUsado}%`, background: 'color-mix(in srgb, var(--text-muted) 35%, transparent)' }} />
                  <div className="h-full transition-all duration-300"
                    style={{ width: `${barActual}%`, background: color }} />
                </div>
                <div className="px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase" style={{ color }}>
                      {excede
                        ? `⚠ Solo hay ${pctLibre}% disponible — reduce el porcentaje`
                        : lleno
                          ? '✓ Has asignado todo el presupuesto de metas'
                          : `Quedan ${pctRestante}% sin asignar`}
                    </span>
                    <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>
                      {pctTotalSimulado}% asignado del total
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-sm font-black" style={{ color }}>{formatCurrency(montoActual)}</span>
                      <span className="text-[9px] ml-1" style={{ color: 'var(--text-muted)' }}>/mes esta meta</span>
                    </div>
                    {!excede && pctRestante > 0 && (
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(montoRestante)} disponibles
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Color picker — estos son colores del usuario para la meta, son datos no tema */}
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {themeColors.map(c => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    opacity: form.color === c ? 1 : 0.6,
                  }} />
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