grant select, update
  on table public.identificaciones
  to service_role;

grant select, insert
  on table public.especies
  to service_role;

grant select, insert, delete
  on table public.predicciones
  to service_role;
