'use client'
import { useState, useEffect, useMemo } from 'react'
import AppShell from '@/components/layout/AppShell'
import {
  Wallet, Target, Loader2, ArrowUpRight, ArrowDownRight,
  TrendingUp, CircleDollarSign, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getFlagEmoji } from '@/lib/utils'
import { FinanceChart } from '@/components/ui/FinanceChart'
import AgendaWidget from '@/components/agenda/AgendaWidget'
import Link from 'next/link'

const COLORES_CAT = {
  basicos: 'var(--accent-blue)',
  deseo: 'var(--accent-violet)',
  ahorro: 'var(--accent-green)',
  inversion: 'var(--accent-gold)',
  deuda: 'var(--accent-rose)',
}

const NOMBRES_CAT = {
  basicos: 'Básicos',
  deseo: 'Estilo de vida',
  deuda: 'Deudas',
  ahorro: 'Ahorro',
  inversion: 'Inversión',
}

function saludoBase(nombre) {
  const h = new Date().getHours()
  let saludo = ''
  let emoji = ''

  if (h >= 6 && h < 12) {
    saludo = 'buenos días'
    emoji = '☕'
  } else if (h >= 12 && h < 20) {
    saludo = 'buenas tardes'
    emoji = '☀️'
  } else {
    saludo = 'buenas noches'
    emoji = (h >= 20 || h < 5) ? '🌙' : '✨'
  }

  // Si hay nombre, dice "Hola [Nombre], buenos días ☕"
  // Si no, solo "Buenos días ☕"
  return nombre
    ? `Hola ${nombre}, ${saludo} ${emoji}`
    : `${saludo.charAt(0).toUpperCase() + saludo.slice(1)} ${emoji}`
}

function diasHastaPago(d) {
  if (!d?.dia_pago) return null
  // Si ya se completaron todas las cuotas, no hay próximo pago
  if (d.plazo_meses && (d.pagadas || 0) >= d.plazo_meses) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  let fechaPago
  if (d.fecha_primer_pago) {
    const base = new Date(d.fecha_primer_pago + 'T12:00:00')
    const targetMonth = base.getMonth() + (d.pagadas || 0)
    const targetYear = base.getFullYear() + Math.floor(targetMonth / 12)
    const targetMonthNorm = ((targetMonth % 12) + 12) % 12
    const lastDay = new Date(targetYear, targetMonthNorm + 1, 0).getDate()
    fechaPago = new Date(targetYear, targetMonthNorm, Math.min(base.getDate(), lastDay))
  } else {
    const diaHoy = hoy.getDate()
    const offsetMes = d.dia_pago < diaHoy ? 1 : 0
    const targetYear = hoy.getFullYear() + (hoy.getMonth() + offsetMes > 11 ? 1 : 0)
    const targetMonth = (hoy.getMonth() + offsetMes + 12) % 12
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
    fechaPago = new Date(targetYear, targetMonth, Math.min(d.dia_pago, lastDay))
  }
  fechaPago.setHours(0, 0, 0, 0)
  return Math.ceil((fechaPago - hoy) / (1000 * 60 * 60 * 24))
}

export default function Dashboard() {
  const [movs, setMovs] = useState([])
  const [metas, setMetas] = useState([])
  const [deudas, setDeudas] = useState([])
  const [inversiones, setInversiones] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setNombre(session?.user?.user_metadata?.nombre || '')
    })
    async function cargar() {
      try {
        const [{ data: m }, { data: mt }, { data: d }, { data: inv }] = await Promise.all([
          supabase.from('movimientos').select('*')
            .gte('fecha', `${new Date().getFullYear()}-01-01`)
            .order('fecha', { ascending: false }),
          supabase.from('metas').select('*').order('created_at'),
          supabase.from('deudas').select('*').eq('estado', 'activa'),
          supabase.from('inversiones').select('*').order('created_at'),
        ])
        setMovs(m || [])
        setMetas(mt || [])
        setDeudas(d || [])
        setInversiones(inv || [])
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [])

  const now = new Date()
  const mesActual = now.getMonth()
  const añoActual = now.getFullYear()

  const movsMes = useMemo(() =>
    movs.filter(m => {
      if (!m.fecha) return false
      const [year, month] = m.fecha.split('-').map(Number)
      return month - 1 === mesActual && year === añoActual
    }), [movs, mesActual, añoActual])

  const ultimosMovs = useMemo(() => movsMes.slice(0, 6), [movsMes])

  const dataGrafico = useMemo(() => {
    if (!movs.length) return []
    const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const porMes = Array.from({ length: 12 }, (_, i) => ({ name: MESES[i], gastos: 0, ingresos: 0 }))
    movs.forEach(mov => {
      if (!mov.fecha) return
      const mes = parseInt(mov.fecha.split('-')[1], 10) - 1
      const año = parseInt(mov.fecha.split('-')[0], 10)
      if (año !== añoActual || mes < 0 || mes > 11) return
      if (mov.tipo === 'ingreso') porMes[mes].ingresos += (mov.monto || 0)
      else if (['basicos', 'deseo', 'deuda'].includes(mov.categoria)) porMes[mes].gastos += (mov.monto || 0)
    })
    return porMes
  }, [movs, añoActual])

  const ingresosMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const gastosMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'egreso' && ['deseo', 'basicos', 'deuda'].includes(m.categoria))
      .reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const ahorroMes = useMemo(() =>
    movsMes.filter(m => m.tipo === 'egreso' && ['ahorro', 'inversion'].includes(m.categoria))
      .reduce((s, m) => s + (m.monto || 0), 0), [movsMes])

  const saldoLibre = ingresosMes - gastosMes - ahorroMes

  const distribucionReal = useMemo(() => {
    const totales = {}
    movsMes.filter(m => m.tipo === 'egreso' && ['basicos', 'deseo', 'deuda'].includes(m.categoria))
      .forEach(m => { totales[m.categoria] = (totales[m.categoria] || 0) + m.monto })
    return Object.entries(totales)
      .map(([name, monto]) => ({
        name, monto,
        pct: Math.round((monto / (gastosMes || 1)) * 100),
        color: COLORES_CAT[name] || 'var(--text-muted)',
      }))
      .sort((a, b) => b.monto - a.monto)
  }, [movsMes, gastosMes])

  const deudasPagadas = useMemo(() => new Set(
    movsMes.filter(m => m.tipo === 'egreso' && m.categoria === 'deuda' && m.deuda_id).map(m => m.deuda_id)
  ), [movsMes])

  const alertas = useMemo(() =>
    deudas
      .map(d => ({ ...d, dias: diasHastaPago(d) }))
      .filter(d => d.dias !== null && d.dias <= 7 && !deudasPagadas.has(d.id))
      .sort((a, b) => a.dias - b.dias)
    , [deudas, deudasPagadas])

  // Patrimonio
  const totalAhorro = useMemo(() => metas.reduce((s, m) => s + (m.actual || 0), 0), [metas])
  const totalInversiones = useMemo(() => inversiones.reduce((s, i) => s + (i.capital || 0), 0), [inversiones])
  const totalDeudas = useMemo(() => deudas.reduce((s, d) => s + (d.pendiente || 0), 0), [deudas])

  const pctGastos = ingresosMes > 0 ? Math.min(100, Math.round((gastosMes / ingresosMes) * 100)) : 0
  const pctAhorro = ingresosMes > 0 ? Math.min(100, Math.round((ahorroMes / ingresosMes) * 100)) : 0
  const pctDisp = ingresosMes > 0 ? Math.min(100, Math.round((Math.abs(saldoLibre) / ingresosMes) * 100)) : 0

  if (!mounted) return null
  if (loading) return (
    <AppShell>
      <div className="flex h-[70vh] items-center justify-center flex-col gap-6">
        <Loader2 className="animate-spin" size={40} style={{ color: 'var(--accent-green)' }} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] opacity-40">Cargando patrimonio...</p>
      </div>
    </AppShell>
  )

  return (
    <AppShell>

      {/* ── Header Principal ── */}
      <div className="mb-10 animate-in fade-in slide-in-from-left-6 duration-1000">

        {/* Fecha: Muy minimalista y separada */}
        <p className="uppercase tracking-[0.3em] font-black opacity-70 mb-3"
          style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          {now.toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {/* Saludo con fuente Sacramento */}
        <h1 className="font-script tracking-normal"
          style={{
            fontSize: '30px', // Sacramento necesita ser un poco más grande para leerse bien
            color: 'var(--text-primary)',
            fontWeight: 400,
            lineHeight: 1.1,
            fontFamily: "'Sacramento', cursive" // Forzamos la fuente si la variable falla
          }}>
          {saludoBase(nombre)}
        </h1>
      </div>

      {/* ── Strip de Patrimonio (Separado del saludo) ── */}
      <div className="grid grid-cols-3 gap-2.5 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        {[
          { label: 'En metas', val: totalAhorro, color: 'var(--accent-green)', Icon: Target, href: '/metas' },
          { label: 'Invertido', val: totalInversiones, color: 'var(--accent-violet)', Icon: TrendingUp, href: '/inversiones' },
          { label: 'Deudas', val: totalDeudas, color: 'var(--accent-rose)', Icon: CircleDollarSign, href: '/deudas' },
        ].map(({ label, val, color, Icon, href }) => (
          <Link key={label} href={href}
            className="flex flex-col gap-2 p-3.5 rounded-[24px] transition-all active:scale-95 border"
            style={{
              background: `color-mix(in srgb, ${color} 6%, var(--bg-card))`,
              borderColor: `color-mix(in srgb, ${color} 12%, transparent)`,
              textDecoration: 'none',
            }}>
            <div className="flex items-center gap-1.5 opacity-60">
              <Icon size={10} style={{ color }} />
              <span style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color }}>{label}</span>
            </div>
            <p className="font-sans font-bold tracking-tighter"
              style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              {formatCurrency(val)}
            </p>
          </Link>
        ))}
      </div>

      {/* ── Alertas deuda ── */}
      {
        alertas.length > 0 && (
          <div className="space-y-2 mb-7">
            {alertas.map(d => {
              const color = d.dias <= 3 ? 'var(--accent-rose)' : 'var(--accent-terra)'
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: `color-mix(in srgb, ${color} 7%, var(--bg-card))`,
                    border: `1px solid color-mix(in srgb, ${color} 18%, transparent)`,
                  }}>
                  <span className="text-base flex-shrink-0">{d.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{d.nombre}</p>
                    <p style={{ fontSize: 10, color }}>
                      {d.dias === 0 ? '¡Vence hoy!' : `Vence en ${d.dias} día${d.dias !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color }}>{formatCurrency(d.cuota)}</span>
                </div>
              )
            })}
          </div>
        )
      }

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
        {[
          { label: 'Ingresos', val: ingresosMes, col: 'var(--accent-green)', Icon: ArrowUpRight, signo: '+', pct: 100 },
          { label: 'Gastos', val: gastosMes, col: 'var(--accent-rose)', Icon: ArrowDownRight, signo: '-', pct: pctGastos },
          { label: 'Futuro', val: ahorroMes, col: 'var(--accent-gold)', Icon: Target, signo: '', pct: pctAhorro },
          { label: 'Disponible', val: saldoLibre, col: saldoLibre >= 0 ? 'var(--accent-blue)' : 'var(--accent-danger)', Icon: Wallet, signo: '', pct: pctDisp },
        ].map((k, i) => (
          <div key={i} className="animate-enter"
            style={{
              background: 'var(--bg-card)',
              borderRadius: 24,
              padding: '18px 18px 14px',
              minHeight: 118,
              border: '1px solid var(--border-glass)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              animationDelay: `${i * 0.06}s`,
            }}>

            {/* Label e Icono */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>
                {k.label}
              </span>
              <div style={{
                width: 26, height: 26, borderRadius: 9, flexShrink: 0,
                background: `color-mix(in srgb, ${k.col} 14%, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <k.Icon size={12} style={{ color: k.col }} strokeWidth={2.5} />
              </div>
            </div>

            {/* Monto y barra */}
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 8, color: k.col }}>
                {k.signo && <span style={{ marginRight: 3, opacity: 0.5 }}>{k.signo}</span>}
                {formatCurrency(Math.abs(k.val))}
              </p>
              <div style={{ height: 3, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${k.pct}%`, background: k.col, borderRadius: 999, transition: 'width 1s ease-out' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Agenda widget ── */}
      <div className="mb-7">
        <AgendaWidget />
      </div>

      {/* ── Gráfico + Últimos movimientos ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-7">

        <div className="lg:col-span-2">
          <FinanceChart data={dataGrafico} />
        </div>

        {/* Últimos movimientos */}
        <div className="flex flex-col rounded-[28px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
              Últimos movimientos
            </p>
            <Link href="/gastos" style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex-1">
            {ultimosMovs.length === 0 ? (
              <p className="text-center text-xs italic py-8" style={{ color: 'var(--text-muted)' }}>Sin movimientos este mes</p>
            ) : ultimosMovs.map((m, idx) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-2.5"
                style={{ borderBottom: idx < ultimosMovs.length - 1 ? '1px solid var(--border-glass)' : 'none' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${m.tipo === 'ingreso' ? 'var(--accent-green)' : COLORES_CAT[m.categoria] || 'var(--text-muted)'} 12%, transparent)` }}>
                  {m.tipo === 'ingreso'
                    ? <ArrowUpRight size={12} style={{ color: 'var(--accent-green)' }} />
                    : <ArrowDownRight size={12} style={{ color: COLORES_CAT[m.categoria] || 'var(--text-muted)' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                    {m.descripcion || NOMBRES_CAT[m.categoria] || m.categoria}
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 900, flexShrink: 0, color: m.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                  {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Distribución + Metas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Distribución */}
        <div className="rounded-[28px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
          <div className="px-5 py-3.5" style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
              Distribución del mes
            </p>
          </div>
          <div className="px-5 py-4 space-y-4">
            {distribucionReal.length > 0 ? distribucionReal.map(d => (
              <div key={d.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
                      {NOMBRES_CAT[d.name] || d.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCurrency(d.monto)}</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-primary)' }}>{d.pct}%</span>
                  </div>
                </div>
                <div style={{ height: 3, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${d.pct}%`, background: d.color, borderRadius: 999, transition: 'width 1s cubic-bezier(0.2,0,0.2,1)' }} />
                </div>
              </div>
            )) : (
              <p className="text-center text-xs italic py-6" style={{ color: 'var(--text-muted)' }}>Sin egresos este mes</p>
            )}
          </div>
        </div>

        {/* Metas */}
        <div className="lg:col-span-2 rounded-[28px] overflow-hidden"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
          <div className="flex items-center justify-between px-5 py-3.5"
            style={{ borderBottom: '1px solid var(--border-glass)' }}>
            <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
              Metas de Ahorro
            </p>
            <Link href="/metas" style={{ color: 'var(--text-muted)', display: 'flex' }}>
              <ChevronRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1, background: 'var(--border-glass)' }}>
            {metas.filter(m => m.estado !== 'pausada' && (m.actual || 0) < m.meta).length === 0 ? (
              <div style={{ background: 'var(--bg-card)', padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin metas activas</p>
              </div>
            ) : metas.filter(m => m.estado !== 'pausada' && (m.actual || 0) < m.meta).map(m => {
              const pct = Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100))
              return (
                <div key={m.id} style={{ background: 'var(--bg-card)', padding: '18px 20px' }}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div style={{
                      width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                      background: `${m.color}18`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                    }}>
                      {getFlagEmoji(m.emoji)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{m.nombre}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {formatCurrency(m.actual || 0)} / {formatCurrency(m.meta)}
                      </p>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.04em', color: m.color, flexShrink: 0 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 3, borderRadius: 999, background: 'var(--progress-track)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: m.color, borderRadius: 999, transition: 'width 1.2s cubic-bezier(0.2,0,0.2,1)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

    </AppShell >
  )
}
