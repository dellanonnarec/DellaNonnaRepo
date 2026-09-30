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
      <header className="relative z-50 mx-auto flex w-full max-w-6xl 
      items-center justify-between bg-[#F8F4E8] px-3 sm:px-6 md:px-8">
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
      <div className="mx-auto max-w-xl">

        <p className="text-[11px] font-bold uppercase tracking-widest text-[#b52327]">
          Etapa 1 de 4
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-[#155b3b]">
          Como quer receber?
        </h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(
            [
              [
                "delivery",
                "Entrega",
                "Receba seu pedido no endereço informado.",
              ],
              [
                "retirada",
                "Retirada no local",
                "Busque seu pedido na pizzaria.",
              ],
            ] as const
          ).map(([id, title, desc]) => (
            <button
              key={id}
              onClick={() => onChoose(id)}
              className={`rounded-xl border p-5 text-left transition ${value === id ? "border-[#b51e24] bg-[#fff4e5] ring-2 ring-[#b51e24]/20" : "border-[#e5ddbd] bg-[#fffbea]"}`}
            >
              <strong className="font-serif text-lg">{title}</strong>
              <p className="mt-1 text-sm text-[#71826a]">{desc}</p>
            </button>
          ))}
        </div>
        <button
          disabled={!value}
          onClick={onContinue}
          className="mt-6 h-12 w-full rounded-lg bg-[#b51e24] font-semibold text-[#fff9df] disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </main>
  );
}
