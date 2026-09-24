import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";
import CartPage from "./CartPage";
import FulfillmentPage from "./FulfillmentPage";
import AddressPage from "./AddressPage";
import CustomerPage from "./CustomerPage";
import PaymentPage from "./PaymentPage";
import ReviewPage from "./ReviewPage";
import OrderConfirmedPage from "./OrderConfirmedPage";
import { type CartItem, type Customer, type DeliveryAddress, type MenuCategory, type MenuItem, type PaymentMethod, cartSubtotal, money } from "./types";

type Step = "menu" | "cart" | "fulfillment" | "address" | "customer" | "payment" | "review" | "confirmed";
const CART_KEY = "della-nonna-public-cart";
const emptyAddress: DeliveryAddress = { cep: "", rua: "", numero: "", complemento: "", bairro: "", referencia: "" };

function isAdditionalCategory(name: string) {
  const normalizedName = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  return /^(?:adicion(?:al|ais)|bordas?)\b/.test(normalizedName);
}

function readCart(): CartItem[] {
  try {
    if (typeof window === "undefined") return [];
    const value = localStorage.getItem(CART_KEY);
    if (!value) return [];
    const parsed = JSON.parse(value) as Partial<CartItem>[];
    return parsed.map((item) => ({
      ...item,
      additions: Array.isArray(item.additions) ? item.additions : [],
    } as CartItem));
  }
  catch { return []; }
}

export default function CardapioPublico() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [step, setStep] = useState<Step>("menu");
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fulfillment, setFulfillment] = useState<"delivery" | "retirada" | "">("");
  const [address, setAddress] = useState<DeliveryAddress>(emptyAddress);
  const [customer, setCustomer] = useState<Customer>({ name: "", whatsapp: "" });
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [busy, setBusy] = useState(false);
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState<number | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState(0);
  const [selectedPizza, setSelectedPizza] = useState<MenuItem | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [pizzaQuantity, setPizzaQuantity] = useState(1);
  const [pizzaObservation, setPizzaObservation] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      if (!publicSupabase) {
        setError("O serviço de pedidos não está configurado.");
        setLoading(false);
        return;
      }
      const supabase = publicSupabase;
      const [categoryResult, itemResult] = await Promise.all([
        supabase.from("categorias_cardapio").select("id,nome,ordem,ativa").eq("ativa", true).order("ordem"),
        supabase.from("cardapio_itens").select("id,nome_comercial,descricao,categoria_id,tamanho,imagem_url,preco_venda,destaque,disponivel,ordem_exibicao,origem_tipo,receita_id,insumo_id").eq("disponivel", true).order("ordem_exibicao"),
      ]);
      if (!active) return;
      if (categoryResult.error || itemResult.error) {
        console.error("Falha ao carregar o cardápio público:", categoryResult.error ?? itemResult.error);
        setError("Não foi possível carregar o cardápio. Tente novamente em instantes.");
        setLoading(false);
        return;
      }
      const categoryRows = (categoryResult.data ?? []) as MenuCategory[];
      const categoryById = new Map(categoryRows.map((category) => [category.id, category]));
      const loadedItems: MenuItem[] = (itemResult.data ?? []).flatMap((row: any) => {
        const category = categoryById.get(row.categoria_id);
        if (!category) return [];
        return [{
          id: row.id,
          nome_comercial: row.nome_comercial,
          descricao: row.descricao,
          categoria_id: row.categoria_id,
          categoria: category.nome,
          tamanho: row.tamanho,
          imagem_url: row.imagem_url,
          preco_venda: Number(row.preco_venda ?? 0),
          destaque: Boolean(row.destaque),
          disponivel: Boolean(row.disponivel),
          ordem_exibicao: Number(row.ordem_exibicao ?? 1),
          origem_tipo: row.origem_tipo,
          receita_id: row.receita_id ?? null,
          insumo_id: row.insumo_id ?? null,
        }];
      });
      setCategories(categoryRows);
      setItems(loadedItems);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* armazenamento indisponível */ }
  }, [cart]);

  const additionalItems = useMemo(() => items.filter((item) => item.origem_tipo === "insumo" && isAdditionalCategory(item.categoria)), [items]);
  const visibleCategories = useMemo(() => categories.filter((category) => !isAdditionalCategory(category.nome)), [categories]);
  const filteredItems = useMemo(() => items.filter((item) => {
    if (isAdditionalCategory(item.categoria)) return false;
    const matchesCategory = activeCategory === "Todas" || item.categoria_id === activeCategory;
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const matchesSearch = !term || `${item.nome_comercial} ${item.descricao ?? ""} ${item.categoria}`.toLocaleLowerCase("pt-BR").includes(term);
    return matchesCategory && matchesSearch;
  }), [items, activeCategory, search]);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartSubtotal(cart);
  const deliveryFee = 0; // Configure aqui quando houver uma taxa/área de entrega no banco.

  const addToCart = (menuItem: MenuItem, quantity = 1, observation = "", additions: CartItem["additions"] = []) => {
    setCart((current) => [...current, {
      cartKey: crypto.randomUUID(), menuItemId: menuItem.id, name: menuItem.nome_comercial,
      category: menuItem.categoria, size: menuItem.tamanho, imageUrl: menuItem.imagem_url,
      unitPrice: menuItem.preco_venda, quantity, observation, originType: menuItem.origem_tipo, additions,
    }]);
  };
  const startAdd = (item: MenuItem) => {
    setError("");
    if (item.origem_tipo === "receita" && /pizza/i.test(item.categoria)) {
      setSelectedPizza(item);
      setSelectedExtras([]);
      setPizzaQuantity(1);
      setPizzaObservation("");
    } else addToCart(item);
  };
  const confirmPizzaAndExtras = () => {
    if (!selectedPizza) return;
    const additions = additionalItems.filter((item) => selectedExtras.includes(item.id)).map((item) => ({
      menuItemId: item.id,
      name: item.nome_comercial,
      quantityPerItem: 1,
      unitPrice: item.preco_venda,
    }));
    addToCart(selectedPizza, pizzaQuantity, pizzaObservation.trim(), additions);
    setSelectedPizza(null);
  };
  const changeQuantity = (cartKey: string, quantity: number) => setCart((current) => quantity < 1 ? current.filter((item) => item.cartKey !== cartKey) : current.map((item) => item.cartKey === cartKey ? { ...item, quantity } : item));

  const submitOrder = async () => {
    if (!fulfillment || !payment || !cart.length || customer.name.trim().length < 2) return;
    if (!publicSupabase) {
      setError("O serviço de pedidos não está configurado.");
      return;
    }
    const supabase = publicSupabase;
    setBusy(true);
    setError("");
    const fee = fulfillment === "delivery" ? deliveryFee : 0;
    const orderPayload = {
      nome_cliente: customer.name.trim(),
      telefone_cliente: customer.whatsapp.trim(),
      tipo_entrega: fulfillment,
      cep: fulfillment === "delivery" ? address.cep.trim() : null,
      rua: fulfillment === "delivery" ? address.rua.trim() : null,
      numero: fulfillment === "delivery" ? address.numero.trim() : null,
      complemento: fulfillment === "delivery" ? address.complemento.trim() || null : null,
      bairro: fulfillment === "delivery" ? address.bairro.trim() : null,
      referencia: fulfillment === "delivery" ? address.referencia.trim() || null : null,
      forma_pagamento: payment,
      subtotal,
      taxa_entrega: fee,
      total: subtotal + fee,
      observacao: null,
    };
    try {
      const { data, error: orderError } = await supabase.rpc("registrar_pedido_publico", {
        p_pedido: orderPayload,
        p_itens: cart.map((item) => ({
          cardapio_item_id: item.menuItemId,
          quantidade: item.quantity,
          observacao: item.observation || null,
          adicionais: item.additions.map((addition) => ({
            cardapio_item_id: addition.menuItemId,
            quantidade: addition.quantityPerItem,
          })),
        })),
      });
      if (orderError) throw orderError;
      const result = Array.isArray(data) ? data[0] : data;
      setConfirmedOrderNumber(result?.order_number == null ? null : Number(result.order_number));
      setConfirmedTotal(Number(result?.order_total ?? (subtotal + fee)));
      setCart([]);
      setStep("confirmed");
    } catch (cause) {
      console.error("Falha ao finalizar pedido:", cause);
      setError("Não foi possível enviar o pedido. Confira sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  if (step === "cart") return <CartPage items={cart} onBack={() => setStep("menu")} onContinue={() => setStep("fulfillment")} onChangeQuantity={changeQuantity} onRemove={(key) => setCart((current) => current.filter((item) => item.cartKey !== key))}/>;
  if (step === "fulfillment") return <FulfillmentPage value={fulfillment} onBack={() => setStep("cart")} onChoose={setFulfillment} onContinue={() => setStep(fulfillment === "delivery" ? "address" : "customer")}/>;
  if (step === "address") return <AddressPage value={address} onChange={setAddress} onBack={() => setStep("fulfillment")} onContinue={() => setStep("customer")}/>;
  if (step === "customer") return <CustomerPage value={customer} onChange={setCustomer} onBack={() => setStep(fulfillment === "delivery" ? "address" : "fulfillment")} onContinue={() => setStep("payment")}/>;
  if (step === "payment") return <PaymentPage value={payment} onChange={setPayment} onBack={() => setStep("customer")} onContinue={() => setStep("review")}/>;
  if (step === "review") return <ReviewPage items={cart} fulfillment={fulfillment as "delivery" | "retirada"} address={address} customer={customer} payment={payment as PaymentMethod} deliveryFee={deliveryFee} busy={busy} error={error} onBack={() => setStep("payment")} onConfirm={() => void submitOrder()}/>;
  if (step === "confirmed") return <OrderConfirmedPage orderNumber={confirmedOrderNumber} total={confirmedTotal} onHome={() => navigate("/pedido")}/>;

  if (selectedPizza) {
    const selectedExtrasTotal = additionalItems
      .filter((item) => selectedExtras.includes(item.id))
      .reduce((sum, item) => sum + item.preco_venda, 0);
    const customizedUnitPrice = selectedPizza.preco_venda + selectedExtrasTotal;

    return <main className="min-h-dvh bg-[#fbf5d9] pb-32 text-[#295727]">
      <header className="sticky top-0 z-20 border-b border-[#e9e2c9] bg-[#fbf5d9]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button type="button" onClick={() => setSelectedPizza(null)} aria-label="Voltar ao cardápio" className="grid size-10 shrink-0 place-items-center rounded-full text-[#315c40] hover:bg-[#f0ead3]"><ArrowLeft size={19}/></button>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#849078]">Personalizar pedido</p><h1 className="truncate font-serif text-lg font-bold text-[#155b3b]">{selectedPizza.nome_comercial}</h1></div>
          <button type="button" onClick={() => { setSelectedPizza(null); setStep("cart"); }} aria-label={`Carrinho, ${cartCount} itens`} className="relative grid size-10 shrink-0 place-items-center rounded-full bg-[#fffbea] text-[#295727] shadow-sm"><ShoppingCart size={19}/>{cartCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#b51e24] text-[10px] font-bold text-white">{cartCount}</span>}</button>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-4">
        <section className="overflow-hidden rounded-2xl border border-[#e5ddbd] bg-[#fffbea] shadow-sm">
          <div className="aspect-[2.1/1] overflow-hidden bg-[#f3eedb]">{selectedPizza.imagem_url ? <img src={selectedPizza.imagem_url} alt={selectedPizza.nome_comercial} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-6xl">🍕</div>}</div>
          <div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-serif text-xl font-bold text-[#155b3b]">{selectedPizza.nome_comercial}</h2>{selectedPizza.descricao && <p className="mt-1 text-xs leading-relaxed text-[#71826a]">{selectedPizza.descricao}</p>}</div><strong className="shrink-0 text-base text-[#b52327]">{money(selectedPizza.preco_venda)}</strong></div></div>
        </section>

        <section className="mt-4 rounded-2xl border border-[#e5ddbd] bg-[#fffbea] p-4 shadow-sm">
          <div className="mb-2"><h2 className="font-serif text-lg font-bold text-[#155b3b]">Adicionais</h2><p className="text-xs text-[#829078]">Escolha os extras para sua pizza</p></div>
          {additionalItems.length === 0 ? <p className="rounded-lg bg-[#f7f1dc] p-3 text-sm text-[#71826a]">Nenhum adicional disponível no momento.</p> : <div className="divide-y divide-[#eee8d4]">{additionalItems.map((extra) => {
            const checked = selectedExtras.includes(extra.id);
            return <label key={extra.id} className="flex min-h-12 cursor-pointer items-center gap-3 py-2.5">
              <input type="checkbox" checked={checked} onChange={(event) => setSelectedExtras((current) => event.target.checked ? [...current, extra.id] : current.filter((id) => id !== extra.id))} className="size-5 accent-[#b51e24]"/>
              <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-[#315c40]">{extra.nome_comercial}</strong>{extra.descricao && <small className="text-xs text-[#829078]">{extra.descricao}</small>}</span>
              <span className="whitespace-nowrap text-sm text-[#71826a]">+ {money(extra.preco_venda)}</span>
            </label>;
          })}</div>}
        </section>

        <label className="mt-4 block rounded-2xl border border-[#e5ddbd] bg-[#fffbea] p-4 text-sm font-semibold text-[#315c40] shadow-sm">Observações <span className="font-normal text-[#829078]">(opcional)</span><textarea value={pizzaObservation} onChange={(event) => setPizzaObservation(event.target.value)} rows={3} maxLength={300} placeholder="Ex.: sem cebola, cortar em 8 pedaços" className="mt-2 w-full resize-y rounded-lg border border-[#e4dfc9] bg-[#fffdf2] p-3 text-sm font-normal outline-none focus:border-[#78936b]"/></label>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[#e5ddbd] bg-[#fffbea]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(49,92,64,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="inline-flex h-11 shrink-0 items-center rounded-full border border-[#e5ddbd] bg-[#fffdf2]"><button type="button" onClick={() => setPizzaQuantity((value) => Math.max(1, value - 1))} aria-label="Diminuir quantidade" className="grid size-10 place-items-center text-lg">−</button><span className="w-5 text-center text-sm font-semibold">{pizzaQuantity}</span><button type="button" onClick={() => setPizzaQuantity((value) => value + 1)} aria-label="Aumentar quantidade" className="grid size-10 place-items-center text-lg">+</button></div>
          <button type="button" onClick={confirmPizzaAndExtras} className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#b51e24] px-4 text-sm font-bold text-white shadow-sm"><Plus size={17}/><span className="truncate">Adicionar ao carrinho · {money(customizedUnitPrice * pizzaQuantity)}</span></button>
        </div>
      </footer>
    </main>;
  }

  return <main className="min-h-screen bg-[#fbf5d9] pb-24 text-[#295727]">
    <header className="sticky top-0 z-30 border-b border-[#e9e2c9] bg-[#fbf5d9]/95 px-4 py-3 backdrop-blur sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><button onClick={() => navigate("/pedido")} aria-label="Voltar ao início" className="grid size-10 place-items-center rounded-full text-[#54715b] hover:bg-[#f0ead3]"><ArrowLeft size={19}/></button><img src="/logo.png" alt="Della Nonna Pizzaria" className="h-12 max-w-[170px] object-contain"/><button onClick={() => setStep("cart")} className="relative inline-flex size-10 items-center justify-center rounded-full bg-[#fffbea] text-[#295727] shadow-sm" aria-label={`Carrinho, ${cartCount} itens`}><ShoppingCart size={20}/>{cartCount > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#b51e24] text-[10px] font-bold text-white">{cartCount}</span>}</button></div>
    </header>
    <div className="mx-auto max-w-6xl px-4 sm:px-8">
      <section className="relative mt-5 overflow-hidden rounded-2xl bg-[#ede4c5]"><img src="/bannerPizza.jpg" alt="Pizza Della Nonna" className="h-52 w-full object-cover sm:h-72"/><div className="absolute inset-0 bg-gradient-to-r from-[#fbf5d9]/90 via-[#fbf5d9]/50 to-transparent"/><div className="absolute inset-y-0 left-0 flex max-w-sm flex-col justify-center p-6 sm:p-10"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#b52327]">Feito com carinho</p><h1 className="mt-2 font-serif text-3xl font-bold leading-tight text-[#155b3b] sm:text-5xl">Sabor e tradição em cada pedido.</h1><p className="mt-2 text-sm text-[#426548]">Escolha seus favoritos e personalize com adicionais.</p></div></section>
      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="relative mt-6 block"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#829078]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no cardápio" className="h-11 w-full rounded-full border border-[#e5ddbd] bg-[#fffbea] pl-11 pr-4 text-sm outline-none focus:border-[#78936b]"/></label>
      <nav aria-label="Categorias do cardápio" className="mt-4 flex gap-2 overflow-x-auto pb-2">{[{ id: "Todas", nome: "Todas" }, ...visibleCategories].map((category) => <button key={category.id} onClick={() => setActiveCategory(category.id)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold ${activeCategory === category.id ? "bg-[#b51e24] text-white" : "border border-[#e5ddbd] bg-[#fffbea] text-[#54715b]"}`}>{category.nome}</button>)}</nav>
      {loading ? <p className="py-16 text-center text-sm text-[#71826a]">Carregando cardápio…</p> : filteredItems.length === 0 ? <p className="py-16 text-center text-sm text-[#71826a]">Nenhum item disponível nesta categoria.</p> : <section className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{filteredItems.map((item) => <article key={item.id} className="flex gap-3 rounded-xl border border-[#e5ddbd] bg-[#fffbea] p-3 shadow-sm"><div className="size-24 shrink-0 overflow-hidden rounded-lg bg-[#f3eedb]">{item.imagem_url ? <img src={item.imagem_url} alt={item.nome_comercial} loading="lazy" className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-3xl">🍕</div>}</div><div className="flex min-w-0 flex-1 flex-col"><div className="flex items-start justify-between gap-2"><h2 className="min-w-0 font-serif font-bold text-[#155b3b]">{item.nome_comercial}</h2>{item.destaque && <span className="shrink-0 rounded-full bg-[#f8efd8] px-2 py-1 text-[9px] font-bold text-[#a16e1f]">Destaque</span>}</div><p className="mt-1 line-clamp-2 text-xs text-[#71826a]">{item.descricao}</p><div className="mt-auto flex items-center justify-between pt-2"><strong className="text-sm text-[#b52327]">{money(item.preco_venda)}</strong><button onClick={() => startAdd(item)} className="inline-flex h-9 items-center gap-1 rounded-full bg-[#b51e24] px-3 text-xs font-semibold text-white"><Plus size={15}/> Adicionar</button></div></div></article>)}</section>}
    </div>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[#e5ddbd] bg-[#fffbea] md:hidden"><button onClick={() => navigate("/pedido")} className="text-xs text-[#54715b]">⌂<span className="block">Início</span></button><span className="text-xs font-semibold text-[#b52327]">▤<span className="block">Cardápio</span></span><button onClick={() => setStep("cart")} className="text-xs text-[#54715b]">🛒{cartCount > 0 && ` ${cartCount}`}<span className="block">Carrinho</span></button></nav>
  </main>;
}
