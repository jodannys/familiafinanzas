'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, validarTokenInvitacion, inicializarHogar, aceptarInvitacion } from '@/lib/supabase'

export function useAuthFlow() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const handlingLogin = useRef(false)

  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)

  const [invToken, setInvToken] = useState(null)
  const [invInfo, setInvInfo] = useState(null)

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
    console.log('[AuthFlow] 🔵 useEffect inicializado. Params:', searchParams.toString())

    async function handleAuthenticatedUser(user) {
      console.log('[AuthFlow] ➡️ handleAuthenticatedUser - Iniciando para:', user.email)
      const type = searchParams.get('type')

      if (type === 'recovery') {
        console.log('[AuthFlow] Modo recovery detectado. Cambiando a reset.')
        setMode('reset')
        setChecking(false)
        return
      }

      console.log('[AuthFlow] Consultando rpc: get_mis_permisos...')
      const { data: perfil, error: rpcError } = await supabase.rpc('get_mis_permisos')
      console.log('[AuthFlow] Resultado rpc:', { perfil, rpcError })

      if (!perfil) {
        console.log('[AuthFlow] No se encontró perfil. Buscando metadata en el usuario...')
        // Solo usamos el nombre que *nosotros* guardamos (registro email/invitación).
        // Ignoramos full_name/name de Google para no saltarnos el formulario de bienvenida.
        const nombreMeta = user.user_metadata?.nombre || ''
        const nombreHogarMeta = user.user_metadata?.nombre_hogar || 'Mi Familia'

        console.log('[AuthFlow] Metadata extraída:', { nombreMeta, nombreHogarMeta })

        if (nombreMeta) {
          console.log('[AuthFlow] Llamando a inicializarHogar...')
          await inicializarHogar(nombreMeta, nombreHogarMeta)
          console.log('[AuthFlow] 🚀 Redirigiendo a / (desde handleAuthenticatedUser > !perfil > inicializarHogar)')
          router.replace('/')
        } else {
          console.log('[AuthFlow] Falta nombre guardado. Cambiando a modo: nombre')
          setMode('nombre')
          setChecking(false)
        }
      } else {
        console.log('[AuthFlow] Perfil encontrado. 🚀 Redirigiendo a / (desde handleAuthenticatedUser)')
        setChecking(false)
        router.replace('/')
      }
    }

    async function checkSession() {
      console.log('[AuthFlow] 🔍 checkSession - Iniciando verificación')
      try {
        const token = searchParams.get('token')

        if (token) {
          console.log('[AuthFlow] Token de invitación detectado en URL:', token)
          const inv = await validarTokenInvitacion(token)
          console.log('[AuthFlow] Resultado validarTokenInvitacion:', inv)

          if (!inv?.valida) {
            console.warn('[AuthFlow] ❌ Invitación no válida o expirada')
            setError(inv?.error || 'Invitación inválida o expirada')
            setChecking(false)
            return
          }

          const { data: { user } } = await supabase.auth.getUser()
          console.log('[AuthFlow] Usuario actual:', user?.email)

          if (user) {
            const emailCoincide = user.email?.toLowerCase() === inv.email?.toLowerCase()
            console.log('[AuthFlow] ¿Coinciden correos (usuario actual e invitación)?:', emailCoincide)

            if (emailCoincide) {
              const nombreFinal = user.user_metadata?.nombre || ''
              console.log('[AuthFlow] Aceptando invitación para:', nombreFinal)
              const { data: res, error: invError } = await aceptarInvitacion(token, nombreFinal)
              
              if (!invError && res?.ok) {
                console.log('[AuthFlow] Invitación aceptada correctamente. 🚀 Redirigiendo a /')
                router.replace('/')
                return
              }
              console.error('[AuthFlow] ❌ Error al aceptar invitación:', { res, invError })
              setError(res?.error || invError?.message || 'Error al aceptar la invitación')
              setChecking(false)
              return
            }

            console.log('[AuthFlow] Correos no coinciden. Cerrando sesión.')
            await supabase.auth.signOut()
          }

          console.log('[AuthFlow] Preparando formulario para registro por invitación.')
          setInvToken(token)
          setInvInfo(inv)
          updateForm('email', inv.email)
          setMode('register')
          setChecking(false)
          return
        }

        console.log('[AuthFlow] No hay token. Obteniendo sesión de usuario actual...')
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error) {
          console.log('[AuthFlow] Error al obtener usuario (posiblemente no hay sesión o es OAuth pendiente):', error.message)
          setChecking(false)
          return
        }

        if (user) {
          console.log('[AuthFlow] Usuario encontrado:', user.email, '-> Llamando a handleAuthenticatedUser')
          await handleAuthenticatedUser(user)
          return
        }

        console.log('[AuthFlow] No hay usuario. Terminando checkSession.')
        setChecking(false)
      } catch (err) {
        console.error('[AuthFlow] ❌ Excepción no controlada en checkSession:', err)
        setChecking(false)
      }
    }

    checkSession()

    console.log('[AuthFlow] Suscribiendo a onAuthStateChange...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthFlow] 🔔 Evento AuthStateChange disparado: ${event}`)
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[AuthFlow] Evento PASSWORD_RECOVERY -> Cambiando a reset')
        setMode('reset')
        return
      }

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        // Si handleLogin ya está manejando el redirect, ignorar este evento
        if (handlingLogin.current) return
        // Si hay token de invitación en la URL, checkSession() maneja todo el flujo.
        if (searchParams.get('token')) {
          console.log('[AuthFlow] Evento SIGNED_IN/INITIAL_SESSION con token de invitación -> delegando a checkSession')
          return
        }
        console.log('[AuthFlow] Evento SIGNED_IN/INITIAL_SESSION -> Procesando usuario:', session.user.email)
        setChecking(true)
        try {
          await handleAuthenticatedUser(session.user)
        } catch (err) {
          console.error('[AuthFlow] ❌ Excepción en onAuthStateChange > handleAuthenticatedUser:', err)
          setChecking(false)
        }
      }
    })

    return () => {
      console.log('[AuthFlow] 🧹 Limpiando suscripción de AuthStateChange')
      subscription.unsubscribe()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router])

  async function handleLogin(e) {
    e.preventDefault()
    console.log('[AuthFlow] 🔓 handleLogin intentando con:', form.email)
    if (!form.email || !form.password) {
      console.warn('[AuthFlow] handleLogin abortado: Faltan campos')
      return
    }
    
    setLoading(true)
    setError('')
    handlingLogin.current = true
    try {
      console.log('[AuthFlow] Llamando a supabase.auth.signInWithPassword...')
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      })
      console.log('[AuthFlow] Respuesta signInWithPassword:', { data, error })

      if (error) {
        console.error('[AuthFlow] ❌ Error de credenciales:', error.message)
        handlingLogin.current = false
        setError('Credenciales no válidas')
      } else {
        const nombreGuardado = data?.user?.user_metadata?.nombre
        console.log('[AuthFlow] Nombre guardado en metadata:', nombreGuardado)

        if (!nombreGuardado) {
          console.log('[AuthFlow] Falta nombre, cambiando a modo nombre')
          handlingLogin.current = false
          setMode('nombre')
        } else {
          console.log('[AuthFlow] Buscando rpc get_mis_permisos tras login...')
          const { data: perfil, error: rpcError } = await supabase.rpc('get_mis_permisos')
          console.log('[AuthFlow] Resultado rpc post-login:', { perfil, rpcError })

          if (!perfil) {
            const nombreHogarMeta = data.user.user_metadata?.nombre_hogar || 'Mi Familia'
            console.log('[AuthFlow] Sin perfil post-login. Inicializando hogar:', nombreHogarMeta)
            await inicializarHogar(nombreGuardado, nombreHogarMeta)
          }
          console.log('[AuthFlow] 🚀 Login exitoso. Redirigiendo a /')
          router.replace('/')
        }
      }
    } catch (err) {
      console.error('[AuthFlow] ❌ Excepción en handleLogin:', err)
      handlingLogin.current = false
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    console.log('[AuthFlow] 📝 handleRegister intentando. invToken:', invToken)
    
    if (!invToken && !form.nombreHogar.trim()) {
      console.warn('[AuthFlow] handleRegister abortado: Falta nombreHogar')
      setError('Debes darle un nombre a tu familia (Ej: Familia Quintero)')
      return
    }
    if (!form.email || !form.password || !form.nombre.trim()) {
      console.warn('[AuthFlow] handleRegister abortado: Faltan campos obligatorios')
      return
    }
    if (form.password !== form.confirmPwd) { 
      console.warn('[AuthFlow] handleRegister abortado: Contraseñas no coinciden')
      setError('Las contraseñas no coinciden'); 
      return 
    }
    if (form.password.length < 6) { 
      console.warn('[AuthFlow] handleRegister abortado: Contraseña corta')
      setError('Mínimo 6 caracteres'); 
      return 
    }
    
    setLoading(true); setError('')

    const redirectTo = invToken
      ? `${window.location.origin}/login?token=${invToken}`
      : `${window.location.origin}/login`
    console.log('[AuthFlow] URL de redirección configurada:', redirectTo)

    console.log('[AuthFlow] Llamando a supabase.auth.signUp...')
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
    console.log('[AuthFlow] Respuesta signUp:', { data, error })

    if (error) {
      console.error('[AuthFlow] ❌ Error en signUp:', error.message)
      setError(error.message === 'User already registered' ? 'Este correo ya está registrado' : 'No se pudo crear la cuenta')
      setLoading(false)
      return
    }

    if (data?.session) {
      console.log('[AuthFlow] Sesión creada tras registro. Procesando siguientes pasos...')
      const nombreFinal = form.nombre.trim()
      if (invToken) {
        console.log('[AuthFlow] Hay invToken. Aceptando invitación...')
        const { data: res, error: invError } = await aceptarInvitacion(invToken, nombreFinal)
        console.log('[AuthFlow] Resultado aceptarInvitacion:', { res, invError })
        
        if (invError || (res && !res.ok)) {
          console.error('[AuthFlow] ❌ Error al aceptar invitación tras registro')
          setError(res?.error || invError?.message || 'Error al aceptar la invitación')
          setLoading(false)
          return
        }
      } else {
        console.log('[AuthFlow] No hay invToken. Inicializando hogar nuevo...')
        await inicializarHogar(nombreFinal, form.nombreHogar.trim())
      }
      console.log('[AuthFlow] 🚀 Registro y configuración completos. Redirigiendo a /')
      setLoading(false)
      router.replace('/')
    } else {
      console.log('[AuthFlow] Registro exitoso pero requiere confirmación de email (no hay sesión inmediata).')
      setLoading(false)
      setSent(true)
    }
  }

  async function handleRecover(e) {
    // Aquí puedes aplicar logs similares si tienes problemas de recuperación
    e.preventDefault()
    if (!form.email) return
    setLoading(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
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
    console.log('[AuthFlow] 💾 handleGuardarNombre iniciado. Nombre:', form.nombre)
    if (!form.nombre.trim()) return
    setLoading(true); setError('')
    const nombreFinal = form.nombre.trim()

    const nombreHogarFinal = form.nombreHogar.trim() || 'Mi Familia'

    console.log('[AuthFlow] Actualizando metadatos de usuario...')
    const { error } = await supabase.auth.updateUser({ data: { nombre: nombreFinal, nombre_hogar: nombreHogarFinal } })
    if (error) { 
      console.error('[AuthFlow] ❌ Error al guardar metadatos:', error)
      setError('Error al guardar el perfil'); 
      setLoading(false); 
      return 
    }

    console.log('[AuthFlow] Consultando rpc get_mis_permisos para handleGuardarNombre...')
    const { data: perfil } = await supabase.rpc('get_mis_permisos')
    
    if (!perfil) {
      console.log('[AuthFlow] Sin perfil. Inicializando hogar...')
      await inicializarHogar(nombreFinal, nombreHogarFinal)
    } else {
      console.log('[AuthFlow] Perfil encontrado. Actualizando tabla perfiles...')
      const { data: { user: u } } = await supabase.auth.getUser()
      if (u) await supabase.from('perfiles').update({ nombre: nombreFinal }).eq('id', u.id)
    }

    console.log('[AuthFlow] 🚀 Nombre guardado con éxito. Redirigiendo a /')
    setLoading(false)
    router.replace('/')
  }

  async function handleGoogleLogin() {
    console.log('[AuthFlow] 🌐 Iniciando login con Google...')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) console.error('[AuthFlow] ❌ Error al conectar con Google:', error.message)
  }

  return {
    form, setForm, updateForm,
    mode, setMode,
    loading, checking,
    error, setError,
    sent, setSent,
    showPwd, setShowPwd,
    showConfirmPwd, setShowConfirmPwd,
    invToken, invInfo,
    handleLogin, handleRegister, handleRecover, handleResetPassword, handleGuardarNombre, handleGoogleLogin,
  }
}