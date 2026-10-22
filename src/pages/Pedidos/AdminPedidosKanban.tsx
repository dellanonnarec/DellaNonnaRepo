import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { ArrowLeft, RefreshCw, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";
import {
  money,
  paymentLabels,
  statusLabels,
  type Order,
  type OrderStatus,
} from "./types";
import "./AdminPedidos.css";

const columns: OrderStatus[] = [
  "recebido",
  "em_preparo",
  "saiu_para_entrega",
  "entregue",
  "cancelado",
];
const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function AdminPedidosKanban() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<OrderStatus | null>(null);
  const [search, setSearch] = useState("");
  const loadOrders = async () => {
    if (!publicSupabase) return;
    const { data } = await publicSupabase
      .from("pedidos")
      .select("*, pedido_itens(*)")
      .order("created_at", { ascending: true });
    setOrders((data ?? []) as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadOrders();
    const client = publicSupabase;
    if (!client) return;
    const channel = client
      .channel("kanban-pedidos-interactive")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => void loadOrders(),
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, []);
  const move = async (order: Order, status: OrderStatus) => {
    if (order.tipo_entrega === "retirada" && status === "saiu_para_entrega") return;
    if (!publicSupabase || order.status === status) return;
    const previous = order.status;
    setOrders((current) =>
      current.map((item) =>
        item.id === order.id ? { ...item, status } : item,
      ),
    );
    setSelectedOrder((current) =>
      current?.id === order.id ? { ...current, status } : current,
    );
    const { error } = await publicSupabase
      .from("pedidos")
      .update({ status })
      .eq("id", order.id);
    if (error) {
      setOrders((current) =>
        current.map((item) =>
          item.id === order.id ? { ...item, status: previous } : item,
        ),
      );
      setSelectedOrder((current) =>
        current?.id === order.id ? { ...current, status: previous } : current,
      );
    }
  };
  const startDragging = (event: DragEvent<HTMLElement>, order: Order) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", order.id);
    setDraggingOrderId(order.id);
  };
  const finishDragging = () => {
    setDraggingOrderId(null);
    setDropTarget(null);
  };
  const allowDrop = (event: DragEvent<HTMLElement>, column: OrderStatus) => {
    const draggedOrder = orders.find((order) => order.id === draggingOrderId);
    if (draggedOrder?.tipo_entrega === "retirada" && column === "saiu_para_entrega") {
      event.dataTransfer.dropEffect = "none";
      setDropTarget(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTarget(column);
  };
  const dropOrder = (event: DragEvent<HTMLElement>, column: OrderStatus) => {
    event.preventDefault();
    const order = orders.find(
      (item) => item.id === event.dataTransfer.getData("text/plain"),
    );
    if (order && !(order.tipo_entrega === "retirada" && column === "saiu_para_entrega")) void move(order, column);
    finishDragging();
  };
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visibleOrders = normalizedSearch
    ? orders.filter((order) => [String(order.numero_pedido), `#${order.numero_pedido}`, order.codigo_acompanhamento ?? "", order.nome_cliente]
        .some((value) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedSearch)))
    : orders;
  return (
    <main className="kanban-page">
      <header className="kanban-top">
        <div>
          <Link className="back-admin" to="/admin/pedidos">
            <ArrowLeft size={16} /> Pedidos
          </Link>
          <p className="orders-eyebrow">CENTRAL DE PRODUÇÃO</p>
          <h1>Kanban de pedidos</h1>
          <p className="kanban-hint">
            Clique em um card para ver todos os dados do pedido.
          </p>
        </div>
        <div className="kanban-toolbar">
          <label className="kanban-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Número, código ou nome do cliente"
              aria-label="Buscar pedido por número, código de acompanhamento ou nome do cliente"
            />
          </label>
          <button
            className="refresh-button"
            onClick={() => void loadOrders()}
            title="Atualizar pedidos"
          >
            <RefreshCw size={17} /> Atualizar
          </button>
        </div>
      </header>
      <div className="kanban-board">
        {columns.map((column) => (
          <section
            className={`kanban-column column-${column}${dropTarget === column ? " is-drop-target" : ""}${column === "saiu_para_entrega" && orders.some((order) => order.id === draggingOrderId && order.tipo_entrega === "retirada") ? " is-drop-disabled" : ""}`}
            key={column}
            title={column === "saiu_para_entrega" && orders.some((order) => order.id === draggingOrderId && order.tipo_entrega === "retirada") ? "Pedidos de retirada não podem ir para entrega" : undefined}
            onDragOver={(event) => allowDrop(event, column)}
            onDragEnter={(event) => allowDrop(event, column)}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDropTarget(null);
            }}
            onDrop={(event) => dropOrder(event, column)}
          >
            <header>
              <div>
                <span className="column-dot" />
                <h2>{statusLabels[column]}</h2>
              </div>
              <b>{visibleOrders.filter((order) => order.status === column).length}</b>
            </header>
            <div className="kanban-cards">
              {loading ? (
                <p className="kanban-empty">Carregando...</p>
              ) : (
                visibleOrders
                  .filter((order) => order.status === column)
                  .map((order) => (
                    <article
                      className={`kanban-card fulfillment-${order.tipo_entrega}${draggingOrderId === order.id ? " is-dragging" : ""}`}
                      draggable
                      onDragStart={(event) => startDragging(event, order)}
                      onDragEnd={finishDragging}
                      onClick={() => setSelectedOrder(order)}
                      key={order.id}
                    >
                      <div className="kanban-card-top">
                        <strong>#{order.numero_pedido}</strong>
                        <span className={`kanban-fulfillment-badge ${order.tipo_entrega}`}>
                          {order.tipo_entrega === "delivery" ? "Delivery" : "Retirada"}
                        </span>
                        <time>{formatTime(order.created_at)}</time>
                      </div>
                      <h3>{order.nome_cliente}</h3>
                      <p>
                        {order.pedido_itens
                          .map(
                            (item) =>
                              `${item.quantidade}x ${item.nome_produto}`,
                          )
                          .join(" · ")}
                      </p>
                      <div className="kanban-card-bottom">
                        <span>{paymentLabels[order.forma_pagamento]}</span>
                        <b>{money(order.total)}</b>
                      </div>
                    </article>
                  ))
              )}
              {!loading && visibleOrders.filter((order) => order.status === column).length === 0 && (
                <p className="kanban-empty">{normalizedSearch ? "Nenhum pedido encontrado." : "Nenhum pedido nesta etapa."}</p>
              )}
            </div>
          </section>
        ))}
      </div>
      {selectedOrder && (
        <KanbanOrderDetails
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatus={(status) => void move(selectedOrder, status)}
        />
      )}
    </main>
  );
}

function KanbanOrderDetails({
  order,
  onClose,
  onStatus,
}: {
  order: Order;
  onClose: () => void;
  onStatus: (status: OrderStatus) => void;
}) {
  return (
    <div className="kanban-detail-backdrop" onMouseDown={onClose}>
      <aside
        className="kanban-detail-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="orders-eyebrow">DETALHES DO PEDIDO</p>
            <h2>#{order.numero_pedido}</h2>
            <small>
              {order.nome_cliente} · {formatTime(order.created_at)}
            </small>
          </div>
          <button onClick={onClose} aria-label="Fechar detalhes">
            <X size={19} />
          </button>
        </header>
        <section>
          <h3>Cliente</h3>
          <p>
            <strong>{order.nome_cliente}</strong>
            <br />
            {order.telefone_cliente}
          </p>
        </section>
        <section>
          <h3>{order.tipo_entrega === "delivery" ? "Entrega" : "Retirada"}</h3>
          <p>
            {order.tipo_entrega === "delivery"
              ? `${order.rua}, ${order.numero}${order.complemento ? `, ${order.complemento}` : ""} - ${order.bairro}${order.cep ? ` · CEP ${order.cep}` : ""}`
              : "Retirada no local"}
          </p>
          {order.referencia && <small>Referência: {order.referencia}</small>}
        </section>
        <section>
          <h3>Itens do pedido</h3>
          <div className="kanban-detail-items">
            {order.pedido_itens.map((item) => (
              <div key={item.id}>
                <span>
                  <strong>{item.quantidade}x</strong> {item.nome_produto}
                  {item.observacao && <small>{item.observacao}</small>}
                </span>
                <b>{money(item.subtotal)}</b>
              </div>
            ))}
          </div>
        </section>
        {order.observacao && (
          <section>
            <h3>Observação</h3>
            <p>{order.observacao}</p>
          </section>
        )}
        <section className="kanban-detail-finance">
          <div>
            <span>Subtotal</span>
            <b>{money(order.subtotal)}</b>
          </div>
          <div>
            <span>{order.modo_taxa_entrega === "fixa" ? "Entrega fixa" : "Taxa de entrega"}</span>
            <b>{order.taxa_entrega_pendente ? "A confirmar" : money(order.taxa_entrega)}</b>
          </div>
          <div className="kanban-detail-total">
            <strong>{order.taxa_entrega_pendente ? "Total parcial" : "Total"}</strong>
            <b>{money(order.total)}</b>
          </div>
          {order.taxa_entrega_pendente && <small className="text-[#8a5a13]">Confirmar a taxa de entrega com o cliente antes do preparo.</small>}
          <div>
            <span>Pagamento</span>
            <b>{paymentLabels[order.forma_pagamento]}</b>
          </div>
        </section>
        <label className="kanban-detail-status">
          Status
          <select
            value={order.status}
            onChange={(event) => onStatus(event.target.value as OrderStatus)}
          >
            {columns.map((status) => (
              <option value={status} key={status} disabled={order.tipo_entrega === "retirada" && status === "saiu_para_entrega"}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          {order.tipo_entrega === "retirada" && (
            <small>Pedidos de retirada não podem ser marcados como “Saiu para entrega”.</small>
          )}
        </label>
      </aside>
    </div>
  );
}
