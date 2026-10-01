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
      <div className="relative mx-auto max-w-[1080px] px-5 pb-24 pt-10 sm:px-8 lg:pt-12">
        {/* STEPPER */}
        <div className="flex max-w-[250px] items-center">
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
        <div className="mb-4 mt-4">
          <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-[#183f2c] sm:text-5xl">
            Forma de pagamento
          </h1>

          <p className="mt-2 max-w-2xl font-serif text-lg text-[#71826a] sm:text-xl">
            Escolha como deseja pagar seu pedido.
          </p>
        </div>

        {/* FORMULÁRIO */}
        <div className="relative rounded-[20px] border border-[#e5d9b8] bg-[#fffbea] p-5 shadow-[0_12px_35px_rgba(88,72,30,0.06)] sm:p-10">
          {/* FORMAS DE PAGAMENTO */}
          <div className="space-y-3">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                onClick={() => onChange(choice.id)}
                className={`flex w-full items-center gap-4 rounded-[12px] border p-4 text-left transition ${
                  value === choice.id
                    ? "border-[#b51e24] bg-[#fff4e5] ring-2 ring-[#b51e24]/10"
                    : "border-[#dfd3b2] bg-[#fffdf5] hover:border-[#c8bd9d]"
                }`}
              >
                {/* Ícone */}
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

                {/* Radio */}
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

                {/* Texto */}
                <span>
                  <strong className="block text-[15px] font-semibold text-[#183f2c]">
                    {choice.title}
                  </strong>

                  <small className="mt-0.5 block text-sm font-normal text-[#71826a]">
                    {choice.detail}
                  </small>
                </span>
              </button>
            ))}
          </div>

          {/* TROCO */}
          {value === "dinheiro" && (
            <div className="mt-5">
              <p className="mb-1 text-[16px] font-semibold text-[#526d58]">
                Precisa de troco?
              </p>

              <div className="flex items-center gap-5">
                <label className="flex cursor-pointer items-center gap-1.5 text-[14px] text-[#71826a]">
                  <input
                    type="radio"
                    name="troco"
                    checked={needsChange}
                    onChange={() => setNeedsChange(true)}
                    className="h-5 w-5 appearance-none rounded-full border border-[#dfd9c4] bg-[#fffbea] checked:border-[#b51e24] checked:bg-[#b51e24] focus:ring-0 focus:ring-offset-0"
                  />
                  Sim
                </label>

                <label className="flex cursor-pointer items-center gap-1.5 text-[14px] text-[#71826a]">
                  <input
                    type="radio"
                    name="troco"
                    checked={!needsChange}
                    onChange={() => {
                      setNeedsChange(false);
                      setChangeFor("");
                    }}
                    className="h-4 w-4 appearance-none rounded-full border border-[#dfd9c4] bg-[#fffbea] checked:border-[#b51e24] checked:bg-[#b51e24] focus:ring-0 focus:ring-offset-0"
                  />
                  Não
                </label>
              </div>

              {needsChange && (
                <div className="mt-2.5">
                  <label className="mb-1 block text-[9px] font-medium text-[#71826a]">
                    Troco para
                  </label>

                  <input
                    type="text"
                    value={changeFor}
                    onChange={(event) => setChangeFor(event.target.value)}
                    placeholder="R$ 100,00"
                    className="h-[39px] w-full rounded-[7px] border border-[#e5dfcd] bg-[#fffdf5] px-2.5 text-[14px] text-[#526d58] outline-none placeholder:text-[#9a9d91] focus:border-[#b51e24]"
                  />
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={onContinue}
            disabled={
              !value ||
              (value === "dinheiro" && needsChange && !changeFor.trim())
            }
            className="mt-10 flex h-12 w-full items-center justify-center gap-1.5 rounded-[6px] bg-[#b51e24] text-[18px] font-semibold text-[#fffbea] shadow-[0_3px_8px_rgba(181,30,36,0.15)] transition hover:bg-[#9f1f23] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Revisar pedido
            <ArrowRight size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </main>
  );
}
