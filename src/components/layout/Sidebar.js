'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ArrowLeftRight, Target, TrendingUp, PieChart,
  CreditCard, Wallet, BarChart3, LogOut, CircleDollarSign, Settings2,
  CalendarDays, Home, Menu,
} from 'lucide-react'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'
import { supabase, signOut } from '@/lib/supabase'

const W_EXP = 240
const W_COL = 64

const MENU_GROUPS = [
  {
    title: 'Análisis',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/reportes', label: 'Reporte Anual', icon: BarChart3 },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { href: '/presupuesto', label: 'Presupuesto', icon: PieChart },
      { href: '/gastos', label: 'Registro', icon: ArrowLeftRight },
      { href: '/agenda', label: 'Agenda', icon: CalendarDays },
      { href: '/sobres', label: 'Sobres', icon: Wallet },
    ],
  },
  {
    title: 'Patrimonio',
    items: [
      { href: '/metas', label: 'Metas de Ahorro', icon: Target },
      { href: '/inversiones', label: 'Inversiones', icon: TrendingUp },
      { href: '/deudas', label: 'Deudas', icon: CircleDollarSign, deudaBadge: true },
      { href: '/inmuebles', label: 'Inmuebles', icon: Home },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { href: '/tarjetas', label: 'Mis Tarjetas', icon: CreditCard },
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

  const [deudasAlert, setDeudasAlert] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [nombre, setNombre] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [tooltip, setTooltip] = useState(null)   // { label, top }
  const [indicator, setIndicator] = useState({ top: 8, height: 36, visible: false })

  /* ── Init: auth + deudas + persisted state ── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ff-sidebar-collapsed')
      if (saved !== null) {
        const c = saved === 'true'
        setCollapsed(c)
        document.documentElement.style.setProperty('--sidebar-w', c ? `${W_COL}px` : `${W_EXP}px`)
      }
    } catch { }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setNombre(session?.user?.user_metadata?.nombre || session?.user?.email?.split('@')[0] || '')
    })
    supabase.from('deudas').select('dia_pago').eq('estado', 'activa').then(({ data }) => {
      if (data) setDeudasAlert(data.some(d => {
        const dias = diasHastaPago(d.dia_pago)
        return dias !== null && dias <= 7
      }))
    })
  }, [])

  /* ── Toggle síncrono: CSS var + estado en el mismo frame ── */
  function applyCollapse(next) {
    document.documentElement.style.setProperty('--sidebar-w', next ? `${W_COL}px` : `${W_EXP}px`)
    try { localStorage.setItem('ff-sidebar-collapsed', String(next)) } catch { }
    if (next) setTooltip(null)
    setCollapsed(next)
  }

  useEffect(() => {
    const update = () => {
      // Buscamos el elemento que tiene data-active="true"
      const activeEl = navRef.current?.querySelector('[data-active="true"]')

      if (activeEl && navRef.current) {
        const navRect = navRef.current.getBoundingClientRect()
        const elRect = activeEl.getBoundingClientRect()

        // Buscamos específicamente el contenedor del icono (el div de 34x34) 
        // para que la barrita se alinee con el icono y no con todo el Link
        const iconEl = activeEl.querySelector('div')
        const iconRect = iconEl?.getBoundingClientRect() || elRect

        setIndicator({
          top: iconRect.top - navRect.top + navRef.current.scrollTop,
          height: iconRect.height, // Ahora mide lo mismo que el icono (34px)
          visible: true,
        })
      } else {
        // Si no hay nada activo (o no se encuentra), ocultamos el indicador
        setIndicator(prev => ({ ...prev, visible: false }))
      }
    }

    // Aumentamos a 100ms o 150ms para esperar a que la transición del 
    // ancho del sidebar esté avanzada y las posiciones sean más reales
    const t = setTimeout(update, 150)

    // También escuchamos el evento de resize por si acaso
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(t)
      window.removeEventListener('resize', update)
    }
  }, [pathname, collapsed])

  async function handleLogout() {
    await signOut()
    router.replace('/login')
  }

  const TRANS = '0.3s cubic-bezier(0.4, 0, 0.2, 1)'

  return (
    <>
      {/* ── Tooltip flotante (solo en estado colapsado) ── */}
      {tooltip && collapsed && (
        <div
          className="sidebar-tooltip"
          style={{
            position: 'fixed',
            left: W_COL + 10,
            top: tooltip.top,
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
          }}
        >
          {/* flecha */}
          <span style={{
            position: 'absolute', left: -4, top: '50%',
            transform: 'translateY(-50%)',
            width: 0, height: 0,
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
            borderRight: '4px solid var(--bg-dark-card)',
          }} />
          {tooltip.label}
        </div>
      )}

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
          // 1. Aseguramos que el padding sea simétrico cuando está colapsado
          padding: collapsed ? '20px 0 16px' : '20px 14px 16px',
          display: 'flex',
          alignItems: 'center',
          // 2. Usamos center para colapsado y espacio entre elementos para expandido
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
                Familia Quintero
              </p>
            </div>
          )}


          <button
            onClick={() => applyCollapse(!collapsed)}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              border: 'none',
              background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              flexShrink: 0,
              // 3. Eliminamos márgenes automáticos que puedan moverlo
              margin: collapsed ? '0 auto' : '0',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-main) 12%, transparent)'
              e.currentTarget.style.color = 'var(--accent-main)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'color-mix(in srgb, var(--text-muted) 8%, transparent)'
              e.currentTarget.style.color = 'var(--text-muted)'
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
          // FIX: padding reducido en colapsado para centrar mejor los iconos
          // 64px (W_COL) - 2*6px = 52px → 9px de margen a cada lado del icono de 34px
          padding: collapsed ? '0 6px' : '0 10px',
          position: 'relative',
          transition: `padding ${TRANS}`,
        }}>

          {/* Indicador deslizante de sección activa */}
          {/* Indicador deslizante (Solo se muestra cuando el menú está expandido) */}
          {/* Indicador deslizante (Solo visible en modo expandido) */}
          {indicator.visible && !collapsed && (
            <div style={{
              position: 'absolute',
              left: 0,
              width: 3,
              top: indicator.top,
              height: indicator.height,
              borderRadius: '0 4px 4px 0',
              background: 'var(--accent-main)',
              transition: `all ${TRANS}`, // Usa la misma constante TRANS (0.3s)
              pointerEvents: 'none',
              zIndex: 10,
            }} />
          )}
          {MENU_GROUPS.map((group, gIdx) => (
            <div key={gIdx} style={{ marginTop: gIdx > 0 ? 14 : 4 }}>

              {/* Etiqueta de grupo */}
              <div style={{
                overflow: 'hidden',
                maxHeight: collapsed ? 0 : 24,
                opacity: collapsed ? 0 : 1,
                transition: `max-height ${TRANS}, opacity 0.2s ease`,
                marginBottom: collapsed ? 0 : 4,
              }}>
                <p style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.11em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  opacity: 0.55,
                  padding: '0 6px',
                  whiteSpace: 'nowrap',
                }}>
                  {group.title}
                </p>
              </div>

              {/* Separador en modo colapsado */}
              {collapsed && gIdx > 0 && (
                <div style={{
                  height: 1,
                  margin: '6px 4px 10px',
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
                      style={{
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: collapsed ? 0 : 10,
                        padding: collapsed ? '6px' : '7px 8px',
                        borderRadius: 10,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        background: (!collapsed && active)
                          ? 'color-mix(in srgb, var(--accent-main) 10%, transparent)'
                          : 'transparent',
                        position: 'relative',
                        zIndex: 1,
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
                      {/* Icono */}
                      <div style={{
                        width: 34,
                        height: 34,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 10,
                        flexShrink: 0,
                        position: 'relative',
                        // CAMBIO: En modo colapsado, el icono SIEMPRE tiene su fondo de color
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

                      {/* Label */}
                      <span style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: active ? 'var(--accent-main)' : 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
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
          ))}
        </nav>

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 10px',
          borderTop: '1px solid color-mix(in srgb, var(--border-glass) 40%, transparent)',
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          flexShrink: 0,
        }}>

          {/* Tema */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: collapsed ? 0 : 10,
            padding: collapsed ? '7px 6px' : '7px 8px',
            borderRadius: 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            transition: `gap ${TRANS}, padding ${TRANS}`,
          }}>
            <div style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <ThemeSwitcher />
            </div>
            <span style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
              whiteSpace: 'nowrap', overflow: 'hidden',
              maxWidth: collapsed ? 0 : 180,
              opacity: collapsed ? 0 : 1,
              transition: `max-width ${TRANS}, opacity 0.18s ease`,
            }}>
              Tema
            </span>
          </div>

          {/* Cerrar sesión */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setConfirmLogout(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
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
              <div style={{
                width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
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
                  position: 'absolute', bottom: '100%', left: 0,
                  marginBottom: 8, zIndex: 201,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 16,
                  boxShadow: 'var(--shadow-lg)',
                  padding: '14px 16px',
                  width: 210,
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
    </>
  )
}