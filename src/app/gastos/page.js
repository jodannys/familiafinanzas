'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, ArrowUpRight, ArrowDownRight, Search, Loader2, Trash2, CreditCard } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { useTheme, getThemeColors } from '@/lib/themes'

const CATS = [
  { value: 'basicos', label: 'Gastos Básicos' },
  { value: 'deseo', label: 'Gastos Deseo' },
  { value: 'ahorro', label: 'Ahorro / Metas' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'deuda', label: 'Deudas' },
]

const CAT_BLOQUE = {
  basicos: 'necesidades', deuda: 'necesidades',
  deseo: 'estilo',
  ahorro: 'futuro', inversion: 'futuro',
}
function fechaHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export default function GastosPage() {
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)

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
  const [tarjetaDeudasMap, setTarjetaDeudasMap] = useState({})
  const [metaSeleccionada, setMetaSeleccionada] = useState('')
  const [deudaSeleccionada, setDeudaSeleccionada] = useState('')
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState('')
  const [presupuesto, setPresupuesto] = useState(null)
  const [colores, setColores] = useState({})
  const [subcategorias, setSubcategorias] = useState([])
  const [categoriasCfg, setCategoriasCfg] = useState([])
  const [form, setForm] = useState({
    tipo: 'egreso', monto: '', descripcion: '',
    categoria: 'basicos', fecha: fechaHoy(), quien: 'Jodannys',
    subcategoria_id: '',
  })
  const [hayMas, setHayMas] = useState(false)
  const LIMITE_INICIAL = 100

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

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
        gold: v('--accent-gold'),
        main: v('--accent-main'),
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

  const CAT_COLOR_VAR = {
    basicos: colores.blue,
    deseo: colores.violet,
    ahorro: colores.green,
    inversion: colores.gold,
    deuda: colores.rose,
  }

  useEffect(() => {
    getPresupuestoMes().then(setPresupuesto)
    cargarMovimientos()
    cargarPresupuesto()
    supabase.from('categorias').select('*').order('bloque').order('nombre').then(({ data }) => setCategoriasCfg(data || []))
    supabase.from('subcategorias').select('*').order('orden').order('nombre').then(({ data }) => setSubcategorias(data || []))
    supabase.from('metas').select('id, nombre, meta, actual, pct_mensual').then(({ data }) => setMetasData(data || []))
    supabase.from('inversiones').select('id, nombre, capital, aporte').then(({ data }) => setInversionesData(data || []))
    supabase.from('deudas').select('id, nombre, pendiente, cuota, pagadas, tipo_deuda').eq('estado', 'activa').then(({ data }) => setDeudasData(data || []))
    supabase.from('perfiles_tarjetas').select('id, nombre_tarjeta, banco, color').eq('estado', 'activa')
      .then(({ data }) => setTarjetasData(data || []))
    supabase.from('deudas').select('id, perfil_tarjeta_id, pendiente').eq('tipo_deuda', 'tarjeta').eq('estado', 'activa')
      .then(({ data }) => {
        const map = {}
          ; (data || []).forEach(d => { if (d.perfil_tarjeta_id) map[d.perfil_tarjeta_id] = d })
        setTarjetaDeudasMap(map)
      })
  }, [])

  async function cargarMovimientos(cargarTodos = false) {
    setLoading(true)
    setError(null)
    // BUG FIX: paginación — carga los últimos LIMITE_INICIAL registros por defecto
    const query = supabase.from('movimientos').select('*').order('fecha', { ascending: false })
    const { data, error } = cargarTodos ? await query : await query.limit(LIMITE_INICIAL + 1)
    if (error) {
      setError('Error al cargar movimientos: ' + error.message)
    } else {
      if (!cargarTodos && data && data.length > LIMITE_INICIAL) {
        setMovs(data.slice(0, LIMITE_INICIAL))
        setHayMas(true)
      } else {
        setMovs(data || [])
        setHayMas(false)
      }
    }
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
    setForm({ tipo: 'egreso', monto: '', descripcion: '', categoria: 'basicos', fecha: fechaHoy(), quien: 'Jodannys', subcategoria_id: '' })
  }


  async function handleAdd(e) {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!monto || monto <= 0) return
    setSaving(true)

    // ── Tarjeta de crédito ────────────────────────────────────────────────────
    if (tarjetaSeleccionada && form.tipo === 'egreso') {
      const deudaTarjeta = tarjetaDeudasMap[tarjetaSeleccionada]
      if (!deudaTarjeta) {
        setError('Esta tarjeta no tiene una deuda activa asociada. Créala primero en el módulo Deudas.')
        setSaving(false)
        return
      }
      const { error } = await supabase.from('deuda_movimientos').insert([{
        deuda_id: deudaTarjeta.id,
        tipo: 'cargo',
        descripcion: form.descripcion,
        monto,
        fecha: form.fecha,
        mes, año,
      }])
      if (error) setError('Error al guardar cargo en tarjeta: ' + error.message)
      else {
        await supabase.from('deudas').update({
          pendiente: parseFloat(deudaTarjeta.pendiente || 0) + monto
        }).eq('id', deudaTarjeta.id)
        setTarjetaDeudasMap(prev => ({
          ...prev,
          [tarjetaSeleccionada]: { ...deudaTarjeta, pendiente: deudaTarjeta.pendiente + monto }
        }))
        resetModal()
      }
      setSaving(false)
      return
    }

    // ── Movimiento normal ─────────────────────────────────────────────────────
    const deudaId = form.categoria === 'deuda' && deudaSeleccionada ? deudaSeleccionada : null

    // FIX 2: guardar meta_id e inversion_id en el payload para poder revertir correctamente al eliminar
    const metaId = form.categoria === 'ahorro' && metaSeleccionada ? metaSeleccionada : null
    const invId = form.categoria === 'inversion' && metaSeleccionada?.startsWith('inv_')
      ? metaSeleccionada.replace('inv_', '')
      : null

    const payloadMov = {
      tipo: form.tipo,
      monto,
      descripcion: form.descripcion,
      categoria: form.categoria,
      fecha: form.fecha,
      quien: form.quien,
      ...(deudaId && { deuda_id: deudaId }),
      ...(metaId && { meta_id: metaId }),
      ...(invId && { inversion_id: invId }),
      ...(form.subcategoria_id && { subcategoria_id: form.subcategoria_id }),
    }

    const { data, error } = await supabase.from('movimientos').insert([payloadMov]).select()

    if (error) {
      setError('Error al guardar: ' + error.message)
      setSaving(false)
      return
    }

    setMovs(prev => [data[0], ...prev])

    // ── Actualizar meta ───────────────────────────────────────────────────────
    if (metaId) {
      const meta = metasData.find(m => m.id === metaId)
      if (meta) {
        const nuevoActual = (meta.actual || 0) + monto
        await supabase.from('metas').update({ actual: nuevoActual }).eq('id', metaId)
        setMetasData(prev => prev.map(m => m.id === metaId ? { ...m, actual: nuevoActual } : m))
      }
      setMetaSeleccionada('')
    }

    // ── Actualizar inversión ──────────────────────────────────────────────────
    if (invId) {
      const inv = inversionesData.find(i => i.id === invId)
      if (inv) {
        const nuevoCapital = (inv.capital || 0) + monto
        await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', invId)
        setInversionesData(prev => prev.map(i => i.id === invId ? { ...i, capital: nuevoCapital } : i))
      }
      setMetaSeleccionada('')
    }

    // ── Actualizar deuda ──────────────────────────────────────────────────────
    if (deudaId) {
      const deuda = deudasData.find(d => d.id === deudaId)
      if (deuda) {
        const nuevoPendiente = Math.max(0, (deuda.pendiente || 0) - monto)
        const nuevosPagados = (deuda.pagadas || 0) + 1
        const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

        await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          pagadas: nuevosPagados,
          estado: nuevoEstado,
        }).eq('id', deudaId)

        // FIX 3: guardar el ID del deuda_movimiento para poder borrarlo con precisión
        const { data: dmData } = await supabase.from('deuda_movimientos').insert([{
          deuda_id: deudaId,
          tipo: 'pago',
          descripcion: form.descripcion,
          monto,
          fecha: form.fecha,
          mes, año,
        }]).select()

        // FIX 3: actualizar el movimiento con el deuda_movimiento_id
        if (dmData?.[0]?.id) {
          await supabase.from('movimientos')
            .update({ deuda_movimiento_id: dmData[0].id })
            .eq('id', data[0].id)
          setMovs(prev => prev.map(m =>
            m.id === data[0].id ? { ...m, deuda_movimiento_id: dmData[0].id } : m
          ))
        }

        setDeudasData(prev => prev.map(d =>
          d.id === deudaId ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados } : d
        ))
      }
      setDeudaSeleccionada('')
    }

    resetModal()
    setSaving(false)
  }


  async function handleDelete(movimiento) {
    if (!confirm(`¿Eliminar "${movimiento.descripcion}"?`)) return
    try {
      // ── Revertir meta ─────────────────────────────────────────────────────
      if (movimiento.categoria === 'ahorro') {
        const meta = movimiento.meta_id
          ? metasData.find(m => m.id === movimiento.meta_id)
          : metasData.find(m => m.nombre === movimiento.descripcion)
        if (meta) {
          const nuevoActual = Math.max(0, (meta.actual || 0) - movimiento.monto)
          await supabase.from('metas').update({ actual: nuevoActual }).eq('id', meta.id)
          setMetasData(prev => prev.map(m => m.id === meta.id ? { ...m, actual: nuevoActual } : m))
        }
      }

      // ── Revertir inversión ────────────────────────────────────────────────
      if (movimiento.categoria === 'inversion') {
        const inv = movimiento.inversion_id
          ? inversionesData.find(i => i.id === movimiento.inversion_id)
          : inversionesData.find(i => i.nombre === movimiento.descripcion)
        if (inv) {
          const nuevoCapital = Math.max(0, (inv.capital || 0) - movimiento.monto)
          await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', inv.id)
          setInversionesData(prev => prev.map(i => i.id === inv.id ? { ...i, capital: nuevoCapital } : i))
        }
      }

      // ── Revertir deuda ────────────────────────────────────────────────────
      let deudaMovimientoId = movimiento.deuda_movimiento_id || null

      if (movimiento.categoria === 'deuda' && movimiento.deuda_id) {
        const { data: deudaData } = await supabase
          .from('deudas').select('id, pendiente, monto, pagadas, estado')
          .eq('id', movimiento.deuda_id).single()

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
          }).eq('id', movimiento.deuda_id)

          setDeudasData(prev => prev.map(d =>
            d.id === movimiento.deuda_id
              ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados }
              : d
          ))
        }
      }

      // BUG FIX: borrar movimientos PRIMERO (tiene FK a deuda_movimientos)
      // Si se borra deuda_movimientos antes, la FK violation impide la operación
      const { error } = await supabase.from('movimientos').delete().eq('id', movimiento.id)
      if (error) { alert('Error al borrar: ' + error.message); return }
      setMovs(prev => prev.filter(m => m.id !== movimiento.id))

      // Ahora sí borrar deuda_movimientos (ya sin referencias en movimientos)
      if (movimiento.categoria === 'deuda' && deudaMovimientoId) {
        await supabase.from('deuda_movimientos').delete().eq('id', deudaMovimientoId)
      } else if (movimiento.categoria === 'deuda' && movimiento.deuda_id) {
        // fallback legacy sin deuda_movimiento_id
        await supabase.from('deuda_movimientos')
          .delete()
          .eq('deuda_id', movimiento.deuda_id)
          .eq('tipo', 'pago')
          .eq('monto', movimiento.monto)
          .eq('fecha', movimiento.fecha)
          .limit(1)
      }
    } catch (err) {
      console.error('Error en borrado:', err)
    }
  }


  function aplicarSugerencia(item) {
    const nombre = item.nombre.replace(/^[\p{Emoji}\s]+/u, '').trim()
    setForm(prev => ({ ...prev, descripcion: nombre, monto: item.monto != null ? item.monto.toString() : '' }))
    const metaMatch = metasData.find(m => m.nombre.toLowerCase() === nombre.toLowerCase())
    if (metaMatch) setMetaSeleccionada(metaMatch.id)
    const invMatch = inversionesData.find(i => i.nombre.toLowerCase() === nombre.toLowerCase())
    if (invMatch) setMetaSeleccionada(`inv_${invMatch.id}`)
  }

  const sugerenciasRicas = form.tipo === 'egreso' ? (() => {
    if (form.categoria === 'deuda') return []

    if (form.categoria === 'ahorro') {
      const montoMetas = presupuesto?.montoMetas || 0
      return metasData.map(m => ({
        id: m.id, nombre: m.nombre,
        monto: Math.round((m.pct_mensual / 100) * montoMetas),
        sub: `${formatCurrency(m.actual || 0)} / ${formatCurrency(m.meta)}`,
        pct: Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100)),
        color: colores.green, emoji: '🎯',
      }))
    }

    if (form.categoria === 'inversion') return inversionesData.map(i => ({
      id: `inv_${i.id}`, nombre: i.nombre, monto: i.aporte || 0,
      sub: `Capital: ${formatCurrency(i.capital || 0)}`,
      pct: null, color: colores.violet, emoji: '📈',
    }))

    return presItems
      .filter(i => i.bloque === CAT_BLOQUE[form.categoria])
      .map(i => ({ id: i.id, nombre: i.nombre, monto: i.monto, sub: null, pct: null, color: colores.terra, emoji: '📌' }))
  })() : []

  const movsMes = movs.filter(m => {
    const [year, month] = m.fecha.split('-').map(Number)
    return month - 1 === now.getMonth() && year === now.getFullYear()
  })
  // FIX 4: separar gastos corrientes de ahorro/inversión igual que el dashboard
  const ingresos = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos = movsMes
    .filter(m => m.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(m.categoria))
    .reduce((s, m) => s + m.monto, 0)
  const ahorro = movsMes
    .filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria))
    .reduce((s, m) => s + m.monto, 0)

  const filtered = movs
    .filter(m => filtro === 'todos' || m.tipo === filtro || m.categoria === filtro)
    .filter(m => !search || m.descripcion.toLowerCase().includes(search.toLowerCase()))

  const usandoTarjeta = form.tipo === 'egreso' && tarjetaSeleccionada

  return (
    <AppShell>
      <div className="w-full max-w-full overflow-x-hidden">

        {/* HEADER */}
        <div className="mb-6 animate-enter px-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: colores.muted }}>Módulo</p>
              <h1 className="text-xl font-black tracking-tight leading-tight" style={{ color: 'var(--text-primary)' }}>Registro</h1>
            </div>
            <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center justify-center gap-2"
              style={{ background: colores.main }}>
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Nuevo registro</span>
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl text-xs font-semibold" style={{
            background: `color-mix(in srgb, ${colores.rose} 8%, transparent)`,
            border: `1px solid color-mix(in srgb, ${colores.rose} 20%, transparent)`,
            color: colores.rose,
          }}>{error}</div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'Ingresos', value: formatCurrency(ingresos), color: colores.green, icon: ArrowUpRight },
            { label: 'Egresos', value: formatCurrency(egresos), color: colores.rose, icon: ArrowDownRight },
            {
              label: 'Balance',
              value: formatCurrency(ingresos - egresos),
              color: ingresos - egresos >= 0 ? colores.green : colores.rose,
              icon: ingresos - egresos >= 0 ? ArrowUpRight : ArrowDownRight,
            },
          ].map((s, i) => (
            <div key={i} className="animate-enter"
              style={{
                background: colores.card,
                borderRadius: 20,
                padding: '12px 14px',
                border: `1px solid ${colores.border}`,
                animationDelay: `${i * 0.05}s`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
              <div style={{
                width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.icon size={12} style={{ color: s.color }} strokeWidth={2.5} />
              </div>
              <div>
                <p style={{
                  fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: colores.muted, marginBottom: 4,
                }}>{s.label}</p>
                <p className="font-serif" style={{
                  fontSize: 16, fontWeight: 400,
                  color: s.color, lineHeight: 1,
                }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* BÚSQUEDA Y FILTROS */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: colores.muted, zIndex: 10 }} />
            <input className="ff-input w-full h-12" style={{ paddingLeft: '3.5rem' }}
              placeholder="Buscar movimiento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[{ v: 'todos', l: 'Todos' }, { v: 'ingreso', l: 'Ingresos' }, { v: 'egreso', l: 'Egresos' }].map(f => (
              <button key={f.v} onClick={() => setFiltro(f.v)}
                className="px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border"
                style={{
                  background: filtro === f.v ? `color-mix(in srgb, ${colores.green} 10%, transparent)` : 'transparent',
                  color: filtro === f.v ? colores.green : colores.muted,
                  borderColor: filtro === f.v ? `color-mix(in srgb, ${colores.green} 20%, transparent)` : 'transparent',
                }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA DE MOVIMIENTOS */}
        <Card className="overflow-hidden border-none shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 opacity-50">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm italic" style={{ color: colores.muted }}>No hay registros</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: colores.border }}>
              {filtered.map((m, i) => (
                <div key={m.id}
                  className="flex items-center gap-3 px-3 py-4 transition-colors group"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  style={{ animationDelay: `${i * 0.02}s` }}>

                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: m.tipo === 'ingreso'
                        ? `color-mix(in srgb, ${colores.green} 10%, transparent)`
                        : `color-mix(in srgb, ${colores.rose} 10%, transparent)`,
                      color: m.tipo === 'ingreso' ? colores.green : colores.rose,
                    }}>
                    {m.tipo === 'ingreso' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {m.descripcion}
                    </p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {(() => {
                        const esIngreso = m.tipo === 'ingreso'
                        const color = esIngreso ? colores.green : (CAT_COLOR_VAR[m.categoria] || colores.muted)
                        const label = esIngreso ? 'ingreso' : m.categoria
                        return (
                          <span style={{
                            fontSize: 9, fontWeight: 900, textTransform: 'uppercase',
                            letterSpacing: '0.12em', padding: '3px 8px', borderRadius: 999,
                            background: `color-mix(in srgb, ${color} 12%, transparent)`,
                            color: color,
                          }}>
                            {label}
                          </span>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-sm font-black tabular-nums"
                      style={{ color: m.tipo === 'ingreso' ? colores.green : colores.rose }}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                    </p>
                    <button
                      onClick={() => handleDelete(m)}
                      className="p-1 transition-all"
                      style={{ color: colores.muted, opacity: 0.4 }}
                      onMouseEnter={e => { e.currentTarget.style.color = colores.rose; e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={e => { e.currentTarget.style.color = colores.muted; e.currentTarget.style.opacity = '0.4' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cargar más movimientos */}
        {hayMas && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => cargarMovimientos(true)}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold border transition-all"
              style={{
                borderColor: 'var(--border-glass)',
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
              }}>
              {loading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
              Cargar historial completo
            </button>
          </div>
        )}

        {/* MODAL NUEVO MOVIMIENTO */}
        <Modal open={modal} onClose={resetModal} title="Nuevo Movimiento">
          <form onSubmit={handleAdd} className="space-y-4">

            {/* Tipo toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              {['ingreso', 'egreso'].map(t => (
                <button type="button" key={t}
                  onClick={() => {
                    setForm({ ...form, tipo: t, categoria: t === 'ingreso' ? '' : 'basicos' })
                    setTarjetaSeleccionada('')
                  }}
                  className="py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  style={{
                    background: form.tipo === t ? colores.card : 'transparent',
                    color: form.tipo === t ? 'var(--text-primary)' : colores.muted,
                    boxShadow: form.tipo === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Categoría + Quién */}
            <div className={`grid ${form.tipo === 'egreso' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              {form.tipo === 'egreso' && (
                <div className="space-y-1">
                  <label className="ff-label">Categoría</label>
                  <select className="ff-input h-12 text-sm" value={form.categoria}
                    onChange={e => { setForm({ ...form, categoria: e.target.value }); setTarjetaSeleccionada('') }}>
                    {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1">
                <label className="ff-label">¿Quién?</label>
                <select className="ff-input h-12 text-sm" value={form.quien}
                  onChange={e => setForm({ ...form, quien: e.target.value })}>
                  <option value="Jodannys">Jodannys</option>
                  <option value="Rolando">Rolando</option>
                  <option value="Ambos">Ambos</option>
                </select>
              </div>
            </div>

            {/* Subcategoría (si hay configuradas) */}
            {form.tipo === 'egreso' && (() => {
              const bloqueActual = CAT_BLOQUE[form.categoria]
              const catsDisp = categoriasCfg.filter(c => c.bloque === bloqueActual)
              const subsDisp = subcategorias.filter(s => catsDisp.some(c => c.id === s.categoria_id))
              if (subsDisp.length === 0) return null
              return (
                <div className="space-y-1 animate-enter">
                  <label className="ff-label">Subcategoría (opcional)</label>
                  <select className="ff-input h-12 text-sm" value={form.subcategoria_id}
                    onChange={e => setForm({ ...form, subcategoria_id: e.target.value })}>
                    <option value="">— Sin subcategoría —</option>
                    {catsDisp.map(cat => {
                      const subsGrupo = subcategorias.filter(s => s.categoria_id === cat.id)
                      if (subsGrupo.length === 0) return null
                      return (
                        <optgroup key={cat.id} label={cat.nombre}>
                          {subsGrupo.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.nombre}</option>
                          ))}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
              )
            })()}

            {/* Tarjeta de crédito */}
            {form.tipo === 'egreso' && form.categoria !== 'deuda' && tarjetasData.length > 0 && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label flex items-center gap-1.5">
                  <CreditCard size={11} /> ¿Pagado con tarjeta? (opcional)
                </label>
                <select className="ff-input h-12 text-sm" value={tarjetaSeleccionada}
                  onChange={e => setTarjetaSeleccionada(e.target.value)}>
                  <option value="">— No, pago directo —</option>
                  {tarjetasData
                    .filter(t => t.estado !== 'pausada') // FIX: ocultar tarjetas pausadas
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nombre_tarjeta}{t.banco ? ` · ${t.banco}` : ''}
                        {!tarjetaDeudasMap[t.id] ? ' ⚠ sin deuda' : ''}
                      </option>
                    ))
                  }
                </select>
                {tarjetaSeleccionada && (
                  <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                    style={{
                      background: `color-mix(in srgb, ${colores.violet} 8%, transparent)`,
                      color: colores.violet,
                      border: `1px solid color-mix(in srgb, ${colores.violet} 20%, transparent)`,
                    }}>
                    💳 Este gasto se acumulará en la tarjeta. No restará del presupuesto hasta que pagues la tarjeta.
                  </div>
                )}
              </div>
            )}

            {/* Sugerencias */}
            {!usandoTarjeta && sugerenciasRicas.length > 0 && (
              <div className="animate-enter">
                <p className="text-[10px] font-black uppercase mb-2 ml-1" style={{ color: colores.muted }}>
                  Sugerencias del presupuesto
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {sugerenciasRicas.map(item => (
                    <button type="button" key={item.id}
                      onClick={() => aplicarSugerencia({ ...item, nombre: `${item.emoji} ${item.nombre}` })}
                      className="text-left p-3 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95"
                      style={{
                        background: `color-mix(in srgb, ${item.color} 8%, transparent)`,
                        borderColor: `color-mix(in srgb, ${item.color} 25%, transparent)`,
                      }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-base leading-none">{item.emoji}</span>
                        <p className="text-[10px] font-black truncate leading-tight" style={{ color: 'var(--text-secondary)' }}>
                          {item.nombre}
                        </p>
                      </div>
                      {item.monto > 0 && (
                        <p className="text-sm font-black mb-1" style={{ color: item.color }}>
                          {formatCurrency(item.monto)}
                        </p>
                      )}
                      {item.sub && (
                        <p className="text-[9px] truncate mb-1" style={{ color: colores.muted }}>{item.sub}</p>
                      )}
                      {item.pct !== null && (
                        <div className="w-full h-1 rounded-full mt-1" style={{ background: colores.track }}>
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selector deuda */}
            {form.tipo === 'egreso' && form.categoria === 'deuda' && deudasData.length > 0 && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label">¿Qué deuda pagas?</label>
                <select className="ff-input h-12 text-sm" value={deudaSeleccionada}
                  onChange={e => {
                    setDeudaSeleccionada(e.target.value)
                    const d = deudasData.find(d => d.id === e.target.value)
                    if (d) setForm(prev => ({ ...prev, descripcion: `Pago ${d.nombre}`, monto: (d.cuota || d.pendiente || '').toString() }))
                  }}>
                  <option value="">— Seleccionar deuda —</option>
                  {deudasData.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.tipo_deuda === 'tarjeta' ? '💳 ' : ''}{d.nombre} · Pendiente {formatCurrency(d.pendiente)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Descripción */}
            {(sugerenciasRicas.length === 0 || metaSeleccionada || form.descripcion) && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label">Descripción</label>
                <input className="ff-input h-12 text-sm font-medium" placeholder="Ej: Sueldo, Alquiler..." required
                  value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
              </div>
            )}

            {/* Monto + Fecha */}
            {(sugerenciasRicas.length === 0 || metaSeleccionada || form.descripcion) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="ff-label">Monto (€)</label>
                  <input className="ff-input h-12 text-sm font-black" type="number" step="0.01" placeholder="0.00" required
                    style={{ color: colores.terra }}
                    value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="ff-label">Fecha</label>
                  <input className="ff-input h-12 text-sm font-medium" type="date" required
                    value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-14 text-sm font-black shadow-lg flex items-center justify-center gap-2 transition-all rounded-xl"
              style={{
                background: 'var(--accent-main)',
                color: 'var(--bg-card)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : usandoTarjeta ? '💳 Cargar a tarjeta' : 'CONFIRMAR'}
            </button>
          </form>
        </Modal>

      </div>
    </AppShell>
  )
}