'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { Loader2, X, Plus, ArrowUpRight, ArrowDownRight, SlidersHorizontal, LogOut, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { THEMES, useTheme } from '@/lib/themes'

const CATS_EGRESO = [
  { id: 'basicos',   label: 'Necesidades',   color: 'var(--accent-blue)'   },
  { id: 'deseo',     label: 'Estilo de vida',color: 'var(--accent-violet)' },
  { id: 'ahorro',    label: 'Ahorro',        color: 'var(--accent-green)'  },
  { id: 'inversion', label: 'Inversión',     color: 'var(--accent-gold)'   },
  { id: 'deuda',     label: 'Deuda',         color: 'var(--accent-rose)'   },
]

function FABModal({ onClose }) {
  const [tipo,    setTipo]    = useState('egreso')
  const [monto,   setMonto]   = useState('')
  const [cat,     setCat]     = useState('basicos')
  const [desc,    setDesc]    = useState('')
  const [saving,  setSaving]  = useState(false)

  async function guardar() {
    const valor = parseFloat(monto)
    if (!valor || valor <= 0) return
    setSaving(true)
    const hoy = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('movimientos').insert([{
      tipo,
      monto: valor,
      descripcion: desc.trim() || null,
      categoria: tipo === 'ingreso' ? 'ingreso' : cat,
      fecha: hoy,
    }])
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    onClose()
    window.location.reload()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[110]"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[120] rounded-t-3xl"
        style={{
          background: 'var(--bg-card)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)',
        }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-glass)' }} />
        </div>

        <div className="px-5 pb-2 flex items-center justify-between">
          <p className="font-script" style={{ fontSize: 18, color: 'var(--text-primary)' }}>Registrar</p>
          <button onClick={onClose}
            style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-5 space-y-4 pt-2">

          {/* Tipo toggle */}
          <div className="flex gap-2">
            {[
              { id: 'egreso',  label: 'Gasto',   icon: ArrowDownRight, color: 'var(--accent-rose)'  },
              { id: 'ingreso', label: 'Ingreso',  icon: ArrowUpRight,   color: 'var(--accent-green)' },
            ].map(t => (
              <button key={t.id}
                onClick={() => setTipo(t.id)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all"
                style={{
                  background: tipo === t.id
                    ? `color-mix(in srgb, ${t.color} 12%, transparent)`
                    : 'var(--bg-secondary)',
                  color:  tipo === t.id ? t.color : 'var(--text-muted)',
                  border: `1.5px solid ${tipo === t.id ? t.color : 'transparent'}`,
                  cursor: 'pointer',
                }}>
                <t.icon size={15} strokeWidth={2} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Monto */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}>Monto</p>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              autoFocus
              className="ff-input w-full font-serif text-2xl font-bold text-center"
              style={{ color: tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--text-primary)' }}
            />
          </div>

          {/* Categoría (solo egreso) */}
          {tipo === 'egreso' && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--text-muted)' }}>Categoría</p>
              <div className="flex flex-wrap gap-2">
                {CATS_EGRESO.map(c => (
                  <button key={c.id}
                    onClick={() => setCat(c.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={{
                      background: cat === c.id
                        ? `color-mix(in srgb, ${c.color} 15%, transparent)`
                        : 'var(--bg-secondary)',
                      color:  cat === c.id ? c.color : 'var(--text-muted)',
                      border: `1px solid ${cat === c.id ? c.color : 'transparent'}`,
                      cursor: 'pointer',
                    }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)' }}>Descripción <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9 }}>(opcional)</span></p>
            <input
              type="text"
              placeholder="Ej: Supermercado, Nómina..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && guardar()}
              className="ff-input w-full text-sm"
            />
          </div>

          {/* Guardar */}
          <button
            onClick={guardar}
            disabled={!monto || parseFloat(monto) <= 0 || saving}
            className="w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all"
            style={{
              background: !monto || parseFloat(monto) <= 0 ? 'var(--bg-secondary)' : 'var(--text-primary)',
              color:      !monto || parseFloat(monto) <= 0 ? 'var(--text-muted)'    : 'var(--bg-card)',
              border: 'none', cursor: monto && parseFloat(monto) > 0 ? 'pointer' : 'not-allowed',
            }}>
            {saving
              ? <Loader2 size={16} className="animate-spin" />
              : <><Plus size={15} /> Registrar</>
            }
          </button>

        </div>
      </div>
    </>
  )
}

export default function AppShell({ children }) {
  const [fabOpen,    setFabOpen]    = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [navigating, setNavigating] = useState(false)
  const pathname   = usePathname()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setNavigating(true)
    const t = setTimeout(() => setNavigating(false), 400)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* Sidebar — solo desktop */}
      <div className="hidden lg:block fixed left-0 top-0 h-full z-[70]">
        <Sidebar />
      </div>

      {/* Main */}
      <main
        className="flex-1 min-h-screen lg:ml-20 flex flex-col overflow-x-hidden"
        style={{ background: 'var(--bg-primary)' }}>

        {/* Header móvil */}
        <div className="lg:hidden sticky top-0 z-50 w-full" style={{ background: 'var(--bg-primary)' }}>
          <div
            className="flex items-center justify-between px-5"
            style={{
              paddingTop:    'calc(env(safe-area-inset-top) + 0.75rem)',
              paddingBottom: '0.75rem',
            }}>
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
              <span className="font-script text-base" style={{ color: 'var(--text-primary)' }}>
                Familia Finanzas
              </span>
            </div>

            <div className="flex items-center gap-2">
              {navigating && <Loader2 size={15} className="animate-spin" style={{ color: 'var(--accent-main)' }} />}
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90"
                style={{
                  background: menuOpen ? 'var(--bg-card)' : 'transparent',
                  border: '1px solid var(--border-glass)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}>
                <SlidersHorizontal size={16} />
              </button>
            </div>
          </div>

          {/* Dropdown */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-[59]" onClick={() => setMenuOpen(false)} />
              <div
                className="absolute right-4 z-[60] rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  top: 'calc(100% + 4px)',
                  width: 200,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-glass)',
                }}>
                <p className="px-4 pt-3 pb-2 text-[9px] font-black uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Tema</p>
                <div className="px-2 pb-2 space-y-0.5">
                  {Object.entries(THEMES).map(([key, t]) => {
                    const active = theme === key
                    return (
                      <button key={key}
                        onClick={() => { setTheme(key); setMenuOpen(false) }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-all"
                        style={{
                          background: active ? 'var(--bg-secondary)' : 'transparent',
                          border: 'none', cursor: 'pointer',
                        }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                          background: t.preview[0], border: '2px solid var(--border-glass)',
                        }} />
                        <span className="flex-1 text-left text-xs font-bold"
                          style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {t.name}
                        </span>
                        {active && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--accent-green)' }}>
                            <Check size={9} color="white" strokeWidth={4} />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="mx-2 mb-2 mt-1 pt-2" style={{ borderTop: '1px solid var(--border-glass)' }}>
                  <button
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      color: 'var(--accent-rose)', background: 'transparent',
                      border: 'none', cursor: 'pointer',
                    }}>
                    <LogOut size={14} />
                    <span className="text-xs font-bold">Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Barra de progreso desktop */}
        {navigating && (
          <div className="fixed top-0 left-0 right-0 z-[200] h-0.5" style={{ background: 'var(--accent-main)' }}>
            <div className="h-full" style={{
              background: `linear-gradient(90deg, transparent, var(--accent-main), transparent)`,
              animation: 'progress-bar 0.4s ease-out forwards',
            }} />
          </div>
        )}

        {/* Fondo decorativo */}
        <div className="fixed inset-0 lg:ml-20 pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-5%', right: '-5%',
            width: '600px', height: '600px',
            background: 'radial-gradient(circle, var(--accent-main) 0%, transparent 70%)',
            opacity: 0.07,
          }} />
        </div>

        {/* FAB móvil — encima del BottomNav */}
        <button
          onClick={() => setFabOpen(true)}
          className="lg:hidden flex fixed right-5 z-[80] w-14 h-14 rounded-full items-center justify-center shadow-2xl active:scale-95 transition-transform"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom) + 76px)',
            background: 'var(--accent-green)', color: 'white', border: 'none', cursor: 'pointer',
          }}>
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* FAB desktop */}
        <button
          onClick={() => setFabOpen(true)}
          className="hidden lg:flex fixed bottom-8 right-8 z-[80] w-14 h-14 rounded-full items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform"
          style={{ background: 'var(--accent-green)', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={24} strokeWidth={2.5} />
        </button>

        {/* Contenido */}
        <div className="relative z-10 p-4 md:p-10 lg:p-12 max-w-[1600px] mx-auto w-full flex-1 pb-24 lg:pb-12">
          {children}
        </div>
      </main>

      {/* Bottom Nav — solo móvil */}
      <BottomNav onFABClick={() => setFabOpen(true)} />

      {/* FAB Modal */}
      {fabOpen && <FABModal onClose={() => setFabOpen(false)} />}
    </div>
  )
}
