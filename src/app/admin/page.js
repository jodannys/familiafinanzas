'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Users, UserPlus, Loader2, Copy, Check,
} from 'lucide-react'
import {
  supabase,
  crearInvitacion,
} from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'
import CustomSelect from '@/components/ui/CustomSelect'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFechaDDMM(fechaStr) {
  if (!fechaStr) return ''
  const d = new Date(fechaStr)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${mon}`
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function AdminPage() {
  // ── Sección 1: Panel Familiar ──────────────────────────────────────────────
  const [miembros, setMiembros] = useState([])
  const [seleccionado, setSeleccionado] = useState('')
  const [movimientos, setMovimientos] = useState([])
  const [loadingMov, setLoadingMov] = useState(false)

  // ── Sección 2: Invitar Miembro ─────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [linkGenerado, setLinkGenerado] = useState('')
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // ── Cargar miembros del hogar ──────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('perfiles')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setMiembros(data || []))
  }, [])
  

  // ── Cargar movimientos cuando cambia el miembro seleccionado ──────────────
  useEffect(() => {
    cargarMovimientos(seleccionado)
  }, [seleccionado])

  async function cargarMovimientos(nombreMiembro) {
    setLoadingMov(true)
    const hoy = new Date()
    const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    let query = supabase
      .from('movimientos')
      .select('id, fecha, tipo, categoria, descripcion, monto, quien')
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
      .limit(100)
    if (nombreMiembro) {
      query = query.eq('quien', nombreMiembro)
    }
    const { data } = await query
    setMovimientos(data || [])
    setLoadingMov(false)
  }

  // ── KPIs del miembro seleccionado ─────────────────────────────────────────
  const totalIngresos = movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + (m.monto || 0), 0)

  const totalGastos = movimientos
    .filter(m => m.tipo === 'egreso')
    .reduce((s, m) => s + (m.monto || 0), 0)

  // ── Generar invitación ─────────────────────────────────────────────────────
  async function handleGenerar() {
    if (!email.trim()) {
      toast('Ingresa un email para continuar')
      return
    }
    setGenerando(true)
    const { data, error } = await crearInvitacion(email.trim())
    setGenerando(false)
    if (error || !data?.ok) {
      toast('Error: ' + (error?.message || data?.error || 'No se pudo generar la invitación'))
      return
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const token = data.token || data
    setLinkGenerado(`${baseUrl}/login?token=${token}`)
  }

  async function handleCopiar() {
    await navigator.clipboard.writeText(linkGenerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <AppShell>
    <div className="flex flex-col gap-6 pb-24 px-2 sm:px-4 pt-6 w-full max-w-2xl mx-auto">

        {/* ── Cabecera de página ───────────────────────────────────────────── */}
        <div>
          <h1
            className="text-3xl"
            style={{ color: 'var(--text-primary)', fontFamily: 'DM Serif Display, Georgia, serif' }}
          >
            Panel de Admin
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Gestiona los miembros del hogar e invita nuevos integrantes.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECCIÓN 1 — Panel Familiar                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <Card>
          {/* Título */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-blue) 20%, transparent)',
              }}
            >
              <Users size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div>
              <h2
                className="text-xl leading-tight"
                style={{ color: 'var(--text-primary)', fontFamily: 'DM Serif Display, Georgia, serif' }}
              >
                Panel Familiar
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Consulta movimientos de cada miembro este mes
              </p>
            </div>
          </div>

          {/* Selector de miembro */}
          <div className="mb-5">
            <label className="ff-label">Miembro del hogar</label>
            <CustomSelect
              value={seleccionado}
              onChange={val => setSeleccionado(val ?? '')}
              options={miembros.map(m => ({ id: m.nombre, label: m.nombre }))}
              placeholder="Todos los miembros"
            />
          </div>

          {/* KPIs — todos los miembros o el seleccionado */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div
              className="rounded-2xl p-4"
              style={{
                background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-green) 18%, transparent)',
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-1"
                style={{ color: 'var(--accent-green)' }}
              >
                {seleccionado ? `Ingresos · ${seleccionado}` : 'Ingresos · Todos'}
              </p>
              <p
                className="text-lg font-black leading-tight"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
              >
                {formatCurrency(totalIngresos)}
              </p>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{
                background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-rose) 18%, transparent)',
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-1"
                style={{ color: 'var(--accent-rose)' }}
              >
                {seleccionado ? `Gastos · ${seleccionado}` : 'Gastos · Todos'}
              </p>
              <p
                className="text-lg font-black leading-tight"
                style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}
              >
                {formatCurrency(totalGastos)}
              </p>
            </div>
          </div>

          {/* Lista de movimientos */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-secondary)' }}
          >
            {loadingMov ? (
              <div className="flex items-center justify-center py-10">
                <Loader2
                  size={24}
                  className="animate-spin"
                  style={{ color: 'var(--accent-main)' }}
                />
              </div>
            ) : movimientos.length === 0 ? (
              <p
                className="text-center py-8 text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Sin movimientos este mes
              </p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                {movimientos.map((mov, i) => (
                  <li
                    key={mov.id || i}
                    className="flex items-center justify-between px-4 py-3 gap-3"
                  >
                    <span
                      className="text-xs font-bold flex-shrink-0 w-10 text-center tabular-nums"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {formatFechaDDMM(mov.fecha)}
                    </span>

                    <div className="flex flex-col flex-1 min-w-0">
                      <span
                        className="text-sm truncate"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {mov.descripcion || mov.categoria || 'Sin descripción'}
                      </span>
                      {!seleccionado && mov.quien && (
                        <span
                          className="text-[11px]"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {mov.quien}
                        </span>
                      )}
                    </div>

                    <span
                      className="text-sm font-black flex-shrink-0 tabular-nums"
                      style={{
                        color: mov.tipo === 'ingreso'
                          ? 'var(--accent-green)'
                          : 'var(--accent-rose)',
                      }}
                    >
                      {mov.tipo === 'ingreso' ? '+' : '-'}
                      {formatCurrency(mov.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SECCIÓN 2 — Invitar Miembro                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <Card>
          {/* Título */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--accent-main) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-main) 20%, transparent)',
              }}
            >
              <UserPlus size={18} style={{ color: 'var(--accent-main)' }} />
            </div>
            <div>
              <h2
                className="text-xl leading-tight"
                style={{ color: 'var(--text-primary)', fontFamily: 'DM Serif Display, Georgia, serif' }}
              >
                Invitar Miembro
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Genera un link de invitación para un nuevo integrante
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="mb-6">
            <label className="ff-label">Email del invitado</label>
            <input
              type="email"
              className="ff-input"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Botón generar */}
          <button
            className="ff-btn-primary w-full"
            onClick={handleGenerar}
            disabled={generando}
            aria-busy={generando}
          >
            {generando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <UserPlus size={16} />
            )}
            {generando ? 'Generando...' : 'Generar invitación'}
          </button>

          {/* Link generado */}
          {linkGenerado && (
            <div
              className="mt-4 rounded-2xl p-4"
              style={{
                background: 'color-mix(in srgb, var(--accent-green) 7%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
              }}
            >
              <p
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: 'var(--accent-green)' }}
              >
                Link de invitación listo
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={linkGenerado}
                  className="ff-input"
                  style={{ fontSize: 12, flex: 1 }}
                  onFocus={e => e.target.select()}
                  aria-label="Link de invitación generado"
                />
                <button
                  onClick={handleCopiar}
                  aria-label={copiado ? 'Copiado' : 'Copiar link'}
                  style={{
                    flexShrink: 0,
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    border: '1px solid color-mix(in srgb, var(--accent-green) 30%, transparent)',
                    background: copiado
                      ? 'color-mix(in srgb, var(--accent-green) 20%, transparent)'
                      : 'var(--bg-secondary)',
                    color: copiado ? 'var(--accent-green)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}
        </Card>

      </div>
    </AppShell>
  )
}
