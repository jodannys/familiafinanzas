'use client'
import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { Loader2, X, Plus, ArrowUpRight, ArrowDownRight, LogOut, Check, CreditCard, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { supabase, signOut } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { getPresupuestoMes } from '@/lib/presupuesto'

// ── Toast System ─────────────────────────────────────────────────────────────
function ToastDisplay() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function handler(e) {
      const { msg, type } = e.detail
      const id = Date.now() + Math.random()
      setToasts(p => [...p, { id, msg, type }])
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500)
    }
    window.addEventListener('ff-toast', handler)
    return () => window.removeEventListener('ff-toast', handler)
  }, [])

  // ... resto del componente ToastDisplay (COLORS, return, etc.)

  const COLORS = {
    error:   { bg: 'color-mix(in srgb, var(--accent-rose)  12%, var(--bg-card))', border: 'color-mix(in srgb, var(--accent-rose)  35%, transparent)', text: 'var(--accent-rose)',  Icon: AlertCircle },
    success: { bg: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-card))', border: 'color-mix(in srgb, var(--accent-green) 35%, transparent)', text: 'var(--accent-green)', Icon: CheckCircle },
    warning: { bg: 'color-mix(in srgb, var(--accent-terra) 12%, var(--bg-card))', border: 'color-mix(in srgb, var(--accent-terra) 35%, transparent)', text: 'var(--accent-terra)', Icon: Info },
  }

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 left-0 right-0 z-[999] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {toasts.map(t => {
        const c = COLORS[t.type] || COLORS.error
        return (
          <div key={t.id}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg animate-enter pointer-events-auto"
            style={{ background: c.bg, border: `1px solid ${c.border}`, maxWidth: 380, width: '100%' }}>
            <c.Icon size={16} style={{ color: c.text, flexShrink: 0 }} />
            <p className="text-xs font-semibold flex-1" style={{ color: c.text }}>{t.msg}</p>
          </div>
        )
      })}
    </div>
  )
}

const CATS_EGRESO = [
  { id: 'basicos', label: 'Básicos', color: 'var(--accent-blue)' },
  { id: 'deseo', label: 'Estilo de vida', color: 'var(--accent-violet)' },
  { id: 'ahorro', label: 'Ahorro', color: 'var(--accent-green)' },
  { id: 'inversion', label: 'Inversión', color: 'var(--accent-gold)' },
  { id: 'deuda', label: 'Deuda', color: 'var(--accent-rose)' },
]

const SPECIAL_CATS = ['ahorro', 'inversion', 'deuda']

function calcFechaPrimerPago(fechaCompra, diaPago, diaCorte) {
  if (!diaPago) return fechaCompra
  const [y, m, d] = fechaCompra.split('-').map(Number)
  const corte = diaCorte || diaPago
  if (d <= corte) {
    return `${y}-${String(m).padStart(2, '0')}-${String(diaPago).padStart(2, '0')}`
  } else {
    const nextM = m === 12 ? 1 : m + 1
    const nextY = m === 12 ? y + 1 : y
    return `${nextY}-${String(nextM).padStart(2, '0')}-${String(diaPago).padStart(2, '0')}`
  }
}

const METODOS_PAGO = [
  { id: 'efectivo', short: 'EF', label: 'Efectivo', color: 'var(--accent-green)' },
  { id: 'transferencia', short: 'TR', label: 'Transf.', color: 'var(--accent-blue)' },
  { id: 'debito', short: 'DB', label: 'Débito', color: 'var(--accent-violet)' },
  { id: 'tarjeta_credito', short: 'TC', label: 'T. Crédito', color: 'var(--accent-rose)' },
]

const CAT_BLOQUE = { basicos: 'necesidades', deuda: 'necesidades', deseo: 'estilo', ahorro: 'futuro', inversion: 'futuro' }

function FABModal({ onClose }) {
  const [step, setStep] = useState(1)
  const [tipo, setTipo] = useState('egreso')
  const [monto, setMonto] = useState('')
  const [cat, setCat] = useState(null)
  const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [loadingItems, setLoadingItems] = useState(false)
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [perfilesTarj, setPerfilesTarj] = useState([])
  const [selectedPerfil, setSelectedPerfil] = useState(null)
  const [numCuotas, setNumCuotas] = useState('')
  const [loadingPerf, setLoadingPerf] = useState(false)
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [quien, setQuien] = useState('Jodannys')
  const [subcats, setSubcats] = useState([])
  const [selectedSubcat, setSelectedSubcat] = useState(null)
  const [montoMetasDisponible, setMontoMetasDisponible] = useState(0)

  useEffect(() => {
    if (metodoPago !== 'tarjeta_credito' || tipo !== 'egreso' || !cat) {
      setPerfilesTarj([]); setSelectedPerfil(null); return
    }
    setLoadingPerf(true)
    supabase.from('perfiles_tarjetas')
      .select('id,nombre_tarjeta,banco,color,dia_pago,dia_corte,limite_credito')
      .eq('estado', 'activa')
      .then(({ data }) => {
        setPerfilesTarj(data || [])
        if (data?.length === 1) setSelectedPerfil(data[0])
        setLoadingPerf(false)
      })
  }, [metodoPago, tipo])

 // DENTRO DE FABModal
useEffect(() => {
  // 1. LIMPIEZA AUTOMÁTICA
  setMonto('') 
  setSelectedItem(null)

  // 2. Lógica de carga para categorías especiales
  if (!cat || !SPECIAL_CATS.includes(cat) || tipo !== 'egreso') {
    setItems([])
    return
  }

  setLoadingItems(true)
  
  const fetchItems =
    cat === 'ahorro' ? supabase.from('metas').select('id,nombre,emoji,meta,actual,pct_mensual').eq('estado', 'activa')
      : cat === 'inversion' ? supabase.from('inversiones').select('id,nombre,emoji,capital,aporte')
        : supabase.from('deudas').select('id,nombre,emoji,cuota,pendiente,pagadas').eq('estado', 'activa').neq('tipo', 'medeben').neq('tipo_deuda', 'tarjeta')

  if (cat === 'ahorro') {
    Promise.all([fetchItems, getPresupuestoMes()]).then(([{ data }, presupuesto]) => {
      setItems(data || [])
      setMontoMetasDisponible(presupuesto?.montoMetas || 0)
      setLoadingItems(false)
    })
  } else {
    fetchItems.then(({ data }) => { 
      setItems(data || [])
      setLoadingItems(false) 
    })
  }
}, [cat, tipo]) // Este trigger asegura que al cambiar de pestaña el monto se borre

  // ── ESTE ES EL USEEFFECT OPTIMIZADO PARA LAS SUBCATEGORÍAS ──
  useEffect(() => {
    if (tipo !== 'egreso' || !cat || SPECIAL_CATS.includes(cat)) {
      setSubcats([]); setSelectedSubcat(null); return
    }
    
    supabase.from('subcategorias')
      .select('id,nombre')
      .eq('categoria_id', cat)
      .order('orden')
      .order('nombre')
      .then(({ data }) => {
        setSubcats(data || [])
        setSelectedSubcat(null)
      })
  }, [cat, tipo])

  async function guardar() {
    const valor = parseFloat(monto)
    if (!valor || valor <= 0) return
    const esTarjeta = tipo === 'egreso' && metodoPago === 'tarjeta_credito'
    if (esTarjeta && !selectedPerfil) { toast('Selecciona una tarjeta de crédito', 'warning'); return }
    const cuotas = parseInt(numCuotas)
    if (esTarjeta && (!cuotas || cuotas < 1)) { toast('Ingresa el número de cuotas', 'warning'); return }
    setSaving(true)
    const catFinal = cat || 'basicos'
    const catLabel = CATS_EGRESO.find(c => c.id === catFinal)?.label || catFinal
    const [fechaYear, fechaMes] = fecha.split('-').map(Number)
    const descFinal = desc.trim() || (selectedItem ? selectedItem.nombre : catLabel)

    // Compra con TC: solo crear deuda, sin movimiento inmediato
    if (esTarjeta && selectedPerfil) {
      const cuotaMensual = parseFloat((valor / cuotas).toFixed(2))
      const { error: tcError } = await supabase.from('deudas').insert([{
        tipo_deuda: 'tarjeta', tipo: 'debo', emoji: '💳',
        nombre: descFinal, categoria: cat,
        capital: valor, monto: valor, pendiente: valor,
        cuota: cuotaMensual, plazo_meses: cuotas, pagadas: 0,
        estado: 'activa', perfil_tarjeta_id: selectedPerfil.id,
        dia_pago: selectedPerfil.dia_pago || null,
        fecha_primer_pago: calcFechaPrimerPago(fecha, selectedPerfil.dia_pago, selectedPerfil.dia_corte),
        color: selectedPerfil.color || '#A44A3F',
        tasa: 0, tasa_interes: 0,
      }])
      setSaving(false)
      if (tcError) { toast('Error al registrar la compra: ' + tcError.message); return }
      toast(`Compra registrada · ${cuotas === 1 ? 'Pago único' : `${cuotas}x de ${formatCurrency(cuotaMensual)}`}`, 'success')
      onClose()
      window.location.reload()
      return
    }

    const { data: movData, error } = await supabase.from('movimientos').insert([{
      tipo, monto: valor, descripcion: descFinal,
      categoria: tipo === 'ingreso' ? 'ingreso' : catFinal,
      fecha,
      metodo_pago: tipo === 'egreso' ? metodoPago : 'transferencia',
      quien,
      ...(selectedSubcat && { subcategoria_id: selectedSubcat.id }),
      ...(tipo === 'egreso' && catFinal === 'deuda' && selectedItem && { deuda_id: selectedItem.id }),
    }]).select()
    if (error) { toast('Error: ' + error.message); setSaving(false); return }

    if (tipo === 'egreso' && selectedItem) {
      if (catFinal === 'ahorro') {
        const { error: metaErr } = await supabase.from('metas').update({ actual: (selectedItem.actual || 0) + valor }).eq('id', selectedItem.id)
        if (metaErr) { toast('Error al actualizar la meta: ' + metaErr.message); setSaving(false); return }
      } else if (catFinal === 'inversion') {
        const { error: invErr } = await supabase.from('inversiones').update({ capital: (selectedItem.capital || 0) + valor }).eq('id', selectedItem.id)
        if (invErr) { toast('Error al actualizar la inversión: ' + invErr.message); setSaving(false); return }
      } else if (catFinal === 'deuda') {
        const { data: dmData, error: dmErr } = await supabase.from('deuda_movimientos').insert([{
          deuda_id: selectedItem.id, tipo: 'pago',
          descripcion: descFinal || `Pago ${selectedItem.nombre}`,
          monto: valor, fecha,
          mes: fechaMes, año: fechaYear,
        }]).select()
        if (dmErr) { toast('Error al registrar el pago: ' + dmErr.message); setSaving(false); return }
        // Vincular deuda_movimiento_id al movimiento para poder revertir limpiamente
        if (dmData?.[0]?.id && movData?.[0]?.id) {
          await supabase.from('movimientos')
            .update({ deuda_movimiento_id: dmData[0].id })
            .eq('id', movData[0].id)
        }
        const nuevoPendiente = Math.max(0, parseFloat(selectedItem.pendiente || 0) - valor)
        const { error: deudaErr } = await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          pagadas: (selectedItem.pagadas || 0) + 1,
          estado: nuevoPendiente <= 0 ? 'pagada' : 'activa',
        }).eq('id', selectedItem.id)
        if (deudaErr) { toast('Error al actualizar la deuda: ' + deudaErr.message); setSaving(false); return }
      }
    }

    toast(tipo === 'ingreso' ? 'Ingreso registrado' : 'Gasto registrado', 'success')
    setSaving(false)
    onClose()
    window.location.reload()
  }

  const catInfo = cat ? CATS_EGRESO.find(c => c.id === cat) : null

  return (
    <>
      <div className="fixed inset-0 z-[110]"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)' }}
        onClick={onClose} />

      <div className="fixed bottom-0 left-0 right-0 z-[120] rounded-t-[32px] flex flex-col shadow-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid var(--border-glass)',
          borderBottom: 'none',
          maxHeight: '92vh',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        }}>

        {/* Handle superior */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full opacity-20" style={{ background: 'var(--text-primary)' }} />
        </div>

        {/* Cabecera */}
        <div className="px-6 pb-4 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            {step === 1 ? (
              <>
                <p className="font-script text-[32px] mb-1" style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}>Registrar</p>
                <p className="text-[9px] uppercase tracking-[0.2em] opacity-40 font-black" style={{ marginLeft: '2px' }}>¿Qué tipo de movimiento?</p>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => setStep(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: 'none', fontSize: 18 }}>
                  ‹
                </button>
                <div>
                  <p className="font-script text-[28px]" style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}>
                    {tipo === 'ingreso' ? 'Ingreso' : catInfo?.label || 'Gasto'}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.2em] opacity-40 font-black" style={{ marginLeft: '2px' }}>Detalle del movimiento</p>
                </div>
              </div>
            )}
          </div>

          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: 'none' }}>
            <X size={20} />
          </button>
        </div>

        {/* ── PASO 1: Tipo + Categoría ── */}
        {step === 1 && (
          <div className="px-6 pb-4 space-y-5 overflow-y-auto flex-1 no-scrollbar">

            {/* Selector Gasto / Ingreso */}
            <div className="flex p-1 rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
              {[
                { id: 'egreso', label: 'Gasto', icon: ArrowDownRight, color: 'var(--accent-rose)' },
                { id: 'ingreso', label: 'Ingreso', icon: ArrowUpRight, color: 'var(--accent-green)' },
              ].map(t => (
                <button key={t.id}
                  onClick={() => { setTipo(t.id); setCat(null); setSelectedItem(null); setMetodoPago('efectivo'); setNumCuotas(1); setSelectedPerfil(null); if (t.id === 'ingreso') setStep(2) }}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[12px] font-bold text-[13px] transition-all"
                  style={{
                    background: tipo === t.id ? 'var(--bg-card)' : 'transparent',
                    color: tipo === t.id ? t.color : 'var(--text-muted)',
                    boxShadow: tipo === t.id ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                  }}>
                  <t.icon size={14} strokeWidth={2.5} /> {t.label}
                </button>
              ))}
            </div>

            {/* Categorías grandes (solo gasto) */}
            {tipo === 'egreso' && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Categoría</p>
                <div className="grid grid-cols-1 gap-2">
                  {CATS_EGRESO.map(c => (
                    <button key={c.id}
                      onClick={() => { setCat(c.id); setSelectedItem(null); setSelectedSubcat(null); setStep(2) }}
                      className="flex items-center gap-4 px-4 py-3.5 rounded-2xl font-bold text-[13px] transition-all active:scale-[0.98] border"
                      style={{
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        borderColor: 'var(--border-glass)',
                      }}>
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="flex-1 text-left">{c.label}</span>
                      <span className="opacity-30 text-base">›</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── PASO 2: Detalles ── */}
        {step === 2 && (
          <div className="px-6 space-y-4 pt-1 overflow-y-auto flex-1 no-scrollbar pb-2">

            {/* Monto */}
            <div className="flex items-center justify-center gap-2 py-4">
              <span className="text-3xl font-serif opacity-25">€</span>
              <input type="number" inputMode="decimal" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)}
                autoFocus className="bg-transparent border-none outline-none text-5xl font-serif font-bold text-center"
                style={{ color: tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--text-primary)', width: 220 }} />
            </div>

            {/* Subcategorías */}
            {tipo === 'egreso' && subcats.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {subcats.map(s => (
                  <button key={s.id} onClick={() => setSelectedSubcat(selectedSubcat?.id === s.id ? null : s)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border"
                    style={{
                      background: selectedSubcat?.id === s.id ? 'var(--accent-main)' : 'transparent',
                      color: selectedSubcat?.id === s.id ? 'white' : 'var(--text-muted)',
                      borderColor: selectedSubcat?.id === s.id ? 'transparent' : 'var(--border-glass)',
                    }}>{s.nombre}</button>
                ))}
              </div>
            )}

            {/* Vínculo a Metas/Inversiones/Deudas */}
            {tipo === 'egreso' && cat && SPECIAL_CATS.includes(cat) && (loadingItems || items.length > 0) && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-0.5">{cat === 'ahorro' ? 'Meta' : cat === 'inversion' ? 'Inversión' : 'Deuda'}</p>
                {loadingItems ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin opacity-30" /></div>
                ) : (
                  <div className="grid gap-1.5">
                    {items.map(item => {
                      const isSelected = selectedItem?.id === item.id
                      const color = cat === 'ahorro' ? 'var(--accent-green)' : cat === 'inversion' ? 'var(--accent-violet)' : 'var(--accent-rose)'
                      return (
                        <button key={item.id}
                          onClick={() => {
                            setSelectedItem(isSelected ? null : item)
                            if (!isSelected) {
                              if (cat === 'deuda' && item.cuota > 0) setMonto(item.cuota.toString())
                              else if (cat === 'inversion' && item.aporte > 0) setMonto(item.aporte.toString())
                              else if (cat === 'ahorro' && item.pct_mensual > 0 && montoMetasDisponible > 0) {
                                const aporte = parseFloat(((item.pct_mensual / 100) * montoMetasDisponible).toFixed(2))
                                setMonto(aporte.toString())
                              }
                            }
                          }}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all border"
                          style={{
                            background: isSelected ? 'var(--bg-card)' : 'transparent',
                            borderColor: isSelected ? color : 'var(--border-glass)'
                          }}>
                          <span className="text-sm">{item.emoji}</span>
                          <div className="flex-1 text-left">
                            <p className="text-[11px] font-bold">{item.nombre}</p>
                            <p className="text-[9px] opacity-40">{cat === 'deuda' ? `Pendiente: ${formatCurrency(item.pendiente)}` : cat === 'inversion' ? `Capital: ${formatCurrency(item.capital || 0)}` : item.pct_mensual > 0 && montoMetasDisponible > 0 ? `Aporte: ${formatCurrency((item.pct_mensual / 100) * montoMetasDisponible)}/mes` : `Meta: ${formatCurrency(item.meta || 0)}`}</p>
                          </div>
                          {isSelected && <Check size={14} style={{ color }} />}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Fila: Fecha · Quién · Método */}
            <div className="flex items-center gap-2 flex-wrap">
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="ff-input !py-2 !text-[11px] !rounded-xl" style={{ flex: '1 1 120px' }} />
              <div className="flex p-0.5 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', flex: '1 1 100px' }}>
                {['Jodannys', 'Ambos'].map(q => (
                  <button key={q} onClick={() => setQuien(q)}
                    className="flex-1 py-1.5 rounded-[10px] text-[10px] font-bold transition-all"
                    style={{
                      background: quien === q ? 'var(--bg-card)' : 'transparent',
                      color: quien === q ? 'var(--accent-main)' : 'var(--text-muted)',
                    }}>{q}</button>
                ))}
              </div>
            </div>

            {/* Métodos de Pago */}
            {tipo === 'egreso' && (
              <>
                <div className="grid grid-cols-4 gap-2">
                  {METODOS_PAGO.map(m => {
                    const sel = metodoPago === m.id
                    return (
                      <button key={m.id} onClick={() => { setMetodoPago(m.id); setSelectedPerfil(null); setNumCuotas(1) }}
                        className="py-2 rounded-xl text-[10px] font-black transition-all border"
                        style={{
                          background: sel ? 'var(--bg-card)' : 'transparent',
                          color: sel ? m.color : 'var(--text-muted)',
                          borderColor: sel ? m.color : 'var(--border-glass)'
                        }}>{m.short}</button>
                    )
                  })}
                </div>

                {metodoPago === 'tarjeta_credito' && (
                  <div className="p-3 rounded-2xl space-y-2 border border-dashed" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-glass)' }}>
                    {loadingPerf ? (
                      <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin opacity-30" /></div>
                    ) : perfilesTarj.length === 0 ? (
                      <p className="text-[10px] text-center opacity-40 py-2">Sin tarjetas · Ve a Deudas → Mis Tarjetas</p>
                    ) : perfilesTarj.map(t => {
                        const isSel = selectedPerfil?.id === t.id
                        return (
                          <button key={t.id} onClick={() => setSelectedPerfil(isSel ? null : t)}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all"
                            style={{ background: isSel ? 'var(--bg-card)' : 'transparent', border: isSel ? '1px solid var(--accent-rose)' : '1px solid transparent' }}>
                            <CreditCard size={14} style={{ color: isSel ? 'var(--accent-rose)' : 'var(--text-muted)' }} />
                            <div className="flex-1 text-left">
                              <p className="text-[11px] font-bold">{t.nombre_tarjeta}</p>
                              <p className="text-[9px] opacity-40">{t.banco || 'Tarjeta'}</p>
                            </div>
                            {isSel && <Check size={14} className="text-[var(--accent-rose)]" />}
                          </button>
                        )
                      })}
                    {selectedPerfil && (
                      <div className="flex items-center gap-3 pt-2 px-1 border-t border-white/5">
                        <p className="text-[9px] font-bold opacity-40">CUOTAS:</p>
                        <input type="number" min="1" value={numCuotas} onChange={e => setNumCuotas(Math.max(1, parseInt(e.target.value) || 1))}
                          className="bg-black/10 rounded-lg text-center font-bold text-xs p-1" style={{ width: 45, color: 'var(--accent-rose)', border: 'none' }} />
                        <p className="text-[9px] opacity-60 font-medium">{numCuotas > 1 ? `${numCuotas}x ${formatCurrency(parseFloat(monto || 0) / numCuotas)}` : 'Pago único'}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Descripción */}
            <input type="text" placeholder="Descripción (opcional)..." value={desc} onChange={e => setDesc(e.target.value)}
              className="ff-input !py-2.5 !text-xs !rounded-xl w-full" />

            {/* Botón Guardar */}
            <button
              onClick={guardar}
              disabled={!monto || parseFloat(monto) <= 0 || saving}
              className="w-full py-4 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all active:scale-[0.97] shadow-xl"
              style={{
                background: (!monto || parseFloat(monto) <= 0)
                  ? 'var(--bg-secondary)'
                  : tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--accent-main)',
                color: (!monto || parseFloat(monto) <= 0) ? 'var(--text-muted)' : '#fff',
              }}>
              {saving ? <Loader2 size={18} className="animate-spin" /> : (
                <>
                  {tipo === 'egreso' && metodoPago === 'tarjeta_credito' ? <CreditCard size={16} /> : <Plus size={16} />}
                  <span>{tipo === 'egreso' && metodoPago === 'tarjeta_credito' ? 'Registrar en cuotas' : tipo === 'ingreso' ? 'Confirmar Ingreso' : 'Confirmar Gasto'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function AppShell({ children }) {
  const [fabOpen, setFabOpen] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [navigating, setNavigating] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
      else setAuthReady(true)
    })
  }, [])

  useEffect(() => {
    setNavigating(true)
    const t = setTimeout(() => setNavigating(false), 400)
    return () => clearTimeout(t)
  }, [pathname])

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="animate-spin rounded-full" style={{ width: 24, height: 24, border: '2px solid var(--border-glass)', borderTopColor: 'var(--accent-main)' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      <ToastDisplay />
      <div className="hidden lg:block fixed left-0 top-0 h-full z-[70]"><Sidebar /></div>
      <main className="flex-1 min-h-screen lg:ml-20 flex flex-col overflow-x-hidden">

        {/* Header móvil */}
        <div className="lg:hidden sticky top-0 z-50 w-full" style={{
          background: 'color-mix(in srgb, var(--bg-primary) 75%, transparent)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
              <span className="font-script text-[25px]" style={{ color: 'var(--text-primary)' }}>Familia Quintero</span>
            </div>
            <button onClick={handleLogout} className="text-[var(--text-muted)] active:scale-90 transition-transform"><LogOut size={18} /></button>
          </div>
        </div>

        <div className="relative z-10 p-4 md:p-10 lg:p-12 max-w-[1600px] mx-auto w-full flex-1 pb-24 lg:pb-12">
          {children}
        </div>
      </main>

      <BottomNav onFABClick={() => setFabOpen(true)} />
      {fabOpen && <FABModal onClose={() => setFabOpen(false)} />}
    </div>
  )
}