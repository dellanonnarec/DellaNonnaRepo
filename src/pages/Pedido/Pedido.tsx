import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Minus,
  Plus,
  ShoppingCart,
  X,
  ArrowRight,
} from "lucide-react";
import { FaCircle } from "react-icons/fa";
import { publicSupabase } from "../../lib/supabase";
import "./Pedido.css";
import { useNavigate } from "react-router-dom";

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
  name: string;
  phone: string;
  type: DeliveryType;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  reference: string;
  payment: PaymentType;
  note: string;
};

const cartKey = "della-nonna-pedido-carrinho";
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paymentLabels: Record<PaymentType, string> = {
  pix: "PIX",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
};
const readCart = (): CartLine[] => {
  try {
    const value = JSON.parse(
      localStorage.getItem(cartKey) ?? "[]",
    ) as CartLine[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export default function Pedido() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [activeCategory, setActiveCategory] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({
    name: "",
    phone: "",
    type: "delivery",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    reference: "",
    payment: "pix",
    note: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!publicSupabase) {
        setError("Cardápio temporariamente indisponível.");
        setLoading(false);
        return;
      }
      const { data, error: loadError } = await publicSupabase
        .from("cardapio_itens")
        .select(
          "id,nome_comercial,descricao,categoria,tamanho,imagem_url,preco_venda,destaque",
        )
        .eq("disponivel", true)
        .order("ordem_exibicao");
      if (!mounted) return;
      if (loadError) setError("Não foi possível carregar o cardápio agora.");
      setItems((data ?? []) as MenuItem[]);
      setLoading(false);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(items.map((item) => item.categoria))],
    [items],
  );
  const groupedItems = useMemo(
    () =>
      categories.map((category) => ({
        category,
        items: items.filter((item) => item.categoria === category),
      })),
    [categories, items],
  );
  const cartCount = cart.reduce((sum, line) => sum + line.quantidade, 0);
  const subtotal = cart.reduce(
    (sum, line) => sum + line.preco_venda * line.quantidade,
    0,
  );

  const addToCart = (item: MenuItem) =>
    setCart((current) => {
      const existing = current.find(
        (line) => line.id === item.id && !line.observacao,
      );
      if (existing)
        return current.map((line) =>
          line === existing
            ? { ...line, quantidade: line.quantidade + 1 }
            : line,
        );
      return [...current, { ...item, quantidade: 1, observacao: "" }];
    });
  const changeQuantity = (line: CartLine, amount: number) =>
    setCart((current) =>
      current.flatMap((currentLine) =>
        currentLine === line
          ? currentLine.quantidade + amount > 0
            ? [{ ...currentLine, quantidade: currentLine.quantidade + amount }]
            : []
          : [currentLine],
      ),
    );
  const updateObservation = (line: CartLine, observacao: string) =>
    setCart((current) =>
      current.map((currentLine) =>
        currentLine === line ? { ...currentLine, observacao } : currentLine,
      ),
    );
  const updateForm = (key: keyof CheckoutForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicSupabase || !cart.length) return;
    setSubmitting(true);
    setError("");
    const payload = {
      nome_cliente: form.name,
      telefone_cliente: form.phone,
      tipo_entrega: form.type,
      cep: form.cep,
      rua: form.street,
      numero: form.number,
      complemento: form.complement,
      bairro: form.neighborhood,
      referencia: form.reference,
      forma_pagamento: form.payment,
      observacao: form.note,
      itens: cart.map((line) => ({
        cardapio_item_id: line.id,
        quantidade: line.quantidade,
        observacao: line.observacao,
      })),
    };
    const { data, error: orderError } = await publicSupabase.rpc(
      "criar_pedido",
      { pedido: payload },
    );
    setSubmitting(false);
    if (orderError || !data) {
      setError(orderError?.message ?? "Não foi possível finalizar o pedido.");
      return;
    }
    const order = (Array.isArray(data) ? data[0] : data) as OrderConfirmation;
    setConfirmation(order);
    setCart([]);
    setCheckoutOpen(false);
    setCartOpen(false);
  };

  if (confirmation) return <Confirmation order={confirmation} />;
  return (
    <main className="min-h-screen bg-[#FCF7ED] pb-24 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-[#FCF7ED] px-4 py-3 shadow-sm md:px-10 lg:px-16">
        <div className="mx-auto flex flex-col w-full max-w-6xl items-center justify-between">
          <div className="relative flex w-full items-center justify-center">
            {/* Logo centralizada */}
            <div>
              <img src="/logo.png" alt="" className="h-[100px] w-[250px]" />
            </div>

            {/* Carrinho fixo no canto direito */}
            <div className="absolute right-0">
              <button
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200"
                aria-label="Carrinho"
              >
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />

                <span
                  className="
                   absolute
                   -right-1 -top-1
                   flex items-center justify-center
                   rounded-full
                   bg-orange-500
                   text-white font-bold
                   h-4 w-4 text-[9px]
                   sm:h-5 sm:w-5 sm:text-[10px]
                   md:h-6 md:w-6 md:text-[11px]
                 "
                >
                  2
                </span>
              </button>
            </div>
          </div>
          <div className="pt-5 flex items-center gap-2 justify-center">
            <FaCircle color="#295727" size={14} />
            <span className=" text-[13px] font-bold  text-[#295727]">
              Aberto agora 18h às 23h
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl ">
        {/* Hero */}
        <section className="relative min-h-[260px] max-h-[560px] overflow-hidden bg-gray-900 md:mt-6">
          <img
            src="/bannerPizza.jpg"
            alt=""
            className="w-full object-cover  "
          />

          <div className="absolute  " />

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 1080 400"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fill="#FCF7ED"
              d="M 0 156 C 216 133 453 105 600 132 C 712 152 763 206 759 288 C 759 384 878 391 1026 400 L 0 400 Z"
            />
          </svg>

          <div className="absolute inset-x-0 bottom-0 p-[clamp(1rem,4vw,2rem)] pb-10 text-white sm:pb-16 md:pb-20">
            <span className="mt-1 block text-[clamp(2rem,6vw,4rem)] font-bold leading-[1.05] text-[#295727]">
              Pizza feita
              <br />
              <span className="text-[#ac1917]">com carinho.</span>
            </span>

            <p className="mt-[clamp(0.4rem,1.5vw,0.75rem)] max-w-[clamp(14rem,45vw,20rem)] text-[clamp(0.75rem,2vw,1rem)] leading-[1.35] text-[#295727]">
              Sabor, tradição e qualidade
              <br />
              em todo pedido.
            </p>
          </div>
        </section>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
          >
            {error}
          </div>
        )}

        {/* Categorias */}
        <nav
          aria-label="Categorias"
          className="scrollbar-none mt-5 flex gap-2 overflow-x-auto pb-1"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setActiveCategory(category);
                document
                  .getElementById(`category-${category}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition ${
                activeCategory === category
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-200"
                  : "bg-white text-gray-500 hover:bg-gray-100"
              }`}
            >
              {category}
            </button>
          ))}
        </nav>

        {/* Conteúdo */}
        <section className="mt-6 p-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">
              Carregando sabores...
            </div>
          ) : groupedItems.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              Nenhum item disponível no momento. Volte em alguns minutos.
            </div>
          ) : (
            groupedItems.map(({ category, items: categoryItems }) => (
              <section
                id={`category-${category}`}
                key={category}
                className="mb-8 scroll-mt-24"
              >
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <span
                      style={{ fontFamily: '"Fraunces", serif' }}
                      className="text-xl font-bold text-[#295727]"
                    >
                      Mais Pedidos
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigate("/pedido/cardapio");
                    }}
                    className="inline-flex items-center justify-center cursor-pointer gap-1 font-bold text-[#ac1917]"
                  >
                    <span className="leading-none">Ver todos</span>
                    <ArrowRight size={18} className="relative top-[1px]" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {categoryItems.map((item) => (
                    <article
                      key={item.id}
                      className="group overflow-hidden rounded-2xl max-w-[200px] bg-white shadow-sm ring-1 ring-black/[0.03] transition hover:shadow-md"
                    >
                      <div className="flex max-h-[130px] aspect-square items-center justify-center overflow-hidden bg-gray-50">
                        {item.imagem_url ? (
                          <img
                            src={item.imagem_url}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-4xl">🍕</span>
                        )}
                      </div>

                      <div className="p-3">
                        <h3 className="truncate text-sm font-bold text-[#295727]">
                          {item.nome_comercial}
                        </h3>
                        <p className="mt-1 line-clamp-2 hidden text-xs text-gray-500 md:block">
                          {item.descricao ||
                            "Uma receita especial da Della Nonna."}
                        </p>

                        <div className="mt-2 flex items-center justify-between">
                          <strong className="text-sm font-bold text-[#ac1917] md:text-base">
                            {money(item.preco_venda)}
                          </strong>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </section>
      </div>

      {/* Navegação inferior — apenas em telas pequenas */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-gray-100 bg-white py-2.5 md:hidden">
        {[
          { label: "Início", icon: "🏠" },
          { label: "Cardápio", icon: "📋" },
          { label: "Carrinho", icon: "🛒", badge: 2 },
          { label: "Perfil", icon: "👤" },
        ].map(({ label, icon, badge }) => (
          <button
            key={label}
            className="relative flex flex-col items-center gap-1 px-3 text-[11px] font-medium text-gray-400 first:text-orange-500"
          >
            <span className="text-base leading-none">{icon}</span>
            {label}
            {badge && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-bold text-white">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </main>
  );
}

function CartSheet({
  cart,
  subtotal,
  onClose,
  onChange,
  onObservation,
  onCheckout,
}: {
  cart: CartLine[];
  subtotal: number;
  onClose: () => void;
  onChange: (line: CartLine, amount: number) => void;
  onObservation: (line: CartLine, value: string) => void;
  onCheckout: () => void;
}) {
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <section
        className="order-sheet"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header>
          <div>
            <span className="order-kicker">SEU PEDIDO</span>
            <h2>Confira seus itens</h2>
          </div>
          <button
            className="close-button"
            onClick={onClose}
            aria-label="Fechar carrinho"
          >
            <X />
          </button>
        </header>
        <div className="cart-lines">
          {cart.map((line) => (
            <div className="cart-line" key={`${line.id}-${line.observacao}`}>
              <div>
                <strong>{line.nome_comercial}</strong>
                <small>{money(line.preco_venda)} cada</small>
                <input
                  placeholder="Alguma observação?"
                  value={line.observacao}
                  onChange={(event) => onObservation(line, event.target.value)}
                />
              </div>
              <div className="quantity-control">
                <button
                  onClick={() => onChange(line, -1)}
                  aria-label="Diminuir"
                >
                  <Minus size={16} />
                </button>
                <b>{line.quantidade}</b>
                <button onClick={() => onChange(line, 1)} aria-label="Aumentar">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <footer className="sheet-total">
          <div>
            <span>Subtotal</span>
            <strong>{money(subtotal)}</strong>
          </div>
          <button className="checkout-button" onClick={onCheckout}>
            Continuar <ChevronRight size={18} />
          </button>
        </footer>
      </section>
    </div>
  );
}

function CheckoutSheet({
  form,
  subtotal,
  error,
  submitting,
  onClose,
  onUpdate,
  onSubmit,
}: {
  form: CheckoutForm;
  subtotal: number;
  error: string;
  submitting: boolean;
  onClose: () => void;
  onUpdate: (key: keyof CheckoutForm, value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const delivery = form.type === "delivery";
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <section
        className="order-sheet checkout-sheet"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header>
          <button className="back-button" onClick={onClose} aria-label="Voltar">
            <ArrowLeft />
          </button>
          <div>
            <span className="order-kicker">ÚLTIMO PASSO</span>
            <h2>Onde entregamos?</h2>
          </div>
        </header>
        <form onSubmit={onSubmit}>
          <div className="field-grid">
            <label>
              Seu nome
              <input
                required
                value={form.name}
                onChange={(event) => onUpdate("name", event.target.value)}
                autoComplete="name"
              />
            </label>
            <label>
              WhatsApp
              <input
                required
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(event) => onUpdate("phone", event.target.value)}
                autoComplete="tel"
              />
            </label>
          </div>
          <fieldset>
            <legend>Como deseja receber?</legend>
            <div className="choice-row">
              <label className={delivery ? "selected" : ""}>
                <input
                  type="radio"
                  name="type"
                  value="delivery"
                  checked={delivery}
                  onChange={(event) => onUpdate("type", event.target.value)}
                />
                Delivery
              </label>
              <label className={!delivery ? "selected" : ""}>
                <input
                  type="radio"
                  name="type"
                  value="retirada"
                  checked={!delivery}
                  onChange={(event) => onUpdate("type", event.target.value)}
                />
                Retirada
              </label>
            </div>
          </fieldset>
          {delivery && (
            <div className="address-fields">
              <div className="field-grid">
                <label>
                  CEP
                  <input
                    required
                    value={form.cep}
                    onChange={(event) => onUpdate("cep", event.target.value)}
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                </label>
                <label>
                  Número
                  <input
                    required
                    value={form.number}
                    onChange={(event) => onUpdate("number", event.target.value)}
                    inputMode="numeric"
                  />
                </label>
              </div>
              <label>
                Rua
                <input
                  required
                  value={form.street}
                  onChange={(event) => onUpdate("street", event.target.value)}
                  autoComplete="street-address"
                />
              </label>
              <div className="field-grid">
                <label>
                  Bairro
                  <input
                    required
                    value={form.neighborhood}
                    onChange={(event) =>
                      onUpdate("neighborhood", event.target.value)
                    }
                  />
                </label>
                <label>
                  Complemento
                  <input
                    value={form.complement}
                    onChange={(event) =>
                      onUpdate("complement", event.target.value)
                    }
                  />
                </label>
              </div>
              <label>
                Referência <span>(opcional)</span>
                <input
                  value={form.reference}
                  onChange={(event) =>
                    onUpdate("reference", event.target.value)
                  }
                />
              </label>
            </div>
          )}
          <label>
            Forma de pagamento
            <select
              value={form.payment}
              onChange={(event) => onUpdate("payment", event.target.value)}
            >
              {Object.entries(paymentLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Observação do pedido <span>(opcional)</span>
            <textarea
              rows={2}
              value={form.note}
              onChange={(event) => onUpdate("note", event.target.value)}
              placeholder="Ex.: tocar a campainha"
            />
          </label>
          {error && <div className="order-alert">{error}</div>}
          <button className="checkout-button submit" disabled={submitting}>
            {submitting ? (
              "Enviando pedido..."
            ) : (
              <>
                Finalizar pedido <strong>{money(subtotal)}</strong>
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}

function Confirmation({ order }: { order: OrderConfirmation }) {
  return (
    <main className="confirmation-page">
      <div className="confirmation-mark">✓</div>
      <p className="order-kicker">PEDIDO RECEBIDO</p>
      <h1>
        Já estamos
        <br />
        <em>preparando.</em>
      </h1>
      <p className="confirmation-copy">
        Obrigado por escolher a Della Nonna. Em breve entraremos em contato pelo
        WhatsApp.
      </p>
      <div className="confirmation-card">
        <span>Pedido</span>
        <strong>#{order.numero_pedido}</strong>
        <div>
          <span>Total</span>
          <b>{money(order.total)}</b>
        </div>
        <div>
          <span>Recebimento</span>
          <b>{order.tipo_entrega === "delivery" ? "Delivery" : "Retirada"}</b>
        </div>
        <div>
          <span>Pagamento</span>
          <b>{paymentLabels[order.forma_pagamento]}</b>
        </div>
      </div>
      <button className="back-menu" onClick={() => window.location.reload()}>
        Voltar ao cardápio <ArrowLeft size={17} />
      </button>
    </main>
  );
}
