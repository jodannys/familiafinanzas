'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Wallet, Plus, ArrowRight, Loader2, Trash2, AlertTriangle, TrendingUp, Sprout } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import Modal from '@/components/ui/Modal'

const ORIGENES = [
  { value: 'estilo',      label: 'Estilo de vida',  color: '#C17A3A', desc: 'Tu sobre diario' },
  { value: 'basicos',     label: 'Gastos Básicos',  color: '#4A6FA5', desc: 'Súper, facturas...' },
  { value: 'metas',       label: 'Metas de Ahorro', color: '#10b981', desc: 'Retrasa tu ahorro' },
  { value: 'inversiones', label: 'Inversiones',     color: '#818CF8', desc: 'Retrasa tu inversión' },
]

const ORIGEN_COLOR = {
  estilo: '#C17A3A', basicos: '#4A6FA5', metas: '#10b981', inversiones: '#818CF8'
}

export default function SobrePage() {
  const [presupuesto, setPresupuesto] = useState(null)
  const [sobreMovs, setSobreMovs]     = useState([])
  const [movsMes, setMovsMes]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [modal, setModal]             = useState(false)      // modal gasto
  const [modalTraspaso, setModalTraspaso] = useState(false)  // modal saldo vacío
  const [modalSobrante, setModalSobrante] = useState(false)  // modal enviar sobrante
  const [gastoTemp, setGastoTemp]     = useState(null)       // gasto pendiente si sobre=0
  const [saving, setSaving]           = useState(false)
  const [form, setForm]               = useState({ descripcion: '', monto: '' })
  const [origenTraspaso, setOrigenTraspaso] = useState('basicos')
  const [destinoSobrante, setDestinoSobrante] = useState('metas')
  const [montoSobrante, setMontoSobrante] = useState('')

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()
  const fechaInicio = `${año}-${String(mes).padStart(2,'0')}-01`
  const fechaFin    = `${año}-${String(mes).padStart(2,'0')}-31`

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const [pres, { data: sobre }, { data: movs }] = await Promise.all([
      getPresupuestoMes(),
      supabase.from('sobre_movimientos').select('*').eq('mes', mes).eq('año', año).order('created_at', { ascending: false }),
      supabase.from('movimientos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
    ])
    setPresupuesto(pres)
    setSobreMovs(sobre || [])
    setMovsMes(movs || [])
    setLoading(false)
  }

  // ─── SALDOS DISPONIBLES ───────────────────────────────────────────────────

  // Estilo: presupuesto estilo − gastos del sobre este mes
  const gastadoSobre = sobreMovs.filter(m => m.origen === 'estilo').reduce((s,m) => s + m.monto, 0)
  const presupuestoEstilo = presupuesto ? presupuesto.ingresoReal * ((presupuesto.pctFuturo === 30 ? 20 : 20) / 100) : 0

  // Calculamos el monto de estilo directamente
  const pctEstilo = presupuesto ? (100 - (presupuesto.pctFuturo || 30) - 50) : 20
  const montoEstilo = presupuesto ? presupuesto.ingresoReal * (pctEstilo / 100) : 0
  const saldoSobre = montoEstilo - gastadoSobre

  // Básicos: presupuesto básicos − egresos reales en basicos/deuda
  const pctBasicos = presupuesto ? (presupuesto.ingresoReal > 0 ? 50 : 50) : 50
  const montoBasicos = presupuesto ? presupuesto.ingresoReal * 0.50 : 0
  const gastadoBasicos = movsMes.filter(m => m.tipo === 'egreso' && ['basicos','deuda'].includes(m.categoria)).reduce((s,m) => s+m.monto, 0)
  const saldoBasicos = montoBasicos - gastadoBasicos

  // Metas: montoMetas − traspasos ya hechos desde sobre hacia metas
  const traspasosMetas = sobreMovs.filter(m => m.origen === 'metas').reduce((s,m) => s+m.monto, 0)
  const saldoMetas = presupuesto ? presupuesto.montoMetas - traspasosMetas : 0

  // Inversiones
  const traspasosInv = sobreMovs.filter(m => m.origen === 'inversiones').reduce((s,m) => s+m.monto, 0)
  const saldoInversiones = presupuesto ? presupuesto.montoInversiones - traspasosInv : 0

  function getSaldo(origen) {
    if (origen === 'estilo')      return saldoSobre
    if (origen === 'basicos')     return saldoBasicos
    if (origen === 'metas')       return saldoMetas
    if (origen === 'inversiones') return saldoInversiones
    return 0
  }

  // ─── REGISTRAR GASTO ─────────────────────────────────────────────────────

  async function handleGasto(e) {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!monto || !form.descripcion) return

    // Si el sobre tiene saldo suficiente → gasto directo de estilo
    if (saldoSobre >= monto) {
      await registrarMovSobre({ descripcion: form.descripcion, monto, origen: 'estilo' })
      setModal(false)
      setForm({ descripcion: '', monto: '' })
    } else {
      // Sobre vacío → guardar gasto pendiente y mostrar modal de traspaso
      setGastoTemp({ descripcion: form.descripcion, monto })
      setModal(false)
      setModalTraspaso(true)
    }
  }

  async function confirmarTraspaso() {
    if (!gastoTemp) return
    const saldoOrigen = getSaldo(origenTraspaso)
    if (saldoOrigen < gastoTemp.monto) return // no hay saldo
    setSaving(true)
    await registrarMovSobre({ descripcion: gastoTemp.descripcion, monto: gastoTemp.monto, origen: origenTraspaso })
    setModalTraspaso(false)
    setGastoTemp(null)
    setForm({ descripcion: '', monto: '' })
    setSaving(false)
  }

  async function registrarMovSobre({ descripcion, monto, origen }) {
    const { data, error } = await supabase
      .from('sobre_movimientos')
      .insert([{ descripcion, monto, origen, mes, año, fecha: new Date().toISOString().slice(0,10) }])
      .select()
    if (!error && data) setSobreMovs(prev => [data[0], ...prev])
  }

  async function handleEliminar(id) {
    const { error } = await supabase.from('sobre_movimientos').delete().eq('id', id)
    if (!error) setSobreMovs(prev => prev.filter(m => m.id !== id))
  }

  // ─── ENVIAR SOBRANTE ─────────────────────────────────────────────────────

  async function confirmarSobrante() {
    const monto = parseFloat(montoSobrante)
    if (!monto || monto > saldoSobre) return
    setSaving(true)
    // Registrar como salida del sobre hacia el destino (monto negativo del sobre, anotado como traspaso)
    await supabase.from('sobre_movimientos').insert([{
      descripcion: `Traspaso a ${destinoSobrante}`,
      monto,
      origen: 'estilo',
      mes, año,
      fecha: new Date().toISOString().slice(0,10)
    }])
    // Y registrar la entrada en el destino como crédito (monto negativo = suma)
    await supabase.from('sobre_movimientos').insert([{
      descripcion: `Ingreso desde Sobre Diario`,
      monto: -monto,  // negativo = suma al saldo del destino
      origen: destinoSobrante,
      mes, año,
      fecha: new Date().toISOString().slice(0,10)
    }])
    await cargarTodo()
    setModalSobrante(false)
    setMontoSobrante('')
    setSaving(false)
  }

  // ─── UI ──────────────────────────────────────────────────────────────────

  const pctUsado = montoEstilo > 0 ? Math.min(100, (gastadoSobre / montoEstilo) * 100) : 0
  const sobreColor = saldoSobre <= 0 ? '#C0605A' : saldoSobre < montoEstilo * 0.2 ? '#f59e0b' : '#C17A3A'

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-2xl font-bold text-stone-800" style={{ letterSpacing:'-0.03em' }}>Sobre Diario</h1>
          <p className="text-xs text-stone-400 mt-1">{now.toLocaleString('es-ES',{month:'long', year:'numeric'})}</p>
        </div>
        <button onClick={() => setModal(true)}
          className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Registrar gasto
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={20} className="animate-spin text-stone-400" />
          <span className="text-sm text-stone-400">Cargando...</span>
        </div>
      ) : (
        <>
          {/* Saldo principal */}
          <Card className="mb-6 animate-enter">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color:'var(--text-muted)' }}>
                  Disponible en el Sobre
                </p>
                <p className="text-4xl font-black" style={{ color: sobreColor, letterSpacing:'-0.04em' }}>
                  {formatCurrency(Math.max(0, saldoSobre))}
                </p>
                {saldoSobre <= 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle size={12} style={{ color:'#C0605A' }} />
                    <p className="text-xs font-bold" style={{ color:'#C0605A' }}>Sobre vacío</p>
                  </div>
                )}
              </div>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background:`${sobreColor}15` }}>
                <Wallet size={22} style={{ color:sobreColor }} />
              </div>
            </div>

            {/* Barra de uso */}
            <div className="w-full h-3 rounded-full mb-2" style={{ background:'var(--progress-track)' }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width:`${pctUsado}%`, background: sobreColor }} />
            </div>
            <div className="flex justify-between text-xs" style={{ color:'var(--text-muted)' }}>
              <span>Gastado: {formatCurrency(gastadoSobre)}</span>
              <span>Total: {formatCurrency(montoEstilo)}</span>
            </div>

            {/* Botón enviar sobrante */}
            {saldoSobre > 0 && (
              <button onClick={() => setModalSobrante(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background:'rgba(45,122,95,0.08)', color:'#2D7A5F', border:'1px dashed rgba(45,122,95,0.3)' }}>
                <Sprout size={13} /> Enviar sobrante a Metas o Inversiones
              </button>
            )}
          </Card>

          {/* Saldos disponibles por bloque */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label:'Básicos', saldo: saldoBasicos, color:'#4A6FA5' },
              { label:'Metas',   saldo: saldoMetas,   color:'#10b981' },
              { label:'Inversión', saldo: saldoInversiones, color:'#818CF8' },
            ].map((b,i) => (
              <div key={i} className="glass-card p-3 relative animate-enter" style={{ animationDelay:`${i*0.05}s` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color:'var(--text-muted)' }}>{b.label}</p>
                <p className="text-sm font-black" style={{ color: b.saldo <= 0 ? '#C0605A' : b.color }}>
                  {formatCurrency(Math.max(0, b.saldo))}
                </p>
                <p className="text-[10px]" style={{ color:'var(--text-muted)' }}>disponible</p>
              </div>
            ))}
          </div>

          {/* Historial */}
          <Card>
            <h3 className="font-bold text-stone-800 mb-4">Historial del mes</h3>
            {sobreMovs.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-8 italic">Sin movimientos aún</p>
            ) : (
              <div className="space-y-2">
                {sobreMovs.map(m => {
                  const esTraspaso = m.monto < 0
                  const color = ORIGEN_COLOR[m.origen] || '#94a3b8'
                  return (
                    <div key={m.id}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl group transition-all"
                      style={{ background:'var(--bg-secondary)' }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background:`${color}18` }}>
                        {esTraspaso
                          ? <TrendingUp size={14} style={{ color }} />
                          : <Wallet size={14} style={{ color }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-stone-800 truncate">{m.descripcion}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {m.origen !== 'estilo' && !esTraspaso && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background:`${color}18`, color }}>
                              cubierto con {ORIGENES.find(o=>o.value===m.origen)?.label}
                            </span>
                          )}
                          {m.origen === 'estilo' && !esTraspaso && (
                            <span className="text-[10px]" style={{ color:'var(--text-muted)' }}>Sobre diario</span>
                          )}
                          {esTraspaso && (
                            <span className="text-[10px] font-bold" style={{ color }}>
                              → {ORIGENES.find(o=>o.value===m.origen)?.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black" style={{ color: esTraspaso ? '#2D7A5F' : '#C0605A' }}>
                          {esTraspaso ? '+' : '-'}{formatCurrency(Math.abs(m.monto))}
                        </p>
                        <button onClick={() => handleEliminar(m.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                          style={{ color:'#C0605A' }}>
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

      {/* Modal: Registrar gasto */}
      <Modal open={modal} onClose={() => setModal(false)} title="Registrar gasto del Sobre">
        <form onSubmit={handleGasto} className="space-y-4">
          <div>
            <label className="ff-label">¿En qué gastaste?</label>
            <input className="ff-input" placeholder="Ej: Café, Ropa, Salida..." required
              value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} />
          </div>
          <div>
            <label className="ff-label">Monto (€)</label>
            <input className="ff-input" type="number" step="0.01" min="0.01" placeholder="0.00" required
              value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} />
            {form.monto && saldoSobre < parseFloat(form.monto) && saldoSobre > 0 && (
              <p className="text-xs mt-1 font-semibold" style={{ color:'#f59e0b' }}>
                ⚠ Solo tienes {formatCurrency(saldoSobre)} en el sobre
              </p>
            )}
            {saldoSobre <= 0 && (
              <p className="text-xs mt-1 font-semibold" style={{ color:'#C0605A' }}>
                Tu sobre está vacío — te pediremos de dónde sacar el dinero
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">
              {saldoSobre <= 0 || (form.monto && saldoSobre < parseFloat(form.monto))
                ? 'Continuar →' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Sobre vacío — elegir origen */}
      <Modal open={modalTraspaso} onClose={() => setModalTraspaso(false)} title="Sobre vacío — ¿De dónde sacas el dinero?">
        <div className="space-y-4">
          {gastoTemp && (
            <div className="px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background:'rgba(192,96,90,0.08)', border:'1px solid rgba(192,96,90,0.2)', color:'#C0605A' }}>
              Necesitas {formatCurrency(gastoTemp.monto)} para "{gastoTemp.descripcion}"
            </div>
          )}

          <p className="text-xs font-bold uppercase tracking-wider" style={{ color:'var(--text-muted)' }}>
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
                    border: `1px solid ${origenTraspaso === o.value ? o.color+'40' : 'transparent'}`,
                    opacity: sinSaldo ? 0.4 : 1,
                    cursor: sinSaldo ? 'not-allowed' : 'pointer'
                  }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: o.color }}>{o.label}</p>
                    <p className="text-xs" style={{ color:'var(--text-muted)' }}>{o.desc}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: sinSaldo ? '#C0605A' : o.color }}>
                      {formatCurrency(saldo)}
                    </p>
                    <p className="text-[10px]" style={{ color:'var(--text-muted)' }}>disponible</p>
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

      {/* Modal: Enviar sobrante */}
      <Modal open={modalSobrante} onClose={() => setModalSobrante(false)} title="Enviar sobrante del Sobre">
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-xl"
            style={{ background:'rgba(45,122,95,0.08)', border:'1px solid rgba(45,122,95,0.2)' }}>
            <p className="text-xs font-bold" style={{ color:'#2D7A5F' }}>
              Tienes {formatCurrency(saldoSobre)} disponibles en el Sobre
            </p>
          </div>

          <div>
            <label className="ff-label">¿Cuánto quieres enviar?</label>
            <input className="ff-input" type="number" step="0.01" min="0.01"
              max={saldoSobre} placeholder="0.00"
              value={montoSobrante} onChange={e => setMontoSobrante(e.target.value)} />
          </div>

          <div>
            <label className="ff-label">¿A dónde va?</label>
            <div className="space-y-2 mt-1">
              {[
                { value:'metas',       label:'Metas de Ahorro', color:'#10b981' },
                { value:'inversiones', label:'Inversiones',     color:'#818CF8' },
              ].map(d => (
                <button key={d.value} onClick={() => setDestinoSobrante(d.value)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: destinoSobrante === d.value ? `${d.color}12` : 'var(--bg-secondary)',
                    border: `1px solid ${destinoSobrante === d.value ? d.color+'40' : 'transparent'}`,
                    cursor:'pointer'
                  }}>
                  <p className="text-sm font-bold" style={{ color:d.color }}>{d.label}</p>
                  <ArrowRight size={14} style={{ color:d.color }} />
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