'use client'
import { useState, useEffect } from 'react'
import { Plus, CreditCard, Banknote, Calendar, Info } from 'lucide-react'

export default function TarjetasPage() {
  const [tarjetas, setTarjetas] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Estado para el formulario de la nueva tarjeta
  const [formData, setFormData] = useState({
    nombre: '',
    banco: '',
    limite: '',
    dia_corte: '',
    dia_pago: ''
  })

  return (
    <div className="max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Mis Tarjetas de Crédito
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Configura tus límites y fechas para controlar el disponible.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-transform active:scale-95"
          style={{ background: 'var(--accent-green)', color: 'white', fontSize: '14px' }}
        >
          <Plus size={18} />
          Nueva Tarjeta
        </button>
      </div>

      {/* Grid de Tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tarjetas.length === 0 ? (
          <div className="col-span-full py-20 text-center rounded-3xl" 
               style={{ background: 'var(--bg-card)', border: '2px dashed var(--bg-secondary)' }}>
            <CreditCard size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)' }}>No tienes tarjetas configuradas aún.</p>
          </div>
        ) : (
          tarjetas.map((tarjeta) => (
            <div key={tarjeta.id} className="p-6 rounded-3xl shadow-sm" style={{ background: 'var(--bg-card)' }}>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent-blue)' }}>
                    {tarjeta.banco}
                  </p>
                  <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    {tarjeta.nombre}
                  </h3>
                </div>
                <div className="p-2 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                  <CreditCard size={20} style={{ color: 'var(--text-primary)' }} />
                </div>
              </div>

              {/* Termómetro de Crédito */}
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-xs font-bold">
                  <span style={{ color: 'var(--text-muted)' }}>Uso actual</span>
                  <span style={{ color: 'var(--text-primary)' }}>0€ / {tarjeta.limite}€</span>
                </div>
                <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                  <div className="h-full rounded-full" style={{ width: '0%', background: 'var(--accent-green)' }}></div>
                </div>
                <p className="text-right text-[10px] font-bold" style={{ color: 'var(--accent-green)' }}>
                  Disponible: {tarjeta.limite}€
                </p>
              </div>

              {/* Info de Fechas */}
              <div className="grid grid-cols-2 gap-4 p-3 rounded-2xl" style={{ background: 'var(--bg-primary)' }}>
                <div className="flex items-center gap-2">
                  <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Corte</p>
                    <p className="text-xs font-bold">Día {tarjeta.dia_corte}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Banknote size={14} style={{ color: 'var(--text-muted)' }} />
                  <div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Pago</p>
                    <p className="text-xs font-bold">Día {tarjeta.dia_pago}</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Aquí iría el Modal para añadir tarjeta (podemos crearlo luego) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md p-8 rounded-3xl shadow-2xl" style={{ background: 'var(--bg-card)' }}>
            <h2 className="text-xl font-bold mb-6">Configurar Tarjeta</h2>
            {/* Formulario rápido para probar */}
            <div className="space-y-4">
               <input 
                 placeholder="Nombre (ej: Visa Jodannys)" 
                 className="w-full p-3 rounded-xl border-none" 
                 style={{ background: 'var(--bg-secondary)' }}
                 onChange={(e) => setFormData({...formData, nombre: e.target.value})}
               />
               <input 
                 placeholder="Banco" 
                 className="w-full p-3 rounded-xl border-none" 
                 style={{ background: 'var(--bg-secondary)' }}
                 onChange={(e) => setFormData({...formData, banco: e.target.value})}
               />
               <input 
                 placeholder="Límite de crédito" 
                 type="number"
                 className="w-full p-3 rounded-xl border-none" 
                 style={{ background: 'var(--bg-secondary)' }}
                 onChange={(e) => setFormData({...formData, limite: e.target.value})}
               />
               <div className="grid grid-cols-2 gap-4">
                 <input 
                   placeholder="Día Corte" 
                   type="number"
                   className="w-full p-3 rounded-xl border-none" 
                   style={{ background: 'var(--bg-secondary)' }}
                   onChange={(e) => setFormData({...formData, dia_corte: e.target.value})}
                 />
                 <input 
                   placeholder="Día Pago" 
                   type="number"
                   className="w-full p-3 rounded-xl border-none" 
                   style={{ background: 'var(--bg-secondary)' }}
                   onChange={(e) => setFormData({...formData, dia_pago: e.target.value})}
                 />
               </div>
               <div className="flex gap-3 mt-6">
                 <button onClick={() => setIsModalOpen(false)} className="flex-1 p-3 rounded-xl font-bold" style={{ background: 'var(--bg-secondary)' }}>Cancelar</button>
                 <button onClick={() => { setTarjetas([...tarjetas, {...formData, id: Date.now()}]); setIsModalOpen(false); }} className="flex-1 p-3 rounded-xl font-bold text-white" style={{ background: 'var(--accent-green)' }}>Guardar</button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}