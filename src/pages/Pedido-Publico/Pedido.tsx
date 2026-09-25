import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Coffee,
  Ellipsis,
  IceCreamCone,
  Home,
  Pizza,
  ShoppingCart,
  Soup,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";
import { type MenuCategory, type MenuItem, money } from "./types";

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

const categoryIcons = [Pizza, Coffee, Soup, IceCreamCone];

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
    <main className="min-h-dvh pb-24 text-[#28563a] bg-[#FCF8ED]">
      <div className="flex flex-col min-h-dvh min-w-full max-w-md bg-[#FCF8ED] pt-5">
        <header className="relative flex h-[104px] flex-col items-center justify-center px-4 pt-2">
          <img
            src="/logo.png"
            alt="Della Nonna Pizzaria"
            className="h-[82px] w-[168px] object-contain pb-2"
          />
          <button
            onClick={() =>
              navigate("/pedido/cardapio", { state: { openCart: true } })
            }
            aria-label={`Abrir carrinho, ${cartCount} itens`}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full border border-[#eee7d1] bg-[#fffdf4] text-[#28563a] shadow-sm"
          >
            <ShoppingCart size={19} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 grid size-[17px] place-items-center rounded-full bg-[#bb2027] text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </button>
          <div className="mt-0.5 flex items-center gap-1.5 text-[8px] italic leading-none text-[#b51e24]">
            <span className="h-px w-5 bg-[#b51e24]/60" />
            pizzaria
            <span className="h-px w-5 bg-[#b51e24]/60" />
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] font-bold  text-[#516f58]">
            <span className="size-1.5 rounded-full bg-[#37834b]" />
            <span>Aberto agora</span>
            <span className="text-[#b4ad91]">·</span>
            <span>18h às 23h</span>
          </div>
        </header>

        <div className="w-full flex-1 max-w-[700px]  mx-auto pt-5">
          <section className="relative min-h-[260px] max-h-[560px] overflow-hidden bg-[#FCF8ED] md:mt-6">
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

            <div className="font-serif absolute inset-x-0 bottom-0 p-[clamp(1rem,4vw,2rem)] pb-10 text-white ">
              <span className="mt-1 block text-[32px] sm:text-[40px] md:text-[58px] lg:text-[56px] font-bold leading-[1.05] text-[#295727]">
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

          <div className="p-5">
            <div className="flex flex-row justify-between">
              <h2 className="font-serif text-[22px] font-bold leading-none text-[#183f2c]">
                Nosso Cardápio
              </h2>
              <span className="flex items-center justify-between gap-0.5 text-[14px] sm:text-[15px] md:text-[16px] font-bold text-[#b51e24]">
                Ver todos
                <ChevronRight
                  size={16}
                  className="w-[14px] h-[14px] sm:w-[15px] sm:h-[15px] md:w-[16px] md:h-[16px]"
                  strokeWidth={3}
                />
              </span>
            </div>
            <nav
              aria-label="Categorias do cardápio"
              className="mt-1 grid grid-cols-4 gap-1.5"
            >
              {categories.map((category, index) => {
                const Icon = categoryIcons[index % categoryIcons.length];
                return (
                  <button
                    key={category.id}
                    onClick={() => openMenu(category.id)}
                    className="flex h-[90px] w-[90px] flex-col items-center justify-center gap-2 rounded-xl border text-[9px] font-medium border-[#eee7d3] bg-[#fffdf4] text-[#516d57]"
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{category.nome}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {featured.length > 0 && (
            <section className="mt-2.5 pb-5">
              <div className="mb-2 flex items-center justify-between px-0.5">
                <h2 className="font-serif text-[19px] font-bold leading-none text-[#183f2c]">
                  Mais pedidos
                </h2>
                <button
                  onClick={() => openMenu()}
                  className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#b51e24]"
                >
                  Ver todos <ChevronRight size={14} />
                </button>
              </div>

              <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {featured.map((item) => (
                  <button
                    key={item.id}
                    onClick={() =>
                      navigate("/pedido/cardapio", {
                        state: { selectedItemId: item.id },
                      })
                    }
                    className={`${featured.length === 1 ? "w-full min-w-full" : "w-[calc(50%-4px)] min-w-[calc(50%-4px)]"} overflow-hidden rounded-xl border border-[#e8e1c8] bg-[#fffdf4] text-left shadow-sm`}
                  >
                    <div className="h-[75px] overflow-hidden bg-[#eee9d7]">
                      <img
                        src={item.imagem_url || "/bannerPizza.jpg"}
                        alt={item.nome_comercial}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="px-2 py-1.5">
                      <strong className="block truncate font-serif text-[11px] leading-tight text-[#174b32]">
                        {item.nome_comercial}
                      </strong>
                      <span className="mt-0.5 block text-[9px] text-[#778273]">
                        {item.descricao || "Massa artesanal, feita na hora."}
                      </span>
                      <span className="mt-0.5 block text-[10px] font-bold text-[#b51e24]">
                        {money(item.preco_venda)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <nav
          aria-label="Navegação principal"
          className="fixed inset-x-0 bottom-0 z-30 mx-auto grid h-[62px] w-full max-w-md grid-cols-4 border-t border-[#eee8d7] bg-[#fffdf5]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(48,72,48,0.05)] backdrop-blur"
        >
          <span className="flex flex-col items-center justify-center gap-0.5 text-[#b51e24]">
            <Home size={17} />
            <span className="text-[9px] font-semibold">Início</span>
          </span>
          <button
            onClick={() => openMenu()}
            className="flex flex-col items-center justify-center gap-0.5 text-[#899184]"
          >
            <BookOpen size={17} />
            <span className="text-[9px]">Cardápio</span>
          </button>
          <button
            onClick={() =>
              navigate("/pedido/cardapio", { state: { openCart: true } })
            }
            className="relative flex flex-col items-center justify-center gap-0.5 text-[#899184]"
          >
            <ShoppingCart size={17} />
            {cartCount > 0 && (
              <span className="absolute left-[calc(50%+3px)] top-1 grid size-[15px] place-items-center rounded-full bg-[#b51e24] text-[8px] font-bold text-white">
                {cartCount}
              </span>
            )}
            <span className="text-[9px]">Carrinho</span>
          </button>
          <button
            onClick={() => openMenu()}
            className="flex flex-col items-center justify-center gap-0.5 text-[#899184]"
          >
            <Ellipsis size={18} />
            <span className="text-[9px]">Mais</span>
          </button>
        </nav>
      </div>
    </main>
  );
}
