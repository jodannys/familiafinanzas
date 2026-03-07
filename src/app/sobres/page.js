'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Wallet, Plus, Loader2, Trash2,
  AlertTriangle, TrendingUp, Sprout, Search,
  Calendar, X, ArrowDownRight, CreditCard
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import Modal from '@/components/ui/Modal'

// ── FIX FECHAS: usa fecha local para evitar desfase UTC ──────────────────────
function fechaHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ORIGENES = [
  { value: 'basicos',     label: 'Gastos Básicos',   color: 'var(--accent-blue)',  desc: 'Súper, facturas...' },
  { value: 'metas',       label: 'Metas de Ahorro',  color: 'var(--accent-green)', desc: 'Retrasa tu ahorro' },
  { value: 'inversiones', label: 'Inversiones',      color: '#818CF8',             desc: 'Retrasa tu inversión' },
]

export default function SobrePage() {
  const [presupuesto, setPresupuesto] = useState(null)
  const [sobreMovs, setSobreMovs]     = useState([])
  const [movsMes, setMovsMes]         = useState([])
  const [tarjetasData, setTarjetasData] = useState([])
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)

  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1)
  const [filtroAño, setFiltroAño] = useState(new Date().getFullYear())
  const [busqueda, setBusqueda]   = useState('')

  const [modal, setModal]                   = useState(false)
  const [modalTraspaso, setModalTraspaso]   = useState(false)
  const [modalSobrante, setModalSobrante]   = useState(false)
  const [gastoTemp, setGastoTemp]           = useState(null)
  const [form, setForm] = useState({ descripcion: '', monto: '', quien: 'Ambos' })
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState('')
  const [origenTraspaso, setOrigenTraspaso] = useState('basicos')
  const [destinoSobrante, setDestinoSobrante] = useState('metas')
  const [montoSobrante, setMontoSobrante]   = useState('')

  useEffect(() => { cargarTodo() }, [filtroMes, filtroAño])

  async function cargarTodo() {
    setLoading(true)
    const fechaInicio = `${filtroAño}-${String(filtroMes).padStart(2, '0')}-01`
    const fechaFin    = `${filtroAño}-${String(filtroMes).padStart(2, '0')}-31`

    try {
      const [pres, { data: sobre }, { data: movs }, { data: tarjetas }] = await Promise.all([
        getPresupuestoMes(),
        supabase.from('sobre_movimientos').select('*').eq('mes', filtroMes).eq('año', filtroAño).order('created_at', { ascending: false }),
        supabase.from('movimientos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
        supabase.from('deudas').select('id, nombre, emoji, pendiente').eq('tipo_deuda', 'tarjeta').eq('estado', 'activa'),
      ])
      setPresupuesto(pres)
      setSobreMovs(sobre || [])
      setMovsMes(movs || [])
      setTarjetasData(tarjetas || [])
    } catch (err) {
      console.error('Error al cargar:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── CÁLCULOS DE SALDO ──────────────────────────────────────────────────────
  const montoEstilo    = parseFloat(presupuesto?.montoEstilo)     || 0
  const montoBasicos   = parseFloat(presupuesto?.montoNecesidades) || 0
  const montoMetas     = parseFloat(presupuesto?.montoMetas)      || 0
  const montoInv       = parseFloat(presupuesto?.montoInversiones) || 0

  const gastadoSobre = movsMes
    .filter(m => m.tipo === 'egreso' && m.categoria === 'deseo')
    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)

  const traspasosAlSobre = sobreMovs
    .filter(m => ['basicos', 'metas', 'inversiones'].includes(m.origen))
    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)

  const saldoSobre = (montoEstilo || 0) - gastadoSobre + traspasosAlSobre

  const gastadoBasicos  = movsMes.filter(m => m.tipo === 'egreso' && ['basicos', 'deuda'].includes(m.categoria))
    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
  const traspasosBasicos = sobreMovs.filter(m => m.origen === 'basicos')
    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
  const saldoBasicos = (montoBasicos || 0) - gastadoBasicos - traspasosBasicos

  const traspasosMetas = sobreMovs.filter(m => m.origen === 'metas')
    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
  const saldoMetas = (montoMetas || 0) - traspasosMetas

  const traspasosInv = sobreMovs.filter(m => m.origen === 'inversiones')
    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
  const saldoInversiones = (montoInv || 0) - traspasosInv

  function getSaldo(origen) {
    if (origen === 'basicos')     return saldoBasicos || 0
    if (origen === 'metas')       return saldoMetas || 0
    if (origen === 'inversiones') return saldoInversiones || 0
    return 0
  }

  // ── HANDLERS ───────────────────────────────────────────────────────────────
  function resetModal() {
    setModal(false)
    setTarjetaSeleccionada('')
    setForm({ descripcion: '', monto: '', quien: 'Ambos' })
  }

  async function handleGasto(e) {
    e.preventDefault()
    const monto = parseFloat(form.monto) || 0
    if (!monto || !form.descripcion) return

    if (tarjetaSeleccionada) {
      setSaving(true)
      const { error } = await supabase.from('deuda_movimientos').insert([{
        deuda_id: tarjetaSeleccionada,
        tipo: 'cargo',
        descripcion: form.descripcion,
        monto,
        fecha: fechaHoy(),
        mes: filtroMes,
        año: filtroAño,
      }])
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
    if (!gastoTemp) return
    const saldoOrigen = getSaldo(origenTraspaso)
    if (saldoOrigen < gastoTemp.monto) {
      alert('No hay saldo suficiente en el origen seleccionado')
      return
    }
    setSaving(true)
    const hoy = fechaHoy()
    await supabase.from('movimientos').insert([{
      tipo: 'egreso', categoria: 'deseo',
      descripcion: gastoTemp.descripcion, monto: gastoTemp.monto,
      fecha: hoy, quien: gastoTemp.quien || 'Ambos',
    }])
    await supabase.from('sobre_movimientos').insert([{
      descripcion: `Traspaso desde ${origenTraspaso} → Sobre`,
      monto: gastoTemp.monto, origen: origenTraspaso,
      mes: filtroMes, año: filtroAño, fecha: hoy,
    }])
    setSaving(false)
    setModalTraspaso(false)
    setGastoTemp(null)
    setForm({ descripcion: '', monto: '', quien: 'Ambos' })
    setTarjetaSeleccionada('')
    cargarTodo()
  }

  async function confirmarSobrante() {
    const monto = parseFloat(montoSobrante) || 0
    if (!monto || monto > saldoSobre) return
    setSaving(true)
    const hoy = fechaHoy()
    await supabase.from('sobre_movimientos').insert([{
      descripcion: `Sobrante → ${destinoSobrante}`,
      monto, origen: 'sobre',destino: destinoSobrante,
      mes: filtroMes, año: filtroAño, fecha: hoy,
    }])
    await supabase.from('movimientos').insert([{
      tipo: 'egreso', categoria: 'deseo',
      descripcion: `Sobrante enviado a ${destinoSobrante}`,
      monto, fecha: hoy, quien: 'Ambos',
    }])
    setSaving(false)
    setModalSobrante(false)
    setMontoSobrante('')
    cargarTodo()
  }

  async function handleEliminar(mov) {
    if (!confirm('¿Eliminar este movimiento?')) return
    if (mov._fuente === 'sobre') {
      await supabase.from('sobre_movimientos').delete().eq('id', mov.id)
      setSobreMovs(prev => prev.filter(m => m.id !== mov.id))
    } else {
      await supabase.from('movimientos').delete().eq('id', mov.id)
      cargarTodo()
    }
  }

  const movsFiltrados = [
    ...movsMes.filter(m => m.tipo === 'egreso' && m.categoria === 'deseo').map(m => ({ ...m, _fuente: 'mov', _label: 'Sobre' })),
    ...sobreMovs.map(m => ({ ...m, _fuente: 'sobre', _label: `Traspaso · ${m.origen}` })),
  ].filter(m => {
    const q = busqueda.toLowerCase()
    return m.descripcion?.toLowerCase().includes(q) || m.quien?.toLowerCase().includes(q)
  }).sort((a, b) => new Date(b.fecha || b.created_at) - new Date(a.fecha || a.created_at))

  const pctUsado   = montoEstilo > 0 ? Math.min(100, (gastadoSobre / montoEstilo) * 100) : 0
  const sobreColor = saldoSobre <= 0
    ? 'var(--accent-rose)'
    : saldoSobre < montoEstilo * 0.2
      ? 'var(--accent-terra)'
      : 'var(--accent-green)'

  const usandoTarjeta     = !!tarjetaSeleccionada
  const esMesActual       = filtroMes === new Date().getMonth() + 1 && filtroAño === new Date().getFullYear()
  const montoFormParseado = parseFloat(form.monto) || 0

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <AppShell>

      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 mb-6 animate-enter">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Control Diario
          </p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Sobre Diario</h1>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}>
            <Calendar size={11} />
            <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer"
              style={{ color: 'var(--text-muted)' }}>
              {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <span>/</span>
            <select value={filtroAño} onChange={e => setFiltroAño(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer"
              style={{ color: 'var(--text-muted)' }}>
              {[2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => setModal(true)}
          className="ff-btn-primary flex items-center justify-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="text-sm font-bold hidden sm:inline">Registrar Gasto</span>
          <span className="text-sm font-bold sm:hidden">Gasto</span>
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
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
              Disponible en el sobre
            </p>
            <h2 className="text-4xl font-black mb-4 tracking-tighter" style={{ color: 'var(--accent-terra)' }}>
              {formatCurrency(Math.max(0, saldoSobre))}
            </h2>

            {/* Barra de progreso */}
            <div className="w-full h-2.5 rounded-full mb-2" style={{ background: 'var(--progress-track)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctUsado}%`, background: sobreColor }} />
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-3">
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
                <p className="text-[10px] font-bold" style={{ color: 'var(--accent-rose)' }}>
                  ¡Sobre vacío! Usando dinero de otras categorías.
                </p>
              </div>
            )}

            {/* Botón enviar sobrante — solo en mes actual con saldo positivo */}
            {saldoSobre > 0 && esMesActual && (
              <button onClick={() => setModalSobrante(true)}
                className="mt-3 w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-dashed transition-all"
                style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}>
                <Sprout size={12} className="inline mr-1.5" />
                Enviar sobrante a Metas / Inversión
              </button>
            )}
          </Card>

          {/* CUBETAS */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Básicos',   saldo: saldoBasicos,     color: 'var(--accent-blue)' },
              { label: 'Metas',     saldo: saldoMetas,       color: 'var(--accent-green)' },
              { label: 'Inversión', saldo: saldoInversiones, color: '#818CF8' },
            ].map((box, i) => (
              <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.08}s` }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  {box.label}
                </p>
                <p className="text-sm font-black"
                  style={{ color: box.saldo < 0 ? 'var(--accent-rose)' : box.color, letterSpacing: '-0.02em' }}>
                  {formatCurrency(box.saldo)}
                </p>
              </div>
            ))}
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
              <div className="py-12 text-center">
                <Wallet size={28} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                <p className="text-xs font-bold italic" style={{ color: 'var(--text-muted)' }}>Sin registros este mes</p>
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
                          : 'rgba(129,140,248,0.12)',
                      }}>
                      {m._fuente === 'mov'
                        ? <ArrowDownRight size={15} style={{ color: 'var(--accent-terra)' }} />
                        : <TrendingUp size={15} style={{ color: '#818CF8' }} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {m.descripcion}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                          {m._label}
                        </span>
                        <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES') : '—'}
                        </span>
                        {m.quien && m._fuente === 'mov' && (
                          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{m.quien}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <p className="text-sm font-black tabular-nums" style={{ color: 'var(--accent-terra)' }}>
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
              <label className="text-[10px] font-black uppercase flex items-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}>
                <CreditCard size={11} /> ¿Pagado con tarjeta? (opcional)
              </label>
              <select className="ff-input" style={{ height: 44, fontSize: 13 }}
                value={tarjetaSeleccionada}
                onChange={e => setTarjetaSeleccionada(e.target.value)}>
                <option value="">— No, pago directo —</option>
                {tarjetasData.map(t => (
                  <option key={t.id} value={t.id}>{t.emoji} {t.nombre}</option>
                ))}
              </select>
              {usandoTarjeta && (
                <div className="px-3 py-2 rounded-xl text-[10px] font-bold"
                  style={{ background: 'rgba(129,140,248,0.08)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.2)' }}>
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
            <input className="ff-input text-xl font-black" type="number" step="0.01" min="0.01" placeholder="0.00" required
              value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            {/* Indicador de saldo disponible */}
            {!usandoTarjeta && montoFormParseado > 0 && (
              <p className="text-[10px] mt-1 font-bold"
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
              <select className="ff-input" style={{ height: 44, fontSize: 13 }}
                value={form.quien} onChange={e => setForm({ ...form, quien: e.target.value })}>
                <option value="Jodannys">Jodannys</option>
                <option value="Rolando">Rolando</option>
                <option value="Ambos">Ambos</option>
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={resetModal} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2"
              style={usandoTarjeta ? { background: '#818CF8' } : {}}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {usandoTarjeta
                ? '💳 Cargar a tarjeta'
                : montoFormParseado > saldoSobre
                  ? 'Elegir Origen →'
                  : 'Confirmar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ MODAL: TRASPASO ═════════════════════════════════════════════════ */}
      <Modal open={modalTraspaso} onClose={() => setModalTraspaso(false)} title="¡Sobre Vacío!">
        <div className="space-y-4">
          <div className="p-3 rounded-xl flex items-center gap-2"
            style={{
              background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)',
            }}>
            <AlertTriangle size={14} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
            <p className="text-xs font-bold" style={{ color: 'var(--accent-rose)' }}>
              No hay saldo. Para pagar <b>{formatCurrency(gastoTemp?.monto)}</b>, elige de dónde tomar:
            </p>
          </div>

          <div className="space-y-2">
            {ORIGENES.map(o => (
              <button key={o.value} onClick={() => setOrigenTraspaso(o.value)}
                className="w-full p-3.5 rounded-xl border-2 transition-all flex justify-between items-center text-left"
                style={{
                  borderColor: origenTraspaso === o.value ? 'var(--accent-green)' : 'var(--border-glass)',
                  background:  origenTraspaso === o.value ? 'color-mix(in srgb, var(--accent-green) 5%, transparent)' : 'transparent',
                }}>
                <div>
                  <p className="text-xs font-black uppercase" style={{ color: o.color }}>{o.label}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Disponible: {formatCurrency(getSaldo(o.value))}
                  </p>
                  {getSaldo(o.value) < (gastoTemp?.monto || 0) && (
                    <p className="text-[9px] font-bold mt-0.5" style={{ color: 'var(--accent-rose)' }}>
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
      <Modal open={modalSobrante} onClose={() => setModalSobrante(false)} title="Enviar Sobrante">
        <div className="space-y-4">
          <div className="p-3 rounded-xl"
            style={{
              background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
            }}>
            <p className="text-xs font-bold" style={{ color: 'var(--accent-green)' }}>
              Tienes {formatCurrency(saldoSobre)} sin gastar. ¡Ponlo a trabajar!
            </p>
          </div>

          <div>
            <label className="ff-label">Monto a mover</label>
            <input className="ff-input text-xl font-bold" type="number" step="0.01"
              max={saldoSobre} placeholder="0.00"
              value={montoSobrante} onChange={e => setMontoSobrante(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {['metas', 'inversiones'].map(dest => (
              <button key={dest} onClick={() => setDestinoSobrante(dest)}
                className="p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all"
                style={{
                  borderColor: destinoSobrante === dest ? 'var(--accent-green)' : 'var(--border-glass)',
                  background:  destinoSobrante === dest ? 'color-mix(in srgb, var(--accent-green) 6%, transparent)' : 'transparent',
                  color:       destinoSobrante === dest ? 'var(--accent-green)' : 'var(--text-muted)',
                }}>
                {dest}
              </button>
            ))}
          </div>

          <button onClick={confirmarSobrante}
            disabled={saving || !montoSobrante || parseFloat(montoSobrante) <= 0}
            className="ff-btn-primary w-full flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Mover a {destinoSobrante}
          </button>
        </div>
      </Modal>
    </AppShell>
  )
}