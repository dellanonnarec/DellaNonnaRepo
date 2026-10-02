import {
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { type CartItem, cartItemTotal, cartSubtotal, money } from "./types";

type Props = {
  items: CartItem[];
  onBack: () => void;
  onContinue: () => void;
  onChangeQuantity: (cartKey: string, quantity: number) => void;
  onRemove: (cartKey: string) => void;
};

export default function CartPage({
  items,
  onBack,
  onContinue,
  onChangeQuantity,
  onRemove,
}: Props) {
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartSubtotal(items);
  return (
    <main className=" min-h-screen bg-[#F8F4E8] px-4 pb-28 pt-6 text-[#295727] sm:px-8">
      <header className="relative z-50 mx-auto flex w-full max-w-6xl items-center justify-between bg-[#F8F4E8] px-3 sm:px-6 md:px-8">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar ao cardápio"
          className="grid size-10 shrink-0 place-items-center rounded-full
             text-[#315c40] transition-colors hover:bg-[#f0ead3] sm:size-11"
        >
          <ArrowLeft className="size-[19px] sm:size-5" />
        </button>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <img
            src="/logo2.png"
            alt="Della Nonna"
            className="h-auto w-[clamp(200px,28vw,280px)]"
          />
        </div>

        <nav className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            aria-label="Carrinho"
            className="relative flex size-10 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:bg-secondary sm:size-11"
          >
            <ShoppingCart className="size-[19px] sm:size-5" strokeWidth={1.6} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </button>
        </nav>
      </header>
      <div className="mx-auto w-full max-w-xl px-4 pt-5 pb-8 sm:px-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#155b3b] sm:text-4xl">
            Seu carrinho
          </h1>

          <span className="mt-1 block text-sm text-[#155b3b]">
            Confira seus itens antes de pedir
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-xl border border-[#e5ddbd] bg-[#fffbea] p-6 text-center text-sm text-[#71826a] sm:p-8">
            Seu carrinho está vazio.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {items.map((item) => (
              <article
                key={item.cartKey}
                className="flex gap-3 rounded-xl border border-[#e5ddbd] bg-[#F8F4E8] p-3 sm:p-4"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="size-16 shrink-0 rounded-lg object-cover sm:size-20"
                  />
                ) : (
                  <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-[#f3eedb] text-2xl sm:size-20 sm:text-3xl">
                    🍕
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold text-[#183f2c]">
                        {item.name}
                      </h2>

                      <p className="text-xs text-[#71826a]">{item.category}</p>

                      {item.additions.length > 0 && (
                        <ul className="mt-1 text-xs text-[#54715b]">
                          {item.additions.map((addition) => (
                            <li key={addition.menuItemId}>
                              + {addition.name}
                              {addition.quantityPerItem > 1
                                ? ` × ${addition.quantityPerItem}`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      )}

                      {item.observation && (
                        <p className="mt-1 break-words text-xs text-[#71826a]">
                          Observação: {item.observation}
                        </p>
                      )}
                    </div>

                    <strong className="shrink-0 whitespace-nowrap text-sm text-[#a91d22]">
                      {money(cartItemTotal(item))}
                    </strong>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="inline-flex shrink-0 items-center rounded-full border border-[#e5ddbd] bg-[#fffdf2]">
                      <button
                        aria-label="Diminuir quantidade"
                        onClick={() =>
                          onChangeQuantity(item.cartKey, item.quantity - 1)
                        }
                        className="grid size-8 place-items-center"
                      >
                        <Minus size={14} />
                      </button>

                      <span className="w-7 text-center text-sm">
                        {item.quantity}
                      </span>

                      <button
                        aria-label="Aumentar quantidade"
                        onClick={() =>
                          onChangeQuantity(item.cartKey, item.quantity + 1)
                        }
                        className="grid size-8 place-items-center"
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemove(item.cartKey)}
                      className="inline-flex shrink-0 items-center gap-1 text-xs text-[#a43a32]"
                    >
                      <Trash2 size={14} />
                      <span>Remover</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between rounded-xl border border-[#e5ddbd] bg-[#F8F4E8] p-4">
          <span className="font-semibold text-[#183f2c]">Subtotal</span>

          <strong className="text-[#183f2c]">{money(subtotal)}</strong>
        </div>

        <div className="mx-auto flex w-full flex-col items-center justify-center">
          <button
            disabled={!items.length}
            onClick={onContinue}
            className="mt-5 flex h-12 w-full max-w-[300px] items-center justify-center gap-2 rounded-[100px] bg-[#b51e24] px-5 font-semibold text-[#fff9df] transition-colors hover:bg-[#99191e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Confirmar pedido
            <ArrowRight size={20} />
          </button>

          <p className="px-2 pt-3 text-center text-xs leading-relaxed text-[#54715b] sm:text-[14px]">
            Você poderá escolher entrega ou retirada
            <br />
            no próximo passo
          </p>
        </div>
      </div>
    </main>
  );
}
