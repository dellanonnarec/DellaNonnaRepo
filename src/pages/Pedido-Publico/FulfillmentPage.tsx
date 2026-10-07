import { ArrowLeft } from "lucide-react";

type Props = {
  value: "delivery" | "retirada" | "";
  onBack: () => void;
  onChoose: (value: "delivery" | "retirada") => void;
  onContinue: () => void;
};

export default function FulfillmentPage({
  value,
  onBack,
  onChoose,
  onContinue,
}: Props) {
  return (
    <main className="min-h-screen bg-[F8F4E8]  text-[#295727] sm:px-8">
      <header
        className="relative z-50 mx-auto flex w-full max-w-xl mt-5 
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
      <div className="mx-auto w-full max-w-xl px-4 py-5 sm:px-6">
        {/* Indicador das etapas */}
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
            <div className="z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#dfd5b8] bg-[#fdf8e8] text-[10px] font-medium text-[#8d876f]">
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

        {/* Título */}
        <div className="mt-6 mb-4 flex flex-col gap-1">
          <span className="text-[10px] font-bold tracking-wide text-[#B52327] sm:text-[11px]">
            SEU PEDIDO
          </span>

          <h1 className="pb-1 font-serif text-2xl font-bold leading-tight text-[#155b3b] sm:text-3xl">
            Como prefere receber sua pizza?
          </h1>
        </div>

        {/* Opções */}
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {(
            [
              ["delivery", "Entrega", "Receba onde estiver.", "/scooter.png"],
              [
                "retirada",
                "Retirada no local",
                "Sem taxa de entrega.",
                "/pizza-slice.png",
              ],
            ] as const
          ).map(([id, title, desc, image]) => (
            <button
              key={id}
              onClick={() => onChoose(id)}
              className={`w-full rounded-xl border p-4 text-left transition sm:p-5 ${
                value === id
                  ? "border-[#b51e24] bg-[#fff4e5] ring-2 ring-[#b51e24]/20"
                  : "border-[#e5ddbd] bg-[#fffbea]"
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={image}
                  alt=""
                  className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12"
                />

                <div className="min-w-0">
                  <strong className="font-serif text-base sm:text-lg">
                    {title}
                  </strong>

                  <p className="mt-1 text-xs text-[#71826a] sm:text-sm">
                    {desc}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Botão centralizado */}
        <div className="flex w-full justify-center">
          <button
            disabled={!value}
            onClick={onContinue}
            className="mt-5 flex h-12 w-full max-w-[300px] items-center justify-center gap-2 rounded-[100px] bg-[#b51e24] px-5 font-semibold text-[#fff9df] transition-colors hover:bg-[#99191e] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continuar Pedido
            <ArrowLeft className="rotate-180" size={20} />
          </button>
        </div>
      </div>
    </main>
  );
}
