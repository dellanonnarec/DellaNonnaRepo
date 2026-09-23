import { useMemo, useState, useEffect } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Save,
  Pencil,
  Minus,
  CircleHelp,
} from "lucide-react";

// Ajuste os imports conforme a estrutura do seu projeto

import { publicSupabase } from "../../lib/supabase";

type Pizza = {
  id: number;
  dbId?: string;
  name: string;
  lines: RecipeLine[];
  salePrice: number;
  competitors: [number | null, number | null, number | null];
  category: "pizza" | "massa";
  doughSize: "broto" | "grande";
  doughRecipe: string;
  massYield: number;
};
const money = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? "sem dado"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parseNumber = (value: string) => Number(value.replace(",", ".")) || 0;

const initialIngredients: Ingredient[] = [
  
];
const initialPizzas: Pizza[] = [
  
];
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
const normalizeName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(de|da|do|das|dos)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const findIngredientByName = (ingredients: Ingredient[], name: string) => {
  const normalizedName = normalizeName(name);
  const exactMatches = ingredients.filter(
    (ingredient) => normalizeName(ingredient.name) === normalizedName,
  );
  const exact = exactMatches
    .sort(
      (left, right) =>
        Number(right.price > 0) - Number(left.price > 0) ||
        right.price - left.price,
    )
    .at(0);
  if (exact) return exact;
  const requestedTokens = normalizedName.split(" ").filter(Boolean);
  return ingredients
    .filter((ingredient) => {
      const ingredientTokens = normalizeName(ingredient.name).split(" ");
      return requestedTokens.every((token) => ingredientTokens.includes(token));
    })
    .sort(
      (left, right) =>
        Number(right.price > 0) - Number(left.price > 0) ||
        right.price - left.price,
    )
    .at(0);
};
type RecipeLine = {
  id: number;
  dbId?: string;
  ingredientId?: string;
  ingredient: string;
  quantity: number;
  type: "g" | "ml" | "unidade_cebola" | "unidade_azeitona";
};


type Dough = {
  flour: number;
  water: number;
  yeast: number;
  salt: number;
  oil: number;
  yield: number;
};
type Gas = {
  price: number;
  weight: number;
  consumption: number;
  minutes: number;
  pizzas: number;
};

const gasStorageKey = "della-nonna-gas";
const defaultGas: Gas = {
  price: 115,
  weight: 13,
  consumption: 0.7,
  minutes: 180,
  pizzas: 60,
};
const readStoredGas = (): { gas: Gas; gasIncluded: boolean } | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(gasStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{
      gas: Partial<Gas>;
      gasIncluded: boolean;
    }>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      gas: {
        price: Number(parsed.gas?.price ?? defaultGas.price),
        weight: Number(parsed.gas?.weight ?? defaultGas.weight),
        consumption: Number(parsed.gas?.consumption ?? defaultGas.consumption),
        minutes: Number(parsed.gas?.minutes ?? defaultGas.minutes),
        pizzas: Number(parsed.gas?.pizzas ?? defaultGas.pizzas),
      },
      gasIncluded: Boolean(parsed.gasIncluded),
    };
  } catch {
    return null;
  }
};

export default function Receitas() {
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [pizzas, setPizzas] = useState(initialPizzas);
  const [editingId, setEditingId] = useState<number | null>(null);
  const supabase = publicSupabase;
  const [dough, setDough] = useState<Dough>({
    flour: 1000,
    water: 600,
    yeast: 20,
    salt: 25,
    oil: 30,
    yield: 5,
  });
  const [saved, setSaved] = useState(false);
  const persistedGas = readStoredGas();
  const [conversion, setConversion] = useState({ cebola: 130, azeitona: 4 });
  const [gasIncluded, setGasIncluded] = useState<boolean>(
    () => persistedGas?.gasIncluded ?? false,
  );
  const [gas, setGas] = useState<Gas>(() => persistedGas?.gas ?? defaultGas);
  const unitPrice = (item?: Ingredient) =>
    item && item.pack > 0 ? item.price / item.pack : 0;
  const pricingSaveQueues = new Map<string, Promise<string | undefined>>();

  const doughCost = useMemo(() => {
    const values: Record<string, number> = {
      "Farinha de trigo": dough.flour,
      Água: dough.water,
      Fermento: dough.yeast,
      Sal: dough.salt,
      Óleo: dough.oil,
    };
    return (
      Object.entries(values).reduce((total, [name, quantity]) => {
        const item = findIngredientByName(ingredients, name);
        return total + (item ? quantity * unitPrice(item) : 0);
      }, 0) / Math.max(dough.yield, 1)
    );
  }, [dough, ingredients]);
  const doughRecipes = pizzas.filter((recipe) => recipe.category === "massa");
  const boxCost = ingredients
    .filter((ingredient) => ingredient.category === "embalagem")
    .reduce((total, ingredient) => total + unitPrice(ingredient), 0);

  const ingredientCost = (line: RecipeLine) => {
    const item = line.ingredientId
      ? ingredients.find((ingredient) => ingredient.dbId === line.ingredientId)
      : findIngredientByName(ingredients, line.ingredient);
    if (!item) return 0;
    const multiplier =
      line.type === "unidade_cebola"
        ? conversion.cebola
        : line.type === "unidade_azeitona"
          ? conversion.azeitona
          : 1;
    return line.quantity * multiplier * unitPrice(item);
  };
  const gasCost =
    gas.pizzas > 0
      ? ((gas.minutes / 60) * gas.consumption * (gas.price / gas.weight)) /
        gas.pizzas
      : 0;
  const totalCost = (pizza: Pizza) => {
    const selectedDough = doughRecipes.find(
      (recipe) => recipe.name === pizza.doughRecipe,
    );
    const pizzaDoughCost = selectedDough
      ? recipeDoughCost(selectedDough)
      : doughCost;
    return (
      (pizza.category === "massa"
        ? recipeDoughCost(pizza)
        : pizza.lines.reduce((total, line) => total + ingredientCost(line), 0) +
          pizzaDoughCost +
          boxCost) + (gasIncluded ? gasCost : 0)
    );
  };
  const savePricingToSupabase = async (pizza: Pizza) => {
    if (!supabase) return pizza.dbId;
    const queueKey = pizza.dbId ?? pizza.name;
    const previous = pricingSaveQueues.get(queueKey) ?? Promise.resolve();
    const next = previous.then(async () => {
      const payload = {
        pizza_nome: pizza.name,
        categoria: pizza.category,
        tamanho_massa: pizza.doughSize,
        massa_utilizada: pizza.doughRecipe || null,
        rendimento_massa: pizza.massYield,
        preco_venda: pizza.salePrice,
        concorrente_massa_arretada: pizza.competitors[0],
        concorrente_dantas: pizza.competitors[1],
        concorrente_farini: pizza.competitors[2],
      };
      const pricingResponse = pizza.dbId
        ? await supabase
            .from("precificacao")
            .update(payload)
            .eq("id", pizza.dbId)
            .select("id")
            .single()
        : await supabase
            .from("precificacao")
            .insert(payload)
            .select("id")
            .single();
      const pricing = pricingResponse.data;
      if (pricingResponse.error) throw pricingResponse.error;
      const pizzaId = (pricing?.id ?? pizza.dbId) as string | undefined;
      if (pizzaId) {
        await supabase.from("fichas_tecnicas").delete().eq("pizza_id", pizzaId);
      } else {
        await supabase
          .from("fichas_tecnicas")
          .delete()
          .eq("pizza_nome", pizza.name);
      }
      if (pizza.lines.length)
        await supabase.from("fichas_tecnicas").insert(
          pizza.lines.map((line, index) => ({
            pizza_id: pizzaId ?? null,
            pizza_nome: pizza.name,
            ingrediente_nome: line.ingredient,
            ingrediente_id: line.ingredientId || null,
            quantidade: line.quantity,
            tipo: line.type,
            ordem: index,
          })),
        );
      return pricing?.id as string | undefined;
    });
    pricingSaveQueues.set(queueKey, next);
    const dbId = await next.finally(() => {
      if (pricingSaveQueues.get(queueKey) === next)
        pricingSaveQueues.delete(queueKey);
    });
    return dbId;
  };
  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };
  useEffect(() => {
  if (!supabase) return;

  let mounted = true;

  const loadRecipesData = async () => {
    setIngredients([]);
    setPizzas([]);

    const [
      ingredientsResponse,
      assumptionsResponse,
      recipesResponse,
      pricingResponse,
      gasResponse,
    ] = await Promise.all([
      supabase
        .from("insumos")
        .select("*")
        .order("created_at"),

      supabase
        .from("premissas_conversao")
        .select("*"),

      supabase
        .from("fichas_tecnicas")
        .select("*")
        .order("ordem"),

      supabase
        .from("precificacao")
        .select("*")
        .order("pizza_nome"),

      supabase
        .from("gas")
        .select("*")
        .eq("id", true)
        .maybeSingle(),
    ]);

    if (!mounted) return;

    const failedResponse = [
      ingredientsResponse,
      assumptionsResponse,
      recipesResponse,
      pricingResponse,
      gasResponse,
    ].find((response) => response.error);

    if (failedResponse?.error) {
      console.error(
        "Falha ao carregar dados das receitas:",
        failedResponse.error,
      );

      return;
    }

    const ingredientRows = ingredientsResponse.data ?? [];
    const assumptionRows = assumptionsResponse.data ?? [];
    const recipeRows = recipesResponse.data ?? [];
    const pricingRows = pricingResponse.data ?? [];
    const gasRow = gasResponse.data;

    // ==========================================
    // INGREDIENTES
    // ==========================================

    const uniqueIngredients = new Map<
      string,
      (typeof ingredientRows)[number]
    >();

    ingredientRows.forEach((row) => {
      const key = `${normalizeName(row.nome)}::${row.categoria}`;

      const current = uniqueIngredients.get(key);

      if (
        !current ||
        Number(row.preco_pago) > Number(current.preco_pago) ||
        row.updated_at > current.updated_at
      ) {
        uniqueIngredients.set(key, row);
      }
    });

    setIngredients(
      [...uniqueIngredients.values()].map((row, index) => ({
        id: index + 1,
        dbId: row.id,
        name: row.nome,
        brand: row.marca_obs ?? "",
        pack: Number(row.qtd_embalagem ?? 0),
        unit: row.unidade,
        price: Number(row.preco_pago ?? 0),
        category: row.categoria,
      })),
    );

    // ==========================================
    // PREMISSAS DE CONVERSÃO
    // ==========================================

    setConversion({
      cebola: Number(
        assumptionRows.find((row) =>
          row.item.startsWith("Cebola"),
        )?.peso_medio_g ?? 130,
      ),

      azeitona: Number(
        assumptionRows.find((row) =>
          row.item.startsWith("Azeitona"),
        )?.peso_medio_g ?? 4,
      ),
    });

    // ==========================================
    // GÁS
    // ==========================================

    if (gasRow) {
      setGas({
        price: Number(gasRow.preco_botijao ?? 0),
        weight: Number(gasRow.peso_botijao_kg ?? 0),
        consumption: Number(gasRow.consumo_kg_hora ?? 0),
        minutes: Number(gasRow.tempo_turno_min ?? 0),
        pizzas: Number(gasRow.pizzas_por_turno ?? 0),
      });

      setGasIncluded(Boolean(gasRow.incluir_no_custo));
    }

    // ==========================================
    // PIZZAS / FICHAS TÉCNICAS
    // ==========================================

    const names = [
      ...new Set([
        ...pricingRows.map((row) => row.pizza_nome),
        ...recipeRows.map((row) => row.pizza_nome),
      ]),
    ];

    setPizzas(
      names.map((name, index) => {
        const pricing = pricingRows.find(
          (row) => row.pizza_nome === name,
        );

        const lines = recipeRows
          .filter((row) =>
            pricing?.id && row.pizza_id
              ? row.pizza_id === pricing.id
              : row.pizza_nome === name,
          )
          .filter((row, rowIndex, rows) =>
            rows.findIndex(
              (candidate) =>
                candidate.ingrediente_nome === row.ingrediente_nome &&
                Number(candidate.quantidade) ===
                  Number(row.quantidade) &&
                candidate.tipo === row.tipo &&
                candidate.ordem === row.ordem,
            ) === rowIndex,
          )
          .map((row, lineIndex) => ({
            id: lineIndex + 1,
            dbId: row.id,
            ingredient: row.ingrediente_nome,
            ingredientId: row.ingrediente_id ?? undefined,
            quantity: Number(row.quantidade ?? 0),
            type: row.tipo,
          }));

        return {
          id: index + 1,
          dbId: pricing?.id,

          name,

          category:
            pricing?.categoria === "massa"
              ? "massa"
              : "pizza",

          doughSize:
            pricing?.tamanho_massa === "grande"
              ? "grande"
              : "broto",

          doughRecipe: pricing?.massa_utilizada ?? "",

          massYield: Number(
            pricing?.rendimento_massa ?? 5,
          ),

          lines,

          salePrice: Number(
            pricing?.preco_venda ?? 0,
          ),

          competitors: [
            pricing?.concorrente_massa_arretada == null
              ? null
              : Number(pricing.concorrente_massa_arretada),

            pricing?.concorrente_dantas == null
              ? null
              : Number(pricing.concorrente_dantas),

            pricing?.concorrente_farini == null
              ? null
              : Number(pricing.concorrente_farini),
          ],
        };
      }),
    );
  };

  void loadRecipesData();

  return () => {
    mounted = false;
  };
}, [supabase]);

  const addPizza = () => {
    const pizza: Pizza = {
      id: Date.now(),
      name: "Novo sabor",
      lines: [],
      salePrice: 0,
      competitors: [null, null, null],
      category: "pizza",
      doughSize: "grande",
      doughRecipe: "",
      massYield: 5,
    };
    setPizzas((items) => [...items, pizza]);
    return pizza;
  };
  const savePizza = async (pizza: Pizza) => {
    const dbId = await savePricingToSupabase(pizza);
    if (dbId) {
      setPizzas((items) =>
        items.map((current) =>
          current.id === pizza.id ? { ...current, dbId } : current,
        ),
      );
    }
    flashSaved();
  };
  const deletePizza = async (pizza: Pizza) => {
    setPizzas((items) => items.filter((item) => item.id !== pizza.id));
    if (supabase) {
      if (pizza.dbId) {
        await supabase
          .from("fichas_tecnicas")
          .delete()
          .eq("pizza_id", pizza.dbId);
        await supabase.from("precificacao").delete().eq("id", pizza.dbId);
      } else {
        await supabase
          .from("fichas_tecnicas")
          .delete()
          .eq("pizza_nome", pizza.name);
        await supabase
          .from("precificacao")
          .delete()
          .eq("pizza_nome", pizza.name);
      }
    }
    flashSaved();
  };
  const duplicatePizza = async (source: Pizza) => {
    const baseName = source.name.replace(/\d+$/, "");
    const usedNames = new Set(pizzas.map((pizza) => pizza.name));
    let copyNumber = 1;
    let name = `${baseName}${String(copyNumber).padStart(2, "0")}`;
    while (usedNames.has(name)) {
      copyNumber += 1;
      name = `${baseName}${String(copyNumber).padStart(2, "0")}`;
    }
    const copy: Pizza = {
      ...source,
      id: Date.now(),
      dbId: undefined,
      name,
      lines: source.lines.map((line) => ({
        ...line,
        id: Date.now() + Math.random(),
        dbId: undefined,
      })),
    };
    const dbId = await savePricingToSupabase(copy);
    setPizzas((items) => [...items, dbId ? { ...copy, dbId } : copy]);
    flashSaved();
  };
  const addLine = (pizzaId: number) =>
    setPizzas((items) =>
      items.map((pizza) =>
        pizza.id === pizzaId
          ? {
              ...pizza,
              lines: [
                ...pizza.lines,
                {
                  id: Date.now(),
                  ingredientId: ingredients.find(
                    (item) => item.category === "insumo",
                  )?.dbId,
                  ingredient:
                    ingredients.find((item) => item.category === "insumo")
                      ?.name ?? "",
                  quantity: 0,
                  type: "g",
                },
              ],
            }
          : pizza,
      ),
    );

  const startNewRecipe = () => {
    const pizza = addPizza();
    setEditingId(pizza.id);
  };

  const saveCurrentRecipe = async (pizza: Pizza) => {
    await savePizza(pizza);
    setEditingId(null);
  };

  const updateLine = (
    pizzaId: number,
    lineId: number,
    key: keyof RecipeLine,
    value: string,
  ) =>
    setPizzas((items) =>
      items.map((pizza) =>
        pizza.id === pizzaId
          ? {
              ...pizza,
              lines: pizza.lines.map((line) =>
                line.id === lineId
                  ? ({
                      ...line,
                      [key]: key === "quantity" ? parseNumber(value) : value,
                    } as RecipeLine)
                  : line,
              ),
            }
          : pizza,
      ),
    );

  const selectIngredient = (
    pizzaId: number,
    lineId: number,
    ingredientId: string,
  ) => {
    setPizzas((items) =>
      items.map((pizza) =>
        pizza.id === pizzaId
          ? {
              ...pizza,
              lines: pizza.lines.map((line) => {
                if (line.id !== lineId) return line;

                const ingredient = ingredients.find(
                  (item) =>
                    item.dbId === ingredientId || item.name === ingredientId,
                );

                return ingredient
                  ? {
                      ...line,
                      ingredientId: ingredient.dbId,
                      ingredient: ingredient.name,
                    }
                  : line;
              }),
            }
          : pizza,
      ),
    );
  };

  const recipeBatchCost = (recipe: Pizza) =>
    recipe.lines.reduce((total, line) => total + ingredientCost(line), 0);

  const recipeDoughCost = (recipe: Pizza) =>
    recipeBatchCost(recipe) / Math.max(recipe.massYield, 1);

  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow orange">RECEITAS</p>

          <h2>Fichas técnicas</h2>

          <p className="section-description">
            Cada grama conta. Acompanhe o custo real de cada sabor em um só
            lugar.
          </p>
        </div>

        <button className="primary-button" onClick={startNewRecipe}>
          <Plus size={16} /> Nova receita
        </button>
      </div>

      <div className="recipe-grid">
        {pizzas.map((pizza) => {
          const isEditing = editingId === pizza.id;

          const selectedDough = doughRecipes.find(
            (recipe) => recipe.name === pizza.doughRecipe,
          );

          const pizzaDoughCost = selectedDough
            ? recipeDoughCost(selectedDough)
            : doughCost;

          return (
            <article className="recipe-card" key={pizza.id}>
              <div className="recipe-card-header">
                <div>
                  <span className="recipe-kicker">
                    FICHA {String(pizza.id).padStart(2, "0")}
                  </span>

                  <h3>
                    <input
                      value={pizza.name}
                      disabled={!isEditing}
                      onChange={(event) =>
                        setPizzas((items) =>
                          items.map((item) =>
                            item.id === pizza.id
                              ? {
                                  ...item,
                                  name: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </h3>
                </div>

                <button
                  className="more-button"
                  title="Duplicar receita"
                  onClick={() => duplicatePizza(pizza)}
                >
                  <Copy size={16} />
                </button>

                <button
                  className="more-button"
                  title="Remover sabor"
                  onClick={() => deletePizza(pizza)}
                >
                  <Trash2 size={16} />
                </button>

                {isEditing ? (
                  <button
                    className="save-recipe-button"
                    title="Salvar receita"
                    onClick={() => saveCurrentRecipe(pizza)}
                  >
                    <Save size={15} /> Salvar
                  </button>
                ) : (
                  <button
                    className="more-button"
                    title="Editar receita"
                    onClick={() => setEditingId(pizza.id)}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>

              <fieldset className="recipe-editor" disabled={!isEditing}>
                <div className="recipe-settings">
                  <label>
                    Categoria
                    <select
                      value={pizza.category}
                      onChange={(event) =>
                        setPizzas((items) =>
                          items.map((item) =>
                            item.id === pizza.id
                              ? {
                                  ...item,
                                  category: event.target
                                    .value as Pizza["category"],
                                }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="pizza">Pizza</option>
                      <option value="massa">Massa</option>
                    </select>
                  </label>

                  {pizza.category === "massa" ? (
                    <>
                      <label>
                        Tamanho da massa
                        <select
                          value={pizza.doughSize}
                          onChange={(event) =>
                            setPizzas((items) =>
                              items.map((item) =>
                                item.id === pizza.id
                                  ? {
                                      ...item,
                                      doughSize: event.target
                                        .value as Pizza["doughSize"],
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="broto">
                            Broto / Individual · 25 cm · 4 fatias
                          </option>

                          <option value="grande">
                            Grande · 35 cm · 8 fatias
                          </option>
                        </select>
                      </label>

                      <label>
                        Rendimento
                        <input
                          type="number"
                          min="1"
                          value={pizza.massYield}
                          onChange={(event) =>
                            setPizzas((items) =>
                              items.map((item) =>
                                item.id === pizza.id
                                  ? {
                                      ...item,
                                      massYield: parseNumber(
                                        event.target.value,
                                      ),
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                    </>
                  ) : (
                    <label>
                      Massa utilizada no custo
                      <select
                        value={pizza.doughRecipe}
                        onChange={(event) =>
                          setPizzas((items) =>
                            items.map((item) =>
                              item.id === pizza.id
                                ? {
                                    ...item,
                                    doughRecipe: event.target.value,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <option value="">Massa padrão</option>

                        {doughRecipes.map((recipe) => (
                          <option key={recipe.id} value={recipe.name}>
                            {recipe.name} ·{" "}
                            {recipe.doughSize === "broto" ? "25 cm" : "35 cm"}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="recipe-lines">
                  {pizza.lines.map((line) => (
                    <div className="recipe-line" key={line.id}>
                      <select
                        value={
                          line.ingredientId ??
                          findIngredientByName(ingredients, line.ingredient)
                            ?.dbId ??
                          ""
                        }
                        onChange={(event) =>
                          selectIngredient(
                            pizza.id,
                            line.id,
                            event.target.value,
                          )
                        }
                      >
                        {ingredients
                          .filter((item) => item.category === "insumo")
                          .map((item) => (
                            <option
                              key={item.id}
                              value={item.dbId ?? item.name}
                            >
                              {item.name}
                            </option>
                          ))}
                      </select>

                      <input
                        className="quantity"
                        type="number"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(
                            pizza.id,
                            line.id,
                            "quantity",
                            event.target.value,
                          )
                        }
                      />

                      <select
                        className="type-select"
                        value={line.type}
                        onChange={(event) =>
                          updateLine(
                            pizza.id,
                            line.id,
                            "type",
                            event.target.value,
                          )
                        }
                      >
                        <option value="g">g</option>
                        <option value="ml">ml</option>
                        <option value="unidade_cebola">un cebola</option>
                        <option value="unidade_azeitona">un azeitona</option>
                      </select>

                      <span className="line-cost">
                        {money(ingredientCost(line))}
                      </span>

                      <button
                        className="remove-line"
                        onClick={() =>
                          setPizzas((items) =>
                            items.map((item) =>
                              item.id === pizza.id
                                ? {
                                    ...item,
                                    lines: item.lines.filter(
                                      (current) => current.id !== line.id,
                                    ),
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button className="add-line" onClick={() => addLine(pizza.id)}>
                  <Plus size={14} /> Adicionar ingrediente
                </button>

                <div className="cost-breakdown">
                  {pizza.category === "massa" ? (
                    <>
                      <div>
                        <span>Custo do lote de massa</span>
                        <strong>{money(recipeBatchCost(pizza))}</strong>
                      </div>

                      <div>
                        <span>
                          Custo de massa por pizza (lote ÷ rendimento)
                        </span>
                        <strong>{money(recipeDoughCost(pizza))}</strong>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <span>Subtotal cobertura</span>

                        <strong>
                          {money(
                            pizza.lines.reduce(
                              (sum, line) => sum + ingredientCost(line),
                              0,
                            ),
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Massa rateada <CircleHelp size={12} />
                        </span>

                        <strong>{money(pizzaDoughCost)}</strong>
                      </div>

                      <div>
                        <span>Embalagem</span>

                        <strong>{money(boxCost)}</strong>
                      </div>
                    </>
                  )}
                </div>

                {pizza.category === "pizza" && (
                  <div className="total-row">
                    <span>Custo total da pizza</span>

                    <strong>{money(totalCost(pizza))}</strong>
                  </div>
                )}
              </fieldset>
            </article>
          );
        })}
      </div>
    </section>
  );
}
