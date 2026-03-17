import { supabase } from './supabase'

// FIX 3: acepta mes y año opcionales para soportar meses históricos
export async function getPresupuestoMes(mesParam = null, añoParam = null) {
  const now = new Date()
  const mes = mesParam ?? (now.getMonth() + 1)
  const año = añoParam ?? now.getFullYear()

  // FIX 1: fecha fin con último día real del mes
  const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`
  const fechaFin    = new Date(año, mes, 0).toISOString().slice(0, 10)

  const [{ data: movsData }, { data: bloquesData }, { data: subData }] = await Promise.all([
    supabase.from('movimientos')
      .select('tipo, monto')
      .gte('fecha', fechaInicio)
      .lte('fecha', fechaFin),     // FIX 1
    supabase.from('presupuesto_bloques').select('*'),
    supabase.from('presupuesto_sub').select('*').eq('bloque', 'futuro'),
  ])

  const ingresoReal = (movsData || [])
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + m.monto, 0)

  const pctFuturo      = (bloquesData || []).find(b => b.bloque === 'futuro')?.pct      || 30
  const pctEstilo      = (bloquesData || []).find(b => b.bloque === 'estilo')?.pct      || 20
  const pctNecesidades = (bloquesData || []).find(b => b.bloque === 'necesidades')?.pct || 50

  const montoFuturo      = ingresoReal * (pctFuturo / 100)
  const montoEstilo      = ingresoReal * (pctEstilo / 100)
  const montoNecesidades = ingresoReal * (pctNecesidades / 100)

  const pctMetas       = (subData || []).find(s => s.categoria === 'metas')?.pct       || 60
  const pctInversiones = (subData || []).find(s => s.categoria === 'inversiones')?.pct || 40

  return {
    total:            ingresoReal,
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
    // FIX 2: indicar si se usaron valores por defecto
    usandoDefaults: !bloquesData?.length,
  }
}