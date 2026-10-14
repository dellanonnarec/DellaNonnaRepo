import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createReceipt58mm } from "./receipt.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const logPath = resolve(directory, "..", "logs", "agent.log");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const printerName = process.env.PRINTER_NAME;
const maxAttempts = Math.max(1, Number(process.env.PRINT_MAX_ATTEMPTS ?? 5));
const retryBaseMs = Math.max(1000, Number(process.env.PRINT_RETRY_BASE_MS ?? 5000));
const staleAfterMs = Math.max(60000, Number(process.env.PRINT_STALE_AFTER_MS ?? 180000));
const agentId = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const pollIntervalMs = 10000;
const leaseHeartbeatMs = 30000;

if (!supabaseUrl || !serviceRoleKey || !printerName) {
  console.error("Configure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e PRINTER_NAME no arquivo .env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let draining = false;
let stopping = false;

async function log(level, message, details = {}) {
  const entry = JSON.stringify({ at: new Date().toISOString(), level, message, ...details });
  console[level === "error" ? "error" : "log"](entry);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${entry}\n`, "utf8");
}

function printRaw(data) {
  if (process.platform !== "win32") throw new Error("A impressão USB via spooler está configurada para Windows.");
  return new Promise((resolvePromise, rejectPromise) => {
    const script = resolve(directory, "print-raw.ps1");
    const child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code !== 0) {
        rejectPromise(new Error(stderr.trim() || `O spooler do Windows retornou código ${code}.`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout.trim()));
      } catch {
        rejectPromise(new Error("PRINT_OUTCOME_UNKNOWN: o spooler não retornou a confirmação do trabalho."));
      }
    });
    child.stdin.end(JSON.stringify({ printerName, data: data.toString("base64") }), "utf8");
  });
}

async function loadPendingJobs() {
  const { data, error } = await supabase
    .from("fila_impressao_pedidos")
    .select("id, pedido_id, tentativas")
    .eq("status", "pendente")
    .lte("proxima_tentativa_em", new Date().toISOString())
    .order("criado_em", { ascending: true })
    .limit(25);
  if (error) throw error;
  return data ?? [];
}

async function claimJob(job) {
  const { data, error } = await supabase
    .from("fila_impressao_pedidos")
    .update({
      status: "processando",
      tentativas: job.tentativas + 1,
      agente_id: agentId,
      iniciado_em: new Date().toISOString(),
      ultimo_erro: null,
    })
    .eq("id", job.id)
    .eq("status", "pendente")
    .select("id, pedido_id, tentativas")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function setJobError(job, error, retryable) {
  const attempt = job.tentativas;
  const retry = retryable && attempt < maxAttempts;
  const backoff = Math.min(retryBaseMs * (2 ** Math.max(0, attempt - 1)), 5 * 60 * 1000);
  const message = String(error?.message ?? error ?? "Falha desconhecida").slice(0, 1500);
  const { error: updateError } = await supabase
    .from("fila_impressao_pedidos")
    .update({
      status: retry ? "pendente" : "erro",
      proxima_tentativa_em: new Date(Date.now() + backoff).toISOString(),
      ultimo_erro: message,
      agente_id: null,
    })
    .eq("id", job.id)
    .eq("status", "processando")
    .eq("agente_id", agentId);
  if (updateError) throw updateError;
  await log("error", retry ? "Falha; pedido agendado para nova tentativa." : "Impressão exige conferência manual.", {
    pedidoId: job.pedido_id,
    tentativa: attempt,
    erro: message,
  });
}

async function processJob(job) {
  const claimed = await claimJob(job);
  if (!claimed) return;

  let spoolAccepted = false;
  const heartbeat = setInterval(() => {
    void supabase.from("fila_impressao_pedidos")
      .update({ iniciado_em: new Date().toISOString() })
      .eq("id", claimed.id)
      .eq("status", "processando")
      .eq("agente_id", agentId);
  }, leaseHeartbeatMs);

  try {
    const { data: order, error } = await supabase
      .from("pedidos")
      .select("*, pedido_itens(*)")
      .eq("id", claimed.pedido_id)
      .single();
    if (error) throw error;
    if (!order) throw new Error("O pedido não foi encontrado para montar o cupom.");

    const orderItems = order.pedido_itens ?? [];
    if (orderItems.length) {
      const { data: additions, error: additionsError } = await supabase
        .from("pedido_item_adicionais")
        .select("pedido_item_id, nome_adicional_snapshot, quantidade")
        .in("pedido_item_id", orderItems.map((item) => item.id));
      if (additionsError) {
        await log("error", "Não foi possível carregar os snapshots de adicionais; o cupom usará as observações gravadas no item.", {
          pedidoId: claimed.pedido_id,
          erro: additionsError.message,
        });
      } else {
        order.adicionaisPorItem = Object.groupBy(additions ?? [], (item) => item.pedido_item_id);
      }
    }

    const result = await printRaw(createReceipt58mm(order));
    spoolAccepted = true;
    const { error: updateError } = await supabase
      .from("fila_impressao_pedidos")
      .update({ status: "enviado", enviado_em: new Date().toISOString(), ultimo_erro: null, agente_id: null })
      .eq("id", claimed.id)
      .eq("status", "processando")
      .eq("agente_id", agentId);
    if (updateError) throw updateError;
    await log("info", "Cupom enviado ao spooler do Windows.", {
      pedidoId: claimed.pedido_id,
      numeroPedido: order.numero_pedido,
      impressora: printerName,
      jobWindows: result.jobId,
      tentativa: claimed.tentativas,
    });
  } catch (error) {
    // Se o Windows aceitou o cupom mas o banco não confirmou, não reenvia automaticamente.
    const message = String(error?.message ?? error);
    const outcomeUnknown = message.includes("PRINT_OUTCOME_UNKNOWN");
    await setJobError(claimed, error, !spoolAccepted && !outcomeUnknown);
  } finally {
    clearInterval(heartbeat);
  }
}

async function recoverInterruptedJobs() {
  const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
  const { data, error } = await supabase
    .from("fila_impressao_pedidos")
    .update({
      status: "erro",
      agente_id: null,
      ultimo_erro: "Agente interrompido durante o envio. Confira se o cupom foi impresso antes de reprocessar.",
    })
    .eq("status", "processando")
    .lt("iniciado_em", cutoff)
    .select("pedido_id");
  if (error) throw error;
  for (const row of data ?? []) {
    await log("error", "Trabalho interrompido marcado para conferência manual.", { pedidoId: row.pedido_id });
  }
}

async function drainQueue() {
  if (draining || stopping) return;
  draining = true;
  try {
    while (!stopping) {
      const jobs = await loadPendingJobs();
      if (!jobs.length) break;
      let claimedAny = false;
      for (const job of jobs) {
        if (stopping) break;
        await processJob(job);
        claimedAny = true;
      }
      if (!claimedAny) break;
    }
  } catch (error) {
    await log("error", "Falha ao consultar/processar a fila.", { erro: error?.message ?? String(error) });
  } finally {
    draining = false;
  }
}

async function retryOrder(orderId) {
  const { data, error } = await supabase
    .from("fila_impressao_pedidos")
    .update({ status: "pendente", tentativas: 0, proxima_tentativa_em: new Date().toISOString(), agente_id: null, iniciado_em: null, ultimo_erro: null })
    .eq("pedido_id", orderId)
    .eq("status", "erro")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Não há um pedido com falha nessa fila UUID.");
  await log("info", "Pedido liberado para reprocessamento manual.", { pedidoId: orderId });
}

async function main() {
  const retryId = process.argv[2] === "--retry" ? process.argv[3] : null;
  if (process.argv[2] === "--retry") {
    if (!retryId) throw new Error("Informe o UUID do pedido: npm run retry -- UUID_DO_PEDIDO");
    await retryOrder(retryId);
    return;
  }

  await recoverInterruptedJobs();
  await log("info", "Agente de impressão iniciado.", { agentId, impressora: printerName, largura: "58 mm" });

  const channel = supabase
    .channel("agente-fila-impressao")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "fila_impressao_pedidos" }, () => void drainQueue())
    .subscribe((status, error) => {
      void log(status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "error" : "info", `Realtime: ${status}`, error ? { erro: error.message } : {});
      if (status === "SUBSCRIBED") void drainQueue();
    });

  const poll = setInterval(() => void drainQueue(), pollIntervalMs);
  const recovery = setInterval(() => {
    void recoverInterruptedJobs().then(() => drainQueue()).catch((error) =>
      log("error", "Falha na recuperação da fila.", { erro: error?.message ?? String(error) }),
    );
  }, Math.max(staleAfterMs, 60000));

  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(poll);
    clearInterval(recovery);
    await supabase.removeChannel(channel);
    await log("info", "Agente encerrado.", { agentId });
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

main().catch(async (error) => {
  await log("error", "Agente não conseguiu iniciar.", { erro: error?.message ?? String(error) });
  process.exitCode = 1;
});
