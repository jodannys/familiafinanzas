'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, validarTokenInvitacion, inicializarHogar, aceptarInvitacion } from '@/lib/supabase'

// ── Validación de contraseña segura ──────────────────────────────────────────
// Mínimo 8 caracteres, 1 mayúscula, 1 número, 1 carácter especial
export function validarContrasena(pwd) {
  const reglas = [
    { test: pwd.length >= 8,               msg: 'Mínimo 8 caracteres' },
    { test: /[A-Z]/.test(pwd),             msg: 'Al menos una mayúscula' },
    { test: /[0-9]/.test(pwd),             msg: 'Al menos un número' },
    { test: /[^A-Za-z0-9]/.test(pwd),      msg: 'Al menos un carácter especial (!@#$%...)' },
  ]
  const fallidas = reglas.filter(r => !r.test).map(r => r.msg)
  const score = reglas.length - fallidas.length // 0–4

  let nivel = 'débil'
  let color = 'var(--accent-rose)'
  if (score === 4) { nivel = 'fuerte'; color = 'var(--accent-green)' }
  else if (score >= 2) { nivel = 'media'; color = 'var(--accent-gold)' }

  return { valida: fallidas.length === 0, fallidas, score, nivel, color, pct: (score / 4) * 100 }
}

export function useAuthFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handlingLogin = useRef(false)
  const handlingAuth = useRef(false)

  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  // 🔴 FIX: campo de confirmación para reset
  const [showNewConfirmPwd, setShowNewConfirmPwd] = useState(false)

  const [invToken, setInvToken] = useState(null)
  const [invInfo, setInvInfo] = useState(null)

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPwd: '',
    newPwd: '',
    newPwdConfirm: '', // 🔴 FIX: campo de confirmación para reset
    nombre: '',
    nombreHogar: '',
    inviteToken: null,
  })

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    async function handleAuthenticatedUser(user) {
      if (handlingAuth.current) return
      handlingAuth.current = true
      try {
        const type = searchParams.get('type')
        if (type === 'recovery') {
          setMode('reset')
          setChecking(false)
          return
        }

        const { data: perfil } = await supabase.rpc('get_mis_permisos')

        if (!perfil) {
          const nombreMeta = user.user_metadata?.nombre || ''
          const nombreHogarMeta = user.user_metadata?.nombre_hogar || 'Mi Familia'

          if (nombreMeta) {
            const { error: initError } = await inicializarHogar(nombreMeta, nombreHogarMeta)
            if (initError) {
              setError('Error al crear tu familia en la base de datos. Intenta de nuevo.')
              setChecking(false)
              return
            }
            router.replace('/')
          } else {
            setMode('nombre')
            setChecking(false)
          }
        } else {
          setChecking(false)
          router.replace('/')
        }
      } finally {
        handlingAuth.current = false
      }
    }

    async function checkSession() {
      try {
        const token = searchParams.get('token')

        if (token) {
          const inv = await validarTokenInvitacion(token)

          if (!inv?.valida) {
            setError(inv?.error || 'Invitación inválida o expirada')
            setChecking(false)
            return
          }

          const { data: { user } } = await supabase.auth.getUser()

          if (user) {
            const emailCoincide = user.email?.toLowerCase() === inv.email?.toLowerCase()

            if (emailCoincide) {
              const nombreFinal = user.user_metadata?.nombre || ''
              const { data: res, error: invError } = await aceptarInvitacion(token, nombreFinal)
              if (!invError && res?.ok) {
                router.replace('/')
                return
              }
              setError(res?.error || invError?.message || 'Error al aceptar la invitación')
              setChecking(false)
              return
            }

            await supabase.auth.signOut()
          }

          setInvToken(token)
          setInvInfo(inv)
          updateForm('email', inv.email)
          setMode('register')
          setChecking(false)
          return
        }

        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          setChecking(false)
          return
        }

        if (user) {
          await handleAuthenticatedUser(user)
          return
        }

        setChecking(false)
      } catch (err) {
        console.error('[AuthFlow] Error en checkSession:', err)
        setChecking(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
        return
      }

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        if (handlingLogin.current) return
        if (searchParams.get('token')) return
        setChecking(true)
        try {
          await handleAuthenticatedUser(session.user)
        } catch (err) {
          console.error('[AuthFlow] Error en onAuthStateChange:', err)
          setChecking(false)
        }
      }
    })

    return () => { subscription.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router])

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.email || !form.password) return

    setLoading(true)
    setError('')
    handlingLogin.current = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      })

      if (error) {
        handlingLogin.current = false
        setError('Credenciales no válidas')
      } else {
        const nombreGuardado = data?.user?.user_metadata?.nombre

        if (!nombreGuardado) {
          handlingLogin.current = false
          setMode('nombre')
        } else {
          const { data: perfil } = await supabase.rpc('get_mis_permisos')

          if (!perfil) {
            const nombreHogarMeta = data.user.user_metadata?.nombre_hogar || 'Mi Familia'
            await inicializarHogar(nombreGuardado, nombreHogarMeta)
          }
          router.replace('/')
        }
      }
    } catch (err) {
      console.error('[AuthFlow] Error en handleLogin:', err)
      handlingLogin.current = false
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()

    if (!invToken && !form.nombreHogar.trim()) {
      setError('Debes darle un nombre a tu familia (Ej: Familia Quintero)')
      return
    }
    if (!form.email || !form.password || !form.nombre.trim()) return

    if (form.password !== form.confirmPwd) {
      setError('Las contraseñas no coinciden')
      return
    }

    // 🔴 FIX: validación segura en vez de solo longitud mínima de 6
    const { valida, fallidas } = validarContrasena(form.password)
    if (!valida) {
      setError(fallidas[0])
      return
    }

    setLoading(true)
    setError('')

    const redirectTo = invToken
      ? `${window.location.origin}/auth/callback?token=${invToken}`
      : `${window.location.origin}/auth/callback`

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          nombre: form.nombre.trim(),
          nombre_hogar: invToken ? undefined : form.nombreHogar.trim(),
        },
        emailRedirectTo: redirectTo,
      },
    })

    if (error) {
      setError(error.message === 'User already registered' ? 'Este correo ya está registrado' : 'No se pudo crear la cuenta')
      setLoading(false)
      return
    }

    if (data?.session) {
      const nombreFinal = form.nombre.trim()
      if (invToken) {
        const { data: res, error: invError } = await aceptarInvitacion(invToken, nombreFinal)
        if (invError || (res && !res.ok)) {
          setError(res?.error || invError?.message || 'Error al aceptar la invitación')
          setLoading(false)
          return
        }
      } else {
        const { error: initError } = await inicializarHogar(nombreFinal, form.nombreHogar.trim())
        if (initError) {
          setError('Error al crear tu familia en la base de datos. Intenta de nuevo.')
          setLoading(false)
          return
        }
      }
      setLoading(false)
      router.replace('/')
    } else {
      setLoading(false)
      setSent(true)
    }
  }

  async function handleRecover(e) {
    e.preventDefault()
    if (!form.email) return
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setLoading(false)
    if (error) setError('No se pudo enviar el enlace. Verifica el correo.')
    else setSent(true)
  }

  async function handleResetPassword(e) {
    e.preventDefault()

    // 🔴 FIX: validación segura + confirmación de contraseña
    const { valida, fallidas } = validarContrasena(form.newPwd)
    if (!valida) { setError(fallidas[0]); return }
    if (form.newPwd !== form.newPwdConfirm) { setError('Las contraseñas no coinciden'); return }

    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password: form.newPwd })
    setLoading(false)
    if (error) setError('No se pudo actualizar la contraseña')
    else router.replace('/')
  }

  async function handleGuardarNombre(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setLoading(true)
    setError('')
    const nombreFinal = form.nombre.trim()
    const nombreHogarFinal = form.nombreHogar.trim() || 'Mi Familia'

    const { error } = await supabase.auth.updateUser({ data: { nombre: nombreFinal, nombre_hogar: nombreHogarFinal } })
    if (error) {
      setError('Error al guardar el perfil')
      setLoading(false)
      return
    }

    const { data: perfil } = await supabase.rpc('get_mis_permisos')

    if (!perfil) {
      const { error: initError } = await inicializarHogar(nombreFinal, nombreHogarFinal)
      if (initError) {
        setError('Error al crear tu familia en la base de datos. Intenta de nuevo.')
        setLoading(false)
        return
      }
    } else {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) await supabase.from('perfiles').update({ nombre: nombreFinal }).eq('id', u.id)
    }

    setLoading(false)
    router.replace('/')
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) console.error('[AuthFlow] Error al conectar con Google:', error.message)
  }

  return {
    form, setForm, updateForm,
    mode, setMode,
    loading, checking,
    error, setError,
    sent, setSent,
    showPwd, setShowPwd,
    showConfirmPwd, setShowConfirmPwd,
    showNewConfirmPwd, setShowNewConfirmPwd, // 🔴 FIX: expuesto para LoginPage
    invToken, invInfo,
    handleLogin, handleRegister, handleRecover, handleResetPassword, handleGuardarNombre, handleGoogleLogin,
  }
}