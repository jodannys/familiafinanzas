'use client'
import { useMemo, useState, useEffect } from 'react'
import { Edit3, Trash2, CheckCircle, AlertTriangle, TrendingUp, Home, Building2, Percent, Wallet, Calendar, FileDown, RefreshCw, Sliders, BarChart2, Receipt, Plus, ArrowDownCircle, ArrowUpCircle, Activity } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
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
  calcularIRPFAlquiler,
  calcularAmortizacionFiscal,
  calcularPlusvaliaVenta,
  calcularPayback,
  calcularTresCapasRentabilidad,
  calcularRefinanciacion,
  generarEvolucionPatrimonio,
} from '@/lib/inmuebles'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import TablaAmortizacion from './TablaAmortizacion'
import { toast } from '@/lib/toast'

export default function SimuladorPanel({ inmueble, metas = [], onEdit, onDelete, onComprado }) {
  const [tab, setTab] = useState('hipoteca')
  const [confirmandoCompra, setConfirmandoCompra] = useState(false)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [procesando, setProcesando] = useState(false)
  const [gastosReales, setGastosReales] = useState([])
  const [tipoMarginal, setTipoMarginal] = useState(30)
  const [inquilinoVH, setInquilinoVH] = useState(true)
  // ── Modo real (inversión) ──
  const [estadoAlquiler, setEstadoAlquiler] = useState(inmueble.estado_alquiler || 'ocupado')
  const [rentasReales, setRentasReales] = useState([])    // tipo_inmueble = 'renta_cobrada'
  const [gastosInmueble, setGastosInmueble] = useState([]) // tipo_inmueble = 'gasto_inmueble'
  const [registrando, setRegistrando] = useState(null)    // null | 'renta' | 'gasto'
  const [formReal, setFormReal] = useState({ monto: '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) })
  const [guardandoReal, setGuardandoReal] = useState(false)

  const { datos_compra: dc, hipoteca: hip, alquiler_config: al, tipo, estado } = inmueble
  const fi = hip

  // ── Valores base ──
  const precioCents = toCents(dc?.precio || 0)
  const gastosCompraCents = toCents(dc?.gastos_compra || 0)
  const reformaCents = toCents(dc?.reforma || 0)
  const aportacionCents = toCents(dc?.aportacion_inicial || 0)
  const principalCents = toCents(hip?.principal || 0)
  const interesAnual = parseFloat(hip?.interes_anual || 3)
  const plazoMeses = parseInt(hip?.plazo_meses || 360)
  const fechaInicio = hip?.fecha_inicio || null

  // ── Financiación especial ──
  const modoFinanciacion = fi?.modo_financiacion || (fi?.aval_ico ? 'dual' : 'ninguna')
  const usarAvalICO = modoFinanciacion === 'aval_ico'
  const usarDual = modoFinanciacion === 'dual'

  const dualData = useMemo(() => usarDual ? calcularFinanciacionDual({
    precioCents, interesAnual, plazoMeses,
    ltvBanco: fi?.ltv_banco ?? 0.80,
    ltvCreditoPublico: fi?.credito_publico?.ltv ?? 0.20,
    interesCreditoPublico: fi?.credito_publico?.interes_anual ?? 0,
  }) : null, [usarDual, precioCents, interesAnual, plazoMeses, fi?.ltv_banco, fi?.credito_publico?.ltv, fi?.credito_publico?.interes_anual])

  const avalData = useMemo(() => usarAvalICO ? calcularAvalICO({ precioCents, interesAnual, plazoMeses }) : null,
    [usarAvalICO, precioCents, interesAnual, plazoMeses])

  const comisionAgenteActiva = fi?.comision_agente?.activo === true
  const comisionAgentePct = fi?.comision_agente?.pct ?? 0
  const comisionAgenteCents = comisionAgenteActiva ? calcularComisionAgente(precioCents, comisionAgentePct) : 0
  const inversionTotalCents = calcularInversionTotal({ precioCents, gastosCompraCents, reformaCents, comisionAgenteCents })
  const efectivoDesembolsadoCents = aportacionCents + gastosCompraCents + reformaCents + comisionAgenteCents

  const cuotaCents = usarDual ? dualData.cuotaTotalCents
    : usarAvalICO ? avalData.cuotaCents
    : calcularCuotaHipoteca(principalCents, interesAnual, plazoMeses)

  const tasacionCents = toCents(dc?.tasacion || (precioCents > toCents(300000) ? 540 : 450))
  const gastosInaplazables = calcularGastosInaplazables({
    precioCents, ccaa: dc?.ccaa, tipoTransmision: dc?.tipo_transmision,
    tasacionCents, comisionAgentePct: comisionAgenteActiva ? comisionAgentePct : 0,
  })

  const tabla = useMemo(() =>
    generarTablaAmortizacion({ principalCents, interesAnual, plazoMeses, fechaInicio }),
    [principalCents, interesAnual, plazoMeses, fechaInicio])
  const resumen = useMemo(() => calcularResumenHipoteca(tabla, principalCents), [tabla, principalCents])
  const ltvInicial = calcularLTV(principalCents, precioCents)
  const mes20 = calcularMesParaEl20(tabla, toCents((dc?.precio || 0) * 0.20))

  // ── NOI y Cashflow (inversión) ──
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
  const rentabilidadNeta = noi ? calcularRentabilidadNeta(cashflowMensualCents * 12, efectivoDesembolsadoCents) : null

  // ── Análisis Fiscal (inversión) ──
  const amortFiscal = noi ? calcularAmortizacionFiscal({ precioCents, gastosCompraCents }) : null
  const interesAnualCents = tabla.length > 0 ? tabla[0].interesCents * 12 : 0
  const irpf = noi ? calcularIRPFAlquiler({
    ingresosBrutosCents: noi.ingresosBrutosCents,
    gastosTotalesCents: noi.gastosTotalesCents,
    interesHipotecaAnualCents: interesAnualCents,
    amortizacionFiscalCents: amortFiscal?.amortizacionAnualCents || 0,
    viviendaHabitual: inquilinoVH,
    tipoMarginal,
  }) : null

  const cashflowPostIrpfMensualCents = irpf ? cashflowMensualCents - irpf.irpfMensualCents : null

  // ── 3 capas de rentabilidad ──
  const tresCapas = noi ? calcularTresCapasRentabilidad({
    ingresosBrutosCents: noi.ingresosBrutosCents,
    noiAnualCents: noi.noiAnualCents,
    cashflowAnualCents: cashflowMensualCents * 12,
    precioCents,
    inversionTotalCents,
    efectivoDesembolsadoCents,
  }) : null

  // ── Payback ──
  const payback = noi && cashflowMensualCents > 0
    ? calcularPayback(efectivoDesembolsadoCents, cashflowMensualCents)
    : null

  // ── Evolución patrimonio ──
  const evolucion = useMemo(() => generarEvolucionPatrimonio({
    precioCents, tabla, revalorizacionAnual: 2,
  }), [precioCents, tabla])

  // ── Casos de compra (vivienda habitual) ──
  const casos = tipo === 'vivienda_habitual'
    ? generarCasosDeCompra({ precioCents, interesAnual, plazoMeses, gastosCompraCents, reformaCents })
    : null

  // ── Movimientos reales vinculados al inmueble ──
  async function cargarMovimientosReales() {
    try {
      const { data, error } = await supabase
        .from('movimientos')
        .select('id, descripcion, monto, fecha, tipo_inmueble')
        .eq('inmueble_id', inmueble.id)
        .order('fecha', { ascending: false })
        .limit(50)
      if (error) return
      const todos = data || []
      setRentasReales(todos.filter(m => m.tipo_inmueble === 'renta_cobrada'))
      setGastosInmueble(todos.filter(m => m.tipo_inmueble === 'gasto_inmueble'))
      setGastosReales(todos)
    } catch (e) { console.warn('[inmuebles] movimientos:', e?.message) }
  }

  useEffect(() => { cargarMovimientosReales() }, [inmueble.id])

  // ── Alerta LTV < 80% ──
  const mesBajoEl80 = useMemo(() => {
    if (ltvInicial <= 80) return null
    const umbral = precioCents * 0.80
    for (const f of tabla) {
      const deudaRestante = f.saldoCents
      if (deudaRestante <= umbral) return f.mes
    }
    return null
  }, [tabla, precioCents, ltvInicial])

  // ── Tabs ──
  const TABS = [
    { id: 'hipoteca',     label: 'Hipoteca',    icon: Home },
    { id: 'amortizacion', label: 'Cuotas',      icon: Calendar },
    ...(tipo === 'vivienda_habitual' ? [{ id: 'casos',     label: 'Casos',     icon: BarChart2 }] : []),
    ...(tipo === 'inversion'         ? [{ id: 'inversion', label: 'Inversión', icon: TrendingUp }] : []),
    ...(tipo === 'inversion'         ? [{ id: 'real',      label: 'Real',      icon: Activity }] : []),
    { id: 'fiscal',      label: 'Fiscal',       icon: Receipt },
    { id: 'patrimonio',  label: 'Patrimonio',   icon: BarChart2 },
    { id: 'refin',       label: 'Refinanciar',  icon: RefreshCw },
    { id: 'venta',       label: 'Venta',        icon: TrendingUp },
  ]

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

  function handlePrint() {
    window.print()
  }

  async function handleToggleEstadoAlquiler() {
    const nuevo = estadoAlquiler === 'ocupado' ? 'vacante' : 'ocupado'
    setEstadoAlquiler(nuevo)
    await supabase.from('inmuebles').update({ estado_alquiler: nuevo }).eq('id', inmueble.id)
  }

  async function handleGuardarMovReal() {
    if (!formReal.monto || parseFloat(formReal.monto) <= 0) return
    setGuardandoReal(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast('No autenticado'); return }
      const esRenta = registrando === 'renta'
      const { error } = await supabase.from('movimientos').insert({
        monto:         parseFloat(formReal.monto),
        descripcion:   formReal.descripcion || (esRenta ? 'Renta cobrada' : 'Gasto inmueble'),
        fecha:         formReal.fecha,
        tipo:          esRenta ? 'ingreso' : 'gasto',
        categoria:     esRenta ? 'inversion' : 'necesidades',
        quien:         'Ambos',
        inmueble_id:   inmueble.id,
        tipo_inmueble: esRenta ? 'renta_cobrada' : 'gasto_inmueble',
        user_id:       user.id,
      })
      if (error) { toast(error.message); return }
      toast(esRenta ? 'Renta registrada' : 'Gasto registrado', 'success')
      setRegistrando(null)
      setFormReal({ monto: '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) })
      cargarMovimientosReales()
    } catch (e) {
      toast(e.message || 'Error al guardar')
    } finally {
      setGuardandoReal(false)
    }
  }

  return (
    <div>

      {/* ── Subheader ── */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusTag dot={estado === 'comprado' ? 'var(--accent-green)' : 'var(--accent-main)'}
            label={estado === 'comprado' ? 'Comprado' : 'En análisis'} />
          {usarAvalICO && <StatusTag dot="var(--accent-violet)" label="Aval ICO" />}
          {usarDual    && <StatusTag dot="var(--accent-violet)" label="Dual 0%" />}
          {comisionAgenteActiva && <StatusTag dot="var(--accent-main)" label={`Bróker ${comisionAgentePct}%`} />}
          {mesBajoEl80 && (
            <StatusTag dot="var(--accent-main)"
              label={`LTV < 80% en mes ${mesBajoEl80}`} />
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={handlePrint} className="w-7 h-7 rounded-lg flex items-center justify-center print:hidden"
            title="Exportar PDF"
            style={{ background: 'var(--progress-track)', color: 'var(--text-muted)' }}>
            <FileDown size={13} />
          </button>
          {estado !== 'comprado' && (
            <>
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
                    style={{ background: 'var(--progress-track)', color: 'var(--text-muted)' }}>No</button>
                  <button onClick={() => onDelete(inmueble.id)}
                    className="px-2 h-7 rounded-lg text-xs font-black"
                    style={{ background: 'var(--accent-rose)', color: 'var(--text-on-dark)' }}>Borrar</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Meta vinculada ── */}
      {(() => {
        const meta = metas.find(m => m.id === inmueble.meta_id)
        if (!meta) return null
        const necesarioCents = toCents(dc?.aportacion_inicial || 0) + toCents(dc?.gastos_compra || 0) + toCents(dc?.reforma || 0) + comisionAgenteCents
        const actualCents = toCents(meta.actual)
        const diferencia = actualCents - necesarioCents
        const viable = diferencia >= 0
        const pct = necesarioCents > 0 ? Math.min(100, Math.round((actualCents / necesarioCents) * 100)) : 0
        const color = viable ? 'var(--accent-green)' : 'var(--accent-main)'
        return (
          <div className="rounded-xl p-4 border mb-4"
            style={{ borderColor: `color-mix(in srgb, ${color}, transparent 70%)`, background: `color-mix(in srgb, ${color}, transparent 93%)` }}>
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
            <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: 'var(--progress-track)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
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
            <div className="rounded-lg px-3 py-2 flex items-center justify-between"
              style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
              <p className="text-xs font-bold" style={{ color }}>
                {viable ? 'Margen (sobrante)' : 'Aún te faltan'}
              </p>
              <p className="text-sm font-black" style={{ color }}>{formatCurrency(fromCents(Math.abs(diferencia)))}</p>
            </div>
          </div>
        )
      })()}

      {/* ── Métricas principales ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden mb-4" style={{ background: 'var(--border-glass)' }}>
        <MetricCell icon={Wallet} label="Cuota mensual" value={formatCurrency(fromCents(cuotaCents))} color="var(--accent-main)" />
        <MetricCell icon={Percent} label="LTV inicial" value={`${ltvInicial}%`} color={ltvInicial > 80 ? 'var(--accent-rose)' : 'var(--accent-green)'} />
        <MetricCell icon={Calendar} label="Hito 20%"
          value={mes20 ? `${Math.floor(mes20 / 12)}a ${mes20 % 12}m` : 'N/A'}
          sub={mes20 ? `mes ${mes20}` : undefined}
          color="var(--accent-main)" />
        {tipo === 'inversion' && cashflowMensualCents !== null
          ? <MetricCell icon={TrendingUp} label="CF post-IRPF"
              value={cashflowPostIrpfMensualCents !== null ? formatCurrency(fromCents(cashflowPostIrpfMensualCents)) : formatCurrency(fromCents(cashflowMensualCents))}
              color={cashflowPostIrpfMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'} />
          : <MetricCell icon={TrendingUp} label="Total intereses" value={formatCurrency(fromCents(resumen.totalInteresCents))} color="var(--accent-rose)" />
        }
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-4 overflow-x-auto no-scrollbar p-1 rounded-xl" style={{ background: 'var(--progress-track)' }}>
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className="flex-shrink-0 flex-1 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all rounded-lg whitespace-nowrap"
            style={{
              letterSpacing: '0.07em',
              background: tab === t.id ? 'var(--bg-card)' : 'transparent',
              color: tab === t.id ? 'var(--accent-main)' : 'var(--text-muted)',
              boxShadow: tab === t.id ? 'var(--shadow-sm)' : 'none',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido ── */}
      <div>

        {/* Tab: Hipoteca */}
        {tab === 'hipoteca' && (
          <div className="space-y-4">
            {usarAvalICO && avalData && (
              <div className="rounded-2xl p-4 border space-y-3"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)', background: 'color-mix(in srgb, var(--accent-violet), transparent 94%)' }}>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--accent-violet)', letterSpacing: '0.12em' }}>Aval ICO — Garantía del Estado · 1 sola hipoteca</p>
                <div className="space-y-1">
                  <CasoRow label="Préstamo (100% LTV)" value={formatCurrency(fromCents(avalData.principalCents))} bold />
                  <CasoRow label="Cuota mensual" value={formatCurrency(fromCents(avalData.cuotaCents))} bold />
                  <CasoRow label="Total intereses" value={formatCurrency(fromCents(avalData.totalInteresCents))} />
                  <CasoRow label="Total pagado" value={formatCurrency(fromCents(avalData.totalPagadoCents))} />
                  <CasoRow label="Entrada cash requerida" value="0 €" bold />
                </div>
              </div>
            )}
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
                  <div className="flex-1 py-1 px-2 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)' }}>
                    <p className="text-xs font-black" style={{ color: 'var(--accent-green)' }}>{formatCurrency(fromCents(dualData.ahorroCuotaMensualCents))}/mes menos</p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>vs. hipoteca 100%</p>
                  </div>
                  <div className="flex-1 py-1 px-2 rounded-lg text-center" style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)' }}>
                    <p className="text-xs font-black" style={{ color: 'var(--accent-green)' }}>{formatCurrency(fromCents(dualData.ahorroInteresesCents))} menos</p>
                    <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>en intereses totales</p>
                  </div>
                </div>
              </div>
            )}
            {(usarAvalICO || usarDual) && (
              <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-rose), transparent 65%)', background: 'color-mix(in srgb, var(--accent-rose), transparent 93%)' }}>
                <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--accent-rose)', letterSpacing: '0.1em' }}>Efectivo mínimo inaplazable</p>
                <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>Aunque financies el 100% del precio, siempre necesitas este efectivo:</p>
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
            {comisionAgenteActiva && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between border"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 78%)', background: 'color-mix(in srgb, var(--accent-main), transparent 94%)' }}>
                <div>
                  <p className="text-xs font-black" style={{ color: 'var(--accent-main)' }}>Comisión bróker inmobiliario ({comisionAgentePct}%)</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sumada a la inversión total · Reduce ROI</p>
                </div>
                <p className="text-sm font-black" style={{ color: 'var(--accent-main)' }}>{formatCurrency(fromCents(comisionAgenteCents))}</p>
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
            {/* Alerta LTV < 80% */}
            {mesBajoEl80 && (
              <div className="rounded-xl px-4 py-3 border"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 70%)', background: 'color-mix(in srgb, var(--accent-main), transparent 92%)' }}>
                <p className="text-xs font-black" style={{ color: 'var(--accent-main)' }}>💡 Hito: LTV baja del 80% en el mes {mesBajoEl80} ({Math.floor(mesBajoEl80 / 12)} años)</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  A partir de ese momento puedes negociar mejores condiciones con el banco (reducción de diferencial, cancelación de vinculaciones).
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Cuotas */}
        {tab === 'amortizacion' && (
          <TablaAmortizacion principalCents={principalCents} interesAnual={interesAnual} plazoMeses={plazoMeses} fechaInicio={fechaInicio} />
        )}

        {/* Tab: Casos */}
        {tab === 'casos' && casos && (
          <div className="space-y-4">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Comparativa de los 3 escenarios con el mismo precio ({formatCurrency(fromCents(precioCents))})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {casos.map(caso => (
                <div key={caso.pct} className="rounded-2xl p-4 border"
                  style={{ borderColor: caso.color, background: `color-mix(in srgb, ${caso.color}, transparent 94%)` }}>
                  <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: caso.color, letterSpacing: '0.1em' }}>{caso.label}</p>
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

        {/* Tab: Inversión */}
        {tab === 'inversion' && noi && (
          <div className="space-y-5">
            {/* 3 capas rentabilidad */}
            {tresCapas && (
              <div className="grid grid-cols-3 gap-px rounded-xl overflow-hidden" style={{ background: 'var(--border-glass)' }}>
                <div className="p-3 text-center" style={{ background: 'var(--bg-card)' }}>
                  <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Rentab. bruta</p>
                  <p className="text-lg font-black mt-1" style={{ color: 'var(--accent-blue)', letterSpacing: '-0.03em' }}>{tresCapas.brutaPct}%</p>
                  <p style={{ fontSize: 8, color: 'var(--text-muted)' }}>Ingr / Precio</p>
                </div>
                <div className="p-3 text-center" style={{ background: 'var(--bg-card)' }}>
                  <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Rentab. neta</p>
                  <p className="text-lg font-black mt-1" style={{ color: 'var(--accent-main)', letterSpacing: '-0.03em' }}>{tresCapas.netaPct}%</p>
                  <p style={{ fontSize: 8, color: 'var(--text-muted)' }}>NOI / Inversión</p>
                </div>
                <div className="p-3 text-center" style={{ background: 'var(--bg-card)' }}>
                  <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Cash-on-Cash</p>
                  <p className="text-lg font-black mt-1" style={{ color: 'var(--accent-main)', letterSpacing: '-0.03em' }}>{tresCapas.cocPct}%</p>
                  <p style={{ fontSize: 8, color: 'var(--text-muted)' }}>CF / Efectivo</p>
                </div>
              </div>
            )}

            {/* Payback */}
            {payback && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between border"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-violet), transparent 75%)', background: 'color-mix(in srgb, var(--accent-violet), transparent 93%)' }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>Periodo de recuperación</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Meses para recuperar el efectivo invertido</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black" style={{ color: 'var(--accent-violet)', letterSpacing: '-0.03em' }}>
                    {payback.años}a {payback.mesesRestantes}m
                  </p>
                  <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>mes {payback.meses}</p>
                </div>
              </div>
            )}
            {!payback && cashflowMensualCents <= 0 && (
              <div className="rounded-xl px-4 py-3 border"
                style={{ borderColor: 'color-mix(in srgb, var(--accent-rose), transparent 70%)', background: 'color-mix(in srgb, var(--accent-rose), transparent 93%)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--accent-rose)' }}>⚠ Cashflow negativo — no hay periodo de recuperación</p>
              </div>
            )}

            {/* NOI */}
            <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 80%)', background: 'color-mix(in srgb, var(--accent-main), transparent 94%)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--accent-main)', letterSpacing: '0.12em' }}>NOI — Net Operating Income</p>
              <div className="space-y-1">
                <CasoRow label="Renta mensual bruta" value={formatCurrency(fromCents(toCents(al?.renta_mensual || 0)))} />
                <CasoRow label="Meses ocupados / año" value={`${al?.meses_ocupados || 11} meses`} />
                <div className="my-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 80%)' }} />
                <CasoRow label="Ingresos brutos anuales" value={formatCurrency(fromCents(noi.ingresosBrutosCents))} bold />
                <CasoRow label="Gastos operativos anuales" value={formatCurrency(fromCents(noi.gastosTotalesCents))} />
                {noi.gestionAnualCents > 0 && <CasoRow label="  · Gestión agencia" value={formatCurrency(fromCents(noi.gestionAnualCents))} />}
                <div className="my-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 80%)' }} />
                <CasoRow label="NOI anual" value={formatCurrency(fromCents(noi.noiAnualCents))} bold />
                <CasoRow label="NOI mensual (media)" value={formatCurrency(fromCents(noi.noiMensualCents))} bold />
              </div>
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 80%)' }}>
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

            {/* Gastos reales vinculados */}
            {gastosReales.length > 0 && (
              <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-blue), transparent 75%)', background: 'color-mix(in srgb, var(--accent-blue), transparent 94%)' }}>
                <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--accent-blue)', letterSpacing: '0.12em' }}>Gastos reales registrados</p>
                <div className="space-y-1">
                  {gastosReales.map(g => (
                    <div key={g.id} className="flex items-center justify-between py-1">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{g.descripcion}</p>
                        <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>{g.fecha}</p>
                      </div>
                      <p className="text-xs font-black flex-shrink-0 ml-2" style={{ color: 'var(--accent-rose)' }}>−{formatCurrency(g.monto)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Real (inversión) */}
        {tab === 'real' && tipo === 'inversion' && (() => {
          const anio = new Date().getFullYear()
          const rentasAnio = rentasReales.filter(r => r.fecha?.startsWith(String(anio)))
          const gastosAnio = gastosInmueble.filter(g => g.fecha?.startsWith(String(anio)))
          const rentaRealCents = rentasAnio.reduce((s, r) => s + toCents(r.monto), 0)
          const gastoRealCents = gastosAnio.reduce((s, g) => s + toCents(g.monto), 0)
          const cashflowRealCents = rentaRealCents - gastoRealCents
          const mesActual = new Date().getMonth() + 1
          const rentaProyYtdCents = noi ? Math.round(noi.noiMensualCents * mesActual) : 0
          const rentaBrutaProyYtdCents = al ? toCents(al.renta_mensual || 0) * mesActual : 0
          return (
            <div className="space-y-4">
              {/* Estado alquiler */}
              <div className="rounded-xl p-4 border flex items-center justify-between"
                style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-card)' }}>
                <div>
                  <p className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>Estado del inmueble</p>
                  <p className="text-xs mt-0.5" style={{ color: estadoAlquiler === 'ocupado' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                    {estadoAlquiler === 'ocupado' ? '● Ocupado — inquilino activo' : '○ Vacante — sin inquilino'}
                  </p>
                </div>
                <button type="button" onClick={handleToggleEstadoAlquiler}
                  className="relative w-12 h-6 rounded-full transition-all flex-shrink-0"
                  style={{ background: estadoAlquiler === 'ocupado' ? 'var(--accent-green)' : 'var(--progress-track)', border: 'none', cursor: 'pointer' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                    style={{ background: 'var(--bg-card)', left: estadoAlquiler === 'ocupado' ? 'calc(100% - 22px)' : '2px', boxShadow: 'var(--shadow-sm)' }} />
                </button>
              </div>

              {/* Resumen YTD */}
              <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-blue), transparent 75%)', background: 'color-mix(in srgb, var(--accent-blue), transparent 94%)' }}>
                <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--accent-blue)', letterSpacing: '0.12em' }}>Real {anio} — {mesActual} meses</p>
                <div className="space-y-2">
                  {/* Rentas */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>Rentas cobradas</span>
                      <span className="font-black" style={{ color: rentaRealCents >= rentaBrutaProyYtdCents ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                        {formatCurrency(fromCents(rentaRealCents))} / {formatCurrency(fromCents(rentaBrutaProyYtdCents))}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                      <div className="h-full rounded-full" style={{ width: `${rentaBrutaProyYtdCents > 0 ? Math.min(100, Math.round(rentaRealCents / rentaBrutaProyYtdCents * 100)) : 0}%`, background: 'var(--accent-green)' }} />
                    </div>
                  </div>
                  {/* Gastos */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>Gastos reales</span>
                      <span className="font-black" style={{ color: 'var(--accent-rose)' }}>{formatCurrency(fromCents(gastoRealCents))}</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 flex justify-between" style={{ borderColor: 'color-mix(in srgb, var(--accent-blue), transparent 75%)' }}>
                    <span className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>Cashflow real neto</span>
                    <span className="text-sm font-black" style={{ color: cashflowRealCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                      {formatCurrency(fromCents(cashflowRealCents))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>NOI proyectado YTD</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(rentaProyYtdCents))}</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setRegistrando('renta'); setFormReal({ monto: String(al?.renta_mensual || ''), descripcion: 'Renta cobrada', fecha: new Date().toISOString().slice(0, 10) }) }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black"
                  style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)', color: 'var(--accent-green)', border: 'none', cursor: 'pointer' }}>
                  <ArrowDownCircle size={15} /> Registrar renta
                </button>
                <button type="button" onClick={() => { setRegistrando('gasto'); setFormReal({ monto: '', descripcion: '', fecha: new Date().toISOString().slice(0, 10) }) }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black"
                  style={{ background: 'color-mix(in srgb, var(--accent-rose), transparent 88%)', color: 'var(--accent-rose)', border: 'none', cursor: 'pointer' }}>
                  <ArrowUpCircle size={15} /> Registrar gasto
                </button>
              </div>

              {/* Mini formulario inline */}
              {registrando && (
                <div className="rounded-xl p-4 border space-y-3" style={{ borderColor: registrando === 'renta' ? 'color-mix(in srgb, var(--accent-green), transparent 70%)' : 'color-mix(in srgb, var(--accent-rose), transparent 70%)', background: 'var(--bg-card)' }}>
                  <p className="text-xs font-black" style={{ color: registrando === 'renta' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                    {registrando === 'renta' ? '+ Renta cobrada' : '− Gasto del inmueble'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <input type="number" placeholder="Importe" min={0} step={1} className="ff-input w-full pr-7"
                        value={formReal.monto} onChange={e => setFormReal(p => ({ ...p, monto: e.target.value }))} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>€</span>
                    </div>
                    <input type="date" className="ff-input w-full"
                      value={formReal.fecha} onChange={e => setFormReal(p => ({ ...p, fecha: e.target.value }))} />
                  </div>
                  <input type="text" placeholder="Descripción (opcional)" className="ff-input w-full"
                    value={formReal.descripcion} onChange={e => setFormReal(p => ({ ...p, descripcion: e.target.value }))} />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleGuardarMovReal} disabled={guardandoReal}
                      className="flex-1 py-2 rounded-lg text-xs font-black"
                      style={{ background: registrando === 'renta' ? 'var(--accent-green)' : 'var(--accent-rose)', color: 'var(--text-on-dark)', border: 'none', cursor: 'pointer', opacity: guardandoReal ? 0.6 : 1 }}>
                      {guardandoReal ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button type="button" onClick={() => setRegistrando(null)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: 'var(--progress-track)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Historial */}
              {(rentasReales.length > 0 || gastosInmueble.length > 0) && (
                <div className="space-y-2">
                  <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Historial</p>
                  {[...rentasReales, ...gastosInmueble]
                    .sort((a, b) => b.fecha?.localeCompare(a.fecha))
                    .slice(0, 15)
                    .map(m => (
                      <div key={m.id} className="flex items-center justify-between py-1.5 border-b" style={{ borderColor: 'var(--border-glass)' }}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{m.descripcion}</p>
                          <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>{m.fecha}</p>
                        </div>
                        <p className="text-xs font-black flex-shrink-0 ml-2"
                          style={{ color: m.tipo_inmueble === 'renta_cobrada' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                          {m.tipo_inmueble === 'renta_cobrada' ? '+' : '−'}{formatCurrency(m.monto)}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* Tab: Fiscal (inversión) */}
        {tab === 'fiscal' && tipo === 'inversion' && noi && irpf && (
          <div className="space-y-4">

            {/* Config fiscal */}
            <div className="rounded-xl p-4 border space-y-3" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-card)' }}>
              <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Configuración fiscal</p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>El inquilino usa el piso como VH</p>
                  <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>Activa la reducción del 60% en base imponible</p>
                </div>
                <button onClick={() => setInquilinoVH(v => !v)} type="button"
                  className="flex-shrink-0 relative w-10 h-6 rounded-full transition-all"
                  style={{ background: inquilinoVH ? 'var(--accent-green)' : 'var(--progress-track)', border: 'none', cursor: 'pointer' }}>
                  <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                    style={{ background: 'var(--bg-card)', left: inquilinoVH ? 'calc(100% - 22px)' : '2px', boxShadow: 'var(--shadow-sm)' }} />
                </button>
              </div>
              <div>
                <label className="ff-label">Tu tipo marginal IRPF (%)</label>
                <input type="number" step={1} min={19} max={47} className="ff-input" value={tipoMarginal}
                  onChange={e => setTipoMarginal(Number(e.target.value))} />
              </div>
            </div>

            <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-blue), transparent 75%)', background: 'color-mix(in srgb, var(--accent-blue), transparent 94%)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--accent-blue)', letterSpacing: '0.12em' }}>IRPF — Rendimientos Capital Inmobiliario</p>
              <div className="space-y-1">
                <CasoRow label="Ingresos brutos" value={formatCurrency(fromCents(noi.ingresosBrutosCents))} />
                <CasoRow label="Gastos operativos deducibles" value={`− ${formatCurrency(fromCents(noi.gastosTotalesCents))}`} />
                <CasoRow label="Intereses hipoteca (año 1)" value={`− ${formatCurrency(fromCents(interesAnualCents))}`} />
                <CasoRow label="Amortización fiscal (3%)" value={`− ${formatCurrency(fromCents(amortFiscal?.amortizacionAnualCents || 0))}`} />
                <div className="my-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-blue), transparent 75%)' }} />
                <CasoRow label="Rendimiento neto" value={formatCurrency(fromCents(irpf.rendimientoNetoCents))} bold />
                {inquilinoVH && irpf.reduccionCents > 0
                  ? <CasoRow label="Reducción 60% (inquilino VH)" value={`− ${formatCurrency(fromCents(irpf.reduccionCents))}`} />
                  : <CasoRow label="Reducción 60% (no aplica — turístico/comercial)" value="0 €" />
                }
                <div className="my-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-blue), transparent 75%)' }} />
                <CasoRow label="Base imponible reducida" value={formatCurrency(fromCents(irpf.baseReducidaCents))} bold />
                <CasoRow label="Tipo marginal aplicado" value={`${tipoMarginal}%`} />
                <CasoRow label="IRPF anual estimado" value={formatCurrency(fromCents(irpf.irpfAnualCents))} bold />
                <CasoRow label="IRPF mensual" value={formatCurrency(fromCents(irpf.irpfMensualCents))} />
              </div>
            </div>

            <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 75%)', background: 'color-mix(in srgb, var(--accent-main), transparent 94%)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--accent-main)', letterSpacing: '0.12em' }}>Amortización Fiscal del Inmueble</p>
              <div className="space-y-1">
                <CasoRow label="Precio + gastos compra" value={formatCurrency(fromCents(precioCents + gastosCompraCents))} />
                <CasoRow label="% valor construcción (70%)" value={formatCurrency(fromCents(amortFiscal?.baseAmortizacion || 0))} />
                <CasoRow label="Tasa amortización anual" value="3%" />
                <div className="my-1 border-t" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 75%)' }} />
                <CasoRow label="Deducción anual" value={formatCurrency(fromCents(amortFiscal?.amortizacionAnualCents || 0))} bold />
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                Esta deducción reduce la base imponible cada año, mejorando el resultado fiscal aunque no genere un gasto real de caja.
              </p>
            </div>

            {/* Cashflow pre vs post IRPF */}
            <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden" style={{ background: 'var(--border-glass)' }}>
              <div className="p-4" style={{ background: 'var(--bg-card)' }}>
                <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>CF pre-IRPF / mes</p>
                <p className="text-xl font-black mt-1" style={{ color: cashflowMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', letterSpacing: '-0.03em' }}>
                  {formatCurrency(fromCents(cashflowMensualCents))}
                </p>
              </div>
              <div className="p-4" style={{ background: 'var(--bg-card)' }}>
                <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>CF post-IRPF / mes</p>
                <p className="text-xl font-black mt-1" style={{ color: cashflowPostIrpfMensualCents >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', letterSpacing: '-0.03em' }}>
                  {formatCurrency(fromCents(cashflowPostIrpfMensualCents))}
                </p>
              </div>
            </div>

            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              * Los intereses hipotecarios deducibles disminuyen cada año. El IRPF mostrado corresponde al primer año.
              Consulta con un asesor fiscal para tu situación concreta.
            </p>
          </div>
        )}

        {/* Tab: Fiscal (vivienda habitual) */}
        {tab === 'fiscal' && tipo === 'vivienda_habitual' && (
          <div className="space-y-4">

            {/* No tributas por IRPF */}
            <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-green), transparent 70%)', background: 'color-mix(in srgb, var(--accent-green), transparent 93%)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--accent-green)', letterSpacing: '0.12em' }}>✅ Sin IRPF por uso propio</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Al vivir en el inmueble no generas rendimientos de capital inmobiliario. No tienes que declarar nada a Hacienda por el simple hecho de habitarlo.
              </p>
            </div>

            {/* Deducción pre-2013 */}
            <div className="rounded-2xl p-4 border" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-card)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>Deducción por inversión en vivienda habitual</p>
              <div className="flex items-start gap-2 mb-2">
                <span className="text-base flex-shrink-0">❌</span>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Eliminada para compras desde el 1 de enero de 2013. Al comprar ahora <strong>no puedes aplicar esta deducción</strong> en la declaración de la renta.
                </p>
              </div>
              <p style={{ fontSize: 9, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Solo pueden seguir aplicándola quienes compraron y dedujeron antes del 01/01/2013 y mantienen el régimen transitorio.
              </p>
            </div>

            {/* Gastos reales (informativos, no deducibles) */}
            <div className="rounded-2xl p-4 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 80%)', background: 'color-mix(in srgb, var(--accent-main), transparent 94%)' }}>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--accent-main)', letterSpacing: '0.12em' }}>Gastos de propiedad — no deducibles</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                No reducen tu IRPF, pero son costes reales que debes presupuestar cada año:
              </p>
              <div className="space-y-1">
                <CasoRow label="IBI (0,4 – 1,1% valor catastral aprox.)" value="Ver recibo municipal" />
                <CasoRow label="Comunidad de propietarios" value="Depende del edificio" />
                <CasoRow label="Seguro multirriesgo hogar" value="~200 – 500 €/año" />
                <CasoRow label="Intereses hipoteca" value="No deducibles (compra post-2013)" />
              </div>
            </div>

            {/* Tip: si la alquilas en el futuro */}
            <div className="rounded-xl px-4 py-3 border" style={{ borderColor: 'color-mix(in srgb, var(--accent-main), transparent 78%)', background: 'color-mix(in srgb, var(--accent-main), transparent 94%)' }}>
              <p className="text-xs font-black" style={{ color: 'var(--accent-main)' }}>💡 Si en el futuro la alquilas</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Pasarías a generar rendimientos de capital inmobiliario sujetos a IRPF. Cambia el tipo a <strong>Inversión</strong> para ver el análisis fiscal completo: deducibles, amortización fiscal y cashflow post-impuestos.
              </p>
            </div>
          </div>
        )}

        {/* Tab: Patrimonio */}
        {tab === 'patrimonio' && (
          <PatrimonioTab evolucion={evolucion} precioCents={precioCents} tabla={tabla} />
        )}

        {/* Tab: Refinanciar */}
        {tab === 'refin' && (
          <RefinanciacionTab
            saldoPendienteCents={tabla.length > 0 ? tabla[0].saldoCents + tabla[0].capitalCents : principalCents}
            interesActual={interesAnual}
            mesesRestantes={plazoMeses}
          />
        )}

        {/* Tab: Venta */}
        {tab === 'venta' && (
          <VentaTab
            precioCents={precioCents}
            gastosCompraCents={gastosCompraCents}
            reformaCents={reformaCents}
            tabla={tabla}
            plazoMeses={plazoMeses}
            esViviendaHabitual={tipo === 'vivienda_habitual'}
          />
        )}

      </div>

      {/* ── Registrar Compra ── */}
      {estado === 'simulacion' && (
        <div className="mt-4">
          {!confirmandoCompra ? (
            <button onClick={() => setConfirmandoCompra(true)}
              className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
              style={{ background: 'var(--accent-main)', color: 'var(--text-on-dark)' }}>
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
                  style={{ background: 'var(--accent-rose)', color: 'var(--text-on-dark)', opacity: procesando ? 0.7 : 1 }}>
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

// ── Tab: Evolución del Patrimonio ─────────────────────────────────────────────
function PatrimonioTab({ evolucion, precioCents, tabla }) {
  const [revalPct, setRevalPct] = useState(2)

  const datos = useMemo(() => generarEvolucionPatrimonio({
    precioCents, tabla, revalorizacionAnual: revalPct,
  }), [precioCents, tabla, revalPct])

  const chartData = datos.map(p => ({
    año: `Año ${p.año}`,
    'Valor mercado': Math.round(fromCents(p.valorMercadoCents)),
    'Deuda': Math.round(fromCents(p.deudaCents)),
    'Patrimonio neto': Math.round(fromCents(p.patrimonioCents)),
  }))

  const patrimonioFinal = datos[datos.length - 1]?.patrimonioCents || 0

  return (
    <div className="space-y-4">
      {/* Slider revalorización */}
      <div className="rounded-xl p-4 border" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-card)' }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Revalorización anual estimada</p>
          <p className="text-sm font-black" style={{ color: 'var(--accent-main)' }}>{revalPct}%</p>
        </div>
        <input type="range" min={0} max={8} step={0.5} value={revalPct}
          onChange={e => setRevalPct(parseFloat(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--accent-main)' }} />
        <div className="flex justify-between mt-1">
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>0%</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>8%</span>
        </div>
      </div>

      {/* Métrica final */}
      <div className="grid grid-cols-2 gap-px rounded-xl overflow-hidden" style={{ background: 'var(--border-glass)' }}>
        <div className="p-3" style={{ background: 'var(--bg-card)' }}>
          <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Patrimonio al pagar</p>
          <p className="text-lg font-black mt-1" style={{ color: 'var(--accent-green)', letterSpacing: '-0.03em' }}>{formatCurrency(fromCents(patrimonioFinal))}</p>
        </div>
        <div className="p-3" style={{ background: 'var(--bg-card)' }}>
          <p style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Precio compra</p>
          <p className="text-lg font-black mt-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{formatCurrency(fromCents(precioCents))}</p>
        </div>
      </div>

      {/* Gráfico */}
      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradValor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="gradDeuda" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-rose)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--accent-rose)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-glass)" />
            <XAxis dataKey="año" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)', borderRadius: 12, fontSize: 11 }}
              formatter={(v) => [`${formatCurrency(v)}`, undefined]}
            />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Area type="monotone" dataKey="Valor mercado" stroke="var(--accent-blue)" fill="url(#gradValor)" strokeWidth={2} />
            <Area type="monotone" dataKey="Deuda" stroke="var(--accent-rose)" fill="url(#gradDeuda)" strokeWidth={2} />
            <Area type="monotone" dataKey="Patrimonio neto" stroke="var(--accent-green)" fill="url(#gradPatrimonio)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Tab: Refinanciación ───────────────────────────────────────────────────────
function RefinanciacionTab({ saldoPendienteCents, interesActual, mesesRestantes }) {
  const [interesNuevo, setInteresNuevo] = useState(String(Math.max(0.5, interesActual - 1)))
  const [costeManual, setCosteManual] = useState('')

  const resultado = useMemo(() => {
    const tipo = parseFloat(interesNuevo)
    if (!tipo || tipo <= 0 || tipo >= interesActual) return null
    return calcularRefinanciacion({
      saldoPendienteCents,
      interesActual,
      interesNuevo: tipo,
      mesesRestantes,
      costeSubrogacionCents: costeManual ? toCents(costeManual) : null,
    })
  }, [saldoPendienteCents, interesActual, interesNuevo, mesesRestantes, costeManual])

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Simula si merece la pena renegociar o subrogar la hipoteca a un tipo menor.
      </p>

      <div className="space-y-3">
        <div>
          <label className="ff-label">Tipo actual: {interesActual}% · Tipo nuevo (%)</label>
          <input type="number" step={0.05} min={0.5} max={interesActual - 0.05}
            className="ff-input" value={interesNuevo}
            onChange={e => setInteresNuevo(e.target.value)} />
        </div>
        <div>
          <label className="ff-label">Coste de subrogación/novación (€) — vacío = 1% del saldo</label>
          <input type="number" step={100} className="ff-input" value={costeManual}
            onChange={e => setCosteManual(e.target.value)} placeholder="Automático (1% saldo)" />
        </div>
      </div>

      {resultado && (
        <div className="space-y-3">
          <div className={`rounded-xl px-4 py-3 text-center font-black text-sm ${resultado.merece ? '' : ''}`}
            style={{
              background: resultado.merece ? 'color-mix(in srgb, var(--accent-green), transparent 88%)' : 'color-mix(in srgb, var(--accent-rose), transparent 88%)',
              color: resultado.merece ? 'var(--accent-green)' : 'var(--accent-rose)',
            }}>
            {resultado.merece ? '✓ MERECE LA PENA REFINANCIAR' : '✕ NO COMPENSA EN ESTE PLAZO'}
          </div>
          <div className="rounded-2xl p-4 border" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-card)' }}>
            <div className="space-y-1">
              <CasoRow label="Cuota actual" value={formatCurrency(fromCents(resultado.cuotaActualCents))} />
              <CasoRow label="Cuota nueva" value={formatCurrency(fromCents(resultado.cuotaNuevaCents))} bold />
              <CasoRow label="Ahorro mensual" value={formatCurrency(fromCents(resultado.ahorrMensualCents))} bold />
              <div className="my-1 border-t" style={{ borderColor: 'var(--border-glass)' }} />
              <CasoRow label="Coste subrogación" value={formatCurrency(fromCents(resultado.costeSubrogacionCents))} />
              {resultado.mesesBreakeven && (
                <CasoRow label="Break-even (meses para cubrir coste)" value={`${resultado.mesesBreakeven} meses`} bold />
              )}
              <CasoRow label="Ahorro total en intereses" value={formatCurrency(fromCents(resultado.ahorroInteresesCents))} bold />
            </div>
          </div>
        </div>
      )}
      {!resultado && parseFloat(interesNuevo) >= interesActual && (
        <p className="text-xs text-center" style={{ color: 'var(--accent-rose)' }}>El tipo nuevo debe ser menor al actual ({interesActual}%)</p>
      )}
    </div>
  )
}

// ── Tab: Venta ────────────────────────────────────────────────────────────────
function VentaTab({ precioCents, gastosCompraCents, reformaCents, tabla, plazoMeses, esViviendaHabitual = false }) {
  const [precioVenta, setPrecioVenta] = useState(String(Math.round(fromCents(precioCents) * 1.15)))
  const [añosVenta, setAñosVenta] = useState('10')
  const [comisionVentaPct, setComisionVentaPct] = useState('3')
  const [reinvierteVH, setReinvierteVH] = useState(false)
  const [mayores65, setMayores65] = useState(false)

  const irpfExento = esViviendaHabitual && (reinvierteVH || mayores65)

  const resultado = useMemo(() => {
    const años = parseInt(añosVenta) || 10
    const mesBuscar = Math.min(años * 12 - 1, tabla.length - 1)
    const deudaPendienteCents = mesBuscar >= 0 ? tabla[mesBuscar]?.saldoCents || 0 : 0
    return calcularPlusvaliaVenta({
      precioCents,
      gastosCompraCents,
      reformaCents,
      precioVentaCents: toCents(precioVenta),
      deudaPendienteCents,
      comisionVentaPct: parseFloat(comisionVentaPct) || 3,
      añosPropiedad: años,
    })
  }, [precioVenta, añosVenta, comisionVentaPct, precioCents, gastosCompraCents, reformaCents, tabla])

  return (
    <div className="space-y-4">
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Simula cuánto obtendrías vendiendo el inmueble en un año concreto, descontando impuestos y gastos.
      </p>

      {/* Exenciones IRPF — solo vivienda habitual */}
      {esViviendaHabitual && (
        <div className="rounded-2xl p-4 border space-y-3"
          style={{ borderColor: 'color-mix(in srgb, var(--accent-green), transparent 70%)', background: 'color-mix(in srgb, var(--accent-green), transparent 93%)' }}>
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--accent-green)', letterSpacing: '0.12em' }}>
            Exenciones IRPF — Vivienda Habitual
          </p>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Reinviertes en otra VH en 2 años</p>
              <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>Exención total si reinviertes en tu próxima vivienda habitual</p>
            </div>
            <button onClick={() => setReinvierteVH(v => !v)} type="button"
              className="flex-shrink-0 relative w-10 h-6 rounded-full transition-all"
              style={{ background: reinvierteVH ? 'var(--accent-green)' : 'var(--progress-track)', border: 'none', cursor: 'pointer' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                style={{ background: 'var(--bg-card)', left: reinvierteVH ? 'calc(100% - 22px)' : '2px', boxShadow: 'var(--shadow-sm)' }} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Tienes más de 65 años</p>
              <p style={{ fontSize: 9, color: 'var(--text-muted)' }}>Exención total sin ninguna condición adicional</p>
            </div>
            <button onClick={() => setMayores65(v => !v)} type="button"
              className="flex-shrink-0 relative w-10 h-6 rounded-full transition-all"
              style={{ background: mayores65 ? 'var(--accent-green)' : 'var(--progress-track)', border: 'none', cursor: 'pointer' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                style={{ background: 'var(--bg-card)', left: mayores65 ? 'calc(100% - 22px)' : '2px', boxShadow: 'var(--shadow-sm)' }} />
            </button>
          </div>
          {irpfExento && resultado && (
            <div className="rounded-xl px-3 py-2 text-center font-black text-xs"
              style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 80%)', color: 'var(--accent-green)' }}>
              ✅ EXENTO — ahorras {formatCurrency(fromCents(resultado.irpfVentaCents))} en IRPF
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="ff-label">Precio de venta (€)</label>
          <input type="number" className="ff-input" value={precioVenta} onChange={e => setPrecioVenta(e.target.value)} />
        </div>
        <div>
          <label className="ff-label">Año de venta</label>
          <input type="number" className="ff-input" min={1} max={Math.round(plazoMeses / 12)} value={añosVenta} onChange={e => setAñosVenta(e.target.value)} />
        </div>
        <div>
          <label className="ff-label">Comisión agente venta (%)</label>
          <input type="number" step={0.5} className="ff-input" value={comisionVentaPct} onChange={e => setComisionVentaPct(e.target.value)} />
        </div>
      </div>

      {resultado && (
        <div className="rounded-2xl p-4 border space-y-1" style={{ borderColor: 'var(--border-glass)', background: 'var(--bg-card)' }}>
          <CasoRow label="Precio de venta" value={formatCurrency(fromCents(resultado.precioVentaCents))} />
          <CasoRow label={`Deuda pendiente (año ${añosVenta})`} value={`− ${formatCurrency(fromCents(resultado.deudaPendienteCents))}`} />
          <CasoRow label="Comisión agente" value={`− ${formatCurrency(fromCents(resultado.comisionVentaCents))}`} />
          <CasoRow label="Plusvalía municipal (est.)" value={`− ${formatCurrency(fromCents(resultado.plusvaliaMunicipalCents))}`} />
          <CasoRow label="Ganancia patrimonial" value={formatCurrency(fromCents(resultado.gananciaPatrimonialCents))} bold />
          {irpfExento
            ? <CasoRow label="IRPF sobre la ganancia" value="0 € (exento)" />
            : <CasoRow label="IRPF sobre la ganancia" value={`− ${formatCurrency(fromCents(resultado.irpfVentaCents))}`} />
          }
          <div className="my-1 border-t" style={{ borderColor: 'var(--border-glass)' }} />
          <CasoRow label="Liquidez neta (en tu cuenta)"
            value={formatCurrency(fromCents(irpfExento
              ? resultado.liquidezNetaCents + resultado.irpfVentaCents
              : resultado.liquidezNetaCents))}
            bold />
          <div className="mt-3 flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border-glass)' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>ROI total</span>
            <span className="text-xl font-black" style={{ color: resultado.roiTotal >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)', letterSpacing: '-0.03em' }}>
              {resultado.roiTotal}%
            </span>
          </div>
        </div>
      )}
      <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
        * Plusvalía municipal es una estimación (varía por municipio y valor catastral). Consulta con asesor fiscal.
      </p>
    </div>
  )
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

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
      <p className="text-sm font-bold" style={{ color: accent ? 'var(--accent-main)' : 'var(--text-primary)' }}>{value}</p>
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
