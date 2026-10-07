import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ArrowRight,
  ChevronRight,
  Ellipsis,
  Home,
  Menu,
  ShoppingCart,
  Flame,
  Plus,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";
import { type MenuCategory, type MenuItem, money } from "./types";
import "./della-theme.css";
import { BannerWaves } from "./BannerWaves";

const favorites = [
  {
    name: "Pizza de Calabresa",
    description: "Massa artesanal, feita na hora.",
    price: "R$ 40,00",
  },
  {
    name: "Pizza de Frango com Catupiry",
    description: "Massa artesanal, feita na hora.",
    price: "R$ 45,00",
  },
];

const CART_KEY = "della-nonna-public-cart";

function isAddonCategory(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

  return /^(?:adicion(?:al|ais)|bordas?)\b/.test(normalized);
}

function readCartCount() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const cart = raw ? (JSON.parse(raw) as { quantity?: number }[]) : [];
    return cart.reduce(
      (count, item) => count + (Number(item.quantity) || 0),
      0,
    );
  } catch {
    return 0;
  }
}

const categoryImages: Record<string, string> = {
  "Pizzas Salgadas": "/salgada.jpg",
  "Pizzas Doces": "/doce.jpg",
  Bebidas: "/bebida.jpg",
};

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
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<MenuItem[]>([]);
  const [cartCount, setCartCount] = useState(readCartCount);
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

      const [categoryResult, itemResult] = await Promise.all([
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
      ]);

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
      const categoryRows = (categoryResult.data ?? []).filter(
        (category) => !isAddonCategory(category.nome),
      ) as MenuCategory[];

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

      setCategories(categoryRows);
      setItems(loadedItems);
      setLoading(false);

      /*
       * A primeira categoria vira a categoria selecionada
       * inicialmente.
       */
      if (categoryRows.length > 0) {
        setActiveCategory((current) => current ?? categoryRows[0].id);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const syncCartCount = () => setCartCount(readCartCount());
    window.addEventListener("storage", syncCartCount);
    window.addEventListener("focus", syncCartCount);
    return () => {
      window.removeEventListener("storage", syncCartCount);
      window.removeEventListener("focus", syncCartCount);
    };
  }, []);

  const openMenu = (categoryId?: string) => {
    navigate("/pedido/cardapio", {
      state: categoryId ? { categoryId } : undefined,
    });
  };

   const filteredItems = useMemo(() => {
    const normalizedSearch = normalizeText(search.trim());

    return items.filter((item) => {
      const matchesCategory =
        !activeCategory || item.categoria_id === activeCategory;

      if (!matchesCategory) return false;

      if (!normalizedSearch) return true;

      const searchableText = normalizeText(
        [
          item.nome_comercial,
          item.descricao ?? "",
          item.categoria,
        ].join(" "),
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

   return (
    <main className="min-h-screen bg-[#F8F4E8] font-sans text-[#295727]">
      {/* ======================================================
          HEADER
      ====================================================== */}
      <header className="relative z-50 mx-auto flex max-w-6xl items-center justify-between bg-[#F8F4E8] px-5 pb-3 pt-2 sm:px-8">
        <div className="leading-none">
          <img
            src="/logo2.png"
            alt="Della Nonna"
            className="h-auto w-[clamp(140px,16vw,180px)]"
          />
        </div>

        <nav className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Carrinho"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#dcd4bd] text-[#295727] transition-colors hover:bg-[#F0E9D6]"
          >
            <ShoppingCart
              className="h-5 w-5"
              strokeWidth={1.6}
            />

            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B51E24] px-1 text-[10px] font-bold leading-none text-white">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </nav>
      </header>

      {/* ======================================================
          BANNER
      ====================================================== */}
      <section className="relative mx-5 h-[18rem] overflow-hidden rounded-2xl sm:mx-8 lg:mx-auto lg:max-w-6xl">
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

      {/* ======================================================
          CARDÁPIO
      ====================================================== */}
      <section
        id="cardapio"
        className="mx-auto max-w-6xl px-5 pb-20 pt-10 sm:px-8"
      >
        {/* Cabeçalho */}
        <div className="mb-6">
          <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.25em] text-[#829078]">
            Nosso cardápio
            <span className="h-[2px] w-8 bg-[#EB662E]" />
          </p>
        </div>

        {/* ====================================================
            BUSCA
        ==================================================== */}
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
            className="h-[46px] w-full rounded-full border border-[#DED7C4] bg-[#FBF8EF] pl-11 pr-5 text-[14px] text-[#295727] outline-none transition placeholder:text-[#71806F] focus:border-[#295727]"
          />
        </div>

        {/* ====================================================
            ABAS
        ==================================================== */}
        <div className="-mx-5 mt-5 overflow-x-auto border-b border-[#DDD6C4] px-5 sm:-mx-8 sm:px-8">
          <div className="flex min-w-max items-end gap-7">
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
                    <span className="absolute bottom-0 left-0 h-[2px] w-full bg-[#B51E24]" />
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
            <p className="text-sm text-[#71806F]">
              Carregando cardápio...
            </p>
          </div>
        )}

        {/* ====================================================
            ERRO
        ==================================================== */}
        {!loading && error && (
          <div className="py-16 text-center">
            <p className="text-sm text-[#B51E24]">
              {error}
            </p>
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
                              "relative flex min-h-[128px] items-center gap-4 py-4",
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
                            <div className="relative mr-0 h-[94px] w-[94px] shrink-0 sm:h-[100px] sm:w-[100px]">
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
                               
                                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#B51E24] text-white shadow-sm transition-transform hover:scale-105 active:scale-95"
                              >
                                <Plus
                                  size={19}
                                  strokeWidth={1.8}
                                />
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
    </main>
  );
}