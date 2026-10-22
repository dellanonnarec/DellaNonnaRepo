import { useEffect } from "react";
import { publicSupabase } from "../lib/supabase";
import { loadOrderForReceipt } from "./orderReceiptData";

const settingKey = "della-desktop-auto-print";
const maxAttempts = 5;

export default function DesktopAutoPrintService({ authenticated }: { authenticated: boolean }) {
  useEffect(() => {
    const desktop = window.desktop;
    if (!desktop || !authenticated || !publicSupabase) return;

    let stopped = false;
    let processing = false;
    let printerName = localStorage.getItem("della-desktop-printer") ?? "";
    const supabase = publicSupabase;
    const isEnabled = () => localStorage.getItem(settingKey) !== "false";

    const recoverInterruptedJobs = async () => {
      const cutoff = new Date(Date.now() - 180000).toISOString();
      const { error } = await supabase
        .from("fila_impressao_pedidos")
        .update({ status: "erro", agente_id: null, ultimo_erro: "Aplicativo interrompido durante o envio. Confira se o cupom foi impresso antes de reimprimir." })
        .eq("status", "processando")
        .lt("iniciado_em", cutoff);
      if (error) console.error("Erro ao recuperar trabalhos interrompidos:", error);
    };

    const processQueue = async () => {
      if (stopped || processing || !isEnabled() || !printerName) return;
      processing = true;
      try {
        const { data: jobs, error } = await supabase
          .from("fila_impressao_pedidos")
          .select("id, pedido_id, tentativas")
          .eq("status", "pendente")
          .lte("proxima_tentativa_em", new Date().toISOString())
          .order("criado_em", { ascending: true })
          .limit(10);
        if (error) throw error;

        for (const job of jobs ?? []) {
          if (stopped || !isEnabled()) break;
          const attempt = Number(job.tentativas ?? 0) + 1;
          const { data: claimed, error: claimError } = await supabase
            .from("fila_impressao_pedidos")
            .update({ status: "processando", tentativas: attempt, agente_id: `desktop-${desktop.platform}`, iniciado_em: new Date().toISOString(), ultimo_erro: null })
            .eq("id", job.id)
            .eq("status", "pendente")
            .select("id, pedido_id, tentativas")
            .maybeSingle();
          if (claimError) throw claimError;
          if (!claimed) continue;

          let acceptedBySpooler = false;
          try {
            const order = await loadOrderForReceipt(supabase, claimed.pedido_id);
            await desktop.printReceipt({ printerName, order });
            acceptedBySpooler = true;
            const { error: savedError } = await supabase
              .from("fila_impressao_pedidos")
              .update({ status: "enviado", enviado_em: new Date().toISOString(), ultimo_erro: null, agente_id: null })
              .eq("id", claimed.id)
              .eq("status", "processando");
            if (savedError) throw savedError;
          } catch (printError) {
            const message = String(printError instanceof Error ? printError.message : printError).slice(0, 1500);
            const retryable = !acceptedBySpooler && !message.includes("PRINT_OUTCOME_UNKNOWN");
            const shouldRetry = retryable && attempt < maxAttempts;
            const backoff = Math.min(5000 * (2 ** Math.max(0, attempt - 1)), 5 * 60 * 1000);
            await supabase
              .from("fila_impressao_pedidos")
              .update({
                status: shouldRetry ? "pendente" : "erro",
                proxima_tentativa_em: new Date(Date.now() + backoff).toISOString(),
                ultimo_erro: acceptedBySpooler ? `Spooler aceitou o cupom; confirme antes de reimprimir. ${message}` : message,
                agente_id: null,
              })
              .eq("id", claimed.id)
              .eq("status", "processando");
          }
        }
      } catch (error) {
        console.error("Erro ao processar fila desktop:", error);
      } finally {
        processing = false;
      }
    };

    const refreshPrinter = () => { printerName = localStorage.getItem("della-desktop-printer") ?? ""; void processQueue(); };
    const channel = supabase.channel("desktop-print-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "fila_impressao_pedidos" }, () => void processQueue())
      .subscribe((status) => { if (status === "SUBSCRIBED") void processQueue(); });
    const poll = window.setInterval(() => void processQueue(), 2500);
    const recovery = window.setInterval(() => { void recoverInterruptedJobs().then(processQueue); }, 180000);
    window.addEventListener("della-desktop-print-settings", refreshPrinter);
    void processQueue();
    void recoverInterruptedJobs().then(processQueue);

    return () => {
      stopped = true;
      window.clearInterval(poll);
      window.clearInterval(recovery);
      window.removeEventListener("della-desktop-print-settings", refreshPrinter);
      void supabase.removeChannel(channel);
    };
  }, [authenticated]);

  return null;
}
