'use client'
import { useState, useEffect, useMemo } from 'react'
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
import { useTheme, getThemeColors } from '@/lib/themes'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'

// ─── Tooltip del gráfico ─────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, colores }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: colores.card,
      border: `1px solid ${colores.border}`,
      borderRadius: 12,
      padding: '8px 12px',
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, color: colores.muted, textTransform: 'uppercase', marginBottom: 4 }}>
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
  const { theme } = useTheme()

  const [inversiones, setInversiones] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [gastosMes, setGastosMes] = useState(0)
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [colores, setColores] = useState({
    green: '', rose: '', blue: '', terra: '', violet: '',
    muted: '', border: '', card: '', track: '',
  })
  const [form, setForm] = useState({
    nombre: '', emoji: '📈', capital: '', aporte: '',
    tasa: '', anos: '10', color: '', bola_nieve: true,
  })

  // ── Colores del tema (CSS vars para Recharts y estilos inline) ────────────
  useEffect(() => {
    function leer() {
      const s = getComputedStyle(document.documentElement)
      const v = (n) => s.getPropertyValue(n).trim()
      setColores({
        green: v('--accent-green'),
        rose: v('--accent-rose'),
        blue: v('--accent-blue'),
        terra: v('--accent-terra'),
        violet: v('--accent-violet'),
        muted: v('--text-muted'),
        border: v('--border-glass'),
        card: v('--bg-card'),
        track: v('--progress-track'),
      })
    }
    leer()
    window.addEventListener('theme-change', leer)
    return () => window.removeEventListener('theme-change', leer)
  }, [])

  // ── Paleta del picker reactiva al tema ────────────────────────────────────
  const themeColors = getThemeColors(theme)

  useEffect(() => {
    if (themeColors.length && form.color && !themeColors.includes(form.color)) {
      setForm(f => ({ ...f, color: themeColors[0] }))
    }
    if (!form.color && themeColors.length) {
      setForm(f => ({ ...f, color: themeColors[0] }))
    }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
    cargarGastosMes()
  }, [])

  // FIX 1: índice de mes corregido a 1-12 + FIX 3: incluye deuda
  async function cargarGastosMes() {
    const now = new Date()
    const año = now.getFullYear()
    const mes = now.getMonth() + 1
    const inicioMes = new Date(año, mes - 1, 1).toISOString().slice(0, 10)
    const inicioSiguiente = new Date(año, mes, 1).toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('movimientos')
      .select('monto, categoria')
      .eq('tipo', 'egreso')
      .gte('fecha', inicioMes)
      .lt('fecha', inicioSiguiente)

    if (error) { console.error(error); return }

    const total = (data || [])
      .filter(m => ['basicos', 'deseo', 'deuda'].includes((m.categoria || '').toLowerCase()))
      .reduce((s, m) => s + parseFloat(m.monto || 0), 0)

    setGastosMes(total)
  }

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
    setForm({ nombre: '', emoji: '📈', capital: '', aporte: '', tasa: '', anos: '10', color: themeColors[0] || '', bola_nieve: true })
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm({ nombre: '', emoji: '📈', capital: '', aporte: '', tasa: '', anos: '10', color: themeColors[0] || '', bola_nieve: true })
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
      color: inv.color || themeColors[0] || '',
      bola_nieve: inv.bola_nieve !== false,
    })
    setModal(true)
  }

  // FIX 4: borrar movimientos huérfanos al eliminar cartera
  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta cartera?')) return
    await supabase.from('movimientos').delete().eq('inversion_id', id)
    const { error } = await supabase.from('inversiones').delete().eq('id', id)
    if (!error) {
      const resto = inversiones.filter(i => i.id !== id)
      setInversiones(resto)
      setSelected(resto[0] || null)
    } else {
      setError(error.message)
    }
  }

  // ── MEMOS — todos al nivel del componente, nunca dentro de loops ──────────

  // FIX 2: memoizar cálculo de cartera seleccionada
  const calc = useMemo(() =>
    selected
      ? calculateCompoundInterest({
        principal: selected.capital,
        monthlyContribution: selected.aporte,
        annualRate: selected.tasa,
        years: selected.anos,
        compound: selected.bola_nieve !== false,
      })
      : null
    , [selected])

  const historyData = useMemo(() =>
    calc?.history?.filter(d => d?.year != null) || []
    , [calc])

  // FIX 2: memoizar cálculos de TODAS las carteras (usado en lista compacta y totalProyectado)
  const calcsPorInversion = useMemo(() =>
    inversiones.map(inv => ({
      id: inv.id,
      calc: calculateCompoundInterest({
        principal: inv.capital,
        monthlyContribution: inv.aporte,
        annualRate: inv.tasa,
        years: inv.anos,
        compound: inv.bola_nieve !== false,
      })
    }))
    , [inversiones])

  // Derivados de calcsPorInversion — también memoizados
  const totalCapital = useMemo(() => inversiones.reduce((s, i) => s + (i.capital || 0), 0), [inversiones])
  const totalAportes = useMemo(() => inversiones.reduce((s, i) => s + (i.aporte || 0), 0), [inversiones])
  const totalProyectado = useMemo(() =>
    calcsPorInversion.reduce((s, { calc: c }) => s + (c?.finalBalance || 0), 0)
    , [calcsPorInversion])

  // FIX 5: fallback sin número mágico — usa presupuesto real
  const baseGastos = useMemo(() => {
    if (gastosMes > 0) return gastosMes
    const fallback = (presupuesto?.montoNecesidades || 0) + (presupuesto?.montoEstilo || 0)
    return fallback > 0 ? fallback : 0
  }, [gastosMes, presupuesto])

  const metaLibertad = baseGastos > 0 ? baseGastos * 12 * 25 : null

  // Tooltip con colores inyectados
  const TooltipConColores = (props) => <CustomTooltip {...props} colores={colores} />

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
  <AppShell>
    {/* 1. Header: Acción principal siempre visible */}
    <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
          style={{ color: colores.muted }}>Módulo</p>
        <h1 className="text-xl font-black tracking-tight truncate"
          style={{ color: 'var(--text-primary)' }}>Inversiones</h1>
      </div>
      <button onClick={abrirNuevo} className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
        <Plus size={16} strokeWidth={3} />
        <span className="hidden sm:inline text-sm font-bold">Nueva cartera</span>
      </button>
    </div>

    {/* Error */}
    {error && (
      <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2"
        style={{
          background: `color-mix(in srgb, ${colores.rose} 10%, transparent)`,
          border: `1px solid color-mix(in srgb, ${colores.rose} 25%, transparent)`,
          color: colores.rose,
        }}>
        <AlertCircle size={14} />{error}
      </div>
    )}

    {/* 2. Resumen Global: KPIs y Meta de Libertad */}
    <div className="space-y-4 mb-8">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Capital total', value: formatCurrency(totalCapital), color: colores.green },
          { label: 'Aportes / mes', value: formatCurrency(totalAportes), color: colores.terra },
          { label: 'Carteras activas', value: `${inversiones.length}`, color: colores.blue },
          { label: 'Total proyectado', value: formatCurrency(totalProyectado), color: colores.violet },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] uppercase tracking-wider font-bold mb-1"
              style={{ color: colores.muted }}>{s.label}</p>
            <p className="text-sm font-black" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {metaLibertad && totalProyectado > 0 && (
        <Card className="animate-enter border-none" style={{ padding: '14px 16px', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target size={13} style={{ color: colores.terra }} />
              <p className="text-[10px] font-black uppercase" style={{ color: 'var(--text-secondary)' }}>
                Progreso Libertad Financiera
              </p>
            </div>
            <p className="text-[10px] font-black" style={{ color: colores.green }}>
              {Math.min(100, (totalProyectado / metaLibertad) * 100).toFixed(1)}%
            </p>
          </div>
          <ProgressBar
            value={Math.min(totalProyectado, metaLibertad)}
            max={metaLibertad}
            color={colores.green}
          />
        </Card>
      )}
    </div>

    {/* 3. Selector de Cartera: Navegación entre inversiones */}
    {inversiones.length > 0 && (
      <div className="mb-4">
        <p className="text-[9px] font-black uppercase mb-2 ml-1" style={{ color: colores.muted }}>
          Seleccionar cartera
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {inversiones.map(inv => (
            <button key={inv.id}
              onClick={() => setSelected(inv)}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-black uppercase transition-all"
              style={{
                background: selected?.id === inv.id ? `color-mix(in srgb, ${inv.color} 12%, var(--bg-card))` : 'var(--bg-secondary)',
                color: selected?.id === inv.id ? inv.color : colores.muted,
                border: selected?.id === inv.id ? `2px solid ${inv.color}` : `1px solid ${colores.border}`,
              }}>
              <span>{inv.emoji}</span>
              <span className="hidden sm:inline">{inv.nombre}</span>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* 4. Detalle de la Cartera Seleccionada */}
    {loading ? (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin" style={{ color: colores.muted }} />
      </div>
    ) : selected && calc ? (
      <div className="space-y-6">
        <Card className="animate-enter" style={{ padding: '16px' }}>
          {/* Cabecera del detalle */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: `${selected.color}18` }}>
                {selected.emoji}
              </div>
              <div>
                <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{selected.nombre}</p>
                <p className="text-[10px]" style={{ color: colores.muted }}>
                  {selected.tasa}% anual · {selected.anos} años
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button onClick={() => abrirEdicion(selected)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-blue-500"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(selected.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-secondary text-rose-500"><Trash2 size={13} /></button>
            </div>
          </div>

          {/* KPIs de la cartera */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Inicial', value: formatCurrency(selected.capital), color: colores.blue },
              { label: 'Final', value: formatCurrency(calc.finalBalance), color: selected.color },
              { label: 'Ganancia', value: formatCurrency(calc.totalInterest), color: colores.terra },
            ].map((k, i) => (
              <div key={i} className="p-2 rounded-xl text-center" style={{ background: 'var(--bg-secondary)' }}>
                <p className="text-[7px] font-black uppercase mb-0.5" style={{ color: colores.muted }}>{k.label}</p>
                <p className="text-[11px] font-black" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Gráfico de Proyección */}
          {historyData.length > 0 && (
            <div className="h-[160px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id={`grad-${selected.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={selected.color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colores.border} opacity={0.5} />
                  <XAxis dataKey="year" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip content={<TooltipConColores />} />
                  <Area type="monotone" dataKey="balance" stroke={selected.color} strokeWidth={2.5} fill={`url(#grad-${selected.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Regla del 4% */}
          <div className="p-3 rounded-xl" style={{ background: `color-mix(in srgb, ${colores.green} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${colores.green} 15%, transparent)` }}>
            <p className="text-[9px] font-black uppercase mb-1" style={{ color: colores.green }}>Retiro mensual estimado</p>
            <p className="text-base font-black" style={{ color: colores.green }}>
              {formatCurrency(calc.finalBalance * 0.04 / 12)}
              <span className="text-[10px] opacity-60 ml-1">/mes</span>
            </p>
          </div>
        </Card>

        {/* 5. Comparativa Final: Todas las carteras de un vistazo */}
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase ml-1" style={{ color: colores.muted }}>
            Resumen de todas las carteras
          </p>
          <Card style={{ padding: '14px 16px' }}>
            <div className="space-y-4">
              {inversiones.map(inv => {
                const c = calcsPorInversion.find(x => x.id === inv.id)?.calc;
                if (!c) return null;
                const pctReal = Math.min(100, Math.round((inv.capital / c.finalBalance) * 100));
                
                return (
                  <div key={inv.id} onClick={() => setSelected(inv)} className="cursor-pointer group">
                    <div className="flex justify-between items-end mb-1.5">
                      <div>
                        <p className="text-xs font-black">{inv.emoji} {inv.nombre}</p>
                        <p className="text-[9px]" style={{ color: colores.muted }}>Actual: {formatCurrency(inv.capital)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black" style={{ color: inv.color }}>{pctReal}% del objetivo</p>
                        <p className="text-[9px]" style={{ color: colores.muted }}>Meta: {formatCurrency(c.finalBalance)}</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full transition-all duration-700" style={{ width: `${pctReal}%`, background: inv.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    ) : (
      <div className="text-center py-20">
        <p className="text-sm mb-4" style={{ color: colores.muted }}>No hay carteras registradas</p>
        <button onClick={abrirNuevo} className="ff-btn-primary">Crear primera cartera</button>
      </div>
    )}

      {/* MODAL CREAR / EDITAR */}
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
            const c = form.color
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
                { val: true, icon: '🔄', title: 'Bola de nieve', desc: 'Reinvierte las ganancias (interés compuesto)' },
                { val: false, icon: '📤', title: 'Sin reinversión', desc: 'Retiras las ganancias cada año' },
              ].map(opt => (
                <button key={String(opt.val)} type="button"
                  onClick={() => setForm(p => ({ ...p, bola_nieve: opt.val }))}
                  className="p-3 rounded-xl text-left transition-all border-2"
                  style={{
                    borderColor: form.bola_nieve === opt.val ? colores.green : colores.border,
                    background: form.bola_nieve === opt.val
                      ? `color-mix(in srgb, ${colores.green} 6%, transparent)`
                      : 'var(--bg-secondary)',
                  }}>
                  <p className="text-base mb-0.5">{opt.icon}</p>
                  <p className="text-[10px] font-black"
                    style={{ color: form.bola_nieve === opt.val ? colores.green : 'var(--text-primary)' }}>
                    {opt.title}
                  </p>
                  <p className="text-[9px]" style={{ color: colores.muted }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Picker de color — reactivo al tema activo */}
          <div>
            <label className="ff-label">Color de la cartera</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {themeColors.map(hex => (
                <button key={hex} type="button"
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
              {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}