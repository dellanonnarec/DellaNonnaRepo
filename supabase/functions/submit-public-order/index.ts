import { calculateDelivery, corsHeaders, DeliveryError, jsonResponse } from "../_shared/delivery.ts";

type OrderBody = {
  customer?: { name?: string; whatsapp?: string };
  fulfillment?: "delivery" | "retirada";
  address?: Record<string, unknown>;
  payment?: "pix" | "cartao" | "dinheiro";
  valor_recebido?: number | null;
  items?: Array<{ cardapio_item_id: string; quantidade: number; observacao?: string | null; adicionais?: Array<{ cardapio_item_id: string; quantidade: number }> }>;
};

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);
  try {
    const body = await request.json() as OrderBody;
    const name = body.customer?.name?.trim() ?? "";
    const phone = body.customer?.whatsapp?.trim() ?? "";
    const fulfillment = body.fulfillment;
    const payment = body.payment;
    if (name.length < 2 || name.length > 100) throw new DeliveryError("Informe seu nome completo.");
    if (phone.replace(/\D/g, "").length < 8) throw new DeliveryError("Informe um WhatsApp válido.");
    if (fulfillment !== "delivery" && fulfillment !== "retirada") throw new DeliveryError("Selecione entrega ou retirada.");
    if (payment !== "pix" && payment !== "cartao" && payment !== "dinheiro") throw new DeliveryError("Selecione uma forma de pagamento.");
    if (!Array.isArray(body.items) || body.items.length === 0) throw new DeliveryError("A sacola está vazia.");

    let fee = 0;
    let distance: number | null = null;
    let feePending = false;
    let feeMode: "fixa" | "dinamica" | "pendente" | null = null;
    let address: Record<string, unknown> = {};
    if (fulfillment === "delivery") {
      if (!body.address || typeof body.address !== "object") throw new DeliveryError("Informe o endereço de entrega.");
      const quote = await calculateDelivery(body.address);
      feePending = quote.manual_confirmation;
      fee = quote.taxa_entrega ?? 0;
      distance = quote.distance_km;
      feeMode = feePending ? "pendente" : quote.modo;
      address = body.address;
    }
    const received = payment === "dinheiro" && body.valor_recebido != null ? Number(body.valor_recebido) : null;
    if (received !== null && (!Number.isFinite(received) || received < 0)) throw new DeliveryError("Valor recebido inválido.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new DeliveryError("O serviço de pedidos não está configurado no servidor.", 503);
    const payload = {
      p_pedido: {
        nome_cliente: name,
        telefone_cliente: phone,
        tipo_entrega: fulfillment,
        cep: fulfillment === "delivery" ? String(address.cep ?? "").trim() : null,
        rua: fulfillment === "delivery" ? String(address.rua ?? "").trim() : null,
        numero: fulfillment === "delivery" ? String(address.numero ?? "").trim() : null,
        complemento: fulfillment === "delivery" ? String(address.complemento ?? "").trim() || null : null,
        bairro: fulfillment === "delivery" ? String(address.bairro ?? "").trim() : null,
        cidade: fulfillment === "delivery" ? String(address.cidade ?? "").trim() : null,
        referencia: fulfillment === "delivery" ? String(address.referencia ?? "").trim() || null : null,
        forma_pagamento: payment,
        taxa_entrega: fee,
        distancia_entrega_km: distance,
        taxa_entrega_pendente: feePending,
        modo_taxa_entrega: feeMode,
        valor_recebido: received,
        observacao: null,
      },
      p_itens: body.items,
    };
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/registrar_pedido_publico_com_acompanhamento`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null) as Array<Record<string, unknown>> | Record<string, unknown> | null;
    if (!response.ok) {
      const detail = result && !Array.isArray(result) && typeof result.message === "string" ? result.message : "Não foi possível registrar o pedido.";
      throw new DeliveryError(detail, response.status >= 500 ? 500 : 422);
    }
    const row = Array.isArray(result) ? result[0] : result;
    const trackingCode = row?.tracking_code ?? row?.codigo_acompanhamento;
    if (typeof trackingCode !== "string" || !trackingCode) throw new DeliveryError("O pedido foi criado, mas o código de acompanhamento não retornou.", 502);
    return jsonResponse({ tracking_code: trackingCode, taxa_entrega: feePending ? null : fee, taxa_entrega_pendente: feePending });
  } catch (error) {
    const status = error instanceof DeliveryError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Falha ao enviar o pedido.";
    if (!(error instanceof DeliveryError)) console.error("submit-public-order failed", error);
    return jsonResponse({ error: message }, status);
  }
});
