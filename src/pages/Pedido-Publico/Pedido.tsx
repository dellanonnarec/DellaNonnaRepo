import { useEffect, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";
import {
  type CartItem,
  type MenuCategory,
  type MenuItem,
  cartSubtotal,
} from "./types";
import CartPage from "./CartPage";
import {
  buildAdditions,
  createCartItem,
  customizedUnitPrice,
  isCustomizablePizza,
} from "./customization";
import "./della-theme.css";

const CART_KEY = "della-nonna-public-cart";
const MENU_QUERY_TIMEOUT_MS = 12_000;

function isAddonCategory(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  return /^(?:adicion(?:al|ais)|bordas?)\b/.test(normalized);
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const cart = raw ? (JSON.parse(raw) as Partial<CartItem>[]) : [];
    return cart.map(
      (item) =>
        ({
          ...item,
          additions: Array.isArray(item.additions) ? item.additions : [],
        }) as CartItem,
    );
  } catch {
    return [];
  }
}

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const formatPrice = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function Pedido() {
  const location = useLocation();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>(readCart);
  const [selectedProduct, setSelectedProduct] = useState<MenuItem | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [observation, setObservation] = useState("");
  const cartCount = cart.reduce((count, item) => count + item.quantity, 0);
  const [activeCategory, setActiveCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let categoryResult;
      let itemResult;

      try {
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () =>
              reject(
                new Error("A consulta ao cardápio excedeu o tempo limite."),
              ),
            MENU_QUERY_TIMEOUT_MS,
          );
        });

        [categoryResult, itemResult] = await Promise.race([
          Promise.all([
            supabase
              .from("categorias_cardapio")
              .select("id,nome,ordem,ativa")
              .eq("ativa", true)
              .order("ordem"),

            supabase
              .from("cardapio_itens")
              .select(
                "id,nome_comercial,descricao,categoria_id,tamanho,imagem_url,preco_venda,destaque,disponivel,ordem_exibicao,origem_tipo,receita_id,insumo_id",
              )
              .eq("disponivel", true)
              .order("ordem_exibicao"),
          ]),
          timeout,
        ]);
      } catch (queryError) {
        if (!active) return;

        console.error("Falha ao carregar o cardápio público:", queryError);
        setError(
          queryError instanceof Error &&
            queryError.message.includes("tempo limite")
            ? "O cardápio está demorando para responder. Tente novamente."
            : "Não foi possível carregar o cardápio. Tente novamente em instantes.",
        );
        setLoading(false);
        return;
      } finally {
        if (timeoutId !== undefined) clearTimeout(timeoutId);
      }

      if (!active) return;

      if (categoryResult.error || itemResult.error) {
        console.error(
          "Falha ao carregar o cardápio público:",
          categoryResult.error ?? itemResult.error,
        );

        setError(
          "Não foi possível carregar o cardápio. Tente novamente em instantes.",
        );

        setLoading(false);
        return;
      }

      /*
       * Remove categorias que não devem aparecer
       * no cardápio público.
       */
      const categoryRows = (categoryResult.data ?? []) as MenuCategory[];

      const categoryById = new Map(
        categoryRows.map((category) => [category.id, category]),
      );

      const loadedItems: MenuItem[] = (itemResult.data ?? []).flatMap(
        (row: any) => {
          const category = categoryById.get(row.categoria_id);

          if (!category) return [];

          return [
            {
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
            },
          ];
        },
      );

      if (!active) return;

      setCategories(
        categoryRows.filter((category) => !isAddonCategory(category.nome)),
      );
      setItems(loadedItems);
      setLoading(false);

      /*
       * A primeira categoria vira a categoria selecionada
       * inicialmente.
       */
      setActiveCategory("Todas");
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // O carrinho continua disponível na página se o armazenamento falhar.
    }
  }, [cart]);

  useEffect(() => {
    const syncCart = () => setCart(readCart());
    window.addEventListener("storage", syncCart);
    window.addEventListener("focus", syncCart);
    return () => {
      window.removeEventListener("storage", syncCart);
      window.removeEventListener("focus", syncCart);
    };
  }, []);

  const additionalItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.origem_tipo === "insumo" && isAddonCategory(item.categoria),
      ),
    [items],
  );
  const borderItems = useMemo(
    () =>
      additionalItems.filter((item) =>
        /^bordas?\b/.test(normalizeText(item.categoria)),
      ),
    [additionalItems],
  );
  const extraItems = useMemo(
    () =>
      additionalItems.filter((item) =>
        /^adicion(?:al|ais)\b/.test(normalizeText(item.categoria)),
      ),
    [additionalItems],
  );

  const startCustomization = (item: MenuItem) => {
    setSelectedProduct(item);
    setSelectedExtras([]);
    setQuantity(1);
    setObservation("");
  };

  const confirmCustomization = () => {
    if (!selectedProduct || quantity < 1) return;
    const additions = isCustomizablePizza(selectedProduct)
      ? buildAdditions(additionalItems, selectedExtras)
      : [];
    setCart((current) => {
      const nextCart = [
        ...current,
        createCartItem(
          selectedProduct,
          quantity,
          observation.trim(),
          additions,
        ),
      ];
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(nextCart));
      } catch {
        // O carrinho continua disponível na página se o armazenamento falhar.
      }
      return nextCart;
    });
    setSelectedProduct(null);
  };

  const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim());

    return items.filter((item) => {
      if (isAddonCategory(item.categoria)) return false;
      const matchesCategory =
        activeCategory === "Todas" || item.categoria_id === activeCategory;

      if (!matchesCategory) return false;

      if (!normalizedSearch) return true;

      const searchableText = normalizeText(
        [item.nome_comercial, item.descricao ?? "", item.categoria].join(" "),
      );

      return searchableText.includes(normalizedSearch);
    });
  }, [items, activeCategory, search]);

  const visibleCategories = useMemo(() => {
    return categories.filter((category) => !isAddonCategory(category.nome));
  }, [categories]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, MenuItem[]>();

    visibleCategories.forEach((category) => {
      groups.set(category.id, []);
    });

    filteredItems.forEach((item) => {
      const current = groups.get(item.categoria_id);

      if (current) {
        current.push(item);
      } else {
        groups.set(item.categoria_id, [item]);
      }
    });

    return visibleCategories
      .map((category) => ({
        category,
        items: groups.get(category.id) ?? [],
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredItems, visibleCategories]);

  const getProductBadge = (item: MenuItem) => {
    if (item.destaque) {
      return "MAIS PEDIDA";
    }

    if (normalizeText(item.nome_comercial).includes("parma")) {
      return "DA NONNA";
    }

    return null;
  };

  const changeCartQuantity = (cartKey: string, nextQuantity: number) =>
    setCart((current) =>
      nextQuantity < 1
        ? current.filter((item) => item.cartKey !== cartKey)
        : current.map((item) =>
            item.cartKey === cartKey
              ? { ...item, quantity: nextQuantity }
              : item,
          ),
    );

  const removeCartItem = (cartKey: string) =>
    setCart((current) => current.filter((item) => item.cartKey !== cartKey));

  if (location.pathname === "/sacola") {
    return (
      <CartPage
        items={cart}
        onBack={() => navigate("/pedido")}
        onContinue={() => navigate("/checkout")}
        onChangeQuantity={changeCartQuantity}
        onRemove={removeCartItem}
      />
    );
  }

  const cartTotal = cartSubtotal(cart);

  return (
    <main className="min-h-screen bg-[#F8F4E8] font-sans text-[#295727]">
      {/* ======================================================
          HEADER
      ====================================================== */}
      <header className="relative z-50 mx-auto flex max-w-6xl items-center justify-center bg-[#F8F4E8] px-5 pb-3 pt-2 sm:px-8">
        <div className="leading-none">
          <img
            src="/logo2.png"
            alt="Della Nonna"
            className="h-auto w-[clamp(190px,16vw,250px)]"
          />
        </div>
      </header>

      {/* ======================================================
          BANNER
      ====================================================== */}
      <section className="relative mx-5 h-72 overflow-hidden rounded-2xl sm:mx-8 lg:mx-auto lg:max-w-6xl">
        <img
          src="/banner1.png"
          alt="Pizza artesanal com manjericão fresco"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-5 sm:px-8">
          <p className="max-w-[16rem] text-[clamp(8px,1.5vw,12px)] uppercase leading-relaxed tracking-[0.25em] text-white/80">
            Sabor, tradição e
            <br />
            qualidade em todo pedido.
          </p>

          <span className="mt-2 h-px w-8 bg-[#EB662E]" />

          <h1 className="mt-3 font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
            Pizza feita
            <span className="block font-bold italic text-[#EB662E]">
              com carinho.
            </span>
          </h1>
        </div>
      </section>

     
      <section
        id="cardapio"
        className="mx-auto max-w-6xl px-5 pb-20 pt-5 sm:px-8"
      >
        
        <div className="relative">
          <Search
            size={17}
            strokeWidth={1.7}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#60705E]"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar sabor ou ingrediente"
            type="search"
            className="h-11.5 w-full rounded-full border border-[#DED7C4] bg-[#FBF8EF] pl-11 pr-5 text-[14px] text-[#295727] outline-none transition placeholder:text-[#71806F] focus:border-[#295727]"
          />
        </div>

        {/* ====================================================
            ABAS
        ==================================================== */}
        <div className="-mx-5 mt-5 overflow-x-auto border-b border-[#DDD6C4] px-5 sm:-mx-8 sm:px-8">
          <div className="flex min-w-max items-end gap-7">
            <button
              type="button"
              onClick={() => setActiveCategory("Todas")}
              className={[
                "relative pb-3 pt-1 text-[14px] transition-colors",
                activeCategory === "Todas"
                  ? "font-medium text-[#B51E24]"
                  : "text-[#60705E] hover:text-[#295727]",
              ].join(" ")}
            >
              Todas
              {activeCategory === "Todas" && (
                <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#B51E24]" />
              )}
            </button>
            {visibleCategories.map((category) => {
              const isActive = activeCategory === category.id;

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={[
                    "relative pb-3 pt-1 text-[14px] transition-colors",
                    isActive
                      ? "font-medium text-[#B51E24]"
                      : "text-[#60705E] hover:text-[#295727]",
                  ].join(" ")}
                >
                  {category.nome}

                  {isActive && (
                    <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#B51E24]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ====================================================
            ESTADO DE CARREGAMENTO
        ==================================================== */}
        {loading && (
          <div className="py-16 text-center">
            <p className="text-sm text-[#71806F]">Carregando cardápio...</p>
          </div>
        )}

        {/* ====================================================
            ERRO
        ==================================================== */}
        {!loading && error && (
          <div className="py-16 text-center">
            <p className="text-sm text-[#B51E24]">{error}</p>
          </div>
        )}

        {/* ====================================================
            PRODUTOS
        ==================================================== */}
        {!loading && !error && (
          <div className="mt-8">
            {groupedItems.length === 0 ? (
              <div className="py-16 text-center">
                <p className="font-display text-2xl italic text-[#295727]">
                  Nenhum produto encontrado.
                </p>

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-3 text-sm text-[#B51E24] underline underline-offset-4"
                  >
                    Limpar busca
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-12">
                {groupedItems.map(({ category, items: categoryItems }) => (
                  <section key={category.id}>
                    {/* Nome da categoria */}
                    <h2 className="mb-6 font-display text-[26px] italic leading-none text-[#295727]">
                      {category.nome}
                    </h2>

                    {/* Produtos */}
                    <div>
                      {categoryItems.map((item, index) => {
                        const badge = getProductBadge(item);

                        return (
                          <article
                            key={item.id}
                            className={[
                              "relative flex min-h-32 items-center gap-4 py-4",
                              index !== categoryItems.length - 1
                                ? "border-b border-[#DDD6C4]"
                                : "",
                            ].join(" ")}
                          >
                            {/* Conteúdo */}
                            <div className="min-w-0 flex-1 pr-1">
                              {badge && (
                                <p className="mb-1 text-[9px] font-medium uppercase tracking-[0.18em] text-[#EB662E]">
                                  {badge}
                                </p>
                              )}

                              <h3 className="font-display text-[18px] font-semibold leading-tight text-[#295727]">
                                {item.nome_comercial}
                              </h3>

                              {item.descricao && (
                                <p className="mt-1 text-[14px] leading-[1.45] text-[#60705E]">
                                  {item.descricao}
                                </p>
                              )}

                              <p className="mt-2 text-[13px] text-[#60705E]">
                                a partir de{" "}
                                <span className="font-medium text-[#B51E24]">
                                  {formatPrice(item.preco_venda)}
                                </span>
                              </p>
                            </div>

                            {/* Imagem + botão */}
                            <div className="relative mr-0 h-23.5 w-23.5 shrink-0 sm:h-25 sm:w-25">
                              {item.imagem_url ? (
                                <img
                                  src={item.imagem_url}
                                  alt={item.nome_comercial}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full rounded-full bg-[#E7DFCB]" />
                              )}

                              <button
                                type="button"
                                aria-label={`Adicionar ${item.nome_comercial}`}
                                onClick={() => startCustomization(item)}
                                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#B51E24] text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                              >
                                <Plus size={19} strokeWidth={1.8} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {cart.length > 0 && (
        <button
          type="button"
          onClick={() => navigate("/sacola")}
          aria-label={`Ver sacola, ${cartCount} ${cartCount === 1 ? "item" : "itens"}, total ${formatPrice(cartTotal)}`}
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex min-h-16 max-w-xl items-center justify-between gap-4 rounded-4xl bg-[#B51E24] px-5 py-4 text-left text-white shadow-[0_12px_35px_rgba(95,20,22,0.35)] transition hover:bg-[#9f1b20] active:scale-[0.99] sm:bottom-6 sm:px-6"
        >
          <span className="font-semibold">
            Ver sacola · {cartCount} {cartCount === 1 ? "item" : "itens"}
          </span>
          <span className="shrink-0 text-lg font-bold">
            {formatPrice(cartTotal)}
          </span>
        </button>
      )}

      {selectedProduct && (
        <div
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customization-title"
            className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-[#F8F4E8] text-[#183a29] shadow-2xl sm:rounded-2xl"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e2dac1] bg-[#F8F4E8]/95 px-5 py-4 backdrop-blur">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#829078]">
                  Personalizar pedido
                </p>
                <h2
                  id="customization-title"
                  className="mt-1 font-display text-xl font-bold"
                >
                  {selectedProduct.nome_comercial}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                aria-label="Fechar personalização"
                className="grid size-10 place-items-center rounded-full text-[#315c40] hover:bg-[#f0ead3]"
              >
                <X size={20} />
              </button>
            </header>

            <div className="space-y-5 px-5 py-5">
              {selectedProduct.imagem_url && (
                <img
                  src={selectedProduct.imagem_url}
                  alt={selectedProduct.nome_comercial}
                  className="h-44 w-full rounded-xl object-cover"
                />
              )}
              {selectedProduct.descricao && (
                <p className="text-sm leading-relaxed text-[#60705E]">
                  {selectedProduct.descricao}
                </p>
              )}
              {selectedProduct.tamanho && (
                <div className="rounded-xl border border-[#e2dac1] bg-[#fffdf4] p-3">
                  <p className="text-xs uppercase tracking-wide text-[#829078]">
                    Tamanho
                  </p>
                  <p className="mt-1 font-semibold">
                    {selectedProduct.tamanho}
                  </p>
                </div>
              )}
              {isCustomizablePizza(selectedProduct) && (
                <>
                  {[
                    {
                      title: "Bordas",
                      options: borderItems,
                      empty: "Nenhuma borda disponível no momento.",
                    },
                    {
                      title: "Adicionais",
                      options: extraItems,
                      empty: "Nenhum adicional disponível no momento.",
                    },
                  ].map(({ title, options, empty }) => (
                    <fieldset key={title}>
                      <legend className="font-serif text-lg font-bold text-[#155b3b]">
                        {title}
                      </legend>
                      <p className="mb-2 text-xs text-[#829078]">
                        Escolha se deseja incluir{" "}
                        {title.toLocaleLowerCase("pt-BR")} na pizza
                      </p>
                      {options.length === 0 ? (
                        <p className="rounded-lg bg-[#f7f1dc] p-3 text-sm text-[#71826a]">
                          {empty}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {options.map((option) => (
                            <label
                              key={option.id}
                              className="flex cursor-pointer items-center gap-3 rounded-lg border border-[#eee8d4] bg-[#FCFAF3] p-3"
                            >
                              <input
                                type="checkbox"
                                checked={selectedExtras.includes(option.id)}
                                onChange={(event) =>
                                  setSelectedExtras((current) =>
                                    event.target.checked
                                      ? [...current, option.id]
                                      : current.filter(
                                          (id) => id !== option.id,
                                        ),
                                  )
                                }
                                className="size-4 accent-[#b51e24]"
                              />
                              <span className="min-w-0 flex-1">
                                <strong className="block text-sm text-[#315c40]">
                                  {option.nome_comercial}
                                </strong>
                                {option.descricao && (
                                  <small className="block text-xs text-[#829078]">
                                    {option.descricao}
                                  </small>
                                )}
                              </span>
                              <span className="text-xs font-bold text-[#b51e24]">
                                + {formatPrice(option.preco_venda)}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </fieldset>
                  ))}
                </>
              )}
              <label className="block">
                <span className="font-serif text-lg font-bold">
                  Observações{" "}
                  <small className="text-xs font-normal text-[#829078]">
                    (opcional)
                  </small>
                </span>
                <textarea
                  value={observation}
                  onChange={(event) => setObservation(event.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Ex.: sem cebola, cortar em 8 pedaços"
                  className="mt-2 w-full resize-y rounded-xl border border-[#e2dbc5] bg-[#fffdf4] p-3 text-sm outline-none focus:border-[#a64a38]"
                />
                <span className="block text-right text-[10px] text-[#929887]">
                  {observation.length}/300
                </span>
              </label>
            </div>

            <footer className="sticky bottom-0 flex items-center gap-3 border-t border-[#e2dac1] bg-[#fbf7e9]/95 px-5 py-3 backdrop-blur">
              <div className="inline-flex h-12 shrink-0 items-center rounded-full border border-[#ddd5bd] bg-[#fffdf4]">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  aria-label="Diminuir quantidade"
                  className="grid size-10 place-items-center text-xl"
                >
                  −
                </button>
                <span className="w-5 text-center text-sm font-bold">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((value) => value + 1)}
                  aria-label="Aumentar quantidade"
                  className="grid size-10 place-items-center text-xl"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={confirmCustomization}
                disabled={quantity < 1}
                className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-[#c63220] px-4 text-sm font-bold text-white hover:bg-[#ad2b1c] disabled:opacity-50"
              >
                <Plus size={17} strokeWidth={2.5} />
                <span className="truncate">
                  Adicionar ao carrinho ·{" "}
                  {formatPrice(
                    customizedUnitPrice(
                      selectedProduct,
                      buildAdditions(additionalItems, selectedExtras),
                    ) * quantity,
                  )}
                </span>
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
