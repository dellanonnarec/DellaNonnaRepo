import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Hash,
  House,
  MapIcon,
  MapPin,
  ShoppingCart,
  Star,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DeliveryAddress } from "./types";

type Props = {
  value: DeliveryAddress;
  onChange: (value: DeliveryAddress) => void;
  previousAddress: DeliveryAddress | null;
  onUsePreviousAddress: () => void;
  onEnterAnotherAddress: () => void;
  onBack: () => void;
  onContinue: () => void;
};
const fields: {
  key: keyof DeliveryAddress;
  label: string;
  required?: boolean;
  className?: string;
}[] = [
  { key: "cep", label: "CEP", required: true },
  { key: "rua", label: "Rua", required: true, className: "sm:col-span-2" },
  { key: "numero", label: "Número", required: true },
  { key: "complemento", label: "Complemento" },
  { key: "bairro", label: "Bairro", required: true },
  { key: "cidade", label: "Cidade" },
  {
    key: "referencia",
    label: "Ponto de referência",
    className: "sm:col-span-2",
  },
];

const addressPatterns: Record<keyof DeliveryAddress, RegExp> = {
  cep: /^\d{5}-?\d{3}$/,
  rua: /^[\p{L}\p{N}\s.,'’ºª°/#()\-]+$/u,
  numero: /^\d+[\p{L}]?(?:[-/](?:\d+[\p{L}]?|[\p{L}]))?$/u,
  complemento: /^[\p{L}\p{N}\s.,'’ºª°/#()\-]+$/u,
  bairro: /^[\p{L}\p{N}\s.,'’ºª°/#()\-]+$/u,
  cidade: /^[\p{L}\s]+$/u,
  referencia: /^[\p{L}\p{N}\s.,'’ºª°/#()\-]+$/u,
};

const addressErrorMessages: Record<keyof DeliveryAddress, string> = {
  cep: "Informe um CEP válido com 8 dígitos (ex.: 00000-000).",
  rua: "Use letras, números e caracteres comuns de endereço.",
  numero: "Informe um número válido (ex.: 12A ou 123-B).",
  complemento: "Use letras, números e caracteres comuns.",
  bairro: "Use letras, números e caracteres comuns.",
  cidade: "Informe uma cidade usando letras e espaços.",
  referencia: "Use letras, números e caracteres comuns.",
};

function formatCep(input: string) {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

export default function AddressPage({
  value,
  onChange,
  previousAddress,
  onUsePreviousAddress,
  onEnterAnotherAddress,
  onBack,
  onContinue,
}: Props) {
  const [cepLookupMessage, setCepLookupMessage] = useState("");
  const [touchedFields, setTouchedFields] = useState<
    Partial<Record<keyof DeliveryAddress, boolean>>
  >({});
  const addressRef = useRef(value);
  const cepRequestRef = useRef<AbortController | null>(null);
  addressRef.current = value;

  useEffect(
    () => () => {
      cepRequestRef.current?.abort();
    },
    [],
  );

  const lookupCep = async (rawCep: string) => {
    cepRequestRef.current?.abort();
    const cep = rawCep.replace(/\D/g, "");
    if (!/^\d{8}$/.test(cep)) {
      setCepLookupMessage("");
      return;
    }

    const controller = new AbortController();
    cepRequestRef.current = controller;
    setCepLookupMessage("Consultando CEP...");

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Falha ao consultar o CEP.");

      const result = (await response.json()) as {
        erro?: boolean;
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      };
      if (controller.signal.aborted) return;
      if (result.erro) {
        setCepLookupMessage(
          "CEP não encontrado. Preencha o endereço manualmente.",
        );
        return;
      }

      onChange({
        ...addressRef.current,
        cep: result.cep || rawCep,
        rua: result.logradouro || "",
        bairro: result.bairro || "",
        cidade: result.localidade || "",
      });
      setCepLookupMessage("");
    } catch {
      if (!controller.signal.aborted) {
        setCepLookupMessage(
          "Não foi possível consultar o CEP. Tente novamente.",
        );
      }
    }
  };

  const requiredFields: (keyof DeliveryAddress)[] = [
    "cep",
    "rua",
    "numero",
    "bairro",
  ];
  const requiredValuesPresent = requiredFields.every((key) =>
    value[key].trim(),
  );
  const allProvidedValuesValid = (
    Object.keys(addressPatterns) as (keyof DeliveryAddress)[]
  ).every((key) => {
    const fieldValue = value[key].trim();
    return !fieldValue || addressPatterns[key].test(fieldValue);
  });
  const valid = requiredValuesPresent && allProvidedValuesValid;
  return (
    <main className="min-h-screen overflow-hidden bg-[#F8F4E8] text-[#183f2c]">
      {/* HEADER */}
      <header
        className="relative z-50 mx-auto flex w-full max-w-6xl mt-5 
      items-center justify-between bg-[#F8F4E8] px-3 sm:px-6 md:px-8"
      >
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

            <div className="h-px flex-1 bg-[#dfd5b8]" />
          </div>

          {/* Etapa 4 */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#fdf8e8] text-[10px] font-medium text-[#8d876f]">
            4
          </div>
        </div>

        {/* TÍTULO */}
        <div className="mb-5 mt-6">
          <span className="text-[10px] font-bold tracking-wide text-[#B52327] sm:text-[11px]">
            SEU PEDIDO
          </span>

          <h1 className="mt-1 font-serif text-3xl font-bold leading-tight text-[#183f2c] sm:text-4xl">
            Endereço de entrega
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#71826a] sm:text-base">
            Informe o seu endereço para que possamos entregar seu pedido.
          </p>
        </div>

        {/* FORMULÁRIO */}
        <div className="relative rounded-[20px] border border-[#e5d9b8] bg-[#fffbea] p-4 shadow-[0_12px_35px_rgba(88,72,30,0.06)] sm:p-6">
          <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2">
            {fields.map(({ key, label, required, className }) => {
              const fieldValue = value[key].trim();

              const hasError = Boolean(
                touchedFields[key] &&
                fieldValue &&
                !addressPatterns[key].test(fieldValue),
              );

              return (
                <label
                  key={key}
                  className={`block text-sm font-semibold text-[#183f2c] ${
                    className ?? ""
                  }`}
                >
                  <span className="mb-2 block">{label}</span>

                  <div className="relative">
                    {/* Ícone */}
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#526d58]">
                      {key === "cep" && <MapPin size={19} strokeWidth={1.8} />}

                      {key === "rua" && <House size={19} strokeWidth={1.8} />}

                      {key === "numero" && <Hash size={19} strokeWidth={1.8} />}

                      {key === "complemento" && (
                        <Building2 size={19} strokeWidth={1.8} />
                      )}

                      {key === "bairro" && (
                        <MapIcon size={19} strokeWidth={1.8} />
                      )}

                      {key === "referencia" && (
                        <Star size={19} strokeWidth={1.8} />
                      )}
                    </div>

                    <input
                      required={required}
                      autoComplete={
                        key === "cidade"
                          ? "address-level2"
                          : key === "numero"
                            ? "off"
                            : key
                      }
                      value={value[key]}
                      aria-invalid={hasError}
                      onBlur={() =>
                        setTouchedFields((current) => ({
                          ...current,
                          [key]: true,
                        }))
                      }
                      onChange={(event) => {
                        const nextValue =
                          key === "cep"
                            ? formatCep(event.target.value)
                            : event.target.value;

                        onChange({
                          ...value,
                          [key]: nextValue,
                        });

                        if (key === "cep") {
                          void lookupCep(nextValue);
                        }
                      }}
                      placeholder={
                        key === "cep"
                          ? "Digite seu CEP"
                          : key === "rua"
                            ? "Digite o nome da rua"
                            : key === "numero"
                              ? "Digite o número"
                              : key === "complemento"
                                ? "Ex.: Apto, Bloco, Casa, etc."
                                : key === "bairro"
                                  ? "Digite o nome do bairro"
                                  : key === "cidade"
                                    ? "Digite a cidade"
                                    : "Ex.: Próximo ao mercado, escola, etc."
                      }
                      className={`h-11 w-full rounded-[12px] border bg-[#fffdf5] pl-12 pr-3 text-sm font-normal text-[#315c40] outline-none transition placeholder:text-[#9b9b83] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/10 ${
                        hasError
                          ? "border-[#b51e24] focus:border-[#b51e24] focus:ring-[#b51e24]/10"
                          : "border-[#dfd3b2]"
                      }`}
                    />

                  </div>

                  {key === "cep" && cepLookupMessage && (
                    <small className="mt-1 block text-xs font-normal text-[#71826a]">
                      {cepLookupMessage}
                    </small>
                  )}

                  {hasError && (
                    <small className="mt-1 block text-xs font-normal text-[#b51e24]">
                      {addressErrorMessages[key]}
                    </small>
                  )}
                </label>
              );
            })}
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

      {previousAddress && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-[#183f2c]/50 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="previous-address-title"
            className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#e5d9b8] bg-[#fffbea] shadow-[0_24px_70px_rgba(24,63,44,0.28)]"
          >
            <div className="bg-[#183f2c] px-6 py-5 text-[#fffbea]">
              <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-white/10 text-[#f4d58a]">
                <MapPin size={21} strokeWidth={1.8} />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#e7c97d]">
                Endereço encontrado
              </p>
              <h2
                id="previous-address-title"
                className="mt-2 font-serif text-2xl font-bold leading-tight"
              >
                Que bom ter você por aqui novamente!
              </h2>
            </div>

            <div className="p-6">
              <p className="text-sm leading-relaxed text-[#526d58]">
                Encontramos os dados do seu último pedido. Deseja utilizá-los
                novamente?
              </p>

              <div className="mt-6 grid gap-3">
                <button
                  type="button"
                  onClick={onUsePreviousAddress}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-[#b51e24] px-4 text-sm font-semibold text-[#fffbea] shadow-[0_8px_16px_rgba(181,30,36,0.18)] transition hover:bg-[#a3191f]"
                >
                  Usar dados do último pedido
                </button>
                <button
                  type="button"
                  onClick={onEnterAnotherAddress}
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-[#d9cfad] bg-[#fffdf5] px-4 text-sm font-semibold text-[#315c40] transition hover:bg-[#f3eedb]"
                >
                  Preencher outro endereço
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
