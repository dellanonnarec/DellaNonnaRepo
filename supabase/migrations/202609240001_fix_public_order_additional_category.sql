-- Correção: aceita categorias 'Adicional' e 'Adicionais' na validação pública.
-- A aplicação exige que os adicionais venham de itens vinculados a insumos.

create or replace function public.registrar_pedido_publico(
  p_pedido jsonb,
  p_itens jsonb
)
returns table (order_id uuid, order_number bigint, order_total numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number bigint;
  v_subtotal numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_extra jsonb;
  v_product_id uuid;
  v_order_item_id uuid;
  v_extra_id uuid;
  v_quantity integer;
  v_extra_quantity integer;
  v_base_price numeric(12,2);
  v_unit_price numeric(12,2);
  v_line_subtotal numeric(12,2);
  v_product_name text;
  v_extra_name text;
  v_extra_price numeric(12,2);
  v_extra_subtotal numeric(12,2);
  v_extra_total numeric(12,2);
  v_extra_names text[];
  v_extra_snapshots jsonb;
  v_category_name text;
  v_product_origin text;
  v_observation text;
begin
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O pedido precisa conter pelo menos um item.';
  end if;
  if nullif(trim(p_pedido->>'nome_cliente'), '') is null
    or char_length(trim(p_pedido->>'nome_cliente')) not between 2 and 100 then
    raise exception 'Nome do cliente inválido.';
  end if;
  if nullif(trim(p_pedido->>'telefone_cliente'), '') is null
    or char_length(trim(p_pedido->>'telefone_cliente')) not between 8 and 30 then
    raise exception 'WhatsApp inválido.';
  end if;
  if p_pedido->>'tipo_entrega' not in ('delivery', 'retirada') then
    raise exception 'Tipo de entrega inválido.';
  end if;
  if p_pedido->>'forma_pagamento' not in ('pix', 'cartao', 'dinheiro') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_pedido->>'tipo_entrega' = 'delivery' and (
    nullif(trim(p_pedido->>'cep'), '') is null
    or nullif(trim(p_pedido->>'rua'), '') is null
    or nullif(trim(p_pedido->>'numero'), '') is null
    or nullif(trim(p_pedido->>'bairro'), '') is null
  ) then
    raise exception 'Endereço de entrega incompleto.';
  end if;

  insert into public.pedidos (
    id, nome_cliente, telefone_cliente, tipo_entrega, cep, rua, numero,
    complemento, bairro, referencia, forma_pagamento, subtotal,
    taxa_entrega, total, observacao
  ) values (
    v_order_id,
    trim(p_pedido->>'nome_cliente'),
    trim(p_pedido->>'telefone_cliente'),
    p_pedido->>'tipo_entrega',
    nullif(trim(p_pedido->>'cep'), ''),
    nullif(trim(p_pedido->>'rua'), ''),
    nullif(trim(p_pedido->>'numero'), ''),
    nullif(trim(p_pedido->>'complemento'), ''),
    nullif(trim(p_pedido->>'bairro'), ''),
    nullif(trim(p_pedido->>'referencia'), ''),
    p_pedido->>'forma_pagamento',
    0, 0, 0, null
  ) returning numero_pedido into v_order_number;

  for v_item in select value from jsonb_array_elements(p_itens)
  loop
    v_product_id := (v_item->>'cardapio_item_id')::uuid;
    v_quantity := (v_item->>'quantidade')::integer;
    if v_quantity is null or v_quantity < 1 then
      raise exception 'Quantidade inválida no pedido.';
    end if;

    select ci.nome_comercial, ci.preco_venda, cc.nome, ci.origem_tipo
      into v_product_name, v_base_price, v_category_name, v_product_origin
    from public.cardapio_itens ci
    join public.categorias_cardapio cc on cc.id = ci.categoria_id
    where ci.id = (v_item->>'cardapio_item_id')::uuid
      and ci.disponivel = true
      and cc.ativa = true
      and cc.nome !~* 'adicion(al|ais)';
    if not found then
      raise exception 'Um dos produtos não está mais disponível.';
    end if;

    if jsonb_typeof(v_item->'adicionais') = 'array'
      and jsonb_array_length(v_item->'adicionais') > 0
      and (v_product_origin <> 'receita' or v_category_name not ilike '%pizza%') then
      raise exception 'Adicionais só podem ser vinculados a uma pizza.';
    end if;

    v_extra_total := 0;
    v_extra_names := array[]::text[];
    v_extra_snapshots := '[]'::jsonb;
    if jsonb_typeof(v_item->'adicionais') = 'array' then
      for v_extra in select value from jsonb_array_elements(v_item->'adicionais')
      loop
        v_extra_id := (v_extra->>'cardapio_item_id')::uuid;
        v_extra_quantity := (v_extra->>'quantidade')::integer;
        if v_extra_quantity is null or v_extra_quantity < 1 then
          raise exception 'Quantidade de adicional inválida.';
        end if;

        select ci.nome_comercial, ci.preco_venda
          into v_extra_name, v_extra_price
        from public.cardapio_itens ci
        join public.categorias_cardapio cc on cc.id = ci.categoria_id
        where ci.id = v_extra_id
          and ci.disponivel = true
          and ci.origem_tipo = 'insumo'
          and cc.ativa = true
          and cc.nome ~* 'adicion(al|ais)';
        if not found then
          raise exception 'Um dos adicionais não está mais disponível.';
        end if;

        v_extra_subtotal := round(v_extra_price * v_extra_quantity * v_quantity, 2);
        v_extra_total := v_extra_total + (v_extra_price * v_extra_quantity);
        v_extra_names := array_append(v_extra_names, v_extra_name);
        v_extra_snapshots := v_extra_snapshots || jsonb_build_array(jsonb_build_object(
          'id', v_extra_id,
          'name', v_extra_name,
          'price', v_extra_price,
          'quantity', v_extra_quantity
        ));
      end loop;
    end if;

    -- O preço unitário do item configurado inclui os adicionais escolhidos.
    v_unit_price := v_base_price + v_extra_total;
    v_line_subtotal := round(v_unit_price * v_quantity, 2);
    v_subtotal := v_subtotal + v_line_subtotal;
    v_observation := nullif(trim(v_item->>'observacao'), '');
    if cardinality(v_extra_names) > 0 then
      v_observation := concat_ws(E'\n', v_observation,
        'Adicionais: ' || array_to_string(v_extra_names, ', '));
    end if;

    insert into public.pedido_itens (
      pedido_id, cardapio_item_id, nome_produto, quantidade,
      preco_unitario, subtotal, observacao
    ) values (
      v_order_id,
      (v_item->>'cardapio_item_id')::uuid,
      v_product_name,
      v_quantity,
      v_unit_price,
      v_line_subtotal,
      v_observation
    ) returning id into v_order_item_id;

    if jsonb_array_length(v_extra_snapshots) > 0 then
      for v_extra in select value from jsonb_array_elements(v_extra_snapshots)
      loop
        v_extra_id := (v_extra->>'id')::uuid;
        v_extra_name := v_extra->>'name';
        v_extra_price := (v_extra->>'price')::numeric;
        v_extra_quantity := (v_extra->>'quantity')::integer;
        v_extra_subtotal := round(v_extra_price * v_extra_quantity * v_quantity, 2);
        insert into public.pedido_item_adicionais (
          pedido_item_id, cardapio_item_id, nome_adicional_snapshot,
          quantidade, preco_unitario, subtotal
        ) values (
          v_order_item_id, v_extra_id, v_extra_name,
          v_extra_quantity * v_quantity, v_extra_price, v_extra_subtotal
        );
      end loop;
    end if;
  end loop;

  -- Sem tabela de taxas no schema atual, a taxa é zero nesta versão.
  v_total := v_subtotal;
  update public.pedidos
  set subtotal = v_subtotal, taxa_entrega = 0, total = v_total
  where id = v_order_id;

  return query select v_order_id, v_order_number, v_total;
end;
$$;

revoke all on function public.registrar_pedido_publico(jsonb, jsonb) from public;
grant execute on function public.registrar_pedido_publico(jsonb, jsonb) to anon, authenticated;

