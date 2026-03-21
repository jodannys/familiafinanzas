'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { Loader2, X, Plus, ArrowUpRight, ArrowDownRight, SlidersHorizontal, LogOut, Check, CreditCard } from 'lucide-react'
import { supabase, signOut } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { THEMES, useTheme } from '@/lib/themes'

const CATS_EGRESO = [
  { id: 'basicos',   label: 'Necesidades',   color: 'var(--accent-blue)'   },
  { id: 'deseo',     label: 'Estilo de vida',color: 'var(--accent-violet)' },
  { id: 'ahorro',    label: 'Ahorro',        color: 'var(--accent-green)'  },
  { id: 'inversion', label: 'Inversión',     color: 'var(--accent-gold)'   },
  { id: 'deuda',     label: 'Deuda',         color: 'var(--accent-rose)'   },
]

const SPECIAL_CATS = ['ahorro', 'inversion', 'deuda']

const METODOS_PAGO = [
  { id: 'efectivo',        short: 'EF', label: 'Efectivo',    color: 'var(--accent-green)'  },
  { id: 'transferencia',   short: 'TR', label: 'Transf.',     color: 'var(--accent-blue)'   },
  { id: 'debito',          short: 'DB', label: 'Débito',      color: 'var(--accent-violet)' },
  { id: 'tarjeta_credito', short: 'TC', label: 'T. Crédito',  color: 'var(--accent-rose)'   },
]
const CUOTAS_OPCIONES = [1, 3, 6, 9, 12, 18, 24, 36]

function FABModal({ onClose }) {
  const [tipo,          setTipo]          = useState('egreso')
  const [monto,         setMonto]         = useState('')
  const [cat,           setCat]           = useState('basicos')
  const [desc,          setDesc]          = useState('')
  const [saving,        setSaving]        = useState(false)
  const [items,         setItems]         = useState([])
  const [selectedItem,  setSelectedItem]  = useState(null)
  const [loadingItems,  setLoadingItems]  = useState(false)
  const [metodoPago,    setMetodoPago]    = useState('efectivo')
  const [perfilesTarj,  setPerfilesTarj]  = useState([])
  const [selectedPerfil,setSelectedPerfil]= useState(null)
  const [numCuotas,     setNumCuotas]     = useState(1)
  const [loadingPerf,   setLoadingPerf]   = useState(false)

  useEffect(() => {
    if (metodoPago !== 'tarjeta_credito' || tipo !== 'egreso') {
      setPerfilesTarj([]); setSelectedPerfil(null); return
    }
    setLoadingPerf(true)
    supabase.from('perfiles_tarjetas')
      .select('id,nombre_tarjeta,banco,color,dia_pago,limite_credito')
      .eq('estado', 'activa')
      .then(({ data }) => { setPerfilesTarj(data || []); setLoadingPerf(false) })
  }, [metodoPago, tipo])

  useEffect(() => {
    if (!SPECIAL_CATS.includes(cat) || tipo !== 'egreso') {
      setItems([]); setSelectedItem(null); return
    }
    setLoadingItems(true); setSelectedItem(null)
    const fetch =
      cat === 'ahorro'    ? supabase.from('metas').select('id,nombre,emoji,meta,actual').eq('estado', 'activa')
      : cat === 'inversion' ? supabase.from('inversiones').select('id,nombre,emoji,capital,aporte')
      :                       supabase.from('deudas').select('id,nombre,emoji,cuota,pendiente,pagadas').eq('estado', 'activa').neq('tipo', 'medeben')
    fetch.then(({ data }) => { setItems(data || []); setLoadingItems(false) })
  }, [cat, tipo])

  async function guardar() {
    const valor = parseFloat(monto)
    if (!valor || valor <= 0) return
    const esTarjeta = tipo === 'egreso' && metodoPago === 'tarjeta_credito'
    if (esTarjeta && !selectedPerfil) { alert('Selecciona una tarjeta de crédito'); return }
    setSaving(true)
    const now = new Date()
    const hoy = now.toISOString().slice(0, 10)
    const catLabel = CATS_EGRESO.find(c => c.id === cat)?.label || cat
    const descFinal = desc.trim() || (selectedItem ? selectedItem.nombre : catLabel)

    const { error } = await supabase.from('movimientos').insert([{
      tipo, monto: valor, descripcion: descFinal,
      categoria: tipo === 'ingreso' ? 'ingreso' : cat,
      fecha: hoy,
      metodo_pago: tipo === 'egreso' ? metodoPago : 'transferencia',
      num_cuotas: esTarjeta ? numCuotas : null,
      tarjeta_nombre: esTarjeta ? selectedPerfil.nombre_tarjeta : null,
    }])
    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    // Actualizar item vinculado (ahorro / inversión / deuda)
    if (tipo === 'egreso' && selectedItem && !esTarjeta) {
      if (cat === 'ahorro') {
        await supabase.from('metas').update({ actual: (selectedItem.actual || 0) + valor }).eq('id', selectedItem.id)
      } else if (cat === 'inversion') {
        await supabase.from('inversiones').update({ capital: (selectedItem.capital || 0) + valor }).eq('id', selectedItem.id)
      } else if (cat === 'deuda') {
        await supabase.from('deuda_movimientos').insert([{
          deuda_id: selectedItem.id, tipo: 'pago',
          descripcion: descFinal || `Pago ${selectedItem.nombre}`,
          monto: valor, fecha: hoy,
          mes: now.getMonth() + 1, año: now.getFullYear(),
        }])
        const nuevoPendiente = Math.max(0, parseFloat(selectedItem.pendiente || 0) - valor)
        await supabase.from('deudas').update({
          pendiente: nuevoPendiente,
          pagadas: (selectedItem.pagadas || 0) + 1,
          estado: nuevoPendiente <= 0 ? 'pagada' : 'activa',
        }).eq('id', selectedItem.id)
      }
    }

    // Crear deuda en cuotas si es tarjeta de crédito
    if (esTarjeta && selectedPerfil) {
      const cuotaMensual = parseFloat((valor / numCuotas).toFixed(2))
      await supabase.from('deudas').insert([{
        tipo_deuda: 'tarjeta', tipo: 'debo', emoji: '💳',
        nombre: descFinal, categoria: cat,
        capital: valor, monto: valor, pendiente: valor,
        cuota: cuotaMensual, plazo_meses: numCuotas, pagadas: 0,
        estado: 'activa', perfil_tarjeta_id: selectedPerfil.id,
        dia_pago: selectedPerfil.dia_pago || null,
        fecha_primer_pago: hoy,
        color: selectedPerfil.color || '#A44A3F',
        tasa: 0, tasa_interes: 0,
      }])
    }

    setSaving(false)
    onClose()
    window.location.reload()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[110]"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[120] rounded-t-3xl"
        style={{
          background: 'var(--bg-card)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
        }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-glass)' }} />
        </div>

        <div className="px-5 pb-2 flex items-center justify-between">
          <p className="font-script" style={{ fontSize: 25, color: 'var(--text-primary)' }}>Registrar</p>
          <button onClick={onClose}
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 space-y-4 pt-2">

          {/* Tipo toggle */}
          <div className="flex gap-2">
            {[
              { id: 'egreso',  label: 'Gasto',   icon: ArrowDownRight, color: 'var(--accent-rose)'  },
              { id: 'ingreso', label: 'Ingreso',  icon: ArrowUpRight,   color: 'var(--accent-green)' },
            ].map(t => (
              <button key={t.id}
                onClick={() => setTipo(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all"
                style={{
                  background: tipo === t.id
                    ? `color-mix(in srgb, ${t.color} 12%, transparent)`
                    : 'var(--bg-secondary)',
                  color:  tipo === t.id ? t.color : 'var(--text-muted)',
                  border: `1.5px solid ${tipo === t.id ? t.color : 'transparent'}`,
                  cursor: 'pointer',
                }}>
                <t.icon size={15} strokeWidth={2} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Monto */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}>Monto</p>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              autoFocus
              className="ff-input w-full font-serif text-2xl font-semibold text-center"
              style={{ color: tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--text-primary)' }}
            />
          </div>

          {/* Categoría (solo egreso) */}
          {tipo === 'egreso' && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--text-muted)' }}>Categoría</p>
              <div className="flex flex-wrap gap-2">
                {CATS_EGRESO.map(c => (
                  <button key={c.id}
                    onClick={() => setCat(c.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: cat === c.id
                        ? `color-mix(in srgb, ${c.color} 15%, transparent)`
                        : 'var(--bg-secondary)',
                      color:  cat === c.id ? c.color : 'var(--text-muted)',
                      border: `1px solid ${cat === c.id ? c.color : 'transparent'}`,
                      cursor: 'pointer',
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Método de pago (solo egreso) */}
          {tipo === 'egreso' && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--text-muted)' }}>Método de pago</p>
              <div className="grid grid-cols-4 gap-1.5">
                {METODOS_PAGO.map(m => {
                  const sel = metodoPago === m.id
                  return (
                    <button key={m.id}
                      onClick={() => { setMetodoPago(m.id); setSelectedPerfil(null); setNumCuotas(1) }}
                      className="py-2 rounded-xl text-[10px] font-semibold transition-all"
                      style={{
                        background: sel ? `color-mix(in srgb, ${m.color} 15%, transparent)` : 'var(--bg-secondary)',
                        color: sel ? m.color : 'var(--text-muted)',
                        border: `1.5px solid ${sel ? m.color : 'transparent'}`,
                        cursor: 'pointer',
                      }}>
                      {m.short}
                    </button>
                  )
                })}
              </div>

              {/* Picker tarjeta crédito */}
              {metodoPago === 'tarjeta_credito' && (
                <div className="mt-2 space-y-2">
                  {loadingPerf ? (
                    <div className="flex justify-center py-2">
                      <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  ) : perfilesTarj.length === 0 ? (
                    <div className="px-3 py-2.5 rounded-xl"
                      style={{ background: 'color-mix(in srgb, var(--accent-gold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-gold) 25%, transparent)' }}>
                      <p className="text-xs" style={{ color: 'var(--accent-gold)' }}>
                        No tienes tarjetas en Mis Tarjetas. Agrégalas primero.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {perfilesTarj.map(t => {
                        const isSel = selectedPerfil?.id === t.id
                        return (
                          <button key={t.id}
                            onClick={() => setSelectedPerfil(isSel ? null : t)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: isSel ? 'color-mix(in srgb, var(--accent-rose) 10%, transparent)' : 'var(--bg-secondary)',
                              border: `1px solid ${isSel ? 'var(--accent-rose)' : 'transparent'}`,
                              cursor: 'pointer',
                            }}>
                            <CreditCard size={13} style={{ color: isSel ? 'var(--accent-rose)' : 'var(--text-muted)', flexShrink: 0 }} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate"
                                style={{ color: isSel ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                                {t.nombre_tarjeta}
                              </p>
                              {t.banco && <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t.banco}</p>}
                            </div>
                            {t.dia_pago && <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Día {t.dia_pago}</p>}
                            {isSel && <Check size={12} style={{ color: 'var(--accent-rose)', flexShrink: 0 }} />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Cuotas */}
                  {selectedPerfil && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                        style={{ color: 'var(--text-muted)' }}>Cuotas</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {CUOTAS_OPCIONES.map(c => (
                          <button key={c}
                            onClick={() => setNumCuotas(c)}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                            style={{
                              background: numCuotas === c ? 'color-mix(in srgb, var(--accent-rose) 15%, transparent)' : 'var(--bg-secondary)',
                              color: numCuotas === c ? 'var(--accent-rose)' : 'var(--text-muted)',
                              border: `1px solid ${numCuotas === c ? 'var(--accent-rose)' : 'transparent'}`,
                              cursor: 'pointer',
                            }}>
                            {c === 1 ? 'Contado' : `${c}x`}
                          </button>
                        ))}
                      </div>
                      {numCuotas > 1 && parseFloat(monto) > 0 && (
                        <p className="text-[10px] mt-1" style={{ color: 'var(--accent-rose)' }}>
                          {numCuotas} cuotas de {formatCurrency(parseFloat(monto) / numCuotas)}
                          {selectedPerfil.dia_pago ? ` · vence día ${selectedPerfil.dia_pago}` : ''}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Picker de item vinculado */}
          {tipo === 'egreso' && SPECIAL_CATS.includes(cat) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--text-muted)' }}>
                {cat === 'ahorro' ? 'Meta de ahorro' : cat === 'inversion' ? 'Cartera de inversión' : 'Deuda a pagar'}
              </p>
              {loadingItems ? (
                <div className="flex justify-center py-3">
                  <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                </div>
              ) : items.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--accent-gold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent-gold) 25%, transparent)' }}>
                  <span className="text-xs" style={{ color: 'var(--accent-gold)' }}>
                    Sin {cat === 'ahorro' ? 'metas activas' : cat === 'inversion' ? 'inversiones' : 'deudas activas'} — se guardará sin vincular
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map(item => {
                    const isSelected = selectedItem?.id === item.id
                    const color = cat === 'ahorro' ? 'var(--accent-green)' : cat === 'inversion' ? 'var(--accent-violet)' : 'var(--accent-rose)'
                    return (
                      <button key={item.id}
                        onClick={() => setSelectedItem(isSelected ? null : item)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{
                          background: isSelected ? `color-mix(in srgb, ${color} 10%, transparent)` : 'var(--bg-secondary)',
                          border: `1px solid ${isSelected ? color : 'transparent'}`,
                          cursor: 'pointer',
                        }}>
                        <span className="text-sm">{item.emoji}</span>
                        <span className="flex-1 text-xs font-semibold" style={{ color: isSelected ? color : 'var(--text-primary)' }}>
                          {item.nombre}
                        </span>
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {cat === 'deuda'    ? (item.cuota > 0 ? `${formatCurrency(item.cuota)}/mes` : formatCurrency(item.pendiente))
                           : cat === 'ahorro'  ? `${formatCurrency(item.actual || 0)} / ${formatCurrency(item.meta || 0)}`
                           : item.aporte > 0  ? `${formatCurrency(item.aporte)}/mes` : ''}
                        </span>
                        {isSelected && <Check size={13} style={{ color, flexShrink: 0 }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Descripción */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}>Descripción <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9 }}>(opcional)</span></p>
            <input
              type="text"
              placeholder="Ej: Supermercado, Nómina..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardar()}
              className="ff-input w-full text-sm"
            />
          </div>

          {/* Aviso cuando hay items pero ninguno seleccionado */}
          {tipo === 'egreso' && SPECIAL_CATS.includes(cat) && items.length > 0 && !selectedItem && (
            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)', marginTop: -8 }}>
              Sin selección — se guardará sin vincular a ningún item
            </p>
          )}

          {/* Guardar */}
          <button
            onClick={guardar}
            disabled={!monto || parseFloat(monto) <= 0 || saving}
            className="w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: (!monto || parseFloat(monto) <= 0) ? 'var(--bg-secondary)' : 'var(--text-primary)',
              color:      (!monto || parseFloat(monto) <= 0) ? 'var(--text-muted)' : 'var(--bg-card)',
              border: 'none', cursor: 'pointer',
            }}>
            {saving
              ? <Loader2 size={16} className="animate-spin" />
              : tipo === 'egreso' && metodoPago === 'tarjeta_credito'
                ? <><CreditCard size={15} /> {numCuotas > 1 ? `${numCuotas} cuotas · TC` : 'Contado · TC'}</>
                : <><Plus size={15} /> Registrar</>
            }
          </button>

        </div>
      </div>
    </>
  )
}

export default function AppShell({ children }) {
  const [fabOpen,    setFabOpen]    = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [navigating, setNavigating] = useState(false)
  const [authReady,  setAuthReady]  = useState(false)
  const pathname   = usePathname()
  const router     = useRouter()
  const { theme, setTheme } = useTheme()

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
    setMenuOpen(false)
    await signOut()
    router.replace('/login')
  }

  if (!authReady) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="animate-spin rounded-full" style={{
        width: 24, height: 24,
        border: '2px solid var(--border-glass)',
        borderTopColor: 'var(--accent-main)',
      }} />
    </div>
  )

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* Sidebar — solo desktop */}
      <div className="hidden lg:block fixed left-0 top-0 h-full z-[70]">
        <Sidebar />
      </div>

      {/* Main */}
      <main
        className="flex-1 min-h-screen lg:ml-20 flex flex-col overflow-x-hidden"
        style={{ background: 'var(--bg-primary)' }}>

        {/* Header móvil */}
        <div className="lg:hidden sticky top-0 z-50 w-full" style={{ background: 'var(--bg-primary)' }}>
          <div
            className="flex items-center justify-between px-5"
            style={{
              paddingTop:    'calc(env(safe-area-inset-top) + 0.75rem)',
              paddingBottom: '0.75rem',
            }}>
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
              <span className="font-script text-base" style={{ color: 'var(--text-primary)', fontSize: 25, }}>
                Familia Quintero
              </span>
            </div>

            <div className="flex items-center gap-2">
              {navigating && <Loader2 size={15} className="animate-spin" style={{ color: 'var(--accent-main)' }} />}
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90"
                style={{
                  background: menuOpen ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}>
                <SlidersHorizontal size={16} />
              </button>
            </div>
          </div>

          {/* Dropdown */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[59]" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-4 z-[60] rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  top: 'calc(100% + 4px)',
                  width: 200,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                }}>
                <p className="px-4 pt-3 pb-2 text-[9px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Tema</p>
                <div className="px-2 pb-2 space-y-0.5">
                  {Object.entries(THEMES).map(([key, t]) => {
                    const active = theme === key
                    return (
                      <button key={key}
                        onClick={() => { setTheme(key); setMenuOpen(false) }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-all"
                        style={{
                          background: active ? 'var(--bg-secondary)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                        }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                          background: t.preview[0], border: '2px solid var(--border-glass)',
                        }} />
                        <span className="flex-1 text-left text-xs font-semibold"
                          style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {t.name}
                        </span>
                        {active && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--accent-green)' }}>
                            <Check size={9} color="white" strokeWidth={4} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="mx-2 mb-2 mt-1 pt-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
                  <button
                    onClick={handleLogout}
                    title="Cerrar sesión"
                    className="flex items-center justify-center w-8 h-8 rounded-xl transition-all ml-1"
                    style={{
                      color: 'var(--accent-rose)', background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
                      border: 'none', cursor: 'pointer',
                    }}>
                    <LogOut size={15} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Barra de progreso desktop */}
        {navigating && (
          <div className="fixed top-0 left-0 right-0 z-[200] h-0.5" style={{ background: 'var(--accent-main)' }}>
            <div className="h-full" style={{
              background: `linear-gradient(90deg, transparent, var(--accent-main), transparent)`,
              animation: 'progress-bar 0.4s ease-out forwards',
            }} />
          </div>
        )}

        {/* Fondo decorativo */}
        <div className="fixed inset-0 lg:ml-20 pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-5%', right: '-5%',
            width: '600px', height: '600px',
            background: 'radial-gradient(circle, var(--accent-main) 0%, transparent 70%)',
            opacity: 0.07,
          }} />
        </div>

        {/* FAB móvil — encima del BottomNav */}
        <button
          onClick={() => setFabOpen(true)}
          className="lg:hidden flex fixed right-5 z-[80] w-14 h-14 rounded-full items-center justify-center shadow-2xl active:scale-95 transition-transform"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 76px)',
            background: 'var(--accent-green)', color: 'white', border: 'none', cursor: 'pointer',
          }}>
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* FAB desktop */}
        <button
          onClick={() => setFabOpen(true)}
          className="hidden lg:flex fixed bottom-8 right-8 z-[80] w-14 h-14 rounded-full items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
          style={{ background: 'var(--accent-green)', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* Contenido */}
        <div className="relative z-10 p-4 md:p-10 lg:p-12 max-w-[1600px] mx-auto w-full flex-1 pb-24 lg:pb-12">
          {children}
        </div>
      </main>

      {/* Bottom Nav — solo móvil */}
      <BottomNav onFABClick={() => setFabOpen(true)} />

      {/* FAB Modal */}
      {fabOpen && <FABModal onClose={() => setFabOpen(false)} />}
    </div>
  )
}
