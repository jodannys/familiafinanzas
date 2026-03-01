'use client'
import { useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, TrendingUp, Snowflake } from 'lucide-react'
import { formatCurrency, calculateCompoundInterest } from '@/lib/utils'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, Legend
} from 'recharts'

const DEMO = [
  { id:1, nombre:'Fondo Indexado S&P500', capital:5000, aporte:400, tasa:9, años:20, bolaNieve:true,  color:'#10b981', emoji:'📈' },
  { id:2, nombre:'ETF Europa',            capital:2000, aporte:200, tasa:7, años:15, bolaNieve:true,  color:'#38bdf8', emoji:'🌍' },
  { id:3, nombre:'Negocio Familiar',      capital:8000, aporte:0,   tasa:12,años:5,  bolaNieve:false, color:'#f59e0b', emoji:'🏪' },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#111d33', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'10px 14px' }}>
      <p className="text-xs text-slate-400 mb-2">Año {label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-xs font-semibold" style={{ color:p.color }}>
          {p.name === 'contributed' ? 'Aportado' : 'Balance'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function InversionesPage() {
  const [inversiones, setInversiones] = useState(DEMO)
  const [selected, setSelected] = useState(DEMO[0])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ nombre:'', emoji:'📈', capital:'', aporte:'', tasa:'', años:'10', bolaNieve:true, color:'#10b981' })

  const calc = calculateCompoundInterest({
    principal: selected.capital,
    monthlyContribution: selected.aporte,
    annualRate: selected.tasa,
    years: selected.años,
  })

  function handleAdd(e) {
    e.preventDefault()
    const nuevo = {
      ...form,
      id: Date.now(),
      capital: parseFloat(form.capital),
      aporte: parseFloat(form.aporte || 0),
      tasa: parseFloat(form.tasa),
      años: parseInt(form.años),
    }
    setInversiones(prev => [...prev, nuevo])
    setSelected(nuevo)
    setModal(false)
    setForm({ nombre:'', emoji:'📈', capital:'', aporte:'', tasa:'', años:'10', bolaNieve:true, color:'#10b981' })
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-8 animate-enter">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Módulo</p>
          <h1 className="text-3xl font-bold text-white" style={{ letterSpacing:'-0.03em' }}>Inversiones</h1>
        </div>
        <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva inversión
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Lista */}
        <div className="space-y-3">
          {inversiones.map(inv => {
            const c = calculateCompoundInterest({ principal:inv.capital, monthlyContribution:inv.aporte, annualRate:inv.tasa, years:inv.años })
            const isSelected = selected.id === inv.id
            return (
              <div key={inv.id} onClick={() => setSelected(inv)} className="glass-card p-4 cursor-pointer transition-all duration-200 hover:border-white/15"
                style={{ borderColor: isSelected ? `${inv.color}40` : undefined, boxShadow: isSelected ? `0 0 20px ${inv.color}15` : undefined }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{inv.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{inv.nombre}</p>
                    <p className="text-xs text-slate-500">{inv.tasa}% anual · {inv.años} años</p>
                  </div>
                  {inv.bolaNieve && (
                    <div title="Bola de nieve activa" className="w-6 h-6 rounded-full bg-sky-400/10 flex items-center justify-center">
                      <Snowflake size={12} className="text-sky-400" />
                    </div>
                  )}
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Capital inicial: {formatCurrency(inv.capital)}</span>
                  <span className="font-bold" style={{ color:inv.color }}>{formatCurrency(c.finalBalance)}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail & chart */}
        <div className="col-span-2 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label:'Balance final',       value: formatCurrency(calc.finalBalance),   color: selected.color },
              { label:'Total aportado',      value: formatCurrency(calc.totalContributed), color:'#94a3b8' },
              { label:'Ganancias (interés)', value: formatCurrency(calc.totalInterest),  color:'#fbbf24' },
            ].map((s,i) => (
              <div key={i} className="glass-card p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">{s.label}</p>
                <p className="text-xl font-bold" style={{ color:s.color, letterSpacing:'-0.02em' }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-white">{selected.nombre}</h3>
                <p className="text-xs text-slate-500">Proyección a {selected.años} años · {selected.tasa}% anual
                  {selected.bolaNieve && ' · 🌨 Bola de nieve activa'}
                </p>
              </div>
              <Badge color="emerald">×{(calc.finalBalance / selected.capital).toFixed(1)} multiplicador</Badge>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={calc.history} margin={{ top:5, right:5, left:-10, bottom:0 }}>
                <defs>
                  <linearGradient id="gBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={selected.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gContrib" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#475569" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#475569" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" tick={{ fill:'#475569', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`A${v}`} />
                <YAxis tick={{ fill:'#475569', fontSize:11 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="balance"     stroke={selected.color} strokeWidth={2} fill="url(#gBalance)" name="balance" />
                <Area type="monotone" dataKey="contributed" stroke="#475569"        strokeWidth={2} fill="url(#gContrib)" name="contributed" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Year by year table */}
          <Card>
            <h3 className="font-bold text-white mb-4">Tabla año a año</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500 uppercase tracking-wider text-left">
                    <th className="pb-3 font-semibold">Año</th>
                    <th className="pb-3 font-semibold">Aportado</th>
                    <th className="pb-3 font-semibold">Interés</th>
                    <th className="pb-3 font-semibold text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.history.slice(1).map(row => (
                    <tr key={row.year} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                      <td className="py-2.5 text-slate-300 font-semibold">Año {row.year}</td>
                      <td className="py-2.5 text-slate-400">{formatCurrency(row.contributed)}</td>
                      <td className="py-2.5 text-amber-400 font-semibold">+{formatCurrency(row.interest)}</td>
                      <td className="py-2.5 text-right font-bold" style={{ color:selected.color }}>{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Inversión">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={2} value={form.emoji}
                onChange={e => setForm({...form, emoji:e.target.value})} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre</label>
              <input className="ff-input" placeholder="Ej: Fondo Indexado S&P500" required
                value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">Capital inicial (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00" required
                value={form.capital} onChange={e => setForm({...form, capital:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Aportación mensual (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.aporte} onChange={e => setForm({...form, aporte:e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ff-label">% Rendimiento anual estimado</label>
              <input className="ff-input" type="number" min="0.1" max="100" step="0.1" placeholder="8" required
                value={form.tasa} onChange={e => setForm({...form, tasa:e.target.value})} />
            </div>
            <div>
              <label className="ff-label">Proyección (años)</label>
              <input className="ff-input" type="number" min="1" max="50" placeholder="10"
                value={form.años} onChange={e => setForm({...form, años:e.target.value})} />
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background:'rgba(56,189,248,0.06)', border:'1px solid rgba(56,189,248,0.15)' }}>
            <input type="checkbox" id="bolaNieve" checked={form.bolaNieve}
              onChange={e => setForm({...form, bolaNieve:e.target.checked})}
              className="w-4 h-4 accent-sky-400" />
            <label htmlFor="bolaNieve" className="text-sm text-slate-300 cursor-pointer">
              <span className="font-semibold text-white">Activar bola de nieve</span> — las ganancias se reinvierten (interés compuesto)
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" className="ff-btn-primary flex-1">Agregar</button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
