'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Home, Sparkles, Sprout, CheckCircle, Edit3, Save,
  Loader2, AlertTriangle, List, LayoutGrid, ArrowRight
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
  const [bloques, setBloques]   = useState(BLOQUES_META)
  const [ingreso, setIngreso]   = useState('')
  const [editando, setEditando] = useState(false)
  const [borradores, setBorradores] = useState(null)
  const [movs, setMovs]         = useState([])
  const [sobreMovs, setSobreMovs] = useState([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [sub, setSub]           = useState({ metas: 60, inversiones: 40 })
  const [editandoSub, setEditandoSub] = useState(false)
  const [subBorrador, setSubBorrador] = useState(null)
  const [vista, setVista]       = useState('general')
  const [categoriasCfg, setCategoriasCfg]     = useState([])
  const [subcategoriasCfg, setSubcategoriasCfg] = useState([])
  const [presupuestoCats, setPresupuestoCats]   = useState([])
  const [montosCats, setMontosCats]             = useState({})

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
        { data: subData },
        { data: sobreData },
        { data: catsData },
        { data: subsData },
        { data: presCatsData },
      ] = await Promise.all([
        supabase.from('movimientos').select('*').gte('fecha', fechaInicio).lte('fecha', fechaFin),
        supabase.from('presupuesto_bloques').select('*'),
        supabase.from('presupuesto_sub').select('*').eq('bloque', 'futuro'),
        supabase.from('sobre_movimientos').select('*').eq('mes', mes).eq('año', año),
        supabase.from('categorias').select('*').order('bloque').order('orden').order('nombre'),
        supabase.from('subcategorias').select('*').order('orden').order('nombre'),
        supabase.from('presupuesto_cats').select('*').eq('mes', mes).eq('año', año),
      ])

      const movsArr = movsData || []
      setMovs(movsArr)
      setSobreMovs(sobreData || [])
      setCategoriasCfg(catsData || [])
      setSubcategoriasCfg(subsData || [])
      setPresupuestoCats(presCatsData || [])

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

      if (subData?.length > 0) {
        const newSub = {}
        subData.forEach(r => { newSub[r.categoria] = r.pct })
        setSub(prev => ({ ...prev, ...newSub }))
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
      setPresupuestoCats(prev => {
        const idx = prev.findIndex(p => p.subcategoria_id === subcategoriaId)
        if (idx >= 0) return prev.map((p, i) => i === idx ? data[0] : p)
        return [...prev, data[0]]
      })
      // Actualizar montosCats para reflejar el valor guardado
      setMontosCats(prev => ({ ...prev, [subcategoriaId]: valor }))
    }
  }

  // ── Gasto real por bloque (desde movimientos + sobres) ────────────────────
  function gastadoReal(bloqueId) {
    const deMovimientos = movs
      .filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === bloqueId)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    const deTraspasos = sobreMovs
      .filter(m => {
        if (ORIGEN_BLOQUE[m.origen] !== bloqueId) return false
        if (bloqueId === 'futuro' && ['metas', 'inversiones'].includes(m.origen)) return false
        return parseFloat(m.monto) > 0
      })
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    return deMovimientos + deTraspasos
  }

  // ── Presupuestado por bloque (desde presupuesto_cats) ─────────────────────
  function presupuestadoBloque(bloqueId) {
    const cats = categoriasCfg.filter(c => c.bloque === bloqueId)
    return cats.reduce((s, cat) => {
      const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
      return s + subs.reduce((ss, sub) => ss + (parseFloat(montosCats[sub.id]) || 0), 0)
    }, 0)
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

  async function guardarSub() {
    if (!subOk || saving) return
    setSaving(true)
    const results = await Promise.all([
      supabase.from('presupuesto_sub').upsert({ bloque: 'futuro', categoria: 'metas',       pct: subBorrador.metas       }, { onConflict: 'bloque,categoria' }),
      supabase.from('presupuesto_sub').upsert({ bloque: 'futuro', categoria: 'inversiones', pct: subBorrador.inversiones }, { onConflict: 'bloque,categoria' }),
    ])
    setSaving(false)
    if (results.some(r => r.error)) { alert('Error al guardar distribución'); return }
    setSub(subBorrador)
    setSubBorrador(null)
    setEditandoSub(false)
  }

  // ── Derivados ─────────────────────────────────────────────────────────────
  const ingresoNum = parseFloat(ingreso) || 0
  const lista      = editando ? borradores : bloques
  const totalPct   = lista.reduce((s, b) => s + b.pct, 0)
  const totalOk    = totalPct === 100
  const subActual  = editandoSub ? subBorrador : sub
  const subOk      = (subBorrador
    ? subBorrador.metas + subBorrador.inversiones
    : sub.metas + sub.inversiones) === 100

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
        <Card className="mb-5 animate-enter" style={{ border: '2px solid var(--accent-blue)' }}>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>
                Distribución de ingresos
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Ajusta qué % del ingreso va a cada bloque — deben sumar 100%
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={cancelarEdicion} className="ff-btn-ghost text-sm py-1.5 px-3">
                Cancelar
              </button>
              <button onClick={guardarEdicion} disabled={!totalOk || saving}
                className="ff-btn-primary text-sm py-1.5 px-3 flex items-center gap-1.5"
                style={{ opacity: totalOk ? 1 : 0.5 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Guardar
              </button>
            </div>
          </div>

          {!totalOk && (
            <div className="mb-4 px-3 py-2.5 rounded-xl flex items-center gap-2 text-sm font-bold"
              style={{
                background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)',
                color: 'var(--accent-rose)',
              }}>
              <AlertTriangle size={14} />
              Los porcentajes suman {totalPct}% — deben ser exactamente 100%
            </div>
          )}

          <div className="space-y-5">
            {borradores.map(b => {
              const BIcon = b.icon
              return (
                <div key={b.id}>
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${b.color} 12%, transparent)` }}>
                      <BIcon size={16} style={{ color: b.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {b.nombre}
                      </p>
                      {ingresoNum > 0 && (
                        <p className="text-xs font-bold mt-0.5" style={{ color: b.color }}>
                          {formatCurrency(ingresoNum * b.pct / 100)} del ingreso
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <input
                        type="number" min="0" max="100"
                        value={b.pct}
                        onChange={e => cambiarPct(b.id, e.target.value)}
                        className="ff-input text-center font-black w-16"
                        style={{ color: b.color, fontSize: 20 }}
                      />
                      <span className="text-xl font-black" style={{ color: 'var(--text-muted)' }}>%</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${b.pct}%`, background: b.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-5 pt-4 flex items-center justify-between"
            style={{ borderTop: '1px solid var(--border-glass)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>Total acumulado</span>
            <div className="flex items-center gap-2">
              {totalOk && <CheckCircle size={16} style={{ color: 'var(--accent-green)' }} />}
              <span className="text-xl font-black"
                style={{ color: totalOk ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                {totalPct}%
              </span>
            </div>
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
              const Icon         = bloque.icon
              const monto        = ingresoNum * (bloque.pct / 100)
              const gastado      = gastadoReal(bloque.id)
              const presupuestado = presupuestadoBloque(bloque.id)
              const disponible   = monto - gastado
              const pctGastado   = monto > 0 ? Math.min(100, (gastado / monto) * 100) : 0
              const sobreGiro    = gastado > monto
              const catsBloque   = categoriasCfg.filter(c => c.bloque === bloque.id)

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

                  {/* Gasto real vs límite del bloque */}
                  {ingresoNum > 0 && (
                    <div className="rounded-xl p-3 mb-4 space-y-2"
                      style={{
                        background: `color-mix(in srgb, ${bloque.color} 6%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${bloque.color} 15%, transparent)`,
                      }}>
                      <div className="flex justify-between text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>Gastado real</span>
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

                  {/* Distribución interna — solo bloque Futuro */}
                  {bloque.id === 'futuro' && (
                    <div className="rounded-xl p-3 mb-4"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>Distribución interna</p>
                        {!editandoSub ? (
                          <button onClick={() => { setSubBorrador({ ...sub }); setEditandoSub(true) }}
                            className="text-xs font-semibold flex items-center gap-1"
                            style={{ color: bloque.color, background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Edit3 size={11} /> Editar
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => { setSubBorrador(null); setEditandoSub(false) }}
                              className="text-xs" style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                              Cancelar
                            </button>
                            <button onClick={guardarSub}
                              className="text-xs font-bold flex items-center gap-1"
                              style={{ color: subOk ? bloque.color : 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Save size={11} /> Guardar
                            </button>
                          </div>
                        )}
                      </div>
                      {!subOk && editandoSub && (
                        <p className="text-xs mb-2 font-bold" style={{ color: 'var(--accent-rose)' }}>
                          Deben sumar 100% (ahora {subBorrador.metas + subBorrador.inversiones}%)
                        </p>
                      )}
                      {[
                        { key: 'metas',       label: 'Metas de Ahorro', color: 'var(--accent-green)'  },
                        { key: 'inversiones', label: 'Inversiones',     color: 'var(--accent-violet)' },
                      ].map(cat => {
                        const pct      = subActual[cat.key] || 0
                        const montoSub = monto * (pct / 100)
                        return (
                          <div key={cat.key} className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{cat.label}</span>
                              <div className="flex items-center gap-2">
                                {editandoSub ? (
                                  <div className="flex items-center gap-1">
                                    <input type="number" min="0" max="100"
                                      value={subBorrador[cat.key]}
                                      onChange={e => setSubBorrador(prev => ({ ...prev, [cat.key]: parseInt(e.target.value) || 0 }))}
                                      className="ff-input text-center font-bold w-16 py-1"
                                      style={{ color: cat.color, fontSize: 13 }} />
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold" style={{ color: cat.color }}>{pct}%</span>
                                )}
                                {ingresoNum > 0 && (
                                  <span className="text-xs font-black" style={{ color: cat.color }}>
                                    {formatCurrency(montoSub)}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: cat.color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Resumen de categorías configuradas */}
                  <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12 }}>
                    {catsBloque.length === 0 ? (
                      <div className="flex items-center justify-between">
                        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                          Sin categorías aún
                        </p>
                        <a href="/ajustes"
                          className="text-xs font-bold flex items-center gap-1"
                          style={{ color: bloque.color }}>
                          Configurar <ArrowRight size={11} />
                        </a>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[9px] font-black uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}>
                            Categorías · {formatCurrency(presupuestado)} presupuestado
                          </p>
                          <button onClick={() => setVista('categorias')}
                            className="text-[10px] font-bold flex items-center gap-1"
                            style={{ color: bloque.color, background: 'none', border: 'none', cursor: 'pointer' }}>
                            Editar montos <ArrowRight size={10} />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {catsBloque.map(cat => {
                            const subs     = subcategoriasCfg.filter(s => s.categoria_id === cat.id)
                            const catPres  = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                            const catGast  = subs.reduce((s, sub) => {
                              return s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0)
                            }, 0)
                            const catPctUsado = catPres > 0 ? Math.min(100, (catGast / catPres) * 100) : 0
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
                                    <div className="h-full rounded-full"
                                      style={{
                                        width: `${catPctUsado}%`,
                                        background: catPctUsado >= 100 ? 'var(--accent-rose)' : cat.color,
                                        transition: 'width 0.5s',
                                      }} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
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
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `color-mix(in srgb, ${b.color} 12%, transparent)` }}>
                          <Icon size={13} style={{ color: b.color }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{b.nombre}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.pct}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black" style={{ color: b.color }}>{formatCurrency(monto)}</p>
                          <p className="text-xs" style={{ color: gastado > monto ? 'var(--accent-rose)' : 'var(--text-muted)' }}>
                            -{formatCurrency(gastado)} gastado
                          </p>
                        </div>
                      </div>
                      {b.id === 'futuro' && (
                        <div className="flex gap-2 mt-2">
                          {[
                            { k: 'metas',       l: 'Metas',      c: 'var(--accent-green)'  },
                            { k: 'inversiones', l: 'Inversiones', c: 'var(--accent-violet)' },
                          ].map(s => (
                            <div key={s.k} className="flex-1 px-2 py-1.5 rounded-lg text-center"
                              style={{ background: `color-mix(in srgb, ${s.c} 10%, transparent)` }}>
                              <p className="text-xs font-bold"  style={{ color: s.c }}>{s.l}</p>
                              <p className="text-xs font-black" style={{ color: s.c }}>
                                {formatCurrency(monto * (sub[s.k] / 100))}
                              </p>
                              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{sub[s.k]}%</p>
                            </div>
                          ))}
                        </div>
                      )}
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
            {categoriasCfg.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-black text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                  Sin categorías configuradas
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Ve a Configuración para crear tus categorías y subcategorías
                </p>
                <a href="/ajustes" className="ff-btn-primary">Ir a Configuración</a>
              </div>
            ) : (
              BLOQUES_META.map(bloque => {
                const Icon       = bloque.icon
                const catsBloque = categoriasCfg.filter(c => c.bloque === bloque.id)
                if (catsBloque.length === 0) return null

                const totalPresBloque = catsBloque.reduce((s, cat) => {
                  const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                  return s + subs.reduce((ss, sub) => ss + (parseFloat(montosCats[sub.id]) || 0), 0)
                }, 0)
                const totalGastBloque = catsBloque.reduce((s, cat) => {
                  const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                  return s + subs.reduce((ss, sub) => {
                    return ss + movs.filter(m => m.subcategoria_id === sub.id).reduce((sss, m) => sss + parseFloat(m.monto), 0)
                  }, 0)
                }, 0)

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
                          {formatCurrency(totalPresBloque)} presupuestado · {formatCurrency(totalGastBloque)} gastado
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black"
                          style={{ color: totalPresBloque - totalGastBloque >= 0 ? bloque.color : 'var(--accent-rose)' }}>
                          {formatCurrency(totalPresBloque - totalGastBloque)}
                        </p>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>disponible</p>
                      </div>
                    </div>

                    {/* Categorías */}
                    <div className="space-y-3">
                      {catsBloque.map(cat => {
                        const subs      = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                        const totalPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                        const totalGast = subs.reduce((s, sub) => {
                          return s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0)
                        }, 0)
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
                                  {diff >= 0 ? 'Disp. ' : 'Excede '}
                                  {formatCurrency(Math.abs(diff))}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 ml-4">
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  Presupuestado: <span className="font-bold" style={{ color: cat.color }}>{formatCurrency(totalPres)}</span>
                                </span>
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                  Gastado: <span className="font-bold">{formatCurrency(totalGast)}</span>
                                </span>
                              </div>
                            </div>

                            {/* Barra de progreso */}
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
                                      {/* Nombre + badge disponible */}
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

                                      {/* Input presupuestado + gastado real */}
                                      <div className="flex items-end gap-3">
                                        <div className="flex-1">
                                          <p className="text-[9px] uppercase tracking-wider font-black mb-1"
                                            style={{ color: 'var(--text-muted)' }}>
                                            Presupuestado
                                          </p>
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
                                            style={{ color: 'var(--text-muted)' }}>
                                            Gastado real
                                          </p>
                                          <div className="ff-input flex items-center text-sm font-bold"
                                            style={{
                                              color: gastadoSub > 0 ? 'var(--accent-rose)' : 'var(--text-muted)',
                                              background: 'var(--bg-secondary)',
                                              cursor: 'default',
                                            }}>
                                            {gastadoSub > 0 ? formatCurrency(gastadoSub) : '—'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Barra de progreso individual */}
                                      {montoPres > 0 && (
                                        <div className="mt-2 h-1.5 rounded-full overflow-hidden"
                                          style={{ background: 'var(--progress-track)' }}>
                                          <div className="h-full rounded-full transition-all duration-500"
                                            style={{
                                              width: `${pctSub}%`,
                                              background: pctSub >= 100 ? 'var(--accent-rose)' : cat.color,
                                            }} />
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
