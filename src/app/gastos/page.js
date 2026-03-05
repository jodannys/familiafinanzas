'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, ArrowUpRight, ArrowDownRight, Search, Loader2, Trash2, CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const CATS = [
  { value: 'basicos',   label: 'Gastos Básicos' },
  { value: 'deseo',     label: 'Gastos Deseo' },
  { value: 'ahorro',    label: 'Ahorro / Metas' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'deuda',     label: 'Deudas' },
]

const catColor = { basicos: 'sky', deseo: 'violet', ahorro: 'emerald', inversion: 'gold', deuda: 'rose' }

const CAT_BLOQUE = {
  basicos: 'necesidades', deuda: 'necesidades',
  deseo: 'estilo',
  ahorro: 'futuro', inversion: 'futuro',
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
    supabase.from('deudas').select('id, nombre, pendiente, cuota').eq('estado', 'activa').then(({ data }) => setDeudasData(data || []))
    // Solo tarjetas de crédito activas
    supabase.from('deudas').select('id, nombre, emoji, color').eq('tipo_deuda', 'tarjeta').eq('estado', 'activa')
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

    // ── PAGO CON TARJETA: va a deuda_movimientos, NO a movimientos ──────────
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
        // Aumentar el pendiente de la tarjeta
        const tarjetaDeuda = deudasData.find(d => d.id === tarjetaSeleccionada) ||
          await supabase.from('deudas').select('pendiente').eq('id', tarjetaSeleccionada).single().then(r => r.data)
        if (tarjetaDeuda) {
          await supabase.from('deudas').update({ pendiente: (tarjetaDeuda.pendiente || 0) + monto }).eq('id', tarjetaSeleccionada)
        }
        resetModal()
      }
      setSaving(false)
      return
    }

    // ── GASTO NORMAL: va a movimientos ────────────────────────────────────────
    const { data, error } = await supabase.from('movimientos').insert([{ ...form, monto }]).select()

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
          const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
          await supabase.from('deudas').update({ pendiente: nuevoPendiente, estado: nuevoEstado }).eq('id', deudaSeleccionada)
          setDeudasData(prev => prev.map(d => d.id === deudaSeleccionada ? { ...d, pendiente: nuevoPendiente } : d))
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
      // Revertir ahorro
      if (movimiento.categoria === 'ahorro') {
        const meta = metasData.find(m => m.nombre === movimiento.descripcion)
        if (meta) {
          const nuevoActual = Math.max(0, (meta.actual || 0) - movimiento.monto)
          await supabase.from('metas').update({ actual: nuevoActual }).eq('id', meta.id)
          setMetasData(prev => prev.map(m => m.id === meta.id ? { ...m, actual: nuevoActual } : m))
        }
      }

      // Revertir inversión
      if (movimiento.categoria === 'inversion') {
        const inv = inversionesData.find(i => i.nombre === movimiento.descripcion)
        if (inv) {
          const nuevoCapital = Math.max(0, (inv.capital || 0) - movimiento.monto)
          await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', inv.id)
          setInversionesData(prev => prev.map(i => i.id === inv.id ? { ...i, capital: nuevoCapital } : i))
        }
      }

      // Revertir deuda: sube el pendiente y borra el movimiento en deuda_movimientos
      if (movimiento.categoria === 'deuda') {
        // Buscar la deuda por descripción (formato "Cuota NombreDeuda" o "Pago letra: NombreDeuda")
        const { data: todasDeudas } = await supabase
          .from('deudas').select('id, nombre, pendiente, monto, pagadas, estado')
        const deudaMatch = (todasDeudas || []).find(d =>
          movimiento.descripcion?.toLowerCase().includes(d.nombre.toLowerCase())
        )
        if (deudaMatch) {
          const nuevoPendiente = Math.min(
            deudaMatch.monto || deudaMatch.pendiente + movimiento.monto,
            (deudaMatch.pendiente || 0) + movimiento.monto
          )
          const nuevosPagados = Math.max(0, (deudaMatch.pagadas || 0) - 1)
          const nuevoEstado   = nuevoPendiente <= 0 ? 'pagada' : 'activa'

          await supabase.from('deudas').update({
            pendiente: nuevoPendiente,
            pagadas:   nuevosPagados,
            estado:    nuevoEstado,
          }).eq('id', deudaMatch.id)

          // También borrar el movimiento espejo en deuda_movimientos
          await supabase.from('deuda_movimientos').delete()
            .eq('tipo', 'pago')
            .eq('monto', movimiento.monto)
            .ilike('descripcion', `%${deudaMatch.nombre}%`)

          setDeudasData(prev => prev.map(d =>
            d.id === deudaMatch.id ? { ...d, pendiente: nuevoPendiente } : d
          ))
        }
      }

      // Borrar el movimiento principal
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
      color: '#10b981', emoji: '🎯',
    }))
    if (form.categoria === 'inversion') return inversionesData.map(i => ({
      id: `inv_${i.id}`, nombre: i.nombre, monto: i.aporte || 0,
      sub: `Capital: ${formatCurrency(i.capital || 0)}`,
      pct: null, color: '#818CF8', emoji: '📈',
    }))
    return presItems
      .filter(i => i.bloque === CAT_BLOQUE[form.categoria])
      .map(i => ({ id: i.id, nombre: i.nombre, monto: i.monto, sub: null, pct: null, color: '#C17A3A', emoji: '📌' }))
  })() : []

  const movsMes = movs.filter(m => {
    const [year, month] = m.fecha.split('-').map(Number)
    return month - 1 === now.getMonth() && year === now.getFullYear()
  })
  const ingresos = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos  = movsMes.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)

  const filtered = movs
    .filter(m => filtro === 'todos' || m.tipo === filtro || m.categoria === filtro)
    .filter(m => !search || m.descripcion.toLowerCase().includes(search.toLowerCase()))

  const usandoTarjeta = form.tipo === 'egreso' && tarjetaSeleccionada

  return (
    <AppShell>
      <div className="mb-6 animate-enter px-1">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Módulo</p>
            <h1 className="text-xl font-black text-stone-800 tracking-tight leading-tight">Ingresos & Egresos</h1>
          </div>
          <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center justify-center gap-2">
            <Plus size={18} strokeWidth={3} />
            <span className="hidden sm:inline">Nuevo registro</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-xs font-semibold bg-rose-50 border border-rose-100 text-rose-600">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Ingresos del mes', value: formatCurrency(ingresos), color: '#10b981' },
          { label: 'Egresos del mes',  value: formatCurrency(egresos),  color: '#fb7185' },
          { label: 'Balance', value: formatCurrency(ingresos - egresos), color: ingresos - egresos >= 0 ? '#10b981' : '#fb7185' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-4 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[10px] text-stone-400 uppercase tracking-wider font-bold mb-1">{s.label}</p>
            <p className="text-xl font-black" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <div className="relative w-full">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" style={{ zIndex: 10 }} />
          <input className="ff-input w-full h-12" style={{ paddingLeft: '3.5rem' }}
            placeholder="Buscar movimiento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[{ v: 'todos', l: 'Todos' }, { v: 'ingreso', l: 'Ingresos' }, { v: 'egreso', l: 'Egresos' }].map(f => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border"
              style={{
                background: filtro === f.v ? 'rgba(45,122,95,0.1)' : 'transparent',
                color: filtro === f.v ? '#2D7A5F' : '#78716c',
                borderColor: filtro === f.v ? 'rgba(45,122,95,0.2)' : 'transparent',
              }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-3 opacity-50">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><p className="text-stone-400 text-sm italic">No hay registros</p></div>
        ) : (
          <div className="divide-y divide-stone-50">
            {filtered.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-3 py-4 hover:bg-stone-50 transition-colors group"
                style={{ animationDelay: `${i * 0.02}s` }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.tipo === 'ingreso' ? 'bg-emerald-50 text-emerald-500' : 'bg-rose-50 text-rose-500'}`}>
                  {m.tipo === 'ingreso' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-stone-800 truncate leading-tight">{m.descripcion}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">{m.quien}</span>
                    <Badge color={catColor[m.categoria] || 'slate'}>{m.categoria}</Badge>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                  <p className="text-sm font-black tabular-nums" style={{ color: m.tipo === 'ingreso' ? '#10b981' : '#fb7185' }}>
                    {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                  </p>
                  <button onClick={() => handleDelete(m)} className="p-1 text-stone-300 hover:text-rose-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={resetModal} title="Nuevo Movimiento">
        <form onSubmit={handleAdd} className="space-y-4">

          {/* Tipo toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl">
            {['ingreso', 'egreso'].map(t => (
              <button type="button" key={t}
                onClick={() => { setForm({ ...form, tipo: t }); setTarjetaSeleccionada('') }}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${form.tipo === t ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400'}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Categoría + Quién */}
          <div className="grid grid-cols-2 gap-3">
            {form.tipo === 'egreso' && (
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Categoría</label>
                <select className="ff-input h-12 text-sm" value={form.categoria}
                  onChange={e => { setForm({ ...form, categoria: e.target.value }); setTarjetaSeleccionada('') }}>
                  {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">¿Quién?</label>
              <select className="ff-input h-12 text-sm" value={form.quien}
                onChange={e => setForm({ ...form, quien: e.target.value })}>
                <option value="Jodannys">Jodannys</option>
                <option value="Rolando">Rolando</option>
                <option value="Ambos">Ambos</option>
              </select>
            </div>
          </div>

          {/* ── TARJETA DE CRÉDITO: solo para egresos que no son pago de deuda ── */}
          {form.tipo === 'egreso' && form.categoria !== 'deuda' && tarjetasData.length > 0 && (
            <div className="space-y-1 animate-enter">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1 flex items-center gap-1.5">
                <CreditCard size={11} /> ¿Pagado con tarjeta? (opcional)
              </label>
              <select className="ff-input h-12 text-sm" value={tarjetaSeleccionada}
                onChange={e => setTarjetaSeleccionada(e.target.value)}>
                <option value="">— No, pago directo —</option>
                {tarjetasData.map(t => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.nombre}</option>
                ))}
              </select>
              {tarjetaSeleccionada && (
                <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                  style={{ background: 'rgba(129,140,248,0.08)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.2)' }}>
                  💳 Este gasto se acumulará en la tarjeta. No restará del presupuesto hasta que pagues la tarjeta.
                </div>
              )}
            </div>
          )}

          {/* Sugerencias — solo si NO usa tarjeta */}
          {!usandoTarjeta && sugerenciasRicas.length > 0 && (
            <div className="animate-enter">
              <p className="text-[10px] font-black uppercase text-stone-400 mb-2 ml-1">Sugerencias del presupuesto</p>
              <div className="grid grid-cols-2 gap-2">
                {sugerenciasRicas.map(item => (
                  <button type="button" key={item.id}
                    onClick={() => aplicarSugerencia({ ...item, nombre: `${item.emoji} ${item.nombre}` })}
                    className="text-left p-3 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95"
                    style={{ background: `${item.color}08`, borderColor: `${item.color}25` }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-base leading-none">{item.emoji}</span>
                      <p className="text-[10px] font-black text-stone-700 truncate leading-tight">{item.nombre}</p>
                    </div>
                    {item.monto > 0 && (
                      <p className="text-sm font-black mb-1" style={{ color: item.color }}>{formatCurrency(item.monto)}</p>
                    )}
                    {item.sub && <p className="text-[9px] text-stone-400 truncate mb-1">{item.sub}</p>}
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
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Añadir a meta</label>
              <select className="ff-input h-12 text-sm" value={metaSeleccionada} onChange={e => setMetaSeleccionada(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {metasData.map(m => <option key={m.id} value={m.id}>{m.nombre} ({formatCurrency(m.actual || 0)} / {formatCurrency(m.meta)})</option>)}
              </select>
            </div>
          )}

          {/* Selector inversión */}
          {!usandoTarjeta && form.tipo === 'egreso' && form.categoria === 'inversion' && inversionesData.length > 0 && (
            <div className="space-y-1 animate-enter">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Añadir a inversión</label>
              <select className="ff-input h-12 text-sm" value={metaSeleccionada} onChange={e => setMetaSeleccionada(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {inversionesData.map(i => <option key={i.id} value={`inv_${i.id}`}>{i.nombre} (Capital: {formatCurrency(i.capital)})</option>)}
              </select>
            </div>
          )}

          {/* Selector deuda */}
          {form.tipo === 'egreso' && form.categoria === 'deuda' && deudasData.length > 0 && (
            <div className="space-y-1 animate-enter">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">¿Qué deuda pagas?</label>
              <select className="ff-input h-12 text-sm" value={deudaSeleccionada}
                onChange={e => {
                  setDeudaSeleccionada(e.target.value)
                  const d = deudasData.find(d => d.id === e.target.value)
                  if (d) setForm(prev => ({ ...prev, descripcion: `Pago ${d.nombre}`, monto: d.cuota?.toString() || '' }))
                }}>
                <option value="">— Seleccionar deuda —</option>
                {deudasData.map(d => <option key={d.id} value={d.id}>{d.nombre} · Pendiente {formatCurrency(d.pendiente)}</option>)}
              </select>
            </div>
          )}

          {/* Descripción */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Descripción</label>
            <input className="ff-input h-12 text-sm font-medium" placeholder="Ej: Sueldo, Alquiler..." required
              value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>

          {/* Monto + Fecha */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Monto (€)</label>
              <input className="ff-input h-12 text-sm font-black" type="number" step="0.01" placeholder="0.00" required
                style={{ color: '#C17A3A' }} value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-stone-400 ml-1">Fecha</label>
              <input className="ff-input h-12 text-sm font-medium" type="date" required
                value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="ff-btn-primary w-full h-14 text-sm font-black shadow-lg flex items-center justify-center gap-2"
            style={{ background: usandoTarjeta ? '#818CF8' : '#C17A3A' }}>
            {saving ? <Loader2 size={20} className="animate-spin" /> : usandoTarjeta ? '💳 Cargar a tarjeta' : 'CONFIRMAR'}
          </button>
        </form>
      </Modal>
    </AppShell>
  )
}