'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import BottomNav from '@/components/layout/BottomNav'
import { Loader2, X, Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

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
  const [navigating, setNavigating] = useState(false)
  const pathname = usePathname()

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

        {/* Header móvil simplificado */}
        <div
          className="lg:hidden flex items-center justify-between px-5 sticky z-50 w-full"
          style={{
            top: 0,
            background: 'var(--bg-primary)',
            paddingTop:    'calc(env(safe-area-inset-top) + 0.75rem)',
            paddingBottom: '0.75rem',
          }}>
          <div className="flex items-center gap-2">
            <img src="/icon.svg" alt="Logo" className="w-8 h-8 rounded-xl" />
            <span className="font-script text-base" style={{ color: 'var(--text-primary)' }}>
              Familia Finanzas
            </span>
          </div>
          {navigating && <Loader2 size={15} className="animate-spin" style={{ color: 'var(--accent-main)' }} />}
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

        {/* FAB desktop */}
        <button
          onClick={() => setFabOpen(true)}
          className="hidden lg:flex fixed bottom-8 right-8 z-[80] w-14 h-14 rounded-full items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
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
