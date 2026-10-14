import type { CartAddition, CartItem, MenuItem } from "./types";

export const isCustomizablePizza = (item: MenuItem) =>
  item.origem_tipo === "receita" && /pizza/i.test(item.categoria);

export const buildAdditions = (
  additionalItems: MenuItem[],
  selectedIds: string[],
): CartAddition[] =>
  additionalItems
    .filter((item) => selectedIds.includes(item.id))
    .map((item) => ({
      menuItemId: item.id,
      name: item.nome_comercial,
      quantityPerItem: 1,
      unitPrice: item.preco_venda,
    }));

export const customizedUnitPrice = (
  item: MenuItem,
  additions: CartAddition[],
) =>
  item.preco_venda +
  additions.reduce(
    (sum, addition) => sum + addition.unitPrice * addition.quantityPerItem,
    0,
  );

export const createCartItem = (
  menuItem: MenuItem,
  quantity = 1,
  observation = "",
  additions: CartAddition[] = [],
): CartItem => ({
  cartKey: crypto.randomUUID(),
  menuItemId: menuItem.id,
  name: menuItem.nome_comercial,
  category: menuItem.categoria,
  size: menuItem.tamanho,
  imageUrl: menuItem.imagem_url,
  unitPrice: menuItem.preco_venda,
  quantity,
  observation,
  originType: menuItem.origem_tipo,
  additions,
});
