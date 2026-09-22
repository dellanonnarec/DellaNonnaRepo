import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";
import { money, paymentLabels, statusLabels, type Order, type OrderStatus } from "./types";
import "./AdminPedidos.css";

const columns: OrderStatus[] = ["recebido", "em_preparo", "saiu_para_entrega", "entregue", "cancelado"];
const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { recebido: "em_preparo", em_preparo: "saiu_para_entrega", saiu_para_entrega: "entregue" };
const previousStatus: Partial<Record<OrderStatus, OrderStatus>> = { em_preparo: "recebido", saiu_para_entrega: "em_preparo", entregue: "saiu_para_entrega" };
const formatTime = (date: string) => new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export default function AdminPedidosKanban() {
  const [orders, setOrders] = useState<Order[]>([]); const [loading, setLoading] = useState(true);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStatus | null>(null);
  const loadOrders = async () => { if (!publicSupabase) return; const { data } = await publicSupabase.from("pedidos").select("*, pedido_itens(*)").order("created_at", { ascending: true }); setOrders((data ?? []) as Order[]); setLoading(false); };
  useEffect(() => { void loadOrders(); const client = publicSupabase; if (!client) return; const channel = client.channel("kanban-pedidos").on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => void loadOrders()).subscribe(); return () => { void client.removeChannel(channel); }; }, []);
  const move = async (order: Order, status: OrderStatus) => {
    if (!publicSupabase || order.status === status) return;
    const previous = order.status;
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status } : item));
    const { error } = await publicSupabase.from("pedidos").update({ status }).eq("id", order.id);
    if (error) setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: previous } : item));
  };
  const startDragging = (event: DragEvent<HTMLElement>, order: Order) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", order.id);
    setDraggingOrderId(order.id);
  };
  const finishDragging = () => { setDraggingOrderId(null); setDropTarget(null); };
  const allowDrop = (event: DragEvent<HTMLElement>, column: OrderStatus) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(column);
  };
  const dropOrder = (event: DragEvent<HTMLElement>, column: OrderStatus) => {
    event.preventDefault();
    const order = orders.find((item) => item.id === event.dataTransfer.getData("text/plain"));
    if (order) void move(order, column);
    finishDragging();
  };
  return <main className="kanban-page"><header className="kanban-top"><div><a className="back-admin" href="/admin/pedidos"><ArrowLeft size={16} /> Pedidos</a><p className="orders-eyebrow">CENTRAL DE PRODUÇÃO</p><h1>Kanban de pedidos</h1></div><button className="refresh-button" onClick={() => void loadOrders()} title="Atualizar pedidos"><RefreshCw size={17} /> Atualizar</button></header><div className="kanban-board">{columns.map((column) => <section className={`kanban-column column-${column}${dropTarget === column ? " is-drop-target" : ""}`} key={column} onDragOver={(event) => allowDrop(event, column)} onDragEnter={(event) => allowDrop(event, column)} onDragLeave={(event) => { if (event.currentTarget === event.target) setDropTarget(null); }} onDrop={(event) => dropOrder(event, column)}><header><div><span className="column-dot" /><h2>{statusLabels[column]}</h2></div><b>{orders.filter((order) => order.status === column).length}</b></header><div className="kanban-cards">{loading ? <p className="kanban-empty">Carregando...</p> : orders.filter((order) => order.status === column).map((order) => <article className={`kanban-card${draggingOrderId === order.id ? " is-dragging" : ""}`} draggable onDragStart={(event) => startDragging(event, order)} onDragEnd={finishDragging} key={order.id}><div className="kanban-card-top"><strong>#{order.numero_pedido}</strong><time>{formatTime(order.created_at)}</time></div><h3>{order.nome_cliente}</h3><p>{order.pedido_itens.map((item) => `${item.quantidade}x ${item.nome_produto}`).join(" · ")}</p><div className="kanban-card-bottom"><span>{order.tipo_entrega === "delivery" ? "Delivery" : "Retirada"} · {paymentLabels[order.forma_pagamento]}</span><b>{money(order.total)}</b></div><div className="kanban-actions">{previousStatus[column] && <button onClick={() => void move(order, previousStatus[column] as OrderStatus)}><ChevronDown size={15} /> Voltar</button>}{nextStatus[column] && <button onClick={() => void move(order, nextStatus[column] as OrderStatus)}>Avançar <ChevronRight size={15} /></button>}</div></article>)}</div></section>)}</div></main>;
}
