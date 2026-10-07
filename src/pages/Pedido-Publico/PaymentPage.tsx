import type { PaymentMethod } from "./types";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CreditCard,
  QrCode,
  Wallet,
} from "lucide-react";
import { FaPix } from "react-icons/fa6";

type Props = {
  value: PaymentMethod | "";
  onChange: (value: PaymentMethod) => void;
  onBack: () => void;
  onContinue: () => void;
};
const choices: { id: PaymentMethod; title: string; detail: string }[] = [
  { id: "pix", title: "Pix", detail: "Pagamento via Pix" },
  { id: "cartao", title: "Cartão", detail: "Pague na entrega ou retirada" },
  { id: "dinheiro", title: "Dinheiro", detail: "Pague em dinheiro ao receber" },
];
export default function PaymentPage({
  value,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
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

            <div className="h-px flex-1 bg-[#dfd5b8]" />
          </div>

          {/* Etapa 3 */}
          <div className="relative flex flex-1 items-center">
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#b52327] text-[10px] font-medium text-white">
              3
            </div>

            <div className="h-px flex-1 bg-[#dfd5b8]" />
          </div>

          {/* Etapa 4 */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#b52327] text-[10px] font-medium text-white">
            4
          </div>
        </div>

        {/* TÍTULO */}
        <div className="mb-5 mt-6">
          <span className="text-[10px] font-bold tracking-wide text-[#B52327] sm:text-[11px]">
            SEU PEDIDO
          </span>

          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[#183f2c] sm:text-4xl">
            Forma de pagamento
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#71826a] sm:text-base">
            Escolha como deseja pagar seu pedido.
          </p>
        </div>

        {/* FORMULÁRIO */}
        <div className="relative rounded-[20px] border border-[#e5d9b8] bg-[#fffbea] p-4 shadow-[0_12px_35px_rgba(88,72,30,0.06)] sm:p-6">
          {/* FORMAS DE PAGAMENTO */}
          <div className="grid gap-3">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onChange(choice.id)}
                className={`flex w-full items-center gap-3 rounded-[12px] border p-3.5 text-left transition sm:gap-4 sm:p-4 ${
                  value === choice.id
                    ? "border-[#b51e24] bg-[#fff4e5] ring-2 ring-[#b51e24]/10"
                    : "border-[#dfd3b2] bg-[#fffdf5] hover:border-[#c8bd9d]"
                }`}
              >
                {/* ÍCONE */}
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${
                    value === choice.id
                      ? "bg-[#b51e24] text-white"
                      : "bg-[#f0ead3] text-[#526d58]"
                  }`}
                >
                  {choice.id === "pix" && <FaPix size={20} strokeWidth={1.8} />}

                  {choice.id === "dinheiro" && (
                    <Banknote size={20} strokeWidth={1.8} />
                  )}

                  {choice.id === "cartao" && (
                    <CreditCard size={20} strokeWidth={1.8} />
                  )}

                  {!["pix", "dinheiro", "cartao"].includes(choice.id) && (
                    <Wallet size={20} strokeWidth={1.8} />
                  )}
                </span>

                {/* RADIO */}
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                    value === choice.id
                      ? "border-[#b51e24]"
                      : "border-[#b9b49c]"
                  }`}
                >
                  {value === choice.id && (
                    <span className="size-2.5 rounded-full bg-[#b51e24]" />
                  )}
                </span>

                {/* TEXTO */}
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-semibold leading-tight text-[#183f2c] sm:text-[15px]">
                    {choice.title}
                  </strong>

                  <small className="mt-1 block text-xs font-normal leading-relaxed text-[#71826a] sm:text-sm">
                    {choice.detail}
                  </small>
                </span>
              </button>
            ))}
          </div>

          {/* TROCO */}
          {value === "dinheiro" && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-[#526d58]">
                Precisa de troco?
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {/* SIM */}
                <label className="flex cursor-pointer items-center gap-1.5 text-sm font-normal text-[#71826a]">
                  <input
                    type="radio"
                    name="troco"
                    checked={needsChange}
                    onChange={() => setNeedsChange(true)}
                    className="h-5 w-5 appearance-none rounded-full border border-[#dfd9c4] bg-[#fffbea] checked:border-[#b51e24] checked:bg-[#b51e24] focus:ring-0 focus:ring-offset-0"
                  />
                  Sim
                </label>

                {/* NÃO */}
                <label className="flex cursor-pointer items-center gap-1.5 text-sm font-normal text-[#71826a]">
                  <input
                    type="radio"
                    name="troco"
                    checked={!needsChange}
                    onChange={() => {
                      setNeedsChange(false);
                      setChangeFor("");
                    }}
                    className="h-5 w-5 appearance-none rounded-full border border-[#dfd9c4] bg-[#fffbea] checked:border-[#b51e24] checked:bg-[#b51e24] focus:ring-0 focus:ring-offset-0"
                  />
                  Não
                </label>
              </div>

              {/* VALOR DO TROCO */}
              {needsChange && (
                <div className="mt-3 w-full sm:max-w-[300px]">
                  <label className="mb-2 block text-sm font-semibold text-[#183f2c]">
                    Troco para
                  </label>

                  <input
                    type="text"
                    value={changeFor}
                    onChange={(event) => setChangeFor(event.target.value)}
                    placeholder="R$ 100,00"
                    className="h-11 w-full rounded-[12px] border border-[#dfd3b2] bg-[#fffdf5] px-3 text-sm font-normal text-[#315c40] outline-none transition placeholder:text-[#9b9b83] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/10"
                  />
                </div>
              )}
            </div>
          )}

          {/* CONTINUAR */}
          <div className="flex w-full justify-center">
            <button
              type="button"
              onClick={onContinue}
              disabled={
                !value ||
                (value === "dinheiro" && needsChange && !changeFor.trim())
              }
              className="mt-7 flex h-12 w-full max-w-[300px] items-center justify-center gap-2 rounded-[100px] bg-[#b51e24] px-5 text-base font-semibold text-[#fffbea] shadow-[0_8px_16px_rgba(181,30,36,0.18)] transition hover:bg-[#a3191f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-[17px]"
            >
              <span>Revisar pedido</span>
              <ArrowRight size={20} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
