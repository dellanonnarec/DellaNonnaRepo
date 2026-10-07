import { ArrowLeft } from "lucide-react";
import {
  type CartItem,
  type Customer,
  type DeliveryAddress,
  type PaymentMethod,
  cartItemTotal,
  cartSubtotal,
  money,
} from "./types";

type Props = {
  items: CartItem[];
  fulfillment: "delivery" | "retirada";
  address: DeliveryAddress;
  customer: Customer;
  payment: PaymentMethod;
  deliveryFee: number;
  busy: boolean;
  error: string;
  onBack: () => void;
  onConfirm: () => void;
};
export default function ReviewPage({
  items,
  fulfillment,
  address,
  customer,
  payment,
  deliveryFee,
  busy,
  error,
  onBack,
  onConfirm,
}: Props) {
  const subtotal = cartSubtotal(items);
  const fee = fulfillment === "delivery" ? deliveryFee : 0;
  return (
    <main className="min-h-screen overflow-hidden bg-[#F8F4E8] text-[#183f2c]">
      {/* HEADER */}
      <header
        className="relative z-50 mx-auto mt-5 flex w-full max-w-6xl
    items-center justify-between bg-[#F8F4E8] px-3 sm:px-6 md:px-8"
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
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
      </header>

      {/* CONTEÚDO */}
      <div className="relative mx-auto w-full max-w-xl px-4 pb-16 pt-5 sm:px-6 sm:pb-24 sm:pt-6">
        {/* STEPPER */}
        <div className="mx-auto flex w-full max-w-[300px] items-center">
          {/* Etapa 1 */}
          <div className="relative flex flex-1 items-center">
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b52327] text-[10px] font-semibold text-white">
              1
            </div>

            <div className="h-px flex-1 bg-[#b52327]" />
          </div>

          {/* Etapa 2 */}
          <div className="relative flex flex-1 items-center">
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#b52327] text-[10px] font-medium text-white">
              2
            </div>

            <div className="h-px flex-1 bg-[#b52327]" />
          </div>

          {/* Etapa 3 */}
          <div className="relative flex flex-1 items-center">
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#b52327] text-[10px] font-medium text-white">
              3
            </div>

            <div className="h-px flex-1 bg-[#b52327]" />
          </div>

          {/* Etapa 4 */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#b52327] bg-[#b52327] text-[10px] font-medium text-white">
            4
          </div>
        </div>

        {/* TÍTULO */}
        <div className="mb-5 mt-6">
          <span className="text-[10px] font-bold tracking-wide text-[#B52327] sm:text-[11px]">
            REVISÃO FINAL
          </span>

          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[#183f2c] sm:text-4xl">
            Resumo do pedido
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#71826a] sm:text-base">
            Confira os detalhes antes de confirmar seu pedido.
          </p>
        </div>

        {/* RESUMO */}
        <section className="relative rounded-[20px] border border-[#e5d9b8] bg-[#fffbea] p-4 shadow-[0_12px_35px_rgba(88,72,30,0.06)] sm:p-6">
          {/* ITENS */}
          <div>
            <h2 className="font-serif text-xl font-bold text-[#183f2c]">
              Itens
            </h2>

            <div className="mt-4 divide-y divide-[#eee8d4]">
              {items.map((item) => (
                <div
                  key={item.cartKey}
                  className="flex items-start justify-between gap-3 py-4 text-sm sm:gap-4"
                >
                  <span className="min-w-0 flex-1 text-[#526d58]">
                    <span className="block font-medium leading-relaxed text-[#183f2c]">
                      {item.quantity} × {item.name}
                    </span>

                    {item.additions.map((addition) => (
                      <small
                        key={addition.menuItemId}
                        className="mt-0.5 block text-xs leading-relaxed text-[#71826a] sm:text-sm"
                      >
                        + {addition.name}
                        {addition.quantityPerItem > 1
                          ? ` × ${addition.quantityPerItem}`
                          : ""}
                      </small>
                    ))}

                    {item.observation && (
                      <small className="mt-0.5 block text-xs leading-relaxed text-[#71826a] sm:text-sm">
                        Obs.: {item.observation}
                      </small>
                    )}
                  </span>

                  <strong className="shrink-0 whitespace-nowrap text-sm text-[#183f2c]">
                    {money(cartItemTotal(item))}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* ENTREGA E CONTATO */}
          <div className="mt-7 border-t border-[#e9e2c9] pt-6">
            <h2 className="font-serif text-xl font-bold text-[#183f2c]">
              Entrega e contato
            </h2>

            <div className="mt-4 space-y-2 text-sm leading-relaxed text-[#526d58]">
              <p>
                {fulfillment === "delivery"
                  ? `${address.rua}, ${address.numero} — ${address.bairro}${address.cidade ? `, ${address.cidade}` : ""}, ${address.cep}`
                  : "Retirada no local"}
              </p>

              <p>
                {customer.name} · {customer.whatsapp}
              </p>

              <p>
                <span className="font-medium text-[#183f2c]">Pagamento:</span>{" "}
                {payment === "pix"
                  ? "Pix"
                  : payment === "cartao"
                    ? "Cartão"
                    : "Dinheiro"}
              </p>
            </div>
          </div>

          {/* VALORES */}
          <div className="mt-7 space-y-3 border-t border-[#e9e2c9] pt-5 text-sm text-[#526d58]">
            <div className="flex items-center justify-between gap-4">
              <span>Subtotal</span>
              <span className="whitespace-nowrap">{money(subtotal)}</span>
            </div>

            {fulfillment === "delivery" && (
              <div className="flex items-center justify-between gap-4">
                <span>Taxa de entrega</span>
                <span className="whitespace-nowrap">{money(fee)}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 border-t border-[#e9e2c9] pt-4 text-lg font-bold text-[#183f2c]">
              <span>Total</span>
              <span className="whitespace-nowrap text-[#b52327]">
                {money(subtotal + fee)}
              </span>
            </div>
          </div>
        </section>

        {/* ERRO */}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-[12px] border border-red-100 bg-red-50 p-4 text-sm leading-relaxed text-red-700"
          >
            {error}
          </p>
        )}

        {/* CONFIRMAR */}
        <div className="flex w-full justify-center">
          <button
            type="button"
            disabled={busy || !items.length}
            onClick={onConfirm}
            className="mt-7 flex h-12 w-full max-w-[300px] items-center justify-center gap-2 rounded-[100px] bg-[#b51e24] px-5 text-base font-semibold text-[#fffbea] shadow-[0_8px_16px_rgba(181,30,36,0.18)] transition hover:bg-[#a3191f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-[17px]"
          >
            <span>{busy ? "Enviando pedido…" : "Confirmar pedido"}</span>
          </button>
        </div>
      </div>
    </main>
  );
}
