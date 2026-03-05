'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, Badge, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import {
  Plus, Loader2, Trash2, CreditCard, Landmark,
  ChevronDown, ChevronUp, Pencil,
  ArrowDownRight, ArrowUpRight, Calendar, Link2
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

// --- LÓGICA DE CÁLCULO ---
function calcularCuota(capital, tasaAnual, meses) {
  if (!capital || !meses) return 0
  if (!tasaAnual || tasaAnual === 0) return capital / meses
  const r = tasaAnual / 100 / 12
  return (capital * r) / (1 - Math.pow(1 + r, -meses))
}

function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  return diaPago >= hoy ? diaPago - hoy : 30 - hoy + diaPago
}

function urgenciaColor(dias) {
  if (dias === null) return null
  if (dias <= 3) return { bg: 'rgba(192,96,90,0.1)', text: '#C0605A', label: `¡Vence en ${dias}d!` }
  if (dias <= 7) return { bg: 'rgba(193,122,58,0.1)', text: '#C17A3A', label: `Vence en ${dias}d` }
  return { bg: 'rgba(45,122,95,0.1)', text: '#2D7A5F', label: `${dias}d para pago` }
}

const TIPO_CONFIG = {
  tarjeta: { label: 'Tarjeta', icon: CreditCard, color: '#818CF8' },
  prestamo: { label: 'Préstamo', icon: Landmark, color: '#C0605A' },
  cuota: { label: 'Cuota', icon: Calendar, color: '#C17A3A' },
}

function IconBtn({ onClick, title, bg, color, children }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick() }} title={title}
      className="flex items-center justify-center rounded-xl transition-all active:scale-90"
      style={{ background: bg, color, width: 34, height: 34, flexShrink: 0 }}>
      {children}
    </button>
  )
}

const FORM_VACIO = {
  emoji: '💳', nombre: '', tipo_deuda: 'tarjeta', categoria: 'deseo',
  limite: '', capital: '', adelanto: '', tasa_interes: '', plazo_meses: '',
  dia_corte: '', dia_pago: '', color: '#818CF8', de_prestamo_id: null
}

export default function DeudasPage() {
  const [deudas, setDeudas] = useState([])
  const [movimientos, setMovimientos] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [expandido, setExpandido] = useState(null)
  const [cardActiva, setCardActiva] = useState(null)
  const [modalDeuda, setModalDeuda] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [modalMov, setModalMov] = useState(null)
  const [formDeuda, setFormDeuda] = useState(FORM_VACIO)
  const [formMov, setFormMov] = useState({ tipo: 'pago', descripcion: '', monto: '', fecha: new Date().toISOString().slice(0, 10) })
  const [misTarjetas, setMisTarjetas] = useState([])

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const { data: deudasData } = await supabase.from('deudas').select('*').order('created_at')
      const { data: tarjetasData } = await supabase.from('perfiles_tarjetas').select('*').eq('estado', 'activa')
      
      setDeudas(deudasData || [])
      setMisTarjetas(tarjetasData || [])

      if (deudasData?.length) {
        const { data: movs } = await supabase.from('deuda_movimientos').select('*').order('fecha', { ascending: false })
        const grouped = {}
        movs?.forEach(m => {
          if (!grouped[m.deuda_id]) grouped[m.deuda_id] = []
          grouped[m.deuda_id].push(m)
        })
        setMovimientos(grouped)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  // Al seleccionar "Cuota", si elegimos un préstamo, rellenamos datos automáticamente
  function handleVincularPrestamo(prestamoId) {
    const p = deudas.find(d => d.id === prestamoId)
    if (!p) return
    setFormDeuda(prev => ({
      ...prev,
      de_prestamo_id: prestamoId,
      nombre: `Letra: ${p.nombre}`,
      capital: p.cuota || 0,
      emoji: '📅',
      dia_pago: p.dia_pago || ''
    }))
  }

  async function handleSaveDeuda(e) {
    e.preventDefault()
    setSaving(true)
    const capital = parseFloat(formDeuda.capital) || 0
    const adelanto = parseFloat(formDeuda.adelanto) || 0
    const tasa = parseFloat(formDeuda.tasa_interes) || 0
    const meses = parseInt(formDeuda.plazo_meses) || 0
    
    // Si es cuota, el monto es el capital directo. Si es préstamo, calculamos la cuota.
    const cuotaCalculada = formDeuda.tipo_deuda === 'cuota' ? capital : calcularCuota(capital - adelanto, tasa, meses)

    const payload = {
      ...formDeuda,
      limite: parseFloat(formDeuda.limite) || 0,
      capital, adelanto, tasa_interes: tasa,
      plazo_meses: meses,
      cuota: parseFloat(cuotaCalculada.toFixed(2)),
      dia_corte: parseInt(formDeuda.dia_corte) || null,
      dia_pago: parseInt(formDeuda.dia_pago) || null,
    }

    if (editandoId) {
      await supabase.from('deudas').update(payload).eq('id', editandoId)
    } else {
      await supabase.from('deudas').insert([{
        ...payload, pagadas: 0, pendiente: capital - adelanto,
        monto: capital, estado: 'activa',
      }])
    }
    await cargar()
    setSaving(false)
    setModalDeuda(false)
    setFormDeuda(FORM_VACIO)
  }

  async function handleAddMov(e) {
    e.preventDefault()
    setSaving(true)
    const monto = parseFloat(formMov.monto)
    const deuda = deudas.find(d => d.id === modalMov)

    // 1. Insertar movimiento de deuda
    const { data: newMov } = await supabase.from('deuda_movimientos').insert([{
      deuda_id: modalMov, tipo: formMov.tipo,
      descripcion: formMov.descripcion, monto,
      fecha: formMov.fecha, mes, año,
    }]).select()

    if (deuda) {
      let nuevoPendiente = deuda.pendiente || 0
      let nuevosPagados = deuda.pagadas || 0

      if (formMov.tipo === 'pago') {
        nuevoPendiente = Math.max(0, nuevoPendiente - monto)
        nuevosPagados += 1
        
        // Registrar en movimientos globales
        await supabase.from('movimientos').insert([{
          tipo: 'egreso', categoria: 'deuda',
          descripcion: `${deuda.nombre}`, monto,
          fecha: formMov.fecha, quien: 'Ambos'
        }])

        // LÓGICA ESPECIAL: Si es una cuota vinculada a un préstamo (Carro, Hipoteca)
        if (deuda.de_prestamo_id) {
          const prestamoPadre = deudas.find(p => p.id === deuda.de_prestamo_id)
          if (prestamoPadre) {
            await supabase.from('deudas').update({
              pendiente: Math.max(0, prestamoPadre.pendiente - monto)
            }).eq('id', prestamoPadre.id)
          }
        }
      }

      await supabase.from('deudas').update({
        pendiente: nuevoPendiente,
        pagadas: nuevosPagados,
        estado: nuevoPendiente <= 0 ? 'pagada' : 'activa'
      }).eq('id', modalMov)
    }

    await cargar()
    setSaving(false)
    setModalMov(null)
  }

  const totalDeuda = deudas.filter(d => d.tipo_deuda !== 'cuota' && d.estado !== 'pagada').reduce((s, d) => s + (d.pendiente || 0), 0)
  const cuotasMes = deudas.reduce((s, d) => s + (d.cuota || 0), 0)

  return (
    <AppShell>
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold mb-0.5">Control Financiero</p>
          <h1 className="text-xl font-black text-stone-800 tracking-tight truncate">Deudas y Cuotas</h1>
        </div>
        <button onClick={() => { setEditandoId(null); setFormDeuda(FORM_VACIO); setModalDeuda(true) }}
          className="ff-btn-primary flex items-center gap-2">
          <Plus size={16} strokeWidth={3} />
          <span className="text-sm font-bold">Añadir</span>
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="glass-card p-4 border-l-4 border-red-400">
          <p className="text-[10px] text-stone-400 uppercase font-black mb-1">Total por pagar</p>
          <p className="text-lg font-black text-stone-800 tabular-nums">{formatCurrency(totalDeuda)}</p>
        </div>
        <div className="glass-card p-4 border-l-4 border-amber-400">
          <p className="text-[10px] text-stone-400 uppercase font-black mb-1">Carga mensual</p>
          <p className="text-lg font-black text-stone-800 tabular-nums">{formatCurrency(cuotasMes)}</p>
        </div>
      </div>

      {/* LISTADO */}
      <div className="space-y-3">
        {deudas.map((d, i) => {
          const cfg = TIPO_CONFIG[d.tipo_deuda] || TIPO_CONFIG.tarjeta
          const pct = d.monto > 0 ? Math.min(100, Math.round(((d.monto - (d.pendiente || 0)) / d.monto) * 100)) : 0
          const urgencia = urgenciaColor(diasHastaPago(d.dia_pago))
          const isActiva = cardActiva === d.id

          return (
            <Card key={d.id} className="animate-enter relative overflow-hidden" 
              style={{ animationDelay: `${i * 0.05}s`, padding: '16px' }}
              onClick={() => setCardActiva(isActiva ? null : d.id)}>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl"
                  style={{ background: `${d.color}15` }}>{d.emoji}</div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-stone-800 text-sm truncate">{d.nombre}</p>
                    {d.de_prestamo_id && <Link2 size={12} className="text-stone-400" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md"
                      style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                    {urgencia && <span className="text-[9px] font-bold" style={{ color: urgencia.text }}>{urgencia.label}</span>}
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-black text-stone-800 tabular-nums">{formatCurrency(d.pendiente)}</p>
                  <p className="text-[10px] text-stone-400 uppercase font-bold">restante</p>
                </div>
              </div>

              {/* BARRA DE PROGRESO (Solo para Préstamos/Tarjetas) */}
              {d.tipo_deuda !== 'cuota' && (
                <div className="mt-4">
                  <div className="flex justify-between text-[9px] font-black uppercase text-stone-400 mb-1">
                    <span>Progreso del pago</span>
                    <span>{pct}%</span>
                  </div>
                  <ProgressBar value={d.monto - d.pendiente} max={d.monto} color={d.color} />
                </div>
              )}

              {/* ACCIONES EXPANDIDAS */}
              <div className={`overflow-hidden transition-all duration-300 ${isActiva ? 'max-h-40 mt-4 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="flex gap-2 pt-3 border-t border-stone-100">
                  <button onClick={() => { setModalMov(d.id); setFormMov(p => ({ ...p, tipo: 'pago', monto: d.cuota || '' })) }}
                    className="flex-1 ff-btn-primary py-2 text-xs flex items-center justify-center gap-2"
                    style={{ background: '#10b981' }}>
                    <ArrowUpRight size={14} /> Pagar Letra
                  </button>
                  <IconBtn onClick={() => setModalMov(d.id)} bg="#f5f5f5" color="#78716c"><ArrowDownRight size={14}/></IconBtn>
                  <IconBtn onClick={() => { setEditandoId(d.id); setModalDeuda(true); setFormDeuda(d) }} bg="#f5f5f5" color="#78716c"><Pencil size={14}/></IconBtn>
                  <IconBtn onClick={() => {if(confirm('¿Eliminar?')) supabase.from('deudas').delete().eq('id', d.id).then(cargar)}} bg="rgba(192,96,90,0.1)" color="#C0605A"><Trash2 size={14}/></IconBtn>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* MODAL DEUDA (CON LÓGICA DE VINCULACIÓN) */}
      <Modal open={modalDeuda} onClose={() => setModalDeuda(false)} title={editandoId ? 'Editar' : 'Nueva'}>
        <form onSubmit={handleSaveDeuda} className="space-y-4">
          <div className="grid grid-cols-3 gap-2 p-1 bg-stone-100 rounded-2xl">
            {Object.entries(TIPO_CONFIG).map(([key, cfg]) => (
              <button type="button" key={key} onClick={() => setFormDeuda(p => ({ ...p, tipo_deuda: key }))}
                className={`py-2 rounded-xl text-[10px] font-black uppercase transition-all ${formDeuda.tipo_deuda === key ? 'bg-white shadow-sm' : 'opacity-50'}`}
                style={{ color: cfg.color }}>{cfg.label}</button>
            ))}
          </div>

          {/* Si es cuota, mostramos selector de préstamos para vincular */}
          {formDeuda.tipo_deuda === 'cuota' && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
              <label className="ff-label text-amber-700">Vincular a préstamo existente:</label>
              <select className="ff-input mt-1 bg-white" onChange={(e) => handleVincularPrestamo(e.target.value)}>
                <option value="">-- No vincular --</option>
                {deudas.filter(d => d.tipo_deuda === 'prestamo').map(p => (
                  <option key={p.id} value={p.id}>{p.nombre} (Debe: {formatCurrency(p.pendiente)})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <input className="ff-input text-center text-xl" value={formDeuda.emoji} onChange={e => setFormDeuda(p => ({ ...p, emoji: e.target.value }))} />
            <input className="ff-input col-span-3" placeholder="Nombre (Ej: Hipoteca, Carro...)" required
              value={formDeuda.nombre} onChange={e => setFormDeuda(p => ({ ...p, nombre: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Monto / Capital (€)</label>
              <input className="ff-input" type="number" required value={formDeuda.capital} onChange={e => setFormDeuda(p => ({ ...p, capital: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Día de Pago</label>
              <input className="ff-input" type="number" value={formDeuda.dia_pago} onChange={e => setFormDeuda(p => ({ ...p, dia_pago: e.target.value }))} />
            </div>
          </div>

          <button type="submit" className="ff-btn-primary w-full py-3" disabled={saving}>
            {saving ? <Loader2 className="animate-spin mx-auto" /> : 'Guardar Deuda'}
          </button>
        </form>
      </Modal>

      {/* MODAL MOVIMIENTO */}
      <Modal open={!!modalMov} onClose={() => setModalMov(null)} title="Registrar Movimiento">
        <form onSubmit={handleAddMov} className="space-y-4">
          <input className="ff-input text-2xl font-black text-center" type="number" step="0.01" required
            value={formMov.monto} onChange={e => setFormMov(p => ({ ...p, monto: e.target.value }))} />
          <input className="ff-input" placeholder="Descripción" required
            value={formMov.descripcion} onChange={e => setFormMov(p => ({ ...p, descripcion: e.target.value }))} />
          <button type="submit" className="ff-btn-primary w-full" style={{ background: '#10b981' }}>Confirmar</button>
        </form>
      </Modal>
    </AppShell>
  )
}