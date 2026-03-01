# Familia Finanzas 💰

App web de gestión financiera familiar. React (Next.js 14) + Supabase + Vercel.

---

## 🚀 Deploy en 3 pasos

### Paso 1 — Instalar y correr local

```bash
npm install
cp .env.local.example .env.local
# Edita .env.local con tus credenciales de Supabase
npm run dev
```
Abre http://localhost:3000

---

### Paso 2 — Configurar Supabase

1. Ve a https://supabase.com y crea un proyecto gratis
2. En **Project Settings → API**, copia:
   - `Project URL` → va en `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → va en `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. En **SQL Editor**, ejecuta el schema completo de abajo

#### Schema SQL (copiar y ejecutar en Supabase SQL Editor)

```sql
-- Movimientos (ingresos y egresos)
CREATE TABLE movimientos (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  monto       DECIMAL(12,2) NOT NULL,
  descripcion TEXT,
  categoria   TEXT NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  quien       TEXT DEFAULT 'Yo',
  recurrente  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Metas de ahorro
CREATE TABLE metas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre        TEXT NOT NULL,
  emoji         TEXT DEFAULT '🎯',
  meta          DECIMAL(12,2) NOT NULL,
  actual        DECIMAL(12,2) DEFAULT 0,
  pct_mensual   DECIMAL(5,2) DEFAULT 0,
  estado        TEXT DEFAULT 'activa' CHECK (estado IN ('activa','pausada','completada')),
  color         TEXT DEFAULT '#10b981',
  prioridad     INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Inversiones
CREATE TABLE inversiones (
  id      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre  TEXT NOT NULL,
  emoji   TEXT DEFAULT '📈',
  capital DECIMAL(12,2) NOT NULL,
  aporte  DECIMAL(12,2) DEFAULT 0,
  tasa    DECIMAL(5,2) NOT NULL,
  anos    INT DEFAULT 10,
  bola_nieve BOOLEAN DEFAULT true,
  color   TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deudas
CREATE TABLE deudas (
  id        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo      TEXT NOT NULL CHECK (tipo IN ('debo','medeben')),
  nombre    TEXT NOT NULL,
  entidad   TEXT,
  monto     DECIMAL(12,2) NOT NULL,
  pendiente DECIMAL(12,2) NOT NULL,
  cuota     DECIMAL(12,2) DEFAULT 0,
  tasa      DECIMAL(5,2) DEFAULT 0,
  vence_dia INT DEFAULT 0,
  estado    TEXT DEFAULT 'activa' CHECK (estado IN ('activa','pagada','mora')),
  color     TEXT DEFAULT '#fb7185',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sobres digitales
CREATE TABLE sobres (
  id       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre   TEXT NOT NULL,
  emoji    TEXT DEFAULT '💰',
  asignado DECIMAL(12,2) NOT NULL,
  color    TEXT DEFAULT '#10b981',
  activo   BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de sobres
CREATE TABLE sobres_movimientos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sobre_id   UUID REFERENCES sobres(id) ON DELETE CASCADE,
  descripcion TEXT,
  monto      DECIMAL(12,2) NOT NULL,
  fecha      DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (recomendado)
ALTER TABLE movimientos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE metas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inversiones          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sobres               ENABLE ROW LEVEL SECURITY;
ALTER TABLE sobres_movimientos   ENABLE ROW LEVEL SECURITY;
```

---

### Paso 3 — Deploy a Vercel

```bash
# Opción A: desde la terminal
npm install -g vercel
vercel

# Opción B: más fácil
# 1. Sube el proyecto a GitHub
# 2. Ve a https://vercel.com → New Project → importa tu repo
# 3. En "Environment Variables" agrega las dos variables de .env.local
# 4. Deploy ✅
```

---

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── page.js              ← Dashboard principal
│   ├── gastos/page.js       ← Ingresos & Egresos
│   ├── sobres/page.js       ← Sobres Digitales
│   ├── metas/page.js        ← Metas de Ahorro
│   ├── inversiones/page.js  ← Inversiones + Interés Compuesto
│   ├── deudas/page.js       ← Deudas
│   └── reportes/page.js     ← Reportes Anuales
├── components/
│   ├── layout/
│   │   ├── Sidebar.js       ← Navegación lateral
│   │   └── AppShell.js      ← Wrapper principal
│   └── ui/
│       ├── Card.js          ← StatCard, Card, Badge, ProgressBar
│       └── Modal.js         ← Modales de formulario
└── lib/
    ├── supabase.js          ← Cliente Supabase
    └── utils.js             ← Formatters + calculateCompoundInterest
```

---

## 🔌 Conectar Supabase (siguiente paso)

Actualmente la app usa datos demo. Para conectarla a Supabase real, en cada página reemplaza el array de demo por una query así:

```js
// Ejemplo en gastos/page.js
import { supabase } from '@/lib/supabase'

useEffect(() => {
  supabase.from('movimientos').select('*').order('fecha', { ascending: false })
    .then(({ data }) => { if (data) setMovs(data) })
}, [])
```

---

## 🛠 Stack

| Tecnología | Uso |
|---|---|
| Next.js 14 (App Router) | Framework React |
| Tailwind CSS | Estilos |
| Supabase | Base de datos + Auth |
| Recharts | Gráficos |
| Lucide React | Iconos |
| Vercel | Deploy |
