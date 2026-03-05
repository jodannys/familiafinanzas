'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import {
  Plus, Loader2, Trash2, CreditCard, Landmark,
  ChevronDown, ChevronUp, Pencil,
  ArrowDownRight, ArrowUpRight, Calendar
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

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
  if (dias <= 3) return { bg: 'rgba(192,96,90,0.1)',  text: '#C0605A', label: `¡Vence en ${dias}d!` }
  if (dias <= 7) return { bg: 'rgba(193,122,58,0.1)', text: '#C17A3A', label: `Vence en ${dias}d` }
  return             { bg: 'rgba(45,122,95,0.1)',   text: '#2D7A5F', label: `${dias}d para pago` }
}

const TIPO_CONFIG = {
  tarjeta:  { label: 'Tarjeta',  icon: CreditCard, color: '#818CF8' },
  prestamo: { label: 'Préstamo', icon: Landmark,   color: '#C0605A' },
  cuota:    { label: 'Cuota',    icon: Calendar,   color: '#C17A3A' },
}

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 34, height: 34, flexShrink: 0 }}>
      {children}
    </button>
  )
}

const FORM_VACIO = {
  emoji: '💳', nombre: '', tipo_deuda: 'tarjeta', categoria: 'deseo',
  limite: '', capital: '', adelanto: '', tasa_interes: '', plazo_meses: '',
  dia_corte: '', dia_pago: '', fecha_primer_pago: '', color: '#818CF8',
}

export default function DeudasPage() {
  const [deudas, setDeudas] = useState([])
  const [movimientos, setMovimientos] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [cardActiva, setCardActiva] = useState(null)
  const [modalDeuda, setModalDeuda] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [modalMov, setModalMov] = useState(null)
  const [formDeuda, setFormDeuda] = useState(FORM_VACIO)
  const [formMov, setFormMov] = useState({ tipo: 'cargo', descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10) })

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('deudas').select('*').order('created_at')
    if (error) { setError(error.message); setLoading(false); return }
    setDeudas(data || [])
    if (data?.length) {
      const { data: movs } = await supabase.from('deuda_movimientos').select('*').order('fecha', { ascending: false })
      const grouped = {}
      ;(movs || []).forEach(m => {
        if (!grouped[m.deuda_id]) grouped[m.deuda_id] = []
        grouped[m.deuda_id].push(m)
      })
      setMovimientos(grouped)
    }
    setLoading(false)
  }

  function abrirEdicion(d) {
    setEditandoId(d.id)
    setFormDeuda({
      emoji: d.emoji || '💳',
      nombre: d.nombre || '',
      tipo_deuda: d.tipo_deuda || 'tarjeta',
      categoria: d.categoria || 'deseo',
      limite: d.limite?.toString() || '',
      capital: d.capital?.toString() || '',
      adelanto: d.adelanto?.toString() || '',
      tasa_interes: d.tasa_interes?.toString() || '',
      plazo_meses: d.plazo_meses?.toString() || '',
      dia_corte: d.dia_corte?.toString() || '',
      dia_pago: d.dia_pago?.toString() || '',
      fecha_primer_pago: d.fecha_primer_pago || '',
      color: d.color || '#818CF8',
    })
    setModalDeuda(true)
  }

  async function handleSaveDeuda(e) {
    e.preventDefault()
    setSaving(true)
    const capital  = parseFloat(formDeuda.capital) || 0
    const adelanto = parseFloat(formDeuda.adelanto) || 0
    const tasa     = parseFloat(formDeuda.tasa_interes) || 0
    const meses    = parseInt(formDeuda.plazo_meses) || 0
    const cuota    = calcularCuota(capital - adelanto, tasa, meses)

    const payload = {
      ...formDeuda,
      limite: parseFloat(formDeuda.limite) || 0,
      capital, adelanto, tasa_interes: tasa,
      plazo_meses: meses,
      cuota: parseFloat(cuota.toFixed(2)),
      dia_corte: parseInt(formDeuda.dia_corte) || null,
      dia_pago: parseInt(formDeuda.dia_pago) || null,
    }

    if (editandoId) {
      const { error } = await supabase.from('deudas').update(payload).eq('id', editandoId)
      if (error) setError(error.message)
      else setDeudas(prev => prev.map(d => d.id === editandoId ? { ...d, ...payload } : d))
    } else {
      const { data, error } = await supabase.from('deudas').insert([{
        ...payload, pagadas: 0,
        pendiente: capital - adelanto,
        monto: capital, tipo: 'debo', estado: 'activa',
      }]).select()
      if (error) setError(error.message)
      else setDeudas(prev => [...prev, data[0]])
    }

    setSaving(false)
    setModalDeuda(false)
    setEditandoId(null)
    setFormDeuda(FORM_VACIO)
  }

  async function handleAddMov(e) {
    e.preventDefault()
    if (!modalMov) return
    setSaving(true)
    const monto = parseFloat(formMov.monto)
    const { data, error } = await supabase.from('deuda_movimientos').insert([{
      deuda_id: modalMov, tipo: formMov.tipo,
      descripcion: formMov.descripcion, monto,
      fecha: formMov.fecha, mes, año,
    }]).select()

    if (!error) {
      setMovimientos(prev => ({ ...prev, [modalMov]: [data[0], ...(prev[modalMov] || [])] }))
      if (formMov.tipo === 'pago') {
        const deuda = deudas.find(d => d.id === modalMov)
        await supabase.from('movimientos').insert([{
          tipo: 'egreso', categoria: 'deuda',
          descripcion: `Pago ${deuda?.nombre || 'deuda'}`,
          monto, fecha: formMov.fecha, quien: 'Ambos',
        }])
        if (deuda) {
          const nuevosPagados  = (deuda.pagadas || 0) + 1
          const nuevoPendiente = Math.max(0, (deuda.pendiente || 0) - monto)
          const nuevoEstado    = nuevoPendiente <= 0 ? 'pagada' : 'activa'
          await supabase.from('deudas').update({ pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado }).eq('id', modalMov)
          setDeudas(prev => prev.map(d => d.id === modalMov ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado } : d))
        }
      }
      setModalMov(null)
      setFormMov({ tipo: 'cargo', descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10) })
    }
    setSaving(false)
  }

  async function handleDeleteDeuda(id) {
    if (!confirm('¿Eliminar esta deuda y todos sus movimientos?')) return
    const deuda = deudas.find(d => d.id === id)
    if (deuda) {
      await supabase.from('movimientos').delete()
        .eq('categoria', 'deuda')
        .ilike('descripcion', `%${deuda.nombre}%`)
    }
    await supabase.from('deudas').delete().eq('id', id)
    setDeudas(prev => prev.filter(d => d.id !== id))
    if (cardActiva === id) setCardActiva(null)
  }

  async function handleDeleteMov(id, deudaId) {
    await supabase.from('deuda_movimientos').delete().eq('id', id)
    setMovimientos(prev => ({ ...prev, [deudaId]: prev[deudaId].filter(m => m.id !== id) }))
  }

  const totalDeuda    = deudas.filter(d => d.estado !== 'pagada').reduce((s, d) => s + (d.pendiente || 0), 0)
  const cuotasMes     = deudas.filter(d => d.estado !== 'pagada').reduce((s, d) => s + (d.cuota || 0), 0)
  const vencenProximo = deudas.filter(d => { const dias = diasHastaPago(d.dia_pago); return dias !== null && dias <= 7 && d.estado !== 'pagada' }).length

  const cuotaPreview = calcularCuota(
    (parseFloat(formDeuda.capital) || 0) - (parseFloat(formDeuda.adelanto) || 0),
    parseFloat(formDeuda.tasa_interes) || 0,
    parseInt(formDeuda.plazo_meses) || 0
  )

  return (
    <AppShell>
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Módulo</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight truncate">Mis Deudas</h1>
        </div>
        <button onClick={() => { setEditandoId(null); setFormDeuda(FORM_VACIO); setModalDeuda(true) }}
          className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-bold">Nueva deuda</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { label: 'Deuda total',   value: formatCurrency(totalDeuda),  color: '#C0605A' },
          { label: 'Cuotas/mes',    value: formatCurrency(cuotasMes),   color: 'var(--accent-terra)' },
          { label: 'Vencen pronto', value: vencenProximo > 0 ? `${vencenProximo} deuda${vencenProximo > 1 ? 's' : ''}` : 'Al día ✓', color: vencenProximo > 0 ? '#C0605A' : 'var(--accent-green)' },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] text-stone-400 uppercase tracking-wider font-bold mb-1">{s.label}</p>
            <p className="text-sm font-black" style={{ color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin text-stone-400" />
        </div>
      ) : deudas.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-stone-400 text-sm mb-4">No hay deudas registradas</p>
          <button onClick={() => setModalDeuda(true)} className="ff-btn-primary">Agregar primera deuda</button>
        </div>
      ) : (
        <div className="space-y-3">
          {deudas.map((d, i) => {
            const cfg       = TIPO_CONFIG[d.tipo_deuda] || TIPO_CONFIG.tarjeta
            const pct       = d.monto > 0 ? Math.min(100, Math.round(((d.monto - (d.pendiente || 0)) / d.monto) * 100)) : 0
            const dias      = diasHastaPago(d.dia_pago)
            const urgencia  = urgenciaColor(dias)
            const isExp     = expandido === d.id
            const isActiva  = cardActiva === d.id
            const movsDeuda = movimientos[d.id] || []

            return (
              <Card key={d.id} className="animate-enter overflow-hidden cursor-pointer select-none"
                style={{ animationDelay: `${i * 0.04}s`, padding: '14px 16px' }}
                onClick={() => setCardActiva(isActiva ? null : d.id)}>

                {/* Fila 1 */}
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
                        style={{ background: d.categoria === 'basicos' ? 'rgba(74,111,165,0.1)' : 'rgba(193,122,58,0.1)', color: d.categoria === 'basicos' ? '#4A6FA5' : '#C17A3A' }}>
                        {d.categoria}
                      </span>
                      {urgencia && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: urgencia.bg, color: urgencia.text }}>{urgencia.label}</span>
                      )}
                      {d.estado === 'pagada' && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>✓ Pagada</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-black tabular-nums" style={{ color: d.color || cfg.color, letterSpacing: '-0.02em' }}>
                      {formatCurrency(d.pendiente || 0)}
                    </p>
                    <p className="text-[9px] text-stone-400">pendiente</p>
                  </div>
                </div>

                {/* Barra */}
                {d.monto > 0 && (
                  <div className="mb-2.5">
                    <ProgressBar value={d.monto - (d.pendiente || 0)} max={d.monto} color={d.color || cfg.color} />
                  </div>
                )}

                {/* Detalles */}
                <div className="flex items-center gap-2 flex-wrap">
                  {d.cuota > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      {formatCurrency(d.cuota)}/mes
                    </span>
                  )}
                  {d.plazo_meses > 0 && (
                    <span className="text-[9px] text-stone-400">{d.pagadas || 0}/{d.plazo_meses} cuotas · {pct}%</span>
                  )}
                  {d.dia_pago && <span className="text-[9px] text-stone-400">Pago día {d.dia_pago}</span>}
                </div>

                {/* ── ACCIONES: solo visibles al tocar la card ── */}
                <div className={`transition-all duration-200 overflow-hidden ${isActiva ? 'max-h-16 opacity-100 mt-3 pt-3 border-t' : 'max-h-0 opacity-0'}`}
                  style={{ borderColor: 'var(--border-glass)' }}>
                  <div className="flex items-center gap-2">
                    <IconBtn onClick={() => { setModalMov(d.id); setFormMov(prev => ({ ...prev, tipo: 'cargo' })) }}
                      title="Registrar cargo" bg="rgba(192,96,90,0.1)" color="#C0605A">
                      <ArrowDownRight size={13} strokeWidth={2.5} />
                    </IconBtn>
                    <IconBtn onClick={() => { setModalMov(d.id); setFormMov(prev => ({ ...prev, tipo: 'pago' })) }}
                      title="Registrar pago" bg="rgba(16,185,129,0.1)" color="#10b981">
                      <ArrowUpRight size={13} strokeWidth={2.5} />
                    </IconBtn>
                    <IconBtn onClick={() => setExpandido(isExp ? null : d.id)}
                      title="Ver historial" bg="var(--bg-secondary)" color="var(--text-muted)">
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </IconBtn>
                    <IconBtn onClick={() => abrirEdicion(d)}
                      title="Editar" bg="rgba(74,111,165,0.1)" color="#4A6FA5">
                      <Pencil size={12} />
                    </IconBtn>
                    <IconBtn onClick={() => handleDeleteDeuda(d.id)}
                      title="Eliminar" bg="rgba(192,96,90,0.08)" color="#C0605A">
                      <Trash2 size={12} />
                    </IconBtn>
                  </div>
                </div>

                {/* Historial */}
                {isExp && (
                  <div className="mt-3 pt-3 border-t space-y-1" style={{ borderColor: 'var(--border-glass)' }}>
                    {movsDeuda.length === 0 ? (
                      <p className="text-[10px] text-stone-400 italic text-center py-2">Sin movimientos aún</p>
                    ) : movsDeuda.map(m => (
                      <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-stone-50 group">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: m.tipo === 'pago' ? 'rgba(16,185,129,0.1)' : 'rgba(192,96,90,0.1)' }}>
                          {m.tipo === 'pago'
                            ? <ArrowUpRight size={11} style={{ color: '#10b981' }} />
                            : <ArrowDownRight size={11} style={{ color: '#C0605A' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-stone-700 truncate">{m.descripcion}</p>
                          <p className="text-[9px] text-stone-400">
                            {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES')} · {m.tipo}
                          </p>
                        </div>
                        <p className="text-xs font-black flex-shrink-0 tabular-nums"
                          style={{ color: m.tipo === 'pago' ? '#10b981' : '#C0605A' }}>
                          {m.tipo === 'pago' ? '-' : '+'}{formatCurrency(m.monto)}
                        </p>
                        <button onClick={e => { e.stopPropagation(); handleDeleteMov(m.id, d.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1" style={{ color: '#C0605A' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* MODAL: Nueva / Editar */}
      <Modal open={modalDeuda} onClose={() => { setModalDeuda(false); setEditandoId(null); setFormDeuda(FORM_VACIO) }}
        title={editandoId ? 'Editar Deuda' : 'Nueva Deuda'}>
        <form onSubmit={handleSaveDeuda} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
              <button type="button" key={key}
                onClick={() => setFormDeuda(prev => ({ ...prev, tipo_deuda: key }))}
                className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                style={{
                  background: formDeuda.tipo_deuda === key ? `${cfg.color}15` : 'var(--bg-secondary)',
                  color: formDeuda.tipo_deuda === key ? cfg.color : 'var(--text-muted)',
                  border: `1px solid ${formDeuda.tipo_deuda === key ? `${cfg.color}40` : 'var(--border-glass)'}`,
                }}>
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2} value={formDeuda.emoji}
                onChange={e => setFormDeuda(prev => ({ ...prev, emoji: e.target.value }))} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre</label>
              <input className="ff-input" placeholder="Ej: Visa Banco X, Préstamo Auto..." required
                value={formDeuda.nombre} onChange={e => setFormDeuda(prev => ({ ...prev, nombre: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[{ v: 'deseo', l: 'Gastos Deseo' }, { v: 'basicos', l: 'Gastos Básicos' }].map(c => (
              <button type="button" key={c.v}
                onClick={() => setFormDeuda(prev => ({ ...prev, categoria: c.v }))}
                className="py-2.5 rounded-xl text-[10px] font-black uppercase transition-all"
                style={{
                  background: formDeuda.categoria === c.v ? 'rgba(45,122,95,0.1)' : 'var(--bg-secondary)',
                  color: formDeuda.categoria === c.v ? '#2D7A5F' : 'var(--text-muted)',
                  border: `1px solid ${formDeuda.categoria === c.v ? 'rgba(45,122,95,0.3)' : 'var(--border-glass)'}`,
                }}>
                {c.l}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {formDeuda.tipo_deuda === 'tarjeta' ? (
              <div className="col-span-2">
                <label className="ff-label">Límite de crédito</label>
                <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                  value={formDeuda.limite}
                  onChange={e => setFormDeuda(prev => ({ ...prev, limite: e.target.value, capital: e.target.value }))} />
              </div>
            ) : (
              <>
                <div>
                  <label className="ff-label">Capital total (€)</label>
                  <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                    value={formDeuda.capital} onChange={e => setFormDeuda(prev => ({ ...prev, capital: e.target.value }))} />
                </div>
                <div>
                  <label className="ff-label">Adelanto / Enganche</label>
                  <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                    value={formDeuda.adelanto} onChange={e => setFormDeuda(prev => ({ ...prev, adelanto: e.target.value }))} />
                </div>
              </>
            )}
          </div>

          {formDeuda.tipo_deuda !== 'tarjeta' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="ff-label">Tasa interés anual (%)</label>
                <input className="ff-input" type="number" min="0" step="0.1" placeholder="0"
                  value={formDeuda.tasa_interes} onChange={e => setFormDeuda(prev => ({ ...prev, tasa_interes: e.target.value }))} />
              </div>
              <div>
                <label className="ff-label">Plazo (meses)</label>
                <input className="ff-input" type="number" min="1" placeholder="12"
                  value={formDeuda.plazo_meses} onChange={e => setFormDeuda(prev => ({ ...prev, plazo_meses: e.target.value }))} />
              </div>
            </div>
          )}

          {formDeuda.tipo_deuda !== 'tarjeta' && cuotaPreview > 0 && (
            <div className="px-4 py-3 rounded-xl"
              style={{ background: 'rgba(45,122,95,0.08)', border: '1px solid rgba(45,122,95,0.2)' }}>
              <p className="text-xs text-stone-500">Cuota mensual calculada</p>
              <p className="text-xl font-black" style={{ color: '#2D7A5F' }}>{formatCurrency(cuotaPreview)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {formDeuda.tipo_deuda === 'tarjeta' && (
              <div>
                <label className="ff-label">Día de corte</label>
                <input className="ff-input" type="number" min="1" max="31" placeholder="15"
                  value={formDeuda.dia_corte} onChange={e => setFormDeuda(prev => ({ ...prev, dia_corte: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="ff-label">Día de pago</label>
              <input className="ff-input" type="number" min="1" max="31" placeholder="5"
                value={formDeuda.dia_pago} onChange={e => setFormDeuda(prev => ({ ...prev, dia_pago: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Fecha 1er pago</label>
              <input className="ff-input" type="date"
                value={formDeuda.fecha_primer_pago} onChange={e => setFormDeuda(prev => ({ ...prev, fecha_primer_pago: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-3 flex-wrap">
              {['#818CF8', '#C0605A', '#C17A3A', '#10b981', '#38bdf8', '#f59e0b'].map(c => (
                <button type="button" key={c} onClick={() => setFormDeuda(prev => ({ ...prev, color: c }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{ background: c, outline: formDeuda.color === c ? `3px solid ${c}` : 'none', outlineOffset: 2, opacity: formDeuda.color === c ? 1 : 0.5 }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setModalDeuda(false); setEditandoId(null); setFormDeuda(FORM_VACIO) }}
              className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear deuda'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Movimiento */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)}
        title={formMov.tipo === 'pago' ? 'Registrar Pago' : 'Registrar Cargo'}>
        <form onSubmit={handleAddMov} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-2xl">
            {[{ v: 'cargo', l: '↓ Cargo' }, { v: 'pago', l: '↑ Pago' }].map(t => (
              <button type="button" key={t.v}
                onClick={() => setFormMov(prev => ({ ...prev, tipo: t.v }))}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${formMov.tipo === t.v ? 'bg-white shadow-sm text-stone-800' : 'text-stone-400'}`}>
                {t.l}
              </button>
            ))}
          </div>

          {formMov.tipo === 'pago' && (
            <div className="px-3 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(16,185,129,0.08)', color: '#2D7A5F', border: '1px solid rgba(16,185,129,0.2)' }}>
              ✓ Se registrará automáticamente en Ingresos & Egresos
            </div>
          )}

          <div>
            <label className="ff-label">Descripción</label>
            <input className="ff-input" required
              placeholder={formMov.tipo === 'pago' ? 'Ej: Pago mensual Visa' : 'Ej: Delivery, Ropa...'}
              value={formMov.descripcion} onChange={e => setFormMov(prev => ({ ...prev, descripcion: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Monto (€)</label>
              <input className="ff-input text-lg font-black" type="number" step="0.01" placeholder="0.00" required
                value={formMov.monto} onChange={e => setFormMov(prev => ({ ...prev, monto: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Fecha</label>
              <input className="ff-input" type="date" required
                value={formMov.fecha} onChange={e => setFormMov(prev => ({ ...prev, fecha: e.target.value }))} />
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