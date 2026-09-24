import { FormEvent, useMemo, useState, useEffect, useRef } from "react";
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

type MenuCategory = string;
type MenuCategoryRow = { id: string; nome: string; ordem: number; ativa: boolean };
type MenuOrigin = "receita" | "insumo";

type MenuItem = {
  id: number;
  dbId?: string;
  nome_comercial: string;
  ficha_tecnica_ref: string;
  descricao: string;
  categoria: MenuCategory;
  categoria_id: string;
  origem_tipo: MenuOrigin;
  receita_id: string | null;
  insumo_id: string | null;
  quantidade_origem: number;
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
const gasStorageKey = "della-nonna-gas";

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
  item: Pick<MenuItem, "ficha_tecnica_ref" | "preco_venda" | "origem_tipo" | "receita_id" | "insumo_id" | "quantidade_origem">,
  pizzas: Pizza[],
  ingredients: Ingredient[],
  totalCost: (pizza: Pizza) => number,
) => {
  const recipe = pizzas.find((pizza) => pizza.dbId === item.receita_id);
  const sourceIngredient = ingredients.find((ingredient) => ingredient.dbId === item.insumo_id);
  const cost = item.origem_tipo === "insumo"
    ? sourceIngredient && sourceIngredient.pack > 0
      ? (item.quantidade_origem * sourceIngredient.price) / sourceIngredient.pack
      : 0
    : recipe ? totalCost(recipe) : 0;
  const salePrice = Number(item.preco_venda ?? 0);
  const margin = salePrice - cost;
  const percentage = salePrice > 0 ? margin / salePrice : 0;
  return { cost, margin, percentage, tone: getMarginTone(percentage) };
};

///////////////////////////////////////////////////////////////
export default function Cardapio() {
  const supabase = publicSupabase;
  const [categoryFilter, setCategoryFilter] = useState<string>(
    "Todos",
  );

  const [statusFilter, setStatusFilter] = useState<
    "Todos" | "Disponível" | "Indisponível"
  >("Todos");
  const [pizzas, setPizzas] = useState(initialPizzas);
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const doughRecipes = useMemo(
    () => pizzas.filter((recipe) => recipe.category === "massa"),
    [pizzas],
  );
  const [draft, setDraft] = useState({
    id: Date.now(),
    dbId: undefined as string | undefined,
    nome_comercial: "",
    ficha_tecnica_ref: "",
    descricao: "",
    categoria: "Pizza" as MenuCategory,
    categoria_id: "",
    origem_tipo: "receita" as MenuOrigin,
    receita_id: "",
    insumo_id: "",
    quantidade_origem: "1",
    tamanho: "",
    imagem_url: "",
    preco_venda: "0",
    disponivel: true,
    destaque: false,
    ordem_exibicao: "1",
    observacoes_internas: "",
  });
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategoryRow[]>([]);
  const [categoryNameDraft, setCategoryNameDraft] = useState("");
  const [gas, setGas] = useState<Gas>(() => readStoredGas()?.gas ?? defaultGas);
  const [gasIncluded, setGasIncluded] = useState<boolean>(
    () => readStoredGas()?.gasIncluded ?? false,
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
        categoriesResponse,
        ingredientsResponse,
        assumptionsResponse,
        recipesResponse,
        pricingResponse,
        gasResponse,
        doughResponse,
      ] = await Promise.all([
        supabase.from("cardapio_itens").select("*").order("ordem_exibicao"),

        supabase.from("categorias_cardapio").select("*").order("ordem"),

        supabase.from("insumos").select("*").order("created_at"),

        supabase.from("premissas_conversao").select("*"),

        supabase.from("fichas_tecnicas").select("*").order("ordem"),

        supabase.from("precificacao").select("*").order("pizza_nome"),

        supabase.from("gas").select("*").eq("id", true).maybeSingle(),

        supabase.from("receita_massa").select("*").order("ingrediente_nome"),
      ]);

      if (!mounted) return;

      const failedResponse = [
        menuResponse,
        categoriesResponse,
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
      const categoryRows = categoriesResponse.data ?? [];
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
      setMenuCategories(categoryRows.map((row) => ({
        id: row.id,
        nome: row.nome,
        ordem: Number(row.ordem ?? 1),
        ativa: Boolean(row.ativa),
      })));

      /*
       * =========================================================
       * PREMISSAS DE CONVERSÃO
       * =========================================================
       */

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
        setGasIncluded(Boolean(gasRow.incluir_no_custo));

        try {
          window.localStorage.setItem(
            gasStorageKey,
            JSON.stringify({
              gas: loadedGas,
              gasIncluded: Boolean(gasRow.incluir_no_custo),
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
          yield: Number(doughRows[0].rendimento_pizzas ?? 5),
        };

        doughRows.forEach((row) => {
          const ingredientName = String(
            row.ingrediente_nome ?? "",
          ).toLowerCase();

          if (ingredientName.includes("farinha")) {
            values.flour = Number(row.quantidade_g ?? 0);
          }

          if (
            ingredientName.includes("água") ||
            ingredientName.includes("agua")
          ) {
            values.water = Number(row.quantidade_g ?? 0);
          }

          if (ingredientName.includes("fermento")) {
            values.yeast = Number(row.quantidade_g ?? 0);
          }

          if (ingredientName.includes("sal")) {
            values.salt = Number(row.quantidade_g ?? 0);
          }

          if (
            ingredientName.includes("óleo") ||
            ingredientName.includes("oleo")
          ) {
            values.oil = Number(row.quantidade_g ?? 0);
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

      /*
       * =========================================================
       * ITENS DO CARDÁPIO
       * =========================================================
       */

      const loadedMenuItems: MenuItem[] = menuRows.map((row, index) => ({
        id: index + 1,
        dbId: row.id,

        nome_comercial: row.nome_comercial ?? "",

        ficha_tecnica_ref: loadedPizzas.find((pizza) => pizza.dbId === row.receita_id)?.name ?? loadedIngredients.find((ingredient) => ingredient.dbId === row.insumo_id)?.name ?? "",

        descricao: row.descricao ?? "",

        categoria: categoryRows.find((category) => category.id === row.categoria_id)?.nome ?? row.categoria ?? "",
        categoria_id: row.categoria_id,
        origem_tipo: row.origem_tipo,
        receita_id: row.receita_id ?? null,
        insumo_id: row.insumo_id ?? null,
        quantidade_origem: Number(row.quantidade_origem ?? 1),

        tamanho: row.tamanho ?? "",

        imagem_url: row.imagem_url ?? "",

        preco_venda: Number(row.preco_venda ?? 0),

        disponivel: Boolean(row.disponivel),

        destaque: Boolean(row.destaque),

        ordem_exibicao: Number(row.ordem_exibicao ?? index + 1),

        observacoes_internas: row.observacoes_internas ?? "",
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

  const selectedRecipe = pizzas.find((pizza) => pizza.dbId === draft.receita_id);
  const selectedIngredient = ingredients.find((ingredient) => ingredient.dbId === draft.insumo_id);
  const previewCost = draft.origem_tipo === "insumo"
    ? selectedIngredient && selectedIngredient.pack > 0
      ? Number(draft.quantidade_origem || 0) * selectedIngredient.price / selectedIngredient.pack
      : 0
    : selectedRecipe ? totalCost(selectedRecipe) : 0;
  const previewPrice = Number(draft.preco_venda || selectedRecipe?.salePrice || 0);
  const previewMargin = previewPrice - previewCost;
  const previewPercent = previewPrice > 0 ? previewMargin / previewPrice : 0;

  const filteredItems = [...menuItems]
    .sort(
      (left, right) => (left.ordem_exibicao ?? 0) - (right.ordem_exibicao ?? 0),
    )
    .filter((item) => {
      const categoryMatches =
        categoryFilter === "Todos" || item.categoria_id === categoryFilter;

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

  const createCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nome = categoryNameDraft.trim();
    if (!nome || !supabase) return;
    const { data, error } = await supabase
      .from("categorias_cardapio")
      .insert({ nome, ordem: menuCategories.length + 1, ativa: true })
      .select("id, nome, ordem, ativa")
      .single();
    if (error) {
      console.error("Falha ao criar categoria:", error);
      return;
    }
    setMenuCategories((items) => [...items, data as MenuCategoryRow]);
    setCategoryNameDraft("");
  };

  const updateCategory = async (category: MenuCategoryRow, patch: Partial<MenuCategoryRow>) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("categorias_cardapio")
      .update(patch)
      .eq("id", category.id);
    if (error) {
      console.error("Falha ao atualizar categoria:", error);
      return;
    }
    setMenuCategories((items) => items.map((item) => item.id === category.id ? { ...item, ...patch } : item));
  };

  const moveCategory = async (category: MenuCategoryRow, direction: -1 | 1) => {
    const ordered = [...menuCategories].sort((a, b) => a.ordem - b.ordem);
    const index = ordered.findIndex((item) => item.id === category.id);
    const target = ordered[index + direction];
    if (!target) return;
    await updateCategory(category, { ordem: target.ordem });
    await updateCategory(target, { ordem: category.ordem });
  };

  const removeCategory = async (category: MenuCategoryRow) => {
    if (!supabase) return;
    const { error } = await supabase.from("categorias_cardapio").delete().eq("id", category.id);
    if (error) {
      console.error("A categoria pode estar em uso e não pôde ser removida:", error);
      return;
    }
    setMenuCategories((items) => items.filter((item) => item.id !== category.id));
  };

  const openNewItem = () => {
    setDraft({
      id: Date.now(),
      dbId: undefined,
      nome_comercial: "",
      ficha_tecnica_ref: "",
      descricao: "",
      categoria: menuCategories.find((category) => category.ativa)?.nome ?? "",
      categoria_id: menuCategories.find((category) => category.ativa)?.id ?? "",
      origem_tipo: "receita",
      receita_id: "",
      insumo_id: "",
      quantidade_origem: "1",
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
      categoria_id: item.categoria_id,
      origem_tipo: item.origem_tipo,
      receita_id: item.receita_id ?? "",
      insumo_id: item.insumo_id ?? "",
      quantidade_origem: String(item.quantidade_origem ?? 1),
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

    const hasOrigin = draft.origem_tipo === "receita" ? Boolean(draft.receita_id) : Boolean(draft.insumo_id);
    if (!nomeComercial || !draft.categoria_id || !hasOrigin) return;

    const nextItem: MenuItem = {
      id: draft.id,
      dbId: draft.dbId,
      nome_comercial: nomeComercial,
      ficha_tecnica_ref: selectedRecipe?.name ?? "",
      descricao: draft.descricao.trim(),
      categoria: menuCategories.find((category) => category.id === draft.categoria_id)?.nome ?? draft.categoria,
      categoria_id: draft.categoria_id,
      origem_tipo: draft.origem_tipo,
      receita_id: draft.origem_tipo === "receita" ? draft.receita_id || null : null,
      insumo_id: draft.origem_tipo === "insumo" ? draft.insumo_id || null : null,
      quantidade_origem: Number(draft.quantidade_origem || 1),
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
      categoria: menuCategories.find((category) => category.ativa)?.nome ?? "",
      categoria_id: menuCategories.find((category) => category.ativa)?.id ?? "",
      origem_tipo: "receita",
      receita_id: "",
      insumo_id: "",
      quantidade_origem: "1",
      tamanho: "",
      imagem_url: "",
      preco_venda: "0",
      disponivel: true,
      destaque: false,
      ordem_exibicao: String(menuItems.length + 1),
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
    if (savedTimerRef.current !== null) {
      window.clearTimeout(savedTimerRef.current);
    }
    savedTimerRef.current = window.setTimeout(() => {
      setSaved(false);
      savedTimerRef.current = null;
    }, 1200);
  };

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) {
        window.clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  const saveMenuItemToSupabase = async (item: MenuItem) => {
    if (!supabase) return item.dbId;
    const payload = {
      nome_comercial: item.nome_comercial,
      categoria_id: item.categoria_id,
      origem_tipo: item.origem_tipo,
      receita_id: item.receita_id,
      insumo_id: item.insumo_id,
      quantidade_origem: item.quantidade_origem,
      descricao: item.descricao || null,
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
    <section className="min-h-screen bg-[#fbf5d9] px-6 text-[#295727] sm:px-8 lg:px-11">
      <div className="mb-7 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b52327]">
            Comercial
          </p>
          <h2 className="font-serif text-3xl font-bold tracking-tight text-[#155b3b]">
            Cardápio
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#54715b]">
            Transforme cada ficha em item do cardápio com preço, foto e status
            de disponibilidade.
          </p>
        </div>

        <button
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#b51e24] px-5 text-sm font-semibold text-[#fff9df] shadow-sm transition hover:bg-[#99191e] focus:outline-none focus:ring-2 focus:ring-[#b51e24]/40 focus:ring-offset-2 focus:ring-offset-[#fbf5d9]"
          onClick={openNewItem}
        >
          <Plus size={16} />
          Novo item
        </button>
      </div>

      <details className="mb-5 rounded-lg border border-[#e5ddbd] bg-[#fffbea] p-4">
        <summary className="cursor-pointer font-serif text-sm font-bold text-[#155b3b]">Gerenciar categorias</summary>
        <form className="mt-4 flex flex-wrap gap-2" onSubmit={createCategory}>
          <input className="h-9 min-w-0 flex-1 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-xs" value={categoryNameDraft} onChange={(event) => setCategoryNameDraft(event.target.value)} placeholder="Nova categoria" maxLength={60} required />
          <button className="inline-flex h-9 items-center gap-2 rounded-md bg-[#b51e24] px-3 text-xs font-semibold text-white" type="submit"><Plus size={14} />Criar categoria</button>
        </form>
        <div className="mt-3 divide-y divide-[#eee8d4]">
          {menuCategories.map((category) => (
            <div key={category.id} className="flex flex-wrap items-center gap-2 py-2">
              <input className="h-8 min-w-0 flex-1 rounded border border-[#e4dfc9] bg-[#fffdf2] px-2 text-xs" defaultValue={category.nome} onBlur={(event) => { const nome = event.target.value.trim(); if (nome && nome !== category.nome) void updateCategory(category, { nome }); }} aria-label={`Nome da categoria ${category.nome}`} />
              <input className="h-8 w-20 rounded border border-[#e4dfc9] bg-[#fffdf2] px-2 text-xs" type="number" min="1" defaultValue={category.ordem} onBlur={(event) => { const ordem = Number(event.target.value); if (ordem > 0 && ordem !== category.ordem) void updateCategory(category, { ordem }); }} aria-label="Ordem da categoria" />
              <label className="flex items-center gap-1 text-xs text-[#54715b]"><input type="checkbox" checked={category.ativa} onChange={(event) => void updateCategory(category, { ativa: event.target.checked })} />Ativa</label>
              <button className="rounded px-2 py-1 text-xs text-[#54715b] hover:bg-[#eaf0dc]" type="button" onClick={() => void moveCategory(category, -1)} title="Mover para cima">↑</button>
              <button className="rounded px-2 py-1 text-xs text-[#54715b] hover:bg-[#eaf0dc]" type="button" onClick={() => void moveCategory(category, 1)} title="Mover para baixo">↓</button>
              <button className="rounded px-2 py-1 text-xs text-[#a43a32] hover:bg-[#f8e8df]" type="button" onClick={() => void removeCategory(category)} title="Excluir categoria">Excluir</button>
            </div>
          ))}
        </div>
      </details>

      <div className="overflow-hidden rounded-lg border border-[#e5ddbd] bg-[#fffbea] shadow-[0_2px_8px_rgba(47,69,44,0.06)]">
        <div className="flex flex-col gap-4 border-b border-[#e9e2c9] px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <strong className="font-serif text-lg font-bold text-[#155b3b]">
              Itens do cardápio
            </strong>
            <span className="rounded-full bg-[#edf0d9] px-2.5 py-1 text-[10px] font-semibold text-[#426548]">
              {filteredItems.length} itens
            </span>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <select
              className="h-9 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-xs text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(event.target.value)
              }
            >
              <option value="Todos">Todas as categorias</option>
              {menuCategories.filter((category) => category.ativa).map((category) => (
                <option key={category.id} value={category.id}>{category.nome}</option>
              ))}
            </select>

            <select
              className="h-9 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-xs text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
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

            <label className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-[#628064] sm:ml-auto sm:w-56">
              <Search size={14} className="shrink-0" />
              <input
                className="min-w-0 flex-1 bg-transparent text-xs text-[#315c40] outline-none placeholder:text-[#9b9c7f]"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar item"
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="bg-[#f5f0d9]">
              <tr>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Item
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Categoria
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Preço
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Status
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  Margem
                </th>
                <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#54715b]">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#eee8d4]">
              {filteredItems.map((item) => {
                const summary = getMenuMarginSummary(item, pizzas, ingredients, totalCost);

                const marginStyle =
                  summary.tone === "good"
                    ? "bg-[#e8f0df] text-[#34704a]"
                    : summary.tone === "warning"
                      ? "bg-[#f8efd8] text-[#a16e1f]"
                      : "bg-[#f7e5dc] text-[#ad342b]";

                return (
                  <tr key={item.id} className="transition hover:bg-[#fcf8e9]">
                    <td className="px-4 py-3">
                      <div className="flex min-w-[210px] items-center gap-3">
                        {item.imagem_url ? (
                          <img
                            src={item.imagem_url}
                            alt={item.nome_comercial}
                            className="size-11 shrink-0 rounded-md border border-[#e5ddbd] object-cover"
                          />
                        ) : (
                          <div className="grid size-11 shrink-0 place-items-center rounded-md border border-[#e5ddbd] bg-[#f3eedb] font-serif text-xs font-bold text-[#34704a]">
                            DN
                          </div>
                        )}

                        <div className="min-w-0">
                          <strong className="block truncate text-xs font-semibold text-[#315c40]">
                            {item.nome_comercial}
                          </strong>
                          <small className="mt-0.5 block truncate text-[10px] text-[#829078]">
                            {item.ficha_tecnica_ref}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[#54715b]">
                      {item.categoria}
                    </td>

                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-[#315c40]">
                      {money(item.preco_venda)}
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          item.disponivel
                            ? "bg-[#e8f0df] text-[#34704a]"
                            : "bg-[#f1eddf] text-[#817b5e]"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            item.disponivel ? "bg-[#438457]" : "bg-[#a49d76]"
                          }`}
                        />
                        {item.disponivel ? "Disponível" : "Indisponível"}
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${marginStyle}`}
                      >
                        {(summary.percentage * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </td>

                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          className="grid size-8 place-items-center rounded-md text-[#54715b] transition hover:bg-[#eaf0dc] hover:text-[#155b3b]"
                          title="Mover para cima"
                          aria-label="Mover para cima"
                          onClick={() => reorderItem(item, -1)}
                        >
                          <ChevronDown size={14} className="rotate-180" />
                        </button>

                        <button
                          className="grid size-8 place-items-center rounded-md text-[#54715b] transition hover:bg-[#eaf0dc] hover:text-[#155b3b]"
                          title="Mover para baixo"
                          aria-label="Mover para baixo"
                          onClick={() => reorderItem(item, 1)}
                        >
                          <ChevronDown size={14} />
                        </button>

                        <button
                          className="grid size-8 place-items-center rounded-md text-[#54715b] transition hover:bg-[#eaf0dc] hover:text-[#155b3b]"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => openEditItem(item)}
                        >
                          <Pencil size={14} />
                        </button>

                        <button
                          className="grid size-8 place-items-center rounded-md text-[#a43a32] transition hover:bg-[#f8e8df] hover:text-[#8f211e]"
                          title="Excluir"
                          aria-label="Excluir"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#183a28]/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={() => setModalOpen(false)}
        >
          <form
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#e5ddbd] bg-[#fffbea] shadow-2xl"
            onSubmit={submitItem}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#e9e2c9] bg-[#fffbea] px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#b52327]">
                  Item do cardápio
                </p>
                <h3 className="mt-1 font-serif text-xl font-bold text-[#155b3b]">
                  {draft.dbId ? "Editar item" : "Novo item"}
                </h3>
              </div>

              <button
                className="grid size-8 place-items-center rounded-md text-[#71826a] transition hover:bg-[#f3eedb] hover:text-[#a43a32]"
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#526d58] sm:col-span-2">
                Nome comercial
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#315c40] outline-none placeholder:text-[#a4a187] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
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

              <label className="block text-xs font-medium text-[#526d58]">
                Origem
                <select className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm" value={draft.origem_tipo} onChange={(event) => setDraft((current) => ({ ...current, origem_tipo: event.target.value as MenuOrigin, receita_id: "", insumo_id: "" }))}>
                  <option value="receita">Receita</option>
                  <option value="insumo">Insumo</option>
                </select>
              </label>

              {draft.origem_tipo === "receita" ? (
                <label className="block text-xs font-medium text-[#526d58]">
                  Receita vinculada
                  <select className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm" required value={draft.receita_id} onChange={(event) => {
                    const recipe = pizzas.find((pizza) => pizza.dbId === event.target.value);
                    setDraft((current) => ({ ...current, receita_id: event.target.value, ficha_tecnica_ref: recipe?.name ?? "" }));
                  }}>
                    <option value="">Selecione uma receita</option>
                    {pizzas.filter((pizza) => pizza.category === "pizza" && pizza.dbId).map((pizza) => <option key={pizza.dbId} value={pizza.dbId}>{pizza.name}</option>)}
                  </select>
                </label>
              ) : (
                <>
                  <label className="block text-xs font-medium text-[#526d58]">
                    Insumo vinculado
                    <select className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm" required value={draft.insumo_id} onChange={(event) => { const ingredient = ingredients.find((entry) => entry.dbId === event.target.value); setDraft((current) => ({ ...current, insumo_id: event.target.value, ficha_tecnica_ref: ingredient?.name ?? "" })); }}>
                      <option value="">Selecione um insumo</option>
                      {ingredients.filter((ingredient) => ingredient.category === "insumo" && ingredient.dbId).map((ingredient) => <option key={ingredient.dbId} value={ingredient.dbId}>{ingredient.name} · {ingredient.unit}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-[#526d58]">
                    Quantidade por item ({ingredients.find((ingredient) => ingredient.dbId === draft.insumo_id)?.unit ?? "unid"})
                    <input className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm" type="number" min="0.001" step="0.001" required value={draft.quantidade_origem} onChange={(event) => setDraft((current) => ({ ...current, quantidade_origem: event.target.value }))} />
                  </label>
                </>
              )}

              <label className="block text-xs font-medium text-[#526d58]">
                Categoria
                <select className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm" required value={draft.categoria_id} onChange={(event) => {
                  const category = menuCategories.find((entry) => entry.id === event.target.value);
                  setDraft((current) => ({ ...current, categoria_id: event.target.value, categoria: category?.nome ?? "" }));
                }}>
                  <option value="">Selecione uma categoria</option>
                  {menuCategories.filter((category) => category.ativa).map((category) => <option key={category.id} value={category.id}>{category.nome}</option>)}
                </select>
              </label>

              <label className="block text-xs font-medium text-[#526d58]">
                Tamanho
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#315c40] outline-none placeholder:text-[#a4a187] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
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

              <label className="block text-xs font-medium text-[#526d58]">
                Preço de venda
                <div className="mt-1.5 flex h-10 items-center rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#789078] focus-within:border-[#78936b] focus-within:ring-2 focus-within:ring-[#78936b]/15">
                  <span className="mr-2">R$</span>
                  <input
                    className="w-full bg-transparent text-sm text-[#315c40] outline-none"
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

              <label className="block text-xs font-medium text-[#526d58]">
                Ordem de exibição
                <input
                  className="mt-1.5 h-10 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 text-sm text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
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

              <label className="block text-xs font-medium text-[#526d58] sm:col-span-2">
                Descrição
                <textarea
                  className="mt-1.5 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 py-2 text-sm text-[#315c40] outline-none placeholder:text-[#a4a187] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
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

              <label className="block text-xs font-medium text-[#526d58] sm:col-span-2">
                Observações internas
                <textarea
                  className="mt-1.5 w-full rounded-md border border-[#e4dfc9] bg-[#fffdf2] px-3 py-2 text-sm text-[#315c40] outline-none placeholder:text-[#a4a187] focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15"
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

              <div className="flex flex-col gap-4 rounded-lg border border-[#e5ddbd] bg-[#faf6e5] p-4 sm:col-span-2 sm:flex-row sm:items-center">
                <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border border-[#e5ddbd] bg-[#f3eedb]">
                  {draft.imagem_url ? (
                    <img
                      className="h-full w-full object-cover"
                      src={draft.imagem_url}
                      alt="Pré-visualização do item"
                    />
                  ) : (
                    <div className="font-serif text-sm font-bold text-[#34704a]">
                      DN
                    </div>
                  )}
                </div>

                <div>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-[#b51e24] px-3 text-xs font-semibold text-[#fff9df] transition hover:bg-[#99191e]">
                    <Plus size={14} />
                    Upload de imagem
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </label>

                  <span className="mt-2 block text-[11px] text-[#829078]">
                    ou cole a URL em um campo futuro.
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-[#e5ddbd] bg-[#faf6e5] p-4 sm:col-span-2">
                <strong className="font-serif text-sm font-bold text-[#155b3b]">
                  Preview do produto vinculado
                </strong>

                {selectedRecipe || selectedIngredient ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#71826a]">Custo estimado</span>
                      <strong className="text-[#315c40]">
                        {money(previewCost)}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#71826a]">Preço sugerido</span>
                      <strong className="text-[#315c40]">
                        {money(selectedRecipe?.salePrice ?? Number(draft.preco_venda || 0))}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#71826a]">Margem atual</span>
                      <strong className="text-[#315c40]">
                        {money(previewMargin)}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-[#71826a]">Margem %</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          getMarginTone(previewPercent) === "good"
                            ? "bg-[#e8f0df] text-[#34704a]"
                            : getMarginTone(previewPercent) === "warning"
                              ? "bg-[#f8efd8] text-[#a16e1f]"
                              : "bg-[#f7e5dc] text-[#ad342b]"
                        }`}
                      >
                        {(previewPercent * 100).toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                        %
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#71826a]">
                    Selecione uma receita ou insumo para visualizar custo e margem.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-lg border border-[#e5ddbd] bg-[#faf6e5] p-4 sm:col-span-2 sm:flex-row sm:items-center sm:gap-6">
                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#426548]">
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    checked={draft.disponivel}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        disponivel: event.target.checked,
                      }))
                    }
                  />
                  <span className="relative h-5 w-9 rounded-full bg-[#d8d5bd] transition peer-checked:bg-[#34704a] peer-focus-visible:ring-2 peer-focus-visible:ring-[#34704a]/30 peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
                  Disponível no cardápio
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#426548]">
                  <input
                    className="peer sr-only"
                    type="checkbox"
                    checked={draft.destaque}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        destaque: event.target.checked,
                      }))
                    }
                  />
                  <span className="relative h-5 w-9 rounded-full bg-[#d8d5bd] transition peer-checked:bg-[#34704a] peer-focus-visible:ring-2 peer-focus-visible:ring-[#34704a]/30 peer-focus-visible:ring-offset-2 after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-4" />
                  Destaque
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[#e9e2c9] bg-[#faf6e5] px-5 py-4">
              <button
                className="h-10 rounded-md border border-[#ddd5b8] px-4 text-xs font-semibold text-[#54715b] transition hover:bg-[#f1ecd8]"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>

              <button
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#b51e24] px-4 text-xs font-semibold text-[#fff9df] transition hover:bg-[#99191e]"
                type="submit"
              >
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



