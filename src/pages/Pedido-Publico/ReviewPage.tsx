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
  <div className="relative mx-auto max-w-[1080px] px-5 pb-24 pt-10 sm:px-8 lg:pt-12">
    {/* STEPPER */}
    <div className="flex max-w-[250px] items-center">
      <div className="relative flex flex-1 items-center">
        <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b52327] text-[10px] font-semibold text-white">
          1
        </div>
        <div className="h-px flex-1 bg-[#b52327]" />
      </div>

      <div className="relative flex flex-1 items-center">
        <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#b52327] text-[10px] font-medium text-white">
          2
        </div>
        <div className="h-px flex-1 bg-[#b52327]" />
      </div>

      <div className="relative flex flex-1 items-center">
        <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#b52327] text-[10px] font-medium text-white">
          3
        </div>
        <div className="h-px flex-1 bg-[#b52327]" />
      </div>

      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#b52327] bg-[#b52327] text-[10px] font-medium text-white">
        4
      </div>
    </div>

    {/* TÍTULO */}
    <div className="mb-4 mt-4">
      <p className="text-[11px] font-bold uppercase tracking-widest text-[#b52327]">
        Revisão final
      </p>

      <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-[#183f2c] sm:text-5xl">
        Resumo do pedido
      </h1>

      <p className="mt-2 max-w-2xl font-serif text-lg text-[#71826a] sm:text-xl">
        Confira os detalhes antes de confirmar seu pedido.
      </p>
    </div>

    {/* RESUMO */}
    <section className="relative rounded-[20px] border border-[#e5d9b8] bg-[#fffbea] p-5 shadow-[0_12px_35px_rgba(88,72,30,0.06)] sm:p-10">
      {/* ITENS */}
      <div>
        <h2 className="font-serif text-xl font-bold text-[#183f2c]">
          Itens
        </h2>

        <div className="mt-4 divide-y divide-[#eee8d4]">
          {items.map((item) => (
            <div
              key={item.cartKey}
              className="flex justify-between gap-4 py-4 text-sm"
            >
              <span className="min-w-0 text-[#526d58]">
                <span className="font-medium text-[#183f2c]">
                  {item.quantity} × {item.name}
                </span>

                {item.additions.map((addition) => (
                  <small
                    key={addition.menuItemId}
                    className="mt-0.5 block text-[#71826a]"
                  >
                    + {addition.name}
                    {addition.quantityPerItem > 1
                      ? ` × ${addition.quantityPerItem}`
                      : ""}
                  </small>
                ))}

                {item.observation && (
                  <small className="mt-0.5 block text-[#71826a]">
                    Obs.: {item.observation}
                  </small>
                )}
              </span>

              <strong className="whitespace-nowrap text-[#183f2c]">
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

        <div className="mt-4 space-y-2 text-sm text-[#526d58]">
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
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>

        {fulfillment === "delivery" && (
          <div className="flex justify-between">
            <span>Taxa de entrega</span>
            <span>{money(fee)}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-[#e9e2c9] pt-4 text-lg font-bold text-[#183f2c]">
          <span>Total</span>
          <span className="text-[#b52327]">
            {money(subtotal + fee)}
          </span>
        </div>
      </div>
    </section>

    {/* ERRO */}
    {error && (
      <p
        role="alert"
        className="mt-4 rounded-[12px] border border-red-100 bg-red-50 p-4 text-sm text-red-700"
      >
        {error}
      </p>
    )}

    {/* CONFIRMAR */}
    <button
      type="button"
      disabled={busy || !items.length}
      onClick={onConfirm}
      className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#b51e24] text-[18px] font-semibold text-[#fffbea] shadow-[0_3px_8px_rgba(181,30,36,0.15)] transition hover:bg-[#9f1f23] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Enviando pedido…" : "Confirmar pedido"}
    </button>
  </div>
</main>
  );
}
