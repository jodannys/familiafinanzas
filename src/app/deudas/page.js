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

// Usa CSS vars — funciona en style={{}} HTML
function urgenciaColor(dias) {
  if (dias === null) return null
  if (dias <= 3) return {
    bg:    'color-mix(in srgb, var(--accent-rose)  10%, transparent)',
    text:  'var(--accent-rose)',
    label: `¡Vence en ${dias}d!`,
  }
  if (dias <= 7) return {
    bg:    'color-mix(in srgb, var(--accent-terra) 10%, transparent)',
    text:  'var(--accent-terra)',
    label: `Vence en ${dias}d`,
  }
  return {
    bg:    'color-mix(in srgb, var(--accent-green) 10%, transparent)',
    text:  'var(--accent-green)',
    label: `${dias}d para pago`,
  }
}

// Colores de tipo usando CSS vars
const TIPO_CONFIG = {
  tarjeta: { label: 'Tarjeta',  icon: CreditCard, color: 'var(--accent-violet)' },
  prestamo: { label: 'Préstamo', icon: Landmark,   color: 'var(--accent-rose)'   },
  cuota:   { label: 'Cuota',    icon: Calendar,   color: 'var(--accent-terra)'   },
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
// Los colores de estos forms son datos del usuario (se guardan en DB), se mantienen como hex

const FORM_TARJETA = {
  tipo_deuda: 'tarjeta', emoji: '💳', nombre: '', categoria: 'deseo',
  tarjeta_id: '', limite: '', monto_compra: '', num_cuotas: '',
  fecha_operacion: new Date().toISOString().slice(0, 10), color: '#818CF8',
}
const FORM_PRESTAMO = {
  tipo_deuda: 'prestamo', emoji: '🏦', nombre: '', categoria: 'basicos',
  capital: '', tasa_interes: '', tiene_interes: false,
  plazo_meses: '', plazo_libre: false, fecha_primer_pago: '', dia_pago: '', color: '#C0605A',
}
const FORM_CUOTA = {
  tipo_deuda: 'cuota', emoji: '📅', nombre: '', categoria: 'deseo',
  deuda_origen_id: '', monto: '', dia_pago: '', color: '#C17A3A',
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
  const [misTarjetas, setMisTarjetas] = useState([])

  const [modalDeuda, setModalDeuda] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('tarjeta')
  const [formTarjeta, setFormTarjeta] = useState(FORM_TARJETA)
  const [formPrestamo, setFormPrestamo] = useState(FORM_PRESTAMO)
  const [formCuota, setFormCuota] = useState(FORM_CUOTA)

  const [modalMov, setModalMov] = useState(null)
  const [formMov, setFormMov] = useState({
    tipo: 'cargo', descripcion: '', monto: '',
    fecha: new Date().toISOString().slice(0, 10),
  })

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true); setError(null)
    try {
      const [{ data: deudasData, error: e1 }, { data: tarjetasData, error: e2 }] = await Promise.all([
        supabase.from('deudas').select('*'),
        supabase.from('perfiles_tarjetas').select('*').eq('estado', 'activa'),
      ])
      if (e1) throw e1
      if (e2) console.error('Error tarjetas:', e2.message)

      const deudasOrdenadas = (deudasData || []).sort((a, b) => {
        if (!a.fecha_vencimiento) return 1
        if (!b.fecha_vencimiento) return -1
        return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento)
      })
      setDeudas(deudasOrdenadas)
      setMisTarjetas(tarjetasData || [])

      if (deudasOrdenadas.length) {
        const { data: movs, error: e3 } = await supabase
          .from('deuda_movimientos').select('*').order('fecha', { ascending: false })
        if (!e3) {
          const grouped = {}
          ;(movs || []).forEach(m => {
            if (!grouped[m.deuda_id]) grouped[m.deuda_id] = []
            grouped[m.deuda_id].push(m)
          })
          setMovimientos(grouped)
        }
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  function abrirNueva() {
    setEditandoId(null)
    setTipoSeleccionado('tarjeta')
    setFormTarjeta(FORM_TARJETA)
    setFormPrestamo(FORM_PRESTAMO)
    setFormCuota(FORM_CUOTA)
    setModalDeuda(true)
  }

  function abrirEdicion(d) {
    setEditandoId(d.id)
    setTipoSeleccionado(d.tipo_deuda || 'tarjeta')
    if (d.tipo_deuda === 'tarjeta') {
      setFormTarjeta({
        tipo_deuda: 'tarjeta', emoji: d.emoji || '💳', nombre: d.nombre || '',
        categoria: d.categoria || 'deseo', tarjeta_id: '',
        limite: d.limite?.toString() || '', monto_compra: d.capital?.toString() || '',
        num_cuotas: d.plazo_meses?.toString() || '',
        fecha_operacion: new Date().toISOString().slice(0, 10), color: d.color || '#818CF8',
      })
    } else if (d.tipo_deuda === 'prestamo') {
      setFormPrestamo({
        tipo_deuda: 'prestamo', emoji: d.emoji || '🏦', nombre: d.nombre || '',
        categoria: d.categoria || 'basicos', capital: d.capital?.toString() || '',
        tasa_interes: (d.tasa_interes || d.tasa || 0).toString(),
        tiene_interes: (d.tasa_interes || d.tasa || 0) > 0,
        plazo_meses: d.plazo_meses?.toString() || '', plazo_libre: !d.plazo_meses,
        fecha_primer_pago: d.fecha_primer_pago || '', dia_pago: d.dia_pago?.toString() || '',
        color: d.color || '#C0605A',
      })
    } else {
      setFormCuota({
        tipo_deuda: 'cuota', emoji: d.emoji || '📅', nombre: d.nombre || '',
        categoria: d.categoria || 'deseo', monto: d.cuota?.toString() || '',
        dia_pago: d.dia_pago?.toString() || '', color: d.color || '#C17A3A',
      })
    }
    setModalDeuda(true)
  }

  function handleSeleccionarTarjetaPerfil(id) {
    const t = misTarjetas.find(x => x.id === id)
    if (!t) return
    setFormTarjeta(prev => ({
      ...prev, tarjeta_id: t.id, limite: t.limite_credito?.toString() || '',
      color: t.color || '#818CF8', dia_pago: t.dia_pago?.toString() || prev.dia_pago || '',
    }))
  }

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
        tipo_deuda: 'tarjeta', tipo: 'debo', emoji: f.emoji, nombre: f.nombre,
        categoria: f.categoria, limite: parseFloat(f.limite) || 0,
        capital, monto: capital, pendiente: capital, cuota, plazo_meses: meses,
        perfil_tarjeta_id: f.tarjeta_id || null, tasa: 0, tasa_interes: 0,
        dia_pago: null, color: f.color, estado: 'activa', pagadas: 0,
      }
    } else if (tipoSeleccionado === 'prestamo') {
      const f = formPrestamo
      const capital = parseFloat(f.capital) || 0
      const tasa = f.tiene_interes ? (parseFloat(f.tasa_interes) || 0) : 0
      const meses = f.plazo_libre ? null : (parseInt(f.plazo_meses) || null)
      const cuota = meses ? parseFloat(calcularCuota(capital, tasa, meses).toFixed(2)) : 0
      payload = {
        tipo_deuda: 'prestamo', tipo: 'debo', emoji: f.emoji, nombre: f.nombre,
        categoria: f.categoria, capital, monto: capital, pendiente: capital,
        tasa, tasa_interes: tasa, plazo_meses: meses, cuota,
        fecha_primer_pago: f.fecha_primer_pago || null, dia_pago: parseInt(f.dia_pago) || null,
        color: f.color, estado: 'activa', pagadas: 0,
      }
    } else {
      const f = formCuota
      const monto = parseFloat(f.monto) || 0
      if (f.deuda_origen_id && !editandoId) {
        const deudaOrigen = deudas.find(d => d.id === f.deuda_origen_id)
        if (deudaOrigen) {
          const nuevoPendiente = Math.max(0, (deudaOrigen.pendiente || 0) - monto)
          const nuevosPagados = (deudaOrigen.pagadas || 0) + 1
          const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
          const hoy = new Date()
          let fechaVence = null
          if (f.dia_pago) {
            fechaVence = new Date(hoy.getFullYear(), hoy.getMonth(), parseInt(f.dia_pago))
            if (fechaVence < hoy) fechaVence.setMonth(fechaVence.getMonth() + 1)
          }
          payload.fecha_vencimiento = fechaVence
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
            ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado } : d))
        }
        setSaving(false); setModalDeuda(false); setEditandoId(null); return
      }
      payload = {
        tipo_deuda: 'cuota', tipo: 'debo', emoji: f.emoji, nombre: f.nombre,
        categoria: f.categoria, cuota: monto, monto, capital: monto, pendiente: monto,
        dia_pago: parseInt(f.dia_pago) || null, color: f.color,
        estado: 'activa', pagadas: 0, tasa: 0, tasa_interes: 0,
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
    setSaving(false); setModalDeuda(false); setEditandoId(null)
  }

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
      ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado } : d))
    setSaving(false)
  }

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
        ? { ...d, pendiente: nuevoPendiente, monto: nuevoMontoTotal, pagadas: nuevosPagados, estado: nuevoEstado } : d))
      setModalMov(null)
      setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10) })
    }
    setSaving(false)
  }

  async function handleDeleteMov(mov) {
    if (!confirm('¿Eliminar este movimiento y revertir el pendiente?')) return
    const deuda = deudas.find(d => d.id === mov.deuda_id)
    if (!deuda) return
    const { error } = await supabase.from('deuda_movimientos').delete().eq('id', mov.id)
    if (error) { setError(error.message); return }
    let nuevoPendiente = deuda.pendiente || 0
    let nuevosPagados = deuda.pagadas || 0
    if (mov.tipo === 'pago') {
      nuevoPendiente = Math.min(deuda.monto || nuevoPendiente + mov.monto, nuevoPendiente + mov.monto)
      nuevosPagados = Math.max(0, nuevosPagados - 1)
      await supabase.from('movimientos').delete()
        .eq('categoria', 'deuda').eq('monto', mov.monto).ilike('descripcion', `%${deuda.nombre}%`)
    } else {
      nuevoPendiente = Math.max(0, nuevoPendiente - mov.monto)
    }
    const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
    await supabase.from('deudas').update({
      pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
    }).eq('id', mov.deuda_id)
    setDeudas(prev => prev.map(d => d.id === mov.deuda_id
      ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado } : d))
    setMovimientos(prev => ({
      ...prev,
      [mov.deuda_id]: (prev[mov.deuda_id] || []).filter(m => m.id !== mov.id)
    }))
  }

  async function handleDeleteDeuda(id) {
    if (!confirm('¿Estás seguro de eliminar esta deuda y todos sus registros asociados?')) return
    setSaving(true)
    try {
      const { error: err1 } = await supabase.from('deuda_movimientos').delete().eq('deuda_id', id)
      if (err1) throw new Error('Error al borrar movimientos: ' + err1.message)
      const deuda = deudas.find(d => d.id === id)
      if (deuda) {
        await supabase.from('movimientos').delete()
          .eq('categoria', 'deuda').ilike('descripcion', `%${deuda.nombre}%`)
      }
      const { error: err2 } = await supabase.from('deudas').delete().eq('id', id)
      if (err2) throw new Error('Error al borrar la deuda: ' + err2.message)
      setDeudas(prev => prev.filter(d => d.id !== id))
      if (cardActiva === id) setCardActiva(null)
    } catch (err) {
      console.error(err); alert(err.message)
    } finally { setSaving(false) }
  }

  const activas = deudas.filter(d => d.estado !== 'pagada')
  const totalDeuda = activas.reduce((s, d) => s + (d.pendiente || 0), 0)
  const cuotasMes = activas.reduce((s, d) => s + (d.cuota || 0), 0)
  const vencenProximo = activas.filter(d => { const dias = diasHastaPago(d.dia_pago); return dias !== null && dias <= 7 }).length

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5"
            style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl font-black tracking-tight truncate"
            style={{ color: 'var(--text-primary)' }}>Mis Deudas</h1>
        </div>
        <button onClick={abrirNueva} className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-bold">Nueva deuda</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2"
          style={{
            background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
            border:     '1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)',
            color:      'var(--accent-rose)',
          }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: 'Deuda total',     value: formatCurrency(totalDeuda),  color: 'var(--accent-rose)'  },
          { label: 'Letras este mes', value: formatCurrency(cuotasMes),   color: 'var(--accent-terra)' },
          {
            label: 'Vencen pronto',
            value: vencenProximo > 0 ? `${vencenProximo} deuda${vencenProximo > 1 ? 's' : ''}` : 'Al día ✓',
            color: vencenProximo > 0 ? 'var(--accent-rose)' : 'var(--accent-green)',
          },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] uppercase tracking-wider font-bold mb-1"
              style={{ color: 'var(--text-muted)' }}>{s.label}</p>
            <p className="text-sm font-black" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : deudas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>No hay deudas registradas</p>
          <button onClick={abrirNueva} className="ff-btn-primary">Agregar primera deuda</button>
        </div>
      ) : (
        <div className="space-y-3">
          {deudas.map((d, i) => {
            const diasFaltantes = d.fecha_vencimiento
              ? Math.ceil((new Date(d.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
              : null
            const cfg = TIPO_CONFIG[d.tipo_deuda] || TIPO_CONFIG.tarjeta
            const pct = d.monto > 0 ? Math.min(100, Math.round(((d.monto - (d.pendiente || 0)) / d.monto) * 100)) : 0
            const dias = diasHastaPago(d.dia_pago)
            const urgencia = urgenciaColor(dias)
            const isExp = expandido === d.id
            const isActiva = cardActiva === d.id
            const movsDeuda = movimientos[d.id] || []
            const esCuota = d.tipo_deuda === 'cuota'
            const pagadaHoy = movsDeuda.some(m =>
              m.tipo === 'pago' && m.fecha?.slice(0, 7) === new Date().toISOString().slice(0, 7)
            )

            return (
              <Card key={d.id}
                className="animate-enter overflow-hidden cursor-pointer select-none"
                style={{ animationDelay: `${i * 0.04}s`, padding: '14px 16px' }}
                onClick={() => setCardActiva(isActiva ? null : d.id)}>

                {/* Badge de vencimiento */}
                {diasFaltantes !== null && (
                  <div className="absolute top-2 right-2">
                    <div className="text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter"
                      style={{
                        background: diasFaltantes <= 3
                          ? 'color-mix(in srgb, var(--accent-rose)  15%, transparent)'
                          : 'color-mix(in srgb, var(--accent-green) 15%, transparent)',
                        color: diasFaltantes <= 3 ? 'var(--accent-rose)' : 'var(--accent-green)',
                        animation: diasFaltantes <= 3 ? 'pulse 2s infinite' : 'none',
                      }}>
                      {diasFaltantes <= 0 ? '¡Vence hoy!' : `Vence en ${diasFaltantes}d`}
                    </div>
                  </div>
                )}

                {/* Fila principal */}
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${d.color || cfg.color}18` }}>
                    <span>{d.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate text-sm leading-tight"
                      style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {/* Badge tipo */}
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full"
                        style={{ background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      {/* Badge categoría */}
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: d.categoria === 'basicos'
                            ? 'color-mix(in srgb, var(--accent-blue)  10%, transparent)'
                            : 'color-mix(in srgb, var(--accent-terra) 10%, transparent)',
                          color: d.categoria === 'basicos' ? 'var(--accent-blue)' : 'var(--accent-terra)',
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
                          style={{
                            background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                            color: 'var(--accent-green)',
                          }}>
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
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>pendiente</p>
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
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {d.pagadas || 0}/{d.plazo_meses} cuotas
                    </span>
                  )}
                  {!d.plazo_meses && d.tipo_deuda === 'prestamo' && (
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Pago flexible</span>
                  )}
                  {d.dia_pago && (
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Pago día {d.dia_pago}</span>
                  )}
                  {d.estado === 'pagada' && (
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                      style={{
                        background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                        color: 'var(--accent-green)',
                      }}>
                      ¡Saldada!
                    </span>
                  )}
                </div>

                {/* Acciones */}
                <div className={`transition-all duration-200 overflow-hidden ${isActiva ? 'max-h-16 opacity-100 mt-3 pt-3 border-t' : 'max-h-0 opacity-0'}`}
                  style={{ borderColor: 'var(--border-glass)' }}>
                  <div className="flex items-center gap-2 flex-wrap">

                    {(esCuota || (d.tipo_deuda === 'prestamo' && d.cuota > 0)) && d.estado !== 'pagada' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleMarcarPagada(d) }}
                        disabled={saving || pagadaHoy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 disabled:opacity-40"
                        style={{
                          background: pagadaHoy
                            ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)'
                            : 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                          color: 'var(--accent-green)',
                        }}>
                        <Check size={11} strokeWidth={3} />
                        {pagadaHoy ? 'Ya pagada' : 'Marcar pagada'}
                      </button>
                    )}

                    <IconBtn
                      onClick={() => { setModalMov(d.id); setFormMov({ tipo: 'cargo', descripcion: 'Nuevo cargo', monto: '', fecha: new Date().toISOString().split('T')[0] }) }}
                      title="Registrar cargo"
                      bg="color-mix(in srgb, var(--accent-rose) 10%, transparent)"
                      color="var(--accent-rose)">
                      <ArrowDownRight size={13} strokeWidth={2.5} />
                    </IconBtn>

                    <IconBtn
                      onClick={() => { setModalMov(d.id); setFormMov({ tipo: 'pago', descripcion: `Pago ${d.nombre}`, monto: d.cuota || d.pendiente || '', fecha: new Date().toISOString().split('T')[0] }) }}
                      title="Registrar pago"
                      bg="color-mix(in srgb, var(--accent-green) 10%, transparent)"
                      color="var(--accent-green)">
                      <ArrowUpRight size={13} strokeWidth={2.5} />
                    </IconBtn>

                    <IconBtn onClick={() => setExpandido(isExp ? null : d.id)}
                      title="Ver historial" bg="var(--bg-secondary)" color="var(--text-muted)">
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </IconBtn>

                    <IconBtn onClick={() => abrirEdicion(d)} title="Editar"
                      bg="color-mix(in srgb, var(--accent-blue) 10%, transparent)"
                      color="var(--accent-blue)">
                      <Pencil size={12} />
                    </IconBtn>

                    <IconBtn onClick={() => handleDeleteDeuda(d.id)} title="Eliminar"
                      bg="color-mix(in srgb, var(--accent-rose) 8%, transparent)"
                      color="var(--accent-rose)">
                      <Trash2 size={12} />
                    </IconBtn>
                  </div>
                </div>

                {/* Historial expandido */}
                {isExp && (
                  <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: 'var(--border-glass)' }}>
                    {movsDeuda.length === 0 ? (
                      <p className="text-[10px] italic text-center py-2" style={{ color: 'var(--text-muted)' }}>
                        Sin movimientos aún
                      </p>
                    ) : movsDeuda.map(m => (
                      <div key={m.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors"
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: m.tipo === 'pago'
                              ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)'
                              : 'color-mix(in srgb, var(--accent-rose)  10%, transparent)',
                          }}>
                          {m.tipo === 'pago'
                            ? <ArrowUpRight   size={11} style={{ color: 'var(--accent-green)' }} />
                            : <ArrowDownRight size={11} style={{ color: 'var(--accent-rose)'  }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                            {m.descripcion}
                          </p>
                          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <p className="text-xs font-black tabular-nums"
                            style={{ color: m.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                            {m.tipo === 'pago' ? '-' : '+'}{formatCurrency(m.monto)}
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); handleDeleteMov(m) }}
                            className="p-1 rounded-lg transition-opacity"
                            style={{ color: 'var(--accent-rose)', opacity: 0.3 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.3'}
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

      {/* ── MODAL CREAR / EDITAR ── */}
      <Modal
        open={modalDeuda}
        onClose={() => { setModalDeuda(false); setEditandoId(null) }}
        title={editandoId ? 'Editar Deuda' : 'Nueva Deuda'}>
        <div className="overflow-y-auto pr-1" style={{ maxHeight: 'min(calc(100dvh - 120px), 680px)' }}>

          {!editandoId && (
            <div className="grid grid-cols-3 gap-2 mb-5">
              {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
                <button type="button" key={key}
                  onClick={() => setTipoSeleccionado(key)}
                  className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                  style={{
                    background: tipoSeleccionado === key ? `color-mix(in srgb, ${cfg.color} 15%, transparent)` : 'var(--bg-secondary)',
                    color:  tipoSeleccionado === key ? cfg.color : 'var(--text-muted)',
                    border: `1px solid ${tipoSeleccionado === key ? `color-mix(in srgb, ${cfg.color} 40%, transparent)` : 'var(--border-glass)'}`,
                  }}>
                  {cfg.label}
                </button>
              ))}
            </div>
          )}

          {/* ── TARJETA ── */}
          {tipoSeleccionado === 'tarjeta' && (
            <form onSubmit={handleSaveDeuda} className="space-y-4">
              {!editandoId && misTarjetas.length > 0 && (
                <div className="p-3 rounded-2xl border border-dashed"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--accent-violet) 30%, transparent)',
                    background:  'color-mix(in srgb, var(--accent-violet) 4%, transparent)',
                  }}>
                  <label className="text-[10px] font-black uppercase mb-2 block"
                    style={{ color: 'var(--accent-violet)' }}>
                    Selecciona la tarjeta usada
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {misTarjetas.map(t => (
                      <button key={t.id} type="button"
                        onClick={() => handleSeleccionarTarjetaPerfil(t.id)}
                        className="flex-shrink-0 px-3 py-2 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center gap-2"
                        style={{
                          borderColor: formTarjeta.tarjeta_id === t.id ? t.color : `${t.color}40`,
                          color: t.color,
                          background: formTarjeta.tarjeta_id === t.id ? `${t.color}12` : 'var(--bg-card)',
                          boxShadow: formTarjeta.tarjeta_id === t.id ? `0 0 0 2px ${t.color}30` : '',
                        }}>
                        <CreditCard size={12} />
                        {t.nombre_tarjeta}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="ff-label">Emoji</label>
                  <input className="ff-input text-center text-xl" maxLength={2}
                    value={formTarjeta.emoji}
                    onChange={e => setFormTarjeta(p => ({ ...p, emoji: e.target.value }))} />
                </div>
                <div className="col-span-3">
                  <label className="ff-label">¿Qué compraste?</label>
                  <input className="ff-input" required placeholder="Ej: Nevera nueva..."
                    value={formTarjeta.nombre}
                    onChange={e => setFormTarjeta(p => ({ ...p, nombre: e.target.value }))} />
                </div>
              </div>
              <CategoriaToggle value={formTarjeta.categoria} onChange={v => setFormTarjeta(p => ({ ...p, categoria: v }))} />
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
              {formTarjeta.monto_compra && formTarjeta.num_cuotas && (
                <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-violet) 8%, transparent)',
                    color: 'var(--accent-violet)',
                  }}>
                  Cuota mensual estimada:{' '}
                  <span className="font-black">
                    {formatCurrency(parseFloat(formTarjeta.monto_compra) / parseInt(formTarjeta.num_cuotas) || 0)}
                  </span>
                </div>
              )}
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

          {/* ── PRÉSTAMO ── */}
          {tipoSeleccionado === 'prestamo' && (
            <form onSubmit={handleSaveDeuda} className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="ff-label">Emoji</label>
                  <input className="ff-input text-center text-xl" maxLength={2}
                    value={formPrestamo.emoji}
                    onChange={e => setFormPrestamo(p => ({ ...p, emoji: e.target.value }))} />
                </div>
                <div className="col-span-3">
                  <label className="ff-label">Nombre del préstamo</label>
                  <input className="ff-input" required placeholder="Ej: Préstamo coche..."
                    value={formPrestamo.nombre}
                    onChange={e => setFormPrestamo(p => ({ ...p, nombre: e.target.value }))} />
                </div>
              </div>
              <CategoriaToggle value={formPrestamo.categoria} onChange={v => setFormPrestamo(p => ({ ...p, categoria: v }))} />
              <div>
                <label className="ff-label">Capital prestado (€)</label>
                <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                  value={formPrestamo.capital}
                  onChange={e => setFormPrestamo(p => ({ ...p, capital: e.target.value }))} />
              </div>
              <div>
                <label className="ff-label mb-2 block">Tipo de interés</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: false, l: '0% — Sin interés' }, { v: true, l: 'Con interés' }].map(c => (
                    <button type="button" key={String(c.v)}
                      onClick={() => setFormPrestamo(p => ({ ...p, tiene_interes: c.v, tasa_interes: '' }))}
                      className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                      style={{
                        background: formPrestamo.tiene_interes === c.v ? 'color-mix(in srgb, var(--accent-rose) 10%, transparent)' : 'var(--bg-secondary)',
                        color: formPrestamo.tiene_interes === c.v ? 'var(--accent-rose)' : 'var(--text-muted)',
                        border: `1px solid ${formPrestamo.tiene_interes === c.v ? 'color-mix(in srgb, var(--accent-rose) 30%, transparent)' : 'var(--border-glass)'}`,
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
              <div>
                <label className="ff-label mb-2 block">Plazo de devolución</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: false, l: 'Plazo fijo' }, { v: true, l: 'Pago libre' }].map(c => (
                    <button type="button" key={String(c.v)}
                      onClick={() => setFormPrestamo(p => ({ ...p, plazo_libre: c.v, plazo_meses: '' }))}
                      className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                      style={{
                        background: formPrestamo.plazo_libre === c.v ? 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' : 'var(--bg-secondary)',
                        color: formPrestamo.plazo_libre === c.v ? 'var(--accent-blue)' : 'var(--text-muted)',
                        border: `1px solid ${formPrestamo.plazo_libre === c.v ? 'color-mix(in srgb, var(--accent-blue) 30%, transparent)' : 'var(--border-glass)'}`,
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
              {formPrestamo.capital && !formPrestamo.plazo_libre && formPrestamo.plazo_meses && (
                <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
                    color: 'var(--accent-rose)',
                  }}>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ff-label">Primer pago</label>
                  <input className="ff-input" type="date"
                    value={formPrestamo.fecha_primer_pago}
                    onChange={e => setFormPrestamo(p => ({ ...p, fecha_primer_pago: e.target.value }))} />
                </div>
              </div>
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

          {/* ── CUOTA ── */}
          {tipoSeleccionado === 'cuota' && (
            <form onSubmit={handleSaveDeuda} className="space-y-4">
              <div className="px-3 py-2.5 rounded-xl text-[10px] leading-relaxed"
                style={{
                  background: 'color-mix(in srgb, var(--accent-terra) 8%, transparent)',
                  color: 'var(--accent-terra)',
                  border: '1px solid color-mix(in srgb, var(--accent-terra) 20%, transparent)',
                }}>
                <strong>Cuota mensual:</strong> selecciona una deuda existente para crear su cuota mensual,
                o rellena manualmente si es un pago recurrente nuevo.
              </div>
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
                          ...p, deuda_origen_id: id, nombre: `Cuota ${d.nombre}`,
                          emoji: d.emoji || '📅', monto: d.cuota?.toString() || d.pendiente?.toString() || '',
                          dia_pago: d.dia_pago?.toString() || '', color: d.color || '#C17A3A',
                          categoria: d.categoria || 'deseo',
                        }))
                      } else {
                        setFormCuota(p => ({ ...p, deuda_origen_id: '' }))
                      }
                    }}>
                    <option value="">— Rellenar manualmente —</option>
                    {deudas.filter(d => d.tipo_deuda !== 'cuota' && d.estado !== 'pagada').map(d => (
                      <option key={d.id} value={d.id}>
                        {d.emoji} {d.nombre} · {d.cuota > 0 ? `${formatCurrency(d.cuota)}/mes` : `Pendiente ${formatCurrency(d.pendiente)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="ff-label">Emoji</label>
                  <input className="ff-input text-center text-xl" maxLength={2}
                    value={formCuota.emoji}
                    onChange={e => setFormCuota(p => ({ ...p, emoji: e.target.value }))} />
                </div>
                <div className="col-span-3">
                  <label className="ff-label">Nombre de la cuota</label>
                  <input className="ff-input" required placeholder="Ej: Cuota préstamo coche..."
                    value={formCuota.nombre}
                    onChange={e => setFormCuota(p => ({ ...p, nombre: e.target.value }))} />
                </div>
              </div>
              <CategoriaToggle value={formCuota.categoria} onChange={v => setFormCuota(p => ({ ...p, categoria: v }))} />
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
        </div>
      </Modal>

      {/* ── MODAL MOVIMIENTO ── */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)}
        title={formMov.tipo === 'pago' ? 'Registrar Pago' : 'Registrar Cargo'}>
        <form onSubmit={handleAddMov} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
            {[{ v: 'cargo', l: '↓ Cargo' }, { v: 'pago', l: '↑ Pago' }].map(t => (
              <button type="button" key={t.v}
                onClick={() => setFormMov(p => ({ ...p, tipo: t.v }))}
                className="py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                style={{
                  background: formMov.tipo === t.v ? 'var(--bg-card)' : 'transparent',
                  color: formMov.tipo === t.v ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: formMov.tipo === t.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
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
              style={{
                background: formMov.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)',
              }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : formMov.tipo === 'pago' ? 'Confirmar Pago' : 'Registrar Cargo'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}

// ── Componente reutilizable para toggle de categoría ─────────────────────────
function CategoriaToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[{ v: 'deseo', l: 'Gasto Deseo' }, { v: 'basicos', l: 'Gasto Básico' }].map(c => (
        <button type="button" key={c.v} onClick={() => onChange(c.v)}
          className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
          style={{
            background: value === c.v ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)' : 'var(--bg-secondary)',
            color:  value === c.v ? 'var(--accent-green)' : 'var(--text-muted)',
            border: `1px solid ${value === c.v ? 'color-mix(in srgb, var(--accent-green) 30%, transparent)' : 'var(--border-glass)'}`,
          }}>
          {c.l}
        </button>
      ))}
    </div>
  )
}

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