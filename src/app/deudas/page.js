'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import ConfirmDialog, { useConfirm } from '@/components/ui/ConfirmDialog'
import CustomSelect from '@/components/ui/CustomSelect'
import {
  Plus, Loader2, Trash2, CreditCard, Landmark,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Pencil, MessageCircle,
  ArrowDownRight, ArrowUpRight, Calendar, Check, AlertCircle, Table2, GripVertical
} from 'lucide-react'
import { formatCurrency, fechaHoy, diasHastaPago } from '@/lib/utils'
import { useTheme, getThemeColors } from '@/lib/themes'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDeudas, calcularCuota, generarTablaAmortizacion, calcularEstadisticas } from './useDeudas'

function SortableItem({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 'auto', position: 'relative' }} {...attributes}>
      {children(listeners, isDragging)}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

  const defaultColor = () => themeColors[0] || 'var(--accent-green)'

  const makeFormTarjeta = () => ({ tipo_deuda: 'tarjeta', tipo: 'debo', emoji: '💳', nombre: '', descripcion: '', categoria: 'deseo', tarjeta_id: '', limite: '', monto_compra: '', num_cuotas: '', fecha_operacion: fechaHoy(), dia_pago: '', color: defaultColor(), telefono: '' })
  const makeFormPrestamo = () => ({ tipo_deuda: 'prestamo', tipo: 'debo', emoji: '🏦', nombre: '', descripcion: '', categoria: 'basicos', capital: '', tasa_interes: '', tiene_interes: false, plazo_meses: '', plazo_libre: false, fecha_primer_pago: '', dia_pago: '', color: defaultColor(), telefono: '' })
  const makeFormCuota = () => ({ tipo_deuda: 'cuota', tipo: 'debo', emoji: '📅', nombre: '', descripcion: '', categoria: 'deseo', deuda_origen_id: '', monto: '', dia_pago: '', color: defaultColor(), telefono: '' })

  // ── Datos y acciones desde el hook ────────────────────────────────────────
  const {
    deudas, movimientos, misTarjetas,
    loading, saving, error, setError,
    cargar, guardarDeuda, marcarPagada,
    agregarMovimiento, editarMovimiento, eliminarMovimiento, eliminarDeuda,
    reordenarDeudas,
  } = useDeudas()

  // ── Estado de expansión por deuda (UI pura) ───────────────────────────────
  const [expandido, setExpandido] = useState(null)
  const [tablaVisible, setTablaVisible] = useState(null)
  const [cardActiva, setCardActiva] = useState(null)

  const [modalDeuda, setModalDeuda] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [tipoSeleccionado, setTipoSeleccionado] = useState('tarjeta')
  const [formTarjeta, setFormTarjeta] = useState(makeFormTarjeta)
  const [formPrestamo, setFormPrestamo] = useState(makeFormPrestamo)
  const [formCuota, setFormCuota] = useState(makeFormCuota)

  const { confirmProps, showConfirm } = useConfirm()

  const [calView, setCalView] = useState(() => { const d = new Date(); return { month: d.getMonth(), year: d.getFullYear() } })
  const [selectedDay, setSelectedDay] = useState(null)

  const [modalMov, setModalMov] = useState(null)
  const [editandoMov, setEditandoMov] = useState(null)
  const [formMov, setFormMov] = useState({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })

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
        descripcion: d.descripcion || '',
        categoria: d.categoria || 'deseo', tarjeta_id: d.perfil_tarjeta_id || '',
        limite: d.limite?.toString() || '', monto_compra: d.capital?.toString() || '',
        num_cuotas: d.plazo_meses?.toString() || '',
        dia_pago: d.dia_pago?.toString() || '',
        fecha_operacion: d.fecha_primer_pago || fechaHoy(), color: c, telefono: d.telefono || '',
      })
    } else if (d.tipo_deuda === 'prestamo') {
      setFormPrestamo({
        tipo_deuda: 'prestamo', tipo: tipoDeudor, emoji: d.emoji || '🏦', nombre: d.nombre || '',
        descripcion: d.descripcion || '',
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
        descripcion: d.descripcion || '',
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
    const resultado = await guardarDeuda({ editandoId, tipoSeleccionado, formTarjeta, formPrestamo, formCuota })
    if (resultado) {
      setModalDeuda(false)
      setEditandoId(null)
    }
  }

  async function handleMarcarPagada(deuda) {
    await marcarPagada(deuda)
  }

  async function handleAddMov(e) {
    e.preventDefault()
    if (!modalMov) return
    const ok = await agregarMovimiento({ deudaId: modalMov, formMov })
    if (ok) {
      setModalMov(null)
      setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
    }
  }

  async function handleEditMov(e) {
    e.preventDefault()
    if (!editandoMov) return
    const ok = await editarMovimiento({ editandoMov, formMov })
    if (ok) {
      setEditandoMov(null)
      setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
    }
  }

  function handleDeleteMov(mov) {
    eliminarMovimiento(mov, showConfirm)
  }

  function handleDeleteDeuda(id) {
    eliminarDeuda(id, { cardActiva, setCardActiva, expandido, setExpandido, tablaVisible, setTablaVisible, showConfirm })
  }

  // ─── Estadísticas ──────────────────────────────────────────────────────────

  const { activas, totalDebo, totalMeDeben, cuotasMes, vencenProximo } = calcularEstadisticas(deudas, movimientos)

  // ─── CALENDARIO ───────────────────────────────────────────────────────────

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  function calcPrimerPago(d, dia) {
    const fb = d.fecha_primer_pago
      ? new Date(d.fecha_primer_pago + 'T12:00:00')
      : new Date(d.created_at)
    let primerMes = fb.getMonth()
    let primerAño = fb.getFullYear()
    if (fb.getDate() > dia) {
      if (primerMes === 11) { primerMes = 0; primerAño++ } else { primerMes++ }
    }
    return { primerMes, primerAño }
  }

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

  const deudaByDay = {}
  activas.forEach(d => {
    const dia = parseInt(d.dia_pago)
    if (!dia || dia < 1 || dia > 31) return

    if (d.tipo_deuda === 'tarjeta') {
      const cargos = (movimientos[d.id] || []).filter(m => m.tipo === 'cargo')
      if (cargos.length > 0) {
        const periodoFin = new Date(calView.year, calView.month, dia)
        const prevM = calView.month === 0 ? 11 : calView.month - 1
        const prevY = calView.month === 0 ? calView.year - 1 : calView.year
        const periodoInicio = new Date(prevY, prevM, dia + 1)
        const tieneCargos = cargos.some(m => {
          if (!m.fecha) return false
          const [fy, fm, fd] = m.fecha.slice(0, 10).split('-').map(Number)
          const f = new Date(fy, fm - 1, fd)
          return f >= periodoInicio && f <= periodoFin
        })
        if (!tieneCargos) return
      } else if (d.plazo_meses) {
        const { primerMes, primerAño } = calcPrimerPago(d, dia)
        const offset = (calView.year - primerAño) * 12 + (calView.month - primerMes)
        if (offset < 0 || offset >= d.plazo_meses) return
      }
    }

    if (!deudaByDay[dia]) deudaByDay[dia] = []

    let pagada = false
    if (d.tipo_deuda === 'tarjeta' && !((movimientos[d.id] || []).filter(m => m.tipo === 'cargo').length > 0)) {
      const { primerMes, primerAño } = calcPrimerPago(d, dia)
      const offset = (calView.year - primerAño) * 12 + (calView.month - primerMes)
      pagada = offset < (d.pagadas || 0)
    } else {
      pagada = (movimientos[d.id] || []).some(m => {
        if (m.tipo !== 'pago') return false
        if (m.mes && m.año) return m.mes === calView.month + 1 && m.año === calView.year
        if (m.fecha) { const f = new Date(m.fecha); return f.getMonth() === calView.month && f.getFullYear() === calView.year }
        return false
      })
    }
    deudaByDay[dia].push({ ...d, pagada })
  })

  const hoyDia = now.getDate()
  const esHoy = (day) => day === hoyDia && calView.month === now.getMonth() && calView.year === now.getFullYear()

  // ─── DRAG & DROP ─────────────────────────────────────────────────────────

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function handleDragEnd(event) {
    await reordenarDeudas(event)
  }

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
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>💸 Lo que debo</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-rose)' }}>{formatCurrency(totalDebo)}</p>
        </div>
        <div className="glass-card p-3 animate-enter" style={{ animationDelay: '0.05s' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>🤝 Me deben</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>{formatCurrency(totalMeDeben)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="glass-card p-3 animate-enter" style={{ animationDelay: '0.1s' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Letras este mes</p>
          <p className="text-sm font-semibold" style={{ color: 'var(--accent-terra)' }}>{formatCurrency(cuotasMes)}</p>
        </div>
        <div className="glass-card p-3 animate-enter" style={{ animationDelay: '0.15s' }}>
          <p className="text-[9px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Vencen pronto</p>
          <p className="text-sm font-semibold" style={{ color: vencenProximo > 0 ? 'var(--accent-rose)' : 'var(--accent-green)' }}>
            {vencenProximo > 0 ? `${vencenProximo} deuda${vencenProximo > 1 ? 's' : ''}` : 'Al día ✓'}
          </p>
        </div>
      </div>

      {/* ── CALENDARIO ── */}
      {!loading && activas.length > 0 && (
        <div className="glass-card mb-6 animate-enter" style={{ padding: '16px' }}>
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMes} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <ChevronLeft size={14} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{MESES[calView.month]} {calView.year}</p>
              <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {Object.keys(deudaByDay).length} pago{Object.keys(deudaByDay).length !== 1 ? 's' : ''} este mes
              </p>
            </div>
            <button onClick={nextMes} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DIAS_SEMANA.map(d => (
              <p key={d} className="text-center text-[9px] font-semibold py-0.5" style={{ color: 'var(--text-muted)' }}>{d}</p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {calCells.map((day, i) => {
              if (!day) return <div key={`pad-${i}`} />
              const deudas_dia = deudaByDay[day] || []
              const isSelected = selectedDay === day
              const isToday = esHoy(day)
              const esMesActual = calView.month === now.getMonth() && calView.year === now.getFullYear()
              const isPast = esMesActual && day < hoyDia

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
                  {deudas_dia.length > 0 && (
                    <div className="flex gap-0.5 mt-1 flex-wrap justify-center" style={{ maxWidth: 28 }}>
                      {deudas_dia.slice(0, 3).map((d, idx) => (
                        <div key={idx} className="w-1.5 h-1.5 rounded-full"
                          style={{
                            background: d.pagada ? 'var(--accent-green)' : isPast ? 'var(--accent-rose)' : (d.color || 'var(--accent-rose)'),
                            opacity: d.pagada ? 1 : isPast ? 0.7 : 1,
                          }} />
                      ))}
                      {deudas_dia.length > 3 && (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
                      )}
                    </div>
                  )}
                  {isPast && deudas_dia.some(d => !d.pagada) && (
                    <span className="text-[7px] font-bold mt-0.5" style={{ color: 'var(--accent-rose)', lineHeight: 1 }}>!</span>
                  )}
                </button>
              )
            })}
          </div>

          {selectedDay && deudaByDay[selectedDay] && (
            <div className="mt-4 pt-3 border-t space-y-2" style={{ borderColor: 'var(--border-glass)' }}>
              <p className="text-[9px] uppercase font-semibold tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Pagos del día {selectedDay}
              </p>
              {deudaByDay[selectedDay].map(d => (
                <div key={d.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-base">{d.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {d.tipo === 'medeben' ? 'Me deben cobrar' : 'Debo pagar'}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: d.color || 'var(--accent-rose)' }}>
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
  <div className="space-y-3 py-2">
    {[1,2,3].map(i => (
      <div key={i} className="rounded-2xl p-4" style={{ border: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-3">
          <div className="skeleton w-10 h-10 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-2/5" />
            <div className="skeleton h-2.5 w-3/5" />
          </div>
          <div className="skeleton h-4 w-20" />
        </div>
      </div>
    ))}
  </div>
) : deudas.length === 0 ? (
  /* Añadimos flex-col e items-center para forzar el centrado vertical de los hijos */
  <div className="flex flex-col items-center justify-center text-center py-20 px-6">
    <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
      No hay deudas registradas
    </p>
    
    <button 
      onClick={abrirNueva} 
      className="ff-btn-primary !w-auto min-w-[200px]"
    >
      Agregar primera deuda
    </button>
  </div>
) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={deudas.map(d => d.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {deudas.map((d, i) => {
            const diasFaltantes = d.fecha_vencimiento
              ? Math.ceil((new Date(d.fecha_vencimiento) - new Date()) / (1000 * 60 * 60 * 24))
              : null
            const cfg = TIPO_CONFIG[d.tipo_deuda] || TIPO_CONFIG.tarjeta
            const dias = diasHastaPago(d)
            const urgencia = urgenciaColor(dias)
            const isExp = expandido === d.id
            const isTabla = tablaVisible === d.id
            const isActiva = cardActiva === d.id
            const movsDeuda = movimientos[d.id] || []
            const esCuota = d.tipo_deuda === 'cuota'
            const esMeDeben = d.tipo === 'medeben'
            const pagadaEsteMes = movsDeuda.some(m => m.tipo === 'pago' && m.mes === mes && m.año === año)

            // ── FIX barra de progreso ──────────────────────────────────────
            // Usar monto (deuda original) como máximo, con fallback robusto
            const montoOriginal = d.monto || d.capital || 0
            const pagado = Math.max(0, montoOriginal - (d.pendiente || 0))
            const pct = montoOriginal > 0 ? Math.min(100, Math.round((pagado / montoOriginal) * 100)) : 0
            const tieneProgreso = montoOriginal > 0

            // ── FIX historial: ordenar cronológicamente ASC ────────────────
            const movsOrdenados = [...movsDeuda].sort((a, b) => {
              const fa = a.fecha ? new Date(a.fecha) : new Date(0)
              const fb = b.fecha ? new Date(b.fecha) : new Date(0)
              return fa - fb
            })

            // Tabla de amortización (solo cuando está activa)
            const tieneInteres = (d.tasa_interes || d.tasa || 0) > 0
            const tablaAmort = isTabla ? generarTablaAmortizacion(d, movsDeuda) : []

            return (
              <SortableItem key={d.id} id={d.id}>
                {(dragListeners, isDragging) => (
              <Card
                className="animate-enter overflow-hidden cursor-pointer select-none"
                style={{ animationDelay: `${i * 0.04}s`, padding: '14px 16px', opacity: isDragging ? 0.45 : 1 }}
                onClick={() => {
                  // Click en la card: solo abre/cierra botones de acción
                  // NO toca historial ni tabla
                  setCardActiva(isActiva ? null : d.id)
                }}>

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

                {/* ── Cabecera: emoji + nombre + montos ── */}
                <div className="flex items-start gap-2.5 mb-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 mt-0.5"
                    style={{ background: `${d.color || cfg.color}18` }}>
                    <span>{d.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {d.nombre}
                    </p>
                   
                    {/* ── FIX: mostrar deuda original y pendiente ── */}
                    {montoOriginal > 0 && (
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {esMeDeben ? 'Prestado' : 'Total'}: <span className="font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(montoOriginal)}</span>
                        </span>
                        {pagado > 0 && (
                          <>
                            <span style={{ color: 'var(--border-glass)' }}>·</span>
                            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                              {esMeDeben ? 'Cobrado' : 'Pagado'}: <span className="font-semibold" style={{ color: 'var(--accent-green)' }}>{formatCurrency(pagado)}</span>
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full"
                        style={{ background: `color-mix(in srgb, ${cfg.color} 15%, transparent)`, color: cfg.color }}>
                        {cfg.label}
                      </span>
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
                  {/* Monto pendiente a la derecha */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-semibold tabular-nums"
                      style={{ color: d.color || cfg.color, letterSpacing: '-0.02em' }}>
                      {formatCurrency(d.pendiente || 0)}
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {esMeDeben ? 'por cobrar' : 'pendiente'}
                    </p>
                    {d.cuota > 0 && (
                      <p className="text-[9px] font-semibold mt-0.5 tabular-nums"
                        style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(d.cuota)}/mes
                      </p>
                    )}
                  </div>
                  <button
                    {...dragListeners}
                    onClick={e => e.stopPropagation()}
                    style={{
                      touchAction: 'none', cursor: 'grab',
                      background: 'none', border: 'none', padding: 4,
                      color: 'var(--text-muted)', opacity: 0.35, flexShrink: 0,
                      display: 'flex', alignItems: 'center', alignSelf: 'center',
                    }}
                  >
                    <GripVertical size={14} />
                  </button>
                </div>

                {/* ── FIX barra de progreso: solo renderizar si hay monto original ── */}
                {tieneProgreso && (
                  <div className="mb-1.5">
                    <ProgressBar value={pagado} max={montoOriginal} color={d.color || cfg.color} />
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>
                        {pct}% {esMeDeben ? 'cobrado' : 'pagado'}
                      </span>
                      <span className="text-[8px]" style={{ color: 'var(--text-muted)' }}>
                        {formatCurrency(d.pendiente || 0)} {esMeDeben ? 'por cobrar' : 'restante'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Info secundaria */}
                <div className="flex items-center gap-2 flex-wrap mt-1">
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

                {/* ── Botones de acción (se abren al tocar la card) ── */}
                <div className={`transition-all duration-200 overflow-hidden ${isActiva ? 'max-h-24 opacity-100 mt-3 pt-3 border-t' : 'max-h-0 opacity-0'}`}
                  style={{ borderColor: 'var(--border-glass)' }}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Marcar pagada / cobrar */}
                    {((esCuota || (d.tipo_deuda === 'prestamo' && d.cuota > 0) || (d.tipo_deuda === 'tarjeta' && d.cuota > 0)) || (esMeDeben && (d.pendiente || 0) > 0)) && d.estado !== 'pagada' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleMarcarPagada(d) }}
                        disabled={saving || pagadaEsteMes}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold uppercase transition-all active:scale-95 disabled:opacity-40"
                        style={{
                          background: pagadaEsteMes
                            ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)'
                            : 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                          color: 'var(--accent-green)',
                        }}>
                        <Check size={11} strokeWidth={3} />
                        {pagadaEsteMes ? (esMeDeben ? 'Cobrada' : 'Pagada') : (esMeDeben ? 'Cobrar' : 'Pagar')}
                      </button>
                    )}
                    {/* Cargo / Prestar más */}
                    <IconBtn
                      onClick={() => {
                        setModalMov(d.id)
                        setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
                      }}
                      title={esMeDeben ? 'Prestar más dinero' : 'Registrar cargo'}
                      bg={esMeDeben
                        ? 'color-mix(in srgb, var(--accent-blue) 10%, transparent)'
                        : 'color-mix(in srgb, var(--accent-rose) 10%, transparent)'}
                      color={esMeDeben ? 'var(--accent-blue)' : 'var(--accent-rose)'}>
                      <ArrowDownRight size={13} strokeWidth={2.5} />
                    </IconBtn>
                    {/* Pago / cobro */}
                    <IconBtn
                      onClick={() => {
                        setModalMov(d.id)
                        setFormMov({ tipo: 'pago', descripcion: esMeDeben ? `Cobro ${d.nombre}` : `Pago ${d.nombre}`, monto: d.cuota || d.pendiente || '', fecha: fechaHoy() })
                      }}
                      title={esMeDeben ? 'Registrar cobro' : 'Registrar pago'}
                      bg="color-mix(in srgb, var(--accent-green) 10%, transparent)"
                      color="var(--accent-green)">
                      <ArrowUpRight size={13} strokeWidth={2.5} />
                    </IconBtn>
                    {/* ── FIX botón historial: toggle independiente ── */}
                    <IconBtn
                      onClick={() => {
                        const nuevoExp = isExp ? null : d.id
                        setExpandido(nuevoExp)
                        // Si abrimos historial, cerramos tabla (y viceversa)
                        if (nuevoExp) setTablaVisible(null)
                      }}
                      title={isExp ? 'Ocultar historial' : 'Ver historial'}
                      bg={isExp ? 'color-mix(in srgb, var(--accent-blue) 15%, transparent)' : 'var(--bg-secondary)'}
                      color={isExp ? 'var(--accent-blue)' : 'var(--text-muted)'}>
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </IconBtn>
                    {/* Tabla de amortización */}
                    <IconBtn
                      onClick={() => {
                        const nuevaTabla = isTabla ? null : d.id
                        setTablaVisible(nuevaTabla)
                        // Si abrimos tabla, cerramos historial
                        if (nuevaTabla) setExpandido(null)
                      }}
                      title={d.plazo_meses ? 'Tabla de amortización' : 'Historial detallado'}
                      bg={isTabla ? 'color-mix(in srgb, var(--accent-violet) 15%, transparent)' : 'var(--bg-secondary)'}
                      color={isTabla ? 'var(--accent-violet)' : 'var(--text-muted)'}>
                      <Table2 size={12} />
                    </IconBtn>
                    {/* WhatsApp */}
                    {d.telefono && (
                      <IconBtn
                        onClick={() => {
                          const phone = d.telefono.replace(/\D/g, '')
                          const monto = formatCurrency(d.cuota || d.pendiente || 0)
                          const msg = `Hola! 👋 Te confirmo el pago de *${d.nombre}* por *${monto}*. ✅`
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                        }}
                        title="Notificar por WhatsApp"
                        bg="color-mix(in srgb, var(--accent-green) 12%, transparent)"
                        color="var(--accent-green)">
                        <MessageCircle size={12} />
                      </IconBtn>
                    )}
                    <IconBtn onClick={() => { abrirEdicion(d) }} title="Editar"
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

                {/* ── FIX Historial de movimientos (ordenado ASC, con monto original al inicio) ── */}
                {isExp && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-glass)' }}
                    onClick={e => e.stopPropagation()}>
                    <p className="text-[9px] uppercase font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                      Historial de movimientos
                    </p>

                    {/* Fila de creación de la deuda (monto original) */}
                    {montoOriginal > 0 && (
                      <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg mb-1"
                        style={{ background: 'var(--bg-secondary)' }}>
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)' }}>
                          <span className="text-[10px]">{d.emoji}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            Deuda registrada
                          </p>
                          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                            {d.fecha_primer_pago
                              ? new Date(d.fecha_primer_pago + 'T12:00:00').toLocaleDateString('es-ES')
                              : new Date(d.created_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <p className="text-xs font-semibold tabular-nums flex-shrink-0"
                          style={{ color: 'var(--text-secondary)' }}>
                          {formatCurrency(montoOriginal)}
                        </p>
                      </div>
                    )}

                    {movsOrdenados.length === 0 ? (
                      <p className="text-[10px] italic text-center py-2" style={{ color: 'var(--text-muted)' }}>
                        Sin movimientos registrados
                      </p>
                    ) : movsOrdenados.map(m => (
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
                            {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES') : '—'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <p className="text-xs font-semibold tabular-nums"
                            style={{ color: m.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                            {m.tipo === 'pago' ? '−' : '+'}{formatCurrency(m.monto)}
                          </p>
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

                    {/* Resumen de saldo */}
                    {montoOriginal > 0 && (
                      <div className="flex justify-between items-center mt-2 pt-2 border-t px-2"
                        style={{ borderColor: 'var(--border-glass)' }}>
                        <span className="text-[9px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                          Saldo pendiente
                        </span>
                        <span className="text-xs font-semibold tabular-nums"
                          style={{ color: d.pendiente > 0 ? (d.color || cfg.color) : 'var(--accent-green)' }}>
                          {formatCurrency(d.pendiente || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── FIX Tabla: sin columnas inútiles cuando no hay interés ── */}
                {isTabla && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-glass)' }}
                    onClick={e => e.stopPropagation()}>
                    <p className="text-[9px] uppercase font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                      {d.plazo_meses ? 'Tabla de amortización' : 'Historial detallado'} · {d.nombre}
                    </p>
                    <div className="overflow-x-auto -mx-2">

                      {/* Tabla de amortización (préstamo/tarjeta con plazo) */}
                      {tablaAmort.length > 0 && (
                        <table className="w-full text-[9px]" style={{ minWidth: tieneInteres ? 380 : 280 }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)' }}>
                              <th className="px-2 py-1 text-left font-semibold uppercase">#</th>
                              <th className="px-2 py-1 text-left font-semibold uppercase">Mes</th>
                              <th className="px-2 py-1 text-right font-semibold uppercase">Cuota</th>
                              {tieneInteres && (
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
                              const esActual = row.mes === mes && row.año === año
                              return (
                                <tr key={row.periodo}
                                  style={{
                                    background: row.parcial
                                      ? 'color-mix(in srgb, var(--accent-terra) 6%, transparent)'
                                      : row.pagada
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
                                    {esActual && (
                                      <span className="ml-1 text-[8px] px-1 rounded"
                                        style={{ background: 'color-mix(in srgb, var(--accent-violet) 20%, transparent)', color: 'var(--accent-violet)' }}>
                                        hoy
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                                    {row.parcial ? (
                                      <span>
                                        <span className="line-through opacity-40">{formatCurrency(row.cuota)}</span>
                                        {' '}
                                        <span className="font-semibold" style={{ color: 'var(--accent-terra)' }}>
                                          {formatCurrency(row.cuotaReal)}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="font-semibold">{formatCurrency(row.cuota)}</span>
                                    )}
                                  </td>
                                  {tieneInteres && (
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
                                    {row.parcial ? (
                                      <span title="Pago parcial" style={{ color: 'var(--accent-terra)' }}>≈</span>
                                    ) : row.pagada ? (
                                      <span style={{ color: 'var(--accent-green)' }}>✓</span>
                                    ) : row.vencida ? (
                                      <span style={{ color: 'var(--accent-rose)' }}>!</span>
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
                              {tieneInteres && (
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
                      )}

                      {/* Historial simple (sin plazo fijo: pago libre o cuota) */}
                      {tablaAmort.length === 0 && (
                        <table className="w-full text-[9px]" style={{ minWidth: 280 }}>
                          <thead>
                            <tr style={{ color: 'var(--text-muted)' }}>
                              <th className="px-2 py-1 text-left font-semibold uppercase">Fecha</th>
                              <th className="px-2 py-1 text-left font-semibold uppercase">Descripción</th>
                              <th className="px-2 py-1 text-right font-semibold uppercase">Monto</th>
                              <th className="px-2 py-1 text-center font-semibold uppercase">Tipo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Fila de creación de la deuda */}
                            <tr>
                              <td className="px-2 py-1.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                {new Date(d.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </td>
                              <td className="px-2 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                                {d.descripcion || d.nombre}
                              </td>
                              <td className="px-2 py-1.5 text-right font-semibold tabular-nums" style={{ color: 'var(--accent-rose)' }}>
                                +{formatCurrency(d.capital || d.monto || 0)}
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className="px-1.5 py-0.5 rounded-full font-semibold"
                                  style={{ background: 'color-mix(in srgb, var(--text-muted) 12%, transparent)', color: 'var(--text-muted)' }}>
                                  Origen
                                </span>
                              </td>
                            </tr>
                            {movsOrdenados.map(m => (
                              <tr key={m.id}>
                                <td className="px-2 py-1.5 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                  {m.fecha ? new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                                </td>
                                <td className="px-2 py-1.5 truncate max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>
                                  {m.descripcion || '—'}
                                </td>
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums"
                                  style={{ color: m.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                                  {m.tipo === 'pago' ? '−' : '+'}{formatCurrency(m.monto)}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <span className="px-1.5 py-0.5 rounded-full font-semibold"
                                    style={{
                                      background: m.tipo === 'pago'
                                        ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)'
                                        : 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
                                      color: m.tipo === 'pago' ? 'var(--accent-green)' : 'var(--accent-rose)',
                                    }}>
                                    {m.tipo === 'cargo' ? 'Cargo' : 'Pago'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                    {tablaAmort.length > 0 && (
                      <p className="text-[8px] mt-1.5 px-2" style={{ color: 'var(--text-muted)' }}>
                        ✓ pagada · ≈ parcial (saldo recalculado) · ! vencida sin pago · — pendiente
                      </p>
                    )}
                  </div>
                )}
              </Card>
                )}
              </SortableItem>
            )
          })}
        </div>
          </SortableContext>
        </DndContext>
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
                  <label className="text-[10px] font-semibold uppercase mb-2 block" style={{ color: 'var(--accent-violet)' }}>
                    Selecciona la tarjeta usada
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {misTarjetas.map(t => (
                      <button key={t.id} type="button"
                        onClick={() => { if (t.estado !== 'pausada') handleSeleccionarTarjetaPerfil(t.id) }}
                        disabled={t.estado === 'pausada'}
                        className="flex-shrink-0 px-3 py-2 rounded-xl border text-[10px] font-semibold uppercase transition-all flex items-center gap-2"
                        style={{
                          borderColor: t.estado === 'pausada' ? 'var(--border-glass)' : formTarjeta.tarjeta_id === t.id ? t.color : `${t.color}40`,
                          color: t.estado === 'pausada' ? 'var(--text-muted)' : t.color,
                          background: t.estado === 'pausada' ? 'var(--bg-secondary)' : formTarjeta.tarjeta_id === t.id ? `${t.color}12` : 'var(--bg-card)',
                          opacity: t.estado === 'pausada' ? 0.5 : 1,
                          cursor: t.estado === 'pausada' ? 'not-allowed' : 'pointer',
                        }}>
                        💳 {t.nombre_tarjeta}
                        {t.estado === 'pausada' && (
                          <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full ml-1"
                            style={{ background: 'color-mix(in srgb, var(--accent-terra) 15%, transparent)', color: 'var(--accent-terra)' }}>
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
                  <input className="ff-input text-center text-xl" maxLength={8}
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
              <div>
                <label className="ff-label">Descripción (opcional)</label>
                <input className="ff-input" placeholder="Ej: Motivo, detalles, acuerdo..."
                  value={formTarjeta.descripcion}
                  onChange={e => setFormTarjeta(p => ({ ...p, descripcion: e.target.value }))} />
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
                  style={{ background: 'color-mix(in srgb, var(--accent-violet) 8%, transparent)', color: 'var(--accent-violet)' }}>
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
                <p className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>Número internacional sin + (ej: 57 para Colombia)</p>
              </div>
              <ColorPicker value={formTarjeta.color} colors={themeColors} onChange={c => setFormTarjeta(p => ({ ...p, color: c }))} />
            </div>
          )}

          {/* ── PRÉSTAMO ── */}
          {tipoSeleccionado === 'prestamo' && (
            <div className="space-y-4">
              <TipoDeudorToggle value={formPrestamo.tipo} onChange={v => setFormPrestamo(p => ({ ...p, tipo: v }))} />
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="ff-label">Emoji</label>
                  <input className="ff-input text-center text-xl" maxLength={8}
                    value={formPrestamo.emoji}
                    onChange={e => setFormPrestamo(p => ({ ...p, emoji: e.target.value }))} />
                </div>
                <div className="col-span-3">
                  <label className="ff-label">Nombre del préstamo</label>
                  <input className="ff-input" required placeholder="Ej: Préstamo Juan..."
                    value={formPrestamo.nombre}
                    onChange={e => setFormPrestamo(p => ({ ...p, nombre: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="ff-label">Descripción (opcional)</label>
                <input className="ff-input" placeholder="Ej: Motivo salud, para renovar casa..."
                  value={formPrestamo.descripcion}
                  onChange={e => setFormPrestamo(p => ({ ...p, descripcion: e.target.value }))} />
              </div>
              {formPrestamo.tipo !== 'medeben' && (
                <CategoriaToggle value={formPrestamo.categoria} onChange={v => setFormPrestamo(p => ({ ...p, categoria: v }))} />
              )}
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
                  style={{ background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)', color: 'var(--accent-rose)' }}>
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
                <p className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>Número internacional sin + (ej: 57 para Colombia)</p>
              </div>
              <ColorPicker value={formPrestamo.color} colors={themeColors} onChange={c => setFormPrestamo(p => ({ ...p, color: c }))} />
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
                  <CustomSelect
                    value={formCuota.deuda_origen_id}
                    onChange={id => {
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
                    }}
                    options={deudas.filter(d => d.tipo_deuda !== 'cuota' && d.estado !== 'pagada').map(d => ({
                      id: d.id,
                      label: `${d.emoji} ${d.nombre} · ${d.cuota > 0 ? `${formatCurrency(d.cuota)}/mes` : `Pendiente ${formatCurrency(d.pendiente)}`}`,
                    }))}
                    placeholder="— Rellenar manualmente —"
                  />
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="ff-label">Emoji</label>
                  <input className="ff-input text-center text-xl" maxLength={8}
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
              <div>
                <label className="ff-label">Descripción (opcional)</label>
                <input className="ff-input" placeholder="Ej: Detalles del acuerdo..."
                  value={formCuota.descripcion}
                  onChange={e => setFormCuota(p => ({ ...p, descripcion: e.target.value }))} />
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
                <p className="text-[9px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>Número internacional sin + (ej: 57 para Colombia)</p>
              </div>
              <ColorPicker value={formCuota.color} colors={themeColors} onChange={c => setFormCuota(p => ({ ...p, color: c }))} />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-6">
          <button type="button"
            onClick={() => { setModalDeuda(false); setEditandoId(null) }}
            className="ff-btn-ghost flex-1">Cancelar</button>
          <button onClick={handleSaveDeuda} disabled={saving}
            className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Guardando...' : editandoId ? 'Guardar' : 'Crear'}
          </button>
        </div>
      </Modal>

      {/* ── MODAL MOVIMIENTO ── */}
      {(() => {
        const deudaModal = deudas.find(d => d.id === (modalMov || editandoMov?.deuda_id))
        const esMeDebenModal = deudaModal?.tipo === 'medeben'
        const labelCargo = esMeDebenModal ? '↓ Prestar más' : '↓ Cargo'
        const labelPago  = esMeDebenModal ? '↑ Cobro recibido' : '↑ Pago'
        const titleModal = editandoMov
          ? 'Editar Movimiento'
          : formMov.tipo === 'pago'
            ? (esMeDebenModal ? 'Registrar Cobro' : 'Registrar Pago')
            : (esMeDebenModal ? 'Prestar más dinero' : 'Registrar Cargo')
        const placeholderDesc = formMov.tipo === 'pago'
          ? (esMeDebenModal ? 'Ej: Me devolvió julio...' : 'Ej: Pago mensual')
          : (esMeDebenModal ? 'Ej: Nuevo préstamo salud...' : 'Ej: Compra supermercado...')
        const colorBoton = formMov.tipo === 'pago'
          ? 'var(--accent-green)'
          : (esMeDebenModal ? 'var(--accent-blue)' : 'var(--accent-rose)')
        const labelConfirmar = saving
          ? 'Guardando...'
          : editandoMov
            ? 'Guardar cambios'
            : formMov.tipo === 'pago'
              ? (esMeDebenModal ? 'Confirmar Cobro' : 'Confirmar Pago')
              : (esMeDebenModal ? 'Registrar Préstamo' : 'Registrar Cargo')
        return (
          <Modal
            open={!!modalMov || !!editandoMov}
            onClose={() => {
              setModalMov(null)
              setEditandoMov(null)
              setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: fechaHoy() })
            }}
            title={titleModal}>
            <form onSubmit={editandoMov ? handleEditMov : handleAddMov} className="space-y-4">
              {!editandoMov && (
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
                  {[{ v: 'cargo', l: labelCargo }, { v: 'pago', l: labelPago }].map(t => (
                    <button type="button" key={t.v}
                      onClick={() => setFormMov(p => ({ ...p, tipo: t.v }))}
                      className="py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all"
                      style={{
                        background: formMov.tipo === t.v ? 'var(--bg-card)' : 'transparent',
                        color: formMov.tipo === t.v ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: formMov.tipo === t.v ? 'var(--shadow-sm)' : 'none',
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
                  Tipo: {editandoMov.tipo === 'pago' ? labelPago : labelCargo} · No se puede cambiar al editar
                </div>
              )}
              <div>
                <label className="ff-label">Descripción</label>
                <input className="ff-input" required
                  placeholder={placeholderDesc}
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
              <div className="flex gap-3 pt-6">
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
                  style={{ background: colorBoton }}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {labelConfirmar}
                </button>
              </div>
            </form>
          </Modal>
        )
      })()}
      <ConfirmDialog {...confirmProps} />
    </AppShell>
  )
}

// ── Componentes reutilizables ─────────────────────────────────────────────────

function CategoriaToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[{ v: 'deseo', l: 'Estilo de vida' }, { v: 'basicos', l: 'Básicos' }].map(c => (
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