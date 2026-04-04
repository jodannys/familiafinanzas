/**
 * insights.js — Motor de análisis financiero para el Dashboard
 *
 * Recibe los datos crudos ya cargados (movs, metas, deudas, inversiones)
 * y devuelve un objeto { insights, score } listo para renderizar.
 *
 * No hace llamadas a Supabase. Es puro cálculo determinista.
 */

// ── Constantes de referencia ────────────────────────────────────────────────

const REGLA_50_30_20 = {
  necesidades: 50,
  deseo:       30,
  futuro:      20,
}

// Umbral máximo aceptable de deuda sobre ingresos (ratio DTI)
const DTI_LIMITE = 0.36

// Puntuación base y pesos por categoría de insight
const SCORE_PESOS = {
  ahorro:      25,  // máx 25 pts — ahorra algo este mes
  gasto:       25,  // máx 25 pts — gastos bajo control
  deuda:       20,  // máx 20 pts — ratio deuda/ingresos sano
  metas:       15,  // máx 15 pts — tiene metas activas con progreso
  inversion:   15,  // máx 15 pts — invierte algo
}

// ── Tipos de severidad ───────────────────────────────────────────────────────

/** @typedef {'ok' | 'warn' | 'danger' | 'info'} InsightSeverity */

/**
 * @typedef {Object} Insight
 * @property {string}          id         — identificador único para React key
 * @property {InsightSeverity} type       — nivel visual del insight
 * @property {string}          titulo     — texto principal corto
 * @property {string}          detalle    — explicación de 1–2 líneas
 * @property {string}          [accion]   — CTA opcional (ej: "Ver metas")
 * @property {string}          [href]     — ruta a la que navega el CTA
 */

// ── Helpers internos ─────────────────────────────────────────────────────────

function pct(parte, total) {
  if (!total || total === 0) return 0
  return Math.round((parte / total) * 100)
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// ── Generador de insights ────────────────────────────────────────────────────

/**
 * Analiza los datos financieros del mes y genera insights accionables.
 *
 * @param {Object} params
 * @param {Array}  params.movsMes       — movimientos del mes actual
 * @param {Array}  params.metas         — todas las metas del usuario
 * @param {Array}  params.deudas        — deudas activas
 * @param {Array}  params.inversiones   — inversiones activas
 * @returns {{ insights: Insight[], score: number, label: string, color: string }}
 */
export function generarInsights({ movsMes = [], metas = [], deudas = [], inversiones = [] }) {
  const insights = []
  let score = 0

  // ── 1. Cifras base del mes ────────────────────────────────────────────────

  const ingresosMes = movsMes
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + (m.monto || 0), 0)

  const gastosMes = movsMes
    .filter(m => m.tipo === 'egreso' && ['basicos', 'deseo'].includes(m.categoria))
    .reduce((s, m) => s + (m.monto || 0), 0)

  const gastoDeudas = movsMes
    .filter(m => m.tipo === 'egreso' && m.categoria === 'deuda')
    .reduce((s, m) => s + (m.monto || 0), 0)

  const ahorroMes = movsMes
    .filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria))
    .reduce((s, m) => s + (m.monto || 0), 0)

  const gastoBasicos = movsMes
    .filter(m => m.tipo === 'egreso' && m.categoria === 'basicos')
    .reduce((s, m) => s + (m.monto || 0), 0)

  const gastoDeseo = movsMes
    .filter(m => m.tipo === 'egreso' && m.categoria === 'deseo')
    .reduce((s, m) => s + (m.monto || 0), 0)

  const saldoLibre = ingresosMes - gastosMes - gastoDeudas - ahorroMes

  // ── 2. Insight: Ahorro ────────────────────────────────────────────────────

  if (ingresosMes > 0) {
    const pctAhorro = pct(ahorroMes, ingresosMes)

    if (ahorroMes === 0) {
      insights.push({
        id:      'ahorro-cero',
        type:    'danger',
        titulo:  'No hay ahorro registrado este mes',
        detalle: 'Intenta reservar al menos un 10% de tus ingresos antes de gastar.',
        accion:  'Ver metas',
        href:    '/metas',
      })
      // 0 pts
    } else if (pctAhorro < 10) {
      score += Math.round(SCORE_PESOS.ahorro * 0.4)
      insights.push({
        id:      'ahorro-bajo',
        type:    'warn',
        titulo:  `Ahorrando solo el ${pctAhorro}% de tus ingresos`,
        detalle: `La regla 50/30/20 recomienda destinar el 20% al futuro. Te faltan ${20 - pctAhorro} puntos porcentuales.`,
        accion:  'Ver presupuesto',
        href:    '/presupuesto',
      })
    } else if (pctAhorro >= 20) {
      score += SCORE_PESOS.ahorro
      insights.push({
        id:      'ahorro-optimo',
        type:    'ok',
        titulo:  `Ahorro excelente: ${pctAhorro}% de tus ingresos`,
        detalle: 'Estás cumpliendo la regla del 20% para el futuro. Buen trabajo.',
      })
    } else {
      score += Math.round(SCORE_PESOS.ahorro * 0.75)
      insights.push({
        id:      'ahorro-bien',
        type:    'ok',
        titulo:  `Ahorrando el ${pctAhorro}% este mes`,
        detalle: `Buen ritmo. Para llegar al 20% necesitas ahorrar ${round2(ingresosMes * 0.20 - ahorroMes)} € más.`,
      })
    }
  }

  // ── 3. Insight: Gastos vs Regla 50/30/20 ─────────────────────────────────

  if (ingresosMes > 0) {
    const pctBasicos = pct(gastoBasicos, ingresosMes)
    const pctDeseo   = pct(gastoDeseo,   ingresosMes)

    // Gastos básicos: máx 50%
    if (pctBasicos > REGLA_50_30_20.necesidades + 10) {
      insights.push({
        id:      'basicos-alto',
        type:    'warn',
        titulo:  `Gastos básicos al ${pctBasicos}% — sobre el límite`,
        detalle: `La regla recomienda que los básicos no superen el 50% del ingreso. Revisa suscripciones y gastos fijos.`,
        accion:  'Ver gastos',
        href:    '/gastos',
      })
    } else if (pctBasicos <= REGLA_50_30_20.necesidades) {
      score += Math.round(SCORE_PESOS.gasto * 0.5)
    }

    // Estilo de vida: máx 30%
    if (pctDeseo > REGLA_50_30_20.deseo + 5) {
      insights.push({
        id:      'deseo-alto',
        type:    'warn',
        titulo:  `Estilo de vida al ${pctDeseo}% — por encima del 30%`,
        detalle: `Llevas ${pctDeseo - 30} puntos de más en gastos de deseo. Pequeños recortes tienen gran impacto.`,
        accion:  'Ver sobres',
        href:    '/sobres',
      })
    } else if (pctDeseo <= REGLA_50_30_20.deseo) {
      score += Math.round(SCORE_PESOS.gasto * 0.5)
    }
  } else {
    insights.push({
      id:      'sin-ingresos',
      type:    'info',
      titulo:  'No se han registrado ingresos este mes',
      detalle: 'Registra tus ingresos para que el análisis sea preciso.',
      accion:  'Registrar ingreso',
      href:    '/gastos',
    })
  }

  // ── 4. Insight: Deuda (DTI) ───────────────────────────────────────────────

  const cuotasTotales = deudas.reduce((s, d) => s + (d.cuota || 0), 0)

  if (deudas.length > 0 && ingresosMes > 0) {
    const dti = cuotasTotales / ingresosMes

    if (dti > DTI_LIMITE) {
      insights.push({
        id:      'dti-alto',
        type:    'danger',
        titulo:  `Carga de deuda: ${pct(cuotasTotales, ingresosMes)}% de tus ingresos`,
        detalle: `El límite recomendado es 36%. Tu ratio actual (${Math.round(dti * 100)}%) puede comprometer tu liquidez.`,
        accion:  'Ver deudas',
        href:    '/deudas',
      })
      // 0 pts en deuda
    } else if (dti > 0.20) {
      score += Math.round(SCORE_PESOS.deuda * 0.6)
      insights.push({
        id:      'dti-medio',
        type:    'info',
        titulo:  `Deudas al ${Math.round(dti * 100)}% — manejable`,
        detalle: `Estás dentro del límite. Considera acelerar el pago de la deuda con mayor interés.`,
        accion:  'Ver deudas',
        href:    '/deudas',
      })
    } else {
      score += SCORE_PESOS.deuda
      insights.push({
        id:      'dti-ok',
        type:    'ok',
        titulo:  `Carga de deuda sana: ${Math.round(dti * 100)}%`,
        detalle: `Tus cuotas representan menos del 20% de tus ingresos. Excelente control.`,
      })
    }
  } else if (deudas.length === 0) {
    score += SCORE_PESOS.deuda
    insights.push({
      id:      'sin-deudas',
      type:    'ok',
      titulo:  'Sin deudas activas',
      detalle: 'Llevas tus finanzas sin compromisos de deuda este mes.',
    })
  }

  // ── 5. Insight: Metas ─────────────────────────────────────────────────────

  const metasActivas = metas.filter(m => m.estado !== 'pausada' && (m.actual || 0) < m.meta)

  if (metasActivas.length === 0) {
    insights.push({
      id:      'sin-metas',
      type:    'info',
      titulo:  'No tienes metas de ahorro activas',
      detalle: 'Crear una meta concreta aumenta la probabilidad de alcanzarla en un 40%.',
      accion:  'Crear meta',
      href:    '/metas',
    })
    // 0 pts en metas
  } else {
    const metaConMasProgreso = metasActivas.reduce((best, m) => {
      const pctM = ((m.actual || 0) / (m.meta || 1))
      const pctBest = ((best.actual || 0) / (best.meta || 1))
      return pctM > pctBest ? m : best
    }, metasActivas[0])

    const pctMeta = pct(metaConMasProgreso.actual || 0, metaConMasProgreso.meta || 1)

    score += metaConMasProgreso ? SCORE_PESOS.metas : 0
    insights.push({
      id:      'metas-activas',
      type:    'ok',
      titulo:  `${metasActivas.length} meta${metasActivas.length > 1 ? 's' : ''} activa${metasActivas.length > 1 ? 's' : ''}`,
      detalle: `Tu meta "${metaConMasProgreso.nombre}" va al ${pctMeta}% — la más avanzada.`,
      accion:  'Ver metas',
      href:    '/metas',
    })
  }

  // ── 6. Insight: Inversiones ───────────────────────────────────────────────

  if (inversiones.length === 0) {
    insights.push({
      id:      'sin-inversiones',
      type:    'info',
      titulo:  'Sin inversiones registradas',
      detalle: 'Invertir el 10–15% de tus ingresos hoy puede transformar tu patrimonio a largo plazo.',
      accion:  'Ver inversiones',
      href:    '/inversiones',
    })
  } else {
    const capitalTotal = inversiones.reduce((s, i) => s + (i.capital || 0), 0)
    score += SCORE_PESOS.inversion
    insights.push({
      id:      'inversiones-ok',
      type:    'ok',
      titulo:  `${inversiones.length} inversión${inversiones.length > 1 ? 'es' : ''} activa${inversiones.length > 1 ? 's' : ''}`,
      detalle: `Capital total invertido: ${capitalTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.`,
      accion:  'Ver inversiones',
      href:    '/inversiones',
    })
  }

  // ── 7. Insight: Saldo libre ───────────────────────────────────────────────

  if (ingresosMes > 0 && saldoLibre < 0) {
    insights.push({
      id:      'saldo-negativo',
      type:    'danger',
      titulo:  'Gastas más de lo que ingresas',
      detalle: `Te sobrepasas por ${Math.abs(saldoLibre).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} este mes. Revisa tus gastos de inmediato.`,
      accion:  'Ver gastos',
      href:    '/gastos',
    })
  }

  // ── Score final ───────────────────────────────────────────────────────────

  const scoreFinal = Math.min(100, Math.max(0, score))
  const { label, color } = getScoreLabel(scoreFinal)

  return {
    insights,
    score: scoreFinal,
    label,
    color,
  }
}

/**
 * Convierte un score numérico en etiqueta y color
 * @param {number} score — 0 a 100
 * @returns {{ label: string, color: string }}
 */
export function getScoreLabel(score) {
  if (score >= 80) return { label: 'Salud excelente',   color: 'var(--accent-green)'  }
  if (score >= 60) return { label: 'Buena salud',       color: 'var(--accent-blue)'   }
  if (score >= 40) return { label: 'Mejorable',         color: 'var(--accent-gold)'   }
  if (score >= 20) return { label: 'Requiere atención', color: 'var(--accent-terra)'  }
  return              { label: 'Situación crítica',  color: 'var(--accent-rose)'   }
}
