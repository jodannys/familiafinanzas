'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Snowflake } from 'lucide-react'
import { formatCurrency, calculateCompoundInterest } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 12, padding: '10px 14px' }}>
      <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>Año {label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name === 'contributed' ? 'Aportado' : 'Balance'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function InversionesPage() {
  const [inversiones, setInversiones] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ nombre: '', emoji: '📈', capital: '', aporte: '', tasa: '', anos: '10', bola_nieve: true, color: '#10b981' })

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
  }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('inversiones').select('*').order('created_at')
    if (error) setError(error.message)
    else { setInversiones(data || []); if (data?.length) setSelected(data[0]) }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload = {
      nombre: form.nombre,
      emoji: form.emoji,
      capital: parseFloat(form.capital),
      aporte: parseFloat(form.aporte || 0),
      tasa: parseFloat(form.tasa),
      anos: parseInt(form.anos),
      bola_nieve: form.bola_nieve,
      color: form.color
    }

    let response;

    if (editandoId) {
      // Actualizar existente
      response = await supabase.from('inversiones').update(payload).eq('id', editandoId).select()
    } else {
      // Crear nueva
      response = await supabase.from('inversiones').insert([payload]).select()
    }

    if (response.error) {
      setError(response.error.message)
    } else {
      setModal(false)
      setForm(defaultForm)
      setEditandoId(null)
      cargar() // Recargamos la lista para asegurar que todo está sincronizado
    }
    setSaving(false)
  }

  // Nueva función para abrir el modal en modo edición
  function openEditModal(inv) {
    setForm({
      nombre: inv.nombre,
      emoji: inv.emoji,
      capital: inv.capital,
      aporte: inv.aporte,
      tasa: inv.tasa,
      anos: inv.anos,
      bola_nieve: inv.bola_nieve,
      color: inv.color
    })
    setEditandoId(inv.id)
    setModal(true)
  }
  async function handleDelete(id) {
    const { error } = await supabase.from('inversiones').delete().eq('id', id)
    if (!error) {
      const resto = inversiones.filter(i => i.id !== id)
      setInversiones(resto)
      setSelected(resto[0] || null)
    }
    else { setError(error.message) }
  }

  const calc = selected ? calculateCompoundInterest({ principal: selected.capital, monthlyContribution: selected.aporte, annualRate: selected.tasa, years: selected.anos }) : null

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Inversiones</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} />Nueva inversión
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin text-stone-400" />
          <span className="text-sm text-stone-400">Cargando inversiones...</span>
        </div>
      ) : inversiones.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">No hay inversiones aún</p>
          <button onClick={() => setModal(true)} className="ff-btn-primary">Agregar primera inversión</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="space-y-3">
            {inversiones.map(inv => {
              const c = calculateCompoundInterest({
                principal: inv.capital,
                monthlyContribution: inv.aporte,
                annualRate: inv.tasa,
                years: inv.anos,
                compound: inv.bola_nieve
              })
              const isSelected = selected?.id === inv.id
              return (
                <div key={inv.id} onClick={() => setSelected(inv)}
                  className="glass-card p-4 cursor-pointer transition-all group"
                  style={{ borderColor: isSelected ? `${inv.color}40` : undefined, boxShadow: isSelected ? `0 0 20px ${inv.color}15` : undefined }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{inv.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-800 truncate">{inv.nombre}</p>
                      <p className="text-xs text-stone-400">{inv.tasa}% anual · {inv.anos} años</p>
                    </div>
                    {inv.bola_nieve && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.1)' }}>
                        <Snowflake size={12} className="text-sky-400" />
                      </div>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Botón Editar */}
                      <button onClick={e => { e.stopPropagation(); openEditModal(inv) }}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors">
                        <Pencil size={13} />
                      </button>
                      {/* Botón Borrar */}
                      <button onClick={e => { e.stopPropagation(); handleDelete(inv.id) }}
                        className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-stone-400">Capital: {formatCurrency(inv.capital)}</span>
                    <span className="font-bold" style={{ color: inv.color }}>{formatCurrency(c.finalBalance)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detalle */}
          {selected && calc && (
            <div className="col-span-1 lg:col-span-2 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Card especial con % en esquina */}
                <div className="glass-card p-4 relative">
                  <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-1">Destinado</p>
                  <p className="text-xl font-bold" style={{ color: '#818CF8', letterSpacing: '-0.02em' }}>
                    {presupuesto ? formatCurrency(presupuesto.montoInversiones) : '—'}
                  </p>
                  {presupuesto && (
                    <span className="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(129,140,248,0.12)', color: '#818CF8' }}>
                      {presupuesto.pctInversiones}%
                    </span>
                  )}
                </div>
                {[
                  { label: 'Balance final', value: formatCurrency(calc.finalBalance), color: selected.color },
                  { label: 'Total aportado', value: formatCurrency(calc.totalContributed), color: 'var(--text-secondary)' },
                  { label: 'Ganancias', value: formatCurrency(calc.totalInterest), color: '#f59e0b' },
                ].map((s, i) => (
                  <div key={i} className="glass-card p-4">
                    <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-1">{s.label}</p>
                    <p className="text-xl font-bold" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-stone-800">{selected.nombre}</h3>
                    <p className="text-xs text-stone-400">Proyección a {selected.anos} años · {selected.tasa}% anual{selected.bola_nieve && ' · 🌨 Bola de nieve'}</p>
                  </div>
                  <Badge color="emerald">×{(calc.finalBalance / selected.capital).toFixed(1)}</Badge>
                </div>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={calc.history} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gBal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selected.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `A${v}`} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="balance" stroke={selected.color} strokeWidth={2} fill="url(#gBal)" name="balance" />
                    <Area type="monotone" dataKey="contributed" stroke="#94a3b8" strokeWidth={1.5} fill="none" name="contributed" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <h3 className="font-bold text-stone-800 mb-4">Tabla año a año</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-stone-400 uppercase tracking-wider text-left">
                        <th className="pb-3 font-semibold">Año</th>
                        <th className="pb-3 font-semibold">Aportado</th>
                        <th className="pb-3 font-semibold">Interés</th>
                        <th className="pb-3 font-semibold text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calc.history.slice(1).map(row => (
                        <tr key={row.year} className="border-t hover:bg-stone-50 transition-colors" style={{ borderColor: 'var(--border-glass)' }}>
                          <td className="py-2.5 text-stone-600 font-semibold">Año {row.year}</td>
                          <td className="py-2.5 text-stone-400">{formatCurrency(row.contributed)}</td>
                          <td className="py-2.5 font-semibold" style={{ color: '#f59e0b' }}>+{formatCurrency(row.interest)}</td>
                          <td className="py-2.5 text-right font-bold" style={{ color: selected.color }}>{formatCurrency(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Inversión">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2} value={form.emoji}
                onChange={e => setForm({ ...form, emoji: e.target.value })} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre</label>
              <input className="ff-input" placeholder="Ej: Fondo S&P500" required
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Capital inicial</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                value={form.capital} onChange={e => setForm({ ...form, capital: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">Aportación mensual</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.aporte} onChange={e => setForm({ ...form, aporte: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ff-label">% Rendimiento anual</label>
              <input className="ff-input" type="number" min="0.1" max="100" step="0.1" placeholder="8" required
                value={form.tasa} onChange={e => setForm({ ...form, tasa: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">Proyección (años)</label>
              <input className="ff-input" type="number" min="1" max="50" placeholder="10"
                value={form.anos} onChange={e => setForm({ ...form, anos: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}>
            <input type="checkbox" id="bola_nieve" checked={form.bola_nieve}
              onChange={e => setForm({ ...form, bola_nieve: e.target.checked })} className="w-4 h-4 accent-sky-400" />
            <label htmlFor="bola_nieve" className="text-sm text-stone-600 cursor-pointer">
              <span className="font-semibold text-stone-800">Bola de nieve</span> — reinvertir ganancias (interés compuesto)
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>
        <div className="mb-4">
          <label className="ff-label">Color de la gráfica</label>
          <div className="flex gap-2 mt-1">
            {['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className={`w-6 h-6 rounded-full border-2 transition-all ${form.color === c ? 'border-stone-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}