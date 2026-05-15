'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { fechaHoy, diasHastaPago } from '@/lib/utils'
import { arrayMove } from '@dnd-kit/sortable'

// ─── Helpers de cálculo (sin JSX, reutilizables) ─────────────────────────────

export function calcularCuota(capital, tasaAnual, meses) {
  if (!capital || !meses) return 0
  if (!tasaAnual || tasaAnual === 0) return capital / meses
  // Interés simple: interés total = capital × tasa mensual × meses
  // tasaAnual viene siempre en % anual, convertimos a mensual
  const tasaMensual = tasaAnual / 100 / 12
  const interesTotal = capital * tasaMensual * meses
  return (capital + interesTotal) / meses
}


export function generarTablaAmortizacion(deuda, movs = []) {
  const meses = deuda.plazo_meses
  if (!meses) return []

  const capital = deuda.capital || deuda.monto || 0
  const tasaAnual = deuda.tasa_interes || deuda.tasa || 0
  const tasaMensual = tasaAnual / 100 / 12
  const tieneInteres = tasaMensual > 0

  const interesMensual = tieneInteres
    ? parseFloat((capital * tasaMensual).toFixed(2))
    : 0
  const capitalMensual = parseFloat((capital / meses).toFixed(2))
  const cuotaBase = parseFloat((capitalMensual + interesMensual).toFixed(2))

  let fechaBase = deuda.fecha_primer_pago
    ? new Date(deuda.fecha_primer_pago + 'T12:00:00')
    : new Date(deuda.created_at || Date.now())

  const hoy = new Date()
  const mesHoy = hoy.getMonth() + 1
  const añoHoy = hoy.getFullYear()

  const rows = []

  for (let i = 0; i < meses; i++) {
    const targetMonth = fechaBase.getMonth() + i
    const añoNum = fechaBase.getFullYear() + Math.floor(targetMonth / 12)
    const mesNum = ((targetMonth % 12) + 12) % 12 + 1

    const pagoReal = movs.find(m => m.tipo === 'pago' && m.mes === mesNum && m.año === añoNum)
    const _montoRaw = pagoReal ? parseFloat(pagoReal.monto) : null
    const montoPagado = _montoRaw !== null ? (isNaN(_montoRaw) ? 0 : _montoRaw) : null

    const esParcial = montoPagado !== null && Math.abs(montoPagado - cuotaBase) > 0.01
    const esPasado = añoNum < añoHoy || (añoNum === añoHoy && mesNum < mesHoy)

    // Saldo = cuotas restantes × cuotaBase (lo que queda por pagar en total)
    const cuotasRestantes = meses - (i + 1)
    const saldo = montoPagado !== null
      ? parseFloat((cuotasRestantes * cuotaBase).toFixed(2))           // pagó esta cuota → saldo es lo que queda
      : parseFloat(((cuotasRestantes + 1) * cuotaBase).toFixed(2))    // no pagó → incluye esta cuota en el saldo

    rows.push({
      periodo: i + 1,
      mes: mesNum,
      año: añoNum,
      cuota: cuotaBase,
      cuotaReal: montoPagado,
      interes: interesMensual,
      capital: capitalMensual,
      saldo,
      pagada: montoPagado !== null,
      montoPagado,
      parcial: esParcial,
      vencida: esPasado && montoPagado === null,
      fechaLabel: `${String(mesNum).padStart(2, '0')}/${añoNum}`,
    })
  }
  return rows
}
// ─── Estadísticas derivadas ───────────────────────────────────────────────────

export function calcularEstadisticas(deudas, movimientos) {
  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  const activas = deudas.filter(d => d.estado !== 'pagada')
  const deboActivas = activas.filter(d => d.tipo !== 'medeben')
  const meDebenActivas = activas.filter(d => d.tipo === 'medeben')

  const totalDebo = deboActivas.reduce((s, d) => s + (d.pendiente || 0), 0)
  const totalMeDeben = meDebenActivas.reduce((s, d) => s + (d.pendiente || 0), 0)

  const cuotasMes = deboActivas
    .filter(d => {
      if (!d.fecha_primer_pago) return true
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
      const base2 = new Date(d.fecha_primer_pago + 'T12:00:00')
      const tm = base2.getMonth() + (d.pagadas || 0)
      const ty = base2.getFullYear() + Math.floor(tm / 12)
      const tmn = ((tm % 12) + 12) % 12
      const ld = new Date(ty, tmn + 1, 0).getDate()
      const proxPago = new Date(ty, tmn, Math.min(base2.getDate(), ld))
      return proxPago.getMonth() === hoy.getMonth() && proxPago.getFullYear() === hoy.getFullYear()
    })
    .reduce((s, d) => s + (d.cuota || 0), 0)

  const vencenProximo = activas.filter(d => {
    const dias = diasHastaPago(d)
    return dias !== null && dias <= 7
  }).length

  return { activas, deboActivas, meDebenActivas, totalDebo, totalMeDeben, cuotasMes, vencenProximo, mes, año }
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useDeudas() {
  const [deudas, setDeudas] = useState([])
  const [movimientos, setMovimientos] = useState({})
  const [misTarjetas, setMisTarjetas] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  // 🟡 FIX: cleanup para evitar setState sobre componente desmontado
  useEffect(() => {
    let activo = true
    cargar(activo)
    return () => { activo = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar(activo = true) {
    setLoading(true); setError(null)
    try {
      const [{ data: deudasData, error: e1 }, { data: tarjetasData }] = await Promise.all([
        supabase.from('deudas').select('*').order('orden', { nullsFirst: false }).order('created_at', { ascending: true }),
        supabase.from('perfiles_tarjetas').select('*').eq('estado', 'activa'),
      ])
      if (e1) throw e1

      if (!activo) return

      setDeudas(deudasData || [])
      setMisTarjetas(tarjetasData || [])

      if ((deudasData || []).length) {
        const { data: movs, error: e3 } = await supabase
          .from('deuda_movimientos').select('*').order('fecha', { ascending: true })
        if (!e3 && activo) {
          const grouped = {}
            ; (movs || []).forEach(m => {
              if (!grouped[m.deuda_id]) grouped[m.deuda_id] = []
              grouped[m.deuda_id].push(m)
            })
          setMovimientos(grouped)
        }
      }
    } catch (err) {
      if (activo) setError(err.message)
    }
    finally {
      if (activo) setLoading(false)
    }
  }

  async function guardarDeuda({ editandoId, tipoSeleccionado, formTarjeta, formPrestamo, formCuota }) {
    if (saving) return false
    setSaving(true)
    let payload = {}

    if (tipoSeleccionado === 'tarjeta') {
      const f = formTarjeta
      if (f.tarjeta_id) {
        const tarjetaPerfil = misTarjetas.find(t => t.id === f.tarjeta_id)
        if (tarjetaPerfil && tarjetaPerfil.estado === 'pausada') {
          setError('Esta tarjeta está pausada. Actívala primero en el módulo Mis Tarjetas.')
          setSaving(false)
          return false
        }
      }
      const capital = parseFloat(f.monto_compra) || 0
      if (!capital || capital <= 0) {
        setError('El monto de la compra es obligatorio.')
        setSaving(false)
        return false
      }
      const meses = parseInt(f.num_cuotas) || 1
      const cuota = parseFloat((capital / meses).toFixed(2))
      payload = {
        tipo_deuda: 'tarjeta', tipo: f.tipo, emoji: f.emoji, nombre: f.nombre,
        descripcion: f.descripcion || null,
        categoria: f.categoria, limite: parseFloat(f.limite) || 0,
        capital, monto: capital, pendiente: capital, cuota, plazo_meses: meses,
        perfil_tarjeta_id: f.tarjeta_id || null, tasa: 0, tasa_interes: 0,
        dia_pago: parseInt(f.dia_pago) || null, color: f.color, estado: 'activa', pagadas: 0,
        fecha_primer_pago: f.fecha_operacion || null,
        telefono: f.telefono || null,
      }
    } else if (tipoSeleccionado === 'prestamo') {
      const f = formPrestamo
      const capital = parseFloat(f.capital) || 0
      if (!capital || capital <= 0) {
        setError('El capital del préstamo es obligatorio.')
        setSaving(false)
        return false
      }
      const tasa = f.tiene_interes ? (parseFloat(f.tasa_interes) || 0) : 0
      const meses = f.plazo_libre ? null : (parseInt(f.plazo_meses) || null)
      const cuota = meses ? parseFloat(calcularCuota(capital, tasa, meses).toFixed(2)) : 0
      payload = {
        tipo_deuda: 'prestamo', tipo: f.tipo, emoji: f.emoji, nombre: f.nombre,
        descripcion: f.descripcion || null,
        categoria: f.categoria, capital, monto: capital, pendiente: capital,
        tasa, tasa_interes: tasa, plazo_meses: meses, cuota,
        fecha_primer_pago: f.fecha_primer_pago || null, dia_pago: parseInt(f.dia_pago) || null,
        color: f.color, estado: 'activa', pagadas: 0,
        telefono: f.telefono || null,
      }
    } else {
      const f = formCuota
      const monto = parseFloat(f.monto) || 0
      if (!monto || monto <= 0) {
        setError('El monto de la cuota es obligatorio.')
        setSaving(false)
        return false
      }
      if (f.deuda_origen_id && !editandoId) {
        const deudaOrigen = deudas.find(d => d.id === f.deuda_origen_id)
        if (deudaOrigen) {
          const nuevoPendiente = Math.max(0, (deudaOrigen.pendiente || 0) - monto)
          const nuevosPagados = (deudaOrigen.pagadas || 0) + 1
          const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
          const { data: dmData, error: dmErr } = await supabase.rpc('registrar_deuda_movimiento', {
            p_deuda_id: f.deuda_origen_id, p_tipo: 'pago',
            p_descripcion: f.nombre || `Cuota ${deudaOrigen.nombre}`,
            p_monto: monto, p_fecha: fechaHoy(), p_mes: mes, p_año: año,
          })
          if (dmErr) { setError(dmErr.message); setSaving(false); return false }
          const tipoMov = deudaOrigen.tipo === 'medeben' ? 'ingreso' : 'egreso'
          await supabase.from('movimientos').insert([{
            tipo: tipoMov, categoria: 'deuda',
            descripcion: f.nombre || `Pago letra: ${deudaOrigen.nombre}`,
            monto, fecha: fechaHoy(), quien: 'Ambos',
            deuda_id: f.deuda_origen_id,
            // 🔴 FIX: la RPC puede devolver objeto o array; normalizamos siempre
            deuda_movimiento_id: (Array.isArray(dmData) ? dmData[0]?.id : dmData?.id) || null,
          }])
          await supabase.from('deudas').update({
            pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
          }).eq('id', f.deuda_origen_id)
          setDeudas(prev => prev.map(d => d.id === f.deuda_origen_id
            ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado } : d))
        }
        setSaving(false)
        return 'cerrar'
      }
      payload = {
        tipo_deuda: 'cuota', tipo: f.tipo, emoji: f.emoji, nombre: f.nombre,
        descripcion: f.descripcion || null,
        categoria: f.categoria, cuota: monto, monto, capital: monto, pendiente: monto,
        dia_pago: parseInt(f.dia_pago) || null, color: f.color,
        estado: 'activa', pagadas: 0, tasa: 0, tasa_interes: 0,
        telefono: f.telefono || null,
      }
    }

    if (editandoId) {
      const { error: err } = await supabase.from('deudas').update(payload).eq('id', editandoId)
      if (err) { setError(err.message); setSaving(false); return false }
    } else {
      const { error: err } = await supabase.from('deudas').insert([{ ...payload, orden: deudas.length }])
      if (err) { setError(err.message); setSaving(false); return false }
    }

    toast(editandoId ? 'Deuda actualizada' : 'Deuda registrada', 'success')
    setSaving(false)
    await cargar()
    return true
  }

  async function marcarPagada(deuda) {
    if (saving) return
    const monto = deuda.cuota || deuda.pendiente || 0
    if (!monto) return

    // 🟡 FIX: guard de doble pago — verificamos en el hook, no solo en la UI
    const yaPageEste = (movimientos[deuda.id] || []).some(
      m => m.tipo === 'pago' && m.mes === mes && m.año === año
    )
    if (yaPageEste) {
      toast('Ya existe un pago registrado para este mes', 'warning')
      return
    }

    setSaving(true)
    const hoy = fechaHoy()
    const nuevoPendiente = Math.max(0, (deuda.pendiente || 0) - monto)
    const nuevosPagados = (deuda.pagadas || 0) + 1
    const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

    const { data: dmData, error: dmError } = await supabase.rpc('registrar_deuda_movimiento', {
      p_deuda_id: deuda.id, p_tipo: 'pago',
      p_descripcion: `Cuota mensual: ${deuda.nombre}`,
      p_monto: monto, p_fecha: hoy, p_mes: mes, p_año: año,
    })
    if (dmError) { setError(dmError.message); setSaving(false); return }

    // 🔴 FIX: normalizamos data de RPC (puede ser objeto o array)
    const dmId = (Array.isArray(dmData) ? dmData[0]?.id : dmData?.id) || null

    const tipoMov = deuda.tipo === 'medeben' ? 'ingreso' : 'egreso'
    const { data: movData, error: movError } = await supabase.from('movimientos').insert([{
      tipo: tipoMov, categoria: 'deuda',
      descripcion: deuda.tipo === 'medeben'
        ? `Cobro deuda: ${deuda.nombre}`
        : `Pago letra: ${deuda.nombre}`,
      monto, fecha: hoy, quien: 'Ambos',
      deuda_id: deuda.id,
      deuda_movimiento_id: dmId,
    }]).select()

    if (movError) {
      if (dmId) await supabase.from('deuda_movimientos').delete().eq('id', dmId)
      setError(movError.message); setSaving(false); return
    }

    const { error: deudaError } = await supabase.from('deudas').update({
      pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
    }).eq('id', deuda.id)

    if (deudaError) {
      if (movData?.[0]?.id) await supabase.from('movimientos').delete().eq('id', movData[0].id)
      if (dmId) await supabase.from('deuda_movimientos').delete().eq('id', dmId)
      setError(deudaError.message); setSaving(false); return
    }

    setDeudas(prev => prev.map(d => d.id === deuda.id
      ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado } : d))
    setMovimientos(prev => ({
      ...prev,
      [deuda.id]: [...(prev[deuda.id] || []), {
        // 🔴 FIX: usamos dmId normalizado
        id: dmId, tipo: 'pago', monto, fecha: hoy, mes, año,
        descripcion: `Cuota mensual: ${deuda.nombre}`,
        deuda_id: deuda.id,
      }]
    }))
    toast(nuevoEstado === 'pagada' ? `¡${deuda.nombre} saldada! 🎉` : 'Pago registrado', 'success')
    setSaving(false)
  }

  async function agregarMovimiento({ deudaId, formMov }) {
    if (saving) return false
    setSaving(true)
    const monto = parseFloat(formMov.monto)
    const deuda = deudas.find(d => d.id === deudaId)

    const { data, error } = await supabase.rpc('registrar_deuda_movimiento', {
      p_deuda_id: deudaId, p_tipo: formMov.tipo,
      p_descripcion: formMov.descripcion, p_monto: monto,
      p_fecha: formMov.fecha, p_mes: mes, p_año: año,
    })

    if (!error && deuda) {
      // 🔴 FIX: normalizamos data — la RPC puede devolver objeto o array
      const movNuevo = Array.isArray(data) ? data[0] : data
      const movId = movNuevo?.id || null

      setMovimientos(prev => ({ ...prev, [deudaId]: [...(prev[deudaId] || []), movNuevo] }))

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
          // 🔴 FIX: usamos movId normalizado
          deuda_movimiento_id: movId,
        }])

        const { error: updateError } = await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          pagadas: nuevosPagados,
          estado: nuevoPendiente <= 0 ? 'pagada' : 'activa',
        }).eq('id', deudaId)
        if (updateError) { setError(updateError.message); setSaving(false); return false }

      } else {
        nuevoPendiente = nuevoPendiente + monto
        const nuevoMonto = (deuda.monto || 0) + monto
        await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          monto: nuevoMonto,
          estado: 'activa',
        }).eq('id', deudaId)
        setDeudas(prev => prev.map(d => d.id === deudaId
          ? { ...d, pendiente: nuevoPendiente, monto: nuevoMonto, estado: 'activa' } : d))
        setSaving(false)
        return true
      }

      setDeudas(prev => prev.map(d => d.id === deudaId
        ? { ...d, pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoPendiente <= 0 ? 'pagada' : 'activa' } : d))
      toast('Pago registrado', 'success')
    }
    setSaving(false)
    return true
  }

  async function editarMovimiento({ editandoMov, formMov }) {
    if (saving) return false
    setSaving(true)

    const montoNuevo = parseFloat(formMov.monto)
    const deuda = deudas.find(d => d.id === editandoMov.deuda_id)
    if (!deuda) { setSaving(false); return false }

    const { error } = await supabase.from('deuda_movimientos').update({
      descripcion: formMov.descripcion,
      monto: montoNuevo,
      fecha: formMov.fecha,
    }).eq('id', editandoMov.id)

    if (!error) {
      const { data: todosMovs } = await supabase
        .from('deuda_movimientos')
        .select('tipo, monto')
        .eq('deuda_id', deuda.id)

      const totalPagado = (todosMovs || []).filter(m => m.tipo === 'pago').reduce((s, m) => s + (m.monto || 0), 0)
      const totalCargos = (todosMovs || []).filter(m => m.tipo === 'cargo').reduce((s, m) => s + (m.monto || 0), 0)
      const nuevoMonto = (deuda.capital || 0) + totalCargos
      const nuevoPendiente = Math.max(0, nuevoMonto - totalPagado)
      const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'

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
        pendiente: nuevoPendiente, monto: nuevoMonto, estado: nuevoEstado,
      }).eq('id', deuda.id)

      await cargar()
    }

    setSaving(false)
    return true
  }

  // 🔴 FIX: lógica de ramas cargo/pago reescrita — eliminado delete duplicado
  // Antes: el delete de deuda_movimientos ocurría dentro del else (cargo) Y también
  // después del else (pago), pero el código era confuso y propenso a errores.
  // Ahora: cada rama maneja su propio delete de forma explícita y clara.
  async function eliminarMovimiento(mov, showConfirm) {
    showConfirm('¿Eliminar este movimiento y revertir el pendiente?', async () => {
      const deuda = deudas.find(d => d.id === mov.deuda_id)
      if (!deuda) return

      // ── Rama CARGO ───────────────────────────────────────────────────────
      if (mov.tipo === 'cargo') {
        const nuevoPendiente = Math.max(0, (deuda.pendiente || 0) - mov.monto)
        const nuevoMonto = Math.max(deuda.capital || 0, (deuda.monto || 0) - mov.monto)

        const { error } = await supabase.from('deuda_movimientos').delete().eq('id', mov.id)
        if (error) { setError(error.message); return }

        const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
        await supabase.from('deudas').update({
          pendiente: nuevoPendiente, monto: nuevoMonto, estado: nuevoEstado
        }).eq('id', mov.deuda_id)

        toast('Movimiento eliminado', 'success')
        await cargar()
        return
      }

      // ── Rama PAGO ────────────────────────────────────────────────────────
      let nuevoPendiente = deuda.pendiente || 0
      let nuevosPagados = deuda.pagadas || 0

      nuevoPendiente = Math.min(
        deuda.monto || (nuevoPendiente + mov.monto),
        nuevoPendiente + mov.monto
      )
      nuevosPagados = Math.max(0, nuevosPagados - 1)

      // Buscar y eliminar el movimiento general vinculado
      const { data: movGeneralData } = await supabase
        .from('movimientos').select('id')
        .eq('deuda_movimiento_id', mov.id).limit(1)

      if (movGeneralData?.[0]?.id) {
        await supabase.from('movimientos').delete().eq('id', movGeneralData[0].id)
      } else {
        // Fallback: buscar por coincidencia de campos
        await supabase.from('movimientos').delete()
          .eq('categoria', 'deuda')
          .eq('monto', mov.monto)
          .eq('deuda_id', mov.deuda_id)
          .limit(1)
      }

      const { error } = await supabase.from('deuda_movimientos').delete().eq('id', mov.id)
      if (error) { setError(error.message); return }

      const nuevoEstado = nuevoPendiente <= 0 ? 'pagada' : 'activa'
      await supabase.from('deudas').update({
        pendiente: nuevoPendiente, pagadas: nuevosPagados, estado: nuevoEstado
      }).eq('id', mov.deuda_id)

      toast('Movimiento eliminado', 'success')
      await cargar()
    })
  }

  async function eliminarDeuda(id, { cardActiva, setCardActiva, expandido, setExpandido, tablaVisible, setTablaVisible, showConfirm }) {
    showConfirm('¿Estás seguro de eliminar esta deuda y todos sus registros asociados?', async () => {
      setSaving(true)
      try {
        await supabase.from('movimientos').delete().eq('deuda_id', id)
        const { error: err1 } = await supabase.from('deuda_movimientos').delete().eq('deuda_id', id)
        if (err1) throw new Error('Error al borrar movimientos de deuda: ' + err1.message)
        const { error: err2 } = await supabase.from('deudas').delete().eq('id', id)
        if (err2) throw new Error('Error al borrar la deuda: ' + err2.message)
        if (cardActiva === id) setCardActiva(null)
        if (expandido === id) setExpandido(null)
        if (tablaVisible === id) setTablaVisible(null)
        toast('Deuda eliminada', 'success')
        await cargar()
      } catch (err) {
        toast(err.message)
      } finally { setSaving(false) }
    })
  }

  async function reordenarDeudas({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = deudas.findIndex(d => d.id === active.id)
    const newIndex = deudas.findIndex(d => d.id === over.id)
    const reordered = arrayMove(deudas, oldIndex, newIndex)
    setDeudas(reordered)
    const updates = reordered
      .map((d, i) => ({ id: d.id, orden: i }))
      .filter((u, i) => u.id !== deudas[i]?.id)
    await Promise.all(updates.map(u => supabase.from('deudas').update({ orden: u.orden }).eq('id', u.id)))
  }

  return {
    deudas,
    setDeudas,
    movimientos,
    misTarjetas,
    loading,
    saving,
    error,
    setError,
    cargar,
    guardarDeuda,
    marcarPagada,
    agregarMovimiento,
    editarMovimiento,
    eliminarMovimiento,
    eliminarDeuda,
    reordenarDeudas,
  }
}