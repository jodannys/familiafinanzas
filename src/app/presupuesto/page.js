'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Home, Sparkles, Sprout, CheckCircle, Edit3, Save, X,
  Loader2, AlertTriangle, List, LayoutGrid, ArrowRight, Target, TrendingUp, CircleDollarSign, Copy,
  ChevronDown, ChevronUp
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
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
  // Split metas/inversiones dentro de Futuro
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

      // Aportes directos al presupuesto de inversiones — excluye sobrantes del sobre
      // (descripcion 'Sobrante sobre →') que vienen del bloque Estilo, no del presupuesto de inversiones.
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

  // ── Guardar presupuesto por subcategoría ──────────────────────────────────
  async function guardarPresupuestoCat(subcategoriaId, monto) {
    const valor = parseFloat(monto) || 0
    const { error } = await supabase.from('presupuesto_cats').upsert(
      { subcategoria_id: subcategoriaId, mes, año, monto: valor },
      { onConflict: 'subcategoria_id,mes,año' }
    )
    if (!error) setMontosCats(prev => ({ ...prev, [subcategoriaId]: valor }))
  }

  // ── Copiar presupuesto del mes anterior ───────────────────────────────────
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
  // El sobre pertenece al bloque estilo → sobrantes enviados desde el sobre reducen estilo
  const DESTINO_BLOQUE = { metas: 'futuro', inversiones: 'futuro' }
  const SOBRE_BLOQUE = 'estilo' // el sobre vive dentro del bloque estilo

  function gastadoReal(bloqueId) {
    const deMovimientos = movs
      .filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === bloqueId)
      // Excluir movimientos inversion sin inversion_id (sobrantes mal creados por código antiguo)
      .filter(m => m.categoria !== 'inversion' || m.inversion_id != null)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    const deTraspasos = sobreMovs
      .filter(m => ORIGEN_BLOQUE[m.origen] === bloqueId && parseFloat(m.monto) > 0)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    // Sobrantes a metas e inversiones ahora crean movimientos propios (categoria='ahorro'/'inversion')
    // y se cuentan en deMovimientos — deSobrantes eliminado para evitar doble conteo.
    const deSobrantes = 0

    // Sobrantes enviados DESDE el sobre se descuentan del bloque estilo (el sobre pertenece a estilo)
    const deSobrantesDelSobre = bloqueId === SOBRE_BLOQUE
      ? sobreMovs
        .filter(m => m.origen === 'sobre')
        .reduce((s, m) => s + parseFloat(m.monto), 0)
      : 0

    // Traspasos ENTRANTES al sobre (desde otras cubetas) — el gasto (categoria:'deseo') ya aparece
    // en deMovimientos como estilo, pero fue pagado por otro bloque. Se resta para evitar doble conteo.
    const deTraspasosSobre = bloqueId === SOBRE_BLOQUE
      ? sobreMovs
        .filter(m => m.destino === 'sobre')
        .reduce((s, m) => s + parseFloat(m.monto), 0)
      : 0

    return deMovimientos + deTraspasos + deSobrantes + deSobrantesDelSobre - deTraspasosSobre
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

  // Montos derivados del ingreso + porcentajes
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
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Mi Presupuesto
          </h1>
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
                padding: '8px 14px',
                borderRadius: 14,
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {copiando ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
              Copiar mes
            </button>
            <button
              onClick={iniciarEdicion}
              className="flex items-center gap-2 transition-all active:scale-95"
              style={{
                padding: '8px 14px',
                borderRadius: 14,
                border: '1px solid color-mix(in srgb, var(--accent-main) 30%, transparent)',
                background: 'color-mix(in srgb, var(--accent-main) 8%, var(--bg-secondary))',
                color: 'var(--accent-main)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Edit3 size={13} />
              Distribución
            </button>
          </div>
        )}
      </div>

      {/* ── Panel de edición ─────────────────────────────────────────────────── */}
      {editando && (
        <div className="mb-5 animate-enter" style={{
          borderRadius: 24,
          border: '1px solid var(--border-glass)',
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>

          {/* Cabecera */}
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

          {/* Filas de bloques */}
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
                  {/* Fila principal */}
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

                    {/* Input % */}
                    <div className="flex items-center gap-1 flex-shrink-0" style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 12,
                      padding: '4px 10px 4px 6px',
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

                  {/* Barra */}
                  <div style={{ marginTop: 10, height: 5, borderRadius: 999, overflow: 'hidden', background: 'var(--progress-track)' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      width: `${pctVal}%`, background: b.color,
                      transition: 'width 0.35s ease-out',
                    }} />
                  </div>

                  {/* Sub-distribución Futuro */}
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
                                  background: 'var(--bg-card)',
                                  borderRadius: 10, padding: '3px 8px 3px 4px',
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

          {/* Footer */}
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
              const disponible = monto - gastado
              const pctGastado = monto > 0 ? Math.min(100, (gastado / monto) * 100) : 0
              const sobreGiro = gastado > monto
              const esFuturo = bloque.id === 'futuro'
              const catsBloque = categoriasCfg.filter(c => c.bloque === bloque.id)

              return (
                <Card key={bloque.id} className="animate-enter">

                  {/* Cabecera */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${bloque.color} 12%, transparent)` }}>
                      <Icon size={18} style={{ color: bloque.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{bloque.nombre}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{bloque.descripcion}</p>
                    </div>
                  </div>

                  {/* % + monto */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl font-semibold flex-1"
                      style={{ color: bloque.color, letterSpacing: '-0.02em' }}>
                      {bloque.pct}%
                    </span>
                    {ingresoNum > 0 && (
                      <span className="text-sm font-semibold" style={{ color: bloque.color }}>
                        {formatCurrency(monto)}
                      </span>
                    )}
                  </div>

                  <div className="w-full h-2 rounded-full mb-4" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${bloque.pct}%`, background: bloque.color }} />
                  </div>

                  {/* Usado vs límite */}
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
                        <span className="font-semibold"
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
                          <p className="text-[9px] font-semibold" style={{ color: 'var(--accent-rose)' }}>
                            Sobre-giro: {formatCurrency(gastado - monto)}
                          </p>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Disponible</span>
                        <span className="text-sm font-semibold"
                          style={{ color: disponible >= 0 ? bloque.color : 'var(--accent-rose)' }}>
                          {formatCurrency(disponible)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ─── FUTURO: metas e inversiones integradas ─── */}
                  {esFuturo && (
                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12 }}>

                      {/* Metas de Ahorro */}
                      {(metas.length > 0 || ingresoNum > 0) && (
                        <div className="mb-3">
                          {/* Cabecera subsección */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Target size={10} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                              <span className="text-[9px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--accent-green)' }}>Metas de Ahorro</span>
                              {ingresoNum > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                  style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', color: 'var(--accent-green)' }}>
                                  {sub.metas}% · {formatCurrency(montoMetas)}
                                </span>
                              )}
                            </div>
                            <a href="/metas" className="text-[9px] font-semibold flex items-center gap-0.5"
                              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                              Ver <ArrowRight size={8} />
                            </a>
                          </div>
                          {/* Lista */}
                          {metas.length === 0 ? (
                            <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>Sin metas aún</p>
                          ) : (
                            <div className="space-y-1.5">
                              {metas.filter(m => m.estado !== 'completada').map(m => {
                                const metaMensual = (m.pct_mensual / 100) * montoMetas
                                return (
                                  <div key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-lg"
                                    style={{ background: 'var(--bg-secondary)' }}>
                                    <span className="text-sm flex-shrink-0">{m.emoji}</span>
                                    <span className="flex-1 text-[10px] font-medium truncate"
                                      style={{ color: 'var(--text-primary)' }}>{m.nombre}</span>
                                    <span className="text-[9px] tabular-nums"
                                      style={{ color: 'var(--text-muted)' }}>{m.pct_mensual}%</span>
                                    {ingresoNum > 0 && (
                                      <span className="text-[10px] font-semibold tabular-nums"
                                        style={{ color: 'var(--accent-green)' }}>
                                        {formatCurrency(metaMensual)}/mes
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Inversiones */}
                      {(inversiones.length > 0 || ingresoNum > 0) && (
                        <div>
                          {/* Cabecera subsección */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp size={10} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
                              <span className="text-[9px] font-semibold uppercase tracking-wider"
                                style={{ color: 'var(--accent-violet)' }}>Inversiones</span>
                              {ingresoNum > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold"
                                  style={{ background: 'color-mix(in srgb, var(--accent-violet) 12%, transparent)', color: 'var(--accent-violet)' }}>
                                  {sub.inversiones}% · {formatCurrency(montoInversiones)}
                                </span>
                              )}
                            </div>
                            <a href="/inversiones" className="text-[9px] font-semibold flex items-center gap-0.5"
                              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                              Ver <ArrowRight size={8} />
                            </a>
                          </div>
                          {/* Lista */}
                          {inversiones.length === 0 ? (
                            <p className="text-[10px] italic" style={{ color: 'var(--text-muted)' }}>Sin carteras aún</p>
                          ) : (
                            <div className="space-y-1.5">
                              {inversiones.map(inv => {
                                const invMensual = ((inv.pct_mensual || 0) / 100) * montoInversiones
                                return (
                                  <div key={inv.id} className="flex items-center gap-2 px-2 py-1 rounded-lg"
                                    style={{ background: 'var(--bg-secondary)' }}>
                                    <span className="text-sm flex-shrink-0">{inv.emoji}</span>
                                    <span className="flex-1 text-[10px] font-medium truncate"
                                      style={{ color: 'var(--text-primary)' }}>{inv.nombre}</span>
                                    <span className="text-[9px] tabular-nums"
                                      style={{ color: 'var(--text-muted)' }}>{inv.pct_mensual || 0}%</span>
                                    {ingresoNum > 0 && invMensual > 0 && (
                                      <span className="text-[10px] font-semibold tabular-nums"
                                        style={{ color: 'var(--accent-violet)' }}>
                                        {formatCurrency(invMensual)}/mes
                                      </span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Categorías custom de Futuro */}
                      {catsBloque.length > 0 && (
                        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-glass)' }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-[9px] font-semibold uppercase tracking-wider"
                              style={{ color: 'var(--text-muted)' }}>Otras categorías</p>
                            <button onClick={() => setVista('categorias')}
                              className="text-[9px] font-semibold flex items-center gap-0.5"
                              style={{ color: bloque.color, background: 'none', border: 'none', cursor: 'pointer' }}>
                              Editar <ArrowRight size={9} />
                            </button>
                          </div>
                          {catsBloque.map(cat => {
                            const subs = subcategoriasCfg.filter(s => s.categoria_id === cat.id)
                            const catPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                            return (
                              <div key={cat.id} className="flex items-center gap-2 py-0.5">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{cat.nombre}</span>
                                <span className="text-xs font-semibold" style={{ color: catPres > 0 ? cat.color : 'var(--text-muted)' }}>
                                  {catPres > 0 ? formatCurrency(catPres) : 'sin monto'}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─── NECESIDADES / ESTILO: categorías custom ─── */}
                  {!esFuturo && (
                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12 }}>
                      {catsBloque.length === 0 ? (
                        <div className="flex items-center justify-between">
                          <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin categorías aún</p>
                          <a href="/ajustes" className="text-xs font-semibold flex items-center gap-1"
                            style={{ color: bloque.color, textDecoration: 'none' }}>
                            Configurar <ArrowRight size={11} />
                          </a>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[9px] font-semibold uppercase tracking-wider"
                              style={{ color: 'var(--text-muted)' }}>Categorías</p>
                            <button onClick={() => setVista('categorias')}
                              className="text-[9px] font-semibold flex items-center gap-0.5"
                              style={{ color: bloque.color, background: 'none', border: 'none', cursor: 'pointer' }}>
                              Editar <ArrowRight size={9} />
                            </button>
                          </div>
                          <div className="space-y-1">
                            {catsBloque.map(cat => {
                              const subs = subcategoriasCfg.filter(s => s.categoria_id === cat.id)
                              const catPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                              const catGast = subs.reduce((s, sub) =>
                                s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0), 0)
                              const catPct = catPres > 0 ? Math.min(100, (catGast / catPres) * 100) : 0
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
                                    <span className="text-xs font-semibold" style={{ color: catPres > 0 ? cat.color : 'var(--text-muted)' }}>
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
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>

          {/* ─── BLOQUE DEUDAS ─── */}
          {deudas.length > 0 && (
            <Card className="animate-enter mb-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--accent-rose) 12%, transparent)' }}>
                  <CircleDollarSign size={18} style={{ color: 'var(--accent-rose)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Deudas</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Compromisos mensuales fijos</p>
                </div>
                <a href="/deudas" className="text-[9px] font-semibold flex items-center gap-0.5"
                  style={{ color: 'var(--accent-rose)', textDecoration: 'none' }}>
                  Ver <ArrowRight size={9} />
                </a>
              </div>
              <div className="space-y-2">
                {deudas.map(d => {
                  const movsDeuda = deudaMovs.filter(m => m.deuda_id === d.id)
                  const pagadaEsteMes = movsDeuda.some(m => m.tipo === 'pago')
                  const montoPagado = movsDeuda.filter(m => m.tipo === 'pago').reduce((s, m) => s + parseFloat(m.monto || 0), 0)
                  return (
                    <div key={d.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl"
                      style={{ background: pagadaEsteMes ? 'color-mix(in srgb, var(--accent-green) 5%, transparent)' : 'transparent' }}>
                      <span className="text-sm flex-shrink-0">{d.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{d.nombre}</p>
                        {pagadaEsteMes && montoPagado > 0 && (
                          <p className="text-[9px]" style={{ color: 'var(--accent-green)' }}>
                            Abonado {formatCurrency(montoPagado)}
                          </p>
                        )}
                      </div>
                      {pagadaEsteMes ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', color: 'var(--accent-green)' }}>
                          ✓ pagado
                        </span>
                      ) : (
                        d.cuota > 0 && (
                          <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: 'var(--accent-rose)' }}>
                            {formatCurrency(d.cuota)}/mes
                          </span>
                        )
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: '1px solid var(--border-glass)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total letras este mes</span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent-rose)' }}>
                  {formatCurrency(deudas.reduce((s, d) => s + (d.cuota || 0), 0))}
                </span>
              </div>
            </Card>
          )}

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

        {/* ══════════ VISTA POR CATEGORÍAS ══════════ */}
        {vista === 'categorias' && (
          <div className="space-y-4">

            {/* Banner ingreso del mes */}
            {ingresoNum > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-2xl animate-enter"
                style={{
                  background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-green) 18%, transparent)',
                }}>
                <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  Ingreso registrado este mes
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent-green)' }}>
                  {formatCurrency(ingresoNum)}
                </span>
              </div>
            )}

            {categoriasCfg.length === 0 && metas.length === 0 && inversiones.length === 0 && deudas.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                  Sin elementos configurados
                </p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Crea categorías en Ajustes, o añade Metas e Inversiones
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <a href="/ajustes" className="ff-btn-primary" style={{ textDecoration: 'none' }}>Configuración</a>
                  <a href="/metas" className="ff-btn-ghost" style={{ textDecoration: 'none' }}>Nueva Meta</a>
                </div>
              </div>
            ) : (
              <>
              {BLOQUES_META.map(bloque => {
                const Icon = bloque.icon
                const catsBloque = categoriasCfg.filter(c => c.bloque === bloque.id)
                const esFuturo = bloque.id === 'futuro'

                if (esFuturo && catsBloque.length === 0 && metas.length === 0 && inversiones.length === 0) return null

                return (
                  <Card key={bloque.id} className="animate-enter">
                    {/* Cabecera de bloque */}
                    <div
                      className="flex items-center gap-3 cursor-pointer select-none"
                      style={{ marginBottom: bloquesCerrados.has(bloque.id) ? 0 : 16 }}
                      onClick={() => toggleBloque(bloque.id)}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${bloque.color} 12%, transparent)` }}>
                        <Icon size={16} style={{ color: bloque.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{bloque.nombre}</p>
                        {ingresoNum > 0 && (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {formatCurrency(ingresoNum * (bloque.pct / 100))} del ingreso
                            {esFuturo && ` · ${sub.metas}% metas · ${sub.inversiones}% inversiones`}
                          </p>
                        )}
                      </div>
                      {bloquesCerrados.has(bloque.id)
                        ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        : <ChevronUp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      }
                    </div>

                    <div className={`collapsible-content ${bloquesCerrados.has(bloque.id) ? 'closed' : 'open'}`}>
                    {/* FUTURO: metas e inversiones de solo lectura */}
                    {esFuturo && (
                      <div className="space-y-3 mb-4">

                        {/* Metas */}
                        {metas.length > 0 && (
                          <div className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)' }}>
                            <div className="flex items-center justify-between px-3 py-2.5"
                              style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, var(--bg-secondary))' }}>
                              <div className="flex items-center gap-2">
                                <Target size={12} style={{ color: 'var(--accent-green)' }} />
                                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Metas de Ahorro</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {ingresoNum > 0 && (
                                  <span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
                                    {sub.metas}% · {formatCurrency(montoMetas)}
                                  </span>
                                )}
                                <a href="/metas" className="text-[9px] font-semibold flex items-center gap-0.5"
                                  style={{ color: 'var(--accent-green)', textDecoration: 'none' }}>
                                  Editar <ArrowRight size={9} />
                                </a>
                              </div>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                              {metas.map(m => {
                                const metaMensual = (m.pct_mensual / 100) * montoMetas
                                const pctCompletada = Math.min(100, Math.round(((m.actual || 0) / m.meta) * 100))
                                return (
                                  <div key={m.id} className="px-3 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-base flex-shrink-0">{m.emoji}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
                                          {m.nombre}
                                        </p>
                                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                          {pctCompletada}% completada · {m.pct_mensual}% del presup. metas
                                        </p>
                                      </div>
                                      {ingresoNum > 0 && (
                                        <span className="text-xs font-semibold flex-shrink-0"
                                          style={{ color: 'var(--accent-green)' }}>
                                          {formatCurrency(metaMensual)}/mes
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                              {/* Total asignado */}
                              {(() => {
                                const totalPctMetas = metas.filter(m => m.estado === 'activa').reduce((s, m) => s + (m.pct_mensual || 0), 0)
                                const libre = 100 - totalPctMetas
                                return (
                                  <div className="flex items-center justify-between px-3 py-2"
                                    style={{ background: 'var(--bg-secondary)' }}>
                                    <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                      {totalPctMetas}% asignado · {libre}% libre
                                    </span>
                                    {ingresoNum > 0 && (
                                      <span className="text-[10px] font-semibold" style={{ color: libre > 0 ? 'var(--text-muted)' : 'var(--accent-green)' }}>
                                        {formatCurrency((libre / 100) * montoMetas)} sin asignar
                                      </span>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Inversiones */}
                        {inversiones.length > 0 && (
                          <div className="rounded-xl overflow-hidden"
                            style={{ border: '1px solid color-mix(in srgb, var(--accent-violet) 20%, transparent)' }}>
                            <div className="flex items-center justify-between px-3 py-2.5"
                              style={{ background: 'color-mix(in srgb, var(--accent-violet) 6%, var(--bg-secondary))' }}>
                              <div className="flex items-center gap-2">
                                <TrendingUp size={12} style={{ color: 'var(--accent-violet)' }} />
                                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Carteras de Inversión</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {ingresoNum > 0 && (
                                  <span className="text-xs font-semibold" style={{ color: 'var(--accent-violet)' }}>
                                    {sub.inversiones}% · {formatCurrency(montoInversiones)}
                                  </span>
                                )}
                                <a href="/inversiones" className="text-[9px] font-semibold flex items-center gap-0.5"
                                  style={{ color: 'var(--accent-violet)', textDecoration: 'none' }}>
                                  Editar <ArrowRight size={9} />
                                </a>
                              </div>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                              {inversiones.map(inv => {
                                const invMensual = ((inv.pct_mensual || 0) / 100) * montoInversiones
                                return (
                                  <div key={inv.id} className="px-3 py-2.5">
                                    <div className="flex items-center gap-2.5">
                                      <span className="text-base flex-shrink-0">{inv.emoji}</span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
                                          {inv.nombre}
                                        </p>
                                        {inv.pct_mensual > 0 && (
                                          <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                            {inv.pct_mensual}% del presup. inversiones
                                          </p>
                                        )}
                                      </div>
                                      {ingresoNum > 0 && inv.pct_mensual > 0 && (
                                        <span className="text-xs font-semibold flex-shrink-0"
                                          style={{ color: 'var(--accent-violet)' }}>
                                          {formatCurrency(invMensual)}/mes
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                              {/* Total aportado real vs presupuesto */}
                              {(() => {
                                const totalPctInv = inversiones.reduce((s, i) => s + (i.pct_mensual || 0), 0)
                                const libre = 100 - totalPctInv
                                const pctUsado = montoInversiones > 0 ? Math.min(100, (aportesInvEsteMes / montoInversiones) * 100) : 0
                                const diff = montoInversiones - aportesInvEsteMes
                                return (
                                  <div className="px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                                        {totalPctInv}% asignado · {libre > 0 ? `${libre}% libre` : 'Completo'}
                                      </span>
                                      {ingresoNum > 0 && (
                                        <span className="text-[10px] font-semibold"
                                          style={{ color: diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                                          {formatCurrency(aportesInvEsteMes)} aportado / {formatCurrency(montoInversiones)}
                                        </span>
                                      )}
                                    </div>
                                    {ingresoNum > 0 && (
                                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                                        <div className="h-full rounded-full transition-all"
                                          style={{ width: `${pctUsado}%`, background: pctUsado > 100 ? 'var(--accent-rose)' : 'var(--accent-violet)' }} />
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Estado vacío — sin categorías configuradas */}
                    {!esFuturo && catsBloque.length === 0 && (
                      <div className="flex items-center justify-between px-1 py-2">
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Sin categorías aún
                        </p>
                        <a href="/ajustes" style={{
                          fontSize: 11, fontWeight: 700, color: bloque.color,
                          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          Configurar <ArrowRight size={11} />
                        </a>
                      </div>
                    )}

                    {/* Categorías custom con inputs editables */}
                    {catsBloque.length > 0 && (
                      <div className="space-y-3">
                        {esFuturo && (metas.length > 0 || inversiones.length > 0) && (
                          <p className="text-[9px] font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--text-muted)' }}>Otras categorías</p>
                        )}
                        {catsBloque.map(cat => {
                          const subs = subcategoriasCfg.filter(s2 => s2.categoria_id === cat.id)
                          const totalPres = subs.reduce((s, sub) => s + (parseFloat(montosCats[sub.id]) || 0), 0)
                          const totalGast = subs.reduce((s, sub) =>
                            s + movs.filter(m => m.subcategoria_id === sub.id).reduce((ss, m) => ss + parseFloat(m.monto), 0), 0)
                          const diff = totalPres - totalGast
                          const pctUsado = totalPres > 0 ? Math.min(100, (totalGast / totalPres) * 100) : 0

                          return (
                            <div key={cat.id} className="rounded-xl overflow-hidden"
                              style={{ border: `1px solid color-mix(in srgb, ${cat.color} 20%, transparent)` }}>

                              <div className="px-3 py-2.5"
                                style={{ background: `color-mix(in srgb, ${cat.color} 8%, var(--bg-secondary))` }}>
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                                  <p className="flex-1 font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{cat.nombre}</p>
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                                    style={{
                                      background: `color-mix(in srgb, ${diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)'} 12%, transparent)`,
                                      color: diff >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
                                    }}>
                                    {diff >= 0 ? 'Disp. ' : 'Excede '}{formatCurrency(Math.abs(diff))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 mt-1 ml-4">
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    Pres: <span className="font-semibold" style={{ color: cat.color }}>{formatCurrency(totalPres)}</span>
                                  </span>
                                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                    Gastado: <span className="font-semibold">{formatCurrency(totalGast)}</span>
                                  </span>
                                </div>
                              </div>

                              {totalPres > 0 && (
                                <div className="h-1.5" style={{ background: 'var(--progress-track)' }}>
                                  <div className="h-full transition-all duration-500"
                                    style={{ width: `${pctUsado}%`, background: pctUsado >= 100 ? 'var(--accent-rose)' : cat.color }} />
                                </div>
                              )}

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
                                    const difSub = montoPres - gastadoSub
                                    const pctSub = montoPres > 0 ? Math.min(100, (gastadoSub / montoPres) * 100) : 0
                                    const overBudget = montoPres > 0 && gastadoSub > montoPres

                                    return (
                                      <div key={sub.id} style={{ padding: '12px 14px' }}>
                                        {/* Nombre + badge restante */}
                                        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            {sub.nombre}
                                          </p>
                                          {montoPres > 0 && (
                                            <span className="tabular-nums" style={{
                                              fontSize: 10, fontWeight: 700,
                                              padding: '2px 7px', borderRadius: 20,
                                              background: `color-mix(in srgb, ${overBudget ? 'var(--accent-rose)' : 'var(--accent-green)'} 10%, transparent)`,
                                              color: overBudget ? 'var(--accent-rose)' : 'var(--accent-green)',
                                            }}>
                                              {overBudget ? '−' : '+'}{formatCurrency(Math.abs(difSub))}
                                            </span>
                                          )}
                                        </div>
                                        {/* Dos columnas */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                          <div style={{
                                            borderRadius: 10, padding: '8px 10px',
                                            background: 'var(--bg-secondary)',
                                          }}>
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
                                                fontSize: 13, fontWeight: 800, color: cat.color,
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
                                            <p className="tabular-nums" style={{
                                              fontSize: 13, fontWeight: 800,
                                              color: gastadoSub > 0
                                                ? (overBudget ? 'var(--accent-rose)' : 'var(--text-secondary)')
                                                : 'var(--text-muted)',
                                            }}>
                                              {gastadoSub > 0 ? formatCurrency(gastadoSub) : '—'}
                                            </p>
                                          </div>
                                        </div>
                                        {/* Barra */}
                                        {montoPres > 0 && (
                                          <div style={{ marginTop: 8, height: 3, borderRadius: 999, overflow: 'hidden', background: 'var(--progress-track)' }}>
                                            <div style={{
                                              height: '100%', borderRadius: 999,
                                              width: `${pctSub}%`,
                                              background: overBudget ? 'var(--accent-rose)' : cat.color,
                                              transition: 'width 0.4s ease-out',
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
                    )}
                    </div>
                  </Card>
                )
              })}
              {/* ─── BLOQUE DEUDAS en vista detallada ─── */}
              {deudas.length > 0 && (
                <Card className="animate-enter">
                  <div
                    className="flex items-center gap-3 cursor-pointer select-none"
                    style={{ marginBottom: bloquesCerrados.has('deudas') ? 0 : 16 }}
                    onClick={() => toggleBloque('deudas')}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--accent-rose) 12%, transparent)' }}>
                      <CircleDollarSign size={16} style={{ color: 'var(--accent-rose)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Deudas activas</p>
                      {ingresoNum > 0 && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Compromisos fijos del mes
                        </p>
                      )}
                    </div>
                    <a href="/deudas" className="text-[9px] font-semibold flex items-center gap-0.5"
                      style={{ color: 'var(--accent-rose)', textDecoration: 'none' }}
                      onClick={e => e.stopPropagation()}>
                      Ver <ArrowRight size={9} />
                    </a>
                    {bloquesCerrados.has('deudas')
                      ? <ChevronDown size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      : <ChevronUp size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    }
                  </div>

                  <div className={`collapsible-content ${bloquesCerrados.has('deudas') ? 'closed' : 'open'}`}>
                  <div className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)' }}>
                    <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                      {deudas.map(d => {
                        const movsDeuda = deudaMovs.filter(m => m.deuda_id === d.id)
                        const pagadaEsteMes = movsDeuda.some(m => m.tipo === 'pago')
                        const montoPagado = movsDeuda.filter(m => m.tipo === 'pago').reduce((s, m) => s + parseFloat(m.monto || 0), 0)
                        return (
                          <div key={d.id} className="px-3 py-2.5 flex items-center gap-2.5"
                            style={{ background: pagadaEsteMes ? 'color-mix(in srgb, var(--accent-green) 4%, transparent)' : 'transparent' }}>
                            <span className="text-base flex-shrink-0">{d.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>{d.nombre}</p>
                              {pagadaEsteMes && montoPagado > 0 && (
                                <p className="text-[9px]" style={{ color: 'var(--accent-green)' }}>
                                  Abonado {formatCurrency(montoPagado)}
                                </p>
                              )}
                            </div>
                            {pagadaEsteMes ? (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', color: 'var(--accent-green)' }}>
                                ✓ pagado
                              </span>
                            ) : (
                              d.cuota > 0 && (
                                <span className="text-[10px] font-semibold flex-shrink-0" style={{ color: 'var(--accent-rose)' }}>
                                  {formatCurrency(d.cuota)}/mes
                                </span>
                              )
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between"
                      style={{ background: 'var(--bg-secondary)' }}>
                      <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Total cuotas</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent-rose)' }}>
                        {formatCurrency(deudas.reduce((s, d) => s + (d.cuota || 0), 0))}
                      </span>
                    </div>
                  </div>
                  </div>
                </Card>
              )}

              {/* ─── RESUMEN TOTAL ─── */}
              {ingresoNum > 0 && (() => {
                const totalPresupuestado = Object.values(montosCats).reduce((s, v) => s + (parseFloat(v) || 0), 0)
                  + deudas.reduce((s, d) => s + (d.cuota || 0), 0)
                  + metas.filter(m => m.estado === 'activa').reduce((s, m) => s + ((m.pct_mensual / 100) * montoMetas), 0)
                  + inversiones.reduce((s, i) => s + (parseFloat(i.aporte) || 0), 0)
                const totalGastado = movs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + parseFloat(m.monto), 0)
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
