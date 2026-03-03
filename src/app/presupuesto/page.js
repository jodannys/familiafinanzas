'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Home, Sparkles, Sprout, CheckCircle, Edit3, Save, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const BLOQUES_DEFAULT = [
  { id: 'necesidades', nombre: 'Necesidades', icon: Home, color: '#4A6FA5', pct: 50, categorias: ['Básicos', 'Remesas', 'Deudas'], descripcion: 'Gastos obligatorios del mes' },
  { id: 'estilo', nombre: 'Estilo de vida', icon: Sparkles, color: '#C17A3A', pct: 20, categorias: ['Deseo', 'Sobres diarios'], descripcion: 'Gastos de disfrute y ocio' },
  { id: 'futuro', nombre: 'Futuro', icon: Sprout, color: '#2D7A5F', pct: 30, categorias: ['Ahorro', 'Metas', 'Inversión'], descripcion: 'Construye tu patrimonio' },
]

export default function PresupuestoPage() {
  const [bloques, setBloques] = useState(BLOQUES_DEFAULT)
  const [ingreso, setIngreso] = useState('')
  const [editando, setEditando] = useState(false)
  const [borradores, setBorradores] = useState(null)
  const [confirmado, setConfirmado] = useState(false)

  // Items detallados por bloque
  const [items, setItems] = useState([])
  const [movs, setMovs] = useState([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [formItem, setFormItem] = useState({ nombre: '', monto: '' })
  const [addingTo, setAddingTo] = useState(null)

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  // Mapeo categoria → bloque
  const CAT_BLOQUE = {
    basicos: 'necesidades', deuda: 'necesidades',
    deseo: 'estilo',
    ahorro: 'futuro', inversion: 'futuro',
  }

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoadingItems(true)
    const [{ data: itemsData }, { data: movsData }] = await Promise.all([
      supabase.from('presupuesto_items').select('*').eq('mes', mes).eq('año', año).order('created_at'),
      supabase.from('movimientos').select('*').gte('fecha', `${año}-${String(mes).padStart(2, '0')}-01`).lte('fecha', `${año}-${String(mes).padStart(2, '0')}-31`),
    ])
    setItems(itemsData || [])
    setMovs(movsData || [])
    setLoadingItems(false)
  }

  // Gasto real por bloque este mes
  function gastadoReal(bloqueId) {
    return movs
      .filter(m => m.tipo === 'egreso' && CAT_BLOQUE[m.categoria] === bloqueId)
      .reduce((s, m) => s + m.monto, 0)
  }

  async function handleAddItem(bloqueId) {
    if (!formItem.nombre || !formItem.monto) return
    const { data, error } = await supabase
      .from('presupuesto_items')
      .insert([{ bloque: bloqueId, nombre: formItem.nombre, monto: parseFloat(formItem.monto), mes, año }])
      .select()
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

  const ingresoNum = parseFloat(ingreso) || 0
  const totalPct = (editando ? borradores : bloques).reduce((s, b) => s + b.pct, 0)
  const totalOk = totalPct === 100

  function iniciarEdicion() { setBorradores(bloques.map(b => ({ ...b }))); setEditando(true) }
  function cancelarEdicion() { setBorradores(null); setEditando(false) }
  function guardarEdicion() { if (!totalOk) return; setBloques(borradores); setBorradores(null); setEditando(false) }
  function cambiarPct(id, val) {
    setBorradores(prev => prev.map(b => b.id === id ? { ...b, pct: Math.max(0, Math.min(100, parseInt(val) || 0)) } : b))
  }

  const lista = editando ? borradores : bloques

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

      {/* Bloques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {lista.map((bloque) => {
          const Icon = bloque.icon
          const monto = ingresoNum * (bloque.pct / 100)
          const bloqueItems = items.filter(i => i.bloque === bloque.id)
          const totalItems = bloqueItems.reduce((s, i) => s + i.monto, 0)
          const isExpandido = expandido === bloque.id

          return (
            <Card key={bloque.id} className="animate-enter">
              {/* Header bloque */}
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
              <div className="flex items-center gap-3 mb-4">
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
              </div>

              {/* Barra */}
              <div className="w-full h-2 rounded-full mb-4" style={{ background: 'var(--progress-track)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${bloque.pct}%`, background: bloque.color }} />
              </div>

              {/* Monto calculado */}
              {ingresoNum > 0 && (
                <div className="px-3 py-2 rounded-xl mb-4"
                  style={{ background: `${bloque.color}10`, border: `1px solid ${bloque.color}25` }}>
                  <p className="text-xs text-stone-400 mb-0.5">De tu ingreso va aquí</p>
                  <p className="text-lg font-bold" style={{ color: bloque.color }}>{formatCurrency(monto)}</p>
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
                {/* Disponible real */}
              {ingresoNum > 0 && (
                <div className="flex items-center justify-between px-1 mb-2">
                  <span className="text-xs" style={{ color:'var(--text-muted)' }}>Gastado real</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: gastadoReal(bloque.id) > monto ? '#C0605A' : bloque.color }}>
                      {formatCurrency(gastadoReal(bloque.id))}
                    </span>
                    <span className="text-xs" style={{ color:'var(--text-muted)' }}>/</span>
                    <span className="text-xs font-bold" style={{ color:'var(--text-secondary)' }}>
                      {formatCurrency(monto)}
                    </span>
                  </div>
                </div>
              )}
              {ingresoNum > 0 && (
                <div className="w-full h-2 rounded-full mb-3" style={{ background:'var(--progress-track)' }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100,(gastadoReal(bloque.id)/monto)*100)}%`,
                      background: gastadoReal(bloque.id) > monto ? '#C0605A' : bloque.color
                    }} />
                </div>
              )}
              {ingresoNum > 0 && (
                <div className="flex justify-between px-1 mb-3">
                  <span className="text-xs" style={{ color:'var(--text-muted)' }}>Disponible</span>
                  <span className="text-sm font-black" style={{ color: monto - gastadoReal(bloque.id) >= 0 ? bloque.color : '#C0605A' }}>
                    {formatCurrency(monto - gastadoReal(bloque.id))}
                  </span>
                </div>
              )}
                <button
                  onClick={() => setExpandido(isExpandido ? null : bloque.id)}
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
                          <span className="text-xs text-stone-700 font-medium">{item.nombre}</span>
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

                    {/* Agregar item */}
                    {addingTo === bloque.id ? (
                      <div className="space-y-2 mt-2">
                        <input className="ff-input w-full" placeholder="Ej: Alquiler, Agua, Supermercado..."
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
                        className="w-full flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-semibold transition-all mt-1"
                        style={{ background: `${bloque.color}08`, color: bloque.color, border: `1px dashed ${bloque.color}40`, cursor: 'pointer' }}>
                        <Plus size={12} /> Agregar item
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Calculadora */}
      <Card className="animate-enter">
        <h3 className="font-bold text-stone-800 mb-1">Calculadora de distribución</h3>
        <p className="text-xs text-stone-400 mb-5">Ingresa tu sueldo y ve cuánto va a cada bloque</p>
        <div className="flex gap-3 mb-6 flex-wrap">
          <input type="number" min="0" step="0.01" placeholder="Ej: 5000.00"
            value={ingreso} onChange={e => { setIngreso(e.target.value); setConfirmado(false) }}
            className="ff-input flex-1 min-w-[180px]" />
          <button onClick={() => setConfirmado(true)} disabled={!ingresoNum}
            className="ff-btn-primary" style={{ opacity: ingresoNum ? 1 : 0.5 }}>
            Calcular
          </button>
        </div>
        {confirmado && ingresoNum > 0 && (
          <div className="space-y-3">
            {bloques.map(b => {
              const monto = ingresoNum * (b.pct / 100)
              const Icon = b.icon
              const bloqueItems = items.filter(i => i.bloque === b.id)
              const totalItems = bloqueItems.reduce((s, i) => s + i.monto, 0)
              return (
                <div key={b.id} className="rounded-xl overflow-hidden"
                  style={{ background: `${b.color}08`, border: `1px solid ${b.color}18` }}>
                  <div className="flex items-center gap-4 p-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${b.color}15` }}>
                      <Icon size={15} style={{ color: b.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-stone-800">{b.nombre}</p>
                      <p className="text-xs text-stone-400">{b.pct}% · {b.categorias.join(', ')}</p>
                    </div>
                    <p className="text-base font-bold flex-shrink-0" style={{ color: b.color }}>{formatCurrency(monto)}</p>
                  </div>
                  {bloqueItems.length > 0 && (
                    <div className="px-3 pb-3 space-y-1">
                      {/* Barra de uso del bloque */}
                      <div className="flex justify-between text-xs mb-1 px-1">
                        <span style={{ color: 'var(--text-muted)' }}>Distribuido</span>
                        <span className="font-bold" style={{ color: totalItems > monto ? '#C0605A' : b.color }}>
                          {formatCurrency(totalItems)} / {formatCurrency(monto)}
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full mb-2" style={{ background: 'var(--progress-track)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (totalItems / monto) * 100)}%`, background: totalItems > monto ? '#C0605A' : b.color }} />
                      </div>
                      {bloqueItems.map(item => {
                        const pctDelBloque = monto > 0 ? ((item.monto / monto) * 100).toFixed(0) : 0
                        return (
                          <div key={item.id} className="flex justify-between text-xs px-2 py-1.5 rounded-lg"
                            style={{ background: `${b.color}08` }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{item.nombre}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{pctDelBloque}% del bloque</span>
                              <span className="font-bold" style={{ color: b.color }}>{formatCurrency(item.monto)}</span>
                            </div>
                          </div>
                        )
                      })}
                      {totalItems > monto && (
                        <p className="text-xs text-center mt-1 font-semibold" style={{ color: '#C0605A' }}>
                          ⚠ Excedes el bloque por {formatCurrency(totalItems - monto)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="flex items-center justify-between px-3 py-3 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
              <div className="flex items-center gap-2">
                <CheckCircle size={15} style={{ color: '#2D7A5F' }} />
                <span className="text-sm font-bold text-stone-800">Total distribuido</span>
              </div>
              <span className="text-base font-bold" style={{ color: '#2D7A5F' }}>{formatCurrency(ingresoNum)}</span>
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  )
}