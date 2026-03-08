'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Home, Sparkles, Sprout, CheckCircle, Edit3, Save,
  Plus, Trash2, Loader2, ChevronDown, ChevronUp, AlertTriangle
} from 'lucide-react'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import Modal from '@/components/ui/Modal'

const BLOQUES_META = [
  { id: 'necesidades', nombre: 'Necesidades', icon: Home, color: 'var(--accent-blue)', pct: 50, categorias: ['Básicos', 'Deudas'], descripcion: 'Gastos obligatorios del mes' },
  { id: 'estilo', nombre: 'Estilo de vida', icon: Sparkles, color: 'var(--accent-terra)', pct: 20, categorias: ['Deseo'], descripcion: 'Gastos de disfrute y ocio' },
  { id: 'futuro', nombre: 'Futuro', icon: Sprout, color: 'var(--accent-green)', pct: 30, categorias: ['Metas', 'Inversiones'], descripcion: 'Construye tu patrimonio' },
]

// Categorías de movimientos → bloque al que pertenecen
const CAT_BLOQUE = {
  basicos: 'necesidades', deuda: 'necesidades',
  deseo: 'estilo',
  ahorro: 'futuro', inversion: 'futuro',
}

// Traspasos del sobre → bloque que se descuenta
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
  const [items, setItems] = useState([])
  const [movs, setMovs] = useState([])
  const [sobreMovs, setSobreMovs] = useState([])
  const [metasReales, setMetasReales] = useState([])
  const [inversionesReales, setInversionesReales] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [formItem, setFormItem] = useState({ nombre: '', monto: '' })
  const [addingTo, setAddingTo] = useState(null)
  const [addingReal, setAddingReal] = useState(null)
  const [montoReal, setMontoReal] = useState('')
  const [sub, setSub] = useState({ metas: 60, inversiones: 40 })
  const [editandoSub, setEditandoSub] = useState(false)
  const [subBorrador, setSubBorrador] = useState(null)

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoadingItems(true)
    const [
      { data: itemsData },
      { data: movsData },
      { data: bloquesData },
      { data: subData },
      { data: metasData },
      { data: invData },
      { data: sobreData },
    ] = await Promise.all([
      supabase.from('presupuesto_items').select('*').eq('mes', mes).eq('año', año).order('created_at'),
      supabase.from('movimientos').select('*')
        .gte('fecha', `${año}-${String(mes).padStart(2, '0')}-01`)
        .lte('fecha', `${año}-${String(mes).padStart(2, '0')}-31`),
      supabase.from('presupuesto_bloques').select('*'),
      supabase.from('presupuesto_sub').select('*').eq('bloque', 'futuro'),
      supabase.from('metas').select('*').eq('estado', 'activa'),
      supabase.from('inversiones').select('*'),
      supabase.from('sobre_movimientos').select('*').eq('mes', mes).eq('año', año),
    ])

    setItems(itemsData || [])
    setMetasReales(metasData || [])
    setInversionesReales(invData || [])
    setSobreMovs(sobreData || [])

    const movsArr = movsData || []
    setMovs(movsArr)

    // Ingreso: suma de todos los ingresos del mes
    const totalIngresos = movsArr
      .filter(m => m.tipo === 'ingreso')
      .reduce((s, m) => s + parseFloat(m.monto), 0)
    if (totalIngresos > 0) setIngreso(totalIngresos.toString())

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

    setLoadingItems(false)
  }

  // ── SALDO DINÁMICO: gasto real + traspasos del sobre ─────────────────────
  function gastadoReal(bloqueId) {
    const deMovimientos = movs
      .filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === bloqueId)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    const deTraspasos = sobreMovs
      .filter(m => ORIGEN_BLOQUE[m.origen] === bloqueId && parseFloat(m.monto) > 0)
      .reduce((s, m) => s + parseFloat(m.monto), 0)

    return deMovimientos + deTraspasos
  }

  // ── ITEMS ─────────────────────────────────────────────────────────────────
  async function handleAddItem(bloqueId, customPayload = null) {
    const payload = customPayload || {
      bloque: bloqueId,
      nombre: formItem.nombre,
      monto: parseFloat(formItem.monto) || 0,
      mes, año,
    }
    if (!payload.nombre || !payload.monto) return
    const { data, error } = await supabase.from('presupuesto_items').insert([payload]).select()
    if (!error) {
      setItems(prev => [...prev, data[0]])
      setFormItem({ nombre: '', monto: '' })
      setAddingTo(null)
    }
  }

  async function handleDeleteItem(id) {
    const { error } = await supabase.from('presupuesto_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  // ── EDICIÓN DE PORCENTAJES ────────────────────────────────────────────────
  function iniciarEdicion() { setBorradores(bloques.map(b => ({ ...b }))); setEditando(true) }
  function cancelarEdicion() { setBorradores(null); setEditando(false) }

  async function guardarEdicion() {
    if (!totalOk) return
    await Promise.all(borradores.map(b =>
      supabase.from('presupuesto_bloques').update({ pct: b.pct }).eq('bloque', b.id)
    ))
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
    if (!subOk) return
    await Promise.all([
      supabase.from('presupuesto_sub').update({ pct: subBorrador.metas }).eq('bloque', 'futuro').eq('categoria', 'metas'),
      supabase.from('presupuesto_sub').update({ pct: subBorrador.inversiones }).eq('bloque', 'futuro').eq('categoria', 'inversiones'),
    ])
    setSub(subBorrador)
    setSubBorrador(null)
    setEditandoSub(false)
  }

  // ── DERIVADOS ─────────────────────────────────────────────────────────────
  const ingresoNum = parseFloat(ingreso) || 0
  const lista = editando ? borradores : bloques
  const totalPct = lista.reduce((s, b) => s + b.pct, 0)
  const totalOk = totalPct === 100
  const subActual = editandoSub ? subBorrador : sub
  const subOk = (subBorrador
    ? subBorrador.metas + subBorrador.inversiones
    : sub.metas + sub.inversiones) === 100

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <AppShell>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 animate-enter">
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
        {!editando ? (
          <button onClick={iniciarEdicion} className="ff-btn-ghost flex items-center gap-2">
            <Edit3 size={14} /> Editar %
          </button>
        ) : (
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={cancelarEdicion} className="ff-btn-ghost">Cancelar</button>
            <button onClick={guardarEdicion} disabled={!totalOk}
              className="ff-btn-primary flex items-center gap-2"
              style={{ opacity: totalOk ? 1 : 0.5 }}>
              <Save size={14} /> Guardar
            </button>
          </div>
        )}
      </div>

      {/* Alerta: porcentajes no suman 100 */}
      {editando && !totalOk && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
          style={{
            background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent-rose) 20%, transparent)',
            color: 'var(--accent-rose)',
          }}>
          <AlertTriangle size={14} />
          Los porcentajes suman {totalPct}% — deben sumar exactamente 100%
        </div>
      )}

      {/* ── BLOQUES ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {lista.map((bloque) => {
          const Icon = bloque.icon
          const monto = ingresoNum * (bloque.pct / 100)
          const gastado = gastadoReal(bloque.id)
          const disponible = monto - gastado
          const pctGastado = monto > 0 ? Math.min(100, (gastado / monto) * 100) : 0
          const sobreGiro = gastado > monto
          const bloqueItems = items.filter(i => i.bloque === bloque.id)
          const totalItems = bloqueItems.reduce((s, i) => s + parseFloat(i.monto), 0)
          const isExpandido = expandido === bloque.id

          // Alerta sobre-giro para Básicos: incluye traspasos al sobre
          const metasPendientes = metasReales.filter(m => !bloqueItems.find(bi => bi.nombre.includes(m.nombre)))
          const invPendientes = inversionesReales.filter(i => !bloqueItems.find(bi => bi.nombre.includes(i.nombre)))

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

              {/* Porcentaje editable */}
              <div className="flex items-center gap-3 mb-3">
                {editando ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="number" min="0" max="100" value={bloque.pct}
                      onChange={e => cambiarPct(bloque.id, e.target.value)}
                      className="ff-input text-center font-black text-lg w-20"
                      style={{ color: bloque.color }} />
                    <span className="text-lg font-bold" style={{ color: 'var(--text-muted)' }}>%</span>
                  </div>
                ) : (
                  <span className="text-3xl font-black flex-1"
                    style={{ color: bloque.color, letterSpacing: '-0.03em' }}>
                    {bloque.pct}%
                  </span>
                )}
                {ingresoNum > 0 && (
                  <span className="text-sm font-black" style={{ color: bloque.color }}>
                    {formatCurrency(monto)}
                  </span>
                )}
              </div>

              {/* Barra del bloque */}
              <div className="w-full h-2 rounded-full mb-4" style={{ background: 'var(--progress-track)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${bloque.pct}%`, background: bloque.color }} />
              </div>

              {/* Gasto real vs presupuesto */}
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

                  {/* Barra de gasto — alerta si sobre-giro */}
                  <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pctGastado}%`,
                        background: sobreGiro ? 'var(--accent-rose)' : bloque.color,
                      }} />
                  </div>

                  {/* Alerta sobre-giro */}
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

              {/* Distribución interna Futuro */}
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
                      <div className="flex gap-2 flex-shrink-0">
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
                    { key: 'metas', label: 'Metas de Ahorro', color: 'var(--accent-green)' },
                    { key: 'inversiones', label: 'Inversiones', color: 'var(--accent-violet)' },
                  ].map(cat => {
                    const pct = subActual[cat.key] || 0
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

              {/* Tags de categorías */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {bloque.categorias.map(cat => (
                  <span key={cat} className="text-xs px-2 py-1 rounded-lg font-bold"
                    style={{
                      background: `color-mix(in srgb, ${bloque.color} 10%, transparent)`,
                      color: bloque.color,
                    }}>
                    {cat}
                  </span>
                ))}
              </div>

              {/* ── Items detallados ── */}
              <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: 12 }}>
                <button onClick={() => setExpandido(isExpandido ? null : bloque.id)}
                  className="w-full flex items-center justify-between text-xs font-semibold mb-2"
                  style={{ color: bloque.color, background: 'none', border: 'none', cursor: 'pointer' }}>
                  <span>
                    {bloqueItems.length > 0
                      ? `${bloqueItems.length} item${bloqueItems.length > 1 ? 's' : ''} · ${formatCurrency(totalItems)} presupuestado`
                      : 'Detallar presupuesto'}
                  </span>
                  {isExpandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isExpandido && (
                  <div className="space-y-2 mt-2 overflow-y-auto" style={{ maxHeight: '320px' }}>
                    {loadingItems ? (
                      <div className="flex justify-center py-2">
                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                      </div>
                    ) : bloqueItems.length === 0 ? (
                      <p className="text-xs text-center py-2 italic" style={{ color: 'var(--text-muted)' }}>Sin items aún</p>
                    ) : (
                      bloqueItems.map(item => (
                        <div key={item.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg group"
                          style={{ background: 'var(--bg-secondary)' }}>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{ color: bloque.color }}>
                              {formatCurrency(parseFloat(item.monto))}
                            </span>
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Sugerencias de metas/inversiones para bloque Futuro */}
                    {bloque.id === 'futuro' && (metasPendientes.length > 0 || invPendientes.length > 0) && (
                      <div className="pt-3 space-y-2"
                        style={{ borderTop: '1px dashed var(--border-glass)' }}>
                        <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Tus metas e inversiones — añade con un clic
                        </p>

                        {metasPendientes.map(meta => {
                          const restante = parseFloat(meta.meta) - parseFloat(meta.actual || 0)
                          return (
                            <button key={meta.id}
                              onClick={() => {
                                // Aporte mensual configurado en la meta: pct_mensual% del presupuesto de metas
                                const aporteMeta = (meta.pct_mensual / 100) * (monto * (sub.metas / 100))
                                const montoSug = Math.min(restante, aporteMeta > 0 ? aporteMeta : monto * (sub.metas / 100))
                                setAddingReal({
                                  nombre: `${getFlagEmoji(meta.emoji) || '🎯'} ${meta.nombre}`,
                                  montoSugerido: montoSug,
                                  bloque: 'futuro',
                                })
                                setMontoReal(montoSug.toFixed(2))
                              }}
                              className="w-full text-left px-3 py-2.5 rounded-xl border flex items-center justify-between transition-colors"
                              style={{
                                borderColor: 'color-mix(in srgb, var(--accent-green) 20%, transparent)',
                                background: 'color-mix(in srgb, var(--accent-green) 4%, transparent)',
                              }}>
                              <div>
                                <p className="text-xs font-bold" style={{ color: 'var(--accent-green)' }}>{meta.nombre}</p>
                                <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                  {formatCurrency(parseFloat(meta.actual || 0))} / {formatCurrency(parseFloat(meta.meta))} · faltan {formatCurrency(restante)}
                                </p>
                              </div>
                              <Plus size={12} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                            </button>
                          )
                        })}

                        {invPendientes.map(inv => (
                          <button key={inv.id}
                            onClick={() => {
                              setAddingReal({
                                nombre: `${getFlagEmoji(inv.emoji) || '📈'} ${inv.nombre}`,
                                montoSugerido: parseFloat(inv.aporte) || 0,
                                bloque: 'futuro',
                              })
                              setMontoReal((parseFloat(inv.aporte) || 0).toFixed(2))
                            }}
                            className="w-full text-left px-3 py-2.5 rounded-xl border flex items-center justify-between transition-colors"
                            style={{
                              borderColor: 'color-mix(in srgb, var(--accent-violet) 20%, transparent)',
                              background: 'color-mix(in srgb, var(--accent-violet) 4%, transparent)',
                            }}>
                            <div>
                              <p className="text-xs font-bold" style={{ color: 'var(--accent-violet)' }}>{inv.nombre}</p>
                              <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                                Capital: {formatCurrency(parseFloat(inv.capital))} · Aporte: {formatCurrency(parseFloat(inv.aporte || 0))}/mes
                              </p>
                            </div>
                            <Plus size={12} style={{ color: 'var(--accent-violet)', flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Agregar item manual */}
                    {addingTo === bloque.id ? (
                      <div className="space-y-2 mt-2">
                        <input className="ff-input w-full" placeholder="Ej: Alquiler, Agua..."
                          value={formItem.nombre} onChange={e => setFormItem({ ...formItem, nombre: e.target.value })} />
                        <input className="ff-input w-full" type="number" step="0.01" placeholder="Monto en €"
                          value={formItem.monto} onChange={e => setFormItem({ ...formItem, monto: e.target.value })} />
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => handleAddItem(bloque.id)}
                            className="flex-1 py-2 rounded-xl text-sm font-bold"
                            style={{ background: bloque.color, border: 'none', cursor: 'pointer', color: 'var(--bg-card)' }}>
                            Agregar
                          </button>
                          <button onClick={() => { setAddingTo(null); setFormItem({ nombre: '', monto: '' }) }}
                            className="flex-1 py-2 rounded-xl text-sm font-bold"
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-glass)',
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                            }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingTo(bloque.id)}
                        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold mt-1"
                        style={{
                          background: `color-mix(in srgb, ${bloque.color} 6%, transparent)`,
                          color: bloque.color,
                          border: `1px dashed color-mix(in srgb, ${bloque.color} 35%, transparent)`,
                          cursor: 'pointer',
                        }}>
                        <Plus size={12} /> Agregar item manual
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* ── RESUMEN MENSUAL ── */}
      {ingresoNum > 0 && (
        <Card className="animate-enter">
          <h3 className="font-black mb-1" style={{ color: 'var(--text-primary)' }}>Resumen del mes</h3>
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
                        { k: 'metas', l: 'Metas', c: 'var(--accent-green)' },
                        { k: 'inversiones', l: 'Inversiones', c: 'var(--accent-violet)' },
                      ].map(s => (
                        <div key={s.k} className="flex-1 px-2 py-1.5 rounded-lg text-center"
                          style={{ background: `color-mix(in srgb, ${s.c} 10%, transparent)` }}>
                          <p className="text-xs font-bold" style={{ color: s.c }}>{s.l}</p>
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

            {/* Total */}
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
      {/* ── MODAL añadir meta/inversión real ── */}
      {addingReal && (
        <Modal
          open={!!addingReal}
          onClose={() => { setAddingReal(null); setMontoReal('') }}
          title={addingReal?.nombre || ''}
        >

          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            ¿Cuánto quieres presupuestar este mes?
          </p>

          <input
            className="ff-input w-full mb-3"
            type="number"
            step="0.01"
            placeholder="Monto €"
            value={montoReal}
            onChange={e => setMontoReal(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                setAddingReal(null)
                setMontoReal('')
              }}
              className="ff-btn-ghost"
              style={{ flex: 1, width: '100%' }}
            >
              Cancelar
            </button>

            <button
              onClick={() => {
                handleAddItem(addingReal.bloque, {
                  bloque: addingReal.bloque,
                  nombre: addingReal.nombre,
                  monto: parseFloat(montoReal) || 0,
                  mes,
                  año,
                })
                setAddingReal(null)
                setMontoReal('')
              }}
              className="ff-btn-primary"
              style={{ flex: 1, width: '100%' }}
            >
              Guardar
            </button>
          </div>
        </Modal>
      )}
    </AppShell >
  )
}