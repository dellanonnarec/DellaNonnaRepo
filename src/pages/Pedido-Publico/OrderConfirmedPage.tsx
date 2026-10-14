import {
  Bike,
  Check,
  ChefHat,
  CircleX,
  ClipboardCheck,
  Copy,
  Home,
  PackageCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";
import { cartItemTotal, money, type CartItem } from "./types";
import "./OrderTracking.css";

type TrackingOrder = {
  order_number: number | string;
  order_total: number | string;
  order_status: string;
};

const statusDetails = {
  recebido: {
    title: "Pedido recebido",
    description: "A cozinha já recebeu seu pedido. Em breve começamos a preparar tudo com carinho.",
    icon: ClipboardCheck,
    tone: "text-[#295727]",
    badge: "bg-[#e7eedf] text-[#315c40]",
    iconBg: "bg-[#e7eedf] text-[#315c40]",
    animation: "tracking-confirmation",
    progress: 0,
  },
  em_preparo: {
    title: "Feito com carinho",
    description: "Sua pizza está sendo preparada na cozinha, com ingredientes fresquinhos.",
    icon: ChefHat,
    tone: "text-[#a95125]",
    badge: "bg-[#f8e8d7] text-[#a95125]",
    iconBg: "bg-[#f8e8d7] text-[#a95125] tracking-steam",
    animation: "tracking-simmer",
    progress: 1,
  },
  saiu_para_entrega: {
    title: "A caminho da sua casa",
    description: "Seu pedido saiu para entrega. Logo, logo chega quentinho até você.",
    icon: Bike,
    tone: "text-[#b51e24]",
    badge: "bg-[#f8e4dc] text-[#a52622]",
    iconBg: "bg-[#f8e4dc] text-[#a52622]",
    animation: "tracking-travel",
    progress: 2,
  },
  entregue: {
    title: "Bom apetite!",
    description: "Pedido entregue. Esperamos que cada pedaço deixe seu dia mais gostoso.",
    icon: PackageCheck,
    tone: "text-[#315c40]",
    badge: "bg-[#e7eedf] text-[#315c40]",
    iconBg: "bg-[#e7eedf] text-[#315c40]",
    animation: "tracking-arrive",
    progress: 3,
  },
  cancelado: {
    title: "Pedido cancelado",
    description: "Este pedido foi cancelado. Se precisar de ajuda, fale com a equipe da Della Nonna.",
    icon: CircleX,
    tone: "text-[#8f3028]",
    badge: "bg-[#f5e5df] text-[#8f3028]",
    iconBg: "bg-[#f5e5df] text-[#8f3028]",
    animation: "",
    progress: -1,
  },
} as const;

const statusLabels: Record<string, string> = {
  recebido: "Recebido",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const progressLabels = ["Recebido", "Na cozinha", "A caminho", "Entregue"];

export default function OrderConfirmedPage() {
  const { codigo = "" } = useParams<{ codigo: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const trackingCode = codigo.trim().toUpperCase();
  const routeState = location.state as { trackingItems?: CartItem[] } | null;
  const items = routeState?.trackingItems ?? [];
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const normalizedStatus = status && status in statusDetails ? status as keyof typeof statusDetails : "recebido";
  const detail = statusDetails[normalizedStatus];
  const StatusIcon = detail.icon;
  const trackingUrl = trackingCode
    ? `${window.location.origin}/pedido/${encodeURIComponent(trackingCode)}`
    : "";

  useEffect(() => {
    if (!trackingCode) {
      setError("Não encontramos um pedido com este código.");
      setLoading(false);
      return;
    }

    let active = true;
    const loadOrder = async () => {
      setError("");
      if (!publicSupabase) {
        if (active) {
          setError("O serviço de acompanhamento não está configurado.");
          setLoading(false);
        }
        return;
      }

      const { data, error: lookupError } = await publicSupabase.rpc(
        "buscar_pedido_publico_por_codigo",
        { p_codigo: trackingCode },
      );
      if (!active) return;
      if (lookupError) {
        console.error("Falha ao consultar acompanhamento do pedido:", lookupError);
        setError("Não foi possível carregar este pedido. Tente novamente.");
        setLoading(false);
        return;
      }

      const order = (Array.isArray(data) ? data[0] : data) as TrackingOrder | null;
      if (!order) {
        setError("Não encontramos um pedido com este código.");
        setLoading(false);
        return;
      }

      setOrderNumber(Number(order.order_number));
      setTotal(Number(order.order_total));
      setStatus(order.order_status);
      setLoading(false);
      setError("");
    };

    void loadOrder();
    const interval = window.setInterval(() => void loadOrder(), 15000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [trackingCode]);

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
    <main className="min-h-dvh overflow-hidden bg-[#f7f3e5] px-4 py-6 text-[#23432f] sm:px-6 sm:py-10">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(235,102,46,0.11),transparent_68%)]" />
      <div className="relative mx-auto w-full max-w-xl">
        <header className="mb-6 flex items-center justify-center sm:mb-8">
          <img src="/logo2.png" alt="Della Nonna" className="h-auto w-44 sm:w-52" />
        </header>

        <section className="overflow-hidden rounded-[28px] border border-[#e5ddbd] bg-[#fffdf6] shadow-[0_18px_55px_rgba(52,64,37,0.09)]">
          <div className="px-5 pb-6 pt-7 text-center sm:px-9 sm:pb-8 sm:pt-9">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a95125]">
              Acompanhamento do pedido
            </p>

            <div className="relative mx-auto mt-5 grid size-24 place-items-center">
              <span className={`absolute inset-0 rounded-4xl ${detail.iconBg} ${detail.animation}`} />
              <StatusIcon className={`relative z-10 size-11 ${detail.tone}`} strokeWidth={1.65} />
              {normalizedStatus === "saiu_para_entrega" && (
                <span className="absolute -bottom-1 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-[#d7bd9e]">
                  <span className="tracking-road absolute -top-1 left-1/2 size-3 -translate-x-1/2 rounded-full bg-[#eb662e]" />
                </span>
              )}
            </div>

            <span className={`mt-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] ${detail.badge}`}>
              <span className={`size-1.5 rounded-full ${normalizedStatus === "cancelado" ? "bg-[#a95125]" : "bg-[#eb662e]"}`} />
              {loading ? "Atualizando status" : statusLabels[normalizedStatus]}
            </span>
            <h1 className="mt-3 font-display text-[clamp(1.8rem,7vw,2.5rem)] font-bold leading-tight text-[#214a32]">
              {loading && !status ? "Localizando seu pedido" : detail.title}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#71806c] sm:text-base">
              {loading
                ? "Buscando a atualização mais recente do seu pedido."
                : detail.description}
            </p>

            {normalizedStatus !== "cancelado" && (
              <div className="mt-8" aria-label={`Etapa ${detail.progress + 1} de 4`}>
                <div className="flex items-center">
                  {progressLabels.map((label, index) => (
                    <div key={label} className="flex min-w-0 flex-1 items-center last:flex-none">
                      <div className={`grid size-7 shrink-0 place-items-center rounded-full border transition-colors ${index <= detail.progress ? "border-[#315c40] bg-[#315c40] text-white" : "border-[#dfd7c2] bg-[#f7f3e5] text-[#a39b83]"}`}>
                        {index < detail.progress ? <Check size={14} strokeWidth={2.5} /> : <span className="size-1.5 rounded-full bg-current" />}
                      </div>
                      {index < progressLabels.length - 1 && (
                        <span className={`mx-1 h-px min-w-2 flex-1 sm:mx-2 ${index < detail.progress ? "bg-[#78936b]" : "bg-[#dfd7c2]"}`} />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[9px] font-medium text-[#71806c] sm:text-[11px]">
                  {progressLabels.map((label) => <span key={label}>{label}</span>)}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-5 rounded-2xl border border-[#e7c8bb] bg-[#fbf0e9] p-3 text-sm text-[#8f3028]">
                {error}
              </p>
            )}
          </div>

          <div className="space-y-4 border-t border-[#eee8d8] bg-[#faf8ef] px-5 py-5 sm:px-9 sm:py-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#fffdf7] p-3.5 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87907c]">Código</p>
                <strong className="mt-1 block break-all font-mono text-lg tracking-[0.16em] text-[#214a32]">
                  {trackingCode || "—"}
                </strong>
              </div>
              <div className="rounded-2xl bg-[#fffdf7] p-3.5 sm:p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87907c]">Pedido</p>
                <strong className="mt-1 block text-lg text-[#214a32]">
                  {orderNumber === null ? "—" : `#${orderNumber}`}
                </strong>
              </div>
            </div>

            {items.length > 0 && (
              <section className="rounded-2xl bg-[#fffdf7] p-4 sm:p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#214a32]">
                  <ClipboardCheck size={17} className="text-[#eb662e]" />
                  Itens do pedido
                </h2>
                <ul className="mt-3 divide-y divide-[#eee8d8]">
                  {items.map((item) => (
                    <li key={item.cartKey} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0 text-sm">
                        <p className="font-semibold text-[#31533a]">{item.quantity} × {item.name}</p>
                        {item.additions.map((addition) => (
                          <p key={addition.menuItemId} className="mt-0.5 text-xs text-[#7a846f]">+ {addition.name}{addition.quantityPerItem > 1 ? ` × ${addition.quantityPerItem}` : ""}</p>
                        ))}
                        {item.observation && <p className="mt-1 text-xs italic text-[#7a846f]">Obs.: {item.observation}</p>}
                      </div>
                      <strong className="shrink-0 text-sm text-[#31533a]">{money(cartItemTotal(item))}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <div className="flex items-center justify-between rounded-2xl bg-[#214a32] px-4 py-4 text-[#fffdf6]">
              <span className="text-sm text-white/80">Total do pedido</span>
              <strong className="font-display text-xl">{money(total)}</strong>
            </div>

            {trackingCode && (
              <div className="grid gap-2 sm:grid-cols-2">
                <a
                  href={`/pedido/${encodeURIComponent(trackingCode)}`}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-[#eb662e] px-4 text-sm font-semibold text-white transition hover:bg-[#d95827] active:scale-[0.99]"
                >
                  Atualizar acompanhamento
                </a>
                <button
                  type="button"
                  onClick={() => void copyTrackingLink()}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#d8cfad] bg-[#fffdf6] px-4 text-sm font-semibold text-[#315c40] transition hover:bg-[#f1eedf] active:scale-[0.99]"
                >
                  <Copy size={15} />
                  {copied ? "Link copiado" : "Copiar link"}
                </button>
              </div>
            )}
          </div>
        </section>

        {normalizedStatus === "cancelado" && (
          <p className="mx-auto mt-4 max-w-md text-center text-xs leading-relaxed text-[#71806c]">
            Se você tiver dúvidas sobre o cancelamento, fale com a equipe da Della Nonna.
          </p>
        )}

        <button
          type="button"
          onClick={() => navigate("/pedido")}
          className="mx-auto mt-5 flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-[#315c40] transition hover:bg-[#eae5d5] active:scale-[0.99]"
        >
          <Home size={16} /> Voltar ao cardápio
        </button>
        <p className="mt-3 text-center font-display text-sm italic text-[#a95125]">Feito à mão, com carinho de família.</p>
      </div>
    </main>
  );
}
