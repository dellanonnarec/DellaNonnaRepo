import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";
import { money, paymentLabels, statusLabels, type Order, type OrderStatus } from "./types";
import "./AdminPedidos.css";

const statusOrder: OrderStatus[] = ["recebido", "em_preparo", "saiu_para_entrega", "entregue", "cancelado"];
const formatTime = (date: string) => new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminPedidos() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"todos" | OrderStatus>("todos");
  const [type, setType] = useState("todos");
  const [payment, setPayment] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadOrders = async () => {
    if (!publicSupabase) return;
    const { data, error: loadError } = await publicSupabase.from("pedidos").select("*, pedido_itens(*)").order("created_at", { ascending: false });
    if (loadError) setError(loadError.message); else setOrders((data ?? []) as Order[]);
    setLoading(false);
  };
  useEffect(() => { void loadOrders(); const client = publicSupabase; if (!client) return; const channel = client.channel("admin-pedidos").on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => void loadOrders()).subscribe(); return () => { void client.removeChannel(channel); }; }, []);
  const filtered = useMemo(() => orders.filter((order) => {
    const query = search.toLocaleLowerCase();
    const matchesSearch = !query || `${order.numero_pedido} ${order.nome_cliente} ${order.telefone_cliente}`.toLocaleLowerCase().includes(query);
    return matchesSearch && (status === "todos" || order.status === status) && (type === "todos" || order.tipo_entrega === type) && (payment === "todos" || order.forma_pagamento === payment);
  }), [orders, search, status, type, payment]);
  const updateStatus = async (order: Order, nextStatus: OrderStatus) => { if (!publicSupabase) return; await publicSupabase.from("pedidos").update({ status: nextStatus }).eq("id", order.id); setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status: nextStatus } : item)); setSelected((current) => current?.id === order.id ? { ...current, status: nextStatus } : current); };
  return <main className="orders-page"><header className="orders-top"><div><p className="orders-eyebrow">OPERAÇÃO / PEDIDOS</p><h1>Pedidos</h1><p>Acompanhe cada pedido que chega à Della Nonna.</p></div><a className="kanban-link" href="/admin/pedidos/kanban">Abrir Kanban <ChevronRight size={17} /></a></header><section className="orders-toolbar"><label className="orders-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, cliente ou telefone" /></label><select value={status} onChange={(event) => setStatus(event.target.value as "todos" | OrderStatus)}><option value="todos">Todos os status</option>{statusOrder.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select><select value={type} onChange={(event) => setType(event.target.value)}><option value="todos">Delivery e retirada</option><option value="delivery">Delivery</option><option value="retirada">Retirada</option></select><select value={payment} onChange={(event) => setPayment(event.target.value)}><option value="todos">Todos pagamentos</option><option value="pix">PIX</option><option value="cartao">Cartão</option><option value="dinheiro">Dinheiro</option></select></section>{error && <div className="orders-error">{error}</div>}<section className="orders-table-wrap"><div className="orders-table-head"><strong>{filtered.length} pedidos</strong><span>Atualização em tempo real ativa</span></div>{loading ? <p className="orders-empty">Carregando pedidos...</p> : filtered.length === 0 ? <p className="orders-empty">Nenhum pedido encontrado.</p> : <div className="orders-table"><div className="orders-row orders-row-head"><span>Pedido</span><span>Cliente</span><span>Recebimento</span><span>Pagamento</span><span>Total</span><span>Status</span></div>{filtered.map((order) => <button className="orders-row" key={order.id} onClick={() => setSelected(order)}><span><b>#{order.numero_pedido}</b><small>{formatTime(order.created_at)}</small></span><span><b>{order.nome_cliente}</b><small>{order.telefone_cliente}</small></span><span>{order.tipo_entrega === "delivery" ? "Delivery" : "Retirada"}<small>{order.pedido_itens.length} {order.pedido_itens.length === 1 ? "item" : "itens"}</small></span><span>{paymentLabels[order.forma_pagamento]}</span><strong>{money(order.total)}</strong><span className={`status-badge status-${order.status}`}>{statusLabels[order.status]}</span></button>)}</div>}</section>{selected && <OrderDetail order={selected} onClose={() => setSelected(null)} onStatus={updateStatus} />}</main>;
}

function OrderDetail({ order, onClose, onStatus }: { order: Order; onClose: () => void; onStatus: (order: Order, status: OrderStatus) => void }) {
  return <div className="orders-modal-backdrop" onMouseDown={onClose}><aside className="order-detail" onMouseDown={(event) => event.stopPropagation()}><header><div><p className="orders-eyebrow">DETALHES DO PEDIDO</p><h2>#{order.numero_pedido}</h2><small>{formatTime(order.created_at)}</small></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><div className="detail-section"><h3>Cliente</h3><p><b>{order.nome_cliente}</b><br />{order.telefone_cliente}</p></div><div className="detail-section"><h3>{order.tipo_entrega === "delivery" ? "Endereço de entrega" : "Retirada no local"}</h3><p>{order.tipo_entrega === "delivery" ? `${order.rua}, ${order.numero}${order.complemento ? `, ${order.complemento}` : ""} - ${order.bairro}${order.cep ? ` · ${order.cep}` : ""}` : "Cliente retirará na pizzaria"}</p>{order.referencia && <small>Ref.: {order.referencia}</small>}</div><div className="detail-section"><h3>Itens</h3><div className="detail-items">{order.pedido_itens.map((item) => <div key={item.id}><span>{item.quantidade}x {item.nome_produto}{item.observacao && <small>{item.observacao}</small>}</span><b>{money(item.subtotal)}</b></div>)}</div></div><div className="detail-finance"><span>Subtotal <b>{money(order.subtotal)}</b></span><span>Entrega <b>{money(order.taxa_entrega)}</b></span><strong>Total <b>{money(order.total)}</b></strong><span>Pagamento <b>{paymentLabels[order.forma_pagamento]}</b></span></div><label className="detail-status">Status<select value={order.status} onChange={(event) => onStatus(order, event.target.value as OrderStatus)}>{statusOrder.map((value) => <option value={value} key={value}>{statusLabels[value]}</option>)}</select></label></aside></div>;
}
