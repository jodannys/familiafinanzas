'use client'
import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { ChevronDown, Loader2, X, Users } from 'lucide-react'
import CustomSelect from '@/components/ui/CustomSelect'

function formatFechaDDMM(fechaStr) {
  if (!fechaStr) return ''
  const d = new Date(fechaStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function FamilyPanel({ anchorRef, onClose, isMobile = false }) {
  const [mounted, setMounted] = useState(false)
  const [miembros, setMiembros] = useState([])
  const [seleccionado, setSeleccionado] = useState('')
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState({ left: 0, bottom: 0 })
  const [hogarId, setHogarId] = useState(null)

  // 1. Montaje y detección de Hogar
  useEffect(() => {
    setMounted(true)
    const getHogar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('perfiles')
          .select('hogar_id')
          .eq('id', user.id)
          .single()
        if (data?.hogar_id) setHogarId(data.hogar_id)
      }
    }
    getHogar()
  }, [])

  // 2. Posicionamiento en Desktop
  useEffect(() => {
    if (!anchorRef?.current || isMobile) return
    const rect = anchorRef.current.getBoundingClientRect()
    setPos({
      left: rect.right + 10,
      bottom: window.innerHeight - rect.bottom - 4,
    })
  }, [anchorRef, isMobile])

  // 3. Cerrar con Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // 4. Cargar Miembros de la familia
  useEffect(() => {
    if (!hogarId) return
    supabase
      .from('perfiles')
      .select('id, nombre')
      .eq('hogar_id', hogarId)
      .order('nombre')
      .then(({ data }) => setMiembros(data || []))
  }, [hogarId])

  // 5. Cargar Movimientos (Lógica de Admin)
  useEffect(() => {
    if (!hogarId) return
    
    setLoading(true)
    const hoy = new Date()
    const desde = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
    
    let q = supabase
      .from('movimientos')
      .select('id, fecha, tipo, categoria, descripcion, monto, quien')
      .eq('hogar_id', hogarId) // Filtro de seguridad por hogar
      .gte('fecha', desde)
      .order('fecha', { ascending: false })
      .limit(50)

    // Si seleccionamos a alguien, filtramos. Si no, vemos "Todos"
    if (seleccionado) {
      q = q.eq('quien', seleccionado)
    }

    q.then(({ data, error }) => {
      if (error) console.error("Error cargando movimientos:", error)
      setMovimientos(data || [])
      setLoading(false)
    })
  }, [seleccionado, hogarId])

  const totalIngresos = movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + (m.monto || 0), 0)
  const totalGastos = movimientos
    .filter(m => m.tipo === 'egreso')
    .reduce((s, m) => s + (m.monto || 0), 0)

  if (!mounted) return null

  const panel = (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 290,
          background: isMobile
            ? 'color-mix(in srgb, var(--bg-dark-card), transparent 50%)'
            : 'transparent',
          backdropFilter: isMobile ? 'blur(5px)' : 'none',
          WebkitBackdropFilter: isMobile ? 'blur(5px)' : 'none',
        }}
      />

      {/* Panel Contenedor */}
      <div
        style={{
          position: 'fixed',
          zIndex: 300,
          ...(isMobile
            ? {
                bottom: 0,
                left: 0,
                right: 0,
                borderRadius: '28px 28px 0 0',
                maxHeight: '85dvh',
                width: '100vw', // Ocupa todo el ancho en móvil
              }
            : {
                left: pos.left,
                bottom: pos.bottom,
                width: 340,
                borderRadius: 20,
                maxHeight: '74dvh',
              }),
          background: 'var(--bg-card)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-2xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: isMobile 
            ? 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)' 
            : 'panel-in 0.22s cubic-bezier(0.34, 1.2, 0.64, 1)',
        }}
      >
        {/* Handle Visual para Móvil */}
        {isMobile && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{
              width: 40, height: 5, borderRadius: 10,
              background: 'color-mix(in srgb, var(--text-muted) 20%, transparent)',
            }} />
          </div>
        )}

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid color-mix(in srgb, var(--border-glass) 40%, transparent)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-blue) 20%, transparent)',
            }}>
              <Users size={18} style={{ color: 'var(--accent-blue)' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                Panel Familiar
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Actividad de {seleccionado || 'la familia'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="hover:scale-110 active:scale-95 transition-transform" style={{
            width: 32, height: 32, borderRadius: 10, border: 'none', background: 'var(--bg-secondary)',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="no-scrollbar" style={{
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {/* Selector */}
          <CustomSelect
            value={seleccionado || null}
            onChange={v => setSeleccionado(v || '')}
            options={miembros.map(m => ({ id: m.nombre, label: m.nombre }))}
            placeholder="Todos los miembros"
            color="var(--accent-main)"
          />

          {/* Resumen KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{
              borderRadius: 18, padding: '14px',
              background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-green) 15%, transparent)',
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-green)', letterSpacing: '0.05em' }}>Ingresos</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{formatCurrency(totalIngresos)}</p>
            </div>
            <div style={{
              borderRadius: 18, padding: '14px',
              background: 'color-mix(in srgb, var(--accent-rose) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-rose) 15%, transparent)',
            }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-rose)', letterSpacing: '0.05em' }}>Gastos</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>{formatCurrency(totalGastos)}</p>
            </div>
          </div>

          {/* Lista de Movimientos */}
          <div style={{
            borderRadius: 20, overflow: 'hidden', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-glass)',
          }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-main)' }} />
              </div>
            ) : movimientos.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sin movimientos este mes</p>
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {movimientos.map((mov, i) => (
                  <li key={mov.id || i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', gap: 12,
                    borderBottom: i < movimientos.length - 1 ? '1px solid color-mix(in srgb, var(--border-glass) 30%, transparent)' : 'none',
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, color: 'var(--text-muted)',
                      background: 'var(--bg-card)', padding: '4px 6px', borderRadius: 6, minWidth: 38, textAlign: 'center'
                    }}>
                      {formatFechaDDMM(mov.fecha)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mov.descripcion || mov.categoria}
                      </p>
                      {!seleccionado && (
                        <p style={{ fontSize: 10, color: 'var(--accent-blue)', fontWeight: 600, marginTop: 1 }}>{mov.quien}</p>
                      )}
                    </div>
                    <p style={{
                      fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap',
                      color: mov.tipo === 'ingreso' ? 'var(--accent-green)' : 'var(--accent-rose)'
                    }}>
                      {mov.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(mov.monto)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Espaciador final para iPhone/Móvil */}
          {isMobile && <div style={{ height: 'max(env(safe-area-inset-bottom), 20px)' }} />}
        </div>
      </div>

      <style>{`
        @keyframes panel-in {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </>
  )

  return createPortal(panel, document.body)
}