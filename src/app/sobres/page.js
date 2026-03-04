'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Wallet, Plus, ArrowRight, Loader2, Trash2,
  AlertTriangle, TrendingUp, Sprout, Search, X
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import Modal from '@/components/ui/Modal'

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
      setPresupuesto(pres)
      console.log('PRESUPUESTO:', pres)
      console.log('montoEstilo:', pres?.montoEstilo)
      console.log('montoNecesidades:', pres?.montoNecesidades)
      setSobreMovs(sobre || [])
      setMovsMes(movs || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // ── SALDOS ────────────────────────────────────────────────────────────────
  const montoEstilo = presupuesto?.montoEstilo || 0
  const montoNecesidades = presupuesto?.montoNecesidades || 0

  const gastadoSobre = sobreMovs.filter(m => m.origen === 'estilo' && m.monto > 0).reduce((s, m) => s + m.monto, 0)
  const sobreEntradas = sobreMovs.filter(m => m.origen === 'estilo' && m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0)
  const saldoSobre = montoEstilo - gastadoSobre + sobreEntradas

  const gastadoBasicos = movsMes.filter(m => m.tipo === 'egreso' && ['basicos', 'deuda'].includes(m.categoria)).reduce((s, m) => s + m.monto, 0)
  const saldoBasicos = montoNecesidades - gastadoBasicos

  const traspasosMetas = sobreMovs.filter(m => m.origen === 'metas' && m.monto > 0).reduce((s, m) => s + m.monto, 0)
  const entradasMetas = sobreMovs.filter(m => m.origen === 'metas' && m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0)
  const saldoMetas = (presupuesto?.montoMetas || 0) - traspasosMetas + entradasMetas

  const traspasosInv = sobreMovs.filter(m => m.origen === 'inversiones' && m.monto > 0).reduce((s, m) => s + m.monto, 0)
  const entradasInv = sobreMovs.filter(m => m.origen === 'inversiones' && m.monto < 0).reduce((s, m) => s + Math.abs(m.monto), 0)
  const saldoInversiones = (presupuesto?.montoInversiones || 0) - traspasosInv + entradasInv

  function getSaldo(origen) {
    if (origen === 'estilo') return saldoSobre
    if (origen === 'basicos') return saldoBasicos
    if (origen === 'metas') return saldoMetas
    if (origen === 'inversiones') return saldoInversiones
    return 0
  }

  // ── HANDLERS ──────────────────────────────────────────────────────────────
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
      .insert([{ descripcion, monto, origen, mes: filtroMes, año: filtroAño, fecha: new Date().toISOString().slice(0, 10) }])
      .select()
    if (!error && data) setSobreMovs(prev => [data[0], ...prev])
    setSaving(false)
  }

  async function confirmarTraspaso() {
    if (!gastoTemp) return
    if (getSaldo(origenTraspaso) < gastoTemp.monto) return
    await registrarMovSobre({ descripcion: gastoTemp.descripcion, monto: gastoTemp.monto, origen: origenTraspaso })
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
    await registrarMovSobre({ descripcion: `Traspaso → ${destinoSobrante}`, monto, origen: 'estilo' })
    await registrarMovSobre({ descripcion: `Ingreso desde Sobre Diario`, monto: -monto, origen: destinoSobrante })
    setModalSobrante(false)
    setMontoSobrante('')
    setSaving(false)
    cargarTodo()
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
      {/* ── HEADER ── */}
      <div className="flex items-start justify-between mb-6 animate-enter">
        <div>
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Módulo</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight leading-tight">Sobre Diario</h1>
          {/* Selector mes/año sutil debajo del título */}
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
        {/* Botón esquina — igual al resto de módulos */}
        <button onClick={() => setModal(true)}
          className="ff-btn-primary flex items-center justify-center gap-2 active:scale-95 transition-transform flex-shrink-0"
          style={{ padding: '14px 20px', minWidth: '48px', minHeight: '48px', borderRadius: '14px' }}>
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
          {/* ── CARD PRINCIPAL ── */}
          <Card className="mb-5 animate-enter">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Disponible en el Sobre
              </p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${sobreColor}15` }}>
                <Wallet size={15} style={{ color: sobreColor }} />
              </div>
            </div>

            {montoEstilo === 0 ? (
              <>
                <p className="text-2xl font-black mb-1" style={{ color: 'var(--text-muted)' }}>€0,00</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Agrega un ingreso para ver tu sobre disponible
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-black tracking-tight mb-0.5" style={{ color: sobreColor }}>
                  {formatCurrency(Math.max(0, saldoSobre))}
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  de {formatCurrency(montoEstilo)} de Estilo de vida
                </p>

                <div className="w-full h-2 rounded-full mb-2" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pctUsado}%`, background: sobreColor }} />
                </div>
                <div className="flex justify-between text-[10px] font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
                  <span>Gastado: {formatCurrency(gastadoSobre)}</span>
                  <span>{Math.round(pctUsado)}% usado</span>
                </div>

                {sobreVacio && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                    style={{ background: 'rgba(192,96,90,0.08)', border: '1px solid rgba(192,96,90,0.2)' }}>
                    <AlertTriangle size={13} style={{ color: '#C0605A' }} />
                    <p className="text-xs font-bold" style={{ color: '#C0605A' }}>
                      Sobre vacío — los próximos gastos saldrán de otra categoría
                    </p>
                  </div>
                )}

                {!sobreVacio && esMesActual && (
                  <button onClick={() => setModalSobrante(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={{ background: 'rgba(45,122,95,0.08)', color: '#2D7A5F', border: '1px dashed rgba(45,122,95,0.3)' }}>
                    <Sprout size={13} /> Enviar sobrante a Metas o Inversiones
                  </button>
                )}
              </>
            )}
          </Card>

          {/* ── SALDOS SECUNDARIOS ── */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Básicos', saldo: saldoBasicos, color: '#4A6FA5' },
              { label: 'Metas', saldo: saldoMetas, color: '#2D7A5F' },
              { label: 'Inversión', saldo: saldoInversiones, color: '#818CF8' },
            ].map((b, i) => (
              <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
                <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>{b.label}</p>
                <p className="text-sm font-black" style={{ color: b.saldo < 0 ? '#C0605A' : b.color }}>
                  {formatCurrency(b.saldo)}
                </p>
                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>disponible</p>
              </div>
            ))}
          </div>

          {/* ── BUSCADOR ── */}
          <div className="relative w-full mb-4">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" style={{ zIndex: 10 }} />
            <input className="ff-input w-full h-11" style={{ paddingLeft: '3rem' }}
              placeholder="Buscar en el historial..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            {busqueda && (
              <button onClick={() => setBusqueda('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* ── HISTORIAL ── */}
          <Card>
            <h3 className="font-bold text-stone-800 mb-4 text-sm">
              Historial — {MESES[filtroMes - 1]} {filtroAño}
            </h3>
            {movsFiltrados.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-8 italic">Sin movimientos registrados</p>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                {movsFiltrados.map(m => {
                  const esEntrada = m.monto < 0
                  const origen = ORIGENES.find(o => o.value === m.origen)
                  const color = origen?.color || '#94a3b8'
                  return (
                    <div key={m.id}
                      className="flex items-center gap-3 py-3 px-2 group transition-all hover:bg-stone-50 rounded-xl">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}15` }}>
                        {esEntrada
                          ? <TrendingUp size={14} style={{ color }} />
                          : <Wallet size={14} style={{ color }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-stone-800 truncate">{m.descripcion}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {m.origen !== 'estilo' && !esEntrada && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase"
                              style={{ background: `${color}15`, color }}>
                              cubierto con {origen?.label}
                            </span>
                          )}
                          {m.origen === 'estilo' && !esEntrada && (
                            <span className="text-[9px] text-stone-400">Sobre diario</span>
                          )}
                          {esEntrada && (
                            <span className="text-[9px] font-bold" style={{ color }}>
                              → {origen?.label}
                            </span>
                          )}
                          <span className="text-[9px] text-stone-300">
                            {new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black" style={{ color: esEntrada ? '#2D7A5F' : '#C0605A' }}>
                          {esEntrada ? '+' : '-'}{formatCurrency(Math.abs(m.monto))}
                        </p>
                        <button onClick={() => handleEliminar(m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          style={{ color: '#C0605A' }}>
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

      {/* ── MODAL: REGISTRAR GASTO ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Registrar gasto del Sobre">
        <form onSubmit={handleGasto} className="space-y-4">
          <div>
            <label className="ff-label">¿En qué gastaste?</label>
            <input className="ff-input" placeholder="Café, ropa, salida..." required
              value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <label className="ff-label">Monto (€)</label>
            <input className="ff-input" type="number" step="0.01" min="0.01" placeholder="0.00" required
              value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
            {form.monto && parseFloat(form.monto) > saldoSobre && saldoSobre > 0 && (
              <p className="text-xs mt-1 font-semibold" style={{ color: '#f59e0b' }}>
                ⚠ Solo tienes {formatCurrency(saldoSobre)} en el sobre
              </p>
            )}
            {sobreVacio && (
              <p className="text-xs mt-1 font-semibold" style={{ color: '#C0605A' }}>
                El sobre está vacío — elegirás de dónde sacar el dinero
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">
              {parseFloat(form.monto || 0) > saldoSobre ? 'Continuar →' : 'Confirmar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: TRASPASO ── */}
      <Modal open={modalTraspaso} onClose={() => setModalTraspaso(false)} title="Sobre vacío — ¿De dónde sacas el dinero?">
        <div className="space-y-4">
          {gastoTemp && (
            <div className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'rgba(192,96,90,0.08)', border: '1px solid rgba(192,96,90,0.2)', color: '#C0605A' }}>
              Necesitas {formatCurrency(gastoTemp.monto)} para "{gastoTemp.descripcion}"
            </div>
          )}
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            Selecciona de dónde saldrá el dinero
          </p>
          <div className="space-y-2">
            {ORIGENES.filter(o => o.value !== 'estilo').map(o => {
              const saldo = getSaldo(o.value)
              const sinSaldo = gastoTemp && saldo < gastoTemp.monto
              return (
                <button key={o.value}
                  onClick={() => !sinSaldo && setOrigenTraspaso(o.value)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-left"
                  style={{
                    background: origenTraspaso === o.value ? `${o.color}12` : 'var(--bg-secondary)',
                    border: `1px solid ${origenTraspaso === o.value ? o.color + '40' : 'transparent'}`,
                    opacity: sinSaldo ? 0.4 : 1,
                    cursor: sinSaldo ? 'not-allowed' : 'pointer'
                  }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: o.color }}>{o.label}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: sinSaldo ? '#C0605A' : o.color }}>
                      {formatCurrency(saldo)}
                    </p>
                    <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>disponible</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setModalTraspaso(false); setGastoTemp(null) }}
              className="ff-btn-ghost flex-1">Cancelar</button>
            <button onClick={confirmarTraspaso} disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              Confirmar traspaso
            </button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: SOBRANTE ── */}
      <Modal open={modalSobrante} onClose={() => setModalSobrante(false)} title="Enviar sobrante">
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-xl"
            style={{ background: 'rgba(45,122,95,0.08)', border: '1px solid rgba(45,122,95,0.2)' }}>
            <p className="text-xs font-bold" style={{ color: '#2D7A5F' }}>
              Tienes {formatCurrency(saldoSobre)} sin usar en el Sobre
            </p>
          </div>
          <div>
            <label className="ff-label">¿Cuánto quieres enviar?</label>
            <input className="ff-input" type="number" step="0.01" min="0.01" max={saldoSobre} placeholder="0.00"
              value={montoSobrante} onChange={e => setMontoSobrante(e.target.value)} />
          </div>
          <div>
            <label className="ff-label">¿A dónde va?</label>
            <div className="space-y-2 mt-1">
              {[
                { value: 'metas', label: 'Metas de Ahorro', color: '#2D7A5F' },
                { value: 'inversiones', label: 'Inversiones', color: '#818CF8' },
              ].map(d => (
                <button key={d.value} onClick={() => setDestinoSobrante(d.value)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: destinoSobrante === d.value ? `${d.color}12` : 'var(--bg-secondary)',
                    border: `1px solid ${destinoSobrante === d.value ? d.color + '40' : 'transparent'}`,
                    cursor: 'pointer'
                  }}>
                  <p className="text-sm font-bold" style={{ color: d.color }}>{d.label}</p>
                  <ArrowRight size={14} style={{ color: d.color }} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalSobrante(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button onClick={confirmarSobrante} disabled={saving || !montoSobrante}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2"
              style={{ opacity: montoSobrante ? 1 : 0.5 }}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              Enviar sobrante
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}