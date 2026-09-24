import { useState, FormEvent, useEffect } from "react";
import { Plus, Search, Trash2, X, RotateCcw } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";

// Ajuste os imports conforme a estrutura do seu projeto
type Ingredient = {
  id: number;
  dbId?: string;
  name: string;
  brand: string;
  pack: number;
  unit: "g" | "ml" | "unid";
  price: number;
  category: "insumo" | "embalagem";
};

function PackagingTable({
  ingredients,
  updateIngredient,
  addPackaging,
  deleteIngredient,
}: {
  ingredients: Ingredient[];
  updateIngredient: (id: number, key: keyof Ingredient, value: string) => void;
  addPackaging: () => void;
  deleteIngredient: (ingredient: Ingredient) => void;
}) {
  const packagings = ingredients.filter(
    (item) => item.category === "embalagem",
  );
  return (
    <div className="table-card packaging-card">
      <div className="table-toolbar">
        <div>
          <strong>Embalagens cadastradas</strong>
          <span className="count-badge">{packagings.length} itens</span>
        </div>
        <button className="text-button" onClick={addPackaging}>
          <Plus size={14} /> Adicionar embalagem
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Marca / obs.</th>
              <th>Qtd. do lote</th>
              <th>Unidade</th>
              <th>Preço pago</th>
              <th>Preço por unidade</th>
              <th aria-label="Ações" />
            </tr>
          </thead>
          <tbody>
            {packagings.map((item) => (
              <tr key={item.id}>
                <td>
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateIngredient(item.id, "name", event.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="muted-input"
                    value={item.brand}
                    onChange={(event) =>
                      updateIngredient(item.id, "brand", event.target.value)
                    }
                    placeholder="Adicionar observação"
                  />
                </td>
                <td>
                  <input
                    className="number-input"
                    type="number"
                    value={item.pack}
                    onChange={(event) =>
                      updateIngredient(item.id, "pack", event.target.value)
                    }
                  />
                </td>
                <td>
                  <select
                    value={item.unit}
                    onChange={(event) =>
                      updateIngredient(item.id, "unit", event.target.value)
                    }
                  >
                    <option>unid</option>
                    <option>g</option>
                    <option>ml</option>
                  </select>
                </td>
                <td>
                  <div className="currency-input">
                    <span>R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={item.price}
                      onChange={(event) =>
                        updateIngredient(item.id, "price", event.target.value)
                      }
                    />
                  </div>
                </td>
                <td>
                  <strong className="unit-price">
                    {unitMoney(item.pack > 0 ? item.price / item.pack : 0)}
                  </strong>{" "}
                  <small>/{item.unit}</small>
                </td>
                <td>
                  <button
                    className="row-action"
                    title="Remover"
                    onClick={() => deleteIngredient(item)}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const parseNumber = (value: string) => Number(value.replace(",", ".")) || 0;

const unitMoney = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? "sem dado"
    : value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 4,
        maximumFractionDigits: 6,
      });

export default function Insumos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isIngredientModalOpen, setIngredientModalOpen] = useState(false);
  const [conversion, setConversion] = useState({ cebola: 130, azeitona: 4 });
  const initialIngredients: Ingredient[] = [];
  const [saved, setSaved] = useState(false);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [ingredientDraft, setIngredientDraft] = useState({
    name: "",
    brand: "",
    pack: "1",
    unit: "g" as Ingredient["unit"],
    price: "0",
  });

  const supabase = publicSupabase;

  useEffect(() => {
    if (!supabase) return;

    const loadIngredients = async () => {
      const { data, error } = await supabase
        .from("insumos")
        .select("*")
        .order("created_at");

      if (error) {
        console.error("Erro ao carregar os ingredientes:", error);
        return;
      }

      if (!data) {
        setIngredients([]);
        return;
      }

      const loadedIngredients: Ingredient[] = data.map((row, index) => ({
        id: index + 1,
        dbId: row.id,
        name: row.nome,
        brand: row.marca_obs ?? "",
        pack: Number(row.qtd_embalagem ?? 0),
        unit: row.unidade as Ingredient["unit"],
        price: Number(row.preco_pago ?? 0),
        category: row.categoria as Ingredient["category"],
      }));

      setIngredients(loadedIngredients);
    };

    void loadIngredients();
  }, [supabase]);

  const filteredIngredients = ingredients.filter((item) => {
    if (item.category !== "insumo") return false;

    const query = searchTerm.trim().toLocaleLowerCase();

    return (
      !query || `${item.name} ${item.brand}`.toLocaleLowerCase().includes(query)
    );
  });

  const saveIngredientToSupabase = async (item: Ingredient) => {
    if (!supabase) return item.dbId;
    const payload = {
      nome: item.name,
      marca_obs: item.brand || null,
      qtd_embalagem: item.pack,
      unidade: item.unit,
      preco_pago: item.price,
      categoria: item.category,
    };
    if (item.dbId) {
      await supabase.from("insumos").update(payload).eq("id", item.dbId);
      return item.dbId;
    }
    const { data } = await supabase
      .from("insumos")
      .upsert(payload, { onConflict: "nome,categoria" })
      .select("id")
      .single();
    return data?.id as string | undefined;
  };

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const addIngredient = async (details: Omit<Ingredient, "id" | "dbId">) => {
    const item: Ingredient = {
      id: Date.now(),
      ...details,
    };
    setIngredients((items) => [...items, item]);
    const dbId = await saveIngredientToSupabase(item);
    if (dbId) {
      setIngredients((items) =>
        items.map((current) =>
          current.id === item.id ? { ...current, dbId } : current,
        ),
      );
    }
    flashSaved();
  };

  const submitIngredient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!ingredientDraft.name.trim()) return;

    await addIngredient({
      name: ingredientDraft.name.trim(),
      brand: ingredientDraft.brand.trim(),
      pack: parseNumber(ingredientDraft.pack),
      unit: ingredientDraft.unit,
      price: parseNumber(ingredientDraft.price),
      category: "insumo",
    });

    setIngredientDraft({
      name: "",
      brand: "",
      pack: "1",
      unit: "g",
      price: "0",
    });

    setIngredientModalOpen(false);
  };

  const updateIngredient = (
    id: number,
    key: keyof Ingredient,
    value: string,
  ) => {
    setIngredients((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [key]: ["pack", "price"].includes(key) ? parseNumber(value) : value,
        } as Ingredient;
        void saveIngredientToSupabase(next);
        return next;
      }),
    );
    flashSaved();
  };
  const addPackaging = async () => {
    const item: Ingredient = {
      id: Date.now(),
      name: "Nova embalagem",
      brand: "",
      pack: 1,
      unit: "unid",
      price: 0,
      category: "embalagem",
    };
    setIngredients((items) => [...items, item]);
    const dbId = await saveIngredientToSupabase(item);
    if (dbId) {
      setIngredients((items) =>
        items.map((current) =>
          current.id === item.id ? { ...current, dbId } : current,
        ),
      );
    }
    flashSaved();
  };
  const deleteIngredient = async (ingredient: Ingredient) => {
    setIngredients((items) =>
      items.filter((item) => item.id !== ingredient.id),
    );
    if (supabase && ingredient.dbId) {
      await supabase.from("insumos").delete().eq("id", ingredient.dbId);
    }
    flashSaved();
  };
  return (
    <section className="min-h-screen  w-full bg-[#fbf5d9] px-6 text-[#295727] sm:px-8 lg:px-11">
      <div className="mb-7 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b52327]">
            Base de custos
          </p>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-[#155b3b]">
            O que entra na pizza
          </h2>
          <p className="mt-1 text-sm text-[#54715b]">
            Atualize os preços de compra. Todos os custos são recalculados
            automaticamente.
          </p>
        </div>

        <button
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#b51e24] px-5 text-sm font-semibold text-[#fff9df] shadow-sm transition hover:bg-[#99191e] focus:outline-none focus:ring-2 focus:ring-[#b51e24]/40 focus:ring-offset-2 focus:ring-offset-[#fbf5d9]"
          onClick={() => setIngredientModalOpen(true)}
        >
          <Plus size={16} />
          Adicionar insumo
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#e5ddbd] bg-[#fffbea] shadow-[0_2px_8px_rgba(47,69,44,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#e9e2c9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <strong className="font-serif text-lg font-bold text-[#155b3b]">
              Insumos cadastrados
            </strong>
            <span className="rounded-full bg-[#edf0d9] px-2.5 py-1 text-[10px] font-semibold text-[#426548]">
              {filteredIngredients.length} itens
            </span>
          </div>

          <label className="flex h-9 w-full items-center gap-2 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-[#628064] sm:max-w-[260px]">
            <Search size={14} className="shrink-0" />
            <input
              className="min-w-0 flex-1 bg-transparent text-xs text-[#315c40] outline-none placeholder:text-[#9b9c7f]"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar insumo"
              aria-label="Pesquisar insumo"
            />
          </label>
        </div>

        <div className="overflow-y-auto max-h-[700px]">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#f5f0d9]">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-[#54715b]">
                  Insumo
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-[#54715b]">
                  Marca / observação
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-[#54715b]">
                  Qtd. embalagem
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-[#54715b]">
                  Unidade
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-[#54715b]">
                  Preço pago
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-widest text-[#54715b]">
                  Preço por unidade
                </th>
                <th className="w-12 px-3 py-3" aria-label="Ações" />
              </tr>
            </thead>

            <tbody className="divide-y divide-[#eee8d4]">
              {filteredIngredients.map((item) => (
                <tr key={item.id} className="transition hover:bg-[#fcf8e9]">
                  <td className="px-4 py-2.5">
                    <div className="flex min-w-[150px] items-center gap-2.5">
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-md text-sm ${
                          item.category === "embalagem"
                            ? "bg-[#f8e9dd] text-[#aa4331]"
                            : "bg-[#eaf0dc] text-[#34704a]"
                        }`}
                      >
                        {item.category === "embalagem" ? "□" : "✦"}
                      </span>
                      <input
                        className="w-full min-w-0 border-0 bg-transparent text-xs font-semibold text-[#315c40] outline-none focus:text-[#155b3b]"
                        value={item.name}
                        onChange={(event) =>
                          updateIngredient(item.id, "name", event.target.value)
                        }
                      />
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <input
                      className="h-8 w-full min-w-[140px] rounded-md border border-transparent bg-transparent px-2 text-xs text-[#54715b] outline-none placeholder:text-[#a4a187] hover:border-[#e4dfc9] focus:border-[#9eae82] focus:bg-[#fffdf2]"
                      value={item.brand}
                      onChange={(event) =>
                        updateIngredient(item.id, "brand", event.target.value)
                      }
                      placeholder="Adicionar observação"
                    />
                  </td>

                  <td className="px-3 py-2.5">
                    <input
                      className="h-8 w-24 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-2 text-xs text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
                      type="number"
                      value={item.pack}
                      onChange={(event) =>
                        updateIngredient(item.id, "pack", event.target.value)
                      }
                    />
                  </td>

                  <td className="px-3 py-2.5">
                    <select
                      className="h-8 w-20 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-2 text-xs text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
                      value={item.unit}
                      onChange={(event) =>
                        updateIngredient(item.id, "unit", event.target.value)
                      }
                    >
                      <option>g</option>
                      <option>ml</option>
                      <option>unid</option>
                    </select>
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex h-8 w-28 items-center rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-2 text-xs text-[#789078] focus-within:border-[#78936b]">
                      <span className="mr-1">R$</span>
                      <input
                        className="w-full min-w-0 bg-transparent text-right text-xs text-[#315c40] outline-none"
                        type="number"
                        step="0.01"
                        value={item.price}
                        onChange={(event) =>
                          updateIngredient(item.id, "price", event.target.value)
                        }
                      />
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-3 py-2.5">
                    <strong className="text-xs font-semibold text-[#315c40]">
                      {unitMoney(item.pack > 0 ? item.price / item.pack : 0)}
                    </strong>{" "}
                    <small className="text-[10px] text-[#829078]">
                      /{item.unit}
                    </small>
                  </td>

                  <td className="px-3 py-2.5">
                    <button
                      className="grid size-8 place-items-center rounded-md text-[#a43a32] transition hover:bg-[#f8e8df] hover:text-[#8f211e]"
                      title="Remover"
                      onClick={() => deleteIngredient(item)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isIngredientModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#183a28]/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={() => setIngredientModalOpen(false)}
        >
          <form
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[#e5ddbd] bg-[#fffbea] shadow-2xl"
            onSubmit={submitIngredient}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[#e9e2c9] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b52327]">
                  Novo cadastro
                </p>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#155b3b]">
                  Adicionar insumo
                </h3>
              </div>

              <button
                className="grid size-8 place-items-center rounded-md text-[#71826a] transition hover:bg-[#f3eedb] hover:text-[#a43a32]"
                type="button"
                onClick={() => setIngredientModalOpen(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#526d58] sm:col-span-2">
                Nome do insumo
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#315c40] outline-none placeholder:text-[#a4a187] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
                  autoFocus
                  required
                  value={ingredientDraft.name}
                  onChange={(event) =>
                    setIngredientDraft({
                      ...ingredientDraft,
                      name: event.target.value,
                    })
                  }
                  placeholder="Ex.: Muçarela"
                />
              </label>

              <label className="block text-xs font-medium text-[#526d58] sm:col-span-2">
                Marca / observação
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#315c40] outline-none placeholder:text-[#a4a187] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
                  value={ingredientDraft.brand}
                  onChange={(event) =>
                    setIngredientDraft({
                      ...ingredientDraft,
                      brand: event.target.value,
                    })
                  }
                  placeholder="Opcional"
                />
              </label>

              <label className="block text-xs font-medium text-[#526d58]">
                Qtd. da embalagem
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
                  required
                  min="0"
                  type="number"
                  value={ingredientDraft.pack}
                  onChange={(event) =>
                    setIngredientDraft({
                      ...ingredientDraft,
                      pack: event.target.value,
                    })
                  }
                />
              </label>

              <label className="block text-xs font-medium text-[#526d58]">
                Unidade
                <select
                  className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
                  value={ingredientDraft.unit}
                  onChange={(event) =>
                    setIngredientDraft({
                      ...ingredientDraft,
                      unit: event.target.value as Ingredient["unit"],
                    })
                  }
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="unid">unid</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-[#526d58] sm:col-span-2">
                Preço pago
                <div className="mt-1.5 flex h-10 items-center rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#789078] focus-within:border-[#78936b] focus-within:ring-2 focus-within:ring-[#78936b]/15">
                  <span className="mr-2">R$</span>
                  <input
                    className="w-full bg-transparent text-sm text-[#315c40] outline-none"
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={ingredientDraft.price}
                    onChange={(event) =>
                      setIngredientDraft({
                        ...ingredientDraft,
                        price: event.target.value,
                      })
                    }
                  />
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-[#e9e2c9] bg-[#faf6e5] px-5 py-4">
              <button
                className="h-10 rounded-md border border-[#ddd5b8] px-4 text-xs font-semibold text-[#54715b] transition hover:bg-[#f1ecd8]"
                type="button"
                onClick={() => setIngredientModalOpen(false)}
              >
                Cancelar
              </button>

              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#b51e24] px-4 text-xs font-semibold text-[#fff9df] transition hover:bg-[#99191e]"
                type="submit"
              >
                <Plus size={16} />
                Salvar insumo
              </button>
            </div>
          </form>
        </div>
      )}

      <PackagingTable
        ingredients={ingredients}
        updateIngredient={updateIngredient}
        addPackaging={addPackaging}
        deleteIngredient={deleteIngredient}
      />

      <div className="mt-6 rounded-lg border border-[#e5ddbd] bg-[#fffbea] p-5 shadow-[0_2px_8px_rgba(47,69,44,0.04)]">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-full bg-[#edf0d9] font-serif text-lg font-bold text-[#34704a]">
            ≈
          </div>

          <div>
            <strong className="font-serif text-base font-bold text-[#155b3b]">
              Premissas de conversão
            </strong>
            <p className="mt-0.5 text-xs text-[#71826a]">
              Use o peso médio para transformar unidades em gramas.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-xs font-medium text-[#526d58]">
            Cebola
            <div className="mt-1.5 flex h-10 items-center rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 focus-within:border-[#78936b]">
              <input
                className="w-full bg-transparent text-sm text-[#315c40] outline-none"
                type="number"
                value={conversion.cebola}
                onChange={(event) =>
                  setConversion((value) => ({
                    ...value,
                    cebola: parseNumber(event.target.value),
                  }))
                }
              />
              <span className="whitespace-nowrap text-[10px] text-[#829078]">
                g / unid.
              </span>
            </div>
          </label>

          <label className="block text-xs font-medium text-[#526d58]">
            Azeitona
            <div className="mt-1.5 flex h-10 items-center rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 focus-within:border-[#78936b]">
              <input
                className="w-full bg-transparent text-sm text-[#315c40] outline-none"
                type="number"
                value={conversion.azeitona}
                onChange={(event) =>
                  setConversion((value) => ({
                    ...value,
                    azeitona: parseNumber(event.target.value),
                  }))
                }
              />
              <span className="whitespace-nowrap text-[10px] text-[#829078]">
                g / unid.
              </span>
            </div>
          </label>
        </div>

        <button className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#a43a32] transition hover:text-[#81251f]">
          <RotateCcw size={14} />
          Restaurar padrão
        </button>
      </div>
    </section>
  );
}
