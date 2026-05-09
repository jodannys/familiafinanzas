'use client'
import { useCurrency } from '@/lib/CurrencyContext'
import { formatCurrency } from '@/lib/utils'

export function useFormatCurrency() {
  const { currency } = useCurrency()
  return (amount) => formatCurrency(amount, currency)
}