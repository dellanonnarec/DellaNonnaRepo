-- Cria códigos públicos únicos para acompanhamento de pedidos.
create or replace function public.gerar_codigo_acompanhamento_pedido()
returns text
language plpgsql
volatile
set search_path = public, pg_temp
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_index integer;
begin
  for i in 1..6 loop
    v_index := (get_byte(gen_random_bytes(1), 0) % length(v_alphabet)) + 1;
    v_code := v_code || substr(v_alphabet, v_index, 1);
  end loop;
  return v_code;
end;
$$;

alter table public.pedidos
  add column if not exists codigo_acompanhamento text;

update public.pedidos
set codigo_acompanhamento = public.gerar_codigo_acompanhamento_pedido()
where codigo_acompanhamento is null;

alter table public.pedidos
  alter column codigo_acompanhamento
  set default public.gerar_codigo_acompanhamento_pedido();

alter table public.pedidos
  alter column codigo_acompanhamento set not null;

create unique index if not exists pedidos_codigo_acompanhamento_uidx
  on public.pedidos (codigo_acompanhamento);

-- Mantém o RPC de criação atual e inclui seu código na resposta sem duplicar
-- a lógica de cálculo e gravação do pedido.
create or replace function public.registrar_pedido_publico_com_acompanhamento(
  p_pedido jsonb,
  p_itens jsonb
)
returns table (
  order_id uuid,
  order_number bigint,
  order_total numeric,
  tracking_code text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select created.order_id, created.order_number, created.order_total,
         orders.codigo_acompanhamento
  from public.registrar_pedido_publico(p_pedido, p_itens) as created
  join public.pedidos as orders on orders.id = created.order_id;
$$;

revoke all on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) from public;
grant execute on function public.registrar_pedido_publico_com_acompanhamento(jsonb, jsonb) to anon, authenticated;

-- O código funciona como credencial de leitura e retorna apenas dados seguros
-- para acompanhamento, sem expor nome, telefone ou endereço do cliente.
create or replace function public.buscar_pedido_publico_por_codigo(p_codigo text)
returns table (
  order_number bigint,
  order_total numeric,
  order_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pedidos.numero_pedido, pedidos.total, pedidos.status
  from public.pedidos as pedidos
  where pedidos.codigo_acompanhamento = upper(trim(coalesce(p_codigo, '')))
  limit 1;
$$;

revoke all on function public.buscar_pedido_publico_por_codigo(text) from public;
grant execute on function public.buscar_pedido_publico_por_codigo(text) to anon, authenticated;
