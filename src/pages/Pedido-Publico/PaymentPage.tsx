import { ArrowLeft } from "lucide-react";
import type { PaymentMethod } from "./types";

type Props = { value: PaymentMethod | ""; onChange: (value: PaymentMethod) => void; onBack: () => void; onContinue: () => void };
const choices: { id: PaymentMethod; title: string; detail: string }[] = [
  { id: "pix", title: "Pix", detail: "Pagamento via Pix" },
  { id: "cartao", title: "Cartão", detail: "Pague na entrega ou retirada" },
  { id: "dinheiro", title: "Dinheiro", detail: "Pague em dinheiro ao receber" },
];
export default function PaymentPage({ value, onChange, onBack, onContinue }: Props) {
  return <main className="min-h-screen bg-[#fbf5d9] px-4 py-6 text-[#295727] sm:px-8"><div className="mx-auto max-w-xl"><button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm text-[#54715b]"><ArrowLeft size={17}/> Voltar</button><p className="text-[11px] font-bold uppercase tracking-widest text-[#b52327]">Etapa 4 de 4</p><h1 className="mt-1 font-serif text-3xl font-bold text-[#155b3b]">Forma de pagamento</h1><div className="mt-6 space-y-3">{choices.map((choice) => <button key={choice.id} onClick={() => onChange(choice.id)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${value === choice.id ? "border-[#b51e24] bg-[#fff4e5] ring-2 ring-[#b51e24]/20" : "border-[#e5ddbd] bg-[#fffbea]"}`}><span className={`grid size-5 place-items-center rounded-full border ${value === choice.id ? "border-[#b51e24]" : "border-[#b9b49c]"}`}>{value === choice.id && <span className="size-2.5 rounded-full bg-[#b51e24]"/>}</span><span><strong className="block">{choice.title}</strong><small className="text-[#71826a]">{choice.detail}</small></span></button>)}</div><button disabled={!value} onClick={onContinue} className="mt-6 h-12 w-full rounded-lg bg-[#b51e24] font-semibold text-[#fff9df] disabled:opacity-50">Revisar pedido</button></div></main>;
}