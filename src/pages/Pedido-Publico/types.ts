export type MenuCategory = {
  id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
};

export type MenuItem = {
  id: string;
  nome_comercial: string;
  descricao: string | null;
  categoria_id: string;
  categoria: string;
  tamanho: string | null;
  imagem_url: string | null;
  preco_venda: number;
  disponivel: boolean;
  destaque: boolean;
  ordem_exibicao: number;
  origem_tipo: "receita" | "insumo";
  receita_id: string | null;
  insumo_id: string | null;
};

export type CartItem = {
  cartKey: string;
  menuItemId: string;
  name: string;
  category: string;
  size: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  observation: string;
  originType: "receita" | "insumo";
  additions: CartAddition[];
};

export type CartAddition = {
  menuItemId: string;
  name: string;
  quantityPerItem: number;
  unitPrice: number;
};

export type DeliveryAddress = {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  referencia: string;
};

export type Customer = {
  name: string;
  whatsapp: string;
};

export type PaymentMethod = "pix" | "cartao" | "dinheiro";

export const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const cartItemTotal = (item: CartItem) =>
  item.quantity * (item.unitPrice + item.additions.reduce(
    (sum, addition) => sum + addition.unitPrice * addition.quantityPerItem,
    0,
  ));

export const cartSubtotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + cartItemTotal(item), 0);
