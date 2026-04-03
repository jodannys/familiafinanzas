'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import {
  Users, UserPlus, Loader2, Copy, Check, ChevronDown,
} from 'lucide-react'
import {
  supabase,
  getMisPermisos,
  crearInvitacion,
} from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { toast } from '@/lib/toast'

// ── Permisos disponibles ───────────────────────────────────────────────────────

const PERMISOS_OPCIONES = [
  { key: 'gastos', label: 'Registro de gastos', icon: '💸' },
  { key: 'presupuesto', label: 'Presupuesto', icon: '📊' },
  { key: 'agenda', label: 'Agenda', icon: '📅' },
  { key: 'sobres', label: 'Sobres', icon: '👛' },
  { key: 'metas', label: 'Metas de Ahorro', icon: '🎯' },
  { key: 'inversiones', label: 'Inversiones', icon: '📈' },
  { key: 'deudas', label: 'Deudas', icon: '💳' },
  { key: 'inmuebles', label: 'Inmuebles', icon: '🏠' },
  { key: 'tarjetas', label: 'Mis Tarjetas', icon: '💳' },
  { key: 'reportes', label: 'Reportes', icon: '📋' },
]

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
  const router = useRouter()
  const [rolVerificado, setRolVerificado] = useState(false)

  // ── Sección 1: Panel Familiar ──────────────────────────────────────────────
  const [miembros, setMiembros] = useState([])
  const [seleccionado, setSeleccionado] = useState('')
  const [movimientos, setMovimientos] = useState([])
  const [loadingMov, setLoadingMov] = useState(false)

  // ── Sección 2: Invitar Miembro ─────────────────────────────────────────────
  const [email, setEmail] = useState('')
  const [rol, setRol] = useState('miembro')
  const [permisos, setPermisos] = useState(() =>
    Object.fromEntries(PERMISOS_OPCIONES.map(p => [p.key, true]))
  )
  const [linkGenerado, setLinkGenerado] = useState('')
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  // ── Verificar rol admin ────────────────────────────────────────────────────
  useEffect(() => {
    getMisPermisos().then(({ data }) => {
      if (data && data.rol !== 'admin') {
        router.replace('/')
        return
      }
      setRolVerificado(true)
    })
  }, [router])

  // ── Cargar miembros del hogar (perfiles_familia = quién gasta) ────────────
  useEffect(() => {
    if (!rolVerificado) return
    supabase
      .from('perfiles_familia')
      .select('id, nombre')
      .order('created_at')
      .then(({ data }) => setMiembros(data || []))
  }, [rolVerificado])

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

  // ── Helpers de permisos ────────────────────────────────────────────────────
  function togglePermiso(key) {
    setPermisos(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const todosActivos = PERMISOS_OPCIONES.every(p => permisos[p.key])
  const ningunoActivo = PERMISOS_OPCIONES.every(p => !permisos[p.key])

  function toggleTodos() {
    const nuevoEstado = !todosActivos
    setPermisos(Object.fromEntries(PERMISOS_OPCIONES.map(p => [p.key, nuevoEstado])))
  }

  // ── Generar invitación ─────────────────────────────────────────────────────
  async function handleGenerar() {
    if (!email.trim()) {
      toast('Ingresa un email para continuar')
      return
    }
    setGenerando(true)
    const { data, error } = await crearInvitacion(email.trim(), rol, permisos)
    setGenerando(false)
    if (error || !data?.ok) {
      toast('Error: ' + (error?.message || data?.error || 'No se pudo generar la invitación'))
      return
    }
    const baseUrl = 'https://finanzas-two-delta.vercel.app'
    const token = data.token || data // Depende de qué devuelva exactamente tu RPC

    setLinkGenerado(`${baseUrl}/login?token=${token}`)

  }

  async function handleCopiar() {
    await navigator.clipboard.writeText(linkGenerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  // ── Guardia de verificación ────────────────────────────────────────────────
  if (!rolVerificado) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-primary)',
        }}
      >
        <Loader2
          size={32}
          className="animate-spin"
          style={{ color: 'var(--accent-main)' }}
        />
      </div>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6 pb-24 px-4 pt-6 max-w-2xl mx-auto">

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
            <div style={{ position: 'relative' }}>
              <select
                className="ff-input"
                style={{ appearance: 'none', paddingRight: 44 }}
                value={seleccionado}
                onChange={e => setSeleccionado(e.target.value)}
              >
                <option value="">Seleccionar miembro...</option>
                {miembros.map((m) => (
                  <option key={m.id} value={m.nombre}>
                    {m.nombre}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
            </div>
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
                Genera un link personalizado con permisos a medida
              </p>
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
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

          {/* Rol */}
          <div className="mb-5">
            <label className="ff-label">Rol</label>
            <div style={{ position: 'relative' }}>
              <select
                className="ff-input"
                style={{ appearance: 'none', paddingRight: 44 }}
                value={rol}
                onChange={e => setRol(e.target.value)}
              >
                <option value="miembro">Miembro</option>
                <option value="admin">Admin</option>
              </select>
              <ChevronDown
                size={16}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {/* Permisos — encabezado con toggle global */}
          <div className="flex items-center justify-between mb-3">
            <label className="ff-label" style={{ margin: 0 }}>Acceso a módulos</label>
            <button
              onClick={toggleTodos}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--accent-main)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 8,
              }}
            >
              {todosActivos ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
          </div>

          {/* Grid de permisos */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
            {PERMISOS_OPCIONES.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => togglePermiso(key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  background: permisos[key]
                    ? 'color-mix(in srgb, var(--accent-main) 12%, transparent)'
                    : 'color-mix(in srgb, var(--text-muted) 6%, transparent)',
                  color: permisos[key] ? 'var(--accent-main)' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: 14 }}>{icon}</span>
                <span style={{ fontSize: 12, fontWeight: 600, flex: 1, lineHeight: 1.3 }}>
                  {label}
                </span>
                {permisos[key] && (
                  <Check
                    size={13}
                    style={{ color: 'var(--accent-main)', flexShrink: 0 }}
                  />
                )}
              </button>
            ))}
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
