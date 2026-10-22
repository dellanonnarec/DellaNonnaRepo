import { publicSupabase } from "../../lib/supabase";
import type { CartItem, Customer, DeliveryAddress, PaymentMethod } from "./types";

type SubmitPublicOrderArgs = {
  items: CartItem[];
  customer: Customer;
  fulfillment: "delivery" | "retirada";
  address: DeliveryAddress;
  payment: PaymentMethod;
  valorRecebido: number | null;
};

export async function submitPublicOrder({
  items,
  customer,
  fulfillment,
  address,
  payment,
  valorRecebido,
}: SubmitPublicOrderArgs): Promise<string> {
  if (!publicSupabase) throw new Error("O serviço de pedidos não está configurado.");

  const { data, error } = await publicSupabase.functions.invoke("submit-public-order", {
    body: {
      customer,
      fulfillment,
      address,
      payment,
      valor_recebido: payment === "dinheiro" ? valorRecebido : null,
      items: items.map((item) => ({
        cardapio_item_id: item.menuItemId,
        quantidade: item.quantity,
        observacao: item.observation || null,
        adicionais: item.additions.map((addition) => ({
          cardapio_item_id: addition.menuItemId,
          quantidade: addition.quantityPerItem,
        })),
      })),
    },
  });
  if (error) {
    let message = error.message;
    const context = (error as Error & { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: string } | null;
      if (payload?.error) message = payload.error;
    }
    throw new Error(message);
  }

  const trackingCode = data?.tracking_code ?? data?.codigo_acompanhamento;
  if (typeof trackingCode !== "string" || !trackingCode.trim()) {
    console.error(
      "A resposta da função de pedido não trouxe um código de acompanhamento. Campos retornados:",
      data && typeof data === "object" ? Object.keys(data) : typeof data,
    );
    throw new Error("O pedido foi criado sem código de acompanhamento.");
  }
  return trackingCode.trim().toUpperCase();
}
