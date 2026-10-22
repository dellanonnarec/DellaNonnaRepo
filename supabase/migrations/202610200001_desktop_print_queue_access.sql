-- A estação desktop usa a sessão do usuário autenticado; nenhuma service_role
-- é distribuída no instalador. O acesso acompanha o modelo administrativo atual
-- do projeto, que protege os dados operacionais para authenticated.
grant select, insert, update, delete on public.fila_impressao_pedidos to authenticated;

drop policy if exists "authenticated users can manage print queue" on public.fila_impressao_pedidos;
create policy "authenticated users can manage print queue"
  on public.fila_impressao_pedidos
  for all
  to authenticated
  using (true)
  with check (true);
