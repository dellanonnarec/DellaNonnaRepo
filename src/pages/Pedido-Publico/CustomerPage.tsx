import { ArrowLeft, ArrowRight, Phone, User } from "lucide-react";
import { useState } from "react";
import type { Customer } from "./types";

const fullNamePattern = /^[\p{L}]+(?:[ -][\p{L}]+)+$/u;
const whatsappPattern = /^(?:\d{11}|\(\d{2}\) \d{5}-\d{4})$/;

function formatBrazilianPhone(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type Props = {
  value: Customer;
  onChange: (value: Customer) => void;
  onBack: () => void;
  onContinue: () => void;
};
export default function CustomerPage({
  value,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const [touched, setTouched] = useState({ name: false, whatsapp: false });
  const nameValid = fullNamePattern.test(value.name.trim());
  const whatsappValid = whatsappPattern.test(value.whatsapp.trim());
  const valid = nameValid && whatsappValid;
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
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#fdf8e8] text-[10px] font-medium text-[#8d876f]">
              3
            </div>

            <div className="h-px flex-1 bg-[#dfd5b8]" />
          </div>

          {/* Etapa 4 */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#fdf8e8] text-[10px] font-medium text-[#8d876f]">
            4
          </div>
        </div>

        {/* TÍTULO */}
        <div className="mb-5 mt-6">
          <span
            className="text-[10px] font-bold tracking-wide
     text-[#B52327] sm:text-[11px]"
          >
            SEU PEDIDO
          </span>

          <h1 className="mt-1 font-serif text-2xl font-bold leading-tight text-[#183f2c] sm:text-4xl">
            Seus dados
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#71826a] sm:text-base">
            Informe seus dados para finalizar o pedido.
          </p>
        </div>

        {/* FORMULÁRIO */}
        <div className="relative rounded-[20px] border border-[#e5d9b8] bg-[#fffbea] p-4 shadow-[0_12px_35px_rgba(88,72,30,0.06)] sm:p-6">
          <div className="grid gap-5">
            {/* NOME */}
            <label className="block text-sm font-semibold text-[#183f2c]">
              <span className="mb-2 block">Nome completo</span>

              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#526d58]">
                  <User size={19} strokeWidth={1.8} />
                </div>

                <input
                  required
                  autoComplete="name"
                  value={value.name}
                  aria-invalid={touched.name && !nameValid}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, name: true }))
                  }
                  onChange={(event) =>
                    onChange({
                      ...value,
                      name: event.target.value,
                    })
                  }
                  placeholder="Digite seu nome completo"
                  className="h-11 w-full rounded-[12px] border border-[#dfd3b2] bg-[#fffdf5] pl-12 pr-3 text-sm font-normal text-[#315c40] outline-none transition placeholder:text-[#9b9b83] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/10"
                />
              </div>
              {touched.name && !nameValid && (
                <small className="mt-1 block text-xs font-normal text-[#b51e24]">
                  Informe nome e sobrenome usando letras, acentos, espaços ou
                  hífen.
                </small>
              )}
            </label>

            {/* WHATSAPP */}
            <label className="block text-sm font-semibold text-[#183f2c]">
              <span className="mb-2 block">WhatsApp</span>

              <div className="relative">
                <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#526d58]">
                  <Phone size={19} strokeWidth={1.8} />
                </div>

                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  value={value.whatsapp}
                  aria-invalid={touched.whatsapp && !whatsappValid}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, whatsapp: true }))
                  }
                  onChange={(event) =>
                    onChange({
                      ...value,
                      whatsapp: formatBrazilianPhone(event.target.value),
                    })
                  }
                  placeholder="(00) 00000-0000"
                  className="h-11 w-full rounded-[12px] border border-[#dfd3b2] bg-[#fffdf5] pl-12 pr-3 text-sm font-normal text-[#315c40] outline-none transition placeholder:text-[#9b9b83] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/10"
                />
              </div>
              {touched.whatsapp && !whatsappValid && (
                <small className="mt-1 block text-xs font-normal text-[#b51e24]">
                  Informe um WhatsApp brasileiro com 11 dígitos, por exemplo
                  (11) 91234-5678.
                </small>
              )}
            </label>
          </div>

          {/* CONTINUAR */}
          <div className="flex w-full justify-center">
            <button
              disabled={!valid}
              onClick={onContinue}
              className="mt-7 flex h-12 w-full max-w-[300px] items-center justify-center gap-2 rounded-[100px] bg-[#b51e24] px-5 text-base font-semibold text-[#fffbea] shadow-[0_8px_16px_rgba(181,30,36,0.18)] transition hover:bg-[#a3191f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-[17px]"
            >
              <span>Continuar</span>
              <ArrowRight size={20} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
