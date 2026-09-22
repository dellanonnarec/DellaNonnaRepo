export type OrderStatus = "recebido" | "em_preparo" | "saiu_para_entrega" | "entregue" | "cancelado";
export type Order = {
  id: string; numero_pedido: number; nome_cliente: string; telefone_cliente: string;
  tipo_entrega: "delivery" | "retirada"; cep: string | null; rua: string | null; numero: string | null;
  complemento: string | null; bairro: string | null; referencia: string | null;
  forma_pagamento: "pix" | "cartao" | "dinheiro"; subtotal: number; taxa_entrega: number; total: number;
  observacao: string | null; status: OrderStatus; created_at: string; updated_at: string;
  pedido_itens: OrderItem[];
};
export type OrderItem = { id: string; nome_produto: string; quantidade: number; preco_unitario: number; subtotal: number; observacao: string | null };
export const statusLabels: Record<OrderStatus, string> = { recebido: "Recebidos", em_preparo: "Preparando", saiu_para_entrega: "Saiu para entrega", entregue: "Entregues", cancelado: "Cancelados" };
export const paymentLabels = { pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro" };
export const money = (value: number) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
