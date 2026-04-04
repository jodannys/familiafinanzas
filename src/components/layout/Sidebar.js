'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, CircleDollarSign, Settings2,
  CalendarDays, Home, Menu,
} from 'lucide-react'
import { supabase, signOut, getMisPermisos } from '@/lib/supabase'
import { useTheme, getThemeColors } from '@/lib/themes'
import ProfilePanel from '@/components/ui/ProfilePanel'

const W_EXP = 240
const W_COL = 64
const TRANS = '0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/reportes', label: 'Reporte Anual', icon: BarChart3, permiso: 'reportes' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart, permiso: 'presupuesto' },
      { href: '/gastos', label: 'Registro', icon: ArrowLeftRight, permiso: 'gastos' },
      { href: '/agenda', label: 'Agenda', icon: CalendarDays, permiso: 'agenda' },
      { href: '/sobres', label: 'Sobres', icon: Wallet, permiso: 'sobres' },
    ],
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas', label: 'Metas de Ahorro', icon: Target, permiso: 'metas' },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp, permiso: 'inversiones' },
      { href: '/deudas', label: 'Deudas', icon: CircleDollarSign, deudaBadge: true, permiso: 'deudas' },
      { href: '/inmuebles', label: 'Inmuebles', icon: Home, permiso: 'inmuebles' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/tarjetas', label: 'Mis Tarjetas', icon: CreditCard, permiso: 'tarjetas' },
      { href: '/ajustes', label: 'Configuración', icon: Settings2 },
    ],
  },
]


function diasHastaPago(diaPago) {
  if (!diaPago) return null
  const hoy = new Date().getDate()
  if (diaPago >= hoy) return diaPago - hoy
  const ultimo = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  return (ultimo - hoy) + diaPago
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef(null)
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)

  function avatarColor(nombre) {
    if (!themeColors || themeColors.length === 0) return '#cccccc'
    if (!nombre) return themeColors[0]
    let h = 0
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) & 0x7fffffff
    return themeColors[h % themeColors.length]
  }

  const [deudasAlert, setDeudasAlert] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const [indicator, setIndicator] = useState({ top: 8, height: 36, visible: false })
  const [perfilNombre, setPerfilNombre] = useState('')
  const [nombreHogar, setNombreHogar] = useState('')

  // ── collapsed se inicializa directo desde localStorage, sin flash ──
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('ff-sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  // ── CSS var sincronizada en el primer render ──
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--sidebar-w',
      collapsed ? `${W_COL}px` : `${W_EXP}px`
    )
  }, [])

  // ── Carga de datos del usuario ──
  useEffect(() => {
    getMisPermisos().then(({ data }) => {
      if (data) {
        setPerfilNombre(data.nombre || '')
        setNombreHogar(data.nombre_hogar || '')
      }
    })
  }, [])

  // ── Auth + deudas con realtime ──
  useEffect(() => {
    const fetchDeudas = () => {
      supabase.from('deudas').select('dia_pago').eq('estado', 'activa').then(({ data }) => {
        if (data) setDeudasAlert(data.some(d => {
          const dias = diasHastaPago(d.dia_pago)
          return dias !== null && dias <= 7
        }))
      })
    }

    fetchDeudas()

    // Actualización en tiempo real: si se añade/modifica una deuda, el badge se actualiza solo
    const channel = supabase
      .channel('deudas-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deudas' }, fetchDeudas)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // ── Indicador deslizante: solo cuando está expandido ──
  useEffect(() => {
    if (collapsed) return

    const update = () => {
      const activeEl = navRef.current?.querySelector('[data-active="true"]')
      if (activeEl && navRef.current) {
        const navRect = navRef.current.getBoundingClientRect()
        const iconEl = activeEl.querySelector('div')
        const iconRect = iconEl?.getBoundingClientRect() || activeEl.getBoundingClientRect()
        setIndicator({
          top: iconRect.top - navRect.top + navRef.current.scrollTop,
          height: iconRect.height,
          visible: true,
        })
      } else {
        setIndicator(prev => ({ ...prev, visible: false }))
      }
    }

    const t = setTimeout(update, 150)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', update)
    }
  }, [pathname, collapsed])

  function applyCollapse(next) {
    document.documentElement.style.setProperty('--sidebar-w', next ? `${W_COL}px` : `${W_EXP}px`)
    try { localStorage.setItem('ff-sidebar-collapsed', String(next)) } catch { }
    if (next) setTooltip(null)
    setCollapsed(next)
  }

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  const nombre = perfilNombre
  const initial = nombre ? nombre.charAt(0).toUpperCase() : '?'
  const bgColor = avatarColor(nombre)

  return (
    <>
      {/* ── Tooltip: siempre montado, controlado por opacity para evitar parpadeo ── */}
      <div
        style={{
          position: 'fixed',
          left: W_COL + 10,
          top: tooltip?.top ?? 0,
          transform: 'translateY(-50%)',
          zIndex: 300,
          background: 'var(--bg-dark-card)',
          color: 'var(--text-on-dark)',
          fontSize: 11,
          fontWeight: 600,
          padding: '6px 12px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          boxShadow: 'var(--shadow-md)',
          pointerEvents: 'none',
          opacity: tooltip && collapsed ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        <span style={{
          position: 'absolute', left: -4, top: '50%',
          transform: 'translateY(-50%)',
          width: 0, height: 0,
          borderTop: '4px solid transparent',
          borderBottom: '4px solid transparent',
          borderRight: '4px solid var(--bg-dark-card)',
        }} />
        {tooltip?.label}
      </div>

      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? W_COL : W_EXP,
        minWidth: collapsed ? W_COL : W_EXP,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid color-mix(in srgb, var(--sidebar-border) 35%, transparent)',
        zIndex: 100,
        overflow: 'hidden',
        transition: `width ${TRANS}`,
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: collapsed ? '20px 0 16px' : '20px 14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          width: '100%',
          flexShrink: 0,
          transition: `padding ${TRANS}`,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'color-mix(in srgb, var(--accent-main) 14%, transparent)',
              }}>
                <img src="/icon.svg" alt="Logo" style={{ width: 20, height: 20 }} />
              </div>
              <p style={{
                fontFamily: 'Sacramento, cursive',
                fontSize: 20,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
              }}>
                {nombreHogar || 'Mi Familia'}
              </p>
            </div>
          )}

          <button
            onClick={() => applyCollapse(!collapsed)}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            style={{
              width: 32, height: 32,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none',
              background: `color-mix(in srgb, ${bgColor} 12%, transparent)`,
              color: bgColor,
              cursor: 'pointer', flexShrink: 0,
              margin: collapsed ? '0 auto' : '0',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = `color-mix(in srgb, ${bgColor} 22%, transparent)`
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = `color-mix(in srgb, ${bgColor} 12%, transparent)`
            }}
          >
            <Menu size={15} />
          </button>
        </div>

        {/* ── Nav ── */}
        <nav ref={navRef} className="no-scrollbar" style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '0 6px' : '0 10px',
          position: 'relative',
          transition: `padding ${TRANS}`,
        }}>

          {indicator.visible && !collapsed && (
            <div style={{
              position: 'absolute',
              left: 0, width: 3,
              top: indicator.top,
              height: indicator.height,
              borderRadius: '0 4px 4px 0',
              background: 'var(--accent-main)',
              transition: `top ${TRANS}, height ${TRANS}`,
              pointerEvents: 'none',
              zIndex: 10,
            }} />
          )}

          {MENU_GROUPS.map((group, gIdx) => {
            return (
              <div key={gIdx} style={{ marginTop: gIdx > 0 ? 14 : 4 }}>

                <div style={{
                  overflow: 'hidden',
                  maxHeight: collapsed ? 0 : 24,
                  opacity: collapsed ? 0 : 1,
                  transition: `max-height ${TRANS}, opacity 0.2s ease`,
                  marginBottom: collapsed ? 0 : 4,
                }}>
                  <p style={{
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.11em', textTransform: 'uppercase',
                    color: 'var(--text-muted)', opacity: 0.55,
                    padding: '0 6px', whiteSpace: 'nowrap',
                  }}>
                    {group.title}
                  </p>
                </div>

                {collapsed && gIdx > 0 && (
                  <div style={{
                    height: 1, margin: '6px 4px 10px',
                    background: 'color-mix(in srgb, var(--border-glass) 40%, transparent)',
                  }} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.items.map(({ href, label, icon: Icon, deudaBadge }) => {
                    const active = pathname === href
                    const showBadge = deudaBadge && deudasAlert
                    return (
                      <Link
                        key={href}
                        href={href}
                        data-active={active}
                        aria-label={collapsed ? label : undefined}
                        style={{
                          textDecoration: 'none',
                          display: 'flex', alignItems: 'center',
                          gap: collapsed ? 0 : 10,
                          padding: collapsed ? '6px' : '7px 8px',
                          borderRadius: 10,
                          justifyContent: collapsed ? 'center' : 'flex-start',
                          background: (!collapsed && active)
                            ? 'color-mix(in srgb, var(--accent-main) 10%, transparent)'
                            : 'transparent',
                          position: 'relative', zIndex: 1,
                          transition: `background 0.15s ease, gap ${TRANS}, padding ${TRANS}`,
                        }}
                        onMouseEnter={e => {
                          if (!active) e.currentTarget.style.background = collapsed
                            ? 'transparent'
                            : 'color-mix(in srgb, var(--text-muted) 7%, transparent)'
                          if (collapsed) {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setTooltip({ label, top: rect.top + rect.height / 2 })
                          }
                        }}
                        onMouseLeave={e => {
                          if (!active) e.currentTarget.style.background = 'transparent'
                          setTooltip(null)
                        }}
                      >
                        <div style={{
                          width: 34, height: 34,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: 10, flexShrink: 0, position: 'relative',
                          background: active
                            ? 'color-mix(in srgb, var(--accent-main) 18%, transparent)'
                            : 'transparent',
                          transition: 'background 0.15s ease',
                        }}>
                          <Icon
                            size={15}
                            strokeWidth={active ? 2.5 : 1.8}
                            style={{ color: active ? 'var(--accent-main)' : 'var(--text-muted)' }}
                          />
                          {showBadge && (
                            <span style={{
                              position: 'absolute', top: -2, right: -2,
                              width: 7, height: 7, borderRadius: '50%',
                              background: 'var(--accent-rose)',
                              border: '2px solid var(--sidebar-bg)',
                            }} />
                          )}
                        </div>

                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: active ? 'var(--accent-main)' : 'var(--text-secondary)',
                          whiteSpace: 'nowrap', overflow: 'hidden',
                          flex: 1,
                          maxWidth: collapsed ? 0 : 180,
                          opacity: collapsed ? 0 : 1,
                          transition: `max-width ${TRANS}, opacity 0.18s ease`,
                        }}>
                          {label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 10px',
          borderTop: '1px solid color-mix(in srgb, var(--border-glass) 40%, transparent)',
          display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0,
        }}>

          {/* ── Avatar del usuario (abre Panel Familiar si es admin) ── */}
          <button
            onClick={() => { setTooltip(null); setShowProfile(true) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '7px 6px' : '7px 8px',
              borderRadius: 10,
              justifyContent: collapsed ? 'center' : 'flex-start',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              transition: `background 0.15s ease, gap ${TRANS}, padding ${TRANS}`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-main) 8%, transparent)'
              if (collapsed && nombre) {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({ label: nombre, top: rect.top + rect.height / 2 })
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              setTooltip(null)
            }}
            aria-label={collapsed ? (nombre || 'Perfil') : undefined}
          >
            {/* Círculo avatar */}
            <div style={{
              width: 28, height: 28,
              borderRadius: '50%',
              background: bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: 12, fontWeight: 700,
              color: '#fff',
              userSelect: 'none',
              transition: `background ${TRANS}`,
            }}
              aria-hidden="true"
            >
              {initial}
            </div>

            {/* Nombre (solo expandido) */}
            <div style={{
              overflow: 'hidden',
              maxWidth: collapsed ? 0 : 180,
              opacity: collapsed ? 0 : 1,
              transition: `max-width ${TRANS}, opacity 0.18s ease`,
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                display: 'block', maxWidth: 150,
              }}>
                {nombre || 'Usuario'}
              </span>
            </div>
          </button>

          {/* ── ThemeSwitcher ── */}
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: collapsed ? 0 : 10,
            padding: collapsed ? '7px 6px' : '7px 8px',
            borderRadius: 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: `gap ${TRANS}, padding ${TRANS}`,
          }}>
           
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setConfirmLogout(true)}
              aria-label={collapsed ? 'Cerrar sesión' : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '7px 6px' : '7px 8px',
                borderRadius: 10, justifyContent: collapsed ? 'center' : 'flex-start',
                border: 'none', background: 'transparent', cursor: 'pointer',
                transition: `background 0.15s ease, gap ${TRANS}, padding ${TRANS}`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-rose) 8%, transparent)'
                if (collapsed) setTooltip({
                  label: 'Cerrar sesión',
                  top: e.currentTarget.getBoundingClientRect().top + 14,
                })
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent'
                setTooltip(null)
              }}
            >
              <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogOut size={15} style={{ color: 'var(--accent-rose)' }} />
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--accent-rose)',
                whiteSpace: 'nowrap', overflow: 'hidden',
                maxWidth: collapsed ? 0 : 180,
                opacity: collapsed ? 0 : 1,
                transition: `max-width ${TRANS}, opacity 0.18s ease`,
              }}>
                Cerrar sesión
              </span>
            </button>

            {confirmLogout && (
              <>
                <div className="fixed inset-0 z-[200]" onClick={() => setConfirmLogout(false)} />
                <div style={{
                  position: 'fixed',
                  bottom: 70,
                  left: collapsed ? 16 : 24,
                  zIndex: 201,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 16, boxShadow: 'var(--shadow-lg)',
                  padding: '14px 16px', width: 210,
                  transition: `left ${TRANS}`,
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                    ¿Cerrar sesión?
                  </p>
                  <p style={{ fontSize: 10, marginBottom: 12, color: 'var(--text-muted)' }}>
                    Tendrás que volver a iniciar sesión.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setConfirmLogout(false)}
                      style={{
                        flex: 1, fontSize: 12, fontWeight: 600,
                        padding: '6px 0', borderRadius: 10, border: 'none',
                        cursor: 'pointer',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleLogout}
                      style={{
                        flex: 1, fontSize: 12, fontWeight: 600,
                        padding: '6px 0', borderRadius: 10, border: 'none',
                        cursor: 'pointer',
                        background: 'color-mix(in srgb, var(--accent-rose) 15%, transparent)',
                        color: 'var(--accent-rose)',
                      }}
                    >
                      Salir
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <ProfilePanel open={showProfile} onClose={() => setShowProfile(false)} />
    </>
  )
}
