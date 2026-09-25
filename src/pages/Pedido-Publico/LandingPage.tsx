import { ArrowRight, Menu, ShoppingCart } from "lucide-react";

import { BannerWaves } from "./BannerWaves";
import "./della-theme.css";


export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <div className="leading-none">
          <span className="block font-logo text-3xl tracking-wide text-accent sm:text-4xl">
            DELLA
          </span>
          <span className="block font-logo text-3xl tracking-wide text-accent sm:text-4xl">
            NONNA
          </span>
          <span className="mt-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.3em] text-muted-foreground">
            <span className="h-px w-5 bg-accent/60" />
            pizzaria
            <span className="h-px w-5 bg-accent/60" />
          </span>
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
      <section className="relative isolate h-[26rem] w-full overflow-hidden sm:h-[30rem] lg:h-[34rem]">
        <img
          src="/banner4.png"
          alt="Pizza artesanal com manjericão fresco"
          width={1408}
          height={1200}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        <BannerWaves />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-5 sm:px-8">
          <p className="max-w-[16rem] text-[0.7rem] uppercase leading-relaxed tracking-[0.25em] text-primary-foreground/80">
            Sabor, tradição e qualidade em todo pedido.
          </p>
          <h1 className="mt-6 font-display text-4xl leading-[1.05] text-primary-foreground sm:text-5xl lg:text-6xl">
            Pizza feita
            <span className="mt-1 block italic text-accent">com carinho.</span>
          </h1>

          <a
            href="#cardapio"
            className="mt-8 inline-flex w-fit items-center gap-4 rounded-full border border-primary-foreground/25 py-2 pl-2 pr-6 transition-colors hover:border-primary-foreground/50"
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
        className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-5 py-12 sm:px-8"
      >
        <div>
          <p className="flex items-center gap-3 text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground">
            Nosso cardápio
            <span className="h-px w-8 bg-accent/60" />
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight text-foreground sm:text-4xl">
            Escolha o seu
            <span className="mt-1 block italic text-accent">favorito.</span>
          </h2>
        </div>
        <a
          href="#cardapio"
          className="text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Ver todos
        </a>
      </section>
    </main>
  );
}




<div className="p-5">
            <div className="flex flex-row justify-between pb-2">
              <h2 className="font-serif text-[20px] sm:text-[22px] md:text-[24px] lg:text-[26px] font-bold leading-none text-[#183f2c]">
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
              className="mt-3 flex flex-col gap-3"
            >
              {categories.map((category) => {
                const image = categoryImages[category.nome];

                return (
                  <button
                    key={category.id}
                    onClick={() => openMenu(category.id)}
                    className="group relative flex h-[120px] w-full overflow-hidden rounded-xl border border-[#eee7d3] bg-[#fffdf4] text-left"
                  >
                    {/* Imagem à direita */}
                    {image && (
                      <img
                        src={image}
                        alt={category.nome}
                        className="absolute inset-0 h-[60px] min-w-[800px] scale-125 object-contain  transition-transform duration-300 group-hover:scale-[1.35]"
                      />
                    )}

                    {/* Degradê sobre a imagem (mesmo padrão do banner) */}
                    <div
                      className="pointer-events-none absolute inset-0 z-10"
                      style={{
                        background:
                          "linear-gradient(90deg, #fffdf4 0%, #fffdf4 38%, rgba(255,253,244,0.9) 46%, rgba(255,253,244,0.55) 54%, rgba(255,253,244,0) 62%)",
                      }}
                      aria-hidden="true"
                    />

                    {/* Texto à esquerda */}
                    <div className="relative z-20 flex h-full w-[55%] flex-col justify-center px-4 sm:px-5">
                      <span className="mt-1 font-serif font-bold leading-tight text-[#183f2c]">
                        {category.nome.toLowerCase().includes("pizza") ? (
                          <>
                            <span className="block text-[14px] font-medium">
                              Pizza
                            </span>
                            <span className="block text-[21px]">
                              {category.nome.replace(/pizzas?/i, "").trim()}
                            </span>
                          </>
                        ) : (
                          <span className="text-[19px] sm:text-[21px]">
                            {category.nome}
                          </span>
                        )}
                      </span>

                      <span className="text-[26px] font-medium text-[#183f2c] transition-transform duration-300 group-hover:translate-x-1">
                        →
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {featured.length > 0 && (
            <section className="p-5">
              <div className="mb-2 flex items-center justify-between px-0.5 pb-2">
                <h2 className="font-serif text-[20px] sm:text-[22px] md:text-[24px] lg:text-[26px] font-bold leading-none text-[#183f2c]">
                  Mais pedidos
                </h2>
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
                    className={`${featured.length === 1 ? "w-full min-w-full" : "w-[calc(50%-4px)] min-w-[calc(50%-4px)]"} overflow-hidden rounded-[5px] border border-[#e8e1c8] bg-[#fffdf4] text-left shadow-sm`}
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
        </div>