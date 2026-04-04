'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { formatCurrency, fechaHoy } from '@/lib/utils'
import { getPresupuestoMes } from '@/lib/presupuesto'

export function useInversiones() {
  const [inversiones, setInversiones] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [gastosMes, setGastosMes] = useState(0)
  const [aportesEsteMes, setAportesEsteMes] = useState(0)
  const [traspasosDeInv, setTraspasosDeInv] = useState(0)
  const [sobreMovsInv, setSobreMovsInv] = useState([])
  const [savingAporte, setSavingAporte] = useState(false)
  const [savingRetiro, setSavingRetiro] = useState(false)
  const [historialAportes, setHistorialAportes] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
    cargarGastosMes()
    cargarAportesEsteMes()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    setLoading(true)
    const { data, error: err } = await supabase.from('inversiones').select('*').order('created_at')
    if (err) setError(err.message)
    else {
      setInversiones(data || [])
      if (data?.length) setSelected(data[0])
    }
    setLoading(false)
  }

  async function cargarGastosMes() {
    const now = new Date()
    const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1)
    const inicio3Meses = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    const { data, error: err } = await supabase
      .from('movimientos')
      .select('monto, categoria, fecha')
      .eq('tipo', 'egreso')
      .in('categoria', ['basicos', 'deseo'])
      .gte('fecha', inicio3Meses.toISOString().slice(0, 10))
      .lt('fecha', inicioMesActual.toISOString().slice(0, 10))

    if (err) return

    const porMes = {}
    ;(data || []).forEach(m => {
      const key = m.fecha.slice(0, 7)
      porMes[key] = (porMes[key] || 0) + parseFloat(m.monto || 0)
    })
    const meses = Object.values(porMes)
    if (!meses.length) return
    setGastosMes(meses.reduce((s, v) => s + v, 0) / meses.length)
  }

  async function cargarAportesEsteMes() {
    const now = new Date()
    const mes = now.getMonth() + 1
    const año = now.getFullYear()
    const inicioMes = new Date(año, mes - 1, 1).toISOString().slice(0, 10)
    const inicioSig = new Date(año, mes, 1).toISOString().slice(0, 10)

    const [{ data: movs }, { data: sobreMovs }] = await Promise.all([
      supabase.from('movimientos').select('monto')
        .eq('tipo', 'egreso').eq('categoria', 'inversion')
        .not('inversion_id', 'is', null)
        .not('descripcion', 'like', 'Sobrante sobre%')
        .gte('fecha', inicioMes).lt('fecha', inicioSig),
      supabase.from('sobre_movimientos').select('monto, fecha, origen, destino, descripcion')
        .eq('mes', mes).eq('año', año)
        .or('origen.eq.inversiones,and(origen.eq.sobre,destino.eq.inversiones)'),
    ])
    setAportesEsteMes((movs || []).reduce((s, m) => s + parseFloat(m.monto || 0), 0))
    const traspasos = (sobreMovs || []).filter(m => m.origen === 'inversiones')
    setTraspasosDeInv(traspasos.reduce((s, m) => s + parseFloat(m.monto || 0), 0))
    setSobreMovsInv(sobreMovs || [])
  }

  async function cargarHistorial(inversionId) {
    setLoadingHistorial(true)
    const { data, error: err } = await supabase
      .from('movimientos')
      .select('id, monto, descripcion, fecha')
      .eq('tipo', 'egreso')
      .eq('categoria', 'inversion')
      .eq('inversion_id', inversionId)
      .order('fecha', { ascending: false })
    if (!err) setHistorialAportes(data || [])
    setLoadingHistorial(false)
  }

  async function guardarInversion({ editandoId, form, themeColors }) {
    setSaving(true)
    setError(null)
    const payload = {
      nombre: form.nombre,
      emoji: form.emoji,
      capital: parseFloat(form.capital) || 0,
      aporte_real: parseFloat(form.aporteReal) || 0,
      aporte: parseFloat(form.aporte) || 0,
      tasa: parseFloat(form.tasa) || 0,
      anos: parseInt(form.anos) || 10,
      color: form.color,
      bola_nieve: form.bola_nieve,
      pct_mensual: parseFloat(form.pct_mensual) || 0,
    }

    if (editandoId) {
      const { error: err } = await supabase.from('inversiones').update(payload).eq('id', editandoId)
      if (err) { setError(err.message); setSaving(false); return false }
      setInversiones(prev => prev.map(i => i.id === editandoId ? { ...i, ...payload } : i))
      setSelected(prev => prev?.id === editandoId ? { ...prev, ...payload } : prev)
    } else {
      const { data, error: err } = await supabase.from('inversiones').insert([payload]).select()
      if (err) { setError(err.message); setSaving(false); return false }
      setInversiones(prev => [...prev, data[0]])
      setSelected(data[0])
    }

    setSaving(false)
    return true
  }

  function eliminarInversion(id, showConfirm) {
    showConfirm('¿Eliminar esta cartera?', async () => {
      setSaving(true)
      setError(null)

      const { error: errMovs } = await supabase.from('movimientos').delete().eq('inversion_id', id)
      if (errMovs) {
        setError('Error al borrar movimientos asociados: ' + errMovs.message)
        setSaving(false)
        return
      }

      const { error: err } = await supabase.from('inversiones').delete().eq('id', id)
      if (!err) {
        const resto = inversiones.filter(i => i.id !== id)
        setInversiones(resto)
        setSelected(resto[0] || null)
      } else {
        setError(err.message)
      }
      setSaving(false)
    })
  }

  async function agregarAporte({ formAporte, selectedInv }) {
    if (savingAporte) return false
    const monto = parseFloat(formAporte.monto)
    if (!monto || monto <= 0) return false
    setSavingAporte(true)
    setError(null)

    const nuevoCapital = (selectedInv.capital || 0) + monto
    const fecha = formAporte.fecha || new Date().toISOString().slice(0, 10)

    const { data: movData, error: movErr } = await supabase.from('movimientos').insert([{
      tipo: 'egreso',
      categoria: 'inversion',
      monto,
      descripcion: formAporte.descripcion || `Aporte a ${selectedInv.nombre}`,
      fecha, quien: 'Ambos',
      inversion_id: selectedInv.id,
    }]).select()

    if (movErr) { setError(movErr.message); setSavingAporte(false); return false }

    const { error: errInv } = await supabase
      .from('inversiones')
      .update({ capital: nuevoCapital })
      .eq('id', selectedInv.id)

    if (errInv) {
      if (movData?.[0]?.id) await supabase.from('movimientos').delete().eq('id', movData[0].id)
      setError(errInv.message)
      setSavingAporte(false)
      return false
    }

    const updated = { ...selectedInv, capital: nuevoCapital }
    setInversiones(prev => prev.map(i => i.id === selectedInv.id ? updated : i))
    setSelected(updated)
    setSavingAporte(false)
    await cargarAportesEsteMes()
    toast(`Aporte de ${formatCurrency(monto)} registrado`, 'success')
    return true
  }

  async function retirarCapital({ formRetiro, selectedInv }) {
    const monto = parseFloat(formRetiro.monto)
    if (!monto || monto <= 0 || !selectedInv) return false
    if (monto > (selectedInv.capital || 0)) {
      setError('No puedes retirar más del capital disponible')
      return false
    }
    setSavingRetiro(true)

    const nuevoCapital = (selectedInv.capital || 0) - monto

    const { data: movRetiroData, error: movRetiroErr } = await supabase.from('movimientos').insert([{
      tipo: 'retiro', categoria: 'inversion',
      descripcion: `Retiro: ${selectedInv.nombre}`,
      monto, fecha: fechaHoy(), quien: 'Ambos',
      inversion_id: selectedInv.id,
    }]).select()

    if (movRetiroErr) { setError(movRetiroErr.message); setSavingRetiro(false); return false }

    const { error: errInv } = await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', selectedInv.id)
    if (errInv) {
      if (movRetiroData?.[0]?.id) await supabase.from('movimientos').delete().eq('id', movRetiroData[0].id)
      setError(errInv.message)
      setSavingRetiro(false)
      return false
    }

    const updated = { ...selectedInv, capital: nuevoCapital }
    setInversiones(prev => prev.map(i => i.id === selectedInv.id ? updated : i))
    setSelected(updated)
    setSavingRetiro(false)
    toast(`Retiro de ${formatCurrency(monto)} registrado`, 'success')
    return true
  }

  function eliminarAporte(movId, monto, showConfirm) {
    showConfirm('¿Eliminar este aporte? Se restará del capital actual.', async () => {
      const nuevoCapital = Math.max(0, (selected.capital || 0) - monto)

      const { error: errInv } = await supabase
        .from('inversiones').update({ capital: nuevoCapital }).eq('id', selected.id)
      if (errInv) { toast('Error al actualizar capital', 'error'); return }

      const { error: errMov } = await supabase.from('movimientos').delete().eq('id', movId)
      if (errMov) {
        await supabase.from('inversiones').update({ capital: selected.capital }).eq('id', selected.id)
        toast('Error al eliminar el aporte', 'error'); return
      }

      const updated = { ...selected, capital: nuevoCapital }
      setInversiones(prev => prev.map(i => i.id === selected.id ? updated : i))
      setSelected(updated)
      setHistorialAportes(prev => prev.filter(a => a.id !== movId))
      await cargarAportesEsteMes()
      toast(`Aporte de ${formatCurrency(monto)} eliminado`, 'success')
    })
  }

  return {
    // Estado de datos
    inversiones,
    setInversiones,
    selected,
    setSelected,
    loading,
    saving,
    error,
    setError,
    presupuesto,
    gastosMes,
    aportesEsteMes,
    traspasosDeInv,
    sobreMovsInv,
    savingAporte,
    savingRetiro,
    historialAportes,
    loadingHistorial,
    // Acciones
    cargar,
    cargarGastosMes,
    cargarAportesEsteMes,
    cargarHistorial,
    guardarInversion,
    eliminarInversion,
    agregarAporte,
    retirarCapital,
    eliminarAporte,
  }
}
