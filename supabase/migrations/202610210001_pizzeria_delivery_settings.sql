create table if not exists public.configuracoes_pizzaria (
  id smallint primary key default 1 check (id = 1),
  cep text not null default '',
  rua text not null default '',
  numero text not null default '',
  complemento text not null default '',
  bairro text not null default '',
  cidade text not null default '',
  estado text not null default '',
  horarios jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pedidos
  add column if not exists distancia_entrega_km numeric(8,2)
  check (distancia_entrega_km is null or distancia_entrega_km >= 0);

create table if not exists public.regras_delivery (
  id uuid primary key default gen_random_uuid(),
  distancia_min_km numeric(8,2) not null check (distancia_min_km >= 0),
  distancia_max_km numeric(8,2) not null check (distancia_max_km > distancia_min_km),
  taxa numeric(12,2) not null check (taxa >= 0),
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.configuracoes_pizzaria enable row level security;
alter table public.regras_delivery enable row level security;
grant select, insert, update, delete on public.configuracoes_pizzaria to authenticated;
grant select, insert, update, delete on public.regras_delivery to authenticated;
grant all on public.configuracoes_pizzaria, public.regras_delivery to service_role;

drop policy if exists "authenticated admins manage pizzeria settings" on public.configuracoes_pizzaria;
create policy "authenticated admins manage pizzeria settings"
  on public.configuracoes_pizzaria for all to authenticated
  using (true) with check (true);

drop policy if exists "authenticated admins manage delivery rules" on public.regras_delivery;
create policy "authenticated admins manage delivery rules"
  on public.regras_delivery for all to authenticated
  using (true) with check (true);

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
  v_previous_max := 0;
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

-- A criação de pedidos públicos passa pelo Edge Function, que recalcula a rota
-- e a taxa no servidor antes de chamar este RPC.
drop function if exists public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb);
create function public.registrar_pedido_publico_com_acompanhamento(
  p_pedido jsonb,
  p_itens jsonb
)
returns table (order_id uuid, order_number bigint, order_total numeric, tracking_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created record;
  v_tracking_code text;
  v_returned boolean := false;
  v_valor_recebido numeric(12,2);
  v_taxa_entrega numeric(12,2) := 0;
  v_distancia_km numeric(8,2);
  v_total numeric(12,2);
begin
  if p_pedido->>'tipo_entrega' = 'delivery' then
    v_taxa_entrega := coalesce(nullif(p_pedido->>'taxa_entrega', '')::numeric, 0);
    v_distancia_km := nullif(p_pedido->>'distancia_entrega_km', '')::numeric;
    if v_taxa_entrega < 0 then raise exception 'Taxa de entrega inválida.'; end if;
    if v_distancia_km is null or v_distancia_km <= 0 then raise exception 'Distância de entrega inválida.'; end if;
  end if;
  if p_pedido->>'forma_pagamento' = 'dinheiro'
    and nullif(trim(p_pedido->>'valor_recebido'), '') is not null then
    v_valor_recebido := (p_pedido->>'valor_recebido')::numeric;
    if v_valor_recebido < 0 then raise exception 'Valor recebido não pode ser negativo.'; end if;
  end if;

  for created in select * from public.registrar_pedido_publico(p_pedido, p_itens)
  loop
    v_returned := true;
    v_total := round(created.order_total + v_taxa_entrega, 2);
    if v_valor_recebido is not null and v_valor_recebido < v_total then
      raise exception 'O valor informado para troco é menor que o total do pedido.';
    end if;
    update public.pedidos
    set taxa_entrega = v_taxa_entrega,
        distancia_entrega_km = v_distancia_km,
        total = v_total,
        valor_recebido = v_valor_recebido
    where id = created.order_id;

    select p.codigo_acompanhamento into v_tracking_code
    from public.pedidos p where p.id = created.order_id;
    if v_tracking_code is null then
      raise exception 'Pedido % criado, mas codigo_acompanhamento não foi encontrado.', created.order_id;
    end if;
    order_id := created.order_id;
    order_number := created.order_number;
    order_total := v_total;
    tracking_code := v_tracking_code;
    return next;
  end loop;
  if not v_returned then raise exception 'A função registrar_pedido_publico não retornou os dados do pedido.'; end if;
end;
$$;

revoke all on function public.registrar_pedido_publico(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pedido_publico(jsonb, jsonb) to service_role;
grant execute on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) to service_role;
