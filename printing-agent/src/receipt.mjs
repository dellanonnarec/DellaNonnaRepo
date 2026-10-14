import iconv from "iconv-lite";

const WIDTH = 32;
const ESC = 0x1b;

function fitLines(value, width = WIDTH) {
  const words = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const word of words) {
    if (word.length > width) {
      if (line) lines.push(line);
      line = "";
      for (let i = 0; i < word.length; i += width) lines.push(word.slice(i, i + width));
    } else if (line && `${line} ${word}`.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function money(value) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function leftRight(left, right) {
  const spaces = Math.max(1, WIDTH - left.length - right.length);
  return `${left.slice(0, WIDTH - right.length - 1)}${" ".repeat(spaces)}${right}`;
}

export function createReceipt58mm(order) {
  const payment = { pix: "PIX", cartao: "Cartão", dinheiro: "Dinheiro" }[order.forma_pagamento] ?? order.forma_pagamento;
  const text = [
    "DELLA NONNA",
    "PEDIDO PARA PRODUÇÃO",
    "--------------------------------",
    `PEDIDO #${order.numero_pedido}`,
    new Date(order.created_at).toLocaleString("pt-BR"),
    "--------------------------------",
    ...fitLines(`${order.nome_cliente} · ${order.telefone_cliente}`),
    order.tipo_entrega === "delivery" ? "ENTREGA" : "RETIRADA NO LOCAL",
  ];

  if (order.tipo_entrega === "delivery") {
    text.push(...fitLines(`${order.rua ?? ""}, ${order.numero ?? ""}${order.complemento ? ` - ${order.complemento}` : ""}`));
    text.push(...fitLines(`${order.bairro ?? ""}${order.cep ? ` · CEP ${order.cep}` : ""}`));
    if (order.referencia) text.push(...fitLines(`Ref.: ${order.referencia}`));
  }

  text.push("--------------------------------", "ITENS");
  for (const item of order.pedido_itens ?? []) {
    text.push(...fitLines(`${item.quantidade}x ${item.nome_produto}`));
    text.push(leftRight("", money(item.subtotal)));
    const additions = order.adicionaisPorItem?.[item.id] ?? [];
    for (const addition of additions) {
      text.push(...fitLines(`  ${addition.quantidade}x ${addition.nome_adicional_snapshot}`));
    }
    if (item.observacao) {
      const observation = additions.length
        ? item.observacao.replace(/(?:^|\n)Adicionais:.*$/i, "").trim()
        : item.observacao;
      if (observation) text.push(...fitLines(`  ${observation}`));
    }
  }

  if (order.observacao) text.push("--------------------------------", "OBSERVAÇÃO", ...fitLines(order.observacao));
  text.push(
    "--------------------------------",
    leftRight("Subtotal", money(order.subtotal)),
    leftRight("Entrega", Number(order.taxa_entrega) > 0 ? money(order.taxa_entrega) : "Grátis"),
    leftRight("TOTAL", money(order.total)),
    leftRight("Pagamento", payment),
    "",
    "",
  );

  const header = Buffer.from([ESC, 0x40, ESC, 0x74, 0x03]); // Inicializa ESC/POS e seleciona tabela CP860.
  const body = iconv.encode(text.join("\n") + "\n\n\n", "cp860");
  return Buffer.concat([header, body]);
}
