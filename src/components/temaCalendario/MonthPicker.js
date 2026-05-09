import { useState, useRef, useEffect } from "react";

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

function formatLabel(v) {
  if (!v || !v.includes('-')) return null;
  const [y, m] = v.split('-');
  if (!y || !m) return null;
  return `${MESES[parseInt(m) - 1]} ${y}`;
}

export default function MonthPicker({ value, onChange, placeholder = 'Seleccionar mes' }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const initYear  = value ? parseInt(value.split('-')[0]) : today.getFullYear();
  const initMonth = value ? parseInt(value.split('-')[1]) - 1 : today.getMonth();

  const [open, setOpen]           = useState(false);
  const [selMonth, setSelMonth]   = useState(initMonth);
  const [selYear, setSelYear]     = useState(initYear);

  const yearListRef  = useRef(null);
  const monthListRef = useRef(null);

  const YEARS = Array.from({ length: 30 }, (_, i) => today.getFullYear() - 5 + i);
  const ITEM_H = 40;

  // Scroll al año/mes seleccionado al abrir
  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      if (yearListRef.current) {
        const idx = YEARS.indexOf(selYear);
        yearListRef.current.scrollTop = idx * ITEM_H - ITEM_H * 2;
      }
      if (monthListRef.current) {
        monthListRef.current.scrollTop = selMonth * ITEM_H - ITEM_H * 2;
      }
    }, 50);
  }, [open]);

  function confirm() {
    const ms = `${selYear}-${String(selMonth + 1).padStart(2, '0')}`;
    onChange(ms);
    setOpen(false);
  }

  function handleOpen() {
    // Sincronizar con value actual al abrir
    if (value && value.includes('-')) {
      setSelYear(parseInt(value.split('-')[0]));
      setSelMonth(parseInt(value.split('-')[1]) - 1);
    }
    setOpen(true);
  }

  return (
    <>
      {/* Trigger */}
      <div
        onClick={handleOpen}
        className="ff-input"
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none' }}
      >
        <span style={{ opacity: value ? 1 : 0.4 }}>
          {formatLabel(value) || placeholder}
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity:0.4, flexShrink:0, marginLeft:8 }}>
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
      </div>

      {/* Overlay */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position:'fixed', inset:0,
         background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)',
            zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center',
            padding:20
          }}
        >
          <div style={{
            background:'var(--input-bg, var(--bg-secondary))',
            border:'1px solid var(--border-glass)',
            borderRadius:20, width:'100%', maxWidth:300,
            padding:'20px 18px 16px',
            boxShadow:'0 20px 60px rgba(15,23,42,0.25)'
          }}>

            {/* Título */}
            <p style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)', marginBottom:14, textAlign:'center' }}>
              Selecciona mes y año
            </p>

            {/* Dos columnas scrolleables */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>

              {/* Meses */}
              <div>
                <p style={{ fontSize:10, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6, textAlign:'center' }}>Mes</p>
                <div
                  ref={monthListRef}
                  style={{ height: ITEM_H * 5, overflowY:'auto', borderRadius:12, border:'1px solid var(--border-glass)', scrollbarWidth:'none' }}
                >
                  {MESES.map((mes, i) => {
                    const sel = i === selMonth;
                    return (
                      <div
                        key={i}
                        onClick={() => setSelMonth(i)}
                        style={{
                          height: ITEM_H, display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:13, fontWeight: sel ? 700 : 400,
                          cursor:'pointer',
                          background: sel ? 'var(--accent-main)' : 'transparent',
                          color: sel ? 'white' : 'var(--text-secondary)',
                          borderRadius: sel ? 10 : 0,
                          transition:'all 0.15s ease'
                        }}
                      >
                        {mes}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Años */}
              <div>
                <p style={{ fontSize:10, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:6, textAlign:'center' }}>Año</p>
                <div
                  ref={yearListRef}
                  style={{ height: ITEM_H * 5, overflowY:'auto', borderRadius:12, border:'1px solid var(--border-glass)', scrollbarWidth:'none' }}
                >
                  {YEARS.map(y => {
                    const sel = y === selYear;
                    return (
                      <div
                        key={y}
                        onClick={() => setSelYear(y)}
                        style={{
                          height: ITEM_H, display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:13, fontWeight: sel ? 700 : 400,
                          cursor:'pointer',
                          background: sel ? 'var(--accent-main)' : 'transparent',
                          color: sel ? 'white' : 'var(--text-secondary)',
                          borderRadius: sel ? 10 : 0,
                          transition:'all 0.15s ease'
                        }}
                      >
                        {y}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Preview */}
            <div style={{ textAlign:'center', marginBottom:14, fontSize:14, fontWeight:700, color:'var(--accent-main)' }}>
              {MESES[selMonth]} {selYear}
            </div>

            {/* Footer */}
            <div style={{ display:'flex', gap:8 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  flex:1, padding:'10px 0', borderRadius:12, border:'1px solid var(--border-glass)',
                  background:'transparent', color:'var(--text-muted)', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>
                Cancelar
              </button>
              <button
                onClick={confirm}
                style={{
                  flex:2, padding:'10px 0', borderRadius:12, border:'none',
                  background:'var(--accent-main)', color:'white', fontSize:13, fontWeight:700, cursor:'pointer'
                }}>
                Confirmar
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}