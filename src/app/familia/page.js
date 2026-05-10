'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useFormatCurrency } from '@/lib/useFormatCurrency'
import { getRangoMes } from '@/lib/utils'
import {
  Users, ChevronLeft, ChevronRight, Flame,
  ArrowUpRight, ArrowDownRight, Loader2,
} from 'lucide-react'
import CustomSelect from '@/components/ui/CustomSelect'

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export default function FamiliaPage() {
  const formatCurrency = useFormatCurrency()

  const hoyReal = new Date()
  const [mes, setMes] = useState({
    year: hoyReal.getFullYear(),
    month: hoyReal.getMonth() + 1,
  })
  const esHoy = mes.year === hoyReal.getFullYear() && mes.month === hoyReal.getMonth() + 1

  const [hogarId, setHogarId] = useState(null)
  const [miembros, setMiembros] = useState([])
  const [seleccionado, setSeleccionado] = useState('')
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)

  // ── Cargar hogar y miembros ──────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('perfiles')
        .select('hogar_id')
        .eq('id', user.id)
        .single()
      if (data?.hogar_id) setHogarId(data.hogar_id)
    }
    init()
  }, [])

  useEffect(() => {
    if (!hogarId) return
    supabase
      .from('perfiles')
      .select('id, nombre')
      .eq('hogar_id', hogarId)
      .order('nombre')
      .then(({ data }) => setMiembros(data || []))
  }, [hogarId])

  // ── Cargar movimientos del mes ───────────────────────────────────────────
  useEffect(() => {
    if (!hogarId) return
    setLoading(true)

    const { inicio, fin } = getRangoMes(mes.month, mes.year)

    let q = supabase
      .from('movimientos')
      .select('id, fecha, tipo, categoria, descripcion, monto, quien')
      .eq('hogar_id', hogarId)
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: false })
      .limit(150)

    if (seleccionado) q = q.eq('quien', seleccionado)

    q.then(({ data, error }) => {
      if (error) console.error(error)
      setMovimientos(data || [])
      setLoading(false)
    })
  }, [hogarId, mes, seleccionado])

  // ── Navegación ───────────────────────────────────────────────────────────
  function irAnterior() {
    setMes(p => p.month === 1
      ? { year: p.year - 1, month: 12 }
      : { year: p.year, month: p.month - 1 }
    )
  }
  function irSiguiente() {
    if (esHoy) return
    setMes(p => p.month === 12
      ? { year: p.year + 1, month: 1 }
      : { year: p.year, month: p.month + 1 }
    )
  }

  // ── KPIs globales ────────────────────────────────────────────────────────
  const totalIngresos = movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + (m.monto || 0), 0)
  const totalGastos = movimientos
    .filter(m => m.tipo === 'egreso')
    .reduce((s, m) => s + (m.monto || 0), 0)
  const balance = totalIngresos - totalGastos

  // ── Resumen por miembro ──────────────────────────────────────────────────
  const resumen = !seleccionado
    ? miembros.map(mb => {
        const movMb = movimientos.filter(m => m.quien === mb.nombre)
        const gastos = movMb.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0)
        const ingresos = movMb.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
        return { ...mb, gastos, ingresos, total: movMb.length }
      }).filter(mb => mb.total > 0)
    : []

  const mayorGastador = resumen.length > 0
    ? resumen.reduce((a, b) => b.gastos > a.gastos ? b : a)
    : null

  // ── Formatear fecha DD/MM ────────────────────────────────────────────────
  function fmtFecha(str) {
    if (!str) return ''
    const [, m, d] = str.split('-')
    return `${d}/${m}`
  }

  return (
    <AppShell>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6 animate-enter">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)' }}>
          <Users size={18} style={{ color: 'var(--accent-blue)' }} />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5"
            style={{ color: 'var(--text-muted)' }}>
            Módulo
          </p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Panel Familiar
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Actividad compartida del hogar
          </p>
        </div>
      </div>

      {/* ── Navegación por mes ── */}
      <div className="flex items-center justify-between mb-6 animate-enter"
        style={{ animationDelay: '0.05s' }}>
        <button onClick={irAnterior}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold"
            style={{ color: esHoy ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
            {MESES[mes.month - 1]} {mes.year}
          </p>
          {esHoy && (
            <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5"
              style={{ color: 'var(--accent-blue)', opacity: 0.7 }}>
              Mes actual
            </p>
          )}
        </div>
        <button onClick={irSiguiente} disabled={esHoy}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{
            background: 'var(--bg-secondary)', border: 'none',
            cursor: esHoy ? 'default' : 'pointer',
            opacity: esHoy ? 0.3 : 1,
          }}>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-3 gap-2 mb-6 animate-enter" style={{ animationDelay: '0.08s' }}>
        {[
          { label: 'Ingresos', value: totalIngresos, color: 'var(--accent-green)', Icon: ArrowUpRight },
          { label: 'Gastos', value: totalGastos, color: 'var(--accent-rose)', Icon: ArrowDownRight },
          {
            label: 'Balance',
            value: Math.abs(balance),
            color: balance >= 0 ? 'var(--accent-green)' : 'var(--accent-rose)',
            Icon: balance >= 0 ? ArrowUpRight : ArrowDownRight,
            prefix: balance >= 0 ? '+' : '-',
          },
        ].map((k, i) => (
          <div key={i} className="glass-card p-3">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center mb-2"
              style={{ background: `color-mix(in srgb, ${k.color} 12%, transparent)` }}>
              <k.Icon size={13} style={{ color: k.color }} strokeWidth={2.5} />
            </div>
            <p className="text-[9px] uppercase tracking-wider font-semibold mb-1"
              style={{ color: 'var(--text-muted)' }}>
              {k.label}
            </p>
            <p className="text-sm font-semibold tabular-nums"
              style={{ color: k.color }}>
              {k.prefix || ''}{formatCurrency(k.value)}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filtro por miembro ── */}
      <div className="mb-4 animate-enter" style={{ animationDelay: '0.1s' }}>
        <CustomSelect
          value={seleccionado || null}
          onChange={v => setSeleccionado(v || '')}
          options={miembros.map(m => ({ id: m.nombre, label: m.nombre }))}
          placeholder="Todos los miembros"
          color="var(--accent-blue)"
        />
      </div>

      {/* ── Resumen por miembro ── */}
      {!seleccionado && resumen.length > 0 && (
        <Card className="mb-4 animate-enter" style={{ animationDelay: '0.12s' }}>
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-3"
            style={{ color: 'var(--text-muted)' }}>
            Por miembro
          </p>
          <div className="space-y-3">
            {resumen.map(mb => {
              const esMayor = mayorGastador?.id === mb.id && mb.gastos > 0
              const pct = totalGastos > 0 ? (mb.gastos / totalGastos) * 100 : 0
              return (
                <div key={mb.id}>
                  {/* Nombre + montos */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: 'color-mix(in srgb, var(--accent-blue) 15%, transparent)',
                          fontSize: 11, fontWeight: 800, color: 'var(--accent-blue)',
                        }}>
                        {mb.nombre.charAt(0).toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {mb.nombre}
                      </p>
                      {esMayor && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                          style={{
                            background: 'color-mix(in srgb, var(--accent-terra) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--accent-terra) 20%, transparent)',
                          }}>
                          <Flame size={9} style={{ color: 'var(--accent-terra)' }} />
                          <span className="text-[8px] font-bold uppercase"
                            style={{ color: 'var(--accent-terra)' }}>
                            Más gasta
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums"
                        style={{ color: 'var(--accent-rose)' }}>
                        -{formatCurrency(mb.gastos)}
                      </p>
                      {mb.ingresos > 0 && (
                        <p className="text-[10px] font-semibold tabular-nums"
                          style={{ color: 'var(--accent-green)' }}>
                          +{formatCurrency(mb.ingresos)}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Barra proporcional */}
                  <div className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--border-glass) 60%, transparent)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: esMayor
                          ? 'var(--accent-terra)'
                          : 'var(--accent-blue)',
                      }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── Lista de movimientos ── */}
      <Card className="overflow-hidden animate-enter" style={{ animationDelay: '0.15s' }}>
        <p className="text-[10px] uppercase tracking-widest font-semibold mb-3"
          style={{ color: 'var(--text-muted)' }}>
          Movimientos
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
          </div>
        ) : movimientos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Sin movimientos en {MESES[mes.month - 1].toLowerCase()}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
            {movimientos.map(m => (
              <div key={m.id}
                className="flex items-center gap-3 py-3"
                style={{ borderColor: 'var(--border-glass)' }}>
                {/* Icono tipo */}
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: m.tipo === 'ingreso'
                      ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)'
                      : 'color-mix(in srgb, var(--accent-rose) 12%, transparent)',
                  }}>
                  {m.tipo === 'ingreso'
                    ? <ArrowUpRight size={15} style={{ color: 'var(--accent-green)' }} />
                    : <ArrowDownRight size={15} style={{ color: 'var(--accent-rose)' }} />
                  }
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}>
                    {m.descripcion || m.categoria}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                      {fmtFecha(m.fecha)}
                    </span>
                    {!seleccionado && m.quien && (
                      <span className="text-[9px] font-bold"
                        style={{ color: 'var(--accent-blue)' }}>
                        {m.quien}
                      </span>
                    )}
                  </div>
                </div>
                {/* Monto */}
                <p className="text-sm font-bold tabular-nums flex-shrink-0"
                  style={{ color: m.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--accent-rose)' }}>
                  {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  )
}