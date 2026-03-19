'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, signIn } from '@/lib/supabase'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/')
      else setChecking(false)
    })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError('')
    const { error } = await signIn(email.trim(), password)
    if (error) {
      setError('Correo o contraseña incorrectos')
      setLoading(false)
    } else {
      router.replace('/')
    }
  }

  if (checking) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-main)' }} />
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>

      {/* Fondo decorativo */}
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

      {/* Panel */}
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
            Finanzas familiares
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-3">

          {/* Email */}
          <div className="relative">
            <label className="ff-label" style={{ marginLeft: 4 }}>Correo</label>
            <input
              type="email"
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="ff-input w-full"
              style={{ fontSize: 15 }}
              autoFocus
            />
          </div>

          {/* Contraseña */}
          <div className="relative">
            <label className="ff-label" style={{ marginLeft: 4 }}>Contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="ff-input w-full pr-12"
                style={{ fontSize: 15 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-center px-3 py-2 rounded-xl"
              style={{
                color: 'var(--accent-rose)',
                background: 'color-mix(in srgb, var(--accent-rose) 8%, transparent)',
              }}>
              {error}
            </p>
          )}

          {/* Botón */}
          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all mt-2"
            style={{
              background: email && password ? 'var(--text-primary)' : 'var(--bg-secondary)',
              color:      email && password ? 'var(--bg-card)'     : 'var(--text-muted)',
              border: 'none',
              cursor: email && password ? 'pointer' : 'not-allowed',
              fontSize: 15,
            }}>
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : 'Entrar'}
          </button>

        </form>

        <p className="text-center text-[10px] mt-8" style={{ color: 'var(--text-muted)' }}>
          Solo para uso familiar · Familia Quintero
        </p>
      </div>
    </div>
  )
}
