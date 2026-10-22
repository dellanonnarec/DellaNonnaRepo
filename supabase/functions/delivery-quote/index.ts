import { calculateDelivery, corsHeaders, DeliveryError, jsonResponse } from "../_shared/delivery.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);
  try {
    const body = await request.json();
    const quote = await calculateDelivery(body.address);
    return jsonResponse(quote);
  } catch (error) {
    const status = error instanceof DeliveryError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Falha ao calcular a entrega.";
    if (!(error instanceof DeliveryError)) console.error("delivery-quote failed", error);
    return jsonResponse({ error: message }, status);
  }
});
