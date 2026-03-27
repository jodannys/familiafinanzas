'use client'
import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { Loader2, X, Plus, ArrowUpRight, ArrowDownRight, LogOut, Check, CreditCard, AlertCircle, CheckCircle, Info } from 'lucide-react'
import { supabase, signOut } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'

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

function FABModal({ onClose }) {
  const [tipo, setTipo] = useState('egreso')
  const [monto, setMonto] = useState('')
  const [cat, setCat] = useState('basicos')
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

  useEffect(() => {
    if (metodoPago !== 'tarjeta_credito' || tipo !== 'egreso') {
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

  useEffect(() => {
    if (!SPECIAL_CATS.includes(cat) || tipo !== 'egreso') {
      setItems([]); setSelectedItem(null); return
    }
    setLoadingItems(true); setSelectedItem(null)
    const fetch =
      cat === 'ahorro' ? supabase.from('metas').select('id,nombre,emoji,meta,actual').eq('estado', 'activa')
        : cat === 'inversion' ? supabase.from('inversiones').select('id,nombre,emoji,capital,aporte')
          : supabase.from('deudas').select('id,nombre,emoji,cuota,pendiente,pagadas').eq('estado', 'activa').neq('tipo', 'medeben').neq('tipo_deuda', 'tarjeta')
    fetch.then(({ data }) => { setItems(data || []); setLoadingItems(false) })
  }, [cat, tipo])

  async function guardar() {
    const valor = parseFloat(monto)
    if (!valor || valor <= 0) return
    const esTarjeta = tipo === 'egreso' && metodoPago === 'tarjeta_credito'
    if (esTarjeta && !selectedPerfil) { toast('Selecciona una tarjeta de crédito', 'warning'); return }
    const cuotas = parseInt(numCuotas)
    if (esTarjeta && (!cuotas || cuotas < 1)) { toast('Ingresa el número de cuotas', 'warning'); return }
    setSaving(true)
    const now = new Date()
    const hoy = now.toISOString().slice(0, 10)
    const catLabel = CATS_EGRESO.find(c => c.id === cat)?.label || cat
    const descFinal = desc.trim() || (selectedItem ? selectedItem.nombre : catLabel)

    // Compra con TC: solo crear deuda, sin movimiento inmediato
    if (esTarjeta && selectedPerfil) {
      const cuotaMensual = parseFloat((valor / cuotas).toFixed(2))
      await supabase.from('deudas').insert([{
        tipo_deuda: 'tarjeta', tipo: 'debo', emoji: '💳',
        nombre: descFinal, categoria: cat,
        capital: valor, monto: valor, pendiente: valor,
        cuota: cuotaMensual, plazo_meses: cuotas, pagadas: 0,
        estado: 'activa', perfil_tarjeta_id: selectedPerfil.id,
        dia_pago: selectedPerfil.dia_pago || null,
        fecha_primer_pago: calcFechaPrimerPago(hoy, selectedPerfil.dia_pago, selectedPerfil.dia_corte),
        color: selectedPerfil.color || '#A44A3F',
        tasa: 0, tasa_interes: 0,
      }])
      setSaving(false)
      onClose()
      window.location.reload()
      return
    }

    const { data: movData, error } = await supabase.from('movimientos').insert([{
      tipo, monto: valor, descripcion: descFinal,
      categoria: tipo === 'ingreso' ? 'ingreso' : cat,
      fecha: hoy,
      metodo_pago: tipo === 'egreso' ? metodoPago : 'transferencia',
      ...(tipo === 'egreso' && cat === 'deuda' && selectedItem && { deuda_id: selectedItem.id }),
    }]).select()
    if (error) { toast('Error: ' + error.message); setSaving(false); return }

    if (tipo === 'egreso' && selectedItem) {
      if (cat === 'ahorro') {
        await supabase.from('metas').update({ actual: (selectedItem.actual || 0) + valor }).eq('id', selectedItem.id)
      } else if (cat === 'inversion') {
        await supabase.from('inversiones').update({ capital: (selectedItem.capital || 0) + valor }).eq('id', selectedItem.id)
      } else if (cat === 'deuda') {
        const { data: dmData } = await supabase.from('deuda_movimientos').insert([{
          deuda_id: selectedItem.id, tipo: 'pago',
          descripcion: descFinal || `Pago ${selectedItem.nombre}`,
          monto: valor, fecha: hoy,
          mes: now.getMonth() + 1, año: now.getFullYear(),
        }]).select()
        // Vincular deuda_movimiento_id al movimiento para poder revertir limpiamente
        if (dmData?.[0]?.id && movData?.[0]?.id) {
          await supabase.from('movimientos')
            .update({ deuda_movimiento_id: dmData[0].id })
            .eq('id', movData[0].id)
        }
        const nuevoPendiente = Math.max(0, parseFloat(selectedItem.pendiente || 0) - valor)
        await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          pagadas: (selectedItem.pagadas || 0) + 1,
          estado: nuevoPendiente <= 0 ? 'pagada' : 'activa',
        }).eq('id', selectedItem.id)
      }
    }

    setSaving(false)
    onClose()
    window.location.reload()
  }

  return (
    <>
      {/* Overlay más sutil */}
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

        {/* Cabecera compacta */}
        {/* Cabecera compacta con más aire */}
        <div className="px-6 pb-4 flex items-center justify-between shrink-0">
          <div className="flex flex-col">
            <p className="font-script text-[32px] mb-1"
              style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Registrar
            </p>
            <p className="text-[9px] uppercase tracking-[0.2em] opacity-40 font-black"
              style={{ marginLeft: '2px' }}>
              Nuevo movimiento
            </p>
          </div>

          <button onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full transition-all active:scale-90"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: 'none' }}>
            <X size={20} />
          </button>
        </div>

        <div className="px-6 space-y-5 pt-2 overflow-y-auto flex-1 no-scrollbar">

          {/* Selector de Tipo (Gasto/Ingreso) */}
          <div className="flex p-1 rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
            {[
              { id: 'egreso', label: 'Gasto', icon: ArrowDownRight, color: 'var(--accent-rose)' },
              { id: 'ingreso', label: 'Ingreso', icon: ArrowUpRight, color: 'var(--accent-green)' },
            ].map(t => (
              <button key={t.id}
                onClick={() => { setTipo(t.id); setMonto(''); setSelectedItem(null); setMetodoPago('efectivo'); setNumCuotas(1); setSelectedPerfil(null) }}
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

          {/* Monto Heroico más estilizado */}
          <div className="flex flex-col items-center py-5 rounded-2xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-30">Cantidad</p>
            <div className="flex items-center justify-center w-full px-4">
              <span className="text-2xl font-serif opacity-30 mr-1">$</span>
              <input type="number" inputMode="decimal" placeholder="0.00" value={monto} onChange={e => setMonto(e.target.value)}
                autoFocus className="bg-transparent border-none outline-none text-4xl font-serif font-bold text-center w-full"
                style={{ color: tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--text-primary)' }} />
            </div>
          </div>

          {/* Categorías (Chips) */}
          {tipo === 'egreso' && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Categoría</p>
              <div className="flex flex-wrap gap-1.5">
                {CATS_EGRESO.map(c => (
                  <button key={c.id} onClick={() => setCat(c.id)}
                    className="px-3.5 py-2 rounded-xl text-[10px] font-bold transition-all border"
                    style={{
                      background: cat === c.id ? c.color : 'transparent',
                      color: cat === c.id ? 'white' : 'var(--text-muted)',
                      borderColor: cat === c.id ? 'transparent' : 'var(--border-glass)',
                    }}> {c.label} </button>
                ))}
              </div>
            </div>
          )}

          {/* Métodos de Pago */}
          {tipo === 'egreso' && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Método de pago</p>
              <div className="grid grid-cols-4 gap-2">
                {METODOS_PAGO.map(m => {
                  const sel = metodoPago === m.id
                  return (
                    <button key={m.id} onClick={() => { setMetodoPago(m.id); setSelectedPerfil(null); setNumCuotas(1) }}
                      className="py-2.5 rounded-xl text-[10px] font-black transition-all border"
                      style={{
                        background: sel ? 'var(--bg-card)' : 'transparent',
                        color: sel ? m.color : 'var(--text-muted)',
                        borderColor: sel ? m.color : 'var(--border-glass)'
                      }}> {m.short} </button>
                  )
                })}
              </div>

              {/* Lógica de Tarjetas de Crédito (INTACTA) */}
              {metodoPago === 'tarjeta_credito' && (
                <div className="mt-3 p-3 rounded-2xl space-y-2 border border-dashed" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-glass)' }}>
                  {loadingPerf ? <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin opacity-30" /></div> :
                    perfilesTarj.map(t => {
                      const isSel = selectedPerfil?.id === t.id
                      return (
                        <button key={t.id} onClick={() => setSelectedPerfil(isSel ? null : t)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-all"
                          style={{ background: isSel ? 'var(--bg-card)' : 'transparent', border: isSel ? '1px solid var(--accent-rose)' : '1px solid transparent' }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/5">
                            <CreditCard size={14} style={{ color: isSel ? 'var(--accent-rose)' : 'var(--text-muted)' }} />
                          </div>
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
            </div>
          )}

          {/* Vínculo a Metas/Deudas (Lógica INTEL INTACTA) */}
          {tipo === 'egreso' && SPECIAL_CATS.includes(cat) && items.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Vincular a {cat === 'ahorro' ? 'Meta' : 'Deuda'}</p>
              <div className="grid gap-2">
                {items.map(item => {
                  const isSelected = selectedItem?.id === item.id
                  const color = cat === 'ahorro' ? 'var(--accent-green)' : cat === 'inversion' ? 'var(--accent-violet)' : 'var(--accent-rose)'
                  return (
                    <button key={item.id}
                      onClick={() => { setSelectedItem(isSelected ? null : item); if (!isSelected && cat === 'deuda' && item.cuota > 0) setMonto(item.cuota.toString()) }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all border"
                      style={{
                        background: isSelected ? 'var(--bg-card)' : 'transparent',
                        borderColor: isSelected ? color : 'var(--border-glass)'
                      }}>
                      <span className="text-base">{item.emoji}</span>
                      <div className="flex-1 text-left">
                        <p className="text-[11px] font-bold">{item.nombre}</p>
                        <p className="text-[9px] opacity-40">{cat === 'deuda' ? `Pendiente: ${formatCurrency(item.pendiente)}` : `Meta: ${formatCurrency(item.meta || 0)}`}</p>
                      </div>
                      {isSelected && <Check size={14} style={{ color }} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Descripción */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-1">Descripción</p>
            <input type="text" placeholder="Ej: Supermercado..." value={desc} onChange={e => setDesc(e.target.value)}
              className="ff-input !py-3 !text-xs !rounded-xl" />
          </div>

          {/* Botón Guardar (DINÁMICO CON TEMA) */}
          <div className="pt-2">
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
                  <span>Confirmar {tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span>
                </>
              )}
            </button>
          </div>
        </div>
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