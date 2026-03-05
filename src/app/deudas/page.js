'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import {
  Plus, Loader2, Trash2, CreditCard, Landmark,
  ChevronDown, ChevronUp, Pencil,
  ArrowDownRight, ArrowUpRight, Calendar, Check, AlertCircle
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcularCuota(capital, tasaAnual, meses) {
  if (!capital || !meses) return 0
  if (!tasaAnual || tasaAnual === 0) return capital / meses
  const r = tasaAnual / 100 / 12
  return (capital * r) / (1 - Math.pow(1 + r, -meses))
}

function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  return diaPago >= hoy ? diaPago - hoy : 30 - hoy + diaPago
}

function urgenciaColor(dias) {
  if (dias === null) return null
  if (dias <= 3) return { bg: 'rgba(192,96,90,0.1)', text: '#C0605A', label: `¡Vence en ${dias}d!` }
  if (dias <= 7) return { bg: 'rgba(193,122,58,0.1)', text: '#C17A3A', label: `Vence en ${dias}d` }
  return { bg: 'rgba(45,122,95,0.1)', text: '#2D7A5F', label: `${dias}d para pago` }
}

const TIPO_CONFIG = {
  tarjeta: { label: 'Tarjeta', icon: CreditCard, color: '#818CF8' },
  prestamo: { label: 'Préstamo', icon: Landmark, color: '#C0605A' },
  cuota: { label: 'Cuota', icon: Calendar, color: '#C17A3A' },
}

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 34, height: 34, flexShrink: 0 }}
    >
      {children}
    </button>
  )
}

// ─── Form defaults por tipo ──────────────────────────────────────────────────

const FORM_TARJETA = {
  tipo_deuda: 'tarjeta',
  emoji: '💳',
  nombre: '',
  categoria: 'deseo',
  tarjeta_id: '',
  limite: '',
  monto_compra: '',
  num_cuotas: '',
  fecha_operacion: new Date().toISOString().slice(0, 10),
  color: '#818CF8',
}

const FORM_PRESTAMO = {
  tipo_deuda: 'prestamo',
  emoji: '🏦',
  nombre: '',
  categoria: 'basicos',
  capital: '',
  tasa_interes: '',
  tiene_interes: false,    // toggle interés
  plazo_meses: '',
  plazo_libre: false,      // pago flexible sin plazo
  fecha_primer_pago: '',
  dia_pago: '',
  color: '#C0605A',
}

const FORM_CUOTA = {
  tipo_deuda: 'cuota',
  emoji: '📅',
  nombre: '',
  categoria: 'deseo',
  deuda_origen_id: '',   // deuda de la que viene esta cuota
  monto: '',
  dia_pago: '',
  color: '#C17A3A',
}

// ─── Component Principal ─────────────────────────────────────────────────────

export default function DeudasPage() {
  const [deudas, setDeudas] = useState([])
  const [movimientos, setMovimientos] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [cardActiva, setCardActiva] = useState(null)

  // Modal nueva/edición
  const [modalDeuda, setModalDeuda] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('tarjeta')
  const [formTarjeta, setFormTarjeta] = useState(FORM_TARJETA)
  const [formPrestamo, setFormPrestamo] = useState(FORM_PRESTAMO)
  const [formCuota, setFormCuota] = useState(FORM_CUOTA)

  // Modal movimiento
  const [modalMov, setModalMov] = useState(null)
  const [formMov, setFormMov] = useState({
    tipo: 'cargo', descripcion: '', monto: '',
    fecha: new Date().toISOString().slice(0, 10),
  })

  const [misTarjetas, setMisTarjetas] = useState([])

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargar() }, [])

  // ── Carga inicial ──────────────────────────────────────────────────────────

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const [{ data: deudasData, error: e1 }, { data: tarjetasData, error: e2 }] = await Promise.all([
        supabase.from('deudas').select('*').order('created_at'),
        supabase.from('perfiles_tarjetas').select('*').eq('estado', 'activa'),
      ])
      if (e1) throw e1
      if (e2) console.error('Error tarjetas:', e2.message)
      setDeudas(deudasData || [])
      setMisTarjetas(tarjetasData || [])

      if (deudasData?.length) {
        const { data: movs, error: e3 } = await supabase
          .from('deuda_movimientos').select('*').order('fecha', { ascending: false })
        if (!e3) {
          const grouped = {}
            ; (movs || []).forEach(m => {
              if (!grouped[m.deuda_id]) grouped[m.deuda_id] = []
              grouped[m.deuda_id].push(m)
            })
          setMovimientos(grouped)
        }
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // ── Abrir modal nueva deuda ────────────────────────────────────────────────

  function abrirNueva() {
    setEditandoId(null)
    setTipoSeleccionado('tarjeta')
    setFormTarjeta(FORM_TARJETA)
    setFormPrestamo(FORM_PRESTAMO)
    setFormCuota(FORM_CUOTA)
    setModalDeuda(true)
  }

  // ── Abrir modal edición ────────────────────────────────────────────────────

  function abrirEdicion(d) {
    setEditandoId(d.id)
    setTipoSeleccionado(d.tipo_deuda || 'tarjeta')

    if (d.tipo_deuda === 'tarjeta') {
      setFormTarjeta({
        tipo_deuda: 'tarjeta',
        emoji: d.emoji || '💳',
        nombre: d.nombre || '',
        categoria: d.categoria || 'deseo',
        tarjeta_id: '',
        limite: d.limite?.toString() || '',
        monto_compra: d.capital?.toString() || '',
        num_cuotas: d.plazo_meses?.toString() || '',
        fecha_operacion: new Date().toISOString().slice(0, 10),
        color: d.color || '#818CF8',
      })
    } else if (d.tipo_deuda === 'prestamo') {
      setFormPrestamo({
        tipo_deuda: 'prestamo',
        emoji: d.emoji || '🏦',
        nombre: d.nombre || '',
        categoria: d.categoria || 'basicos',
        capital: d.capital?.toString() || '',
        tasa_interes: (d.tasa_interes || d.tasa || 0).toString(),
        tiene_interes: (d.tasa_interes || d.tasa || 0) > 0,
        plazo_meses: d.plazo_meses?.toString() || '',
        plazo_libre: !d.plazo_meses,
        fecha_primer_pago: d.fecha_primer_pago || '',
        dia_pago: d.dia_pago?.toString() || '',
        color: d.color || '#C0605A',
      })
    } else {
      setFormCuota({
        tipo_deuda: 'cuota',
        emoji: d.emoji || '📅',
        nombre: d.nombre || '',
        categoria: d.categoria || 'deseo',
        monto: d.cuota?.toString() || '',
        dia_pago: d.dia_pago?.toString() || '',
        color: d.color || '#C17A3A',
      })
    }
    setModalDeuda(true)
  }

  // ── Seleccionar tarjeta perfil en formulario tarjeta ───────────────────────

  function handleSeleccionarTarjetaPerfil(id) {
    const t = misTarjetas.find(x => x.id === id)
    if (!t) return
    setFormTarjeta(prev => ({
      ...prev,
      tarjeta_id: t.id,
      limite: t.limite_credito?.toString() || '',
      color: t.color || '#818CF8',
      dia_pago: t.dia_pago?.toString() || prev.dia_pago || '',
    }))
  }

  // ── Guardar deuda ──────────────────────────────────────────────────────────

  async function handleSaveDeuda(e) {
    e.preventDefault()
    setSaving(true)

    let payload = {}

    if (tipoSeleccionado === 'tarjeta') {
      const f = formTarjeta
      const capital = parseFloat(f.monto_compra) || 0
      const meses = parseInt(f.num_cuotas) || 1
      const cuota = parseFloat((capital / meses).toFixed(2))
      payload = {
        tipo_deuda: 'tarjeta',
        tipo: 'debo',
        emoji: f.emoji,
        nombre: f.nombre,
        categoria: f.categoria,
        limite: parseFloat(f.limite) || 0,
        capital,
        monto: capital,
        pendiente: capital,
        cuota,
        plazo_meses: meses,
        tasa: 0,
        tasa_interes: 0,
        dia_pago: null,
        dia_corte: null,
        color: f.color,
        estado: 'activa',
        pagadas: 0,
      }
    } else if (tipoSeleccionado === 'prestamo') {
      const f = formPrestamo
      const capital = parseFloat(f.capital) || 0
      const tasa = f.tiene_interes ? (parseFloat(f.tasa_interes) || 0) : 0
      const meses = f.plazo_libre ? null : (parseInt(f.plazo_meses) || null)
      const cuota = meses ? parseFloat(calcularCuota(capital, tasa, meses).toFixed(2)) : 0
      payload = {
        tipo_deuda: 'prestamo',
        tipo: 'debo',
        emoji: f.emoji,
        nombre: f.nombre,
        categoria: f.categoria,
        capital,
        monto: capital,
        pendiente: capital,
        tasa,
        tasa_interes: tasa,
        plazo_meses: meses,
        cuota,
        fecha_primer_pago: f.fecha_primer_pago || null,
        dia_pago: parseInt(f.dia_pago) || null,
        color: f.color,
        estado: 'activa',
        pagadas: 0,
      }
    } else {
      const f = formCuota
      const monto = parseFloat(f.monto) || 0

      // FIX 1: Si hay deuda origen, registrar pago directo (no crear deuda nueva)
      if (f.deuda_origen_id && !editandoId) {
        const deudaOrigen = deudas.find(d => d.id === f.deuda_origen_id)
        if (deudaOrigen) {
          const nuevoPendiente = Math.max(0, (deudaOrigen.pendiente || 0) - monto)
          const nuevosPagados = (deudaOrigen.pagadas || 0) + 1
          const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

          await supabase.from('deuda_movimientos').insert([{
            deuda_id: f.deuda_origen_id, tipo: 'pago',
            descripcion: f.nombre || `Cuota ${deudaOrigen.nombre}`,
            monto, fecha: new Date().toISOString().slice(0, 10), mes, año,
          }])
          await supabase.from('movimientos').insert([{
            tipo: 'egreso', categoria: 'deuda',
            descripcion: f.nombre || `Pago letra: ${deudaOrigen.nombre}`,
            monto, fecha: new Date().toISOString().slice(0, 10), quien: 'Ambos',
          }])
          await supabase.from('deudas').update({
            pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
          }).eq('id', f.deuda_origen_id)

          setDeudas(prev => prev.map(d => d.id === f.deuda_origen_id
            ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado }
            : d))
        }
        setSaving(false)
        setModalDeuda(false)
        setEditandoId(null)
        return
      }

      // Sin deuda origen: crear cuota recurrente nueva (comportamiento original)
      payload = {
        tipo_deuda: 'cuota',
        tipo: 'debo',
        emoji: f.emoji,
        nombre: f.nombre,
        categoria: f.categoria,
        cuota: monto,
        monto,
        capital: monto,
        pendiente: monto,
        dia_pago: parseInt(f.dia_pago) || null,
        color: f.color,
        estado: 'activa',
        pagadas: 0,
        tasa: 0,
        tasa_interes: 0,
      }
    }

    if (editandoId) {
      const { error } = await supabase.from('deudas').update(payload).eq('id', editandoId)
      if (error) setError(error.message)
      else setDeudas(prev => prev.map(d => d.id === editandoId ? { ...d, ...payload } : d))
    } else {
      const { data, error } = await supabase.from('deudas').insert([payload]).select()
      if (error) setError(error.message)
      else setDeudas(prev => [...prev, data[0]])
    }

    setSaving(false)
    setModalDeuda(false)
    setEditandoId(null)
  }

  // ── Marcar cuota como pagada ───────────────────────────────────────────────

  async function handleMarcarPagada(deuda) {
    const monto = deuda.cuota || deuda.pendiente || 0
    if (!monto) return
    setSaving(true)

    const nuevoPendiente = Math.max(0, (deuda.pendiente || 0) - monto)
    const nuevosPagados = (deuda.pagadas || 0) + 1
    const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

    await supabase.from('deuda_movimientos').insert([{
      deuda_id: deuda.id, tipo: 'pago',
      descripcion: `Cuota mensual: ${deuda.nombre}`,
      monto, fecha: new Date().toISOString().slice(0, 10), mes, año,
    }])

    await supabase.from('movimientos').insert([{
      tipo: 'egreso', categoria: 'deuda',
      descripcion: `Pago letra: ${deuda.nombre}`,
      monto, fecha: new Date().toISOString().slice(0, 10), quien: 'Ambos',
    }])

    await supabase.from('deudas').update({
      pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
    }).eq('id', deuda.id)

    setDeudas(prev => prev.map(d => d.id === deuda.id
      ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado }
      : d))
    setSaving(false)
  }

  // ── Movimiento manual ──────────────────────────────────────────────────────

  async function handleAddMov(e) {
    e.preventDefault()
    if (!modalMov) return
    setSaving(true)
    const monto = parseFloat(formMov.monto)
    const deuda = deudas.find(d => d.id === modalMov)

    const { data, error } = await supabase.from('deuda_movimientos').insert([{
      deuda_id: modalMov, tipo: formMov.tipo,
      descripcion: formMov.descripcion, monto,
      fecha: formMov.fecha, mes, año,
    }]).select()

    if (!error && deuda) {
      setMovimientos(prev => ({ ...prev, [modalMov]: [data[0], ...(prev[modalMov] || [])] }))
      let nuevoPendiente = deuda.pendiente || 0
      let nuevoMontoTotal = deuda.monto || 0
      let nuevosPagados = deuda.pagadas || 0

      if (formMov.tipo === 'pago') {
        nuevoPendiente = Math.max(0, nuevoPendiente - monto)
        nuevosPagados++
        await supabase.from('movimientos').insert([{
          tipo: 'egreso', categoria: 'deuda',
          descripcion: `Pago letra: ${deuda.nombre}`,
          monto, fecha: formMov.fecha, quien: 'Ambos',
        }])
      } else {
        nuevoPendiente = nuevoPendiente + monto
        nuevoMontoTotal = nuevoMontoTotal + monto
      }

      const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
      await supabase.from('deudas').update({
        pendiente: nuevoPendiente, monto: nuevoMontoTotal,
        pagadas: nuevosPagados, estado: nuevoEstado
      }).eq('id', modalMov)

      setDeudas(prev => prev.map(d => d.id === modalMov
        ? { ...d, pendiente: nuevoPendiente, monto: nuevoMontoTotal, pagadas: nuevosPagados, estado: nuevoEstado }
        : d))
      setModalMov(null)
      setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10) })
    }
    setSaving(false)
  }

  // FIX 2: Borrar movimiento y revertir pendiente automáticamente
  async function handleDeleteMov(mov) {
    if (!confirm('¿Eliminar este movimiento y revertir el pendiente?')) return
    const deuda = deudas.find(d => d.id === mov.deuda_id)
    if (!deuda) return

    const { error } = await supabase.from('deuda_movimientos').delete().eq('id', mov.id)
    if (error) { setError(error.message); return }

    // Revertir: pago → sube pendiente, cargo → baja pendiente
    let nuevoPendiente = deuda.pendiente || 0
    let nuevosPagados = deuda.pagadas || 0

    if (mov.tipo === 'pago') {
      nuevoPendiente = Math.min(deuda.monto || nuevoPendiente + mov.monto, nuevoPendiente + mov.monto)
      nuevosPagados = Math.max(0, nuevosPagados - 1)

      await supabase.from('movimientos').delete()
        .eq('categoria', 'deuda')
        .eq('monto', mov.monto)
        .ilike('descripcion', `%${deuda.nombre}%`)

    } else {
      nuevoPendiente = Math.max(0, nuevoPendiente - mov.monto)
    }
    const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

    await supabase.from('deudas').update({
      pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
    }).eq('id', mov.deuda_id)

    setDeudas(prev => prev.map(d => d.id === mov.deuda_id
      ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado }
      : d))
    setMovimientos(prev => ({
      ...prev,
      [mov.deuda_id]: (prev[mov.deuda_id] || []).filter(m => m.id !== mov.id)
    }))
  }

  // ── Eliminar deuda ─────────────────────────────────────────────────────────

  async function handleDeleteDeuda(id) {
    if (!confirm('¿Eliminar esta deuda y todos sus movimientos?')) return
    const deuda = deudas.find(d => d.id === id)
    if (deuda) {
      await supabase.from('movimientos').delete()
        .eq('categoria', 'deuda').ilike('descripcion', `%${deuda.nombre}%`)
    }
    await supabase.from('deudas').delete().eq('id', id)
    setDeudas(prev => prev.filter(d => d.id !== id))
    if (cardActiva === id) setCardActiva(null)
  }

  // ── Totales ────────────────────────────────────────────────────────────────

  const activas = deudas.filter(d => d.estado !== 'pagada')
  const totalDeuda = activas.reduce((s, d) => s + (d.pendiente || 0), 0)
  const cuotasMes = activas.reduce((s, d) => s + (d.cuota || 0), 0)
  const vencenProximo = activas.filter(d => { const dias = diasHastaPago(d.dia_pago); return dias !== null && dias <= 7 }).length

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Módulo</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight truncate">Mis Deudas</h1>
        </div>
        <button onClick={abrirNueva} className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-bold">Nueva deuda</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: 'Deuda total', value: formatCurrency(totalDeuda), color: '#C0605A' },
          { label: 'Letras este mes', value: formatCurrency(cuotasMes), color: 'var(--accent-terra)' },
          { label: 'Vencen pronto', value: vencenProximo > 0 ? `${vencenProximo} deuda${vencenProximo > 1 ? 's' : ''}` : 'Al día ✓', color: vencenProximo > 0 ? '#C0605A' : 'var(--accent-green)' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] text-stone-400 uppercase tracking-wider font-bold mb-1">{s.label}</p>
            <p className="text-sm font-black" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-stone-400" />
        </div>
      ) : deudas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">No hay deudas registradas</p>
          <button onClick={abrirNueva} className="ff-btn-primary">Agregar primera deuda</button>
        </div>
      ) : (
        <div className="space-y-3">
          {deudas.map((d, i) => {
            const cfg = TIPO_CONFIG[d.tipo_deuda] || TIPO_CONFIG.tarjeta
            const pct = d.monto > 0 ? Math.min(100, Math.round(((d.monto - (d.pendiente || 0)) / d.monto) * 100)) : 0
            const dias = diasHastaPago(d.dia_pago)
            const urgencia = urgenciaColor(dias)
            const isExp = expandido === d.id
            const isActiva = cardActiva === d.id
            const movsDeuda = movimientos[d.id] || []
            const esCuota = d.tipo_deuda === 'cuota'
            const pagadaHoy = movsDeuda.some(m =>
              m.tipo === 'pago' &&
              m.fecha?.slice(0, 7) === new Date().toISOString().slice(0, 7)
            )

            return (
              <Card key={d.id}
                className="animate-enter overflow-hidden cursor-pointer select-none"
                style={{ animationDelay: `${i * 0.04}s`, padding: '14px 16px' }}
                onClick={() => setCardActiva(isActiva ? null : d.id)}
              >
                {/* Fila principal */}
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${d.color || cfg.color}18` }}>
                    <span>{d.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-stone-800 truncate text-sm leading-tight">{d.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                        style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: d.categoria === 'basicos' ? 'rgba(74,111,165,0.1)' : 'rgba(193,122,58,0.1)',
                          color: d.categoria === 'basicos' ? '#4A6FA5' : '#C17A3A',
                        }}>
                        {d.categoria}
                      </span>
                      {urgencia && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: urgencia.bg, color: urgencia.text }}>
                          {urgencia.label}
                        </span>
                      )}
                      {pagadaHoy && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                          ✓ Pagada este mes
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black tabular-nums"
                      style={{ color: d.color || cfg.color, letterSpacing: '-0.02em' }}>
                      {formatCurrency(d.pendiente || 0)}
                    </p>
                    <p className="text-[9px] text-stone-400">pendiente</p>
                  </div>
                </div>

                {/* Barra progreso */}
                {d.monto > 0 && (
                  <div className="mb-2.5">
                    <ProgressBar value={d.monto - (d.pendiente || 0)} max={d.monto} color={d.color || cfg.color} />
                  </div>
                )}

                {/* Info extra */}
                <div className="flex items-center gap-2 flex-wrap">
                  {d.cuota > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {formatCurrency(d.cuota)}/mes
                    </span>
                  )}
                  {d.plazo_meses && (
                    <span className="text-[9px] text-stone-400">
                      {d.pagadas || 0}/{d.plazo_meses} cuotas
                    </span>
                  )}
                  {!d.plazo_meses && d.tipo_deuda === 'prestamo' && (
                    <span className="text-[9px] text-stone-400">Pago flexible</span>
                  )}
                  {d.dia_pago && <span className="text-[9px] text-stone-400">Pago día {d.dia_pago}</span>}
                  {d.estado === 'pagada' && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                      ¡Saldada!
                    </span>
                  )}
                </div>

                {/* Acciones (visible al hacer click) */}
                <div className={`transition-all duration-200 overflow-hidden ${isActiva ? 'max-h-16 opacity-100 mt-3 pt-3 border-t' : 'max-h-0 opacity-0'}`}
                  style={{ borderColor: 'var(--border-glass)' }}>
                  <div className="flex items-center gap-2 flex-wrap">

                    {/* Marcar cuota como pagada (para tipo cuota o préstamo con cuota mensual) */}
                    {(esCuota || (d.tipo_deuda === 'prestamo' && d.cuota > 0)) && d.estado !== 'pagada' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleMarcarPagada(d) }}
                        disabled={saving || pagadaHoy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 disabled:opacity-40"
                        style={{ background: pagadaHoy ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.12)', color: '#10b981' }}
                      >
                        <Check size={11} strokeWidth={3} />
                        {pagadaHoy ? 'Ya pagada' : 'Marcar pagada'}
                      </button>
                    )}

                    {/* Cargo */}
                    <IconBtn onClick={() => { setModalMov(d.id); setFormMov(prev => ({ ...prev, tipo: 'cargo' })) }}
                      title="Registrar cargo" bg="rgba(192,96,90,0.1)" color="#C0605A">
                      <ArrowDownRight size={13} strokeWidth={2.5} />
                    </IconBtn>

                    {/* Pago */}
                    <IconBtn onClick={() => { setModalMov(d.id); setFormMov(prev => ({ ...prev, tipo: 'pago' })) }}
                      title="Registrar pago" bg="rgba(16,185,129,0.1)" color="#10b981">
                      <ArrowUpRight size={13} strokeWidth={2.5} />
                    </IconBtn>

                    {/* Historial */}
                    <IconBtn onClick={() => setExpandido(isExp ? null : d.id)}
                      title="Ver historial" bg="var(--bg-secondary)" color="var(--text-muted)">
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </IconBtn>

                    {/* Editar */}
                    <IconBtn onClick={() => abrirEdicion(d)} title="Editar"
                      bg="rgba(74,111,165,0.1)" color="#4A6FA5">
                      <Pencil size={12} />
                    </IconBtn>

                    {/* Eliminar */}
                    <IconBtn onClick={() => handleDeleteDeuda(d.id)} title="Eliminar"
                      bg="rgba(192,96,90,0.08)" color="#C0605A">
                      <Trash2 size={12} />
                    </IconBtn>
                  </div>
                </div>

                {/* Historial expandido */}
                {isExp && (
                  <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: 'var(--border-glass)' }}>
                    {movsDeuda.length === 0 ? (
                      <p className="text-[10px] text-stone-400 italic text-center py-2">Sin movimientos aún</p>
                    ) : movsDeuda.map(m => (
                      <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-stone-50">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: m.tipo === 'pago' ? 'rgba(16,185,129,0.1)' : 'rgba(192,96,90,0.1)' }}>
                          {m.tipo === 'pago'
                            ? <ArrowUpRight size={11} style={{ color: '#10b981' }} />
                            : <ArrowDownRight size={11} style={{ color: '#C0605A' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-stone-700 truncate">{m.descripcion}</p>
                          <p className="text-[9px] text-stone-400">
                            {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <p className="text-xs font-black tabular-nums"
                            style={{ color: m.tipo === 'pago' ? '#10b981' : '#C0605A' }}>
                            {m.tipo === 'pago' ? '-' : '+'}{formatCurrency(m.monto)}
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteMov(m) }}
                            className="p-1 rounded-lg opacity-30 hover:opacity-100 transition-opacity"
                            style={{ color: '#C0605A' }}
                            title="Borrar y revertir">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Nueva / Editar Deuda
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal
        open={modalDeuda}
        onClose={() => { setModalDeuda(false); setEditandoId(null) }}
        title={editandoId ? 'Editar Deuda' : 'Nueva Deuda'}
      >
        {/* Selector de tipo (solo al crear) */}
        <div className="overflow-y-auto pr-1" style={{ maxHeight: 'calc(85vh - 130px)' }}></div>
        {!editandoId && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
              <button type="button" key={key}
                onClick={() => setTipoSeleccionado(key)}
                className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                style={{
                  background: tipoSeleccionado === key ? `${cfg.color}15` : 'var(--bg-secondary)',
                  color: tipoSeleccionado === key ? cfg.color : 'var(--text-muted)',
                  border: `1px solid ${tipoSeleccionado === key ? `${cfg.color}40` : 'var(--border-glass)'}`,
                }}>
                {cfg.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Formulario TARJETA ── */}
        {tipoSeleccionado === 'tarjeta' && (
          <form onSubmit={handleSaveDeuda} className="space-y-4">

            {/* Selector de tarjeta guardada (solo al crear) */}
            {!editandoId && misTarjetas.length > 0 && (
              <div className="p-3 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30">
                <label className="text-[10px] font-black uppercase text-indigo-500 mb-2 block">
                  Selecciona la tarjeta usada
                </label>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {misTarjetas.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => handleSeleccionarTarjetaPerfil(t.id)}
                      className="flex-shrink-0 px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center gap-2 bg-white hover:shadow-sm"
                      style={{
                        borderColor: formTarjeta.tarjeta_id === t.id ? t.color : `${t.color}40`,
                        color: t.color,
                        background: formTarjeta.tarjeta_id === t.id ? `${t.color}12` : 'white',
                        boxShadow: formTarjeta.tarjeta_id === t.id ? `0 0 0 2px ${t.color}30` : '',
                      }}>
                      <CreditCard size={12} />
                      {t.nombre_tarjeta}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Emoji + Nombre */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="ff-label">Emoji</label>
                <input className="ff-input text-center text-xl" maxLength={2}
                  value={formTarjeta.emoji}
                  onChange={e => setFormTarjeta(p => ({ ...p, emoji: e.target.value }))} />
              </div>
              <div className="col-span-3">
                <label className="ff-label">¿Qué compraste?</label>
                <input className="ff-input" required placeholder="Ej: Nevera nueva, Reparación coche..."
                  value={formTarjeta.nombre}
                  onChange={e => setFormTarjeta(p => ({ ...p, nombre: e.target.value }))} />
              </div>
            </div>

            {/* Categoría */}
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'deseo', l: 'Gasto Deseo' }, { v: 'basicos', l: 'Gasto Básico' }].map(c => (
                <button type="button" key={c.v}
                  onClick={() => setFormTarjeta(p => ({ ...p, categoria: c.v }))}
                  className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                  style={{
                    background: formTarjeta.categoria === c.v ? 'rgba(45,122,95,0.1)' : 'var(--bg-secondary)',
                    color: formTarjeta.categoria === c.v ? '#2D7A5F' : 'var(--text-muted)',
                    border: `1px solid ${formTarjeta.categoria === c.v ? 'rgba(45,122,95,0.3)' : 'var(--border-glass)'}`,
                  }}>
                  {c.l}
                </button>
              ))}
            </div>

            {/* Monto + Cuotas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ff-label">Monto Total (€)</label>
                <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                  value={formTarjeta.monto_compra}
                  onChange={e => setFormTarjeta(p => ({ ...p, monto_compra: e.target.value }))} />
              </div>
              <div>
                <label className="ff-label">Número de cuotas</label>
                <input className="ff-input" type="number" min="1" placeholder="1" required
                  value={formTarjeta.num_cuotas}
                  onChange={e => setFormTarjeta(p => ({ ...p, num_cuotas: e.target.value }))} />
              </div>
            </div>

            {/* Preview cuota */}
            {formTarjeta.monto_compra && formTarjeta.num_cuotas && (
              <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                style={{ background: 'rgba(129,140,248,0.08)', color: '#818CF8' }}>
                Cuota mensual estimada:{' '}
                <span className="font-black">
                  {formatCurrency(parseFloat(formTarjeta.monto_compra) / parseInt(formTarjeta.num_cuotas) || 0)}
                </span>
              </div>
            )}

            {/* Fecha de la compra */}
            <div>
              <label className="ff-label">Fecha de la compra</label>
              <input className="ff-input" type="date" required
                value={formTarjeta.fecha_operacion}
                onChange={e => setFormTarjeta(p => ({ ...p, fecha_operacion: e.target.value }))} />
            </div>

            <FormFooter saving={saving} editandoId={editandoId}
              onCancel={() => { setModalDeuda(false); setEditandoId(null) }} />
          </form>
        )}

        {/* ── Formulario PRÉSTAMO ── */}
        {tipoSeleccionado === 'prestamo' && (
          <form onSubmit={handleSaveDeuda} className="space-y-4">

            {/* Emoji + Nombre */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="ff-label">Emoji</label>
                <input className="ff-input text-center text-xl" maxLength={2}
                  value={formPrestamo.emoji}
                  onChange={e => setFormPrestamo(p => ({ ...p, emoji: e.target.value }))} />
              </div>
              <div className="col-span-3">
                <label className="ff-label">Nombre del préstamo</label>
                <input className="ff-input" required placeholder="Ej: Préstamo coche, Préstamo esposo..."
                  value={formPrestamo.nombre}
                  onChange={e => setFormPrestamo(p => ({ ...p, nombre: e.target.value }))} />
              </div>
            </div>

            {/* Categoría */}
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'deseo', l: 'Gasto Deseo' }, { v: 'basicos', l: 'Gasto Básico' }].map(c => (
                <button type="button" key={c.v}
                  onClick={() => setFormPrestamo(p => ({ ...p, categoria: c.v }))}
                  className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                  style={{
                    background: formPrestamo.categoria === c.v ? 'rgba(45,122,95,0.1)' : 'var(--bg-secondary)',
                    color: formPrestamo.categoria === c.v ? '#2D7A5F' : 'var(--text-muted)',
                    border: `1px solid ${formPrestamo.categoria === c.v ? 'rgba(45,122,95,0.3)' : 'var(--border-glass)'}`,
                  }}>
                  {c.l}
                </button>
              ))}
            </div>

            {/* Capital */}
            <div>
              <label className="ff-label">Capital prestado (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                value={formPrestamo.capital}
                onChange={e => setFormPrestamo(p => ({ ...p, capital: e.target.value }))} />
            </div>

            {/* Toggle interés */}
            <div>
              <label className="ff-label mb-2 block">Tipo de interés</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ v: false, l: '0% — Sin interés' }, { v: true, l: 'Con interés' }].map(c => (
                  <button type="button" key={String(c.v)}
                    onClick={() => setFormPrestamo(p => ({ ...p, tiene_interes: c.v, tasa_interes: '' }))}
                    className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                    style={{
                      background: formPrestamo.tiene_interes === c.v ? 'rgba(192,96,90,0.1)' : 'var(--bg-secondary)',
                      color: formPrestamo.tiene_interes === c.v ? '#C0605A' : 'var(--text-muted)',
                      border: `1px solid ${formPrestamo.tiene_interes === c.v ? 'rgba(192,96,90,0.3)' : 'var(--border-glass)'}`,
                    }}>
                    {c.l}
                  </button>
                ))}
              </div>
              {formPrestamo.tiene_interes && (
                <div className="mt-2">
                  <label className="ff-label">Tasa anual (%)</label>
                  <input className="ff-input" type="number" min="0" step="0.1" placeholder="Ej: 5.5"
                    value={formPrestamo.tasa_interes}
                    onChange={e => setFormPrestamo(p => ({ ...p, tasa_interes: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Toggle plazo */}
            <div>
              <label className="ff-label mb-2 block">Plazo de devolución</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ v: false, l: 'Plazo fijo' }, { v: true, l: 'Pago libre' }].map(c => (
                  <button type="button" key={String(c.v)}
                    onClick={() => setFormPrestamo(p => ({ ...p, plazo_libre: c.v, plazo_meses: '' }))}
                    className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                    style={{
                      background: formPrestamo.plazo_libre === c.v ? 'rgba(74,111,165,0.1)' : 'var(--bg-secondary)',
                      color: formPrestamo.plazo_libre === c.v ? '#4A6FA5' : 'var(--text-muted)',
                      border: `1px solid ${formPrestamo.plazo_libre === c.v ? 'rgba(74,111,165,0.3)' : 'var(--border-glass)'}`,
                    }}>
                    {c.l}
                  </button>
                ))}
              </div>
              {!formPrestamo.plazo_libre && (
                <div className="mt-2">
                  <label className="ff-label">Plazo (meses)</label>
                  <input className="ff-input" type="number" min="1" placeholder="Ej: 48"
                    value={formPrestamo.plazo_meses}
                    onChange={e => setFormPrestamo(p => ({ ...p, plazo_meses: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Preview cuota */}
            {formPrestamo.capital && !formPrestamo.plazo_libre && formPrestamo.plazo_meses && (
              <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                style={{ background: 'rgba(192,96,90,0.08)', color: '#C0605A' }}>
                Cuota mensual estimada:{' '}
                <span className="font-black">
                  {formatCurrency(calcularCuota(
                    parseFloat(formPrestamo.capital),
                    formPrestamo.tiene_interes ? parseFloat(formPrestamo.tasa_interes) || 0 : 0,
                    parseInt(formPrestamo.plazo_meses)
                  ))}
                </span>
              </div>
            )}

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ff-label">Primer pago</label>
                <input className="ff-input" type="date"
                  value={formPrestamo.fecha_primer_pago}
                  onChange={e => setFormPrestamo(p => ({ ...p, fecha_primer_pago: e.target.value }))} />
              </div>
            </div>

            {/* Día de pago mensual */}
            <div>
              <label className="ff-label">Día de pago mensual</label>
              <input className="ff-input" type="number" min="1" max="31" placeholder="Ej: 5"
                value={formPrestamo.dia_pago}
                onChange={e => setFormPrestamo(p => ({ ...p, dia_pago: e.target.value }))} />
            </div>

            <FormFooter saving={saving} editandoId={editandoId}
              onCancel={() => { setModalDeuda(false); setEditandoId(null) }} />
          </form>
        )}

        {/* ── Formulario CUOTA ── */}
        {tipoSeleccionado === 'cuota' && (
          <form onSubmit={handleSaveDeuda} className="space-y-4">

            {/* Info contextual */}
            <div className="px-3 py-2.5 rounded-xl text-[10px] leading-relaxed"
              style={{ background: 'rgba(193,122,58,0.08)', color: '#C17A3A', border: '1px solid rgba(193,122,58,0.2)' }}>
              <strong>Cuota mensual:</strong> selecciona una deuda existente para crear su cuota mensual,
              o rellena manualmente si es un pago recurrente nuevo.
            </div>

            {/* Selector de deuda existente */}
            {deudas.filter(d => d.tipo_deuda !== 'cuota' && d.estado !== 'pagada').length > 0 && (
              <div>
                <label className="ff-label">Traer cuota de una deuda existente (opcional)</label>
                <select className="ff-input"
                  value={formCuota.deuda_origen_id}
                  onChange={e => {
                    const id = e.target.value
                    const d = deudas.find(x => x.id === id)
                    if (d) {
                      setFormCuota(p => ({
                        ...p,
                        deuda_origen_id: id,
                        nombre: `Cuota ${d.nombre}`,
                        emoji: d.emoji || '📅',
                        monto: d.cuota?.toString() || d.pendiente?.toString() || '',
                        dia_pago: d.dia_pago?.toString() || '',
                        color: d.color || '#C17A3A',
                        categoria: d.categoria || 'deseo',
                      }))
                    } else {
                      setFormCuota(p => ({ ...p, deuda_origen_id: '' }))
                    }
                  }}>
                  <option value="">— Rellenar manualmente —</option>
                  {deudas
                    .filter(d => d.tipo_deuda !== 'cuota' && d.estado !== 'pagada')
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.emoji} {d.nombre} · {d.cuota > 0 ? `${formatCurrency(d.cuota)}/mes` : `Pendiente ${formatCurrency(d.pendiente)}`}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Emoji + Nombre */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="ff-label">Emoji</label>
                <input className="ff-input text-center text-xl" maxLength={2}
                  value={formCuota.emoji}
                  onChange={e => setFormCuota(p => ({ ...p, emoji: e.target.value }))} />
              </div>
              <div className="col-span-3">
                <label className="ff-label">Nombre de la cuota</label>
                <input className="ff-input" required placeholder="Ej: Cuota préstamo coche, Letra Visa..."
                  value={formCuota.nombre}
                  onChange={e => setFormCuota(p => ({ ...p, nombre: e.target.value }))} />
              </div>
            </div>

            {/* Categoría */}
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'deseo', l: 'Gasto Deseo' }, { v: 'basicos', l: 'Gasto Básico' }].map(c => (
                <button type="button" key={c.v}
                  onClick={() => setFormCuota(p => ({ ...p, categoria: c.v }))}
                  className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                  style={{
                    background: formCuota.categoria === c.v ? 'rgba(45,122,95,0.1)' : 'var(--bg-secondary)',
                    color: formCuota.categoria === c.v ? '#2D7A5F' : 'var(--text-muted)',
                    border: `1px solid ${formCuota.categoria === c.v ? 'rgba(45,122,95,0.3)' : 'var(--border-glass)'}`,
                  }}>
                  {c.l}
                </button>
              ))}
            </div>

            {/* Monto + día */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ff-label">Monto de la letra (€)</label>
                <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                  value={formCuota.monto}
                  onChange={e => setFormCuota(p => ({ ...p, monto: e.target.value }))} />
              </div>
              <div>
                <label className="ff-label">Día de pago</label>
                <input className="ff-input" type="number" min="1" max="31" placeholder="Ej: 1" required
                  value={formCuota.dia_pago}
                  onChange={e => setFormCuota(p => ({ ...p, dia_pago: e.target.value }))} />
              </div>
            </div>

            <FormFooter saving={saving} editandoId={editandoId}
              onCancel={() => { setModalDeuda(false); setEditandoId(null) }} />
          </form>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL: Movimiento manual (cargo / pago)
      ═══════════════════════════════════════════════════════════════════ */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)}
        title={formMov.tipo === 'pago' ? 'Registrar Pago' : 'Registrar Cargo'}>
        <form onSubmit={handleAddMov} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl">
            {[{ v: 'cargo', l: '↓ Cargo' }, { v: 'pago', l: '↑ Pago' }].map(t => (
              <button type="button" key={t.v}
                onClick={() => setFormMov(p => ({ ...p, tipo: t.v }))}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formMov.tipo === t.v ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400'}`}>
                {t.l}
              </button>
            ))}
          </div>
          <div>
            <label className="ff-label">Descripción</label>
            <input className="ff-input" required
              placeholder={formMov.tipo === 'pago' ? 'Ej: Pago mensual' : 'Ej: Compra supermercado...'}
              value={formMov.descripcion}
              onChange={e => setFormMov(p => ({ ...p, descripcion: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Monto (€)</label>
              <input className="ff-input text-lg font-black" type="number" step="0.01" placeholder="0.00" required
                value={formMov.monto}
                onChange={e => setFormMov(p => ({ ...p, monto: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Fecha</label>
              <input className="ff-input" type="date" required
                value={formMov.fecha}
                onChange={e => setFormMov(p => ({ ...p, fecha: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalMov(null)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ background: formMov.tipo === 'pago' ? '#10b981' : '#C0605A' }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : formMov.tipo === 'pago' ? 'Confirmar Pago' : 'Registrar Cargo'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}

// ─── Sub-componente reutilizable para los botones del form ────────────────────

function FormFooter({ saving, editandoId, onCancel }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onCancel} className="ff-btn-ghost flex-1">Cancelar</button>
      <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
        {saving && <Loader2 size={14} className="animate-spin" />}
        {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear deuda'}
      </button>
    </div>
  )
}