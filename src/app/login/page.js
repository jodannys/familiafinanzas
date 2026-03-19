'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, signIn } from '@/lib/supabase'
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, CheckCircle } from 'lucide-react'

function LoginContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [mode,     setMode]     = useState('login')   // 'login' | 'recover' | 'reset'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [newPwd,   setNewPwd]   = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)
  const [error,    setError]    = useState('')
  const [sent,     setSent]     = useState(false)

  useEffect(() => {
    // Si Supabase redirige con type=recovery (enlace del email)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const type = searchParams.get('type')
      if (type === 'recovery' && session) {
        setMode('reset')
        setChecking(false)
      } else if (session && type !== 'recovery') {
        router.replace('/')
      } else {
        setChecking(false)
      }
    })

    // Escuchar el evento de recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    const { error } = await signIn(email.trim(), password)
    if (error) { setError('Correo o contraseña incorrectos'); setLoading(false) }
    else router.replace('/')
  }

  async function handleRecover(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (error) setError('No se pudo enviar el enlace. Verifica el correo.')
    else setSent(true)
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    if (!newPwd || newPwd.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setLoading(false)
    if (error) setError('No se pudo cambiar la contraseña')
    else router.replace('/')
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-main)' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>

      {/* Fondos decorativos */}
      <div style={{
        position: 'fixed', top: '-10%', right: '-10%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-main) 0%, transparent 70%)',
        opacity: 0.1, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-10%', left: '-10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-green) 0%, transparent 70%)',
        opacity: 0.08, pointerEvents: 'none',
      }} />

      <div className="w-full max-w-sm relative z-10">

        {/* Logo + nombre */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-lg"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
            <img src="/icon.svg" alt="Logo" className="w-9 h-9" />
          </div>
          <p className="font-script mb-1" style={{ fontSize: 36, color: 'var(--text-primary)', lineHeight: 1.1 }}>
            Familia Quintero
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {mode === 'recover' ? 'Recuperar acceso' : mode === 'reset' ? 'Nueva contraseña' : 'Finanzas familiares'}
          </p>
        </div>

        {/* ── LOGIN ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="ff-label" style={{ marginLeft: 4 }}>Correo</label>
              <input type="email" autoComplete="email" placeholder="correo@ejemplo.com"
                value={email} onChange={e => setEmail(e.target.value)}
                className="ff-input w-full" style={{ fontSize: 15 }} autoFocus />
            </div>
            <div>
              <label className="ff-label" style={{ marginLeft: 4 }}>Contraseña</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} autoComplete="current-password"
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="ff-input w-full pr-12" style={{ fontSize: 15 }} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-center px-3 py-2 rounded-xl"
                style={{ color: 'var(--accent-rose)', background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading || !email || !password}
              className="w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: email && password ? 'var(--text-primary)' : 'var(--bg-secondary)',
                color:      email && password ? 'var(--bg-card)'      : 'var(--text-muted)',
                border: 'none', cursor: email && password ? 'pointer' : 'not-allowed', fontSize: 15,
              }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Entrar'}
            </button>

            <button type="button" onClick={() => { setMode('recover'); setError('') }}
              className="w-full text-center text-xs py-2 transition-all"
              style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              ¿Olvidaste la contraseña?
            </button>
          </form>
        )}

        {/* ── RECUPERAR ── */}
        {mode === 'recover' && (
          <form onSubmit={handleRecover} className="space-y-3">
            {sent ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)' }}>
                  <CheckCircle size={28} style={{ color: 'var(--accent-green)' }} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                    Enlace enviado
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Revisa el correo <strong>{email}</strong> y haz clic en el enlace para restablecer tu contraseña.
                  </p>
                </div>
                <button type="button" onClick={() => { setMode('login'); setSent(false) }}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: 'var(--accent-main)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <ArrowLeft size={13} /> Volver al inicio
                </button>
              </div>
            ) : (
              <>
                <div className="px-3 py-3 rounded-xl text-xs"
                  style={{ background: 'color-mix(in srgb, var(--accent-blue) 8%, transparent)', color: 'var(--text-secondary)' }}>
                  Escribe tu correo y te enviaremos un enlace para restablecer la contraseña.
                </div>
                <div>
                  <label className="ff-label" style={{ marginLeft: 4 }}>Correo</label>
                  <input type="email" autoComplete="email" placeholder="correo@ejemplo.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="ff-input w-full" style={{ fontSize: 15 }} autoFocus />
                </div>
                {error && (
                  <p className="text-xs text-center px-3 py-2 rounded-xl"
                    style={{ color: 'var(--accent-rose)', background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)' }}>
                    {error}
                  </p>
                )}
                <button type="submit" disabled={loading || !email}
                  className="w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: email ? 'var(--text-primary)' : 'var(--bg-secondary)',
                    color:      email ? 'var(--bg-card)'      : 'var(--text-muted)',
                    border: 'none', cursor: email ? 'pointer' : 'not-allowed', fontSize: 15,
                  }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <><Mail size={15} /> Enviar enlace</>}
                </button>
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  className="w-full flex items-center justify-center gap-1.5 text-xs py-2"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <ArrowLeft size={13} /> Volver
                </button>
              </>
            )}
          </form>
        )}

        {/* ── RESET NUEVA CONTRASEÑA ── */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-3">
            <div className="px-3 py-3 rounded-xl text-xs"
              style={{ background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', color: 'var(--text-secondary)' }}>
              Elige una nueva contraseña para tu cuenta familiar.
            </div>
            <div>
              <label className="ff-label" style={{ marginLeft: 4 }}>Nueva contraseña</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                  value={newPwd} onChange={e => setNewPwd(e.target.value)}
                  className="ff-input w-full pr-12" style={{ fontSize: 15 }} autoFocus />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && (
              <p className="text-xs text-center px-3 py-2 rounded-xl"
                style={{ color: 'var(--accent-rose)', background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)' }}>
                {error}
              </p>
            )}
            <button type="submit" disabled={loading || newPwd.length < 6}
              className="w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: newPwd.length >= 6 ? 'var(--text-primary)' : 'var(--bg-secondary)',
                color:      newPwd.length >= 6 ? 'var(--bg-card)'      : 'var(--text-muted)',
                border: 'none', cursor: newPwd.length >= 6 ? 'pointer' : 'not-allowed', fontSize: 15,
              }}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Guardar contraseña'}
            </button>
          </form>
        )}

        <p className="text-center text-[10px] mt-8" style={{ color: 'var(--text-muted)' }}>
          Solo para uso familiar · Familia Quintero
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-main)' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
