'use client'
import { useState, useEffect } from 'react'
import { X, Edit3, Save, Mail, Lock, Eye, EyeOff, Palette, Check, Loader2, LogOut, UserPlus, Copy, Users, Globe } from 'lucide-react'
import { supabase, crearInvitacion, getMiembrosHogar, cancelarInvitacion } from '@/lib/supabase'
import { useTheme, getThemeColors, THEMES } from '@/lib/themes'
import { toast } from '@/lib/toast'
import CustomSelect from '@/components/ui/CustomSelect'
import { useCurrency } from '@/lib/CurrencyContext'

const PAISES = [
  { code: 'ES', label: 'España', emoji: '🇪🇸' },
  { code: 'MX', label: 'México', emoji: '🇲🇽' },
  { code: 'CO', label: 'Colombia', emoji: '🇨🇴' },
  { code: 'AR', label: 'Argentina', emoji: '🇦🇷' },
  { code: 'CL', label: 'Chile', emoji: '🇨🇱' },
  { code: 'PE', label: 'Perú', emoji: '🇵🇪' },
  { code: 'VE', label: 'Venezuela', emoji: '🇻🇪' },
  { code: 'EC', label: 'Ecuador', emoji: '🇪🇨' },
  { code: 'US', label: 'Estados Unidos', emoji: '🇺🇸' },
  { code: 'OTHER', label: 'Otro', emoji: '🌍' },
]

const PAIS_MONEDA = {
  ES: 'EUR', MX: 'MXN', CO: 'COP',
  AR: 'ARS', CL: 'CLP', PE: 'PEN',
  VE: 'VES', EC: 'USD', US: 'USD',
  OTHER: 'USD',
}

export default function ProfilePanel({ open, onClose, onLogout }) {
  const { theme, setTheme } = useTheme()
  const themeColors = getThemeColors(theme)
  const { currency, cambiarMoneda, MONEDAS } = useCurrency()

  const [user, setUser] = useState(null)
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [isGoogle, setIsGoogle] = useState(false)
  const [bgColor, setBgColor] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [pais, setPais] = useState('ES')

  const [editNombre, setEditNombre] = useState(false)
  const [nombreVal, setNombreVal] = useState('')
  const [savingNombre, setSavingNombre] = useState(false)

  const [editEmail, setEditEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const [editPwd, setEditPwd] = useState(false)
  const [newPwd, setNewPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  const [editMoneda, setEditMoneda] = useState(false)
  const [editPais, setEditPais] = useState(false)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [generando, setGenerando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const [miembros, setMiembros] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [cancelando, setCancelando] = useState(null)
  const [eliminando, setEliminando] = useState(null)

  const [miembroSeleccionado, setMiembroSeleccionado] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(false)

  // ── Cargar datos al abrir ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    supabase.auth.getUser().then(async ({ data: { user: u } }) => {
      if (!u) return
      setUser(u)
      const n = u.user_metadata?.nombre || ''
      setNombre(n)
      setNombreVal(n)
      setEmail(u.email || '')
      const google = u.app_metadata?.provider === 'google' ||
        (u.identities || []).some(i => i.provider === 'google')
      setIsGoogle(google)

      const { data: perfil } = await supabase
        .from('perfiles')
        .select('rol, pais')
        .eq('id', u.id)
        .single()
      setIsAdmin(perfil?.rol === 'admin')
      setPais(perfil?.pais || 'ES')

      const { data: miembrosData } = await getMiembrosHogar()
      if (miembrosData) {
        setMiembros(miembrosData.miembros || [])
        setPendientes(miembrosData.pendientes || [])
      }
    })

    return () => {
      setInviteEmail('')
      setInviteLink('')
      setCopiado(false)
    }
  }, [open])

  // ── Color avatar ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!themeColors?.length || !nombre) return
    let h = 0
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) & 0x7fffffff
    setBgColor(themeColors[h % themeColors.length])
  }, [nombre, themeColors])

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleGuardarNombre() {
    if (!nombreVal.trim()) return
    setSavingNombre(true)
    const { error } = await supabase.auth.updateUser({ data: { nombre: nombreVal.trim() } })
    if (!error && user) {
      await supabase.from('perfiles').update({ nombre: nombreVal.trim() }).eq('id', user.id)
      setNombre(nombreVal.trim())
    }
    setSavingNombre(false)
    if (error) { toast('Error: ' + error.message); return }
    setEditNombre(false)
    toast('Nombre actualizado', 'success')
  }

  async function handleGuardarEmail() {
    if (!newEmail.trim() || newEmail === email) return
    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setSavingEmail(false)
    if (error) { toast('Error: ' + error.message); return }
    toast('Revisa tu nuevo correo para confirmar', 'warning')
    setEditEmail(false)
    setNewEmail('')
  }

  async function handleGuardarPwd() {
    if (newPwd.length < 6) return
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setSavingPwd(false)
    if (error) { toast('Error: ' + error.message); return }
    toast('Contraseña actualizada', 'success')
    setNewPwd('')
    setEditPwd(false)
  }

  async function handleGuardarPais(nuevoPais) {
    if (!user) return
    const { error } = await supabase
      .from('perfiles')
      .update({ pais: nuevoPais })
      .eq('id', user.id)
    if (error) { toast('Error al guardar el país'); return }
    setPais(nuevoPais)
    setEditPais(false)

    const monedaNueva = PAIS_MONEDA[nuevoPais]
    if (monedaNueva && monedaNueva !== currency) {
      await cambiarMoneda(monedaNueva)
      toast(`País y moneda actualizados (${monedaNueva})`, 'success')
    } else {
      toast('País actualizado', 'success')
    }

    window.dispatchEvent(new CustomEvent('ff:pais-changed', { detail: { pais: nuevoPais } }))
  }

  // ✅ Cambiar handleEliminarMiembro
async function handleEliminarMiembro() {
  if (!miembroSeleccionado) return
  setEliminando(miembroSeleccionado.id)

  const { error } = await supabase.rpc('eliminar_miembro_hogar', {
    miembro_id: miembroSeleccionado.id
  })

  if (!error) {
    setMiembros(prev => prev.filter(m => m.id !== miembroSeleccionado.id))
    toast('Miembro eliminado del hogar', 'success')
  } else {
    toast('Error al eliminar el miembro')
  }

  setEliminando(null)
  setConfirmEliminar(false)
  setMiembroSeleccionado(null)
}

  async function handleGenerarInvitacion() {
    if (!inviteEmail.trim()) { toast('Ingresa el email del invitado', 'warning'); return }
    setGenerando(true)
    setInviteLink('')
    const { data, error } = await crearInvitacion(inviteEmail.trim())
    setGenerando(false)
    if (error || !data?.ok) {
      toast('Error: ' + (error?.message || data?.error || 'No se pudo generar la invitación'))
      return
    }
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || window.location.origin).trim()
    const token = data.token || data
    setInviteLink(`${baseUrl}/login?token=${encodeURIComponent(token)}`)
    const { data: miembrosData } = await getMiembrosHogar()
    if (miembrosData) setPendientes(miembrosData.pendientes || [])
  }

  async function handleCopiarLink() {
    if (!inviteLink) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteLink)
      } else {
        const el = document.createElement('textarea')
        el.value = inviteLink
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
      setCopiado(true)
      toast('Enlace copiado', 'success')
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      toast('Copia el link manualmente: ' + inviteLink)
    }
  }

  async function handleCancelarInvitacion(id) {
    setCancelando(id)
    const { error } = await cancelarInvitacion(id)
    if (!error) {
      setPendientes(prev => prev.filter(p => p.id !== id))
      toast('Invitación cancelada', 'success')
    } else {
      toast('Error al cancelar la invitación')
    }
    setCancelando(null)
  }

  if (!open) return null

  const initial = (nombre || '?').charAt(0).toUpperCase()
  const avatarBg = bgColor || 'var(--accent-main)'
  const paisInfo = PAISES.find(p => p.code === pais) || PAISES[PAISES.length - 1]

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}>
        <div onClick={onClose} style={{ position: 'absolute', inset: 0 }} />

        <div className="animate-enter" style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 420, maxHeight: '100%',
          borderRadius: 28, overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          border: '1px solid var(--border-glass)',
          display: 'flex', flexDirection: 'column',
        }}>

          {/* ── Cabecera ── */}
          <div style={{
            background: `color-mix(in srgb, ${avatarBg} 10%, var(--bg-card))`,
            borderBottom: '1px solid var(--border-subtle)',
            padding: '24px 20px 20px', flexShrink: 0,
          }}>
            <div className="flex items-center gap-4">
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: avatarBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 700, color: '#fff', userSelect: 'none',
                boxShadow: `0 4px 14px color-mix(in srgb, ${avatarBg} 45%, transparent)`,
                border: '3px solid color-mix(in srgb, var(--bg-card) 60%, transparent)',
              }}>
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }} className="truncate">
                  {nombre || 'Sin nombre'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }} className="truncate">
                  {email}
                </p>
              </div>
              <button onClick={onClose} style={{
                width: 32, height: 32, borderRadius: 10, border: 'none', flexShrink: 0,
                background: 'color-mix(in srgb, var(--bg-dark-card) 8%, transparent)',
                color: 'var(--text-muted)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* ── Contenido scrolleable ── */}
          <div className="custom-scroll" style={{
            overflowY: 'auto', background: 'var(--bg-primary)',
            padding: '20px 20px 28px', flex: 1,
          }}>

            {/* ── Moneda ── */}
            <Row
              icon={<span style={{ fontSize: 14, color: 'var(--accent-gold)' }}>
                {MONEDAS.find(m => m.code === currency)?.simbolo || '€'}
              </span>}
              label="Moneda"
              value={MONEDAS.find(m => m.code === currency)?.label || 'Euro'}
              onEdit={() => { setEditMoneda(v => !v); setEditPais(false) }}
            />
            {editMoneda && (
               <div style={{ marginTop: 6, marginBottom: 6 }}>
                <CustomSelect
                  defaultOpen
                  value={currency}
                  onChange={v => { cambiarMoneda(v || 'EUR'); setEditMoneda(false) }}
                  color="var(--accent-gold)"
                  options={MONEDAS.map(m => ({ id: m.code, label: m.label, sub: m.simbolo }))}
                  placeholder="Seleccionar moneda"
                />
              </div>
            )}

            {/* ── País ── */}
            <Row
              icon={<span style={{ fontSize: 14 }}>{paisInfo.emoji}</span>}
              label="País"
              value={paisInfo.label}
              onEdit={() => { setEditPais(v => !v); setEditMoneda(false) }}
            />
            {editPais && (
               <div style={{ marginTop: 6, marginBottom: 6, }}>
                <CustomSelect
                  defaultOpen
                  value={pais}
                  onChange={v => { if (v) handleGuardarPais(v) }}
                  color="var(--accent-blue)"
                  options={PAISES.map(p => ({ id: p.code, label: p.label, sub: p.emoji }))}
                  placeholder="Seleccionar país"
                />
              </div>
            )}

            {/* ── Nombre ── */}
            <Row
              icon={<Edit3 size={14} style={{ color: 'var(--accent-green)' }} />}
              label="Nombre" value={nombre}
              onEdit={() => { setEditNombre(v => !v); setEditEmail(false); setEditPwd(false) }}
            />
            {editNombre && (
          <div style={{ marginTop: 15, marginBottom: 15 }}>
                <InlineEdit
                  value={nombreVal} onChange={setNombreVal}
                  onSave={handleGuardarNombre} saving={savingNombre}
                  onCancel={() => setEditNombre(false)}
                  placeholder="Tu nombre" type="text"
                  accentVar="var(--accent-green)"
                />
              </div>
            )}

            {/* ── Correo ── */}
            <Row
              icon={<Mail size={14} style={{ color: 'var(--accent-blue)' }} />}
              label="Correo" value={email}
              onEdit={isGoogle ? null : () => { setEditEmail(v => !v); setEditNombre(false); setEditPwd(false) }}
              disabled={isGoogle} disabledLabel="Google"
            />
            {editEmail && !isGoogle && (
              <div style={{ marginTop: 6 }}>
                <InlineEdit
                  value={newEmail} onChange={setNewEmail}
                  onSave={handleGuardarEmail} saving={savingEmail}
                  onCancel={() => { setEditEmail(false); setNewEmail('') }}
                  placeholder="Nuevo correo" type="email"
                  accentVar="var(--accent-blue)"
                />
              </div>
            )}

            {/* ── Contraseña ── */}
            <Row
              icon={<Lock size={14} style={{ color: 'var(--accent-violet)' }} />}
              label="Contraseña" value="••••••••"
              onEdit={isGoogle ? null : () => { setEditPwd(v => !v); setEditNombre(false); setEditEmail(false) }}
              disabled={isGoogle} disabledLabel="Google"
            />
            {editPwd && !isGoogle && (
              <div className="mb-3 flex gap-2" style={{ marginTop: 6 }}>
                <div className="relative flex-1">
                  <input type={showPwd ? 'text' : 'password'} value={newPwd}
                    onChange={e => setNewPwd(e.target.value)} autoFocus
                    placeholder="Mínimo 6 caracteres" className="ff-input w-full pr-10 text-sm" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 0,
                  }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <button onClick={handleGuardarPwd} disabled={savingPwd || newPwd.length < 6}
                  className="px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{
                    background: newPwd.length >= 6 ? 'var(--accent-violet)' : 'var(--bg-secondary)',
                    color: newPwd.length >= 6 ? '#fff' : 'var(--text-muted)',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {savingPwd ? <Loader2 size={12} className="animate-spin" /> : <Save size={13} />}
                </button>
                <button onClick={() => { setEditPwd(false); setNewPwd('') }}
                  className="px-3 py-2 rounded-xl"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
                  <X size={13} />
                </button>
              </div>
            )}

            {/* ── Temas ── */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0 12px' }} />
            <div className="flex items-center gap-2 mb-3">
              <Palette size={14} style={{ color: 'var(--accent-violet)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Tema</span>
            </div>
            <div className="space-y-1">
              {Object.entries(THEMES).map(([key, t]) => {
                const active = theme === key
                return (
                  <button key={key} onClick={() => setTheme(key)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all active:scale-[0.98]"
                    style={{
                      background: active
                        ? 'color-mix(in srgb, var(--accent-violet) 8%, var(--bg-secondary))'
                        : 'var(--bg-secondary)',
                      border: active
                        ? '1px solid color-mix(in srgb, var(--accent-violet) 30%, transparent)'
                        : '1px solid transparent',
                      cursor: 'pointer',
                    }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: `linear-gradient(135deg, ${t.preview[0]} 50%, ${t.preview[1]} 50%)`,
                      border: '1px solid var(--border-glass)',
                    }} />
                    <span className="flex-1 text-left text-sm font-semibold"
                      style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                      {t.name}
                    </span>
                    {active && (
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'var(--accent-violet)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Check size={10} color="white" strokeWidth={4} />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* ── Miembros del hogar ── */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0 12px' }} />
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                Miembros de la familia
              </span>
            </div>

            <div className="space-y-1 mb-2">
              {miembros.map(m => {
                const esYo = m.id === user?.id
                const seleccionado = miembroSeleccionado?.id === m.id
                const inicial = (m.nombre || m.email || '?').charAt(0).toUpperCase()
                return (
                  <div key={m.id}
                    onClick={() => { if (isAdmin && !esYo) setMiembroSeleccionado(seleccionado ? null : m) }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: seleccionado
                        ? 'color-mix(in srgb, var(--accent-rose) 8%, var(--bg-secondary))'
                        : 'var(--bg-secondary)',
                      border: `1px solid ${seleccionado
                        ? 'color-mix(in srgb, var(--accent-rose) 25%, transparent)'
                        : 'transparent'}`,
                      cursor: isAdmin && !esYo ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}>

                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: m.rol === 'admin'
                        ? 'color-mix(in srgb, var(--accent-main) 20%, transparent)'
                        : 'color-mix(in srgb, var(--accent-blue) 15%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700,
                      color: m.rol === 'admin' ? 'var(--accent-main)' : 'var(--accent-blue)',
                    }}>
                      {inicial}
                    </div>

                    {/* Nombre + email */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }} className="truncate">
                          {m.nombre || 'Sin nombre'}
                        </p>
                        {esYo && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: 'var(--accent-main)',
                            background: 'color-mix(in srgb, var(--accent-main) 12%, transparent)',
                            padding: '1px 5px', borderRadius: 4,
                            textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0,
                          }}>tú</span>
                        )}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }} className="truncate">
                        {m.email}
                      </p>
                    </div>

                    {/* Rol */}
                    <span style={{
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                      color: m.rol === 'admin' ? 'var(--accent-main)' : 'var(--text-muted)',
                      background: m.rol === 'admin'
                        ? 'color-mix(in srgb, var(--accent-main) 10%, transparent)'
                        : 'var(--bg-card)',
                      padding: '3px 8px', borderRadius: 6,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {m.rol}
                    </span>

                    {/* Botón eliminar — aparece solo al seleccionar */}
                    {isAdmin && !esYo && seleccionado && (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmEliminar(true) }}
                        style={{
                          background: 'var(--accent-rose)', border: 'none', cursor: 'pointer',
                          color: '#fff', padding: '4px 10px', borderRadius: 8,
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                        Eliminar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* ── Invitaciones pendientes ── */}
            {pendientes?.length > 0 && (
              <div className="space-y-1">
                <p style={{
                  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6,
                }}>
                  Pendientes
                </p>
                {pendientes.map(p => (
                  <div key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{
                      background: 'color-mix(in srgb, var(--accent-gold) 5%, var(--bg-secondary))',
                      border: '1px solid color-mix(in srgb, var(--accent-gold) 15%, transparent)',
                    }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'color-mix(in srgb, var(--accent-gold) 15%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Mail size={14} style={{ color: 'var(--accent-gold)' }} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }} className="truncate">
                      {p.email}
                    </p>
                    {isAdmin && (
                      <button
                        onClick={() => handleCancelarInvitacion(p.id)}
                        disabled={cancelando === p.id}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--accent-rose)', padding: 4, flexShrink: 0,
                        }}>
                        {cancelando === p.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <X size={13} />
                        }
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* ── Invitar miembro (solo admin) ── */}
            {isAdmin && (
              <>
                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0 12px' }} />
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus size={14} style={{ color: 'var(--accent-main)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Invitar miembro
                  </span>
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email" value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteLink('') }}
                    placeholder="email@ejemplo.com"
                    className="ff-input flex-1 text-sm"
                    autoComplete="off"
                  />
                  <button
                    onClick={handleGenerarInvitacion} disabled={generando}
                    className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1"
                    style={{
                      background: 'var(--accent-main)', color: 'var(--text-on-dark)',
                      border: 'none', cursor: 'pointer', flexShrink: 0,
                    }}>
                    {generando ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
                  </button>
                </div>
                {inviteLink && (
                  <button
                    onClick={handleCopiarLink}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left"
                    style={{
                      background: 'color-mix(in srgb, var(--accent-green) 8%, var(--bg-secondary))',
                      border: '1px solid color-mix(in srgb, var(--accent-green) 20%, transparent)',
                      cursor: 'pointer',
                    }}>
                    <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {inviteLink}
                    </span>
                    {copiado
                      ? <Check size={13} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                      : <Copy size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    }
                  </button>
                )}
              </>
            )}

            {/* ── Cerrar sesión ── */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '16px 0 12px' }} />
            <button
              onClick={() => onLogout?.()}
              className="flex items-center gap-3 w-full px-3 py-3 rounded-xl transition-all active:scale-[0.98]"
              style={{
                background: 'color-mix(in srgb, var(--accent-danger) 6%, var(--bg-secondary))',
                border: '1px solid color-mix(in srgb, var(--accent-danger) 15%, transparent)',
                color: 'var(--accent-danger)', cursor: 'pointer',
              }}>
              <LogOut size={15} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>Cerrar sesión</span>
            </button>

          </div>
        </div>
      </div>

      {/* ── Modal confirmar eliminar miembro ── */}
      {confirmEliminar && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 24, padding: 24,
            maxWidth: 320, width: '100%',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
              ¿Eliminar miembro?
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
              <strong>{miembroSeleccionado?.nombre || miembroSeleccionado?.email}</strong> perderá acceso al hogar.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { setConfirmEliminar(false); setMiembroSeleccionado(null) }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 12, border: 'none',
                  background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>
                Cancelar
              </button>
              <button
                onClick={handleEliminarMiembro}
                disabled={!!eliminando}
                style={{
                  flex: 1, padding: '10px', borderRadius: 12, border: 'none',
                  background: 'var(--accent-rose)', color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: eliminando ? 0.7 : 1,
                }}>
                {eliminando ? <Loader2 size={13} className="animate-spin" /> : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Row({ icon, label, value, onEdit, disabled, disabledLabel }) {
  return (
    <button
      onClick={onEdit || undefined}
      disabled={!onEdit}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl mb-1"
      style={{
        background: 'var(--bg-secondary)', border: 'none',
        cursor: onEdit ? 'pointer' : 'default',
        opacity: disabled ? 0.5 : 1,
      }}>
      {icon}
      <span className="text-sm flex-1 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
        {disabled ? disabledLabel : value}
      </span>
      {onEdit && <Edit3 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </button>
  )
}

function InlineEdit({ value, onChange, onSave, saving, onCancel, placeholder, type, accentVar }) {
  return (
    <div className="mb-3 flex gap-2" style={{ marginTop: 6 }}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSave()}
        autoFocus placeholder={placeholder} className="ff-input flex-1 text-sm" />
      <button onClick={onSave} disabled={saving}
        className="px-3 py-2 rounded-xl text-xs font-semibold"
        style={{ background: accentVar, color: '#fff', border: 'none', cursor: 'pointer' }}>
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={13} />}
      </button>
      <button onClick={onCancel}
        className="px-3 py-2 rounded-xl"
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
        <X size={13} />
      </button>
    </div>
  )
}