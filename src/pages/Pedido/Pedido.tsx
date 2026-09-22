import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";
import "./Pedido.css";

type MenuItem = {
  id: string;
  nome_comercial: string;
  descricao: string | null;
  categoria: string;
  tamanho: string | null;
  imagem_url: string | null;
  preco_venda: number;
  destaque: boolean;
};
type CartLine = MenuItem & { quantidade: number; observacao: string };
type DeliveryType = "delivery" | "retirada";
type PaymentType = "pix" | "cartao" | "dinheiro";
type OrderConfirmation = {
  numero_pedido: number;
  subtotal: number;
  taxa_entrega: number;
  total: number;
  tipo_entrega: DeliveryType;
  forma_pagamento: PaymentType;
};
type CheckoutForm = {
  name: string; phone: string; type: DeliveryType; cep: string; street: string;
  number: string; complement: string; neighborhood: string; reference: string;
  payment: PaymentType; note: string;
};

const cartKey = "della-nonna-pedido-carrinho";
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paymentLabels: Record<PaymentType, string> = { pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro" };
const readCart = (): CartLine[] => {
  try {
    const value = JSON.parse(localStorage.getItem(cartKey) ?? "[]") as CartLine[];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
};

export default function Pedido() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [activeCategory, setActiveCategory] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({ name: "", phone: "", type: "delivery", cep: "", street: "", number: "", complement: "", neighborhood: "", reference: "", payment: "pix", note: "" });

  useEffect(() => { localStorage.setItem(cartKey, JSON.stringify(cart)); }, [cart]);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!publicSupabase) { setError("Cardápio temporariamente indisponível."); setLoading(false); return; }
      const { data, error: loadError } = await publicSupabase.from("cardapio_itens").select("id,nome_comercial,descricao,categoria,tamanho,imagem_url,preco_venda,destaque").eq("disponivel", true).order("ordem_exibicao");
      if (!mounted) return;
      if (loadError) setError("Não foi possível carregar o cardápio agora.");
      setItems((data ?? []) as MenuItem[]);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const categories = useMemo(() => [...new Set(items.map((item) => item.categoria))], [items]);
  const groupedItems = useMemo(() => categories.map((category) => ({ category, items: items.filter((item) => item.categoria === category) })), [categories, items]);
  const cartCount = cart.reduce((sum, line) => sum + line.quantidade, 0);
  const subtotal = cart.reduce((sum, line) => sum + line.preco_venda * line.quantidade, 0);

  const addToCart = (item: MenuItem) => setCart((current) => {
    const existing = current.find((line) => line.id === item.id && !line.observacao);
    if (existing) return current.map((line) => line === existing ? { ...line, quantidade: line.quantidade + 1 } : line);
    return [...current, { ...item, quantidade: 1, observacao: "" }];
  });
  const changeQuantity = (line: CartLine, amount: number) => setCart((current) => current.flatMap((currentLine) => currentLine === line ? (currentLine.quantidade + amount > 0 ? [{ ...currentLine, quantidade: currentLine.quantidade + amount }] : []) : [currentLine]));
  const updateObservation = (line: CartLine, observacao: string) => setCart((current) => current.map((currentLine) => currentLine === line ? { ...currentLine, observacao } : currentLine));
  const updateForm = (key: keyof CheckoutForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicSupabase || !cart.length) return;
    setSubmitting(true); setError("");
    const payload = {
      nome_cliente: form.name, telefone_cliente: form.phone, tipo_entrega: form.type,
      cep: form.cep, rua: form.street, numero: form.number, complemento: form.complement,
      bairro: form.neighborhood, referencia: form.reference, forma_pagamento: form.payment,
      observacao: form.note,
      itens: cart.map((line) => ({ cardapio_item_id: line.id, quantidade: line.quantidade, observacao: line.observacao })),
    };
    const { data, error: orderError } = await publicSupabase.rpc("criar_pedido", { pedido: payload });
    setSubmitting(false);
    if (orderError || !data) { setError(orderError?.message ?? "Não foi possível finalizar o pedido."); return; }
    const order = (Array.isArray(data) ? data[0] : data) as OrderConfirmation;
    setConfirmation(order); setCart([]); setCheckoutOpen(false); setCartOpen(false);
  };

  if (confirmation) return <Confirmation order={confirmation} />;
  return <main className="order-page">
    <header className="order-header"><div className="order-brand"><span className="order-mark">DN</span><div><strong>Della Nonna</strong><small>Pizzaria artesanal</small></div></div><div className="header-note">Aberto hoje<br /><b>18h às 23h</b></div></header>
    <section className="order-hero"><p className="order-kicker">FEITO NA HORA</p><h1>Seu momento<br /><em>começa aqui.</em></h1><p>Escolha seus favoritos e receba em casa ou retire quentinho na pizzaria.</p></section>
    {error && <div className="order-alert" role="alert">{error}</div>}
    <nav className="category-nav" aria-label="Categorias">{categories.map((category) => <button className={activeCategory === category ? "active" : ""} key={category} onClick={() => { setActiveCategory(category); document.getElementById(`category-${category}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{category}</button>)}</nav>
    <section className="menu-content">{loading ? <div className="order-loading">Carregando sabores...</div> : groupedItems.length === 0 ? <div className="order-empty">Nenhum item disponível no momento. Volte em alguns minutos.</div> : groupedItems.map(({ category, items: categoryItems }) => <section className="menu-category" id={`category-${category}`} key={category}><div className="category-heading"><div><span>{categoryItems.some((item) => item.destaque) ? "OS FAVORITOS DA CASA" : "PARA TODOS OS MOMENTOS"}</span><h2>{category}</h2></div><small>{categoryItems.length} opções</small></div><div className="product-grid">{categoryItems.map((item) => <article className="product-card" key={item.id}><div className="product-photo">{item.imagem_url ? <img src={item.imagem_url} alt="" loading="lazy" /> : <span>🍕</span>}</div><div className="product-info"><div><h3>{item.nome_comercial}</h3>{item.tamanho && <small>{item.tamanho}</small>}</div><p>{item.descricao || "Uma receita especial da Della Nonna."}</p><div className="product-bottom"><strong>{money(item.preco_venda)}</strong><button className="add-button" onClick={() => addToCart(item)} aria-label={`Adicionar ${item.nome_comercial}`}><Plus size={20} /><span>Adicionar</span></button></div></div></article>)}</div></section>)}</section>
    {cartCount > 0 && <button className="cart-bar" onClick={() => setCartOpen(true)}><span className="cart-icon"><ShoppingBag size={21} /><b>{cartCount}</b></span><span><strong>Ver carrinho</strong><small>{cartCount} {cartCount === 1 ? "item" : "itens"}</small></span><strong>{money(subtotal)}</strong><ChevronRight size={20} /></button>}
    {cartOpen && <CartSheet cart={cart} subtotal={subtotal} onClose={() => setCartOpen(false)} onChange={changeQuantity} onObservation={updateObservation} onCheckout={() => { setCartOpen(false); setCheckoutOpen(true); }} />}
    {checkoutOpen && <CheckoutSheet form={form} subtotal={subtotal} error={error} submitting={submitting} onClose={() => setCheckoutOpen(false)} onUpdate={updateForm} onSubmit={submitOrder} />}
  </main>;
}

function CartSheet({ cart, subtotal, onClose, onChange, onObservation, onCheckout }: { cart: CartLine[]; subtotal: number; onClose: () => void; onChange: (line: CartLine, amount: number) => void; onObservation: (line: CartLine, value: string) => void; onCheckout: () => void }) {
  return <div className="sheet-backdrop" onMouseDown={onClose}><section className="order-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><header><div><span className="order-kicker">SEU PEDIDO</span><h2>Confira seus itens</h2></div><button className="close-button" onClick={onClose} aria-label="Fechar carrinho"><X /></button></header><div className="cart-lines">{cart.map((line) => <div className="cart-line" key={`${line.id}-${line.observacao}`}><div><strong>{line.nome_comercial}</strong><small>{money(line.preco_venda)} cada</small><input placeholder="Alguma observação?" value={line.observacao} onChange={(event) => onObservation(line, event.target.value)} /></div><div className="quantity-control"><button onClick={() => onChange(line, -1)} aria-label="Diminuir"><Minus size={16} /></button><b>{line.quantidade}</b><button onClick={() => onChange(line, 1)} aria-label="Aumentar"><Plus size={16} /></button></div></div>)}</div><footer className="sheet-total"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><button className="checkout-button" onClick={onCheckout}>Continuar <ChevronRight size={18} /></button></footer></section></div>;
}

function CheckoutSheet({ form, subtotal, error, submitting, onClose, onUpdate, onSubmit }: { form: CheckoutForm; subtotal: number; error: string; submitting: boolean; onClose: () => void; onUpdate: (key: keyof CheckoutForm, value: string) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const delivery = form.type === "delivery";
  return <div className="sheet-backdrop" onMouseDown={onClose}><section className="order-sheet checkout-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><header><button className="back-button" onClick={onClose} aria-label="Voltar"><ArrowLeft /></button><div><span className="order-kicker">ÚLTIMO PASSO</span><h2>Onde entregamos?</h2></div></header><form onSubmit={onSubmit}><div className="field-grid"><label>Seu nome<input required value={form.name} onChange={(event) => onUpdate("name", event.target.value)} autoComplete="name" /></label><label>WhatsApp<input required type="tel" inputMode="tel" value={form.phone} onChange={(event) => onUpdate("phone", event.target.value)} autoComplete="tel" /></label></div><fieldset><legend>Como deseja receber?</legend><div className="choice-row"><label className={delivery ? "selected" : ""}><input type="radio" name="type" value="delivery" checked={delivery} onChange={(event) => onUpdate("type", event.target.value)} />Delivery</label><label className={!delivery ? "selected" : ""}><input type="radio" name="type" value="retirada" checked={!delivery} onChange={(event) => onUpdate("type", event.target.value)} />Retirada</label></div></fieldset>{delivery && <div className="address-fields"><div className="field-grid"><label>CEP<input required value={form.cep} onChange={(event) => onUpdate("cep", event.target.value)} inputMode="numeric" autoComplete="postal-code" /></label><label>Número<input required value={form.number} onChange={(event) => onUpdate("number", event.target.value)} inputMode="numeric" /></label></div><label>Rua<input required value={form.street} onChange={(event) => onUpdate("street", event.target.value)} autoComplete="street-address" /></label><div className="field-grid"><label>Bairro<input required value={form.neighborhood} onChange={(event) => onUpdate("neighborhood", event.target.value)} /></label><label>Complemento<input value={form.complement} onChange={(event) => onUpdate("complement", event.target.value)} /></label></div><label>Referência <span>(opcional)</span><input value={form.reference} onChange={(event) => onUpdate("reference", event.target.value)} /></label></div>}<label>Forma de pagamento<select value={form.payment} onChange={(event) => onUpdate("payment", event.target.value)}>{Object.entries(paymentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Observação do pedido <span>(opcional)</span><textarea rows={2} value={form.note} onChange={(event) => onUpdate("note", event.target.value)} placeholder="Ex.: tocar a campainha" /></label>{error && <div className="order-alert">{error}</div>}<button className="checkout-button submit" disabled={submitting}>{submitting ? "Enviando pedido..." : <>Finalizar pedido <strong>{money(subtotal)}</strong></>}</button></form></section></div>;
}

function Confirmation({ order }: { order: OrderConfirmation }) {
  return <main className="confirmation-page"><div className="confirmation-mark">✓</div><p className="order-kicker">PEDIDO RECEBIDO</p><h1>Já estamos<br /><em>preparando.</em></h1><p className="confirmation-copy">Obrigado por escolher a Della Nonna. Em breve entraremos em contato pelo WhatsApp.</p><div className="confirmation-card"><span>Pedido</span><strong>#{order.numero_pedido}</strong><div><span>Total</span><b>{money(order.total)}</b></div><div><span>Recebimento</span><b>{order.tipo_entrega === "delivery" ? "Delivery" : "Retirada"}</b></div><div><span>Pagamento</span><b>{paymentLabels[order.forma_pagamento]}</b></div></div><button className="back-menu" onClick={() => window.location.reload()}>Voltar ao cardápio <ArrowLeft size={17} /></button></main>;
}
