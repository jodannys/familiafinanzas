'use client'
import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Plus, X, Zap } from 'lucide-react'
import {
  generarTablaAmortizacion,
  calcularResumenHipoteca,
  toCents,
  fromCents,
} from '@/lib/inmuebles'
import { formatCurrency } from '@/lib/utils'

/**
 * Componente: Tabla de Amortización colapsable
 * Replica la hoja "Desglose de cuotas" del Excel
 * Soporta amortizaciones extra y compara el impacto vs. plan original.
 */
export default function TablaAmortizacion({ principalCents, interesAnual, plazoMeses, fechaInicio }) {
  const [abierta, setAbierta] = useState(false)
  const [extras, setExtras] = useState([]) // [{ mes, montoCents }]
  const [inputMes, setInputMes] = useState('')
  const [inputMonto, setInputMonto] = useState('')
  const [añoExpandido, setAñoExpandido] = useState(null)

  // ── Tablas (con y sin amortizaciones extra) ──
  const tablaSin = useMemo(() =>
    generarTablaAmortizacion({ principalCents, interesAnual, plazoMeses, fechaInicio }),
    [principalCents, interesAnual, plazoMeses, fechaInicio]
  )

  const tablaCon = useMemo(() =>
    generarTablaAmortizacion({ principalCents, interesAnual, plazoMeses, fechaInicio, amortizacionesExtra: extras }),
    [principalCents, interesAnual, plazoMeses, fechaInicio, extras]
  )

  const resumenSin = useMemo(() => calcularResumenHipoteca(tablaSin, principalCents), [tablaSin, principalCents])
  const resumenCon = useMemo(() => calcularResumenHipoteca(tablaCon, principalCents), [tablaCon, principalCents])

  const hayExtras = extras.length > 0
  const mesesAhorrados = resumenSin.mesesReales - resumenCon.mesesReales
  const interesAhorradoCents = resumenSin.totalInteresCents - resumenCon.totalInteresCents

  // Agrupar filas por año
  const tablaActiva = hayExtras ? tablaCon : tablaSin
  const porAño = useMemo(() => {
    const mapa = {}
    for (const fila of tablaActiva) {
      if (!mapa[fila.año]) mapa[fila.año] = []
      mapa[fila.año].push(fila)
    }
    return mapa
  }, [tablaActiva])

  const años = Object.keys(porAño).map(Number)

  function agregarExtra() {
    const mes = parseInt(inputMes)
    const montoCents = toCents(inputMonto)
    if (mes > 0 && mes <= plazoMeses && montoCents > 0) {
      setExtras(prev => [...prev, { mes, montoCents }])
      setInputMes('')
      setInputMonto('')
    }
  }

  function quitarExtra(idx) {
    setExtras(prev => prev.filter((_, i) => i !== idx))
  }

  // Cuota mensual normal del plan
  const cuotaBase = tablaSin[0]?.cuotaCents ?? 0

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border-glass)' }}>

      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setAbierta(v => !v)}
        className="w-full flex items-center justify-between p-4 transition-colors"
        style={{ background: 'color-mix(in srgb, var(--accent-blue), transparent 94%)', textAlign: 'left' }}>
        <div>
          <p className="font-serif text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Desglose de cuotas
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {resumenCon.añosReales} años {resumenCon.mesesRestantes > 0 ? `y ${resumenCon.mesesRestantes} meses` : ''} · {formatCurrency(fromCents(resumenCon.totalInteresCents))} en intereses
            {hayExtras && mesesAhorrados > 0 && (
              <span style={{ color: 'var(--accent-green)', marginLeft: 8 }}>
                · Ahorras {mesesAhorrados} meses con extras
              </span>
            )}
          </p>
        </div>
        {abierta ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
      </button>

      {abierta && (
        <div style={{ background: 'var(--bg-card)' }}>

          {/* Resumen de totales */}
          <div className="p-4 grid grid-cols-3 gap-3 border-b" style={{ borderColor: 'var(--border-glass)' }}>
            <Stat label="Cuota mensual" value={formatCurrency(fromCents(cuotaBase))} color="var(--accent-blue)" />
            <Stat label="Total intereses" value={formatCurrency(fromCents(resumenCon.totalInteresCents))} color="var(--accent-rose)" />
            <Stat label="Total pagado banco" value={formatCurrency(fromCents(resumenCon.totalInteresCents + principalCents))} color="var(--text-muted)" />
          </div>

          {/* Panel amortizaciones extra */}
          <div className="p-4 border-b space-y-3" style={{ borderColor: 'var(--border-glass)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Simular amortizaciones extra
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Mes (ej: 12)"
                  value={inputMes}
                  onChange={e => setInputMes(e.target.value)}
                  min={1}
                  max={plazoMeses}
                  className="ff-input w-full text-sm"
                />
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  placeholder="Importe €"
                  value={inputMonto}
                  onChange={e => setInputMonto(e.target.value)}
                  min={0}
                  className="ff-input w-full text-sm"
                />
              </div>
              <button
                type="button"
                onClick={agregarExtra}
                className="px-3 rounded-xl flex items-center gap-1 text-xs font-bold transition-all"
                style={{ background: 'var(--accent-green)', color: 'var(--text-on-dark)' }}>
                <Plus size={14} /> Añadir
              </button>
            </div>

            {extras.length > 0 && (
              <div className="space-y-1">
                {extras.map((e, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 92%)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Mes {e.mes} — {formatCurrency(fromCents(e.montoCents))}
                    </span>
                    <button type="button" onClick={() => quitarExtra(i)}>
                      <X size={12} style={{ color: 'var(--text-muted)' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {hayExtras && (
              <div className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 90%)', border: '1px solid color-mix(in srgb, var(--accent-green), transparent 80%)' }}>
                <Zap size={16} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--accent-green)' }}>
                    {mesesAhorrados > 0 ? `Ahorras ${Math.floor(mesesAhorrados / 12)} años y ${mesesAhorrados % 12} meses` : 'Sin ahorro de tiempo apreciable'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {formatCurrency(fromCents(interesAhorradoCents))} menos en intereses
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tabla por años */}
          <div className="max-h-96 overflow-y-auto">
            {años.map(año => {
              const filas = porAño[año]
              const intAño = filas.reduce((s, f) => s + f.interesCents, 0)
              const capAño = filas.reduce((s, f) => s + f.capitalCents, 0)
              const exAño = filas.reduce((s, f) => s + f.extraCents, 0)
              const abierto = añoExpandido === año

              return (
                <div key={año} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-glass)' }}>
                  {/* Fila resumen anual */}
                  <button
                    type="button"
                    onClick={() => setAñoExpandido(abierto ? null : año)}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors"
                    style={{ '--tw-hover-bg': 'transparent' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text-primary), transparent 96%)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black" style={{ color: 'var(--text-muted)' }}>{año}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                        {filas.length} cuotas · Intereses: {formatCurrency(fromCents(intAño))}
                      </span>
                      {exAño > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 90%)', color: 'var(--accent-green)' }}>
                          +{formatCurrency(fromCents(exAño))} extra
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
                        Saldo: {formatCurrency(fromCents(filas[filas.length - 1].saldoCents))}
                      </span>
                      {abierto ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
                    </div>
                  </button>

                  {/* Filas mensuales */}
                  {abierto && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: 'var(--progress-track)' }}>
                            {['Mes', 'Fecha', 'Cuota', 'Interés', 'Capital', 'Extra', 'Saldo', 'LTV%'].map(h => (
                              <th key={h} className="px-3 py-1.5 text-left font-black uppercase"
                                style={{ fontSize: 8, letterSpacing: '0.1em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map(f => {
                            const ltvPct = principalCents > 0 ? Math.round((f.saldoCents / principalCents) * 10000) / 100 : 0
                            const tieneExtra = f.extraCents > 0
                            return (
                              <tr key={f.mes} style={{ background: tieneExtra ? 'color-mix(in srgb, var(--accent-green), transparent 95%)' : undefined }}>
                                <td className="px-3 py-1.5 font-bold" style={{ color: 'var(--text-muted)' }}>{f.mes}</td>
                                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{f.fecha}</td>
                                <td className="px-3 py-1.5 font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(fromCents(f.cuotaCents))}</td>
                                <td className="px-3 py-1.5" style={{ color: 'var(--accent-rose)' }}>{formatCurrency(fromCents(f.interesCents))}</td>
                                <td className="px-3 py-1.5" style={{ color: 'var(--accent-green)' }}>{formatCurrency(fromCents(f.capitalCents))}</td>
                                <td className="px-3 py-1.5 font-bold" style={{ color: tieneExtra ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                                  {tieneExtra ? formatCurrency(fromCents(f.extraCents)) : '—'}
                                </td>
                                <td className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(f.saldoCents))}</td>
                                <td className="px-3 py-1.5" style={{ color: ltvPct < 80 ? 'var(--accent-green)' : 'var(--text-muted)' }}>{ltvPct}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <p className="text-sm font-black" style={{ color, letterSpacing: '-0.02em' }}>{value}</p>
      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
    </div>
  )
}
