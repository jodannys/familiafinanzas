'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Wallet, Plus, ArrowRight, Loader2, Trash2,
  AlertTriangle, TrendingUp, Sprout, Search, X
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import Modal from '@/components/ui/Modal'

// Utility rápida por si no la tienes importada
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

const ORIGENES = [
  { value: 'estilo', label: 'Estilo de vida', color: '#C17A3A', desc: 'Tu sobre diario' },
  { value: 'basicos', label: 'Gastos Básicos', color: '#4A6FA5', desc: 'Súper, facturas...' },
  { value: 'metas', label: 'Metas de Ahorro', color: '#2D7A5F', desc: 'Retrasa tu ahorro' },
  { value: 'inversiones', label: 'Inversiones', color: '#818CF8', desc: 'Retrasa tu inversión' },
]

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function SobrePage() {
  const [presupuesto, setPresupuesto] = useState(null)
  const [sobreMovs, setSobreMovs] = useState([])
  const [movsMes, setMovsMes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const now = new Date()
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1)
  const [filtroAño, setFiltroAño] = useState(now.getFullYear())
  const [busqueda, setBusqueda] = useState('')

  const [modal, setModal] = useState(false)
  const [modalTraspaso, setModalTraspaso] = useState(false)
  const [modalSobrante, setModalSobrante] = useState(false)
  const [gastoTemp, setGastoTemp] = useState(null)
  const [form, setForm] = useState({ descripcion: '', monto: '' })
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
        supabase.from('sobre_movimientos').select('*').eq('mes', filtroMes).eq('año', filtroAño).order('created_at', { ascending: false }),
        supabase.from('movimientos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
      ])
      setPresupuesto(pres)
      setSobreMovs(sobre || [])
      setMovsMes(movs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── LÓGICA DE SALDOS ──
  const montoEstilo = presupuesto?.montoEstilo || 0
  const montoNecesidades = presupuesto?.montoNecesidades || 0

  const gastadoSobre = movsMes
    .filter(m => m.tipo === 'egreso' && m.categoria === 'deseo')
    .reduce((s, m) => s + m.monto, 0)

  const ajustesSobre = sobreMovs
    .filter(m => m.origen === 'estilo')
    .reduce((s, m) => s + m.monto, 0)

  const saldoSobre = montoEstilo - gastadoSobre - ajustesSobre

  const gastadoBasicos = movsMes.filter(m => m.tipo === 'egreso' && ['basicos', 'deuda'].includes(m.categoria)).reduce((s, m) => s + m.monto, 0)
  const saldoBasicos = montoNecesidades - (sobreMovs.filter(m => m.origen === 'basicos').reduce((s, m) => s + m.monto, 0)) - gastadoBasicos

  const saldoMetas = (presupuesto?.montoMetas || 0) - (sobreMovs.filter(m => m.origen === 'metas').reduce((s, m) => s + m.monto, 0))
  const saldoInversiones = (presupuesto?.montoInversiones || 0) - (sobreMovs.filter(m => m.origen === 'inversiones').reduce((s, m) => s + m.monto, 0))

  function getSaldo(origen) {
    if (origen === 'estilo') return saldoSobre
    if (origen === 'basicos') return saldoBasicos
    if (origen === 'metas') return saldoMetas
    if (origen === 'inversiones') return saldoInversiones
    return 0
  }

  // ── HANDLERS ──
  async function handleGasto(e) {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!monto || !form.descripcion) return

    if (saldoSobre <= 0 || monto > saldoSobre) {
      setGastoTemp({ descripcion: form.descripcion, monto: monto })
      setModal(false)
      setModalTraspaso(true)
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('movimientos')
      .insert([{
        tipo: 'egreso',
        monto: monto,
        descripcion: form.descripcion,
        categoria: 'deseo',
        fecha: new Date().toISOString().slice(0, 10),
        quien: 'Ambos'
      }])

    if (!error) {
      setModal(false)
      setForm({ descripcion: '', monto: '' })
      cargarTodo()
    }
    setSaving(false)
  }

  async function registrarMovSobre({ descripcion, monto, origen }) {
    const { error } = await supabase
      .from('sobre_movimientos')
      .insert([{ 
        descripcion, monto, origen, 
        mes: filtroMes, año: filtroAño, 
        fecha: new Date().toISOString().slice(0, 10) 
      }])
    return !error
  }

  async function confirmarTraspaso() {
    if (!gastoTemp) return
    setSaving(true)
    
    await supabase.from('movimientos').insert([{
      tipo: 'egreso', monto: gastoTemp.monto, descripcion: gastoTemp.descripcion,
      categoria: 'deseo', fecha: new Date().toISOString().slice(0, 10), quien: 'Ambos'
    }])

    await registrarMovSobre({ 
      descripcion: `Traspaso desde ${origenTraspaso}`, 
      monto: -gastoTemp.monto, 
      origen: 'estilo' 
    })

    await registrarMovSobre({ 
      descripcion: `Cubre gasto: ${gastoTemp.descripcion}`, 
      monto: gastoTemp.monto, 
      origen: origenTraspaso 
    })

    setModalTraspaso(false)
    setGastoTemp(null)
    setForm({ descripcion: '', monto: '' })
    cargarTodo()
    setSaving(false)
  }

  async function handleEliminar(id) {
    if(!confirm('¿Eliminar este ajuste?')) return
    const { error } = await supabase.from('sobre_movimientos').delete().eq('id', id)
    if (!error) cargarTodo()
  }

  async function confirmarSobrante() {
    const monto = parseFloat(montoSobrante)
    if (!monto || monto > saldoSobre) return
    setSaving(true)
    await registrarMovSobre({ descripcion: `Traspaso → ${destinoSobrante}`, monto, origen: 'estilo' })
    await registrarMovSobre({ descripcion: `Ingreso desde Sobre Diario`, monto: -monto, origen: destinoSobrante })
    setModalSobrante(false)
    setMontoSobrante('')
    cargarTodo()
    setSaving(false)
  }

  const movsFiltrados = sobreMovs.filter(m =>
    m.descripcion.toLowerCase().includes(busqueda.toLowerCase())
  )

  const pctUsado = montoEstilo > 0 ? Math.min(100, (gastadoSobre / montoEstilo) * 100) : 0
  const sobreVacio = saldoSobre <= 0
  const sobreColor = sobreVacio ? '#C0605A' : saldoSobre < montoEstilo * 0.2 ? '#C17A3A' : '#2D7A5F'
  const esMesActual = filtroMes === now.getMonth() + 1 && filtroAño === now.getFullYear()

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-6 animate-enter">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Módulo</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight leading-tight">Sobre Diario</h1>
          <div className="flex items-center gap-1 mt-1.5">
            <select value={filtroMes} onChange={e => setFiltroMes(Number(e.target.value))}
              className="text-xs font-semibold text-stone-400 bg-transparent outline-none cursor-pointer hover:text-stone-600 transition-colors">
              {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <span className="text-xs text-stone-300">·</span>
            <select value={filtroAño} onChange={e => setFiltroAño(Number(e.target.value))}
              className="text-xs font-semibold text-stone-400 bg-transparent outline-none cursor-pointer hover:text-stone-600 transition-colors">
              {[2025, 2026, 2027].map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <button onClick={() => setModal(true)}
          className="ff-btn-primary flex items-center justify-center gap-2 active:scale-95 transition-transform"
          style={{ padding: '12px 20px', borderRadius: '14px' }}>
          <Plus size={20} strokeWidth={3} color="white" />
          <span className="hidden sm:inline text-sm font-bold text-white">Registrar gasto</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin text-stone-400" />
          <span className="text-sm text-stone-400">Cargando...</span>
        </div>
      ) : (
        <>
          <Card className="mb-5 animate-enter">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Disponible en el Sobre
              </p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${sobreColor}15` }}>
                <Wallet size={15} style={{ color: sobreColor }} />
              </div>
            </div>

            {montoEstilo === 0 ? (
              <p className="text-2xl font-black mb-1 text-stone-400">€0,00</p>
            ) : (
              <>
                <p className="text-3xl font-black tracking-tight mb-0.5" style={{ color: sobreColor }}>
                  {formatCurrency(Math.max(0, saldoSobre))}
                </p>
                <p className="text-xs mb-3 text-stone-400">
                  de {formatCurrency(montoEstilo)} de Estilo de vida
                </p>

                <div className="w-full h-2 rounded-full mb-2" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pctUsado}%`, background: sobreColor }} />
                </div>
                <div className="flex justify-between text-[10px] font-semibold mb-3 text-stone-400">
                  <span>Gastado Real: {formatCurrency(gastadoSobre)}</span>
                  <span>{Math.round(pctUsado)}% del presupuesto</span>
                </div>

                {sobreVacio && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 bg-red-50 border border-red-100">
                    <AlertTriangle size={13} className="text-red-500" />
                    <p className="text-xs font-bold text-red-500">Sobre vacío — usarás fondos de reserva</p>
                  </div>
                )}

                {!sobreVacio && esMesActual && (
                  <button onClick={() => setModalSobrante(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: 'rgba(45,122,95,0.08)', color: '#2D7A5F', border: '1px dashed rgba(45,122,95,0.3)' }}>
                    <Sprout size={13} /> Enviar sobrante a Ahorro/Inversión
                  </button>
                )}
              </>
            )}
          </Card>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Básicos', saldo: saldoBasicos, color: '#4A6FA5' },
              { label: 'Metas', saldo: saldoMetas, color: '#2D7A5F' },
              { label: 'Inversión', saldo: saldoInversiones, color: '#818CF8' },
            ].map((b, i) => (
              <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1 text-stone-400">{b.label}</p>
                <p className="text-sm font-black" style={{ color: b.saldo < 0 ? '#C0605A' : b.color }}>
                  {formatCurrency(b.saldo)}
                </p>
              </div>
            ))}
          </div>

          <div className="relative w-full mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input className="ff-input w-full h-11 pl-12" placeholder="Buscar ajustes..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>

          <Card>
            <h3 className="font-bold text-stone-800 mb-4 text-sm">Ajustes y Traspasos Internos</h3>
            {movsFiltrados.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-8 italic">Sin ajustes manuales este mes</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {movsFiltrados.map(m => {
                  const esEntrada = m.monto < 0
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-3 group">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${esEntrada ? 'bg-green-50' : 'bg-stone-50'}`}>
                        {esEntrada ? <TrendingUp size={14} className="text-green-600" /> : <ArrowRight size={14} className="text-stone-400" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-stone-800">{m.descripcion}</p>
                        <p className="text-[10px] text-stone-400 uppercase font-bold">{m.origen}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className={`text-sm font-black ${esEntrada ? 'text-green-600' : 'text-stone-600'}`}>
                          {esEntrada ? '+' : '-'}{formatCurrency(Math.abs(m.monto))}
                        </p>
                        <button onClick={() => handleEliminar(m.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {/* MODAL GASTO */}
      <Modal open={modal} onClose={() => setModal(false)} title="Registrar gasto">
        <form onSubmit={handleGasto} className="space-y-4">
          <div>
            <label className="ff-label">Descripción</label>
            <input className="ff-input" placeholder="Ej: Cena fuera" required
              value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <label className="ff-label">Monto (€)</label>
            <input className="ff-input" type="number" step="0.01" required
              value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="ff-btn-primary w-full py-3">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Confirmar Gasto'}
          </button>
        </form>
      </Modal>

      {/* MODAL TRASPASO (Cuando no hay saldo) */}
      <Modal open={modalTraspaso} onClose={() => setModalTraspaso(false)} title="Sobre insuficiente">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-700 text-xs font-bold">
            El sobre no tiene suficiente dinero. ¿De dónde quieres cubrir los {formatCurrency(gastoTemp?.monto || 0)}?
          </div>
          <div className="space-y-2">
            {ORIGENES.filter(o => o.value !== 'estilo').map(o => (
              <button key={o.value} onClick={() => setOrigenTraspaso(o.value)}
                className={`w-full p-3 rounded-xl border text-left transition-all ${origenTraspaso === o.value ? 'border-stone-800 bg-stone-50' : 'border-transparent bg-stone-50/50'}`}>
                <p className="text-xs font-bold" style={{ color: o.color }}>{o.label}</p>
                <p className="text-sm font-black">{formatCurrency(getSaldo(o.value))}</p>
              </button>
            ))}
          </div>
          <button onClick={confirmarTraspaso} disabled={saving} className="ff-btn-primary w-full py-3">
            {saving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Confirmar y Traspasar'}
          </button>
        </div>
      </Modal>

      {/* MODAL SOBRANTE */}
      <Modal open={modalSobrante} onClose={() => setModalSobrante(false)} title="Enviar sobrante">
        <div className="space-y-4">
          <input className="ff-input" type="number" placeholder="Monto a enviar"
            value={montoSobrante} onChange={e => setMontoSobrante(e.target.value)} />
          <div className="flex gap-2">
            {['metas', 'inversiones'].map(d => (
              <button key={d} onClick={() => setDestinoSobrante(d)}
                className={`flex-1 py-3 rounded-xl border text-xs font-bold ${destinoSobrante === d ? 'border-stone-800 bg-stone-100' : 'border-stone-100'}`}>
                {d.toUpperCase()}
              </button>
            ))}
          </div>
          <button onClick={confirmarSobrante} className="ff-btn-primary w-full">Enviar fondos</button>
        </div>
      </Modal>
    </AppShell>
  )
}