-- Guarda os dados de identificação e o endereço de entrega mais recente
-- para permitir que o cliente os reutilize no checkout público.
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  nome_normalizado text not null,
  whatsapp text not null,
  whatsapp_normalizado text not null,
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  referencia text,
  ultimo_pedido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clientes_identidade_key unique (nome_normalizado, whatsapp_normalizado)
);

alter table public.pedidos
  add column if not exists cliente_id uuid references public.clientes(id) on delete set null;

create index if not exists pedidos_cliente_id_idx on public.pedidos(cliente_id);

alter table public.clientes enable row level security;
revoke all on table public.clientes from anon, authenticated;

-- Migra os endereços de entrega já existentes para que clientes recorrentes
-- também possam reutilizar um endereço anterior após aplicar esta migration.
with pedidos_entrega as (
  select
    trim(p.nome_cliente) as nome_completo,
    lower(regexp_replace(trim(p.nome_cliente), '[[:space:]]+', ' ', 'g')) as nome_normalizado,
    trim(p.telefone_cliente) as whatsapp,
    regexp_replace(p.telefone_cliente, '[^0-9]', '', 'g') as whatsapp_normalizado,
    nullif(trim(p.cep), '') as cep,
    nullif(trim(p.rua), '') as rua,
    nullif(trim(p.numero), '') as numero,
    nullif(trim(p.complemento), '') as complemento,
    nullif(trim(p.bairro), '') as bairro,
    nullif(trim(p.referencia), '') as referencia,
    p.created_at,
    row_number() over (
      partition by
        lower(regexp_replace(trim(p.nome_cliente), '[[:space:]]+', ' ', 'g')),
        regexp_replace(p.telefone_cliente, '[^0-9]', '', 'g')
      order by p.created_at desc
    ) as position
  from public.pedidos p
  where p.tipo_entrega = 'delivery'
)
insert into public.clientes (
  nome_completo, nome_normalizado, whatsapp, whatsapp_normalizado,
  cep, rua, numero, complemento, bairro, referencia, ultimo_pedido_em
)
select
  nome_completo, nome_normalizado, whatsapp, whatsapp_normalizado,
  cep, rua, numero, complemento, bairro, referencia, created_at
from pedidos_entrega
where position = 1
on conflict (nome_normalizado, whatsapp_normalizado) do update set
  nome_completo = excluded.nome_completo,
  whatsapp = excluded.whatsapp,
  cep = excluded.cep,
  rua = excluded.rua,
  numero = excluded.numero,
  complemento = excluded.complemento,
  bairro = excluded.bairro,
  referencia = excluded.referencia,
  ultimo_pedido_em = excluded.ultimo_pedido_em,
  updated_at = now();

update public.pedidos p
set cliente_id = c.id
from public.clientes c
where c.nome_normalizado = lower(regexp_replace(trim(p.nome_cliente), '[[:space:]]+', ' ', 'g'))
  and c.whatsapp_normalizado = regexp_replace(p.telefone_cliente, '[^0-9]', '', 'g')
  and p.cliente_id is distinct from c.id;

create or replace function public.vincular_cliente_ao_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.clientes (
    nome_completo, nome_normalizado, whatsapp, whatsapp_normalizado,
    cep, rua, numero, complemento, bairro, referencia, ultimo_pedido_em
  ) values (
    trim(new.nome_cliente),
    lower(regexp_replace(trim(new.nome_cliente), '[[:space:]]+', ' ', 'g')),
    trim(new.telefone_cliente),
    regexp_replace(new.telefone_cliente, '[^0-9]', '', 'g'),
    case when new.tipo_entrega = 'delivery' then nullif(trim(new.cep), '') end,
    case when new.tipo_entrega = 'delivery' then nullif(trim(new.rua), '') end,
    case when new.tipo_entrega = 'delivery' then nullif(trim(new.numero), '') end,
    case when new.tipo_entrega = 'delivery' then nullif(trim(new.complemento), '') end,
    case when new.tipo_entrega = 'delivery' then nullif(trim(new.bairro), '') end,
    case when new.tipo_entrega = 'delivery' then nullif(trim(new.referencia), '') end,
    coalesce(new.created_at, now())
  )
  on conflict (nome_normalizado, whatsapp_normalizado) do update set
    nome_completo = excluded.nome_completo,
    whatsapp = excluded.whatsapp,
    cep = case when new.tipo_entrega = 'delivery' then excluded.cep else clientes.cep end,
    rua = case when new.tipo_entrega = 'delivery' then excluded.rua else clientes.rua end,
    numero = case when new.tipo_entrega = 'delivery' then excluded.numero else clientes.numero end,
    complemento = case when new.tipo_entrega = 'delivery' then excluded.complemento else clientes.complemento end,
    bairro = case when new.tipo_entrega = 'delivery' then excluded.bairro else clientes.bairro end,
    referencia = case when new.tipo_entrega = 'delivery' then excluded.referencia else clientes.referencia end,
    ultimo_pedido_em = excluded.ultimo_pedido_em,
    updated_at = now()
  returning id into new.cliente_id;

  return new;
end;
$$;

revoke all on function public.vincular_cliente_ao_pedido() from public, anon, authenticated;

drop trigger if exists pedidos_vincular_cliente on public.pedidos;
create trigger pedidos_vincular_cliente
before insert on public.pedidos
for each row execute function public.vincular_cliente_ao_pedido();

create or replace function public.buscar_endereco_cliente_checkout(
  p_nome_completo text,
  p_whatsapp text
)
returns table (
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  referencia text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.cep, c.rua, c.numero, c.complemento, c.bairro, c.referencia
  from public.clientes c
  where c.nome_normalizado = lower(regexp_replace(trim(coalesce(p_nome_completo, '')), '[[:space:]]+', ' ', 'g'))
    and c.whatsapp_normalizado = regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g')
    and c.cep is not null
    and c.rua is not null
    and c.numero is not null
    and c.bairro is not null
  limit 1;
$$;

revoke all on function public.buscar_endereco_cliente_checkout(text, text) from public;
grant execute on function public.buscar_endereco_cliente_checkout(text, text) to anon, authenticated;
