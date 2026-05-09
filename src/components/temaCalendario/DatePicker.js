import { useState } from "react";

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function formatLabel(v) {
  if (!v) return null;
  const [y, m, d] = v.split('-');
  return `${d} / ${m} / ${y}`;
}

export default function DatePicker({ value, onChange, placeholder = 'Fecha' }) {
  const today = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD'

  const base = value || today;
  const [y, m] = base.split('-').map(Number);

  const [open, setOpen] = useState(false);
  const [dispYear, setDispYear] = useState(y);
  const [dispMonth, setDispMonth] = useState(m - 1);

  // Sincronizar año/mes si value cambia desde fuera
  // (opcional, útil si el padre resetea el valor)

  const firstDay = new Date(dispYear, dispMonth, 1).getDay();
  const daysInMonth = new Date(dispYear, dispMonth + 1, 0).getDate();

  function navMes(year, month) {
    setDispYear(year);
    setDispMonth(month);
  }

  function selectDate(date) {
    onChange(date);   // <- llama directamente a la prop, nada de eval
    setOpen(false);
  }

  function seleccionarHoy() {
    selectDate(today);
  }

  const prevM = dispMonth === 0 ? 11 : dispMonth - 1;
  const prevY = dispMonth === 0 ? dispYear - 1 : dispYear;
  const nextM = dispMonth === 11 ? 0 : dispMonth + 1;
  const nextY = dispMonth === 11 ? dispYear + 1 : dispYear;

  // Celdas del calendario
  const blanks = Array.from({ length: firstDay });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <>
      {/* Trigger */}
      <div
        onClick={() => setOpen(true)}
        className="custom-select-trigger"   // <-- tu clase CSS de ff-input o similar
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 14px', border: '2px solid var(--border)',
          borderRadius: 10, background: 'white', cursor: 'pointer',
          fontSize: 15, color: value ? 'var(--text)' : 'var(--muted)'
        }}
      >
        <span>{formatLabel(value) || placeholder}</span>
        {/* Icono calendario */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>

      {/* Overlay / Modal */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20
          }}
        >
          <div style={{
            background: 'white', borderRadius: 20, width: '100%', maxWidth: 320,
            padding: '20px 18px 16px',
            boxShadow: '0 20px 60px rgba(15,23,42,0.25)'
          }}>

            {/* Nav mes */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <button onClick={() => navMes(prevY, prevM)} style={btnNavStyle}>‹</button>
              <span style={{ fontWeight: 700, fontSize: 15 }}>
                {MESES[dispMonth]} {dispYear}
              </span>
              <button onClick={() => navMes(nextY, nextM)} style={btnNavStyle}>›</button>
            </div>

            {/* Cabecera días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
              {DIAS.map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '4px 0' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grilla días */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1 }}>
              {blanks.map((_, i) => <div key={`b${i}`} />)}
              {days.map(d => {
                const ds = `${dispYear}-${String(dispMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const sel = ds === value;
                const isToday = ds === today;
                return (
                  <div
                    key={d}
                    onClick={() => selectDate(ds)}
                    style={{
                      aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '50%', cursor: 'pointer', fontSize: 13.5,
                      fontWeight: sel || isToday ? 700 : 400,
                      background: sel ? 'var(--primary)' : 'transparent',
                      color: sel ? 'white' : isToday ? 'var(--primary)' : 'var(--text)',
                      outline: isToday && !sel ? '2px solid var(--primary)' : 'none',
                      outlineOffset: -1
                    }}
                  >
                    {d}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <button onClick={seleccionarHoy} style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', border: 'none', background: 'none', cursor: 'pointer' }}>
                Hoy
              </button>
              <button onClick={() => setOpen(false)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', border: 'none', background: 'none', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

const btnNavStyle = {
  width: 34, height: 34, border: 'none', background: '#f1f5f9',
  borderRadius: '50%', cursor: 'pointer', fontSize: 18, color: '#475569',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};