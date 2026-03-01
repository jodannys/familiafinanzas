'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, SectionHeader, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, ArrowUpRight, ArrowDownRight, Search, Loader2, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const CATS = [
  { value: 'basicos',   label: 'Gastos Básicos' },
  { value: 'deseo',     label: 'Gastos Deseo' },
  { value: 'ahorro',    label: 'Ahorro / Metas' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'deuda',     label: 'Deudas' },
  { value: 'remesa',    label: 'Remesas' },
]

const catColor = { basicos:'sky', deseo:'violet', ahorro:'emerald', inversion:'gold', deuda:'rose', remesa:'orange' }

export default function GastosPage() {
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [form, setForm] = useState({
    tipo: 'egreso', monto: '', descripcion: '',
    categoria: 'basicos', fecha: new Date().toISOString().slice(0,10), quien: 'Yo'
  })

  // Cargar movimientos desde Supabase
  useEffect(() => {
    cargarMovimientos()
  }, [])

  async function cargarMovimientos() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false })
    if (error) {
      setError('Error al cargar movimientos: ' + error.message)
    } else {
      setMovs(data || [])
    }
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase
      .from('movimientos')
      .insert([{ ...form, monto: parseFloat(form.monto) }])
      .select()
    if (error) {
      setError('Error al guardar: ' + error.message)
    } else {
      setMovs(prev => [data[0], ...prev])
      setModal(false)
      setForm({ tipo:'egreso', monto:'', descripcion:'', categoria:'basicos', fecha: new Date().toISOString().slice(0,10), quien:'Yo' })
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('movimientos').delete().eq('id', id)
    if (!error) setMovs(prev => prev.filter(m => m.id !== id))
  }

  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s,m) => s+m.monto, 0)
  const egresos  = movs.filter(m => m.tipo === 'egreso').reduce((s,m) => s+m.monto, 0)

  const filtered = movs
    .filter(m => filtro === 'todos' || m.tipo === filtro || m.categoria === filtro)
    .filter(m => !search || m.descripcion.toLowerCase().includes(search.toLowerCase()))

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-stone-400 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-xl md:text-3xl font-bold text-stone-800" style={{ letterSpacing: '-0.03em' }}>Ingresos & Egresos</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nuevo registro
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(192,96,90,0.1)', border: '1px solid rgba(192,96,90,0.25)', color: '#C0605A' }}>
          {error}
        </div>
      )}

      {/* Totales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {[
          { label:'Ingresos del mes', value: formatCurrency(ingresos), color:'#10b981' },
          { label:'Egresos del mes',  value: formatCurrency(egresos),  color:'#fb7185' },
          { label:'Balance',          value: formatCurrency(ingresos-egresos), color: ingresos-egresos>=0 ? '#10b981' : '#fb7185' },
        ].map((s,i) => (
          <div key={i} className="glass-card p-5 animate-enter" style={{ animationDelay:`${i*0.05}s` }}>
            <p className="text-xs text-stone-400 uppercase tracking-wider font-semibold mb-2">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color:s.color, letterSpacing:'-0.02em' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input className="ff-input pl-9" placeholder="Buscar movimiento..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[{v:'todos',l:'Todos'},{v:'ingreso',l:'Ingresos'},{v:'egreso',l:'Egresos'},{v:'remesa',l:'Remesas'}].map(f => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: filtro===f.v ? 'rgba(45,122,95,0.15)' : 'var(--bg-secondary)',
                color: filtro===f.v ? '#2D7A5F' : 'var(--text-secondary)',
                border: filtro===f.v ? '1px solid rgba(45,122,95,0.3)' : '1px solid var(--border-glass)',
              }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <Loader2 size={20} className="animate-spin text-stone-400" />
            <span className="text-sm text-stone-400">Cargando movimientos...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-stone-400 text-sm">No hay movimientos aún</p>
            <button onClick={() => setModal(true)} className="ff-btn-primary mt-4">
              Agregar el primero
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((m, i) => (
              <div key={m.id}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl hover:bg-stone-50 transition-colors group animate-enter"
                style={{ animationDelay:`${i*0.03}s` }}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${m.tipo==='ingreso' ? 'bg-emerald-400/10' : 'bg-rose-400/10'}`}>
                  {m.tipo==='ingreso'
                    ? <ArrowUpRight size={14} className="text-emerald-400" />
                    : <ArrowDownRight size={14} className="text-rose-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{m.descripcion}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-stone-400">{m.fecha}</span>
                    <span className="text-xs text-stone-400">· {m.quien}</span>
                    <Badge color={catColor[m.categoria] || 'slate'}>{m.categoria}</Badge>
                  </div>
                </div>
                <p className="text-sm font-bold flex-shrink-0"
                  style={{ color: m.tipo==='ingreso' ? '#10b981' : '#fb7185' }}>
                  {m.tipo==='ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                </p>
                <button onClick={() => handleDelete(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-rose-50"
                  style={{ color: '#C0605A' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Movimiento">
        <form onSubmit={handleAdd} className="space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-3">
            {['ingreso','egreso'].map(t => (
              <button type="button" key={t} onClick={() => setForm({...form, tipo:t})}
                className="py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: form.tipo===t ? (t==='ingreso' ? 'rgba(16,185,129,0.12)' : 'rgba(251,113,133,0.12)') : 'var(--bg-secondary)',
                  color: form.tipo===t ? (t==='ingreso' ? '#10b981' : '#fb7185') : 'var(--text-secondary)',
                  border: form.tipo===t ? `1px solid ${t==='ingreso' ? 'rgba(16,185,129,0.3)' : 'rgba(251,113,133,0.3)'}` : '1px solid var(--border-glass)',
                }}>
                {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
              </button>
            ))}
          </div>
          <div>
            <label className="ff-label">Descripción</label>
            <input className="ff-input" placeholder="Ej: Sueldo, Mercado..." required
              value={form.descripcion} onChange={e => setForm({...form, descripcion:e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Monto</label>
              <input className="ff-input" type="number" min="0.01" step="0.01" placeholder="0.00" required
                value={form.monto} onChange={e => setForm({...form, monto:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Fecha</label>
              <input className="ff-input" type="date" required
                value={form.fecha} onChange={e => setForm({...form, fecha:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Categoría</label>
              <select className="ff-input" value={form.categoria} onChange={e => setForm({...form, categoria:e.target.value})}>
                {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="ff-label">¿Quién?</label>
              <select className="ff-input" value={form.quien} onChange={e => setForm({...form, quien:e.target.value})}>
                <option>Yo</option>
                <option>Pareja</option>
                <option>Ambos</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1 flex items-center justify-center gap-2" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}