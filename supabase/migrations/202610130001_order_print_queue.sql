-- Fila durável da estação local de impressão.
-- Não há backfill: somente pedidos novos, criados após esta migration, entram na fila.
create table if not exists public.fila_impressao_pedidos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique
    references public.pedidos(id) on delete cascade,
  status text not null default 'pendente'
    check (status in ('pendente', 'processando', 'enviado', 'erro')),
  tentativas integer not null default 0 check (tentativas >= 0),
  proxima_tentativa_em timestamptz not null default now(),
  agente_id text,
  iniciado_em timestamptz,
  enviado_em timestamptz,
  ultimo_erro text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists fila_impressao_pedidos_pendentes_idx
  on public.fila_impressao_pedidos(proxima_tentativa_em, criado_em)
  where status = 'pendente';

create index if not exists fila_impressao_pedidos_status_idx
  on public.fila_impressao_pedidos(status, atualizado_em desc);

alter table public.fila_impressao_pedidos enable row level security;
revoke all on public.fila_impressao_pedidos from anon, authenticated;
grant all on public.fila_impressao_pedidos to service_role;

create or replace function public.enqueue_order_print()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'recebido' then
    insert into public.fila_impressao_pedidos(pedido_id)
    values (new.id)
    on conflict (pedido_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_order_print() from public, anon, authenticated;
drop trigger if exists pedidos_enqueue_print on public.pedidos;
create trigger pedidos_enqueue_print
  after insert on public.pedidos
  for each row execute function public.enqueue_order_print();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_rel
      where prpubid = (select oid from pg_publication where pubname = 'supabase_realtime')
        and prrelid = 'public.fila_impressao_pedidos'::regclass
    ) then
    alter publication supabase_realtime add table public.fila_impressao_pedidos;
  end if;
exception when undefined_object then
  null;
end;
$$;
