'use client'
import { useMemo, useState } from 'react'
import { Edit3, Trash2, CheckCircle, AlertTriangle, TrendingUp, Home, Building2, Percent, Wallet, Calendar } from 'lucide-react'
import {
  toCents, fromCents,
  calcularCuotaHipoteca,
  generarTablaAmortizacion,
  calcularResumenHipoteca,
  calcularMesParaEl20,
  calcularNOI,
  calcularCashflow,
  calcularRentabilidadNeta,
  calcularLTV,
  calcularInversionTotal,
  calcularAvalICO,
  calcularFinanciacionDual,
  calcularGastosInaplazables,
  calcularComisionAgente,
  generarCasosDeCompra,
  registrarCompra,
} from '@/lib/inmuebles'
import { formatCurrency } from '@/lib/utils'
import TablaAmortizacion from './TablaAmortizacion'
import { toast } from '@/lib/toast'

/**
 * Panel de simulación completo para un inmueble.
 * Replica las hojas "Desglose de cuotas", "1-Alquiler piso" y "Presupuesto-Casa".
 */
export default function SimuladorPanel({ inmueble, metas = [], onEdit, onDelete, onComprado }) {
  const [tab, setTab] = useState('hipoteca')
  const [confirmandoCompra, setConfirmandoCompra] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [procesando, setProcesando] = useState(false)

  const { datos_compra: dc, hipoteca: hip, alquiler_config: al, tipo, estado } = inmueble
  const fi = hip  // financiacion se guarda dentro de hipoteca

  // ── Valores numéricos (todos en céntimos internamente) ──
  const precioCents = toCents(dc?.precio || 0)
  const gastosCompraCents = toCents(dc?.gastos_compra || 0)
  const reformaCents = toCents(dc?.reforma || 0)
  const aportacionCents = toCents(dc?.aportacion_inicial || 0)
  const principalCents = toCents(hip?.principal || 0)
  const interesAnual = parseFloat(hip?.interes_anual || 3)
  const plazoMeses = parseInt(hip?.plazo_meses || 360)
  const fechaInicio = hip?.fecha_inicio || null

  // ── Modo de financiación especial ──
  // backward compat: si fi.aval_ico=true sin modo_financiacion, era financiación dual
  const modoFinanciacion = fi?.modo_financiacion || (fi?.aval_ico ? 'dual' : 'ninguna')
  const usarAvalICO = modoFinanciacion === 'aval_ico'
  const usarDual = modoFinanciacion === 'dual'

  const dualData = useMemo(() => usarDual ? calcularFinanciacionDual({
    precioCents,
    interesAnual,
    plazoMeses,
    ltvBanco: fi?.ltv_banco ?? 0.80,
    ltvCreditoPublico: fi?.credito_publico?.ltv ?? 0.20,
    interesCreditoPublico: fi?.credito_publico?.interes_anual ?? 0,
  }) : null, [usarDual, precioCents, interesAnual, plazoMeses, fi?.ltv_banco, fi?.credito_publico?.ltv, fi?.credito_publico?.interes_anual])

  const avalData = useMemo(() => usarAvalICO ? calcularAvalICO({
    precioCents,
    interesAnual,
    plazoMeses,
  }) : null, [usarAvalICO, precioCents, interesAnual, plazoMeses])

  // ── Comisión bróker inmobiliario (3-5%) ──
  const comisionAgenteActiva = fi?.comision_agente?.activo === true
  const comisionAgentePct = fi?.comision_agente?.pct ?? 0
  const comisionAgenteCents = comisionAgenteActiva ? calcularComisionAgente(precioCents, comisionAgentePct) : 0

  const inversionTotalCents = calcularInversionTotal({ precioCents, gastosCompraCents, reformaCents, comisionAgenteCents })

  // Cash-on-Cash: denominador = solo el efectivo que sale del bolsillo del inversor
  // = entrada + gastos compra + reforma + comisión agente (NO incluye el préstamo bancario)
  const efectivoDesembolsadoCents = aportacionCents + gastosCompraCents + reformaCents + comisionAgenteCents

  // Cuota según modo
  const cuotaCents = usarDual
    ? dualData.cuotaTotalCents
    : usarAvalICO
    ? avalData.cuotaCents
    : calcularCuotaHipoteca(principalCents, interesAnual, plazoMeses)

  // ── Gastos inaplazables (siempre en efectivo, incluso con 100% LTV) ──
  const tasacionCents = toCents(dc?.tasacion || (precioCents > toCents(300000) ? 540 : 450))
  const gastosInaplazables = calcularGastosInaplazables({
    precioCents,
    ccaa: dc?.ccaa,
    tipoTransmision: dc?.tipo_transmision,
    tasacionCents,
    comisionAgentePct: comisionAgenteActiva ? comisionAgentePct : 0,
  })

  // ── Tabla amortización (préstamo bancario) ──
  const tabla = useMemo(() =>
    generarTablaAmortizacion({ principalCents, interesAnual, plazoMeses, fechaInicio }),
    [principalCents, interesAnual, plazoMeses, fechaInicio]
  )
  const resumen = useMemo(() => calcularResumenHipoteca(tabla, principalCents), [tabla, principalCents])

  // ── LTV y hito del 20% ──
  const ltvInicial = calcularLTV(principalCents, precioCents)
  const mes20 = calcularMesParaEl20(tabla, toCents((dc?.precio || 0) * 0.20))

  // ── NOI y Cashflow (solo inversión) ──
  // El cashflow descuenta cuota total (banco + crédito público)
  const noi = tipo === 'inversion' && al ? calcularNOI({
    rentaMensualCents: toCents(al.renta_mensual || 0),
    mesesOcupados: parseInt(al.meses_ocupados || 11),
    comunidadMensualCents: toCents(al.comunidad_mensual || 0),
    mantenimientoMensualCents: toCents(al.mantenimiento_mensual || 0),
    ibiAnualCents: toCents(al.ibi_anual || 0),
    seguroAnualCents: toCents(al.seguro_anual || 0),
    gestionPct: al.gestion_pct || 0,
    seguroImpagoCents: toCents(al.seguro_impago || 0),
  }) : null

  const cashflowMensualCents = noi ? calcularCashflow(noi.noiMensualCents, cuotaCents) : null
  // ROI incluye comisión del agente en la base de cálculo
  const rentabilidadNeta = noi ? calcularRentabilidadNeta(cashflowMensualCents * 12, efectivoDesembolsadoCents) : null

  // ── Casos de compra (solo vivienda habitual) ──
  const casos = tipo === 'vivienda_habitual'
    ? generarCasosDeCompra({ precioCents, interesAnual, plazoMeses, gastosCompraCents, reformaCents })
    : null

  async function handleRegistrarCompra() {
    setProcesando(true)
    try {
      await registrarCompra(inmueble.id)
      toast('¡Compra registrada! La entrada se ha descontado de tus ahorros.', 'success')
      onComprado?.(inmueble.id)
    } catch (err) {
      toast(err.message || 'Error al registrar la compra')
    } finally {
      setProcesando(false)
      setConfirmandoCompra(false)
    }
  }

  return (
    <div>

      {/* ── Subheader: etiquetas + acciones ── */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusTag
            dot={estado === 'comprado' ? 'var(--accent-green)' : 'var(--accent-gold)'}
            label={estado === 'comprado' ? 'Comprado' : 'Simulación'}
          />
          {usarAvalICO && <StatusTag dot="var(--accent-violet)" label="Aval ICO" />}
          {usarDual    && <StatusTag dot="var(--accent-violet)" label="Dual 0%" />}
          {comisionAgenteActiva && <StatusTag dot="var(--accent-terra)" label={`Bróker ${comisionAgentePct}%`} />}
        </div>
        {estado !== 'comprado' && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => onEdit(inmueble)} className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--progress-track)', color: 'var(--text-muted)' }}>
              <Edit3 size={13} />
            </button>
            {!confirmandoEliminar ? (
              <button onClick={() => setConfirmandoEliminar(true)} className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--accent-rose), transparent 90%)', color: 'var(--accent-rose)' }}>
                <Trash2 size={13} />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={() => setConfirmandoEliminar(false)}
                  className="px-2 h-7 rounded-lg text-xs font-bold"
                  style={{ background: 'var(--progress-track)', color: 'var(--text-muted)' }}>
                  No
                </button>
                <button onClick={() => onDelete(inmueble.id)}
                  className="px-2 h-7 rounded-lg text-xs font-black"
                  style={{ background: 'var(--accent-rose)', color: '#fff' }}>
                  Borrar
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Viabilidad: meta vinculada ── */}
      {(() => {
        const meta = metas.find(m => m.id === inmueble.meta_id)
        if (!meta) return null
        const necesarioCents =
          toCents(dc?.aportacion_inicial || 0) +
          toCents(dc?.gastos_compra || 0) +
          toCents(dc?.reforma || 0) +
          comisionAgenteCents
        const actualCents = toCents(meta.actual)
        const diferencia = actualCents - necesarioCents   // positivo = sobrante, negativo = falta
        const viable = diferencia >= 0
        const pct = necesarioCents > 0 ? Math.min(100, Math.round((actualCents / necesarioCents) * 100)) : 0
        const color = viable ? 'var(--accent-green)' : 'var(--accent-terra)'
        return (
          <div className="rounded-xl p-4 border mb-4" style={{
            borderColor: `color-mix(in srgb, ${color}, transparent 70%)`,
            background: `color-mix(in srgb, ${color}, transparent 93%)`,
          }}>
            {/* Estado */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {meta.emoji || ''} {meta.nombre}
                </p>
                <p className="text-sm font-black mt-0.5" style={{ color }}>
                  {viable ? '✅ Viable — puedes comprar' : '⏳ Ahorrando…'}
                </p>
              </div>
              <p className="text-2xl font-black" style={{ color, letterSpacing: '-0.03em' }}>{pct}%</p>
            </div>
            {/* Barra */}
            <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--progress-track)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
            {/* Números */}
            <div className="flex justify-between mb-2">
              <div>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(fromCents(actualCents))}</p>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>En la hucha</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(necesarioCents))}</p>
                <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Necesario</p>
              </div>
            </div>
            {/* Margen / Faltante */}
            <div className="rounded-lg px-3 py-2 flex items-center justify-between"
              style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
              <p className="text-xs font-bold" style={{ color }}>
                {viable ? 'Margen (sobrante)' : 'Aún te faltan'}
              </p>
              <p className="text-sm font-black" style={{ color }}>
                {formatCurrency(fromCents(Math.abs(diferencia)))}
              </p>
            </div>
          </div>
        )
      })()}

      {/* ── Métricas principales ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden mb-4" style={{ background: 'var(--border-glass)' }}>
        <MetricCell icon={Wallet} label="Cuota mensual" value={formatCurrency(fromCents(cuotaCents))} color="var(--accent-terra)" />
        <MetricCell icon={Percent} label="LTV inicial" value={`${ltvInicial}%`} color={ltvInicial > 80 ? 'var(--accent-rose)' : 'var(--accent-green)'} />
        <MetricCell icon={Calendar} label="Hito 20%"
          value={mes20 ? `${Math.floor(mes20 / 12)}a ${mes20 % 12}m` : 'N/A'}
          sub={mes20 ? `mes ${mes20}` : undefined}
          color="var(--accent-gold)" />
        {tipo === 'inversion' && cashflowMensualCents !== null
          ? <MetricCell icon={TrendingUp} label="Cashflow" value={formatCurrency(fromCents(cashflowMensualCents))} color={cashflowMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'} />
          : <MetricCell icon={TrendingUp} label="Total intereses" value={formatCurrency(fromCents(resumen.totalInteresCents))} color="var(--accent-rose)" />
        }
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto no-scrollbar p-1 rounded-xl" style={{ background: 'var(--progress-track)' }}>
        {[
          { id: 'hipoteca',     label: 'Hipoteca' },
          { id: 'amortizacion', label: 'Cuotas' },
          ...(tipo === 'vivienda_habitual' ? [{ id: 'casos',     label: 'Casos' }]     : []),
          ...(tipo === 'inversion'         ? [{ id: 'inversion', label: 'Inversión' }] : []),
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex-shrink-0 flex-1 px-4 py-2 text-xs font-black uppercase tracking-wider transition-all rounded-lg whitespace-nowrap"
            style={{
              letterSpacing: '0.08em',
              background: tab === t.id ? 'var(--bg-card)' : 'transparent',
              color: tab === t.id ? 'var(--accent-terra)' : 'var(--text-muted)',
              boxShadow: tab === t.id ? 'var(--shadow-sm, 0 1px 4px rgba(0,0,0,0.10))' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido tabs ── */}
      <div>

        {/* Tab: Hipoteca */}
        {tab === 'hipoteca' && (
          <div className="space-y-4">

            {/* Bloque Aval ICO (una sola deuda al 100%) */}
            {usarAvalICO && avalData && (
              <div className="rounded-2xl p-4 border space-y-3"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)', background: 'color-mix(in srgb, var(--accent-violet), transparent 94%)' }}>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--accent-violet)', letterSpacing: '0.12em' }}>
                  Aval ICO — Garantía del Estado · 1 sola hipoteca
                </p>
                <div className="space-y-1">
                  <CasoRow label="Préstamo (100% LTV)" value={formatCurrency(fromCents(avalData.principalCents))} bold />
                  <CasoRow label="Cuota mensual" value={formatCurrency(fromCents(avalData.cuotaCents))} bold />
                  <CasoRow label="Total intereses" value={formatCurrency(fromCents(avalData.totalInteresCents))} />
                  <CasoRow label="Total pagado" value={formatCurrency(fromCents(avalData.totalPagadoCents))} />
                  <CasoRow label="Entrada cash requerida" value="0 €" bold />
                </div>
              </div>
            )}

            {/* Bloque Financiación Dual (dos deudas separadas) */}
            {usarDual && dualData && (
              <div className="rounded-2xl p-4 border space-y-3"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)', background: 'color-mix(in srgb, var(--accent-violet), transparent 94%)' }}>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--accent-violet)', letterSpacing: '0.12em' }}>
                  Financiación Dual — 2 deudas · {fi?.credito_publico?.nombre || 'Castilla-La Mancha'}
                </p>
                <div className="space-y-1">
                  <CasoRow label={`Préstamo banco (${Math.round((fi?.ltv_banco ?? 0.8) * 100)}%)`} value={formatCurrency(fromCents(dualData.principalBancoCents))} />
                  <CasoRow label={`Crédito público (${Math.round((fi?.credito_publico?.ltv ?? 0.2) * 100)}%) al ${fi?.credito_publico?.interes_anual ?? 0}%`} value={formatCurrency(fromCents(dualData.principalPublicoCents))} />
                  <CasoRow label="Cuota banco" value={formatCurrency(fromCents(dualData.cuotaBancoCents))} />
                  <CasoRow label="Cuota crédito público" value={formatCurrency(fromCents(dualData.cuotaPublicaCents))} />
                  <CasoRow label="Cuota total mensual" value={formatCurrency(fromCents(dualData.cuotaTotalCents))} bold />
                  <CasoRow label="Total intereses (banco)" value={formatCurrency(fromCents(dualData.interesesBancoCents))} />
                  <CasoRow label="Total pagado" value={formatCurrency(fromCents(dualData.totalPagadoCents))} />
                </div>
                <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)' }}>
                  <div className="flex-1 py-1 px-2 rounded-lg text-center"
                    style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)' }}>
                    <p className="text-xs font-black" style={{ color: 'var(--accent-green)' }}>
                      {formatCurrency(fromCents(dualData.ahorroCuotaMensualCents))}/mes menos
                    </p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>vs. hipoteca 100%</p>
                  </div>
                  <div className="flex-1 py-1 px-2 rounded-lg text-center"
                    style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)' }}>
                    <p className="text-xs font-black" style={{ color: 'var(--accent-green)' }}>
                      {formatCurrency(fromCents(dualData.ahorroInteresesCents))} menos
                    </p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>en intereses totales</p>
                  </div>
                </div>
              </div>
            )}

            {/* Efectivo mínimo inaplazable */}
            {(usarAvalICO || usarDual) && (
              <div className="rounded-2xl p-4 border"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-rose), transparent 65%)', background: 'color-mix(in srgb, var(--accent-rose), transparent 93%)' }}>
                <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--accent-rose)', letterSpacing: '0.1em' }}>
                  Efectivo mínimo inaplazable
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                  Aunque financies el 100% del precio, siempre necesitas este efectivo:
                </p>
                <div className="space-y-1">
                  {Object.entries(gastosInaplazables.desglose).map(([concepto, cents]) => (
                    <div key={concepto} className="flex justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{concepto}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(cents))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-rose), transparent 65%)' }}>
                    <span className="text-xs font-black" style={{ color: 'var(--accent-rose)' }}>Total inaplazable</span>
                    <span className="text-sm font-black" style={{ color: 'var(--accent-rose)' }}>{formatCurrency(fromCents(gastosInaplazables.totalCents))}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Comisión agente cuando activa */}
            {comisionAgenteActiva && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between border"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-terra), transparent 78%)', background: 'color-mix(in srgb, var(--accent-terra), transparent 94%)' }}>
                <div>
                  <p className="text-xs font-black" style={{ color: 'var(--accent-terra)' }}>
                    Comisión bróker inmobiliario ({comisionAgentePct}%)
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Sumada a la inversión total · Reduce ROI
                  </p>
                </div>
                <p className="text-sm font-black" style={{ color: 'var(--accent-terra)' }}>
                  {formatCurrency(fromCents(comisionAgenteCents))}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InfoRow label="Precio del piso" value={formatCurrency(fromCents(precioCents))} />
              <InfoRow label="Entrada (cash)" value={(usarAvalICO || usarDual) ? '0 €' : formatCurrency(fromCents(aportacionCents))} />
              <InfoRow label={usarAvalICO ? 'Préstamo (100% LTV)' : 'Préstamo banco'} value={formatCurrency(fromCents(principalCents))} />
              <InfoRow label="Gastos compra" value={formatCurrency(fromCents(gastosCompraCents))} />
              <InfoRow label="Reforma" value={formatCurrency(fromCents(reformaCents))} />
              {comisionAgenteActiva && <InfoRow label="Comisión agente" value={formatCurrency(fromCents(comisionAgenteCents))} />}
              <InfoRow label="Inversión total" value={formatCurrency(fromCents(inversionTotalCents))} accent />
              <InfoRow label="Tipo de interés" value={`${interesAnual}%`} />
              <InfoRow label="Plazo" value={`${Math.round(plazoMeses / 12)} años`} />
              <InfoRow label="Total pagado banco" value={formatCurrency(fromCents(resumen.totalInteresCents + principalCents))} />
              <InfoRow label="Inicio pagos" value={fechaInicio || '—'} />
              <InfoRow label="LTV inicial" value={`${ltvInicial}%`} accent />
            </div>
          </div>
        )}

        {/* Tab: Desglose de cuotas */}
        {tab === 'amortizacion' && (
          <TablaAmortizacion
            principalCents={principalCents}
            interesAnual={interesAnual}
            plazoMeses={plazoMeses}
            fechaInicio={fechaInicio}
          />
        )}

        {/* Tab: Casos de compra */}
        {tab === 'casos' && casos && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Comparativa de los 3 escenarios del Excel "Presupuesto-Casa" con el mismo precio ({formatCurrency(fromCents(precioCents))})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {casos.map(caso => (
                <div key={caso.pct} className="rounded-2xl p-4 border transition-all"
                  style={{ borderColor: caso.color, background: `color-mix(in srgb, ${caso.color}, transparent 94%)` }}>
                  <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: caso.color, letterSpacing: '0.1em' }}>
                    {caso.label}
                  </p>
                  <CasoRow label="Préstamo" value={formatCurrency(fromCents(caso.prestamoCents))} />
                  <CasoRow label="Entrada cash" value={formatCurrency(fromCents(caso.entradaCents))} />
                  <CasoRow label="Cuota mensual" value={formatCurrency(fromCents(caso.cuotaCents))} bold />
                  <CasoRow label="Total intereses" value={formatCurrency(fromCents(caso.totalInteresCents))} />
                  <CasoRow label="Total pagado banco" value={formatCurrency(fromCents(caso.totalPagadoBancoCents))} />
                  <CasoRow label="Desembolso inicial" value={formatCurrency(fromCents(caso.inversionCents))} bold />
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: `color-mix(in srgb, ${caso.color}, transparent 75%)` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>LTV</span>
                      <span className="text-xs font-black" style={{ color: caso.color }}>{Math.round(caso.pct * 100)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              El Caso 3 (100% ICO) no requiere entrada pero genera {formatCurrency(fromCents(casos[2].totalInteresCents - casos[0].totalInteresCents))} más en intereses que el Caso 1.
            </p>
          </div>
        )}

        {/* Tab: Análisis inversión */}
        {tab === 'inversion' && noi && (
          <div className="space-y-5">
            {/* NOI */}
            <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-gold), transparent 80%)', background: 'color-mix(in srgb, var(--accent-gold), transparent 94%)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--accent-gold)', letterSpacing: '0.12em' }}>NOI — Net Operating Income</p>
              <div className="space-y-1">
                <CasoRow label="Renta mensual bruta" value={formatCurrency(fromCents(toCents(al?.renta_mensual || 0)))} />
                <CasoRow label="Meses ocupados / año" value={`${al?.meses_ocupados || 11} meses`} />
                <div className="my-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-gold), transparent 80%)' }} />
                <CasoRow label="Ingresos brutos anuales" value={formatCurrency(fromCents(noi.ingresosBrutosCents))} bold />
                <CasoRow label="Gastos operativos anuales" value={formatCurrency(fromCents(noi.gastosTotalesCents))} />
                {noi.gestionAnualCents > 0 && (
                  <CasoRow label="  · Gestión agencia" value={formatCurrency(fromCents(noi.gestionAnualCents))} />
                )}
                <div className="my-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-gold), transparent 80%)' }} />
                <CasoRow label="NOI anual" value={formatCurrency(fromCents(noi.noiAnualCents))} bold />
                <CasoRow label="NOI mensual (media)" value={formatCurrency(fromCents(noi.noiMensualCents))} bold />
              </div>
              {/* Rango real mes a mes */}
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2" style={{ borderColor: 'color-mix(in srgb, var(--accent-gold), transparent 80%)' }}>
                <div className="rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 90%)' }}>
                  <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Mes con inquilino</p>
                  <p className="text-sm font-black" style={{ color: 'var(--accent-green)' }}>
                    {formatCurrency(fromCents(toCents(al?.renta_mensual || 0) - noi.gastosMensualesCents))}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--accent-rose), transparent 90%)' }}>
                  <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Mes vacío</p>
                  <p className="text-sm font-black" style={{ color: 'var(--accent-rose)' }}>
                    {formatCurrency(fromCents(-noi.gastosMensualesCents))}
                  </p>
                </div>
              </div>
            </div>

            {/* Cashflow */}
            <div className="rounded-2xl p-4 border" style={{
              borderColor: `color-mix(in srgb, ${cashflowMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'}, transparent 80%)`,
              background: `color-mix(in srgb, ${cashflowMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'}, transparent 94%)`
            }}>
              <p className="text-xs font-black uppercase tracking-wider mb-3"
                style={{ color: cashflowMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', letterSpacing: '0.12em' }}>
                Cash Flow = NOI − Hipoteca
              </p>
              <div className="space-y-1">
                <CasoRow label="NOI mensual (media)" value={formatCurrency(fromCents(noi.noiMensualCents))} />
                <CasoRow label="Cuota hipoteca" value={`− ${formatCurrency(fromCents(cuotaCents))}`} />
                <div className="my-1 border-t" style={{ borderColor: `color-mix(in srgb, ${cashflowMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'}, transparent 70%)` }} />
                <CasoRow label="Cash Flow mensual (media)" value={formatCurrency(fromCents(cashflowMensualCents))} bold />
                <CasoRow label="Cash Flow anual" value={formatCurrency(fromCents(cashflowMensualCents * 12))} bold />
              </div>
              {/* Rango real mes a mes */}
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2" style={{ borderColor: `color-mix(in srgb, ${cashflowMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'}, transparent 70%)` }}>
                <div className="rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 90%)' }}>
                  <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Mes con inquilino</p>
                  <p className="text-sm font-black" style={{ color: 'var(--accent-green)' }}>
                    {formatCurrency(fromCents(toCents(al?.renta_mensual || 0) - noi.gastosMensualesCents - cuotaCents))}
                  </p>
                </div>
                <div className="rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--accent-rose), transparent 90%)' }}>
                  <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>Mes vacío</p>
                  <p className="text-sm font-black" style={{ color: 'var(--accent-rose)' }}>
                    {formatCurrency(fromCents(-noi.gastosMensualesCents - cuotaCents))}
                  </p>
                </div>
              </div>
            </div>

            {/* Rentabilidad */}
            <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 80%)', background: 'color-mix(in srgb, var(--accent-violet), transparent 94%)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--accent-violet)', letterSpacing: '0.12em' }}>Rentabilidad</p>
              <div className="space-y-1">
                <CasoRow label="Efectivo desembolsado" value={formatCurrency(fromCents(efectivoDesembolsadoCents))} />
                <CasoRow label="Beneficio neto anual" value={formatCurrency(fromCents(cashflowMensualCents * 12))} />
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)' }}>
                <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Cash-on-Cash</span>
                <span className="text-2xl font-black" style={{ color: 'var(--accent-violet)', letterSpacing: '-0.03em' }}>{rentabilidadNeta}%</span>
              </div>
              <div className="mt-3 py-2 px-3 rounded-xl text-center font-black text-sm"
                style={{ background: 'color-mix(in srgb, var(--accent-violet), transparent 85%)', color: 'var(--accent-violet)' }}>
                {rentabilidadNeta >= 5 ? '✓ MANTENER / COMPRAR' : rentabilidadNeta >= 3 ? '⚠ REVISAR' : '✕ DESCARTAR'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Registrar Compra ── */}
      {estado === 'simulacion' && (
        <div className="mt-4">
          {!confirmandoCompra ? (
            <button
              onClick={() => setConfirmandoCompra(true)}
              className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
              style={{ background: 'var(--accent-terra)', color: '#fff' }}>
              <CheckCircle size={16} />
              Registrar compra real
            </button>
          ) : (
            <div className="rounded-xl p-4 border space-y-3"
              style={{ borderColor: 'color-mix(in srgb, var(--accent-rose), transparent 70%)', background: 'color-mix(in srgb, var(--accent-rose), transparent 93%)' }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} style={{ color: 'var(--accent-rose)', flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p className="text-xs font-black" style={{ color: 'var(--accent-rose)' }}>Confirmar compra</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Se descontarán {formatCurrency(fromCents(aportacionCents))} de tus ahorros y el inmueble quedará registrado como comprado.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setConfirmandoCompra(false)} className="ff-btn-ghost flex-1 text-xs py-2">Cancelar</button>
                <button onClick={handleRegistrarCompra} disabled={procesando}
                  className="flex-1 py-2 rounded-xl font-black text-xs"
                  style={{ background: 'var(--accent-rose)', color: '#fff', opacity: procesando ? 0.7 : 1 }}>
                  {procesando ? 'Procesando...' : 'Confirmar compra'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

function MetricCell({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="p-3" style={{ background: 'var(--bg-card)' }}>
      <div className="flex items-center gap-1 mb-1">
        <Icon size={11} style={{ color }} />
        <p style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</p>
      </div>
      <p className="text-sm font-black leading-tight" style={{ color, letterSpacing: '-0.02em' }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, marginTop: 1 }}>{sub}</p>}
    </div>
  )
}

function InfoRow({ label, value, accent }) {
  return (
    <div className="py-2 border-b" style={{ borderColor: 'var(--progress-track)' }}>
      <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: accent ? 'var(--accent-terra)' : 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

function StatusTag({ dot, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0, display: 'inline-block' }} />
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

function CasoRow({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`text-xs ${bold ? 'font-black' : 'font-semibold'}`} style={{ color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{value}</span>
    </div>
  )
}
