'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, X, Plus, ArrowUpRight, ArrowDownRight,
  Check, CreditCard, AlertCircle, CheckCircle, Info,
  Banknote, Smartphone, Building2, Wallet, LogOut,
} from 'lucide-react'
import { supabase, signOut, getMisPermisos } from '@/lib/supabase'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { getPresupuestoMes } from '@/lib/presupuesto'
import CustomSelect from '@/components/ui/CustomSelect'
import { useQuien } from '@/lib/useQuien'
import { useTheme, getThemeColors } from '@/lib/themes'
import ProfilePanel from '@/components/ui/ProfilePanel'
import PageTransition from '@/components/ui/PageTransition'
import ConfirmLogoutModal from '@/components/ui/ConfirmLogoutModal'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATS_EGRESO = [
  { id: 'basicos',   label: 'Básicos',        color: 'var(--accent-blue)'   },
  { id: 'deseo',     label: 'Estilo de vida', color: 'var(--accent-violet)' },
  { id: 'ahorro',    label: 'Ahorro',         color: 'var(--accent-green)'  },
  { id: 'inversion', label: 'Inversión',      color: 'var(--accent-gold)'   },
  { id: 'deuda',     label: 'Deuda',          color: 'var(--accent-rose)'   },
]

const SPECIAL_CATS = ['ahorro', 'inversion', 'deuda']
const CAT_BLOQUE   = { basicos: 'necesidades', deuda: 'necesidades', deseo: 'estilo', ahorro: 'futuro', inversion: 'futuro' }

const METODOS_PAGO = [
  { id: 'efectivo',        label: 'Efectivo',  Icon: Banknote,  color: 'var(--accent-green)'  },
  { id: 'transferencia',   label: 'Transf.',   Icon: Smartphone, color: 'var(--accent-blue)'  },
  { id: 'debito',          label: 'Débito',    Icon: Building2,  color: 'var(--accent-violet)' },
  { id: 'tarjeta_credito', label: 'T. Crédito', Icon: CreditCard, color: 'var(--accent-rose)' },
]

function calcFechaPrimerPago(fechaCompra, diaPago, diaCorte) {
  if (!diaPago) return fechaCompra
  const [y, m, d] = fechaCompra.split('-').map(Number)
  const corte = diaCorte || diaPago
  if (d <= corte) {
    return `${y}-${String(m).padStart(2,'0')}-${String(diaPago).padStart(2,'0')}`
  }
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  return `${nextY}-${String(nextM).padStart(2,'0')}-${String(diaPago).padStart(2,'0')}`
}

// ── Sección con etiqueta ──────────────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div>
      <p style={{
        fontSize: 9, fontWeight: 900, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
        marginBottom: 6, paddingLeft: 2,
      }}>{label}</p>
      {children}
    </div>
  )
}

// ── Divisor ───────────────────────────────────────────────────────────────────

function Divider() {
  return <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
}

// ── DraggableFAB (solo desktop) ───────────────────────────────────────────────

function DraggableFAB({ onClick }) {
  const DEFAULT = { x: window?.innerWidth ? window.innerWidth - 80 : 1200, y: window?.innerHeight ? window.innerHeight - 100 : 700 }

  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('ff-fab-pos')
      if (saved) {
        const p = JSON.parse(saved)
        // Validar que siga dentro de la pantalla
        if (p.x > 0 && p.y > 0 && p.x < window.innerWidth && p.y < window.innerHeight) return p
      }
    } catch (e) {}
    return DEFAULT
  })

  const dragging  = useRef(false)
  const didMove   = useRef(false)
  const startPtr  = useRef({ x: 0, y: 0 })
  const startPos  = useRef({ x: 0, y: 0 })

  const onPointerDown = useCallback((e) => {
    dragging.current = true
    didMove.current  = false
    startPtr.current = { x: e.clientX, y: e.clientY }
    startPos.current = pos
    e.currentTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }, [pos])

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return
    const dx = e.clientX - startPtr.current.x
    const dy = e.clientY - startPtr.current.y
    if (Math.abs(dx) + Math.abs(dy) > 4) didMove.current = true
    const SIZE = 58
    const nx = Math.max(8, Math.min(window.innerWidth  - SIZE - 8, startPos.current.x + dx))
    const ny = Math.max(8, Math.min(window.innerHeight - SIZE - 8, startPos.current.y + dy))
    setPos({ x: nx, y: ny })
  }, [])

  const onPointerUp = useCallback((e) => {
    if (!dragging.current) return
    dragging.current = false
    if (!didMove.current) {
      onClick()
    } else {
      try { localStorage.setItem('ff-fab-pos', JSON.stringify(pos)) } catch (e) {}
    }
  }, [onClick, pos])

  // Guardar posición al soltar
  useEffect(() => {
    if (!dragging.current) {
      try { localStorage.setItem('ff-fab-pos', JSON.stringify(pos)) } catch (e) {}
    }
  }, [pos])

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: 58, height: 58,
        borderRadius: '50%',
        background: 'var(--accent-main)',
        color: 'var(--text-on-dark)',
        border: '3px solid color-mix(in srgb, var(--bg-card) 85%, transparent)',
        boxShadow: `var(--shadow-lg), 0 8px 24px color-mix(in srgb, var(--accent-main) 55%, transparent)`,
        cursor: dragging.current ? 'grabbing' : 'grab',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 400,
        touchAction: 'none',
        userSelect: 'none',
        transition: dragging.current ? 'none' : 'box-shadow 0.2s',
      }}
    >
      <Plus size={26} strokeWidth={3} />
    </button>
  )
}

// ── FABModal ──────────────────────────────────────────────────────────────────


export function FABModal({ onClose }) {
  const router = useRouter()
  const [tipo,               setTipo]               = useState('egreso')
  const [monto,              setMonto]               = useState('')
  const [cat,                setCat]                 = useState(null)
  const [catDB,              setCatDB]               = useState(null)
  const [catDBList,          setCatDBList]           = useState([])
  const [loadingCatDB,       setLoadingCatDB]        = useState(false)
  const [desc,               setDesc]                = useState('')
  const [saving,             setSaving]              = useState(false)
  const [items,              setItems]               = useState([])
  const [selectedItem,       setSelectedItem]        = useState(null)
  const [loadingItems,       setLoadingItems]        = useState(false)
  const [metodoPago,         setMetodoPago]          = useState('efectivo')
  const [perfilesTarj,       setPerfilesTarj]        = useState([])
  const [selectedPerfil,     setSelectedPerfil]      = useState(null)
  const [numCuotas,          setNumCuotas]           = useState(1)
  const [loadingPerf,        setLoadingPerf]         = useState(false)
  const [fecha,              setFecha]               = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
  const { opcionesQuien, defaultQuien } = useQuien()
  const [quien,              setQuien]               = useState('Ambos')

  // Sincronizar quien con el default cuando carga el hook
  useEffect(() => {
    if (defaultQuien) setQuien(q => q === 'Ambos' ? defaultQuien : q)
  }, [defaultQuien])
  const [subcats,            setSubcats]             = useState([])
  const [selectedSubcat,     setSelectedSubcat]      = useState(null)
  const [subcatPresupuesto,  setSubcatPresupuesto]   = useState({})
  const [montoMetasDisp,     setMontoMetasDisp]      = useState(0)

  useEffect(() => {
    getPresupuestoMes().then(p => setMontoMetasDisp(p?.montoMetas || 0))
  }, [])

  // Limpiar monto + items al cambiar tipo
  function handleTipo(t) {
    setTipo(t); setCat(null); setCatDB(null); setSelectedItem(null)
    setMetodoPago('efectivo'); setNumCuotas(1); setSelectedPerfil(null)
    setMonto('')
  }

  // Limpiar monto + sub-estado al cambiar categoría
  function handleCat(id) {
    const nuevo = cat === id ? null : id
    setCat(nuevo); setCatDB(null); setSelectedItem(null)
    setSelectedSubcat(null); setMonto('')  // ← limpia monto
  }

  // Perfiles de tarjeta
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
      })
      .finally(() => setLoadingPerf(false))
  }, [metodoPago, tipo, cat])

  // Categorías BD
  useEffect(() => {
    setCatDB(null); setSelectedItem(null); setSubcats([]); setSelectedSubcat(null)
    if (!cat || SPECIAL_CATS.includes(cat)) { setCatDBList([]); return }
    const bloque = CAT_BLOQUE[cat]
    if (!bloque) { setCatDBList([]); return }
    setLoadingCatDB(true)
    supabase.from('categorias').select('id,nombre,color').eq('bloque', bloque)
      .order('orden').order('nombre')
      .then(({ data }) => { setCatDBList(data || []) })
      .finally(() => setLoadingCatDB(false))
  }, [cat])

  // Items especiales
  useEffect(() => {
    setSelectedItem(null)
    if (!cat || !SPECIAL_CATS.includes(cat) || tipo !== 'egreso') { setItems([]); return }
    setLoadingItems(true)
    const q =
      cat === 'ahorro'     ? supabase.from('metas').select('id,nombre,emoji,meta,actual,pct_mensual').eq('estado','activa')
      : cat === 'inversion' ? supabase.from('inversiones').select('id,nombre,emoji,capital,aporte')
      : supabase.from('deudas').select('id,nombre,emoji,cuota,pendiente,pagadas')
          .eq('estado','activa').neq('tipo','medeben').neq('tipo_deuda','tarjeta')
    q.then(({ data }) => { setItems(data || []) })
      .finally(() => setLoadingItems(false))
  }, [cat, tipo])

  // Subcategorías + presupuesto del mes
  useEffect(() => {
    if (!catDB) { setSubcats([]); setSelectedSubcat(null); setSubcatPresupuesto({}); return }
    const now = new Date()
    const mes = now.getMonth() + 1
    const año = now.getFullYear()
    setSubcats([])
    Promise.all([
      supabase.from('subcategorias').select('id,nombre').eq('categoria_id', catDB.id).order('orden').order('nombre'),
      supabase.from('presupuesto_cats').select('subcategoria_id,monto').eq('mes', mes).eq('año', año),
    ]).then(([{ data: subsData }, { data: presData }]) => {
      setSubcats(subsData || [])
      setSelectedSubcat(null)
      const presMap = {}
      ;(presData || []).forEach(p => { presMap[p.subcategoria_id] = parseFloat(p.monto) })
      setSubcatPresupuesto(presMap)
    })
  }, [catDB])

  // ── Guardar ─────────────────────────────────────────────────────────────────
  async function guardar() {
    if (saving) return
    const valor = parseFloat(monto)
    if (!valor || valor <= 0) return
    const esTarjeta = tipo === 'egreso' && metodoPago === 'tarjeta_credito'
    if (esTarjeta && !selectedPerfil) { toast('Selecciona una tarjeta de crédito', 'warning'); return }
    const cuotas = parseInt(numCuotas)
    if (esTarjeta && (!cuotas || cuotas < 1)) { toast('Ingresa el número de cuotas', 'warning'); return }
    const catFinal = tipo === 'ingreso' ? 'ingreso' : (cat || 'basicos')
    const catLabel = tipo === 'ingreso' ? 'Ingreso' : (catDB?.nombre || CATS_EGRESO.find(c => c.id === catFinal)?.label || catFinal)
    if (catFinal === 'deuda' && selectedItem && valor > selectedItem.pendiente) {
      toast(`El monto supera el pendiente (${formatCurrency(selectedItem.pendiente)})`, 'warning'); return
    }
    setSaving(true)
    const [fechaYear, fechaMes] = fecha.split('-').map(Number)
    const descFinal = desc.trim() || (selectedItem ? selectedItem.nombre : catLabel)

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
        color: selectedPerfil.color || '#A44A3F', tasa: 0, tasa_interes: 0,
      }])
      setSaving(false)
      if (tcError) { toast('Error al registrar la compra: ' + tcError.message); return }
      toast(`Compra registrada · ${cuotas === 1 ? 'Pago único' : `${cuotas}x de ${formatCurrency(cuotaMensual)}`}`, 'success')
      onClose(); window.dispatchEvent(new Event('ff:movimiento-guardado')); return
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
        const { error: e } = await supabase.from('metas').update({ actual: (selectedItem.actual || 0) + valor }).eq('id', selectedItem.id)
        if (e) { toast('Error al actualizar la meta: ' + e.message); setSaving(false); return }
      } else if (catFinal === 'inversion') {
        const { error: e } = await supabase.from('inversiones').update({ capital: (selectedItem.capital || 0) + valor }).eq('id', selectedItem.id)
        if (e) { toast('Error al actualizar la inversión: ' + e.message); setSaving(false); return }
      } else if (catFinal === 'deuda') {
        const { data: dmData, error: dmErr } = await supabase.rpc('registrar_deuda_movimiento', {
          p_deuda_id: selectedItem.id, p_tipo: 'pago',
          p_descripcion: descFinal || `Pago ${selectedItem.nombre}`,
          p_monto: valor, p_fecha: fecha, p_mes: fechaMes, p_año: fechaYear,
        })
        if (dmErr) { toast('Error al registrar el pago: ' + dmErr.message); setSaving(false); return }
        if (dmData?.id && movData?.[0]?.id) {
          await supabase.from('movimientos').update({ deuda_movimiento_id: dmData.id }).eq('id', movData[0].id)
        }
        const nuevoPendiente = Math.max(0, parseFloat(selectedItem.pendiente || 0) - valor)
        const { error: deudaErr } = await supabase.from('deudas').update({
          pendiente: nuevoPendiente, pagadas: (selectedItem.pagadas || 0) + 1,
          estado: nuevoPendiente <= 0 ? 'pagada' : 'activa',
        }).eq('id', selectedItem.id)
        if (deudaErr) { toast('Error al actualizar la deuda: ' + deudaErr.message); setSaving(false); return }
      }
    }

    toast(tipo === 'ingreso' ? 'Ingreso registrado' : 'Gasto registrado', 'success')
    setSaving(false); onClose(); window.dispatchEvent(new Event('ff:movimiento-guardado'))
  }

  // ── Colores dinámicos ────────────────────────────────────────────────────────
  const catInfo    = cat ? CATS_EGRESO.find(c => c.id === cat) : null
  const accentColor = tipo === 'ingreso' ? 'var(--accent-green)' : (catInfo?.color || 'var(--accent-main)')
  const montoValido = parseFloat(monto) > 0

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
      style={{
        background: 'color-mix(in srgb, var(--bg-dark-card), transparent 45%)',
        backdropFilter: 'blur(8px)',
        padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
      }}
      onClick={onClose}
    >
        {/* Sheet */}
        <div
          className="ff-sheet animate-enter relative w-full flex flex-col"
          style={{
            maxWidth: 440,
            maxHeight: '100%',
          }}
          onClick={e => e.stopPropagation()}
        >

          {/* ── Header ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '38px 1fr 38px',
            alignItems: 'center', gap: 8,
            padding: '14px 14px 12px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
          }}>
            <div />
            <div style={{
              display: 'flex', gap: 3, padding: '3px',
              borderRadius: 14, background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
            }}>
              {[
                { id: 'egreso',  label: 'Gasto',   Icon: ArrowDownRight, color: 'var(--accent-rose)'  },
                { id: 'ingreso', label: 'Ingreso',  Icon: ArrowUpRight,   color: 'var(--accent-green)' },
              ].map(t => (
                <button key={t.id} onClick={() => handleTipo(t.id)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '8px 0', borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: tipo === t.id ? `color-mix(in srgb, ${t.color} 14%, var(--bg-secondary))` : 'transparent',
                  color: tipo === t.id ? t.color : 'var(--text-muted)',
                  fontWeight: 700, fontSize: 12,
                  transition: 'all 0.15s',
                }}>
                  <t.Icon size={14} strokeWidth={2.5} />
                  {t.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{
              width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'var(--bg-card)', color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <X size={15} />
            </button>
          </div>

          {/* ── Monto — hero con tinte de color ── */}
          <div style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            background: `color-mix(in srgb, ${accentColor} 5%, var(--bg-card))`,
            flexShrink: 0,
          }}>
            <p style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: accentColor, opacity: 0.8, margin: 0,
            }}>
              {tipo === 'ingreso' ? 'Ingreso' : (catInfo?.label || 'Importe')}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: accentColor, opacity: 0.45 }}>€</span>
              <input
                type="number" inputMode="decimal" placeholder="0.00"
                value={monto} onChange={e => setMonto(e.target.value)}
                autoFocus
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 52, fontWeight: 800, color: accentColor,
                  width: 210, textAlign: 'center',
                  fontFamily: 'Inter, sans-serif', letterSpacing: '-0.04em',
                }}
              />
            </div>
          </div>

          {/* ── Cuerpo scrollable ── */}
          <div className="custom-scroll" style={{ overflowY: 'auto', flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* SECCIÓN: Categoría (solo gasto) */}
          {tipo === 'egreso' && (
            <Section label="Categoría">
              <CustomSelect
                value={cat || ''}
                onChange={id => { setMonto(''); handleCat(id) }}
                options={CATS_EGRESO.map(c => ({ id: c.id, label: c.label }))}
                placeholder="— Seleccionar categoría —"
              />
            </Section>
          )}

          {/* SECCIÓN: Categoría BD + Subcategoría */}
          {tipo === 'egreso' && cat && !SPECIAL_CATS.includes(cat) && (
            <Section label="Categoría">
              {loadingCatDB ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
                  <Loader2 size={14} className="animate-spin" style={{ opacity: 0.3 }} />
                </div>
              ) : catDBList.length === 0 ? null : (
                <CustomSelect
                  value={catDB?.id || ''}
                  onChange={id => setCatDB(catDBList.find(c => c.id === id) || null)}
                  options={catDBList.map(c => ({ id: c.id, label: c.nombre }))}
                  placeholder="— Seleccionar categoría —"
                  color={catInfo?.color}
                />
              )}

              {/* Subcategorías */}
              {subcats.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <CustomSelect
                    value={selectedSubcat?.id || ''}
                    onChange={id => {
                      const sub = subcats.find(s => s.id === id) || null
                      setSelectedSubcat(sub)
                      if (sub && subcatPresupuesto[sub.id] > 0) setMonto(subcatPresupuesto[sub.id].toString())
                    }}
                    options={subcats.map(s => ({
                      id: s.id,
                      label: s.nombre,
                      sub: subcatPresupuesto[s.id] > 0 ? formatCurrency(subcatPresupuesto[s.id]) : undefined,
                    }))}
                    placeholder="— Subcategoría (opcional) —"
                    color={catInfo?.color}
                  />
                </div>
              )}
            </Section>
          )}

          {/* SECCIÓN: Items especiales */}
          {tipo === 'egreso' && cat && SPECIAL_CATS.includes(cat) && (loadingItems || items.length > 0) && (
            <Section label={cat === 'ahorro' ? 'Meta' : cat === 'inversion' ? 'Inversión' : 'Deuda'}>
              {loadingItems ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 10 }}>
                  <Loader2 size={14} className="animate-spin" style={{ opacity: 0.3 }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {items.map(item => {
                    const isSel = selectedItem?.id === item.id
                    const color = cat === 'ahorro' ? 'var(--accent-green)' : cat === 'inversion' ? 'var(--accent-violet)' : 'var(--accent-rose)'
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(isSel ? null : item)
                          if (!isSel) {
                            if      (cat === 'deuda'     && item.cuota > 0)                       setMonto(item.cuota.toString())
                            else if (cat === 'inversion' && item.aporte > 0)                       setMonto(item.aporte.toString())
                            else if (cat === 'ahorro'    && item.pct_mensual > 0 && montoMetasDisp > 0)
                              setMonto(parseFloat(((item.pct_mensual / 100) * montoMetasDisp).toFixed(2)).toString())
                          } else {
                            setMonto('') // limpiar si se deselecciona
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 12px', borderRadius: 12, cursor: 'pointer',
                          background: isSel ? `color-mix(in srgb, ${color} 8%, var(--bg-card))` : 'var(--bg-secondary)',
                          border: `1px solid ${isSel ? color : 'transparent'}`,
                          transition: 'all 0.12s', textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 16 }}>{item.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{item.nombre}</p>
                          <p style={{ margin: 0, fontSize: 9, color: 'var(--text-muted)' }}>
                            {cat === 'deuda'
                              ? `Pendiente: ${formatCurrency(item.pendiente)}`
                              : cat === 'inversion'
                                ? `Capital: ${formatCurrency(item.capital || 0)}`
                                : item.pct_mensual > 0 && montoMetasDisp > 0
                                  ? `Aporte: ${formatCurrency((item.pct_mensual / 100) * montoMetasDisp)}`
                                  : `Meta: ${formatCurrency(item.meta || 0)}`}
                          </p>
                        </div>
                        {isSel && <Check size={12} style={{ color, flexShrink: 0 }} />}
                      </button>
                    )
                  })}
                </div>
              )}
            </Section>
          )}

          {tipo === 'egreso' && <Divider />}

          {/* SECCIÓN: Detalles (fecha, quién, método) */}
          <Section label="Detalles">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* Solo fecha */}
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="ff-input"
                style={{ fontSize: 11, padding: '7px 10px', borderRadius: 10, width: '100%' }}
              />

              {/* ¿Quién? (dinámico desde perfiles del hogar) */}
              {opcionesQuien.length > 1 && (
                <CustomSelect
                  value={quien}
                  onChange={v => setQuien(v || defaultQuien)}
                  options={opcionesQuien}
                  placeholder="— ¿Quién? —"
                />
              )}

              {/* Método de pago (solo gasto) */}
              {tipo === 'egreso' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                  {METODOS_PAGO.map(m => {
                    const sel = metodoPago === m.id
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setMetodoPago(m.id); setSelectedPerfil(null); setNumCuotas(1) }}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          padding: '8px 4px', borderRadius: 12, cursor: 'pointer',
                          background: sel ? `color-mix(in srgb, ${m.color} 10%, var(--bg-card))` : 'var(--bg-secondary)',
                          border: `1px solid ${sel ? m.color : 'var(--border-glass)'}`,
                          color: sel ? m.color : 'var(--text-muted)',
                          transition: 'all 0.12s',
                        }}
                      >
                        <m.Icon size={14} strokeWidth={2} />
                        <span style={{ fontSize: 9, fontWeight: 700 }}>{m.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Tarjetas de crédito */}
              {tipo === 'egreso' && metodoPago === 'tarjeta_credito' && (loadingPerf || perfilesTarj.length > 0) && (
                <div style={{
                  padding: '10px 12px', borderRadius: 14,
                  background: 'var(--bg-secondary)', border: '1px dashed var(--border-glass)',
                  display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  {loadingPerf ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}>
                      <Loader2 size={14} className="animate-spin" style={{ opacity: 0.3 }} />
                    </div>
                  ) : perfilesTarj.length === 0 ? null : perfilesTarj.map(t => {
                    const isSel = selectedPerfil?.id === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedPerfil(isSel ? null : t)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                          background: isSel ? 'var(--bg-card)' : 'transparent',
                          border: `1px solid ${isSel ? 'var(--accent-rose)' : 'transparent'}`,
                        }}
                      >
                        <CreditCard size={13} style={{ color: isSel ? 'var(--accent-rose)' : 'var(--text-muted)' }} />
                        <div style={{ flex: 1, textAlign: 'left' }}>
                          <p style={{ margin: 0, fontSize: 11, fontWeight: 700 }}>{t.nombre_tarjeta}</p>
                          <p style={{ margin: 0, fontSize: 9, opacity: 0.4 }}>{t.banco || 'Tarjeta'}</p>
                        </div>
                        {isSel && <Check size={12} style={{ color: 'var(--accent-rose)' }} />}
                      </button>
                    )
                  })}
                  {selectedPerfil && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      paddingTop: 8, borderTop: '1px solid var(--border-glass)',
                    }}>
                      <p style={{ margin: 0, fontSize: 9, fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cuotas</p>
                      <input
                        type="number" min="1" value={numCuotas}
                        onChange={e => setNumCuotas(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                        style={{
                          width: 44, textAlign: 'center', fontWeight: 700, fontSize: 13,
                          background: 'var(--bg-card)', border: '1px solid var(--border-glass)',
                          borderRadius: 8, padding: '3px 0', color: 'var(--accent-rose)',
                        }}
                      />
                      <p style={{ margin: 0, fontSize: 10, opacity: 0.6 }}>
                        {(numCuotas || 1) > 1
                          ? `${numCuotas}x ${formatCurrency(parseFloat(monto || 0) / numCuotas)}`
                          : 'Pago único'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>

          {/* SECCIÓN: Descripción */}
          <Section label={tipo === 'ingreso' ? 'Descripción' : 'Nota (opcional)'}>
            <input
              type="text"
              placeholder={tipo === 'ingreso' ? 'Ej: Sueldo, Freelance…' : 'Añade una descripción…'}
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="ff-input"
              style={{ width: '100%', fontSize: 12, padding: '9px 12px', borderRadius: 10 }}
            />
          </Section>

          {/* ── Botón guardar ── */}
          <button
            onClick={guardar}
            disabled={!montoValido || saving}
            style={{
              width: '100%', padding: '14px', borderRadius: 16, border: 'none', cursor: montoValido ? 'pointer' : 'default',
              background: !montoValido ? 'var(--bg-secondary)'
                : tipo === 'ingreso' ? 'var(--accent-green)' : accentColor,
              color: !montoValido ? 'var(--text-muted)' : '#fff',
              fontWeight: 800, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <>
                {tipo === 'egreso' && metodoPago === 'tarjeta_credito'
                  ? <CreditCard size={15} />
                  : <Plus size={15} />}
                <span>
                  {tipo === 'egreso' && metodoPago === 'tarjeta_credito'
                    ? 'Registrar en cuotas'
                    : tipo === 'ingreso'
                      ? 'Confirmar ingreso'
                      : 'Confirmar gasto'}
                </span>
              </>
            )}
          </button>

        </div>
      </div>
    </div>
  )
}

// ── Toast System ──────────────────────────────────────────────────────────────

const TOAST_DURATION = 3500

const TOAST_COLORS = {
  error:   { bg: 'color-mix(in srgb, var(--accent-rose)  12%, var(--bg-card))', border: 'color-mix(in srgb, var(--accent-rose)  35%, transparent)', text: 'var(--accent-rose)',  bar: 'var(--accent-rose)',  Icon: AlertCircle },
  success: { bg: 'color-mix(in srgb, var(--accent-green) 12%, var(--bg-card))', border: 'color-mix(in srgb, var(--accent-green) 35%, transparent)', text: 'var(--accent-green)', bar: 'var(--accent-green)', Icon: CheckCircle },
  warning: { bg: 'color-mix(in srgb, var(--accent-terra) 12%, var(--bg-card))', border: 'color-mix(in srgb, var(--accent-terra) 35%, transparent)', text: 'var(--accent-terra)', bar: 'var(--accent-terra)', Icon: Info },
}

function ToastDisplay() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    function handler(e) {
      const { msg, type } = e.detail
      const id = Date.now() + Math.random()
      setToasts(p => [...p.slice(-3), { id, msg, type }]) // máximo 4 toasts
      setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), TOAST_DURATION)
    }
    window.addEventListener('ff-toast', handler)
    return () => window.removeEventListener('ff-toast', handler)
  }, [])

  function dismiss(id) {
    setToasts(p => p.filter(t => t.id !== id))
  }

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 left-0 right-0 z-[999] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {toasts.map(t => {
        const c = TOAST_COLORS[t.type] || TOAST_COLORS.error
        return (
          <div key={t.id}
            onClick={() => dismiss(t.id)}
            className="flex flex-col rounded-2xl shadow-lg animate-enter pointer-events-auto overflow-hidden cursor-pointer active:scale-95 transition-transform"
            style={{ background: c.bg, border: `1px solid ${c.border}`, maxWidth: 380, width: '100%' }}>
            <div className="flex items-center gap-3 px-4 pt-3 pb-2.5">
              <c.Icon size={16} style={{ color: c.text, flexShrink: 0 }} />
              <p className="text-xs font-semibold flex-1" style={{ color: c.text }}>{t.msg}</p>
              <X size={12} style={{ color: c.text, opacity: 0.5, flexShrink: 0 }} />
            </div>
            {/* Barra de progreso que drena en TOAST_DURATION ms */}
            <div className="h-[2px] w-full" style={{ background: `color-mix(in srgb, ${c.bar} 15%, transparent)` }}>
              <div className="h-full toast-drain" style={{
                background: c.bar,
                animationDuration: `${TOAST_DURATION}ms`,
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── AppShell ──────────────────────────────────────────────────────────────────

export default function AppShell({ children }) {
  const [fabOpen, setFabOpen] = useState(false)
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme);
  const [authReady, setAuthReady] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [nombreHogar, setNombreHogar] = useState('')
  const [perfilUsuario, setPerfilUsuario] = useState(null)
  const router = useRouter()

 function avatarColor(nombre) {
  // Si no hay colores en el tema por alguna razón, devolvemos un color por defecto
  if (!themeColors || themeColors.length === 0) return '#cccccc';
  
  // Si no hay nombre, devuelve el primer color del tema
  if (!nombre) return themeColors[0];
  
  let h = 0;
  for (let i = 0; i < nombre.length; i++) {
    h = (h * 31 + nombre.charCodeAt(i)) & 0x7fffffff;
  }
  
  // Devuelve un color dinámico basado en los colores de tu tema actual
  return themeColors[h % themeColors.length];
}

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session) router.replace('/login')
        else {
          setAuthReady(true)
          getMisPermisos().then(({ data }) => {
            if (data?.nombre_hogar) setNombreHogar(data.nombre_hogar)
            if (data) setPerfilUsuario(data)
          })
        }
      })
      .catch(() => router.replace('/login'))
  }, [])

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
      <ProfilePanel open={showProfile} onClose={() => setShowProfile(false)} onLogout={() => { setShowProfile(false); setConfirmLogout(true) }} />
      <div className="hidden lg:block fixed left-0 top-0 h-full z-[70]"><Sidebar /></div>
      <main className="app-main flex-1 min-h-screen flex flex-col overflow-x-hidden">

        {/* Header móvil */}
        <div className="lg:hidden sticky top-0 z-50 w-full" style={{
          background: 'color-mix(in srgb, var(--bg-primary) 75%, transparent)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
              <span className="font-script text-[25px]" style={{
                color: 'var(--text-primary)',
                maxWidth: '55vw',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'block',
              }}>{nombreHogar || 'Mi Familia'}</span>
            </div>
            <div className="flex items-center gap-3">
              {perfilUsuario && (
                <button
                  onClick={() => setShowProfile(true)}
                  className="active:scale-90 transition-transform"
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: avatarColor(perfilUsuario?.nombre || ''),
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700, color: '#fff',
                    userSelect: 'none', flexShrink: 0,
                  }}
                  aria-label="Perfil"
                >
                  {(perfilUsuario?.nombre || '?').charAt(0).toUpperCase()}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 p-4 md:p-10 lg:p-12 max-w-[1600px] mx-auto w-full flex-1 pb-24 lg:pb-12">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      <BottomNav onFABClick={() => setFabOpen(true)} />
      {/* FAB flotante arrastrable — solo desktop, oculto cuando el modal está abierto */}
      {!fabOpen && (
        <div className="hidden lg:block">
          <DraggableFAB onClick={() => setFabOpen(true)} />
        </div>
      )}
      {fabOpen && <FABModal onClose={() => setFabOpen(false)} />}
      <ConfirmLogoutModal
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={handleLogout}
      />
    </div>
  )
}