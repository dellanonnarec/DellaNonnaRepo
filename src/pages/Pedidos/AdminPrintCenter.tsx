import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, CircleHelp, CirclePlus, Clock3, Download, LoaderCircle, Printer, RefreshCw, Search, Settings2, Wifi, WifiOff, X } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";
import { loadOrderForReceipt } from "../../printing/orderReceiptData";
import { money, paymentLabels, statusLabels, type Order, type OrderStatus } from "./types";
import "./AdminPrintCenter.css";

type PrintStatus = "pendente" | "processando" | "enviado" | "erro";
type QueueEntry = { id: string; pedido_id: string; status: PrintStatus; tentativas: number; ultimo_erro: string | null; criado_em: string; enviado_em: string | null; proxima_tentativa_em: string };
type PrinterInfo = { name: string; displayName?: string; status?: number };
const printLabels: Record<PrintStatus, string> = { pendente: "Aguardando", processando: "Imprimindo", enviado: "Impresso", erro: "Falha" };
const formatDate = (value: string) => new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminPrintCenter() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [printerName, setPrinterName] = useState(() => localStorage.getItem("della-desktop-printer") ?? "");
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("della-desktop-auto-print") !== "false");
  const [startup, setStartup] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState("");
  const [search, setSearch] = useState("");
  const [printFilter, setPrintFilter] = useState("todos");
  const [orderFilter, setOrderFilter] = useState("todos");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadData = useCallback(async () => {
    if (!publicSupabase) { setLoading(false); return; }
    const [ordersResult, queueResult] = await Promise.all([
      publicSupabase.from("pedidos").select("*, pedido_itens(*)").order("created_at", { ascending: false }).order("id", { ascending: false }).range(0, 499),
      publicSupabase.from("fila_impressao_pedidos").select("*").order("criado_em", { ascending: false }).limit(500),
    ]);
    if (ordersResult.error || queueResult.error) {
      setNotice(ordersResult.error?.message ?? queueResult.error?.message ?? "Não foi possível atualizar os pedidos.");
    } else {
      const latestOrders = (ordersResult.data ?? []) as Order[];
      setOrders((current) => {
        const latestIds = new Set(latestOrders.map((order) => order.id));
        return [...latestOrders, ...current.filter((order) => !latestIds.has(order.id))];
      });
      const latestQueue = (queueResult.data ?? []) as QueueEntry[];
      setQueue((current) => {
        const latestIds = new Set(latestQueue.map((job) => job.id));
        return [...latestQueue, ...current.filter((job) => !latestIds.has(job.id))];
      });
      setHasMoreOrders(latestOrders.length === 500);
      setNotice("");
    }
    setLoading(false);
  }, []);

  const loadMoreOrders = async () => {
    if (!publicSupabase || loadingMore || !hasMoreOrders) return;
    const oldest = orders[orders.length - 1];
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const { data, error } = await publicSupabase
        .from("pedidos")
        .select("*, pedido_itens(*)")
        .or(`created_at.lt.${oldest.created_at},and(created_at.eq.${oldest.created_at},id.lt.${oldest.id})`)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(0, 499);
      if (error) throw error;
      const olderOrders = (data ?? []) as Order[];
      if (olderOrders.length) {
        setOrders((current) => [...current, ...olderOrders.filter((order) => !current.some((loaded) => loaded.id === order.id))]);
        const { data: olderQueue, error: queueError } = await publicSupabase
          .from("fila_impressao_pedidos").select("*").in("pedido_id", olderOrders.map((order) => order.id));
        if (queueError) throw queueError;
        if (olderQueue?.length) setQueue((current) => {
          const loadedIds = new Set(current.map((job) => job.id));
          return [...current, ...(olderQueue as QueueEntry[]).filter((job) => !loadedIds.has(job.id))];
        });
      }
      setHasMoreOrders(olderOrders.length === 500);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar pedidos anteriores.");
    } finally { setLoadingMore(false); }
  };

  const loadPrinters = useCallback(async () => {
    if (!window.desktop) return;
    try {
      const found = await window.desktop.getPrinters();
      setPrinters(found);
      setPrinterName((current) => current || localStorage.getItem("della-desktop-printer") || "");
      setStartup(await window.desktop.getStartupSetting());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível consultar as impressoras do Windows.");
    }
  }, []);

  useEffect(() => {
    void loadData();
    void loadPrinters();
    const client = publicSupabase;
    if (!client) return;
    const channel = client.channel("desktop-print-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "fila_impressao_pedidos" }, () => void loadData())
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    const timer = window.setInterval(() => void loadData(), 10000);
    return () => { window.clearInterval(timer); void client.removeChannel(channel); };
  }, [loadData, loadPrinters]);

  useEffect(() => {
    localStorage.setItem("della-desktop-printer", printerName);
    window.dispatchEvent(new Event("della-desktop-print-settings"));
  }, [printerName]);

  const queueByOrder = useMemo(() => new Map(queue.map((entry) => [entry.pedido_id, entry])), [queue]);
  const searchValue = search.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visibleOrders = useMemo(() => orders.filter((order) => {
    const entry = queueByOrder.get(order.id);
    const matchText = !searchValue || [String(order.numero_pedido), order.nome_cliente, order.telefone_cliente, order.codigo_acompanhamento ?? ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(searchValue));
    const date = order.created_at.slice(0, 10);
    return matchText && (printFilter === "todos" || entry?.status === printFilter || (printFilter === "sem-fila" && !entry))
      && (orderFilter === "todos" || order.status === orderFilter)
      && (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  }), [orders, queueByOrder, searchValue, printFilter, orderFilter, fromDate, toDate]);

  const persistAutoPrint = (enabled: boolean) => {
    setAutoPrint(enabled);
    localStorage.setItem("della-desktop-auto-print", String(enabled));
    window.dispatchEvent(new Event("della-desktop-print-settings"));
  };

  const printOrder = async (order: Order) => {
    if (!window.desktop || !publicSupabase || !printerName) { setNotice("Selecione uma impressora instalada para imprimir."); return; }
    setWorking(order.id);
    setNotice("");
    const entry = queueByOrder.get(order.id);
    let claimedId: string | null = null;
    let attempt = entry?.tentativas ?? 0;
    try {
      if (entry && entry.status !== "enviado") {
        const { data: claimed, error } = await publicSupabase.from("fila_impressao_pedidos")
          .update({ status: "processando", tentativas: attempt + 1, iniciado_em: new Date().toISOString(), agente_id: "desktop-manual", ultimo_erro: null })
          .eq("id", entry.id).in("status", ["pendente", "erro"]).select("id").maybeSingle();
        if (error) throw error;
        if (!claimed) throw new Error("Este pedido já está sendo processado. Atualize a fila e tente novamente.");
        claimedId = claimed.id;
        attempt += 1;
      } else if (!entry) {
        const { data: created, error } = await publicSupabase.from("fila_impressao_pedidos")
          .insert({ pedido_id: order.id, status: "processando", tentativas: 1, iniciado_em: new Date().toISOString(), agente_id: "desktop-manual" })
          .select("id").single();
        if (error) throw error;
        claimedId = created.id;
        attempt = 1;
      } else {
        await publicSupabase.from("fila_impressao_pedidos").update({ tentativas: attempt + 1 }).eq("id", entry.id);
        attempt += 1;
      }
      const fullOrder = await loadOrderForReceipt(publicSupabase, order.id);
      await window.desktop.printReceipt({ printerName, order: fullOrder });
      if (claimedId) await publicSupabase.from("fila_impressao_pedidos").update({ status: "enviado", enviado_em: new Date().toISOString(), agente_id: null, ultimo_erro: null }).eq("id", claimedId);
      setNotice(`Pedido #${order.numero_pedido} enviado ao spooler do Windows.`);
      await loadData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao imprimir o pedido.";
      if (claimedId) await publicSupabase.from("fila_impressao_pedidos").update({ status: "erro", tentativas: attempt, agente_id: null, ultimo_erro: message }).eq("id", claimedId);
      setNotice(message);
      await loadData();
    } finally { setWorking(""); }
  };

  const testPrinter = async () => {
    if (!window.desktop || !printerName) { setNotice("Selecione uma impressora instalada."); return; }
    setWorking("test");
    try {
      const result = await window.desktop.testPrinter(printerName);
      setNotice(`Teste enviado à impressora (trabalho ${result.jobId}).`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Falha no teste de impressão."); }
    finally { setWorking(""); }
  };

  const setLaunchOnStartup = async (enabled: boolean) => {
    if (!window.desktop) return;
    try { setStartup(await window.desktop.setStartupSetting(enabled)); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível alterar a inicialização do Windows."); }
  };

  const counts = { pending: queue.filter((item) => item.status === "pendente").length, sent: queue.filter((item) => item.status === "enviado").length, failed: queue.filter((item) => item.status === "erro").length };
  const chosenPrinter = printers.find((printer) => printer.name === printerName);
  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    if (!publicSupabase) return;
    try {
      const fullOrder = await loadOrderForReceipt(publicSupabase, order.id);
      setSelectedOrder(fullOrder as Order);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível carregar todos os detalhes do pedido.");
    }
  };

  return <main className="print-center">
    <header className="print-center-heading">
      <div><p className="print-center-eyebrow">DELLA NONNA · ESTAÇÃO LOCAL</p><h1>Central de impressão</h1><p>Pedidos, fila e impressora térmica em um só lugar.</p></div>
      <button className="print-refresh" onClick={() => { setLoading(true); void loadData(); void loadPrinters(); }}><RefreshCw size={16} />Atualizar</button>
    </header>

    <section className="print-status-grid" aria-label="Status da estação">
      <article className={`print-status-card ${connected ? "online" : "offline"}`}><span className="print-status-icon">{connected ? <Wifi size={19} /> : <WifiOff size={19} />}</span><div><small>Supabase</small><strong>{connected ? "Conectado" : "Reconectando"}</strong></div><i /></article>
      <article className={`print-status-card ${chosenPrinter ? "online" : "offline"}`}><span className="print-status-icon"><Printer size={19} /></span><div><small>Impressora Windows</small><strong>{chosenPrinter?.displayName || chosenPrinter?.name || "Não selecionada"}</strong></div><i /></article>
      <button className={`print-status-card print-auto-card ${autoPrint ? "online" : "offline"}`} onClick={() => persistAutoPrint(!autoPrint)} aria-pressed={autoPrint}><span className="print-status-icon"><Settings2 size={19} /></span><div><small>Impressão automática</small><strong>{autoPrint ? "Ativada" : "Pausada"}</strong></div><span className={`print-switch ${autoPrint ? "on" : ""}`} /></button>
      <article className="print-status-card"><span className="print-status-icon"><Clock3 size={19} /></span><div><small>Na fila</small><strong>{counts.pending} {counts.pending === 1 ? "pedido" : "pedidos"}</strong></div></article>
    </section>

    {notice && <div className="print-notice" role="status"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => setNotice("")}><X size={16} /></button></div>}

    <section className="print-settings-panel">
      <div className="print-setting"><span className="print-setting-icon"><Printer size={18} /></span><div><strong>Impressora de produção</strong><small>{chosenPrinter ? "Impressão ESC/POS em 58 mm via spooler do Windows" : "Escolha uma impressora instalada"}</small></div><label className="print-select-wrap"><select aria-label="Selecionar impressora" value={printerName} onChange={(event) => setPrinterName(event.target.value)}><option value="">Selecionar impressora</option>{printers.map((printer) => <option key={printer.name} value={printer.name}>{printer.displayName || printer.name}</option>)}</select><ChevronDown size={15} /></label><button className="print-test-button" onClick={() => void testPrinter()} disabled={working === "test" || !printerName}>{working === "test" ? <LoaderCircle className="spin" size={16} /> : <CirclePlus size={16} />}Testar</button></div>
      <div className="print-setting print-startup"><span className="print-setting-icon"><Download size={18} /></span><div><strong>Iniciar com o Windows</strong><small>Abra a central automaticamente ao entrar no computador</small></div><button className={`print-switch-button ${startup ? "enabled" : ""}`} onClick={() => void setLaunchOnStartup(!startup)} aria-label={startup ? "Desativar inicialização com Windows" : "Ativar inicialização com Windows"}><span /></button></div>
    </section>

    <section className="print-queue-summary">
      <div><h2>Fila de impressão</h2><p>Acompanhe o que aguarda, foi impresso ou precisa de atenção.</p></div>
      <div className="print-queue-counts"><span><i className="dot-pending" />{counts.pending} aguardando</span><span><i className="dot-sent" />{counts.sent} impressos</span><span><i className="dot-error" />{counts.failed} falhas</span></div>
    </section>

    <section className="print-orders-panel">
      <div className="print-orders-heading"><div><h2>Pedidos</h2><span>{visibleOrders.length} exibidos</span></div><label className="print-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Número, cliente ou código" /></label></div>
      <div className="print-filters"><label>Impressão<select value={printFilter} onChange={(event) => setPrintFilter(event.target.value)}><option value="todos">Todos</option><option value="pendente">Aguardando</option><option value="processando">Imprimindo</option><option value="enviado">Impressos</option><option value="erro">Falhas</option><option value="sem-fila">Sem fila</option></select></label><label>Status do pedido<select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)}><option value="todos">Todos os status</option>{(Object.keys(statusLabels) as OrderStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label><label>De<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>Até<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div>
      <div className="print-orders-table-wrap"><table className="print-orders-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Horário</th><th>Atendimento</th><th>Status do pedido</th><th>Impressão</th><th>Total</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan={8} className="print-table-empty"><LoaderCircle className="spin" size={18} />Carregando pedidos…</td></tr> : visibleOrders.length === 0 ? <tr><td colSpan={8} className="print-table-empty"><CircleHelp size={18} />Nenhum pedido encontrado.</td></tr> : visibleOrders.map((order) => {
          const entry = queueByOrder.get(order.id);
          const printStatus = entry?.status;
          return <tr key={order.id}>
            <td><button className="print-order-link" onClick={() => void openOrderDetails(order)}>#{order.numero_pedido}</button><small>{order.codigo_acompanhamento || ""}</small></td>
            <td><strong>{order.nome_cliente}</strong><small>{order.telefone_cliente}</small></td>
            <td>{formatDate(order.created_at)}</td>
            <td><span className={`print-fulfillment ${order.tipo_entrega}`}>{order.tipo_entrega === "delivery" ? "Delivery" : "Retirada"}</span></td>
            <td>{statusLabels[order.status]}</td>
            <td><span className={`print-job-status ${printStatus ?? "sem-fila"}`}><i />{printStatus ? printLabels[printStatus] : "Sem fila"}</span>{entry?.tentativas ? <small>{entry.tentativas} {entry.tentativas === 1 ? "tentativa" : "tentativas"}</small> : null}</td>
            <td><strong>{money(Number(order.total))}</strong></td>
            <td><button className="print-row-button" onClick={() => void printOrder(order)} disabled={working === order.id || (printStatus === "processando")} title={printStatus === "enviado" ? "Reimprimir ticket" : "Imprimir ticket"}>{working === order.id ? <LoaderCircle className="spin" size={16} /> : <Printer size={16} />}</button></td>
          </tr>;
        })}
      </tbody></table></div>
      {hasMoreOrders && <div className="print-load-more"><button onClick={() => void loadMoreOrders()} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="spin" size={15} /> : <ChevronDown size={15} />}{loadingMore ? "Carregando pedidos" : "Carregar pedidos anteriores"}</button></div>}
    </section>

    {selectedOrder && <div className="print-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedOrder(null); }}><section className="print-order-modal" role="dialog" aria-modal="true" aria-labelledby="print-order-title"><header><div><small>DETALHES DO PEDIDO</small><h2 id="print-order-title">Pedido #{selectedOrder.numero_pedido}</h2></div><button onClick={() => setSelectedOrder(null)} aria-label="Fechar detalhes"><X size={19} /></button></header><div className="print-ticket-preview"><div className="print-preview-brand">DELLA NONNA<small>PEDIDO PARA PRODUÇÃO</small></div><div className="print-preview-service">{selectedOrder.tipo_entrega === "delivery" ? "ENTREGA" : "RETIRADA"}</div><p>{selectedOrder.nome_cliente} · {selectedOrder.telefone_cliente}</p>{selectedOrder.tipo_entrega === "delivery" && <p>{selectedOrder.rua}, {selectedOrder.numero} · {selectedOrder.bairro}</p>}<hr /><h3>ITENS DO PEDIDO</h3>{selectedOrder.pedido_itens?.map((item) => <div className="print-preview-item" key={item.id}><span>{item.quantidade}x {item.nome_produto}{(selectedOrder as Order & { adicionaisPorItem?: Record<string, Array<{ nome_adicional_snapshot: string }>> }).adicionaisPorItem?.[item.id]?.map((addition, index) => <small key={`${item.id}-${index}`}>+ {addition.nome_adicional_snapshot}</small>)}{item.observacao && <small>OBS: {item.observacao}</small>}</span><strong>{money(Number(item.subtotal))}</strong></div>)}<hr /><div className="print-preview-total"><b>{selectedOrder.taxa_entrega_pendente ? "TOTAL PARCIAL" : "TOTAL"}</b><strong>{money(Number(selectedOrder.total))}</strong></div>{selectedOrder.taxa_entrega_pendente && <p>Taxa de entrega a confirmar com o cliente.</p>}<p>Pagamento: {paymentLabels[selectedOrder.forma_pagamento]}</p><p className="print-preview-time">{formatDate(selectedOrder.created_at)}</p></div><footer><button className="print-modal-secondary" onClick={() => setSelectedOrder(null)}>Fechar</button><button className="print-modal-primary" disabled={working === selectedOrder.id} onClick={() => void printOrder(selectedOrder)}>{working === selectedOrder.id ? <LoaderCircle className="spin" size={16} /> : <Printer size={16} />}{queueByOrder.get(selectedOrder.id)?.status === "enviado" ? "Reimprimir ticket" : "Imprimir ticket"}</button></footer></section></div>}
  </main>;
}
