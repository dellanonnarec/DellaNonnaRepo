create sequence if not exists public.pedidos_numero_seq start with 1001;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero_pedido bigint not null default nextval('public.pedidos_numero_seq'),
  nome_cliente text not null check (char_length(trim(nome_cliente)) between 2 and 100),
  telefone_cliente text not null check (char_length(trim(telefone_cliente)) between 8 and 30),
  tipo_entrega text not null check (tipo_entrega in ('delivery', 'retirada')),
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  referencia text,
  forma_pagamento text not null check (forma_pagamento in ('pix', 'cartao', 'dinheiro')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  taxa_entrega numeric(12,2) not null default 0 check (taxa_entrega >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  observacao text,
  status text not null default 'recebido' check (status in ('recebido', 'em_preparo', 'saiu_para_entrega', 'entregue', 'cancelado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pedidos_delivery_endereco check (
    tipo_entrega = 'retirada' or (
      nullif(trim(cep), '') is not null and nullif(trim(rua), '') is not null
      and nullif(trim(numero), '') is not null and nullif(trim(bairro), '') is not null
    )
  )
);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  cardapio_item_id uuid not null references public.cardapio_itens(id) on delete restrict,
  nome_produto text not null,
  quantidade integer not null check (quantidade > 0),
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists pedidos_status_created_at_idx on public.pedidos(status, created_at desc);
create index if not exists pedido_itens_pedido_id_idx on public.pedido_itens(pedido_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_rel
    where prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
      and prrelid = 'public.pedidos'::regclass
  ) then
    alter publication supabase_realtime add table public.pedidos;
  end if;
exception when undefined_object then
  null;
end;
$$;

drop trigger if exists pedidos_touch_updated_at on public.pedidos;
create trigger pedidos_touch_updated_at before update on public.pedidos for each row execute function public.touch_updated_at();

alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

drop policy if exists "authenticated users can manage orders" on public.pedidos;
create policy "authenticated users can manage orders" on public.pedidos for all to authenticated using (true) with check (true);
drop policy if exists "authenticated users can manage order items" on public.pedido_itens;
create policy "authenticated users can manage order items" on public.pedido_itens for all to authenticated using (true) with check (true);

drop policy if exists "public can view available menu items" on public.cardapio_itens;
create policy "public can view available menu items" on public.cardapio_itens for select to anon, authenticated using (disponivel = true);

create or replace function public.criar_pedido(pedido jsonb)
returns public.pedidos
language plpgsql
security definer
set search_path = public
as $$
declare
  novo_pedido public.pedidos;
  item jsonb;
  item_cardapio public.cardapio_itens;
  quantidade integer;
  item_subtotal numeric(12,2);
  subtotal_calculado numeric(12,2) := 0;
  taxa numeric(12,2) := 0;
  tipo text := pedido->>'tipo_entrega';
  forma text := pedido->>'forma_pagamento';
begin
  if tipo not in ('delivery', 'retirada') then raise exception 'Tipo de entrega invalido'; end if;
  if forma not in ('pix', 'cartao', 'dinheiro') then raise exception 'Forma de pagamento invalida'; end if;
  if tipo = 'delivery' then taxa := 0; end if;
  if jsonb_typeof(pedido->'itens') <> 'array' or jsonb_array_length(pedido->'itens') = 0 then
    raise exception 'O pedido precisa ter itens';
  end if;

  insert into public.pedidos (
    nome_cliente, telefone_cliente, tipo_entrega, cep, rua, numero, complemento,
    bairro, referencia, forma_pagamento, taxa_entrega, observacao
  ) values (
    trim(pedido->>'nome_cliente'), trim(pedido->>'telefone_cliente'), tipo,
    nullif(trim(pedido->>'cep'), ''), nullif(trim(pedido->>'rua'), ''),
    nullif(trim(pedido->>'numero'), ''), nullif(trim(pedido->>'complemento'), ''),
    nullif(trim(pedido->>'bairro'), ''), nullif(trim(pedido->>'referencia'), ''),
    forma, taxa, nullif(trim(pedido->>'observacao'), '')
  ) returning * into novo_pedido;

  for item in select value from jsonb_array_elements(pedido->'itens') loop
    quantidade := greatest(1, (item->>'quantidade')::integer);
    select * into item_cardapio from public.cardapio_itens
    where id = (item->>'cardapio_item_id')::uuid and disponivel = true;
    if not found then raise exception 'Produto indisponivel'; end if;
    item_subtotal := round(item_cardapio.preco_venda * quantidade, 2);
    subtotal_calculado := subtotal_calculado + item_subtotal;
    insert into public.pedido_itens (
      pedido_id, cardapio_item_id, nome_produto, quantidade, preco_unitario, subtotal, observacao
    ) values (
      novo_pedido.id, item_cardapio.id, item_cardapio.nome_comercial, quantidade,
      item_cardapio.preco_venda, item_subtotal, nullif(trim(item->>'observacao'), '')
    );
  end loop;

  update public.pedidos
  set subtotal = subtotal_calculado, total = subtotal_calculado + taxa
  where id = novo_pedido.id
  returning * into novo_pedido;
  return novo_pedido;
end;
$$;

grant execute on function public.criar_pedido(jsonb) to anon, authenticated;
