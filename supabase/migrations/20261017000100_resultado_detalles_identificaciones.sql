alter table public.identificaciones
  add column if not exists resultado_detalles jsonb;
