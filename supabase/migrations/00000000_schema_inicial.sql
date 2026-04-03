-- =====================================================================
-- SCHEMA INICIAL — familia-finanzas
-- Ejecutar PRIMERO en Supabase SQL Editor, antes que cualquier otro migration.
-- Es idempotente: usa CREATE TABLE IF NOT EXISTS — seguro de re-ejecutar.
-- Orden respeta dependencias de FK.
-- =====================================================================

BEGIN;

-- ═══════════════════════════════════════════════════════════════════
-- 1. CATEGORIAS
--    Base del árbol presupuestal. No tiene FK (solo user_id).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.categorias (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text        NOT NULL,
  bloque     text        NOT NULL CHECK (bloque IN ('necesidades','estilo','futuro')),
  orden      integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. SUBCATEGORIAS
--    Depende de: categorias
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.subcategorias (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id uuid        REFERENCES public.categorias(id) ON DELETE CASCADE,
  nombre       text        NOT NULL,
  orden        integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. PRESUPUESTO_BLOQUES
--    Porcentajes por bloque (necesidades / estilo / futuro).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.presupuesto_bloques (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  bloque     text        NOT NULL CHECK (bloque IN ('necesidades','estilo','futuro')),
  pct        numeric     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bloque)
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. PRESUPUESTO_SUB
--    Sub-distribución dentro del bloque "futuro" (metas / inversiones).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.presupuesto_sub (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  bloque     text        NOT NULL,
  categoria  text        NOT NULL,
  pct        numeric     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 5. METAS
--    Objetivos de ahorro del usuario.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.metas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  emoji       text,
  meta        numeric     NOT NULL DEFAULT 0,
  actual      numeric     NOT NULL DEFAULT 0,
  pct_mensual numeric              DEFAULT 0,
  estado      text        NOT NULL DEFAULT 'activa'
                          CHECK (estado IN ('activa','completada','pausada')),
  color       text,
  prioridad   integer              DEFAULT 0,
  orden       integer              DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 6. INVERSIONES
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inversiones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text        NOT NULL,
  emoji       text,
  capital     numeric     NOT NULL DEFAULT 0,
  aporte      numeric              DEFAULT 0,
  aporte_real numeric              DEFAULT 0,
  tasa        numeric              DEFAULT 0,
  anos        integer              DEFAULT 0,
  color       text,
  bola_nieve  boolean              DEFAULT false,
  pct_mensual numeric              DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 7. PERFILES_FAMILIA
--    Miembros de la familia (quien gasta / quien ingresa).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.perfiles_familia (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     text        NOT NULL,
  emoji      text,
  color      text,
  orden      integer              DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 8. PERFILES_TARJETAS
--    Tarjetas de crédito del usuario.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.perfiles_tarjetas (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_tarjeta text        NOT NULL,
  banco          text,
  color          text,
  dia_pago       integer,
  dia_corte      integer,
  limite_credito numeric              DEFAULT 0,
  estado         text        NOT NULL DEFAULT 'activa'
                             CHECK (estado IN ('activa','pausada')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 9. DEUDAS
--    Depende de: perfiles_tarjetas
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.deudas (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  perfil_tarjeta_id uuid        REFERENCES public.perfiles_tarjetas(id) ON DELETE SET NULL,
  tipo_deuda        text,
  tipo              text        CHECK (tipo IN ('debo','medeben')),
  nombre            text        NOT NULL,
  descripcion       text,
  categoria         text,
  emoji             text,
  capital           numeric              DEFAULT 0,
  monto             numeric              DEFAULT 0,
  pendiente         numeric              DEFAULT 0,
  cuota             numeric              DEFAULT 0,
  plazo_meses       integer              DEFAULT 0,
  pagadas           integer              DEFAULT 0,
  tasa              numeric              DEFAULT 0,
  tasa_interes      numeric              DEFAULT 0,
  dia_pago          integer,
  limite            numeric              DEFAULT 0,
  color             text,
  estado            text        NOT NULL DEFAULT 'activa'
                                CHECK (estado IN ('activa','pagada','pausada')),
  telefono          text,
  fecha_primer_pago date,
  orden             integer              DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 10. DEUDA_MOVIMIENTOS
--     Historial de pagos/cargos por deuda. Hereda seguridad via deudas.
--     Depende de: deudas
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.deuda_movimientos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deuda_id    uuid        NOT NULL REFERENCES public.deudas(id) ON DELETE CASCADE,
  tipo        text        NOT NULL CHECK (tipo IN ('pago','cargo','cuota')),
  descripcion text,
  monto       numeric     NOT NULL DEFAULT 0,
  fecha       date,
  mes         integer,
  año         integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 11. MOVIMIENTOS
--     Tabla central de transacciones. Depende de todas las anteriores.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.movimientos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo                text        NOT NULL CHECK (tipo IN ('ingreso','egreso','retiro')),
  monto               numeric     NOT NULL DEFAULT 0,
  descripcion         text,
  categoria           text,
  fecha               date,
  quien               text,
  recurrente          boolean              DEFAULT false,
  metodo_pago         text                 DEFAULT 'efectivo',
  num_cuotas          integer,
  tarjeta_nombre      text,
  subcategoria_id     uuid        REFERENCES public.subcategorias(id)      ON DELETE SET NULL,
  meta_id             uuid        REFERENCES public.metas(id)              ON DELETE SET NULL,
  inversion_id        uuid        REFERENCES public.inversiones(id)        ON DELETE SET NULL,
  deuda_id            uuid        REFERENCES public.deudas(id)             ON DELETE SET NULL,
  deuda_movimiento_id uuid        REFERENCES public.deuda_movimientos(id)  ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 12. SOBRE_MOVIMIENTOS
--     Traspasos entre sobres. Depende de: metas, inversiones
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.sobre_movimientos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  descripcion  text,
  monto        numeric     NOT NULL DEFAULT 0,
  origen       text,
  destino      text,
  mes          integer,
  año          integer,
  fecha        date                 DEFAULT CURRENT_DATE,
  meta_id      uuid        REFERENCES public.metas(id)       ON DELETE SET NULL,
  inversion_id uuid        REFERENCES public.inversiones(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 13. PRESUPUESTO_CATS
--     Presupuesto mensual por subcategoría. Depende de: subcategorias
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.presupuesto_cats (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  subcategoria_id uuid        REFERENCES public.subcategorias(id) ON DELETE CASCADE,
  mes             integer     NOT NULL,
  año             integer     NOT NULL,
  monto           numeric     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 14. PRESUPUESTO_ITEMS
--     Ítems dentro de cada categoría presupuestada. Depende de: presupuesto_cats
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.presupuesto_items (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cat_id     uuid        NOT NULL REFERENCES public.presupuesto_cats(id) ON DELETE CASCADE,
  mes        integer,
  año        integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- 15. AGENDA_NOTAS
--     Recordatorios y eventos de la familia.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.agenda_notas (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo     text        NOT NULL,
  fecha      date,
  tipo       text,
  color      text,
  completado boolean              DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
