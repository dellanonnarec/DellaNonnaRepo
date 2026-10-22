-- Persiste o valor informado no campo "Troco para" para que o agente local
-- possa imprimi-lo no ticket. O total calculado pelo RPC permanece inalterado.
alter table public.pedidos
  add column if not exists valor_recebido numeric(12, 2);

drop function if exists public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb);

create function public.registrar_pedido_publico_com_acompanhamento(
  p_pedido jsonb,
  p_itens jsonb
)
returns table (
  order_id uuid,
  order_number bigint,
  order_total numeric,
  tracking_code text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created record;
  v_tracking_code text;
  v_returned boolean := false;
  v_valor_recebido numeric(12, 2);
begin
  if p_pedido->>'forma_pagamento' = 'dinheiro'
    and nullif(trim(p_pedido->>'valor_recebido'), '') is not null then
    v_valor_recebido := (p_pedido->>'valor_recebido')::numeric;
    if v_valor_recebido < 0 then
      raise exception 'Valor recebido não pode ser negativo.';
    end if;
  end if;

  for created in
    select * from public.registrar_pedido_publico(p_pedido, p_itens)
  loop
    v_returned := true;

    if v_valor_recebido is not null then
      update public.pedidos
      set valor_recebido = v_valor_recebido
      where id = created.order_id;
    end if;

    select p.codigo_acompanhamento
      into v_tracking_code
    from public.pedidos as p
    where p.id = created.order_id;

    if v_tracking_code is null then
      raise exception 'Pedido % criado, mas codigo_acompanhamento não foi encontrado.', created.order_id;
    end if;

    order_id := created.order_id;
    order_number := created.order_number;
    order_total := created.order_total;
    tracking_code := v_tracking_code;
    return next;
  end loop;

  if not v_returned then
    raise exception 'A função registrar_pedido_publico não retornou os dados do pedido.';
  end if;
end;
$$;

revoke all on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) from public;
grant execute on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) to anon, authenticated;
