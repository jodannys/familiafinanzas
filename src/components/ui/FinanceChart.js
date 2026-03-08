'use client'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const data = [
  { month: 'Ene', valor: 4000 },
  { month: 'Feb', valor: 3000 },
  { month: 'Mar', valor: 5000 },
  { month: 'Abr', valor: 4500 },
  { month: 'May', valor: 6200 },
  { month: 'Jun', valor: 5800 },
];

export function FinanceChart() {
  return (
    /* Contenedor NEGRO TOTAL para que resalte como en la imagen */
    <div 
      className="h-[380px] w-full flex flex-col p-8 rounded-[40px] border shadow-2xl"
      style={{ 
        background: '#0A0A0A', // Negro profundo mate
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <div className="mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          Progreso Financiero
        </h3>
        <p className="text-2xl font-black tracking-tighter text-white">
          Estado de Cuenta
        </p>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                {/* Gradiente en color Tierra/Naranja como tu logo */}
                <stop offset="5%" stopColor="#C17A3A" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#C17A3A" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid 
              strokeDasharray="3 3" 
              vertical={false} 
              stroke="rgba(255,255,255,0.05)" 
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              /* Letras en blanco tenue para que no compitan con la línea */
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}
              dy={15}
            />

            <YAxis hide={true} domain={['auto', 'auto']} />

            <Tooltip
              contentStyle={{
                backgroundColor: '#111',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                color: '#fff'
              }}
              itemStyle={{ color: '#C17A3A', fontWeight: 'bold' }}
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
            />

            <Area
              type="monotone"
              dataKey="valor"
              stroke="#C17A3A" /* Color Tierra de la marca */
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorValor)"
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}