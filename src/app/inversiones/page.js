'use client'
import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card, ProgressBar } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import {
  Plus, Minus, Loader2, Trash2, Pencil,
  TrendingUp, Target, Wallet, Sparkles,
  AlertCircle, PlusCircle, History, Info,
  ChevronRight, SlidersHorizontal, X
} from 'lucide-react'
import { formatCurrency, calculateCompoundInterest } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { useTheme, getThemeColors } from '@/lib/themes'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'

// ─── Tooltip del gráfico ─────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, colores }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: colores.card,
      border: `1px solid ${colores.border}`,
      borderRadius: 12,
      padding: '8px 12px',
    }}>
      <p style={{ fontSize: 9, fontWeight: 800, color: colores.muted, textTransform: 'uppercase', marginBottom: 4 }}>
        Año {label}
      </p>
      {payload.map(p => (
        <p key={p.name} style={{ fontSize: 11, fontWeight: 800, color: p.color }}>
          {p.name === 'contributed' ? 'Aportado' : p.name === 'simBalance' ? 'Simulado' : 'Balance'}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

// ─── Tooltip Regla del 4% ─────────────────────────────────────────────────────
function Tooltip4Pct({ colores }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="ml-1 rounded-full flex items-center justify-center transition-all"
        style={{ color: colores.muted, width: 16, height: 16 }}
        aria-label="Qué es la regla del 4%"
      >
        <Info size={12} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-70 w-64 p-3 rounded-xl shadow-2xl text-left"
            style={{
              background: colores.card,
              border: `1px solid ${colores.border}`,
            }}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: colores.green }}>
              Regla del 4% · Trinity Study
            </p>
            <p className="text-[10px] leading-relaxed" style={{ color: colores.muted }}>
              Puedes empezar a retirar cuando tu cartera valga <strong>tus gastos anuales multiplicados por 25</strong>.
              Ej: si gastas $1.000/mes → necesitas $300.000 invertidos ($12.000 × 25).
              Desde ese momento, retiras el 4% fijo del capital inicial cada año y la cartera
              dura al menos 30 años con ~95% de probabilidad histórica.
            </p>
            <p className="text-[10px] mt-2 leading-relaxed" style={{ color: colores.muted }}>
              ⚠️ Solo aplica a carteras diversificadas (acciones + bonos). No garantiza el futuro.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

function fechaHoy() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── Modal de ayuda del módulo ────────────────────────────────────────────────
function ModuleInfoModal({ open, onClose, colores }) {
  const secciones = [
    {
      emoji: '📂',
      titulo: 'Carteras de inversión',
      texto: 'Cada cartera es un vehículo de inversión (ETF, fondo, cuenta, etc.). Define su capital actual, el aporte mensual planeado y la tasa anual de crecimiento esperada.',
    },
    {
      emoji: '📈',
      titulo: 'Proyección con interés compuesto',
      texto: 'El gráfico muestra cómo crecería tu cartera año a año reinvirtiendo las ganancias (efecto bola de nieve). La línea sólida es el balance proyectado; la discontinua, lo que habrías aportado tú.',
    },
    {
      emoji: '🏦',
      titulo: 'Regla del 4%',
      texto: 'Estima cuánto podrías retirar anualmente de forma sostenible sin agotar la cartera en 30 años. Sirve de referencia para saber cuándo podrías vivir de tus inversiones.',
    },
    {
      emoji: '🔢',
      titulo: 'Vista "Todas las carteras"',
      texto: 'Con más de una cartera, el chip "Todas" suma capitales, proyecciones y gráfico de todas al mismo tiempo para una vista global de tu patrimonio.',
    },
    {
      emoji: '💸',
      titulo: 'Registrar un aporte',
      texto: 'Toca el botón "+" en el detalle de una cartera para registrar cuánto aportaste realmente este mes. Si configuraste un % mensual en Ajustes, el monto se auto-rellena.',
    },
    {
      emoji: '🎛️',
      titulo: 'Simulador',
      texto: 'Ajusta el aporte, la tasa y los años para explorar distintos escenarios futuros sin modificar los datos reales de la cartera.',
    },
    {
      emoji: '⚙️',
      titulo: '% mensual en presupuesto',
      texto: 'En Ajustes → Inversiones puedes asignar qué porcentaje del presupuesto de inversiones va a cada cartera. Eso calcula el aporte sugerido automáticamente al registrar.',
    },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Cómo usar Inversiones">
      <p className="text-xs leading-relaxed mb-5" style={{ color: colores.muted }}>
        Este módulo proyecta el crecimiento de tus inversiones con interés compuesto y te ayuda a visualizar cuándo podrías alcanzar la libertad financiera.
      </p>
      <div className="flex flex-col gap-5">
        {secciones.map(s => (
          <div key={s.titulo} className="flex gap-3 items-start">
            <span className="text-base flex-shrink-0 mt-0.5">{s.emoji}</span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-primary)' }}>
                {s.titulo}
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: colores.muted }}>
                {s.texto}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 px-4 py-3 rounded-xl text-[10px] leading-relaxed text-center"
        style={{
          background: `color-mix(in srgb, ${colores.violet} 8%, transparent)`,
          border: `1px solid color-mix(in srgb, ${colores.violet} 20%, transparent)`,
          color: colores.muted,
        }}>
        ⚠️ Las proyecciones son estimaciones basadas en tasas constantes. El rendimiento real puede variar. No constituyen asesoramiento financiero.
      </div>
    </Modal>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function InversionesPage() {
  const { theme } = useTheme()

  const [inversiones, setInversiones] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [presupuesto, setPresupuesto] = useState(null)
  const [gastosMes, setGastosMes] = useState(0)
  const [aportesEsteMes, setAportesEsteMes] = useState(0)
  const [traspasosDeInv, setTraspasosDeInv] = useState(0)
  const [sobreMovsInv, setSobreMovsInv] = useState([])
  const [detallePres, setDetallePres] = useState(false)
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [modalAporte, setModalAporte] = useState(false)
  const [formAporte, setFormAporte] = useState({ monto: '', descripcion: '', fecha: fechaHoy() })
  const [savingAporte, setSavingAporte] = useState(false)

  // ── Info modal ────────────────────────────────────────────────────────────
  const [showInfo, setShowInfo] = useState(false)

  // ── NUEVO: controla si el monto fue auto-rellenado por el sistema ─────────
  const [autoFilled, setAutoFilled] = useState(false)

  // ── Retiro de capital ─────────────────────────────────────────────────────
  const [modalRetiro, setModalRetiro] = useState(false)
  const [formRetiro, setFormRetiro] = useState({ monto: '' })
  const [savingRetiro, setSavingRetiro] = useState(false)

  // ── Historial de aportes ──────────────────────────────────────────────────
  const [modalHistorial, setModalHistorial] = useState(false)
  const [historialAportes, setHistorialAportes] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)

  // ── Simulador ─────────────────────────────────────────────────────────────
  const [showSimulador, setShowSimulador] = useState(false)
  const [simAporte, setSimAporte] = useState(0)
  const [simTasa, setSimTasa] = useState(0)
  const [simAnos, setSimAnos] = useState(10)

  const [colores, setColores] = useState({
    green: '', rose: '', blue: '', terra: '', violet: '',
    muted: '', border: '', card: '', track: '',
  })
  const [form, setForm] = useState({
    nombre: '', emoji: '📈', capital: '',
    aporteReal: '',
    aporte: '',
    tasa: '', anos: '10', color: '', bola_nieve: true, pct_mensual: '',
  })

  useEffect(() => {
    function leer() {
      const s = getComputedStyle(document.documentElement)
      const v = (n) => s.getPropertyValue(n).trim()
      setColores({
        green: v('--accent-green'),
        rose: v('--accent-rose'),
        blue: v('--accent-blue'),
        terra: v('--accent-terra'),
        violet: v('--accent-violet'),
        muted: v('--text-muted'),
        border: v('--border-glass'),
        card: v('--bg-card'),
        track: v('--progress-track'),
      })
    }
    leer()
    window.addEventListener('theme-change', leer)
    return () => window.removeEventListener('theme-change', leer)
  }, [])

  const themeColors = getThemeColors(theme)

  useEffect(() => {
    if (themeColors.length && form.color && !themeColors.includes(form.color)) {
      setForm(f => ({ ...f, color: themeColors[0] }))
    }
    if (!form.color && themeColors.length) {
      setForm(f => ({ ...f, color: themeColors[0] }))
    }
  }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargar()
    getPresupuestoMes().then(setPresupuesto)
    cargarGastosMes()
    cargarAportesEsteMes()
  }, [])

  // Sincronizar simulador cuando cambia selected
  useEffect(() => {
    if (selected) {
      setSimAporte(selected.aporte || 0)
      setSimTasa(selected.tasa || 0)
      setSimAnos(selected.anos || 10)
    }
  }, [selected?.id, selected?.aporte, selected?.tasa, selected?.anos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── SMART-FILL: auto-rellenar monto al abrir el modal ─────────────────────
  // Regla: pct_mensual de la cartera aplicado sobre presupuesto.montoInversiones
  useEffect(() => {
    if (!modalAporte) {
      // Al cerrar, limpiar estado para no contaminar la siguiente apertura
      setAutoFilled(false)
      return
    }
    // Siempre inicializar fecha con hoy al abrir
    setFormAporte(p => ({ ...p, fecha: fechaHoy() }))
    const pct = selected?.pct_mensual
    const base = presupuesto?.montoInversiones
    if (pct > 0 && base > 0) {
      const sugerido = parseFloat(((base * pct) / 100).toFixed(2))
      if (!isNaN(sugerido) && sugerido > 0) {
        setFormAporte(p => ({ ...p, monto: sugerido.toString() }))
        setAutoFilled(true)
      }
    }
  }, [modalAporte, presupuesto?.montoInversiones, selected?.pct_mensual]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarGastosMes() {
    const now = new Date()
    // Usamos solo meses completos (excluye el mes en curso, que está incompleto)
    const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1)
    const inicio3Meses = new Date(now.getFullYear(), now.getMonth() - 3, 1)

    const { data, error } = await supabase
      .from('movimientos')
      .select('monto, categoria, fecha')
      .eq('tipo', 'egreso')
      .in('categoria', ['basicos', 'deseo']) // excluye deuda (gasto temporal)
      .gte('fecha', inicio3Meses.toISOString().slice(0, 10))
      .lt('fecha', inicioMesActual.toISOString().slice(0, 10))

    if (error) { console.error(error); return }

    // Agrupar por mes y promediar
    const porMes = {}
    ;(data || []).forEach(m => {
      const key = m.fecha.slice(0, 7) // 'YYYY-MM'
      porMes[key] = (porMes[key] || 0) + parseFloat(m.monto || 0)
    })
    const meses = Object.values(porMes)
    if (!meses.length) return
    setGastosMes(meses.reduce((s, v) => s + v, 0) / meses.length)
  }

  async function cargarAportesEsteMes() {
    const now = new Date()
    const mes = now.getMonth() + 1
    const año = now.getFullYear()
    const inicioMes = new Date(año, mes - 1, 1).toISOString().slice(0, 10)
    const inicioSig = new Date(año, mes, 1).toISOString().slice(0, 10)
    // Solo aportes directos del presupuesto de inversiones.
    // Los sobrantes del sobre (descripcion 'Sobrante sobre →') vienen del bloque Estilo,
    // no del presupuesto de inversiones, así que no cuentan como "comprometido".
    const [{ data: movs }, { data: sobreMovs }] = await Promise.all([
      supabase.from('movimientos').select('monto')
        .eq('tipo', 'egreso').eq('categoria', 'inversion')
        .not('inversion_id', 'is', null)
        .not('descripcion', 'like', 'Sobrante sobre%')
        .gte('fecha', inicioMes).lt('fecha', inicioSig),
      supabase.from('sobre_movimientos').select('monto, fecha, origen, destino, descripcion')
        .eq('mes', mes).eq('año', año)
        .or('origen.eq.inversiones,and(origen.eq.sobre,destino.eq.inversiones)'),
    ])
    setAportesEsteMes((movs || []).reduce((s, m) => s + parseFloat(m.monto || 0), 0))
    const traspasos = (sobreMovs || []).filter(m => m.origen === 'inversiones')
    setTraspasosDeInv(traspasos.reduce((s, m) => s + parseFloat(m.monto || 0), 0))
    setSobreMovsInv(sobreMovs || [])
  }

  async function cargar() {
    setLoading(true)
    const { data, error } = await supabase.from('inversiones').select('*').order('created_at')
    if (error) setError(error.message)
    else {
      setInversiones(data || [])
      if (data?.length) setSelected(data[0])
    }
    setLoading(false)
  }

  async function cargarHistorial(inversionId) {
    setLoadingHistorial(true)
    const { data, error } = await supabase
      .from('movimientos')
      .select('id, monto, descripcion, fecha')
      .eq('tipo', 'egreso')
      .eq('categoria', 'inversion')
      .eq('inversion_id', inversionId)
      .order('fecha', { ascending: false })
    if (!error) setHistorialAportes(data || [])
    setLoadingHistorial(false)
  }

  async function handleDeleteAporte(movId, monto) {
    if (!confirm('¿Eliminar este aporte? Se restará del capital actual.')) return
    const nuevoCapital = Math.max(0, (selected.capital || 0) - monto)

    const { error: errInv } = await supabase
      .from('inversiones').update({ capital: nuevoCapital }).eq('id', selected.id)
    if (errInv) { toast('Error al actualizar capital', 'error'); return }

    const { error: errMov } = await supabase.from('movimientos').delete().eq('id', movId)
    if (errMov) {
      await supabase.from('inversiones').update({ capital: selected.capital }).eq('id', selected.id)
      toast('Error al eliminar el aporte', 'error'); return
    }

    const updated = { ...selected, capital: nuevoCapital }
    setInversiones(prev => prev.map(i => i.id === selected.id ? updated : i))
    setSelected(updated)
    setHistorialAportes(prev => prev.filter(a => a.id !== movId))
    cargarAportesEsteMes()
    toast(`Aporte de ${formatCurrency(monto)} eliminado`, 'success')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const payload = {
      nombre: form.nombre,
      emoji: form.emoji,
      capital: parseFloat(form.capital) || 0,
      aporte_real: parseFloat(form.aporteReal) || 0,
      aporte: parseFloat(form.aporte) || 0,
      tasa: parseFloat(form.tasa) || 0,
      anos: parseInt(form.anos) || 10,
      color: form.color,
      bola_nieve: form.bola_nieve,
      pct_mensual: parseFloat(form.pct_mensual) || 0,
    }

    if (editandoId) {
      const { error } = await supabase.from('inversiones').update(payload).eq('id', editandoId)
      if (error) { setError(error.message); setSaving(false); return }
      setInversiones(prev => prev.map(i => i.id === editandoId ? { ...i, ...payload } : i))
      if (selected?.id === editandoId) setSelected(prev => ({ ...prev, ...payload }))
    } else {
      const { data, error } = await supabase.from('inversiones').insert([payload]).select()
      if (error) { setError(error.message); setSaving(false); return }
      setInversiones(prev => [...prev, data[0]])
      setSelected(data[0])
    }

    setSaving(false)
    setModal(false)
    setEditandoId(null)
    setForm({ nombre: '', emoji: '📈', capital: '', aporteReal: '', aporte: '', tasa: '', anos: '10', color: themeColors[0] || '', bola_nieve: true, pct_mensual: '' })
  }

  function abrirNuevo() {
    setEditandoId(null)
    setForm({ nombre: '', emoji: '📈', capital: '', aporteReal: '', aporte: '', tasa: '', anos: '10', color: themeColors[0] || '', bola_nieve: true, pct_mensual: '' })
    setModal(true)
  }

  function abrirEdicion(inv) {
    setEditandoId(inv.id)
    setForm({
      nombre: inv.nombre || '',
      emoji: inv.emoji || '📈',
      capital: inv.capital?.toString() || '',
      aporteReal: inv.aporte_real?.toString() || '',
      aporte: inv.aporte?.toString() || '',
      tasa: inv.tasa?.toString() || '',
      anos: inv.anos?.toString() || '10',
      color: inv.color || themeColors[0] || '',
      bola_nieve: inv.bola_nieve !== false,
      pct_mensual: inv.pct_mensual?.toString() || '',
    })
    setModal(true)
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta cartera?')) return
    setSaving(true)
    setError(null)

    const { error: errMovs } = await supabase.from('movimientos').delete().eq('inversion_id', id)
    if (errMovs) {
      setError('Error al borrar movimientos asociados: ' + errMovs.message)
      setSaving(false)
      return
    }

    const { error } = await supabase.from('inversiones').delete().eq('id', id)
    if (!error) {
      const resto = inversiones.filter(i => i.id !== id)
      setInversiones(resto)
      setSelected(resto[0] || null)
    } else {
      setError(error.message)
    }
    setSaving(false)
  }

  async function handleAddAporte(e) {
    e.preventDefault()
    const monto = parseFloat(formAporte.monto)
    if (!monto || monto <= 0) return
    setSavingAporte(true)
    setError(null)

    const nuevoCapital = (selected.capital || 0) + monto
    const fecha = formAporte.fecha || new Date().toISOString().slice(0, 10)

    const { error: errInv } = await supabase
      .from('inversiones')
      .update({ capital: nuevoCapital })
      .eq('id', selected.id)

    if (errInv) { setError(errInv.message); setSavingAporte(false); return }

    await supabase.from('movimientos').insert([{
      tipo: 'egreso',
      categoria: 'inversion',
      monto,
      descripcion: formAporte.descripcion || `Aporte a ${selected.nombre}`,
      fecha, quien: 'Ambos',
      inversion_id: selected.id,
    }])

    const updated = { ...selected, capital: nuevoCapital }
    setInversiones(prev => prev.map(i => i.id === selected.id ? updated : i))
    setSelected(updated)
    setSavingAporte(false)
    setModalAporte(false)
    setFormAporte({ monto: '', descripcion: '', fecha: fechaHoy() })
    setAutoFilled(false)
    cargarAportesEsteMes()
    toast(`Aporte de ${formatCurrency(monto)} registrado`, 'success')
  }

  async function handleRetirarInversion(e) {
    e.preventDefault()
    const monto = parseFloat(formRetiro.monto)
    if (!monto || monto <= 0 || !selected) return
    if (monto > (selected.capital || 0)) { setError('No puedes retirar más del capital disponible'); return }
    setSavingRetiro(true)

    const nuevoCapital = (selected.capital || 0) - monto
    const { error: errInv } = await supabase.from('inversiones').update({ capital: nuevoCapital }).eq('id', selected.id)
    if (errInv) { setError(errInv.message); setSavingRetiro(false); return }

    await supabase.from('movimientos').insert([{
      tipo: 'retiro', categoria: 'inversion',
      descripcion: `Retiro: ${selected.nombre}`,
      monto, fecha: fechaHoy(), quien: 'Ambos',
      inversion_id: selected.id,
    }])

    const updated = { ...selected, capital: nuevoCapital }
    setInversiones(prev => prev.map(i => i.id === selected.id ? updated : i))
    setSelected(updated)
    setSavingRetiro(false)
    setModalRetiro(false)
    setFormRetiro({ monto: '' })
    toast(`Retiro de ${formatCurrency(monto)} registrado`, 'success')
  }

  // ── MEMOS ─────────────────────────────────────────────────────────────────

  const calc = useMemo(() =>
    selected
      ? calculateCompoundInterest({
        principal: selected.capital,
        monthlyContribution: selected.aporte,
        annualRate: selected.tasa,
        years: selected.anos,
        compound: selected.bola_nieve !== false,
      })
      : null
    , [selected])

  const calcSim = useMemo(() => {
    if (!selected) return null
    const changed = simAporte !== (selected.aporte || 0) ||
      simTasa !== (selected.tasa || 0) ||
      simAnos !== (selected.anos || 10)
    if (!changed) return null
    return calculateCompoundInterest({
      principal: selected.capital,
      monthlyContribution: simAporte,
      annualRate: simTasa,
      years: simAnos,
      compound: selected.bola_nieve !== false,
    })
  }, [selected, simAporte, simTasa, simAnos])

  const historyData = useMemo(() => {
    const base = calc?.history?.filter(d => d?.year != null) || []
    if (!calcSim) return base
    const simMap = {}
    calcSim.history?.forEach(d => { if (d?.year != null) simMap[d.year] = d.balance })
    return base.map(d => ({ ...d, simBalance: simMap[d.year] ?? null }))
  }, [calc, calcSim])

  const calcsPorInversion = useMemo(() =>
    inversiones.map(inv => ({
      id: inv.id,
      calc: calculateCompoundInterest({
        principal: inv.capital,
        monthlyContribution: inv.aporte,
        annualRate: inv.tasa,
        years: inv.anos,
        compound: inv.bola_nieve !== false,
      })
    }))
    , [inversiones])

  const combinedHistory = useMemo(() => {
    if (!calcsPorInversion.length) return []
    const maxYear = Math.max(...inversiones.map(i => i.anos || 10))
    const result = []
    for (let y = 0; y <= maxYear; y++) {
      let balance = 0
      let contributed = 0
      calcsPorInversion.forEach(({ calc: c, id }) => {
        const inv = inversiones.find(i => i.id === id)
        const cap = inv?.anos || 10
        const entry = c?.history?.find(h => h.year === Math.min(y, cap))
        if (entry) { balance += entry.balance; contributed += entry.contributed }
      })
      result.push({ year: y, balance, contributed })
    }
    return result
  }, [calcsPorInversion, inversiones])

  const totalCapital = useMemo(() => inversiones.reduce((s, i) => s + (i.capital || 0), 0), [inversiones])
  const totalAportes = useMemo(() => inversiones.reduce((s, i) => s + (i.aporte || 0), 0), [inversiones])
  const totalProyectado = useMemo(() =>
    calcsPorInversion.reduce((s, { calc: c }) => s + (c?.finalBalance || 0), 0)
    , [calcsPorInversion])

  // Horizonte común: todas las carteras proyectadas al año más lejano entre ellas
  const maxAnosCarteras = useMemo(() =>
    inversiones.length ? Math.max(...inversiones.map(i => i.anos || 10)) : 10
    , [inversiones])
  // Balance combinado al horizonte común (para libertad financiera — misma unidad de tiempo)
  const totalProyectadoCombinado = useMemo(() =>
    combinedHistory[combinedHistory.length - 1]?.balance || 0
    , [combinedHistory])

  const gananciaInteres = useMemo(() =>
    inversiones.reduce((s, inv, idx) => {
      const finalBalance = calcsPorInversion[idx]?.calc?.finalBalance || 0
      const totalMetido = (inv.capital || 0) + (inv.aporte || 0) * (inv.anos || 0) * 12
      return s + Math.max(0, finalBalance - totalMetido)
    }, 0)
    , [inversiones, calcsPorInversion])

  const baseGastos = useMemo(() => {
    if (gastosMes > 0) return gastosMes
    const fallback = (presupuesto?.montoNecesidades || 0) + (presupuesto?.montoEstilo || 0)
    return fallback > 0 ? fallback : 0
  }, [gastosMes, presupuesto])

  const metaLibertad = baseGastos > 0 ? baseGastos * 12 * 25 : null

  const calcPreview = useMemo(() => {
    if (!form.capital || !form.tasa || !form.anos) return null
    return calculateCompoundInterest({
      principal: parseFloat(form.capital) || 0,
      monthlyContribution: parseFloat(form.aporte) || 0,
      annualRate: parseFloat(form.tasa) || 0,
      years: parseInt(form.anos) || 10,
      compound: form.bola_nieve,
    })
  }, [form.capital, form.aporte, form.tasa, form.anos, form.bola_nieve])

  const TooltipConColores = (props) => <CustomTooltip {...props} colores={colores} />

  // ─── Helpers internos ─────────────────────────────────────────────────────

  /** Formatea con la misma moneda en todo el modal */
  function fmt(n) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
  }

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  return (
    <AppShell>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0 flex items-center gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: colores.muted }}>Módulo</p>
            <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Inversiones</h1>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="flex-shrink-0 flex items-center justify-center rounded-full transition-all"
            style={{
              width: 28, height: 28,
              background: `color-mix(in srgb, ${colores.violet} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${colores.violet} 25%, transparent)`,
              color: colores.violet,
            }}
            aria-label="Cómo usar este módulo"
          >
            <Info size={13} />
          </button>
        </div>
        <button onClick={abrirNuevo} className="ff-btn-primary flex items-center gap-2 flex-shrink-0">
          <Plus size={16} strokeWidth={3} />
          <span className="hidden sm:inline text-sm font-semibold">Nueva cartera</span>
        </button>
      </div>

      {/* Modal de ayuda */}
      <ModuleInfoModal open={showInfo} onClose={() => setShowInfo(false)} colores={colores} />

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2"
          style={{
            background: `color-mix(in srgb, ${colores.rose} 10%, transparent)`,
            border: `1px solid color-mix(in srgb, ${colores.rose} 25%, transparent)`,
            color: colores.rose,
          }}>
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Barra de presupuesto para inversiones */}
      {presupuesto?.montoInversiones > 0 && (() => {
        const presupuestado = presupuesto.montoInversiones
        const comprometido = aportesEsteMes + traspasosDeInv
        const disponible = presupuestado - comprometido
        const pct = Math.min(100, (comprometido / presupuestado) * 100)
        const sobrePasado = comprometido > presupuestado
        const trackColor = sobrePasado ? colores.rose : colores.violet
        const traspasos = sobreMovsInv.filter(m => m.origen === 'inversiones')
        const sobrantes = sobreMovsInv.filter(m => m.origen === 'sobre')
        const hayDetalle = sobreMovsInv.length > 0
        return (
          <div className="mb-5 rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
            {/* Cabecera clickable */}
            <button
              onClick={() => hayDetalle && setDetallePres(p => !p)}
              className="w-full px-4 py-3 text-left"
              style={{ background: 'none', border: 'none', cursor: hayDetalle ? 'pointer' : 'default' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: 'var(--text-muted)' }}>
                  Presupuesto mensual
                  {hayDetalle && (
                    <ChevronRight size={10} style={{
                      color: 'var(--text-muted)',
                      transform: detallePres ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s',
                    }} />
                  )}
                </span>
                <span className="text-[11px] font-bold tabular-nums"
                  style={{ color: sobrePasado ? colores.rose : colores.green }}>
                  {sobrePasado ? '−' : ''}{formatCurrency(Math.abs(disponible))} {sobrePasado ? 'excedido' : 'libre'}
                </span>
              </div>
              <div className="w-full h-1 rounded-full mb-1.5" style={{ background: 'var(--progress-track)' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: trackColor }} />
              </div>
              <div className="flex justify-between">
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {formatCurrency(comprometido)} usado
                </span>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {formatCurrency(presupuestado)} total
                </span>
              </div>
            </button>
            {/* Detalle expandible — solo movimientos del sobre */}
            {detallePres && hayDetalle && (
              <div className="px-4 pb-3 space-y-1"
                style={{ borderTop: '1px solid var(--border-glass)' }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider pt-2.5 mb-1.5"
                  style={{ color: 'var(--text-muted)' }}>Movimientos del sobre</p>
                {traspasos.map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: `color-mix(in srgb, ${colores.rose} 10%, transparent)`, color: colores.rose }}>
                        usado en sobre
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold tabular-nums" style={{ color: colores.rose }}>
                      −{formatCurrency(m.monto)}
                    </span>
                  </div>
                ))}
                {sobrantes.map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: `color-mix(in srgb, ${colores.green} 10%, transparent)`, color: colores.green }}>
                        sobrante del sobre
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        {m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold tabular-nums" style={{ color: colores.green }}>
                      +{formatCurrency(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Panel de distribución por cartera */}
      {presupuesto?.montoInversiones > 0 && inversiones.length > 0 && (() => {
        const totalPct = inversiones.reduce((s, i) => s + (i.pct_mensual || 0), 0)
        const librePct = 100 - totalPct
        const sobreasignado = totalPct > 100
        return (
          <div className="mb-5 rounded-[24px] overflow-hidden"
            style={{
              border: `1px solid ${sobreasignado
                ? `color-mix(in srgb, ${colores.rose} 35%, transparent)`
                : 'color-mix(in srgb, var(--accent-violet) 20%, transparent)'}`,
            }}>
            {/* Cabecera */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: `color-mix(in srgb, var(--accent-violet) 6%, var(--bg-secondary))` }}>
              <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Distribución por cartera
              </p>
              {sobreasignado ? (
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1"
                  style={{ color: colores.rose, background: `color-mix(in srgb, ${colores.rose} 12%, transparent)` }}>
                  <AlertCircle size={9} /> {totalPct}% · excede 100%
                </span>
              ) : (
                <span className="text-[9px] font-semibold" style={{ color: 'var(--accent-violet)' }}>
                  {totalPct}% asignado
                </span>
              )}
            </div>

            {/* Fila por cartera */}
            <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
              {inversiones.map(inv => {
                const euros = ((inv.pct_mensual || 0) / 100) * presupuesto.montoInversiones
                return (
                  <div key={inv.id} className="flex items-center gap-3 px-4 py-2.5"
                    style={{ background: 'var(--bg-card)' }}>
                    <span className="text-base flex-shrink-0">{inv.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {inv.nombre}
                      </p>
                      {/* Mini barra proporcional */}
                      <div className="mt-1 h-1 rounded-full overflow-hidden w-full" style={{ background: 'var(--progress-track)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (inv.pct_mensual || 0))}%`,
                            background: inv.color,
                          }} />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold" style={{ color: inv.color }}>
                        {inv.pct_mensual > 0 ? `${inv.pct_mensual}%` : '—'}
                      </p>
                      {inv.pct_mensual > 0 && (
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                          {formatCurrency(euros)}/mes
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pie: sin asignar o alerta */}
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ background: 'var(--bg-secondary)', borderTop: `1px solid var(--border-glass)` }}>
              {sobreasignado ? (
                <p className="text-[9px] font-semibold w-full text-center" style={{ color: colores.rose }}>
                  Reduce los porcentajes para que no superen 100%
                </p>
              ) : (
                <>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                    {librePct > 0 ? `${librePct}% sin asignar` : 'Todo asignado'}
                  </span>
                  {librePct > 0 && (
                    <span className="text-[9px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                      {formatCurrency((librePct / 100) * presupuesto.montoInversiones)}/mes libre
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Stats globales */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {[
          { label: 'Capital real', value: formatCurrency(totalCapital), color: colores.green },
          { label: 'Aportado este mes', value: formatCurrency(aportesEsteMes), color: colores.terra },
          { label: '★ Ganancia estimada', value: formatCurrency(gananciaInteres), color: colores.blue },
          { label: '★ Total proyectado', value: formatCurrency(totalProyectado), color: colores.violet },
        ].map((s, i) => (
          <div key={i} className="glass-card p-3 animate-enter" style={{ animationDelay: `${i * 0.05}s` }}>
            <p className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: colores.muted }}>{s.label}</p>
            <p className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Contenido principal */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={20} className="animate-spin" style={{ color: colores.muted }} />
        </div>
      ) : inversiones.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `color-mix(in srgb, ${colores.violet} 10%, transparent)` }}>
            <TrendingUp size={24} style={{ color: colores.violet }} />
          </div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Sin carteras registradas</p>
          <p className="text-xs" style={{ color: colores.muted }}>Crea tu primera cartera de inversión</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <button onClick={abrirNuevo} className="ff-btn-primary">Nueva cartera</button>
            <a href="/ajustes" className="ff-btn-ghost flex items-center justify-center gap-1"
              style={{ textDecoration: 'none' }}>
              Configurar categorías
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Selector de carteras */}
          <div className="space-y-2">
            {inversiones.length > 1 && (
              <div className="flex items-center gap-2 ml-1">
                <p className="text-[9px] font-semibold uppercase flex-1" style={{ color: colores.muted }}>
                  Carteras
                </p>
                <button
                  onClick={() => setSelected(null)}
                  className="px-3 py-1 rounded-xl text-[10px] font-bold transition-all"
                  style={{
                    background: selected === null
                      ? `color-mix(in srgb, ${colores.violet} 15%, var(--bg-card))`
                      : 'var(--bg-secondary)',
                    color: selected === null ? colores.violet : colores.muted,
                    border: selected === null
                      ? `1.5px solid color-mix(in srgb, ${colores.violet} 35%, transparent)`
                      : `1px solid ${colores.border}`,
                  }}>
                  Todas
                </button>
              </div>
            )}
            {inversiones.map(inv => {
              const c = calcsPorInversion.find(x => x.id === inv.id)?.calc
              const rendPct = inv.capital > 0 && c
                ? (((c.finalBalance - inv.capital) / inv.capital) * 100).toFixed(0)
                : null
              const isActive = selected?.id === inv.id

              return (
                <button
                  key={inv.id}
                  onClick={() => setSelected(inv)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all text-left"
                  style={{
                    background: isActive
                      ? `color-mix(in srgb, ${inv.color} 10%, var(--bg-card))`
                      : 'var(--bg-secondary)',
                    border: isActive
                      ? `1.5px solid color-mix(in srgb, ${inv.color} 35%, transparent)`
                      : `1px solid ${colores.border}`,
                  }}>

                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ background: `${inv.color}18` }}>
                    {inv.emoji}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate leading-tight"
                      style={{ color: isActive ? inv.color : 'var(--text-primary)' }}>
                      {inv.nombre}
                    </p>
                    <p className="text-[9px] mt-0.5" style={{ color: colores.muted }}>
                      {inv.tasa}% · {inv.anos}a · {inv.bola_nieve !== false ? '🔄' : '📤'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <p className="text-xs font-semibold" style={{ color: isActive ? inv.color : 'var(--text-primary)' }}>
                      {formatCurrency(inv.capital)}
                    </p>
                    {rendPct && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          color: colores.green,
                          background: `color-mix(in srgb, ${colores.green} 12%, transparent)`,
                        }}>
                        ×{(c.finalBalance / Math.max(1, inv.capital)).toFixed(1)} · +{rendPct}%
                      </span>
                    )}
                  </div>

                </button>
              )
            })}
          </div>

          {/* ── Vista combinada: Todas las carteras ── */}
          {selected === null && inversiones.length > 0 && (
            <Card className="animate-enter" style={{ padding: '16px' }}>

              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${colores.violet} 12%, transparent)` }}>
                  <TrendingUp size={20} style={{ color: colores.violet }} />
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                    Todas las carteras
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: colores.muted }}>
                    {inversiones.length} cartera{inversiones.length !== 1 ? 's' : ''} · {formatCurrency(totalAportes)}/mes
                  </p>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Capital total',   value: formatCurrency(totalCapital),    color: colores.blue   },
                  { label: 'Proyectado',       value: formatCurrency(totalProyectado), color: colores.violet },
                  { label: 'Ganancias netas',  value: formatCurrency(gananciaInteres), color: colores.terra  },
                ].map((k, i) => (
                  <div key={i} className="p-2.5 rounded-xl text-center"
                    style={{
                      background: `color-mix(in srgb, ${k.color} 8%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${k.color} 20%, transparent)`,
                    }}>
                    <p className="text-[8px] font-semibold uppercase mb-1" style={{ color: k.color }}>{k.label}</p>
                    <p className="text-sm font-semibold" style={{ color: k.color, letterSpacing: '-0.02em' }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Gráfico combinado */}
              {combinedHistory.length > 1 && (
                <div className="mb-4">
                  <p className="text-[9px] font-semibold uppercase mb-2 ml-1" style={{ color: colores.muted }}>
                    Proyección combinada
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={combinedHistory} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cgBalance" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colores.violet} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={colores.violet} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cgContrib" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colores.blue} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={colores.blue} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={colores.border} />
                      <XAxis dataKey="year" tick={{ fontSize: 9, fill: colores.muted }}
                        tickFormatter={y => `${y}a`} />
                      <YAxis tick={{ fontSize: 9, fill: colores.muted }} width={52}
                        tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip content={<TooltipConColores />} />
                      <Area type="monotone" dataKey="contributed" name="contributed"
                        stroke={colores.blue} strokeWidth={1.5} fill="url(#cgContrib)" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="balance" name="balance"
                        stroke={colores.violet} strokeWidth={2} fill="url(#cgBalance)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Regla del 4% global */}
              <div className="p-3 rounded-xl mb-4"
                style={{
                  background: `color-mix(in srgb, ${colores.green} 6%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${colores.green} 15%, transparent)`,
                }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={11} style={{ color: colores.green, flexShrink: 0 }} />
                  <p className="text-[9px] font-semibold uppercase" style={{ color: colores.green }}>
                    Retiro mensual sostenible (Regla del 4%)
                  </p>
                  <Tooltip4Pct colores={colores} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] mb-0.5" style={{ color: colores.muted }}>Hoy</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      {formatCurrency(totalCapital * 0.04 / 12)}<span className="text-[9px] font-medium opacity-60 ml-1">/mes</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] mb-0.5" style={{ color: colores.muted }}>En {maxAnosCarteras}a (proyectado)</p>
                    <p className="text-sm font-semibold" style={{ color: colores.green, letterSpacing: '-0.02em' }}>
                      {formatCurrency(totalProyectadoCombinado * 0.04 / 12)}<span className="text-[9px] font-medium opacity-60 ml-1">/mes</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Desglose por cartera — clicable para seleccionar */}
              <div className="space-y-1.5">
                <p className="text-[9px] font-semibold uppercase mb-2" style={{ color: colores.muted }}>
                  Desglose por cartera
                </p>
                {inversiones.map(inv => {
                  const c = calcsPorInversion.find(x => x.id === inv.id)?.calc
                  return (
                    <button key={inv.id} onClick={() => setSelected(inv)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                      style={{ background: 'var(--bg-secondary)', border: `1px solid ${colores.border}` }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: `${inv.color}18` }}>
                        {inv.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {inv.nombre}
                        </p>
                        <p className="text-[9px]" style={{ color: colores.muted }}>
                          {formatCurrency(inv.capital)} real · {inv.tasa}% · {inv.anos}a
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-semibold" style={{ color: inv.color }}>
                          {formatCurrency(c?.finalBalance || 0)}
                        </p>
                        <p className="text-[9px]" style={{ color: colores.muted }}>proyectado</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          {/* Detalle cartera seleccionada */}
          {selected && calc && (
            <Card className="animate-enter" style={{ padding: '16px' }}>

              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: `${selected.color}18` }}>
                    {selected.emoji}
                  </div>
                  <div>
                    <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {selected.nombre}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: colores.muted }}>
                      {selected.tasa}% anual · {selected.anos} años · +{formatCurrency(selected.aporte)}/mes
                      {' · '}
                      <span style={{ color: selected.bola_nieve !== false ? colores.green : colores.terra }}>
                        {selected.bola_nieve !== false ? '🔄 Bola de nieve' : '📤 Sin reinversión'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => { cargarHistorial(selected.id); setModalHistorial(true) }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                    title="Ver historial de aportes"
                    style={{
                      background: `color-mix(in srgb, ${colores.terra} 10%, transparent)`,
                      color: colores.terra,
                    }}>
                    <History size={13} />
                  </button>
                  <button onClick={() => setModalAporte(true)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                    title="Agregar aporte"
                    style={{
                      background: `color-mix(in srgb, ${colores.green} 10%, transparent)`,
                      color: colores.green,
                    }}>
                    <PlusCircle size={13} />
                  </button>
                  {(selected.capital || 0) > 0 && (
                    <button onClick={() => { setModalRetiro(true); setFormRetiro({ monto: '' }) }}
                      className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                      title="Retirar capital"
                      style={{
                        background: `color-mix(in srgb, ${colores.rose} 10%, transparent)`,
                        color: colores.rose,
                      }}>
                      <Minus size={13} />
                    </button>
                  )}
                  <button onClick={() => abrirEdicion(selected)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                    style={{
                      background: `color-mix(in srgb, ${colores.blue} 10%, transparent)`,
                      color: colores.blue,
                    }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => handleDelete(selected.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                    style={{
                      background: `color-mix(in srgb, ${colores.rose} 8%, transparent)`,
                      color: colores.rose,
                    }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: <Wallet size={12} />, label: 'Capital inicial', value: formatCurrency(selected.capital), color: colores.blue },
                  { icon: <TrendingUp size={12} />, label: 'Balance final', value: formatCurrency(calc.finalBalance), color: selected.color },
                  { icon: <Sparkles size={12} />, label: 'Ganancias netas', value: formatCurrency(calc.totalInterest), color: colores.terra },
                ].map((k, i) => (
                  <div key={i} className="p-2.5 rounded-xl text-center"
                    style={{
                      background: `color-mix(in srgb, ${k.color} 8%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${k.color} 20%, transparent)`,
                    }}>
                    <div className="flex items-center justify-center gap-1 mb-1" style={{ color: k.color }}>
                      {k.icon}
                      <p className="text-[8px] font-semibold uppercase">{k.label}</p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: k.color, letterSpacing: '-0.02em' }}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Aporte planeado vs real */}
              {(selected.aporte_real > 0) && (() => {
                const planeado = selected.aporte || 0
                const real = selected.aporte_real || 0
                const pct = planeado > 0 ? Math.min(140, Math.round((real / planeado) * 100)) : 100
                const cumple = real >= planeado
                const color = cumple ? colores.green : colores.rose
                return (
                  <div className="mb-4 px-3 py-2.5 rounded-xl"
                    style={{ background: 'var(--bg-secondary)', border: `1px solid ${colores.border}` }}>
                    <p className="text-[9px] font-semibold uppercase mb-2" style={{ color: colores.muted }}>
                      Aporte mensual
                    </p>
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <p className="text-[9px] mb-0.5" style={{ color: colores.muted }}>Planeado</p>
                        <p className="text-xs font-semibold" style={{ color: colores.blue }}>
                          {formatCurrency(planeado)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] mb-0.5" style={{ color: colores.muted }}>Diferencia</p>
                        <p className="text-xs font-semibold" style={{ color }}>
                          {real >= planeado ? '+' : ''}{formatCurrency(real - planeado)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] mb-0.5" style={{ color: colores.muted }}>Real</p>
                        <p className="text-xs font-semibold" style={{ color }}>
                          {formatCurrency(real)}
                        </p>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, pct)}%`, background: color }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px]" style={{ color: colores.muted }}>0</span>
                      <span className="text-[9px] font-semibold" style={{ color }}>
                        {pct}% del objetivo
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Multiplicador */}
              <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${selected.color} 8%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${selected.color} 20%, transparent)`,
                }}>
                <Target size={13} style={{ color: selected.color, flexShrink: 0 }} />
                <p className="text-[10px] font-semibold" style={{ color: selected.color }}>
                  Tu dinero se multiplica ×{(calc.finalBalance / (selected.capital || 1)).toFixed(1)} en {selected.anos} años
                </p>
                <span className="mx-auto sm:ml-auto sm:mr-0 text-[9px] font-semibold px-2 py-0.5 rounded-full block sm:inline-block text-center"
                  style={{
                    background: `color-mix(in srgb, ${selected.color} 15%, transparent)`,
                    color: selected.color,
                    whiteSpace: 'nowrap'
                  }}>
                  Int. Comp.
                </span>
              </div>

              {/* Simulador in-place */}
              <div className="mb-4">
                <button
                  onClick={() => setShowSimulador(s => !s)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: showSimulador
                      ? `color-mix(in srgb, ${colores.violet} 10%, transparent)`
                      : 'var(--bg-secondary)',
                    border: `1px solid ${showSimulador
                      ? `color-mix(in srgb, ${colores.violet} 30%, transparent)`
                      : colores.border}`,
                  }}>
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={13} style={{ color: showSimulador ? colores.violet : colores.muted }} />
                    <p className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: showSimulador ? colores.violet : colores.muted }}>
                      Simulador de escenarios
                    </p>
                  </div>
                  <span className="text-[9px] font-semibold" style={{ color: colores.muted }}>
                    {showSimulador ? 'Cerrar' : '¿Qué pasa si...?'}
                  </span>
                </button>

                {showSimulador && (
                  <div className="mt-3 p-3 rounded-xl space-y-3"
                    style={{
                      background: `color-mix(in srgb, ${colores.violet} 5%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${colores.violet} 15%, transparent)`,
                    }}>
                    <p className="text-[9px] font-semibold" style={{ color: colores.muted }}>
                      Ajusta los parámetros sin modificar tu cartera real. Verás el impacto en el gráfico.
                    </p>

                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] font-semibold" style={{ color: colores.muted }}>
                          Aporte mensual hipotético
                        </label>
                        <span className="text-[10px] font-bold" style={{ color: colores.violet }}>
                          {formatCurrency(simAporte)}
                        </span>
                      </div>
                      <input type="range" min={0} max={Math.max(2000, simAporte * 3)} step={25}
                        value={simAporte}
                        onChange={e => setSimAporte(Number(e.target.value))}
                        className="w-full accent-violet-400" />
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[9px]" style={{ color: colores.muted }}>€0</span>
                        <span className="text-[9px]" style={{ color: colores.muted }}>
                          actual: {formatCurrency(selected.aporte || 0)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] font-semibold" style={{ color: colores.muted }}>
                          Tasa anual hipotética
                        </label>
                        <span className="text-[10px] font-bold" style={{ color: colores.violet }}>
                          {simTasa}%
                        </span>
                      </div>
                      <input type="range" min={0} max={20} step={0.5}
                        value={simTasa}
                        onChange={e => setSimTasa(Number(e.target.value))}
                        className="w-full accent-violet-400" />
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[9px]" style={{ color: colores.muted }}>0%</span>
                        <span className="text-[9px]" style={{ color: colores.muted }}>
                          actual: {selected.tasa}%
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <label className="text-[10px] font-semibold" style={{ color: colores.muted }}>
                          Plazo hipotético
                        </label>
                        <span className="text-[10px] font-bold" style={{ color: colores.violet }}>
                          {simAnos} años
                        </span>
                      </div>
                      <input type="range" min={1} max={50} step={1}
                        value={simAnos}
                        onChange={e => setSimAnos(Number(e.target.value))}
                        className="w-full accent-violet-400" />
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[9px]" style={{ color: colores.muted }}>1a</span>
                        <span className="text-[9px]" style={{ color: colores.muted }}>
                          actual: {selected.anos}a
                        </span>
                      </div>
                    </div>

                    {calcSim && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-2 rounded-xl text-center"
                          style={{ background: `color-mix(in srgb, ${selected.color} 8%, transparent)` }}>
                          <p className="text-[8px] font-semibold uppercase mb-0.5" style={{ color: colores.muted }}>
                            Actual
                          </p>
                          <p className="text-sm font-bold" style={{ color: selected.color }}>
                            {formatCurrency(calc.finalBalance)}
                          </p>
                        </div>
                        <div className="p-2 rounded-xl text-center"
                          style={{ background: `color-mix(in srgb, ${colores.violet} 8%, transparent)` }}>
                          <p className="text-[8px] font-semibold uppercase mb-0.5" style={{ color: colores.muted }}>
                            Simulado
                          </p>
                          <p className="text-sm font-bold" style={{ color: colores.violet }}>
                            {formatCurrency(calcSim.finalBalance)}
                          </p>
                          <p className="text-[9px] font-semibold mt-0.5"
                            style={{ color: calcSim.finalBalance >= calc.finalBalance ? colores.green : colores.rose }}>
                            {calcSim.finalBalance >= calc.finalBalance ? '+' : ''}
                            {formatCurrency(calcSim.finalBalance - calc.finalBalance)}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setSimAporte(selected.aporte || 0)
                        setSimTasa(selected.tasa || 0)
                        setSimAnos(selected.anos || 10)
                      }}
                      className="flex items-center gap-1 text-[9px] font-semibold"
                      style={{ color: colores.muted }}>
                      <X size={10} /> Resetear a valores reales
                    </button>
                  </div>
                )}
              </div>

              {/* Gráfico */}
              {historyData.length > 0 && (
                <div className="mb-4">
                  <p className="text-[9px] font-semibold uppercase mb-2 ml-1" style={{ color: colores.muted }}>
                    Proyección de crecimiento
                    {calcSim && (
                      <span className="ml-2 normal-case" style={{ color: colores.violet }}>
                        + escenario simulado
                      </span>
                    )}
                  </p>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historyData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${selected.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={selected.color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={selected.color} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id={`grad-sim`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={colores.violet} stopOpacity={0.2} />
                            <stop offset="95%" stopColor={colores.violet} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colores.border} opacity={0.5} />
                        <XAxis
                          dataKey="year"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: colores.muted, fontSize: 9, fontWeight: 700 }}
                          tickFormatter={v => `A${v}`}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: colores.muted, fontSize: 9 }}
                          tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                        />
                        <Tooltip
                          content={<TooltipConColores />}
                          cursor={{ stroke: selected.color, strokeWidth: 1.5, strokeDasharray: '4 4' }}
                        />
                        <Area
                          name="balance"
                          type="monotone"
                          dataKey="balance"
                          stroke={selected.color}
                          strokeWidth={2.5}
                          fill={`url(#grad-${selected.id})`}
                        />
                        <Area
                          name="contributed"
                          type="monotone"
                          dataKey="contributed"
                          stroke={colores.muted}
                          strokeWidth={1.5}
                          strokeDasharray="5 3"
                          fill="transparent"
                        />
                        {calcSim && (
                          <Area
                            name="simBalance"
                            type="monotone"
                            dataKey="simBalance"
                            stroke={colores.violet}
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            fill={`url(#grad-sim)`}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-2 ml-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 rounded" style={{ background: selected.color }} />
                      <span className="text-[9px] font-semibold" style={{ color: colores.muted }}>Balance proyectado</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 border-t border-dashed" style={{ borderColor: colores.muted }} />
                      <span className="text-[9px] font-semibold" style={{ color: colores.muted }}>Total aportado</span>
                    </div>
                    {calcSim && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 border-t border-dashed" style={{ borderColor: colores.violet }} />
                        <span className="text-[9px] font-semibold" style={{ color: colores.violet }}>Simulado</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Regla del 4% */}
              <div className="p-3 rounded-xl"
                style={{
                  background: `color-mix(in srgb, ${colores.green} 6%, transparent)`,
                  border: `1px solid color-mix(in srgb, ${colores.green} 15%, transparent)`,
                }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={11} style={{ color: colores.green, flexShrink: 0 }} />
                  <p className="text-[9px] font-semibold uppercase" style={{ color: colores.green }}>
                    Retiro mensual sostenible (Regla del 4%)
                  </p>
                  <Tooltip4Pct colores={colores} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[9px] mb-0.5" style={{ color: colores.muted }}>Hoy</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                      {formatCurrency(selected.capital * 0.04 / 12)}<span className="text-[9px] font-medium opacity-60 ml-1">/mes</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] mb-0.5" style={{ color: colores.muted }}>En {selected.anos}a (proyectado)</p>
                    <p className="text-sm font-semibold" style={{ color: colores.green, letterSpacing: '-0.02em' }}>
                      {formatCurrency(calc.finalBalance * 0.04 / 12)}<span className="text-[9px] font-medium opacity-60 ml-1">/mes</span>
                    </p>
                  </div>
                </div>
                <p className="text-[9px] mt-2" style={{ color: colores.muted }}>
                  Basado en historial bursátil. No garantiza rendimientos futuros.
                </p>
              </div>
            </Card>
          )}

          {/* Meta libertad financiera */}
          {metaLibertad && totalProyectadoCombinado > 0 && (
            <Card className="animate-enter" style={{ padding: '14px 16px', animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Target size={13} style={{ color: colores.terra }} />
                  <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
                    Libertad financiera · todas las carteras
                  </p>
                </div>
                <p className="text-[10px] font-semibold" style={{ color: colores.green }}>
                  {Math.min(100, (totalProyectadoCombinado / metaLibertad) * 100).toFixed(1)}%
                </p>
              </div>

              <ProgressBar
                value={Math.min(totalProyectadoCombinado, metaLibertad)}
                max={metaLibertad}
                color={colores.green}
              />

              <div className="mt-3 space-y-1.5">
                {[
                  { label: 'Capital actual total', val: formatCurrency(totalCapital), color: 'var(--text-primary)' },
                  { label: `Proyectado en ${maxAnosCarteras}a (horizonte común)`, val: formatCurrency(totalProyectadoCombinado), color: colores.green },
                  { label: 'Meta (prom. 3 meses × 12 × 25)', val: formatCurrency(metaLibertad), color: 'var(--text-muted)' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <p className="text-[9px]" style={{ color: colores.muted }}>{label}</p>
                    <p className="text-[10px] font-semibold" style={{ color }}>{val}</p>
                  </div>
                ))}
              </div>

              {totalProyectadoCombinado < metaLibertad && (
                <>
                  <div className="my-2 border-t" style={{ borderColor: 'var(--border-glass)' }} />
                  <div className="flex items-center justify-between">
                    <p className="text-[9px]" style={{ color: colores.muted }}>Te faltan</p>
                    <p className="text-[11px] font-semibold" style={{ color: colores.rose }}>
                      {formatCurrency(metaLibertad - totalProyectadoCombinado)}
                    </p>
                  </div>
                  {totalAportes > 0 && (() => {
                    const tasaPonderada = inversiones.reduce((s, i) => s + (i.tasa || 0) * (i.capital || 0), 0)
                    const capitalTotal = inversiones.reduce((s, i) => s + (i.capital || 0), 0)
                    const tasaAnual = capitalTotal > 0 ? tasaPonderada / capitalTotal : 0
                    const r = tasaAnual / 100 / 12
                    const PV = totalCapital
                    const PMT = totalAportes
                    const FV = metaLibertad
                    let mesesEstimados
                    if (r > 0 && PMT + PV * r > 0) {
                      const num = Math.log((FV * r + PMT) / (PV * r + PMT))
                      const den = Math.log(1 + r)
                      mesesEstimados = num > 0 && den > 0 ? Math.ceil(num / den) : null
                    } else {
                      mesesEstimados = PMT > 0 ? Math.ceil((FV - PV) / PMT) : null
                    }
                    if (!mesesEstimados || mesesEstimados <= 0 || !isFinite(mesesEstimados)) return null
                    const años = Math.floor(mesesEstimados / 12)
                    const meses = mesesEstimados % 12
                    return (
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[9px]" style={{ color: colores.muted }}>Tiempo estimado</p>
                        <p className="text-[10px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          ~{años > 0 ? `${años}a` : ''}{meses > 0 ? ` ${meses}m` : ''}
                        </p>
                      </div>
                    )
                  })()}
                </>
              )}
            </Card>
          )}

          {/* Carteras activas */}
          {inversiones.length > 0 && (
            <Card className="animate-enter" style={{ padding: '14px 16px' }}>
              <p className="text-[10px] font-semibold uppercase mb-3" style={{ color: colores.muted }}>
                Carteras activas — capital real vs proyección
              </p>
              <div className="space-y-4">
                {inversiones.map(inv => {
                  const c = calcsPorInversion.find(x => x.id === inv.id)?.calc
                  if (!c) return null
                  const pctReal = c.finalBalance > 0
                    ? Math.min(100, Math.round((inv.capital / c.finalBalance) * 100))
                    : 0
                  return (
                    <div key={inv.id} onClick={() => setSelected(inv)} className="cursor-pointer">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: inv.color, flexShrink: 0 }} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {inv.emoji} {inv.nombre}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold" style={{ color: inv.color }}>
                            {formatCurrency(inv.capital)}
                          </p>
                          <p className="text-[9px]" style={{ color: colores.muted }}>
                            → {formatCurrency(c.finalBalance)} en {inv.anos}a
                          </p>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full overflow-hidden relative"
                        style={{ background: `${inv.color}20` }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pctReal}%`, background: inv.color }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px]" style={{ color: colores.muted }}>
                          Capital: {formatCurrency(inv.capital)}
                        </span>
                        <span className="text-[9px]" style={{ color: colores.muted }}>
                          Proyectado: {formatCurrency(c.finalBalance)}
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div className="border-t pt-2 flex items-center justify-between"
                  style={{ borderColor: 'var(--border-glass)' }}>
                  <span className="text-[9px]" style={{ color: colores.muted }}>Total proyectado combinado</span>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(totalProyectado)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── MODAL RETIRO ──────────────────────────────────────────────────── */}
      <Modal
        open={modalRetiro}
        onClose={() => { setModalRetiro(false); setFormRetiro({ monto: '' }) }}
        title={`Retirar capital · ${selected?.nombre || ''}`}
        size="sm">
        {selected && (
          <form onSubmit={handleRetirarInversion} className="space-y-4">
            <div className="rounded-xl px-4 py-3"
              style={{ background: `color-mix(in srgb, ${colores.rose} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${colores.rose} 20%, transparent)` }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: colores.rose }}>
                {selected.emoji} {selected.nombre}
              </p>
              <p className="text-sm font-semibold" style={{ color: colores.rose }}>
                Capital disponible: {formatCurrency(selected.capital || 0)}
              </p>
            </div>

            <div>
              <label className="ff-label">Monto a retirar</label>
              <input className="ff-input" type="number" min="0.01" step="0.01"
                max={selected.capital || 0} placeholder="0.00"
                required autoFocus
                value={formRetiro.monto}
                onChange={e => setFormRetiro(p => ({ ...p, monto: e.target.value }))} />
              <p className="text-[10px] mt-1" style={{ color: colores.muted }}>
                Máximo: {formatCurrency(selected.capital || 0)}
              </p>
            </div>

            {parseFloat(formRetiro.monto) > 0 && (
              <div className="rounded-xl px-3 py-2.5 flex items-center justify-between"
                style={{ background: `color-mix(in srgb, ${colores.rose} 6%, transparent)`, border: `1px solid color-mix(in srgb, ${colores.rose} 18%, transparent)` }}>
                <span className="text-[10px] font-semibold" style={{ color: colores.muted }}>Capital restante</span>
                <span className="text-sm font-semibold" style={{ color: colores.rose }}>
                  {formatCurrency(Math.max(0, (selected.capital || 0) - parseFloat(formRetiro.monto)))}
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setModalRetiro(false); setFormRetiro({ monto: '' }) }}
                className="ff-btn-ghost flex-1">Cancelar</button>
              <button type="submit" disabled={savingRetiro}
                className="ff-btn-primary flex-1 flex items-center justify-center gap-2"
                style={{ background: colores.rose }}>
                {savingRetiro && <Loader2 size={14} className="animate-spin" />}
                {savingRetiro ? 'Guardando...' : 'Confirmar retiro'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── MODAL HISTORIAL DE APORTES ─────────────────────────────────────── */}
      <Modal
        open={modalHistorial}
        onClose={() => setModalHistorial(false)}
        title={`Historial · ${selected?.nombre || ''}`}>
        {loadingHistorial ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={{ color: colores.muted }} />
          </div>
        ) : historialAportes.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: colores.muted }}>No hay aportes registrados aún</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] mb-3" style={{ color: colores.muted }}>
              Cada aporte modifica el capital de la cartera. Al eliminar uno, se restará del capital actual.
            </p>
            {historialAportes.map(a => (
              <div key={a.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{
                  background: 'var(--bg-secondary)',
                  border: `1px solid ${colores.border}`,
                }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {a.descripcion || 'Aporte'}
                  </p>
                  <p className="text-[9px] mt-0.5" style={{ color: colores.muted }}>
                    {new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <p className="text-sm font-semibold" style={{ color: colores.green }}>
                    +{formatCurrency(a.monto)}
                  </p>
                  <button
                    onClick={() => handleDeleteAporte(a.id, parseFloat(a.monto))}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style={{
                      background: `color-mix(in srgb, ${colores.rose} 8%, transparent)`,
                      color: colores.rose,
                    }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t"
              style={{ borderColor: 'var(--border-glass)' }}>
              <p className="text-[9px] font-semibold" style={{ color: colores.muted }}>
                Total histórico registrado
              </p>
              <p className="text-[11px] font-semibold" style={{ color: colores.green }}>
                +{formatCurrency(historialAportes.reduce((s, a) => s + parseFloat(a.monto), 0))}
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* ── MODAL APORTE (MEJORADO) ────────────────────────────────────────── */}
      <Modal
        open={modalAporte}
        onClose={() => {
          setModalAporte(false)
          setFormAporte({ monto: '', descripcion: '', fecha: fechaHoy() })
          setAutoFilled(false)
        }}
        title="Agregar aporte">
        <form onSubmit={handleAddAporte} className="space-y-4">

          {/* ── 1. Campo de monto con smart-fill ── */}
          <div>
            {/* Label dinámico: indica cuándo es una sugerencia automática */}
            <label className="ff-label text-[10px] uppercase opacity-60">
              {autoFilled && selected?.pct_mensual > 0
                ? `Monto sugerido (${selected.pct_mensual}% del plan mensual)`
                : 'Monto a aportar'}
            </label>

            <input
              className="ff-input text-lg font-bold"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              required
              autoFocus
              value={formAporte.monto}
              onChange={e => {
                setFormAporte(p => ({ ...p, monto: e.target.value }))
                // Si el usuario edita manualmente, ya no es auto-fill
                setAutoFilled(false)
              }}
              style={{
                color: parseFloat(formAporte.monto) > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                // Fondo sutil del color de la cartera cuando es sugerencia del sistema
                background: autoFilled
                  ? `color-mix(in srgb, ${selected?.color || colores.violet} 8%, var(--bg-secondary))`
                  : undefined,
                borderColor: autoFilled
                  ? `color-mix(in srgb, ${selected?.color || colores.violet} 30%, transparent)`
                  : undefined,
                transition: 'background 0.3s, border-color 0.3s',
              }}
            />

            {/* Indicador de sugerencia automática */}
            {autoFilled && (
              <p className="text-[9px] mt-1 font-semibold flex items-center gap-1"
                style={{ color: selected?.color || colores.violet }}>
                <Sparkles size={9} />
                Calculado automáticamente · edita si necesitas otro importe
              </p>
            )}

            {/* ── 2. Visualizador de impacto en presupuesto ── */}
            {presupuesto?.montoInversiones > 0 && (
              <div className="mt-3 p-3 rounded-2xl border transition-colors duration-300"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: (() => {
                    const total = aportesEsteMes + (parseFloat(formAporte.monto) || 0)
                    return total > presupuesto.montoInversiones
                      ? `color-mix(in srgb, var(--accent-danger) 35%, transparent)`
                      : 'var(--border-glass)'
                  })(),
                }}>
                {(() => {
                  const montoInput = parseFloat(formAporte.monto) || 0
                  const totalTrasAporte = aportesEsteMes + montoInput
                  const presupuestado = presupuesto.montoInversiones
                  const pct = Math.min(100, (totalTrasAporte / presupuestado) * 100)
                  const excede = totalTrasAporte > presupuestado
                  const diferencia = Math.abs(presupuestado - totalTrasAporte)
                  const colorBarra = excede ? 'var(--accent-danger)' : (selected?.color || colores.violet || 'var(--accent-violet)')

                  return (
                    <>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest"
                          style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                          Uso presupuesto inversiones
                        </span>
                        <span className="text-[9px] font-bold" style={{ color: colorBarra }}>
                          {pct.toFixed(0)}%{excede ? ' · Excedido' : ''}
                        </span>
                      </div>

                      {/* Barra dinámica */}
                      <div className="h-1 w-full rounded-full overflow-hidden mb-2"
                        style={{ background: 'var(--progress-track)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: colorBarra }} />
                      </div>

                      {/* Indicador textual: disponible o excedido */}
                      <p className="text-[9px] font-semibold" style={{ color: colorBarra }}>
                        {excede
                          ? `Excedido por ${fmt(diferencia)}`
                          : `Te quedan ${fmt(diferencia)} disponibles este mes`}
                      </p>
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {/* ── 3. Preview capital nuevo con Sparkles si acerca a meta ── */}
          {parseFloat(formAporte.monto) > 0 && selected && (() => {
            const montoInput = parseFloat(formAporte.monto) || 0
            const nuevoCapital = (selected.capital || 0) + montoInput
            // Acerca a meta si hay metaLibertad y el nuevo capital aumenta el % de progreso
            const acercaMeta = metaLibertad && totalProyectado > 0 && montoInput > 0
            return (
              <div className="px-3 py-2.5 rounded-xl text-[10px] font-semibold flex justify-between items-center"
                style={{
                  background: `color-mix(in srgb, ${colores.green} 8%, transparent)`,
                  color: colores.green,
                  border: `1px solid color-mix(in srgb, ${colores.green} 20%, transparent)`,
                }}>
                <span className="opacity-70 uppercase font-black tracking-wider flex items-center gap-1">
                  {acercaMeta && <Sparkles size={10} />}
                  Capital tras aporte:
                </span>
                <span className="text-sm">{formatCurrency(nuevoCapital)}</span>
              </div>
            )
          })()}

          {/* Descripción */}
          <div>
            <label className="ff-label text-[10px] uppercase opacity-60">Descripción (opcional)</label>
            <input
              className="ff-input"
              placeholder="Ej: Aporte enero, bono, dividendo..."
              value={formAporte.descripcion}
              onChange={e => setFormAporte(p => ({ ...p, descripcion: e.target.value }))}
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="ff-label text-[10px] uppercase opacity-60">Fecha</label>
            <input
              className="ff-input"
              type="date"
              value={formAporte.fecha || new Date().toISOString().slice(0, 10)}
              onChange={e => setFormAporte(p => ({ ...p, fecha: e.target.value }))}
            />
          </div>

          {/* Acciones */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setModalAporte(false)
                setFormAporte({ monto: '', descripcion: '', fecha: fechaHoy() })
                setAutoFilled(false)
              }}
              className="ff-btn-ghost flex-1">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingAporte}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2 py-4">
              {savingAporte ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL CREAR / EDITAR */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditandoId(null) }}
        title={editandoId ? 'Editar Cartera' : 'Nueva Cartera'}>
        <form onSubmit={handleSave} className="space-y-4">

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="ff-label">Emoji</label>
              <input className="ff-input text-center text-xl" maxLength={8}
                value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} />
            </div>
            <div className="col-span-3">
              <label className="ff-label">Nombre de la cartera</label>
              <input className="ff-input" required placeholder="Ej: S&P 500, Dividendos..."
                value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Capital inicial (€)</label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.capital} onChange={e => setForm(p => ({ ...p, capital: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">% presup mensual</label>
              <input className="ff-input" type="number" min="0" max="100" step="1" placeholder="Ej: 50"
                value={form.pct_mensual} onChange={e => setForm(p => ({ ...p, pct_mensual: e.target.value }))} />
              {(() => {
                const pctNuevo = parseFloat(form.pct_mensual) || 0
                const totalOtras = inversiones
                  .filter(i => i.id !== editandoId)
                  .reduce((s, i) => s + (i.pct_mensual || 0), 0)
                const libreActual = 100 - totalOtras
                const esUnica = inversiones.filter(i => i.id !== editandoId).length === 0

                if (!pctNuevo) {
                  // Sin input aún — mostrar % libre y sugerencia si es única
                  return (
                    <div className="mt-1.5 space-y-1">
                      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        {libreActual}% disponible
                        {presupuesto?.montoInversiones > 0 && ` · ${formatCurrency((libreActual / 100) * presupuesto.montoInversiones)}`}
                      </p>
                      {esUnica && (
                        <p className="text-[9px] font-semibold" style={{ color: colores.violet }}>
                          Es tu única cartera — puedes asignar el 100%
                        </p>
                      )}
                    </div>
                  )
                }

                const totalConEsta = totalOtras + pctNuevo
                if (totalConEsta > 100) return (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-[9px] font-semibold" style={{ color: colores.rose }}>
                      Excede en {totalConEsta - 100}% · máximo disponible: {libreActual}%
                    </p>
                  </div>
                )
                return (
                  <div className="mt-1.5 space-y-0.5">
                    {presupuesto?.montoInversiones > 0 && (
                      <p className="text-[9px] font-semibold" style={{ color: colores.violet }}>
                        = {formatCurrency((pctNuevo / 100) * presupuesto.montoInversiones)}/mes
                      </p>
                    )}
                    {libreActual - pctNuevo > 0 && (
                      <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                        Quedarán {libreActual - pctNuevo}% sin asignar
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>

          <div className="p-3 rounded-xl space-y-3"
            style={{
              background: 'var(--bg-secondary)',
              border: `1px solid ${colores.border}`,
            }}>
            <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: colores.muted }}>
              Aportes mensuales
            </p>

            <div>
              <label className="ff-label flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" />
                Aporte real mensual
              </label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.aporteReal}
                onChange={e => setForm(p => ({ ...p, aporteReal: e.target.value }))} />
              <p className="text-[9px] mt-1 ml-1" style={{ color: colores.muted }}>
                Usado en el tracker. Al registrar aportes manuales se refleja aquí.
              </p>
            </div>

            <div>
              <label className="ff-label flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block border" />
                Aporte hipotético para proyección
              </label>
              <input className="ff-input" type="number" min="0" step="0.01" placeholder="0.00"
                value={form.aporte}
                onChange={e => setForm(p => ({ ...p, aporte: e.target.value }))} />
              <p className="text-[9px] mt-1 ml-1" style={{ color: colores.muted }}>
                Solo afecta al gráfico de interés compuesto. No se registra como movimiento.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="ff-label">Tasa anual (%)</label>
              <input className="ff-input" type="number" min="0" step="0.1" placeholder="Ej: 7" required
                value={form.tasa} onChange={e => setForm(p => ({ ...p, tasa: e.target.value }))} />
            </div>
            <div>
              <label className="ff-label">Plazo (años)</label>
              <input className="ff-input" type="number" min="1" max="50" placeholder="10" required
                value={form.anos} onChange={e => setForm(p => ({ ...p, anos: e.target.value }))} />
            </div>
          </div>

          {calcPreview && (
            <div className="px-3 py-2.5 rounded-xl text-[10px] font-semibold"
              style={{
                background: `color-mix(in srgb, ${form.color} 8%, transparent)`,
                color: form.color,
                border: `1px solid color-mix(in srgb, ${form.color} 20%, transparent)`,
              }}>
              Balance proyectado:{' '}
              <span className="font-semibold text-sm">{formatCurrency(calcPreview.finalBalance)}</span>
              <span className="opacity-60 ml-1">en {form.anos} años</span>
              {calcPreview.totalInterest > 0 && (
                <span className="opacity-60 ml-2">
                  · Ganancias: {formatCurrency(calcPreview.totalInterest)}
                </span>
              )}
            </div>
          )}

          <div>
            <label className="ff-label">Estrategia de interés</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[
                { val: true, icon: '🔄', title: 'Bola de nieve', desc: 'Reinvierte las ganancias (interés compuesto)' },
                { val: false, icon: '📤', title: 'Sin reinversión', desc: 'Retiras las ganancias cada año' },
              ].map(opt => (
                <button key={String(opt.val)} type="button"
                  onClick={() => setForm(p => ({ ...p, bola_nieve: opt.val }))}
                  className="p-3 rounded-xl text-left transition-all border-2"
                  style={{
                    borderColor: form.bola_nieve === opt.val ? colores.green : colores.border,
                    background: form.bola_nieve === opt.val
                      ? `color-mix(in srgb, ${colores.green} 6%, transparent)`
                      : 'var(--bg-secondary)',
                  }}>
                  <p className="text-base mb-0.5">{opt.icon}</p>
                  <p className="text-[10px] font-semibold"
                    style={{ color: form.bola_nieve === opt.val ? colores.green : 'var(--text-primary)' }}>
                    {opt.title}
                  </p>
                  <p className="text-[9px]" style={{ color: colores.muted }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="ff-label">Color de la cartera</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {themeColors.map(hex => (
                <button key={hex} type="button"
                  onClick={() => setForm(p => ({ ...p, color: hex }))}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    backgroundColor: hex,
                    outline: form.color === hex ? `3px solid var(--text-secondary)` : 'none',
                    outlineOffset: 2,
                    opacity: form.color === hex ? 1 : 0.5,
                    transform: form.color === hex ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button"
              onClick={() => { setModal(false); setEditandoId(null) }}
              className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving}
              className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : editandoId ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}