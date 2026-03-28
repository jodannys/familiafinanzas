'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import ConfirmDialog, { useConfirm } from '@/components/ui/ConfirmDialog'
import { Plus, Minus, Loader2, Trash2, Pencil, Pause, Play, Check, Target, TrendingUp, ChevronRight, History } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
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
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)
  const { confirmProps, showConfirm } = useConfirm()
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [traspasosDeMetas, setTraspasosDeMetas] = useState(0)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: themeColors[0] || '#2D7A5F' })
  const [selectedMetaId, setSelectedMetaId] = useState(null)
  const [modalAporte, setModalAporte] = useState(null) // meta object
  const [montoAporte, setMontoAporte] = useState('')
  const [modalRetiro, setModalRetiro] = useState(null) // meta object
  const [montoRetiro, setMontoRetiro] = useState('')
  const [modalHistorialMeta, setModalHistorialMeta] = useState(null) // meta object
  const [historialAportes, setHistorialAportes] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
    cargarTraspasos()
  }, [])

  async function cargarTraspasos() {
    const now = new Date()
    const mes = now.getMonth() + 1
    const año = now.getFullYear()
    const { data } = await supabase.from('sobre_movimientos').select('monto')
      .eq('origen', 'metas').eq('mes', mes).eq('año', año)
    setTraspasosDeMetas((data || []).reduce((s, m) => s + parseFloat(m.monto || 0), 0))
  }

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
      .filter(m => m.id !== editingId && ['activa', 'pausada'].includes(m.estado))
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
    setError(null)
    setForm({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: themeColors[0] || '#2D7A5F' })
  }

  function handleDelete(id) {
    showConfirm('¿Eliminar esta meta y todos sus aportes?', async () => {
      await supabase.from('movimientos').delete().eq('meta_id', id)
      const { error } = await supabase.from('metas').delete().eq('id', id)
      if (!error) setMetas(prev => prev.filter(m => m.id !== id))
      else setError(error.message)
    })
  }

  function abrirModalAporte(meta) {
    const autoMonto = montoMetasDisponible > 0 && meta.pct_mensual
      ? ((meta.pct_mensual / 100) * montoMetasDisponible).toFixed(2)
      : ''
    setError(null)
    setModalAporte(meta)
    setMontoAporte(autoMonto)
  }

  async function handleAgregarDinero(e) {
    e.preventDefault()
    if (saving) return
    const monto = parseFloat(montoAporte)
    if (!monto || monto <= 0 || !modalAporte) return
    setSaving(true)

    const nuevoActual = (modalAporte.actual || 0) + monto
    const completada = nuevoActual >= modalAporte.meta

    const { error: metaError } = await supabase.from('metas').update({
      actual: nuevoActual,
      ...(completada && { estado: 'completada' }),
    }).eq('id', modalAporte.id)

    if (metaError) { setError('Error al actualizar la meta'); setSaving(false); return }

    const { error: movError } = await supabase.from('movimientos').insert([{
      tipo: 'egreso', monto, descripcion: `Aporte: ${modalAporte.nombre}`,
      categoria: 'ahorro', fecha: fechaHoy(), quien: 'Ambos', meta_id: modalAporte.id,
    }])
    if (movError) {
      // Revertir la meta si el movimiento falló
      await supabase.from('metas').update({ actual: modalAporte.actual || 0, estado: modalAporte.estado }).eq('id', modalAporte.id)
      setError('Error al registrar el aporte')
      setSaving(false)
      return
    }

    setMetas(prev => prev.map(m => m.id === modalAporte.id
      ? { ...m, actual: nuevoActual, ...(completada && { estado: 'completada' }) } : m
    ))
    setSaving(false)
    setModalAporte(null)
    setMontoAporte('')
    toast(completada ? `🎉 ¡Meta "${modalAporte.nombre}" completada!` : `Aporte de ${formatCurrency(monto)} registrado`, 'success')
  }

  async function handleRetirarMeta(e) {
    e.preventDefault()
    if (saving) return
    const monto = parseFloat(montoRetiro)
    if (!monto || monto <= 0 || !modalRetiro) return
    if (monto > (modalRetiro.actual || 0)) { setError('No puedes retirar más de lo ahorrado'); return }
    setSaving(true)

    const nuevoActual = (modalRetiro.actual || 0) - monto
    const necesitaReactivar = modalRetiro.estado === 'completada' && nuevoActual < modalRetiro.meta

    const { error } = await supabase.from('metas').update({
      actual: nuevoActual,
      ...(necesitaReactivar && { estado: 'activa' }),
    }).eq('id', modalRetiro.id)

    if (error) { setError('Error al registrar el retiro'); setSaving(false); return }

    const { error: movRetiroError } = await supabase.from('movimientos').insert([{
      tipo: 'retiro', categoria: 'ahorro',
      descripcion: `Retiro: ${modalRetiro.nombre}`,
      monto, fecha: fechaHoy(), quien: 'Ambos', meta_id: modalRetiro.id,
    }])
    if (movRetiroError) {
      // Revertir la meta si el movimiento falló
      await supabase.from('metas').update({ actual: modalRetiro.actual || 0, estado: modalRetiro.estado }).eq('id', modalRetiro.id)
      setError('Error al registrar el retiro')
      setSaving(false)
      return
    }

    setMetas(prev => prev.map(m => m.id === modalRetiro.id
      ? { ...m, actual: nuevoActual, ...(necesitaReactivar && { estado: 'activa' }) } : m
    ))
    setSaving(false)
    setModalRetiro(null)
    setMontoRetiro('')
    toast(`Retiro de ${formatCurrency(monto)} registrado`, 'success')
  }

  async function cargarHistorialMeta(meta) {
    setLoadingHistorial(true)
    setModalHistorialMeta(meta)
    const { data } = await supabase
      .from('movimientos')
      .select('id, monto, descripcion, fecha, tipo')
      .eq('meta_id', meta.id)
      .order('fecha', { ascending: false })
    setHistorialAportes(data || [])
    setLoadingHistorial(false)
  }

  function handleDeleteAporteMeta(movId, monto) {
    showConfirm('¿Eliminar este aporte? Se restará del total ahorrado.', async () => {
      const meta = modalHistorialMeta
      if (!meta) return
      const nuevoActual = Math.max(0, (meta.actual || 0) - monto)

      const { error: errMeta } = await supabase.from('metas').update({ actual: nuevoActual }).eq('id', meta.id)
      if (errMeta) { toast('Error al actualizar la meta', 'error'); return }

      const { error: errMov } = await supabase.from('movimientos').delete().eq('id', movId)
      if (errMov) {
        await supabase.from('metas').update({ actual: meta.actual || 0 }).eq('id', meta.id)
        toast('Error al eliminar el aporte', 'error')
        return
      }

      const updatedMeta = { ...meta, actual: nuevoActual }
      setMetas(prev => prev.map(m => m.id === meta.id ? updatedMeta : m))
      setModalHistorialMeta(updatedMeta)
      setHistorialAportes(prev => prev.filter(a => a.id !== movId))
      toast(`Aporte de ${formatCurrency(monto)} eliminado`, 'success')
  }

  function handleEstado(id, estado) {
    const doUpdate = async () => {
      const { error } = await supabase.from('metas').update({ estado }).eq('id', id)
      if (!error) setMetas(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
    }
    if (estado === 'completada') {
      const meta = metas.find(m => m.id === id)
      if (meta && (meta.actual || 0) < meta.meta) {
        const pct = meta.meta > 0 ? Math.round(((meta.actual || 0) / meta.meta) * 100) : 0
        showConfirm(`Solo tiene ${pct}% completado. ¿Marcarla como completada de todas formas?`, doUpdate)
        return
      }
    }
    doUpdate()
  }

  const activas    = metas.filter(m => m.estado === 'activa')
  const pausadas   = metas.filter(m => m.estado === 'pausada')
  const completadas = metas.filter(m => m.estado === 'completada')
  const totalAhorrado  = metas.reduce((s, m) => s + (m.actual || 0), 0)
  const totalObjetivo  = metas.reduce((s, m) => s + (m.meta || 0), 0)
  const totalPctAsignado = [...activas, ...pausadas].reduce((s, m) => s + (m.pct_mensual || 0), 0)
  const pctDisponible  = Math.max(0, 100 - totalPctAsignado)
  const montoMetasDisponible = Math.max(0, (presupuesto?.montoMetas || 0) - traspasosDeMetas)

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
  <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Mensual</p>
  <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--accent-violet)' }}>
    {presupuesto ? formatCurrency(montoMetasDisponible) : '—'}
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
  /* Agregamos flex flex-col e items-center para asegurar el eje central */
  <div className="flex flex-col items-center justify-center text-center py-20 px-6">
    
    {/* Icono centrado por el padre flex-col */}
    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' }}>
      <Target size={28} style={{ color: 'var(--accent-green)' }} />
    </div>

    <p className="font-serif text-lg mb-1" style={{ color: 'var(--text-primary)' }}>
      Sin metas aún
    </p>
    
    <p className="text-sm mb-6 max-w-[240px] opacity-60" style={{ color: 'var(--text-muted)' }}>
      Define hacia dónde va tu ahorro
    </p>

    {/* El botón ahora se mantendrá en el centro gracias a items-center del padre */}
    <button 
      onClick={() => setModal(true)} 
      className="ff-btn-primary !w-auto min-w-[200px] shadow-lg"
    >
      Crear primera meta
    </button>
    
  </div>
) : (
        <div className="space-y-2">
          {metasActivas.map((meta, i) => {
            const isSelected = selectedMetaId === meta.id
            const pct = meta.meta > 0 ? Math.min(100, Math.round(((meta.actual || 0) / meta.meta) * 100)) : 0
            const tiempo = mesesRestantes(meta.actual || 0, meta.meta, meta.pct_mensual || 0, montoMetasDisponible)
            const isPausada = meta.estado === 'pausada'
            const aporteMensual = (meta.pct_mensual / 100) * montoMetasDisponible

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
                    {meta.estado === 'activa' && (
                      <button
                        onClick={e => { e.stopPropagation(); abrirModalAporte(meta) }}
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
                    {meta.estado === 'activa' && (meta.actual || 0) > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); setModalRetiro(meta); setMontoRetiro('') }}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold transition-all"
                        style={{
                          background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
                          color: 'var(--accent-rose)', border: 'none', cursor: 'pointer',
                        }}>
                        <Minus size={11} strokeWidth={2.5} />
                        Retirar
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
                    <IconBtn onClick={e => { e.stopPropagation(); cargarHistorialMeta(meta) }}
                      title="Historial de aportes"
                      bg="color-mix(in srgb, var(--accent-terra) 10%, transparent)"
                      color="var(--accent-terra)">
                      <History size={12} />
                    </IconBtn>
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

      {/* MODAL HISTORIAL */}
      <Modal open={!!modalHistorialMeta} onClose={() => { setModalHistorialMeta(null); setHistorialAportes([]) }}
        title={`Historial · ${modalHistorialMeta?.nombre || ''}`}>
        {loadingHistorial ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : historialAportes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No hay aportes registrados aún</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] mb-3" style={{ color: 'var(--text-muted)' }}>
              Al eliminar un aporte se restará del total ahorrado en esta meta.
            </p>
            {historialAportes.map(a => (
              <div key={a.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {a.descripcion || 'Aporte'}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <p className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
                    +{formatCurrency(a.monto)}
                  </p>
                  <button
                    onClick={() => handleDeleteAporteMeta(a.id, parseFloat(a.monto))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style={{ background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)', color: 'var(--accent-rose)' }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border-glass)' }}>
              <p className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Total registrado</p>
              <p className="text-[11px] font-semibold" style={{ color: 'var(--accent-green)' }}>
                +{formatCurrency(historialAportes.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0))}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL RETIRO */}
      <Modal open={!!modalRetiro} onClose={() => { setModalRetiro(null); setMontoRetiro(''); setError(null) }}
        title={`Retirar de ${modalRetiro?.nombre || ''}`} size="sm">
        {modalRetiro && (
          <form onSubmit={handleRetirarMeta} className="space-y-4">
            <div className="rounded-xl px-4 py-3"
              style={{ background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-rose)' }}>
                  {getFlagEmoji(modalRetiro.emoji)} {modalRetiro.nombre}
                </span>
                <span className="text-xs font-semibold" style={{ color: 'var(--accent-rose)' }}>
                  Disponible: {formatCurrency(modalRetiro.actual || 0)}
                </span>
              </div>
              <ProgressBar value={modalRetiro.actual || 0} max={modalRetiro.meta} color="var(--accent-rose)" />
            </div>

            <div>
              <label className="ff-label">Monto a retirar</label>
              <input className="ff-input" type="number" min="0.01" step="0.01"
                max={modalRetiro.actual || 0} placeholder="0.00"
                required autoFocus
                value={montoRetiro}
                onChange={e => setMontoRetiro(e.target.value)} />
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                Máximo disponible: {formatCurrency(modalRetiro.actual || 0)}
              </p>
            </div>

            {parseFloat(montoRetiro) > 0 && (
              <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--accent-rose) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-rose) 18%, transparent)' }}>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Quedará en meta</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent-rose)' }}>
                  {formatCurrency(Math.max(0, (modalRetiro.actual || 0) - parseFloat(montoRetiro)))}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setModalRetiro(null); setMontoRetiro(''); setError(null) }}
                className="ff-btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={saving}
                className="ff-btn-primary flex-1 flex items-center justify-center gap-2"
                style={{ background: 'var(--accent-rose)' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : 'Confirmar retiro'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL APORTE */}
      <Modal open={!!modalAporte} onClose={() => { setModalAporte(null); setMontoAporte(''); setError(null) }}
        title={`Aportar a ${modalAporte?.nombre || ''}`} size="sm">
        {modalAporte && (
          <form onSubmit={handleAgregarDinero} className="space-y-4">
            {/* Preview progreso */}
            <div className="rounded-xl px-4 py-3"
              style={{ background: `color-mix(in srgb, ${modalAporte.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${modalAporte.color} 20%, transparent)` }}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: modalAporte.color }}>
                  {getFlagEmoji(modalAporte.emoji)} {modalAporte.nombre}
                </span>
                <span className="text-xs font-semibold" style={{ color: modalAporte.color }}>
                  {Math.min(100, Math.round(((modalAporte.actual || 0) / modalAporte.meta) * 100))}%
                </span>
              </div>
              <ProgressBar value={modalAporte.actual || 0} max={modalAporte.meta} color={modalAporte.color} />
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {formatCurrency(modalAporte.actual || 0)}
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  meta: {formatCurrency(modalAporte.meta)}
                </span>
              </div>
            </div>

            <div>
              <label className="ff-label">Monto a aportar</label>
              <input className="ff-input" type="number" min="0.01" step="0.01" placeholder="0.00"
                required autoFocus
                value={montoAporte}
                onChange={e => setMontoAporte(e.target.value)} />
              {montoMetasDisponible > 0 && modalAporte.pct_mensual > 0 && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  Aporte automático sugerido: {formatCurrency((modalAporte.pct_mensual / 100) * montoMetasDisponible)}
                </p>
              )}
            </div>

            {/* Preview nuevo total */}
            {parseFloat(montoAporte) > 0 && (
              <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-green) 18%, transparent)' }}>
                <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>Nuevo total</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
                  {formatCurrency((modalAporte.actual || 0) + parseFloat(montoAporte))}
                  {(modalAporte.actual || 0) + parseFloat(montoAporte) >= modalAporte.meta && ' 🎉'}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setModalAporte(null); setMontoAporte(''); setError(null) }}
                className="ff-btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={saving}
                className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando...' : 'Registrar aporte'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL CREAR/EDITAR */}
      <Modal open={modal} onClose={closeModal} title={editingId ? 'Editar Meta' : 'Nueva Meta de Ahorro'}>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={8} value={form.emoji}
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
              .filter(m => m.id !== editingId && ['activa', 'pausada'].includes(m.estado))
              .reduce((s, m) => s + (m.pct_mensual || 0), 0)
            const pctLibre = Math.max(0, 100 - pctUsado)
            const pctActual = parseFloat(form.pct_mensual) || 0
            const excede = pctActual > pctLibre
            const montoActual = (pctActual / 100) * montoMetasDisponible
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

      <ConfirmDialog {...confirmProps} />
    </AppShell>
  )
}
