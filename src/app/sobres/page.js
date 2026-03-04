'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Wallet, Plus, Loader2, Trash2,
  AlertTriangle, TrendingUp, Sprout, Search,
  Calendar, X, ArrowDownRight
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import Modal from '@/components/ui/Modal'

const ORIGENES = [
  { value: 'basicos', label: 'Gastos Básicos', color: 'var(--accent-blue)', desc: 'Súper, facturas...' },
  { value: 'metas', label: 'Metas de Ahorro', color: 'var(--accent-green)', desc: 'Retrasa tu ahorro' },
  { value: 'inversiones', label: 'Inversiones', color: '#818CF8', desc: 'Retrasa tu inversión' },
]

export default function SobrePage() {
  const [presupuesto, setPresupuesto] = useState(null)
  const [sobreMovs, setSobreMovs] = useState([])   // solo traspasos
  const [movsMes, setMovsMes] = useState([])        // todos los movimientos del mes
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
  const [origenTraspaso, setOrigenTraspaso] = useState('basicos')
  const [destinoSobrante, setDestinoSobrante] = useState('metas')
  const [montoSobrante, setMontoSobrante] = useState('')

  useEffect(() => { cargarTodo() }, [filtroMes, filtroAño])

  async function cargarTodo() {
    setLoading(true)
    const fechaInicio = `${filtroAño}-${String(filtroMes).padStart(2, '0')}-01`
    const fechaFin = `${filtroAño}-${String(filtroMes).padStart(2, '0')}-31`

    try {
      const [pres, { data: sobre }, { data: movs }] = await Promise.all([
        getPresupuestoMes(),
        supabase.from('sobre_movimientos')
          .select('*')
          .eq('mes', filtroMes)
          .eq('año', filtroAño)
          .order('created_at', { ascending: false }),
        supabase.from('movimientos')
          .select('*')
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin),
      ])
      setPresupuesto(pres)
      setSobreMovs(sobre || [])
      setMovsMes(movs || [])
    } catch (error) {
      console.error('Error al cargar:', error)
    } finally {
      setLoading(false)
    }
  }

  // ── CÁLCULOS DE SALDO ──────────────────────────────────────────────────────

  // Sobre Diario: lee gastos de categoría "deseo" en movimientos
  const montoEstilo = presupuesto?.montoEstilo || 0
  const gastadoSobre = movsMes
    .filter(m => m.tipo === 'egreso' && m.categoria === 'deseo')
    .reduce((s, m) => s + m.monto, 0)

  // Los traspasos de otras cubetas al sobre aumentan el disponible
  const traspasosAlSobre = sobreMovs
    .filter(m => ['basicos', 'metas', 'inversiones'].includes(m.origen))
    .reduce((s, m) => s + m.monto, 0)

  const saldoSobre = montoEstilo - gastadoSobre + traspasosAlSobre

  // Básicos: egresos de categoría basicos/deuda
  const montoBasicos = presupuesto?.montoNecesidades || 0
  const gastadoBasicos = movsMes
    .filter(m => m.tipo === 'egreso' && ['basicos', 'deuda'].includes(m.categoria))
    .reduce((s, m) => s + m.monto, 0)

  const traspasosBasicos = sobreMovs
    .filter(m => m.origen === 'basicos')
    .reduce((s, m) => s + m.monto, 0)

  const saldoBasicos = montoBasicos - gastadoBasicos - traspasosBasicos

  // Metas e Inversiones: usan sobre_movimientos para traspasos
  const traspasosMetas = sobreMovs
    .filter(m => m.origen === 'metas' && m.monto > 0)
    .reduce((s, m) => s + m.monto, 0)
  const saldoMetas = (presupuesto?.montoMetas || 0) - traspasosMetas

  const traspasosInv = sobreMovs
    .filter(m => m.origen === 'inversiones' && m.monto > 0)
    .reduce((s, m) => s + m.monto, 0)
  const saldoInversiones = (presupuesto?.montoInversiones || 0) - traspasosInv

  function getSaldo(origen) {
    if (origen === 'basicos') return saldoBasicos
    if (origen === 'metas') return saldoMetas
    if (origen === 'inversiones') return saldoInversiones
    return 0
  }

  // ── HANDLERS ───────────────────────────────────────────────────────────────

  async function handleGasto(e) {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!monto || !form.descripcion) return

    if (saldoSobre >= monto) {
      // Guardar directamente en movimientos como egreso deseo
      setSaving(true)
      const { error } = await supabase.from('movimientos').insert([{
        tipo: 'egreso',
        categoria: 'deseo',
        descripcion: form.descripcion,
        monto,
        fecha: new Date().toISOString().slice(0, 10),
        quien: form.quien,
      }])
      if (!error) {
        setModal(false)
        setForm({ descripcion: '', monto: '', quien: 'Ambos' })
        cargarTodo()
      }
      setSaving(false)
    } else {
      // Sobre insuficiente → pedir traspaso
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

    // 1. Gasto real en movimientos (categoría deseo)
    await supabase.from('movimientos').insert([{
      tipo: 'egreso',
      categoria: 'deseo',
      descripcion: gastoTemp.descripcion,
      monto: gastoTemp.monto,
      fecha: new Date().toISOString().slice(0, 10),
      quien: gastoTemp.quien || 'Ambos',
    }])

    // 2. Traspaso en sobre_movimientos para ajustar el saldo del origen
    await supabase.from('sobre_movimientos').insert([{
      descripcion: `Traspaso desde ${origenTraspaso} → Sobre`,
      monto: gastoTemp.monto,
      origen: origenTraspaso,
      mes: filtroMes,
      año: filtroAño,
      fecha: new Date().toISOString().slice(0, 10),
    }])

    setSaving(false)
    setModalTraspaso(false)
    setGastoTemp(null)
    setForm({ descripcion: '', monto: '', quien: 'Ambos' })
    cargarTodo()
  }

  async function confirmarSobrante() {
    const monto = parseFloat(montoSobrante)
    if (!monto || monto > saldoSobre) return
    setSaving(true)

    // Registrar traspaso en sobre_movimientos
    await supabase.from('sobre_movimientos').insert([{
      descripcion: `Sobrante → ${destinoSobrante}`,
      monto,
      origen: destinoSobrante,
      mes: filtroMes,
      año: filtroAño,
      fecha: new Date().toISOString().slice(0, 10),
    }])

    // Registrar el gasto en movimientos para que reste del sobre
    await supabase.from('movimientos').insert([{
      tipo: 'egreso',
      categoria: 'deseo',
      descripcion: `Sobrante enviado a ${destinoSobrante}`,
      monto,
      fecha: new Date().toISOString().slice(0, 10),
      quien: 'Ambos',
    }])

    setSaving(false)
    setModalSobrante(false)
    setMontoSobrante('')
    cargarTodo()
  }

  async function handleEliminar(mov) {
    if (mov._fuente === 'sobre') {
      await supabase.from('sobre_movimientos').delete().eq('id', mov.id)
      setSobreMovs(prev => prev.filter(m => m.id !== mov.id))
    } else {
      await supabase.from('movimientos').delete().eq('id', mov.id)
      cargarTodo()
    }
  }

  // ── LISTA UNIFICADA ────────────────────────────────────────────────────────
  // Gastos del sobre (movimientos deseo) + traspasos (sobre_movimientos)
  const movsFiltrados = [
    ...movsMes
      .filter(m => m.tipo === 'egreso' && m.categoria === 'deseo')
      .map(m => ({ ...m, _fuente: 'mov', _label: 'Sobre' })),
    ...sobreMovs.map(m => ({ ...m, _fuente: 'sobre', _label: `Traspaso · ${m.origen}` })),
  ]
    .filter(m => m.descripcion?.toLowerCase().includes(busqueda.toLowerCase()))
    .sort((a, b) => new Date(b.fecha || b.created_at) - new Date(a.fecha || a.created_at))

  const pctUsado = montoEstilo > 0 ? Math.min(100, (gastadoSobre / montoEstilo) * 100) : 0
  const sobreColor = saldoSobre <= 0
    ? 'var(--accent-rose)'
    : saldoSobre < montoEstilo * 0.2
      ? 'var(--accent-terra)'
      : 'var(--accent-green)'

  return (
    <AppShell>
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3 mb-6 animate-enter">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Control Diario</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight">Sobre Diario</h1>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400">
            <Calendar size={11} />
            <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer hover:text-stone-600">
              {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <span>/</span>
            <select value={filtroAño} onChange={e => setFiltroAño(Number(e.target.value))}
              className="bg-transparent outline-none cursor-pointer hover:text-stone-600">
              {[2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => setModal(true)}
          className="ff-btn-primary flex items-center justify-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="text-sm font-bold hidden sm:inline">Registrar Gasto</span>
          <span className="text-sm font-bold sm:hidden">+ Gasto</span>

          {loading ? (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-green)' }} />
              <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Cargando...</p>
            </div>
          ) : (
            <>
              {/* CARD PRINCIPAL */}
              <Card className="mb-6 relative overflow-hidden" style={{ padding: '20px 20px' }}>
                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>
                  Disponible en el sobre
                </p>
                <h2 className="text-4xl font-black mb-4 tracking-tighter" style={{ color: '#C17A3A' }}>
                  {formatCurrency(Math.max(0, saldoSobre))}
                </h2>

                <div className="w-full h-2.5 rounded-full mb-2" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pctUsado}%`, background: sobreColor }} />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-3">
                  <span style={{ color: 'var(--text-muted)' }}>Gastado: {formatCurrency(gastadoSobre)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>Límite: {formatCurrency(montoEstilo)}</span>
                </div>

                {saldoSobre <= 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100">
                    <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
                    <p className="text-[10px] font-bold text-rose-600">¡Sobre vacío! Usando dinero de otras categorías.</p>
                  </div>
                )}

                {saldoSobre > 0 && filtroMes === (new Date().getMonth() + 1) && (
                  <button onClick={() => setModalSobrante(true)}
                    className="mt-3 w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider border border-dashed transition-all hover:bg-stone-50"
                    style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}>
                    <Sprout size={12} className="inline mr-1.5" />
                    Enviar sobrante a Metas / Inversión
                  </button>
                )}
              </Card>

              {/* CUBETAS SECUNDARIAS */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { label: 'Básicos', saldo: saldoBasicos, color: 'var(--accent-blue)' },
                  { label: 'Metas', saldo: saldoMetas, color: 'var(--accent-green)' },
                  { label: 'Inversión', saldo: saldoInversiones, color: '#818CF8' },
                ].map((box, i) => (
                  <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.08}s` }}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{box.label}</p>
                    <p className="text-sm font-black" style={{ color: box.saldo < 0 ? 'var(--accent-rose)' : box.color }}>
                      {formatCurrency(box.saldo)}
                    </p>
                  </div>
                ))}
              </div>

              {/* BUSCADOR */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" style={{ zIndex: 10 }} />
                <input className="ff-input w-full h-11" style={{ paddingLeft: '3rem' }}
                  placeholder="Buscar en este sobre..."
                  value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                {busqueda && (
                  <button onClick={() => setBusqueda('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400">
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* LISTA */}
              <Card className="p-2">
                {movsFiltrados.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-xs font-bold text-stone-400 italic">Sin registros este mes</p>
                  </div>
                ) : (
                  <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                    {movsFiltrados.map((m, i) => (
                      <div key={`${m._fuente}-${m.id}`}
                        className="flex items-center gap-3 px-3 py-3.5 hover:bg-stone-50 transition-colors group overflow-hidden">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: m._fuente === 'mov' ? 'rgba(193,122,58,0.1)' : 'rgba(129,140,248,0.1)' }}>
                          {m._fuente === 'mov'
                            ? <ArrowDownRight size={15} style={{ color: '#C17A3A' }} />
                            : <TrendingUp size={15} style={{ color: '#818CF8' }} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-stone-800 truncate leading-tight" style={{ maxWidth: '100%' }}>{m.descripcion}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                              style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                              {m._label}
                            </span>
                            <span className="text-[9px] text-stone-400">
                              {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES') : '—'}
                            </span>
                            {m.quien && m._fuente === 'mov' && (
                              <span className="text-[9px] text-stone-400">{m.quien}</span>
                            )}
                          </div>
                        </div>



                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto pl-2">
                          <p className="text-sm font-black tabular-nums whitespace-nowrap" style={{ color: '#C17A3A' }}>
                            -{formatCurrency(Math.abs(m.monto))}
                          </p>
                          <button onClick={() => handleEliminar(m)}
                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: '#C0605A' }}>
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

          {/* MODAL: REGISTRAR GASTO */}
          <Modal open={modal} onClose={() => setModal(false)} title="Registrar Gasto del Sobre">
            <form onSubmit={handleGasto} className="space-y-4">
              <div>
                <label className="ff-label">Descripción</label>
                <input className="ff-input" placeholder="¿En qué gastaste?" required
                  value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div>
                <label className="ff-label">Monto (€)</label>
                <input className="ff-input text-xl font-black" type="number" step="0.01" placeholder="0.00" required
                  value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
              </div>
              <div>
                <label className="ff-label">¿Quién?</label>
                <select className="ff-input h-12 text-sm" value={form.quien}
                  onChange={e => setForm({ ...form, quien: e.target.value })}>
                  <option value="Jodannys">Jodannys</option>
                  <option value="Rolando">Rolando</option>
                  <option value="Ambos">Ambos</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
                <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saldoSobre < parseFloat(form.monto || 0) ? 'Elegir Origen →' : 'Confirmar'}
                </button>
              </div>
            </form>
          </Modal>

          {/* MODAL: TRASPASO */}
          <Modal open={modalTraspaso} onClose={() => setModalTraspaso(false)} title="¡Sobre Vacío!">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-2">
                <AlertTriangle size={14} className="text-rose-500 flex-shrink-0" />
                <p className="text-xs font-bold text-rose-600">
                  No hay saldo. Para pagar <b>{formatCurrency(gastoTemp?.monto)}</b> elige de dónde tomar:
                </p>
              </div>
              <div className="space-y-2">
                {ORIGENES.map(o => (
                  <button key={o.value} onClick={() => setOrigenTraspaso(o.value)}
                    className="w-full p-3.5 rounded-xl border-2 transition-all flex justify-between items-center text-left"
                    style={{
                      borderColor: origenTraspaso === o.value ? 'var(--accent-green)' : 'var(--border-glass)',
                      background: origenTraspaso === o.value ? 'rgba(45,122,95,0.05)' : 'transparent'
                    }}>
                    <div>
                      <p className="text-xs font-black uppercase" style={{ color: o.color }}>{o.label}</p>
                      <p className="text-[10px] text-stone-400">Disponible: {formatCurrency(getSaldo(o.value))}</p>
                    </div>
                    {origenTraspaso === o.value && (
                      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-green)' }} />
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

          {/* MODAL: SOBRANTE */}
          <Modal open={modalSobrante} onClose={() => setModalSobrante(false)} title="Enviar Sobrante">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <p className="text-xs font-bold text-emerald-700">
                  Tienes {formatCurrency(saldoSobre)} sin gastar este mes. ¡Aprovéchalo!
                </p>
              </div>
              <div>
                <label className="ff-label">Monto a mover</label>
                <input className="ff-input text-xl font-bold" type="number" step="0.01" max={saldoSobre}
                  placeholder="0.00" value={montoSobrante}
                  onChange={e => setMontoSobrante(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['metas', 'inversiones'].map(dest => (
                  <button key={dest} onClick={() => setDestinoSobrante(dest)}
                    className="p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all"
                    style={{
                      borderColor: destinoSobrante === dest ? 'var(--accent-green)' : 'var(--border-glass)',
                      background: destinoSobrante === dest ? 'rgba(45,122,95,0.05)' : 'transparent',
                      color: destinoSobrante === dest ? 'var(--accent-green)' : 'var(--text-muted)'
                    }}>
                    {dest}
                  </button>
                ))}
              </div>
              <button onClick={confirmarSobrante} disabled={saving || !montoSobrante}
                className="ff-btn-primary w-full flex items-center justify-center gap-2">
                {saving && <Loader2 size={14} className="animate-spin" />}
                Mover a {destinoSobrante}
              </button>
            </div>
          </Modal>
        </AppShell>
        )
}