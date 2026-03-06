'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { 
  Plus, Loader2, TrendingUp, Wallet, Target, 
  Trash2, Pencil, Info, ChevronRight 
} from 'lucide-react'
import { formatCurrency, calculateCompoundInterest } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, 
  YAxis, Tooltip, CartesianGrid 
} from 'recharts'

// --- COMPONENTES AUXILIARES ---

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="glass-card p-4 shadow-2xl border-none" style={{ background: 'var(--bg-card)', backdropFilter: 'blur(10px)' }}>
      <p className="text-[10px] uppercase font-black mb-2 opacity-60" style={{ color: 'var(--text-primary)' }}>Año {label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {p.name === 'balance' ? 'Total: ' : 'Aportado: '}
            {formatCurrency(p.value)}
          </p>
        </div>
      ))}
    </div>
  )
}

function SummaryCard({ label, value, icon, color, subtext }) {
  return (
    <div className="glass-card p-5 border-none shadow-sm flex flex-col justify-between min-h-[110px]" style={{ background: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between">
        <p className="ff-label !mb-0">{label}</p>
        <div style={{ color: color }} className="opacity-80">{icon}</div>
      </div>
      <div>
        <p className="text-xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {subtext && <p className="text-[9px] font-bold opacity-50 uppercase mt-1" style={{ color: 'var(--text-primary)' }}>{subtext}</p>}
      </div>
    </div>
  )
}

// --- PÁGINA PRINCIPAL ---

const INITIAL_FORM = {
  nombre: '', emoji: '📈', capital: '', aporte: '', 
  tasa: '', anos: '10', color: '#2D7A5F', invertido_real: ''
}

export default function InversionesPage() {
  const [inversiones, setInversiones] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [presupuesto, setPresupuesto] = useState(null)
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState(INITIAL_FORM)

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
  }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('inversiones').select('*').order('created_at')
    if (data) {
      setInversiones(data)
      if (data.length > 0) setSelected(data[0])
    }
    setLoading(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      capital: parseFloat(form.capital),
      aporte: parseFloat(form.aporte || 0),
      tasa: parseFloat(form.tasa),
      anos: parseInt(form.anos),
      invertido_real: parseFloat(form.invertido_real || 0)
    }

    const { error } = editandoId 
      ? await supabase.from('inversiones').update(payload).eq('id', editandoId)
      : await supabase.from('inversiones').insert([payload])

    if (!error) {
      setModal(false)
      setEditandoId(null)
      setForm(INITIAL_FORM)
      cargar()
    }
    setSaving(false)
  }

  async function eliminar(id) {
    if (!confirm('¿Seguro que quieres eliminar esta cartera?')) return
    await supabase.from('inversiones').delete().eq('id', id)
    cargar()
  }

  const calc = selected ? calculateCompoundInterest({
    principal: selected.capital,
    monthlyContribution: selected.aporte,
    annualRate: selected.tasa,
    years: selected.anos,
    compound: true
  }) : null

  return (
    <AppShell>
      <div className="max-w-[1400px] mx-auto pb-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 animate-enter">
          <div>
            <div className="flex items-center gap-2 mb-2">
               <div className="w-8 h-[2px]" style={{ background: 'var(--accent-green)' }} />
               <p className="text-[10px] uppercase tracking-[0.2em] font-black" style={{ color: 'var(--text-muted)' }}>Módulo Futuro</p>
            </div>
            <h1 className="text-4xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
              Inversiones<span style={{ color: 'var(--accent-green)' }}>.</span>
            </h1>
          </div>
          <button onClick={() => { setEditandoId(null); setForm(INITIAL_FORM); setModal(true); }} 
            className="ff-btn-primary flex items-center justify-center gap-2 h-14 px-8 shadow-lg shadow-[var(--accent-green)]/20">
            <Plus size={20} strokeWidth={3} />
            <span className="text-xs font-black uppercase tracking-widest">Nueva Cartera</span>
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-30">
            <Loader2 size={40} className="animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-widest">Calculando Proyecciones...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LISTADO LATERAL (Desktop: Izquierda) */}
            <div className="lg:col-span-3 space-y-4 order-2 lg:order-1">
              <div className="flex items-center justify-between px-1">
                <p className="ff-label !mb-0">Tus Estrategias</p>
                <Badge color="gray">{inversiones.length}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {inversiones.map(inv => {
                  const isSelected = selected?.id === inv.id
                  return (
                    <div key={inv.id} className="relative group">
                      <button onClick={() => setSelected(inv)}
                        className={`w-full glass-card p-4 transition-all duration-500 text-left relative overflow-hidden ${isSelected ? 'ring-2 ring-inset scale-[1.02]' : 'opacity-60 hover:opacity-100'}`}
                        style={{ borderColor: isSelected ? inv.color : 'var(--border-glass)', ringColor: inv.color }}>
                        <div className="flex items-center gap-4">
                          <div className="text-2xl bg-white/10 w-12 h-12 flex items-center justify-center rounded-2xl shadow-inner">{inv.emoji}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black truncate uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>{inv.nombre}</p>
                            <p className="text-[10px] font-bold opacity-50" style={{ color: 'var(--text-primary)' }}>{formatCurrency(inv.capital)} inicial</p>
                          </div>
                          {isSelected && <ChevronRight size={16} style={{ color: inv.color }} />}
                        </div>
                      </button>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setForm(inv); setEditandoId(inv.id); setModal(true); }} className="p-2 hover:bg-white/20 rounded-full" style={{ color: 'var(--text-primary)' }}><Pencil size={12}/></button>
                        <button onClick={() => eliminar(inv.id)} className="p-2 hover:bg-red-500/10 rounded-full text-red-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* CONTENIDO PRINCIPAL (Desktop: Centro/Derecha) */}
            <div className="lg:col-span-9 space-y-8 order-1 lg:order-2">
              {selected && calc ? (
                <>
                  {/* METRICAS CLAVE */}
                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    <SummaryCard label="Inversión Hoy" value={formatCurrency(selected.invertido_real || 0)} icon={<Wallet size={18}/>} color="var(--accent-blue)" subtext="Saldo Actual" />
                    <SummaryCard label="Valor Final" value={formatCurrency(calc.finalBalance)} icon={<TrendingUp size={18}/>} color={selected.color} subtext={`En ${selected.anos} años`} />
                    <SummaryCard label="Tu Esfuerzo" value={formatCurrency(calc.totalContributed)} icon={<Plus size={18}/>} color="var(--text-muted)" subtext="Total aportado" />
                    <SummaryCard label="Interés Neto" value={formatCurrency(calc.totalInterest)} icon={<Target size={18}/>} color="var(--accent-terra)" subtext="Ganancia pura" />
                  </div>

                  {/* GRÁFICO DE CRECIMIENTO */}
                  <Card className="p-6 md:p-10 border-none shadow-xl relative overflow-hidden group">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{selected.emoji}</span>
                          <h3 className="text-2xl font-black tracking-tighter uppercase" style={{ color: 'var(--text-primary)' }}>{selected.nombre}</h3>
                        </div>
                        <p className="text-xs font-bold opacity-40 uppercase tracking-[0.2em]">Crecimiento Compuesto Estancado al {selected.tasa}%</p>
                      </div>
                      <div className="flex items-center gap-6 bg-[var(--bg-secondary)] py-3 px-6 rounded-3xl">
                        <div className="text-center">
                          <p className="text-[9px] font-black opacity-40 uppercase mb-1">Potencial</p>
                          <p className="text-xl font-black" style={{ color: selected.color }}>x{(calc.finalBalance / (selected.capital || 1)).toFixed(1)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="h-[350px] md:h-[450px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={calc.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={selected.color} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-glass)" opacity={0.5} />
                          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 700 }} tickFormatter={v => `Año ${v}`} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickFormatter={v => `$${v/1000}k`} />
                          <Tooltip content={<CustomTooltip />} cursor={{ stroke: selected.color, strokeWidth: 2, strokeDasharray: '6 6' }} />
                          <Area name="balance" type="monotone" dataKey="balance" stroke={selected.color} strokeWidth={4} fill="url(#colorInv)" animationDuration={2000} />
                          <Area name="contributed" type="monotone" dataKey="contributed" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="8 4" fill="transparent" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* SECCIÓN ANALÍTICA DE RETIRO */}
                  {presupuesto && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-card p-8 border-none shadow-lg flex flex-col justify-between" style={{ background: 'var(--bg-card)' }}>
                        <div>
                          <p className="ff-label">Meta de Libertad Financiera</p>
                          <h4 className="text-4xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>{formatCurrency(presupuesto.total * 12 * 25)}</h4>
                          <p className="text-[10px] font-bold opacity-50 mt-2 uppercase">Basado en gastos de {formatCurrency(presupuesto.total)}/mes</p>
                        </div>
                        <div className="mt-8">
                          <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                             <span style={{ color: 'var(--text-muted)' }}>Progreso Meta</span>
                             <span style={{ color: 'var(--accent-green)' }}>{Math.min((calc.finalBalance / (presupuesto.total * 12 * 25)) * 100, 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-[var(--bg-secondary)] h-3 rounded-full overflow-hidden shadow-inner">
                            <div className="h-full transition-all duration-[2s] ease-out shadow-lg" 
                              style={{ background: 'var(--accent-green)', width: `${Math.min((calc.finalBalance / (presupuesto.total * 12 * 25)) * 100, 100)}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="p-8 rounded-[32px] flex flex-col justify-center border-none shadow-2xl relative overflow-hidden" 
                        style={{ background: 'var(--accent-green)', color: 'white' }}>
                        <div className="absolute -right-10 -bottom-10 opacity-10 rotate-12"><Target size={200} /></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-4 text-white">Estrategia de Salida</p>
                        <p className="text-2xl font-medium leading-tight text-white/90 italic">
                          "Al alcanzar tu meta, podrías retirar <span className="text-white font-black underline decoration-white/30">{formatCurrency(calc.finalBalance * 0.04 / 12)}</span> al mes sin que tu dinero se agote nunca."
                        </p>
                        <div className="mt-6 flex items-center gap-2 text-white/60">
                           <Info size={14} />
                           <p className="text-[9px] font-bold uppercase tracking-widest">Aplicando la Regla del 4% Anual</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-[600px] flex flex-col items-center justify-center opacity-20 text-center">
                  <TrendingUp size={80} className="mb-4" />
                  <p className="text-xl font-black uppercase tracking-[0.2em]">Selecciona una cartera para proyectar</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL PARA CREAR/EDITAR */}
      <Modal open={modal} onClose={() => setModal(false)} title={editandoId ? "Editar Estrategia" : "Nueva Estrategia de Inversión"}>
        <form onSubmit={handleSave} className="space-y-6 py-2">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1">
              <label className="ff-label italic">Emoji</label>
              <input className="ff-input text-center text-2xl h-14" value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre de la Cartera</label>
              <input className="ff-input h-14" placeholder="Ej: S&P 500, Dividendos..." required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label !text-[var(--accent-blue)] font-black">Capital Invertido Real</label>
              <input className="ff-input h-12 border-[var(--accent-blue)]/30" type="number" step="0.01" placeholder="¿Cuánto hay hoy?" value={form.invertido_real} onChange={e => setForm({ ...form, invertido_real: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">Capital Inicial (Cálculo)</label>
              <input className="ff-input h-12" type="number" step="0.01" required value={form.capital} onChange={e => setForm({ ...form, capital: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Aporte Mensual</label>
              <input className="ff-input h-12" type="number" step="0.01" required value={form.aporte} onChange={e => setForm({ ...form, aporte: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">Tasa Anual (%)</label>
              <input className="ff-input h-12" type="number" step="0.1" required value={form.tasa} onChange={e => setForm({ ...form, tasa: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Plazo (Años)</label>
              <input className="ff-input h-12" type="number" required value={form.anos} onChange={e => setForm({ ...form, anos: e.target.value })} />
            </div>
            <div>
              <label className="ff-label">Color Visual</label>
              <input className="w-full h-12 rounded-xl cursor-pointer border-none" type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>

          <button type="submit" disabled={saving} className="ff-btn-primary w-full py-5 text-xs font-black uppercase tracking-[0.2em] shadow-xl">
            {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : (editandoId ? 'Guardar Cambios' : 'Lanzar Inversión')}
          </button>
        </form>
      </Modal>
    </AppShell>
  )
}