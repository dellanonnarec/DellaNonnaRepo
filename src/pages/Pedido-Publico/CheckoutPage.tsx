import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CartItem, Customer, DeliveryAddress, PaymentMethod } from "./types";
import { cartSubtotal, money } from "./types";
import FulfillmentPage from "./FulfillmentPage";
import CustomerPage from "./CustomerPage";
import AddressPage from "./AddressPage";
import PaymentPage from "./PaymentPage";
import { ArrowLeft } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";
import { submitPublicOrder } from "./submitPublicOrder";

const CART_KEY = "della-nonna-public-cart";
const emptyAddress: DeliveryAddress = {
  cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", referencia: "",
};

function readCart(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as Partial<CartItem>[];
    return parsed.map((item) => ({
      ...item,
      additions: Array.isArray(item.additions) ? item.additions : [],
    }) as CartItem);
  } catch {
    return [];
  }
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [items] = useState(readCart);
  const [fulfillment, setFulfillment] = useState<"delivery" | "retirada" | "">("retirada");
  const [customer, setCustomer] = useState<Customer>({ name: "", whatsapp: "" });
  const [address, setAddress] = useState(emptyAddress);
  const [previousAddress, setPreviousAddress] = useState<DeliveryAddress | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | "">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customerValid, setCustomerValid] = useState(false);
  const [addressValid, setAddressValid] = useState(false);
  const [paymentValid, setPaymentValid] = useState(false);
  const lastLookupKey = useRef("");
  const deliveryFee = 0;
  const subtotal = cartSubtotal(items);
  const fee = fulfillment === "delivery" ? deliveryFee : 0;
  const total = subtotal + fee;
  const lookupKey = fulfillment === "delivery" && customerValid
    ? `${customer.name.trim()}|${customer.whatsapp.trim()}`
    : "";

  const continueFromCustomer = useCallback(async () => {
    if (fulfillment !== "delivery" || !publicSupabase) return;
    setPreviousAddress(null);
    try {
      const { data, error: lookupError } = await publicSupabase.rpc(
        "buscar_endereco_cliente_checkout",
        { p_nome_completo: customer.name.trim(), p_whatsapp: customer.whatsapp.trim() },
      );
      if (lookupError) throw lookupError;
      const match = Array.isArray(data) ? data[0] : data;
      if (match) {
        setPreviousAddress({
          cep: match.cep ?? "", rua: match.rua ?? "", numero: match.numero ?? "",
          complemento: match.complemento ?? "", bairro: match.bairro ?? "",
          cidade: match.cidade ?? "", referencia: match.referencia ?? "",
        });
      }
    } catch (cause) {
      console.error("Falha ao consultar endereço anterior:", cause);
    }
  }, [customer.name, customer.whatsapp, fulfillment]);

  useEffect(() => {
    if (!lookupKey) {
      lastLookupKey.current = "";
      return;
    }
    if (lastLookupKey.current === lookupKey) return;
    lastLookupKey.current = lookupKey;
    void continueFromCustomer();
  }, [lookupKey, continueFromCustomer]);

  const canSubmit = items.length > 0 && Boolean(fulfillment) && customerValid &&
    paymentValid && (fulfillment !== "delivery" || addressValid);

  const submitOrder = async () => {
    if (!fulfillment || !payment || !items.length || customer.name.trim().length < 2) return;
    if (!publicSupabase) {
      setError("O serviço de pedidos não está configurado.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const trackingCode = await submitPublicOrder({
        items, customer, fulfillment, address, payment, subtotal, deliveryFee,
      });
      localStorage.removeItem(CART_KEY);
      navigate(`/pedido/${encodeURIComponent(trackingCode)}`, {
        replace: true,
        state: { trackingItems: items },
      });
    } catch (cause) {
      console.error("Falha ao finalizar pedido:", cause);
      setError("Não foi possível enviar o pedido. Confira sua conexão e tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const onBack = () => navigate("/sacola");

  return (
    <main className="min-h-dvh bg-[#f7f3e5] px-5 pb-32 pt-5 text-[#183f2c] sm:px-6">
      <header className="relative z-50 mx-auto flex w-full max-w-6xl items-center justify-between bg-[#F8F4E8] px-3 sm:px-6 md:px-8">
        <button type="button" onClick={onBack} aria-label="Voltar à sacola" className="grid size-10 shrink-0 place-items-center rounded-full text-[#315c40] transition-colors hover:bg-[#f0ead3] sm:size-11">
          <ArrowLeft className="size-4.75 sm:size-5" />
        </button>
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <img src="/logo2.png" alt="Della Nonna" className="h-auto w-[clamp(200px,28vw,280px)]" />
        </div>
      </header>

      <div className="mx-auto w-full max-w-118 space-y-6 pt-5">
        <FulfillmentPage value={fulfillment} onBack={onBack} onChoose={setFulfillment} onContinue={() => undefined} embedded />
        <section>
          <h1 className="mb-3 font-serif text-lg font-bold">Seus dados</h1>
          <CustomerPage value={customer} onChange={setCustomer} onBack={onBack} onContinue={() => undefined} onValidityChange={setCustomerValid} embedded />
          {fulfillment === "retirada" && <span className="mt-4 block rounded-xl bg-[#fffdf6] px-4 py-3 text-sm leading-relaxed text-[#526d58]">Retire em <strong className="font-semibold text-[#183f2c]">Rua das Oliveiras, 120</strong> · pronto em ~25 min.</span>}
        </section>

        {fulfillment === "delivery" && (
          <section>
            <h2 className="mb-3 font-serif text-lg font-bold">Endereço</h2>
            <AddressPage value={address} onChange={setAddress} previousAddress={previousAddress}
              onUsePreviousAddress={() => { if (previousAddress) setAddress(previousAddress); setPreviousAddress(null); }}
              onEnterAnotherAddress={() => { setAddress(emptyAddress); setPreviousAddress(null); }}
              onBack={onBack} onContinue={() => undefined} onValidityChange={setAddressValid} embedded />
          </section>
        )}

        <section>
          <h2 className="mb-3 font-serif text-lg font-bold">Pagamento <span className="font-sans text-xs font-normal">{fulfillment === "delivery" ? "na entrega" : "na retirada"}</span></h2>
          <PaymentPage value={payment} onChange={setPayment} onBack={onBack} onContinue={() => undefined} onValidityChange={setPaymentValid} embedded />
        </section>

        <section className="space-y-2 rounded-[20px] bg-[#fffdf6] p-5 text-sm shadow-sm">
          <div className="flex justify-between gap-4"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          {fulfillment === "delivery" && <div className="flex justify-between gap-4"><span>Entrega</span><span>{money(fee)}</span></div>}
          <div className="flex justify-between gap-4 border-t border-[#dfd8c5] pt-2 text-base font-bold"><span>Total</span><span className="text-[#b51e24]">{money(total)}</span></div>
        </section>
      </div>

      <footer className="fixed inset-x-0 bottom-0 z-30 bg-linear-to-t from-[#f7f3e5] via-[#f7f3e5]/95 to-transparent px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:px-6">
        <div className="mx-auto max-w-lg">
          {error && <p role="alert" className="mb-2 text-center text-sm text-[#b51e24]">{error}</p>}
          <button type="button" onClick={() => void submitOrder()} disabled={!canSubmit || busy}
            className="flex h-14 w-full items-center justify-between rounded-full bg-[#b51e24] px-6 text-base font-bold text-white shadow-[0_10px_28px_rgba(181,30,36,0.22)] transition hover:bg-[#a3191f] disabled:cursor-not-allowed disabled:bg-[#d99a90]">
            <span>{busy ? "Enviando pedido…" : "Fazer pedido"}</span><span>{money(total)}</span>
          </button>
        </div>
      </footer>
    </main>
  );
}
