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
      !query ||
      `${item.name} ${item.brand}`
        .toLocaleLowerCase()
        .includes(query)
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
        items.map((current) => current.id === item.id ? { ...current, dbId } : current),
      );
    }
    flashSaved();
  };
   const deleteIngredient = async (ingredient: Ingredient) => {
    setIngredients((items) => items.filter((item) => item.id !== ingredient.id));
    if (supabase && ingredient.dbId) {
      await supabase.from("insumos").delete().eq("id", ingredient.dbId);
    }
    flashSaved();
  };
  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow orange">BASE DE CUSTOS</p>
          <h2>O que entra na pizza</h2>
          <p className="section-description">
            Atualize os preços de compra. Todos os custos são recalculados
            automaticamente.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() => setIngredientModalOpen(true)}
        >
          <Plus size={16} /> Adicionar insumo
        </button>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div>
            <strong>Insumos cadastrados</strong>

            <span className="count-badge">
              {filteredIngredients.length} itens
            </span>
          </div>

          <label className="table-search">
            <Search size={14} />

            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Pesquisar insumo"
              aria-label="Pesquisar insumo"
            />
          </label>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Marca / observação</th>
                <th>Qtd. embalagem</th>
                <th>Unidade</th>
                <th>Preço pago</th>
                <th>Preço por unidade</th>
                <th aria-label="Ações" />
              </tr>
            </thead>

            <tbody>
              {filteredIngredients.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="ingredient-name">
                      <span
                        className={
                          item.category === "embalagem"
                            ? "ingredient-icon box"
                            : "ingredient-icon"
                        }
                      >
                        {item.category === "embalagem" ? "□" : "✦"}
                      </span>

                      <input
                        value={item.name}
                        onChange={(event) =>
                          updateIngredient(item.id, "name", event.target.value)
                        }
                      />
                    </div>
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
                      <option>g</option>
                      <option>ml</option>
                      <option>unid</option>
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

      {isIngredientModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setIngredientModalOpen(false)}
        >
          <form
            className="ingredient-modal"
            onSubmit={submitIngredient}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow orange">NOVO CADASTRO</p>

                <h3>Adicionar insumo</h3>
              </div>

              <button
                className="modal-close"
                type="button"
                onClick={() => setIngredientModalOpen(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="ingredient-form-grid">
              <label className="form-field form-field-wide">
                Nome do insumo
                <input
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

              <label className="form-field form-field-wide">
                Marca / observação
                <input
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

              <label className="form-field">
                Qtd. da embalagem
                <input
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

              <label className="form-field">
                Unidade
                <select
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

              <label className="form-field form-field-wide">
                Preço pago
                <div className="modal-price-input">
                  <span>R$</span>

                  <input
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

            <div className="modal-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setIngredientModalOpen(false)}
              >
                Cancelar
              </button>

              <button className="primary-button" type="submit">
                <Plus size={16} /> Salvar insumo
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

      <div className="conversion-card">
        <div className="conversion-title">
          <div className="conversion-icon">≈</div>

          <div>
            <strong>Premissas de conversão</strong>

            <p>Use o peso médio para transformar unidades em gramas.</p>
          </div>
        </div>

        <div className="conversion-fields">
          <label>
            Cebola{" "}
            <div className="input-with-suffix">
              <input
                type="number"
                value={conversion.cebola}
                onChange={(event) =>
                  setConversion((value) => ({
                    ...value,
                    cebola: parseNumber(event.target.value),
                  }))
                }
              />

              <span>g / unid.</span>
            </div>
          </label>

          <label>
            Azeitona{" "}
            <div className="input-with-suffix">
              <input
                type="number"
                value={conversion.azeitona}
                onChange={(event) =>
                  setConversion((value) => ({
                    ...value,
                    azeitona: parseNumber(event.target.value),
                  }))
                }
              />

              <span>g / unid.</span>
            </div>
          </label>
        </div>

        <button className="text-button">
          <RotateCcw size={14} /> Restaurar padrão
        </button>
      </div>
    </section>
  );
}
