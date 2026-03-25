'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

function pad(n) { return String(n).padStart(2, '0') }

function formatFechaCorta(fechaStr) {
  const hoy = new Date()
  const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
  const man = new Date(hoy); man.setDate(man.getDate() + 1)
  const manStr = `${man.getFullYear()}-${pad(man.getMonth() + 1)}-${pad(man.getDate())}`
  if (fechaStr === hoyStr) return 'Hoy'
  if (fechaStr === manStr) return 'Mañana'
  const [y, m, d] = fechaStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function AgendaWidget() {
  const [eventos, setEventos] = useState([])

  useEffect(() => {
    async function cargar() {
      const hoy = new Date()
      const hoyStr = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`
      const en7 = new Date(hoy); en7.setDate(en7.getDate() + 7)
      const en7Str = `${en7.getFullYear()}-${pad(en7.getMonth() + 1)}-${pad(en7.getDate())}`

      const [{ data: notas, error: e1 }, { data: deudas, error: e2 }] = await Promise.all([
        supabase.from('agenda_notas').select('*')
          .gte('fecha', hoyStr).lte('fecha', en7Str)
          .eq('completado', false).order('fecha').limit(5),
        supabase.from('deudas').select('id,nombre,emoji,dia_pago,cuota,color,fecha_primer_pago,plazo_meses').eq('estado', 'activa'),
      ])
      if (e1 || e2) return

      // Eventos automáticos de deudas en los próximos 7 días
      const añoHoy = hoy.getFullYear()
      const mesHoy = hoy.getMonth() // 0-indexed
      const eventosDeudas = (deudas || []).flatMap(d => {
        if (d.fecha_primer_pago) {
          const [fpAño, fpMes] = d.fecha_primer_pago.split('-').map(Number)
          const currentIdx = añoHoy * 12 + mesHoy
          const startIdx = fpAño * 12 + (fpMes - 1)
          if (currentIdx < startIdx) return []
          if (d.plazo_meses) {
            const endIdx = startIdx + d.plazo_meses - 1
            if (currentIdx > endIdx) return []
          }
        }
        const diasMes = new Date(añoHoy, mesHoy + 1, 0).getDate()
        const dia = Math.min(d.dia_pago || 1, diasMes)
        const fecha = `${añoHoy}-${pad(mesHoy + 1)}-${pad(dia)}`
        if (fecha >= hoyStr && fecha <= en7Str) {
          return [{
            id: `auto-${d.id}`,
            fecha,
            titulo: `${d.emoji || '💳'} ${d.nombre}`,
            color: d.color || 'var(--accent-rose)',
            _cuota: d.cuota,
            _auto: true,
          }]
        }
        return []
      })

      const todos = [...(notas || []), ...eventosDeudas]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(0, 5)

      setEventos(todos)
    }
    cargar()
  }, [])

  return (
    <div className="flex flex-col rounded-[28px] overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-glass)' }}>

      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid var(--border-glass)' }}>
        <div className="flex items-center gap-2">
          <CalendarDays size={12} style={{ color: 'var(--text-muted)' }} />
          <p style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'var(--text-muted)' }}>
            Próximos eventos
          </p>
        </div>
        <Link href="/agenda" style={{ color: 'var(--text-muted)', display: 'flex' }}>
          <ChevronRight size={14} />
        </Link>
      </div>

      <div className="flex-1">
        {eventos.length === 0 ? (
          <p className="text-center text-xs italic py-8" style={{ color: 'var(--text-muted)' }}>
            Sin eventos esta semana
          </p>
        ) : eventos.map((ev, idx) => (
          <div key={ev.id} className="flex items-center gap-3 px-5 py-2.5"
            style={{ borderBottom: idx < eventos.length - 1 ? '1px solid var(--border-glass)' : 'none' }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: ev.color, flexShrink: 0,
            }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {ev.titulo}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {formatFechaCorta(ev.fecha)}
              </p>
            </div>
            {ev._cuota > 0 && (
              <span style={{ fontSize: 11, fontWeight: 900, flexShrink: 0, color: 'var(--text-primary)' }}>
                {formatCurrency(ev._cuota)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid var(--border-glass)' }}>
        <Link href="/agenda"
          className="flex items-center justify-center gap-1.5 py-3"
          style={{ textDecoration: 'none', color: 'var(--accent-green)', fontSize: 11, fontWeight: 700 }}>
          Ver agenda completa
          <ChevronRight size={12} />
        </Link>
      </div>
    </div>
  )
}
