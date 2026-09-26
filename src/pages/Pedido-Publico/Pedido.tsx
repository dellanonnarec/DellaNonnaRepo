import { useEffect, useState } from "react";
import {
  BookOpen,
  ArrowRight,
  ChevronRight,
  Ellipsis,
  Home,
  Menu,
  ShoppingCart,
  Flame,
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

export default function Pedido() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [featured, setFeatured] = useState<MenuItem[]>([]);
  const [cartCount, setCartCount] = useState(readCartCount);

  useEffect(() => {
    let active = true;
    const loadFeatured = async () => {
      if (!publicSupabase) return;
      const [categoriesResult, itemsResult] = await Promise.all([
        publicSupabase
          .from("categorias_cardapio")
          .select("id,nome,ordem,ativa")
          .eq("ativa", true)
          .order("ordem"),
        publicSupabase
          .from("cardapio_itens")
          .select(
            "id,nome_comercial,descricao,categoria_id,tamanho,imagem_url,preco_venda,destaque,disponivel,ordem_exibicao,origem_tipo,receita_id,insumo_id",
          )
          .eq("disponivel", true)
          .eq("destaque", true)
          .order("ordem_exibicao")
          .limit(30),
      ]);
      if (!active) return;
      if (categoriesResult.error) {
        console.error(
          "Falha ao carregar categorias do cardápio:",
          categoriesResult.error,
        );
        return;
      }

      const visibleCategories = (categoriesResult.data ?? []).filter(
        (category) => !isAddonCategory(category.nome),
      );
      setCategories(visibleCategories as MenuCategory[]);
      if (itemsResult.error) {
        console.error(
          "Falha ao carregar itens em destaque:",
          itemsResult.error,
        );
        return;
      }

      const categoryNames = new Map(
        visibleCategories.map((category) => [category.id, category.nome]),
      );
      const items = (itemsResult.data ?? []).flatMap((row: any) => {
        const category = categoryNames.get(row.categoria_id);
        if (!category || isAddonCategory(category)) return [];
        return [
          {
            ...row,
            categoria: category,
            preco_venda: Number(row.preco_venda ?? 0),
            destaque: Boolean(row.destaque),
          } as MenuItem,
        ];
      });
      setFeatured(items.slice(0, 8));
    };

    void loadFeatured();
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

  return (
    <main className="min-h-screen bg-[#F8F4E8] font-sans">
      {/* Header */}
      <header className="mx-auto relative z-50 flex max-w-6xl items-center justify-between pt-2 px-5 sm:px-8 bg-[#F8F4E8]">
        <div className="leading-none">
          <img
            src="/logo.png"
            alt=""
            className="h-auto w-[clamp(90px,12vw,140px)]"
          />
        </div>

        <nav className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Carrinho"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary"
          >
            <ShoppingCart className="h-5 w-5" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            aria-label="Menu"
            className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
          >
            <Menu className="h-6 w-6" strokeWidth={1.6} />
          </button>
        </nav>
      </header>

      {/* Banner */}
      <section className="relative bottom-[40px] isolate h-[26rem] w-full overflow-hidden sm:h-[30rem] lg:h-[34rem]">
        <img
          src="/banner1.png"
          alt="Pizza artesanal com manjericão fresco"
          width={1408}
          height={1200}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <BannerWaves />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-5 sm:px-8">
          <p className="max-w-[16rem] text-[clamp(8px,1.5vw,12px)] uppercase leading-relaxed tracking-[0.25em] text-primary-foreground/80">
            Sabor, tradição e <br /> qualidade em todo pedido.
          </p>
          <span className="h-px w-8 bg-accent/100 mt-2" />
          <h1 className="mt-3 font-display font-bold text-4xl leading-[1.05] text-primary-foreground sm:text-5xl lg:text-6xl">
            Pizza feita
            <span className=" font-bold block italic text-accent">
              com carinho.
            </span>
          </h1>

          <a
            href="#cardapio"
            className="mt-4 inline-flex w-fit items-center gap-4 rounded-full border border-primary-foreground/25 py-1 pl-2 pr-6 transition-colors hover:border-primary-foreground/50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ArrowRight className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="text-[0.7rem] uppercase leading-relaxed tracking-[0.2em] text-primary-foreground">
              Peça agora
              <br />e sinta o sabor
            </span>
          </a>
        </div>
      </section>

      {/* Cardápio intro */}
      <section
        id="cardapio"
        className="mx-auto relative bottom-[120px] flex max-w-6xl flex-wrap items-end justify-between gap-6 pl-6 pr-6 py-12 sm:px-8"
      >
        <div className="flex flex-row justify-between w-full">
          <div>
            <p className="flex items-center gap-2 text-[0.7rem] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              Nosso cardápio
              <span className="h-[2px] w-8 bg-accent/100" />
            </p>
            <h2 className=" font-display text-3xl font-bold  text-foreground sm:text-4xl">
              Escolha o seu
              <span className=" block italic text-accent">favorito.</span>
            </h2>
          </div>
          <a
            href="#cardapio"
            className="flex items-center justify-center-safe text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Ver todos
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </a>
        </div>
      </section>
      <nav
        aria-label="Categorias do cardápio"
        className="mt-3 grid gap-2 sm:mt-6 sm:gap-3 relative bottom-[160px] pl-6 pr-6"
      >
        {categories.map((category) => {
          const image = categoryImages[category.nome];

          return (
            <button
              key={category.id}
              onClick={() => openMenu(category.id)}
              className="group relative isolate cursor-pointer h-[95px] max-w-[1233px] mx-auto w-full overflow-hidden rounded-xl border border-border/60 bg-[#F8F4E8] text-left shadow-sm sm:h-28"
            >
              {image && (
                <img
                  src={image}
                  alt={category.nome}
                  loading="lazy"
                  width={1024}
                  height={768}
                  className="absolute inset-0 h-full w-full object-cover object-[center_46%] transition-transform duration-300 group-hover:scale-[1.03] sm:object-[center_52%]"
                />
              )}

              {/* DIVISOR / DEGRADÊ */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background: `
                     linear-gradient(
                       90deg,
                       #F8F4E8 0%,
                       #F8F4E8 34%,
                       rgba(245,237,217,0.98) 42%,
                       rgba(245,237,217,0.92) 48%,
                       rgba(245,237,217,0.75) 55%,
                       rgba(245,237,217,0.52) 61%,
                       rgba(245,237,217,0.30) 67%,
                       rgba(245,237,217,0.12) 74%,
                       rgba(245,237,217,0) 82%
                     )
                   `,
                }}
                aria-hidden="true"
              />

              <div className="relative z-20 flex h-full flex-col justify-center px-3 sm:px-6">
                {category.nome.toLowerCase().includes("pizza") ? (
                  <>
                    <p className="text-[8px] font-bold uppercase tracking-[0.19em] text-accent sm:text-[11px]">
                      Pizzas
                    </p>

                    <h3 className="font-display text-xl font-bold leading-none text-foreground sm:text-3xl">
                      {category.nome.replace(/pizzas?/i, "").trim()}
                    </h3>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] font-bold uppercase tracking-[0.19em] text-accent sm:text-[11px]">
                      PARA ACOMPANHAR
                    </p>

                    <h3 className="font-display text-xl font-bold leading-none text-foreground sm:text-3xl">
                      {category.nome}
                    </h3>
                  </>
                )}

                <ArrowRight
                  aria-hidden="true"
                  className="mt-1 h-3.5 w-3.5 text-accent transition-transform duration-300 group-hover:translate-x-1 sm:mt-2 sm:h-5 sm:w-5"
                  strokeWidth={1.5}
                />
              </div>
            </button>
          );
        })}
      </nav>
      {featured.length > 0 && (
        <section className="relative bottom-[140px] mx-auto mt-3 w-full max-w-[1233px]  sm:mt-8 pl-6 pr-6">
          <div className="mx-auto w-full max-w-[1233px]">
            {/* Título */}
            <div className="mb-[clamp(0.75rem,1.5vw,1.25rem)] flex items-center gap-[clamp(0.5rem,1vw,0.875rem)]">
              <span className="font-bold uppercase leading-none tracking-[clamp(0.16em,0.35vw,0.28em)] text-[clamp(0.75rem,1.5vw,1.1rem)] text-foreground">
                Mais pedidos
              </span>

              <span className="h-px w-[clamp(2rem,4vw,3rem)] shrink-0 bg-accent" />
            </div>

            {/* Cards */}
            <div className="grid w-full grid-cols-2 justify-center gap-2 sm:gap-4">
              {featured.map((item) => (
                <button
                  key={item.id}
                  onClick={() =>
                    navigate("/pedido/cardapio", {
                      state: { selectedItemId: item.id },
                    })
                  }
                  className="group w-full min-w-0 max-w-[620px] justify-self-center overflow-hidden rounded-lg border border-border/60 bg-card text-left shadow-sm"
                >
                  <div className="relative h-[clamp(140px,22vw,280px)] w-full overflow-hidden">
                    <img
                      src={item.imagem_url || "/bannerPizza.jpg"}
                      alt={item.nome_comercial}
                      loading="lazy"
                      width={1024}
                      height={768}
                      className="h-full w-full object-cover object-center"
                    />

                    <span
                      className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground sm:right-3 sm:top-3 sm:h-8 sm:w-8"
                      aria-label="Mais pedido"
                    >
                      <Flame className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />
                    </span>
                  </div>

                  <div className="px-[clamp(0.5rem,1.5vw,1rem)] pb-[clamp(0.5rem,1.5vw,1rem)] pt-[clamp(0.375rem,1vw,0.75rem)]">
                    <h3 className="font-display text-[clamp(0.85rem,1.8vw,1.25rem)] font-bold leading-[1.1] text-foreground">
                      {item.nome_comercial}
                    </h3>

                    <p className="mt-[clamp(0.25rem,0.6vw,0.5rem)] truncate text-[clamp(0.6rem,1.2vw,0.875rem)] text-muted-foreground">
                      {item.descricao || "Massa artesanal, feita na hora."}
                    </p>

                    <div className="mt-[clamp(0.5rem,1vw,0.75rem)] flex items-end justify-between gap-2">
                      <span className="text-[clamp(0.75rem,1.5vw,1.125rem)] font-bold text-accent">
                        {money(item.preco_venda)}
                      </span>

                      <span className="flex h-[clamp(1.5rem,3vw,2.25rem)] w-[clamp(1.5rem,3vw,2.25rem)] shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-300 group-hover:translate-x-1">
                        <ArrowRight className="h-[clamp(0.75rem,1.5vw,1rem)] w-[clamp(0.75rem,3vw,1rem)]" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
