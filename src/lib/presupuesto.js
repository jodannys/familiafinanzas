import { supabase } from './supabase'

export async function getPresupuestoMes() {
  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()
  

  const [{ data: movsData }, { data: bloquesData }, { data: subData }] = await Promise.all([
    supabase.from('movimientos')
      .select('tipo, monto')
      .gte('fecha', `${año}-${String(mes).padStart(2,'0')}-01`)
      .lte('fecha', `${año}-${String(mes).padStart(2,'0')}-31`),
    supabase.from('presupuesto_bloques').select('*'),
    supabase.from('presupuesto_sub').select('*').eq('bloque','futuro'),
  ])

  const ingresoReal = (movsData || [])
    .filter(m => m.tipo === 'ingreso')
    .reduce((s,m) => s + m.monto, 0)

  const pctFuturo    = (bloquesData || []).find(b => b.bloque === 'futuro')?.pct       || 30
  const pctEstilo    = (bloquesData || []).find(b => b.bloque === 'estilo')?.pct       || 20
  const pctNecesidades = (bloquesData || []).find(b => b.bloque === 'necesidades')?.pct || 50

  const montoFuturo      = ingresoReal * (pctFuturo / 100)
  const montoEstilo      = ingresoReal * (pctEstilo / 100)
  const montoNecesidades = ingresoReal * (pctNecesidades / 100)

  const pctMetas       = (subData || []).find(s => s.categoria === 'metas')?.pct       || 60
  const pctInversiones = (subData || []).find(s => s.categoria === 'inversiones')?.pct || 40

  return {
    ingresoReal,
    montoFuturo,
    montoEstilo,
    montoNecesidades,
    montoMetas:       montoFuturo * (pctMetas / 100),
    montoInversiones: montoFuturo * (pctInversiones / 100),
    pctFuturo,
    pctEstilo,
    pctNecesidades,
    pctMetas,
    pctInversiones,
  }
}