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
    <div
      className="h-[380px] w-full flex flex-col p-8 rounded-[40px] border shadow-2xl"
      style={{
        background: '#0A0A0A',
        borderColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <div className="mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
          Progreso Financiero
        </h3>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            /* AJUSTE 1: Aumentamos el margen izquierdo a 10 o 20 */
            margin={{ top: 10, right: 5, left: 5, bottom: 0 }} 
          >
            <defs>
              <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
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
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700 }}
              dy={15}
            />

            <YAxis
              /* AJUSTE 2: Usamos un color explícito o blanco/blanco-tenue */
              /* A veces 'var(--text-secondary)' en fondo negro #0A0A0A no tiene suficiente contraste */
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}
              axisLine={false}
              tickLine={false}
              /* AJUSTE 3: Formateador para que no ocupen tanto espacio horizontal */
              tickFormatter={(value) => value >= 1000 ? `${value/1000}k` : value}
              width={45} 
            />

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
              stroke="#C17A3A"
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