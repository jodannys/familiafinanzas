import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utilidad para combinar clases de Tailwind de forma segura
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ─── FORMATOS DE DATOS ──────────────────────────────────────────────────────

/**
 * Formatea un número como moneda (por defecto EUR)
 * Maneja null, undefined y NaN devolviendo 0,00 €
 */
export function formatCurrency(amount, currency = 'EUR') {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0,00 €'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

/**
 * Formatea un número como porcentaje con signo + o -
 */
export function formatPercent(value) {
  if (typeof value !== 'number') return '0.0%'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

/**
 * Devuelve el nombre corto del mes
 */
export function getMonthName(month) {
  // Los meses en JS suelen ser 0-11, pero si pasas 1-12 restamos 1
  const index = month > 0 ? month - 1 : 0
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return months[index]
}

// ─── GESTIÓN DE FECHAS (SIN DESFASES UTC) ───────────────────────────────────

/**
 * Retorna el mes y año actual (formato 1-12 para el mes)
 */
export function getCurrentMonth() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

/**
 * Retorna el rango de fechas de un mes específico (YYYY-MM-DD)
 * Crucial para filtros de Supabase .gte() y .lte()
 */
export function getRangoMes(month, year) {
  const pad = (n) => String(n).padStart(2, '0')
  
  // Primer día del mes
  const inicio = `${year}-${pad(month)}-01`
  
  // Último día del mes (usando el día 0 del mes siguiente)
  const ultimoDia = new Date(year, month, 0).getDate()
  const fin = `${year}-${pad(month)}-${pad(ultimoDia)}`
  
  return { inicio, fin }
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD local
 * Evita el error de un día menos que da .toISOString()
 */
export function getFechaLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ─── CÁLCULOS FINANCIEROS ───────────────────────────────────────────────────

/**
 * Calcula el interés compuesto con aportaciones mensuales
 */
export function calculateCompoundInterest({ principal, monthlyContribution, annualRate, years, compound = true }) {
  const p  = parseFloat(principal) || 0
  const mc = parseFloat(monthlyContribution) || 0
  const r  = (parseFloat(annualRate) || 0) / 100
  const y  = Math.max(1, parseInt(years) || 10)

  let currentBalance   = p
  let totalContributed = p
  let totalInterest    = 0

  const history = [{ year: 0, balance: p, contributed: p, interest: 0 }]

  for (let i = 1; i <= y; i++) {
    const yearlyContribution = mc * 12
    let interestForYear = 0

    if (compound) {
      if (r === 0) {
        currentBalance += yearlyContribution
      } else {
        // Fórmula cerrada exacta para evitar acumulación de error flotante
        const rm = r / 12
        const balanceAtStart = currentBalance
        const factor = Math.pow(1 + rm, 12)
        const balanceFromPrincipal = currentBalance * factor
        const balanceFromContribs  = mc * (factor - 1) / rm
        currentBalance = balanceFromPrincipal + balanceFromContribs
        interestForYear = currentBalance - balanceAtStart - yearlyContribution
        totalInterest  += interestForYear
      }
    } else {
      const interestThisYear = (totalContributed + (yearlyContribution / 2)) * r
      totalInterest  += interestThisYear
      currentBalance += yearlyContribution + interestThisYear
      interestForYear = interestThisYear
    }

    totalContributed += yearlyContribution

    history.push({
      year:        i,
      balance:     currentBalance,
      contributed: totalContributed,
      interest:    interestForYear,
    })
  }

  return {
    finalBalance:     currentBalance,
    totalContributed,
    totalInterest,
    history,
  }
}

// ─── CONFIGURACIONES Y OTROS ────────────────────────────────────────────────

/**
 * Configuración visual de las categorías usando variables CSS del tema
 */
export const CATEGORY_CONFIG = {
  basicos:   { label: 'Básicos',         color: 'var(--accent-blue)',   icon: 'Home'       },
  deseo:     { label: 'Estilo de vida', color: 'var(--accent-violet)', icon: 'Sparkles'   },
  ahorro:    { label: 'Ahorro / Metas', color: 'var(--accent-green)',  icon: 'PiggyBank'  },
  inversion: { label: 'Inversión',      color: 'var(--accent-gold)',   icon: 'TrendingUp' },
  deuda:     { label: 'Deudas',          color: 'var(--accent-rose)',   icon: 'CreditCard' },
}

/**
 * Convierte un código de país (ES, PE) en su emoji de bandera
 */
export function getFlagEmoji(input) {
  if (!input) return ''
  const isLetters = /^[a-zA-Z]{2}$/.test(input)
  if (!isLetters) return input
  try {
    const codePoints = input.toUpperCase().split('').map(c => 127397 + c.charCodeAt())
    return String.fromCodePoint(...codePoints)
  } catch {
    return input
  }
}