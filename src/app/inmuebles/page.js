'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Home, Building2, Target, Loader2 } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import Modal from '@/components/ui/Modal'
import { Card, Badge, ProgressBar } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import {
  getInmuebles,
  createInmueble,
  updateInmueble,
  deleteInmueble,
  getTotalAhorrado,
  getMetas,
  toCents,
  fromCents,
  calcularCuotaHipoteca,
  calcularLTV,
  calcularInversionTotal,
  calcularNOI,
  calcularCashflow,
  calcularAvalICO,
  calcularFinanciacionDual,
} from '@/lib/inmuebles'
import FormInmueble from '@/components/inmuebles/FormInmueble'
import SimuladorPanel from '@/components/inmuebles/SimuladorPanel'
import ComparadorInmuebles from '@/components/inmuebles/ComparadorInmuebles'

export default function InmueblesPage() {
  const [inmuebles, setInmuebles] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalAhorradoCents, setTotalAhorradoCents] = useState(0)
  const [metas, setMetas] = useState([])
  const [panelInmueble, setPanelInmueble] = useState(null)
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null)
  const [comparando, setComparando] = useState([]) // max 2 ids

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [data, ahorro, metasData] = await Promise.all([getInmuebles(), getTotalAhorrado(), getMetas()])
      setInmuebles(data)
      setTotalAhorradoCents(ahorro)
      setMetas(metasData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleGuardar(payload) {
    try {
      if (editando) {
        const actualizado = await updateInmueble(editando.id, payload)
        setInmuebles(prev => prev.map(i => i.id === editando.id ? actualizado : i))
        toast('Simulación actualizada', 'success')
      } else {
        const nuevo = await createInmueble(payload)
        setInmuebles(prev => [nuevo, ...prev])
        toast('Simulación creada', 'success')
      }
      setFormAbierto(false)
      setEditando(null)
    } catch (e) {
      toast(e.message || 'Error al guardar')
    }
  }

  async function handleEliminar(id) {
    try {
      await deleteInmueble(id)
      setInmuebles(prev => prev.filter(i => i.id !== id))
      if (panelInmueble?.id === id) setPanelInmueble(null)
      toast('Simulación eliminada', 'success')
    } catch (e) {
      toast(e.message || 'Error al eliminar')
    }
  }

  function handleEditar(inmueble) {
    setEditando(inmueble)
    setFormAbierto(true)
  }

  function handleComprado(id) {
    setInmuebles(prev => prev.map(i => i.id === id ? { ...i, estado: 'comprado' } : i))
    setPanelInmueble(prev => prev?.id === id ? { ...prev, estado: 'comprado' } : prev)
  }

  function handleAbrirForm() {
    setEditando(null)
    setFormAbierto(true)
  }

  // ── Inmueble de referencia para la meta (el 1er de vivienda habitual en simulación) ──
  const inmueblemeta = inmuebles.find(i => i.tipo === 'vivienda_habitual' && i.estado === 'simulacion')
  const dc = inmueblemeta?.datos_compra
  // Objetivo = entrada + gastos compra + reforma (igual que FormInmueble y SimuladorPanel)
  const entradaObjetivoCents = inmueblemeta
    ? toCents(dc?.aportacion_inicial || 0) + toCents(dc?.gastos_compra || 0) + toCents(dc?.reforma || 0)
    : 0
  // Actual = hucha vinculada si existe, si no suma total de todas las metas
  const metaVinculada = metas.find(m => m.id === inmueblemeta?.meta_id)
  const ahorroReferenceCents = metaVinculada ? toCents(metaVinculada.actual) : totalAhorradoCents

  const progressPct = entradaObjetivoCents > 0
    ? Math.min(100, Math.round((ahorroReferenceCents / entradaObjetivoCents) * 100))
    : 0

  // ── Separar por tipo/estado ──
  const viviendas = inmuebles.filter(i => i.tipo === 'vivienda_habitual')
  const inversiones = inmuebles.filter(i => i.tipo === 'inversion')

  return (
    <AppShell>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Inmuebles</h1>
        </div>
        <button
          onClick={handleAbrirForm}
          className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-semibold">Nuevo</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Meta: Entrada para la casa ── */}
          {entradaObjetivoCents > 0 && (
            <Card glow="terra">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--accent-terra), transparent 88%)', border: '1px solid color-mix(in srgb, var(--accent-terra), transparent 78%)' }}>
                  <Target size={18} style={{ color: 'var(--accent-terra)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Objetivo de compra</p>
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{inmueblemeta?.nombre}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-black" style={{ color: 'var(--accent-terra)', letterSpacing: '-0.04em', lineHeight: 1 }}>{progressPct}%</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)' }}>completado</p>
                </div>
              </div>

              {/* Barra más gruesa */}
              <div className="h-3 rounded-full overflow-hidden mb-4" style={{ background: 'var(--progress-track)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: 'var(--accent-terra)' }} />
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--progress-track)' }}>
                  <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{formatCurrency(fromCents(ahorroReferenceCents))}</p>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>
                    {metaVinculada ? metaVinculada.nombre : 'Total ahorrado'}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--progress-track)' }}>
                  <p className="text-sm font-black" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(entradaObjetivoCents))}</p>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>Necesario</p>
                </div>
              </div>

              {/* Estado */}
              {entradaObjetivoCents > ahorroReferenceCents ? (
                <div className="rounded-xl px-3 py-2 flex items-center justify-between"
                  style={{ background: 'color-mix(in srgb, var(--accent-terra), transparent 90%)' }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Aún te faltan</p>
                  <p className="text-sm font-black" style={{ color: 'var(--accent-terra)' }}>
                    {formatCurrency(fromCents(entradaObjetivoCents - ahorroReferenceCents))}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl px-3 py-2 text-center font-black text-sm"
                  style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)', color: 'var(--accent-green)' }}>
                  ✓ ¡Meta alcanzada! Puedes iniciar la búsqueda.
                </div>
              )}
            </Card>
          )}

            {/* ── Lista vacía ── */}
            {inmuebles.length === 0 && (
              <div className="glass-card flex flex-col items-center justify-center py-16 text-center">
                <Home size={40} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
                <h3 className="font-serif text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Sin simulaciones aún</h3>
                <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  Crea tu primera simulación para replicar el análisis del Excel en la app.
                </p>
                <button onClick={handleAbrirForm} className="ff-btn-terra">
                  <Plus size={16} className="inline mr-2" />
                  Nueva simulación
                </button>
              </div>
            )}

            {/* ── Comparador ── */}
            {comparando.length === 2 && (
              <ComparadorInmuebles
                inmuebles={inmuebles.filter(i => comparando.includes(i.id))}
                onCerrar={() => setComparando([])}
              />
            )}

            {/* ── Vivienda habitual ── */}
            {viviendas.length > 0 && (
              <section className="space-y-2">
                <SectionHeader icon={Home} label="Vivienda habitual" count={viviendas.length} color="var(--accent-blue)" />
                {viviendas.map(inmueble => (
                  <InmuebleItem
                    key={inmueble.id}
                    inmueble={inmueble}
                    onOpen={() => setPanelInmueble(inmueble)}
                    comparando={comparando}
                    onToggleComparar={id => setComparando(prev =>
                      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev
                    )}
                  />
                ))}
              </section>
            )}

            {/* ── Inversiones ── */}
            {inversiones.length > 0 && (
              <section className="space-y-2">
                <SectionHeader icon={Building2} label="Inversión / Alquiler" count={inversiones.length} color="var(--accent-gold)" />
                {inversiones.map(inmueble => (
                  <InmuebleItem
                    key={inmueble.id}
                    inmueble={inmueble}
                    onOpen={() => setPanelInmueble(inmueble)}
                    comparando={comparando}
                    onToggleComparar={id => setComparando(prev =>
                      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev
                    )}
                  />
                ))}
              </section>
            )}
        </div>
      )}

      {/* ── Modal detalle inmueble ── */}
      <Modal open={!!panelInmueble} onClose={() => setPanelInmueble(null)} size="lg" title={panelInmueble?.nombre}>
        {panelInmueble && (
          <SimuladorPanel
            inmueble={panelInmueble}
            metas={metas}
            onEdit={(inm) => { setPanelInmueble(null); handleEditar(inm) }}
            onDelete={(id) => { setPanelInmueble(null); handleEliminar(id) }}
            onComprado={handleComprado}
          />
        )}
      </Modal>

      {/* ── Modal de formulario ── */}
      <Modal
        open={formAbierto}
        onClose={() => { setFormAbierto(false); setEditando(null) }}
        title={editando ? 'Editar inmueble' : 'Nueva simulación'}>
        <FormInmueble
          inmueble={editando}
          metas={metas}
          onSave={handleGuardar}
          onClose={() => { setFormAbierto(false); setEditando(null) }}
        />
      </Modal>
    </AppShell>
  )
}

// ── Componente: tarjeta de inmueble (compacta, abre modal al tocar) ───────────

function InmuebleItem({ inmueble, onOpen, comparando = [], onToggleComparar }) {
  const { datos_compra: dc, hipoteca: hip, alquiler_config: al, tipo, estado } = inmueble
  const fi = hip

  const precioCents = toCents(dc?.precio || 0)
  const principalCents = toCents(hip?.principal || 0)
  const interesAnual = hip?.interes_anual || 3
  const plazoMeses = hip?.plazo_meses || 360
  const modoFin = fi?.modo_financiacion || (fi?.aval_ico ? 'dual' : 'ninguna')

  const cuotaCents = modoFin === 'aval_ico'
    ? calcularAvalICO({ precioCents, interesAnual, plazoMeses }).cuotaCents
    : modoFin === 'dual'
    ? calcularFinanciacionDual({ precioCents, interesAnual, plazoMeses, ltvBanco: fi?.ltv_banco ?? 0.80, ltvCreditoPublico: fi?.credito_publico?.ltv ?? 0.20, interesCreditoPublico: fi?.credito_publico?.interes_anual ?? 0 }).cuotaTotalCents
    : calcularCuotaHipoteca(principalCents, interesAnual, plazoMeses)

  const ltvInicial = calcularLTV(principalCents, precioCents)

  let cashflowLabel = null
  if (tipo === 'inversion' && al?.renta_mensual) {
    const noi = calcularNOI({
      rentaMensualCents: toCents(al.renta_mensual),
      mesesOcupados: al.meses_ocupados ?? 11,
      comunidadMensualCents: toCents(al.comunidad_mensual || 0),
      mantenimientoMensualCents: toCents(al.mantenimiento_mensual || 0),
      ibiAnualCents: toCents(al.ibi_anual || 0),
      seguroAnualCents: toCents(al.seguro_anual || 0),
    })
    const cf = calcularCashflow(noi.noiMensualCents, cuotaCents)
    cashflowLabel = { cents: cf, positive: cf >= 0 }
  }

  const accentColor = tipo === 'inversion' ? 'var(--accent-gold)' : 'var(--accent-blue)'

  const ltvColor = ltvInicial > 90 ? 'var(--accent-rose)' : ltvInicial > 80 ? 'var(--accent-gold)' : 'var(--accent-green)'
  const enComparador = comparando.includes(inmueble.id)
  const comparadorLleno = comparando.length >= 2 && !enComparador

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      className="w-full glass-card transition-all active:scale-[0.99] overflow-hidden cursor-pointer"
      style={{ textAlign: 'left' }}>
      <div className="flex items-center gap-3 p-3">
        {/* Icono */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${accentColor}, transparent 88%)` }}>
          {tipo === 'inversion'
            ? <Building2 size={15} style={{ color: accentColor }} />
            : <Home size={15} style={{ color: accentColor }} />}
        </div>

        {/* Nombre + datos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 mb-1">
            <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{inmueble.nombre}</p>
            {estado === 'comprado' && (
              <span className="flex-shrink-0 font-black px-1.5 py-0.5 rounded-md"
                style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)', color: 'var(--accent-green)', fontSize: 9 }}>
                ✓ Comprado
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatCurrency(fromCents(precioCents))}</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>·</span>
            <span className="font-bold px-1.5 py-0.5 rounded-md"
              style={{ fontSize: 9, background: `color-mix(in srgb, ${ltvColor}, transparent 88%)`, color: ltvColor }}>
              LTV {ltvInicial}%
            </span>
          </div>
        </div>

        {/* Métricas + botón comparar */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Botón COMP — div en vez de button para evitar button-in-button */}
          {onToggleComparar && !comparadorLleno && (
            <div
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onToggleComparar(inmueble.id) }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onToggleComparar(inmueble.id) } }}
              className="font-black px-1.5 py-1 rounded-lg transition-all cursor-pointer"
              style={{
                fontSize: 8, letterSpacing: '0.08em',
                background: enComparador ? 'var(--accent-terra)' : 'var(--progress-track)',
                color: enComparador ? '#fff' : 'var(--text-muted)',
              }}>
              {enComparador ? '✓' : '+'}
            </div>
          )}

          <div className="text-right">
            <p className="text-sm font-black" style={{ color: 'var(--accent-terra)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {formatCurrency(fromCents(cuotaCents))}
            </p>
            {cashflowLabel ? (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>CF</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: cashflowLabel.positive ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                  {formatCurrency(fromCents(cashflowLabel.cents))}
                </span>
              </div>
            ) : (
              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: 2 }}>/mes</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, label, count, color }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}>
        <Icon size={11} style={{ color }} />
      </div>
      <p className="text-xs font-black uppercase tracking-wider flex-1"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
        {label}
      </p>
      <span className="text-xs font-black px-2 py-0.5 rounded-full"
        style={{ background: `color-mix(in srgb, ${color}, transparent 88%)`, color }}>
        {count}
      </span>
    </div>
  )
}
