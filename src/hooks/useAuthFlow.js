'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, validarTokenInvitacion, inicializarHogar, aceptarInvitacion } from '@/lib/supabase'

export function useAuthFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState('login') // 'login' | 'register' | 'recover' | 'reset' | 'nombre'
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  // Estado de invitación
  const [invToken, setInvToken] = useState(null)
  const [invInfo, setInvInfo] = useState(null) // { nombre_hogar, rol_asignado, email }

  // Formulario agrupado
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPwd: '',
    newPwd: '',
    nombre: '',
    nombreHogar: '',
    inviteToken: null,
  })

  function updateForm(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  useEffect(() => {
    // Ejecuta el flujo de post-autenticacion para un usuario ya verificado.
    // Se llama tanto desde checkSession (flujo normal/email) como desde
    // onAuthStateChange SIGNED_IN (flujo OAuth / race condition).
    async function handleAuthenticatedUser(user) {
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
          await inicializarHogar(nombreMeta, nombreHogarMeta)
          router.replace('/')
        } else {
          setMode('nombre')
          setChecking(false)
        }
      } else {
        router.replace('/')
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

        // Si hay error de sesion pero venimos de OAuth (el evento SIGNED_IN
        // llegara via onAuthStateChange cuando las cookies esten listas).
        // No hacemos signOut automatico para no destruir la sesion recien creada.
        if (error) {
          setChecking(false)
          return
        }

        if (user) {
          await handleAuthenticatedUser(user)
          return
        }

        setChecking(false)
      } catch {
        setChecking(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
        return
      }

      // SIGNED_IN cubre tanto el login con email/password como el retorno
      // de OAuth (Google). Es el punto de entrada seguro post-callback.
      if (event === 'SIGNED_IN' && session?.user) {
        setChecking(true)
        try {
          await handleAuthenticatedUser(session.user)
        } catch {
          setChecking(false)
        }
      }
    })

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router])

  async function handleLogin(e) {
    e.preventDefault()
    if (!form.email || !form.password) return
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      })
      if (error) {
        setError('Credenciales no válidas')
      } else {
        const nombreGuardado = data?.user?.user_metadata?.nombre
        if (!nombreGuardado) {
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
    } catch {
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
    if (form.password !== form.confirmPwd) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true); setError('')

    const redirectTo = invToken
      ? `${window.location.origin}/login?token=${invToken}`
      : `${window.location.origin}/login`

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
        await inicializarHogar(nombreFinal, form.nombreHogar.trim())
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
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setLoading(false)
    if (error) setError('No se pudo enviar el enlace. Verifica el correo.')
    else setSent(true)
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    if (!form.newPwd || form.newPwd.length < 6) { setError('Mínimo 6 caracteres'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: form.newPwd })
    setLoading(false)
    if (error) setError('No se pudo actualizar la contraseña')
    else router.replace('/')
  }

  async function handleGuardarNombre(e) {
    e.preventDefault()
    if (!form.nombre.trim()) return
    setLoading(true); setError('')
    const nombreFinal = form.nombre.trim()

    const nombreHogarFinal = form.nombreHogar.trim() || 'Mi Familia'

    const { error } = await supabase.auth.updateUser({ data: { nombre: nombreFinal, nombre_hogar: nombreHogarFinal } })
    if (error) { setError('Error al guardar el perfil'); setLoading(false); return }

    const { data: perfil } = await supabase.rpc('get_mis_permisos')
    if (!perfil) {
      await inicializarHogar(nombreFinal, nombreHogarFinal)
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
    if (error) console.error('Error al conectar con Google:', error.message)
  }

  return {
    form,
    setForm,
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
  }
}
