'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import Modal from '@/components/ui/Modal'
import {
  ChevronLeft, ChevronRight, Plus, Loader2, Trash2, Pencil,
  Check, CalendarDays, List, Bell, CreditCard, Target, StickyNote,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme, getThemeColors } from '@/lib/themes'
import { formatCurrency } from '@/lib/utils'

const TIPOS = [
  { id: 'recordatorio', label: 'Recordatorio', color: 'var(--accent-terra)',  Icon: Bell },
  { id: 'pago',         label: 'Pago',         color: 'var(--accent-rose)',   Icon: CreditCard },
  { id: 'meta',         label: 'Meta',         color: 'var(--accent-green)',  Icon: Target },
  { id: 'nota',         label: 'Nota libre',   color: 'var(--accent-blue)',   Icon: StickyNote },
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function pad(n) { return String(n).padStart(2, '0') }

function toFechaStr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}` }

function construirCalendario(año, mes) {
  const primerDia = new Date(año, mes, 1)
  const ultimoDia = new Date(año, mes + 1, 0).getDate()
  let inicioSemana = primerDia.getDay() - 1
  if (inicioSemana < 0) inicioSemana = 6

  const semanas = []
  let semana = []

  for (let i = 0; i < inicioSemana; i++) {
    const d = new Date(año, mes, 1 - inicioSemana + i)
    semana.push({ fecha: toFechaStr(d.getFullYear(), d.getMonth(), d.getDate()), dia: d.getDate(), esMes: false })
  }
  for (let d = 1; d <= ultimoDia; d++) {
    semana.push({ fecha: toFechaStr(año, mes, d), dia: d, esMes: true })
    if (semana.length === 7) { semanas.push(semana); semana = [] }
  }
  let nextDay = 1
  while (semana.length > 0 && semana.length < 7) {
    const d = new Date(año, mes + 1, nextDay++)
    semana.push({ fecha: toFechaStr(d.getFullYear(), d.getMonth(), d.getDate()), dia: d.getDate(), esMes: false })
  }
  if (semana.length > 0) semanas.push(semana)
  while (semanas.length < 6) {
    const fila = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(año, mes + 1, nextDay++)
      fila.push({ fecha: toFechaStr(d.getFullYear(), d.getMonth(), d.getDate()), dia: d.getDate(), esMes: false })
    }
    semanas.push(fila)
  }
  return semanas
}

function formatFechaRelativa(fechaStr) {
  const hoy = new Date()
  const hoyStr = toFechaStr(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const man = new Date(hoy); man.setDate(man.getDate() + 1)
  const manStr = toFechaStr(man.getFullYear(), man.getMonth(), man.getDate())
  if (fechaStr === hoyStr) return 'Hoy'
  if (fechaStr === manStr) return 'Mañana'
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function AgendaPage() {
  const hoy = new Date()
  const [año, setAño] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth())
  const [vista, setVista] = useState('mes')
  const [diaSeleccionado, setDiaSeleccionado] = useState(
    toFechaStr(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  )
  const [notas, setNotas] = useState([])
  const [deudasData, setDeudasData] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editingNota, setEditingNota] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ titulo: '', fecha: '', tipo: 'recordatorio', color: 'var(--accent-terra)' })
  const { theme } = useTheme()
  const themeColors = getThemeColors(theme)

  const hoyStr = toFechaStr(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  useEffect(() => { cargar() }, [año, mes])

  async function cargar() {
    setLoading(true)
    const diasMes = new Date(año, mes + 1, 0).getDate()
    const desde = `${año}-${pad(mes + 1)}-01`
    const hasta = `${año}-${pad(mes + 1)}-${pad(diasMes)}`
    const [{ data: nd }, { data: dd }] = await Promise.all([
      supabase.from('agenda_notas').select('*').gte('fecha', desde).lte('fecha', hasta).order('fecha'),
      supabase.from('deudas').select('id,nombre,emoji,dia_pago,cuota,color,fecha_primer_pago,plazo_meses').eq('estado', 'activa'),
    ])
    setNotas(nd || [])
    setDeudasData(dd || [])
    setLoading(false)
  }

  // Eventos automáticos desde deudas (no se guardan en BD)
  const eventosDeudas = (deudasData || []).flatMap(d => {
    if (d.fecha_primer_pago) {
      const [fpAño, fpMes] = d.fecha_primer_pago.split('-').map(Number)
      const currentIdx = año * 12 + mes
      const startIdx = fpAño * 12 + (fpMes - 1)
      if (currentIdx < startIdx) return []
      if (d.plazo_meses) {
        const endIdx = startIdx + d.plazo_meses - 1
        if (currentIdx > endIdx) return []
      }
    }
    const diasMes = new Date(año, mes + 1, 0).getDate()
    const dia = Math.min(d.dia_pago || 1, diasMes)
    return [{
      id: `auto-${d.id}`,
      fecha: toFechaStr(año, mes, dia),
      titulo: `${d.emoji || '💳'} ${d.nombre}`,
      tipo: 'pago',
      color: d.color || 'var(--accent-rose)',
      completado: false,
      _auto: true,
      _cuota: d.cuota,
    }]
  })

  const todasNotas = [...notas, ...eventosDeudas]

  const notasPorFecha = todasNotas.reduce((acc, n) => {
    if (!acc[n.fecha]) acc[n.fecha] = []
    acc[n.fecha].push(n)
    return acc
  }, {})

  const notasDia = notasPorFecha[diaSeleccionado] || []

  const semanas = construirCalendario(año, mes)

  // Semana que contiene el día seleccionado
  const semanaSeleccionada = semanas.find(s => s.some(c => c.fecha === diaSeleccionado)) || semanas[0]

  function navMes(delta) {
    let nm = mes + delta, na = año
    if (nm < 0) { nm = 11; na-- }
    if (nm > 11) { nm = 0; na++ }
    setMes(nm); setAño(na)
  }

  function navSemana(delta) {
    const [y, m, d] = diaSeleccionado.split('-').map(Number)
    const fecha = new Date(y, m - 1, d)
    fecha.setDate(fecha.getDate() + delta * 7)
    setDiaSeleccionado(toFechaStr(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
    setMes(fecha.getMonth())
    setAño(fecha.getFullYear())
  }

  function renderNota(nota) {
    const tipo = TIPOS.find(t => t.id === nota.tipo) || TIPOS[3]
    return (
      <div key={nota.id} className="flex items-center gap-3 px-4 py-3">
        {nota._auto ? (
          <div className="flex-shrink-0 flex items-center justify-center rounded-xl"
            style={{
              width: 28, height: 28,
              background: `color-mix(in srgb, ${nota.color} 18%, transparent)`,
              border: `1.5px solid color-mix(in srgb, ${nota.color} 35%, transparent)`,
            }}>
            <CreditCard size={13} style={{ color: nota.color }} />
          </div>
        ) : (
          <button type="button" onClick={() => handleToggle(nota)}
            className="flex-shrink-0 flex items-center justify-center rounded-lg transition-all"
            style={{
              width: 28, height: 28, cursor: 'pointer',
              background: nota.completado
                ? `color-mix(in srgb, ${nota.color} 20%, transparent)`
                : `color-mix(in srgb, ${nota.color} 8%, transparent)`,
              border: `1.5px solid color-mix(in srgb, ${nota.color} 30%, transparent)`,
            }}>
            {nota.completado && <Check size={13} style={{ color: nota.color }} />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{
            color: 'var(--text-primary)',
            textDecoration: nota.completado ? 'line-through' : 'none',
            opacity: nota.completado ? 0.45 : 1,
          }}>
            {nota.titulo}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
              padding: '2px 7px', borderRadius: 999,
              background: `color-mix(in srgb, ${tipo.color} 12%, transparent)`,
              color: tipo.color,
            }}>
              {nota._auto ? '⚡ Auto · ' : ''}{tipo.label}
            </span>
            {nota._cuota > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {formatCurrency(nota._cuota)}
              </span>
            )}
          </div>
        </div>
        {!nota._auto && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => abrirModalEditar(nota)}
              style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
              <Pencil size={13} />
            </button>
            <button onClick={() => handleDelete(nota)}
              style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-rose)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>
    )
  }

  function abrirModalNueva() {
    setEditingNota(null)
    setForm({ titulo: '', fecha: diaSeleccionado, tipo: 'recordatorio', color: 'var(--accent-terra)' })
    setModal(true)
  }

  function abrirModalEditar(nota) {
    setEditingNota(nota)
    setForm({ titulo: nota.titulo, fecha: nota.fecha, tipo: nota.tipo, color: nota.color })
    setModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { titulo: form.titulo, fecha: form.fecha, tipo: form.tipo, color: form.color }
    if (editingNota) {
      const { error } = await supabase.from('agenda_notas').update(payload).eq('id', editingNota.id)
      if (!error) { setNotas(prev => prev.map(n => n.id === editingNota.id ? { ...n, ...payload } : n)); cerrarModal() }
    } else {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.from('agenda_notas')
        .insert([{ ...payload, completado: false, user_id: session.user.id }]).select()
      if (!error) { setNotas(prev => [...prev, data[0]]); cerrarModal() }
    }
    setSaving(false)
  }

  async function handleToggle(nota) {
    if (nota._auto) return
    const v = !nota.completado
    setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, completado: v } : n))
    await supabase.from('agenda_notas').update({ completado: v }).eq('id', nota.id)
  }

  async function handleDelete(nota) {
    if (nota._auto) return
    await supabase.from('agenda_notas').delete().eq('id', nota.id)
    setNotas(prev => prev.filter(n => n.id !== nota.id))
  }

  function cerrarModal() { setModal(false); setEditingNota(null) }

  const filasVista = vista === 'mes' ? semanas : [semanaSeleccionada]

  return (
    <AppShell>
   
      <div className="flex items-center justify-between gap-3 mb-6 animate-enter">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Módulo</p>
          <h1 className="text-xl tracking-tight" style={{ color: 'var(--text-primary)' }}>Agenda</h1>
        </div>
       
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-secondary)' }}>
            {[{ id: 'mes', Icon: CalendarDays }, { id: 'semana', Icon: List }].map(({ id, Icon }) => (
              <button key={id} onClick={() => setVista(id)}
                className="flex items-center justify-center rounded-lg transition-all"
                style={{
                  width: 32, height: 32, border: 'none', cursor: 'pointer',
                  background: vista === id ? 'var(--bg-card)' : 'transparent',
                  color: vista === id ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: vista === id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
      </div>


      {/* Nav mes / semana */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={() => vista === 'mes' ? navMes(-1) : navSemana(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {vista === 'mes' ? `${MESES[mes]} ${año}` : (() => {
            const ini = semanaSeleccionada[0]
            const fin = semanaSeleccionada[6]
            const [iy, im, id] = ini.fecha.split('-').map(Number)
            const [fy, fm, fd] = fin.fecha.split('-').map(Number)
            const fIni = new Date(iy, im - 1, id).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
            const fFin = new Date(fy, fm - 1, fd).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
            return `${fIni} — ${fFin}`
          })()}
        </p>
        <button onClick={() => vista === 'mes' ? navMes(1) : navSemana(1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 6 }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {vista === 'mes' ? (
        <>
          {/* Calendario mensual */}
          <div className="rounded-[24px] overflow-hidden mb-4 animate-enter"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
            <div className="grid grid-cols-7 px-2 pt-3 pb-1">
              {DIAS_SEMANA.map(d => (
                <div key={d} className="text-center"
                  style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {d}
                </div>
              ))}
            </div>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-green)' }} />
              </div>
            ) : (
              <div className="px-2 pb-3">
                {semanas.map((semana, si) => (
                  <div key={si} className="grid grid-cols-7">
                    {semana.map((celda) => {
                      const notasCelda = notasPorFecha[celda.fecha] || []
                      const tiposPresentes = [...new Set(notasCelda.map(n => n.tipo))]
                        .map(tid => TIPOS.find(t => t.id === tid)).filter(Boolean)
                      const esHoy = celda.fecha === hoyStr
                      const esSel = celda.fecha === diaSeleccionado
                      return (
                        <button key={celda.fecha} onClick={() => setDiaSeleccionado(celda.fecha)}
                          className="flex flex-col items-center py-1.5 rounded-xl transition-all active:scale-95"
                          style={{
                            background: esSel ? 'color-mix(in srgb, var(--accent-green) 15%, var(--bg-card))' : 'transparent',
                            border: esSel ? '1.5px solid color-mix(in srgb, var(--accent-green) 35%, transparent)' : '1.5px solid transparent',
                            opacity: celda.esMes ? 1 : 0.28, cursor: 'pointer', minHeight: 48,
                          }}>
                          <span style={{
                            fontSize: 13, lineHeight: 1.3,
                            fontWeight: esHoy ? 900 : esSel ? 700 : 400,
                            color: esHoy ? 'var(--accent-green)' : 'var(--text-primary)',
                          }}>
                            {celda.dia}
                          </span>
                          <div className="flex items-center gap-0.5 mt-0.5" style={{ minHeight: 9 }}>
                            {tiposPresentes.slice(0, 4).map(t => (
                              <t.Icon key={t.id} size={8} style={{ color: t.color, flexShrink: 0 }} />
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-center gap-4 px-4 pb-3 flex-wrap">
              {TIPOS.map(t => (
                <div key={t.id} className="flex items-center gap-1">
                  <t.Icon size={9} style={{ color: t.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)' }}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel día seleccionado */}
          <div className="rounded-[24px] overflow-hidden animate-enter"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
            <div className="flex items-center justify-between px-5 py-3.5"
              style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <div>
                <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--text-muted)' }}>
                  {formatFechaRelativa(diaSeleccionado).toUpperCase().split(',')[0]}
                </p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {formatFechaRelativa(diaSeleccionado)}
                </p>
              </div>
              <button onClick={abrirModalNueva}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all active:scale-95"
                style={{ background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)', color: 'var(--accent-green)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                <Plus size={14} /> Agregar
              </button>
            </div>
            {notasDia.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CalendarDays size={26} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
                <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>Sin eventos para este día</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'var(--border-glass)' }}>
                {notasDia.map(nota => renderNota(nota))}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Vista semana — lista vertical */
        <div className="rounded-[24px] overflow-hidden animate-enter"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-green)' }} />
            </div>
          ) : semanaSeleccionada.map((celda, idx) => {
            const notasCelda = notasPorFecha[celda.fecha] || []
            const esHoy = celda.fecha === hoyStr
            const [cy, cm, cd] = celda.fecha.split('-').map(Number)
            const nombreDia = new Date(cy, cm - 1, cd).toLocaleDateString('es-ES', { weekday: 'long' })
            return (
              <div key={celda.fecha}
                style={{ borderBottom: idx < 6 ? '1px solid var(--border-glass)' : 'none' }}>
                {/* Cabecera del día */}
                <div className="flex items-center justify-between px-5 py-3"
                  style={{
                    background: esHoy ? 'color-mix(in srgb, var(--accent-green) 5%, transparent)' : 'transparent',
                  }}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center rounded-xl flex-shrink-0"
                      style={{
                        width: 34, height: 34,
                        background: esHoy ? 'var(--accent-green)' : 'color-mix(in srgb, var(--text-muted) 10%, transparent)',
                      }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: esHoy ? '#fff' : 'var(--text-primary)', lineHeight: 1 }}>
                        {cd}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: esHoy ? 'var(--accent-green)' : 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {nombreDia}{esHoy ? ' · Hoy' : ''}
                      </p>
                      {notasCelda.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {[...new Set(notasCelda.map(n => n.tipo))]
                            .map(tid => TIPOS.find(t => t.id === tid)).filter(Boolean)
                            .map(t => <t.Icon key={t.id} size={9} style={{ color: t.color }} />)}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => { setDiaSeleccionado(celda.fecha); abrirModalNueva() }}
                    className="flex items-center justify-center rounded-xl transition-all active:scale-90"
                    style={{ width: 28, height: 28, background: 'color-mix(in srgb, var(--accent-green) 10%, transparent)', color: 'var(--accent-green)', border: 'none', cursor: 'pointer' }}>
                    <Plus size={14} />
                  </button>
                </div>

                {/* Eventos del día */}
                {notasCelda.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-glass)' }}>
                    {notasCelda.map(nota => renderNota(nota))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nueva / editar nota */}
      <Modal open={modal} onClose={cerrarModal} title={editingNota ? 'Editar nota' : 'Nueva nota'} size="sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="ff-label">Título</label>
            <input className="ff-input" type="text" placeholder="¿Qué necesitas recordar?" required autoFocus
              value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
          </div>

          <div>
            <label className="ff-label">Fecha</label>
            <input className="ff-input" type="date" required
              value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
          </div>

          <div>
            <label className="ff-label">Tipo</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {TIPOS.map(t => (
                <button type="button" key={t.id}
                  onClick={() => setForm({ ...form, tipo: t.id, color: t.color })}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: form.tipo === t.id
                      ? `color-mix(in srgb, ${t.color} 14%, transparent)`
                      : `color-mix(in srgb, ${t.color} 5%, transparent)`,
                    border: `1.5px solid ${form.tipo === t.id
                      ? `color-mix(in srgb, ${t.color} 40%, transparent)`
                      : `color-mix(in srgb, ${t.color} 15%, transparent)`}`,
                    color: t.color, cursor: 'pointer',
                  }}>
                  <t.Icon size={14} />
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="ff-label">Color personalizado</label>
            <div className="flex gap-2.5 flex-wrap mt-1">
              {themeColors.map(c => (
                <button type="button" key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c, border: 'none', cursor: 'pointer',
                    outline: form.color === c ? `3px solid ${c}` : 'none',
                    outlineOffset: 2, opacity: form.color === c ? 1 : 0.5,
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={cerrarModal} className="ff-btn-ghost flex-1">Cancelar</button>
            <button type="submit" disabled={saving} className="ff-btn-primary flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Guardando...' : editingNota ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>
    </AppShell>
  )
}
