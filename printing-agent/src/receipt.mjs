import iconv from "iconv-lite";

const WIDTH = 32;
const ESC = 0x1b;
const separator = "--------------------------------";
const totalSeparator = "================================";

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
  const safeRight = String(right ?? "").slice(-WIDTH);
  const leftWidth = Math.max(0, WIDTH - safeRight.length - 1);
  return `${String(left ?? "").slice(0, leftWidth).padEnd(leftWidth)} ${safeRight}`;
}

function priceLines(label, amount, indent = "") {
  const price = money(amount);
  const labelWidth = Math.max(1, WIDTH - indent.length - price.length - 1);
  const wrappedLabel = fitLines(label, labelWidth);
  return wrappedLabel.map((line, index) => {
    const indentedLine = `${indent}${line}`;
    return index === wrappedLabel.length - 1
      ? leftRight(indentedLine, price)
      : indentedLine;
  });
}

function observationLines(value) {
  const lines = String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const [firstLine, ...remainingLines] = lines;
  return [...fitLines(`OBS: ${firstLine}`), ...remainingLines.flatMap((line) => fitLines(line))];
}

function styledLine(value, { align = 0, bold = false, doubleHeight = false } = {}) {
  return { value: String(value ?? ""), align, bold, doubleHeight };
}

function encodeLine(line) {
  if (typeof line === "string") return Buffer.concat([iconv.encode(line, "cp860"), Buffer.from([0x0a])]);

  const commands = Buffer.from([
    ESC, 0x61, line.align,
    ESC, 0x45, line.bold ? 1 : 0,
    ESC, 0x21, line.doubleHeight ? 0x10 : 0,
  ]);
  const reset = Buffer.from([ESC, 0x21, 0, ESC, 0x45, 0, ESC, 0x61, 0, 0x0a]);
  return Buffer.concat([commands, iconv.encode(line.value, "cp860"), reset]);
}

export function createReceipt58mm(order) {
  const payment = { pix: "PIX", cartao: "CARTÃO", dinheiro: "DINHEIRO" }[order.forma_pagamento] ?? String(order.forma_pagamento ?? "").toUpperCase();
  const serviceType = order.tipo_entrega === "delivery" ? "ENTREGA" : "RETIRADA";
  const text = [
    styledLine("DELLA NONNA", { align: 1, bold: true }),
    styledLine("PEDIDO PARA PRODUÇÃO", { align: 1 }),
    separator,
    styledLine(`PEDIDO #${order.numero_pedido}`, { bold: true, doubleHeight: true }),
    new Date(order.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", " ·"),
    styledLine(serviceType, { align: 1, bold: true, doubleHeight: true }),
    separator,
    styledLine("DADOS DO CLIENTE"),
    ...fitLines(order.nome_cliente).map((line) => styledLine(line, { bold: true })),
    ...fitLines(`Telefone: ${order.telefone_cliente}`, WIDTH - 2).map((line, index) => styledLine(index ? `  ${line}` : line)),
  ];

  if (order.tipo_entrega === "delivery") {
    text.push(separator, styledLine("ENDEREÇO DE ENTREGA"));
    text.push(...fitLines(`${order.rua ?? ""}, ${order.numero ?? ""}${order.complemento ? ` - ${order.complemento}` : ""}`));
    text.push(...fitLines(`${order.bairro ?? ""}${order.cep ? ` · CEP ${order.cep}` : ""}`));
    if (order.referencia) text.push(...fitLines(`Referência: ${order.referencia}`));
  }

  text.push(separator);

  const orderItems = order.pedido_itens ?? [];
  const isBeverage = (item) => String(item.categoria ?? "").trim().toLocaleLowerCase("pt-BR").startsWith("bebida");
  const regularItems = orderItems.filter((item) => !isBeverage(item));
  const beverages = orderItems.filter(isBeverage);

  const appendItem = (item) => {
    const additions = order.adicionaisPorItem?.[item.id] ?? [];
    text.push(...priceLines(`${item.quantidade}x ${item.nome_produto}`, item.subtotal));

    for (const addition of additions) {
      const kind = /borda/i.test(addition.nome_adicional_snapshot ?? "") ? "Borda" : "Adicional";
      const quantity = Number(addition.quantidade) > 1 ? `${addition.quantidade}x ` : "";
      const description = `+ ${kind}: ${quantity}${addition.nome_adicional_snapshot}`;
      text.push(...fitLines(description));
    }

    const observation = String(item.observacao ?? "");
    const legacyAdditions = observation.match(/(?:^|\n)Adicionais:\s*(.*)$/i)?.[1]?.trim();
    const cleanObservation = observation.replace(/(?:^|\n)Adicionais:.*$/i, "").trim();
    if (!additions.length && legacyAdditions) {
      for (const legacyAddition of legacyAdditions.split(/,\s*/).filter(Boolean)) {
        text.push(...fitLines(`+ Adicional: ${legacyAddition}`));
      }
    }
    if (cleanObservation) text.push(...observationLines(cleanObservation));
  };

  if (regularItems.length) {
    text.push(separator, "ITENS DO PEDIDO");
    regularItems.forEach((item, index) => {
      if (index) text.push(separator);
      appendItem(item);
    });
  }
  if (beverages.length) {
    text.push(separator, "BEBIDAS DO PEDIDO");
    beverages.forEach((item, index) => {
      if (index) text.push(separator);
      appendItem(item);
    });
  }

  if (order.observacao) text.push(separator, ...observationLines(order.observacao));

  const discount = Number(order.desconto ?? 0);
  const received = Number(order.valor_recebido ?? 0);
  text.push(
    separator,
    styledLine("RESUMO DO PEDIDO", { bold: true }),
    separator,
    ...priceLines("Subtotal dos produtos", order.subtotal),
    ...(order.taxa_entrega_pendente
      ? [leftRight("Taxa de entrega", "A CONFIRMAR")]
      : priceLines(order.modo_taxa_entrega === "fixa" ? "Entrega fixa" : "Taxa de entrega", order.taxa_entrega)),
    ...priceLines("Desconto", discount),
    separator,
    styledLine(leftRight(order.taxa_entrega_pendente ? "TOTAL PARCIAL" : "TOTAL", money(order.total)), { bold: true, doubleHeight: true }),
    separator,
    styledLine("FORMA DE PAGAMENTO"),
    styledLine(payment, { bold: true }),
  );
  if (order.taxa_entrega_pendente) text.push(styledLine("CONFIRMAR TAXA DE ENTREGA", { bold: true }));
  if (order.forma_pagamento === "dinheiro" && received > 0) {
    const change = Math.max(0, received - Number(order.total ?? 0));
    text.push(
      separator,
      ...priceLines("Valor recebido", received),
      styledLine("ATENÇÃO - LEVAR TROCO", { bold: true }),
      styledLine(leftRight("TROCO", money(change)), { bold: true, doubleHeight: true }),
    );
  }
  text.push("");

  const header = Buffer.from([ESC, 0x40, ESC, 0x74, 0x03]); // Inicializa ESC/POS e seleciona tabela CP860.
  const body = Buffer.concat([...text.map(encodeLine), Buffer.from([0x0a])]);
  return Buffer.concat([header, body]);
}
