'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, ArrowUpRight, ArrowDownRight, Search, Loader2, Trash2, CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const CATS = [
  { value: 'basicos', label: 'Gastos Básicos' },
  { value: 'deseo', label: 'Gastos Deseo' },
  { value: 'ahorro', label: 'Ahorro / Metas' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'deuda', label: 'Deudas' },
]

const catColor = { basicos: 'sky', deseo: 'violet', ahorro: 'emerald', inversion: 'gold', deuda: 'rose' }

const CAT_BLOQUE = {
  basicos: 'necesidades', deuda: 'necesidades',
  deseo: 'estilo',
  ahorro: 'futuro', inversion: 'futuro',
}

// Mapa de colores de categoría a variables CSS del tema
const CAT_CSS_COLOR = {
  basicos: 'var(--accent-blue)',
  deseo: 'var(--accent-terra)',
  ahorro: 'var(--accent-green)',
  inversion: 'var(--accent-terra)',
  deuda: 'var(--accent-rose)',
}

export default function GastosPage() {
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [presItems, setPresItems] = useState([])
  const [metasData, setMetasData] = useState([])
  const [inversionesData, setInversionesData] = useState([])
  const [deudasData, setDeudasData] = useState([])
  const [tarjetasData, setTarjetasData] = useState([])
  const [metaSeleccionada, setMetaSeleccionada] = useState('')
  const [deudaSeleccionada, setDeudaSeleccionada] = useState('')
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState('')
  const [form, setForm] = useState({
    tipo: 'egreso', monto: '', descripcion: '',
    categoria: 'basicos', fecha: new Date().toISOString().slice(0, 10), quien: 'Jodannys'
  })

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => {
    cargarMovimientos()
    cargarPresupuesto()
    supabase.from('metas').select('id, nombre, meta, actual').then(({ data }) => setMetasData(data || []))
    supabase.from('inversiones').select('id, nombre, capital, aporte').then(({ data }) => setInversionesData(data || []))
    supabase.from('deudas').select('id, nombre, pendiente, cuota, pagadas, tipo_deuda').eq('estado', 'activa').then(({ data }) => setDeudasData(data || []))
    supabase.from('deudas').select('id, nombre, emoji, pendiente').eq('tipo_deuda', 'tarjeta').eq('estado', 'activa')
      .then(({ data }) => setTarjetasData(data || []))
  }, [])

  async function cargarMovimientos() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.from('movimientos').select('*').order('fecha', { ascending: false })
    if (error) setError('Error al cargar movimientos: ' + error.message)
    else setMovs(data || [])
    setLoading(false)
  }

  async function cargarPresupuesto() {
    const { data } = await supabase.from('presupuesto_items').select('*')
      .eq('mes', now.getMonth() + 1).eq('año', now.getFullYear())
    setPresItems(data || [])
  }

  function resetModal() {
    setModal(false)
    setTarjetaSeleccionada('')
    setMetaSeleccionada('')
    setDeudaSeleccionada('')
    setForm({ tipo: 'egreso', monto: '', descripcion: '', categoria: 'basicos', fecha: new Date().toISOString().slice(0, 10), quien: 'Jodannys' })
  }

  async function handleAdd(e) {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!monto || monto <= 0) return
    setSaving(true)

    if (tarjetaSeleccionada && form.tipo === 'egreso') {
      const tarjeta = tarjetasData.find(t => t.id === tarjetaSeleccionada)
      const { error } = await supabase.from('deuda_movimientos').insert([{
        deuda_id: tarjetaSeleccionada,
        tipo: 'cargo',
        descripcion: form.descripcion,
        monto,
        fecha: form.fecha,
        mes, año,
      }])
      if (error) setError('Error al guardar cargo en tarjeta: ' + error.message)
      else {
        if (tarjeta) {
          await supabase.from('deudas').update({
            pendiente: parseFloat(tarjeta.pendiente || 0) + monto
          }).eq('id', tarjetaSeleccionada)
        }
        resetModal()
      }
      setSaving(false)
      return
    }

    const deudaId = form.categoria === 'deuda' && deudaSeleccionada ? deudaSeleccionada : null
    const payloadMov = deudaId ? { ...form, monto, deuda_id: deudaId } : { ...form, monto }

    const { data, error } = await supabase.from('movimientos').insert([payloadMov]).select()

    if (error) {
      setError('Error al guardar: ' + error.message)
    } else {
      setMovs(prev => [data[0], ...prev])

      if (form.categoria === 'ahorro' && metaSeleccionada) {
        const meta = metasData.find(m => m.id === metaSeleccionada)
        if (meta) {
          const nuevoActual = (meta.actual || 0) + monto
          await supabase.from('metas').update({ actual: nuevoActual }).eq('id', metaSeleccionada)
          setMetasData(prev => prev.map(m => m.id === metaSeleccionada ? { ...m, actual: nuevoActual } : m))
        }
        setMetaSeleccionada('')
      }

      if (form.categoria === 'inversion' && metaSeleccionada?.startsWith('inv_')) {
        const invId = metaSeleccionada.replace('inv_', '')
        const inv = inversionesData.find(i => i.id === invId)
        if (inv) {
          const nuevoCapital = (inv.capital || 0) + monto
          await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', invId)
          setInversionesData(prev => prev.map(i => i.id === invId ? { ...i, capital: nuevoCapital } : i))
        }
        setMetaSeleccionada('')
      }

      if (form.categoria === 'deuda' && deudaSeleccionada) {
        const deuda = deudasData.find(d => d.id === deudaSeleccionada)
        if (deuda) {
          const nuevoPendiente = Math.max(0, (deuda.pendiente || 0) - monto)
          const nuevosPagados = (deuda.pagadas || 0) + 1
          const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

          await supabase.from('deudas').update({
            pendiente: nuevoPendiente,
            pagadas: nuevosPagados,
            estado: nuevoEstado,
          }).eq('id', deudaSeleccionada)

          await supabase.from('deuda_movimientos').insert([{
            deuda_id: deudaSeleccionada,
            tipo: 'pago',
            descripcion: form.descripcion,
            monto,
            fecha: form.fecha,
            mes,
            año,
          }])

          setDeudasData(prev => prev.map(d =>
            d.id === deudaSeleccionada ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados } : d
          ))
        }
        setDeudaSeleccionada('')
      }

      resetModal()
    }
    setSaving(false)
  }

  async function handleDelete(movimiento) {
    if (!confirm(`¿Eliminar "${movimiento.descripcion}"?`)) return
    try {
      if (movimiento.categoria === 'ahorro') {
        const meta = metasData.find(m => m.nombre === movimiento.descripcion)
        if (meta) {
          const nuevoActual = Math.max(0, (meta.actual || 0) - movimiento.monto)
          await supabase.from('metas').update({ actual: nuevoActual }).eq('id', meta.id)
          setMetasData(prev => prev.map(m => m.id === meta.id ? { ...m, actual: nuevoActual } : m))
        }
      }

      if (movimiento.categoria === 'inversion') {
        const inv = inversionesData.find(i => i.nombre === movimiento.descripcion)
        if (inv) {
          const nuevoCapital = Math.max(0, (inv.capital || 0) - movimiento.monto)
          await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', inv.id)
          setInversionesData(prev => prev.map(i => i.id === inv.id ? { ...i, capital: nuevoCapital } : i))
        }
      }

      if (movimiento.categoria === 'deuda') {
        const deudaId = movimiento.deuda_id
        if (deudaId) {
          const { data: deudaData } = await supabase
            .from('deudas').select('id, pendiente, monto, pagadas, estado')
            .eq('id', deudaId).single()

          if (deudaData) {
            const nuevoPendiente = Math.min(
              deudaData.monto || (deudaData.pendiente + movimiento.monto),
              (deudaData.pendiente || 0) + movimiento.monto
            )
            const nuevosPagados = Math.max(0, (deudaData.pagadas || 0) - 1)
            const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

            await supabase.from('deudas').update({
              pendiente: nuevoPendiente,
              pagadas: nuevosPagados,
              estado: nuevoEstado,
            }).eq('id', deudaId)

            await supabase.from('deuda_movimientos').delete()
              .eq('deuda_id', deudaId)
              .eq('tipo', 'pago')
              .eq('monto', movimiento.monto)
              .eq('fecha', movimiento.fecha)

            setDeudasData(prev => prev.map(d =>
              d.id === deudaId ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados } : d
            ))
          }
        }
      }

      const { error } = await supabase.from('movimientos').delete().eq('id', movimiento.id)
      if (!error) setMovs(prev => prev.filter(m => m.id !== movimiento.id))
      else alert('Error al borrar: ' + error.message)
    } catch (err) {
      console.error('Error en borrado:', err)
    }
  }

  function aplicarSugerencia(item) {
    const nombre = item.nombre.replace(/^[\p{Emoji}\s]+/u, '').trim()
    setForm(prev => ({ ...prev, descripcion: nombre, monto: item.monto ? item.monto.toString() : '' }))
    const metaMatch = metasData.find(m => m.nombre.toLowerCase() === nombre.toLowerCase())
    if (metaMatch) setMetaSeleccionada(metaMatch.id)
    const invMatch = inversionesData.find(i => i.nombre.toLowerCase() === nombre.toLowerCase())
    if (invMatch) setMetaSeleccionada(`inv_${invMatch.id}`)
  }

  const sugerenciasRicas = form.tipo === 'egreso' ? (() => {
    if (form.categoria === 'deuda') return []
    if (form.categoria === 'ahorro') return metasData.map(m => ({
      id: m.id, nombre: m.nombre, monto: 0,
      sub: `${formatCurrency(m.actual || 0)} / ${formatCurrency(m.meta)}`,
      pct: Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100)),
      color: 'var(--accent-green)', emoji: '🎯',
    }))
    if (form.categoria === 'inversion') return inversionesData.map(i => ({
      id: `inv_${i.id}`, nombre: i.nombre, monto: i.aporte || 0,
      sub: `Capital: ${formatCurrency(i.capital || 0)}`,
      pct: null, color: 'var(--accent-terra)', emoji: '📈',
    }))
    return presItems
      .filter(i => i.bloque === CAT_BLOQUE[form.categoria])
      .map(i => ({ id: i.id, nombre: i.nombre, monto: i.monto, sub: null, pct: null, color: 'var(--accent-terra)', emoji: '📌' }))
  })() : []

  const movsMes = movs.filter(m => {
    const [year, month] = m.fecha.split('-').map(Number)
    return month - 1 === now.getMonth() && year === now.getFullYear()
  })
  const ingresos = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos = movsMes.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)

  const filtered = movs
    .filter(m => filtro === 'todos' || m.tipo === filtro || m.categoria === filtro)
    .filter(m => !search || m.descripcion.toLowerCase().includes(search.toLowerCase()))

  const usandoTarjeta = form.tipo === 'egreso' && tarjetaSeleccionada

  return (
    <AppShell>
      {/* ── HEADER ── */}
      <div className="mb-5 animate-enter px-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>Módulo</p>
            <h1 className="text-lg font-black tracking-tight leading-tight" style={{ color: "var(--text-primary)" }}>Ingresos & Egresos</h1>
          </div>
          <button
            onClick={() => setModal(true)}
            className="ff-btn-primary flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black"
          >
            <Plus size={16} strokeWidth={3} />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--accent-rose) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)", color: "var(--accent-rose)" }}>{error}</div>
      )}

      {/* ── STATS: horizontal scroll en móvil, 3 cols en tablet ── */}
      <div className="flex gap-3 mb-5 overflow-x-auto no-scrollbar pb-1">
        {[
          { label: 'Ingresos', value: formatCurrency(ingresos), color: 'var(--accent-green)', icon: '↑' },
          { label: 'Egresos', value: formatCurrency(egresos), color: 'var(--accent-rose)', icon: '↓' },
          { label: 'Balance', value: formatCurrency(ingresos - egresos), color: ingresos - egresos >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', icon: '=' },
        ].map((s, i) => (
          <div
            key={i}
            className="glass-card p-4 animate-enter flex-shrink-0"
            style={{ animationDelay: `${i * 0.05}s`, minWidth: '120px', flex: '1 1 0' }}
          >
            <p className="text-[9px] uppercase tracking-wider font-bold mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            <p className="text-base font-black leading-tight" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── BÚSQUEDA + FILTROS ── */}
      <div className="flex flex-col gap-2 mb-5">
        <div className="relative w-full">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)", zIndex: 10 }} />
          <input
            className="ff-input w-full h-11"
            style={{ paddingLeft: '2.75rem', fontSize: '14px' }}
            placeholder="Buscar movimiento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[{ v: 'todos', l: 'Todos' }, { v: 'ingreso', l: 'Ingresos' }, { v: 'egreso', l: 'Egresos' }].map(f => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border flex-shrink-0"
              style={{
                background: filtro === f.v ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'transparent',
                color: filtro === f.v ? 'var(--accent-green)' : 'var(--text-muted)',
                borderColor: filtro === f.v ? 'color-mix(in srgb, var(--accent-green) 25%, transparent)' : 'transparent',
              }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── LISTA DE MOVIMIENTOS ── */}
      <Card className="overflow-hidden border-none shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 opacity-50">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm italic" style={{ color: "var(--text-muted)" }}>No hay registros</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-glass)" }}>
            {filtered.map((m, i) => (
              <div
                key={m.id}
                className="flex items-center gap-3 px-3 py-3.5 transition-colors group"
                style={{ animationDelay: `${i * 0.02}s` }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg-secondary)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                {/* Icono tipo */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: m.tipo === 'ingreso'
                      ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)'
                      : 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
                    color: m.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--accent-rose)',
                  }}
                >
                  {m.tipo === 'ingreso' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  
                </div>

                {/* Descripción + meta info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                    {m.descripcion}
                  </p>
                  {/* Fila secundaria: fecha + quien + categoria */}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                    <span style={{ color: "var(--border-glass)" }}></span>
                    {m.tipo === 'egreso' && m.categoria && (
                      <>
                        <span style={{ color: "var(--border-glass)" }}></span>
                        <span
                          className="text-[9px] font-black uppercase tracking-tight px-1.5 py-0.5 rounded-md"
                          style={{
                            background: `color-mix(in srgb, ${CAT_CSS_COLOR[m.categoria] ?? 'var(--text-muted)'} 12%, transparent)`,
                            color: CAT_CSS_COLOR[m.categoria] ?? 'var(--text-muted)',
                          }}
                        >
                          {m.categoria}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Monto + borrar */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <p
                    className="text-sm font-black tabular-nums"
                    style={{ color: m.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--accent-rose)' }}
                  >
                    {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                  </p>
                  <button
                    onClick={() => handleDelete(m)}
                    className="p-2 rounded-xl transition-all opacity-40 active:opacity-100"
                    style={{ color: "var(--text-muted)", background: "var(--bg-secondary)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── MODAL ── */}
      <Modal open={modal} onClose={resetModal} title="Nuevo Movimiento">
        {/* max-h y scroll dentro del modal para que no se salga en móvil */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 160px)' }}>
          <form onSubmit={handleAdd} className="space-y-4 px-1 pb-4">

            {/* Tipo toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl" style={{ background: "var(--bg-secondary)" }}>
              {['ingreso', 'egreso'].map(t => (
                <button type="button" key={t}
                  onClick={() => { setForm({ ...form, tipo: t }); setTarjetaSeleccionada('') }}
                  className="py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  style={{
                    background: form.tipo === t ? 'var(--bg-card)' : 'transparent',
                    color: form.tipo === t ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: form.tipo === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Categoría + Quién — en móvil van en columna si es egreso */}
            <div className={`grid gap-3 ${form.tipo === 'egreso' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {form.tipo === 'egreso' && (
                <div className="space-y-1">
                  <label className="ff-label">Categoría</label>
                  <select className="ff-input w-full h-11 text-sm" value={form.categoria}
                    onChange={e => { setForm({ ...form, categoria: e.target.value }); setTarjetaSeleccionada('') }}>
                    {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="ff-label">¿Quién?</label>
                <select className="ff-input w-full h-11 text-sm" value={form.quien}
                  onChange={e => setForm({ ...form, quien: e.target.value })}>
                  <option value="Jodannys">Jodannys</option>
                  <option value="Rolando">Rolando</option>
                  <option value="Ambos">Ambos</option>
                </select>
              </div>
            </div>

            {/* Tarjeta de crédito */}
            {form.tipo === 'egreso' && form.categoria !== 'deuda' && tarjetasData.length > 0 && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label flex items-center gap-1.5">
                  <CreditCard size={11} /> ¿Pagado con tarjeta? (opcional)
                </label>
                <select className="ff-input w-full h-11 text-sm" value={tarjetaSeleccionada}
                  onChange={e => setTarjetaSeleccionada(e.target.value)}>
                  <option value="">— No, pago directo —</option>
                  {tarjetasData.map(t => (
                    <option key={t.id} value={t.id}>{t.emoji} {t.nombre}</option>
                  ))}
                </select>
                {tarjetaSeleccionada && (
                  <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                    style={{ background: 'color-mix(in srgb, var(--accent-terra) 8%, transparent)', color: 'var(--accent-terra)', border: '1px solid color-mix(in srgb, var(--accent-terra) 20%, transparent)' }}>
                    💳 Este gasto se acumulará en la tarjeta. No restará del presupuesto hasta que pagues la tarjeta.
                  </div>
                )}
              </div>
            )}

            {/* Sugerencias */}
            {!usandoTarjeta && sugerenciasRicas.length > 0 && (
              <div className="animate-enter">
                <p className="text-[10px] font-black uppercase mb-2 ml-1" style={{ color: "var(--text-muted)" }}>Sugerencias del presupuesto</p>
                <div className="grid grid-cols-2 gap-2">
                  {sugerenciasRicas.map(item => (
                    <button type="button" key={item.id}
                      onClick={() => aplicarSugerencia({ ...item, nombre: `${item.emoji} ${item.nombre}` })}
                      className="text-left p-3 rounded-2xl border transition-all active:scale-95"
                      style={{ background: `color-mix(in srgb, ${item.color} 8%, transparent)`, borderColor: `color-mix(in srgb, ${item.color} 20%, transparent)` }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm leading-none">{item.emoji}</span>
                        <p className="text-[10px] font-black truncate leading-tight" style={{ color: "var(--text-secondary)" }}>{item.nombre}</p>
                      </div>
                      {item.monto > 0 && (
                        <p className="text-sm font-black mb-1" style={{ color: item.color }}>{formatCurrency(item.monto)}</p>
                      )}
                      {item.sub && <p className="text-[9px] truncate mb-1" style={{ color: "var(--text-muted)" }}>{item.sub}</p>}
                      {item.pct !== null && (
                        <div className="w-full h-1 rounded-full mt-1" style={{ background: 'var(--progress-track)' }}>
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selector meta */}
            {!usandoTarjeta && form.tipo === 'egreso' && form.categoria === 'ahorro' && metasData.length > 0 && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label">Añadir a meta</label>
                <select className="ff-input w-full h-11 text-sm" value={metaSeleccionada} onChange={e => setMetaSeleccionada(e.target.value)}>
                  <option value="">— Sin asignar —</option>
                  {metasData.map(m => <option key={m.id} value={m.id}>{m.nombre} ({formatCurrency(m.actual || 0)} / {formatCurrency(m.meta)})</option>)}
                </select>
              </div>
            )}

            {/* Selector inversión */}
            {!usandoTarjeta && form.tipo === 'egreso' && form.categoria === 'inversion' && inversionesData.length > 0 && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label">Añadir a inversión</label>
                <select className="ff-input w-full h-11 text-sm" value={metaSeleccionada} onChange={e => setMetaSeleccionada(e.target.value)}>
                  <option value="">— Sin asignar —</option>
                  {inversionesData.map(i => <option key={i.id} value={`inv_${i.id}`}>{i.nombre} (Capital: {formatCurrency(i.capital)})</option>)}
                </select>
              </div>
            )}

            {/* Selector deuda */}
            {form.tipo === 'egreso' && form.categoria === 'deuda' && deudasData.length > 0 && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label">¿Qué deuda pagas?</label>
                <select className="ff-input w-full h-11 text-sm" value={deudaSeleccionada}
                  onChange={e => {
                    setDeudaSeleccionada(e.target.value)
                    const d = deudasData.find(d => d.id === e.target.value)
                    if (d) setForm(prev => ({ ...prev, descripcion: `Pago ${d.nombre}`, monto: d.cuota?.toString() || '' }))
                  }}>
                  <option value="">— Seleccionar deuda —</option>
                  {deudasData
                    .filter(d => d.tipo_deuda !== 'tarjeta')
                    .map(d => <option key={d.id} value={d.id}>{d.nombre} · Pendiente {formatCurrency(d.pendiente)}</option>)}
                </select>
              </div>
            )}

            {/* Descripción */}
            <div className="space-y-1">
              <label className="ff-label">Descripción</label>
              <input
                className="ff-input h-11 text-sm font-medium"
                placeholder="Ej: Sueldo, Alquiler..."
                required
                value={form.descripcion}
                onChange={e => setForm({ ...form, descripcion: e.target.value })}
              />
            </div>

            {/* Monto + Fecha: en móvil columna, en sm grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="ff-label">Monto (€)</label>
                <input
                  className="ff-input w-full h-11 text-sm font-black"
                  type="number" step="0.01" placeholder="0.00" required
                  style={{ color: 'var(--accent-terra)' }}
                  value={form.monto}
                  onChange={e => setForm({ ...form, monto: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="ff-label">Fecha</label>
                <input
                  className="ff-input w-full h-11 text-sm font-medium"
                  type="date" required
                  value={form.fecha}
                  onChange={e => setForm({ ...form, fecha: e.target.value })}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="ff-btn-primary w-full h-13 text-sm font-black shadow-lg flex items-center justify-center gap-2"
              style={{
                height: '52px',
                background: usandoTarjeta ? 'var(--accent-terra)' : 'var(--accent-terra)',
                borderRadius: '14px',
              }}
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : usandoTarjeta ? '💳 Cargar a tarjeta' : 'CONFIRMAR'}
            </button>
          </form>
        </div>
      </Modal>
    </AppShell>
  )
}