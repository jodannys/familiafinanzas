'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Wallet, Plus, ArrowRight, Loader2, Trash2,
  AlertTriangle, TrendingUp, Sprout, Search,
  Calendar, Filter, X
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import Modal from '@/components/ui/Modal'

const ORIGENES = [
  { value: 'estilo', label: 'Estilo de vida', color: 'var(--accent-terra)', desc: 'Tu sobre diario' },
  { value: 'basicos', label: 'Gastos Básicos', color: 'var(--accent-blue)', desc: 'Súper, facturas...' },
  { value: 'metas', label: 'Metas de Ahorro', color: 'var(--accent-green)', desc: 'Retrasa tu ahorro' },
  { value: 'inversiones', label: 'Inversiones', color: '#818CF8', desc: 'Retrasa tu inversión' },
]

export default function SobrePage() {
  // Estados de Datos
  const [presupuesto, setPresupuesto] = useState(null)
  const [sobreMovs, setSobreMovs] = useState([])
  const [movsMes, setMovsMes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Estados de Filtros
  const [filtroMes, setFiltroMes] = useState(new Date().getMonth() + 1)
  const [filtroAño, setFiltroAño] = useState(new Date().getFullYear())
  const [busqueda, setBusqueda] = useState('')

  // Estados de Modales y Formularios
  const [modal, setModal] = useState(false)
  const [modalTraspaso, setModalTraspaso] = useState(false)
  const [modalSobrante, setModalSobrante] = useState(false)
  const [gastoTemp, setGastoTemp] = useState(null)
  const [form, setForm] = useState({ descripcion: '', monto: '' })
  const [origenTraspaso, setOrigenTraspaso] = useState('basicos')
  const [destinoSobrante, setDestinoSobrante] = useState('metas')
  const [montoSobrante, setMontoSobrante] = useState('')

  useEffect(() => {
    cargarTodo()
  }, [filtroMes, filtroAño])

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
      console.error("Error al cargar:", error)
    } finally {
      setLoading(false)
    }
  }

  // --- CÁLCULOS DE SALDOS (Lógica de Cubetas Reales) ---

  const gastadoSobre = sobreMovs.filter(m => m.origen === 'estilo').reduce((s, m) => s + m.monto, 0)
  const montoEstilo = presupuesto?.montoEstilo || 0
  const saldoSobre = montoEstilo - gastadoSobre


  const montoBasicos = presupuesto?.montoNecesidades || 0
  const gastadoBasicos = movsMes.filter(m => m.tipo === 'egreso' && ['basicos', 'deuda'].includes(m.categoria)).reduce((s, m) => s + m.monto, 0)
  const saldoBasicos = montoBasicos - gastadoBasicos

  const traspasosMetas = sobreMovs.filter(m => m.origen === 'metas').reduce((s, m) => s + m.monto, 0)
  const saldoMetas = presupuesto ? presupuesto.montoMetas - traspasosMetas : 0

  const traspasosInv = sobreMovs.filter(m => m.origen === 'inversiones').reduce((s, m) => s + m.monto, 0)
  const saldoInversiones = presupuesto ? presupuesto.montoInversiones - traspasosInv : 0

  function getSaldo(origen) {
    if (origen === 'estilo') return saldoSobre
    if (origen === 'basicos') return saldoBasicos
    if (origen === 'metas') return saldoMetas
    if (origen === 'inversiones') return saldoInversiones
    return 0
  }

  // --- HANDLERS DE MOVIMIENTOS ---

  async function handleGasto(e) {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!monto || !form.descripcion) return

    if (saldoSobre >= monto) {
      await registrarMovSobre({ descripcion: form.descripcion, monto, origen: 'estilo' })
      setModal(false)
      setForm({ descripcion: '', monto: '' })
    } else {
      setGastoTemp({ descripcion: form.descripcion, monto })
      setModal(false)
      setModalTraspaso(true)
    }
  }

  async function registrarMovSobre({ descripcion, monto, origen }) {
    setSaving(true)
    const { data, error } = await supabase
      .from('sobre_movimientos')
      .insert([{
        descripcion,
        monto,
        origen,
        mes: filtroMes,
        año: filtroAño,
        fecha: new Date().toISOString().slice(0, 10)
      }])
      .select()

    if (!error && data) setSobreMovs(prev => [data[0], ...prev])
    setSaving(false)
  }

  async function confirmarTraspaso() {
    if (!gastoTemp) return
    const saldoOrigen = getSaldo(origenTraspaso)
    if (saldoOrigen < gastoTemp.monto) {
      alert("No hay saldo suficiente en el origen seleccionado")
      return
    }
    await registrarMovSobre({
      descripcion: gastoTemp.descripcion,
      monto: gastoTemp.monto,
      origen: origenTraspaso
    })
    setModalTraspaso(false)
    setGastoTemp(null)
    setForm({ descripcion: '', monto: '' })
  }

  async function handleEliminar(id) {
    const { error } = await supabase.from('sobre_movimientos').delete().eq('id', id)
    if (!error) setSobreMovs(prev => prev.filter(m => m.id !== id))
  }

  async function confirmarSobrante() {
    const monto = parseFloat(montoSobrante)
    if (!monto || monto > saldoSobre) return
    setSaving(true)

    // 1. Salida del sobre
    await registrarMovSobre({ descripcion: `Traspaso a ${destinoSobrante}`, monto, origen: 'estilo' })
    // 2. Entrada al destino (monto negativo resta en la suma de egresos del sobre)
    await registrarMovSobre({ descripcion: `Ingreso desde Sobre Diario`, monto: -monto, origen: destinoSobrante })

    setModalSobrante(false)
    setMontoSobrante('')
    setSaving(false)
    cargarTodo()
  }

  // --- FILTRO DE BÚSQUEDA ---
  const movsFiltrados = sobreMovs.filter(m =>
    m.descripcion.toLowerCase().includes(busqueda.toLowerCase())
  )

  const pctUsado = montoEstilo > 0 ? Math.min(100, (gastadoSobre / montoEstilo) * 100) : 0
  const sobreColor = saldoSobre <= 0 ? 'var(--accent-rose)' : saldoSobre < montoEstilo * 0.2 ? 'var(--accent-terra)' : 'var(--accent-green)'

  return (
    <AppShell>
      {/* HEADER DINÁMICO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 animate-enter">
        <div>
          <p className="ff-label mb-1">Control Diario</p>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Sobre Diario
          </h1>
          <div className="flex items-center gap-3 mt-2 text-xs font-bold uppercase tracking-widest text-stone-400">
            <div className="flex items-center gap-1">
              <Calendar size={12} />
              <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))} className="bg-transparent outline-none cursor-pointer hover:text-stone-600 transition-colors">
                {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <span>/</span>
            <select value={filtroAño} onChange={(e) => setFiltroAño(Number(e.target.value))} className="bg-transparent outline-none cursor-pointer hover:text-stone-600 transition-colors">
              {[2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center justify-center gap-2 shadow-lg">
          <Plus size={18} strokeWidth={3} />
          Registrar Gasto
        </button>
      </div>

      {loading ? (
        <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-green)' }} />
          <p className="text-sm font-bold text-stone-400 uppercase tracking-widest">Sincronizando cubetas...</p>
        </div>
      ) : (
        <>
          {/* CARD PRINCIPAL (ADAPTADA AL TEMA) */}
          <Card className="mb-8 p-8 border-none shadow-xl relative overflow-hidden group" style={{ background: 'var(--bg-card)' }}>
            <div className="absolute top-[-20px] right-[-20px] opacity-[0.03] group-hover:scale-110 transition-transform duration-700">
              <Wallet size={200} />
            </div>

            <div className="relative z-10">
              <p className="ff-label" style={{ color: 'var(--text-muted)' }}>Disponible en el sobre</p>
              <h2 className="text-6xl font-black mb-6 tracking-tighter" style={{ color: '#C17A3A' }}>
                {formatCurrency(Math.max(0, saldoSobre))}
              </h2>

              <div className="w-full h-3 rounded-full mb-3" style={{ background: 'var(--progress-track)' }}>
                <div className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${pctUsado}%`, background: sobreColor }} />
              </div>

              <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                <span style={{ color: 'var(--text-muted)' }}>Gastado: {formatCurrency(gastadoSobre)}</span>
                <span style={{ color: 'var(--text-muted)' }}>Límite: {formatCurrency(montoEstilo)}</span>
              </div>

              {saldoSobre <= 0 && (
                <div className="mt-6 flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-100 animate-pulse">
                  <AlertTriangle size={16} className="text-rose-500" />
                  <p className="text-xs font-bold text-rose-600">¡Sobre vacío! Estás usando dinero de otras categorías.</p>
                </div>
              )}

              {saldoSobre > 0 && filtroMes === (new Date().getMonth() + 1) && (
                <button onClick={() => setModalSobrante(true)}
                  className="mt-6 w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] border border-dashed transition-all hover:bg-stone-50"
                  style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }}>
                  <Sprout size={14} className="inline mr-2" /> Enviar sobrante a Metas / Inversión
                </button>
              )}
            </div>
          </Card>

          {/* CUBETAS SECUNDARIAS */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Básicos', saldo: saldoBasicos, color: 'var(--accent-blue)' },
              { label: 'Metas', saldo: saldoMetas, color: 'var(--accent-green)' },
              { label: 'Inversión', saldo: saldoInversiones, color: '#818CF8' }
            ].map((box, i) => (
              <div key={i} className="glass-card p-4 animate-enter" style={{ animationDelay: `${i * 0.1}s` }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{box.label}</p>
                <p className="text-sm font-black" style={{ color: box.saldo < 0 ? 'var(--accent-rose)' : box.color }}>
                  {formatCurrency(box.saldo)}
                </p>
              </div>
            ))}
          </div>

          {/* BUSCADOR Y LISTADO */}
          {/* BUSCADOR ADAPTADO */}
          <div className="flex flex-col gap-3 mb-6 animate-enter" style={{ animationDelay: '0.3s' }}>
            <div className="relative w-full">
              {/* Icono de la lupa con z-index para que siempre sea visible */}
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                style={{ zIndex: 10 }}
              />

              {/* Input con el espacio forzado por Style para que el texto empiece después de la lupa */}
              <input
                className="ff-input w-full h-12"
                style={{
                  paddingLeft: '3.5rem',
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-glass)'
                }}
                placeholder="Buscar en este sobre..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />

              {/* Botón de limpiar búsqueda si hay texto */}
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
                  style={{ zIndex: 10 }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          <Card className="p-2">
            <div className="space-y-1">
              {movsFiltrados.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs font-bold text-stone-400 italic">No se han encontrado registros</p>
                </div>
              ) : (
                movsFiltrados.map((m) => {
                  const esPositivo = m.monto < 0; // Traspasos entrantes
                  return (
                    <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl hover:bg-stone-50 transition-all group">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: m.origen === 'estilo' ? 'var(--bg-secondary)' : `${ORIGENES.find(o => o.value === m.origen)?.color}15` }}>
                        {esPositivo ? <TrendingUp size={16} className="text-emerald-500" /> : <Wallet size={16} style={{ color: 'var(--text-muted)' }} />}
                      </div>

                      <div className="flex-1">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{m.descripcion}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
                            {m.origen === 'estilo' ? 'Sobre' : `de ${m.origen}`}
                          </span>
                          <span className="text-[9px] text-stone-400">{new Date(m.fecha).toLocaleDateString('es-ES')}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`text-sm font-black ${esPositivo ? 'text-emerald-500' : 'text-stone-800'}`}>
                          {esPositivo ? '+' : '-'}{formatCurrency(Math.abs(m.monto))}
                        </p>
                        <button onClick={() => handleEliminar(m.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-rose-400 p-1">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </>
      )}

      {/* MODAL: REGISTRAR GASTO */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Gasto Hormiga">
        <form onSubmit={handleGasto} className="space-y-5">
          <div>
            <label className="ff-label">Descripción del gasto</label>
            <input className="ff-input" placeholder="¿En qué se fue el dinero?" required
              value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <label className="ff-label">Monto (€)</label>
            <input className="ff-input text-2xl font-black" type="number" step="0.01" placeholder="0.00" required
              value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cerrar</button>
            <button type="submit" className="ff-btn-primary flex-1">
              {saldoSobre < parseFloat(form.monto || 0) ? 'Elegir Origen →' : 'Confirmar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: TRASPASO (SOBRE VACÍO) */}
      <Modal open={modalTraspaso} onClose={() => setModalTraspaso(false)} title="¡Sobre Vacío!">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-2">
            <AlertTriangle size={32} />
          </div>
          <p className="text-sm text-stone-600">
            No queda dinero en tu Sobre. Para registrar <b>{formatCurrency(gastoTemp?.monto)}</b>, debes quitarlo de otra cubeta:
          </p>

          <div className="grid gap-2 text-left">
            {ORIGENES.filter(o => o.value !== 'estilo').map(o => (
              <button key={o.value}
                onClick={() => setOrigenTraspaso(o.value)}
                className={`p-4 rounded-xl border-2 transition-all flex justify-between items-center ${origenTraspaso === o.value ? 'border-emerald-500 bg-emerald-50' : 'border-stone-100 hover:border-stone-200'}`}>
                <div>
                  <p className="text-xs font-black uppercase" style={{ color: o.color }}>{o.label}</p>
                  <p className="text-[10px] text-stone-400">Disponible: {formatCurrency(getSaldo(o.value))}</p>
                </div>
                {origenTraspaso === o.value && <div className="w-2 h-2 rounded-full bg-emerald-500" />}
              </button>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={() => setModalTraspaso(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button onClick={confirmarTraspaso} disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Confirmar Robo
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: SOBRANTE */}
      <Modal open={modalSobrante} onClose={() => setModalSobrante(false)} title="Optimizar Ahorro">
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-700">¡Felicidades! Tienes {formatCurrency(saldoSobre)} que no has gastado.</p>
          </div>

          <div>
            <label className="ff-label">Monto a mover</label>
            <input className="ff-input text-xl font-bold" type="number" step="0.01" max={saldoSobre}
              value={montoSobrante} onChange={e => setMontoSobrante(e.target.value)} />
          </div>

          <div className="flex gap-2">
            {['metas', 'inversiones'].map(dest => (
              <button key={dest} onClick={() => setDestinoSobrante(dest)}
                className={`flex-1 p-3 rounded-xl border-2 text-[10px] font-black uppercase transition-all ${destinoSobrante === dest ? 'border-emerald-500 bg-emerald-50' : 'border-stone-100'}`}>
                {dest}
              </button>
            ))}
          </div>

          <button onClick={confirmarSobrante} disabled={saving || !montoSobrante} className="ff-btn-primary w-full flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Mover a {destinoSobrante}
          </button>
        </div>
      </Modal>
    </AppShell>
  )
}