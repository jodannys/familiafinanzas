'use client'
import { useState, useEffect } from 'react'
import AppShell from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Home, Sparkles, Sprout, CheckCircle, Edit3, Save, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Target, TrendingUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const BLOQUES_META = [
  { id:'necesidades', nombre:'Necesidades',    icon:Home,     color:'#4A6FA5', pct:50, categorias:['Básicos','Deudas'],         descripcion:'Gastos obligatorios' },
  { id:'estilo',      nombre:'Estilo de vida', icon:Sparkles, color:'#C17A3A', pct:20, categorias:['Deseo'],                    descripcion:'Ocio y disfrute' },
  { id:'futuro',      nombre:'Futuro',         icon:Sprout,   color:'#2D7A5F', pct:30, categorias:['Metas','Inversiones'],      descripcion:'Patrimonio' },
]

export default function PresupuestoPage() {
  const [bloques, setBloques] = useState(BLOQUES_META)
  const [ingreso, setIngreso] = useState('')
  const [editando, setEditando] = useState(false)
  const [borradores, setBorradores] = useState(null)
  const [items, setItems] = useState([])
  const [movs, setMovs] = useState([])
  
  // Estados para datos reales de Futuro
  const [metasReales, setMetasReales] = useState([])
  const [inversionesReales, setInversionesReales] = useState([])
  
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [formItem, setFormItem] = useState({ nombre:'', monto:'' })
  const [addingTo, setAddingTo] = useState(null)

  const now = new Date()
  const mes = now.getMonth() + 1
  const año = now.getFullYear()

  useEffect(() => { cargarTodo() }, [])

  async function cargarTodo() {
    setLoading(true)
    const [
      { data: itemsData },
      { data: movsData },
      { data: bloquesData },
      { data: metasData },
      { data: invData }
    ] = await Promise.all([
      supabase.from('presupuesto_items').select('*').eq('mes', mes).eq('año', año),
      supabase.from('movimientos').select('*').gte('fecha', `${año}-${String(mes).padStart(2,'0')}-01`),
      supabase.from('presupuesto_bloques').select('*'),
      supabase.from('metas').select('*'),
      supabase.from('inversiones').select('*')
    ])

    setItems(itemsData || [])
    setMovs(movsData || [])
    setMetasReales(metasData || [])
    setInversionesReales(invData || [])

    const totalIngresos = (movsData || []).filter(m => m.tipo === 'ingreso').reduce((s,m) => s+m.monto, 0)
    if (totalIngresos > 0) setIngreso(totalIngresos.toString())

    if (bloquesData?.length > 0) {
      setBloques(prev => prev.map(b => {
        const found = bloquesData.find(r => r.bloque === b.id)
        return found ? { ...b, pct: found.pct } : b
      }))
    }
    setLoading(false)
  }

  // Lógica para añadir Metas/Inversiones al presupuesto automáticamente
  async function vincularAFuturo(nombre, monto, tipo) {
    const { data, error } = await supabase
      .from('presupuesto_items')
      .insert([{ 
        bloque: 'futuro', 
        nombre: `${tipo === 'meta' ? '🎯' : '📈'} ${nombre}`, 
        monto: parseFloat(monto) || 0, 
        mes, año 
      }])
      .select()
    if (!error) setItems(prev => [...prev, data[0]])
  }

  async function handleDeleteItem(id) {
    const { error } = await supabase.from('presupuesto_items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  const ingresoNum = parseFloat(ingreso) || 0

  return (
    <AppShell>
      <div className="flex items-start justify-between mb-8 animate-enter">
        <div>
          <h1 className="text-2xl font-black text-stone-800 tracking-tight">Estrategia Mensual</h1>
          <p className="text-sm text-stone-400">Distribución inteligente de tus ingresos</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        {bloques.map((bloque) => {
          const Icon = bloque.icon
          const montoMaximo = ingresoNum * (bloque.pct / 100)
          const bloqueItems = items.filter(i => i.bloque === bloque.id)
          const totalPresupuestado = bloqueItems.reduce((s,i) => s+i.monto, 0)
          const isExpandido = expandido === bloque.id

          return (
            <Card key={bloque.id} className="relative overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:`${bloque.color}15`, color:bloque.color }}>
                  <Icon size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black uppercase tracking-widest text-stone-400">{bloque.nombre}</p>
                  <p className="text-xl font-black" style={{ color:bloque.color }}>{bloque.pct}%</p>
                </div>
              </div>

              <div className="space-y-1 mb-4">
                <div className="flex justify-between text-[10px] font-bold uppercase text-stone-400">
                  <span>Presupuestado</span>
                  <span>{formatCurrency(montoMaximo)}</span>
                </div>
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full transition-all duration-700" style={{ width:`${Math.min(100, (totalPresupuestado/montoMaximo)*100)}%`, background:bloque.color }} />
                </div>
              </div>

              {/* CONTENIDO EXPANDIBLE */}
              <div className="border-t border-stone-50 pt-4">
                <button onClick={() => setExpandido(isExpandido ? null : bloque.id)} className="w-full flex items-center justify-between text-[10px] font-black uppercase text-stone-400 tracking-tighter hover:text-stone-600 transition-colors">
                  <span>{isExpandido ? 'Cerrar detalles' : 'Ver desglose'}</span>
                  {isExpandido ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                </button>

                {isExpandido && (
                  <div className="mt-4 space-y-3 animate-enter">
                    {/* Lista de Items ya agregados */}
                    {bloqueItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-stone-50 p-2 rounded-lg group">
                        <span className="text-xs font-bold text-stone-700">{item.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black" style={{ color:bloque.color }}>{formatCurrency(item.monto)}</span>
                          <button onClick={() => handleDeleteItem(item.id)} className="text-stone-300 hover:text-rose-500 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* LÓGICA ESPECIAL PARA FUTURO: Sugerencias Reales */}
                    {bloque.id === 'futuro' && (
                      <div className="pt-2 border-t border-dashed border-stone-200 mt-2">
                        <p className="text-[9px] font-black text-stone-400 uppercase mb-2 italic">Vincular Metas e Inversiones</p>
                        <div className="flex flex-col gap-2">
                          {metasReales.filter(m => !bloqueItems.find(bi => bi.nombre.includes(m.nombre))).map(meta => (
                            <button key={meta.id} onClick={() => vincularAFuturo(meta.nombre, (montoMaximo * 0.2), 'meta')}
                              className="text-left text-[10px] p-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 font-bold flex items-center justify-between hover:bg-emerald-100 transition-colors">
                              <span>🎯 {meta.nombre}</span>
                              <Plus size={10} />
                            </button>
                          ))}
                          {inversionesReales.filter(i => !bloqueItems.find(bi => bi.nombre.includes(i.nombre))).map(inv => (
                            <button key={inv.id} onClick={() => vincularAFuturo(inv.nombre, (montoMaximo * 0.1), 'inv')}
                              className="text-left text-[10px] p-2 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold flex items-center justify-between hover:bg-indigo-100 transition-colors">
                              <span>📈 {inv.nombre}</span>
                              <Plus size={10} />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Botón estándar para Necesidades y Estilo */}
                    {bloque.id !== 'futuro' && (
                      <button onClick={() => setAddingTo(bloque.id)} className="w-full py-2 border-2 border-dashed border-stone-100 rounded-xl text-[10px] font-black text-stone-400 uppercase hover:bg-stone-50 transition-all">
                        + Añadir concepto
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* MODAL SIMPLE PARA AÑADIR ITEMS MANUALES (Necesidades/Estilo) */}
      {addingTo && (
        <div className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-xs animate-enter">
            <h3 className="font-black text-stone-800 mb-4 uppercase text-xs tracking-widest">Añadir a {addingTo}</h3>
            <div className="space-y-3">
              <input className="ff-input text-sm" placeholder="Nombre (ej: Alquiler)" value={formItem.nombre} onChange={e => setFormItem({...formItem, nombre:e.target.value})} />
              <input className="ff-input text-sm" type="number" placeholder="Monto €" value={formItem.monto} onChange={e => setFormItem({...formItem, monto:e.target.value})} />
              <div className="flex gap-2 pt-2">
                <button onClick={() => setAddingTo(null)} className="flex-1 py-3 text-xs font-bold text-stone-400">CANCELAR</button>
                <button onClick={async () => {
                  const { data, error } = await supabase.from('presupuesto_items').insert([{ bloque: addingTo, nombre: formItem.nombre, monto: parseFloat(formItem.monto), mes, año }]).select()
                  if (!error) { setItems([...items, data[0]]); setAddingTo(null); setFormItem({nombre:'', monto:''}) }
                }} className="flex-1 py-3 bg-stone-800 text-white rounded-xl text-xs font-black">GUARDAR</button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  )
}