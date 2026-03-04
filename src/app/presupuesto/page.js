'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Home, Sparkles, Sprout, CheckCircle, Edit3, Save, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Target, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'

const BLOQUES_META = [
  { id: 'necesidades', nombre: 'Necesidades', icon: Home, color: '#4A6FA5', pct: 50, categorias: ['Básicos', 'Deudas'], descripcion: 'Gastos obligatorios del mes' },
  { id: 'estilo', nombre: 'Estilo de vida', icon: Sparkles, color: '#C17A3A', pct: 20, categorias: ['Deseo'], descripcion: 'Gastos de disfrute y ocio' },
  { id: 'futuro', nombre: 'Futuro', icon: Sprout, color: '#2D7A5F', pct: 30, categorias: ['Metas', 'Inversiones'], descripcion: 'Construye tu patrimonio' },
]

const CAT_BLOQUE = {
  basicos: 'necesidades', deuda: 'necesidades',
  deseo: 'estilo',
  ahorro: 'futuro', inversion: 'futuro',
}

export default function PresupuestoPage() {
  const [bloques, setBloques] = useState(BLOQUES_META)
  const [ingreso, setIngreso] = useState('')
  const [editando, setEditando] = useState(false)
  const [borradores, setBorradores] = useState(null)
  const [items, setItems] = useState([])
  const [movs, setMovs] = useState([])
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
      { data: invData }
    ] = await Promise.all([
      supabase.from('presupuesto_items').select('*').eq('mes', mes).eq('año', año).order('created_at'),
      supabase.from('movimientos').select('*').gte('fecha', `${año}-${String(mes).padStart(2, '0')}-01`).lte('fecha', `${año}-${String(mes).padStart(2, '0')}-31`),
      supabase.from('presupuesto_bloques').select('*'),
      supabase.from('presupuesto_sub').select('*').eq('bloque', 'futuro'),
      supabase.from('metas').select('*').eq('estado', 'activa'),
      supabase.from('inversiones').select('*'),
    ])

    setItems(itemsData || [])
    setMetasReales(metasData || [])
    setInversionesReales(invData || [])

    const movsArr = movsData || []
    setMovs(movsArr)
    const totalIngresos = movsArr.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
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

  function gastadoReal(bloqueId) {
    return movs.filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === bloqueId).reduce((s, m) => s + m.monto, 0)
  }

  async function handleAddItem(bloqueId, customPayload = null) {
    const payload = customPayload || {
      bloque: bloqueId,
      nombre: formItem.nombre,
      monto: parseFloat(formItem.monto),
      mes, año
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

  function iniciarEdicion() { setBorradores(bloques.map(b => ({ ...b }))); setEditando(true) }
  function cancelarEdicion() { setBorradores(null); setEditando(false) }

  async function guardarEdicion() {
    if (!totalOk) return
    await Promise.all(borradores.map(b =>
      supabase.from('presupuesto_bloques').update({ pct: b.pct }).eq('bloque', b.id)
    ))
    setBloques(borradores); setBorradores(null); setEditando(false)
  }

  function cambiarPct(id, val) {
    setBorradores(prev => prev.map(b => b.id === id ? { ...b, pct: Math.max(0, Math.min(100, parseInt(val) || 0)) } : b))
  }

  async function guardarSub() {
    if (!subOk) return
    await Promise.all([
      supabase.from('presupuesto_sub').update({ pct: subBorrador.metas }).eq('bloque', 'futuro').eq('categoria', 'metas'),
      supabase.from('presupuesto_sub').update({ pct: subBorrador.inversiones }).eq('bloque', 'futuro').eq('categoria', 'inversiones'),
    ])
    setSub(subBorrador); setSubBorrador(null); setEditandoSub(false)
  }

  const ingresoNum = parseFloat(ingreso) || 0
  const lista = editando ? borradores : bloques
  const totalPct = lista.reduce((s, b) => s + b.pct, 0)
  const totalOk = totalPct === 100
  const subActual = editandoSub ? subBorrador : sub
  const subOk = (subBorrador ? subBorrador.metas + subBorrador.inversiones : sub.metas + sub.inversiones) === 100

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Mi Presupuesto</h1>
          <p className="text-sm text-stone-400 mt-1">Regla 50/20/30 — {now.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</p>
        </div>
        {!editando ? (
          <button onClick={iniciarEdicion} className="ff-btn-ghost flex items-center gap-2">
            <Edit3 size={14} /> Editar %
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={cancelarEdicion} className="ff-btn-ghost">Cancelar</button>
            <button onClick={guardarEdicion} className="ff-btn-primary flex items-center gap-2"
              disabled={!totalOk} style={{ opacity: totalOk ? 1 : 0.5 }}>
              <Save size={14} /> Guardar
            </button>
          </div>
        )}
      </div>

      {editando && !totalOk && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          Los porcentajes suman {totalPct}% — deben sumar exactamente 100%
        </div>
      )}

      {/* BLOQUES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {lista.map((bloque) => {
          const Icon = bloque.icon
          const monto = ingresoNum * (bloque.pct / 100)
          const bloqueItems = items.filter(i => i.bloque === bloque.id)
          const totalItems = bloqueItems.reduce((s, i) => s + i.monto, 0)
          const isExpandido = expandido === bloque.id
          const gastado = gastadoReal(bloque.id)
          const disponible = monto - gastado

          // Metas e inversiones NO añadidas aún como items
          const metasNoAgregadas = metasReales.filter(m => !bloqueItems.find(bi => bi.nombre.includes(m.nombre)))
          const invNoAgregadas = inversionesReales.filter(i => !bloqueItems.find(bi => bi.nombre.includes(i.nombre)))

          return (
            <Card key={bloque.id} className="animate-enter">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${bloque.color}15` }}>
                  <Icon size={18} style={{ color: bloque.color }} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-stone-800">{bloque.nombre}</p>
                  <p className="text-xs text-stone-400">{bloque.descripcion}</p>
                </div>
              </div>

              {/* Porcentaje */}
              <div className="flex items-center gap-3 mb-3">
                {editando ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input type="number" min="0" max="100" value={bloque.pct}
                      onChange={e => cambiarPct(bloque.id, e.target.value)}
                      className="ff-input text-center font-bold text-lg w-20"
                      style={{ color: bloque.color }} />
                    <span className="text-lg font-bold text-stone-400">%</span>
                  </div>
                ) : (
                  <span className="text-3xl font-bold flex-1" style={{ color: bloque.color, letterSpacing: '-0.03em' }}>
                    {bloque.pct}%
                  </span>
                )}
                {ingresoNum > 0 && (
                  <span className="text-sm font-bold" style={{ color: bloque.color }}>{formatCurrency(monto)}</span>
                )}
              </div>

              {/* Barra porcentaje */}
              <div className="w-full h-2 rounded-full mb-4" style={{ background: 'var(--progress-track)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${bloque.pct}%`, background: bloque.color }} />
              </div>

              {/* Gastado / Disponible */}
              {ingresoNum > 0 && (
                <div className="rounded-xl p-3 mb-4 space-y-2"
                  style={{ background: `${bloque.color}08`, border: `1px solid ${bloque.color}20` }}>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-muted)' }}>Gastado real</span>
                    <span className="font-bold" style={{ color: gastado > monto ? '#C0605A' : bloque.color }}>
                      {formatCurrency(gastado)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (gastado / monto) * 100)}%`, background: gastado > monto ? '#C0605A' : bloque.color }} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Disponible</span>
                    <span className="text-sm font-black" style={{ color: disponible >= 0 ? bloque.color : '#C0605A' }}>
                      {formatCurrency(disponible)}
                    </span>
                  </div>
                </div>
              )}

              {/* Sub-distribución para Futuro */}
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
                          style={{ color: subOk ? bloque.color : '#C0605A', background: 'none', border: 'none', cursor: 'pointer' }}>
                          <Save size={11} /> Guardar
                        </button>
                      </div>
                    )}
                  </div>

                  {!subOk && editandoSub && (
                    <p className="text-xs mb-2 font-semibold" style={{ color: '#C0605A' }}>
                      Deben sumar 100% (ahora {subBorrador.metas + subBorrador.inversiones}%)
                    </p>
                  )}

                  {[
                    { key: 'metas', label: 'Metas de Ahorro', color: '#10b981' },
                    { key: 'inversiones', label: 'Inversiones', color: '#818CF8' },
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
                                <span className="text-xs text-stone-400">%</span>
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

              {/* Categorías */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {bloque.categorias.map(cat => (
                  <span key={cat} className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: `${bloque.color}12`, color: bloque.color }}>{cat}</span>
                ))}
              </div>

              {/* Items detallados */}
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
                  <div className="space-y-2 mt-2">
                    {loadingItems ? (
                      <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-stone-400" /></div>
                    ) : bloqueItems.length === 0 ? (
                      <p className="text-xs text-stone-400 text-center py-2">Sin items aún</p>
                    ) : (
                      bloqueItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg group"
                          style={{ background: 'var(--bg-secondary)' }}>
                          <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{item.nombre}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold" style={{ color: bloque.color }}>{formatCurrency(item.monto)}</span>
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ color: '#C0605A', background: 'none', border: 'none', cursor: 'pointer' }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}

                    {/* ── METAS E INVERSIONES REALES (solo en Futuro) ── */}
                    {bloque.id === 'futuro' && (metasNoAgregadas.length > 0 || invNoAgregadas.length > 0) && (
                      <div className="pt-3 border-t border-dashed border-stone-200 space-y-2">
                        <p className="text-[9px] font-black text-stone-400 uppercase tracking-wider">
                          Tus metas e inversiones — añade con un clic
                        </p>

                        {metasNoAgregadas.map(meta => {
                          const restante = meta.meta - (meta.actual || 0)
                          return (
                            <button key={meta.id}
                              onClick={() => {
                                setAddingReal({ nombre: `${getFlagEmoji(meta.emoji) || '🎯'} ${meta.nombre}`, montoSugerido: Math.min(restante, monto * (sub.metas / 100)), bloque: 'futuro' })
                                setMontoReal(Math.min(restante, monto * (sub.metas / 100)).toFixed(2))
                              }}
                              className="w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between hover:bg-emerald-50 transition-colors"
                              style={{ borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.04)' }}>
                              <div>
                                <p className="text-xs font-bold" style={{ color: '#10b981' }}>{meta.nombre}</p>
                                <p className="text-[9px] text-stone-400">
                                  {formatCurrency(meta.actual || 0)} / {formatCurrency(meta.meta)} · faltan {formatCurrency(restante)}
                                </p>
                              </div>
                              <Plus size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                            </button>
                          )
                        })}

                        {invNoAgregadas.map(inv => (
                          <button key={inv.id}
                            onClick={() => {
                              setAddingReal({ nombre: `${getFlagEmoji(meta.emoji) || '🎯'} ${meta.nombre}`, montoSugerido: inv.aporte || 0, bloque: 'futuro' })
                              setMontoReal((inv.aporte || 0).toFixed(2))
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl border flex items-center justify-between hover:bg-indigo-50 transition-colors"
                            style={{ borderColor: 'rgba(129,140,248,0.2)', background: 'rgba(129,140,248,0.04)' }}>
                            <div>
                              <p className="text-xs font-bold" style={{ color: '#818CF8' }}>{inv.nombre}</p>
                              <p className="text-[9px] text-stone-400">
                                Capital: {formatCurrency(inv.capital)} · Aporte: {formatCurrency(inv.aporte || 0)}/mes
                              </p>
                            </div>
                            <Plus size={12} style={{ color: '#818CF8', flexShrink: 0 }} />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Añadir item manual */}
                    {addingTo === bloque.id ? (
                      <div className="space-y-2 mt-2">
                        <input className="ff-input w-full" placeholder="Ej: Alquiler, Agua..."
                          value={formItem.nombre} onChange={e => setFormItem({ ...formItem, nombre: e.target.value })} />
                        <input className="ff-input w-full" type="number" placeholder="Monto en €"
                          value={formItem.monto} onChange={e => setFormItem({ ...formItem, monto: e.target.value })} />
                        <div className="flex gap-2">
                          <button onClick={() => handleAddItem(bloque.id)}
                            className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                            style={{ background: bloque.color, border: 'none', cursor: 'pointer' }}>
                            Agregar
                          </button>
                          <button onClick={() => { setAddingTo(null); setFormItem({ nombre: '', monto: '' }) }}
                            className="flex-1 py-2 rounded-xl text-sm font-bold"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setAddingTo(bloque.id)}
                        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold mt-1"
                        style={{ background: `${bloque.color}08`, color: bloque.color, border: `1px dashed ${bloque.color}40`, cursor: 'pointer' }}>
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

      {/* RESUMEN */}
      {ingresoNum > 0 && (
        <Card className="animate-enter">
          <h3 className="font-bold text-stone-800 mb-1">Resumen del mes</h3>
          <p className="text-xs text-stone-400 mb-4">
            Ingresos de {now.toLocaleString('es-ES', { month: 'long' })}
          </p>
          <div className="space-y-3">
            {bloques.map(b => {
              const monto = ingresoNum * (b.pct / 100)
              const Icon = b.icon
              const gastado = gastadoReal(b.id)
              return (
                <div key={b.id} className="rounded-xl p-3"
                  style={{ background: `${b.color}08`, border: `1px solid ${b.color}18` }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${b.color}15` }}>
                      <Icon size={13} style={{ color: b.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-stone-800">{b.nombre}</p>
                      <p className="text-xs text-stone-400">{b.pct}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black" style={{ color: b.color }}>{formatCurrency(monto)}</p>
                      <p className="text-xs" style={{ color: gastado > monto ? '#C0605A' : 'var(--text-muted)' }}>
                        -{formatCurrency(gastado)} gastado
                      </p>
                    </div>
                  </div>
                  {b.id === 'futuro' && (
                    <div className="flex gap-2 mt-2">
                      {[{ k: 'metas', l: 'Metas', c: '#10b981' }, { k: 'inversiones', l: 'Inversiones', c: '#818CF8' }].map(s => (
                        <div key={s.k} className="flex-1 px-2 py-1.5 rounded-lg text-center"
                          style={{ background: `${s.c}12` }}>
                          <p className="text-xs font-semibold" style={{ color: s.c }}>{s.l}</p>
                          <p className="text-xs font-black" style={{ color: s.c }}>
                            {formatCurrency(monto * (sub[s.k] / 100))}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub[s.k]}%</p>
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
                <CheckCircle size={15} style={{ color: '#2D7A5F' }} />
                <span className="text-sm font-bold text-stone-800">Total ingreso</span>
              </div>
              <span className="text-base font-bold" style={{ color: '#2D7A5F' }}>{formatCurrency(ingresoNum)}</span>
            </div>
          </div>
        </Card>
      )}
      {addingReal && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-xs shadow-2xl">
            <h3 className="font-black text-stone-800 mb-1 text-sm">{addingReal.nombre}</h3>
            <p className="text-xs text-stone-400 mb-4">¿Cuánto quieres presupuestar este mes?</p>
            <input className="ff-input w-full mb-3" type="number" step="0.01" placeholder="Monto €"
              value={montoReal} onChange={e => setMontoReal(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => { setAddingReal(null); setMontoReal('') }}
                className="flex-1 py-3 text-xs font-bold text-stone-400">Cancelar</button>
              <button onClick={() => {
                handleAddItem(addingReal.bloque, { bloque: addingReal.bloque, nombre: addingReal.nombre, monto: parseFloat(montoReal), mes, año })
                setAddingReal(null); setMontoReal('')
              }} className="flex-1 py-3 bg-stone-800 text-white rounded-xl text-xs font-black">Guardar</button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  )
}