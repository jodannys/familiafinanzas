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
export function calculateCompoundInterest({ principal, monthlyContribution, annualRate, years, compound = true }) {
  const p = parseFloat(principal) || 0;
  const mc = parseFloat(monthlyContribution) || 0;
  const r = (parseFloat(annualRate) || 0) / 100;
  const y = parseInt(years) || 10;

  let currentBalance = p;
  let totalContributed = p;
  let totalInterest = 0;
  
  // Guardamos el año 0 para la gráfica
  const history = [{ year: 0, balance: p, contributed: p, interest: 0 }];

  for (let i = 1; i <= y; i++) {
    let yearlyContribution = mc * 12;
    let interestForYear = 0;

    if (compound) {
      // Interés Compuesto: Calculamos mes a mes sumando las ganancias al capital
      let balanceAtStart = currentBalance;
      for (let m = 0; m < 12; m++) {
        let interestThisMonth = currentBalance * (r / 12);
        currentBalance += interestThisMonth + mc;
        totalInterest += interestThisMonth;
      }
      interestForYear = currentBalance - balanceAtStart - yearlyContribution;
    } else {
      // Interés Simple: El interés solo se calcula sobre lo que has aportado de tu bolsillo
      let interestThisYear = (totalContributed + (yearlyContribution / 2)) * r;
      totalInterest += interestThisYear;
      currentBalance += yearlyContribution + interestThisYear;
      interestForYear = interestThisYear;
    }

    totalContributed += yearlyContribution;

    history.push({
      year: i,
      balance: currentBalance,
      contributed: totalContributed,
      interest: interestForYear
    });
  }

  return {
    finalBalance: currentBalance,
    totalContributed,
    totalInterest,
    history
  };
}
export const CATEGORY_CONFIG = {
  basicos:   { label: 'Gastos Básicos',  color: '#38bdf8', icon: 'Home' },
  deseo:     { label: 'Gastos Deseo',    color: '#a78bfa', icon: 'Sparkles' },
  ahorro:    { label: 'Ahorro / Metas',  color: '#34d399', icon: 'PiggyBank' },
  inversion: { label: 'Inversión',       color: '#fbbf24', icon: 'TrendingUp' },
  deuda:     { label: 'Deudas',          color: '#fb7185', icon: 'CreditCard' },
}


export function getFlagEmoji(input) {
  if (!input || typeof input !== 'string') return input;

  // Detecta código de país de 2 letras (A-Z, case insensitive)
  if (/^[a-zA-Z]{2}$/.test(input)) {
    try {
      const codePoints = input.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      return input; // Si falla, devuelve tal cual
    }
  }

  // Si es un emoji unicode (ej: 🎯 🏠) lo dejamos tal cual
  const firstCode = input.codePointAt(0);
  if (firstCode > 127000) return input;

  // Si no es ninguno de los anteriores, devolvemos tal cual
  return input;
}