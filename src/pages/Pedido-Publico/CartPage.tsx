import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { type CartItem, cartItemTotal, cartSubtotal, money } from "./types";

type Props = {
  items: CartItem[];
  onBack: () => void;
  onContinue: () => void;
  onChangeQuantity: (cartKey: string, quantity: number) => void;
  onRemove: (cartKey: string) => void;
};

export default function CartPage({ items, onBack, onContinue, onChangeQuantity, onRemove }: Props) {
  const subtotal = cartSubtotal(items);
  return (
    <main className="min-h-screen bg-[#fbf5d9] px-4 pb-28 pt-6 text-[#295727] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#54715b]"><ArrowLeft size={17}/> Voltar ao cardápio</button>
        <h1 className="font-serif text-3xl font-bold text-[#155b3b]">Meu carrinho</h1>
        {items.length === 0 ? <div className="mt-6 rounded-xl border border-[#e5ddbd] bg-[#fffbea] p-8 text-center text-sm text-[#71826a]">Seu carrinho está vazio.</div> : <div className="mt-5 space-y-3">{items.map((item) => <article key={item.cartKey} className="flex gap-3 rounded-xl border border-[#e5ddbd] bg-[#fffbea] p-3 sm:p-4">
          {item.imageUrl ? <img src={item.imageUrl} alt="" className="size-20 rounded-lg object-cover"/> : <div className="grid size-20 place-items-center rounded-lg bg-[#f3eedb] text-3xl">🍕</div>}
          <div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div><h2 className="font-semibold">{item.name}</h2><p className="text-xs text-[#71826a]">{item.category}</p>{item.additions.length > 0 && <ul className="mt-1 text-xs text-[#54715b]">{item.additions.map((addition) => <li key={addition.menuItemId}>+ {addition.name}{addition.quantityPerItem > 1 ? ` × ${addition.quantityPerItem}` : ""}</li>)}</ul>}{item.observation && <p className="mt-1 text-xs text-[#71826a]">Observação: {item.observation}</p>}</div><strong className="whitespace-nowrap text-sm text-[#a91d22]">{money(cartItemTotal(item))}</strong></div>
            <div className="mt-3 flex items-center justify-between"><div className="inline-flex items-center rounded-full border border-[#e5ddbd] bg-[#fffdf2]"><button aria-label="Diminuir quantidade" onClick={() => onChangeQuantity(item.cartKey, item.quantity - 1)} className="grid size-8 place-items-center"><Minus size={14}/></button><span className="w-7 text-center text-sm">{item.quantity}</span><button aria-label="Aumentar quantidade" onClick={() => onChangeQuantity(item.cartKey, item.quantity + 1)} className="grid size-8 place-items-center"><Plus size={14}/></button></div><button onClick={() => onRemove(item.cartKey)} className="inline-flex items-center gap-1 text-xs text-[#a43a32]"><Trash2 size={14}/> Remover</button></div>
          </div>
        </article>)}</div>}
        <div className="mt-5 flex justify-between rounded-xl border border-[#e5ddbd] bg-[#fffbea] p-4"><span className="font-semibold">Subtotal</span><strong>{money(subtotal)}</strong></div>
        <button disabled={!items.length} onClick={onContinue} className="mt-5 h-12 w-full rounded-lg bg-[#b51e24] font-semibold text-[#fff9df] hover:bg-[#99191e] disabled:cursor-not-allowed disabled:opacity-50">Ir para checkout</button>
      </div>
    </main>
  );
}
