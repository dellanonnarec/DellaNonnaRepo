import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadOrderForReceipt(supabase: SupabaseClient, orderId: string) {
  const { data: order, error } = await supabase
    .from("pedidos")
    .select("*, pedido_itens(*)")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  if (!order) throw new Error("O pedido não foi encontrado.");

  const items = order.pedido_itens ?? [];
  if (!items.length) return order;

  const catalogIds = [...new Set(items.map((item: { cardapio_item_id?: string | null }) => item.cardapio_item_id).filter(Boolean))];
  if (catalogIds.length) {
    const { data: catalogItems, error: catalogError } = await supabase
      .from("cardapio_itens")
      .select("id, categoria_id")
      .in("id", catalogIds);
    if (catalogError) throw catalogError;

    const categoryIds = [...new Set((catalogItems ?? []).map((item) => item.categoria_id).filter(Boolean))];
    const { data: categories, error: categoriesError } = categoryIds.length
      ? await supabase.from("categorias_cardapio").select("id, nome").in("id", categoryIds)
      : { data: [], error: null };
    if (categoriesError) throw categoriesError;

    const namesById = new Map((categories ?? []).map((category) => [category.id, category.nome]));
    const categoryByProduct = new Map((catalogItems ?? []).map((item) => [item.id, namesById.get(item.categoria_id) ?? ""]));
    for (const item of items) item.categoria = categoryByProduct.get(item.cardapio_item_id) ?? "";
  }

  const { data: additions, error: additionsError } = await supabase
    .from("pedido_item_adicionais")
    .select("pedido_item_id, nome_adicional_snapshot, quantidade, preco_unitario, subtotal")
    .in("pedido_item_id", items.map((item: { id: string }) => item.id));
  if (additionsError) throw additionsError;
  order.adicionaisPorItem = (additions ?? []).reduce<Record<string, typeof additions>>((grouped, item) => {
    const key = item.pedido_item_id;
    grouped[key] = [...(grouped[key] ?? []), item];
    return grouped;
  }, {});
  return order;
}
