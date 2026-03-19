'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Home, Sparkles, Sprout, CheckCircle, Edit3, Save, X,
  Loader2, AlertTriangle, List, LayoutGrid, ArrowRight, Target, TrendingUp
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const BLOQUES_META = [
  { id: 'necesidades', nombre: 'Necesidades', icon: Home,     color: 'var(--accent-blue)',  pct: 50, descripcion: 'Gastos obligatorios del mes' },
  { id: 'estilo',      nombre: 'Estilo de vida', icon: Sparkles, color: 'var(--accent-terra)', pct: 20, descripcion: 'Gastos de disfrute y ocio' },
  { id: 'futuro',      nombre: 'Futuro',       icon: Sprout,  color: 'var(--accent-green)', pct: 30, descripcion: 'Construye tu patrimonio' },
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
  const [bloques, setBloques]       = useState(BLOQUES_META)
  const [ingreso, setIngreso]       = useState('')
  const [editando, setEditando]     = useState(false)
  const [borradores, setBorradores] = useState(null)
  const [movs, setMovs]             = useState([])
  const [sobreMovs, setSobreMovs]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [vista, setVista]           = useState('general')
  const [categoriasCfg, setCategoriasCfg]       = useState([])
  const [subcategoriasCfg, setSubcategoriasCfg] = useState([])
  const [montosCats, setMontosCats]             = useState({})
  const [metas, setMetas]           = useState([])
  const [inversiones, setInversiones] = useState([])

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const fechaInicio = `${año}-${String(mes).padStart(2, '0')}-01`
    const fechaFin    = new Date(año, mes, 0).toISOString().slice(0, 10)

    try {
      const [
        { data: movsData },
        { data: bloquesData },
        { data: sobreData },
        { data: catsData },
        { data: subsData },
        { data: presCatsData },
        { data: metasData },
        { data: invData },
      ] = await Promise.all([
        supabase.from('movimientos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
        supabase.from('presupuesto_bloques').select('*'),
        supabase.from('sobre_movimientos').select('*').eq('mes', mes).eq('año', año),
        supabase.from('categorias').select('*').order('bloque').order('orden').order('nombre'),
        supabase.from('subcategorias').select('*').order('orden').order('nombre'),
        supabase.from('presupuesto_cats').select('*').eq('mes', mes).eq('año', año),
        supabase.from('metas').select('id, nombre, emoji, pct_mensual, meta, actual').order('created_at'),
        supabase.from('inversiones').select('id, nombre, emoji, aporte, color').order('created_at'),
      ])

      const movsArr = movsData || []
      setMovs(movsArr)
      setSobreMovs(sobreData || [])
      setCategoriasCfg(catsData || [])
      setSubcategoriasCfg(subsData || [])
      setMetas(metasData || [])
      setInversiones(invData || [])

      const initMontos = {}
      ;(presCatsData || []).forEach(p => { initMontos[p.subcategoria_id] = p.monto })
      setMontosCats(initMontos)

      const totalIngresos = movsArr
        .filter(m => m.tipo === 'ingreso')
        .reduce((s, m) => s + parseFloat(m.monto), 0)
      setIngreso(totalIngresos > 0 ? totalIngresos.toString() : '')

      if (bloquesData?.length > 0) {
        setBloques(prev => prev.map(b => {
          const found = bloquesData.find(r => r.bloque === b.id)
          return found ? { ...b, pct: found.pct } : b
        }))
      }
    } catch (err) {
      console.error('Error cargando presupuesto:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Guardar presupuesto por subcategoría ──────────────────────────────────
  async function guardarPresupuestoCat(subcategoriaId, monto) {
    const valor = parseFloat(monto) || 0
    const { data, error } = await supabase.from('presupuesto_cats').upsert({
      subcategoria_id: subcategoriaId, mes, año, monto: valor,
    }, { onConflict: 'subcategoria_id,mes,año' }).select()
    if (!error && data?.[0]) {
      setMontosCats(prev => ({ ...prev, [subcategoriaId]: valor }))
    }
  }

  // ── Gasto real por bloque ─────────────────────────────────────────────────
  function gastadoReal(bloqueId) {
    const deMovimientos = movs
      .filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === bloqueId)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    // Para futuro: incluye transferencias a metas e inversiones
    const deTraspasos = sobreMovs
      .filter(m => ORIGEN_BLOQUE[m.origen] === bloqueId && parseFloat(m.monto) > 0)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    return deMovimientos + deTraspasos
  }

  // ── Presupuestado por bloque ───────────────────────────────────────────────
  function presupuestadoBloque(bloqueId) {
    // Categorías custom de ajustes
    const catsPres = categoriasCfg
      .filter(c => c.bloque === bloqueId)
      .reduce((s, cat) => {
        const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
        return s + subs.reduce((ss, sub) => ss + (parseFloat(montosCats[sub.id]) || 0), 0)
      }, 0)

    // Para futuro: suma aportes de inversiones
    if (bloqueId === 'futuro') {
      const invPres = inversiones.reduce((s, inv) => s + (parseFloat(inv.aporte) || 0), 0)
      return catsPres + invPres
    }
    return catsPres
  }

  // ── Edición de porcentajes ────────────────────────────────────────────────
  function iniciarEdicion()  { setBorradores(bloques.map(b => ({ ...b }))); setEditando(true) }
  function cancelarEdicion() { setBorradores(null); setEditando(false) }

  async function guardarEdicion() {
    if (!totalOk || saving) return
    setSaving(true)
    const results = await Promise.all(borradores.map(b =>
      supabase.from('presupuesto_bloques').upsert({ bloque: b.id, pct: b.pct }, { onConflict: 'bloque' })
    ))
    setSaving(false)
    if (results.some(r => r.error)) { alert('Error al guardar porcentajes'); return }
    setBloques(borradores)
    setBorradores(null)
    setEditando(false)
  }

  function cambiarPct(id, val) {
    setBorradores(prev => prev.map(b =>
      b.id === id ? { ...b, pct: Math.max(0, Math.min(100, parseInt(val) || 0)) } : b
    ))
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const ingresoNum = parseFloat(ingreso) || 0
  const lista      = editando ? borradores : bloques
  const totalPct   = lista.reduce((s, b) => s + b.pct, 0)
  const totalOk    = totalPct === 100

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <AppShell>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4 animate-enter">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Módulo
          </p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Mi Presupuesto
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        {vista === 'general' && !editando && (
          <button onClick={iniciarEdicion} className="ff-btn-ghost flex items-center gap-2">
            <Edit3 size={14} /> Distribución
          </button>
        )}
      </div>

      {/* ── Panel de edición de distribución ─────────────────────────────────── */}
      {editando && (
        <Card className="mb-5 animate-enter" style={{ border: '1px solid var(--accent-blue)' }}>

          {/* Cabecera compacta */}
          <div className="flex items-center gap-2 mb-4">
            <Edit3 size={14} style={{ color: 'var(--accent-blue)' }} />
            <p className="flex-1 font-black text-sm" style={{ color: 'var(--text-primary)' }}>
              Distribución de ingresos
            </p>
            <button onClick={cancelarEdicion} style={{
              color: 'var(--text-muted)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 4, lineHeight: 0,
            }}>
              <X size={16} />
            </button>
          </div>

          {/* Sliders por bloque */}
          <div className="space-y-5">
            {borradores.map(b => {
              const BIcon = b.icon
              return (
                <div key={b.id}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${b.color} 12%, transparent)` }}>
                      <BIcon size={14} style={{ color: b.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {b.nombre}
                      </p>
                      {ingresoNum > 0 && (
                        <p className="text-xs mt-0.5" style={{ color: b.color }}>
                          {formatCurrency(ingresoNum * b.pct / 100)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input
                        type="number" min="0" max="100"
                        value={b.pct}
                        onChange={e => cambiarPct(b.id, e.target.value)}
                        className="ff-input text-center font-black w-14"
                        style={{ color: b.color, fontSize: 18 }}
                      />
                      <span className="text-base font-black" style={{ color: 'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${b.pct}%`, background: b.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer: total + guardar */}
          <div className="mt-5 pt-4 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border-glass)' }}>
            <div className="flex items-center gap-2">
              {totalOk
                ? <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                : <AlertTriangle size={14} style={{ color: 'var(--accent-rose)' }} />
              }
              <span className="text-sm font-black"
                style={{ color: totalOk ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                {totalPct}%{!totalOk && ` — ${100 - totalPct > 0 ? 'faltan' : 'sobran'} ${Math.abs(100 - totalPct)}%`}
              </span>
            </div>
            <button onClick={guardarEdicion} disabled={!totalOk || saving}
              className="ff-btn-primary text-sm py-1.5 px-4 flex items-center gap-1.5"
              style={{ opacity: totalOk ? 1 : 0.5 }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar
            </button>
          </div>
        </Card>
      )}

      {/* Selector de vista */}
      <div className="flex mb-5 p-1 rounded-xl gap-1"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', width: 'fit-content' }}>
        {[
          { id: 'general',    label: 'General',        Icon: LayoutGrid },
          { id: 'categorias', label: 'Por categorías', Icon: List },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setVista(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{
              background: vista === id ? 'var(--text-primary)' : 'transparent',
              color:      vista === id ? 'var(--bg-card)' : 'var(--text-muted)',
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

          {/* Bloques */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {lista.map(bloque => {
              const Icon          = bloque.icon
              const monto         = ingresoNum * (bloque.pct / 100)
              const gastado       = gastadoReal(bloque.id)
              const presupuestado = presupuestadoBloque(bloque.id)
              const disponible    = monto - gastado
              const pctGastado    = monto > 0 ? Math.min(100, (gastado / monto) * 100) : 0
              const sobreGiro     = gastado > monto
              const catsBloque    = categoriasCfg.filter(c => c.bloque === bloque.id)
              const esFuturo      = bloque.id === 'futuro'

              return (
                <Card key={bloque.id} className="animate-enter">

                  {/* Cabecera */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${bloque.color} 12%, transparent)` }}>
                      <Icon size={18} style={{ color: bloque.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{bloque.nombre}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{bloque.descripcion}</p>
                    </div>
                  </div>

                  {/* Porcentaje */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl font-black flex-1"
                      style={{ color: bloque.color, letterSpacing: '-0.03em' }}>
                      {bloque.pct}%
                    </span>
                    {ingresoNum > 0 && (
                      <span className="text-sm font-black" style={{ color: bloque.color }}>
                        {formatCurrency(monto)}
                      </span>
                    )}
                  </div>

                  {/* Barra del porcentaje */}
                  <div className="w-full h-2 rounded-full mb-4" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${bloque.pct}%`, background: bloque.color }} />
                  </div>

                  {/* Gasto real vs límite */}
                  {ingresoNum > 0 && (
                    <div className="rounded-xl p-3 mb-4 space-y-2"
                      style={{
                        background: `color-mix(in srgb, ${bloque.color} 6%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${bloque.color} 15%, transparent)`,
                      }}>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>
                          {esFuturo ? 'Ahorrado / invertido' : 'Gastado real'}
                        </span>
                        <span className="font-bold"
                          style={{ color: sobreGiro ? 'var(--accent-rose)' : bloque.color }}>
                          {formatCurrency(gastado)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pctGastado}%`, background: sobreGiro ? 'var(--accent-rose)' : bloque.color }} />
                      </div>
                      {sobreGiro && (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle size={10} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />
                          <p className="text-[9px] font-black" style={{ color: 'var(--accent-rose)' }}>
                            Sobre-giro: {formatCurrency(gastado - monto)} por encima del límite
                          </p>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Disponible</span>
                        <span className="text-sm font-black"
                          style={{ color: disponible >= 0 ? bloque.color : 'var(--accent-rose)' }}>
                          {formatCurrency(disponible)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Sección inferior: categorías + (para futuro) metas e inversiones */}
                  <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12 }}>

                    {/* Metas e Inversiones — solo bloque futuro */}
                    {esFuturo && (metas.length > 0 || inversiones.length > 0) && (
                      <div className="mb-3 space-y-2">
                        {metas.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                                style={{ color: 'var(--accent-green)' }}>
                                <Target size={9} /> Metas
                              </p>
                              <a href="/metas"
                                className="text-[9px] font-bold flex items-center gap-0.5"
                                style={{ color: 'var(--accent-green)', textDecoration: 'none' }}>
                                Ver <ArrowRight size={9} />
                              </a>
                            </div>
                            {metas.map(m => (
                              <div key={m.id} className="flex items-center gap-1.5 py-0.5">
                                <span className="text-xs flex-shrink-0">{m.emoji}</span>
                                <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{m.nombre}</span>
                                <span className="text-[10px] font-bold" style={{ color: 'var(--accent-green)' }}>
                                  {m.pct_mensual}%
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {inversiones.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1"
                                style={{ color: 'var(--accent-violet)' }}>
                                <TrendingUp size={9} /> Inversiones
                              </p>
                              <a href="/inversiones"
                                className="text-[9px] font-bold flex items-center gap-0.5"
                                style={{ color: 'var(--accent-violet)', textDecoration: 'none' }}>
                                Ver <ArrowRight size={9} />
                              </a>
                            </div>
                            {inversiones.map(inv => (
                              <div key={inv.id} className="flex items-center gap-1.5 py-0.5">
                                <span className="text-xs flex-shrink-0">{inv.emoji}</span>
                                <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{inv.nombre}</span>
                                {inv.aporte > 0 && (
                                  <span className="text-[10px] font-bold" style={{ color: 'var(--accent-violet)' }}>
                                    {formatCurrency(inv.aporte)}/mes
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {catsBloque.length > 0 && (
                          <div className="mt-1" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 8 }} />
                        )}
                      </div>
                    )}

                    {/* Categorías custom del bloque */}
                    {catsBloque.length === 0 && !esFuturo ? (
                      <div className="flex items-center justify-between">
                        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin categorías aún</p>
                        <a href="/ajustes"
                          className="text-xs font-bold flex items-center gap-1"
                          style={{ color: bloque.color, textDecoration: 'none' }}>
                          Configurar <ArrowRight size={11} />
                        </a>
                      </div>
                    ) : catsBloque.length === 0 && esFuturo && metas.length === 0 && inversiones.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin elementos aún</p>
                        <a href="/metas"
                          className="text-xs font-bold flex items-center gap-1"
                          style={{ color: bloque.color, textDecoration: 'none' }}>
                          Añadir meta <ArrowRight size={11} />
                        </a>
                      </div>
                    ) : catsBloque.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-black uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}>
                            Categorías · {formatCurrency(presupuestado)} presupuestado
                          </p>
                          <button onClick={() => setVista('categorias')}
                            className="text-[10px] font-bold flex items-center gap-1"
                            style={{ color: bloque.color, background: 'none', border: 'none', cursor: 'pointer' }}>
                            Editar <ArrowRight size={10} />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {catsBloque.map(cat => {
                            const subs    = subcategoriasCfg.filter(s => s.categoria_id === cat.id)
                            const catPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                            const catGast = subs.reduce((s, sub) =>
                              s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0), 0)
                            const catPct  = catPres > 0 ? Math.min(100, (catGast / catPres) * 100) : 0
                            return (
                              <div key={cat.id}>
                                <div className="flex items-center gap-2 py-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                  <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{cat.nombre}</span>
                                  {catGast > 0 && (
                                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                      {formatCurrency(catGast)} /
                                    </span>
                                  )}
                                  <span className="text-xs font-bold" style={{ color: catPres > 0 ? cat.color : 'var(--text-muted)' }}>
                                    {catPres > 0 ? formatCurrency(catPres) : 'sin monto'}
                                  </span>
                                </div>
                                {catPres > 0 && (
                                  <div className="h-0.5 rounded-full ml-3.5" style={{ background: 'var(--progress-track)' }}>
                                    <div className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${catPct}%`, background: catPct >= 100 ? 'var(--accent-rose)' : cat.color }} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Resumen del mes */}
          {ingresoNum > 0 && (
            <Card className="animate-enter">
              <h3 className="font-black mb-1" style={{ color: 'var(--text-primary)' }}>Resumen del mes</h3>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                {now.toLocaleString('es-ES', { month: 'long' })} — ingresos registrados
              </p>
              <div className="space-y-3">
                {bloques.map(b => {
                  const monto   = ingresoNum * (b.pct / 100)
                  const Icon    = b.icon
                  const gastado = gastadoReal(b.id)
                  return (
                    <div key={b.id} className="rounded-xl p-3"
                      style={{
                        background: `color-mix(in srgb, ${b.color} 6%, transparent)`,
                        border:     `1px solid color-mix(in srgb, ${b.color} 14%, transparent)`,
                      }}>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `color-mix(in srgb, ${b.color} 12%, transparent)` }}>
                          <Icon size={13} style={{ color: b.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{b.nombre}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.pct}%</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-black" style={{ color: b.color }}>{formatCurrency(monto)}</p>
                          <p className="text-xs" style={{ color: gastado > monto ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                            {b.id === 'futuro' ? '-' : '-'}{formatCurrency(gastado)} {b.id === 'futuro' ? 'usado' : 'gastado'}
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
                    <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Total ingreso</span>
                  </div>
                  <span className="text-base font-black" style={{ color: 'var(--accent-green)' }}>
                    {formatCurrency(ingresoNum)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </>}

        {/* ══════════ VISTA POR CATEGORÍAS ══════════ */}
        {vista === 'categorias' && (
          <div className="space-y-4">
            {categoriasCfg.length === 0 && metas.length === 0 && inversiones.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-black text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                  Sin categorías configuradas
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Ve a Configuración para crear tus categorías, o crea una Meta o Inversión
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <a href="/ajustes" className="ff-btn-primary" style={{ textDecoration: 'none' }}>Ir a Configuración</a>
                  <a href="/metas" className="ff-btn-ghost" style={{ textDecoration: 'none' }}>Nueva Meta</a>
                </div>
              </div>
            ) : (
              BLOQUES_META.map(bloque => {
                const Icon       = bloque.icon
                const catsBloque = categoriasCfg.filter(c => c.bloque === bloque.id)
                const esFuturo   = bloque.id === 'futuro'

                // Para futuro: incluye metas e inversiones aunque no haya cats custom
                if (catsBloque.length === 0 && !esFuturo) return null
                if (catsBloque.length === 0 && esFuturo && metas.length === 0 && inversiones.length === 0) return null

                // Totales del bloque
                const catsPres = catsBloque.reduce((s, cat) => {
                  const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                  return s + subs.reduce((ss, sub) => ss + (parseFloat(montosCats[sub.id]) || 0), 0)
                }, 0)
                const catsGast = catsBloque.reduce((s, cat) => {
                  const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                  return s + subs.reduce((ss, sub) =>
                    ss + movs.filter(m => m.subcategoria_id === sub.id).reduce((sss, m) => sss + parseFloat(m.monto), 0), 0)
                }, 0)
                const invPres       = esFuturo ? inversiones.reduce((s, inv) => s + (parseFloat(inv.aporte) || 0), 0) : 0
                const totalPresBloque = catsPres + invPres
                const totalGastBloque = catsGast + (esFuturo ? gastadoReal('futuro') - movs.filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === 'futuro').reduce((s, m) => s + parseFloat(m.monto), 0) : 0)

                return (
                  <Card key={bloque.id} className="animate-enter">
                    {/* Cabecera de bloque */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${bloque.color} 12%, transparent)` }}>
                        <Icon size={16} style={{ color: bloque.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{bloque.nombre}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(totalPresBloque)} presupuestado
                        </p>
                      </div>
                    </div>

                    {/* Metas e Inversiones — solo en futuro (solo lectura) */}
                    {esFuturo && (metas.length > 0 || inversiones.length > 0) && (
                      <div className="space-y-3 mb-3">
                        {metas.length > 0 && (
                          <div className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)' }}>
                            <div className="flex items-center gap-2 px-3 py-2.5"
                              style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, var(--bg-secondary))' }}>
                              <Target size={13} style={{ color: 'var(--accent-green)' }} />
                              <p className="flex-1 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                                Metas de Ahorro
                              </p>
                              <a href="/metas"
                                className="text-[10px] font-bold flex items-center gap-0.5"
                                style={{ color: 'var(--accent-green)', textDecoration: 'none' }}>
                                Editar <ArrowRight size={9} />
                              </a>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                              {metas.map(m => (
                                <div key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                                  <span className="text-base flex-shrink-0">{m.emoji}</span>
                                  <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                                    {m.nombre}
                                  </p>
                                  <span className="text-xs font-bold flex-shrink-0"
                                    style={{ color: 'var(--accent-green)' }}>
                                    {m.pct_mensual}% del futuro
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {inversiones.length > 0 && (
                          <div className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid color-mix(in srgb, var(--accent-violet) 20%, transparent)' }}>
                            <div className="flex items-center gap-2 px-3 py-2.5"
                              style={{ background: 'color-mix(in srgb, var(--accent-violet) 6%, var(--bg-secondary))' }}>
                              <TrendingUp size={13} style={{ color: 'var(--accent-violet)' }} />
                              <p className="flex-1 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                                Carteras de Inversión
                              </p>
                              <a href="/inversiones"
                                className="text-[10px] font-bold flex items-center gap-0.5"
                                style={{ color: 'var(--accent-violet)', textDecoration: 'none' }}>
                                Editar <ArrowRight size={9} />
                              </a>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                              {inversiones.map(inv => (
                                <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5">
                                  <span className="text-base flex-shrink-0">{inv.emoji}</span>
                                  <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                                    {inv.nombre}
                                  </p>
                                  {inv.aporte > 0 && (
                                    <span className="text-xs font-bold flex-shrink-0"
                                      style={{ color: 'var(--accent-violet)' }}>
                                      {formatCurrency(inv.aporte)}/mes
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Categorías custom con inputs editables */}
                    {catsBloque.length > 0 && (
                      <div className="space-y-3">
                        {esFuturo && (metas.length > 0 || inversiones.length > 0) && (
                          <p className="text-[9px] font-black uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}>
                            Otras categorías
                          </p>
                        )}
                        {catsBloque.map(cat => {
                          const subs      = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                          const totalPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                          const totalGast = subs.reduce((s, sub) =>
                            s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0), 0)
                          const diff     = totalPres - totalGast
                          const pctUsado = totalPres > 0 ? Math.min(100, (totalGast / totalPres) * 100) : 0

                          return (
                            <div key={cat.id} className="rounded-xl overflow-hidden"
                              style={{ border: `1px solid color-mix(in srgb, ${cat.color} 20%, transparent)` }}>

                              {/* Cabecera de categoría */}
                              <div className="px-3 py-2.5"
                                style={{ background: `color-mix(in srgb, ${cat.color} 8%, var(--bg-secondary))` }}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                  <p className="flex-1 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{cat.nombre}</p>
                                  <span className="text-xs font-black px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{
                                      background: `color-mix(in srgb, ${diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'} 12%, transparent)`,
                                      color: diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                                    }}>
                                    {diff >= 0 ? 'Disp. ' : 'Excede '}{formatCurrency(Math.abs(diff))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 ml-4">
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    Pres: <span className="font-bold" style={{ color: cat.color }}>{formatCurrency(totalPres)}</span>
                                  </span>
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    Gastado: <span className="font-bold">{formatCurrency(totalGast)}</span>
                                  </span>
                                </div>
                              </div>

                              {/* Barra */}
                              {totalPres > 0 && (
                                <div className="h-1.5" style={{ background: 'var(--progress-track)' }}>
                                  <div className="h-full transition-all duration-500"
                                    style={{ width: `${pctUsado}%`, background: pctUsado >= 100 ? 'var(--accent-rose)' : cat.color }} />
                                </div>
                              )}

                              {/* Subcategorías */}
                              {subs.length === 0 ? (
                                <p className="text-xs italic px-3 py-3" style={{ color: 'var(--text-muted)' }}>
                                  Sin subcategorías — añade en Configuración
                                </p>
                              ) : (
                                <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                                  {subs.map(sub => {
                                    const gastadoSub = movs
                                      .filter(m => m.subcategoria_id === sub.id)
                                      .reduce((s, m) => s + parseFloat(m.monto), 0)
                                    const montoPres = parseFloat(montosCats[sub.id]) || 0
                                    const difSub    = montoPres - gastadoSub
                                    const pctSub    = montoPres > 0 ? Math.min(100, (gastadoSub / montoPres) * 100) : 0

                                    return (
                                      <div key={sub.id} className="px-3 py-3">
                                        <div className="flex items-center justify-between mb-2.5">
                                          <p className="text-sm font-bold" style={{ color: 'var(--text-secondary)' }}>
                                            {sub.nombre}
                                          </p>
                                          {(montoPres > 0 || gastadoSub > 0) && (
                                            <span className="text-xs font-black px-2 py-0.5 rounded-full"
                                              style={{
                                                background: `color-mix(in srgb, ${difSub >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'} 10%, transparent)`,
                                                color: difSub >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                                              }}>
                                              {difSub >= 0 ? '+' : ''}{formatCurrency(difSub)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-end gap-3">
                                          <div className="flex-1">
                                            <p className="text-[9px] uppercase tracking-wider font-black mb-1"
                                              style={{ color: 'var(--text-muted)' }}>Presupuestado</p>
                                            <input
                                              type="number" step="0.01" min="0" placeholder="0.00"
                                              value={montosCats[sub.id] ?? ''}
                                              onChange={e => setMontosCats(prev => ({ ...prev, [sub.id]: e.target.value }))}
                                              onBlur={e => guardarPresupuestoCat(sub.id, e.target.value)}
                                              onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                              className="ff-input w-full text-sm"
                                              style={{ color: cat.color, fontWeight: 700 }}
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-[9px] uppercase tracking-wider font-black mb-1"
                                              style={{ color: 'var(--text-muted)' }}>Gastado real</p>
                                            <div className="ff-input flex items-center text-sm font-bold"
                                              style={{
                                                color: gastadoSub > 0 ? 'var(--accent-rose)' : 'var(--text-muted)',
                                                background: 'var(--bg-secondary)', cursor: 'default',
                                              }}>
                                              {gastadoSub > 0 ? formatCurrency(gastadoSub) : '—'}
                                            </div>
                                          </div>
                                        </div>
                                        {montoPres > 0 && (
                                          <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                                            style={{ background: 'var(--progress-track)' }}>
                                            <div className="h-full rounded-full transition-all duration-500"
                                              style={{ width: `${pctSub}%`, background: pctSub >= 100 ? 'var(--accent-rose)' : cat.color }} />
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        )}

      </>}

    </AppShell>
  )
}
