'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import {
  Plus, Loader2, Trash2, CreditCard, Landmark,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, MessageCircle,
  ArrowDownRight, ArrowUpRight, Calendar, Check, AlertCircle, Table2, X
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useTheme, getThemeColors } from '@/lib/themes'

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcularCuota(capital, tasaAnual, meses) {
  if (!capital || !meses) return 0
  if (!tasaAnual || tasaAnual === 0) return capital / meses
  const r = tasaAnual / 100 / 12
  return (capital * r) / (1 - Math.pow(1 + r, -meses))
}
function fechaHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  return diaPago >= hoy ? diaPago - hoy : 30 - hoy + diaPago
}

function urgenciaColor(dias) {
  if (dias === null) return null
  if (dias <= 3) return {
    bg: 'color-mix(in srgb, var(--accent-rose)  10%, transparent)',
    text: 'var(--accent-rose)',
    label: `¡Vence en ${dias}d!`,
  }
  if (dias <= 7) return {
    bg: 'color-mix(in srgb, var(--accent-terra) 10%, transparent)',
    text: 'var(--accent-terra)',
    label: `Vence en ${dias}d`,
  }
  return {
    bg: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
    text: 'var(--accent-green)',
    label: `${dias}d para pago`,
  }
}

// Genera tabla de amortización completa desde el período 1
function generarTablaAmortizacion(deuda, movs = []) {
  const meses = deuda.plazo_meses
  if (!meses) return []

  const capital = deuda.capital || deuda.monto || 0
  const cuota = deuda.cuota || 0
  const tasaMensual = (deuda.tasa_interes || deuda.tasa || 0) / 100 / 12

  // Fecha de inicio
  let fechaBase = deuda.fecha_primer_pago
    ? new Date(deuda.fecha_primer_pago + 'T12:00:00')
    : new Date(deuda.created_at || Date.now())

  let saldo = capital
  const rows = []

  for (let i = 0; i < meses; i++) {
    const f = new Date(fechaBase)
    f.setMonth(f.getMonth() + i)
    const mesNum = f.getMonth() + 1
    const añoNum = f.getFullYear()

    const interes = tasaMensual > 0 ? parseFloat((saldo * tasaMensual).toFixed(2)) : 0
    const capitalCuota = parseFloat((cuota - interes).toFixed(2))
    saldo = parseFloat(Math.max(0, saldo - capitalCuota).toFixed(2))

    // Buscar pago real en movimientos
    const pagoReal = movs.find(m => m.tipo === 'pago' && m.mes === mesNum && m.año === añoNum)

    rows.push({
      periodo: i + 1,
      mes: mesNum,
      año: añoNum,
      cuota,
      interes,
      capital: capitalCuota,
      saldo,
      pagada: !!pagoReal,
      montoPagado: pagoReal?.monto,
      fechaLabel: `${String(mesNum).padStart(2, '0')}/${añoNum}`,
    })
  }
  return rows
}

const TIPO_CONFIG = {
  tarjeta: { label: 'Tarjeta', icon: CreditCard, color: 'var(--accent-violet)' },
  prestamo: { label: 'Préstamo', icon: Landmark, color: 'var(--accent-rose)' },
  cuota: { label: 'Cuota', icon: Calendar, color: 'var(--accent-terra)' },
}

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick() }}
      title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 34, height: 34, flexShrink: 0 }}>
      {children}
    </button>
  )
}

// ─── Color picker reutilizable ────────────────────────────────────────────────

function ColorPicker({ value, onChange, colors }) {
  return (
    <div>
      <label className="ff-label">Color</label>
      <div className="flex gap-2 mt-1 flex-wrap">
        {colors.map(hex => (
          <button key={hex} type="button"
            onClick={() => onChange(hex)}
            className="w-8 h-8 rounded-full transition-all"
            style={{
              backgroundColor: hex,
              outline: value === hex ? '3px solid var(--text-secondary)' : 'none',
              outlineOffset: 2,
              opacity: value === hex ? 1 : 0.5,
              transform: value === hex ? 'scale(1.15)' : 'scale(1)',
            }} />
        ))}
      </div>
    </div>
  )
}

// Toggle Yo debo / Me deben
function TipoDeudorToggle({ value, onChange }) {
  return (
    <div>
      <label className="ff-label mb-2 block">Dirección de la deuda</label>
      <div className="grid grid-cols-2 gap-2">
        {[
          { v: 'debo', l: '💸 Yo debo', desc: 'Debo dinero a alguien' },
          { v: 'medeben', l: '🤝 Me deben', desc: 'Alguien me debe a mí' },
        ].map(c => (
          <button type="button" key={c.v} onClick={() => onChange(c.v)}
            className="py-2.5 px-3 rounded-xl text-[10px] font-semibold uppercase transition-all text-left"
            style={{
              background: value === c.v
                ? (c.v === 'debo'
                  ? 'color-mix(in srgb, var(--accent-rose) 12%, transparent)'
                  : 'color-mix(in srgb, var(--accent-green) 12%, transparent)')
                : 'var(--bg-secondary)',
              color: value === c.v
                ? (c.v === 'debo' ? 'var(--accent-rose)' : 'var(--accent-green)')
                : 'var(--text-muted)',
              border: `1px solid ${value === c.v
                ? (c.v === 'debo'
                  ? 'color-mix(in srgb, var(--accent-rose) 30%, transparent)'
                  : 'color-mix(in srgb, var(--accent-green) 30%, transparent)')
                : 'var(--border-glass)'}`,
            }}>
            <div>{c.l}</div>
            <div className="text-[8px] normal-case font-normal mt-0.5 opacity-70">{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DeudasPage() {
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)

  const defaultColor = () => themeColors[0] || '#818CF8'

  const makeFormTarjeta = () => ({ tipo_deuda: 'tarjeta', tipo: 'debo', emoji: '💳', nombre: '', categoria: 'deseo', tarjeta_id: '', limite: '', monto_compra: '', num_cuotas: '', fecha_operacion: fechaHoy(), dia_pago: '', color: defaultColor(), telefono: '' })
  const makeFormPrestamo = () => ({ tipo_deuda: 'prestamo', tipo: 'debo', emoji: '🏦', nombre: '', categoria: 'basicos', capital: '', tasa_interes: '', tiene_interes: false, plazo_meses: '', plazo_libre: false, fecha_primer_pago: '', dia_pago: '', color: defaultColor(), telefono: '' })
  const makeFormCuota = () => ({ tipo_deuda: 'cuota', tipo: 'debo', emoji: '📅', nombre: '', categoria: 'deseo', deuda_origen_id: '', monto: '', dia_pago: '', color: defaultColor(), telefono: '' })

  const [deudas, setDeudas] = useState([])
  const [movimientos, setMovimientos] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [tablaVisible, setTablaVisible] = useState(null) // id de deuda con tabla abierta
  const [cardActiva, setCardActiva] = useState(null)
  const [misTarjetas, setMisTarjetas] = useState([])

  const [modalDeuda, setModalDeuda] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('tarjeta')
  const [formTarjeta, setFormTarjeta] = useState(makeFormTarjeta)
  const [formPrestamo, setFormPrestamo] = useState(makeFormPrestamo)
  const [formCuota, setFormCuota] = useState(makeFormCuota)

  const [calView, setCalView]     = useState(() => { const d = new Date(); return { month: d.getMonth(), year: d.getFullYear() } })
  const [selectedDay, setSelectedDay] = useState(null)

  const [modalMov, setModalMov] = useState(null) // id de deuda para nuevo movimiento
  const [editandoMov, setEditandoMov] = useState(null) // objeto movimiento siendo editado
  const [formMov, setFormMov] = useState({
    tipo: 'cargo', descripcion: '', monto: '',
    fecha: fechaHoy(),
  })

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => {
    if (!themeColors.length) return
    const c = themeColors[0]
    setFormTarjeta(p => ({ ...p, color: themeColors.includes(p.color) ? p.color : c }))
    setFormPrestamo(p => ({ ...p, color: themeColors.includes(p.color) ? p.color : c }))
    setFormCuota(p => ({ ...p, color: themeColors.includes(p.color) ? p.color : c }))
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!a.fecha_vencimiento && !b.fecha_vencimiento) return 0
        if (!a.fecha_vencimiento) return 1
        if (!b.fecha_vencimiento) return -1
        return new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento)
      })
      setDeudas(deudasOrdenadas)
      setMisTarjetas(tarjetasData || [])

      if (deudasOrdenadas.length) {
        const { data: movs, error: e3 } = await supabase
          .from('deuda_movimientos').select('*').order('fecha', { ascending: true })
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

  function abrirNueva() {
    setEditandoId(null)
    setTipoSeleccionado('tarjeta')
    setFormTarjeta(makeFormTarjeta())
    setFormPrestamo(makeFormPrestamo())
    setFormCuota(makeFormCuota())
    setModalDeuda(true)
  }

  function abrirEdicion(d) {
    setEditandoId(d.id)
    setTipoSeleccionado(d.tipo_deuda || 'tarjeta')
    const c = d.color || defaultColor()
    const tipoDeudor = d.tipo || 'debo'
    if (d.tipo_deuda === 'tarjeta') {
      setFormTarjeta({
        tipo_deuda: 'tarjeta', tipo: tipoDeudor, emoji: d.emoji || '💳', nombre: d.nombre || '',
        categoria: d.categoria || 'deseo', tarjeta_id: '',
        limite: d.limite?.toString() || '', monto_compra: d.capital?.toString() || '',
        num_cuotas: d.plazo_meses?.toString() || '',
        fecha_operacion: fechaHoy(), color: c, telefono: d.telefono || '',
      })
    } else if (d.tipo_deuda === 'prestamo') {
      setFormPrestamo({
        tipo_deuda: 'prestamo', tipo: tipoDeudor, emoji: d.emoji || '🏦', nombre: d.nombre || '',
        categoria: d.categoria || 'basicos', capital: d.capital?.toString() || '',
        tasa_interes: (d.tasa_interes || d.tasa || 0).toString(),
        tiene_interes: (d.tasa_interes || d.tasa || 0) > 0,
        plazo_meses: d.plazo_meses?.toString() || '', plazo_libre: !d.plazo_meses,
        fecha_primer_pago: d.fecha_primer_pago || '', dia_pago: d.dia_pago?.toString() || '',
        color: c, telefono: d.telefono || '',
      })
    } else {
      setFormCuota({
        tipo_deuda: 'cuota', tipo: tipoDeudor, emoji: d.emoji || '📅', nombre: d.nombre || '',
        categoria: d.categoria || 'deseo', monto: d.cuota?.toString() || '',
        dia_pago: d.dia_pago?.toString() || '', color: c, telefono: d.telefono || '',
      })
    }
    setModalDeuda(true)
  }

  function handleSeleccionarTarjetaPerfil(id) {
    const t = misTarjetas.find(x => x.id === id)
    if (!t) return
    setFormTarjeta(prev => ({
      ...prev, tarjeta_id: t.id, limite: t.limite_credito?.toString() || '',
      color: themeColors.includes(t.color) ? t.color : (themeColors[0] || t.color),
      dia_pago: t.dia_pago?.toString() || prev.dia_pago || '',
    }))
  }

  async function handleSaveDeuda(e) {
    e.preventDefault()
    setSaving(true)
    let payload = {}

    if (tipoSeleccionado === 'tarjeta') {
      const f = formTarjeta
      if (f.tarjeta_id) {
        const tarjetaPerfil = misTarjetas.find(t => t.id === f.tarjeta_id)
        if (tarjetaPerfil && tarjetaPerfil.estado === 'pausada') {
          setError('Esta tarjeta está pausada. Actívala primero en el módulo Mis Tarjetas.')
          setSaving(false)
          return
        }
      }
      const capital = parseFloat(f.monto_compra) || 0
      const meses = parseInt(f.num_cuotas) || 1
      const cuota = parseFloat((capital / meses).toFixed(2))
      payload = {
        tipo_deuda: 'tarjeta', tipo: f.tipo, emoji: f.emoji, nombre: f.nombre,
        categoria: f.categoria, limite: parseFloat(f.limite) || 0,
        capital, monto: capital, pendiente: capital, cuota, plazo_meses: meses,
        perfil_tarjeta_id: f.tarjeta_id || null, tasa: 0, tasa_interes: 0,
        dia_pago: parseInt(f.dia_pago) || null, color: f.color, estado: 'activa', pagadas: 0,
        telefono: f.telefono || null,
      }
    } else if (tipoSeleccionado === 'prestamo') {
      const f = formPrestamo
      const capital = parseFloat(f.capital) || 0
      const tasa = f.tiene_interes ? (parseFloat(f.tasa_interes) || 0) : 0
      const meses = f.plazo_libre ? null : (parseInt(f.plazo_meses) || null)
      const cuota = meses ? parseFloat(calcularCuota(capital, tasa, meses).toFixed(2)) : 0
      payload = {
        tipo_deuda: 'prestamo', tipo: f.tipo, emoji: f.emoji, nombre: f.nombre,
        categoria: f.categoria, capital, monto: capital, pendiente: capital,
        tasa, tasa_interes: tasa, plazo_meses: meses, cuota,
        fecha_primer_pago: f.fecha_primer_pago || null, dia_pago: parseInt(f.dia_pago) || null,
        color: f.color, estado: 'activa', pagadas: 0,
        telefono: f.telefono || null,
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
          const { data: dmData } = await supabase.from('deuda_movimientos').insert([{
            deuda_id: f.deuda_origen_id, tipo: 'pago',
            descripcion: f.nombre || `Cuota ${deudaOrigen.nombre}`,
            monto, fecha: fechaHoy(), mes, año,
          }]).select()
          const tipoMov = deudaOrigen.tipo === 'medeben' ? 'ingreso' : 'egreso'
          await supabase.from('movimientos').insert([{
            tipo: tipoMov, categoria: 'deuda',
            descripcion: f.nombre || `Pago letra: ${deudaOrigen.nombre}`,
            monto, fecha: fechaHoy(), quien: 'Ambos',
            deuda_id: f.deuda_origen_id,
            deuda_movimiento_id: dmData?.[0]?.id || null,
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
        tipo_deuda: 'cuota', tipo: f.tipo, emoji: f.emoji, nombre: f.nombre,
        categoria: f.categoria, cuota: monto, monto, capital: monto, pendiente: monto,
        dia_pago: parseInt(f.dia_pago) || null, color: f.color,
        estado: 'activa', pagadas: 0, tasa: 0, tasa_interes: 0,
        telefono: f.telefono || null,
      }
    }

    if (editandoId) {
      const { error } = await supabase.from('deudas').update(payload).eq('id', editandoId)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('deudas').insert([payload])
      if (error) { setError(error.message); setSaving(false); return }
    }
    setSaving(false); setModalDeuda(false); setEditandoId(null)
    await cargar()
  }

  async function handleMarcarPagada(deuda) {
    const monto = deuda.cuota || deuda.pendiente || 0
    if (!monto) return
    setSaving(true)
    const hoy = fechaHoy()
    const nuevoPendiente = Math.max(0, (deuda.pendiente || 0) - monto)
    const nuevosPagados = (deuda.pagadas || 0) + 1
    const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

    const { data: dmData } = await supabase.from('deuda_movimientos').insert([{
      deuda_id: deuda.id, tipo: 'pago',
      descripcion: `Cuota mensual: ${deuda.nombre}`,
      monto, fecha: hoy, mes, año,
    }]).select()

    // medeben → ingreso (nos pagan a nosotros), debo → egreso (pagamos nosotros)
    const tipoMov = deuda.tipo === 'medeben' ? 'ingreso' : 'egreso'
    await supabase.from('movimientos').insert([{
      tipo: tipoMov, categoria: 'deuda',
      descripcion: deuda.tipo === 'medeben'
        ? `Cobro deuda: ${deuda.nombre}`
        : `Pago letra: ${deuda.nombre}`,
      monto, fecha: hoy, quien: 'Ambos',
      deuda_id: deuda.id,
      deuda_movimiento_id: dmData?.[0]?.id || null,
    }])

    await supabase.from('deudas').update({
      pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
    }).eq('id', deuda.id)

    setDeudas(prev => prev.map(d => d.id === deuda.id
      ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado } : d))
    setMovimientos(prev => ({
      ...prev,
      [deuda.id]: [{ ...dmData?.[0], tipo: 'pago', monto, fecha: hoy, mes, año, descripcion: `Cuota mensual: ${deuda.nombre}` }, ...(prev[deuda.id] || [])]
    }))
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
      let nuevosPagados = deuda.pagadas || 0

      if (formMov.tipo === 'pago') {
        nuevoPendiente = Math.max(0, nuevoPendiente - monto)
        nuevosPagados++

        const tipoMov = deuda.tipo === 'medeben' ? 'ingreso' : 'egreso'
        await supabase.from('movimientos').insert([{
          tipo: tipoMov, categoria: 'deuda',
          descripcion: deuda.tipo === 'medeben'
            ? `Cobro deuda: ${deuda.nombre}`
            : `Pago letra: ${deuda.nombre}`,
          monto, fecha: formMov.fecha, quien: 'Ambos',
          deuda_id: deuda.id,
          deuda_movimiento_id: data[0]?.id || null,
        }])

        await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          pagadas: nuevosPagados,
          estado: nuevoPendiente <= 0 ? 'pagada' : 'activa',
        }).eq('id', modalMov)

      } else {
        // Cargo: sube pendiente, no afecta movimientos generales
        nuevoPendiente = nuevoPendiente + monto
        await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          estado: 'activa',
        }).eq('id', modalMov)
      }

      setDeudas(prev => prev.map(d => d.id === modalMov
        ? {
          ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados,
          estado: nuevoPendiente <= 0 ? 'pagada' : 'activa'
        } : d))
      setModalMov(null)
      setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
    }
    setSaving(false)
  }

  // Editar un movimiento existente
  async function handleEditMov(e) {
    e.preventDefault()
    if (!editandoMov) return
    setSaving(true)

    const montoNuevo = parseFloat(formMov.monto)
    const montoAnterior = editandoMov.monto
    const deuda = deudas.find(d => d.id === editandoMov.deuda_id)
    if (!deuda) { setSaving(false); return }

    // Actualizar el registro deuda_movimientos
    const { error } = await supabase.from('deuda_movimientos').update({
      descripcion: formMov.descripcion,
      monto: montoNuevo,
      fecha: formMov.fecha,
    }).eq('id', editandoMov.id)

    if (!error) {
      // Recalcular pendiente sumando TODOS los movimientos desde DB (fuente de verdad)
      const { data: todosMovs } = await supabase
        .from('deuda_movimientos')
        .select('tipo, monto')
        .eq('deuda_id', deuda.id)

      const totalPagado = (todosMovs || []).filter(m => m.tipo === 'pago').reduce((s, m) => s + (m.monto || 0), 0)
      const totalCargos = (todosMovs || []).filter(m => m.tipo === 'cargo').reduce((s, m) => s + (m.monto || 0), 0)
      const montoOriginal = deuda.monto || 0
      const nuevoPendiente = Math.max(0, montoOriginal - totalPagado + totalCargos)
      const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

      // Actualizar movimiento general si existe (para pagos)
      if (editandoMov.tipo === 'pago') {
        const { data: movGeneral } = await supabase
          .from('movimientos').select('id')
          .eq('deuda_movimiento_id', editandoMov.id).limit(1)
        if (movGeneral?.[0]?.id) {
          await supabase.from('movimientos').update({
            monto: montoNuevo, descripcion: formMov.descripcion, fecha: formMov.fecha,
          }).eq('id', movGeneral[0].id)
        }
      }

      await supabase.from('deudas').update({
        pendiente: nuevoPendiente, estado: nuevoEstado,
      }).eq('id', deuda.id)

      // Recargar todo desde DB para garantizar consistencia
      await cargar()
    }

    setEditandoMov(null)
    setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
    setSaving(false)
  }

  async function handleDeleteMov(mov) {
    if (!confirm('¿Eliminar este movimiento y revertir el pendiente?')) return
    const deuda = deudas.find(d => d.id === mov.deuda_id)
    if (!deuda) return

    let nuevoPendiente = deuda.pendiente || 0
    let nuevosPagados = deuda.pagadas || 0

    if (mov.tipo === 'pago') {
      nuevoPendiente = Math.min(
        deuda.monto || (nuevoPendiente + mov.monto),
        nuevoPendiente + mov.monto
      )
      nuevosPagados = Math.max(0, nuevosPagados - 1)

      // CRÍTICO: borrar movimientos PRIMERO (tiene FK a deuda_movimientos)
      const { data: movGeneralData } = await supabase
        .from('movimientos')
        .select('id')
        .eq('deuda_movimiento_id', mov.id)
        .limit(1)

      if (movGeneralData?.[0]?.id) {
        await supabase.from('movimientos').delete().eq('id', movGeneralData[0].id)
      } else {
        // Fallback legacy
        await supabase.from('movimientos').delete()
          .eq('categoria', 'deuda')
          .eq('monto', mov.monto)
          .eq('deuda_id', mov.deuda_id)
          .limit(1)
      }
    } else {
      nuevoPendiente = Math.max(0, nuevoPendiente - mov.monto)
    }

    // Ahora sí borrar deuda_movimientos (ya no tiene referencias en movimientos)
    const { error } = await supabase.from('deuda_movimientos').delete().eq('id', mov.id)
    if (error) { setError(error.message); return }

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
      // CRÍTICO: borrar movimientos generales PRIMERO (tienen FK a deuda_movimientos)
      await supabase.from('movimientos').delete().eq('deuda_id', id)

      // Luego borrar deuda_movimientos (ya sin referencias)
      const { error: err1 } = await supabase.from('deuda_movimientos').delete().eq('deuda_id', id)
      if (err1) throw new Error('Error al borrar movimientos de deuda: ' + err1.message)

      // Finalmente borrar la deuda
      const { error: err2 } = await supabase.from('deudas').delete().eq('id', id)
      if (err2) throw new Error('Error al borrar la deuda: ' + err2.message)

      if (cardActiva === id) setCardActiva(null)
      await cargar()
    } catch (err) {
      console.error(err); alert(err.message)
    } finally { setSaving(false) }
  }

  // ─── Estadísticas separadas: debo vs medeben ─────────────────────────────

  const activas = deudas.filter(d => d.estado !== 'pagada')
  const deboActivas = activas.filter(d => d.tipo !== 'medeben')
  const meDebenActivas = activas.filter(d => d.tipo === 'medeben')

  const totalDebo = deboActivas.reduce((s, d) => s + (d.pendiente || 0), 0)
  const totalMeDeben = meDebenActivas.reduce((s, d) => s + (d.pendiente || 0), 0)
  const cuotasMes = deboActivas.reduce((s, d) => s + (d.cuota || 0), 0)
  const vencenProximo = activas.filter(d => { const dias = diasHastaPago(d.dia_pago); return dias !== null && dias <= 7 }).length

  // ─── CALENDARIO ──────────────────────────────────────────────────────────

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DIAS_SEMANA = ['L','M','X','J','V','S','D']

  function prevMes() {
    setCalView(p => p.month === 0 ? { month: 11, year: p.year - 1 } : { month: p.month - 1, year: p.year })
    setSelectedDay(null)
  }
  function nextMes() {
    setCalView(p => p.month === 11 ? { month: 0, year: p.year + 1 } : { month: p.month + 1, year: p.year })
    setSelectedDay(null)
  }

  const firstDayOfMonth = new Date(calView.year, calView.month, 1).getDay()
  const startPad = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1
  const daysInMonth = new Date(calView.year, calView.month + 1, 0).getDate()
  const calCells = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  // Deudas por día en el mes del calendario
  const deudaByDay = {}
  activas.forEach(d => {
    const dia = parseInt(d.dia_pago)
    if (!dia || dia < 1 || dia > 31) return
    if (!deudaByDay[dia]) deudaByDay[dia] = []
    const pagada = (movimientos[d.id] || []).some(
      m => m.tipo === 'pago' && m.mes === calView.month + 1 && m.año === calView.year
    )
    deudaByDay[dia].push({ ...d, pagada })
  })

  const hoyDia = now.getDate()
  const esHoy = (day) => day === hoyDia && calView.month === now.getMonth() && calView.year === now.getFullYear()

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Mis Deudas</h1>
        </div>
        <button onClick={abrirNueva} className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-semibold">Nueva deuda</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2"
          style={{
            background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)',
            color: 'var(--accent-rose)',
          }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="glass-card p-3 animate-enter">
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1"
            style={{ color: 'var(--text-muted)' }}>💸 Lo que debo</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-rose)' }}>
            {formatCurrency(totalDebo)}
          </p>
        </div>
        <div className="glass-card p-3 animate-enter" style={{ animationDelay: '0.05s' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1"
            style={{ color: 'var(--text-muted)' }}>🤝 Me deben</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
            {formatCurrency(totalMeDeben)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="glass-card p-3 animate-enter" style={{ animationDelay: '0.1s' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1"
            style={{ color: 'var(--text-muted)' }}>Letras este mes</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-terra)' }}>
            {formatCurrency(cuotasMes)}
          </p>
        </div>
        <div className="glass-card p-3 animate-enter" style={{ animationDelay: '0.15s' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1"
            style={{ color: 'var(--text-muted)' }}>Vencen pronto</p>
          <p className="text-sm font-semibold"
            style={{ color: vencenProximo > 0 ? 'var(--accent-rose)' : 'var(--accent-green)' }}>
            {vencenProximo > 0 ? `${vencenProximo} deuda${vencenProximo > 1 ? 's' : ''}` : 'Al día ✓'}
          </p>
        </div>
      </div>

      {/* ── CALENDARIO ── */}
      {!loading && activas.length > 0 && (
        <div className="glass-card mb-6 animate-enter" style={{ padding: '16px' }}>

          {/* Cabecera mes */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMes}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <ChevronLeft size={14} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {MESES[calView.month]} {calView.year}
              </p>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {Object.keys(deudaByDay).length} pago{Object.keys(deudaByDay).length !== 1 ? 's' : ''} este mes
              </p>
            </div>
            <button onClick={nextMes}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 mb-1">
            {DIAS_SEMANA.map(d => (
              <p key={d} className="text-center text-[9px] font-semibold py-0.5"
                style={{ color: 'var(--text-muted)' }}>{d}</p>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-0.5">
            {calCells.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />
              const deudas_dia = deudaByDay[day] || []
              const isSelected = selectedDay === day
              const isToday = esHoy(day)
              const esMesActual = calView.month === now.getMonth() && calView.year === now.getFullYear()
              const isPast = esMesActual && day < hoyDia
              const isFuture = esMesActual && day > hoyDia

              return (
                <button key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className="flex flex-col items-center py-1.5 rounded-xl transition-all"
                  style={{
                    background: isSelected
                      ? 'color-mix(in srgb, var(--accent-main) 15%, transparent)'
                      : isToday
                        ? 'color-mix(in srgb, var(--accent-blue) 10%, transparent)'
                        : 'transparent',
                    border: 'none',
                    cursor: deudas_dia.length > 0 ? 'pointer' : 'default',
                    minHeight: 44,
                    opacity: isPast && deudas_dia.length === 0 ? 0.35 : 1,
                  }}>
                  <span className="text-[11px] font-semibold tabular-nums"
                    style={{
                      color: isToday ? 'var(--accent-blue)'
                        : isSelected ? 'var(--accent-main)'
                        : isPast ? 'var(--text-muted)'
                        : 'var(--text-secondary)',
                    }}>
                    {day}
                  </span>
                  {/* Dots */}
                  {deudas_dia.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center" style={{ maxWidth: 28 }}>
                      {deudas_dia.slice(0, 3).map((d, idx) => (
                        <div key={idx} className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: d.pagada
                              ? 'var(--accent-green)'
                              : isPast
                                ? 'var(--accent-rose)'
                                : (d.color || 'var(--accent-rose)'),
                            opacity: d.pagada ? 1 : isPast ? 0.7 : 1,
                          }} />
                      ))}
                      {deudas_dia.length > 3 && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
                      )}
                    </div>
                  )}
                  {/* Indicador vencido */}
                  {isPast && deudas_dia.some(d => !d.pagada) && (
                    <span className="text-[7px] font-bold mt-0.5" style={{ color: 'var(--accent-rose)', lineHeight: 1 }}>!</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Detalle del día seleccionado */}
          {selectedDay && deudaByDay[selectedDay] && (
            <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: 'var(--border-glass)' }}>
              <p className="text-[9px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Pagos del día {selectedDay}
              </p>
              {deudaByDay[selectedDay].map(d => (
                <div key={d.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl"
                  style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-base">{d.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {d.tipo === 'medeben' ? 'Me deben cobrar' : 'Debo pagar'}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums"
                    style={{ color: d.color || 'var(--accent-rose)' }}>
                    {formatCurrency(d.cuota || d.pendiente || 0)}
                  </p>
                  {d.pagada
                    ? <Check size={13} strokeWidth={2.5} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                    : <div className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--accent-rose) 20%, transparent)', border: '1.5px solid var(--accent-rose)' }} />
                  }
                </div>
              ))}
            </div>
          )}

          {/* Leyenda */}
          <div className="flex items-center gap-3 mt-3 pt-2 border-t flex-wrap" style={{ borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-green)' }} />
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Pagado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-rose)' }} />
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Pendiente</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold" style={{ color: 'var(--accent-rose)' }}>!</span>
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Vencido</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-4 h-4 rounded-md" style={{ background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)' }} />
              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Hoy</span>
            </div>
          </div>
        </div>
      )}

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
            const dias = diasHastaPago(d.dia_pago)
            const urgencia = urgenciaColor(dias)
            const isExp = expandido === d.id
            const isTabla = tablaVisible === d.id
            const isActiva = cardActiva === d.id
            const movsDeuda = movimientos[d.id] || []
            const esCuota = d.tipo_deuda === 'cuota'
            const esMeDeben = d.tipo === 'medeben'
            const pagadaEsteMes = (movimientos[d.id] || [])
              .some(m => m.tipo === 'pago' && m.mes === mes && m.año === año)

            // Tabla de amortización
            const tablaAmort = isTabla ? generarTablaAmortizacion(d, movsDeuda) : []

            return (
              <Card key={d.id}
                className="animate-enter overflow-hidden cursor-pointer select-none"
                style={{ animationDelay: `${i * 0.04}s`, padding: '14px 16px' }}
                onClick={() => setCardActiva(isActiva ? null : d.id)}>

                {diasFaltantes !== null && (
                  <div className="absolute top-2 right-2">
                    <div className="text-[9px] font-semibold px-2 py-0.5 rounded-lg uppercase tracking-tighter"
                      style={{
                        background: diasFaltantes <= 3
                          ? 'color-mix(in srgb, var(--accent-rose)  15%, transparent)'
                          : 'color-mix(in srgb, var(--accent-green) 15%, transparent)',
                        color: diasFaltantes <= 3 ? 'var(--accent-rose)' : 'var(--accent-green)',
                      }}>
                      {diasFaltantes <= 0 ? '¡Vence hoy!' : `Vence en ${diasFaltantes}d`}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${d.color || cfg.color}18` }}>
                    <span>{d.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-sm leading-tight"
                      style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full"
                        style={{ background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      {/* Badge debo/medeben */}
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: esMeDeben
                            ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)'
                            : 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
                          color: esMeDeben ? 'var(--accent-green)' : 'var(--accent-rose)',
                        }}>
                        {esMeDeben ? '🤝 Me deben' : '💸 Debo'}
                      </span>
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: d.categoria === 'basicos'
                            ? 'color-mix(in srgb, var(--accent-blue)  10%, transparent)'
                            : 'color-mix(in srgb, var(--accent-terra) 10%, transparent)',
                          color: d.categoria === 'basicos' ? 'var(--accent-blue)' : 'var(--accent-terra)',
                        }}>
                        {d.categoria}
                      </span>
                      {urgencia && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: urgencia.bg, color: urgencia.text }}>
                          {urgencia.label}
                        </span>
                      )}
                      {pagadaEsteMes && (
                        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                            color: 'var(--accent-green)',
                          }}>
                          ✓ {esMeDeben ? 'Cobrada' : 'Pagada'} este mes
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-semibold tabular-nums"
                      style={{ color: d.color || cfg.color, letterSpacing: '-0.02em' }}>
                      {formatCurrency(d.pendiente || 0)}
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {esMeDeben ? 'por cobrar' : 'pendiente'}
                    </p>
                  </div>
                </div>

                {d.monto > 0 && (
                  <div className="mb-2.5">
                    <ProgressBar value={d.monto - (d.pendiente || 0)} max={d.monto} color={d.color || cfg.color} />
                  </div>
                )}

                <div className="flex items-center gap-2 flex-wrap">
                  {d.cuota > 0 && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
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
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {esMeDeben ? 'Cobro' : 'Pago'} día {d.dia_pago}
                    </span>
                  )}
                  {d.estado === 'pagada' && (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                        color: 'var(--accent-green)',
                      }}>
                      {esMeDeben ? '¡Cobrada!' : '¡Saldada!'}
                    </span>
                  )}
                </div>

                {/* Botones de acción */}
                <div className={`transition-all duration-200 overflow-hidden ${isActiva ? 'max-h-20 opacity-100 mt-3 pt-3 border-t' : 'max-h-0 opacity-0'}`}
                  style={{ borderColor: 'var(--border-glass)' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(esCuota || (d.tipo_deuda === 'prestamo' && d.cuota > 0)) && d.estado !== 'pagada' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleMarcarPagada(d) }}
                        disabled={saving || pagadaEsteMes}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-semibold uppercase transition-all active:scale-95 disabled:opacity-40"
                        style={{
                          background: pagadaEsteMes
                            ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)'
                            : 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                          color: 'var(--accent-green)',
                        }}>
                        <Check size={11} strokeWidth={3} />
                        {pagadaEsteMes ? (esMeDeben ? 'Ya cobrada' : 'Ya pagada') : (esMeDeben ? 'Marcar cobrada' : 'Marcar pagada')}
                      </button>
                    )}
                    {!esMeDeben && (
                      <IconBtn
                        onClick={() => { setModalMov(d.id); setFormMov({ tipo: 'cargo', descripcion: 'Nuevo cargo', monto: '', fecha: new Date().toISOString().split('T')[0] }) }}
                        title="Registrar cargo"
                        bg="color-mix(in srgb, var(--accent-rose) 10%, transparent)"
                        color="var(--accent-rose)">
                        <ArrowDownRight size={13} strokeWidth={2.5} />
                      </IconBtn>
                    )}
                    <IconBtn
                      onClick={() => { setModalMov(d.id); setFormMov({ tipo: 'pago', descripcion: esMeDeben ? `Cobro ${d.nombre}` : `Pago ${d.nombre}`, monto: d.cuota || d.pendiente || '', fecha: new Date().toISOString().split('T')[0] }) }}
                      title={esMeDeben ? 'Registrar cobro' : 'Registrar pago'}
                      bg="color-mix(in srgb, var(--accent-green) 10%, transparent)"
                      color="var(--accent-green)">
                      <ArrowUpRight size={13} strokeWidth={2.5} />
                    </IconBtn>
                    <IconBtn onClick={() => {
                      setExpandido(isExp ? null : d.id)
                      if (isTabla) setTablaVisible(null)
                    }}
                      title="Ver historial" bg="var(--bg-secondary)" color="var(--text-muted)">
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </IconBtn>
                    {/* Botón tabla de amortización */}
                    {d.plazo_meses && (
                      <IconBtn onClick={() => {
                        setTablaVisible(isTabla ? null : d.id)
                        if (isExp) setExpandido(null)
                      }}
                        title="Tabla de amortización"
                        bg={isTabla ? 'color-mix(in srgb, var(--accent-violet) 15%, transparent)' : 'var(--bg-secondary)'}
                        color={isTabla ? 'var(--accent-violet)' : 'var(--text-muted)'}>
                        <Table2 size={12} />
                      </IconBtn>
                    )}
                    {d.telefono && (
                      <IconBtn
                        onClick={() => {
                          const phone = d.telefono.replace(/\D/g, '')
                          const monto = formatCurrency(d.cuota || d.pendiente || 0)
                          const msg = `Hola! 👋 Te confirmo el pago de *${d.nombre}* por *${monto}*. ✅`
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                        }}
                        title="Notificar por WhatsApp"
                        bg="color-mix(in srgb, #25D366 12%, transparent)"
                        color="#25D366">
                        <MessageCircle size={12} />
                      </IconBtn>
                    )}
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

                {/* Historial de movimientos */}
                {isExp && (
                  <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: 'var(--border-glass)' }}>
                    <p className="text-[9px] uppercase font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                      Historial de movimientos
                    </p>
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
                            ? <ArrowUpRight size={11} style={{ color: 'var(--accent-green)' }} />
                            : <ArrowDownRight size={11} style={{ color: 'var(--accent-rose)' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {m.descripcion}
                          </p>
                          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <p className="text-xs font-semibold tabular-nums"
                            style={{ color: m.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                            {m.tipo === 'pago' ? '-' : '+'}{formatCurrency(m.monto)}
                          </p>
                          {/* Botón editar movimiento */}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setEditandoMov(m)
                              setFormMov({ tipo: m.tipo, descripcion: m.descripcion, monto: m.monto?.toString() || '', fecha: m.fecha })
                            }}
                            className="p-1 rounded-lg transition-opacity"
                            style={{ color: 'var(--accent-blue)', opacity: 0.3 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '0.3'}
                            title="Editar movimiento">
                            <Pencil size={11} />
                          </button>
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

                {/* Tabla de amortización */}
                {isTabla && tablaAmort.length > 0 && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-glass)' }}>
                    <p className="text-[9px] uppercase font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                      Tabla de amortización · {d.nombre}
                    </p>
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full text-[9px] min-w-[460px]">
                        <thead>
                          <tr style={{ color: 'var(--text-muted)' }}>
                            <th className="px-2 py-1 text-left font-semibold uppercase">#</th>
                            <th className="px-2 py-1 text-left font-semibold uppercase">Mes</th>
                            <th className="px-2 py-1 text-right font-semibold uppercase">Cuota</th>
                            {(d.tasa_interes > 0 || d.tasa > 0) && (
                              <>
                                <th className="px-2 py-1 text-right font-semibold uppercase">Capital</th>
                                <th className="px-2 py-1 text-right font-semibold uppercase">Interés</th>
                              </>
                            )}
                            <th className="px-2 py-1 text-right font-semibold uppercase">Saldo</th>
                            <th className="px-2 py-1 text-center font-semibold uppercase">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tablaAmort.map(row => {
                            const esPasada = new Date(row.año, row.mes - 1) < new Date(año, mes - 1)
                            const esActual = row.mes === mes && row.año === año
                            return (
                              <tr key={row.periodo}
                                style={{
                                  background: row.pagada
                                    ? 'color-mix(in srgb, var(--accent-green) 6%, transparent)'
                                    : esActual
                                      ? 'color-mix(in srgb, var(--accent-violet) 6%, transparent)'
                                      : 'transparent',
                                }}>
                                <td className="px-2 py-1.5 font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                  {row.periodo}
                                </td>
                                <td className="px-2 py-1.5 font-semibold" style={{ color: esActual ? 'var(--accent-violet)' : 'var(--text-secondary)' }}>
                                  {row.fechaLabel}
                                  {esActual && <span className="ml-1 text-[8px] px-1 rounded" style={{ background: 'color-mix(in srgb, var(--accent-violet) 20%, transparent)', color: 'var(--accent-violet)' }}>hoy</span>}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                  {formatCurrency(row.cuota)}
                                </td>
                                {(d.tasa_interes > 0 || d.tasa > 0) && (
                                  <>
                                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--accent-blue)' }}>
                                      {formatCurrency(row.capital)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--accent-rose)' }}>
                                      {formatCurrency(row.interes)}
                                    </td>
                                  </>
                                )}
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                  {formatCurrency(row.saldo)}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {row.pagada ? (
                                    <span className="font-semibold" style={{ color: 'var(--accent-green)' }}>✓</span>
                                  ) : esPasada ? (
                                    <span className="font-semibold" style={{ color: 'var(--accent-rose)' }}>!</span>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <td colSpan={2} className="px-2 py-1.5 font-semibold text-[9px] uppercase" style={{ color: 'var(--text-muted)' }}>
                              Total
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                              {formatCurrency(tablaAmort.reduce((s, r) => s + r.cuota, 0))}
                            </td>
                            {(d.tasa_interes > 0 || d.tasa > 0) && (
                              <>
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--accent-blue)' }}>
                                  {formatCurrency(tablaAmort.reduce((s, r) => s + r.capital, 0))}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--accent-rose)' }}>
                                  {formatCurrency(tablaAmort.reduce((s, r) => s + r.interes, 0))}
                                </td>
                              </>
                            )}
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <p className="text-[8px] mt-1.5 px-2" style={{ color: 'var(--text-muted)' }}>
                      ✓ = pagada · ! = vencida sin pago registrado · — = pendiente
                    </p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* ── MODAL CREAR / EDITAR DEUDA ── */}
      <Modal
        open={modalDeuda}
        onClose={() => { setModalDeuda(false); setEditandoId(null) }}
        title={editandoId ? 'Editar Deuda' : 'Nueva Deuda'}>

        {!editandoId && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
              <button type="button" key={key}
                onClick={() => setTipoSeleccionado(key)}
                className="py-2.5 rounded-xl text-[10px] font-semibold uppercase transition-all"
                style={{
                  background: tipoSeleccionado === key ? `color-mix(in srgb, ${cfg.color} 15%, transparent)` : 'var(--bg-secondary)',
                  color: tipoSeleccionado === key ? cfg.color : 'var(--text-muted)',
                  border: `1px solid ${tipoSeleccionado === key ? `color-mix(in srgb, ${cfg.color} 40%, transparent)` : 'var(--border-glass)'}`,
                }}>
                {cfg.label}
              </button>
            ))}
          </div>
        )}

        <div>

          {/* ── TARJETA ── */}
          {tipoSeleccionado === 'tarjeta' && (
            <div className="space-y-4">
              <TipoDeudorToggle value={formTarjeta.tipo} onChange={v => setFormTarjeta(p => ({ ...p, tipo: v }))} />
              {!editandoId && misTarjetas.length > 0 && (
                <div className="p-3 rounded-2xl border border-dashed"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--accent-violet) 30%, transparent)',
                    background: 'color-mix(in srgb, var(--accent-violet) 4%, transparent)',
                  }}>
                  <label className="text-[10px] font-semibold uppercase mb-2 block"
                    style={{ color: 'var(--accent-violet)' }}>
                    Selecciona la tarjeta usada
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {misTarjetas.map(t => (
                      <button key={t.id} type="button"
                        onClick={() => {
                          if (t.estado === 'pausada') return
                          handleSeleccionarTarjetaPerfil(t.id)
                        }}
                        disabled={t.estado === 'pausada'}
                        className="flex-shrink-0 px-3 py-2 rounded-xl border text-[10px] font-semibold uppercase transition-all flex items-center gap-2"
                        style={{
                          borderColor: t.estado === 'pausada'
                            ? 'var(--border-glass)'
                            : formTarjeta.tarjeta_id === t.id ? t.color : `${t.color}40`,
                          color: t.estado === 'pausada' ? 'var(--text-muted)' : t.color,
                          background: t.estado === 'pausada'
                            ? 'var(--bg-secondary)'
                            : formTarjeta.tarjeta_id === t.id ? `${t.color}12` : 'var(--bg-card)',
                          opacity: t.estado === 'pausada' ? 0.5 : 1,
                          cursor: t.estado === 'pausada' ? 'not-allowed' : 'pointer',
                        }}>
                        💳 {t.nombre_tarjeta}
                        {t.estado === 'pausada' && (
                          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full ml-1"
                            style={{
                              background: 'color-mix(in srgb, var(--accent-terra) 15%, transparent)',
                              color: 'var(--accent-terra)',
                            }}>
                            PAUSADA
                          </span>
                        )}
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
                <div className="px-3 py-2 rounded-xl text-[10px] font-semibold"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-violet) 8%, transparent)',
                    color: 'var(--accent-violet)',
                  }}>
                  Cuota mensual estimada:{' '}
                  <span className="font-semibold">
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
              <div>
                <label className="ff-label">WhatsApp (opcional)</label>
                <input className="ff-input" type="tel" placeholder="Ej: 573001234567"
                  value={formTarjeta.telefono}
                  onChange={e => setFormTarjeta(p => ({ ...p, telefono: e.target.value }))} />
                <p className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>
                  Número internacional sin + (ej: 57 para Colombia)
                </p>
              </div>
              <ColorPicker value={formTarjeta.color} colors={themeColors}
                onChange={c => setFormTarjeta(p => ({ ...p, color: c }))} />
            </div>
          )}

          {/* ── PRÉSTAMO ── */}
          {tipoSeleccionado === 'prestamo' && (
            <div className="space-y-4">
              <TipoDeudorToggle value={formPrestamo.tipo} onChange={v => setFormPrestamo(p => ({ ...p, tipo: v }))} />
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
                      className="py-2.5 rounded-xl text-[10px] font-semibold uppercase transition-all"
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
                      className="py-2.5 rounded-xl text-[10px] font-semibold uppercase transition-all"
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
                <div className="px-3 py-2 rounded-xl text-[10px] font-semibold"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
                    color: 'var(--accent-rose)',
                  }}>
                  Cuota mensual estimada:{' '}
                  <span className="font-semibold">
                    {formatCurrency(calcularCuota(
                      parseFloat(formPrestamo.capital),
                      formPrestamo.tiene_interes ? parseFloat(formPrestamo.tasa_interes) || 0 : 0,
                      parseInt(formPrestamo.plazo_meses)
                    ))}
                  </span>
                  {formPrestamo.tiene_interes && (
                    <span className="ml-2 opacity-70">
                      · Total intereses:{' '}
                      {formatCurrency(
                        calcularCuota(
                          parseFloat(formPrestamo.capital),
                          parseFloat(formPrestamo.tasa_interes) || 0,
                          parseInt(formPrestamo.plazo_meses)
                        ) * parseInt(formPrestamo.plazo_meses) - parseFloat(formPrestamo.capital)
                      )}
                    </span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="ff-label">Primer pago</label>
                  <input className="ff-input" type="date"
                    value={formPrestamo.fecha_primer_pago}
                    onChange={e => setFormPrestamo(p => ({ ...p, fecha_primer_pago: e.target.value }))} />
                </div>
                <div>
                  <label className="ff-label">Día de pago mensual</label>
                  <input className="ff-input" type="number" min="1" max="31" placeholder="Ej: 5"
                    value={formPrestamo.dia_pago}
                    onChange={e => setFormPrestamo(p => ({ ...p, dia_pago: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="ff-label">WhatsApp (opcional)</label>
                <input className="ff-input" type="tel" placeholder="Ej: 573001234567"
                  value={formPrestamo.telefono}
                  onChange={e => setFormPrestamo(p => ({ ...p, telefono: e.target.value }))} />
                <p className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>
                  Número internacional sin + (ej: 57 para Colombia)
                </p>
              </div>
              <ColorPicker value={formPrestamo.color} colors={themeColors}
                onChange={c => setFormPrestamo(p => ({ ...p, color: c }))} />
            </div>
          )}

          {/* ── CUOTA ── */}
          {tipoSeleccionado === 'cuota' && (
            <div className="space-y-4">
              <TipoDeudorToggle value={formCuota.tipo} onChange={v => setFormCuota(p => ({ ...p, tipo: v }))} />
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
                          dia_pago: d.dia_pago?.toString() || '',
                          color: themeColors.includes(d.color) ? d.color : (themeColors[0] || d.color),
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
              <div>
                <label className="ff-label">WhatsApp (opcional)</label>
                <input className="ff-input" type="tel" placeholder="Ej: 573001234567"
                  value={formCuota.telefono}
                  onChange={e => setFormCuota(p => ({ ...p, telefono: e.target.value }))} />
                <p className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>
                  Número internacional sin + (ej: 57 para Colombia)
                </p>
              </div>
              <ColorPicker value={formCuota.color} colors={themeColors}
                onChange={c => setFormCuota(p => ({ ...p, color: c }))} />
            </div>
          )}

        </div>

        <div className="flex gap-3 pt-4">
          <button type="button"
            onClick={() => { setModalDeuda(false); setEditandoId(null) }}
            className="ff-btn-ghost flex-1">
            Cancelar
          </button>
          <button
            onClick={handleSaveDeuda}
            disabled={saving}
            className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </Modal>

      {/* ── MODAL MOVIMIENTO (nuevo o editar) ── */}
      <Modal
        open={!!modalMov || !!editandoMov}
        onClose={() => {
          setModalMov(null)
          setEditandoMov(null)
          setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
        }}
        title={editandoMov
          ? 'Editar Movimiento'
          : formMov.tipo === 'pago' ? 'Registrar Pago' : 'Registrar Cargo'}>
        <form onSubmit={editandoMov ? handleEditMov : handleAddMov} className="space-y-4">
          {!editandoMov && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              {[{ v: 'cargo', l: '↓ Cargo' }, { v: 'pago', l: '↑ Pago' }].map(t => (
                <button type="button" key={t.v}
                  onClick={() => setFormMov(p => ({ ...p, tipo: t.v }))}
                  className="py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all"
                  style={{
                    background: formMov.tipo === t.v ? 'var(--bg-card)' : 'transparent',
                    color: formMov.tipo === t.v ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: formMov.tipo === t.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}>
                  {t.l}
                </button>
              ))}
            </div>
          )}
          {editandoMov && (
            <div className="px-3 py-2 rounded-xl text-[10px] font-semibold"
              style={{
                background: editandoMov.tipo === 'pago'
                  ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)'
                  : 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
                color: editandoMov.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)',
              }}>
              Tipo: {editandoMov.tipo === 'pago' ? '↑ Pago' : '↓ Cargo'} · No se puede cambiar al editar
            </div>
          )}
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
              <input className="ff-input text-lg font-semibold" type="number" step="0.01" placeholder="0.00" required
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
            <button type="button"
              onClick={() => {
                setModalMov(null)
                setEditandoMov(null)
                setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
              }}
              className="ff-btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2"
              style={{
                background: formMov.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)',
              }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : editandoMov ? 'Guardar cambios' : formMov.tipo === 'pago' ? 'Confirmar Pago' : 'Registrar Cargo'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}

// ── Componentes reutilizables ─────────────────────────────────────────────────

function CategoriaToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[{ v: 'deseo', l: 'Gasto Deseo' }, { v: 'basicos', l: 'Gasto Básico' }].map(c => (
        <button type="button" key={c.v} onClick={() => onChange(c.v)}
          className="py-2.5 rounded-xl text-[10px] font-semibold uppercase transition-all"
          style={{
            background: value === c.v ? 'color-mix(in srgb, var(--accent-green) 10%, transparent)' : 'var(--bg-secondary)',
            color: value === c.v ? 'var(--accent-green)' : 'var(--text-muted)',
            border: `1px solid ${value === c.v ? 'color-mix(in srgb, var(--accent-green) 30%, transparent)' : 'var(--border-glass)'}`,
          }}>
          {c.l}
        </button>
      ))}
    </div>
  )
}
