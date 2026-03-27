import { supabase } from './supabase'

// FIX 3: acepta mes y año opcionales para soportar meses históricos
export async function getPresupuestoMes(mesParam = null, añoParam = null) {
  const now = new Date()
  const mes = mesParam ?? (now.getMonth() + 1)
  const año = añoParam ?? now.getFullYear()

  // FIX 1: fecha fin con último día real del mes
  const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`
  const fechaFin    = new Date(año, mes, 0).toISOString().slice(0, 10)

  try {
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

    // Normalizar bloques principales para que siempre sumen exactamente 100%
    const totalBloques = pctFuturo + pctEstilo + pctNecesidades
    const factorBloques = totalBloques > 0 ? 100 / totalBloques : 1
    const pctFuturoN      = pctFuturo      * factorBloques
    const pctEstiloN      = pctEstilo      * factorBloques
    const pctNecesidadesN = pctNecesidades * factorBloques

    const montoFuturo      = ingresoReal * (pctFuturoN / 100)
    const montoEstilo      = ingresoReal * (pctEstiloN / 100)
    const montoNecesidades = ingresoReal * (pctNecesidadesN / 100)

    const pctMetas       = (subData || []).find(s => s.categoria === 'metas')?.pct       || 60
    const pctInversiones = (subData || []).find(s => s.categoria === 'inversiones')?.pct || 40
    // Normalizar sub-porcentajes de futuro para que también sumen 100%
    const totalSub = pctMetas + pctInversiones
    const factorSub = totalSub > 0 ? 100 / totalSub : 1
    const pctMetasN       = pctMetas       * factorSub
    const pctInversionesN = pctInversiones * factorSub

    return {
      total:            ingresoReal,
      ingresoReal,
      montoFuturo,
      montoEstilo,
      montoNecesidades,
      montoMetas:       montoFuturo * (pctMetasN / 100),
      montoInversiones: montoFuturo * (pctInversionesN / 100),
      pctFuturo:      pctFuturoN,
      pctEstilo:      pctEstiloN,
      pctNecesidades: pctNecesidadesN,
      pctMetas:       pctMetasN,
      pctInversiones: pctInversionesN,
      // FIX 2: indicar si se usaron valores por defecto
      usandoDefaults: !bloquesData?.length,
    }
  } catch (err) {
    console.error('Error en getPresupuestoMes:', err)
    return {
      total: 0, ingresoReal: 0,
      montoFuturo: 0, montoEstilo: 0, montoNecesidades: 0,
      montoMetas: 0, montoInversiones: 0,
      pctFuturo: 30, pctEstilo: 20, pctNecesidades: 50,
      pctMetas: 60, pctInversiones: 40,
      usandoDefaults: true,
    }
  }
}