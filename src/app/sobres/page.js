'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import CustomSelect from '@/components/ui/CustomSelect'
import {
  Wallet, Plus, Loader2, Trash2,
  AlertTriangle, TrendingUp, Sprout, Search,
  X, ArrowDownRight, CreditCard, ChevronLeft, ChevronRight
} from 'lucide-react'
import { formatCurrency, fechaHoy } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { useQuien } from '@/lib/useQuien'
import Modal from '@/components/ui/Modal'
import ConfirmDialog, { useConfirm } from '@/components/ui/ConfirmDialog'


const ORIGENES = [
  { value: 'basicos', label: 'Básicos', color: 'var(--accent-blue)', desc: 'Súper, facturas...' },
  { value: 'metas', label: 'Metas de Ahorro', color: 'var(--accent-green)', desc: 'Retrasa tu ahorro' },
  { value: 'inversiones', label: 'Inversiones', color: 'var(--accent-violet)', desc: 'Retrasa tu inversión' },
]

export default function SobrePage() {
  const { opcionesQuien, defaultQuien } = useQuien()
  const [presupuesto, setPresupuesto] = useState(null)
  const [sobreMovs, setSobreMovs] = useState([])
  const [movsMes, setMovsMes] = useState([])
  const [tarjetasData, setTarjetasData] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1)
  const [filtroAño, setFiltroAño] = useState(new Date().getFullYear())
  const [busqueda, setBusqueda] = useState('')

  const [modal, setModal] = useState(false)
  const [modalTraspaso, setModalTraspaso] = useState(false)
  const [modalSobrante, setModalSobrante] = useState(false)
  const [gastoTemp, setGastoTemp] = useState(null)
  const [form, setForm] = useState({ descripcion: '', monto: '', quien: 'Ambos' })

  // Sincronizar quien inicial cuando carga el hook
  useEffect(() => {
    if (defaultQuien) setForm(f => ({ ...f, quien: f.quien === 'Ambos' ? defaultQuien : f.quien }))
  }, [defaultQuien])
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState('')
  const [origenTraspaso, setOrigenTraspaso] = useState('basicos')
  const [destinoSobrante, setDestinoSobrante] = useState('metas')
  const [montoSobrante, setMontoSobrante] = useState('')
  const [metasData, setMetasData] = useState([])
  const [metaSeleccionada, setMetaSeleccionada] = useState('')
  const [inversionesData, setInversionesData] = useState([])
  const [inversionSeleccionada, setInversionSeleccionada] = useState('')

  const { confirmProps, showConfirm } = useConfirm()

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  function prevMes() {
    if (filtroMes === 1) { setFiltroMes(12); setFiltroAño(a => a - 1) }
    else setFiltroMes(m => m - 1)
  }
  function nextMes() {
    if (filtroMes === 12) { setFiltroMes(1); setFiltroAño(a => a + 1) }
    else setFiltroMes(m => m + 1)
  }

  useEffect(() => { cargarTodo() }, [filtroMes, filtroAño])

  async function cargarTodo() {
    setLoading(true)
    const fechaInicio = `${filtroAño}-${String(filtroMes).padStart(2, '0')}-01`
    const ultimoDia = new Date(filtroAño, filtroMes, 0).getDate()
    const fechaFin = `${filtroAño}-${String(filtroMes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`

    try {
      const [pres, { data: sobre }, { data: movs }, { data: tarjetas }, { data: metas }, { data: inversiones }] = await Promise.all([
        getPresupuestoMes(filtroMes, filtroAño),
        supabase.from('sobre_movimientos').select('*').eq('mes', filtroMes).eq('año', filtroAño).order('created_at', { ascending: false }),
        supabase.from('movimientos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
        supabase.from('deudas').select('id, nombre, emoji, pendiente').eq('tipo_deuda', 'tarjeta').eq('estado', 'activa'),
        supabase.from('metas').select('id, nombre, emoji, meta, actual, estado').eq('estado', 'activa').order('created_at'),
        supabase.from('inversiones').select('id, nombre, emoji, capital, color').order('created_at'),
      ])
      setPresupuesto(pres)
      setSobreMovs(sobre || [])
      setMovsMes(movs || [])
      setTarjetasData(tarjetas || [])
      setMetasData(metas || [])
      setInversionesData(inversiones || [])
    } catch (err) {
      console.error('Error cargando sobres:', err)
      toast('Error cargando datos de sobres')
    } finally {
      setLoading(false)
    }
  }

 // ── CÁLCULOS DE SALDO ──────────────────────────────────────────────────────
const montoEstilo = parseFloat(presupuesto?.montoEstilo) || 0
const montoBasicos = parseFloat(presupuesto?.montoNecesidades) || 0
const montoMetas = parseFloat(presupuesto?.montoMetas) || 0
const montoInv = parseFloat(presupuesto?.montoInversiones) || 0

// Gastos directos del sobre (excluye sobrantes enviados desde el sobre)
const gastadoSobre = movsMes
  .filter(m => m.tipo === 'egreso' && m.categoria === 'deseo')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)

// Traspasos entrantes al sobre (desde otras cubetas)
const traspasosAlSobre = sobreMovs
  .filter(m => ['basicos', 'metas', 'inversiones'].includes(m.origen))
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)

// Sobrantes enviados desde el sobre a metas/inversiones
const sobranteDesdeElSobre = sobreMovs
  .filter(m => m.origen === 'sobre')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)

// FIX 1: el sobrante ya está en gastadoSobre (via movimientos categoria:deseo),
// así que lo restamos para no descontarlo doble
const saldoSobre = (montoEstilo || 0) - gastadoSobre + traspasosAlSobre - sobranteDesdeElSobre

// FIX 2: barra de progreso usa el límite real (monto + traspasos entrantes)
const limiteReal = montoEstilo + traspasosAlSobre

const gastadoBasicos = movsMes
  .filter(m => m.tipo === 'egreso' && ['basicos', 'deuda'].includes(m.categoria))
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
const traspasosBasicos = sobreMovs.filter(m => m.origen === 'basicos')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
const saldoBasicos = (montoBasicos || 0) - gastadoBasicos - traspasosBasicos

const traspasosMetas = sobreMovs.filter(m => m.origen === 'metas')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
const sobranteAMetas = sobreMovs
  .filter(m => m.origen === 'sobre' && m.destino === 'metas')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
// Incluir aportes reales a metas este mes para no sobrestimar el saldo disponible
const gastadoMetas = movsMes
  .filter(m => m.tipo === 'egreso' && m.categoria === 'ahorro')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
const saldoMetas = (montoMetas || 0) - gastadoMetas - traspasosMetas + sobranteAMetas

const traspasosInv = sobreMovs.filter(m => m.origen === 'inversiones')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
const sobranteAInv = sobreMovs
  .filter(m => m.origen === 'sobre' && m.destino === 'inversiones')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
// Incluir aportes reales a inversiones este mes
const gastadoInv = movsMes
  .filter(m => m.tipo === 'egreso' && m.categoria === 'inversion')
  .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
const saldoInversiones = (montoInv || 0) - gastadoInv - traspasosInv + sobranteAInv

  function getSaldo(origen) {
    if (origen === 'basicos') return saldoBasicos || 0
    if (origen === 'metas') return saldoMetas || 0
    if (origen === 'inversiones') return saldoInversiones || 0
    return 0
  }

  // ── HANDLERS ───────────────────────────────────────────────────────────────
  function resetModal() {
    setModal(false)
    setTarjetaSeleccionada('')
    setForm({ descripcion: '', monto: '', quien: defaultQuien })
  }

  async function handleGasto(e) {
    e.preventDefault()
    if (saving) return
    const monto = parseFloat(form.monto) || 0
    if (!monto || !form.descripcion) return

    if (tarjetaSeleccionada) {
      setSaving(true)
      const { error } = await supabase.rpc('registrar_deuda_movimiento', {
        p_deuda_id: tarjetaSeleccionada,
        p_tipo: 'cargo',
        p_descripcion: form.descripcion,
        p_monto: monto,
        p_fecha: fechaHoy(),
        p_mes: filtroMes,
        p_año: filtroAño,
      })
      if (!error) {
        const tarjeta = tarjetasData.find(t => t.id === tarjetaSeleccionada)
        if (tarjeta) {
          await supabase.from('deudas').update({ pendiente: parseFloat(tarjeta.pendiente || 0) + monto }).eq('id', tarjetaSeleccionada)
        }
        resetModal()
        cargarTodo()
      }
      setSaving(false)
      return
    }

    if (saldoSobre >= monto) {
      setSaving(true)
      const { error } = await supabase.from('movimientos').insert([{
        tipo: 'egreso', categoria: 'deseo',
        descripcion: form.descripcion, monto,
        fecha: fechaHoy(),
        quien: form.quien,
      }])
      if (!error) { resetModal(); cargarTodo() }
      setSaving(false)
    } else {
      setGastoTemp({ descripcion: form.descripcion, monto, quien: form.quien })
      setModal(false)
      setModalTraspaso(true)
    }
  }

  async function confirmarTraspaso() {
    if (saving || !gastoTemp) return
    const saldoOrigen = getSaldo(origenTraspaso)
    if (saldoOrigen < gastoTemp.monto) {
      toast('No hay saldo suficiente en el origen seleccionado')
      return
    }
    setSaving(true)
    const hoy = fechaHoy()

    // BUG FIX: operación en dos pasos con rollback manual
    // Paso 1: insertar movimiento de gasto
    const { data: movData, error: movError } = await supabase.from('movimientos').insert([{
      tipo: 'egreso', categoria: 'deseo',
      descripcion: gastoTemp.descripcion, monto: gastoTemp.monto,
      fecha: hoy, quien: gastoTemp.quien || 'Ambos',
    }]).select()

    if (movError) {
      setSaving(false)
      toast('' + movError.message)
      return
    }

    // Paso 2: insertar traspaso en sobre_movimientos
    const { error: sobreError } = await supabase.from('sobre_movimientos').insert([{
      descripcion: `Traspaso desde ${origenTraspaso} → Sobre`,
      monto: gastoTemp.monto, origen: origenTraspaso,
      destino: 'sobre',
      mes: filtroMes, año: filtroAño, fecha: hoy,
    }])

    if (sobreError) {
      // Rollback: borrar el movimiento si el traspaso falló
      if (movData?.[0]?.id) {
        const { error: rollbackError } = await supabase
          .from('movimientos').delete().eq('id', movData[0].id)
        if (rollbackError) {
          // El rollback también falló — avisar al usuario para que limpie manualmente
          toast('⚠️ Error crítico: el gasto quedó registrado pero el traspaso no. Revisa tus movimientos y elimina el duplicado.')
          setSaving(false)
          return
        }
      }
      setSaving(false)
      toast('Error al registrar el traspaso. La operación fue revertida.')
      return
    }

    setSaving(false)
    setModalTraspaso(false)
    setGastoTemp(null)
    setForm({ descripcion: '', monto: '', quien: defaultQuien })
    setTarjetaSeleccionada('')
    cargarTodo()
  }

  async function confirmarSobrante() {
    if (saving) return
    const monto = parseFloat(montoSobrante) || 0
    if (!monto || monto > saldoSobre) return
    if (destinoSobrante === 'metas' && !metaSeleccionada) return
    if (destinoSobrante === 'inversiones' && !inversionSeleccionada) return
    setSaving(true)
    const hoy = fechaHoy()

    const meta = metaSeleccionada ? metasData.find(m => m.id === metaSeleccionada) : null
    const inversion = inversionSeleccionada ? inversionesData.find(i => i.id === inversionSeleccionada) : null
    const nombreDestino = meta?.nombre || inversion?.nombre || destinoSobrante

    // Paso 1: sobre_movimiento con meta_id / inversion_id para trazabilidad
    const { data: sobreData, error: sobreErr } = await supabase.from('sobre_movimientos').insert([{
      descripcion: `Sobrante → ${nombreDestino}`,
      monto, origen: 'sobre', destino: destinoSobrante,
      mes: filtroMes, año: filtroAño, fecha: hoy,
      meta_id: meta?.id || null,
      inversion_id: inversion?.id || null,
    }]).select()

    if (sobreErr) { setSaving(false); toast('' + sobreErr.message); return }
    const sobreId = sobreData?.[0]?.id

    if (meta) {
      const nuevoActual = (meta.actual || 0) + monto
      const completada = nuevoActual >= meta.meta

      // Paso 2: actualizar meta
      const { error: metaErr } = await supabase.from('metas').update({
        actual: nuevoActual,
        ...(completada && { estado: 'completada' }),
      }).eq('id', meta.id)

      if (metaErr) {
        // Rollback paso 1
        if (sobreId) await supabase.from('sobre_movimientos').delete().eq('id', sobreId)
        setSaving(false); toast('Error al actualizar la meta. Operación revertida.'); return
      }

      // Paso 3: registrar movimiento contable
      const { error: movErr } = await supabase.from('movimientos').insert([{
        tipo: 'egreso', monto,
        descripcion: `Sobrante sobre → ${meta.nombre}`,
        categoria: 'ahorro', fecha: hoy,
        quien: 'Ambos', meta_id: meta.id,
      }])

      if (movErr) {
        // Rollback pasos 1 y 2
        await supabase.from('metas').update({ actual: meta.actual, estado: meta.estado }).eq('id', meta.id)
        if (sobreId) await supabase.from('sobre_movimientos').delete().eq('id', sobreId)
        setSaving(false); toast('Error al registrar el movimiento. Operación revertida.'); return
      }

      if (completada) toast(`¡Meta "${meta.nombre}" completada!`, 'success')
    }

    if (inversion) {
      const nuevoCapital = (inversion.capital || 0) + monto

      // Paso 2: actualizar inversión
      const { error: invErr } = await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', inversion.id)

      if (invErr) {
        if (sobreId) await supabase.from('sobre_movimientos').delete().eq('id', sobreId)
        setSaving(false); toast('Error al actualizar la inversión. Operación revertida.'); return
      }

      // Paso 3: registrar movimiento contable
      const { error: movErr } = await supabase.from('movimientos').insert([{
        tipo: 'egreso', monto,
        descripcion: `Sobrante sobre → ${inversion.nombre}`,
        categoria: 'inversion', fecha: hoy,
        quien: 'Ambos', inversion_id: inversion.id,
      }])

      if (movErr) {
        await supabase.from('inversiones').update({ capital: inversion.capital }).eq('id', inversion.id)
        if (sobreId) await supabase.from('sobre_movimientos').delete().eq('id', sobreId)
        setSaving(false); toast('Error al registrar el movimiento. Operación revertida.'); return
      }
    }

    setSaving(false)
    setModalSobrante(false)
    setMontoSobrante('')
    setMetaSeleccionada('')
    setInversionSeleccionada('')
    cargarTodo()
  }

  function handleEliminar(mov) {
    showConfirm('¿Eliminar este movimiento?', async () => {
      if (mov._fuente === 'sobre') {
        // Verificar que el sobre_movimiento aún existe (evita doble ejecución si el usuario reintenta)
        const { data: sobreExiste } = await supabase
          .from('sobre_movimientos').select('id').eq('id', mov.id).maybeSingle()
        if (!sobreExiste) { cargarTodo(); return }

        if (mov.destino === 'metas' && mov.meta_id) {
          const { data: metaData } = await supabase
            .from('metas').select('actual').eq('id', mov.meta_id).single()
          if (metaData) {
            const nuevoActual = Math.max(0, (metaData.actual || 0) - parseFloat(mov.monto || 0))
            const { error } = await supabase.from('metas').update({ actual: nuevoActual }).eq('id', mov.meta_id)
            if (error) { toast('Error al actualizar la meta'); cargarTodo(); return }
          }
          const { data: movMeta } = await supabase.from('movimientos').select('id')
            .eq('meta_id', mov.meta_id).eq('monto', mov.monto).eq('fecha', mov.fecha)
            .like('descripcion', 'Sobrante sobre%').limit(1).maybeSingle()
          if (movMeta) await supabase.from('movimientos').delete().eq('id', movMeta.id)
        }
        if (mov.destino === 'inversiones' && mov.inversion_id) {
          const { data: invData } = await supabase
            .from('inversiones').select('capital').eq('id', mov.inversion_id).single()
          if (invData) {
            const nuevoCapital = Math.max(0, (invData.capital || 0) - parseFloat(mov.monto || 0))
            const { error } = await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', mov.inversion_id)
            if (error) { toast('Error al actualizar la inversión'); cargarTodo(); return }
          }
          const { data: movInv } = await supabase.from('movimientos').select('id')
            .eq('inversion_id', mov.inversion_id).eq('monto', mov.monto).eq('fecha', mov.fecha)
            .like('descripcion', 'Sobrante sobre%').limit(1).maybeSingle()
          if (movInv) await supabase.from('movimientos').delete().eq('id', movInv.id)
        }
        await supabase.from('sobre_movimientos').delete().eq('id', mov.id)
        cargarTodo()
      } else {
        // Gasto del sobre — borrar el movimiento
        await supabase.from('movimientos').delete().eq('id', mov.id)
        // Si este gasto vino con un traspaso, borrarlo también (eliminación atómica)
        if (mov._traspaso) {
          await supabase.from('sobre_movimientos').delete().eq('id', mov._traspaso.id)
        }
        cargarTodo()
      }
    })
  }

  // Mapa de traspasos entrantes al sobre indexados por fecha+monto para enlazarlos con su gasto
  const traspasosAlSobreMap = {}
  sobreMovs
    .filter(m => ['basicos', 'metas', 'inversiones'].includes(m.origen))
    .forEach(m => {
      const key = `${m.fecha}_${parseFloat(m.monto)}`
      if (!traspasosAlSobreMap[key]) traspasosAlSobreMap[key] = m
    })

  const movsFiltrados = [
    // Gastos del sobre (movimientos categoria='deseo'), enriquecidos con el traspaso si lo tienen
    ...movsMes
      .filter(m => m.tipo === 'egreso' && m.categoria === 'deseo')
      .map(m => {
        const key = `${m.fecha}_${parseFloat(m.monto)}`
        return { ...m, _fuente: 'mov', _label: 'Gasto sobre', _traspaso: traspasosAlSobreMap[key] || null }
      }),
    // Solo sobrantes enviados DESDE el sobre (origen='sobre') — los traspasos entrantes se muestran via el gasto
    ...sobreMovs
      .filter(m => m.origen === 'sobre')
      .map(m => ({ ...m, _fuente: 'sobre', _label: `Enviado a ${m.destino}` })),
  ].filter(m => {
    const q = busqueda.toLowerCase()
    return m.descripcion?.toLowerCase().includes(q) || m.quien?.toLowerCase().includes(q)
  }).sort((a, b) => new Date(b.fecha || b.created_at) - new Date(a.fecha || a.created_at))

  const pctUsado = montoEstilo > 0 ? Math.min(100, (gastadoSobre / montoEstilo) * 100) : 0
  const sobreColor = saldoSobre <= 0
    ? 'var(--accent-rose)'
    : saldoSobre < montoEstilo * 0.2
      ? 'var(--accent-terra)'
      : 'var(--accent-green)'

  const usandoTarjeta = !!tarjetaSeleccionada
  const esMesActual = filtroMes === new Date().getMonth() + 1 && filtroAño === new Date().getFullYear()
  const montoFormParseado = parseFloat(form.monto) || 0

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <AppShell>

      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Control Diario</p>
          <h1 className="text-xl tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>Sobre Diario</h1>
          {/* Navegación de mes */}
          <div className="flex items-center gap-2">
            <button onClick={prevMes} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={15} strokeWidth={2.5} />
            </button>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)', minWidth: 110, textAlign: 'center' }}>
              {MESES[filtroMes - 1]} {filtroAño}
            </span>
            <button onClick={nextMes} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <button onClick={() => setModal(true)}
          className="ff-btn-primary flex items-center justify-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="text-sm font-semibold hidden sm:inline">Registrar Gasto</span>
        </button>
      </div>

      {loading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-green)' }} />
        </div>
      ) : (
        <>
          {/* CARD PRINCIPAL DEL SOBRE */}
          <Card className="mb-4 relative overflow-hidden" style={{ padding: '18px 20px' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
              Disponible en el sobre
            </p>
            <p className="text-4xl font-semibold mb-4 tracking-tight" style={{ color: 'var(--accent-terra)' }}>
              {formatCurrency(Math.max(0, saldoSobre))}
            </p>

            {/* Barra de progreso */}
            <div className="w-full h-2.5 rounded-full mb-2" style={{ background: 'var(--progress-track)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctUsado}%`, background: sobreColor }} />
            </div>
            <div className="flex justify-between text-[10px] font-semibold uppercase tracking-wider mb-3">
              <span style={{ color: 'var(--text-muted)' }}>Gastado: {formatCurrency(gastadoSobre)}</span>
              <span style={{ color: 'var(--text-muted)' }}>Límite: {formatCurrency(montoEstilo)}</span>
            </div>

            {/* Alerta sobre vacío */}
            {saldoSobre <= 0 && (
              <div className="flex items-center gap-2 p-3 rounded-xl"
                style={{
                  background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)',
                }}>
                <AlertTriangle size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                <p className="text-[10px] font-semibold" style={{ color: 'var(--accent-rose)' }}>
                  ¡Sobre vacío! Usando dinero de otras categorías.
                </p>
              </div>
            )}

            {/* Botón enviar sobrante — solo en mes actual con saldo positivo */}
            {saldoSobre > 0 && esMesActual && (
              <button onClick={() => setModalSobrante(true)}
                className="mt-3 w-full py-2.5 rounded-xl text-[10px] font-semibold uppercase tracking-wider border border-dashed transition-all"
                style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}>
                <Sprout size={12} className="inline mr-1.5" />
                Enviar sobrante a Metas / Inversión
              </button>
            )}
          </Card>

          {/* CUBETAS */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Básicos', saldo: saldoBasicos, color: 'var(--accent-blue)' },
              { label: 'Metas', saldo: saldoMetas, color: 'var(--accent-green)' },
              { label: 'Inversión', saldo: saldoInversiones, color: 'var(--accent-violet)' },
            ].map((box, i) => {
              const negativo = box.saldo < 0
              return (
                <div key={i} className="glass-card p-3 animate-enter" style={{
                  animationDelay: `${i * 0.08}s`,
                  ...(negativo && {
                    background: 'color-mix(in srgb, var(--accent-rose) 8%, var(--bg-card))',
                    border: '1px solid color-mix(in srgb, var(--accent-rose) 25%, transparent)',
                  }),
                }}>
                  <p className="text-[9px] font-semibold uppercase tracking-widest mb-1" style={{ color: negativo ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                    {negativo && <AlertTriangle size={9} className="inline mr-0.5 -mt-0.5" />}
                    {box.label}
                  </p>
                  <p className="text-sm font-semibold"
                    style={{ color: negativo ? 'var(--accent-rose)' : box.color, letterSpacing: '-0.02em' }}>
                    {formatCurrency(box.saldo)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* BUSCADOR — busca en descripción y en quien */}
          <div className="relative mb-4">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)', zIndex: 10 }} />
            <input className="ff-input w-full" style={{ paddingLeft: '2.5rem' }}
              placeholder="Buscar en este sobre..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}>
                <X size={15} />
              </button>
            )}
          </div>

          {/* LISTA */}
          <Card style={{ padding: '4px' }}>
            {movsFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Wallet size={28} className="mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                {busqueda ? (
                  <>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Sin resultados para "{busqueda}"</p>
                    <button onClick={() => setBusqueda('')} className="mt-3 text-xs underline" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Limpiar búsqueda
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Sin movimientos este mes</p>
                    <p className="text-[11px] mt-1 opacity-60" style={{ color: 'var(--text-muted)' }}>Los gastos registrados aparecerán aquí</p>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                {movsFiltrados.map((m) => (
                  <div key={`${m._fuente}-${m.id}`}
                    className="flex items-center gap-3 px-3 py-3.5 group transition-colors"
                    style={{ borderRadius: 12 }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: m._fuente === 'mov'
                          ? 'color-mix(in srgb, var(--accent-terra) 12%, transparent)'
                          : 'color-mix(in srgb, var(--accent-violet) 12%, transparent)',

                      }}>
                      {m._fuente === 'mov'
                        ? <ArrowDownRight size={15} style={{ color: 'var(--accent-terra)' }} />
                        : <TrendingUp size={15} style={{ color: 'var(--accent-violet)' }} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {m.descripcion}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                          {m._label}
                        </span>
                        {m._traspaso && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--accent-violet) 10%, transparent)', color: 'var(--accent-violet)' }}>
                            desde {m._traspaso.origen}
                          </span>
                        )}
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES') : '—'}
                        </span>
                        {m.quien && m._fuente === 'mov' && (
                          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{m.quien}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--accent-terra)' }}>
                        -{formatCurrency(Math.abs(parseFloat(m.monto)))}
                      </p>
                      <button onClick={() => handleEliminar(m)}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--accent-rose)' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ══ MODAL: REGISTRAR GASTO ══════════════════════════════════════════ */}
      <Modal open={modal} onClose={resetModal} title="Registrar Gasto del Sobre">
        <form onSubmit={handleGasto} className="space-y-4">

          {tarjetasData.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}>
                <CreditCard size={11} /> ¿Pagado con tarjeta? (opcional)
              </label>
              <CustomSelect
                value={tarjetaSeleccionada}
                onChange={v => setTarjetaSeleccionada(v || '')}
                options={tarjetasData.map(t => ({ id: t.id, label: `${t.emoji} ${t.nombre}` }))}
                placeholder="— No, pago directo —"
              />
              {usandoTarjeta && (
                <div className="px-3 py-2 rounded-xl text-[10px] font-semibold"
                  style={{ background: 'color-mix(in srgb, var(--accent-violet) 8%, transparent)', color: 'var(--accent-violet)', border: '1px solid color-mix(in srgb, var(--accent-violet) 20%, transparent)' }}>
                  💳 Este gasto NO restará del sobre. Se acumula en la tarjeta.
                </div>
              )}
            </div>
          )}

          <div>
            <label className="ff-label">Descripción</label>
            <input className="ff-input" placeholder="¿En qué gastaste?" required
              value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>

          <div>
            <label className="ff-label">Monto (€)</label>
            <input className="ff-input text-xl font-semibold" type="number" step="0.01" min="0.01" placeholder="0.00" required
              value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            {/* Indicador de saldo disponible */}
            {!usandoTarjeta && montoFormParseado > 0 && (
              <p className="text-[10px] mt-1 font-semibold"
                style={{ color: montoFormParseado > saldoSobre ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                {montoFormParseado > saldoSobre
                  ? `⚠ Faltan ${formatCurrency(montoFormParseado - saldoSobre)} → se pedirá traspaso`
                  : `Quedan ${formatCurrency(saldoSobre - montoFormParseado)} en el sobre`}
              </p>
            )}
          </div>

          {!usandoTarjeta && (
            <div>
              <label className="ff-label">¿Quién?</label>
              <CustomSelect
                value={form.quien}
                onChange={v => setForm({ ...form, quien: v || defaultQuien })}
                options={opcionesQuien}
                placeholder="— ¿Quién? —"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={resetModal} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2"
              style={usandoTarjeta ? { background: 'var(--accent-violet)' } : {}}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {usandoTarjeta
                ? '💳 Cargar a tarjeta'
                : montoFormParseado > saldoSobre
                  ? 'Origen →'
                  : 'Confirmar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ MODAL: TRASPASO ═════════════════════════════════════════════════ */}
      <Modal open={modalTraspaso} onClose={() => { setModalTraspaso(false); setGastoTemp(null) }} title="¡Sobre Vacío!">
        <div className="space-y-4">
          <div className="p-3 rounded-xl flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)',
            }}>
            <AlertTriangle size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-rose)' }}>
              No hay saldo. Para pagar <b>{formatCurrency(gastoTemp?.monto)}</b>, elige de dónde tomar:
            </p>
          </div>

          <div className="space-y-2">
            {ORIGENES.map(o => (
              <button key={o.value} onClick={() => setOrigenTraspaso(o.value)}
                className="w-full p-3.5 rounded-xl border-2 transition-all flex justify-between items-center text-left"
                style={{
                  borderColor: origenTraspaso === o.value ? 'var(--accent-green)' : 'var(--border-glass)',
                  background: origenTraspaso === o.value ? 'color-mix(in srgb, var(--accent-green) 5%, transparent)' : 'transparent',
                }}>
                <div>
                  <p className="text-xs font-semibold uppercase" style={{ color: o.color }}>{o.label}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Disponible: {formatCurrency(getSaldo(o.value))}
                  </p>
                  {getSaldo(o.value) < (gastoTemp?.monto || 0) && (
                    <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--accent-rose)' }}>
                      ✗ Saldo insuficiente
                    </p>
                  )}
                </div>
                {origenTraspaso === o.value && (
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-green)' }} />
                )}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setModalTraspaso(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button onClick={confirmarTraspaso} disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: SOBRANTE ═════════════════════════════════════════════════ */}
      <Modal open={modalSobrante} onClose={() => { setModalSobrante(false); setMontoSobrante(''); setMetaSeleccionada(''); setInversionSeleccionada('') }} title="Enviar Sobrante">
        <div className="space-y-4">
          <div className="p-3 rounded-xl"
            style={{
              background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
            }}>
            <p className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
              Tienes {formatCurrency(saldoSobre)} sin gastar. ¡Ponlo a trabajar!
            </p>
          </div>

          <div>
            <label className="ff-label">Monto a mover</label>
            <input className="ff-input text-xl font-semibold" type="number" step="0.01"
              max={saldoSobre} placeholder="0.00"
              value={montoSobrante} onChange={e => setMontoSobrante(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {['metas', 'inversiones'].map(dest => (
              <button key={dest} onClick={() => { setDestinoSobrante(dest); setMetaSeleccionada(''); setInversionSeleccionada('') }}
                className="p-3 rounded-xl border-2 text-[10px] font-semibold uppercase transition-all"
                style={{
                  borderColor: destinoSobrante === dest ? 'var(--accent-green)' : 'var(--border-glass)',
                  background: destinoSobrante === dest ? 'color-mix(in srgb, var(--accent-green) 6%, transparent)' : 'transparent',
                  color: destinoSobrante === dest ? 'var(--accent-green)' : 'var(--text-muted)',
                }}>
                {dest}
              </button>
            ))}
          </div>

          {/* Selector de meta cuando destino='metas' */}
          {destinoSobrante === 'metas' && metasData.length > 0 && (
            <div>
              <label className="ff-label">¿A qué meta?</label>
              <div className="space-y-1.5 mt-1">
                {metasData.map(m => {
                  const pct = Math.min(100, Math.round(((m.actual || 0) / m.meta) * 100))
                  return (
                    <button key={m.id} type="button"
                      onClick={() => setMetaSeleccionada(m.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left"
                      style={{
                        borderColor: metaSeleccionada === m.id ? 'var(--accent-green)' : 'var(--border-glass)',
                        background: metaSeleccionada === m.id ? 'color-mix(in srgb, var(--accent-green) 6%, transparent)' : 'var(--bg-secondary)',
                      }}>
                      <span className="text-base flex-shrink-0">{m.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{m.nombre}</p>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{pct}% completada</p>
                      </div>
                      {metaSeleccionada === m.id && (
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-green)' }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Selector de inversión cuando destino='inversiones' */}
          {destinoSobrante === 'inversiones' && inversionesData.length > 0 && (
            <div>
              <label className="ff-label">¿A qué cartera?</label>
              <div className="space-y-1.5 mt-1">
                {inversionesData.map(inv => (
                  <button key={inv.id} type="button"
                    onClick={() => setInversionSeleccionada(inv.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left"
                    style={{
                      borderColor: inversionSeleccionada === inv.id ? 'var(--accent-violet)' : 'var(--border-glass)',
                      background: inversionSeleccionada === inv.id ? 'color-mix(in srgb, var(--accent-violet) 6%, transparent)' : 'var(--bg-secondary)',
                    }}>
                    <span className="text-base flex-shrink-0">{inv.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{inv.nombre}</p>
                      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Capital: {formatCurrency(inv.capital || 0)}</p>
                    </div>
                    {inversionSeleccionada === inv.id && (
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--accent-violet)' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={confirmarSobrante}
            disabled={
              saving || !montoSobrante || parseFloat(montoSobrante) <= 0 ||
              (destinoSobrante === 'metas' && !metaSeleccionada) ||
              (destinoSobrante === 'inversiones' && !inversionSeleccionada)
            }
            className="ff-btn-primary w-full flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {(() => {
              if (destinoSobrante === 'metas' && metaSeleccionada)
                return `Mover a ${metasData.find(m => m.id === metaSeleccionada)?.nombre || 'Meta'}`
              if (destinoSobrante === 'inversiones' && inversionSeleccionada)
                return `Mover a ${inversionesData.find(i => i.id === inversionSeleccionada)?.nombre || 'Inversión'}`
              return `Mover a ${destinoSobrante}`
            })()}
          </button>
        </div>
      </Modal>
      <ConfirmDialog {...confirmProps} />
    </AppShell>
  )
}