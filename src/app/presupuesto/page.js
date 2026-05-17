'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Home, Sparkles, Sprout, CheckCircle, Edit3, Save, X,
  Loader2, AlertTriangle, List, LayoutGrid, ArrowRight, Target, TrendingUp, CircleDollarSign, Copy,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { useFormatCurrency } from '@/lib/useFormatCurrency'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

const BLOQUES_META = [
  { id: 'necesidades', nombre: 'Necesidades', icon: Home, color: 'var(--accent-blue)', pct: 50, descripcion: 'Gastos obligatorios del mes' },
  { id: 'estilo', nombre: 'Estilo de vida', icon: Sparkles, color: 'var(--accent-terra)', pct: 20, descripcion: 'Gastos de disfrute y ocio' },
  { id: 'futuro', nombre: 'Futuro', icon: Sprout, color: 'var(--accent-green)', pct: 30, descripcion: 'Construye tu patrimonio' },
]

const CAT_BLOQUE = {
  basicos: 'necesidades', deuda: 'necesidades',
  deseo: 'estilo',
  ahorro: 'futuro', inversion: 'futuro',
}

const ORIGEN_BLOQUE = {
  basicos: 'necesidades',
  metas: 'futuro',
  inversiones: 'futuro',
}

export default function PresupuestoPage() {
  const [bloques, setBloques] = useState(BLOQUES_META)
  const [ingreso, setIngreso] = useState('')
  const [editando, setEditando] = useState(false)
  const [borradores, setBorradores] = useState(null)
  const [sub, setSub] = useState({ metas: 60, inversiones: 40 })
  const [subBorrador, setSubBorrador] = useState(null)
  const [movs, setMovs] = useState([])
  const [sobreMovs, setSobreMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [vista, setVista] = useState('general')
  const [categoriasCfg, setCategoriasCfg] = useState([])
  const [subcategoriasCfg, setSubcategoriasCfg] = useState([])
  const [montosCats, setMontosCats] = useState({})
  const [metas, setMetas] = useState([])
  const [inversiones, setInversiones] = useState([])
  const [aportesInvEsteMes, setAportesInvEsteMes] = useState(0)
  const [deudas, setDeudas] = useState([])
  const [bloquesCerrados, setBloquesCerrados] = useState(new Set())
  const formatCurrency = useFormatCurrency()

  function toggleBloque(id) {
    setBloquesCerrados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const [deudaMovs, setDeudaMovs] = useState([])
  const [copiando, setCopiando] = useState(false)

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`
    const fechaFin = new Date(año, mes, 0).toISOString().slice(0, 10)

    try {
      const [
        { data: movsData },
        { data: bloquesData },
        { data: subData },
        { data: sobreData },
        { data: catsData },
        { data: subsData },
        { data: presCatsData },
        { data: metasData },
        { data: invData },
        { data: deudasData },
        { data: deudaMovsData },
      ] = await Promise.all([
        supabase.from('movimientos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
        supabase.from('presupuesto_bloques').select('*'),
        supabase.from('presupuesto_sub').select('*').eq('bloque', 'futuro'),
        supabase.from('sobre_movimientos').select('*').eq('mes', mes).eq('año', año),
        supabase.from('categorias').select('*').order('bloque').order('orden').order('nombre'),
        supabase.from('subcategorias').select('*').order('orden').order('nombre'),
        supabase.from('presupuesto_cats').select('*').eq('mes', mes).eq('año', año),
        supabase.from('metas').select('id, nombre, emoji, pct_mensual, meta, actual, estado, color').order('created_at'),
        supabase.from('inversiones').select('id, nombre, emoji, aporte, pct_mensual, color').order('created_at'),
        supabase.from('deudas').select('id, nombre, emoji, cuota, pendiente, estado, tipo, dia_pago').eq('estado', 'activa').neq('tipo', 'medeben'),
        supabase.from('deuda_movimientos').select('deuda_id, tipo, monto, mes, año').eq('mes', mes).eq('año', año),
      ])

      setMovs(movsData || [])
      setSobreMovs(sobreData || [])
      setCategoriasCfg(catsData || [])
      setSubcategoriasCfg(subsData || [])
      setMetas(metasData || [])
      setInversiones(invData || [])

      setAportesInvEsteMes((movsData || [])
        .filter(m =>
          m.tipo === 'egreso' &&
          m.categoria === 'inversion' &&
          m.inversion_id != null &&
          !m.descripcion?.startsWith('Sobrante sobre')
        )
        .reduce((s, m) => s + parseFloat(m.monto || 0), 0))
      setDeudas(deudasData || [])
      setDeudaMovs(deudaMovsData || [])

      const initMontos = {}
        ; (presCatsData || []).forEach(p => { initMontos[p.subcategoria_id] = p.monto })
      setMontosCats(initMontos)

      const totalIngresos = (movsData || [])
        .filter(m => m.tipo === 'ingreso')
        .reduce((s, m) => s + parseFloat(m.monto), 0)
      setIngreso(totalIngresos > 0 ? totalIngresos.toString() : '')

      if (bloquesData?.length > 0) {
        setBloques(prev => prev.map(b => {
          const found = bloquesData.find(r => r.bloque === b.id)
          return found ? { ...b, pct: found.pct } : b
        }))
      }

      if (subData?.length > 0) {
        const newSub = {}
        subData.forEach(r => { newSub[r.categoria] = r.pct })
        setSub(prev => ({ ...prev, ...newSub }))
      }
    } catch (err) {
      console.error('Error cargando presupuesto:', err)
      toast('Error cargando datos del presupuesto')
    } finally {
      setLoading(false)
    }
  }

  async function guardarPresupuestoCat(subcategoriaId, monto) {
    const valor = parseFloat(monto) || 0
    const { error } = await supabase.from('presupuesto_cats').upsert(
      { subcategoria_id: subcategoriaId, mes, año, monto: valor },
      { onConflict: 'subcategoria_id,mes,año' }
    )
    if (!error) setMontosCats(prev => ({ ...prev, [subcategoriaId]: valor }))
  }

  async function copiarMesAnterior() {
    setCopiando(true)
    const mesPrev = mes === 1 ? 12 : mes - 1
    const añoPrev = mes === 1 ? año - 1 : año
    const { data, error } = await supabase.from('presupuesto_cats')
      .select('subcategoria_id, monto').eq('mes', mesPrev).eq('año', añoPrev)
    if (error || !data?.length) {
      toast('No hay presupuesto guardado del mes anterior')
      setCopiando(false)
      return
    }
    const nuevos = data.map(({ subcategoria_id, monto }) => ({ subcategoria_id, mes, año, monto }))
    const { error: upsertErr } = await supabase.from('presupuesto_cats')
      .upsert(nuevos, { onConflict: 'subcategoria_id,mes,año' })
    if (upsertErr) { toast('Error al copiar: ' + upsertErr.message); setCopiando(false); return }
    const map = {}
    data.forEach(p => { map[p.subcategoria_id] = parseFloat(p.monto) })
    setMontosCats(map)
    toast('Presupuesto copiado del mes anterior', 'success')
    setCopiando(false)
  }

  // ── Gasto real por bloque ─────────────────────────────────────────────────
  // FIX Bug 2: deSobrantesDelSobre solo se descuenta si realmente
  // existe un movimiento correspondiente en movs (evita restar sin haber sumado)
  const SOBRE_BLOQUE = 'estilo'

  function gastadoReal(bloqueId) {
    const deMovimientos = movs
      .filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === bloqueId)
      .filter(m => m.categoria !== 'inversion' || m.inversion_id != null)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    const deTraspasos = sobreMovs
      .filter(m => ORIGEN_BLOQUE[m.origen] === bloqueId && parseFloat(m.monto) > 0)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    // FIX: solo descontar sobrantes del sobre si ese gasto YA está contado
    // en deMovimientos (categoria='deseo' aparece en movs con CAT_BLOQUE='estilo')
    // Los sobrantes enviados desde el sobre crean un movimiento propio,
    // así que se descuenta el traspaso para no contar dos veces.
    const deSobrantesDelSobre = bloqueId === SOBRE_BLOQUE
      ? sobreMovs
        .filter(m => m.origen === 'sobre' && m.monto > 0)
        .reduce((s, m) => {
          // Solo restar si hay un movimiento real de tipo deseo por ese monto/fecha
          const tieneMovReal = movs.some(mv =>
            mv.tipo === 'egreso' &&
            CAT_BLOQUE[mv.categoria] === SOBRE_BLOQUE &&
            Math.abs(parseFloat(mv.monto) - parseFloat(m.monto)) < 0.01
          )
          return tieneMovReal ? s + parseFloat(m.monto) : s
        }, 0)
      : 0

    const deTraspasosSobre = bloqueId === SOBRE_BLOQUE
      ? sobreMovs
        .filter(m => m.destino === 'sobre')
        .reduce((s, m) => s + parseFloat(m.monto), 0)
      : 0

    return deMovimientos + deTraspasos - deSobrantesDelSobre - deTraspasosSobre
  }

  // ── Edición de porcentajes ────────────────────────────────────────────────
  function iniciarEdicion() {
    setBorradores(bloques.map(b => ({ ...b })))
    setSubBorrador({ metas: sub.metas, inversiones: sub.inversiones })
    setEditando(true)
  }
  function cancelarEdicion() { setBorradores(null); setSubBorrador(null); setEditando(false) }

  async function guardarEdicion() {
    if (!totalOk || !subOk || saving) return
    setSaving(true)
    const results = await Promise.all([
      ...borradores.map(b =>
        supabase.from('presupuesto_bloques').upsert(
          { bloque: b.id, pct: parseInt(b.pct) || 0 },
          { onConflict: 'bloque' }
        )
      ),
      supabase.from('presupuesto_sub').upsert(
        { bloque: 'futuro', categoria: 'metas', pct: parseInt(subBorrador.metas) || 0 },
        { onConflict: 'bloque,categoria' }
      ),
      supabase.from('presupuesto_sub').upsert(
        { bloque: 'futuro', categoria: 'inversiones', pct: parseInt(subBorrador.inversiones) || 0 },
        { onConflict: 'bloque,categoria' }
      ),
    ])
    setSaving(false)
    if (results.some(r => r.error)) { toast('Error al guardar'); return }
    setBloques(borradores)
    setSub({ metas: parseInt(subBorrador.metas) || 0, inversiones: parseInt(subBorrador.inversiones) || 0 })
    setBorradores(null)
    setSubBorrador(null)
    setEditando(false)
  }

  function cambiarPct(id, val) {
    const limpio = val === '' ? '' : Math.max(0, Math.min(100, parseInt(val) || 0))
    setBorradores(prev => prev.map(b => b.id === id ? { ...b, pct: limpio } : b))
  }

  function cambiarSubPct(key, val) {
    const limpio = val === '' ? '' : Math.max(0, Math.min(100, parseInt(val) || 0))
    setSubBorrador(prev => ({ ...prev, [key]: limpio }))
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const ingresoNum = parseFloat(ingreso) || 0
  const lista = editando ? borradores : bloques
  const totalPct = lista.reduce((s, b) => s + (parseInt(b.pct) || 0), 0)
  const totalOk = totalPct === 100
  const subTotalPct = subBorrador
    ? (parseInt(subBorrador.metas) || 0) + (parseInt(subBorrador.inversiones) || 0)
    : 100
  const subOk = subBorrador ? subTotalPct === 100 : true
  const panelOk = totalOk && subOk

  const futuroPct = (lista.find(b => b.id === 'futuro')?.pct) || 0
  const montoFuturo = ingresoNum * ((parseInt(futuroPct) || 0) / 100)
  const subActual = editando ? subBorrador : sub
  const montoMetas = montoFuturo * ((parseInt(subActual?.metas) || 0) / 100)
  const montoInversiones = montoFuturo * ((parseInt(subActual?.inversiones) || 0) / 100)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 animate-enter">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Mi Presupuesto</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        {!editando && (
          <div className="flex items-center gap-2">
            <button
              onClick={copiarMesAnterior}
              disabled={copiando}
              className="flex items-center gap-2 transition-all active:scale-95"
              style={{
                padding: '8px 14px', borderRadius: 14,
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
              {copiando ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
              Copiar mes
            </button>
            <button
              onClick={iniciarEdicion}
              className="flex items-center gap-2 transition-all active:scale-95"
              style={{
                padding: '8px 14px', borderRadius: 14,
                border: '1px solid color-mix(in srgb, var(--accent-main) 30%, transparent)',
                background: 'color-mix(in srgb, var(--accent-main) 8%, var(--bg-secondary))',
                color: 'var(--accent-main)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
              <Edit3 size={13} />
              Distribución
            </button>
          </div>
        )}
      </div>

      {/* ── BANNER RESUMEN RÁPIDO ── */}

      {ingresoNum > 0 && !editando && (() => {
        const gastadoNecesidades = gastadoReal('necesidades')
        const gastadoEstilo = gastadoReal('estilo')
        const gastadoFuturo = gastadoReal('futuro')
        const totalGastado = gastadoNecesidades + gastadoEstilo + gastadoFuturo

        const presupuestadoCats = Object.values(montosCats).reduce((s, v) => s + (parseFloat(v) || 0), 0)
        const presupuestadoDeudas = deudas.reduce((s, d) => s + (d.cuota || 0), 0)
        const presupuestadoMetas = metas
          .filter(m => m.estado === 'activa')
          .reduce((s, m) => s + ((m.pct_mensual / 100) * montoMetas), 0)
        const presupuestadoInv = inversiones
          .filter(i => (i.pct_mensual || 0) > 0)
          .reduce((s, i) => s + ((i.pct_mensual / 100) * montoInversiones), 0)
        const totalPresupuestado = presupuestadoCats + presupuestadoDeudas + presupuestadoMetas + presupuestadoInv

        const sinAsignar = ingresoNum - totalPresupuestado
        const disponible = totalPresupuestado - totalGastado
        const sobrePresup = sinAsignar < 0
        const sobreGiro = totalGastado > totalPresupuestado
        const pctGastado = Math.min(100, (totalGastado / ingresoNum) * 100)
        const pctPresupuestado = Math.min(100, (totalPresupuestado / ingresoNum) * 100)

        const chips = [
          { label: 'Necesidades', bloqueId: 'necesidades', gastado: gastadoNecesidades, color: bloques.find(b => b.id === 'necesidades')?.color },
          { label: 'Estilo', bloqueId: 'estilo', gastado: gastadoEstilo, color: bloques.find(b => b.id === 'estilo')?.color },
          { label: 'Futuro', bloqueId: 'futuro', gastado: gastadoFuturo, color: bloques.find(b => b.id === 'futuro')?.color },
        ]

        return (
          <div className="mb-5 animate-enter" style={{
            borderRadius: 20,
            border: '1px solid var(--border-glass)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
          }}>

            {/* ── FILA PRINCIPAL ── */}
            <div style={{ padding: '20px 20px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.03em', marginBottom: 3 }}>
                    Ingreso del mes
                  </p>
                  <p style={{
                    fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 700,
                    color: 'var(--text-primary)', letterSpacing: '-0.02em',
                    lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
                  }}>
                    {formatCurrency(ingresoNum)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.03em', marginBottom: 3 }}>
                    {sobrePresup ? '⚠ Sobre presupuesto' : sobreGiro ? '⚠ Sobre-giro' : 'Sin asignar'}
                  </p>
                  <p style={{
                    fontSize: 'clamp(20px, 5vw, 26px)', fontWeight: 700,
                    letterSpacing: '-0.02em', lineHeight: 1.1,
                    fontVariantNumeric: 'tabular-nums',
                    color: sobrePresup || sobreGiro
                      ? 'var(--accent-rose)'
                      : sinAsignar === 0
                        ? 'var(--accent-green)'
                        : 'var(--accent-blue)',
                  }}>
                    {sobrePresup ? `-${formatCurrency(Math.abs(sinAsignar))}` : formatCurrency(sinAsignar)}
                  </p>
                </div>
              </div>

              {/* Barra doble */}
              <div style={{
                width: '100%', height: 6, borderRadius: 999,
                background: 'var(--progress-track)',
                overflow: 'hidden', position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pctPresupuestado}%`, borderRadius: 999,
                  background: sobrePresup
                    ? 'color-mix(in srgb, var(--accent-rose) 25%, transparent)'
                    : 'color-mix(in srgb, var(--accent-blue) 25%, transparent)',
                }} />
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: `${pctGastado}%`, borderRadius: 999,
                  background: sobreGiro ? 'var(--accent-rose)' : 'var(--accent-terra)',
                  transition: 'width 0.5s ease-out',
                }} />
              </div>
            </div>

            {/* ── FRANJA 3 MÉTRICAS ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              borderTop: '1px solid var(--border-glass)',
            }}>
              {[
                { label: 'Gastado', value: totalGastado, color: sobreGiro ? 'var(--accent-rose)' : 'var(--accent-terra)', align: 'left' },
                { label: 'Presupuestado', value: totalPresupuestado, color: 'var(--text-secondary)', align: 'center' },
                { label: 'Disponible', value: disponible, color: sobreGiro ? 'var(--accent-rose)' : 'var(--accent-green)', align: 'right' },
              ].map((m, i) => (
                <div key={m.label} style={{
                  padding: '12px 14px',
                  textAlign: m.align,
                  borderRight: i < 2 ? '1px solid var(--border-glass)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: 3,
                  alignItems: m.align === 'center' ? 'center' : m.align === 'right' ? 'flex-end' : 'flex-start',
                }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                    {m.label}
                  </p>
                  <p style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: m.color }}>
                    {formatCurrency(m.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* ── CHIPS POR BLOQUE ── */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8, padding: '12px 16px 16px',
              borderTop: '1px solid var(--border-glass)',
            }}>
              {chips.map(chip => {
                const techo = ingresoNum * ((bloques.find(b => b.id === chip.bloqueId)?.pct || 0) / 100)
                const excede = chip.gastado > techo
                const pct = techo > 0 ? Math.min(100, (chip.gastado / techo) * 100) : 0
                return (
                  <div key={chip.label} style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 14, padding: '10px 10px 8px',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: chip.color, flexShrink: 0 }} />
                      <p style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {chip.label}
                      </p>
                    </div>
                    <p style={{
                      fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                      color: excede ? 'var(--accent-rose)' : chip.color,
                    }}>
                      {formatCurrency(chip.gastado)}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      de {formatCurrency(techo)}
                    </p>
                    <div style={{ height: 2, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden', marginTop: 2 }}>
                      <div style={{
                        height: '100%', borderRadius: 999,
                        width: `${pct}%`,
                        background: excede ? 'var(--accent-rose)' : chip.color,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── ALERTA ── */}
            {(sobreGiro || sobrePresup || (sinAsignar > 0 && sinAsignar < ingresoNum * 0.05)) && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 16px 14px',
                borderTop: '1px solid var(--border-glass)',
              }}>
                <AlertTriangle size={13} style={{
                  color: sobreGiro || sobrePresup ? 'var(--accent-rose)' : 'var(--accent-terra)',
                  flexShrink: 0, marginTop: 1,
                }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: sobreGiro || sobrePresup ? 'var(--accent-rose)' : 'var(--accent-terra)' }}>
                    {sobrePresup ? 'Presupuesto excede el ingreso'
                      : sobreGiro ? 'Gasto real excede el presupuesto'
                        : 'Presupuesto casi completo'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {sobrePresup
                      ? `Tienes ${formatCurrency(Math.abs(sinAsignar))} más presupuestados que tu ingreso`
                      : sobreGiro
                        ? `Gastaste ${formatCurrency(totalGastado - totalPresupuestado)} más de lo presupuestado`
                        : `Solo quedan ${formatCurrency(sinAsignar)} sin asignar`}
                  </p>
                </div>
              </div>
            )}

          </div>
        )
      })()}
      {/* ── Panel de edición ── */}
      {editando && (
        <div className="mb-5 animate-enter" style={{
          borderRadius: 24, border: '1px solid var(--border-glass)',
          background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)', overflow: 'hidden',
        }}>
          <div className="flex items-center gap-3 px-5 py-4"
            style={{ borderBottom: '1px solid var(--border-glass)', background: 'var(--bg-secondary)' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, flexShrink: 0,
              background: 'color-mix(in srgb, var(--accent-main) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Edit3 size={14} style={{ color: 'var(--accent-main)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Distribución del ingreso
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                Los porcentajes deben sumar 100%
              </p>
            </div>
            <button onClick={cancelarEdicion} style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'var(--bg-card)', border: '1px solid var(--border-glass)',
              color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: '8px 0' }}>
            {borradores.map((b, idx) => {
              const BIcon = b.icon
              const bMonto = ingresoNum * ((parseInt(b.pct) || 0) / 100)
              const pctVal = parseInt(b.pct) || 0
              return (
                <div key={b.id} style={{
                  padding: '14px 20px',
                  borderBottom: idx < borradores.length - 1 ? '1px solid var(--border-glass)' : 'none',
                }}>
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                      background: `color-mix(in srgb, ${b.color} 12%, var(--bg-secondary))`,
                      border: `1px solid color-mix(in srgb, ${b.color} 20%, transparent)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BIcon size={15} style={{ color: b.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                        {b.nombre}
                      </p>
                      {ingresoNum > 0 && (
                        <p style={{ fontSize: 11, color: b.color, fontWeight: 600, marginTop: 1 }}>
                          {formatCurrency(bMonto)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" style={{
                      background: 'var(--bg-secondary)', borderRadius: 12, padding: '4px 10px 4px 6px',
                    }}>
                      <input
                        type="number" min="0" max="100"
                        value={b.pct}
                        onChange={e => cambiarPct(b.id, e.target.value)}
                        style={{
                          width: 36, textAlign: 'center', background: 'none', border: 'none',
                          outline: 'none', fontSize: 15, fontWeight: 800,
                          color: b.color, fontFamily: 'Inter, sans-serif',
                        }}
                      />
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                  <div style={{ marginTop: 10, height: 5, borderRadius: 999, overflow: 'hidden', background: 'var(--progress-track)' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: `${pctVal}%`, background: b.color,
                      transition: 'width 0.35s ease-out',
                    }} />
                  </div>

                  {b.id === 'futuro' && subBorrador && (
                    <div style={{
                      marginTop: 12, borderRadius: 14,
                      background: 'var(--bg-secondary)',
                      border: `1px solid color-mix(in srgb, ${b.color} 15%, var(--border-glass))`,
                      padding: '12px 14px',
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Distribución interna del Futuro
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                          { key: 'metas', label: 'Metas de Ahorro', color: 'var(--accent-green)', emoji: '🎯' },
                          { key: 'inversiones', label: 'Inversiones', color: 'var(--accent-violet)', emoji: '📈' },
                        ].map(s => {
                          const pct = parseInt(subBorrador[s.key]) || 0
                          const sMonto = bMonto * (pct / 100)
                          return (
                            <div key={s.key}>
                              <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
                                <span style={{ fontSize: 13 }}>{s.emoji}</span>
                                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  {s.label}
                                </span>
                                {ingresoNum > 0 && (
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                                    {formatCurrency(sMonto)}
                                  </span>
                                )}
                                <div className="flex items-center gap-1" style={{
                                  background: 'var(--bg-card)', borderRadius: 10, padding: '3px 8px 3px 4px',
                                }}>
                                  <input type="number" min="0" max="100" value={subBorrador[s.key]}
                                    onChange={e => cambiarSubPct(s.key, e.target.value)}
                                    style={{
                                      width: 30, textAlign: 'center', background: 'none', border: 'none',
                                      outline: 'none', fontSize: 13, fontWeight: 800,
                                      color: s.color, fontFamily: 'Inter, sans-serif',
                                    }} />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>%</span>
                                </div>
                              </div>
                              <div style={{ height: 3, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%', borderRadius: 999, background: s.color,
                                  width: `${Math.min(100, pct)}%`, transition: 'width 0.35s ease-out',
                                }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {!subOk && (
                        <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-rose)', marginTop: 8 }}>
                          ⚠ Suman {subTotalPct}% — deben ser exactamente 100%
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderTop: '1px solid var(--border-glass)', background: 'var(--bg-secondary)' }}>
            <div className="flex items-center gap-2">
              {panelOk
                ? <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                : <AlertTriangle size={14} style={{ color: 'var(--accent-rose)' }} />
              }
              <span style={{ fontSize: 12, fontWeight: 600, color: panelOk ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                {!totalOk
                  ? `Bloques: ${totalPct}% (faltan ${100 - totalPct}%)`
                  : !subOk
                    ? `Futuro: ${subTotalPct}% (deben ser 100%)`
                    : 'Todo cuadra ✓'}
              </span>
            </div>
            <button onClick={guardarEdicion} disabled={!panelOk || saving}
              className="flex items-center gap-2 transition-all active:scale-95"
              style={{
                padding: '9px 18px', borderRadius: 12, border: 'none', cursor: panelOk ? 'pointer' : 'not-allowed',
                background: panelOk ? 'var(--accent-main)' : 'var(--bg-secondary)',
                color: panelOk ? '#fff' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700, opacity: panelOk ? 1 : 0.5,
              }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* Selector de vista */}
      <div className="flex mb-5 p-1 rounded-xl gap-1"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', width: 'fit-content' }}>
        {[
          { id: 'general', label: 'General', Icon: LayoutGrid },
          { id: 'categorias', label: 'Por categorías', Icon: List },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setVista(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: vista === id ? 'var(--text-primary)' : 'transparent',
              color: vista === id ? 'var(--bg-card)' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer',
            }}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : <>

        {/* ══════════ VISTA GENERAL ══════════ */}
        {vista === 'general' && <>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {lista.map(bloque => {
              const Icon = bloque.icon
              const monto = ingresoNum * ((parseInt(bloque.pct) || 0) / 100)
              const gastado = gastadoReal(bloque.id)
              const esFuturo = bloque.id === 'futuro'
              const catsBloque = categoriasCfg.filter(c => c.bloque === bloque.id)

              const presupuestadoBloque = esFuturo
                ? metas.filter(m => m.estado === 'activa').reduce((s, m) => s + ((m.pct_mensual / 100) * montoMetas), 0)
                + inversiones.filter(i => (i.pct_mensual || 0) > 0).reduce((s, i) => s + ((i.pct_mensual / 100) * montoInversiones), 0)
                + catsBloque.flatMap(c => subcategoriasCfg.filter(s => s.categoria_id === c.id))
                  .reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                : catsBloque.flatMap(c => subcategoriasCfg.filter(s => s.categoria_id === c.id))
                  .reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)

              const disponible = presupuestadoBloque - gastado
              const sinAsignar = monto - presupuestadoBloque
              const sobreGiro = gastado > presupuestadoBloque
              const pctGastado = presupuestadoBloque > 0 ? Math.min(100, (gastado / presupuestadoBloque) * 100) : 0

              return (
                <div key={bloque.id} className="animate-enter" style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 24,
                  overflow: 'hidden',
                  marginBottom: 12,
                }}>

                  {/* ── HEADER ── */}
                  <div style={{
                    padding: '16px 18px 14px',
                    borderBottom: '1px solid var(--border-glass)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                          background: `color-mix(in srgb, ${bloque.color} 12%, transparent)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={17} style={{ color: bloque.color }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {bloque.nombre}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                            {bloque.descripcion}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 22, fontWeight: 700, color: bloque.color,
                        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
                      }}>
                        {bloque.pct}%
                      </span>
                    </div>

                    {ingresoNum > 0 && (
                      <>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 6 }}>
                          Techo del bloque: {formatCurrency(monto)}
                        </p>
                        <div style={{
                          width: '100%', height: 5, borderRadius: 999,
                          background: 'var(--progress-track)', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 999,
                            width: `${bloque.pct}%`,
                            background: bloque.color,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── 3 MÉTRICAS ── */}
                  {ingresoNum > 0 && (
                    <>
                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        padding: '14px 18px', gap: 4,
                      }}>
                        <div>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>
                            {esFuturo ? 'Usado' : 'Gastado'}
                          </p>
                          <p style={{
                            fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                            color: sobreGiro ? 'var(--accent-rose)' : bloque.color,
                          }}>
                            {formatCurrency(gastado)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>
                            Presupuestado
                          </p>
                          <p style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>
                            {formatCurrency(presupuestadoBloque)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 3 }}>
                            Disponible
                          </p>
                          <p style={{
                            fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                            color: disponible >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                          }}>
                            {formatCurrency(Math.max(0, disponible))}
                          </p>
                        </div>
                      </div>

                      {/* Barra de progreso real */}
                      <div style={{ padding: '0 18px' }}>
                        <div style={{
                          width: '100%', height: 4, borderRadius: 999,
                          background: 'var(--progress-track)', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 999,
                            width: `${pctGastado}%`,
                            background: sobreGiro ? 'var(--accent-rose)' : bloque.color,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>

                      {/* Techo y sin asignar */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 18px 14px',
                      }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Techo: {formatCurrency(monto)}
                        </p>
                        {sinAsignar > 0 ? (
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            padding: '3px 10px', borderRadius: 999,
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-muted)',
                          }}>
                            {formatCurrency(sinAsignar)} sin asignar
                          </span>
                        ) : sinAsignar === 0 ? (
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            padding: '3px 10px', borderRadius: 999,
                            background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                            color: 'var(--accent-green)',
                          }}>
                            Todo asignado
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 11, fontWeight: 600,
                            padding: '3px 10px', borderRadius: 999,
                            background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
                            color: 'var(--accent-rose)',
                          }}>
                            {formatCurrency(Math.abs(sinAsignar))} sobre techo
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  {/* ── DIVISOR ── */}
                  <div style={{ height: 1, background: 'var(--border-glass)', margin: '0 18px' }} />

                  {/* ── FUTURO: metas e inversiones ── */}
                  {esFuturo && (
                    <div style={{ padding: '14px 18px' }}>
                      {metas.length > 0 && (
                        <div style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Target size={11} style={{ color: 'var(--accent-green)' }} />
                              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                                Metas de ahorro
                              </span>
                              {ingresoNum > 0 && (
                                <span style={{
                                  fontSize: 10, fontWeight: 600,
                                  padding: '2px 7px', borderRadius: 999,
                                  background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                                  color: 'var(--accent-green)',
                                }}>
                                  {sub.metas}% · {formatCurrency(montoMetas)}
                                </span>
                              )}
                            </div>
                            <a href="/metas" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                              Ver <ArrowRight size={10} />
                            </a>
                          </div>
                          {metas.filter(m => m.estado !== 'completada').map(m => {
                            const metaMensual = (m.pct_mensual / 100) * montoMetas
                            return (
                              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: bloque.color, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {m.emoji} {m.nombre}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                  {m.pct_mensual}%
                                </span>
                                {ingresoNum > 0 && (
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-green)', fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right' }}>
                                    {formatCurrency(metaMensual)}/mes
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {inversiones.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <TrendingUp size={11} style={{ color: 'var(--accent-violet)' }} />
                              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                                Inversiones
                              </span>
                              {ingresoNum > 0 && (
                                <span style={{
                                  fontSize: 10, fontWeight: 600,
                                  padding: '2px 7px', borderRadius: 999,
                                  background: 'color-mix(in srgb, var(--accent-violet) 10%, transparent)',
                                  color: 'var(--accent-violet)',
                                }}>
                                  {sub.inversiones}% · {formatCurrency(montoInversiones)}
                                </span>
                              )}
                            </div>
                            <a href="/inversiones" style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                              Ver <ArrowRight size={10} />
                            </a>
                          </div>
                          {inversiones.map(inv => {
                            const invMensual = ((inv.pct_mensual || 0) / 100) * montoInversiones
                            return (
                              <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-violet)', flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {inv.emoji} {inv.nombre}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                  {inv.pct_mensual || 0}%
                                </span>
                                {ingresoNum > 0 && invMensual > 0 && (
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-violet)', fontVariantNumeric: 'tabular-nums', minWidth: 72, textAlign: 'right' }}>
                                    {formatCurrency(invMensual)}/mes
                                  </span>
                                )}
                              </div>
                            )
                          })}
                          {inversiones.length === 0 && (
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin carteras aún</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── NECESIDADES / ESTILO: categorías ── */}
                  {!esFuturo && (
                    <div style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                          Categorías
                        </span>
                        <button onClick={() => setVista('categorias')} style={{
                          fontSize: 11, fontWeight: 600, color: bloque.color,
                          background: 'none', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          Editar <ArrowRight size={10} />
                        </button>
                      </div>

                      {catsBloque.length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin categorías aún</p>
                      ) : (
                        catsBloque.map(cat => {
                          const subs = subcategoriasCfg.filter(s => s.categoria_id === cat.id)
                          const catPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                          const catGast = subs.reduce((s, sub) =>
                            s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0), 0)
                          const catPct = catPres > 0 ? Math.min(100, (catGast / catPres) * 100) : 0

                          return (
                            <div key={cat.id} style={{ marginBottom: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {cat.nombre}
                                </span>
                                {catGast > 0 && (
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatCurrency(catGast)} /
                                  </span>
                                )}
                                <span style={{
                                  fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                                  color: catPres > 0 ? cat.color : 'var(--text-muted)',
                                  minWidth: 64, textAlign: 'right',
                                }}>
                                  {formatCurrency(catPres)}
                                </span>
                              </div>
                              {catPres > 0 && (
                                <div style={{ height: 2, borderRadius: 999, background: 'var(--progress-track)', marginLeft: 14, overflow: 'hidden' }}>
                                  <div style={{
                                    height: '100%', borderRadius: 999,
                                    width: `${catPct}%`,
                                    background: catPct >= 100 ? 'var(--accent-rose)' : cat.color,
                                    transition: 'width 0.4s ease',
                                  }} />
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── BLOQUE DEUDAS ── */}
          {deudas.length > 0 && (
            <div className="animate-enter mb-3" style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              borderRadius: 20,
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                padding: '16px 18px 14px',
                borderBottom: '1px solid var(--border-glass)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                    background: 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CircleDollarSign size={17} style={{ color: 'var(--accent-rose)' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>Deudas</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>Compromisos mensuales fijos</p>
                  </div>
                </div>
                <a href="/deudas" style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--accent-rose)',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  Ver <ArrowRight size={10} />
                </a>
              </div>

              {/* Lista deudas */}
              <div style={{ padding: '8px 0' }}>
                {deudas.map((d, i) => {
                  const movsDeuda = deudaMovs.filter(m => m.deuda_id === d.id)
                  const pagadaEsteMes = movsDeuda.some(m => m.tipo === 'pago')
                  const montoPagado = movsDeuda
                    .filter(m => m.tipo === 'pago')
                    .reduce((s, m) => s + parseFloat(m.monto || 0), 0)
                  return (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 18px',
                      borderBottom: i < deudas.length - 1 ? '1px solid var(--border-glass)' : 'none',
                      background: pagadaEsteMes
                        ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)'
                        : 'transparent',
                    }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{d.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {d.nombre}
                        </p>
                        {pagadaEsteMes && montoPagado > 0 && (
                          <p style={{ fontSize: 10, color: 'var(--accent-green)', marginTop: 1 }}>
                            Abonado {formatCurrency(montoPagado)}
                          </p>
                        )}
                      </div>
                      {pagadaEsteMes ? (
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '3px 9px', borderRadius: 999, flexShrink: 0,
                          background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                          color: 'var(--accent-green)',
                        }}>
                          ✓ pagado
                        </span>
                      ) : d.cuota > 0 && (
                        <span style={{
                          fontSize: 13, fontWeight: 700, flexShrink: 0,
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--accent-rose)',
                        }}>
                          {formatCurrency(d.cuota)}/mes
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 18px',
                borderTop: '1px solid var(--border-glass)',
                background: 'var(--bg-secondary)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total letras este mes</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-rose)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatCurrency(deudas.reduce((s, d) => s + (d.cuota || 0), 0))}
                </span>
              </div>
            </div>
          )}

          {/* ── RESUMEN DEL MES ── */}
          {/* Resumen del mes */}
          {ingresoNum > 0 && (
            <Card className="animate-enter">
              <p className="font-script" style={{ fontSize: 35, color: 'var(--text-primary)' }}>Resumen del mes</p>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                {now.toLocaleString('es-ES', { month: 'long' })} — ingresos registrados
              </p>
              <div className="space-y-3">
                {bloques.map(b => {
                  const monto = ingresoNum * (b.pct / 100)
                  const Icon = b.icon
                  const gastado = gastadoReal(b.id)
                  return (
                    <div key={b.id} className="rounded-xl p-3"
                      style={{
                        background: `color-mix(in srgb, ${b.color} 6%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${b.color} 14%, transparent)`,
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `color-mix(in srgb, ${b.color} 12%, transparent)` }}>
                          <Icon size={13} style={{ color: b.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{b.nombre}</p>
                          {b.id === 'futuro'
                            ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {sub.metas}% metas · {sub.inversiones}% inversiones
                            </p>
                            : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.pct}%</p>
                          }
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-semibold" style={{ color: b.color }}>{formatCurrency(monto)}</p>
                          <p className="text-xs" style={{ color: gastado > monto ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                            {formatCurrency(gastado)} {b.id === 'futuro' ? 'usado' : 'gastado'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div className="flex items-center justify-between px-3 py-3 rounded-xl"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                  <div className="flex items-center gap-2">
                    <CheckCircle size={15} style={{ color: 'var(--accent-green)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Total ingreso</span>
                  </div>
                  <span className="text-base font-semibold" style={{ color: 'var(--accent-green)' }}>
                    {formatCurrency(ingresoNum)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </>}

        {vista === 'categorias' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {categoriasCfg.length === 0 && metas.length === 0 && inversiones.length === 0 && deudas.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Sin elementos configurados
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Crea categorías en Ajustes, o añade Metas e Inversiones
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="/ajustes" className="ff-btn-primary" style={{ textDecoration: 'none' }}>Configuración</a>
                  <a href="/metas" className="ff-btn-ghost" style={{ textDecoration: 'none' }}>Nueva Meta</a>
                </div>
              </div>
            ) : (
              <>
                {/* ── BLOQUES ── */}
                {BLOQUES_META.map(bloque => {
                  const Icon = bloque.icon
                  const catsBloque = categoriasCfg.filter(c => c.bloque === bloque.id)
                  const esFuturo = bloque.id === 'futuro'
                  const cerrado = bloquesCerrados.has(bloque.id)

                  if (esFuturo && catsBloque.length === 0 && metas.length === 0 && inversiones.length === 0) return null

                  // Resumen para mostrar en header cuando está cerrado
                  const presBloque = esFuturo
                    ? metas.filter(m => m.estado === 'activa').reduce((s, m) => s + ((m.pct_mensual / 100) * montoMetas), 0)
                    + inversiones.filter(i => (i.pct_mensual || 0) > 0).reduce((s, i) => s + ((i.pct_mensual / 100) * montoInversiones), 0)
                    + catsBloque.flatMap(c => subcategoriasCfg.filter(s => s.categoria_id === c.id))
                      .reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                    : catsBloque.flatMap(c => subcategoriasCfg.filter(s => s.categoria_id === c.id))
                      .reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)

                  const gastBloque = gastadoReal(bloque.id)
                  const techoBloque = ingresoNum * ((bloque.pct || 0) / 100)
                  const pctBarra = presBloque > 0 ? Math.min(100, (gastBloque / presBloque) * 100) : 0

                  return (
                    <div key={bloque.id} className="animate-enter" style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 20,
                      overflow: 'hidden',
                    }}>
                      {/* Header colapsable */}
                      <div
                        onClick={() => toggleBloque(bloque.id)}
                        style={{
                          padding: '14px 18px',
                          display: 'flex', alignItems: 'center', gap: 12,
                          cursor: 'pointer', userSelect: 'none',
                          borderBottom: cerrado ? 'none' : '1px solid var(--border-glass)',
                        }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                          background: `color-mix(in srgb, ${bloque.color} 12%, transparent)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={16} style={{ color: bloque.color }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            {bloque.nombre}
                          </p>
                          {ingresoNum > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(gastBloque)} gastado
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                              <span style={{ fontSize: 11, color: bloque.color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                {formatCurrency(presBloque)} presup.
                              </span>
                              {ingresoNum > 0 && (
                                <>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>·</span>
                                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                    techo {formatCurrency(techoBloque)}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        {cerrado
                          ? <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          : <ChevronUp size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        }
                      </div>

                      {/* Mini barra siempre visible */}
                      {ingresoNum > 0 && !cerrado && (
                        <div style={{ height: 3, background: 'var(--progress-track)' }}>
                          <div style={{
                            height: '100%',
                            width: `${pctBarra}%`,
                            background: pctBarra >= 100 ? 'var(--accent-rose)' : bloque.color,
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                      )}

                      {/* Contenido colapsable */}
                      <div className={`collapsible-content ${cerrado ? 'closed' : 'open'}`}>

                        {/* FUTURO — metas e inversiones */}
                        {esFuturo && (
                          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                            {/* Metas */}
                            {metas.length > 0 && (
                              <div style={{
                                borderRadius: 14, overflow: 'hidden',
                                border: '1px solid var(--border-glass)',
                              }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: 'var(--bg-secondary)',
                                  borderBottom: '1px solid var(--border-glass)',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <Target size={12} style={{ color: 'var(--accent-green)' }} />
                                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Metas de Ahorro</p>
                                    {ingresoNum > 0 && (
                                      <span style={{
                                        fontSize: 10, fontWeight: 600,
                                        padding: '2px 7px', borderRadius: 999,
                                        background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
                                        color: 'var(--accent-green)',
                                      }}>
                                        {sub.metas}% · {formatCurrency(montoMetas)}
                                      </span>
                                    )}
                                  </div>
                                  <a href="/metas" style={{
                                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3,
                                  }}>
                                    Editar <ArrowRight size={10} />
                                  </a>
                                </div>
                                {metas.map((m, i) => {
                                  const metaMensual = (m.pct_mensual / 100) * montoMetas
                                  const pctCompletada = Math.min(100, Math.round(((m.actual || 0) / m.meta) * 100))
                                  return (
                                    <div key={m.id} style={{
                                      padding: '10px 14px',
                                      borderBottom: i < metas.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 16, flexShrink: 0 }}>{m.emoji}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {m.nombre}
                                          </p>
                                          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                            {pctCompletada}% completada · {m.pct_mensual}% del presup. metas
                                          </p>
                                        </div>
                                        {ingresoNum > 0 && (
                                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                            {formatCurrency(metaMensual)}/mes
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                {(() => {
                                  const totalPctMetas = metas.filter(m => m.estado === 'activa').reduce((s, m) => s + (m.pct_mensual || 0), 0)
                                  const libre = 100 - totalPctMetas
                                  return (
                                    <div style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      padding: '8px 14px',
                                      background: 'var(--bg-secondary)',
                                      borderTop: '1px solid var(--border-glass)',
                                    }}>
                                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                        {totalPctMetas}% asignado · {libre}% libre
                                      </span>
                                      {ingresoNum > 0 && (
                                        <span style={{
                                          fontSize: 10, fontWeight: 600,
                                          color: libre > 0 ? 'var(--text-muted)' : 'var(--accent-green)',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}>
                                          {formatCurrency((libre / 100) * montoMetas)} sin asignar
                                        </span>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            )}

                            {/* Inversiones */}
                            {inversiones.length > 0 && (
                              <div style={{
                                borderRadius: 14, overflow: 'hidden',
                                border: '1px solid var(--border-glass)',
                              }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '10px 14px',
                                  background: 'var(--bg-secondary)',
                                  borderBottom: '1px solid var(--border-glass)',
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <TrendingUp size={12} style={{ color: 'var(--accent-violet)' }} />
                                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Carteras de Inversión</p>
                                    {ingresoNum > 0 && (
                                      <span style={{
                                        fontSize: 10, fontWeight: 600,
                                        padding: '2px 7px', borderRadius: 999,
                                        background: 'color-mix(in srgb, var(--accent-violet) 10%, transparent)',
                                        color: 'var(--accent-violet)',
                                      }}>
                                        {sub.inversiones}% · {formatCurrency(montoInversiones)}
                                      </span>
                                    )}
                                  </div>
                                  <a href="/inversiones" style={{
                                    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
                                    textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3,
                                  }}>
                                    Editar <ArrowRight size={10} />
                                  </a>
                                </div>
                                {inversiones.map((inv, i) => {
                                  const invMensual = ((inv.pct_mensual || 0) / 100) * montoInversiones
                                  return (
                                    <div key={inv.id} style={{
                                      padding: '10px 14px',
                                      borderBottom: i < inversiones.length - 1 ? '1px solid var(--border-glass)' : 'none',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 16, flexShrink: 0 }}>{inv.emoji}</span>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {inv.nombre}
                                          </p>
                                          {inv.pct_mensual > 0 && (
                                            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                              {inv.pct_mensual}% del presup. inversiones
                                            </p>
                                          )}
                                        </div>
                                        {ingresoNum > 0 && inv.pct_mensual > 0 && (
                                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-violet)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                            {formatCurrency(invMensual)}/mes
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                {(() => {
                                  const totalPctInv = inversiones.reduce((s, i) => s + (i.pct_mensual || 0), 0)
                                  const libre = 100 - totalPctInv
                                  const pctUsado = montoInversiones > 0 ? Math.min(100, (aportesInvEsteMes / montoInversiones) * 100) : 0
                                  const diff = montoInversiones - aportesInvEsteMes
                                  return (
                                    <div style={{
                                      padding: '8px 14px',
                                      background: 'var(--bg-secondary)',
                                      borderTop: '1px solid var(--border-glass)',
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                          {totalPctInv}% asignado · {libre > 0 ? `${libre}% libre` : 'Completo'}
                                        </span>
                                        {ingresoNum > 0 && (
                                          <span style={{
                                            fontSize: 10, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                                            color: diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                                          }}>
                                            {formatCurrency(aportesInvEsteMes)} aportado / {formatCurrency(montoInversiones)}
                                          </span>
                                        )}
                                      </div>
                                      {ingresoNum > 0 && (
                                        <div style={{ height: 3, borderRadius: 999, overflow: 'hidden', background: 'var(--progress-track)' }}>
                                          <div style={{
                                            height: '100%', borderRadius: 999,
                                            width: `${pctUsado}%`,
                                            background: pctUsado > 100 ? 'var(--accent-rose)' : 'var(--accent-violet)',
                                            transition: 'width 0.4s ease',
                                          }} />
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()}
                              </div>
                            )}

                            {metas.length === 0 && inversiones.length === 0 && (
                              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin metas ni inversiones aún</p>
                            )}
                          </div>
                        )}

                        {/* CATEGORÍAS normales */}
                        {!esFuturo && catsBloque.length === 0 && (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 18px',
                          }}>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin categorías aún</p>
                            <a href="/ajustes" style={{
                              fontSize: 11, fontWeight: 600, color: bloque.color,
                              textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                            }}>
                              Configurar <ArrowRight size={11} />
                            </a>
                          </div>
                        )}

                        {catsBloque.length > 0 && (
                          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {esFuturo && (metas.length > 0 || inversiones.length > 0) && (
                              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                                Otras categorías
                              </p>
                            )}
                            {catsBloque.map(cat => {
                              const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                              const totalPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                              const totalGast = subs.reduce((s, sub) =>
                                s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0), 0)
                              const diff = totalPres - totalGast
                              const pctUsado = totalPres > 0 ? Math.min(100, (totalGast / totalPres) * 100) : 0

                              return (
                                <div key={cat.id} style={{
                                  borderRadius: 14, overflow: 'hidden',
                                  border: '1px solid var(--border-glass)',
                                }}>
                                  {/* Header categoría */}
                                  <div style={{
                                    padding: '10px 14px',
                                    background: 'var(--bg-secondary)',
                                    borderBottom: '1px solid var(--border-glass)',
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                                      <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{cat.nombre}</p>
                                      <span style={{
                                        fontSize: 11, fontWeight: 700,
                                        padding: '2px 8px', borderRadius: 999,
                                        background: `color-mix(in srgb, ${diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'} 10%, transparent)`,
                                        color: diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                                        fontVariantNumeric: 'tabular-nums',
                                      }}>
                                        {diff >= 0 ? '+' : '-'}{formatCurrency(Math.abs(diff))}
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 16 }}>
                                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                        Presup. <span style={{ fontWeight: 600, color: cat.color }}>{formatCurrency(totalPres)}</span>
                                      </span>
                                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                        Gastado <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{formatCurrency(totalGast)}</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Barra categoría */}
                                  {totalPres > 0 && (
                                    <div style={{ height: 3, background: 'var(--progress-track)' }}>
                                      <div style={{
                                        height: '100%',
                                        width: `${pctUsado}%`,
                                        background: pctUsado >= 100 ? 'var(--accent-rose)' : cat.color,
                                        transition: 'width 0.5s ease',
                                      }} />
                                    </div>
                                  )}

                                  {/* Subcategorías */}
                                  {subs.length === 0 ? (
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 14px' }}>
                                      Sin subcategorías — añade en Configuración
                                    </p>
                                  ) : (
                                    subs.map((sub, i) => {
                                      const gastadoSub = movs
                                        .filter(m => m.subcategoria_id === sub.id)
                                        .reduce((s, m) => s + parseFloat(m.monto), 0)
                                      const montoPres = parseFloat(montosCats[sub.id]) || 0
                                      const difSub = montoPres - gastadoSub
                                      const pctSub = montoPres > 0 ? Math.min(100, (gastadoSub / montoPres) * 100) : 0
                                      const overBudget = montoPres > 0 && gastadoSub > montoPres

                                      return (
                                        <div key={sub.id} style={{
                                          padding: '12px 14px',
                                          borderTop: i > 0 ? '1px solid var(--border-glass)' : 'none',
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                              {sub.nombre}
                                            </p>
                                            {montoPres > 0 && (
                                              <span style={{
                                                fontSize: 10, fontWeight: 700,
                                                padding: '2px 7px', borderRadius: 999,
                                                fontVariantNumeric: 'tabular-nums',
                                                background: `color-mix(in srgb, ${overBudget ? 'var(--accent-rose)' : 'var(--accent-green)'} 10%, transparent)`,
                                                color: overBudget ? 'var(--accent-rose)' : 'var(--accent-green)',
                                              }}>
                                                {overBudget ? '−' : '+'}{formatCurrency(Math.abs(difSub))}
                                              </span>
                                            )}
                                          </div>
                                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                            <div style={{ borderRadius: 10, padding: '8px 10px', background: 'var(--bg-secondary)' }}>
                                              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
                                                Presupuestado
                                              </p>
                                              <input
                                                type="number" step="0.01" min="0" placeholder="0.00"
                                                value={montosCats[sub.id] ?? ''}
                                                onChange={e => setMontosCats(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                                onBlur={e => guardarPresupuestoCat(sub.id, e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                                style={{
                                                  width: '100%', background: 'none', border: 'none', outline: 'none',
                                                  fontSize: 13, fontWeight: 700, color: cat.color,
                                                  fontFamily: 'Inter, sans-serif', padding: 0,
                                                }}
                                              />
                                            </div>
                                            <div style={{
                                              borderRadius: 10, padding: '8px 10px',
                                              background: overBudget
                                                ? 'color-mix(in srgb, var(--accent-rose) 8%, var(--bg-secondary))'
                                                : 'var(--bg-secondary)',
                                            }}>
                                              <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
                                                Gastado
                                              </p>
                                              <p style={{
                                                fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                                color: gastadoSub > 0
                                                  ? (overBudget ? 'var(--accent-rose)' : 'var(--text-secondary)')
                                                  : 'var(--text-muted)',
                                              }}>
                                                {gastadoSub > 0 ? formatCurrency(gastadoSub) : '—'}
                                              </p>
                                            </div>
                                          </div>
                                          {montoPres > 0 && (
                                            <div style={{ marginTop: 8, height: 3, borderRadius: 999, overflow: 'hidden', background: 'var(--progress-track)' }}>
                                              <div style={{
                                                height: '100%', borderRadius: 999,
                                                width: `${pctSub}%`,
                                                background: overBudget ? 'var(--accent-rose)' : cat.color,
                                                transition: 'width 0.4s ease',
                                              }} />
                                            </div>
                                          )}
                                        </div>
                                      )
                                    })
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* ── DEUDAS ── */}
                {deudas.length > 0 && (
                  <div className="animate-enter" style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 20,
                    overflow: 'hidden',
                  }}>
                    <div
                      onClick={() => toggleBloque('deudas')}
                      style={{
                        padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        cursor: 'pointer', userSelect: 'none',
                        borderBottom: bloquesCerrados.has('deudas') ? 'none' : '1px solid var(--border-glass)',
                      }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                        background: 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CircleDollarSign size={16} style={{ color: 'var(--accent-rose)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>Deudas activas</p>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(deudas.reduce((s, d) => s + (d.cuota || 0), 0))} en cuotas este mes
                        </p>
                      </div>
                      <a href="/deudas"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-rose)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                        Ver <ArrowRight size={10} />
                      </a>
                      {bloquesCerrados.has('deudas')
                        ? <ChevronDown size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        : <ChevronUp size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      }
                    </div>

                    <div className={`collapsible-content ${bloquesCerrados.has('deudas') ? 'closed' : 'open'}`}>
                      {deudas.map((d, i) => {
                        const movsDeuda = deudaMovs.filter(m => m.deuda_id === d.id)
                        const pagadaEsteMes = movsDeuda.some(m => m.tipo === 'pago')
                        const montoPagado = movsDeuda.filter(m => m.tipo === 'pago').reduce((s, m) => s + parseFloat(m.monto || 0), 0)
                        return (
                          <div key={d.id} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 18px',
                            borderBottom: i < deudas.length - 1 ? '1px solid var(--border-glass)' : 'none',
                            background: pagadaEsteMes ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)' : 'transparent',
                          }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{d.emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {d.nombre}
                              </p>
                              {pagadaEsteMes && montoPagado > 0 && (
                                <p style={{ fontSize: 10, color: 'var(--accent-green)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                                  Abonado {formatCurrency(montoPagado)}
                                </p>
                              )}
                            </div>
                            {pagadaEsteMes ? (
                              <span style={{
                                fontSize: 10, fontWeight: 700,
                                padding: '3px 9px', borderRadius: 999, flexShrink: 0,
                                background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                                color: 'var(--accent-green)',
                              }}>
                                ✓ pagado
                              </span>
                            ) : d.cuota > 0 && (
                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-rose)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                                {formatCurrency(d.cuota)}/mes
                              </span>
                            )}
                          </div>
                        )
                      })}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 18px',
                        borderTop: '1px solid var(--border-glass)',
                        background: 'var(--bg-secondary)',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total cuotas</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent-rose)', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCurrency(deudas.reduce((s, d) => s + (d.cuota || 0), 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                               {/* RESUMEN TOTAL — FIX Bug 1: inversiones usa pct_mensual * montoInversiones, no i.aporte */}
                {ingresoNum > 0 && (() => {
                  const totalPresupuestado = Object.values(montosCats).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                    + deudas.reduce((s, d) => s + (d.cuota || 0), 0)
                    + metas.filter(m => m.estado === 'activa').reduce((s, m) => s + ((m.pct_mensual / 100) * montoMetas), 0)
                    + inversiones.reduce((s, i) => s + ((i.pct_mensual / 100) * montoInversiones), 0) // ✅ FIX
                  const totalGastado = gastadoReal('necesidades') + gastadoReal('estilo') + gastadoReal('futuro')
                  const sinAsignar = ingresoNum - totalPresupuestado
                  const pctAsignado = ingresoNum > 0 ? Math.min(100, (totalPresupuestado / ingresoNum) * 100) : 0

                  return (
                    <Card className="animate-enter">
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-4"
                        style={{ color: 'var(--text-muted)' }}>Resumen mensual</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total presupuestado</span>
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(totalPresupuestado)}
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pctAsignado}%`, background: pctAsignado > 100 ? 'var(--accent-rose)' : 'var(--accent-blue)' }} />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Gastado real</span>
                          <span className="text-sm font-semibold" style={{ color: 'var(--accent-rose)' }}>
                            {formatCurrency(totalGastado)}
                          </span>
                        </div>
                        <div className="h-px" style={{ background: 'var(--border-glass)' }} />
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {sinAsignar >= 0 ? 'Sin asignar' : 'Sobre presupuesto'}
                          </span>
                          <span className="text-base font-semibold"
                            style={{ color: sinAsignar >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                            {sinAsignar >= 0 ? '+' : ''}{formatCurrency(sinAsignar)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  )
                })()}
              </>
            )}
          </div>
        )}

      </>}

    </AppShell>
  )
}