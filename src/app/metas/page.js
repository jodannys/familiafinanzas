'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'

// DESPUÉS
function mesesRestantes(actual, meta, pctMensual, montoDisponible = 0) {
  const aporteMensual = (pctMensual / 100) * montoDisponible
  if (aporteMensual <= 0) return '—'
  const restante = meta - actual
  const meses = Math.ceil(restante / aporteMensual)
  if (meses <= 0) return 'Completada'
  if (meses < 12) return `${meses} meses`
  const anos = Math.floor(meses / 12)
  const m = meses % 12
  return `${anos}a ${m}m`
}

export default function MetasPage() {
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    nombre: '',
    emoji: '🎯',
    meta: '',
    pct_mensual: '',
    color: '#10b981'
  })

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
    setForm({
      nombre: meta.nombre,
      emoji: meta.emoji,
      meta: meta.meta,
      pct_mensual: meta.pct_mensual,
      color: meta.color
    })
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
      // MODO EDICIÓN
      const { error } = await supabase.from('metas').update(payload).eq('id', editingId)
      if (error) setError(error.message)
      else {
        setMetas(prev => prev.map(m => m.id === editingId ? { ...m, ...payload } : m))
        closeModal()
      }
    } else {
      // MODO CREACIÓN
      const { data, error } = await supabase
        .from('metas')
        .insert([{ ...payload, actual: 0, estado: 'activa' }])
        .select()
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

  async function handleEstado(id, estado) {
    const { error } = await supabase.from('metas').update({ estado }).eq('id', id)
    if (!error) setMetas(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
  }

  const activas = metas.filter(m => m.estado === 'activa')
  const totalAhorrado = metas.reduce((s, m) => s + (m.actual || 0), 0)

  const estadoBadge = { activa: 'emerald', pausada: 'gold', completada: 'sky' }
  const estadoLabel = { activa: 'Activa', pausada: 'Pausada', completada: 'Completada ✓' }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Metas de Ahorro</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva meta
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Total ahorrado */}
        <div className="glass-card p-5 animate-enter">
          <p className="ff-label mb-2">Total ahorrado</p>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--accent-green)', letterSpacing: '-0.03em' }}>
            {formatCurrency(totalAhorrado)}
          </div>
        </div>

        {/* Destinado a Metas — con % en esquina */}
        <div className="glass-card p-5 animate-enter relative" style={{ animationDelay: '0.05s' }}>
          <p className="ff-label mb-2">Destinado a Metas</p>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--accent-terra)', letterSpacing: '-0.03em' }}>
            {presupuesto ? formatCurrency(presupuesto.montoMetas) : '—'}
          </div>
          {presupuesto && (
            <span className="absolute top-3 right-4 text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(193,122,58,0.12)', color: 'var(--accent-terra)' }}>
              {presupuesto.pctMetas}%
            </span>
          )}
        </div>

        {/* Metas activas */}
        <div className="glass-card p-5 animate-enter" style={{ animationDelay: '0.1s' }}>
          <p className="ff-label mb-2">Metas activas</p>
          <div className="text-2xl font-extrabold" style={{ color: 'var(--accent-blue)', letterSpacing: '-0.03em' }}>
            {activas.length}
          </div>
        </div>
      </div>
      {/* Cards List */}
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
        <div className="grid grid-cols-1 gap-4">
          {metas.map((meta, i) => {
            const pct = Math.min(100, Math.round(((meta.actual || 0) / meta.meta) * 100))
            const restante = meta.meta - (meta.actual || 0)

            const tiempo = mesesRestantes(meta.actual || 0, meta.meta, meta.pct_mensual || 0, presupuesto?.montoMetas || 0)
            return (
              <Card key={meta.id} className="animate-enter group" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${meta.color}18` }}>
                    {getFlagEmoji(meta.emoji)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-stone-800">
                        {meta.nombre}
                      </h3>
                      <Badge color={estadoBadge[meta.estado]}>{estadoLabel[meta.estado]}</Badge>
                    </div>
                  </div>
                  <p className="text-xl font-bold flex-shrink-0" style={{ color: meta.color }}>{pct}%</p>
                </div>

                <ProgressBar value={meta.actual || 0} max={meta.meta} color={meta.color} className="mb-3" />

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold" style={{ color: meta.color }}>{formatCurrency(meta.actual || 0)}</span>
                    <span className="text-xs text-stone-400">de {formatCurrency(meta.meta)}</span>
                    {meta.estado !== 'completada' && restante > 0 && (
                      <span className="text-xs text-stone-400">· faltan {formatCurrency(restante)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-400">{meta.pct_mensual || 0}% /mes</span>
                    <span className="text-xs font-semibold" style={{ color: meta.color }}>{tiempo}</span>

                    {/* Botones de acción rápidos */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      {meta.estado === 'activa' && (
                        <button onClick={() => handleEstado(meta.id, 'pausada')}
                          className="text-[10px] px-2 py-1 rounded-lg bg-amber-50 text-amber-600 font-bold uppercase tracking-tight">
                          Pausar
                        </button>
                      )}
                      {meta.estado === 'pausada' && (
                        <button onClick={() => handleEstado(meta.id, 'activa')}
                          className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 font-bold uppercase tracking-tight">
                          Activar
                        </button>
                      )}
                      <button onClick={() => handleEstado(meta.id, 'completada')}
                        className="p-1.5 rounded-lg hover:bg-sky-50 text-sky-500">
                        ✓
                      </button>
                      <button onClick={() => prepareEdit(meta)}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(meta.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: 'var(--accent-rose)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal para Crear/Editar */}
      <Modal open={modal} onClose={closeModal} title={editingId ? "Editar Meta" : "Nueva Meta de Ahorro"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Monto objetivo</label>
              <input className="ff-input" type="number" min="1" step="0.01" placeholder="0.00" required
                value={form.meta} onChange={e => setForm({ ...form, meta: e.target.value })} />
            </div>
            <div>

              <label className="ff-label">% del presupuesto de metas</label>
              <input className="ff-input" type="number" min="0" max="100" placeholder="10" required
                value={form.pct_mensual} onChange={e => setForm({ ...form, pct_mensual: e.target.value })} />
              {presupuesto && form.pct_mensual && (
                <p className="text-xs mt-1 pl-1" style={{ color: 'var(--text-muted)' }}>
                  = {formatCurrency((parseFloat(form.pct_mensual) / 100) * presupuesto.montoMetas)}/mes
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#10b981', '#f59e0b', '#8b5cf6', '#38bdf8', '#C0605A', '#C17A3A'].map(c => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2,
                    opacity: form.color === c ? 1 : 0.6
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