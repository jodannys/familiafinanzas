'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, Loader2, Trash2, Snowflake, Pencil } from 'lucide-react'
import { formatCurrency, calculateCompoundInterest } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xl">
      <p className="text-[10px] uppercase font-black text-stone-400 mb-2">Año {label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-sm font-bold" style={{ color: p.color }}>
          {p.name === 'contributed' ? 'Aportado' : 'Balance'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// Definimos el estado inicial fuera para poder resetearlo fácilmente
const INITIAL_FORM = { 
  nombre: '', emoji: '📈', capital: '', aporte: '', 
  tasa: '', anos: '10', bola_nieve: true, color: '#10b981' 
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
  const [form, setForm] = useState(INITIAL_FORM)

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
  }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('inversiones').select('*').order('created_at')
    if (error) setError(error.message)
    else { 
      setInversiones(data || [])
      if (data?.length) setSelected(data[0]) 
    }
    setLoading(false)
  }

  async function handleSave(e) {
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

    const { data, error: saveError } = editandoId 
      ? await supabase.from('inversiones').update(payload).eq('id', editandoId).select()
      : await supabase.from('inversiones').insert([payload]).select()

    if (saveError) {
      setError(saveError.message)
    } else {
      setModal(false)
      setForm(INITIAL_FORM)
      setEditandoId(null)
      cargar()
    }
    setSaving(false)
  }

  function openEditModal(inv) {
    setForm({ ...inv })
    setEditandoId(inv.id)
    setModal(true)
  }

  async function handleDelete(id) {
    if(!confirm('¿Seguro que quieres eliminar esta inversión?')) return
    const { error } = await supabase.from('inversiones').delete().eq('id', id)
    if (!error) {
      const resto = inversiones.filter(i => i.id !== id)
      setInversiones(resto)
      if (selected?.id === id) setSelected(resto[0] || null)
    } else { 
      setError(error.message) 
    }
  }

  // IMPORTANTE: Pasamos "compound" basado en "bola_nieve"
  const calc = selected ? calculateCompoundInterest({ 
    principal: selected.capital, 
    monthlyContribution: selected.aporte, 
    annualRate: selected.tasa, 
    years: selected.anos,
    compound: selected.bola_nieve 
  }) : null

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo Futuro</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Inversiones</h1>
        </div>
        <button onClick={() => { setEditandoId(null); setForm(INITIAL_FORM); setModal(true); }} 
          className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} />Nueva inversión
        </button>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold bg-red-50 border border-red-100 text-red-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-stone-400">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Sincronizando...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista Lateral */}
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
                  className={`glass-card p-4 cursor-pointer transition-all group border-2 ${isSelected ? '' : 'border-transparent opacity-70'}`}
                  style={{ borderColor: isSelected ? inv.color : 'transparent' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{inv.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-800 truncate">{inv.nombre}</p>
                      <p className="text-[10px] text-stone-400 uppercase font-bold tracking-tighter">
                        {inv.tasa}% · {inv.anos} años
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); openEditModal(inv) }} className="p-1 hover:bg-stone-100 rounded text-stone-400"><Pencil size={14}/></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(inv.id) }} className="p-1 hover:bg-red-50 rounded text-red-400"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] text-stone-400 font-bold">CAPITAL: {formatCurrency(inv.capital)}</span>
                    <span className="font-black text-sm" style={{ color: inv.color }}>{formatCurrency(c.finalBalance)}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detalle y Gráfica */}
          {selected && calc && (
            <div className="col-span-1 lg:col-span-2 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="glass-card p-4 relative">
                  <p className="text-[9px] text-stone-400 uppercase font-black mb-1">Presupuesto</p>
                  <p className="text-xl font-bold text-indigo-500">{presupuesto ? formatCurrency(presupuesto.montoInversiones) : '—'}</p>
                </div>
                {[
                  { label: 'Proyección', value: formatCurrency(calc.finalBalance), color: selected.color },
                  { label: 'Tus aportes', value: formatCurrency(calc.totalContributed), color: '#78716c' },
                  { label: 'Beneficio', value: formatCurrency(calc.totalInterest), color: '#f59e0b' },
                ].map((s, i) => (
                  <div key={i} className="glass-card p-4">
                    <p className="text-[9px] text-stone-400 uppercase font-black mb-1">{s.label}</p>
                    <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>

              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                   <div>
                      <h3 className="font-black text-stone-800 uppercase text-xs tracking-widest">{selected.nombre}</h3>
                      <p className="text-[10px] text-stone-400 font-bold">{selected.bola_nieve ? '🌨 INTERÉS COMPUESTO ACTIVADO' : '⚖️ INTERÉS SIMPLE'}</p>
                   </div>
                   <Badge color="emerald" className="text-lg px-3 py-1 font-black">x{(calc.finalBalance / selected.capital).toFixed(1)}</Badge>
                </div>
                
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={calc.history}>
                    <defs>
                      <linearGradient id="gColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selected.color} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#a8a29e', fontSize: 10}} tickFormatter={v => `Año ${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="balance" stroke={selected.color} strokeWidth={3} fill="url(#gColor)" />
                    <Area type="monotone" dataKey="contributed" stroke="#e7e5e4" strokeWidth={2} strokeDasharray="4 4" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* MODAL */}
      <Modal open={modal} onClose={() => setModal(false)} title={editandoId ? "Editar Inversión" : "Nueva Inversión"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre</label>
              <input className="ff-input" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Capital Inicial</label>
              <input className="ff-input" type="number" step="0.01" required value={form.capital} onChange={e => setForm({ ...form, capital: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">Aporte Mensual</label>
              <input className="ff-input" type="number" step="0.01" value={form.aporte} onChange={e => setForm({ ...form, aporte: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">% Rendimiento</label>
              <input className="ff-input" type="number" step="0.1" required value={form.tasa} onChange={e => setForm({ ...form, tasa: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">Años</label>
              <input className="ff-input" type="number" required value={form.anos} onChange={e => setForm({ ...form, anos: e.target.value })} />
            </div>
          </div>

          <div className={`p-4 rounded-xl flex items-center gap-3 border ${form.bola_nieve ? 'bg-sky-50 border-sky-100' : 'bg-stone-50 border-stone-200'}`}>
            <input type="checkbox" id="bola" checked={form.bola_nieve} onChange={e => setForm({ ...form, bola_nieve: e.target.checked })} className="w-5 h-5 accent-sky-500" />
            <label htmlFor="bola" className="text-sm font-bold text-stone-700 cursor-pointer">Reinvertir ganancias (Bola de Nieve)</label>
          </div>

          <div>
            <label className="ff-label mb-2 block">Color de la gráfica</label>
            <div className="flex gap-2">
              {['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444'].map(c => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className={`w-8 h-8 rounded-full border-4 transition-all ${form.color === c ? 'border-stone-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 py-4 uppercase font-black tracking-widest text-xs">
              {saving ? <Loader2 className="animate-spin mx-auto" /> : (editandoId ? 'Guardar Cambios' : 'Crear Inversión')}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}