import { ArrowLeft, ArrowRight, Building2, Hash, House, MapIcon, MapPin, ShoppingCart, Star } from "lucide-react";
import type { DeliveryAddress } from "./types";

type Props = {
  value: DeliveryAddress;
  onChange: (value: DeliveryAddress) => void;
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
  {
    key: "referencia",
    label: "Ponto de referência",
    className: "sm:col-span-2",
  },
];
export default function AddressPage({
  value,
  onChange,
  onBack,
  onContinue,
}: Props) {
  const valid = Boolean(
    value.cep.trim() &&
    value.rua.trim() &&
    value.numero.trim() &&
    value.bairro.trim(),
  );
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
      <div className="relative mx-auto max-w-[1080px] px-5 pb-24 pt-10 sm:px-8 lg:pt-12">
        {/* STEPPER */}
        <div className="flex max-w-[250px]  items-center">
          {/* Etapa 1 */}
          <div className="relative flex flex-1 items-center">
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b52327] text-[10px] font-semibold text-white">
              1
            </div>

            {/* Linha até a etapa 2 */}
            <div className="h-px flex-1 bg-[#b52327]" />
          </div>

          {/* Etapa 2 */}
          <div className="relative flex flex-1 items-center">
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#b52327] text-[10px] font-medium text-white">
              2
            </div>

            {/* Linha até a etapa 3 */}
            <div className="h-px flex-1 bg-[#b52327]" />
          </div>

          {/* Etapa 3 */}
          <div className="relative flex flex-1 items-center">
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#fdf8e8] text-[10px] font-medium text-[#8d876f]">
              3
            </div>

            {/* Linha até a etapa 4 */}
            <div className="h-px flex-1 bg-[#dfd5b8]" />
          </div>

          {/* Etapa 4 */}
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#fdf8e8] text-[10px] font-medium text-[#8d876f]">
            4
          </div>
        </div>

        {/* TÍTULO */}
        <div className="mb-4 mt-4">

          <h1 className="mt-2 font-serif text-4xl font-bold leading-tight text-[#183f2c] sm:text-5xl">
            Endereço de entrega
          </h1>

          <p className="mt-2 max-w-2xl font-serif text-lg text-[#71826a] sm:text-xl">
            Informe o seu endereço para que possamos entregar seu pedido.
          </p>
        </div>

        {/* DECORAÇÃO */}
        <div className="pointer-events-none absolute right-[-30px] top-[130px] hidden opacity-30 lg:block">
          <svg
            width="180"
            height="250"
            viewBox="0 0 180 250"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M155 10C112 52 105 104 117 157C123 183 136 209 157 236"
              stroke="#8b8b55"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M122 65C93 46 68 46 45 57C72 78 97 81 122 65Z"
              fill="#a5a26d"
            />
            <path
              d="M112 105C82 91 55 96 36 113C63 127 89 124 112 105Z"
              fill="#a5a26d"
            />
            <path
              d="M119 145C90 134 66 141 50 160C77 170 101 165 119 145Z"
              fill="#a5a26d"
            />
            <path
              d="M135 44C137 17 150 3 169 0C171 23 159 39 135 44Z"
              fill="#a5a26d"
            />
            <path
              d="M126 87C131 62 144 49 163 47C164 69 150 82 126 87Z"
              fill="#a5a26d"
            />
            <path
              d="M135 128C143 106 157 95 176 96C173 117 159 128 135 128Z"
              fill="#a5a26d"
            />
          </svg>
        </div>

        {/* FORMULÁRIO */}
        <div className="relative rounded-[20px] border border-[#e5d9b8] bg-[#fffbea] p-5 shadow-[0_12px_35px_rgba(88,72,30,0.06)] sm:p-10">
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {fields.map(({ key, label, required, className }) => (
              <label
                key={key}
                className={`block text-sm font-semibold text-[#183f2c] ${
                  className ?? ""
                }`}
              >
                <span className="mb-2 block">{label}</span>

                <div className="relative">
                  {/* Ícones */}
                  <div className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#526d58]">
                    {key === "cep" && <MapPin size={20} strokeWidth={1.8} />}

                    {key === "rua" && <House size={20} strokeWidth={1.8} />}

                    {key === "numero" && <Hash size={20} strokeWidth={1.8} />}

                    {key === "complemento" && (
                      <Building2 size={20} strokeWidth={1.8} />
                    )}

                    {key === "bairro" && <MapIcon size={20} strokeWidth={1.8} />}

                    {key === "referencia" && (
                      <Star size={20} strokeWidth={1.8} />
                    )}
                  </div>

                  <input
                    required={required}
                    autoComplete={key === "numero" ? "off" : key}
                    value={value[key]}
                    onChange={(event) =>
                      onChange({
                        ...value,
                        [key]: event.target.value,
                      })
                    }
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
                                : "Ex.: Próximo ao mercado, escola, etc."
                    }
                    className="h-[40px] w-full rounded-[12px] border border-[#dfd3b2] 
                    bg-[#fffdf5] pl-[48px]  text-[14px] font-normal text-[#315c40] placeholder:text-[#9b9b83] outline-none transition focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/10"
                  />
                </div>
              </label>
            ))}
          </div>

          {/* CONTINUAR */}
          <button
            disabled={!valid}
            onClick={onContinue}
            className="mt-9 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#b51e24]  text-[18px] font-semibold text-[#fffbea] shadow-[0_8px_16px_rgba(181,30,36,0.18)] transition hover:bg-[#a3191f] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>Continuar</span>
            <ArrowRight size={22} strokeWidth={1.8}  />
          </button>
        </div>
      </div>

      {/* ONDA DECORATIVA INFERIOR */}
      <div className="pointer-events-none relative mt-[-25px] h-[120px] overflow-hidden">
        <svg
          className="absolute bottom-0 left-0 h-full w-full"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0 100C180 65 280 72 450 108C620 144 760 145 930 105C1110 63 1250 64 1440 105V160H0Z"
            fill="#183f2c"
          />

          <path
            d="M0 120C190 86 305 91 475 121C650 151 770 154 950 120C1135 85 1260 88 1440 120V160H0Z"
            fill="#b51e24"
          />
        </svg>
      </div>
    </main>
  );
}
