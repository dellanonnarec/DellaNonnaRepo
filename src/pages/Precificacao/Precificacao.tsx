import { Save, Flame } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
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

type RecipeLine = {
  id: number;
  dbId?: string;
  ingredientId?: string;
  ingredient: string;
  quantity: number;
  type: "g" | "ml" | "unidade_cebola" | "unidade_azeitona";
};

type Gas = {
  price: number;
  weight: number;
  consumption: number;
  minutes: number;
  pizzas: number;
};

const initialPizzas: Pizza[] = [];

const money = (value: number | null | undefined) =>
  value == null || Number.isNaN(value)
    ? "sem dado"
    : value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });

const parseNumber = (value: string) => Number(value.replace(",", ".")) || 0;
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

type Dough = {
  flour: number;
  water: number;
  yeast: number;
  salt: number;
  oil: number;
  yield: number;
};
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

const initialIngredients: Ingredient[] = [];

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

export default function Precificacao() {
  const supabase = publicSupabase;
  const [pizzas, setPizzas] = useState(initialPizzas);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const persistedGas = readStoredGas();
  const [gas, setGas] = useState<Gas>(() => persistedGas?.gas ?? defaultGas);
  const [saved, setSaved] = useState(false);
  const [conversion, setConversion] = useState({ cebola: 130, azeitona: 4 });
  const [gasIncluded, setGasIncluded] = useState<boolean>(
    () => persistedGas?.gasIncluded ?? false,
  );
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const loadPricingData = async () => {
      const [
        ingredientsResponse,
        assumptionsResponse,
        recipesResponse,
        pricingResponse,
        gasResponse,
        doughResponse,
      ] = await Promise.all([
        supabase.from("insumos").select("*").order("created_at"),

        supabase.from("premissas_conversao").select("*"),

        supabase.from("fichas_tecnicas").select("*").order("ordem"),

        supabase.from("precificacao").select("*").order("pizza_nome"),

        supabase.from("gas").select("*").eq("id", true).maybeSingle(),

        supabase.from("receita_massa").select("*").order("ingrediente_nome"),
      ]);

      if (!mounted) return;

      const failedResponse = [
        ingredientsResponse,
        assumptionsResponse,
        recipesResponse,
        pricingResponse,
        gasResponse,
        doughResponse,
      ].find((response) => response.error);

      if (failedResponse?.error) {
        console.error(
          "Falha ao carregar dados da precificação:",
          failedResponse.error,
        );

        return;
      }

      const ingredientRows = ingredientsResponse.data ?? [];
      const assumptionRows = assumptionsResponse.data ?? [];
      const recipeRows = recipesResponse.data ?? [];
      const pricingRows = pricingResponse.data ?? [];
      const gasRow = gasResponse.data;
      const doughRows = doughResponse.data ?? [];

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
          assumptionRows.find((row) => row.item.startsWith("Cebola"))
            ?.peso_medio_g ?? 130,
        ),

        azeitona: Number(
          assumptionRows.find((row) => row.item.startsWith("Azeitona"))
            ?.peso_medio_g ?? 4,
        ),
      });

      // ==========================================
      // GÁS
      // ==========================================

      if (gasRow) {
        const loadedGas: Gas = {
          price: Number(gasRow.preco_botijao ?? 0),
          weight: Number(gasRow.peso_botijao_kg ?? 0),
          consumption: Number(gasRow.consumo_kg_hora ?? 0),
          minutes: Number(gasRow.tempo_turno_min ?? 0),
          pizzas: Number(gasRow.pizzas_por_turno ?? 0),
        };

        setGas(loadedGas);
        setGasIncluded(Boolean(gasRow.incluir_no_custo));

        // Mantém também o localStorage sincronizado
        try {
          window.localStorage.setItem(
            gasStorageKey,
            JSON.stringify({
              gas: loadedGas,
              gasIncluded: Boolean(gasRow.incluir_no_custo),
            }),
          );
        } catch {
          // Ignora erro de localStorage
        }
      }

      // ==========================================
      // RECEITA BASE DA MASSA
      // ==========================================

      if (doughRows.length) {
        const values: Dough = {
          flour: 0,
          water: 0,
          yeast: 0,
          salt: 0,
          oil: 0,
          yield: Number(doughRows[0].rendimento_pizzas ?? 5),
        };

        doughRows.forEach((row) => {
          const key = row.ingrediente_nome.toLowerCase();

          if (key.includes("farinha")) {
            values.flour = Number(row.quantidade_g ?? 0);
          }

          if (key.includes("água") || key.includes("agua")) {
            values.water = Number(row.quantidade_g ?? 0);
          }

          if (key.includes("fermento")) {
            values.yeast = Number(row.quantidade_g ?? 0);
          }

          if (key.includes("sal")) {
            values.salt = Number(row.quantidade_g ?? 0);
          }

          if (key.includes("óleo") || key.includes("oleo")) {
            values.oil = Number(row.quantidade_g ?? 0);
          }
        });

        setDough(values);
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

      const loadedPizzas: Pizza[] = names.map((name, index) => {
        const pricing = pricingRows.find((row) => row.pizza_nome === name);

        const lines = recipeRows
          .filter((row) =>
            pricing?.id && row.pizza_id
              ? row.pizza_id === pricing.id
              : row.pizza_nome === name,
          )
          .filter(
            (row, rowIndex, rows) =>
              rows.findIndex(
                (candidate) =>
                  candidate.ingrediente_nome === row.ingrediente_nome &&
                  Number(candidate.quantidade) === Number(row.quantidade) &&
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

          lines,

          salePrice: Number(pricing?.preco_venda ?? 0),

          category: pricing?.categoria === "massa" ? "massa" : "pizza",

          doughSize: pricing?.tamanho_massa === "grande" ? "grande" : "broto",

          doughRecipe: pricing?.massa_utilizada ?? "",

          massYield: Number(pricing?.rendimento_massa ?? 5),

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
      });

      setPizzas(loadedPizzas);
    };

    void loadPricingData();

    return () => {
      mounted = false;
    };
  }, [supabase]);
  const pricingSaveTimers = new Map<number, ReturnType<typeof setTimeout>>();
  const pricingSaveQueues = new Map<string, Promise<string | undefined>>();
  const unitPrice = (item?: Ingredient) =>
    item && item.pack > 0 ? item.price / item.pack : 0;
  const [dough, setDough] = useState<Dough>({
    flour: 1000,
    water: 600,
    yeast: 20,
    salt: 25,
    oil: 30,
    yield: 5,
  });
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
  const recipeBatchCost = (recipe: Pizza) =>
    recipe.lines.reduce((total, line) => total + ingredientCost(line), 0);
  const recipeDoughCost = (recipe: Pizza) =>
    recipeBatchCost(recipe) / Math.max(recipe.massYield, 1);
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
  const pizzaRecipes = pizzas.filter((pizza) => pizza.category === "pizza");
  const gasCost =
    gas.pizzas > 0
      ? ((gas.minutes / 60) * gas.consumption * (gas.price / gas.weight)) /
        gas.pizzas
      : 0;

  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
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
  const schedulePricingSave = (pizza: Pizza) => {
    if (!supabase || !pizza.dbId) return;
    const currentTimer = pricingSaveTimers.get(pizza.id);
    if (currentTimer) clearTimeout(currentTimer);
    pricingSaveTimers.set(
      pizza.id,
      setTimeout(() => {
        pricingSaveTimers.delete(pizza.id);
        void savePricingToSupabase(pizza);
      }, 400),
    );
  };

  const updatePizza = (
    id: number,
    key: "salePrice" | "name",
    value: string,
  ) => {
    setPizzas((current) =>
      current.map((pizza) => {
        if (pizza.id !== id) return pizza;
        const next = {
          ...pizza,
          [key]: key === "salePrice" ? parseNumber(value) : value,
        };
        schedulePricingSave(next);
        return next;
      }),
    );
    flashSaved();
  };
  return (
    <section className="min-h-screen bg-[#fbf5d9] px-6  text-[#295727] sm:px-8 lg:px-11">
      <div className="mb-7 flex flex-col items-start justify-between gap-5 xl:flex-row xl:items-end">
        <div>
          <p className="font-serif text-3xl font-bold tracking-tight text-[#155b3b]">
            Estratégia comercial
          </p>
          <p className="mt-1 max-w-2xl text-sm text-[#54715b]">
            Veja onde sua margem está saudável e como você se posiciona na
            região.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[#e5ddbd] bg-[#fffbea] px-4 py-3 text-xs text-[#54715b]">
          <span className="inline-flex items-center gap-2">
            <i className="size-2 rounded-full bg-[#438457]" />
            Margem saudável
          </span>

          <span className="inline-flex items-center gap-2">
            <i className="size-2 rounded-full bg-[#d69b38]" />
            Atenção
          </span>

          <span className="inline-flex items-center gap-2">
            <i className="size-2 rounded-full bg-[#b52327]" />
            Revisar preço
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#e5ddbd] bg-[#fffbea] shadow-[0_2px_8px_rgba(47,69,44,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#e9e2c9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-3">
            <strong className="font-serif text-lg font-bold text-[#155b3b]">
              Margem por sabor
            </strong>

            <span className="rounded-full bg-[#edf0d9] px-2.5 py-1 text-[10px] font-semibold text-[#426548]">
              {pizzaRecipes.length} sabores
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#71826a]">
            <Save size={14} className="text-[#438457]" />
            Atualização automática
          </span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[700px]">
          <table className="w-full min-w-[940px] border-collapse text-left">
            <thead className="bg-[#f5f0d9]">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Sabor
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Custo total
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Preço de venda
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Margem R$
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Margem %
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Massa Arretada
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Dantas
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Farini
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#eee8d4]">
              {pizzaRecipes.map((pizza) => {
                const cost = totalCost(pizza);
                const margin = pizza.salePrice - cost;
                const percentage =
                  pizza.salePrice > 0 ? margin / pizza.salePrice : 0;

                const color =
                  percentage > 0.55
                    ? "good"
                    : percentage >= 0.45
                      ? "warn"
                      : "bad";

                const marginStyle =
                  color === "good"
                    ? "bg-[#e8f0df] text-[#34704a]"
                    : color === "warn"
                      ? "bg-[#f8efd8] text-[#a16e1f]"
                      : "bg-[#f7e5dc] text-[#ad342b]";

                return (
                  <tr key={pizza.id} className="transition hover:bg-[#fcf8e9]">
                    <td className="px-4 py-3">
                      <strong className="font-serif text-sm font-bold text-[#315c40]">
                        {pizza.name}
                      </strong>
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[#54715b]">
                      {money(cost)}
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex h-8 w-28 items-center rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-2 text-xs text-[#789078] focus-within:border-[#78936b]">
                        <span className="mr-1">R$</span>
                        <input
                          className="w-full min-w-0 bg-transparent text-right text-xs text-[#315c40] outline-none"
                          type="number"
                          step="0.01"
                          value={pizza.salePrice}
                          onChange={(event) =>
                            updatePizza(
                              pizza.id,
                              "salePrice",
                              event.target.value,
                            )
                          }
                        />
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-3">
                      <strong className="text-xs font-semibold text-[#315c40]">
                        {money(margin)}
                      </strong>
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${marginStyle}`}
                      >
                        {(percentage * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </td>

                    {pizza.competitors.map((price, index) => (
                      <td className="px-3 py-3" key={index}>
                        <input
                          className="h-8 w-24 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-2 text-xs text-[#315c40] outline-none placeholder:text-[#a4a187] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
                          type="number"
                          step="0.01"
                          placeholder="sem dado"
                          value={price ?? ""}
                          onChange={(event) =>
                            setPizzas((items) =>
                              items.map((item) =>
                                item.id === pizza.id
                                  ? {
                                      ...item,
                                      competitors: item.competitors.map(
                                        (current, currentIndex) =>
                                          currentIndex === index
                                            ? event.target.value
                                              ? parseNumber(event.target.value)
                                              : null
                                            : current,
                                      ) as Pizza["competitors"],
                                    }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-[#e5ddbd] bg-[#fffbea] shadow-[0_2px_8px_rgba(47,69,44,0.04)]">
        <div className="flex flex-col gap-4 border-b border-[#e9e2c9] px-5 py-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#f8e9dd] text-[#b44b30]">
              <Flame size={21} />
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#b52327]">
                Estimativa operacional
              </span>

              <h3 className="mt-0.5 font-serif text-lg font-bold text-[#155b3b]">
                Custo de gás
              </h3>

              <p className="mt-1 text-xs text-[#71826a]">
                Este valor é uma referência e não entra no custo total por
                padrão.
              </p>
            </div>
          </div>

          <label className="inline-flex shrink-0 cursor-pointer items-center gap-2.5 text-xs font-medium text-[#426548]">
            <input
              className="peer sr-only"
              type="checkbox"
              checked={gasIncluded}
              onChange={(event) => setGasIncluded(event.target.checked)}
            />
            <span className="relative h-5 w-9 rounded-full bg-[#d8d5bd] transition peer-checked:bg-[#34704a] peer-focus-visible:ring-2 peer-focus-visible:ring-[#34704a]/30 peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
            Incluir no custo da pizza
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {(
            [
              ["Preço do botijão", "price", "R$"],
              ["Peso do botijão", "weight", "kg"],
              ["Consumo por hora", "consumption", "kg/h"],
              ["Tempo de turno", "minutes", "min"],
              ["Pizzas por turno", "pizzas", "pizzas"],
            ] as const
          ).map(([label, key, suffix]) => (
            <label
              className="block text-[11px] font-medium text-[#526d58]"
              key={key}
            >
              {label}

              <div className="mt-1.5 flex h-9 items-center rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 focus-within:border-[#78936b] focus-within:ring-2 focus-within:ring-[#78936b]/15">
                <input
                  className="w-full min-w-0 bg-transparent text-xs text-[#315c40] outline-none"
                  type="number"
                  step="0.1"
                  value={gas[key]}
                  onChange={(event) =>
                    setGas((value) => ({
                      ...value,
                      [key]: parseNumber(event.target.value),
                    }))
                  }
                />

                <span className="ml-2 whitespace-nowrap text-[10px] text-[#829078]">
                  {suffix}
                </span>
              </div>
            </label>
          ))}

          <div className="flex flex-col justify-center rounded-md border border-[#dfe6cf] bg-[#f1f3df] px-4 py-3 sm:col-span-2 xl:col-span-1">
            <span className="text-[10px] font-medium text-[#54715b]">
              Custo estimado por pizza
            </span>

            <strong className="mt-0.5 font-mono text-lg font-bold text-[#b52327]">
              {money(gasCost)}
            </strong>

            <small className="mt-0.5 text-[10px] text-[#71826a]">
              {gasIncluded
                ? "Incluído nos custos acima"
                : "Não incluído no custo total"}
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}
