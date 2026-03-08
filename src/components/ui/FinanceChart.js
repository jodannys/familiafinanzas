'use client'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data = [
  { month: 'Ene', valor: 4000 },
  { month: 'Feb', valor: 3000 },
  { month: 'Mar', valor: 5000 },
  { month: 'Abr', valor: 4500 },
];

export function FinanceChart() {
  return (
    /* Usamos la clase dark-card que definimos en el CSS para el look de la imagen */
    <div className="dark-card h-[350px] w-full flex flex-col">
      <div className="mb-4">
        <h3 className="ff-label text-white/60">Progreso Financiero</h3>
        <p className="text-2xl font-bold text-white">Estado de Cuenta</p>
      </div>

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                {/* Usamos var(--accent-main) para que cambie según el tema */}
                <stop offset="5%" stopColor="var(--accent-main)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-main)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis hide={true} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--bg-dark-card)',
                border: '1px solid var(--border-glass)',
                borderRadius: '16px',
                color: 'var(--text-primary)'
              }}
              itemStyle={{ color: 'var(--accent-main)' }}
            />
            <Area
              type="monotone"
              dataKey="valor"
              stroke="var(--accent-main)"
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorValor)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}