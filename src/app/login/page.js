'use client'
import { Suspense } from 'react'
import { Loader2, Eye, EyeOff, ArrowLeft, Mail, CheckCircle, Lock, UserCircle2 } from 'lucide-react'
import { useAuthFlow } from '@/hooks/useAuthFlow'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

function LoginContent() {
  const {
    form,
    updateForm,
    mode,
    setMode,
    loading,
    checking,
    error,
    setError,
    sent,
    setSent,
    showPwd,
    setShowPwd,
    showConfirmPwd,
    setShowConfirmPwd,
    invToken,
    invInfo,
    handleLogin,
    handleRegister,
    handleRecover,
    handleResetPassword,
    handleGuardarNombre,
    handleGoogleLogin,
  } = useAuthFlow()

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
              Economía del Hogar
            </h1>
            <p className="text-[10px] uppercase tracking-[0.25em] font-black opacity-40">
              {mode === 'recover' ? 'Seguridad' : mode === 'reset' ? 'Nueva Clave' : mode === 'nombre' ? 'Bienvenida' : mode === 'register' ? 'Nueva Cuenta' : 'Control de Gastos'}
            </p>
          </div>

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="login-email" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Email</label>
                <input id="login-email" name="email" type="email" placeholder="nombre@Gmail.com"
                  value={form.email} onChange={e => updateForm('email', e.target.value)}
                  className="ff-input w-full" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="login-password" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Contraseña</label>
                <div className="relative">
                  <input id="login-password" name="password" type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                    value={form.password} onChange={e => updateForm('password', e.target.value)}
                    className="ff-input w-full pr-12" />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading || !form.email || !form.password}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                style={{
                  background: form.email && form.password ? 'var(--text-primary)' : 'var(--bg-secondary)',
                  color: form.email && form.password ? 'var(--bg-card)' : 'var(--text-muted)',
                }}>
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" aria-label="Cargando" /> : 'Entrar'}
              </button>

              {/* Google */}
              <button type="button" onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.1em] transition-all active:scale-95"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)' }}>
                <GoogleIcon />
                Continuar con Google
              </button>

              <button type="button" onClick={() => { setMode('recover'); setError('') }}
                className="w-full text-center text-[11px] font-bold opacity-30 hover:opacity-100 transition-opacity py-2 uppercase tracking-tighter">
                ¿Olvidaste tu contraseña?
              </button>

              <div className="flex items-center gap-3 my-1" aria-hidden="true">
                <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-20">o</span>
                <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
              </div>

              <button type="button" onClick={() => { setMode('register'); setError(''); updateForm('password', ''); updateForm('confirmPwd', '') }}
                className="w-full py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.1em] transition-all active:scale-95"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Crear cuenta nueva
              </button>
            </form>
          )}

          {/* ── REGISTER ── */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              {invInfo && (
                <div className="p-3 rounded-2xl text-[11px] font-medium text-center border"
                  style={{ background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-green) 20%, transparent)', color: 'var(--text-secondary)' }}>
                  Te invitaron a unirte a <span className="font-black" style={{ color: 'var(--accent-green)' }}>{invInfo.nombre_hogar}</span> como <span className="font-bold">{invInfo.rol_asignado}</span>
                </div>
              )}
              {sent ? (
                <div className="flex flex-col items-center gap-6 py-4 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)' }}>
                    <CheckCircle size={40} style={{ color: 'var(--accent-green)' }} aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>Revisa tu correo</h2>
                    <p className="text-[12px] opacity-60 leading-relaxed px-4">
                      Enviamos un enlace de confirmación a <span className="font-bold">{form.email}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => { setMode('login'); setSent(false) }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-all mt-4">
                    <ArrowLeft size={14} aria-hidden="true" /> Volver al login
                  </button>
                </div>
              ) : (
                <>
                  {!invToken && (
                    <div className="space-y-1.5">
                      <label htmlFor="reg-familia" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Nombre de tu Familia</label>
                      <input id="reg-familia" name="familia" type="text" placeholder="Ej: Familia Quintero"
                        value={form.nombreHogar} onChange={e => updateForm('nombreHogar', e.target.value)}
                        className="ff-input w-full border-accent-terra" autoFocus />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="reg-nombre" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Tu nombre</label>
                    <input id="reg-nombre" name="nombre" type="text" placeholder="¿Cómo te llamamos?"
                      value={form.nombre} onChange={e => updateForm('nombre', e.target.value)}
                      className="ff-input w-full" autoFocus={!!invToken} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="reg-email" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Email</label>
                    <input id="reg-email" name="email" type="email" placeholder="nombre@gmail.com"
                      value={form.email} onChange={e => !invToken && updateForm('email', e.target.value)}
                      readOnly={!!invToken}
                      className={`ff-input w-full ${invToken ? 'opacity-60 cursor-not-allowed' : ''}`} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="reg-password" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Contraseña</label>
                    <div className="relative">
                      <input id="reg-password" name="password" type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                        value={form.password} onChange={e => updateForm('password', e.target.value)}
                        className="ff-input w-full pr-12" />
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                        {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="reg-confirm" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Confirmar contraseña</label>
                    <div className="relative">
                      <input id="reg-confirm" name="confirm_password" type={showConfirmPwd ? 'text' : 'password'} placeholder="Repite la contraseña"
                        value={form.confirmPwd} onChange={e => updateForm('confirmPwd', e.target.value)}
                        className={`ff-input w-full pr-12 ${form.confirmPwd && form.confirmPwd !== form.password ? 'error' : ''}`} />
                      <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        aria-label={showConfirmPwd ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                        className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                        {showConfirmPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading || !form.nombre.trim() || !form.email || !form.password || !form.confirmPwd || (!invToken && !form.nombreHogar.trim())}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                    style={{
                      background: form.nombre.trim() && form.email && form.password && form.confirmPwd && (invToken || form.nombreHogar.trim()) ? 'var(--text-primary)' : 'var(--bg-secondary)',
                      color: form.nombre.trim() && form.email && form.password && form.confirmPwd && (invToken || form.nombreHogar.trim()) ? 'var(--bg-card)' : 'var(--text-muted)',
                    }}>
                    {loading ? <Loader2 size={20} className="animate-spin mx-auto" aria-label="Cargando" /> : 'Crear cuenta'}
                  </button>

                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-30 py-3 hover:opacity-100 transition-opacity">
                    <ArrowLeft size={12} aria-hidden="true" /> Ya tengo cuenta
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
                    <CheckCircle size={40} style={{ color: 'var(--accent-green)' }} aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-lg font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>Enlace Enviado</h2>
                    <p className="text-[12px] opacity-60 leading-relaxed px-4">Revisa <span className="font-bold">{form.email}</span> para restablecer tu acceso.</p>
                  </div>
                  <button type="button" onClick={() => { setMode('login'); setSent(false) }}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-all mt-4">
                    <ArrowLeft size={14} aria-hidden="true" /> Volver
                  </button>
                </div>
              ) : (
                <>
                  <div className="p-4 rounded-2xl text-[11px] font-medium leading-relaxed mb-2 border"
                    style={{ background: 'color-mix(in srgb, var(--accent-blue) 5%, transparent)', borderColor: 'color-mix(in srgb, var(--accent-blue) 15%, transparent)', color: 'var(--text-secondary)' }}>
                    Escribe tu email para recibir un enlace de recuperación.
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="recover-email" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Email</label>
                    <input id="recover-email" type="email" placeholder="tu-correo@gmail.com" value={form.email}
                      onChange={e => updateForm('email', e.target.value)} className="ff-input w-full" autoFocus />
                  </div>
                  {error && (
                    <div role="alert" className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">{error}</div>
                  )}
                  <button type="submit" disabled={loading || !form.email}
                    className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                    style={{ background: form.email ? 'var(--text-primary)' : 'var(--bg-secondary)', color: form.email ? 'var(--bg-card)' : 'var(--text-muted)' }}>
                    {loading ? <Loader2 size={20} className="animate-spin mx-auto" aria-label="Cargando" /> : <><Mail size={16} className="mr-2 inline" aria-hidden="true" />Enviar Enlace</>}
                  </button>
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    className="w-full flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-30 py-4 hover:opacity-100 transition-opacity">
                    <ArrowLeft size={12} aria-hidden="true" /> Cancelar
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
                <label htmlFor="reset-newpwd" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Nueva Contraseña</label>
                <div className="relative">
                  <input id="reset-newpwd" type={showPwd ? 'text' : 'password'} placeholder="Mínimo 6 caracteres"
                    value={form.newPwd} onChange={e => updateForm('newPwd', e.target.value)}
                    className="ff-input w-full pr-12" autoFocus />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 transition-opacity">
                    {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && (
                <div role="alert" className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">{error}</div>
              )}
              <button type="submit" disabled={loading || form.newPwd.length < 6}
                className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-[0.1em] shadow-lg active:scale-95 transition-all mt-2"
                style={{ background: form.newPwd.length >= 6 ? 'var(--accent-green)' : 'var(--bg-secondary)', color: 'white' }}>
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" aria-label="Cargando" /> : 'Actualizar Contraseña'}
              </button>
            </form>
          )}

          {/* ── NOMBRE (ONBOARDING) ── */}
          {mode === 'nombre' && (
            <form onSubmit={handleGuardarNombre} className="space-y-4">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2"
                  style={{ background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)', color: 'var(--accent-blue)' }}>
                  <UserCircle2 size={40} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  ¡Bienvenido!
                </h2>
                <p className="text-[12px] opacity-60 leading-relaxed">Cuéntanos un poco sobre ti y tu familia</p>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="onboarding-nombre" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Tu nombre</label>
                <input id="onboarding-nombre" type="text" placeholder="¿Cómo te llamamos?" value={form.nombre}
                  onChange={e => updateForm('nombre', e.target.value)}
                  className="ff-input w-full" autoFocus />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="onboarding-hogar" className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-1">Nombre de tu familia</label>
                <input id="onboarding-hogar" type="text" placeholder="Ej: Familia Quintero" value={form.nombreHogar}
                  onChange={e => updateForm('nombreHogar', e.target.value)}
                  className="ff-input w-full" />
              </div>
              {error && (
                <div role="alert" className="text-[11px] text-center font-bold p-3 rounded-2xl bg-rose-500/10 text-rose-500">{error}</div>
              )}
              <button type="submit" disabled={loading || !form.nombre.trim() || !form.nombreHogar.trim()}
                className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                style={{ background: form.nombre.trim() && form.nombreHogar.trim() ? 'var(--text-primary)' : 'var(--bg-secondary)', color: form.nombre.trim() && form.nombreHogar.trim() ? 'var(--bg-card)' : 'var(--text-muted)' }}>
                {loading ? <Loader2 size={20} className="animate-spin mx-auto" aria-label="Cargando" /> : 'Comenzar →'}
              </button>
            </form>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-10 opacity-30" aria-hidden="true">
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
