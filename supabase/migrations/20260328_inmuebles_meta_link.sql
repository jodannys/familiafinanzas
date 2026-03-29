-- Vincula cada inmueble a una meta de ahorro (opcional)
ALTER TABLE public.inmuebles
  ADD COLUMN IF NOT EXISTS meta_id uuid NULL
    REFERENCES public.metas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inmuebles_meta_id
  ON public.inmuebles USING btree (meta_id);
