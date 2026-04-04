'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { X, Edit3, Save, Mail, Lock, Eye, EyeOff, Palette, Check, Loader2 } from 'lucide-react'
import { supabase, signOut } from '@/lib/supabase'
import { useTheme, getThemeColors, THEMES } from '@/lib/themes'
import { toast } from '@/lib/toast'

export default function ProfilePanel({ open, onClose }) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const themeColors = getThemeColors(theme)

  const [user, setUser]           = useState(null)
  const [nombre, setNombre]       = useState('')
  const [email, setEmail]         = useState('')
  const [isGoogle, setIsGoogle]   = useState(false)
  const [bgColor, setBgColor]     = useState('')

  const [editNombre, setEditNombre]     = useState(false)
  const [nombreVal, setNombreVal]       = useState('')
  const [savingNombre, setSavingNombre] = useState(false)

  const [editEmail, setEditEmail]   = useState(false)
  const [newEmail, setNewEmail]     = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const [editPwd, setEditPwd]     = useState(false)
  const [newPwd, setNewPwd]       = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)

  const [confirmLogout, setConfirmLogout] = useState(false)

  useEffect(() => {
    if (!open) return
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return
      setUser(u)
      const n = u.user_metadata?.nombre || ''
      setNombre(n); setNombreVal(n)
      setEmail(u.email || '')
      const google = u.app_metadata?.provider === 'google' ||
        (u.identities || []).some(i => i.provider === 'google')
      setIsGoogle(google)
    })
  }, [open])

  useEffect(() => {
    if (!themeColors?.length || !nombre) return
    let h = 0
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) & 0x7fffffff
    setBgColor(themeColors[h % themeColors.length])
  }, [nombre, themeColors])

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
    toast('Nombre actualizado')
  }

  async function handleGuardarEmail() {
    if (!newEmail.trim() || newEmail === email) return
    setSavingEmail(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setSavingEmail(false)
    if (error) { toast('Error: ' + error.message); return }
    toast('Revisa tu nuevo correo para confirmar')
    setEditEmail(false); setNewEmail('')
  }

  async function handleGuardarPwd() {
    if (newPwd.length < 6) return
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setSavingPwd(false)
    if (error) { toast('Error: ' + error.message); return }
    toast('Contraseña actualizada')
    setNewPwd(''); setEditPwd(false)
  }

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  if (!open) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 501,
        background: 'var(--bg-primary)',
        borderRadius: 24,
        padding: '24px 20px 28px',
        width: 'min(440px, calc(100vw - 32px))',
        boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
        maxHeight: '90dvh',
        overflowY: 'auto',
      }}>

        {/* Header — avatar + info + cerrar */}
        <div className="flex items-center gap-4 mb-6">
          <div style={{
            width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
            background: bgColor || 'var(--accent-main)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#fff', userSelect: 'none',
          }}>
            {(nombre || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base truncate" style={{ color: 'var(--text-primary)' }}>
              {nombre || 'Sin nombre'}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{email}</p>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 10, border: 'none',
            background: 'var(--bg-secondary)', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <X size={15} />
          </button>
        </div>

        {/* ── Nombre ── */}
        <Row icon={<Edit3 size={14} style={{ color: 'var(--accent-green)' }} />}
          label="Nombre"
          value={nombre}
          onEdit={() => { setEditNombre(v => !v); setEditEmail(false); setEditPwd(false) }}
        />
        {editNombre && (
          <InlineEdit
            value={nombreVal} onChange={setNombreVal}
            onSave={handleGuardarNombre} saving={savingNombre}
            onCancel={() => setEditNombre(false)}
            placeholder="Tu nombre" type="text"
            accentVar="var(--accent-green)"
          />
        )}

        {/* ── Correo ── */}
        <Row icon={<Mail size={14} style={{ color: 'var(--accent-blue)' }} />}
          label="Correo"
          value={email}
          onEdit={isGoogle ? null : () => { setEditEmail(v => !v); setEditNombre(false); setEditPwd(false) }}
          disabled={isGoogle}
          disabledLabel="Google"
        />
        {editEmail && !isGoogle && (
          <InlineEdit
            value={newEmail} onChange={setNewEmail}
            onSave={handleGuardarEmail} saving={savingEmail}
            onCancel={() => { setEditEmail(false); setNewEmail('') }}
            placeholder="Nuevo correo" type="email"
            accentVar="var(--accent-blue)"
          />
        )}

        {/* ── Contraseña ── */}
        <Row icon={<Lock size={14} style={{ color: 'var(--accent-violet)' }} />}
          label="Contraseña"
          value="••••••••"
          onEdit={isGoogle ? null : () => { setEditPwd(v => !v); setEditNombre(false); setEditEmail(false) }}
          disabled={isGoogle}
          disabledLabel="Google"
        />
        {editPwd && !isGoogle && (
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1">
              <input type={showPwd ? 'text' : 'password'} value={newPwd}
                onChange={e => setNewPwd(e.target.value)} autoFocus
                placeholder="Mínimo 6 caracteres" className="ff-input w-full pr-10 text-sm" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button onClick={handleGuardarPwd} disabled={savingPwd || newPwd.length < 6}
              className="px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: newPwd.length >= 6 ? 'var(--accent-violet)' : 'var(--bg-secondary)', color: newPwd.length >= 6 ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}>
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
        <div style={{ borderTop: '1px solid var(--border-glass)', margin: '16px 0 12px' }} />
        <div className="flex items-center gap-2 mb-3">
          <Palette size={14} style={{ color: 'var(--accent-violet)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tema</span>
        </div>
        <div className="space-y-1">
          {Object.entries(THEMES).map(([key, t]) => {
            const active = theme === key
            return (
              <button key={key} onClick={() => setTheme(key)}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl"
                style={{
                  background: active ? 'color-mix(in srgb, var(--accent-violet) 8%, var(--bg-secondary))' : 'var(--bg-secondary)',
                  border: active ? '1px solid color-mix(in srgb, var(--accent-violet) 30%, transparent)' : '1px solid transparent',
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
                  <div className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--accent-violet)' }}>
                    <Check size={10} color="white" strokeWidth={4} />
                  </div>
                )}
              </button>
            )
          })}
        </div>


        {/* ── Logout ── */}
        <div style={{ borderTop: '1px solid var(--border-glass)', margin: '16px 0 12px' }} />
      </div>
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
      }}
    >
      {icon}
      <span className="text-sm flex-1 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-muted)' }}>
        {disabled ? disabledLabel : value}
      </span>
      {onEdit && <Edit3 size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
    </button>
  )
}

function InlineEdit({ value, onChange, onSave, saving, onCancel, placeholder, type, accentVar }) {
  return (
    <div className="mb-3 flex gap-2">
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
