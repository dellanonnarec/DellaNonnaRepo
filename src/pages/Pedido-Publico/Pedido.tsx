import { useEffect, useState } from "react";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";
import { type MenuItem, money } from "./types";

export default function Pedido() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<MenuItem[]>([]);
  useEffect(() => {
    let active = true;
    const loadFeatured = async () => {
      if (!publicSupabase) return;
      const [categoriesResult, itemsResult] = await Promise.all([
        publicSupabase.from("categorias_cardapio").select("id,nome,ordem,ativa").eq("ativa", true),
        publicSupabase.from("cardapio_itens").select("id,nome_comercial,descricao,categoria_id,tamanho,imagem_url,preco_venda,destaque,disponivel,ordem_exibicao,origem_tipo,receita_id,insumo_id").eq("disponivel", true).eq("destaque", true).order("ordem_exibicao").limit(6),
      ]);
      if (!active || categoriesResult.error || itemsResult.error) return;
      const categories = new Map((categoriesResult.data ?? []).map((category: any) => [category.id, category.nome]));
      setFeatured((itemsResult.data ?? []).flatMap((row: any) => {
        const category = categories.get(row.categoria_id);
        if (!category || /adicional/i.test(category)) return [];
        return [{ ...row, categoria: category, preco_venda: Number(row.preco_venda), destaque: Boolean(row.destaque) } as MenuItem];
      }));
    };
    void loadFeatured();
    return () => { active = false; };
  }, []);

  return <main className="min-h-screen bg-[#fbf5d9] text-[#295727]"><header className="bg-[#fbf5d9] px-4 py-4"><div className="mx-auto flex max-w-6xl items-center justify-between"><img src="/logo.png" alt="Della Nonna Pizzaria" className="h-16 w-44 object-contain"/><button onClick={() => navigate("/pedido/cardapio")} className="inline-flex items-center gap-2 rounded-full bg-[#fffbea] px-4 py-2 text-sm font-semibold text-[#315c40]"><ShoppingCart size={17}/> Fazer pedido</button></div></header><div className="mx-auto max-w-6xl px-4 pb-12 sm:px-8"><section className="relative mt-4 overflow-hidden rounded-2xl bg-[#ede4c5]"><img src="/bannerPizza.jpg" alt="Pizzas Della Nonna" className="h-[340px] w-full object-cover sm:h-[470px]"/><div className="absolute inset-0 bg-gradient-to-r from-[#fbf5d9]/95 via-[#fbf5d9]/55 to-transparent"/><div className="absolute inset-y-0 left-0 flex max-w-lg flex-col justify-center p-7 sm:p-12"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#b52327]">Pizzaria Della Nonna</p><h1 className="mt-3 font-serif text-4xl font-bold leading-tight text-[#155b3b] sm:text-6xl">Pizza feita com carinho.</h1><p className="mt-4 max-w-sm text-sm text-[#426548] sm:text-base">Sabor, tradição e qualidade em todo pedido.</p><button onClick={() => navigate("/pedido/cardapio")} className="mt-6 inline-flex h-12 w-fit items-center gap-2 rounded-lg bg-[#b51e24] px-5 font-semibold text-white">Ver cardápio <ArrowRight size={17}/></button></div></section>{featured.length > 0 && <section className="mt-10"><div className="mb-4 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-[#b52327]">Da casa</p><h2 className="font-serif text-2xl font-bold text-[#155b3b]">Destaques do cardápio</h2></div><button onClick={() => navigate("/pedido/cardapio")} className="text-sm font-semibold text-[#a91d22]">Ver tudo</button></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{featured.map((item) => <button key={item.id} onClick={() => navigate("/pedido/cardapio")} className="overflow-hidden rounded-xl border border-[#e5ddbd] bg-[#fffbea] text-left"><div className="aspect-square bg-[#f3eedb]">{item.imagem_url ? <img src={item.imagem_url} alt={item.nome_comercial} className="h-full w-full object-cover"/> : <div className="grid h-full place-items-center text-4xl">🍕</div>}</div><div className="p-3"><strong className="block truncate text-sm">{item.nome_comercial}</strong><span className="mt-1 block text-sm font-bold text-[#b52327]">{money(item.preco_venda)}</span></div></button>)}</div></section>}</div></main>;
}