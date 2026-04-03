'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Settings2, Plus, Trash2, Edit3, Save, X,
  ChevronDown, ChevronUp, Loader2, Home, Sparkles, Sprout,
  Target, TrendingUp, ArrowRight, User, Palette, Check, Download
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { useTheme, getThemeColors, THEMES } from '@/lib/themes'
import { getFlagEmoji } from '@/lib/utils'
import ConfirmDialog, { useConfirm } from '@/components/ui/ConfirmDialog'

const BLOQUES = [
  { id: 'necesidades', nombre: 'Necesidades', color: 'var(--accent-blue)', Icon: Home },
  { id: 'estilo', nombre: 'Estilo de vida', color: 'var(--accent-terra)', Icon: Sparkles },
  { id: 'futuro', nombre: 'Futuro', color: 'var(--accent-green)', Icon: Sprout },
]

export default function AjustesPage() {
  const { theme, setTheme } = useTheme()
  const themeColors = getThemeColors(theme)

  const [categorias, setCategorias] = useState([])
  const [subcategorias, setSubcategorias] = useState([])
  const [metas, setMetas] = useState([])
  const [inversiones, setInversiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nombrePerfil, setNombrePerfil]   = useState('')
  const [editNombre,   setEditNombre]     = useState(false)
  const [savingNombre, setSavingNombre]   = useState(false)

  // Expansión de categorías para ver subcategorías
  const [expandido, setExpandido] = useState(null)

  // Form nueva categoría
  const [addingCatBloque, setAddingCatBloque] = useState(null)
  const [formCat, setFormCat] = useState({ nombre: '', color: '' })

  // Form nueva subcategoría
  const [addingSubCat, setAddingSubCat] = useState(null)
  const [formSub, setFormSub] = useState('')
  const [formSubTipo, setFormSubTipo] = useState(null)

  // Form agregar al bloque Futuro (metas/inversiones)
  const [addingFuturoTipo, setAddingFuturoTipo] = useState(null) // null | 'selecting' | 'metas' | 'inversiones'
  const [formFuturo, setFormFuturo] = useState('')

  // Edición inline
  const [editandoCat, setEditandoCat] = useState(null)
  const [editandoSub, setEditandoSub] = useState(null)
  const [editandoMeta, setEditandoMeta] = useState(null)       // { id, nombre, emoji, pct_mensual }
  const [editandoInversion, setEditandoInversion] = useState(null) // { id, nombre, emoji, aporte }
  const [exportando, setExportando] = useState(false)
  const [bloqueCollapsed, setBloqueCollapsed] = useState({})
  const [hoveredCat, setHoveredCat] = useState(null)
  const [showTemas, setShowTemas] = useState(false)

  const { confirmProps, showConfirm } = useConfirm()

  useEffect(() => {
    cargar()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setNombrePerfil(session?.user?.user_metadata?.nombre || '')
    })
  }, [])

  async function handleGuardarNombre() {
    if (!nombrePerfil.trim()) return
    setSavingNombre(true)
    const nombre = nombrePerfil.trim()

    // 1. Actualizar metadatos de Auth
    const { error: authError } = await supabase.auth.updateUser({ data: { nombre } })
    if (authError) { toast('Error al guardar nombre: ' + authError.message); setSavingNombre(false); return }

    // 2. Sincronizar en la tabla perfiles (para Sidebar, permisos y lógica del hogar)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('perfiles').update({ nombre }).eq('id', user.id)
    }

    setSavingNombre(false)
    setEditNombre(false)
  }

  async function cargar() {
    setLoading(true)
    try {
      const [
        { data: cats, error: e1 },
        { data: subs, error: e2 },
        { data: metasData, error: e3 },
        { data: invData, error: e4 },
      ] = await Promise.all([
        supabase.from('categorias').select('*').order('bloque').order('orden').order('nombre'),
        supabase.from('subcategorias').select('*').order('orden').order('nombre'),
        supabase.from('metas').select('id, nombre, emoji, pct_mensual').order('created_at'),
        supabase.from('inversiones').select('id, nombre, emoji, aporte, pct_mensual').order('created_at'),
      ])
      if (e1 || e2 || e3 || e4) throw (e1 || e2 || e3 || e4)
      setCategorias(cats || [])
      setSubcategorias(subs || [])
      setMetas(metasData || [])
      setInversiones(invData || [])
    } catch (err) {
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
    if (error) { toast('' + error.message); return }
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
    if (error) { toast('' + error.message); return }
    setCategorias(prev => prev.map(c =>
      c.id === cat.id ? { ...c, nombre: editandoCat.nombre.trim(), color: editandoCat.color } : c
    ))
    setEditandoCat(null)
  }

  function handleDeleteCat(id) {
    showConfirm('¿Eliminar esta categoría y todas sus subcategorías?', async () => {
      const { error: subError } = await supabase.from('subcategorias').delete().eq('categoria_id', id)
      if (subError) { toast('Error al eliminar subcategorías: ' + subError.message); return }
      const { error } = await supabase.from('categorias').delete().eq('id', id)
      if (error) { toast('' + error.message); return }
      setCategorias(prev => prev.filter(c => c.id !== id))
      setSubcategorias(prev => prev.filter(s => s.categoria_id !== id))
    })
  }

  // ── SUBCATEGORÍAS ─────────────────────────────────────────────────────────

  async function handleAddSub(categoriaId) {
    if (!formSub.trim() || saving) return
    setSaving(true)
    const { data, error } = await supabase.from('subcategorias').insert([{
      categoria_id: categoriaId,
      nombre: formSub.trim(),
      tipo: formSubTipo || null,
      orden: subcategorias.filter(s => s.categoria_id === categoriaId).length,
    }]).select()
    setSaving(false)
    if (error) { toast('' + error.message); return }
    setSubcategorias(prev => [...prev, data[0]])
    setFormSub('')
    setFormSubTipo(null)
    setAddingSubCat(null)
  }

  async function handleSaveSub(sub) {
    if (!editandoSub?.nombre?.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('subcategorias').update({
      nombre: editandoSub.nombre.trim(),
      tipo: editandoSub.tipo || null,
    }).eq('id', sub.id)
    setSaving(false)
    if (error) { toast('' + error.message); return }
    setSubcategorias(prev => prev.map(s =>
      s.id === sub.id ? { ...s, nombre: editandoSub.nombre.trim(), tipo: editandoSub.tipo || null } : s
    ))
    setEditandoSub(null)
  }

  async function handleDeleteSub(id) {
    const { error } = await supabase.from('subcategorias').delete().eq('id', id)
    if (error) { toast('' + error.message); return }
    setSubcategorias(prev => prev.filter(s => s.id !== id))
  }

  // ── FUTURO: agregar meta o inversión directamente ─────────────────────────

  async function handleAddFuturo() {
    if (!formFuturo.trim() || saving) return
    setSaving(true)
    if (addingFuturoTipo === 'metas') {
      const { data, error } = await supabase.from('metas').insert([{
        nombre: formFuturo.trim(), emoji: '🎯', pct_mensual: 0, meta: 0, actual: 0, estado: 'activa',
      }]).select()
      setSaving(false)
      if (error) { toast('' + error.message); return }
      setMetas(prev => [...prev, data[0]])
    } else {
      const { data, error } = await supabase.from('inversiones').insert([{
        nombre: formFuturo.trim(), emoji: '📈', aporte: 0, pct_mensual: 0, capital: 0, tasa: 0,
      }]).select()
      setSaving(false)
      if (error) { toast('' + error.message); return }
      setInversiones(prev => [...prev, data[0]])
    }
    setFormFuturo('')
    setAddingFuturoTipo(null)
  }

  function handleDeleteMeta(id) {
    showConfirm('¿Eliminar esta meta?', async () => {
      const { error } = await supabase.from('metas').delete().eq('id', id)
      if (error) { toast('' + error.message); return }
      setMetas(prev => prev.filter(m => m.id !== id))
    })
  }

  function handleDeleteInversion(id) {
    showConfirm('¿Eliminar esta inversión?', async () => {
      const { error } = await supabase.from('inversiones').delete().eq('id', id)
      if (error) { toast('' + error.message); return }
      setInversiones(prev => prev.filter(i => i.id !== id))
    })
  }

  // ── EDITAR METAS ──────────────────────────────────────────────────────────

  async function handleSaveMeta(meta) {
    if (!editandoMeta?.nombre?.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('metas').update({
      nombre: editandoMeta.nombre.trim(),
      emoji: editandoMeta.emoji || '🎯',
      pct_mensual: parseFloat(editandoMeta.pct_mensual) || 0,
    }).eq('id', meta.id)
    setSaving(false)
    if (error) { toast('' + error.message); return }
    setMetas(prev => prev.map(m => m.id === meta.id
      ? { ...m, nombre: editandoMeta.nombre.trim(), emoji: editandoMeta.emoji || '🎯', pct_mensual: parseFloat(editandoMeta.pct_mensual) || 0 }
      : m
    ))
    setEditandoMeta(null)
  }

  // ── EDITAR INVERSIONES ────────────────────────────────────────────────────

  async function handleSaveInversion(inv) {
    if (!editandoInversion?.nombre?.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('inversiones').update({
      nombre: editandoInversion.nombre.trim(),
      emoji: editandoInversion.emoji || '📈',
      aporte: parseFloat(editandoInversion.aporte) || 0,
      pct_mensual: parseFloat(editandoInversion.pct_mensual) || 0,
    }).eq('id', inv.id)
    setSaving(false)
    if (error) { toast('' + error.message); return }
    setInversiones(prev => prev.map(i => i.id === inv.id
      ? { ...i, nombre: editandoInversion.nombre.trim(), emoji: editandoInversion.emoji || '📈', aporte: parseFloat(editandoInversion.aporte) || 0, pct_mensual: parseFloat(editandoInversion.pct_mensual) || 0 }
      : i
    ))
    setEditandoInversion(null)
  }

  // ── EXPORTAR BACKUP ───────────────────────────────────────────────────────

  async function handleExportar() {
    setExportando(true)
    try {
      const [
        { data: movs }, { data: deudasData }, { data: deudaMovs },
        { data: metasData }, { data: invData },
        { data: cats }, { data: subs },
        { data: sobreMovs }, { data: bloquesData },
      ] = await Promise.all([
        supabase.from('movimientos').select('*').order('fecha'),
        supabase.from('deudas').select('*'),
        supabase.from('deuda_movimientos').select('*'),
        supabase.from('metas').select('*'),
        supabase.from('inversiones').select('*'),
        supabase.from('categorias').select('*'),
        supabase.from('subcategorias').select('*'),
        supabase.from('sobre_movimientos').select('*'),
        supabase.from('presupuesto_bloques').select('*'),
      ])
      const backup = {
        exportado: new Date().toISOString(),
        version: 1,
        movimientos: movs || [],
        deudas: deudasData || [],
        deuda_movimientos: deudaMovs || [],
        metas: metasData || [],
        inversiones: invData || [],
        categorias: cats || [],
        subcategorias: subs || [],
        sobre_movimientos: sobreMovs || [],
        presupuesto_bloques: bloquesData || [],
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `familiafinanzas-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('Backup descargado', 'success')
    } catch (err) {
      toast('Error al exportar: ' + err.message)
    } finally {
      setExportando(false)
    }
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
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Módulo</p>
         <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
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

          {/* ── Perfil ── */}
          <div className="animate-enter">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditNombre(v => !v)}
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', border: 'none', cursor: 'pointer' }}>
                <User size={16} style={{ color: 'var(--accent-green)' }} />
              </button>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Perfil</p>
            </div>
            {editNombre && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={nombrePerfil}
                  onChange={e => setNombrePerfil(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGuardarNombre()}
                  autoFocus
                  placeholder="Tu nombre"
                  className="ff-input flex-1 text-sm"
                />
                <button onClick={handleGuardarNombre} disabled={savingNombre}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--accent-green)', color: 'var(--text-on-dark)', border: 'none', cursor: 'pointer' }}>
                  {savingNombre ? <Loader2 size={12} className="animate-spin" /> : <Save size={13} />}
                </button>
                <button onClick={() => setEditNombre(false)}
                  className="px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                  <X size={13} />
                </button>
              </div>
            )}

            {/* ── Temas ── */}
            <div className="mt-4">
              <button
                onClick={() => setShowTemas(v => !v)}
                className="flex items-center gap-3"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--accent-violet) 12%, transparent)' }}>
                  <Palette size={16} style={{ color: 'var(--accent-violet)' }} />
                </div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Temas</p>
                {showTemas
                  ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                  : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
              </button>

              {showTemas && (
                <div className="mt-3 space-y-1">
                  {Object.entries(THEMES).map(([key, t]) => {
                    const active = theme === key
                    return (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl"
                        style={{
                          background: active ? 'color-mix(in srgb, var(--accent-violet) 8%, var(--bg-secondary))' : 'var(--bg-secondary)',
                          border: active ? '1px solid color-mix(in srgb, var(--accent-violet) 30%, transparent)' : '1px solid transparent',
                          cursor: 'pointer',
                        }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: `linear-gradient(135deg, ${t.preview[0]} 50%, ${t.preview[1]} 50%)`,
                          border: '1px solid var(--border-glass)',
                        }} />
                        <span className="flex-1 text-left text-sm font-semibold"
                          style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {t.name}
                        </span>
                        {active && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--accent-violet)' }}>
                            <Check size={10} color="white" strokeWidth={4} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {BLOQUES.map(bloque => {
            const catBloque = categorias.filter(c => c.bloque === bloque.id)
            const { Icon } = bloque

            return (
              <Card key={bloque.id} className="animate-enter">

                {/* Cabecera del bloque */}
                <div className={`flex items-center gap-3 ${bloqueCollapsed[bloque.id] ? '' : 'mb-4'}`}>
                  <button
                    onClick={() => setBloqueCollapsed(p => ({ ...p, [bloque.id]: !p[bloque.id] }))}
                    className="flex items-center gap-3 flex-1 min-w-0"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${bloque.color} 12%, transparent)` }}>
                      <Icon size={16} style={{ color: bloque.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{bloque.nombre}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {bloque.id === 'futuro'
                          ? `${metas.length} meta${metas.length !== 1 ? 's' : ''} · ${inversiones.length} inversión${inversiones.length !== 1 ? 'es' : ''}`
                          : `${catBloque.length} categoría${catBloque.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {bloqueCollapsed[bloque.id]
                      ? <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      : <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
                  </button>
                  {!bloqueCollapsed[bloque.id] && (bloque.id === 'futuro' ? (
                    <button
                      onClick={() => { setAddingFuturoTipo('selecting'); setFormFuturo('') }}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${bloque.color} 10%, transparent)`,
                        color: bloque.color, border: 'none', cursor: 'pointer',
                      }}>
                      <Plus size={12} /> Agregar
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setAddingCatBloque(bloque.id)
                        setFormCat({ nombre: '', color: themeColors[0] || '' })
                      }}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{
                        background: `color-mix(in srgb, ${bloque.color} 10%, transparent)`,
                        color: bloque.color, border: 'none', cursor: 'pointer',
                      }}>
                      <Plus size={12} /> Categoría
                    </button>
                  ))}
                </div>

                {/* Formulario nueva categoría */}
                {!bloqueCollapsed[bloque.id] && addingCatBloque === bloque.id && (
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

                {/* Formulario Futuro: selector tipo → nombre */}
                {bloque.id === 'futuro' && !bloqueCollapsed[bloque.id] && addingFuturoTipo && (
                  <div className="mb-4 p-3 rounded-xl space-y-3"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
                    {addingFuturoTipo === 'selecting' ? (
                      <>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>¿Qué quieres agregar?</p>
                        <div className="flex gap-2">
                          {[
                            { key: 'metas', label: 'Metas de Ahorro', color: 'var(--accent-green)', Icon: Target },
                            { key: 'inversiones', label: 'Carteras de Inversión', color: 'var(--accent-violet)', Icon: TrendingUp },
                          ].map(t => (
                            <button key={t.key} onClick={() => setAddingFuturoTipo(t.key)}
                              className="flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-semibold"
                              style={{
                                background: `color-mix(in srgb, ${t.color} 10%, transparent)`,
                                color: t.color,
                                border: `1px solid color-mix(in srgb, ${t.color} 25%, transparent)`,
                                cursor: 'pointer',
                              }}>
                              <t.Icon size={18} />
                              {t.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setAddingFuturoTipo(null)}
                          className="ff-btn-ghost w-full text-sm py-1.5">
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          {addingFuturoTipo === 'metas'
                            ? <><Target size={13} style={{ color: 'var(--accent-green)' }} /><span className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>Meta de Ahorro</span></>
                            : <><TrendingUp size={13} style={{ color: 'var(--accent-violet)' }} /><span className="text-xs font-semibold" style={{ color: 'var(--accent-violet)' }}>Cartera de Inversión</span></>
                          }
                        </div>
                        <input
                          className="ff-input w-full"
                          placeholder={addingFuturoTipo === 'metas' ? 'Ej: Fondo de emergencia, Vacaciones...' : 'Ej: S&P 500, Bitcoin...'}
                          value={formFuturo}
                          onChange={e => setFormFuturo(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddFuturo()}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button onClick={handleAddFuturo} disabled={saving || !formFuturo.trim()}
                            className="ff-btn-primary flex-1 text-sm py-2 flex items-center justify-center gap-1">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} /> Agregar</>}
                          </button>
                          <button onClick={() => setAddingFuturoTipo('selecting')}
                            className="ff-btn-ghost flex-1 text-sm py-2">
                            ← Cambiar tipo
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Lista de categorías */}
                {!bloqueCollapsed[bloque.id] && (
                <div className="space-y-2">
                  {catBloque.length === 0 && addingCatBloque !== bloque.id && bloque.id !== 'futuro' && (
                    <p className="text-xs italic text-center py-4" style={{ color: 'var(--text-muted)' }}>

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
                          style={{ background: `color-mix(in srgb, ${cat.color} 6%, var(--bg-secondary))` }}
                          onMouseEnter={() => setHoveredCat(cat.id)}
                          onMouseLeave={() => setHoveredCat(null)}
                          onTouchStart={() => setHoveredCat(prev => prev === cat.id ? null : cat.id)}>

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
                            <span className="flex-1 text-sm font-normal" style={{ color: 'var(--text-secondary)' }}>
                              {cat.nombre}
                            </span>
                          )}

                          <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, opacity: hoveredCat === cat.id ? 1 : 0, transition: 'opacity 0.15s' }}>
                                  <button
                                    onClick={() => setEditandoCat({ id: cat.id, nombre: cat.nombre, color: cat.color })}
                                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                    <Edit3 size={12} />
                                  </button>
                                  <button onClick={() => handleDeleteCat(cat.id)}
                                    style={{ color: 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
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
                                  <div className="flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2">
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
                                    </div>
                                    {bloque.id === 'futuro' && (
                                      <div className="flex items-center gap-1.5">
                                        {[
                                          { key: 'metas', label: 'Metas', color: 'var(--accent-green)', Icon: Target },
                                          { key: 'inversiones', label: 'Inversiones', color: 'var(--accent-violet)', Icon: TrendingUp },
                                        ].map(t => (
                                          <button key={t.key}
                                            onClick={() => setEditandoSub(p => ({ ...p, tipo: p.tipo === t.key ? null : t.key }))}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                                            style={{
                                              background: editandoSub.tipo === t.key ? `color-mix(in srgb, ${t.color} 15%, transparent)` : 'transparent',
                                              color: editandoSub.tipo === t.key ? t.color : 'var(--text-muted)',
                                              border: `1px solid ${editandoSub.tipo === t.key ? t.color : 'var(--border-glass)'}`,
                                              cursor: 'pointer',
                                            }}>
                                            <t.Icon size={9} /> {t.label}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <>
                                    <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      {sub.nombre}
                                    </span>
                                    {bloque.id === 'futuro' && sub.tipo && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                                        style={{
                                          background: `color-mix(in srgb, ${sub.tipo === 'metas' ? 'var(--accent-green)' : 'var(--accent-violet)'} 12%, transparent)`,
                                          color: sub.tipo === 'metas' ? 'var(--accent-green)' : 'var(--accent-violet)',
                                        }}>
                                        {sub.tipo === 'metas' ? <Target size={8} /> : <TrendingUp size={8} />}
                                        {sub.tipo === 'metas' ? 'Metas' : 'Inversiones'}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => setEditandoSub({ id: sub.id, nombre: sub.nombre, tipo: sub.tipo || null })}
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
                              <div className="pt-1 space-y-1.5">
                                <div className="flex items-center gap-2">
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
                                  <button onClick={() => { setAddingSubCat(null); setFormSub(''); setFormSubTipo(null) }}
                                    style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                    <X size={12} />
                                  </button>
                                </div>
                                {bloque.id === 'futuro' && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>Tipo:</span>
                                    {[
                                      { key: 'metas', label: 'Metas', color: 'var(--accent-green)', Icon: Target },
                                      { key: 'inversiones', label: 'Inversiones', color: 'var(--accent-violet)', Icon: TrendingUp },
                                    ].map(t => (
                                      <button key={t.key}
                                        onClick={() => setFormSubTipo(formSubTipo === t.key ? null : t.key)}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                                        style={{
                                          background: formSubTipo === t.key ? `color-mix(in srgb, ${t.color} 15%, transparent)` : 'transparent',
                                          color: formSubTipo === t.key ? t.color : 'var(--text-muted)',
                                          border: `1px solid ${formSubTipo === t.key ? t.color : 'var(--border-glass)'}`,
                                          cursor: 'pointer',
                                        }}>
                                        <t.Icon size={9} /> {t.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
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
                )}

                {/* Metas e Inversiones — solo bloque Futuro */}
                {bloque.id === 'futuro' && !bloqueCollapsed[bloque.id] && (
                  <div className={`space-y-3 ${catBloque.length > 0 ? 'mt-3' : ''}`}>

                    {/* Metas de Ahorro */}
                    <div className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)' }}>
                      <div className="flex items-center justify-between px-3 py-2"
                        style={{ background: 'color-mix(in srgb, var(--accent-green) 6%, var(--bg-secondary))' }}>
                        <div className="flex items-center gap-2">
                          <Target size={12} style={{ color: 'var(--accent-green)' }} />
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Metas de Ahorro</p>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', color: 'var(--accent-green)' }}>
                            {metas.length}
                          </span>
                        </div>
                        <a href="/metas" className="text-[10px] font-semibold flex items-center gap-0.5"
                          style={{ color: 'var(--accent-green)', textDecoration: 'none' }}>
                          Ver todo <ArrowRight size={9} />
                        </a>
                      </div>
                      {metas.length === 0 && (
                        <p className="text-xs italic px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                          Sin metas — pulsa "+ Agregar" para crear una
                        </p>
                      )}
                      {metas.map(m => (
                        <div key={m.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                          {editandoMeta?.id === m.id ? (
                            <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
                              <input className="ff-input w-8 text-center text-sm p-1" maxLength={4}
                                value={editandoMeta.emoji}
                                onChange={e => setEditandoMeta(p => ({ ...p, emoji: e.target.value }))} />
                              <input className="ff-input flex-1 text-xs py-1 min-w-[100px]"
                                value={editandoMeta.nombre}
                                onChange={e => setEditandoMeta(p => ({ ...p, nombre: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSaveMeta(m)} />
                              <div className="flex items-center gap-1">
                                <input className="ff-input w-14 text-xs py-1 text-center" type="number" min="0" max="100"
                                  value={editandoMeta.pct_mensual}
                                  onChange={e => setEditandoMeta(p => ({ ...p, pct_mensual: e.target.value }))} />
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                              </div>
                              <button onClick={() => handleSaveMeta(m)} disabled={saving}
                                style={{ color: 'var(--accent-green)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              </button>
                              <button onClick={() => setEditandoMeta(null)}
                                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2">
                              <span className="text-sm">{getFlagEmoji(m.emoji)}</span>
                              <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.nombre}</span>
                              <span className="text-[10px] font-semibold" style={{ color: 'var(--accent-green)' }}>{m.pct_mensual}%</span>
                              <button onClick={() => setEditandoMeta({ id: m.id, nombre: m.nombre, emoji: m.emoji || '🎯', pct_mensual: m.pct_mensual })}
                                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                <Edit3 size={11} />
                              </button>
                              <button onClick={() => handleDeleteMeta(m.id)}
                                style={{ color: 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Carteras de Inversión */}
                    <div className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid color-mix(in srgb, var(--accent-violet) 20%, transparent)' }}>
                      <div className="flex items-center justify-between px-3 py-2"
                        style={{ background: 'color-mix(in srgb, var(--accent-violet) 6%, var(--bg-secondary))' }}>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={12} style={{ color: 'var(--accent-violet)' }} />
                          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Carteras de Inversión</p>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'color-mix(in srgb, var(--accent-violet) 12%, transparent)', color: 'var(--accent-violet)' }}>
                            {inversiones.length}
                          </span>
                        </div>
                        <a href="/inversiones" className="text-[10px] font-semibold flex items-center gap-0.5"
                          style={{ color: 'var(--accent-violet)', textDecoration: 'none' }}>
                          Ver todo <ArrowRight size={9} />
                        </a>
                      </div>
                      {inversiones.length === 0 && (
                        <p className="text-xs italic px-3 py-2" style={{ color: 'var(--text-muted)' }}>
                          Sin carteras — pulsa "+ Agregar" para crear una
                        </p>
                      )}
                      {inversiones.map(inv => (
                        <div key={inv.id} className="border-t" style={{ borderColor: 'var(--border-glass)' }}>
                          {editandoInversion?.id === inv.id ? (
                            <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
                              <input className="ff-input w-8 text-center text-sm p-1" maxLength={4}
                                value={editandoInversion.emoji}
                                onChange={e => setEditandoInversion(p => ({ ...p, emoji: e.target.value }))} />
                              <input className="ff-input flex-1 text-xs py-1 min-w-[100px]"
                                value={editandoInversion.nombre}
                                onChange={e => setEditandoInversion(p => ({ ...p, nombre: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSaveInversion(inv)} />
                              <div className="flex items-center gap-1">
                                <input className="ff-input w-14 text-xs py-1 text-center" type="number" min="0" max="100"
                                  value={editandoInversion.pct_mensual}
                                  onChange={e => setEditandoInversion(p => ({ ...p, pct_mensual: e.target.value }))} />
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <input className="ff-input w-16 text-xs py-1 text-center" type="number" min="0" step="0.01"
                                  placeholder="0"
                                  value={editandoInversion.aporte}
                                  onChange={e => setEditandoInversion(p => ({ ...p, aporte: e.target.value }))} />
                                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>/mes</span>
                              </div>
                              <button onClick={() => handleSaveInversion(inv)} disabled={saving}
                                style={{ color: 'var(--accent-violet)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              </button>
                              <button onClick={() => setEditandoInversion(null)}
                                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 px-3 py-2">
                              <span className="text-sm">{getFlagEmoji(inv.emoji)}</span>
                              <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{inv.nombre}</span>
                              {(inv.pct_mensual > 0) && (
                                <span className="text-[10px] font-semibold" style={{ color: 'var(--accent-violet)' }}>{inv.pct_mensual}%</span>
                              )}
                              
                              <button onClick={() => setEditandoInversion({ id: inv.id, nombre: inv.nombre, emoji: inv.emoji || '📈', aporte: inv.aporte?.toString() || '0', pct_mensual: inv.pct_mensual?.toString() || '0' })}
                                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                <Edit3 size={11} />
                              </button>
                              <button onClick={() => handleDeleteInversion(inv.id)}
                                style={{ color: 'var(--accent-rose)', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                <Trash2 size={11} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
          {/* ── Exportar datos ── */}
          <Card className="animate-enter">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--accent-terra) 12%, transparent)' }}>
                <Download size={16} style={{ color: 'var(--accent-terra)' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Exportar datos</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Descarga un backup completo en JSON</p>
              </div>
            </div>
            <button
              onClick={handleExportar}
              disabled={exportando}
              className="ff-btn-ghost w-full flex items-center justify-center gap-2 text-sm">
              {exportando
                ? <><Loader2 size={14} className="animate-spin" /> Exportando...</>
                : <><Download size={14} /> Descargar backup</>}
            </button>
          </Card>

        </div>
      )}
      <ConfirmDialog {...confirmProps} />
    </AppShell>
  )
}
