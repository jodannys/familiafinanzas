'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import ConfirmDialog, { useConfirm } from '@/components/ui/ConfirmDialog'
import { Plus, Loader2, Trash2, Pencil, Pause, Play, CreditCard, Save, AlertTriangle, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { formatCurrency } from '@/lib/utils'
import { useTheme, getThemeColors } from '@/lib/themes'

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 36, height: 36, flexShrink: 0 }}>
      {children}
    </button>
  )
}

export default function TarjetasPage() {
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)

  const [tarjetas, setTarjetas] = useState([])
  const [deudas, setDeudas] = useState([])
  const [movsPorDeuda, setMovsPorDeuda] = useState({})
  const [usadoPorTarjeta, setUsadoPorTarjeta] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [modalPago, setModalPago] = useState(false)
  const [pagoDeuda, setPagoDeuda] = useState(null)
  const [formPago, setFormPago] = useState({ monto: '', descripcion: '', fecha: '' })
  const [savingPago, setSavingPago] = useState(false)

  const [form, setForm] = useState({
    nombre_tarjeta: '', banco: '', limite_credito: '',
    dia_corte: '', dia_pago: '', estado: 'activa', color: '',
  })

  const { confirmProps, showConfirm } = useConfirm()

  // Inicializar color y resetear si el tema cambia
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
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') cargar()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  async function cargar() {
    setLoading(true)

    // FIX 1: queries paralelas en vez de secuenciales
    const [
      { data: tarjetasData, error: e1 },
      { data: deudasTarjeta },
    ] = await Promise.all([
      supabase.from('perfiles_tarjetas').select('*').order('created_at', { ascending: false }),
      supabase.from('deudas')
        .select('id, nombre, perfil_tarjeta_id, pendiente, estado, capital, cuota, plazo_meses, pagadas, created_at, fecha_primer_pago, color')
        .eq('tipo_deuda', 'tarjeta')
        .order('created_at', { ascending: false }),
    ])

    if (e1) { setLoading(false); return }

    const todasDeudas = deudasTarjeta || []
    setTarjetas(tarjetasData || [])
    setDeudas(todasDeudas)

    // Solo contar deudas activas para el saldo usado
    const usado = {}
    ;(tarjetasData || []).forEach(t => { usado[t.id] = 0 })
    ;todasDeudas.filter(d => d.estado !== 'pagada').forEach(d => {
      if (d.perfil_tarjeta_id && usado[d.perfil_tarjeta_id] !== undefined) {
        const tarjeta = (tarjetasData || []).find(t => t.id === d.perfil_tarjeta_id)
        if (tarjeta && tarjeta.estado !== 'pausada') {
          usado[d.perfil_tarjeta_id] += (d.pendiente || 0)
        }
      }
    })
    setUsadoPorTarjeta(usado)

    // Cargar pagos de cada deuda de tarjeta
    if (todasDeudas.length) {
      const ids = todasDeudas.map(d => d.id)
      const { data: movs } = await supabase
        .from('deuda_movimientos')
        .select('deuda_id, tipo, monto, fecha, descripcion')
        .in('deuda_id', ids)
        .order('fecha', { ascending: false })
      const grouped = {}
      ;(movs || []).forEach(m => {
        if (!grouped[m.deuda_id]) grouped[m.deuda_id] = []
        grouped[m.deuda_id].push(m)
      })
      setMovsPorDeuda(grouped)
    }

    setLoading(false)
  }

  const openModal = (tarjeta = null) => {
    if (tarjeta) {
      setEditingId(tarjeta.id)
      setForm({
        nombre_tarjeta: tarjeta.nombre_tarjeta || '',
        banco: tarjeta.banco || '',
        limite_credito: tarjeta.limite_credito?.toString() || '',
        dia_corte: tarjeta.dia_corte?.toString() || '',
        dia_pago: tarjeta.dia_pago?.toString() || '',
        estado: tarjeta.estado || 'activa',
        color: tarjeta.color || themeColors[0] || '',
      })
    } else {
      setEditingId(null)
      setForm({ nombre_tarjeta: '', banco: '', limite_credito: '', dia_corte: '', dia_pago: '', estado: 'activa', color: themeColors[0] || '' })
    }
    setModal(true)
  }

  const closeModal = () => { setModal(false); setEditingId(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)

    // FIX 5: validar rango de dia_corte y dia_pago
    const diaCorte = parseInt(form.dia_corte) || null
    const diaPago = parseInt(form.dia_pago) || null
    if (diaCorte !== null && (diaCorte < 1 || diaCorte > 31)) {
      toast('El día de corte debe estar entre 1 y 31')
      setSaving(false)
      return
    }
    if (diaPago !== null && (diaPago < 1 || diaPago > 31)) {
      toast('El día de pago debe estar entre 1 y 31')
      setSaving(false)
      return
    }

    const payload = {
      nombre_tarjeta: form.nombre_tarjeta,
      banco: form.banco,
      limite_credito: parseFloat(form.limite_credito) || 0,
      dia_corte: diaCorte,
      dia_pago: diaPago,
      estado: form.estado,
      color: form.color,
    }

    if (editingId) {
      await supabase.from('perfiles_tarjetas').update(payload).eq('id', editingId)
      // FIX 3: solo actualizar estado local, sin cargar() innecesario
      setTarjetas(prev => prev.map(t => t.id === editingId ? { ...t, ...payload } : t))
    } else {
      const { data } = await supabase.from('perfiles_tarjetas').insert([payload]).select()
      if (data?.[0]) {
        setTarjetas(prev => [data[0], ...prev])
        // inicializar su saldo en 0
        setUsadoPorTarjeta(prev => ({ ...prev, [data[0].id]: 0 }))
      }
    }

    setSaving(false)
    closeModal()
    // FIX 3: sin cargar() aquí — estado ya actualizado arriba
  }

  async function handleToggleEstado(tarjeta) {
    const nuevoEstado = tarjeta.estado === 'activa' ? 'pausada' : 'activa'
    // BUG FIX: sólo actualizar estado local si la BD confirma el cambio
    const { error } = await supabase.from('perfiles_tarjetas').update({ estado: nuevoEstado }).eq('id', tarjeta.id)
    if (error) {
      toast('' + error.message)
      return
    }
    setTarjetas(prev => prev.map(t => t.id === tarjeta.id ? { ...t, estado: nuevoEstado } : t))
  }

  function handleDelete(id) {
    showConfirm('¿Eliminar esta tarjeta? Las compras a plazos asociadas quedarán sin perfil.', async () => {
      // Desvincular deudas primero
      const { error: errDesvincular } = await supabase.from('deudas')
        .update({ perfil_tarjeta_id: null })
        .eq('perfil_tarjeta_id', id)

      if (errDesvincular) {
        toast('' + errDesvincular.message)
        return
      }

      // BUG FIX: sólo borrar localmente si la BD confirma el borrado
      const { error } = await supabase.from('perfiles_tarjetas').delete().eq('id', id)
      if (error) {
        toast('' + error.message)
        return
      }

      setTarjetas(prev => prev.filter(t => t.id !== id))
      setDeudas(prev => prev.map(d =>
        d.perfil_tarjeta_id === id ? { ...d, perfil_tarjeta_id: null } : d
      ))
      if (selectedId === id) setSelectedId(null)
    })
  }

  function handleDeleteDeuda(e, deuda) {
    e.stopPropagation()
    showConfirm(`¿Eliminar "${deuda.nombre}"? Se borrarán también sus pagos registrados.`, async () => {
      const { error: errMovs } = await supabase.from('deuda_movimientos').delete().eq('deuda_id', deuda.id)
      if (errMovs) { toast('Error al borrar los pagos: ' + errMovs.message); return }
      const { error } = await supabase.from('deudas').delete().eq('id', deuda.id)
      if (error) { toast('' + error.message); return }
      setDeudas(prev => prev.filter(d => d.id !== deuda.id))
    })
  }

  function abrirPago(e, deuda) {
    e.stopPropagation()
    setPagoDeuda(deuda)
    setFormPago({ monto: deuda.cuota > 0 ? deuda.cuota.toString() : '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) })
    setModalPago(true)
  }

  async function handlePago(e) {
    e.preventDefault()
    const monto = parseFloat(formPago.monto)
    if (!monto || monto <= 0 || !pagoDeuda) return
    setSavingPago(true)

    const fecha = formPago.fecha || new Date().toISOString().slice(0, 10)
    const mesNum = parseInt(fecha.slice(5, 7))
    const añoNum = parseInt(fecha.slice(0, 4))
    const nuevoPendiente = Math.max(0, (pagoDeuda.pendiente || 0) - monto)
    const estaPagada = nuevoPendiente === 0
    const cuotaPagada = pagoDeuda.cuota > 0 && monto >= pagoDeuda.cuota * 0.9

    const desc = formPago.descripcion || `Pago cuota: ${pagoDeuda.nombre}`
    const [{ error: errDM }, { error: errDeuda }] = await Promise.all([
      supabase.rpc('registrar_deuda_movimiento', {
        p_deuda_id: pagoDeuda.id,
        p_tipo: 'pago',
        p_monto: monto,
        p_descripcion: desc,
        p_fecha: fecha,
        p_mes: mesNum,
        p_año: añoNum,
      }),
      supabase.from('deudas').update({
        pendiente: nuevoPendiente,
        ...(estaPagada ? { estado: 'pagada' } : {}),
        ...(cuotaPagada ? { pagadas: (pagoDeuda.pagadas || 0) + 1 } : {}),
      }).eq('id', pagoDeuda.id),
    ])

    if (errDM || errDeuda) {
      toast('Error al registrar el pago')
      setSavingPago(false)
      return
    }

    // Registrar egreso real en movimientos (el dinero sale del bolsillo al pagar la cuota)
    const { error: errMov } = await supabase.from('movimientos').insert([{
      tipo: 'egreso', monto, descripcion: desc,
      categoria: 'deuda', fecha, quien: 'Ambos',
      metodo_pago: 'transferencia',
    }])
    if (errMov) {
      toast('Pago registrado pero no apareció en gastos: ' + errMov.message)
    }

    // Actualizar estado local
    setDeudas(prev => prev.map(d => d.id === pagoDeuda.id
      ? { ...d, pendiente: nuevoPendiente, ...(estaPagada ? { estado: 'pagada' } : {}), ...(cuotaPagada ? { pagadas: (d.pagadas || 0) + 1 } : {}) }
      : d
    ))
    setMovsPorDeuda(prev => ({
      ...prev,
      [pagoDeuda.id]: [{ tipo: 'pago', monto, fecha, descripcion: formPago.descripcion || 'Pago tarjeta' }, ...(prev[pagoDeuda.id] || [])],
    }))
    setUsadoPorTarjeta(prev => ({
      ...prev,
      [pagoDeuda.perfil_tarjeta_id]: Math.max(0, (prev[pagoDeuda.perfil_tarjeta_id] || 0) - monto),
    }))

    setSavingPago(false)
    setModalPago(false)
    setPagoDeuda(null)
    toast(`Pago de ${formatCurrency(monto)} registrado${estaPagada ? ' — compra pagada ✓' : ''}`, 'success')
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5"
            style={{ color: 'var(--text-muted)' }}>Configuración</p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Mis Tarjetas</h1>
        </div>
        <button onClick={() => openModal()} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} strokeWidth={3} />
        </button>
      </div>

      {loading ? (
  <div className="flex justify-center py-20">
    <Loader2 className="animate-spin opacity-30" style={{ color: 'var(--text-muted)' }} />
  </div>
) : tarjetas.length === 0 ? (
  /* Aplicamos flex-col e items-center para el centrado total en móviles */
  <div className="flex flex-col items-center justify-center text-center py-20 px-6">
    
    {/* Icono de tarjeta (opcional, le da un toque pro) */}
    <div className="w-16 h-12 rounded-xl mb-6 flex items-center justify-center border-2 border-dashed opacity-20"
      style={{ borderColor: 'var(--text-muted)' }}>
      <CreditCard size={24} style={{ color: 'var(--text-muted)' }} />
    </div>

    <p className="text-sm mb-6 font-medium" style={{ color: 'var(--text-muted)' }}>
      No hay tarjetas registradas
    </p>

    <button 
      onClick={() => openModal()} 
      className="ff-btn-primary !w-auto min-w-[220px] shadow-lg active:scale-95 transition-transform"
    >
      Agregar primera tarjeta
    </button>
  </div>
) : (

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tarjetas.map((t) => {
            const isSelected = selectedId === t.id
            const usado = usadoPorTarjeta[t.id] || 0
            const limite = t.limite_credito || 0
            const disponible = Math.max(0, limite - usado)
            const pctUsado = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0
            const deudasCard = deudas.filter(d => d.perfil_tarjeta_id === t.id)

            return (
              <Card key={t.id}
                onClick={() => setSelectedId(isSelected ? null : t.id)}
                className={`cursor-pointer transition-all ${t.estado === 'pausada' ? 'opacity-60' : ''}`}
                style={{
                  border: isSelected ? `1px solid ${t.color}80` : '1px solid transparent',
                  padding: '16px',
                }}>

                {/* Cabecera */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${t.color}20`, color: t.color }}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase leading-none mb-1"
                        style={{ color: 'var(--text-muted)' }}>{t.banco || '—'}</p>
                      <h3 className="font-semibold text-sm leading-none"
                        style={{ color: 'var(--text-primary)' }}>{t.nombre_tarjeta}</h3>
                    </div>
                  </div>
                  {t.estado === 'pausada' && (
                    <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      Pausada
                    </span>
                  )}
                </div>

                {/* Barra de uso */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-semibold uppercase"
                      style={{ color: 'var(--text-muted)' }}>Usado</span>
                    <span className="text-sm font-semibold"
                      style={{ color: t.color }}>{formatCurrency(usado)}</span>
                  </div>
                  <ProgressBar value={usado} max={limite} color={pctUsado > 80 ? 'var(--accent-rose)' : t.color} />
                  <div className="flex justify-between text-[10px] font-semibold"
                    style={{ color: 'var(--text-muted)' }}>
                    <span>{pctUsado}% usado</span>
                    <span style={{ color: 'var(--accent-green)' }}>Disp: {formatCurrency(disponible)}</span>
                  </div>
                  {pctUsado >= 75 && limite > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg mt-1"
                      style={{ background: `color-mix(in srgb, var(--accent-rose) ${pctUsado >= 90 ? 12 : 8}%, transparent)` }}>
                      <AlertTriangle size={10} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                      <p className="text-[9px] font-semibold" style={{ color: 'var(--accent-rose)' }}>
                        {pctUsado >= 90 ? `¡Límite casi agotado! Solo quedan ${formatCurrency(disponible)}` : `Cerca del límite — ${formatCurrency(disponible)} disponible`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Días de corte y pago */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-[11px] font-semibold"
                    style={{ color: 'var(--text-secondary)' }}>
                    {t.dia_corte && <span>Corte: día {t.dia_corte}</span>}
                    {t.dia_pago && <span>Pago: día {t.dia_pago}</span>}
                  </div>
                  {isSelected && (
                    <div className="flex gap-1">
                      <IconBtn
                        onClick={e => { e.stopPropagation(); handleToggleEstado(t) }}
                        bg="var(--bg-secondary)" color={t.color}
                        title={t.estado === 'pausada' ? 'Activar' : 'Pausar'}>
                        {t.estado === 'pausada' ? <Play size={14} /> : <Pause size={14} />}
                      </IconBtn>
                      <IconBtn
                        onClick={e => { e.stopPropagation(); openModal(t) }}
                        bg="var(--bg-secondary)" color="var(--text-secondary)"
                        title="Editar">
                        <Pencil size={14} />
                      </IconBtn>
                      <IconBtn
                        onClick={e => { e.stopPropagation(); handleDelete(t.id) }}
                        bg="color-mix(in srgb, var(--accent-rose) 8%, transparent)"
                        color="var(--accent-rose)"
                        title="Eliminar">
                        <Trash2 size={14} />
                      </IconBtn>
                    </div>
                  )}
                </div>

                {/* Historial de compras */}
                {isSelected && (
                  <div className="mt-4 pt-4 space-y-2 max-h-72 overflow-y-auto custom-scroll pr-1"
                    style={{ borderTop: '1px solid var(--border-glass)' }}>
                    <p className="ff-label mb-2">Historial de compras</p>
                    {deudasCard.length === 0 ? (
                      <p className="text-[11px] italic opacity-50">Sin compras registradas</p>
                    ) : (
                      deudasCard.map(deuda => {
                        const pagos = (movsPorDeuda[deuda.id] || []).filter(m => m.tipo === 'pago')
                        const pagadas = deuda.pagadas || 0
                        const total = deuda.plazo_meses || 1
                        const esPagada = deuda.estado === 'pagada'
                        const fechaCompra = deuda.fecha_primer_pago
                          ? new Date(deuda.fecha_primer_pago + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
                          : new Date(deuda.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit' })
                        return (
                          <div key={deuda.id} className="rounded-xl p-3 space-y-1.5"
                            style={{ background: 'var(--bg-secondary)', border: `1px solid ${esPagada ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)' : 'transparent'}` }}>
                            {/* Fila principal */}
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{deuda.nombre}</p>
                                <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{fechaCompra}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-[11px] font-semibold" style={{ color: esPagada ? 'var(--accent-green)' : t.color }}>
                                  {formatCurrency(deuda.capital || 0)}
                                </p>
                                {esPagada
                                  ? <p className="text-[9px] font-semibold" style={{ color: 'var(--accent-green)' }}>✓ pagada</p>
                                  : <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{formatCurrency(deuda.pendiente)} pend.</p>
                                }
                              </div>
                            </div>
                            {/* Cuotas */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {total > 1 && (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: `color-mix(in srgb, ${t.color} 12%, transparent)`, color: t.color }}>
                                    {pagadas}/{total} cuotas
                                  </span>
                                )}
                                {deuda.cuota > 0 && total > 1 && (
                                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                    {formatCurrency(deuda.cuota)}/mes
                                  </span>
                                )}
                                {total === 1 && (
                                  <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold"
                                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                                    Contado
                                  </span>
                                )}
                              </div>
                              {/* Barra de progreso */}
                              {total > 1 && (
                                <div className="flex-1 max-w-[80px] h-1 rounded-full ml-3" style={{ background: 'var(--progress-track)' }}>
                                  <div className="h-1 rounded-full" style={{
                                    width: `${Math.min(100, Math.round((pagadas / total) * 100))}%`,
                                    background: esPagada ? 'var(--accent-green)' : t.color,
                                  }} />
                                </div>
                              )}
                            </div>
                            {/* Último pago + botón pagar */}
                            <div className="flex items-center justify-between gap-2">
                              {pagos.length > 0 ? (
                                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                  Último: {new Date(pagos[0].fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {formatCurrency(pagos[0].monto)}
                                </p>
                              ) : <span />}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={e => handleDeleteDeuda(e, deuda)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold"
                                  style={{
                                    background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
                                    color: 'var(--accent-rose)',
                                  }}>
                                  <Trash2 size={9} />
                                </button>
                                {!esPagada && (
                                  <button
                                    onClick={e => abrirPago(e, deuda)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold"
                                    style={{
                                      background: `color-mix(in srgb, ${t.color} 12%, transparent)`,
                                      color: t.color,
                                    }}>
                                    <DollarSign size={9} />
                                    Pagar
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Modal pago directo */}
      <Modal
        open={modalPago}
        onClose={() => { setModalPago(false); setPagoDeuda(null) }}
        title="Registrar pago">
        {pagoDeuda && (
          <form onSubmit={handlePago} className="space-y-4">
            <div className="px-3 py-2.5 rounded-xl text-xs font-semibold"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
              {pagoDeuda.nombre}
              <span className="ml-2 font-normal" style={{ color: 'var(--text-muted)' }}>
                Pendiente: {formatCurrency(pagoDeuda.pendiente)}
              </span>
            </div>

            <div>
              <label className="ff-label">Monto del pago</label>
              <input className="ff-input" type="number" min="0.01" step="0.01" required autoFocus
                value={formPago.monto}
                onChange={e => setFormPago(p => ({ ...p, monto: e.target.value }))} />
            </div>

            <div>
              <label className="ff-label">Descripción (opcional)</label>
              <input className="ff-input" placeholder="Ej: Pago mínimo, pago total..."
                value={formPago.descripcion}
                onChange={e => setFormPago(p => ({ ...p, descripcion: e.target.value }))} />
            </div>

            <div>
              <label className="ff-label">Fecha</label>
              <input className="ff-input" type="date"
                value={formPago.fecha}
                onChange={e => setFormPago(p => ({ ...p, fecha: e.target.value }))} />
            </div>

            {formPago.monto > 0 && (
              <div className="px-3 py-2 rounded-xl text-[10px] font-semibold"
                style={{
                  background: parseFloat(formPago.monto) >= pagoDeuda.pendiente
                    ? 'color-mix(in srgb, var(--accent-green) 8%, transparent)'
                    : 'color-mix(in srgb, var(--accent-blue) 8%, transparent)',
                  color: parseFloat(formPago.monto) >= pagoDeuda.pendiente ? 'var(--accent-green)' : 'var(--accent-blue)',
                }}>
                {parseFloat(formPago.monto) >= pagoDeuda.pendiente
                  ? '✓ Pago total — la compra quedará liquidada'
                  : `Quedará pendiente: ${formatCurrency(Math.max(0, pagoDeuda.pendiente - parseFloat(formPago.monto)))}`}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setModalPago(false); setPagoDeuda(null) }}
                className="ff-btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={savingPago}
                className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
                {savingPago && <Loader2 size={14} className="animate-spin" />}
                {savingPago ? 'Guardando...' : 'Registrar pago'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal crear / editar */}
      <Modal open={modal} onClose={closeModal} title={editingId ? 'Editar Tarjeta' : 'Nueva Tarjeta'}>
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Nom. Tarjeta</label>
              <input className="ff-input" required placeholder="Ej: Visa Oro"
                value={form.nombre_tarjeta}
                onChange={e => setForm(p => ({ ...p, nombre_tarjeta: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Banco</label>
              <input className="ff-input" placeholder="Ej: BBVA, Santander..."
                value={form.banco}
                onChange={e => setForm(p => ({ ...p, banco: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="ff-label">Límite de crédito (€)</label>
            <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
              value={form.limite_credito}
              onChange={e => setForm(p => ({ ...p, limite_credito: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Día de corte</label>
              <input
                className="ff-input"
                type="number"
                min="1"
                max="31"
                placeholder="Ej: 15"
                value={form.dia_corte}
                onChange={e => setForm({ ...form, dia_corte: e.target.value })}
              />
            </div>
            <div>
              <label className="ff-label">Día de pago</label>
              <input
                className="ff-input"
                type="number"
                min="1"
                max="31"
                placeholder="Ej: 20"
                value={form.dia_pago}
                onChange={e => setForm({ ...form, dia_pago: e.target.value })}
              />
            </div>
          </div>

          {/* Color picker — reactivo al tema activo */}
          <div>
            <label className="ff-label">Color</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {themeColors.map(hex => (
                <button key={hex} type="button"
                  onClick={() => setForm(p => ({ ...p, color: hex }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    backgroundColor: hex,
                    outline: form.color === hex ? '3px solid var(--text-secondary)' : 'none',
                    outlineOffset: 2,
                    opacity: form.color === hex ? 1 : 0.5,
                    transform: form.color === hex ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={closeModal}   className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving
                ? <><Loader2 size={14} className="animate-spin" /> Guardando...</>
                : <><Save size={14} /> {editingId ? 'Guardar' : 'Crear'}</>
              }
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog {...confirmProps} />
    </AppShell>
  )
}