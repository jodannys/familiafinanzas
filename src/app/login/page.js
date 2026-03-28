'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, signIn } from '@/lib/supabase'
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, CheckCircle, Lock, UserCircle2 } from 'lucide-react'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'recover' | 'reset' | 'nombre'
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [nombre, setNombre] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  useEffect(() => {
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset')
    })

    return () => subscription.unsubscribe()
  }, [searchParams, router])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true); setError('')
    const { data, error } = await signIn(email.trim(), password)
    if (error) {
      setError('Credenciales no válidas')
      setLoading(false)
    } else {
      const nombreGuardado = data?.user?.user_metadata?.nombre
      if (!nombreGuardado) { setLoading(false); setMode('nombre') }
      else router.replace('/')
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    if (!email || !password || !nombre.trim()) return
    if (password !== confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true); setError('')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nombre: nombre.trim() } },
    })
    if (error) {
      setError(error.message === 'User already registered' ? 'Este correo ya está registrado' : 'No se pudo crear la cuenta')
      setLoading(false)
      return
    }
    if (data?.user) {
      // Sincronizar nombre en perfiles_familia
      await supabase.from('perfiles_familia').upsert(
        { nombre: nombre.trim() },
        { onConflict: 'nombre', ignoreDuplicates: true }
      )
      setLoading(false)
      router.replace('/')
    } else {
      // Email confirmation required
      setLoading(false)
      setSent(true)
    }
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
    if (error) setError('No se pudo actualizar la contraseña')
    else router.replace('/')
  }

  async function handleGuardarNombre(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setLoading(true); setError('')
    const nombreFinal = nombre.trim()

    // 1. Guardar nombre en user_metadata de Supabase Auth
    const { error } = await supabase.auth.updateUser({ data: { nombre: nombreFinal } })
    if (error) { setError('Error al guardar el perfil'); setLoading(false); return }

    // 2. Sincronizar en perfiles_familia para que useQuien lo detecte automáticamente
    await supabase.from('perfiles_familia').upsert(
      { nombre: nombreFinal },
      { onConflict: 'nombre', ignoreDuplicates: true }
    )

    setLoading(false)
    router.replace('/')
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <Loader2 size={32} className="animate-spin opacity-20" style={{ color: 'var(--text-primary)' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>

      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-10 blur-[100px]"
        style={{ background: 'var(--accent-main)' }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-5 blur-[100px]"
        style={{ background: 'var(--accent-green)' }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="border rounded-[40px] p-8 shadow-2xl"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-glass)' }}>

          {/* Header */}
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 shadow-xl"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-glass)' }}>
              <img src="/icon.svg" alt="Logo" className="w-10 h-10" />
            </div>
            <h1 className="font-script text-[38px] leading-none mb-2" style={{ color: 'var(--text-primary)' }}>
              Familia Quintero
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-40">
              {mode === 'recover' ? 'Seguridad' : mode === 'reset' ? 'Nueva Clave' : mode === 'nombre' ? 'Bienvenida' : mode === 'register' ? 'Nueva Cuenta' : 'Finanzas Familiares'}
            </p>
          </div>

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Email</label>
                <input type="email" placeholder="nombre@familia.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="ff-input w-full" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    className="ff-input w-full pr-12" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || !email || !password}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                style={{
                  background: email && password ? 'var(--text-primary)' : 'var(--bg-secondary)',
                  color: email && password ? 'var(--bg-card)' : 'var(--text-muted)',
                }}>
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Entrar'}
              </button>


              <button type="button" onClick={() => { setMode('recover'); setError('') }}
                className="w-full text-center text-[11px] font-bold opacity-30 hover:opacity-100 transition-opacity py-2 uppercase tracking-tighter">
                ¿Olvidaste tu contraseña?
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-20">o</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
              </div>

              <button type="button" onClick={() => { setMode('register'); setError(''); setPassword(''); setConfirmPwd('') }}
                className="w-full py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.1em] transition-all active:scale-95"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Crear cuenta nueva
              </button>
            </form>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {sent ? (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' }}>
                    <CheckCircle size={40} style={{ color: 'var(--accent-green)' }} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>Revisa tu correo</h2>
                    <p className="text-[12px] opacity-60 leading-relaxed px-4">
                      Enviamos un enlace de confirmación a <span className="font-bold">{email}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => { setMode('login'); setSent(false) }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-all mt-4">
                    <ArrowLeft size={14} /> Volver al login
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Tu nombre</label>
                    <input type="text" placeholder="¿Cómo te llamamos?"
                      value={nombre} onChange={e => setNombre(e.target.value)}
                      className="ff-input w-full" autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Email</label>
                    <input type="email" placeholder="nombre@familia.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      className="ff-input w-full" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Contraseña</label>
                    <div className="relative">
                      <input type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                        value={password} onChange={e => setPassword(e.target.value)}
                        className="ff-input w-full pr-12" />
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                        {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Confirmar contraseña</label>
                    <div className="relative">
                      <input type={showConfirmPwd ? 'text' : 'password'} placeholder="Repite la contraseña"
                        value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                        className={`ff-input w-full pr-12 ${confirmPwd && confirmPwd !== password ? 'error' : ''}`} />
                      <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                        {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading || !nombre.trim() || !email || !password || !confirmPwd}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                    style={{
                      background: nombre.trim() && email && password && confirmPwd ? 'var(--text-primary)' : 'var(--bg-secondary)',
                      color: nombre.trim() && email && password && confirmPwd ? 'var(--bg-card)' : 'var(--text-muted)',
                    }}>
                    {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Crear cuenta'}
                  </button>

                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-30 py-3 hover:opacity-100 transition-opacity">
                    <ArrowLeft size={12} /> Ya tengo cuenta
                  </button>
                </>
              )}
            </form>
          )}

          {/* ── RECOVER ── */}
          {mode === 'recover' && (
            <form onSubmit={handleRecover} className="space-y-4">
              {sent ? (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center bg-green-500/10">
                    <CheckCircle size={40} style={{ color: 'var(--accent-green)' }} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>Enlace Enviado</h2>
                    <p className="text-[12px] opacity-60 leading-relaxed px-4">Revisa <span className="font-bold">{email}</span> para restablecer tu acceso.</p>
                  </div>
                  <button type="button" onClick={() => { setMode('login'); setSent(false) }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-all mt-4">
                    <ArrowLeft size={14} /> Volver
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-2xl text-[11px] font-medium leading-relaxed mb-2 border"
                    style={{ background: 'color-mix(in srgb, var(--accent-blue) 5%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 15%, transparent)', color: 'var(--text-secondary)' }}>
                    Escribe tu email para recibir un enlace de recuperación.
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Email</label>
                    <input type="email" placeholder="tu-correo@familia.com" value={email}
                      onChange={e => setEmail(e.target.value)} className="ff-input w-full" autoFocus />
                  </div>
                  {error && <div className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">{error}</div>}
                  <button type="submit" disabled={loading || !email}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                    style={{ background: email ? 'var(--text-primary)' : 'var(--bg-secondary)', color: email ? 'var(--bg-card)' : 'var(--text-muted)' }}>
                    {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : <><Mail size={16} className="mr-2 inline" />Enviar Enlace</>}
                  </button>
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-30 py-4 hover:opacity-100 transition-opacity">
                    <ArrowLeft size={12} /> Cancelar
                  </button>
                </>
              )}
            </form>
          )}

          {/* ── RESET ── */}
          {mode === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-4 rounded-2xl text-[11px] font-medium mb-2 text-center"
                style={{ background: 'color-mix(in srgb, var(--accent-green) 5%, transparent)', color: 'var(--text-secondary)' }}>
                Establece una nueva contraseña segura.
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Nueva Contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                    value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    className="ff-input w-full pr-12" autoFocus />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <div className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">{error}</div>}
              <button type="submit" disabled={loading || newPwd.length < 6}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                style={{ background: newPwd.length >= 6 ? 'var(--accent-green)' : 'var(--bg-secondary)', color: 'white' }}>
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Actualizar Contraseña'}
              </button>
            </form>
          )}

          {/* ── NOMBRE (ONBOARDING) ── */}
          {mode === 'nombre' && (
            <form onSubmit={handleGuardarNombre} className="space-y-6">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                  style={{ background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)', color: 'var(--accent-blue)' }}>
                  <UserCircle2 size={40} strokeWidth={1.5} />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>¡Bienvenido!</h2>
                <p className="text-[12px] opacity-60 leading-relaxed">¿Cómo quieres que te llamemos?</p>
              </div>
              <input type="text" placeholder="Tu nombre..." value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="ff-input w-full text-center text-lg font-bold" autoFocus />
              {error && <div className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">{error}</div>}
              <button type="submit" disabled={loading || !nombre.trim()}
                className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                style={{ background: nombre.trim() ? 'var(--text-primary)' : 'var(--bg-secondary)', color: nombre.trim() ? 'var(--bg-card)' : 'var(--text-muted)' }}>
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" /> : 'Comenzar →'}
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-10 opacity-30">
          <Lock size={10} />
          <p className="text-[9px] font-black uppercase tracking-[0.4em]">Acceso Privado · 2026</p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 size={32} className="animate-spin opacity-20" style={{ color: 'var(--text-primary)' }} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
