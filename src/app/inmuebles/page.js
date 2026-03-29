'use client'
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

export default function InmueblesPage() {
  const [inmuebles, setInmuebles] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalAhorradoCents, setTotalAhorradoCents] = useState(0)
  const [metas, setMetas] = useState([])
  const [panelInmueble, setPanelInmueble] = useState(null) // inmueble abierto en modal
  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState(null) // inmueble a editar

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
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'color-mix(in srgb, var(--accent-terra), transparent 88%)', border: '1px solid color-mix(in srgb, var(--accent-terra), transparent 78%)' }}>
                      <Target size={18} style={{ color: 'var(--accent-terra)' }} />
                    </div>
                    <div>
                      <p className="font-serif text-base" style={{ color: 'var(--text-primary)' }}>Meta: Entrada para la casa</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {inmueblemeta?.nombre}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-black" style={{ color: 'var(--accent-terra)', letterSpacing: '-0.03em' }}>
                    {progressPct}%
                  </span>
                </div>

                <ProgressBar value={ahorroReferenceCents} max={entradaObjetivoCents} color="var(--accent-terra)" className="h-2 mb-3" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{formatCurrency(fromCents(ahorroReferenceCents))}</p>
                    <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {metaVinculada ? metaVinculada.nombre : 'Total ahorrado'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(fromCents(entradaObjetivoCents))}</p>
                    <p style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Entrada + gastos + reforma</p>
                  </div>
                </div>

                {entradaObjetivoCents > ahorroReferenceCents && (
                  <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                    Faltan {formatCurrency(fromCents(entradaObjetivoCents - ahorroReferenceCents))} para la entrada
                  </p>
                )}
                {ahorroReferenceCents >= entradaObjetivoCents && (
                  <div className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg text-center"
                    style={{ background: 'color-mix(in srgb, var(--accent-green), transparent 88%)', color: 'var(--accent-green)' }}>
                    ¡Meta alcanzada! Puedes iniciar la búsqueda.
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

            {/* ── Vivienda habitual ── */}
            {viviendas.length > 0 && (
              <section className="space-y-2">
                <SectionHeader icon={Home} label="Vivienda habitual" count={viviendas.length} color="var(--accent-blue)" />
                {viviendas.map(inmueble => (
                  <InmuebleItem
                    key={inmueble.id}
                    inmueble={inmueble}
                    onOpen={() => setPanelInmueble(inmueble)}
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

function InmuebleItem({ inmueble, onOpen }) {
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

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full glass-card transition-all active:scale-[0.99]"
      style={{ padding: 0, textAlign: 'left' }}>
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${accentColor}, transparent 88%)`, border: `1px solid color-mix(in srgb, ${accentColor}, transparent 78%)` }}>
          {tipo === 'inversion'
            ? <Building2 size={14} style={{ color: accentColor }} />
            : <Home size={14} style={{ color: accentColor }} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{inmueble.nombre}</p>
            {estado === 'comprado' && <Badge color="green">Comprado</Badge>}
          </div>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {formatCurrency(fromCents(precioCents))} · LTV {ltvInicial}%
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-black" style={{ color: 'var(--accent-terra)', letterSpacing: '-0.02em' }}>
            {formatCurrency(fromCents(cuotaCents))}
          </p>
          {cashflowLabel
            ? <p className="text-xs font-bold" style={{ color: cashflowLabel.positive ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                CF {formatCurrency(fromCents(cashflowLabel.cents))}
              </p>
            : <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>/mes</p>
          }
        </div>
      </div>
    </button>
  )
}

function SectionHeader({ icon: Icon, label, count, color }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} style={{ color }} />
      <p className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}>
        {label}
      </p>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, ${color}, transparent 90%)`, color }}>
        {count}
      </span>
    </div>
  )
}
