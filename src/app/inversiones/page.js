'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import {
  Plus, Loader2, Trash2, Pencil,
  TrendingUp, Target, Wallet, Sparkles,
  AlertCircle
} from 'lucide-react'
import { formatCurrency, calculateCompoundInterest } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'

// ─── Tooltip del gráfico ─────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-glass)',
      borderRadius: 12,
      padding: '8px 12px'
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
        Año {label}
      </p>
      {payload.map(p => (
        <p key={p.name} style={{ fontSize: 11, fontWeight: 800, color: p.color }}>
          {p.name === 'contributed' ? 'Aportado' : 'Balance'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function InversionesPage() {
  const [inversiones, setInversiones] = useState([])
  const [selected, setSelected]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [gastosMes, setGastosMes]     = useState(0)
  const [modal, setModal]             = useState(false)
  const [editandoId, setEditandoId]   = useState(null)
  const [form, setForm] = useState({
    nombre: '', emoji: '📈', capital: '', aporte: '',
    tasa: '', anos: '10', color: 'var(--accent-green)', bola_nieve: true
  })
async function cargar() {
  setLoading(true)
  const { data, error } = await supabase.from('inversiones').select()
  if (error) console.error(error)
  else setInversiones(data || [])
  setLoading(false)
}
  // ─── Cargar datos iniciales ────────────────────────────────────────────────
  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
    cargarGastosMes()
  }, [])

 async function cargarGastosMes() {

  const now = new Date()
  const año = now.getFullYear()
  const mes = now.getMonth()

  // inicio del mes
  const inicioMes = new Date(año, mes, 1).toISOString().slice(0,10)

  // inicio del mes siguiente
  const inicioMesSiguiente = new Date(año, mes + 1, 1).toISOString().slice(0,10)

  const { data, error } = await supabase
    .from('movimientos')
    .select('monto, categoria')
    .eq('tipo', 'egreso')
    .gte('fecha', inicioMes)
    .lt('fecha', inicioMesSiguiente)

  if (error) {
    console.error(error)
    return
  }

  // solo gastos reales
  const categoriasGasto = ['basicos','deseo']

  const total = (data || [])
    .filter(m => categoriasGasto.includes((m.categoria || '').toLowerCase()))
    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)

  setGastosMes(total)
}

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      nombre: form.nombre,
      emoji: form.emoji,
      capital: parseFloat(form.capital) || 0,
      aporte: parseFloat(form.aporte) || 0,
      tasa: parseFloat(form.tasa) || 0,
      anos: parseInt(form.anos) || 10,
      color: form.color,
      bola_nieve: form.bola_nieve,
    }

    if (editandoId) {
      const { error } = await supabase.from('inversiones').update(payload).eq('id', editandoId)
      if (error) { setError(error.message); setSaving(false); return }
      setInversiones(prev => prev.map(i => i.id === editandoId ? { ...i, ...payload } : i))
      if (selected?.id === editandoId) setSelected(prev => ({ ...prev, ...payload }))
    } else {
      const { data, error } = await supabase.from('inversiones').insert([payload]).select()
      if (error) { setError(error.message); setSaving(false); return }
      setInversiones(prev => [...prev, data[0]])
      setSelected(data[0])
    }

    setSaving(false)
    setModal(false)
    setEditandoId(null)
    setForm({ nombre: '', emoji: '📈', capital: '', aporte: '', tasa: '', anos: '10', color: 'var(--accent-green)', bola_nieve: true })
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm({ nombre: '', emoji: '📈', capital: '', aporte: '', tasa: '', anos: '10', color: 'var(--accent-green)', bola_nieve: true })
    setModal(true)
  }

  function abrirEdicion(inv) {
    setEditandoId(inv.id)
    setForm({
      nombre: inv.nombre || '',
      emoji: inv.emoji || '📈',
      capital: inv.capital?.toString() || '',
      aporte: inv.aporte?.toString() || '',
      tasa: inv.tasa?.toString() || '',
      anos: inv.anos?.toString() || '10',
      color: inv.color || 'var(--accent-green)',
      bola_nieve: inv.bola_nieve !== false,
    })
    setModal(true)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta cartera?')) return
    const { error } = await supabase.from('inversiones').delete().eq('id', id)
    if (!error) {
      const resto = inversiones.filter(i => i.id !== id)
      setInversiones(resto)
      setSelected(resto[0] || null)
    }
  }

  // ─── Cálculos de inversión ────────────────────────────────────────────────
  const calc = selected
    ? calculateCompoundInterest({
        principal: selected.capital,
        monthlyContribution: selected.aporte,
        annualRate: selected.tasa,
        years: selected.anos,
        compound: selected.bola_nieve !== false,
      })
    : null

  const historyData = calc?.history?.filter(d => d?.year != null) || []

  const totalCapital = inversiones.reduce((s, i) => s + (i.capital || 0), 0)
  const totalAportes = inversiones.reduce((s, i) => s + (i.aporte || 0), 0)

  // ─── AJUSTE FIRE: gastos reales del mes ──────────────────────────────────

const baseGastos   = gastosMes > 0 ? gastosMes : (presupuesto?.total ?? 0) * 0.7
const metaLibertad = baseGastos > 0 ? baseGastos * 12 * 25 : null

  const progresoFIRE = calc ? Math.min(100, (calc.finalBalance / metaLibertad) * 100) : 0

  // ─── Colores de cartera ───────────────────────────────────────────────────
  const COLORES_PICKER = [
    { hex: '#2D7A5F', label: 'Verde' },
    { hex: '#4A6FA5', label: 'Azul' },
    { hex: '#818CF8', label: 'Índigo' },
    { hex: '#C17A3A', label: 'Terra' },
    { hex: '#C0605A', label: 'Rosa' },
    { hex: '#10b981', label: 'Menta' },
    { hex: '#8b5cf6', label: 'Violeta' },
  ]

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
            style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl font-black tracking-tight truncate"
            style={{ color: 'var(--text-primary)' }}>Inversiones</h1>
        </div>
        <button onClick={abrirNuevo} className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-bold">Nueva cartera</span>
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2"
          style={{
            background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)',
            color: 'var(--accent-rose)'
          }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* ── Stats globales ── */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: 'Capital total',    value: formatCurrency(totalCapital), color: 'var(--accent-green)' },
          { label: 'Aportes / mes',    value: formatCurrency(totalAportes), color: 'var(--accent-terra)' },
          { label: 'Carteras activas', value: `${inversiones.length}`,      color: 'var(--accent-blue)'  },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] uppercase tracking-wider font-bold mb-1"
              style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-sm font-black" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Contenido principal ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : inversiones.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No hay carteras registradas</p>
          <button onClick={abrirNuevo} className="ff-btn-primary">Crear primera cartera</button>
        </div>
      ) : (
        <div className="space-y-4">

          {/* ── Chips selector de cartera ── */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {inversiones.map(inv => (
              <button key={inv.id}
                onClick={() => setSelected(inv)}
                className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase transition-all"
                style={{
                  background: selected?.id === inv.id ? `${inv.color}18` : 'var(--bg-secondary)',
                  color:      selected?.id === inv.id ? inv.color         : 'var(--text-muted)',
                  border:     `1px solid ${selected?.id === inv.id ? `${inv.color}40` : 'var(--border-glass)'}`,
                }}>
                <span>{inv.emoji}</span>
                <span className="hidden sm:inline">{inv.nombre}</span>
              </button>
            ))}
          </div>

          {/* ── Detalle cartera seleccionada ── */}
          {selected && calc && (
            <Card className="animate-enter" style={{ padding: '16px' }}>

              {/* Cabecera */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${selected.color}18` }}>
                    {selected.emoji}
                  </div>
                  <div>
                    <p className="font-black text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {selected.nombre}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {selected.tasa}% anual · {selected.anos} años · +{formatCurrency(selected.aporte)}/mes
                      {' · '}
                      <span style={{ color: selected.bola_nieve !== false ? 'var(--accent-green)' : 'var(--accent-terra)' }}>
                        {selected.bola_nieve !== false ? '🔄 Bola de nieve' : '📤 Sin reinversión'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => abrirEdicion(selected)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                    style={{ background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)', color: 'var(--accent-blue)' }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(selected.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                    style={{ background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)', color: 'var(--accent-rose)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: <Wallet size={12} />,    label: 'Capital inicial',  value: formatCurrency(selected.capital),       color: 'var(--accent-blue)'  },
                  { icon: <TrendingUp size={12} />, label: 'Balance final',    value: formatCurrency(calc.finalBalance),      color: selected.color        },
                  { icon: <Sparkles size={12} />,   label: 'Ganancias netas', value: formatCurrency(calc.totalInterest),     color: 'var(--accent-terra)' },
                ].map((k, i) => (
                  <div key={i} className="p-2.5 rounded-xl text-center"
                    style={{
                      background: `color-mix(in srgb, ${k.color} 8%, transparent)`,
                      border:     `1px solid color-mix(in srgb, ${k.color} 20%, transparent)`,
                    }}>
                    <div className="flex items-center justify-center gap-1 mb-1" style={{ color: k.color }}>
                      {k.icon}
                      <p className="text-[8px] font-black uppercase">{k.label}</p>
                    </div>
                    <p className="text-sm font-black" style={{ color: k.color, letterSpacing: '-0.02em' }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Multiplicador */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${selected.color} 8%, transparent)`,
                  border:     `1px solid color-mix(in srgb, ${selected.color} 20%, transparent)`,
                }}>
                <Target size={13} style={{ color: selected.color, flexShrink: 0 }} />
                <p className="text-[10px] font-black" style={{ color: selected.color }}>
                  Tu dinero se multiplica ×{(calc.finalBalance / (selected.capital || 1)).toFixed(1)} en {selected.anos} años
                </p>
                <span className="ml-auto text-[9px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: `color-mix(in srgb, ${selected.color} 15%, transparent)`, color: selected.color }}>
                  Interés compuesto
                </span>
              </div>

              {/* Gráfico */}
              {historyData.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-black uppercase mb-2 ml-1" style={{ color: 'var(--text-muted)' }}>
                    Proyección de crecimiento
                  </p>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${selected.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={selected.color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-glass)" opacity={0.5} />
                        <XAxis dataKey="year" axisLine={false} tickLine={false}
                          tick={{ fill: 'var(--text-muted)', fontSize: 9, fontWeight: 700 }}
                          tickFormatter={v => `A${v}`} interval="preserveStartEnd" />
                        <YAxis axisLine={false} tickLine={false}
                          tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
                          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                        <Tooltip content={<CustomTooltip />}
                          cursor={{ stroke: selected.color, strokeWidth: 1.5, strokeDasharray: '4 4' }} />
                        <Area name="balance" type="monotone" dataKey="balance"
                          stroke={selected.color} strokeWidth={2.5}
                          fill={`url(#grad-${selected.id})`} />
                        <Area name="contributed" type="monotone" dataKey="contributed"
                          stroke="var(--text-muted)" strokeWidth={1.5}
                          strokeDasharray="5 3" fill="transparent" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex items-center gap-4 mt-2 ml-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 rounded" style={{ background: selected.color }} />
                      <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>Balance proyectado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 border-t border-dashed" style={{ borderColor: 'var(--text-muted)' }} />
                      <span className="text-[9px] font-bold" style={{ color: 'var(--text-muted)' }}>Total aportado</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Regla del 4% */}
              <div className="p-3 rounded-xl"
                style={{
                  background: 'color-mix(in srgb, var(--accent-green) 6%, transparent)',
                  border:     '1px solid color-mix(in srgb, var(--accent-green) 15%, transparent)',
                }}>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={11} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                  <p className="text-[9px] font-black uppercase" style={{ color: 'var(--accent-green)' }}>
                    Retiro mensual sostenible (Regla del 4%)
                  </p>
                </div>
                <p className="text-base font-black" style={{ color: 'var(--accent-green)', letterSpacing: '-0.02em' }}>
                  {formatCurrency(calc.finalBalance * 0.04 / 12)}
                  <span className="text-[10px] font-bold opacity-60">/mes para siempre</span>
                </p>
              </div>
            </Card>
          )}

          {/* ── Meta libertad financiera ── */}
           {metaLibertad && calc && (
        <Card className="animate-enter" style={{ padding: '14px 16px', animationDelay: '0.1s' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target size={13} style={{ color: 'var(--accent-terra)' }} />
              <p className="text-[10px] font-black uppercase" style={{ color: 'var(--text-secondary)' }}>
                Meta libertad financiera
              </p>
            </div>
            <p className="text-[10px] font-black" style={{ color: 'var(--accent-green)' }}>
              {progresoFIRE.toFixed(1)}%
            </p>
          </div>
          <ProgressBar value={Math.min(calc.finalBalance, metaLibertad)} max={metaLibertad} color="var(--accent-green)" />
          <div className="flex items-center justify-between mt-2">
            <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              Basado en {formatCurrency(baseGastos)} gastos/mes × 12 × 25
            </p>
            <p className="text-[9px] font-black" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(metaLibertad)}
            </p>
          </div>
        </Card>
      )}

          {/* ── Lista compacta de todas las carteras ── */}
          {inversiones.length > 1 && (
            <div className="space-y-2">
              <p className="text-[9px] font-black uppercase ml-1" style={{ color: 'var(--text-muted)' }}>
                Todas las carteras
              </p>
              {inversiones.map((inv, i) => {
                const c = calculateCompoundInterest({
                  principal: inv.capital,
                  monthlyContribution: inv.aporte,
                  annualRate: inv.tasa,
                  years: inv.anos,
                })
                return (
                  <div key={inv.id}
                    onClick={() => setSelected(inv)}
                    className="glass-card cursor-pointer transition-all animate-enter"
                    style={{
                      animationDelay: `${i * 0.04}s`,
                      padding: '10px 14px',
                      border: selected?.id === inv.id ? `1px solid ${inv.color}40` : '',
                    }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${inv.color}18` }}>
                        <span className="text-base">{inv.emoji}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black truncate" style={{ color: 'var(--text-primary)' }}>
                          {inv.nombre}
                        </p>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {inv.tasa}% · {inv.anos}a · +{formatCurrency(inv.aporte)}/mes
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black" style={{ color: inv.color, letterSpacing: '-0.02em' }}>
                          {formatCurrency(c.finalBalance)}
                        </p>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>en {inv.anos} años</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL CREAR / EDITAR
      ══════════════════════════════════════════════════ */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditandoId(null) }}
        title={editandoId ? 'Editar Cartera' : 'Nueva Cartera'}>
        <form onSubmit={handleSave} className="space-y-4">

          {/* Emoji + Nombre */}
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2}
                value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre de la cartera</label>
              <input className="ff-input" required placeholder="Ej: S&P 500, Dividendos..."
                value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
            </div>
          </div>

          {/* Capital + Aporte */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Capital inicial (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                value={form.capital} onChange={e => setForm(p => ({ ...p, capital: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Aporte mensual (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.aporte} onChange={e => setForm(p => ({ ...p, aporte: e.target.value }))} />
            </div>
          </div>

          {/* Tasa + Años */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Tasa anual (%)</label>
              <input className="ff-input" type="number" min="0" step="0.1" placeholder="Ej: 7" required
                value={form.tasa} onChange={e => setForm(p => ({ ...p, tasa: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Plazo (años)</label>
              <input className="ff-input" type="number" min="1" max="50" placeholder="10" required
                value={form.anos} onChange={e => setForm(p => ({ ...p, anos: e.target.value }))} />
            </div>
          </div>

          {/* Preview en tiempo real */}
          {form.capital && form.tasa && form.anos && (() => {
            const prev = calculateCompoundInterest({
              principal: parseFloat(form.capital) || 0,
              monthlyContribution: parseFloat(form.aporte) || 0,
              annualRate: parseFloat(form.tasa) || 0,
              years: parseInt(form.anos) || 10,
              compound: form.bola_nieve,
            })
            const c = form.color.startsWith('var(') ? 'var(--accent-green)' : form.color
            return (
              <div className="px-3 py-2.5 rounded-xl text-[10px] font-bold"
                style={{
                  background: `color-mix(in srgb, ${c} 8%, transparent)`,
                  color: c,
                  border: `1px solid color-mix(in srgb, ${c} 20%, transparent)`,
                }}>
                Balance proyectado:{' '}
                <span className="font-black text-sm">{formatCurrency(prev.finalBalance)}</span>
                <span className="opacity-60 ml-1">en {form.anos} años</span>
              </div>
            )
          })()}

          {/* Toggle Bola de Nieve */}
          <div>
            <label className="ff-label">Estrategia de interés</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { val: true,  icon: '🔄', title: 'Bola de nieve', desc: 'Reinvierte las ganancias (interés compuesto)' },
                { val: false, icon: '📤', title: 'Sin reinversión', desc: 'Retiras las ganancias cada año' },
              ].map(opt => (
                <button key={String(opt.val)} type="button"
                  onClick={() => setForm(p => ({ ...p, bola_nieve: opt.val }))}
                  className="p-3 rounded-xl text-left transition-all border-2"
                  style={{
                    borderColor: form.bola_nieve === opt.val ? 'var(--accent-green)' : 'var(--border-glass)',
                    background:  form.bola_nieve === opt.val
                      ? 'color-mix(in srgb, var(--accent-green) 6%, transparent)'
                      : 'var(--bg-secondary)',
                  }}>
                  <p className="text-base mb-0.5">{opt.icon}</p>
                  <p className="text-[10px] font-black" style={{ color: form.bola_nieve === opt.val ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                    {opt.title}
                  </p>
                  <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Picker de color de cartera */}
          <div>
            <label className="ff-label">Color de la cartera</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLORES_PICKER.map(({ hex, label }) => (
                <button key={hex} type="button" title={label}
                  onClick={() => setForm(p => ({ ...p, color: hex }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    backgroundColor: hex,
                    outline: form.color === hex ? `3px solid var(--text-secondary)` : 'none',
                    outlineOffset: 2,
                    opacity: form.color === hex ? 1 : 0.5,
                    transform: form.color === hex ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button"
              onClick={() => { setModal(false); setEditandoId(null) }}
              className="ff-btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear cartera'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}