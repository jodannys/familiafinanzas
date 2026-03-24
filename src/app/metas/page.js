'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Pencil, Pause, Play, Check, Target, TrendingUp, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'
import { useTheme, getThemeColors } from '@/lib/themes'

function fechaHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function mesesRestantes(actual, meta, pctMensual, montoDisponible = 0) {
  if (actual >= meta) return 'Completada'
  const aporteMensual = (pctMensual / 100) * montoDisponible
  if (aporteMensual <= 0) return null
  const restante = meta - actual
  const meses = Math.ceil(restante / aporteMensual)
  if (meses <= 0) return 'Completada'
  if (meses < 12) return `${meses} mes${meses > 1 ? 'es' : ''}`
  const anos = Math.floor(meses / 12)
  const m = meses % 12
  return m > 0 ? `${anos}a ${m}m` : `${anos} año${anos > 1 ? 's' : ''}`
}

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 34, height: 34, flexShrink: 0, border: 'none', cursor: 'pointer' }}>
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
  const [form, setForm] = useState({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: themeColors[0] || '#2D7A5F' })
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
      setError(`Solo hay ${100 - pctUsado}% disponible.`)
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
    setForm({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: themeColors[0] || '#2D7A5F' })
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta meta?')) return
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
    const metaObj = metas.find(m => m.id === id)
    if (!metaObj) return

    const montoAuto = (pctMeta / 100) * presupuesto.montoMetas
    const totalAsignadoOtras = metas
      .filter(m => m.id !== id && m.estado === 'activa')
      .reduce((s, m) => s + (m.pct_mensual || 0), 0)
    const maxDisponible = (100 - totalAsignadoOtras) / 100 * presupuesto.montoMetas

    if (montoAuto > maxDisponible) {
      alert(`No puedes aportar más de ${formatCurrency(maxDisponible)}`)
      return
    }
    if (!confirm(`¿Aportar ${formatCurrency(montoAuto)} a "${nombreMeta}"?`)) return

    setSaving(true)
    const nuevoMonto = montoActual + montoAuto
    const completada = nuevoMonto >= metaObj.meta

    const { error: metaError } = await supabase.from('metas').update({
      actual: nuevoMonto,
      ...(completada && { estado: 'completada' }),
    }).eq('id', id)

    if (metaError) { setError('Error al actualizar la meta'); setSaving(false); return }

    await supabase.from('movimientos').insert([{
      tipo: 'egreso', monto: montoAuto, descripcion: nombreMeta,
      categoria: 'ahorro', fecha: fechaHoy(), quien: 'Ambos', meta_id: id,
    }])

    setMetas(prev => prev.map(m => m.id === id
      ? { ...m, actual: nuevoMonto, ...(completada && { estado: 'completada' }) } : m
    ))
    setSaving(false)
    if (completada) setTimeout(() => alert(`🎉 ¡Meta "${nombreMeta}" completada!`), 300)
  }

  async function handleEstado(id, estado) {
    if (estado === 'completada') {
      const meta = metas.find(m => m.id === id)
      if (meta && (meta.actual || 0) < meta.meta) {
        const pct = Math.round(((meta.actual || 0) / meta.meta) * 100)
        if (!confirm(`Solo tiene ${pct}% completado. ¿Marcarla como completada?`)) return
      }
    }
    const { error } = await supabase.from('metas').update({ estado }).eq('id', id)
    if (!error) setMetas(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
  }

  const activas    = metas.filter(m => m.estado === 'activa')
  const pausadas   = metas.filter(m => m.estado === 'pausada')
  const completadas = metas.filter(m => m.estado === 'completada')
  const totalAhorrado  = metas.reduce((s, m) => s + (m.actual || 0), 0)
  const totalObjetivo  = metas.reduce((s, m) => s + (m.meta || 0), 0)
  const totalPctAsignado = activas.reduce((s, m) => s + (m.pct_mensual || 0), 0)
  const pctDisponible  = Math.max(0, 100 - totalPctAsignado)

  const metasActivas = [...activas, ...pausadas]

  return (
    <AppShell>

      {/* Header */}
      <div className="flex items-center justify-between mb-5 animate-enter">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Metas de Ahorro</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} strokeWidth={2.5} />
          <span className="hidden sm:inline text-sm">Nueva meta</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs"
          style={{
            background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)',
            color: 'var(--accent-rose)',
          }}>
          {error}
        </div>
      )}

     {/* KPIs — Altura fija para evitar descuadre */}
<div className="grid grid-cols-2 gap-2 mb-5 animate-enter">
  
  {/* Caja 1 */}
  {/* Caja 1 */}
<div className="glass-card p-2 flex flex-col justify-center rounded-lg" style={{ height: 60 }}> 
  {/* Añadí rounded-lg para que sea menos ovalada */}
  <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Ahorrado</p>
  <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--accent-green)' }}>
    {formatCurrency(totalAhorrado)}
  </p>
  {totalObjetivo > 0 ? (
    <p className="text-[8px] mt-0.5 opacity-70" style={{ color: 'var(--text-muted)' }}>
      de {formatCurrency(totalObjetivo)}
    </p>
  ) : (
    <div className="h-[10px]" /> 
  )}
</div>

{/* Caja 2 */}
<div className="glass-card p-2 flex flex-col justify-center rounded-lg" style={{ height: 60 }}>
  {/* Añadí rounded-lg aquí también */}
  <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Mensual</p>
  <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--accent-violet)' }}>
    {presupuesto ? formatCurrency(presupuesto.montoMetas) : '—'}
  </p>
  {pctDisponible > 0 && activas.length > 0 ? (
    <p className="text-[8px] mt-0.5 opacity-70" style={{ color: 'var(--text-muted)' }}>
      {pctDisponible}% libre
    </p>
  ) : (
    <div className="h-[10px]" /> 
  )}
</div>
</div>
      {/* Mensaje distribución */}
      {!loading && activas.length > 0 && (() => {
        const totalPct = activas.reduce((s, m) => s + (m.pct_mensual || 0), 0)
        const disponible = 100 - totalPct
        const completo = disponible <= 0
        return (
          <div className="mb-5 px-3 py-2.5 rounded-xl flex items-center gap-2"
            style={{
              background: completo
                ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)'
                : 'color-mix(in srgb, var(--accent-gold) 8%, transparent)',
              border: `1px solid ${completo
                ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                : 'color-mix(in srgb, var(--accent-gold) 20%, transparent)'}`,
            }}>
            <span style={{ fontSize: 14 }}>{completo ? '✅' : '💡'}</span>
            <p className="text-[10px] font-semibold flex-1" style={{ color: completo ? 'var(--accent-green)' : 'var(--accent-gold)' }}>
              {completo
                ? `Distribución completa · ${totalPct}% asignado`
                : `${disponible}% disponible · Envía el sobrante a Metas o Inversión`}
            </p>
          </div>
        )
      })()}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : metas.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' }}>
            <Target size={28} style={{ color: 'var(--accent-green)' }} />
          </div>
          <p className="font-serif text-lg mb-1" style={{ color: 'var(--text-primary)' }}>Sin metas aún</p>
          <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Define hacia dónde va tu ahorro
          </p>
          <button onClick={() => setModal(true)} className="ff-btn-primary">Crear primera meta</button>
        </div>
      ) : (
        <div className="space-y-2">
          {metasActivas.map((meta, i) => {
            const isSelected = selectedMetaId === meta.id
            const pct = Math.min(100, Math.round(((meta.actual || 0) / meta.meta) * 100))
            const tiempo = mesesRestantes(meta.actual || 0, meta.meta, meta.pct_mensual || 0, presupuesto?.montoMetas || 0)
            const isPausada = meta.estado === 'pausada'
            const aporteMensual = presupuesto?.montoMetas
              ? (meta.pct_mensual / 100) * presupuesto.montoMetas
              : 0

            return (
              <Card key={meta.id}
                className="animate-enter cursor-pointer select-none"
                onClick={() => setSelectedMetaId(isSelected ? null : meta.id)}
                style={{
                  animationDelay: `${i * 0.04}s`,
                  padding: '14px 16px',
                  opacity: isPausada ? 0.75 : 1,
                  border: isSelected ? `1.5px solid ${meta.color}50` : '1.5px solid transparent',
                }}>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${meta.color}15` }}>
                    {getFlagEmoji(meta.emoji)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {meta.nombre}
                      </p>
                      {isPausada && (
                        <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'color-mix(in srgb, var(--accent-terra) 12%, transparent)', color: 'var(--accent-terra)' }}>
                          PAUSADA
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {tiempo && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          ⏱ {tiempo}
                        </span>
                      )}
                      {aporteMensual > 0 && meta.estado === 'activa' && (
                        <span className="text-[10px] font-semibold"
                          style={{ color: meta.color }}>
                          {formatCurrency(aporteMensual)}/mes
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-semibold leading-none" style={{ color: meta.color }}>
                      {pct}%
                    </p>
                  </div>
                </div>

                <div className="mb-2">
                  <ProgressBar value={meta.actual || 0} max={meta.meta} color={meta.color} />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-semibold tabular-nums" style={{ color: meta.color }}>
                      {formatCurrency(meta.actual || 0)}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      / {formatCurrency(meta.meta)}
                    </span>
                  </div>
                  <ChevronRight size={14} style={{
                    color: 'var(--text-muted)',
                    transform: isSelected ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s',
                  }} />
                </div>

                {/* Acciones expandibles */}
                {isSelected && (
                  <div className="mt-3 pt-3 flex items-center gap-2 flex-wrap"
                    style={{ borderTop: '1px solid var(--border-glass)' }}>
                    {meta.estado === 'activa' && presupuesto?.montoMetas > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); handleAgregarDinero(meta.id, meta.actual || 0, meta.nombre, meta.pct_mensual) }}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
                        style={{
                          background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                          color: 'var(--accent-green)', border: 'none', cursor: 'pointer',
                        }}>
                        <Plus size={11} strokeWidth={2.5} />
                        Aportar {aporteMensual > 0 ? formatCurrency(aporteMensual) : ''}
                      </button>
                    )}
                    {meta.estado === 'activa' && (
                      <IconBtn onClick={e => { e.stopPropagation(); handleEstado(meta.id, 'pausada') }}
                        title="Pausar"
                        bg="color-mix(in srgb, var(--accent-terra) 10%, transparent)"
                        color="var(--accent-terra)">
                        <Pause size={13} strokeWidth={2} />
                      </IconBtn>
                    )}
                    {meta.estado === 'pausada' && (
                      <IconBtn onClick={e => { e.stopPropagation(); handleEstado(meta.id, 'activa') }}
                        title="Activar"
                        bg="color-mix(in srgb, var(--accent-green) 10%, transparent)"
                        color="var(--accent-green)">
                        <Play size={13} strokeWidth={2} />
                      </IconBtn>
                    )}
                    {meta.estado !== 'completada' && (
                      <IconBtn onClick={e => { e.stopPropagation(); handleEstado(meta.id, 'completada') }}
                        title="Marcar completada"
                        bg="color-mix(in srgb, var(--accent-blue) 10%, transparent)"
                        color="var(--accent-blue)">
                        <Check size={13} strokeWidth={2} />
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
                    {/* EL PORCENTAJE EN LA ESQUINA */}
                      <span className="text-[10px] font-bold px-2 py-1.5 rounded-lg ml-1"
                        style={{ 
                          background: `color-mix(in srgb, ${meta.color} 15%, transparent)`, 
                          color: meta.color 
                        }}>
                        {meta.pct_mensual}%
                      </span>
                  </div>
                )}
              </Card>
            )
          })}

          {/* Completadas */}
          {completadas.length > 0 && (
            <div className="mt-4">
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-2 px-1"
                style={{ color: 'var(--text-muted)' }}>
                Completadas · {completadas.length}
              </p>
              <div className="space-y-1.5">
                {completadas.map((meta, i) => (
                  <div key={meta.id}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{
                      background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
                      border: '1px solid color-mix(in srgb, var(--accent-green) 15%, transparent)',
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: `${meta.color}15` }}>
                      {getFlagEmoji(meta.emoji)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{meta.nombre}</p>
                      <p className="text-[10px]" style={{ color: 'var(--accent-green)' }}>
                        {formatCurrency(meta.actual || 0)} ahorrado
                      </p>
                    </div>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--accent-green)' }}>
                      <Check size={12} color="white" strokeWidth={3} />
                    </div>
                    <button onClick={() => handleDelete(meta.id)}
                      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              <label className="ff-label">% del presupuesto</label>
              <input className="ff-input" type="number" min="0" max="100" placeholder="10" required
                value={form.pct_mensual} onChange={e => setForm({ ...form, pct_mensual: e.target.value })} />
            </div>
          </div>

          {/* Indicador de disponibilidad */}
          {presupuesto && (() => {
            const pctUsado = metas
              .filter(m => m.id !== editingId && m.estado === 'activa')
              .reduce((s, m) => s + (m.pct_mensual || 0), 0)
            const pctLibre = Math.max(0, 100 - pctUsado)
            const pctActual = parseFloat(form.pct_mensual) || 0
            const excede = pctActual > pctLibre
            const montoActual = (pctActual / 100) * presupuesto.montoMetas
            const color = excede ? 'var(--accent-rose)' : 'var(--accent-green)'

            return (
              <div className="rounded-xl px-3 py-2.5"
                style={{
                  background: `color-mix(in srgb, ${color} 6%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase" style={{ color }}>
                    {excede ? `⚠ Máximo disponible: ${pctLibre}%` : `${pctLibre - pctActual}% libre tras esta meta`}
                  </span>
                  {!excede && montoActual > 0 && (
                    <span className="text-xs font-semibold" style={{ color }}>
                      {formatCurrency(montoActual)}/mes
                    </span>
                  )}
                </div>
              </div>
            )
          })()}

          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-2.5 flex-wrap mt-1">
              {themeColors.map(c => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    opacity: form.color === c ? 1 : 0.55,
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : editingId ? 'Guardar' : 'Crear meta'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
