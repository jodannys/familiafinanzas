import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount, currency = 'EUR') {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
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

// Compound interest formula: A = P(1 + r/n)^(nt)
export function calculateCompoundInterest({ principal, monthlyContribution, annualRate, years }) {
  const r = annualRate / 100 / 12 // monthly rate
  const n = years * 12 // total months
  let balance = principal

  const history = [{ month: 0, balance: principal, contributed: principal, interest: 0 }]
  let totalContributed = principal

  for (let i = 1; i <= n; i++) {
    const interest = balance * r
    balance = balance + interest + monthlyContribution
    totalContributed += monthlyContribution
    if (i % 12 === 0) {
      history.push({
        month: i,
        year: i / 12,
        balance: Math.round(balance * 100) / 100,
        contributed: Math.round(totalContributed * 100) / 100,
        interest: Math.round((balance - totalContributed) * 100) / 100,
      })
    }
  }

  return { finalBalance: balance, totalContributed, totalInterest: balance - totalContributed, history }
}

export const CATEGORY_CONFIG = {
  basicos:   { label: 'Gastos Básicos',  color: '#38bdf8', icon: 'Home' },
  deseo:     { label: 'Gastos Deseo',    color: '#a78bfa', icon: 'Sparkles' },
  ahorro:    { label: 'Ahorro / Metas',  color: '#34d399', icon: 'PiggyBank' },
  inversion: { label: 'Inversión',       color: '#fbbf24', icon: 'TrendingUp' },
  deuda:     { label: 'Deudas',          color: '#fb7185', icon: 'CreditCard' },
  remesa:    { label: 'Remesas',         color: '#fb923c', icon: 'Send' },
}


export function getFlagEmoji(countryCode) {
  // 1. Si no hay código o no son exactamente 2 letras, devolver tal cual
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
    return countryCode;
  }

  // 2. Verificar si son letras de la A a la Z (códigos de país como VE, ES, AR)
  const isCountryCode = /^[a-zA-Z]{2}$/.test(countryCode);
  
  if (isCountryCode) {
    try {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
return String.fromCodePoint(...codePoints);
    } catch (e) {
      return countryCode; // Si falla el renderizado, muestra "VE" o "ES"
    }
  }

  return countryCode; // Si ya era un emoji (ej: 🏠), lo devuelve igual
}