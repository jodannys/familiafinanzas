import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// FIX 1: manejar null, undefined y NaN
export function formatCurrency(amount, currency = 'EUR') {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0,00 €'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num)
}

export function formatPercent(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function getMonthName(month) {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
  return months[month]
}

export function getCurrentMonth() {
  const now = new Date()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function calculateCompoundInterest({ principal, monthlyContribution, annualRate, years, compound = true }) {
  const p  = parseFloat(principal) || 0
  const mc = parseFloat(monthlyContribution) || 0
  const r  = (parseFloat(annualRate) || 0) / 100

  // garantizar años positivos y al menos 1
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
        // FIX #5: fórmula cerrada exacta para evitar acumulación de error flotante
        // FV = P*(1+rm)^12 + mc*((1+rm)^12 - 1)/rm   donde rm = r/12
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

// FIX 4: usar CSS vars del tema en vez de hex hardcodeados
export const CATEGORY_CONFIG = {
  basicos:   { label: 'Básicos',        color: 'var(--accent-blue)',   icon: 'Home'       },
  deseo:     { label: 'Estilo de vida', color: 'var(--accent-violet)', icon: 'Sparkles'   },
  ahorro:    { label: 'Ahorro / Metas', color: 'var(--accent-green)',  icon: 'PiggyBank'  },
  inversion: { label: 'Inversión',      color: 'var(--accent-gold)',   icon: 'TrendingUp' },
  deuda:     { label: 'Deudas',         color: 'var(--accent-rose)',   icon: 'CreditCard' },
}

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