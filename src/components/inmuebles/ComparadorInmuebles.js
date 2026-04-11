'use client'
import { useMemo } from 'react'
import { X } from 'lucide-react'
import {
  toCents, fromCents,
  calcularCuotaHipoteca, calcularLTV, calcularNOI, calcularCashflow,
  calcularRentabilidadNeta, calcularInversionTotal, calcularComisionAgente,
  calcularAvalICO, calcularFinanciacionDual, calcularTresCapasRentabilidad,
} from '@/lib/inmuebles'
import { formatCurrency } from '@/lib/utils'

/**
 * Compara dos inmuebles en paralelo.
 * Muestra las métricas clave de cada uno lado a lado.
 */
export default function ComparadorInmuebles({ inmuebles, onCerrar }) {
  if (inmuebles.length < 2) return null
  const [a, b] = inmuebles

  return (
    <div className="rounded-2xl border overflow-hidden mb-6" style={{ borderColor: 'var(--border-glass)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-glass)' }}>
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
          Comparador
        </p>
        <button onClick={onCerrar} className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--progress-track)', color: 'var(--text-muted)' }}>
          <X size={12} />
        </button>
      </div>

      {/* Nombres */}
      <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border-glass)' }}>
        {[a, b].map((inm, i) => (
          <div key={inm.id} className="px-3 py-2" style={{ background: 'var(--progress-track)' }}>
            <p className="text-xs font-black truncate" style={{ color: i === 0 ? 'var(--accent-blue)' : 'var(--accent-gold)' }}>
              {inm.nombre}
            </p>
            <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>
              {formatCurrency(inm.datos_compra?.precio || 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Filas de métricas */}
      <div>
        <MetricSection label="COMPRA" />
        <CompRow label="Precio" a={a} b={b} fn={x => formatCurrency(fromCents(toCents(x.datos_compra?.precio || 0)))} />
        <CompRow label="Cuota mensual" a={a} b={b} fn={getCuota} menor />
        <CompRow label="LTV" a={a} b={b} fn={getLTV} menor />
        <CompRow label="Inversión total" a={a} b={b} fn={getInversion} menor />

        {(a.tipo === 'inversion' || b.tipo === 'inversion') && <>
          <MetricSection label="INVERSIÓN" />
          <CompRow label="Renta mensual" a={a} b={b} fn={x => x.alquiler_config?.renta_mensual ? formatCurrency(x.alquiler_config.renta_mensual) : '—'} mayor />
          <CompRow label="Cashflow / mes" a={a} b={b} fn={getCashflow} mayor colored />
          <CompRow label="Rentab. bruta" a={a} b={b} fn={x => getRentabs(x).bruta} mayor />
          <CompRow label="Rentab. neta" a={a} b={b} fn={x => getRentabs(x).neta} mayor />
          <CompRow label="Cash-on-Cash" a={a} b={b} fn={x => getRentabs(x).coc} mayor />
        </>}

        <MetricSection label="HIPOTECA" />
        <CompRow label="Tipo interés" a={a} b={b} fn={x => `${x.hipoteca?.interes_anual || 3}%`} menor />
        <CompRow label="Plazo" a={a} b={b} fn={x => `${Math.round((x.hipoteca?.plazo_meses || 360) / 12)} años`} menor />
      </div>
    </div>
  )
}

// ── Helpers de cálculo ────────────────────────────────────────────────────────

function getCuota(inm) {
  const dc = inm.datos_compra, hip = inm.hipoteca
  const precioCents = toCents(dc?.precio || 0)
  const principalCents = toCents(hip?.principal || 0)
  const ia = parseFloat(hip?.interes_anual || 3)
  const pm = parseInt(hip?.plazo_meses || 360)
  const modo = hip?.modo_financiacion || (hip?.aval_ico ? 'dual' : 'ninguna')
  let cuota = 0
  if (modo === 'aval_ico') cuota = calcularAvalICO({ precioCents, interesAnual: ia, plazoMeses: pm }).cuotaCents
  else if (modo === 'dual') cuota = calcularFinanciacionDual({ precioCents, interesAnual: ia, plazoMeses: pm, ltvBanco: hip?.ltv_banco ?? 0.80, ltvCreditoPublico: hip?.credito_publico?.ltv ?? 0.20, interesCreditoPublico: hip?.credito_publico?.interes_anual ?? 0 }).cuotaTotalCents
  else cuota = calcularCuotaHipoteca(principalCents, ia, pm)
  return formatCurrency(fromCents(cuota))
}

function getLTV(inm) {
  const dc = inm.datos_compra, hip = inm.hipoteca
  const ltv = calcularLTV(toCents(hip?.principal || 0), toCents(dc?.precio || 0))
  return `${ltv}%`
}

function getInversion(inm) {
  const dc = inm.datos_compra, hip = inm.hipoteca
  const precioCents = toCents(dc?.precio || 0)
  const comAgente = hip?.comision_agente?.activo ? calcularComisionAgente(precioCents, hip.comision_agente.pct ?? 0) : 0
  const total = calcularInversionTotal({ precioCents, gastosCompraCents: toCents(dc?.gastos_compra || 0), reformaCents: toCents(dc?.reforma || 0), comisionAgenteCents: comAgente })
  return formatCurrency(fromCents(total))
}

function getCashflow(inm) {
  if (!inm.alquiler_config) return '—'
  const al = inm.alquiler_config, hip = inm.hipoteca, dc = inm.datos_compra
  const precioCents = toCents(dc?.precio || 0)
  const ia = parseFloat(hip?.interes_anual || 3)
  const pm = parseInt(hip?.plazo_meses || 360)
  const principalCents = toCents(hip?.principal || 0)
  const noi = calcularNOI({ rentaMensualCents: toCents(al.renta_mensual || 0), mesesOcupados: al.meses_ocupados ?? 11, comunidadMensualCents: toCents(al.comunidad_mensual || 0), mantenimientoMensualCents: toCents(al.mantenimiento_mensual || 0), ibiAnualCents: toCents(al.ibi_anual || 0), seguroAnualCents: toCents(al.seguro_anual || 0) })
  const cuota = calcularCuotaHipoteca(principalCents, ia, pm)
  const cf = calcularCashflow(noi.noiMensualCents, cuota)
  return formatCurrency(fromCents(cf))
}

function getRentabs(inm) {
  if (!inm.alquiler_config) return { bruta: '—', neta: '—', coc: '—' }
  const al = inm.alquiler_config, hip = inm.hipoteca, dc = inm.datos_compra
  const precioCents = toCents(dc?.precio || 0)
  const ia = parseFloat(hip?.interes_anual || 3)
  const pm = parseInt(hip?.plazo_meses || 360)
  const principalCents = toCents(hip?.principal || 0)
  const gastosCompraCents = toCents(dc?.gastos_compra || 0)
  const reformaCents = toCents(dc?.reforma || 0)
  const aportacionCents = toCents(dc?.aportacion_inicial || 0)
  const comAgente = hip?.comision_agente?.activo ? calcularComisionAgente(precioCents, hip.comision_agente.pct ?? 0) : 0
  const inversionTotal = calcularInversionTotal({ precioCents, gastosCompraCents, reformaCents, comisionAgenteCents: comAgente })
  const efectivo = aportacionCents + gastosCompraCents + reformaCents + comAgente
  const noi = calcularNOI({ rentaMensualCents: toCents(al.renta_mensual || 0), mesesOcupados: al.meses_ocupados ?? 11, comunidadMensualCents: toCents(al.comunidad_mensual || 0), mantenimientoMensualCents: toCents(al.mantenimiento_mensual || 0), ibiAnualCents: toCents(al.ibi_anual || 0), seguroAnualCents: toCents(al.seguro_anual || 0) })
  const cuota = calcularCuotaHipoteca(principalCents, ia, pm)
  const cf = calcularCashflow(noi.noiMensualCents, cuota)
  const caps = calcularTresCapasRentabilidad({ ingresosBrutosCents: noi.ingresosBrutosCents, noiAnualCents: noi.noiAnualCents, cashflowAnualCents: cf * 12, precioCents, inversionTotalCents: inversionTotal, efectivoDesembolsadoCents: efectivo })
  return { bruta: `${caps.brutaPct}%`, neta: `${caps.netaPct}%`, coc: `${caps.cocPct}%` }
}

// ── Sub-componentes de UI ─────────────────────────────────────────────────────

function MetricSection({ label }) {
  return (
    <div className="px-4 py-1.5" style={{ background: 'var(--progress-track)' }}>
      <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function CompRow({ label, a, b, fn, menor, mayor, colored }) {
  const va = fn(a), vb = fn(b)
  const isBetter = (val, other) => {
    if (!menor && !mayor) return false
    if (val === '—' || other === '—') return false
    const numA = parseFloat(String(va).replace(/[^0-9.,\-]/g, '').replace(',', '.'))
    const numB = parseFloat(String(vb).replace(/[^0-9.,\-]/g, '').replace(',', '.'))
    if (isNaN(numA) || isNaN(numB) || numA === numB) return false
    if (menor) return val === va ? numA < numB : numB < numA
    if (mayor) return val === va ? numA > numB : numB > numA
  }

  const renderVal = (val, isA) => {
    const better = isBetter(val, isA ? vb : va)
    const numVal = parseFloat(String(val).replace(/[^0-9.,\-]/g, '').replace(',', '.'))
    const isNeg = colored && !isNaN(numVal) && numVal < 0
    const isPos = colored && !isNaN(numVal) && numVal > 0
    return (
      <div className={`px-3 py-2 text-right ${better ? 'font-black' : ''}`}
        style={{ background: 'var(--bg-card)', color: isNeg ? 'var(--accent-rose)' : isPos ? 'var(--accent-green)' : better ? 'var(--accent-main)' : 'var(--text-primary)' }}>
        <p className="text-xs">{val}</p>
        {better && <span style={{ fontSize: 7, fontWeight: 900, color: 'var(--accent-main)' }}>✓ MEJOR</span>}
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 py-1" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-glass)' }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--border-glass)' }}>
        {renderVal(va, true)}
        {renderVal(vb, false)}
      </div>
    </div>
  )
}
