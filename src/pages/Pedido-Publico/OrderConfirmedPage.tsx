import { CheckCircle2, Copy, Home } from "lucide-react";
import { useState } from "react";
import { money } from "./types";

type Props = {
  orderNumber: number | null;
  total: number;
  trackingCode: string;
  status: string | null;
  loading: boolean;
  error: string;
  onHome: () => void;
};

const statusLabels: Record<string, string> = {
  recebido: "Pedido recebido",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export default function OrderConfirmedPage({
  orderNumber,
  total,
  trackingCode,
  status,
  loading,
  error,
  onHome,
}: Props) {
  const [copied, setCopied] = useState(false);
  const trackingUrl = trackingCode
    ? `${window.location.origin}/pedido/cardapio/#${trackingCode}`
    : "";

  const copyTrackingLink = async () => {
    if (!trackingUrl) return;
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#fbf5d9] px-4 py-10 text-[#295727]">
      <section className="w-full max-w-md rounded-2xl border border-[#e5ddbd] bg-[#fffbea] p-7 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-[#438457]" size={54} />
        <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-[#b52327]">
          Pedido recebido
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold text-[#155b3b]">
          Obrigado!
        </h1>
        <p className="mt-3 text-sm text-[#71826a]">
          {loading
            ? "Carregando os dados do pedido..."
            : "Seu pedido foi enviado para a pizzaria."}
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-[#fff0e8] p-3 text-sm text-[#a3191f]">
            {error}
          </p>
        )}
        {orderNumber !== null && (
          <p className="mt-4 rounded-lg bg-[#f1f3df] p-3 text-sm">
            Pedido <strong>#{orderNumber}</strong>
          </p>
        )}
        {!loading && !error && (
          <p className="mt-3 text-sm">
            Total: <strong>{money(total)}</strong>
          </p>
        )}
        {status && !error && (
          <div className="mt-4 rounded-lg bg-[#f1f3df] p-3 text-sm">
            Status: <strong>{statusLabels[status] ?? status}</strong>
          </div>
        )}
        {trackingCode && (
          <div className="mt-4 rounded-lg border border-[#e5ddbd] p-3">
            <p className="text-xs text-[#71826a]">Código de acompanhamento</p>
            <strong className="mt-1 block font-mono text-lg tracking-[0.2em]">
              {trackingCode}
            </strong>
            <button
              type="button"
              onClick={() => void copyTrackingLink()}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#d8cfad] bg-[#fffdf5] text-sm font-semibold text-[#315c40] transition hover:bg-[#f1f3df]"
            >
              <Copy size={15} />
              {copied ? "Link copiado" : "Copiar link de acompanhamento"}
            </button>
          </div>
        )}
        <button
          onClick={onHome}
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#b51e24] font-semibold text-[#fff9df]"
        >
          <Home size={16} /> Voltar ao início
        </button>
      </section>
    </main>
  );
}
