import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, ClipboardList, LoaderCircle, TrendingUp } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";
import "./AdminDashboard.css";

type DashboardItem = { nome_produto: string; quantidade: number; subtotal: number | string };
type DashboardOrder = {
  id: string;
  status: string;
  total: number | string;
  tipo_entrega: string;
  forma_pagamento: string;
  created_at: string;
  pedido_itens: DashboardItem[] | null;
};
type Bucket = { key: string; label: string; sales: number; orders: number };
type MonthPickerProps = { caption: string; value: string; min?: string; max?: string; onChange: (value: string) => void };

const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
const monthValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const startOfMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
};
const addMonths = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth() + amount, 1);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const monthLabel = (date: Date) => new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
const monthNames = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2020, index, 1)));

function MonthPicker({ caption, value, min, max, onChange }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [visibleYear, setVisibleYear] = useState(Number(value.slice(0, 4)));
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedYear = Number(value.slice(0, 4));
  const selectedMonth = Number(value.slice(5, 7));
  const minYear = min ? Number(min.slice(0, 4)) : undefined;
  const maxYear = max ? Number(max.slice(0, 4)) : undefined;
  const formatted = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(new Date(selectedYear, selectedMonth - 1, 1));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return <div className="dashboard-month-picker" ref={rootRef}>
    <button type="button" className="dashboard-month-trigger" aria-label={`${caption}: ${formatted}`} aria-expanded={open} onClick={() => { setVisibleYear(selectedYear); setOpen((current) => !current); }}>
      <CalendarDays size={16} aria-hidden="true" />
      <span className="dashboard-picker-caption">{caption}</span>
      <strong>{formatted}</strong>
      <ChevronRight size={14} className={open ? "is-open" : ""} aria-hidden="true" />
    </button>
    {open && <div className="dashboard-month-popover" role="dialog" aria-label={`Selecionar ${caption.toLowerCase()}`}>
      <div className="dashboard-month-popover-head">
        <button type="button" aria-label="Ano anterior" disabled={minYear !== undefined && visibleYear <= minYear} onClick={() => setVisibleYear((year) => year - 1)}><ChevronLeft size={16} /></button>
        <strong>{visibleYear}</strong>
        <button type="button" aria-label="Próximo ano" disabled={maxYear !== undefined && visibleYear >= maxYear} onClick={() => setVisibleYear((year) => year + 1)}><ChevronRight size={16} /></button>
      </div>
      <div className="dashboard-month-grid">{monthNames.map((name, index) => {
        const month = String(index + 1).padStart(2, "0");
        const option = `${visibleYear}-${month}`;
        const disabled = Boolean((min && option < min) || (max && option > max));
        const selected = option === value;
        return <button type="button" key={name} disabled={disabled} aria-pressed={selected} className={selected ? "selected" : ""} onClick={() => { onChange(option); setOpen(false); }}>{name.slice(0, 3)}</button>;
      })}</div>
    </div>}
  </div>;
}

function buildBuckets(start: Date, endExclusive: Date, orders: DashboardOrder[]): Bucket[] {
  const oneMonth = start.getFullYear() === addMonths(endExclusive, -1).getFullYear() && start.getMonth() === addMonths(endExclusive, -1).getMonth();
  const buckets: Bucket[] = [];
  if (oneMonth) {
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= days; day++) buckets.push({ key: dateKey(new Date(start.getFullYear(), start.getMonth(), day)), label: String(day), sales: 0, orders: 0 });
  } else {
    for (let cursor = new Date(start); cursor < endExclusive; cursor = addMonths(cursor, 1)) {
      buckets.push({ key: monthValue(cursor), label: monthLabel(cursor), sales: 0, orders: 0 });
    }
  }
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const order of orders) {
    if (order.status !== "entregue") continue;
    const created = new Date(order.created_at);
    const key = oneMonth ? dateKey(created) : monthValue(created);
    const bucket = byKey.get(key);
    if (bucket) {
      bucket.sales += Number(order.total) || 0;
      bucket.orders += 1;
    }
  }
  return buckets;
}

export default function AdminDashboard() {
  const now = new Date();
  const [fromMonth, setFromMonth] = useState(monthValue(addMonths(now, -5)));
  const [toMonth, setToMonth] = useState(monthValue(now));
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    const start = startOfMonth(fromMonth);
    const endExclusive = addMonths(startOfMonth(toMonth), 1);
    const monthCount = (endExclusive.getFullYear() - start.getFullYear()) * 12 + endExclusive.getMonth() - start.getMonth();
    const previousStart = addMonths(start, -monthCount);
    return { start, endExclusive, previousStart };
  }, [fromMonth, toMonth]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      if (!publicSupabase) {
        setError("Configure a conexão com o Supabase para carregar as métricas.");
        setOrders([]);
        setLoading(false);
        return;
      }
      const { data, error: queryError } = await publicSupabase
        .from("pedidos")
        .select("id,status,total,tipo_entrega,forma_pagamento,created_at,pedido_itens(nome_produto,quantidade,subtotal)")
        .gte("created_at", range.previousStart.toISOString())
        .lt("created_at", range.endExclusive.toISOString())
        .order("created_at", { ascending: true });
      if (!active) return;
      if (queryError) {
        console.error("Falha ao carregar métricas do dashboard:", queryError);
        setError("Não foi possível carregar as métricas. Verifique sua conexão e as permissões dos pedidos.");
        setOrders([]);
      } else {
        setOrders((data ?? []) as DashboardOrder[]);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [range]);

  const currentStart = range.start.getTime();
  const periodOrders = useMemo(() => orders.filter((order) => {
    const created = new Date(order.created_at).getTime();
    return created >= currentStart && created < range.endExclusive.getTime();
  }), [orders, currentStart, range.endExclusive]);
  const previousOrders = useMemo(() => orders.filter((order) => {
    const created = new Date(order.created_at).getTime();
    return created >= range.previousStart.getTime() && created < currentStart;
  }), [orders, range.previousStart, currentStart]);

  const delivered = periodOrders.filter((order) => order.status === "entregue");
  const canceledCount = periodOrders.filter((order) => order.status === "cancelado").length;
  const revenue = delivered.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const previousRevenue = previousOrders.filter((order) => order.status === "entregue").reduce((sum, order) => sum + (Number(order.total) || 0), 0);
  const change = previousRevenue === 0 ? null : ((revenue - previousRevenue) / previousRevenue) * 100;
  const buckets = useMemo(() => buildBuckets(range.start, range.endExclusive, periodOrders), [range.start, range.endExclusive, periodOrders]);
  const maxSales = Math.max(1, ...buckets.map((bucket) => bucket.sales));

  const popularItems = useMemo(() => {
    const items = new Map<string, { quantity: number; revenue: number }>();
    for (const order of delivered) for (const item of order.pedido_itens ?? []) {
      const current = items.get(item.nome_produto) ?? { quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantidade) || 0;
      current.revenue += Number(item.subtotal) || 0;
      items.set(item.nome_produto, current);
    }
    return [...items.entries()].map(([name, values]) => ({ name, ...values })).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [delivered]);

  const paymentBreakdown = useMemo(() => {
    const values = new Map<string, number>();
    for (const order of delivered) values.set(order.forma_pagamento, (values.get(order.forma_pagamento) ?? 0) + 1);
    return [{ key: "pix", label: "Pix", color: "#34704a" }, { key: "cartao", label: "Cartão", color: "#df612f" }, { key: "dinheiro", label: "Dinheiro", color: "#c5a34a" }]
      .map((payment) => ({ ...payment, count: values.get(payment.key) ?? 0, share: delivered.length ? ((values.get(payment.key) ?? 0) / delivered.length) * 100 : 0 }));
  }, [delivered]);

  const fulfillmentBreakdown = useMemo(() => [
    { label: "Delivery", count: delivered.filter((order) => order.tipo_entrega === "delivery").length, color: "#b52327" },
    { label: "Retirada", count: delivered.filter((order) => order.tipo_entrega === "retirada").length, color: "#34704a" },
  ], [delivered]);

  const setRangeStart = (value: string) => {
    setFromMonth(value);
    if (value > toMonth) setToMonth(value);
  };
  const setRangeEnd = (value: string) => {
    setToMonth(value);
    if (value < fromMonth) setFromMonth(value);
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div><p className="dashboard-eyebrow">DELLA NONNA / VISÃO GERAL</p><h1>Dashboard</h1><p>Um olhar claro sobre o ritmo da sua pizzaria.</p></div>
        <div className="dashboard-range" aria-label="Filtro de período">
          <MonthPicker caption="De" value={fromMonth} max={toMonth} onChange={setRangeStart} />
          <span className="dashboard-range-separator">até</span>
          <MonthPicker caption="Até" value={toMonth} min={fromMonth} max={monthValue(now)} onChange={setRangeEnd} />
        </div>
      </header>

      {error && <div className="dashboard-error"><CircleAlert size={18} />{error}</div>}
      {loading ? <div className="dashboard-loading"><LoaderCircle size={20} className="dashboard-spinner" />Carregando métricas...</div> : !error && <>
        <section className="dashboard-metrics" aria-label="Indicadores do período">
          <article className="dashboard-metric"><span>Vendas entregues</span><strong>{money(revenue)}</strong><small>{change === null ? "Sem período anterior para comparar" : <>{change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{Math.abs(change).toFixed(1).replace(".", ",")}% vs. período anterior</>}</small></article>
          <article className="dashboard-metric"><span>Pedidos concluídos</span><strong>{delivered.length}</strong><small>Pedidos com status entregue</small></article>
          <article className="dashboard-metric"><span>Ticket médio</span><strong>{money(delivered.length ? revenue / delivered.length : 0)}</strong><small>Por pedido entregue</small></article>
          <article className="dashboard-metric dashboard-metric-canceled"><span>Pedidos cancelados</span><strong>{canceledCount}</strong><small>{periodOrders.length} pedidos no período</small></article>
        </section>

        <section className="dashboard-panel dashboard-sales-panel">
          <header><div><h2>Vendas ao longo do tempo</h2><p>Somente pedidos entregues · {fromMonth === toMonth ? "visão diária" : "visão mensal"}</p></div><span className="dashboard-panel-total"><TrendingUp size={16} />{money(revenue)}</span></header>
          {delivered.length === 0 ? <div className="dashboard-empty"><ClipboardList size={22} /><span>Nenhuma venda concluída neste período.</span></div> : <div className={`dashboard-chart ${buckets.length > 10 ? "dashboard-chart-many" : ""}`} role="img" aria-label="Gráfico de vendas concluídas">
            <div className="dashboard-y-labels"><span>{money(maxSales)}</span><span>{money(maxSales / 2)}</span><span>R$ 0</span></div>
            <div className="dashboard-bars">{buckets.map((bucket) => <div className="dashboard-bar-column" key={bucket.key} title={`${bucket.label}: ${money(bucket.sales)} · ${bucket.orders} pedidos`}><div className="dashboard-bar-track"><i style={{ height: `${Math.max(0, (bucket.sales / maxSales) * 100)}%` }} /></div><small>{bucket.label}</small></div>)}</div>
          </div>}
        </section>

        <div className="dashboard-lower-grid">
          <section className="dashboard-panel"><header><div><h2>Mais vendidos</h2><p>Itens de pedidos entregues</p></div></header>
            {popularItems.length === 0 ? <p className="dashboard-quiet-empty">Sem itens para exibir neste período.</p> : <div className="dashboard-ranking">{popularItems.map((item, index) => <div className="dashboard-ranking-row" key={item.name}><span className="dashboard-rank">{String(index + 1).padStart(2, "0")}</span><div className="dashboard-rank-info"><div><strong>{item.name}</strong><small>{item.quantity} un.</small></div><div className="dashboard-rank-track"><i style={{ width: `${Math.max(7, (item.quantity / popularItems[0].quantity) * 100)}%` }} /></div></div><b>{money(item.revenue)}</b></div>)}</div>}
          </section>

          <section className="dashboard-panel"><header><div><h2>Como seus clientes pagam</h2><p>Pedidos concluídos</p></div></header><div className="dashboard-breakdown">{paymentBreakdown.map((item) => <div className="dashboard-breakdown-row" key={item.key}><span><i style={{ backgroundColor: item.color }} />{item.label}</span><div className="dashboard-breakdown-track"><i style={{ width: `${item.share}%`, backgroundColor: item.color }} /></div><b>{item.count}</b></div>)}</div>
            <div className="dashboard-fulfillment">{fulfillmentBreakdown.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.count}</strong><small>{delivered.length ? `${Math.round((item.count / delivered.length) * 100)}%` : "0%"}</small></div>)}</div>
          </section>
        </div>
      </>}
    </main>
  );
}
