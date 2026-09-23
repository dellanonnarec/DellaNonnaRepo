import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Columns3,
  LogOut,
  Settings2,
  TrendingUp,
  Utensils,
} from "lucide-react";
import Pedido from "./pages/Pedido/Pedido";
import AdminPedidos from "./pages/Pedidos/AdminPedidosPage";
import AdminPedidosKanban from "./pages/Pedidos/AdminPedidosKanbanPage";
import { publicSupabase } from "./lib/supabase";
import "./App.css";
import AuthLogin from "./pages/auth/AuthLogin";
import Insumos from "./pages/insumos/Insumos";
import Receitas from "./pages/Receitas/Receitas";
import Precificacao from "./pages/Precificacao/Precificacao";
import Cardapio from "./pages/Cardapio/Cardapio";

const supabase = publicSupabase;

function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "/";
  const isPublicOrderRoute = pathname === "/pedido";
  const isOrdersRoute = pathname === "/admin/pedidos";
  const isKanbanRoute = pathname === "/admin/pedidos/kanban";
  const [session, setSession] = useState(false);
  const [authReady, setAuthReady] = useState(!supabase);
  const [activeSection, setActiveSection] = useState<
    "insumos" | "fichas" | "precificacao" | "cardapio" | "pedidos" | "kanban"
  >("insumos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [databaseError, setDatabaseError] = useState("");
  const [hydrated, setHydrated] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(Boolean(data.session));
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(Boolean(nextSession));
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const route = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const page = route[1] || route[0];
    if (page === "cardapio") setActiveSection("cardapio");
    if (page === "precificacao") setActiveSection("precificacao");
    if (page === "fichas") setActiveSection("fichas");
    if (page === "insumos" || page === "admin") setActiveSection("insumos");
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    setHydrated(false);
    let mounted = true;
    const hydrate = async () => {
      const [ingredientsResponse, assumptionsResponse, recipesResponse, pricingResponse, doughResponse, gasResponse, menuItemsResponse] = await Promise.all([
        supabase.from("insumos").select("*").order("created_at"),
        supabase.from("premissas_conversao").select("*"),
        supabase.from("fichas_tecnicas").select("*").order("ordem"),
        supabase.from("precificacao").select("*").order("pizza_nome"),
        supabase.from("receita_massa").select("*").order("ingrediente_nome"),
        supabase.from("gas").select("*").eq("id", true).maybeSingle(),
        supabase.from("cardapio_itens").select("*").order("ordem_exibicao"),
      ]);
      if (!mounted) return;
      const failedResponse = [ingredientsResponse, assumptionsResponse, recipesResponse, pricingResponse, doughResponse, gasResponse, menuItemsResponse].find((response) => response.error);
      if (failedResponse?.error) {
        console.error("Falha ao carregar dados do Supabase:", failedResponse.error);
        setDatabaseError(`Não foi possível carregar os dados: ${failedResponse.error.message}`);
        setHydrated(true);
        return;
      }
      setDatabaseError("");
      const ingredientRows = ingredientsResponse.data;
      const assumptionRows = assumptionsResponse.data;
      const recipeRows = recipesResponse.data;
      const pricingRows = pricingResponse.data;
      const doughRows = doughResponse.data;
      const gasRows = gasResponse.data;
      const menuRows = menuItemsResponse.data;
      if (menuRows?.length) {
        setMenuItems(
          menuRows.map((row, index) => ({
            id: index + 1,
            dbId: row.id,
            nome_comercial: row.nome_comercial,
            ficha_tecnica_ref: row.ficha_tecnica_ref,
            descricao: row.descricao ?? "",
            categoria: row.categoria ?? "Outro",
            tamanho: row.tamanho ?? "",
            imagem_url: row.imagem_url ?? "",
            preco_venda: Number(row.preco_venda ?? 0),
            disponivel: row.disponivel ?? true,
            destaque: Boolean(row.destaque),
            ordem_exibicao: Number(row.ordem_exibicao ?? index + 1),
            observacoes_internas: row.observacoes_internas ?? "",
            created_at: row.created_at,
            updated_at: row.updated_at,
          })),
        );
      }
      if (ingredientRows?.length) {
        const uniqueIngredients = new Map<string, (typeof ingredientRows)[number]>();
        ingredientRows.forEach((row) => {
          const key = `${normalizeName(row.nome)}::${row.categoria}`;
          const current = uniqueIngredients.get(key);
          if (!current || Number(row.preco_pago) > Number(current.preco_pago) || row.updated_at > current.updated_at) {
            uniqueIngredients.set(key, row);
          }
        });
        setIngredients(
          [...uniqueIngredients.values()].map((row, index) => ({
            id: index + 1,
            dbId: row.id,
            name: row.nome,
            brand: row.marca_obs ?? "",
            pack: Number(row.qtd_embalagem),
            unit: row.unidade,
            price: Number(row.preco_pago),
            category: row.categoria,
          })),
        );
      }
      if (assumptionRows?.length)
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
      if (gasRows) {
        setGas({
          price: Number(gasRows.preco_botijao),
          weight: Number(gasRows.peso_botijao_kg),
          consumption: Number(gasRows.consumo_kg_hora),
          minutes: Number(gasRows.tempo_turno_min),
          pizzas: Number(gasRows.pizzas_por_turno),
        });
        setGasIncluded(Boolean(gasRows.incluir_no_custo));
      }
      if (doughRows?.length) {
        const values: Dough = {
          flour: 0,
          water: 0,
          yeast: 0,
          salt: 0,
          oil: 0,
          yield: Number(doughRows[0].rendimento_pizzas),
        };
        doughRows.forEach((row) => {
          const key = row.ingrediente_nome.toLowerCase();
          if (key.includes("farinha")) values.flour = Number(row.quantidade_g);
          if (key.includes("água") || key.includes("agua"))
            values.water = Number(row.quantidade_g);
          if (key.includes("fermento")) values.yeast = Number(row.quantidade_g);
          if (key.includes("sal")) values.salt = Number(row.quantidade_g);
          if (key.includes("óleo") || key.includes("oleo"))
            values.oil = Number(row.quantidade_g);
        });
        setDough(values);
      }
      if (pricingRows?.length || recipeRows?.length) {
        const names = [
          ...new Set([
            ...(pricingRows ?? []).map((row) => row.pizza_nome),
            ...(recipeRows ?? []).map((row) => row.pizza_nome),
          ]),
        ];
        setPizzas(
          names.map((name, index) => {
            const pricing = pricingRows?.find((row) => row.pizza_nome === name);
            return {
              id: index + 1,
              dbId: pricing?.id,
              name,
              category: pricing?.categoria === "massa" ? "massa" : "pizza",
              doughSize: pricing?.tamanho_massa === "grande" ? "grande" : "broto",
              doughRecipe: pricing?.massa_utilizada ?? "",
              massYield: Number(pricing?.rendimento_massa ?? 5),
              lines: (recipeRows ?? [])
                .filter((row) =>
                  pricing?.id && row.pizza_id
                    ? row.pizza_id === pricing.id
                    : row.pizza_nome === name,
                )
                .filter((row, rowIndex, rows) =>
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
                  quantity: Number(row.quantidade),
                  type: row.tipo,
                })),
              salePrice: Number(pricing?.preco_venda ?? 0),
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
      }
      setHydrated(true);
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, [session]);



  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(false);
  };
  if (isPublicOrderRoute) return <Pedido />;
  if (!authReady)
    return <main className="login-page"><div className="login-card"><p>Restaurando sessão...</p></div></main>;
  if (!session)
    return <AuthLogin/>;
  if (isOrdersRoute) return <AdminPedidos />;
  if (isKanbanRoute) return <AdminPedidosKanban />;
  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <aside className="sidebar">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
        >
          <ChevronDown size={16} />
        </button>
        <div className="logo-lockup">
          <div className="brand-mark small">
            <span>DN</span>
          </div>
          <div>
            <strong>DELLA NONNA</strong>
            <span>PIZZARIA</span>
          </div>
        </div>
        <div className="sidebar-label">OPERAÇÃO</div>
        <nav>
          {(
            [
              ["insumos", "Insumos", Settings2],
              ["fichas", "Fichas técnicas", Utensils],
              ["precificacao", "Precificação", TrendingUp],
              ["cardapio", "Cardápio", Settings2],
              ["pedidos", "Pedidos", ClipboardList],
              ["kanban", "Kanban", Columns3],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={activeSection === id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setActiveSection(id);
                if (typeof window !== "undefined") {
                  const path = id === "insumos"
                    ? "/admin"
                    : id === "pedidos"
                      ? "/admin/pedidos"
                      : id === "kanban"
                        ? "/admin/pedidos/kanban"
                        : `/admin/${id}`;
                  if (id === "pedidos" || id === "kanban") {
                    window.location.assign(path);
                  } else {
                    window.history.pushState({}, "", path);
                  }
                }
              }}
            >
              <Icon size={17} />
              {label}
              {id === "precificacao" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-state">
            <span className="live-dot" />
            <div>
              <strong>
                {supabase ? "Dados sincronizados" : "Modo demonstração"}
              </strong>
              <small>
                {supabase
                  ? "Supabase conectado"
                  : "Configure o Supabase para persistir"}
              </small>
            </div>
          </div>
          <button className="user-row" onClick={logout}>
            <span className="avatar">AD</span>
            <span>
              <strong>Admin</strong>
              <small>Administrador</small>
            </span>
            <LogOut size={15} />
          </button>
        </div>
      </aside>
      <main className="content">
        {databaseError && (
          <div className="database-error" role="alert">
            {databaseError} Aplique todas as migrations do Supabase e recarregue a página.
          </div>
        )}
        <header className="topbar">
          <div>
            <p className="breadcrumb">
              DASHBOARD <span>/</span>{" "}
              {activeSection === "insumos"
                ? "INSUMOS"
                : activeSection === "fichas"
                  ? "FICHAS TÉCNICAS"
                  : activeSection === "cardapio"
                    ? "CARDÁPIO"
                    : "PRECIFICAÇÃO"}
            </p>
            <h1>
              {activeSection === "insumos"
                ? "Insumos e embalagens"
                : activeSection === "fichas"
                  ? "Fichas técnicas"
                  : activeSection === "cardapio"
                    ? "Cardápio"
                    : "Precificação"}
            </h1>
          </div>
          <div className="top-actions">
            <div className="last-saved">
              {saved ? (
                <>
                  <Check size={14} /> Salvo agora
                </>
              ) : (
                "Última atualização hoje, 09:42"
              )}
            </div>
            <button className="icon-button" title="Ajuda">
              <CircleHelp size={18} />
            </button>
            <button className="user-pill" onClick={logout}>
              <span className="avatar">AD</span> Admin <ChevronDown size={14} />
            </button>
          </div>
        </header>
        {activeSection === "insumos" && (
          <Insumos
          />
        )}{" "}
        {activeSection === "fichas" && (
          <Receitas
          />
        )}{" "}
        {activeSection === "precificacao" && (
          <Precificacao/>
        )}
        {activeSection === "cardapio" && (
          <Cardapio/>
        )}
      </main>
    </div>
  );
}





export default App;
