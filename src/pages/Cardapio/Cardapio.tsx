import { FormEvent, useMemo, useState, useEffect } from "react";
import {
  ChevronDown,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { publicSupabase } from "../../lib/supabase";

type MenuCategory = "Pizza" | "Bebida" | "Porção" | "Sobremesa" | "Outro";

type MenuItem = {
  id: number;
  dbId?: string;
  nome_comercial: string;
  ficha_tecnica_ref: string;
  descricao: string;
  categoria: MenuCategory;
  tamanho: string;
  imagem_url: string;
  preco_venda: number;
  disponivel: boolean;
  destaque: boolean;
  ordem_exibicao: number;
  observacoes_internas: string;
};

type RecipeLine = {
  id: number;
  dbId?: string;
  ingredientId?: string;
  ingredient: string;
  quantity: number;
  type: "g" | "ml" | "unidade_cebola" | "unidade_azeitona";
};

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

type Gas = {
  price: number;
  weight: number;
  consumption: number;
  minutes: number;
  pizzas: number;
};
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
type Dough = {
  flour: number;
  water: number;
  yeast: number;
  salt: number;
  oil: number;
  yield: number;
};

const initialIngredients: Ingredient[] = [];
const initialPizzas: Pizza[] = [];

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

const menuCategoryOptions: MenuCategory[] = [
  "Pizza",
  "Bebida",
  "Porção",
  "Sobremesa",
  "Outro",
];

const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const getMarginTone = (percentage: number) => {
  if (percentage >= 0.55) return "good";
  if (percentage >= 0.4) return "warning";
  return "danger";
};

const getMenuMarginSummary = (
  item: Pick<MenuItem, "ficha_tecnica_ref" | "preco_venda">,
  pizzas: Pizza[],
  totalCost: (pizza: Pizza) => number,
) => {
  const recipe = pizzas.find((pizza) => pizza.name === item.ficha_tecnica_ref);
  const cost = recipe ? totalCost(recipe) : 0;
  const salePrice = Number(item.preco_venda ?? 0);
  const margin = salePrice - cost;
  const percentage = salePrice > 0 ? margin / salePrice : 0;
  return { cost, margin, percentage, tone: getMarginTone(percentage) };
};

///////////////////////////////////////////////////////////////
export default function Cardapio() {
  const supabase = publicSupabase;
  const [categoryFilter, setCategoryFilter] = useState<"Todos" | MenuCategory>(
    "Todos",
  );

  const [statusFilter, setStatusFilter] = useState<
    "Todos" | "Disponível" | "Indisponível"
  >("Todos");
  const [pizzas, setPizzas] = useState(initialPizzas);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const doughRecipes = pizzas.filter((recipe) => recipe.category === "massa");
  const [draft, setDraft] = useState({
    id: Date.now(),
    dbId: undefined as string | undefined,
    nome_comercial: "",
    ficha_tecnica_ref: "",
    descricao: "",
    categoria: "Pizza" as MenuCategory,
    tamanho: "",
    imagem_url: "",
    preco_venda: "0",
    disponivel: true,
    destaque: false,
    ordem_exibicao: "1",
    observacoes_internas: "",
  });
  const [saved, setSaved] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const persistedGas = readStoredGas();
  const [gas, setGas] = useState<Gas>(() => persistedGas?.gas ?? defaultGas);
  const [gasIncluded, setGasIncluded] = useState<boolean>(
    () => persistedGas?.gasIncluded ?? false,
  );
  const [conversion, setConversion] = useState({ cebola: 130, azeitona: 4 });
  const [dough, setDough] = useState<Dough>({
    flour: 1000,
    water: 600,
    yeast: 20,
    salt: 25,
    oil: 30,
    yield: 5,
  });

  useEffect(() => {
  if (!supabase) return;

  let mounted = true;

  const loadCardapioData = async () => {
    const [
      menuResponse,
      ingredientsResponse,
      assumptionsResponse,
      recipesResponse,
      pricingResponse,
      gasResponse,
      doughResponse,
    ] = await Promise.all([
      supabase
        .from("cardapio_itens")
        .select("*")
        .order("ordem_exibicao"),

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

      supabase
        .from("receita_massa")
        .select("*")
        .order("ingrediente_nome"),
    ]);

    if (!mounted) return;

    const failedResponse = [
      menuResponse,
      ingredientsResponse,
      assumptionsResponse,
      recipesResponse,
      pricingResponse,
      gasResponse,
      doughResponse,
    ].find((response) => response.error);

    if (failedResponse?.error) {
      console.error(
        "Falha ao carregar dados do cardápio:",
        failedResponse.error,
      );
      return;
    }

    const menuRows = menuResponse.data ?? [];
    const ingredientRows = ingredientsResponse.data ?? [];
    const assumptionRows = assumptionsResponse.data ?? [];
    const recipeRows = recipesResponse.data ?? [];
    const pricingRows = pricingResponse.data ?? [];
    const gasRow = gasResponse.data;
    const doughRows = doughResponse.data ?? [];

    /*
     * =========================================================
     * INGREDIENTES
     * =========================================================
     */

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

    const loadedIngredients: Ingredient[] = [
      ...uniqueIngredients.values(),
    ].map((row, index) => ({
      id: index + 1,
      dbId: row.id,
      name: row.nome,
      brand: row.marca_obs ?? "",
      pack: Number(row.qtd_embalagem ?? 0),
      unit: row.unidade,
      price: Number(row.preco_pago ?? 0),
      category: row.categoria,
    }));

    setIngredients(loadedIngredients);

    /*
     * =========================================================
     * PREMISSAS DE CONVERSÃO
     * =========================================================
     */

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

    /*
     * =========================================================
     * GÁS
     * =========================================================
     */

    if (gasRow) {
      const loadedGas: Gas = {
        price: Number(gasRow.preco_botijao ?? 0),
        weight: Number(gasRow.peso_botijao_kg ?? 0),
        consumption: Number(gasRow.consumo_kg_hora ?? 0),
        minutes: Number(gasRow.tempo_turno_min ?? 0),
        pizzas: Number(gasRow.pizzas_por_turno ?? 0),
      };

      setGas(loadedGas);
      setGasIncluded(
        Boolean(gasRow.incluir_no_custo),
      );

      try {
        window.localStorage.setItem(
          gasStorageKey,
          JSON.stringify({
            gas: loadedGas,
            gasIncluded: Boolean(
              gasRow.incluir_no_custo,
            ),
          }),
        );
      } catch {
        // Ignora falha do localStorage
      }
    }

    /*
     * =========================================================
     * RECEITA BASE DA MASSA
     * =========================================================
     */

    if (doughRows.length) {
      const values: Dough = {
        flour: 0,
        water: 0,
        yeast: 0,
        salt: 0,
        oil: 0,
        yield: Number(
          doughRows[0].rendimento_pizzas ?? 5,
        ),
      };

      doughRows.forEach((row) => {
        const ingredientName =
          String(row.ingrediente_nome ?? "")
            .toLowerCase();

        if (ingredientName.includes("farinha")) {
          values.flour = Number(
            row.quantidade_g ?? 0,
          );
        }

        if (
          ingredientName.includes("água") ||
          ingredientName.includes("agua")
        ) {
          values.water = Number(
            row.quantidade_g ?? 0,
          );
        }

        if (
          ingredientName.includes("fermento")
        ) {
          values.yeast = Number(
            row.quantidade_g ?? 0,
          );
        }

        if (ingredientName.includes("sal")) {
          values.salt = Number(
            row.quantidade_g ?? 0,
          );
        }

        if (
          ingredientName.includes("óleo") ||
          ingredientName.includes("oleo")
        ) {
          values.oil = Number(
            row.quantidade_g ?? 0,
          );
        }
      });

      setDough(values);
    }

    /*
     * =========================================================
     * FICHAS / PIZZAS
     * =========================================================
     */

    const names = [
      ...new Set([
        ...pricingRows.map(
          (row) => row.pizza_nome,
        ),
        ...recipeRows.map(
          (row) => row.pizza_nome,
        ),
      ]),
    ];

    const loadedPizzas: Pizza[] = names.map(
      (name, index) => {
        const pricing = pricingRows.find(
          (row) =>
            row.pizza_nome === name,
        );

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
                  candidate.ingrediente_nome ===
                    row.ingrediente_nome &&
                  Number(
                    candidate.quantidade,
                  ) ===
                    Number(row.quantidade) &&
                  candidate.tipo === row.tipo &&
                  candidate.ordem === row.ordem,
              ) === rowIndex,
          )
          .map((row, lineIndex) => ({
            id: lineIndex + 1,
            dbId: row.id,
            ingredient:
              row.ingrediente_nome,
            ingredientId:
              row.ingrediente_id ??
              undefined,
            quantity: Number(
              row.quantidade ?? 0,
            ),
            type: row.tipo,
          }));

        return {
          id: index + 1,
          dbId: pricing?.id,
          name,
          lines,

          salePrice: Number(
            pricing?.preco_venda ?? 0,
          ),

          category:
            pricing?.categoria === "massa"
              ? "massa"
              : "pizza",

          doughSize:
            pricing?.tamanho_massa ===
            "grande"
              ? "grande"
              : "broto",

          doughRecipe:
            pricing?.massa_utilizada ?? "",

          massYield: Number(
            pricing?.rendimento_massa ?? 5,
          ),

          competitors: [
            pricing?.concorrente_massa_arretada ==
            null
              ? null
              : Number(
                  pricing.concorrente_massa_arretada,
                ),

            pricing?.concorrente_dantas ==
            null
              ? null
              : Number(
                  pricing.concorrente_dantas,
                ),

            pricing?.concorrente_farini ==
            null
              ? null
              : Number(
                  pricing.concorrente_farini,
                ),
          ],
        };
      },
    );

    setPizzas(loadedPizzas);

    /*
     * =========================================================
     * ITENS DO CARDÁPIO
     * =========================================================
     */

    const loadedMenuItems: MenuItem[] =
      menuRows.map((row, index) => ({
        id: index + 1,
        dbId: row.id,

        nome_comercial:
          row.nome_comercial ?? "",

        ficha_tecnica_ref:
          row.ficha_tecnica_ref ?? "",

        descricao:
          row.descricao ?? "",

        categoria:
          row.categoria as MenuCategory,

        tamanho:
          row.tamanho ?? "",

        imagem_url:
          row.imagem_url ?? "",

        preco_venda: Number(
          row.preco_venda ?? 0,
        ),

        disponivel:
          Boolean(row.disponivel),

        destaque:
          Boolean(row.destaque),

        ordem_exibicao: Number(
          row.ordem_exibicao ?? index + 1,
        ),

        observacoes_internas:
          row.observacoes_internas ?? "",
      }));

    setMenuItems(loadedMenuItems);
  };

  void loadCardapioData();

  return () => {
    mounted = false;
  };
}, [supabase]);

  const unitPrice = (item?: Ingredient) =>
    item && item.pack > 0 ? item.price / item.pack : 0;
  
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
  const gasCost =
    gas.pizzas > 0
      ? ((gas.minutes / 60) * gas.consumption * (gas.price / gas.weight)) /
        gas.pizzas
      : 0;

  const boxCost = ingredients
    .filter((ingredient) => ingredient.category === "embalagem")
    .reduce((total, ingredient) => total + unitPrice(ingredient), 0);
  const totalCost = (pizza: Pizza) => {
    const selectedDough = doughRecipes.find(
      (recipe) => recipe.name === pizza.doughRecipe,
    );
    const recipeDoughCost = (recipe: Pizza) =>
      recipe.lines.reduce((total, line) => total + ingredientCost(line), 0) /
      Math.max(recipe.massYield, 1);
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


  const selectedRecipe = pizzas.find(
    (pizza) => pizza.name === draft.ficha_tecnica_ref,
  );
  const previewCost = selectedRecipe ? totalCost(selectedRecipe) : 0;
  const previewPrice = Number(
    draft.preco_venda || selectedRecipe?.salePrice || 0,
  );

  const previewMargin = previewPrice - previewCost;

  const previewPercent = previewPrice > 0 ? previewMargin / previewPrice : 0;

  const filteredItems = [...menuItems]
    .sort(
      (left, right) => (left.ordem_exibicao ?? 0) - (right.ordem_exibicao ?? 0),
    )
    .filter((item) => {
      const categoryMatches =
        categoryFilter === "Todos" || item.categoria === categoryFilter;

      const statusMatches =
        statusFilter === "Todos" ||
        (statusFilter === "Disponível" && item.disponivel) ||
        (statusFilter === "Indisponível" && !item.disponivel);

      const term = searchTerm.trim().toLocaleLowerCase();

      const textMatches =
        !term ||
        `${item.nome_comercial} ${item.descricao} ${item.ficha_tecnica_ref}`
          .toLocaleLowerCase()
          .includes(term);

      return categoryMatches && statusMatches && textMatches;
    });

  const openNewItem = () => {
    setDraft({
      id: Date.now(),
      dbId: undefined,
      nome_comercial: "",
      ficha_tecnica_ref: "",
      descricao: "",
      categoria: "Pizza",
      tamanho: "",
      imagem_url: "",
      preco_venda: "0",
      disponivel: true,
      destaque: false,
      ordem_exibicao: String(menuItems.length + 1),
      observacoes_internas: "",
    });

    setModalOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setDraft({
      id: item.id,
      dbId: item.dbId,
      nome_comercial: item.nome_comercial,
      ficha_tecnica_ref: item.ficha_tecnica_ref,
      descricao: item.descricao,
      categoria: item.categoria,
      tamanho: item.tamanho,
      imagem_url: item.imagem_url,
      preco_venda: String(item.preco_venda ?? 0),
      disponivel: item.disponivel,
      destaque: item.destaque,
      ordem_exibicao: String(item.ordem_exibicao || 1),
      observacoes_internas: item.observacoes_internas,
    });

    setModalOpen(true);
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || !supabase) {
      if (file) {
        setDraft((current) => ({
          ...current,
          imagem_url: URL.createObjectURL(file),
        }));
      }

      return;
    }

    const fileName = `cardapio/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    const { error } = await supabase.storage
      .from("cardapio")
      .upload(fileName, file, {
        upsert: true,
      });

    if (error) {
      console.error("Falha ao enviar imagem do cardápio:", error);

      setDraft((current) => ({
        ...current,
        imagem_url: URL.createObjectURL(file),
      }));

      return;
    }

    const { data } = supabase.storage.from("cardapio").getPublicUrl(fileName);

    setDraft((current) => ({
      ...current,
      imagem_url: data.publicUrl,
    }));
  };

  const submitItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nomeComercial = draft.nome_comercial.trim();

    const fichaRef = draft.ficha_tecnica_ref.trim();

    if (!nomeComercial || !fichaRef) return;

    const nextItem: MenuItem = {
      id: draft.id,
      dbId: draft.dbId,
      nome_comercial: nomeComercial,
      ficha_tecnica_ref: fichaRef,
      descricao: draft.descricao.trim(),
      categoria: draft.categoria,
      tamanho: draft.tamanho.trim(),
      imagem_url: draft.imagem_url,
      preco_venda: Number(draft.preco_venda || 0),
      disponivel: draft.disponivel,
      destaque: draft.destaque,
      ordem_exibicao: Number(draft.ordem_exibicao || 1),
      observacoes_internas: draft.observacoes_internas.trim(),
    };

    await saveMenuItem(nextItem);

    setModalOpen(false);

    setDraft({
      id: Date.now(),
      dbId: undefined,
      nome_comercial: "",
      ficha_tecnica_ref: "",
      descricao: "",
      categoria: "Pizza",
      tamanho: "",
      imagem_url: "",
      preco_venda: "0",
      disponivel: true,
      destaque: false,
      ordem_exibicao: String(items.length + 1),
      observacoes_internas: "",
    });
  };

  const reorderItem = async (item: MenuItem, direction: -1 | 1) => {
    const ordered = [...menuItems].sort(
      (left, right) => (left.ordem_exibicao ?? 0) - (right.ordem_exibicao ?? 0),
    );

    const index = ordered.findIndex((current) => current.id === item.id);

    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const target = ordered[targetIndex];

    const nextItem = {
      ...item,
      ordem_exibicao: target.ordem_exibicao,
    };

    const nextTarget = {
      ...target,
      ordem_exibicao: item.ordem_exibicao,
    };

    await saveMenuItem(nextItem);
    await saveMenuItem(nextTarget);
  };
  const flashSaved = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const saveMenuItemToSupabase = async (item: MenuItem) => {
    if (!supabase) return item.dbId;
    const payload = {
      nome_comercial: item.nome_comercial,
      ficha_tecnica_ref: item.ficha_tecnica_ref,
      descricao: item.descricao || null,
      categoria: item.categoria,
      tamanho: item.tamanho || null,
      imagem_url: item.imagem_url || null,
      preco_venda: item.preco_venda,
      disponivel: item.disponivel,
      destaque: item.destaque,
      ordem_exibicao: item.ordem_exibicao,
      observacoes_internas: item.observacoes_internas || null,
    };
    if (item.dbId) {
      const { error } = await supabase
        .from("cardapio_itens")
        .update(payload)
        .eq("id", item.dbId);
      if (error) throw error;
      return item.dbId;
    }
    const { data, error } = await supabase
      .from("cardapio_itens")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    return data?.id as string | undefined;
  };

  const saveMenuItem = async (item: MenuItem) => {
    const dbId = await saveMenuItemToSupabase(item);
    setMenuItems((items) => {
      const existing = items.some((current) => current.id === item.id);
      if (existing) {
        return items.map((current) =>
          current.id === item.id
            ? { ...item, dbId: dbId ?? item.dbId }
            : current,
        );
      }
      return [...items, { ...item, dbId: dbId ?? item.dbId }];
    });
    flashSaved();
  };

  const deleteMenuItem = async (item: MenuItem) => {
    setMenuItems((items) => items.filter((current) => current.id !== item.id));
    if (supabase && item.dbId) {
      await supabase.from("cardapio_itens").delete().eq("id", item.dbId);
    }
    flashSaved();
  };

  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow orange">COMERCIAL</p>

          <h2>Cardápio</h2>

          <p className="section-description">
            Transforme cada ficha em item do cardápio com preço, foto e status
            de disponibilidade.
          </p>
        </div>

        <button className="primary-button" onClick={openNewItem}>
          <Plus size={16} /> Novo item
        </button>
      </div>

      <div className="table-card menu-table-card">
        <div className="table-toolbar menu-toolbar">
          <div>
            <strong>Itens do cardápio</strong>

            <span className="count-badge">{filteredItems.length} itens</span>
          </div>

          <div className="menu-filters">
            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value as "Todos" | MenuCategory)
              }
            >
              <option value="Todos">Todas as categorias</option>

              {menuCategoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "Todos" | "Disponível" | "Indisponível",
                )
              }
            >
              <option value="Todos">Todos os status</option>

              <option value="Disponível">Disponível</option>

              <option value="Indisponível">Indisponível</option>
            </select>

            <label className="table-search compact-search">
              <Search size={14} />

              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar item"
              />
            </label>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Categoria</th>
                <th>Preço</th>
                <th>Status</th>
                <th>Margem</th>
                <th aria-label="Ações" />
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => {
                const summary = getMenuMarginSummary(item, pizzas, totalCost);

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="menu-item-cell">
                        {item.imagem_url ? (
                          <img
                            src={item.imagem_url}
                            alt={item.nome_comercial}
                            className="menu-thumb"
                          />
                        ) : (
                          <div className="menu-thumb placeholder-thumb">DN</div>
                        )}

                        <div>
                          <strong>{item.nome_comercial}</strong>

                          <small>{item.ficha_tecnica_ref}</small>
                        </div>
                      </div>
                    </td>

                    <td>{item.categoria}</td>

                    <td>{money(item.preco_venda)}</td>

                    <td>
                      <span
                        className={`menu-status ${
                          item.disponivel ? "online" : "offline"
                        }`}
                      >
                        {item.disponivel ? "Disponível" : "Indisponível"}
                      </span>
                    </td>

                    <td>
                      <span className={`margin-pill ${summary.tone}`}>
                        {(summary.percentage * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </td>

                    <td>
                      <div className="row-actions compact-actions">
                        <button
                          className="row-action"
                          title="Mover para cima"
                          onClick={() => reorderItem(item, -1)}
                        >
                          <ChevronDown
                            size={14}
                            style={{
                              transform: "rotate(180deg)",
                            }}
                          />
                        </button>

                        <button
                          className="row-action"
                          title="Mover para baixo"
                          onClick={() => reorderItem(item, 1)}
                        >
                          <ChevronDown size={14} />
                        </button>

                        <button
                          className="row-action"
                          title="Editar"
                          onClick={() => openEditItem(item)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          className="row-action"
                          title="Excluir"
                          onClick={() => void deleteMenuItem(item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setModalOpen(false)}
        >
          <form
            className="ingredient-modal menu-modal"
            onSubmit={submitItem}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow orange">ITEM DO CARDÁPIO</p>

                <h3>{draft.dbId ? "Editar item" : "Novo item"}</h3>
              </div>

              <button
                className="modal-close"
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="menu-form-grid">
              <label className="form-field form-field-wide">
                Nome comercial
                <input
                  required
                  value={draft.nome_comercial}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      nome_comercial: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Pizza Calabresa Especial"
                />
              </label>

              <label className="form-field">
                Ficha técnica vinculada
                <select
                  required
                  value={draft.ficha_tecnica_ref}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ficha_tecnica_ref: event.target.value,
                    }))
                  }
                >
                  <option value="">Selecione uma ficha</option>

                  {pizzas.map((pizza) => (
                    <option key={pizza.id} value={pizza.name}>
                      {pizza.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                Categoria
                <select
                  value={draft.categoria}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      categoria: event.target.value as MenuCategory,
                    }))
                  }
                >
                  {menuCategoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                Tamanho
                <input
                  value={draft.tamanho}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      tamanho: event.target.value,
                    }))
                  }
                  placeholder="Ex.: 35 cm"
                />
              </label>

              <label className="form-field">
                Preço de venda
                <div className="modal-price-input">
                  <span>R$</span>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={draft.preco_venda}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        preco_venda: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>

              <label className="form-field">
                Ordem de exibição
                <input
                  type="number"
                  min="1"
                  value={draft.ordem_exibicao}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ordem_exibicao: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-field form-field-wide">
                Descrição
                <textarea
                  value={draft.descricao}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      descricao: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Descreva o produto para o cliente"
                />
              </label>

              <label className="form-field form-field-wide">
                Observações internas
                <textarea
                  value={draft.observacoes_internas}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      observacoes_internas: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Opcional"
                />
              </label>

              <div className="menu-image-panel form-field-wide">
                <div className="menu-image-box">
                  {draft.imagem_url ? (
                    <img
                      src={draft.imagem_url}
                      alt="Pré-visualização do item"
                    />
                  ) : (
                    <div className="placeholder-thumb large">DN</div>
                  )}
                </div>

                <div className="menu-image-actions">
                  <label className="primary-button upload-button">
                    <Plus size={14} />
                    Upload de imagem
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>

                  <span className="helper-copy">
                    ou cole a URL em um campo futuro.
                  </span>
                </div>
              </div>

              <div className="menu-preview panel-block form-field-wide">
                <strong>Preview da ficha vinculada</strong>

                {selectedRecipe ? (
                  <>
                    <div className="preview-row">
                      <span>Custo estimado</span>

                      <strong>{money(previewCost)}</strong>
                    </div>

                    <div className="preview-row">
                      <span>Preço sugerido</span>

                      <strong>{money(selectedRecipe.salePrice)}</strong>
                    </div>

                    <div className="preview-row">
                      <span>Margem atual</span>

                      <strong>{money(previewMargin)}</strong>
                    </div>

                    <div className="preview-row">
                      <span>Margem %</span>

                      <span
                        className={`margin-pill ${getMarginTone(
                          previewPercent,
                        )}`}
                      >
                        {(previewPercent * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                  </>
                ) : (
                  <p>Selecione uma ficha para visualizar custo e margem.</p>
                )}
              </div>

              <div className="menu-toggle-row form-field-wide">
                <label className="toggle-label compact-toggle">
                  <input
                    type="checkbox"
                    checked={draft.disponivel}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        disponivel: event.target.checked,
                      }))
                    }
                  />
                  <span className="toggle" />
                  Disponível no cardápio
                </label>

                <label className="toggle-label compact-toggle">
                  <input
                    type="checkbox"
                    checked={draft.destaque}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        destaque: event.target.checked,
                      }))
                    }
                  />
                  <span className="toggle" />
                  Destaque
                </label>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>

              <button className="primary-button" type="submit">
                <Save size={16} />
                Salvar item
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
