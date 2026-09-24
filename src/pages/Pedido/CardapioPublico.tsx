import {
  ArrowLeft,
  Search,
  Plus,
  Home,
  Receipt,
  ShoppingCart,
  MoreHorizontal,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";

export default function CardapioPublico() {
  const [categoriaAtiva, setCategoriaAtiva] = useState("Todas");

  const categorias = ["Todas", "Clássicas", "Especiais", "Meio a meio"];

  const navigate = useNavigate();

  const pizzas = [
    {
      id: 1,
      nome: "Pizza Della Nonna",
      descricao: "Molho artesanal, mussarela, calabresa e cebola.",
      preco: "39,90",
      imagem: "/pizza1.jpg",
    },
    {
      id: 2,
      nome: "Pizza Calabresa",
      descricao: "Molho artesanal, mussarela e cebola.",
      preco: "36,90",
      imagem: "/pizza2.jpg",
    },
    {
      id: 3,
      nome: "Pizza Frango",
      descricao: "Molho artesanal, mussarela, frango e catupiry.",
      preco: "37,90",
      imagem: "/pizza3.jpg",
    },
    {
      id: 4,
      nome: "Pizza Mussarela",
      descricao: "Molho artesanal e mussarela.",
      preco: "32,90",
      imagem: "/pizza4.jpg",
    },
    {
      id: 4,
      nome: "Pizza Mussarela",
      descricao: "Molho artesanal e mussarela.",
      preco: "32,90",
      imagem: "/pizza4.jpg",
    },
    {
      id: 4,
      nome: "Pizza Mussarela",
      descricao: "Molho artesanal e mussarela.",
      preco: "32,90",
      imagem: "/pizza4.jpg",
    },

    {
      id: 4,
      nome: "Pizza Mussarela",
      descricao: "Molho artesanal e mussarela.",
      preco: "32,90",
      imagem: "/pizza4.jpg",
    },
  ];

  return (
    <main className="min-h-screen bg-[#F8F4EB] p-[10px]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#F8F4EB] px-4 pt-4">
        <div className="flex items-center gap-3">
          <button className="cursor-pointer" onClick={() => {
                      navigate("/pedido");
                    }}>
            <ArrowLeft className="h-[clamp(18px,3vw,24px)] w-[clamp(18px,3vw,24px)] text-[#4B4B4B]" />
          </button>

          <span
          style={{ fontFamily: '"Fraunces", serif' }}
            className="
            font-bold text-[#4B4B4B]
            text-[clamp(1.5rem,3vw,1.5rem)]
            "
          >
            Cárdapio
          </span>
        </div>

        {/* Busca */}
        <div className="relative mt-4">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            placeholder="Buscar no cardápio..."
            className="h-11 w-full rounded-full border border-gray-200 bg-white pl-11 pr-4 text-sm outline-none"
          />
        </div>

        {/* Categorias */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {categorias.map((categoria) => (
            <button
              key={categoria}
              onClick={() => setCategoriaAtiva(categoria)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                categoriaAtiva === categoria
                  ? "bg-[#B71C1C] text-white"
                  : "bg-white text-gray-500"
              }`}
            >
              {categoria}
            </button>
          ))}
        </div>
      </header>

      {/* Lista */}
      <section className="px-4 py-3">
        <div className="space-y-4">
          {pizzas.map((pizza) => (
            <article key={pizza.id} className="flex items-center gap-3">
              <img
                src={pizza.imagem}
                alt={pizza.nome}
                className="h-24 w-24 rounded-xl object-cover"
              />

              <div className="flex-1">
                <h3 className="font-bold text-[#295727]">{pizza.nome}</h3>

                <p className="mt-1 text-xs text-gray-500">{pizza.descricao}</p>

                <strong className="mt-2 block text-lg font-bold text-[#555]">
                  R$ {pizza.preco}
                </strong>
              </div>

              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#B71C1C] text-white shadow">
                <Plus size={18} />
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 flex h-16 items-center justify-around border-t bg-white">
        <button className="flex flex-col items-center text-gray-500">
          <Home size={18} />
          <span className="mt-1 text-[11px]">Início</span>
        </button>

        <button className="flex flex-col items-center text-[#B71C1C]">
          <Receipt size={18} />
          <span className="mt-1 text-[11px]">Cardápio</span>
        </button>

        <button className="relative flex flex-col items-center text-gray-500">
          <ShoppingCart size={18} />

          <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#B71C1C] text-[9px] text-white">
            2
          </span>

          <span className="mt-1 text-[11px]">Carrinho</span>
        </button>

        <button className="flex flex-col items-center text-gray-500">
          <MoreHorizontal size={18} />
          <span className="mt-1 text-[11px]">Mais</span>
        </button>
      </nav>
    </main>
  );
}
