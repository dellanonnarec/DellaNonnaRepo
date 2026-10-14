import { publicSupabase } from "../../lib/supabase";
import type { CartItem, Customer, DeliveryAddress, PaymentMethod } from "./types";

type SubmitPublicOrderArgs = {
  items: CartItem[];
  customer: Customer;
  fulfillment: "delivery" | "retirada";
  address: DeliveryAddress;
  payment: PaymentMethod;
  subtotal: number;
  deliveryFee: number;
};

export async function submitPublicOrder({
  items,
  customer,
  fulfillment,
  address,
  payment,
  subtotal,
  deliveryFee,
}: SubmitPublicOrderArgs): Promise<string> {
  if (!publicSupabase) throw new Error("O serviço de pedidos não está configurado.");

  const fee = fulfillment === "delivery" ? deliveryFee : 0;
  const { data, error } = await publicSupabase.rpc(
    "registrar_pedido_publico_com_acompanhamento",
    {
      p_pedido: {
        nome_cliente: customer.name.trim(),
        telefone_cliente: customer.whatsapp.trim(),
        tipo_entrega: fulfillment,
        cep: fulfillment === "delivery" ? address.cep.trim() : null,
        rua: fulfillment === "delivery" ? address.rua.trim() : null,
        numero: fulfillment === "delivery" ? address.numero.trim() : null,
        complemento: fulfillment === "delivery" ? address.complemento.trim() || null : null,
        bairro: fulfillment === "delivery" ? address.bairro.trim() : null,
        cidade: fulfillment === "delivery" ? address.cidade.trim() : null,
        referencia: fulfillment === "delivery" ? address.referencia.trim() || null : null,
        forma_pagamento: payment,
        subtotal,
        taxa_entrega: fee,
        total: subtotal + fee,
        observacao: null,
      },
      p_itens: items.map((item) => ({
        cardapio_item_id: item.menuItemId,
        quantidade: item.quantity,
        observacao: item.observation || null,
        adicionais: item.additions.map((addition) => ({
          cardapio_item_id: addition.menuItemId,
          quantidade: addition.quantityPerItem,
        })),
      })),
    },
  );
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  const trackingCode =
    result?.tracking_code ?? result?.codigo_acompanhamento;
  if (typeof trackingCode !== "string" || !trackingCode.trim()) {
    console.error(
      "A resposta do RPC de pedido não trouxe um código de acompanhamento. Campos retornados:",
      result && typeof result === "object" ? Object.keys(result) : typeof result,
    );
    throw new Error("O pedido foi criado sem código de acompanhamento.");
  }
  return trackingCode.trim().toUpperCase();
}
