-- Recria a RPC de finalização com retorno explícito do código de acompanhamento.
-- O DROP é necessário caso o projeto remoto tenha a mesma assinatura com outro
-- tipo de retorno (por exemplo, void), que CREATE OR REPLACE não consegue alterar.
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
begin
  return query
  select
    created.order_id,
    created.order_number,
    created.order_total,
    orders.codigo_acompanhamento
  from public.registrar_pedido_publico(p_pedido, p_itens) as created
  join public.pedidos as orders on orders.id = created.order_id;
end;
$$;

revoke all on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) from public;
grant execute on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) to anon, authenticated;
