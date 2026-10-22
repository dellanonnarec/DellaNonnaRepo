-- A plataforma Supabase exige uma cláusula WHERE em operações DELETE.
-- A função substitui a lista completa de faixas de forma atômica.
create or replace function public.salvar_regras_delivery(p_regras jsonb)
returns setof public.regras_delivery
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_rule jsonb;
  v_min numeric(8,2);
  v_max numeric(8,2);
  v_fee numeric(12,2);
  v_previous_max numeric(8,2) := 0;
  v_order integer := 0;
  v_id uuid;
begin
  if jsonb_typeof(p_regras) <> 'array' or jsonb_array_length(p_regras) = 0 then
    raise exception 'Cadastre ao menos uma faixa de entrega.';
  end if;

  for v_rule in select value from jsonb_array_elements(p_regras)
  loop
    v_min := (v_rule->>'distancia_min_km')::numeric;
    v_max := (v_rule->>'distancia_max_km')::numeric;
    v_fee := (v_rule->>'taxa')::numeric;
    if v_min is null or v_max is null or v_fee is null or v_fee < 0 or v_max <= v_min then
      raise exception 'Uma faixa contém valores inválidos.';
    end if;
    if v_min <> v_previous_max then
      raise exception 'As faixas precisam começar em 0 e ser contínuas, sem sobreposição ou lacunas.';
    end if;
    v_previous_max := v_max;
  end loop;

  delete from public.regras_delivery where true;
  for v_rule in select value from jsonb_array_elements(p_regras)
  loop
    v_min := (v_rule->>'distancia_min_km')::numeric;
    v_max := (v_rule->>'distancia_max_km')::numeric;
    v_fee := (v_rule->>'taxa')::numeric;
    v_id := coalesce(nullif(v_rule->>'id', '')::uuid, gen_random_uuid());
    v_order := v_order + 1;
    insert into public.regras_delivery(id, distancia_min_km, distancia_max_km, taxa, ordem)
    values (v_id, v_min, v_max, v_fee, v_order);
  end loop;
  return query select * from public.regras_delivery order by ordem;
end;
$$;

revoke all on function public.salvar_regras_delivery(jsonb) from public, anon;
grant execute on function public.salvar_regras_delivery(jsonb) to authenticated;
grant execute on function public.salvar_regras_delivery(jsonb) to service_role;
