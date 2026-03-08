'use client'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export function FinanceChart({ data = [] }) { // <--- Ahora recibe data por props
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
        <p className="text-2xl font-black tracking-tighter text-white">
          Flujo de Caja Diario
        </p>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data} // <--- Usa los datos reales
            margin={{ top: 10, right: -10, left: -20, bottom: 0 }}
          >

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="rgba(255,255,255,0.05)"
            />

            <XAxis
              dataKey="name" // <--- Cambiado a "name" para coincidir con el procesado
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 700 }}
              dy={15}
              minTickGap={20} // Evita que los días se amontonen en móvil
            />

            <YAxis
              width={40}
              tick={{
                fill: 'rgba(255,255,255,0.4)',
                fontSize: 10,
                fontWeight: 700,
                textAnchor: 'start'
              }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
              dx={5}
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

            // SUSTITUYE POR:
            <defs>
              <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C0605A" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#C0605A" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2D7A5F" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2D7A5F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="ingresos"
              stroke="#2D7A5F" strokeWidth={3}
              fillOpacity={1} fill="url(#colorIngresos)"
              animationDuration={1500} name="Ingresos" />
            <Area type="monotone" dataKey="gastos"
              stroke="#C0605A" strokeWidth={3}
              fillOpacity={1} fill="url(#colorGastos)"
              animationDuration={1500} name="Gastos" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}