'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, CircleDollarSign, Settings2,
  CalendarDays, Home, Menu, Check, Users,
} from 'lucide-react'
import { supabase, signOut, getMisPermisos } from '@/lib/supabase'
import ConfirmLogoutModal from '@/components/ui/ConfirmLogoutModal'
import { useTheme, getThemeColors, THEMES } from '@/lib/themes'
import ProfilePanel from '@/components/ui/ProfilePanel'
import UserAvatar from '@/components/ui/UserAvatar'


const W_EXP = 240
const W_COL = 64
const TRANS = '0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)'

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/reportes', label: 'Reporte Anual', icon: BarChart3, permiso: 'reportes' },
      { href: '/familia', label: 'Panel Familiar', icon: Users },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart, permiso: 'presupuesto' },
      { href: '/gastos', label: 'Registro', icon: ArrowLeftRight, permiso: 'gastos' },
      { href: '/agenda', label: 'Agenda', icon: CalendarDays, permiso: 'agenda' },
      { href: '/sobres', label: 'Gastos Diarios', icon: Wallet, permiso: 'sobres' },
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

export default function Sidebar({ paisUsuario = 'ES', tieneFamilia = true }) {
  const pathname = usePathname()
  const router = useRouter()
  const navRef = useRef(null)
  const { theme, setTheme } = useTheme()

  const [deudasAlert, setDeudasAlert] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [tooltip, setTooltip] = useState(null)
  const [openTheme, setOpenTheme] = useState(false)
  const [indicator, setIndicator] = useState({ top: 8, height: 36, visible: false })
  const [perfilNombre, setPerfilNombre] = useState('')
  const [nombreHogar, setNombreHogar] = useState('')

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('ff-sidebar-collapsed') === 'true' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-w', collapsed ? `${W_COL}px` : `${W_EXP}px`)
  }, [])

  useEffect(() => {
    getMisPermisos().then(({ data }) => {
      if (data) { setPerfilNombre(data.nombre || ''); setNombreHogar(data.nombre_hogar || '') }
    })
  }, [])

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
    const channel = supabase
      .channel('deudas-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deudas' }, fetchDeudas)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => {
    if (collapsed) return
    const update = () => {
      const activeEl = navRef.current?.querySelector('[data-active="true"]')
      if (activeEl && navRef.current) {
        const navRect = navRef.current.getBoundingClientRect()
        const iconEl = activeEl.querySelector('div')
        const iconRect = iconEl?.getBoundingClientRect() || activeEl.getBoundingClientRect()
        setIndicator({ top: iconRect.top - navRect.top + navRef.current.scrollTop, height: iconRect.height, visible: true })
      } else {
        setIndicator(prev => ({ ...prev, visible: false }))
      }
    }
    const t = setTimeout(update, 150)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); window.removeEventListener('resize', update) }
  }, [pathname, collapsed])

  function applyCollapse(next) {
    document.documentElement.style.setProperty('--sidebar-w', next ? `${W_COL}px` : `${W_EXP}px`)
    try { localStorage.setItem('ff-sidebar-collapsed', String(next)) } catch { }
    if (next) setTooltip(null)
    setCollapsed(next)
  }

  async function handleLogout() { await signOut(); router.replace('/login') }

  const nombre = perfilNombre

  return (
    <>
      {/* Tooltip */}
      <div style={{
        position: 'fixed', left: W_COL + 10, top: tooltip?.top ?? 0,
        transform: 'translateY(-50%)', zIndex: 300,
        background: 'var(--bg-dark-card)', color: 'var(--text-on-dark)',
        fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 8,
        whiteSpace: 'nowrap', boxShadow: 'var(--shadow-md)', pointerEvents: 'none',
        opacity: tooltip && collapsed ? 1 : 0, transition: 'opacity 0.15s ease',
      }}>
        <span style={{
          position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)',
          width: 0, height: 0, borderTop: '4px solid transparent',
          borderBottom: '4px solid transparent', borderRight: '4px solid var(--bg-dark-card)',
        }} />
        {tooltip?.label}
      </div>

      <aside style={{
        width: collapsed ? W_COL : W_EXP, minWidth: collapsed ? W_COL : W_EXP,
        height: '100%', display: 'flex', flexDirection: 'column',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid color-mix(in srgb, var(--sidebar-border) 35%, transparent)',
        zIndex: 100, overflow: 'hidden', transition: `width ${TRANS}`,
      }}>

        {/* Header */}
        <div style={{
          padding: collapsed ? '20px 0 16px' : '20px 14px 16px',
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          width: '100%', flexShrink: 0, transition: `padding ${TRANS}`,
        }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>

              <div style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src="/icon.svg"
                  alt="Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>

              <p style={{
                fontFamily: 'Sacramento, cursive',
                fontSize: 20,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}>
                {nombreHogar || 'Mi Familia'}
              </p>

            </div>
          )}

          <button
            onClick={() => applyCollapse(!collapsed)}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 8, border: 'none',
              background: 'color-mix(in srgb, var(--accent-main) 12%, transparent)',
              color: 'var(--accent-main)', cursor: 'pointer', flexShrink: 0,
              margin: collapsed ? '0 auto' : '0', transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-main) 22%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-main) 12%, transparent)'}
          >
            <Menu size={15} />
          </button>
        </div>

        {/* Nav */}
        <nav ref={navRef} className="no-scrollbar" style={{
          flex: 1, overflowY: 'auto', overflowX: 'hidden',
          padding: collapsed ? '0 6px' : '0 10px',
          position: 'relative', transition: `padding ${TRANS}`,
        }}>
          {indicator.visible && !collapsed && (
            <div style={{
              position: 'absolute', left: 0, width: 3,
              top: indicator.top, height: indicator.height,
              borderRadius: '0 4px 4px 0', background: 'var(--accent-main)',
              transition: `top ${TRANS}, height ${TRANS}`,
              pointerEvents: 'none', zIndex: 10,
            }} />
          )}

          {MENU_GROUPS.map((group, gIdx) => (
            <div key={gIdx} style={{ marginTop: gIdx > 0 ? 14 : 4 }}>
              <div style={{
                overflow: 'hidden', maxHeight: collapsed ? 0 : 24,
                opacity: collapsed ? 0 : 1,
                transition: `max-height ${TRANS}, opacity 0.2s ease`,
                marginBottom: collapsed ? 0 : 4,
              }}>
                <p style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.11em',
                  textTransform: 'uppercase', color: 'var(--text-muted)', opacity: 0.55,
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
                {group.items
                  .filter(item => item.href !== '/inmuebles' || paisUsuario === 'ES')
                  .filter(item => item.href !== '/familia' || tieneFamilia) // ← agregar esto
                  .map((item) => {
                    const { label, icon: Icon, deudaBadge, href } = item
                    const active = pathname === href

                    const showBadge = deudaBadge && deudasAlert

                    const commonStyle = {
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      textAlign: 'left',
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
                      width: '100%', border: 'none', cursor: 'pointer',
                    }

                    const iconAccent = 'var(--accent-main)'

                    const inner = (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                          <div style={{
                            width: 34, height: 34,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 10, position: 'relative',
                            background: active
                              ? 'color-mix(in srgb, var(--accent-main) 18%, transparent)'
                              : 'transparent',
                            transition: 'background 0.15s ease',
                          }}>
                            <Icon
                              size={15}
                              strokeWidth={active ? 2.5 : 1.8}
                              style={{
                                color: active
                                  ? 'var(--accent-main)'
                                  : 'var(--text-muted)'
                              }}
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
                          {collapsed && (
                            <div style={{
                              width: active ? 4 : 0, height: 4, borderRadius: 9999,
                              background: iconAccent,
                              transition: 'width 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }} />
                          )}
                        </div>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: active
                            ? 'var(--accent-main)'
                            : 'var(--text-secondary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', flex: 1,
                          maxWidth: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1,
                          transition: `max-width ${TRANS}, opacity 0.18s ease`,
                        }}>
                          {label}
                        </span>
                      </>
                    )

                    const hoverOn = (e) => {
                      if (!active) e.currentTarget.style.background =
                        'color-mix(in srgb, var(--text-muted) 7%, transparent)'
                      if (collapsed) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setTooltip({ label, top: rect.top + rect.height / 2 })
                      }
                    }
                    const hoverOff = (e) => {
                      if (!active) e.currentTarget.style.background = 'transparent'
                      setTooltip(null)
                    }

                    return (
                      <Link
                        key={href}
                        href={href}
                        data-active={active}
                        aria-label={collapsed ? label : undefined}
                        style={commonStyle}
                        onMouseEnter={hoverOn}
                        onMouseLeave={hoverOff}
                      >
                        {inner}
                      </Link>
                    )
                  })}

              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '10px 10px',
          borderTop: '1px solid color-mix(in srgb, var(--border-glass) 40%, transparent)',
          display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0,
        }}>


          {/* Avatar */}
          <button
            onClick={() => { setTooltip(null); setShowProfile(true) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10, padding: collapsed ? '7px 6px' : '7px 8px',
              borderRadius: 10, justifyContent: collapsed ? 'center' : 'flex-start',
              border: 'none', background: 'transparent', cursor: 'pointer',
              transition: `background 0.15s ease, gap ${TRANS}, padding ${TRANS}`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-main) 8%, transparent)'
              if (collapsed && nombre) {
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltip({ label: nombre, top: rect.top + rect.height / 2 })
              }
            }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setTooltip(null) }}
          >
            <UserAvatar nombre={perfilNombre} size={32} />
            <div style={{
              overflow: 'hidden', maxWidth: collapsed ? 0 : 180,
              opacity: collapsed ? 0 : 1,
              transition: `max-width ${TRANS}, opacity 0.18s ease`, flexShrink: 0,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                paddingLeft: 4, display: 'block', maxWidth: 150,
              }}>
                {nombre || 'Usuario'}
              </span>
            </div>
          </button>

          {/* ThemeSwitcher */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenTheme(o => !o)}
              aria-label={collapsed ? 'Cambiar tema' : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: collapsed ? 0 : 10, padding: collapsed ? '7px 6px' : '7px 8px',
                borderRadius: 10, justifyContent: collapsed ? 'center' : 'flex-start',
                border: 'none',
                background: openTheme ? 'color-mix(in srgb, var(--accent-main) 8%, transparent)' : 'transparent',
                cursor: 'pointer', transition: `background 0.15s ease, gap ${TRANS}, padding ${TRANS}`,
              }}
              onMouseEnter={e => {
                if (!openTheme) e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-main) 8%, transparent)'
                if (collapsed) setTooltip({ label: 'Cambiar tema', top: e.currentTarget.getBoundingClientRect().top + 14 })
              }}
              onMouseLeave={e => {
                if (!openTheme) e.currentTarget.style.background = 'transparent'
                setTooltip(null)
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, padding: 6,
                background: 'color-mix(in srgb, var(--accent-main) 10%, transparent)',
              }}>
                {(THEMES[theme]?.preview || []).slice(0, 4).map((c, i) => (
                  <div key={i} style={{ borderRadius: 2, background: c }} />
                ))}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                whiteSpace: 'nowrap', overflow: 'hidden',
                maxWidth: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1,
                transition: `max-width ${TRANS}, opacity 0.18s ease`,
              }}>
                Tema
              </span>
            </button>

            {openTheme && (
              <>
                <div className="fixed inset-0 z-[200]" onClick={() => setOpenTheme(false)} />
                <div style={{
                  position: 'fixed', bottom: 70, left: collapsed ? W_COL + 8 : W_EXP + 8,
                  zIndex: 201, background: 'var(--bg-card)', border: '1px solid var(--border-glass)',
                  borderRadius: 20, boxShadow: 'var(--shadow-lg)', padding: 6, width: 180,
                  backdropFilter: 'blur(12px)', transition: `left ${TRANS}`,
                }}>
                  <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-muted)', padding: '6px 10px 8px' }}>
                    Temas
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Object.entries(THEMES).map(([key, t]) => {
                      const isActive = theme === key
                      return (
                        <button key={key}
                          onClick={() => { setTheme(key); setOpenTheme(false) }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            width: '100%', padding: '8px 10px', borderRadius: 12,
                            border: 'none', cursor: 'pointer',
                            background: isActive ? 'var(--bg-secondary)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)' }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, background: t.preview[0], border: '2px solid var(--border-glass)' }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, textAlign: 'left', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {t.name}
                          </span>
                          {isActive && (
                            <div style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Check size={10} color="white" strokeWidth={4} />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={() => setConfirmLogout(true)}
            aria-label={collapsed ? 'Cerrar sesión' : undefined}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: collapsed ? 0 : 10, padding: collapsed ? '7px 6px' : '7px 8px',
              borderRadius: 10, justifyContent: collapsed ? 'center' : 'flex-start',
              border: 'none', background: 'transparent', cursor: 'pointer',
              transition: `background 0.15s ease, gap ${TRANS}, padding ${TRANS}`,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-rose) 8%, transparent)'
              if (collapsed) setTooltip({ label: 'Cerrar sesión', top: e.currentTarget.getBoundingClientRect().top + 14 })
            }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; setTooltip(null) }}
          >
            <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LogOut size={15} style={{ color: 'var(--accent-rose)' }} />
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, color: 'var(--accent-rose)',
              whiteSpace: 'nowrap', overflow: 'hidden',
              maxWidth: collapsed ? 0 : 180, opacity: collapsed ? 0 : 1,
              transition: `max-width ${TRANS}, opacity 0.18s ease`,
            }}>
              Cerrar sesión
            </span>
          </button>
        </div>
      </aside>

      <ProfilePanel open={showProfile} onClose={() => setShowProfile(false)} onLogout={() => { setShowProfile(false); setConfirmLogout(true) }} />
      <ConfirmLogoutModal open={confirmLogout} onCancel={() => setConfirmLogout(false)} onConfirm={handleLogout} />
    </>
  )
}