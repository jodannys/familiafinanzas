'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { Plus, ArrowUpRight, ArrowDownRight, Search, Loader2, Trash2, CreditCard, Minus, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { formatCurrency, fechaHoy } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { getPresupuestoMes } from '@/lib/presupuesto'
import { useQuien } from '@/lib/useQuien'
import { useTheme, getThemeColors } from '@/lib/themes'
import CustomSelect from '@/components/ui/CustomSelect'
import ConfirmDialog, { useConfirm } from '@/components/ui/ConfirmDialog'
import { getRangoMes, getFechaLocal } from '@/lib/utils'
import { getCurrentMonth } from '@/lib/utils' // Importamos la utilidad


const CATS = [
  { value: 'basicos', label: 'Básicos' },
  { value: 'deseo', label: 'Estilo de vida' },
  { value: 'ahorro', label: 'Ahorro / Metas' },
  { value: 'inversion', label: 'Inversión' },
  { value: 'deuda', label: 'Deudas' },
]

const CAT_BLOQUE = {
  basicos: 'necesidades', deuda: 'necesidades',
  deseo: 'estilo',
  ahorro: 'futuro', inversion: 'futuro',
}
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
export default function GastosPage() {
  const { opcionesQuien, defaultQuien } = useQuien()
  const { confirmProps, showConfirm } = useConfirm()
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [modal, setModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [presItems, setPresItems] = useState([])
  const [metasData, setMetasData] = useState([])
  const [inversionesData, setInversionesData] = useState([])
  const [deudasData, setDeudasData] = useState([])
  const [tarjetasData, setTarjetasData] = useState([])
  const [tarjetaDeudasMap, setTarjetaDeudasMap] = useState({})
  const [metaSeleccionada, setMetaSeleccionada] = useState('')
  const [deudaSeleccionada, setDeudaSeleccionada] = useState('')
  const [tarjetaSeleccionada, setTarjetaSeleccionada] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [numCuotas, setNumCuotas] = useState('')
  const [presupuesto, setPresupuesto] = useState(null)
  const [colores, setColores] = useState({})
  const [subcategorias, setSubcategorias] = useState([])
  const [categoriasCfg, setCategoriasCfg] = useState([])
  const [subcatPresupuesto, setSubcatPresupuesto] = useState({})
  const [form, setForm] = useState({
    tipo: 'egreso', monto: '', descripcion: '',
    categoria: 'basicos', fecha: fechaHoy(), quien: 'Ambos',
    subcategoria_id: '',
  })

  // Sincronizar quien inicial cuando carga el hook
  useEffect(() => {
    if (defaultQuien) setForm(f => ({ ...f, quien: f.quien === 'Ambos' ? defaultQuien : f.quien }))
  }, [defaultQuien])

  const METODOS_PAGO = [
    { id: 'efectivo', short: 'EF', label: 'Efectivo', color: colores.green },
    { id: 'transferencia', short: 'TR', label: 'Transf.', color: colores.blue },
    { id: 'debito', short: 'DB', label: 'Débito', color: colores.violet },
    { id: 'tarjeta_credito', short: 'TC', label: 'T. Crédito', color: colores.rose },
  ]
  const CUOTAS_OPCIONES = [1, 3, 6, 9, 12, 18, 24, 36]
  const [hayMas, setHayMas] = useState(false)
  const [visMes, setVisMes] = useState(new Date().getMonth() + 1)
  const [visAño, setVisAño] = useState(new Date().getFullYear())
  const LIMITE_INICIAL = 100

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

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
        gold: v('--accent-gold'),
        main: v('--accent-main'),
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

  const CAT_COLOR_VAR = {
    basicos: colores.blue,
    deseo: colores.violet,
    ahorro: colores.green,
    inversion: colores.gold,
    deuda: colores.rose,
  }

  useEffect(() => {
    let activo = true
    getPresupuestoMes().then(d => { if (activo) setPresupuesto(d) })
    cargarPresupuesto()
    supabase.from('categorias').select('*').order('bloque').order('nombre').then(({ data }) => { if (activo) setCategoriasCfg(data || []) })
    supabase.from('subcategorias').select('*').order('orden').order('nombre').then(({ data }) => { if (activo) setSubcategorias(data || []) })
    supabase.from('presupuesto_cats').select('subcategoria_id,monto').eq('mes', mes).eq('año', año)
      .then(({ data }) => {
        if (!activo) return
        const map = {}
          ; (data || []).forEach(p => { map[p.subcategoria_id] = parseFloat(p.monto) })
        setSubcatPresupuesto(map)
      })
    supabase.from('metas').select('id, nombre, meta, actual, pct_mensual').then(({ data }) => { if (activo) setMetasData(data || []) })
    supabase.from('inversiones').select('id, nombre, capital, aporte, pct_mensual').then(({ data }) => { if (activo) setInversionesData(data || []) })
    supabase.from('deudas').select('id, nombre, pendiente, cuota, pagadas, tipo_deuda').eq('estado', 'activa').then(({ data }) => { if (activo) setDeudasData(data || []) })
    supabase.from('perfiles_tarjetas').select('id, nombre_tarjeta, banco, color, dia_pago, dia_corte').eq('estado', 'activa')
      .then(({ data }) => {
        if (!activo) return
        setTarjetasData(data || [])
      })
    supabase.from('deudas').select('id, nombre, perfil_tarjeta_id, pendiente, color').eq('tipo_deuda', 'tarjeta').eq('estado', 'activa')
      .then(({ data }) => {
        if (!activo) return
        const map = {}
          // Primero mapear los que tienen perfil_tarjeta_id
          ; (data || []).forEach(d => { if (d.perfil_tarjeta_id) map[d.perfil_tarjeta_id] = d })
        // Para tarjetas de perfiles sin deuda asociada, guardar un fallback genérico
        setTarjetaDeudasMap(map)
      })
    return () => { activo = false }
  }, [])

  useEffect(() => {
    cargarMovimientos(false, visMes, visAño)
  }, [visMes, visAño])

  async function cargarMovimientos(cargarTodos = false, mesV, añoV) {
    // 1. Obtenemos mes y año (si no vienen, usamos los del estado/vista)
    const m = mesV ?? visMes
    const a = añoV ?? visAño

    // 2. Usamos la nueva utilidad para obtener el rango exacto (YYYY-MM-DD)
    const { inicio, fin } = getRangoMes(m, a)

    setLoading(true)
    setError(null)

    // 3. Aplicamos el rango a la query de Supabase
    const query = supabase
      .from('movimientos')
      .select('*')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    // 4. Ejecutamos la consulta con o sin límite
    const { data, error } = cargarTodos
      ? await query
      : await query.limit(LIMITE_INICIAL + 1)

    if (error) {
      setError('Error al cargar movimientos: ' + error.message)
    } else {
      // 5. Lógica de paginación/limite
      if (!cargarTodos && data && data.length > LIMITE_INICIAL) {
        setMovs(data.slice(0, LIMITE_INICIAL))
        setHayMas(true)
      } else {
        setMovs(data || [])
        setHayMas(false)
      }
    }

    setLoading(false)
  }


  async function cargarPresupuesto(mesV, añoV) {
    // 1. Obtenemos el mes/año real en el momento de la ejecución
    const { month, year } = getCurrentMonth()

    // 2. Priorizamos los argumentos (si estamos navegando por meses) 
    // o usamos el mes actual por defecto.
    const m = mesV ?? month
    const a = añoV ?? year

    const { data, error } = await supabase
      .from('presupuesto_items')
      .select('*')
      .eq('mes', m)
      .eq('año', a)

    if (error) {
      console.error("Error en presupuesto:", error.message)
    } else {
      setPresItems(data || [])
    }
  }

  function resetModal() {
    setModal(false)
    setTarjetaSeleccionada('')
    setMetaSeleccionada('')
    setDeudaSeleccionada('')
    setMetodoPago('efectivo')
    setNumCuotas('')
    setForm({ tipo: 'egreso', monto: '', descripcion: '', categoria: 'basicos', fecha: fechaHoy(), quien: defaultQuien, subcategoria_id: '' })
  }


  async function handleAdd(e) {
    e.preventDefault();
    if (saving) return;

    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) return;

    setSaving(true);
    setError(null);

    try {
      // ── 1. CASO: TARJETA DE CRÉDITO (FLUJO ESPECIAL) ───────────────────────────
      if (metodoPago === 'tarjeta_credito' && form.tipo === 'egreso') {
        if (!tarjetaSeleccionada) {
          toast('Selecciona una tarjeta de crédito', 'warning');
          setSaving(false);
          return;
        }
        const cuotas = parseInt(numCuotas);
        if (!cuotas || cuotas < 1) {
          toast('Ingresa el número de cuotas', 'warning');
          setSaving(false);
          return;
        }

        const tarjeta = tarjetasData.find(t => t.id === tarjetaSeleccionada);
        const subNombreTC = form.subcategoria_id ? subcategorias.find(s => s.id === form.subcategoria_id)?.nombre : null;
        const descTC = form.descripcion.trim() || subNombreTC || 'Compra con tarjeta';
        const cuotaMensual = parseFloat((monto / cuotas).toFixed(2));

        // Solo crear la deuda (el movimiento real se crea al pagar la cuota)
        const { error: errDeuda } = await supabase.from('deudas').insert([{
          tipo_deuda: 'tarjeta',
          tipo: 'debo',
          emoji: '💳',
          nombre: descTC,
          categoria: form.categoria,
          capital: monto,
          monto: monto,
          pendiente: monto,
          cuota: cuotaMensual,
          plazo_meses: cuotas,
          pagadas: 0,
          estado: 'activa',
          perfil_tarjeta_id: tarjetaSeleccionada,
          dia_pago: tarjeta?.dia_pago || null,
          fecha_primer_pago: calcFechaPrimerPago(form.fecha, tarjeta?.dia_pago, tarjeta?.dia_corte),
          color: tarjeta?.color || '#A44A3F',
          tasa: 0,
          tasa_interes: 0,
        }]);

        if (errDeuda) throw errDeuda;

        toast(`Compra registrada · ${cuotas === 1 ? 'Pago único' : `${cuotas}x de ${formatCurrency(cuotaMensual)}`}`, 'success');
        resetModal();
        setSaving(false);
        return;
      }

      // ── 2. PREPARAR MOVIMIENTO NORMAL ──────────────────────────────────────────
      const deudaId = form.categoria === 'deuda' && deudaSeleccionada ? deudaSeleccionada : null;
      const metaId = form.categoria === 'ahorro' && metaSeleccionada ? metaSeleccionada : null;
      const invId = form.categoria === 'inversion' && metaSeleccionada?.startsWith('inv_')
        ? metaSeleccionada.replace('inv_', '')
        : null;

      const subNombre = form.subcategoria_id ? subcategorias.find(s => s.id === form.subcategoria_id)?.nombre : null;
      const descFinal = form.descripcion.trim() || subNombre || (form.tipo === 'ingreso' ? 'Ingreso' : 'Gasto');

      const payloadMov = {
        tipo: form.tipo,
        monto,
        descripcion: descFinal,
        metodo_pago: form.tipo === 'egreso' ? metodoPago : 'transferencia',
        categoria: form.categoria,
        fecha: form.fecha,
        quien: form.quien,
        ...(deudaId && { deuda_id: deudaId }),
        ...(metaId && !invId && { meta_id: metaId }),
        ...(invId && { inversion_id: invId }),
        ...(form.subcategoria_id && { subcategoria_id: form.subcategoria_id }),
      };

      // ── 3. REGISTRAR MOVIMIENTO (RPC atómica) ────────────────────────────────
      // Una sola llamada reemplaza: INSERT movimientos + UPDATE metas/inversiones/deudas
      // + INSERT deuda_movimientos + UPDATE movimientos (deuda_movimiento_id).
      // Si cualquier paso falla en el servidor, PostgreSQL hace rollback completo.
      const { data: rpcData, error: errRpc } = await supabase.rpc('registrar_movimiento', {
        p_tipo:            form.tipo,
        p_monto:           monto,
        p_descripcion:     descFinal,
        p_categoria:       form.categoria,
        p_fecha:           form.fecha,
        p_quien:           form.quien,
        p_metodo_pago:     form.tipo === 'egreso' ? metodoPago : 'transferencia',
        p_meta_id:         metaId || null,
        p_inversion_id:    invId || null,
        p_deuda_id:        deudaId || null,
        p_subcategoria_id: form.subcategoria_id || null,
      });

      if (errRpc) throw errRpc;

      // ── 4. ACTUALIZAR ESTADO LOCAL ────────────────────────────────────────────
      // Recargamos el movimiento real desde DB para tener deuda_movimiento_id
      // y descripcion final que la RPC pudo haber guardado.
      const movId = rpcData?.mov_id;
      if (movId) {
        const { data: movRow } = await supabase
          .from('movimientos').select('*').eq('id', movId).single();
        if (movRow) setMovs(prev => [movRow, ...prev]);
      }

      // Sincronizar estado local de metas, inversiones y deudas
      if (metaId && !invId) {
        setMetasData(prev => prev.map(m =>
          m.id === metaId ? { ...m, actual: (m.actual || 0) + monto } : m
        ));
      }
      if (invId) {
        setInversionesData(prev => prev.map(i =>
          i.id === invId ? { ...i, capital: (i.capital || 0) + monto } : i
        ));
      }
      if (deudaId) {
        setDeudasData(prev => prev.map(d => {
          if (d.id !== deudaId) return d;
          const nuevoPendiente = Math.max(0, (d.pendiente || 0) - monto);
          return { ...d, pendiente: nuevoPendiente, pagadas: (d.pagadas || 0) + 1 };
        }));
      }

      toast('Movimiento guardado', 'success');
      resetModal();

    } catch (err) {
      console.error('Error en handleAdd:', err);
      setError(err.message);
      toast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(movimiento) {
    showConfirm(`¿Eliminar "${movimiento.descripcion}"?`, async () => {
      try {
        // ── RPC atómica: revierte metas/inversiones/deudas + borra movimiento ─
        const { error } = await supabase.rpc('revertir_movimiento', { p_mov_id: movimiento.id })
        if (error) { toast('Error: ' + error.message, 'error'); return }

        setMovs(prev => prev.filter(m => m.id !== movimiento.id))

        // Sincronizar estado local de metas, inversiones y deudas
        if (movimiento.categoria === 'ahorro' && movimiento.meta_id) {
          setMetasData(prev => prev.map(m =>
            m.id === movimiento.meta_id
              ? { ...m, actual: Math.max(0, (m.actual || 0) - movimiento.monto) }
              : m
          ))
        }
        if (movimiento.categoria === 'inversion' && movimiento.inversion_id) {
          setInversionesData(prev => prev.map(i =>
            i.id === movimiento.inversion_id
              ? { ...i, capital: Math.max(0, (i.capital || 0) - movimiento.monto) }
              : i
          ))
        }
        if (movimiento.categoria === 'deuda' && movimiento.deuda_id) {
          setDeudasData(prev => prev.map(d =>
            d.id === movimiento.deuda_id
              ? { ...d, pendiente: (d.pendiente || 0) + movimiento.monto, pagadas: Math.max(0, (d.pagadas || 0) - 1) }
              : d
          ))
        }

        // Limpiar sobre_movimientos huérfanos (lógica de sobres, no cubierta por la RPC)
        if (movimiento.categoria === 'deseo' && movimiento.fecha) {
          const { data: smRows } = await supabase
            .from('sobre_movimientos').select('id')
            .in('origen', ['basicos', 'metas', 'inversiones'])
            .eq('destino', 'sobre').eq('fecha', movimiento.fecha).eq('monto', movimiento.monto).limit(1)
          if (smRows?.[0]?.id) await supabase.from('sobre_movimientos').delete().eq('id', smRows[0].id)
        }
        if ((movimiento.categoria === 'ahorro' || movimiento.categoria === 'inversion') && movimiento.fecha) {
          const { data: smRows } = await supabase
            .from('sobre_movimientos').select('id')
            .eq('origen', 'sobre').eq('fecha', movimiento.fecha).eq('monto', movimiento.monto).limit(1)
          if (smRows?.[0]?.id) await supabase.from('sobre_movimientos').delete().eq('id', smRows[0].id)
        }

      } catch (err) {
        toast('Error al eliminar el movimiento', 'error')
      }
    })
  }


  function aplicarSugerencia(item) {
    const nombre = item.nombre.replace(/^[\p{Emoji}\s]+/u, '').trim()
    setForm(prev => ({ ...prev, descripcion: nombre, monto: item.monto != null ? item.monto.toString() : '' }))
    const metaMatch = metasData.find(m => m.nombre.toLowerCase() === nombre.toLowerCase())
    if (metaMatch) setMetaSeleccionada(metaMatch.id)
    const invMatch = inversionesData.find(i => i.nombre.toLowerCase() === nombre.toLowerCase())
    if (invMatch) setMetaSeleccionada(`inv_${invMatch.id}`)
  }

  const sugerenciasRicas = form.tipo === 'egreso' ? (() => {
    if (form.categoria === 'deuda') return []

    if (form.categoria === 'ahorro') {
      const montoMetas = presupuesto?.montoMetas || 0
      return metasData.map(m => ({
        id: m.id, nombre: m.nombre,
        monto: Math.round((m.pct_mensual / 100) * montoMetas),
        sub: `${formatCurrency(m.actual || 0)} / ${formatCurrency(m.meta)}`,
        pct: Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100)),
        color: colores.green, emoji: '🎯',
      }))
    }

    if (form.categoria === 'inversion') {
      const montoInversiones = presupuesto?.montoInversiones || 0
      return inversionesData.map(i => ({
        id: `inv_${i.id}`, nombre: i.nombre,
        monto: i.pct_mensual > 0 ? Math.round((i.pct_mensual / 100) * montoInversiones) : (i.aporte || 0),
        sub: `Capital: ${formatCurrency(i.capital || 0)}`,
        pct: null, color: colores.violet, emoji: '📈',
      }))
    }

    return presItems
      .filter(i => i.bloque === CAT_BLOQUE[form.categoria])
      .map(i => ({ id: i.id, nombre: i.nombre, monto: i.monto, sub: null, pct: null, color: colores.terra, emoji: '📌' }))
  })() : []

  const movsMes = movs.filter(m => {
    if (!m.fecha) return false
    const [year, month] = m.fecha.split('-').map(Number)
    return month === visMes && year === visAño
  })
  // FIX 4: separar gastos corrientes de ahorro/inversión igual que el dashboard
  const ingresos = movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
  const egresos = movsMes
    .filter(m => m.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(m.categoria))
    .reduce((s, m) => s + m.monto, 0)
  const ahorro = movsMes
    .filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria))
    .reduce((s, m) => s + m.monto, 0)

  const filtered = movs
    .filter(m => filtro === 'todos' || m.tipo === filtro || m.categoria === filtro)
    .filter(m =>
      !search ||
      (m.descripcion?.toLowerCase() || "").includes(search.toLowerCase())
    );
  const usandoTarjeta = form.tipo === 'egreso' && metodoPago === 'tarjeta_credito' && tarjetaSeleccionada
  console.log("=== DEBUG GASTOS ===");
  console.log("1. Registros totales cargados (movs):", movs.length);
  console.log("2. Filtro activo:", filtro);
  console.log("3. Registros que pasan el filtro (filtered):", filtered.length);
  if (movs.length > 0) {
    console.log("4. Ejemplo de un registro:", movs[0]);
  }
  return (
    <AppShell>
      <div className="w-full max-w-full overflow-x-hidden">

        {/* HEADER */}
        <div className="mb-6 animate-enter px-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: colores.muted }}>Módulo</p>
              <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Registro</h1>
              <div className="flex items-center gap-1 mt-1.5">
                <button
                  onClick={() => { if (visMes === 1) { setVisMes(12); setVisAño(v => v - 1) } else setVisMes(v => v - 1) }}
                  style={{ padding: '2px 5px', color: colores.muted, border: 'none', cursor: 'pointer', display: 'flex' }}>
                  <ChevronLeft size={13} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 72, textAlign: 'center' }}>
                  {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][visMes - 1]} {visAño}
                </span>
                <button
                  onClick={() => { if (visMes === 12) { setVisMes(1); setVisAño(v => v + 1) } else setVisMes(v => v + 1) }}
                  disabled={visMes === mes && visAño === año}
                  style={{ padding: '2px 5px', color: visMes === mes && visAño === año ? colores.border : colores.muted, border: 'none', cursor: visMes === mes && visAño === año ? 'default' : 'pointer', display: 'flex' }}>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
            <button onClick={() => setModal(true)} className="ff-btn-primary flex items-center justify-center gap-2"
              style={{ background: colores.main }}>
              <Plus size={18} strokeWidth={3} />
              <span className="hidden sm:inline">Nuevo registro</span>
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl text-xs font-semibold" style={{
            background: `color-mix(in srgb, ${colores.rose} 8%, transparent)`,
            border: `1px solid color-mix(in srgb, ${colores.rose} 20%, transparent)`,
            color: colores.rose,
          }}>{error}</div>
        )}

        {/* KPI CARDS */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { label: 'Ingresos', value: formatCurrency(ingresos), color: colores.green, icon: ArrowUpRight },
            { label: 'Egresos', value: formatCurrency(egresos), color: colores.rose, icon: ArrowDownRight },
            {
              label: 'Balance',
              value: formatCurrency(ingresos - egresos),
              color: ingresos - egresos >= 0 ? colores.green : colores.rose,
              icon: ingresos - egresos >= 0 ? ArrowUpRight : ArrowDownRight,
            },
          ].map((s, i) => (
            <div key={i} className="animate-enter"
              style={{
                background: colores.card,
                borderRadius: 20,
                padding: '12px 14px',
                border: `1px solid ${colores.border}`,
                animationDelay: `${i * 0.05}s`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
              <div style={{
                width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                background: `color-mix(in srgb, ${s.color} 12%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <s.icon size={12} style={{ color: s.color }} strokeWidth={2.5} />
              </div>
              <div>
                <p style={{
                  fontSize: 8, fontWeight: 900, textTransform: 'uppercase',
                  letterSpacing: '0.12em', color: colores.muted, marginBottom: 4,
                }}>{s.label}</p>
                <p style={{
                  fontSize: 15, fontWeight: 600,
                  color: s.color, lineHeight: 1,
                }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* BÚSQUEDA Y FILTROS */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="relative w-full">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: colores.muted, zIndex: 10 }} />
            <input className="ff-input w-full h-12" style={{ paddingLeft: '3.5rem' }}
              placeholder="Buscar movimiento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {[{ v: 'todos', l: 'Todos' }, { v: 'ingreso', l: 'Ingresos' }, { v: 'egreso', l: 'Egresos' }, { v: 'retiro', l: 'Retiros' }, { v: 'deuda', l: 'Deudas' }, { v: 'ahorro', l: 'Ahorro' }].map(f => (
              <button key={f.v} onClick={() => setFiltro(f.v)}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap border"
                style={{
                  background: filtro === f.v ? `color-mix(in srgb, ${colores.green} 10%, transparent)` : 'transparent',
                  color: filtro === f.v ? colores.green : colores.muted,
                  borderColor: filtro === f.v ? `color-mix(in srgb, ${colores.green} 20%, transparent)` : 'transparent',
                }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        {/* LISTA DE MOVIMIENTOS */}
        <Card className="overflow-hidden border-none"
          style={{ boxShadow: '0 8px 20px -6px color-mix(in srgb, var(--accent-main) 16%, transparent), 0 2px 6px -2px color-mix(in srgb, var(--bg-dark-card) 8%, transparent)' }}>
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 px-1 py-1">
                  <div className="skeleton w-9 h-9 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-3/5" />
                    <div className="skeleton h-2.5 w-2/5" />
                  </div>
                  <div className="skeleton h-3 w-14" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 px-6">
              {movs.length === 0 ? (
                <>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: `color-mix(in srgb, ${colores.main} 10%, transparent)` }}>
                    <Receipt size={24} style={{ color: colores.main }} />
                  </div>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>Sin registros este mes</p>
                  <p className="text-xs mb-5 opacity-60" style={{ color: 'var(--text-muted)' }}>Añade tu primer ingreso o gasto</p>
                  <button onClick={() => setModal(true)} className="ff-btn-primary !w-auto min-w-[180px]"
                    style={{ background: colores.main }}>
                    Nuevo registro
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Sin resultados</p>
                  <p className="text-xs opacity-60" style={{ color: 'var(--text-muted)' }}>Prueba otro filtro o búsqueda</p>
                </>
              )}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: colores.border }}>
              {filtered.map((m, i) => (
                <div key={m.id}
                  className="flex items-center gap-2.5 px-3 py-3 group"
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'translateY(0)' }}
                  style={{ animationDelay: `${i * 0.02}s`, transition: 'background 0.18s ease, transform 0.15s ease' }}>

                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: m.tipo === 'ingreso'
                        ? `color-mix(in srgb, ${colores.green} 10%, transparent)`
                        : m.tipo === 'retiro'
                          ? `color-mix(in srgb, ${colores.terra} 10%, transparent)`
                          : `color-mix(in srgb, ${colores.rose} 10%, transparent)`,
                      color: m.tipo === 'ingreso' ? colores.green : m.tipo === 'retiro' ? colores.terra : colores.rose,
                    }}>
                    {m.tipo === 'ingreso' ? <ArrowUpRight size={18} /> : m.tipo === 'retiro' ? <Minus size={18} /> : <ArrowDownRight size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight" style={{ color: 'var(--text-primary)' }}>
                      {m.descripcion}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {(() => {
                        const esIngreso = m.tipo === 'ingreso'
                        const esRetiro = m.tipo === 'retiro'
                        const color = esIngreso ? colores.green : esRetiro ? colores.terra : (CAT_COLOR_VAR[m.categoria] || colores.muted)
                        const label = esIngreso ? 'ingreso' : esRetiro ? 'retiro' : m.categoria
                        const [fy, fm, fd] = (m.fecha || '').split('-').map(Number)
                        const fechaObj = fy ? new Date(fy, fm - 1, fd) : null
                        const fechaStr = fechaObj ? fechaObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
                        const metodoInfo = m.metodo_pago ? METODOS_PAGO.find(mp => mp.id === m.metodo_pago) : null
                        const deudaRef = m.deuda_id ? deudasData.find(d => d.id === m.deuda_id) : null
                        return (
                          <>
                            <span style={{
                              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                              letterSpacing: '0.12em', padding: '3px 8px', borderRadius: 999,
                              background: `color-mix(in srgb, ${color} 12%, transparent)`,
                              color: color,
                            }}>
                              {label}
                            </span>
                            {fechaStr && (
                              <span style={{ fontSize: 9, color: colores.muted, fontWeight: 500 }}>
                                {fechaStr}
                              </span>
                            )}
                            {metodoInfo && m.tipo === 'egreso' && (
                              <span style={{
                                fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                                padding: '3px 6px', borderRadius: 999,
                                background: `color-mix(in srgb, ${metodoInfo.color} 12%, transparent)`,
                                color: metodoInfo.color,
                              }}>
                                {metodoInfo.short}
                              </span>
                            )}
                            {deudaRef && (
                              <span style={{ fontSize: 9, color: colores.muted, fontWeight: 500 }}>
                                pendiente {formatCurrency(deudaRef.pendiente)}
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="text-right flex flex-col items-end gap-0.5 flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums"
                      style={{ color: m.tipo === 'ingreso' ? colores.green : m.tipo === 'retiro' ? colores.terra : colores.rose }}>
                      {m.tipo === 'ingreso' ? '+' : m.tipo === 'retiro' ? '−' : '-'}{formatCurrency(m.monto)}
                    </p>
                    <button
                      onClick={() => handleDelete(m)}
                      className="p-1 transition-all"
                      style={{ color: colores.muted, opacity: 0.4 }}
                      onMouseEnter={e => { e.currentTarget.style.color = colores.rose; e.currentTarget.style.opacity = '1' }}
                      onMouseLeave={e => { e.currentTarget.style.color = colores.muted; e.currentTarget.style.opacity = '0.4' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Cargar más movimientos */}
        {hayMas && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => cargarMovimientos(true)}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold border transition-all"
              style={{
                borderColor: 'var(--border-glass)',
                color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
              }}>
              {loading ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
              Cargar historial completo
            </button>
          </div>
        )}

        {/* MODAL NUEVO MOVIMIENTO */}
        <Modal open={modal} onClose={resetModal} title="Nuevo Movimiento">
          <form onSubmit={handleAdd} className="space-y-4">

            {/* Tipo toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'var(--bg-secondary)' }}>
              {['ingreso', 'egreso'].map(t => (
                <button type="button" key={t}
                  onClick={() => {
                    setForm({ ...form, tipo: t, categoria: t === 'ingreso' ? 'ingreso' : 'basicos' })
                    setTarjetaSeleccionada('')
                  }}
                  className="py-2.5 rounded-xl text-xs font-semibold uppercase tracking-widest transition-all"
                  style={{
                    background: form.tipo === t ? colores.card : 'transparent',
                    color: form.tipo === t ? 'var(--text-primary)' : colores.muted,
                    boxShadow: form.tipo === t ? 'var(--shadow-sm)' : 'none',
                  }}>
                  {t}
                </button>
              ))}
            </div>

            {/* Categoría + Quién */}
            <div className={`grid ${form.tipo === 'egreso' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              {form.tipo === 'egreso' && (
                <div className="space-y-1">
                  <label className="ff-label">Categoría</label>
                  <CustomSelect
                    value={form.categoria}
                    onChange={id => { setForm({ ...form, categoria: id || 'basicos', subcategoria_id: '' }); setTarjetaSeleccionada('') }}
                    options={CATS.map(c => ({ id: c.value, label: c.label }))}
                    placeholder="— Categoría —"
                  />
                </div>
              )}
              <div className="space-y-1">
                <label className="ff-label">¿Quién?</label>
                <CustomSelect
                  value={form.quien}
                  onChange={id => setForm({ ...form, quien: id || defaultQuien })}
                  options={opcionesQuien}
                  placeholder="— Quién —"
                />
              </div>
            </div>

            {/* Subcategoría (si hay configuradas) */}
            {form.tipo === 'egreso' && (() => {
              const bloqueActual = CAT_BLOQUE[form.categoria]
              const catsDisp = categoriasCfg.filter(c => c.bloque === bloqueActual)
              const subsDisp = subcategorias.filter(s => catsDisp.some(c => c.id === s.categoria_id))
              if (subsDisp.length === 0) return null
              const opcionesSubcat = catsDisp.flatMap(cat => {
                const subsGrupo = subcategorias.filter(s => s.categoria_id === cat.id)
                if (subsGrupo.length === 0) return []
                return [
                  { id: `h-${cat.id}`, label: cat.nombre, header: true },
                  ...subsGrupo.map(sub => ({
                    id: sub.id,
                    label: sub.nombre,
                    sub: subcatPresupuesto[sub.id] > 0 ? formatCurrency(subcatPresupuesto[sub.id]) : undefined,
                  })),
                ]
              })
              return (
                <div className="space-y-1 animate-enter">
                  <label className="ff-label">Subcategoría (opcional)</label>
                  <CustomSelect
                    value={form.subcategoria_id}
                    onChange={id => {
                      const sub = subcategorias.find(s => s.id === id)
                      setForm(prev => ({
                        ...prev,
                        subcategoria_id: id || '',
                        descripcion: sub ? sub.nombre : prev.descripcion,
                        ...(id && subcatPresupuesto[id] > 0 ? { monto: subcatPresupuesto[id].toString() } : {}),
                      }))
                    }}
                    options={opcionesSubcat}
                    placeholder="— Sin subcategoría —"
                  />
                </div>
              )
            })()}

            {/* Método de pago */}
            {form.tipo === 'egreso' && (
              <div className="space-y-2 animate-enter">
                <label className="ff-label">Método de pago</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {METODOS_PAGO.map(m => {
                    const sel = metodoPago === m.id
                    const c = m.color || 'var(--text-muted)'
                    return (
                      <button type="button" key={m.id}
                        onClick={() => {
                          setMetodoPago(m.id)
                          setTarjetaSeleccionada(m.id === 'tarjeta_credito' && tarjetasData.length === 1 ? tarjetasData[0].id : '')
                          setNumCuotas(1)
                        }}
                        className="py-2 rounded-xl text-[10px] font-semibold transition-all"
                        style={{
                          background: sel ? `color-mix(in srgb, ${c} 15%, transparent)` : 'var(--bg-secondary)',
                          color: sel ? c : 'var(--text-muted)',
                          border: `1.5px solid ${sel ? c : 'transparent'}`,
                          cursor: 'pointer',
                        }}>
                        {m.short}
                      </button>
                    )
                  })}
                </div>

                {metodoPago === 'tarjeta_credito' && tarjetasData.length > 0 && (
                  <div className="space-y-2">
                    {/* Picker de tarjeta — igual que FAB */}
                    <div className="space-y-1.5">
                      {tarjetasData.filter(t => t.estado !== 'pausada').map(t => {
                        const isSel = tarjetaSeleccionada === t.id
                        return (
                          <button type="button" key={t.id}
                            onClick={() => setTarjetaSeleccionada(isSel ? '' : t.id)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all"
                            style={{
                              background: isSel ? `color-mix(in srgb, ${colores.rose} 10%, transparent)` : 'var(--bg-secondary)',
                              border: `1px solid ${isSel ? colores.rose : 'transparent'}`,
                              cursor: 'pointer',
                            }}>
                            <span className="text-[11px] font-semibold flex-1 truncate"
                              style={{ color: isSel ? colores.rose : 'var(--text-primary)' }}>
                              {t.nombre_tarjeta}{t.banco ? ` · ${t.banco}` : ''}
                            </span>
                            {t.dia_pago && <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Día {t.dia_pago}</span>}
                            {isSel && <span style={{ color: colores.rose, fontSize: 12 }}>✓</span>}
                          </button>
                        )
                      })}
                    </div>
                    {/* Cuotas — input libre */}
                    {tarjetaSeleccionada && (
                      <div>
                        <label className="ff-label">Número de cuotas</label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            max="60"
                            placeholder="—"
                            value={numCuotas}
                            onChange={e => setNumCuotas(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                            className="ff-input text-center font-semibold"
                            style={{ width: 80, color: colores.rose }}
                          />
                          <p className="text-[10px] flex-1" style={{ color: colores.muted }}>
                            {!numCuotas
                              ? 'Ingresa el nº de cuotas'
                              : parseInt(numCuotas) === 1
                                ? 'Pago único · se paga desde Tarjetas'
                                : parseFloat(form.monto) > 0
                                  ? `${numCuotas}x de ${formatCurrency(parseFloat(form.monto) / parseInt(numCuotas))} · se paga desde Tarjetas`
                                  : `${numCuotas} cuotas`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sugerencias */}
            {!usandoTarjeta && sugerenciasRicas.length > 0 && (
              <div className="animate-enter">
                <p className="text-[10px] font-semibold uppercase mb-2 ml-1" style={{ color: colores.muted }}>
                  Sugerencias del presupuesto
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {sugerenciasRicas.map(item => (
                    <button type="button" key={item.id}
                      onClick={() => aplicarSugerencia({ ...item, nombre: `${item.emoji} ${item.nombre}` })}
                      className="text-left p-3 rounded-2xl border transition-all hover:scale-[1.02] active:scale-95"
                      style={{
                        background: `color-mix(in srgb, ${item.color} 8%, transparent)`,
                        borderColor: `color-mix(in srgb, ${item.color} 25%, transparent)`,
                      }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-base leading-none">{item.emoji}</span>
                        <p className="text-[10px] font-semibold truncate leading-tight" style={{ color: 'var(--text-secondary)' }}>
                          {item.nombre}
                        </p>
                      </div>
                      {item.monto > 0 && (
                        <p className="text-sm font-semibold mb-1" style={{ color: item.color }}>
                          {formatCurrency(item.monto)}
                        </p>
                      )}
                      {item.sub && (
                        <p className="text-[9px] truncate mb-1" style={{ color: colores.muted }}>{item.sub}</p>
                      )}
                      {item.pct !== null && (
                        <div className="w-full h-1 rounded-full mt-1" style={{ background: colores.track }}>
                          <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selector deuda */}
            {form.tipo === 'egreso' && form.categoria === 'deuda' && (() => {
              const deudasPrestamo = deudasData.filter(d => d.tipo_deuda !== 'tarjeta')
              const hayTarjetas = deudasData.some(d => d.tipo_deuda === 'tarjeta')
              return (
                <div className="space-y-2 animate-enter">
                  {deudasPrestamo.length > 0 && (
                    <div className="space-y-1">
                      <label className="ff-label">¿Qué deuda pagas?</label>
                      <CustomSelect
                        value={deudaSeleccionada}
                        onChange={id => {
                          setDeudaSeleccionada(id || '')
                          const d = deudasPrestamo.find(d => d.id === id)
                          if (d) setForm(prev => ({ ...prev, descripcion: `Pago ${d.nombre}`, monto: (d.cuota || d.pendiente || '').toString() }))
                        }}
                        options={deudasPrestamo.map(d => ({
                          id: d.id,
                          label: d.nombre,
                          sub: formatCurrency(d.pendiente),
                        }))}
                        placeholder="— Seleccionar deuda —"
                        color="var(--accent-rose)"
                      />
                    </div>
                  )}
                  {hayTarjetas && (
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                      💳 Los pagos de tarjeta de crédito se registran desde el módulo <strong>Tarjetas</strong>.
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Descripción / Nota */}
            {(sugerenciasRicas.length === 0 || metaSeleccionada || form.descripcion) && (
              <div className="space-y-1 animate-enter">
                <label className="ff-label">
                  {form.subcategoria_id ? 'Nota (opcional)' : 'Descripción'}
                </label>
                <input className="ff-input h-12 text-sm font-medium"
                  placeholder={form.subcategoria_id ? 'Añade un detalle...' : 'Ej: Sueldo, Alquiler...'}
                  required={!form.subcategoria_id}
                  value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
              </div>
            )}

            {/* Monto + Fecha */}
            {(sugerenciasRicas.length === 0 || metaSeleccionada || form.descripcion) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="ff-label">Monto (€)</label>
                  <input className="ff-input h-12 text-sm font-semibold" type="number" step="0.01" placeholder="0.00" required
                    style={{ color: colores.terra }}
                    value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <label className="ff-label">Fecha</label>
                  <input className="ff-input h-12 text-sm font-medium" type="date" required
                    value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-14 text-sm font-semibold shadow-lg flex items-center justify-center gap-2 transition-all rounded-xl"
              style={{
                background: 'var(--accent-main)',
                color: 'var(--bg-card)',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? <Loader2 size={20} className="animate-spin" /> : usandoTarjeta ? '💳 Cargar a tarjeta' : 'CONFIRMAR'}
            </button>
          </form>
        </Modal>

      </div>
      <ConfirmDialog {...confirmProps} />
    </AppShell>
  )
}