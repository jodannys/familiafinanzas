'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Settings2, Plus, Trash2, Edit3, Save, X,
  ChevronDown, ChevronUp, Loader2, Home, Sparkles, Sprout,
  Target, TrendingUp, ArrowRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, getThemeColors } from '@/lib/themes'

const BLOQUES = [
  { id: 'necesidades', nombre: 'Necesidades', color: 'var(--accent-blue)', Icon: Home },
  { id: 'estilo', nombre: 'Estilo de vida', color: 'var(--accent-terra)', Icon: Sparkles },
  { id: 'futuro', nombre: 'Futuro', color: 'var(--accent-green)', Icon: Sprout },
]

export default function AjustesPage() {
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)

  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [metas, setMetas] = useState([])
  const [inversiones, setInversiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Expansión de categorías para ver subcategorías
  const [expandido, setExpandido] = useState(null)

  // Form nueva categoría
  const [addingCatBloque, setAddingCatBloque] = useState(null)
  const [formCat, setFormCat] = useState({ nombre: '', color: '' })

  // Form nueva subcategoría
  const [addingSubCat, setAddingSubCat] = useState(null)
  const [formSub, setFormSub] = useState('')

  // Edición inline
  const [editandoCat, setEditandoCat] = useState(null)
  const [editandoSub, setEditandoSub] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const [{ data: cats }, { data: subs }, { data: metasData }, { data: invData }] = await Promise.all([
        supabase.from('categorias').select('*').order('bloque').order('orden').order('nombre'),
        supabase.from('subcategorias').select('*').order('orden').order('nombre'),
        supabase.from('metas').select('id, nombre, emoji, pct_mensual').order('created_at'),
        supabase.from('inversiones').select('id, nombre, emoji, aporte').order('created_at'),
      ])
      setCategorias(cats || [])
      setSubcategorias(subs || [])
      setMetas(metasData || [])
      setInversiones(invData || [])
    } catch (err) {
      console.error('Error cargando ajustes:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── CATEGORÍAS ────────────────────────────────────────────────────────────

  async function handleAddCat(bloque) {
    if (!formCat.nombre.trim() || saving) return
    setSaving(true)
    const { data, error } = await supabase.from('categorias').insert([{
      nombre: formCat.nombre.trim(),
      bloque,
      color: formCat.color,
      orden: categorias.filter(c => c.bloque === bloque).length,
    }]).select()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setCategorias(prev => [...prev, data[0]])
    setFormCat({ nombre: '', color: themeColors[0] || '' })
    setAddingCatBloque(null)
    setExpandido(data[0].id)
  }

  async function handleSaveCat(cat) {
    if (!editandoCat?.nombre?.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('categorias').update({
      nombre: editandoCat.nombre.trim(),
      color: editandoCat.color,
    }).eq('id', cat.id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setCategorias(prev => prev.map(c =>
      c.id === cat.id ? { ...c, nombre: editandoCat.nombre.trim(), color: editandoCat.color } : c
    ))
    setEditandoCat(null)
  }

  async function handleDeleteCat(id) {
    if (!confirm('¿Eliminar esta categoría y todas sus subcategorías?')) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setCategorias(prev => prev.filter(c => c.id !== id))
    setSubcategorias(prev => prev.filter(s => s.categoria_id !== id))
  }

  // ── SUBCATEGORÍAS ─────────────────────────────────────────────────────────

  async function handleAddSub(categoriaId) {
    if (!formSub.trim() || saving) return
    setSaving(true)
    const { data, error } = await supabase.from('subcategorias').insert([{
      categoria_id: categoriaId,
      nombre: formSub.trim(),
      orden: subcategorias.filter(s => s.categoria_id === categoriaId).length,
    }]).select()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setSubcategorias(prev => [...prev, data[0]])
    setFormSub('')
    setAddingSubCat(null)
  }

  async function handleSaveSub(sub) {
    if (!editandoSub?.nombre?.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('subcategorias').update({
      nombre: editandoSub.nombre.trim()
    }).eq('id', sub.id)
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setSubcategorias(prev => prev.map(s =>
      s.id === sub.id ? { ...s, nombre: editandoSub.nombre.trim() } : s
    ))
    setEditandoSub(null)
  }

  async function handleDeleteSub(id) {
    const { error } = await supabase.from('subcategorias').delete().eq('id', id)
    if (error) { alert('Error: ' + error.message); return }
    setSubcategorias(prev => prev.filter(s => s.id !== id))
  }

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <AppShell>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 animate-enter">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--accent-violet) 12%, transparent)' }}>
          <Settings2 size={18} style={{ color: 'var(--accent-violet)' }} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: 'var(--text-muted)' }}>
            Módulo
          </p>
          <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Configuración
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Categorías y subcategorías de gastos
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : (
        <div className="space-y-5">
          {BLOQUES.map(bloque => {
            const catBloque = categorias.filter(c => c.bloque === bloque.id)
            const { Icon } = bloque

            return (
              <Card key={bloque.id} className="animate-enter">

                {/* Cabecera del bloque */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${bloque.color} 12%, transparent)` }}>
                    <Icon size={16} style={{ color: bloque.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-sm" style={{ color: 'var(--text-primary)' }}>{bloque.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {catBloque.length} categoría{catBloque.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setAddingCatBloque(bloque.id)
                      setFormCat({ nombre: '', color: themeColors[0] || '' })
                    }}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${bloque.color} 10%, transparent)`,
                      color: bloque.color,
                      border: 'none',
                      cursor: 'pointer',
                    }}>
                    <Plus size={12} /> Categoría
                  </button>
                </div>

                {/* Formulario nueva categoría */}
                {addingCatBloque === bloque.id && (
                  <div className="mb-4 p-3 rounded-xl space-y-3"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                    <input
                      className="ff-input w-full"
                      placeholder="Ej: Vivienda y Servicios, Salud, Educación..."
                      value={formCat.nombre}
                      onChange={e => setFormCat(p => ({ ...p, nombre: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleAddCat(bloque.id)}
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Color:</span>
                      {themeColors.map(c => (
                        <button key={c}
                          onClick={() => setFormCat(p => ({ ...p, color: c }))}
                          className="w-5 h-5 rounded-full transition-all"
                          style={{
                            background: c,
                            outline: formCat.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                            outlineOffset: 2,
                            border: 'none',
                            cursor: 'pointer',
                          }} />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddCat(bloque.id)}
                        disabled={saving || !formCat.nombre.trim()}
                        className="ff-btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} /> Agregar</>}
                      </button>
                      <button
                        onClick={() => setAddingCatBloque(null)}
                        className="ff-btn-ghost flex-1 text-sm py-2">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista de categorías */}
                <div className="space-y-2">
                  {catBloque.length === 0 && addingCatBloque !== bloque.id && (
                    <p className="text-xs italic text-center py-4" style={{ color: 'var(--text-muted)' }}>
                      Sin categorías — pulsa "Categoría" para agregar
                    </p>
                  )}

                  {catBloque.map(cat => {
                    const subs = subcategorias.filter(s => s.categoria_id === cat.id)
                    const isExpanded = expandido === cat.id

                    return (
                      <div key={cat.id} className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid var(--border-glass)' }}>

                        {/* Fila de categoría */}
                        <div className="flex items-center gap-2 px-3 py-2.5"
                          style={{ background: `color-mix(in srgb, ${cat.color} 6%, var(--bg-secondary))` }}>

                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />

                          {editandoCat?.id === cat.id ? (
                            <div className="flex-1 flex items-center gap-2 flex-wrap">
                              <input
                                className="ff-input flex-1 py-1 text-sm min-w-0"
                                value={editandoCat.nombre}
                                onChange={e => setEditandoCat(p => ({ ...p, nombre: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSaveCat(cat)}
                                autoFocus
                              />
                              <div className="flex gap-1">
                                {themeColors.slice(0, 8).map(c => (
                                  <button key={c}
                                    onClick={() => setEditandoCat(p => ({ ...p, color: c }))}
                                    className="w-4 h-4 rounded-full"
                                    style={{
                                      background: c,
                                      outline: editandoCat.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                                      outlineOffset: 1,
                                      border: 'none',
                                      cursor: 'pointer',
                                    }} />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <span className="flex-1 font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                              {cat.nombre}
                            </span>
                          )}

                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                            style={{
                              background: `color-mix(in srgb, ${cat.color} 12%, transparent)`,
                              color: cat.color,
                            }}>
                            {subs.length}
                          </span>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {editandoCat?.id === cat.id ? (
                              <>
                                <button onClick={() => handleSaveCat(cat)}
                                  style={{ color: 'var(--accent-green)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                  <Save size={13} />
                                </button>
                                <button onClick={() => setEditandoCat(null)}
                                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                  <X size={13} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditandoCat({ id: cat.id, nombre: cat.nombre, color: cat.color })}
                                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                  <Edit3 size={12} />
                                </button>
                                <button onClick={() => handleDeleteCat(cat.id)}
                                  style={{ color: 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                  <Trash2 size={12} />
                                </button>
                                <button onClick={() => setExpandido(isExpanded ? null : cat.id)}
                                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Subcategorías */}
                        {isExpanded && (
                          <div className="px-3 py-2 space-y-1" style={{ background: 'var(--bg-card)' }}>

                            {subs.length === 0 && addingSubCat !== cat.id && (
                              <p className="text-xs italic py-1" style={{ color: 'var(--text-muted)' }}>
                                Sin subcategorías aún
                              </p>
                            )}

                            {subs.map(sub => (
                              <div key={sub.id} className="flex items-center gap-2 py-1">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: cat.color, opacity: 0.5 }} />

                                {editandoSub?.id === sub.id ? (
                                  <>
                                    <input
                                      className="ff-input flex-1 py-0.5 text-xs"
                                      value={editandoSub.nombre}
                                      onChange={e => setEditandoSub(p => ({ ...p, nombre: e.target.value }))}
                                      onKeyDown={e => e.key === 'Enter' && handleSaveSub(sub)}
                                      autoFocus
                                    />
                                    <button onClick={() => handleSaveSub(sub)}
                                      style={{ color: 'var(--accent-green)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                      <Save size={12} />
                                    </button>
                                    <button onClick={() => setEditandoSub(null)}
                                      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                      <X size={12} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      {sub.nombre}
                                    </span>
                                    <button
                                      onClick={() => setEditandoSub({ id: sub.id, nombre: sub.nombre })}
                                      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                      <Edit3 size={11} />
                                    </button>
                                    <button onClick={() => handleDeleteSub(sub.id)}
                                      style={{ color: 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                      <Trash2 size={11} />
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}

                            {/* Form nueva subcategoría */}
                            {addingSubCat === cat.id ? (
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  className="ff-input flex-1 py-1 text-xs"
                                  placeholder="Nueva subcategoría..."
                                  value={formSub}
                                  onChange={e => setFormSub(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleAddSub(cat.id)}
                                  autoFocus
                                />
                                <button onClick={() => handleAddSub(cat.id)} disabled={saving}
                                  style={{ color: cat.color, background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                </button>
                                <button onClick={() => { setAddingSubCat(null); setFormSub('') }}
                                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                  <X size={12} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setAddingSubCat(cat.id); setFormSub('') }}
                                className="flex items-center gap-1 text-xs mt-1"
                                style={{ color: cat.color, background: 'none', border: 'none', cursor: 'pointer' }}>
                                <Plus size={11} /> Agregar subcategoría
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Metas e Inversiones — solo bloque Futuro, solo lectura */}
                {bloque.id === 'futuro' && (metas.length > 0 || inversiones.length > 0) && (
                  <div className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid var(--border-glass)' }}>
                    <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Desde tus módulos — solo lectura
                    </p>

                    {metas.length > 0 && (
                      <div className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)' }}>
                        <div className="flex items-center justify-between px-3 py-2"
                          style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, var(--bg-secondary))' }}>
                          <div className="flex items-center gap-2">
                            <Target size={12} style={{ color: 'var(--accent-green)' }} />
                            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Metas de Ahorro</p>
                          </div>
                          <a href="/metas"
                            className="text-[10px] font-bold flex items-center gap-0.5"
                            style={{ color: 'var(--accent-green)', textDecoration: 'none' }}>
                            Gestionar <ArrowRight size={9} />
                          </a>
                        </div>
                        {metas.map(m => (
                          <div key={m.id} className="flex items-center gap-2 px-3 py-2 border-t"
                            style={{ borderColor: 'var(--border-glass)' }}>
                            <span className="text-sm">{m.emoji}</span>
                            <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.nombre}</span>
                            <span className="text-[10px] font-bold" style={{ color: 'var(--accent-green)' }}>
                              {m.pct_mensual}% del futuro
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {inversiones.length > 0 && (
                      <div className="rounded-xl overflow-hidden"
                        style={{ border: '1px solid color-mix(in srgb, var(--accent-violet) 20%, transparent)' }}>
                        <div className="flex items-center justify-between px-3 py-2"
                          style={{ background: 'color-mix(in srgb, var(--accent-violet) 6%, var(--bg-secondary))' }}>
                          <div className="flex items-center gap-2">
                            <TrendingUp size={12} style={{ color: 'var(--accent-violet)' }} />
                            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Carteras de Inversión</p>
                          </div>
                          <a href="/inversiones"
                            className="text-[10px] font-bold flex items-center gap-0.5"
                            style={{ color: 'var(--accent-violet)', textDecoration: 'none' }}>
                            Gestionar <ArrowRight size={9} />
                          </a>
                        </div>
                        {inversiones.map(inv => (
                          <div key={inv.id} className="flex items-center gap-2 px-3 py-2 border-t"
                            style={{ borderColor: 'var(--border-glass)' }}>
                            <span className="text-sm">{inv.emoji}</span>
                            <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{inv.nombre}</span>
                            {inv.aporte > 0 && (
                              <span className="text-[10px] font-bold" style={{ color: 'var(--accent-violet)' }}>
                                +{inv.aporte}/mes
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
