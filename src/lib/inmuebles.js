/**
 * Motor Financiero - Módulo Inmuebles
 * Replica exacta de la lógica del Excel Plan_compra_vivienda.xlsx
 * Todos los cálculos internos en CÉNTIMOS (enteros) para evitar errores float.
 */

import { supabase } from '@/lib/supabase'

// ── Utilidades de precisión monetaria ─────────────────────────────────────────

/** Convierte euros a céntimos (entero) */
export function toCents(amount) {
  return Math.round(parseFloat(amount || 0) * 100)
}

/** Convierte céntimos a euros */
export function fromCents(cents) {
  return (cents || 0) / 100
}

// ── Cálculo automático de gastos de compra (legislación española) ─────────────

/**
 * ITP (Impuesto de Transmisiones Patrimoniales) por Comunidad Autónoma
 * Fuente: tipos vigentes 2024-2025
 */
export const ITP_POR_CCAA = {
  'Andalucía':              7.0,
  'Aragón':                 8.0,
  'Asturias':               8.0,
  'Baleares':               8.0,
  'Canarias':               6.5,   // IGIC (no ITP)
  'Cantabria':             10.0,
  'Castilla-La Mancha':     9.0,
  'Castilla y León':        8.0,
  'Cataluña':              10.0,
  'Comunidad Valenciana':  10.0,
  'Extremadura':            8.0,
  'Galicia':               10.0,
  'La Rioja':               7.0,
  'Madrid':                 6.0,
  'Murcia':                 8.0,
  'Navarra':                6.0,
  'País Vasco':             4.0,
}

/**
 * Calcula el arancel notarial estimado para escritura de compraventa
 * Basado en el Real Decreto 1427/1989 (arancel notarial)
 * Para 180.000€ → ~700€ aprox
 */
function calcularArancelNotarial(precioCents) {
  const p = precioCents / 100 // euros
  let base = 0
  if (p <= 6010)           base = 90
  else if (p <= 30050)     base = 27  + (p - 6010)   * 0.0045
  else if (p <= 60101)     base = 135 + (p - 30050)  * 0.0015
  else if (p <= 150253)    base = 180 + (p - 60101)  * 0.001
  else if (p <= 601012)    base = 270 + (p - 150253) * 0.0005
  else                     base = 495 + (p - 601012) * 0.0003
  // Añadir copias, folios y otros conceptos (aprox +60%)
  const total = Math.round(base * 1.6)
  return toCents(Math.max(450, Math.min(1800, total)))
}

/**
 * Calcula los honorarios del Registro de la Propiedad
 * Arancel del Registro (RD 1427/1989)
 */
function calcularArancelRegistro(precioCents) {
  const p = precioCents / 100
  let base = 0
  if (p <= 6010)           base = 24.04
  else if (p <= 30050)     base = 24.04  + (p - 6010)   * 0.00175
  else if (p <= 60101)     base = 66.07  + (p - 30050)  * 0.00125
  else if (p <= 150253)    base = 103.55 + (p - 60101)  * 0.001
  else if (p <= 601012)    base = 193.68 + (p - 150253) * 0.00075
  else                     base = 531.72 + (p - 601012) * 0.0003
  return toCents(Math.max(100, Math.min(600, Math.round(base * 1.2))))
}

/**
 * Calcula los gastos de compra estimados según la legislación española
 *
 * @param {object} config
 * @param {number} config.precioCents         - Precio de compra en céntimos
 * @param {string} config.ccaa                - Comunidad Autónoma (clave de ITP_POR_CCAA)
 * @param {'segunda_mano'|'obra_nueva'|'vpo'} config.tipoTransmision
 * @param {boolean} [config.incluirBroker]    - Incluir honorarios de broker hipotecario
 * @param {boolean} [config.incluirTasacion]  - Incluir tasación (necesaria para hipoteca)
 * @returns {{ total, desglose }} Totales y desglose por concepto (en céntimos)
 */
export function calcularGastosCompraLegales({
  precioCents,
  ccaa = 'Madrid',
  tipoTransmision = 'segunda_mano',
  incluirBroker = false,
  incluirTasacion = true,
  tasacionCents = null,  // null → auto: 45000 (≤300k€) | 54000 (>300k€)
}) {
  const desglose = {}

  // 1. Impuesto principal
  if (tipoTransmision === 'obra_nueva') {
    const ivaRate = 10   // IVA reducido vivienda habitual
    desglose['IVA (10%)'] = Math.round(precioCents * ivaRate / 100)
    // AJD (Actos Jurídicos Documentados) — aplica en obra nueva
    const ajdRate = ccaa === 'Madrid' ? 0.75 : ccaa === 'País Vasco' ? 0.5 : 1.0
    desglose['AJD'] = Math.round(precioCents * ajdRate / 100)
  } else if (tipoTransmision === 'vpo') {
    desglose['IVA VPO (4%)'] = Math.round(precioCents * 4 / 100)
    const ajdRate = ccaa === 'Madrid' ? 0.75 : 1.0
    desglose['AJD'] = Math.round(precioCents * ajdRate / 100)
  } else {
    // Segunda mano: ITP
    const itpRate = ITP_POR_CCAA[ccaa] ?? 8.0
    desglose[`ITP (${itpRate}%) — ${ccaa}`] = Math.round(precioCents * itpRate / 100)
  }

  // 2. Notaría (arancel notarial)
  desglose['Notaría'] = calcularArancelNotarial(precioCents)

  // 3. Registro de la Propiedad
  desglose['Registro de la Propiedad'] = calcularArancelRegistro(precioCents)

  // 4. Gestoría (honorarios fijos estimados)
  desglose['Gestoría'] = toCents(400)

  // 5. Tasación — editable; default 450€ / auto +20% si precio >300k€
  if (incluirTasacion) {
    const autoTasacion = precioCents > toCents(300000) ? toCents(540) : toCents(450)
    desglose['Tasación'] = tasacionCents != null ? tasacionCents : autoTasacion
  }

  // 6. Broker hipotecario (opcional)
  if (incluirBroker) {
    desglose['Broker hipotecario'] = toCents(Math.max(3000, Math.round(fromCents(precioCents) * 0.01 / 100) * 100))
  }

  const total = Object.values(desglose).reduce((s, v) => s + v, 0)
  return { total, desglose }
}

// ── Motor Financiero: Sistema Francés ─────────────────────────────────────────

/**
 * Calcula la cuota mensual fija (Sistema Francés)
 * Fórmula: C = P × [r(1+r)^n] / [(1+r)^n − 1]
 * donde r = interés mensual, n = plazo en meses
 *
 * @param {number} principalCents  - Principal en céntimos
 * @param {number} interesAnual    - Tipo de interés anual en % (ej: 3.0)
 * @param {number} plazoMeses      - Plazo en meses (ej: 360)
 * @returns {number} Cuota mensual en céntimos
 */
export function calcularCuotaHipoteca(principalCents, interesAnual, plazoMeses) {
  if (plazoMeses <= 0 || principalCents <= 0) return 0
  const r = interesAnual / 100 / 12
  if (r === 0) return Math.round(principalCents / plazoMeses)
  const factor = Math.pow(1 + r, plazoMeses)
  return Math.round((principalCents * r * factor) / (factor - 1))
}

/**
 * Genera la tabla de amortización completa (Sistema Francés)
 * Cada fila: Cuota = Interés (Deuda × i) + Capital (Cuota − Interés)
 *
 * @param {object} config
 * @param {number} config.principalCents         - Principal en céntimos
 * @param {number} config.interesAnual           - Interés anual en %
 * @param {number} config.plazoMeses             - Plazo total en meses
 * @param {string} [config.fechaInicio]          - "YYYY-MM" fecha primer pago
 * @param {Array}  [config.amortizacionesExtra]  - [{ mes, montoCents }]
 * @returns {Array} Tabla con una fila por mes hasta liquidar la deuda
 */
export function generarTablaAmortizacion({
  principalCents,
  interesAnual,
  plazoMeses,
  fechaInicio = null,
  amortizacionesExtra = [],
}) {
  const cuotaFijaCents = calcularCuotaHipoteca(principalCents, interesAnual, plazoMeses)
  const r = interesAnual / 100 / 12

  // Indexar amortizaciones extra por número de mes
  const extraMap = {}
  for (const a of amortizacionesExtra) {
    extraMap[a.mes] = (extraMap[a.mes] || 0) + (a.montoCents || toCents(a.monto || 0))
  }

  // Parsear fecha de inicio
  let startYear = new Date().getFullYear()
  let startMonthIndex = new Date().getMonth() + 1
  if (fechaInicio) {
    const parts = fechaInicio.split('-').map(Number)
    startYear = parts[0]
    startMonthIndex = parts[1]
  }

  let saldo = principalCents
  const tabla = []

  for (let i = 1; i <= plazoMeses && saldo > 0; i++) {
    const interesCents = Math.round(saldo * r)
    const capitalBase = cuotaFijaCents - interesCents
    const extraCents = extraMap[i] || 0
    const capitalTotal = Math.min(capitalBase + extraCents, saldo)
    const cuotaRealCents = interesCents + capitalTotal

    // Calcular fecha del mes actual (i=1 → mes startMonthIndex)
    const totalMonths = startMonthIndex - 1 + (i - 1)
    const year = startYear + Math.floor(totalMonths / 12)
    const month = (totalMonths % 12) + 1

    saldo = Math.max(0, saldo - capitalTotal)

    tabla.push({
      mes: i,
      fecha: `${year}-${String(month).padStart(2, '0')}`,
      año: year,
      cuotaCents: cuotaRealCents,
      interesCents,
      capitalCents: capitalTotal,
      extraCents,
      saldoCents: saldo,
    })

    if (saldo <= 0) break
  }

  return tabla
}

/**
 * Mes en que el capital amortizado acumulado ≥ 20% del precio (hito de la entrada)
 * Replicado del hito "Mes para el 20%" del Excel.
 *
 * @param {Array}  tabla                  - Resultado de generarTablaAmortizacion
 * @param {number} veintePorCientoCents   - 20% del precio de compra en céntimos
 * @returns {number|null} Número de mes (1-based) o null si no se alcanza
 */
export function calcularMesParaEl20(tabla, veintePorCientoCents) {
  let capitalAcumulado = 0
  for (const fila of tabla) {
    capitalAcumulado += fila.capitalCents
    if (capitalAcumulado >= veintePorCientoCents) return fila.mes
  }
  return null
}

/**
 * Resumen de la hipoteca (totales del Excel "RESUMEN HIPOTECA")
 */
export function calcularResumenHipoteca(tabla, principalCents) {
  const mesesReales = tabla.length
  const totalPagadoCents = tabla.reduce((s, f) => s + f.cuotaCents, 0)
  const totalInteresCents = tabla.reduce((s, f) => s + f.interesCents, 0)
  const totalCapitalCents = tabla.reduce((s, f) => s + f.capitalCents, 0)
  const añosReales = Math.floor(mesesReales / 12)
  const mesesRestantes = mesesReales % 12

  return {
    mesesReales,
    añosReales,
    mesesRestantes,
    totalPagadoCents,
    totalInteresCents,
    totalCapitalCents,
  }
}

// ── Motor Financiero: Análisis de Inversión ───────────────────────────────────

/**
 * Calcula el NOI (Net Operating Income) mensual y anual
 * Replicado exactamente del Excel "1-Alquiler piso"
 *
 * El Excel usa "Vacancia = 11" para indicar 11 meses de ingresos al año.
 * Aquí usamos meses_ocupados (11 = 11/12 de ocupación).
 *
 * NOI anual  = (renta_mensual × meses_ocupados) − gastos_anuales
 * NOI mensual = NOI anual / 12
 *
 * @param {object} config
 * @param {number} config.rentaMensualCents        - Renta bruta mensual
 * @param {number} [config.mesesOcupados]          - Meses con inquilino (default 11)
 * @param {number} [config.comunidadMensualCents]  - Gastos comunidad/mes
 * @param {number} [config.mantenimientoMensualCents] - Reserva mantenimiento/mes
 * @param {number} [config.ibiAnualCents]          - IBI anual
 * @param {number} [config.seguroAnualCents]       - Seguro del hogar anual
 * @returns {{ noiMensualCents, noiAnualCents, ingresosBrutosCents, gastosTotalesCents }}
 */
export function calcularNOI({
  rentaMensualCents,
  mesesOcupados = 11,
  comunidadMensualCents = 0,
  mantenimientoMensualCents = 0,
  ibiAnualCents = 0,
  seguroAnualCents = 0,
  gestionPct = 0,        // % sobre la renta cobrada (solo meses ocupados)
  seguroImpagoCents = 0, // prima anual seguro de impago
}) {
  const ingresosBrutosCents = rentaMensualCents * mesesOcupados
  // Gestión: % aplicado solo sobre la renta que realmente se cobra
  const gestionAnualCents = Math.round(ingresosBrutosCents * (parseFloat(gestionPct) || 0) / 100)
  const gastosTotalesCents =
    (comunidadMensualCents * 12) +
    (mantenimientoMensualCents * 12) +
    ibiAnualCents +
    seguroAnualCents +
    gestionAnualCents +
    seguroImpagoCents

  const noiAnualCents = ingresosBrutosCents - gastosTotalesCents
  const noiMensualCents = Math.round(noiAnualCents / 12)
  // Gastos fijos mensuales (para mostrar rango mes ocupado / mes vacío)
  const gastosMensualesCents = Math.round(gastosTotalesCents / 12)

  return {
    ingresosBrutosCents,
    gastosTotalesCents,
    gestionAnualCents,
    gastosMensualesCents,
    noiAnualCents,
    noiMensualCents,
  }
}

/**
 * Cashflow mensual neto = NOI mensual − Cuota hipoteca
 * Replicado del "CASH FLOW" del Excel
 */
export function calcularCashflow(noiMensualCents, cuotaHipotecaCents) {
  return noiMensualCents - cuotaHipotecaCents
}

/**
 * Rentabilidad neta real (Cash-on-Cash Return)
 * Replicado de "Rentabilidad neta real" del Excel:
 *   = Cash Flow anual / Inversión total
 *
 * @param {number} cashflowAnualCents
 * @param {number} inversionTotalCents
 * @returns {number} Porcentaje (ej: 6.67)
 */
export function calcularRentabilidadNeta(cashflowAnualCents, inversionTotalCents) {
  if (inversionTotalCents <= 0) return 0
  return Math.round((cashflowAnualCents / inversionTotalCents) * 10000) / 100
}

/**
 * LTV (Loan to Value) en porcentaje
 * @returns {number} ej: 70.0 (%)
 */
export function calcularLTV(deudaCents, valorCents) {
  if (valorCents <= 0) return 0
  return Math.round((deudaCents / valorCents) * 10000) / 100
}

/**
 * Inversión total = Precio + Gastos compra + Reforma
 * (Gastos compra = ITP + Notaría + Broker + Gestoría)
 * Replicado de "Inversión total" del Excel
 */
/**
 * Comisión del agente/bróker inmobiliario
 * Rango habitual en España: 3-5% del valor de compra
 * @param {number} precioCents - Precio de compra en céntimos
 * @param {number} pct         - Porcentaje (ej: 3.0, 4.0, 5.0)
 */
export function calcularComisionAgente(precioCents, pct = 3) {
  if (!pct || pct <= 0) return 0
  return Math.round(precioCents * parseFloat(pct) / 100)
}

/**
 * Inversión total = Precio + Gastos compra + Reforma + Comisión agente
 * La comisión del bróker inmobiliario (3-5%) se suma a la inversión inicial,
 * reduciendo el ROI y cash-on-cash return de la operación.
 */
export function calcularInversionTotal({ precioCents, gastosCompraCents = 0, reformaCents = 0, comisionAgenteCents = 0 }) {
  return precioCents + gastosCompraCents + reformaCents + comisionAgenteCents
}

// ── Financiación especial: Aval ICO + Crédito Público 0% ─────────────────────

/**
 * Aval ICO — Garantía del Estado
 *
 * UNA SOLA hipoteca al 100% LTV al tipo de mercado habitual.
 * El Estado actúa como avalista del exceso de LTV (normalmente 20-25%).
 * No hay segundo préstamo ni deuda pública separada.
 *
 * ≠ Financiación Dual: aquí no existe un crédito público al 0%.
 * El coste financiero es mayor que el Dual pero la gestión es más sencilla.
 *
 * @param {object} config
 * @param {number} config.precioCents
 * @param {number} config.interesAnual   - Tipo de la hipoteca (ej: 3.0)
 * @param {number} config.plazoMeses     - Plazo en meses (ej: 360)
 * @returns {object}
 */
export function calcularAvalICO({ precioCents, interesAnual, plazoMeses }) {
  const cuotaCents = calcularCuotaHipoteca(precioCents, interesAnual, plazoMeses)
  const tabla = generarTablaAmortizacion({ principalCents: precioCents, interesAnual, plazoMeses })
  const { totalInteresCents, totalPagadoCents } = calcularResumenHipoteca(tabla, precioCents)
  return {
    principalCents: precioCents,
    cuotaCents,
    totalInteresCents,
    totalPagadoCents,
    entradaCashCents: 0,
  }
}

/**
 * Financiación Dual — Préstamo Público al 0%
 *
 * DOS deudas separadas con dos tablas de amortización distintas.
 * El DTI se calcula con la suma de ambas cuotas.
 *
 * ≠ Aval ICO: aquí sí existe un segundo préstamo (crédito público al 0%).
 *
 * Ejemplo (Castilla-La Mancha / Familias con menores):
 *   • Banco 80%  → tipo de mercado, Sistema Francés
 *   • Público 20% → 0% de interés, amortización lineal (principal / plazo)
 *
 * @param {object} config
 * @param {number} config.precioCents
 * @param {number} config.interesAnual           - Tipo del préstamo bancario (ej: 3.0)
 * @param {number} config.plazoMeses             - Plazo de ambos préstamos (ej: 360)
 * @param {number} [config.ltvBanco]             - % financiado por banco (default 0.80)
 * @param {number} [config.ltvCreditoPublico]    - % del crédito público (default 0.20)
 * @param {number} [config.interesCreditoPublico]- Tipo del crédito público (default 0)
 * @returns {object} Desglose completo de ambas fuentes de financiación
 */
export function calcularFinanciacionDual({
  precioCents,
  interesAnual,
  plazoMeses,
  ltvBanco = 0.80,
  ltvCreditoPublico = 0.20,
  interesCreditoPublico = 0,
}) {
  const principalBancoCents   = Math.round(precioCents * ltvBanco)
  const principalPublicoCents = Math.round(precioCents * ltvCreditoPublico)
  const entradaCashCents      = Math.max(0, precioCents - principalBancoCents - principalPublicoCents)

  const cuotaBancoCents = calcularCuotaHipoteca(principalBancoCents, interesAnual, plazoMeses)

  // Crédito público al 0%: cuota = principal / plazo (sin intereses)
  const cuotaPublicaCents = interesCreditoPublico === 0
    ? Math.round(principalPublicoCents / plazoMeses)
    : calcularCuotaHipoteca(principalPublicoCents, interesCreditoPublico, plazoMeses)

  const cuotaTotalCents = cuotaBancoCents + cuotaPublicaCents

  // Intereses totales: solo el banco genera intereses; crédito público = 0
  const tablaBanco = generarTablaAmortizacion({ principalCents: principalBancoCents, interesAnual, plazoMeses })
  const { totalInteresCents: interesesBancoCents } = calcularResumenHipoteca(tablaBanco, principalBancoCents)

  // Comparativa vs. hipoteca 100% bancaria
  const cuota100BancoCents   = calcularCuotaHipoteca(precioCents, interesAnual, plazoMeses)
  const tabla100             = generarTablaAmortizacion({ principalCents: precioCents, interesAnual, plazoMeses })
  const { totalInteresCents: intereses100 } = calcularResumenHipoteca(tabla100, precioCents)
  const ahorroCuotaMensualCents  = cuota100BancoCents - cuotaTotalCents
  const ahorroInteresesCents     = intereses100 - interesesBancoCents

  return {
    // Fuentes de financiación
    principalBancoCents,
    principalPublicoCents,
    entradaCashCents,
    ltvBanco,
    ltvCreditoPublico,
    interesCreditoPublico,
    // Cuotas
    cuotaBancoCents,
    cuotaPublicaCents,
    cuotaTotalCents,
    // Costes totales
    interesesBancoCents,
    totalInteresesCents: interesesBancoCents,   // crédito público sin intereses
    totalPagadoCents: principalBancoCents + interesesBancoCents + principalPublicoCents,
    // Ventaja vs. 100% bancario
    ahorroCuotaMensualCents,
    ahorroInteresesCents,
  }
}

/** Alias de compatibilidad — usar calcularFinanciacionDual en código nuevo */
export const calcularFinanciacionICO = calcularFinanciacionDual

/**
 * Gastos que el comprador SIEMPRE debe pagar en efectivo,
 * independientemente del nivel de financiación (incluso con 100% LTV).
 *
 * Incluye: impuestos (ITP/IVA/AJD) + notaría + registro + gestoría + tasación
 *          + comisión agente inmobiliario (si aplica)
 *
 * NO incluye: reforma, entrada / down payment (estos pueden financiarse)
 *
 * @param {object} config
 * @param {number} config.precioCents
 * @param {string} [config.ccaa]
 * @param {string} [config.tipoTransmision]
 * @param {number} [config.tasacionCents]      - null = auto
 * @param {number} [config.comisionAgentePct]  - 0 si no hay comisión
 * @returns {{ totalCents, desglose }}
 */
export function calcularGastosInaplazables({
  precioCents,
  ccaa = 'Madrid',
  tipoTransmision = 'segunda_mano',
  tasacionCents = null,
  comisionAgentePct = 0,
}) {
  const { desglose: dl } = calcularGastosCompraLegales({
    precioCents,
    ccaa,
    tipoTransmision,
    incluirTasacion: true,
    incluirBroker: false,
    tasacionCents,
  })

  const desglose = { ...dl }

  if (comisionAgentePct > 0) {
    desglose['Comisión agente'] = calcularComisionAgente(precioCents, comisionAgentePct)
  }

  const totalCents = Object.values(desglose).reduce((s, v) => s + v, 0)
  return { totalCents, desglose }
}

/**
 * Genera los 3 casos de compra del Excel (80%, 90%, 100% del precio)
 * Replicado de la hoja "Presupuesto-Casa" columnas de casos
 *
 * @param {object} config
 * @param {number} config.precioCents
 * @param {number} config.interesAnual
 * @param {number} config.plazoMeses
 * @param {number} config.gastosCompraCents  - ITP + Notaría + Broker + Gestoría
 * @param {number} config.reformaCents
 * @returns {Array} 3 escenarios con métricas calculadas
 */
export function generarCasosDeCompra({ precioCents, interesAnual, plazoMeses, gastosCompraCents, reformaCents }) {
  const ltvs = [
    { label: 'Caso 1 – 80%', pct: 0.80, color: 'var(--accent-green)' },
    { label: 'Caso 2 – 90%', pct: 0.90, color: 'var(--accent-gold)' },
    { label: 'Caso 3 – 100% (ICO)', pct: 1.00, color: 'var(--accent-terra)' },
  ]

  return ltvs.map(({ label, pct, color }) => {
    const prestamoCents = Math.round(precioCents * pct)
    const entradaCents = precioCents - prestamoCents
    const cuotaCents = calcularCuotaHipoteca(prestamoCents, interesAnual, plazoMeses)
    const inversionCents = entradaCents + gastosCompraCents + reformaCents
    const tabla = generarTablaAmortizacion({ principalCents: prestamoCents, interesAnual, plazoMeses })
    const { totalInteresCents } = calcularResumenHipoteca(tabla, prestamoCents)
    const totalPagadoBancoCents = prestamoCents + totalInteresCents

    return {
      label,
      color,
      pct,
      prestamoCents,
      entradaCents,
      cuotaCents,
      inversionCents,
      totalInteresCents,
      totalPagadoBancoCents,
    }
  })
}

// ── Supabase CRUD ─────────────────────────────────────────────────────────────

export async function getInmuebles() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data, error } = await supabase
    .from('inmuebles')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getInmueble(id) {
  const { data, error } = await supabase
    .from('inmuebles')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createInmueble(payload) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data, error } = await supabase
    .from('inmuebles')
    .insert({ ...payload, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInmueble(id, payload) {
  const { data, error } = await supabase
    .from('inmuebles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteInmueble(id) {
  const { error } = await supabase.from('inmuebles').delete().eq('id', id)
  if (error) throw error
}

/**
 * Registrar compra de forma atómica vía RPC de Supabase:
 *  1. Marca el inmueble como 'comprado'
 *  2. Registra la salida de la entrada del ahorro (movimientos)
 */
export async function registrarCompra(inmuebleId) {
  const { data, error } = await supabase.rpc('registrar_compra_inmueble', {
    p_inmueble_id: inmuebleId,
  })
  if (error) throw error
  return data
}

/**
 * Lee el total ahorrado del usuario desde la tabla de metas
 * (integra con la meta de "compra de casa" existente en la app)
 */
/**
 * Devuelve las metas activas del usuario para el selector de vínculo.
 */
export async function getMetas() {
  try {
    const { data, error } = await supabase
      .from('metas')
      .select('id, nombre, emoji, actual, meta, color, estado')
    if (error) { console.error('[getMetas]', error); return [] }
    return data ?? []
  } catch (e) {
    console.error('[getMetas]', e)
    return []
  }
}

export async function getTotalAhorrado() {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0
    const { data } = await supabase
      .from('metas')
      .select('actual')
      .eq('user_id', user.id)
    if (!data || data.length === 0) return 0
    return data.reduce((acc, m) => acc + toCents(m.actual || 0), 0)
  } catch {
    return 0
  }
}
