'use client'
import { createContext, useContext, useState, useEffect } from "react";
import { MONEDAS } from '@/lib/monedas'
import { supabase } from '@/lib/supabase'

const CurrencyContext = createContext();
export { MONEDAS }

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('EUR')

  useEffect(() => {
    async function cargar() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      const { data } = await supabase
        .from('perfiles')
        .select('moneda')
        .eq('id', session.user.id)
        .single()
      if (data?.moneda) setCurrency(data.moneda)
    }
    cargar()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user?.id) { setCurrency('EUR'); return }
      supabase.from('perfiles')
        .select('moneda')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => setCurrency(data?.moneda || 'EUR'))
    })

    return () => subscription.unsubscribe()
  }, [])

  async function cambiarMoneda(code) {
    setCurrency(code)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.id) return
    await supabase
      .from('perfiles')
      .update({ moneda: code })
      .eq('id', session.user.id)
  }

  return (
    <CurrencyContext.Provider value={{ currency, cambiarMoneda, MONEDAS }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}