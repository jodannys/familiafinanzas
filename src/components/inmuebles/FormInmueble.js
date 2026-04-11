'use client'
import { useState } from 'react'
import { Home, TrendingUp, Calculator, ChevronDown, ChevronUp, AlertTriangle, ShieldCheck } from 'lucide-react'
import {
  toCents, fromCents,
  calcularCuotaHipoteca,
  calcularInversionTotal,
  calcularGastosCompraLegales,
  calcularAvalICO,
  calcularFinanciacionDual,
  calcularGastosInaplazables,
  calcularComisionAgente,
  ITP_POR_CCAA,
} from '@/lib/inmuebles'
import { formatCurrency } from '@/lib/utils'
import CustomSelect from '@/components/ui/CustomSelect'

// ── Opciones para CustomSelect ────────────────────────────────────────────────

const CCAA_OPTIONS = Object.entries(ITP_POR_CCAA).map(([nombre, pct]) => ({
  id: nombre,
  label: nombre,
  sub: `${pct}%`,
}))

const TIPO_TRANSMISION_OPTIONS = [
  { id: 'segunda_mano', label: 'Segunda mano', sub: 'ITP' },
  { id: 'obra_nueva',   label: 'Obra nueva',   sub: 'IVA 10%' },
  { id: 'vpo',          label: 'VPO',           sub: 'IVA 4%' },
]

const MESES_OCUPADOS_OPTIONS = [
  { id: '12', label: '12 meses', sub: 'sin vacancia' },
  { id: '11', label: '11 meses', sub: '1 mes vacío' },
  { id: '10', label: '10 meses', sub: '2 meses vacíos' },
  { id: '9',  label: '9 meses',  sub: '3 meses vacíos' },
]

const MODOS_FINANCIACION = [
  {
    id: 'ninguna',
    label: 'Sin financiación especial',
    desc: 'Hipoteca estándar — precio menos entrada propia',
  },
  {
    id: 'aval_ico',
    label: 'Aval ICO — Garantía del Estado',
    desc: '1 sola deuda al 100% LTV · mismo tipo de mercado · el Estado avala el exceso de LTV',
  },
  {
    id: 'dual',
    label: 'Financiación Dual — Préstamo Público 0%',
    desc: '2 deudas separadas: banco 80% tipo mercado + crédito público 20% al 0%',
  },
]

export default function FormInmueble({ inmueble = null, metas = [], inmuebles = [], onSave, onClose }) {
  const esEdicion = !!inmueble

  // ── Estado del formulario ──
  const [nombre,  setNombre]  = useState(inmueble?.nombre || '')
  const [tipo,    setTipo]    = useState(inmueble?.tipo   || 'vivienda_habitual')
  const [notas,   setNotas]   = useState(inmueble?.notas  || '')

  // Datos compra — vacíos al crear, valores guardados al editar
  const dc = inmueble?.datos_compra || {}
  const [precio,       setPrecio]      = useState(esEdicion ? (dc.precio    ?? '') : '')
  const [reforma,      setReforma]     = useState(esEdicion ? (dc.reforma   ?? '') : '')
  const [aportacion,   setAportacion]  = useState(esEdicion ? (dc.aportacion_inicial ?? '') : '')
  const [entradaModo,  setEntradaModo] = useState('eur') // 'eur' | 'pct'
  const [tasacion,  setTasacion]  = useState(dc.tasacion || 450)

  // Gastos de compra — cálculo automático
  const [ccaa,           setCcaa]           = useState(dc.ccaa           || 'Madrid')
  const [tipoTransmision,setTipoTransmision]= useState(dc.tipo_transmision || 'segunda_mano')
  const [incluirBroker,  setIncluirBroker]  = useState(false)
  const [incluirTasacion,setIncluirTasacion]= useState(true)
  const [desglosAbierto, setDesglosAbierto] = useState(false)
  // ITP manual (reducción por edad, familia numerosa, discapacidad, etc.)
  const [itpManual,    setItpManual]    = useState(dc.itp_pct_manual != null)
  const [itpPctManual, setItpPctManual] = useState(dc.itp_pct_manual ?? '')

  // Hipoteca
  const hip = inmueble?.hipoteca || {}
  const [interesAnual, setInteresAnual] = useState(hip.interes_anual ?? 3)
  const [plazoAños,    setPlazoAños]    = useState(hip.plazo_meses ? hip.plazo_meses / 12 : 30)
  const [fechaInicio,  setFechaInicio]  = useState(() => {
    if (hip.fecha_inicio) return hip.fecha_inicio
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  // Alquiler — vacíos al crear
  const al = inmueble?.alquiler_config || {}
  const [rentaMensual,  setRentaMensual]  = useState(esEdicion ? (al.renta_mensual        ?? '') : '')
  const [mesesOcupados, setMesesOcupados] = useState(String(al.meses_ocupados ?? 11))
  const [comunidad,     setComunidad]     = useState(esEdicion ? (al.comunidad_mensual     ?? '') : '')
  const [mantenimiento, setMantenimiento] = useState(esEdicion ? (al.mantenimiento_mensual ?? '') : '')
  const [ibi,           setIbi]           = useState(esEdicion ? (al.ibi_anual            ?? '') : '')
  const [seguro,        setSeguro]        = useState(esEdicion ? (al.seguro_anual         ?? '') : '')
  const [gestionPct,    setGestionPct]    = useState(al.gestion_pct    ?? 0)
  const [seguroImpago,  setSeguroImpago]  = useState(esEdicion ? (al.seguro_impago ?? '') : '')

  // Financiación especial
  const fi = inmueble?.hipoteca || {}
  const [modoFinanciacion, setModoFinanciacion] = useState(
    fi.modo_financiacion || (fi.aval_ico ? 'dual' : 'ninguna')
  )
  const [ltvBanco,      setLtvBanco]      = useState(fi.ltv_banco               ?? 0.80)
  const [ltvPublico,    setLtvPublico]    = useState(fi.credito_publico?.ltv     ?? 0.20)
  const [interesPublico,setInteresPublico]= useState(fi.credito_publico?.interes_anual ?? 0)

  // Comisión bróker inmobiliario
  const [usarComisionAgente, setUsarComisionAgente] = useState(fi.comision_agente?.activo ?? false)
  const [comisionAgentePct,  setComisionAgentePct]  = useState(fi.comision_agente?.pct    ?? 3)
  const [comisionInput,      setComisionInput]      = useState(String(fi.comision_agente?.pct ?? 3))

  // Meta vinculada
  const [metaId, setMetaId] = useState(inmueble?.meta_id || null)

  const [saving, setSaving] = useState(false)

  // ── Cálculos en vivo ──────────────────────────────────────────────────────────
  const plazoMeses       = Math.round((parseFloat(plazoAños) || 0) * 12)
  const precioCentsLive  = toCents(precio)
  const tasacionCentsLive= toCents(tasacion) || (precioCentsLive > toCents(300000) ? toCents(540) : toCents(450))
  const comisionAgenteCents = usarComisionAgente ? calcularComisionAgente(precioCentsLive, comisionAgentePct) : 0

  const sinFinanciacion = modoFinanciacion === 'ninguna'
  const esAvalICO       = modoFinanciacion === 'aval_ico'
  const esDual          = modoFinanciacion === 'dual'

  const principalBancoCents = sinFinanciacion
    ? Math.max(0, precioCentsLive - toCents(aportacion))
    : esAvalICO
    ? precioCentsLive
    : Math.round(precioCentsLive * ltvBanco)

  const cuotaCents = esAvalICO
    ? calcularAvalICO({ precioCents: precioCentsLive, interesAnual: parseFloat(interesAnual) || 0, plazoMeses }).cuotaCents
    : esDual
    ? calcularFinanciacionDual({ precioCents: precioCentsLive, interesAnual: parseFloat(interesAnual) || 0, plazoMeses, ltvBanco, ltvCreditoPublico: ltvPublico, interesCreditoPublico: parseFloat(interesPublico) || 0 }).cuotaTotalCents
    : calcularCuotaHipoteca(principalBancoCents, parseFloat(interesAnual) || 0, plazoMeses)

  const gastosPreview = calcularGastosCompraLegales({
    precioCents: precioCentsLive,
    ccaa,
    tipoTransmision,
    incluirBroker,
    incluirTasacion,
    tasacionCents: tasacionCentsLive,
    itpPctManual: itpManual && itpPctManual !== '' ? parseFloat(itpPctManual) : null,
  })
  const gastosCompra = fromCents(gastosPreview.total)

  const inversionCents = calcularInversionTotal({
    precioCents: precioCentsLive,
    gastosCompraCents: toCents(gastosCompra),
    reformaCents: toCents(reforma),
    comisionAgenteCents,
  })

  const gastosInaplazables = calcularGastosInaplazables({
    precioCents: precioCentsLive,
    ccaa,
    tipoTransmision,
    tasacionCents: tasacionCentsLive,
    comisionAgentePct: usarComisionAgente ? comisionAgentePct : 0,
  })

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleModoFinanciacion(modo) {
    setModoFinanciacion(modo)
    if (modo !== 'ninguna') setAportacion(0)
  }

  function handleTipoChange(nuevoTipo) {
    setTipo(nuevoTipo)
    if (!esEdicion) {
      setPrecio('')
      setReforma('')
      setAportacion('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    if (!precio || parseFloat(precio) <= 0) return
    setSaving(true)

    const payload = {
      nombre: nombre.trim(),
      tipo,
      notas: notas.trim() || null,
      meta_id: metaId || null,
      datos_compra: {
        precio:             parseFloat(precio)     || 0,
        gastos_compra:      parseFloat(gastosCompra) || 0,
        reforma:            parseFloat(reforma)    || 0,
        aportacion_inicial: parseFloat(aportacion) || 0,
        tasacion:           parseFloat(tasacion)   || 450,
        ccaa,
        tipo_transmision: tipoTransmision,
        itp_pct_manual: itpManual && itpPctManual !== '' ? parseFloat(itpPctManual) : null,
      },
      hipoteca: {
        principal:        principalBancoCents / 100,
        interes_anual:    parseFloat(interesAnual)   || 0,
        plazo_meses:      plazoMeses,
        fecha_inicio:     fechaInicio,
        modo_financiacion: modoFinanciacion,
        aval_ico:         modoFinanciacion !== 'ninguna',
        ltv_banco:        esDual ? ltvBanco : esAvalICO ? 1.0 : null,
        credito_publico: esDual ? {
          activo: true,
          ltv: ltvPublico,
          interes_anual: parseFloat(interesPublico) || 0,
          nombre: 'Préstamo Público — Familias con menores / Castilla-La Mancha',
        } : { activo: false },
        comision_agente: {
          activo:  usarComisionAgente,
          pct:     parseFloat(comisionAgentePct),
          importe: comisionAgenteCents / 100,
        },
      },
      alquiler_config: tipo === 'inversion' ? {
        renta_mensual:         parseFloat(rentaMensual)  || 0,
        meses_ocupados:        parseInt(mesesOcupados)   || 11,
        comunidad_mensual:     parseFloat(comunidad)     || 0,
        mantenimiento_mensual: parseFloat(mantenimiento) || 0,
        ibi_anual:             parseFloat(ibi)           || 0,
        seguro_anual:          parseFloat(seguro)        || 0,
        gestion_pct:           parseFloat(gestionPct)    || 0,
        seguro_impago:         parseFloat(seguroImpago)  || 0,
      } : {},
    }

    try {
      await onSave(payload)
    } finally {
      setSaving(false)
    }
  }

  const precioAlto = precioCentsLive > toCents(300000)

  // Opciones de metas para el selector
  const metaOptions = metas.map(m => ({
    id: m.id,
    label: `${m.emoji ? m.emoji + ' ' : ''}${m.nombre}`,
    sub: new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(m.actual),
  }))

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Nombre + Tipo ── */}
      <div className="space-y-3">
        <div>
          <label className="ff-label">Nombre del inmueble</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Ej: Piso calle Mayor, Inversión Ruzafa..."
            required
            className="ff-input w-full"
          />
        </div>

        <div>
          <label className="ff-label">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'vivienda_habitual', label: 'Vivienda habitual', icon: Home },
              { id: 'inversion',         label: 'Inversión / Alquiler', icon: TrendingUp },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTipoChange(id)}
                className="flex items-center gap-2 p-3 rounded-xl border text-left transition-all"
                style={{
                  borderColor: tipo === id ? 'var(--accent-main)' : 'var(--border-glass)',
                  background:  tipo === id ? 'color-mix(in srgb, var(--accent-main), transparent 92%)' : 'var(--input-bg)',
                  color:       tipo === id ? 'var(--accent-main)' : 'var(--text-muted)',
                }}>
                <Icon size={14} />
                <span className="text-xs font-bold">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Datos de compra ── */}
      <div className="space-y-3">
        <p className="font-serif text-sm" style={{ color: 'var(--text-primary)' }}>Datos de compra</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ff-label">Precio del piso</label>
            <div className="relative">
              <input type="number" className="ff-input w-full pr-8"
                placeholder="0" min={0} step={1000}
                value={precio} onChange={e => setPrecio(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
            </div>
          </div>
          <div>
            <label className="ff-label">Reforma y muebles</label>
            <div className="relative">
              <input type="number" className="ff-input w-full pr-8"
                placeholder="0" min={0} step={500}
                value={reforma} onChange={e => setReforma(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
            </div>
          </div>
        </div>

        {sinFinanciacion && (
          <div>
            <label className="ff-label">Entrada (cash aportado)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  className="ff-input w-full"
                  style={{ paddingRight: 36 }}
                  placeholder="0"
                  min={0}
                  step={entradaModo === 'pct' ? 1 : 1000}
                  value={entradaModo === 'pct'
                    ? (precioCentsLive > 0 ? +((parseFloat(aportacion) || 0) / fromCents(precioCentsLive) * 100).toFixed(1) : '')
                    : aportacion
                  }
                  onChange={e => {
                    const v = e.target.value
                    if (entradaModo === 'pct') {
                      const euros = precioCentsLive > 0 ? Math.round(fromCents(precioCentsLive) * (parseFloat(v) || 0) / 100) : 0
                      setAportacion(euros)
                    } else {
                      setAportacion(v)
                    }
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}>
                  {entradaModo === 'eur' ? '€' : '%'}
                </span>
              </div>
              <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--progress-track)' }}>
                {['eur', 'pct'].map(m => (
                  <button key={m} type="button"
                    onClick={() => setEntradaModo(m)}
                    className="text-sm font-black transition-all"
                    style={{
                      width: 48, height: '100%',
                      background: entradaModo === m ? 'var(--accent-main)' : 'transparent',
                      color: entradaModo === m ? 'var(--text-on-dark)' : 'var(--text-muted)',
                      border: 'none', cursor: 'pointer',
                    }}>
                    {m === 'eur' ? '€' : '%'}
                  </button>
                ))}
              </div>
            </div>
            {precioCentsLive > 0 && (parseFloat(aportacion) || 0) > 0 && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {entradaModo === 'pct'
                  ? `= ${formatCurrency(parseFloat(aportacion) || 0)}`
                  : `= ${+((parseFloat(aportacion) || 0) / fromCents(precioCentsLive) * 100).toFixed(1)}% del precio`
                }
              </p>
            )}
          </div>
        )}

        {/* Gastos de compra — cálculo automático */}
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 78%)' }}>
          <div className="p-3" style={{ background: 'color-mix(in srgb, var(--accent-main), transparent 94%)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-main)', marginBottom: 8 }}>
              Gastos de compra — cálculo automático
            </p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="ff-label">Comunidad Autónoma</label>
                <CustomSelect
                  value={ccaa}
                  onChange={v => setCcaa(v || 'Madrid')}
                  options={CCAA_OPTIONS}
                  color="var(--accent-main)"
                />
              </div>
              <div>
                <label className="ff-label">Tipo de transmisión</label>
                <CustomSelect
                  value={tipoTransmision}
                  onChange={v => { setTipoTransmision(v || 'segunda_mano'); setItpManual(false) }}
                  options={TIPO_TRANSMISION_OPTIONS}
                  color="var(--accent-main)"
                />
              </div>
            </div>

            {/* ITP manual — solo segunda mano */}
            {tipoTransmision === 'segunda_mano' && (
              <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input type="checkbox" checked={itpManual} onChange={e => setItpManual(e.target.checked)} className="rounded" />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Tipo reducido de ITP
                    <span className="font-normal ml-1" style={{ color: 'var(--text-muted)' }}>(jóvenes, familia numerosa, discapacidad…)</span>
                  </span>
                </label>
                {itpManual && (
                  <div className="flex items-center gap-2 pl-6">
                    <div className="relative w-28">
                      <input
                        type="number"
                        className="ff-input w-full pr-7 text-sm"
                        min={0} max={20} step={0.5}
                        placeholder={String(ITP_POR_CCAA[ccaa] ?? 8)}
                        value={itpPctManual}
                        onChange={e => setItpPctManual(e.target.value)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>%</span>
                    </div>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Estándar: {ITP_POR_CCAA[ccaa] ?? 8}%
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={incluirTasacion} onChange={e => setIncluirTasacion(e.target.checked)} className="rounded" />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Incluir tasación</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={incluirBroker} onChange={e => setIncluirBroker(e.target.checked)} className="rounded" />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Intermediario hipotecario</span>
              </label>
            </div>

            {/* Tasación editable */}
            {incluirTasacion && (
              <div className="mb-3">
                <label className="ff-label">Coste tasación</label>
                <div className="relative">
                  <input type="number" className="ff-input w-full pr-8"
                    placeholder="450" min={100} step={50}
                    value={tasacion} onChange={e => setTasacion(e.target.value)} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
                </div>
                {precioAlto && (
                  <p className="text-xs px-2 py-1.5 rounded-lg mt-1 flex items-center gap-1.5"
                    style={{ background: 'color-mix(in srgb, var(--accent-main), transparent 85%)', color: 'var(--accent-main)' }}>
                    <AlertTriangle size={11} />
                    Precio &gt; 300k€ — tasación estimada ~540€ (+20%)
                  </p>
                )}
              </div>
            )}

            <div className="w-full py-2 px-3 rounded-xl flex items-center justify-between text-xs font-black"
              style={{ background: 'var(--accent-main)', color: 'var(--text-on-dark)' }}>
              <span className="flex items-center gap-1.5"><Calculator size={13} /> Total calculado (auto)</span>
              <span>{formatCurrency(fromCents(gastosPreview.total))}</span>
            </div>

            {/* Desglose */}
            <button type="button" onClick={() => setDesglosAbierto(v => !v)}
              className="w-full flex items-center justify-center gap-1 mt-2 text-xs font-semibold"
              style={{ color: 'var(--accent-main)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              {desglosAbierto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {desglosAbierto ? 'Ocultar desglose' : 'Ver desglose'}
            </button>
            {desglosAbierto && (
              <div className="mt-2 pt-2 border-t space-y-1" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 75%)' }}>
                {Object.entries(gastosPreview.desglose).map(([concepto, cents]) => (
                  <div key={concepto} className="flex justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{concepto}</span>
                    <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(cents))}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 75%)' }}>
                  <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>Total gastos</span>
                  <span className="text-xs font-black" style={{ color: 'var(--accent-main)' }}>{formatCurrency(fromCents(gastosPreview.total))}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Comisión bróker inmobiliario ── */}
      <div className="rounded-xl border p-3" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 78%)', background: 'color-mix(in srgb, var(--accent-main), transparent 96%)' }}>
        <label className="flex items-start gap-3 cursor-pointer">
          <div className="relative mt-0.5 flex-shrink-0">
            <input type="checkbox" checked={usarComisionAgente} onChange={e => setUsarComisionAgente(e.target.checked)} className="sr-only peer" />
            <div className="w-9 h-5 rounded-full transition-colors"
              style={{ background: usarComisionAgente ? 'var(--accent-main)' : 'var(--progress-track)' }} />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform"
              style={{ transform: usarComisionAgente ? 'translateX(16px)' : 'translateX(0)', background: 'var(--bg-card)' }} />
          </div>
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Comisión bróker inmobiliario</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Habitual 3-5% · se suma a la inversión total y reduce el ROI</p>
          </div>
        </label>
        {usarComisionAgente && (
          <div className="flex items-center gap-3 mt-3 pl-12">
            <input type="range" min={0} max={10} step={0.5} value={comisionAgentePct}
              onChange={e => { const v = parseFloat(e.target.value); setComisionAgentePct(v); setComisionInput(String(v)) }}
              className="flex-1" style={{ accentColor: 'var(--accent-main)' }} />
            <div className="relative w-16">
              <input
                type="number" min={0} max={10} step={0.5}
                className="ff-input w-full pr-5 text-xs font-black text-center py-1"
                style={{ color: 'var(--accent-main)' }}
                value={comisionInput}
                onChange={e => {
                  setComisionInput(e.target.value)
                  const v = parseFloat(e.target.value)
                  if (!isNaN(v) && v >= 0 && v <= 10) setComisionAgentePct(v)
                }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
            </div>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {formatCurrency(fromCents(comisionAgenteCents))}
            </span>
          </div>
        )}
      </div>

      {/* ── Financiación especial (solo vivienda habitual) ── */}
      {tipo === 'vivienda_habitual' && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 78%)' }}>
          <div className="p-3" style={{ background: 'color-mix(in srgb, var(--accent-violet), transparent 94%)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-violet)', marginBottom: 8 }}>
              Financiación especial
            </p>

            <div className="space-y-2 mb-3">
              {MODOS_FINANCIACION.map(({ id, label, desc }) => (
                <button key={id} type="button"
                  onClick={() => handleModoFinanciacion(id)}
                  className="w-full text-left p-3 rounded-xl border transition-all"
                  style={{
                    borderColor: modoFinanciacion === id ? 'var(--accent-violet)' : 'var(--border-glass)',
                    background:  modoFinanciacion === id ? 'color-mix(in srgb, var(--accent-violet), transparent 85%)' : 'var(--input-bg)',
                  }}>
                  <p className="text-xs font-black" style={{ color: modoFinanciacion === id ? 'var(--accent-violet)' : 'var(--text-primary)' }}>
                    {label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                </button>
              ))}
            </div>

            {/* Opciones Dual */}
            {esDual && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)' }}>
                <div>
                  <label className="ff-label">LTV banco (%)</label>
                  <div className="flex items-center gap-2">
                    <input type="range" min={50} max={80} step={5} value={Math.round(ltvBanco * 100)}
                      onChange={e => { const v = parseInt(e.target.value) / 100; setLtvBanco(v); setLtvPublico(+(1 - v).toFixed(2)) }}
                      className="flex-1"
                      style={{ accentColor: 'var(--accent-violet)' }} />
                    <span className="text-xs font-black w-8 text-right" style={{ color: 'var(--accent-violet)' }}>{Math.round(ltvBanco * 100)}%</span>
                  </div>
                </div>
                <div>
                  <label className="ff-label">Crédito público (%)</label>
                  <div className="ff-input flex items-center justify-between" style={{ opacity: 0.8 }}>
                    <span className="text-sm font-bold">{Math.round(ltvPublico * 100)}%</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>auto</span>
                  </div>
                </div>
                <div>
                  <label className="ff-label">Interés crédito público</label>
                  <div className="relative">
                    <input type="number" className="ff-input w-full pr-8"
                      placeholder="0" min={0} max={5} step={0.1}
                      value={interesPublico} onChange={e => setInteresPublico(e.target.value)} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                </div>
                <div className="flex flex-col justify-end pb-1">
                  <p className="text-xs font-black" style={{ color: 'var(--accent-violet)' }}>
                    Cuota total: {formatCurrency(fromCents(cuotaCents))}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatCurrency(fromCents(Math.round(precioCentsLive * ltvBanco)))} banco
                    &nbsp;+&nbsp;
                    {formatCurrency(fromCents(Math.round(precioCentsLive * ltvPublico)))} público
                  </p>
                </div>
              </div>
            )}

            {/* Resumen Aval ICO */}
            {esAvalICO && (
              <div className="pt-2 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldCheck size={13} style={{ color: 'var(--accent-violet)' }} />
                  <p className="text-xs font-black" style={{ color: 'var(--accent-violet)' }}>
                    Cuota única: {formatCurrency(fromCents(cuotaCents))} / mes
                  </p>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  1 sola hipoteca · {interesAnual}% · 100% de {formatCurrency(fromCents(precioCentsLive))} · Estado avala el exceso
                </p>
              </div>
            )}

            {/* Alerta efectivo inaplazable cuando financiación especial */}
            {modoFinanciacion !== 'ninguna' && (
              <div className="mt-3 p-3 rounded-xl border" style={{ borderColor: 'color-mix(in srgb, var(--accent-rose), transparent 65%)', background: 'color-mix(in srgb, var(--accent-rose), transparent 92%)' }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle size={13} style={{ color: 'var(--accent-rose)' }} />
                  <p className="text-xs font-black" style={{ color: 'var(--accent-rose)' }}>El peligro del 100%</p>
                </div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Aunque financies el 100% del precio, <strong>siempre necesitas efectivo</strong> para impuestos y gestión:
                </p>
                <div className="space-y-0.5">
                  {Object.entries(gastosInaplazables.desglose).map(([concepto, cents]) => (
                    <div key={concepto} className="flex justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{concepto}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(cents))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-rose), transparent 65%)' }}>
                    <span className="text-xs font-black" style={{ color: 'var(--accent-rose)' }}>Efectivo mínimo inaplazable</span>
                    <span className="text-xs font-black" style={{ color: 'var(--accent-rose)' }}>{formatCurrency(fromCents(gastosInaplazables.totalCents))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Hipoteca ── */}
      <div>
        <p className="font-serif text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Hipoteca</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ff-label">{esAvalICO ? 'Préstamo (100% LTV)' : esDual ? `Préstamo banco (${Math.round(ltvBanco * 100)}%)` : 'Principal (precio − entrada)'}</label>
            <div className="ff-input flex items-center gap-2" style={{ opacity: 0.7 }}>
              <span className="text-sm font-semibold">{formatCurrency(fromCents(principalBancoCents))}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>auto</span>
            </div>
          </div>
          <div>
            <label className="ff-label">Tipo de interés anual</label>
            <div className="relative">
              <input type="number" className="ff-input w-full pr-8"
                placeholder="3" min={0} step={0.05}
                value={interesAnual} onChange={e => setInteresAnual(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>%</span>
            </div>
          </div>
          <div>
            <label className="ff-label">Plazo</label>
            <div className="relative">
              <input type="number" className="ff-input w-full pr-12"
                placeholder="30" min={5} max={40} step={1}
                value={plazoAños} onChange={e => setPlazoAños(e.target.value)} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>años</span>
            </div>
          </div>
          <div>
            <label className="ff-label">Fecha primer pago</label>
            <input type="month" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="ff-input w-full" />
          </div>
        </div>
      </div>

      {/* ── Alquiler (solo inversión) ── */}
      {tipo === 'inversion' && (
        <div>
          <p className="font-serif text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Configuración de alquiler</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Renta mensual bruta</label>
              <div className="relative">
                <input type="number" className="ff-input w-full pr-8"
                  placeholder="0" min={0} step={50}
                  value={rentaMensual} onChange={e => setRentaMensual(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
              </div>
            </div>
            <div>
              <label className="ff-label">Meses ocupados / año</label>
              <CustomSelect
                value={mesesOcupados}
                onChange={v => setMesesOcupados(v || '11')}
                options={MESES_OCUPADOS_OPTIONS}
                color="var(--accent-main)"
              />
            </div>
            <div>
              <label className="ff-label">Comunidad / mes</label>
              <div className="relative">
                <input type="number" className="ff-input w-full pr-8"
                  placeholder="0" min={0} step={5}
                  value={comunidad} onChange={e => setComunidad(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
              </div>
            </div>
            <div>
              <label className="ff-label">Mantenimiento / mes</label>
              <div className="relative">
                <input type="number" className="ff-input w-full pr-8"
                  placeholder="0" min={0} step={5}
                  value={mantenimiento} onChange={e => setMantenimiento(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
              </div>
            </div>
            <div>
              <label className="ff-label">IBI anual</label>
              <div className="relative">
                <input type="number" className="ff-input w-full pr-8"
                  placeholder="0" min={0} step={50}
                  value={ibi} onChange={e => setIbi(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
              </div>
            </div>
            <div>
              <label className="ff-label">Seguro del hogar anual</label>
              <div className="relative">
                <input type="number" className="ff-input w-full pr-8"
                  placeholder="0" min={0} step={10}
                  value={seguro} onChange={e => setSeguro(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
              </div>
            </div>
            <div>
              <label className="ff-label">Gestión alquiler (agencia) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span></label>
              <div className="relative">
                <input type="number" className="ff-input w-full pr-8"
                  placeholder="0" min={0} max={20} step={0.5}
                  value={gestionPct} onChange={e => setGestionPct(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>%</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>% sobre renta cobrada · típico 8-10%</p>
            </div>
            <div>
              <label className="ff-label">Seguro de impago anual <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>opcional</span></label>
              <div className="relative">
                <input type="number" className="ff-input w-full pr-8"
                  placeholder="0" min={0} step={10}
                  value={seguroImpago} onChange={e => setSeguroImpago(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>€</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Prima anual · típico 3-4% renta</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Meta vinculada ── */}
      {metas.length > 0 && (
        <div>
          <label className="ff-label">Hucha vinculada (meta de ahorro)</label>
          <CustomSelect
            value={metaId}
            onChange={v => setMetaId(v || null)}
            options={metaOptions}
            placeholder="— Sin vincular —"
            color="var(--accent-main)"
          />
          {metaId && (() => {
            // Advertir si otro inmueble ya usa esta meta
            const conflicto = inmuebles.find(i => i.meta_id === metaId && i.id !== inmueble?.id)
            const m = metas.find(x => x.id === metaId)
            if (!m) return null
            const necesarioCents = toCents(aportacion) + toCents(gastosCompra) + toCents(reforma) + comisionAgenteCents
            const actualCents = toCents(m.actual)
            const falta = necesarioCents - actualCents
            const pct = necesarioCents > 0 ? Math.min(100, Math.round((actualCents / necesarioCents) * 100)) : 0
            return (
              <div className="space-y-2 mt-2">
              {conflicto && (
                <div className="rounded-xl p-3 border flex items-start gap-2" style={{
                  borderColor: 'color-mix(in srgb, var(--accent-main), transparent 60%)',
                  background:  'color-mix(in srgb, var(--accent-main), transparent 90%)',
                }}>
                  <AlertTriangle size={14} style={{ color: 'var(--accent-main)', flexShrink: 0, marginTop: 1 }} />
                  <p className="text-xs" style={{ color: 'var(--accent-main)' }}>
                    Esta hucha ya está vinculada a <strong>"{conflicto.nombre}"</strong>. El saldo se mostrará completo en ambos inmuebles — no se divide.
                  </p>
                </div>
              )}
              <div className="rounded-xl p-3 border" style={{
                borderColor: falta <= 0 ? 'color-mix(in srgb, var(--accent-green), transparent 70%)' : 'color-mix(in srgb, var(--accent-main), transparent 70%)',
                background:  falta <= 0 ? 'color-mix(in srgb, var(--accent-green), transparent 93%)' : 'color-mix(in srgb, var(--accent-main), transparent 93%)',
              }}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-bold" style={{ color: falta <= 0 ? 'var(--accent-green)' : 'var(--accent-main)' }}>
                    {falta <= 0 ? '¡Listo para comprar!' : `Faltan ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(fromCents(falta))}`}
                  </span>
                  <span className="text-xs font-black" style={{ color: falta <= 0 ? 'var(--accent-green)' : 'var(--accent-main)' }}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: falta <= 0 ? 'var(--accent-green)' : 'var(--accent-main)' }} />
                </div>
              </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Notas ── */}
      <div>
        <label className="ff-label">Notas</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          placeholder="Observaciones, características del piso..."
          className="ff-input w-full resize-none"
        />
      </div>

      {/* ── Preview calculado ── */}
      <div className="rounded-xl p-3 border" style={{ background: 'color-mix(in srgb, var(--accent-main), transparent 94%)', borderColor: 'color-mix(in srgb, var(--accent-main), transparent 82%)' }}>
        <div className="flex flex-col gap-1.5">
          {[
            { label: esDual ? 'Cuota total (2 deudas)' : 'Cuota / mes', value: formatCurrency(fromCents(cuotaCents)), accent: true },
            { label: esAvalICO ? 'Préstamo único' : esDual ? 'Préstamo banco' : 'Préstamo', value: formatCurrency(fromCents(principalBancoCents)) },
            { label: 'Inv. total', value: formatCurrency(fromCents(inversionCents)) },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex items-center justify-between">
              <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
              <p className="text-sm font-black" style={{ color: accent ? 'var(--accent-main)' : 'var(--text-primary)', letterSpacing: '-0.02em' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Botones ── */}
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="ff-btn-ghost flex-1">Cancelar</button>
        <button type="submit" disabled={saving || !nombre.trim() || !precio || parseFloat(precio) <= 0} className="ff-btn-primary flex-1">
          {saving ? 'Guardando...' : esEdicion ? 'Actualizar' : 'Crear'}
        </button>
      </div>

    </form>
  )
}
