-- Permite receber pedidos delivery quando o provedor de rotas não estiver
-- configurado. A taxa fica explicitamente pendente para confirmação manual.
alter table public.pedidos
  add column if not exists taxa_entrega_pendente boolean not null default false;

create or replace function public.registrar_pedido_publico_com_acompanhamento(
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
  v_taxa_pendente boolean := coalesce((p_pedido->>'taxa_entrega_pendente')::boolean, false);
  v_total numeric(12,2);
begin
  if p_pedido->>'tipo_entrega' = 'delivery' then
    v_taxa_entrega := coalesce(nullif(p_pedido->>'taxa_entrega', '')::numeric, 0);
    v_distancia_km := nullif(p_pedido->>'distancia_entrega_km', '')::numeric;
    if v_taxa_entrega < 0 then raise exception 'Taxa de entrega inválida.'; end if;
    if v_taxa_pendente then
      if v_taxa_entrega <> 0 or v_distancia_km is not null then
        raise exception 'Uma taxa pendente deve ser registrada sem taxa ou distância calculada.';
      end if;
    elsif v_distancia_km is null or v_distancia_km <= 0 then
      raise exception 'Distância de entrega inválida.';
    end if;
  else
    v_taxa_pendente := false;
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
        taxa_entrega_pendente = v_taxa_pendente,
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

revoke all on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) to service_role;

drop function if exists public.buscar_pedido_publico_por_codigo(text);
create function public.buscar_pedido_publico_por_codigo(p_codigo text)
returns table (
  order_number bigint,
  order_total numeric,
  order_status text,
  taxa_entrega_pendente boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pedidos.numero_pedido, pedidos.total, pedidos.status, pedidos.taxa_entrega_pendente
  from public.pedidos as pedidos
  where pedidos.codigo_acompanhamento = upper(trim(coalesce(p_codigo, '')))
  limit 1;
$$;

revoke all on function public.buscar_pedido_publico_por_codigo(text) from public;
grant execute on function public.buscar_pedido_publico_por_codigo(text) to anon, authenticated;
