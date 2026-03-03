'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'

function mesesRestantes(actual, meta, pctMensual, ingresoMensual = 5500) {
  const aporteMensual = (pctMensual / 100) * ingresoMensual
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
  const [form, setForm] = useState({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: '#10b981' })

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

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('metas')
      .insert([{ nombre: form.nombre, emoji: form.emoji, meta: parseFloat(form.meta), actual: 0, estado: 'activa', color: form.color, pct_mensual: parseFloat(form.pct_mensual) }])
      .select()
    if (error) setError(error.message)
    else { setMetas(prev => [...prev, data[0]]); setModal(false); setForm({ nombre: '', emoji: '🎯', meta: '', pct_mensual: '', color: '#10b981' }) }
    setSaving(false)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('metas').delete().eq('id', id)
    if (!error) setMetas(prev => prev.filter(m => m.id !== id))
  }

  async function handleEstado(id, estado) {
    const { error } = await supabase.from('metas').update({ estado }).eq('id', id)
    if (!error) setMetas(prev => prev.map(m => m.id === id ? { ...m, estado } : m))
  }

  const activas = metas.filter(m => m.estado === 'activa')
  const totalPct = activas.reduce((s, m) => s + (m.pct_mensual || 0), 0)
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
        {[
          // DESPUÉS
          { label: 'Total ahorrado', value: formatCurrency(totalAhorrado), color: '#10b981' },
          {
            label: 'Destinado a Metas', value: presupuesto ? (
              <div className="flex items-baseline gap-2">
                {/* Monto principal en color Terra del tema */}
                <span className="text-2xl font-extrabold" style={{ color: 'var(--accent-terra)', letterSpacing: '-0.03em' }}>
                  {formatCurrency(presupuesto.montoMetas)}
                </span>
                {/* Badge con el % usando el fondo secundario del tema */}
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wider uppercase"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-glass)'
                  }}>
                  {presupuesto.pctMetas}%
                </span>
              </div>
            ) : '—',
            color: 'var(--accent-terra)'
          },
          { label: 'Metas activas', value: `${activas.length}`, color: '#38bdf8' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-5 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
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
            const tiempo = mesesRestantes(meta.actual || 0, meta.meta, meta.pct_mensual || 0)
            return (
              <Card key={meta.id} className="animate-enter group" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${meta.color}18` }}>
                    {getFlagEmoji(meta.emoji)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
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
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {meta.estado === 'activa' && (
                        <button onClick={() => handleEstado(meta.id, 'pausada')}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(193,122,58,0.1)', color: '#C17A3A' }}>
                          Pausar
                        </button>
                      )}
                      {meta.estado === 'pausada' && (
                        <button onClick={() => handleEstado(meta.id, 'activa')}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(45,122,95,0.1)', color: '#2D7A5F' }}>
                          Activar
                        </button>
                      )}
                      <button onClick={() => handleEstado(meta.id, 'completada')}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8' }}>
                        ✓
                      </button>
                      <button onClick={() => handleDelete(meta.id)}
                        className="p-1.5 rounded-lg"
                        style={{ color: '#C0605A' }}>
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

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Meta de Ahorro">
        <form onSubmit={handleAdd} className="space-y-4">
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
              <label className="ff-label">% ingreso mensual</label>
              <input className="ff-input" type="number" min="0" max="100" placeholder="10" required
                value={form.pct_mensual} onChange={e => setForm({ ...form, pct_mensual: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#10b981', '#f59e0b', '#8b5cf6', '#38bdf8', '#fb7185', '#fb923c'].map(c => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{ background: c, outline: form.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : 'Crear meta'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}