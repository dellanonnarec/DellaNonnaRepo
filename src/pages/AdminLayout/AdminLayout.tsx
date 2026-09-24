import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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

import { publicSupabase } from "../../lib/supabase";

import Insumos from "../insumos/Insumos";
import Receitas from "../Receitas/Receitas";
import Precificacao from "../Precificacao/Precificacao";
import Cardapio from "../Cardapio/Cardapio";

type Section =
  | "insumos"
  | "fichas"
  | "precificacao"
  | "cardapio"
  | "pedidos"
  | "kanban";

const supabase = publicSupabase;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeSection, setActiveSection] = useState<Section>("insumos");

  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  const [saved] = useState(false);

  const [databaseError] = useState("");

  useEffect(() => {
    const path = location.pathname;

    if (path === "/admin" || path === "/admin/insumos") {
      setActiveSection("insumos");
    }

    if (path === "/admin/fichas") {
      setActiveSection("fichas");
    }

    if (path === "/admin/precificacao") {
      setActiveSection("precificacao");
    }

    if (path === "/admin/cardapio") {
      setActiveSection("cardapio");
    }

    if (path === "/admin/pedidos") {
      setActiveSection("pedidos");
    }

    if (path === "/admin/pedidos/kanban") {
      setActiveSection("kanban");
    }
  }, [location.pathname]);

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }

    navigate("/");
  };

  return (
    <div className="flex bg-[#b51218]">
      <aside
        className={`relative flex h-screen shrink-0 flex-col overflow-hidden bg-[#b51218] text-[#f5e8c7] transition-[width] duration-300 ${
          sidebarExpanded ? "w-60" : "w-[76px]"
        }`}
      >
        <button
          type="button"
          aria-label={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
          aria-expanded={sidebarExpanded}
          onClick={() => setSidebarExpanded((expanded) => !expanded)}
          className="absolute right-2 top-8 z-10 grid size-8 place-items-center rounded-full border border-[#e7d7ad]/40 bg-[#f5e8c7] text-[#276b43] shadow-md transition hover:bg-white"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-300 ${
              sidebarExpanded ? "rotate-90" : "-rotate-90"
            }`}
          />
        </button>

        <div
          className={`flex h-[118px] shrink-0 items-center justify-center overflow-hidden border-b-[6px] border-[#f5e8c7] bg-[#f5e8c7] px-3 ${
            sidebarExpanded ? "pr-10" : "pr-3"
          }`}
        >
          <img
            src="/logo.png"
            alt="Bella Nonna Pizzeria"
            className={`max-h-[92px] w-full object-contain transition-all duration-300 ${
              sidebarExpanded ? "max-w-[155px]" : "max-w-12"
            }`}
          />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-6">
          {sidebarExpanded && (
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#e8c7a5]/70">
              Operação
            </p>
          )}

          <div className="space-y-1">
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
                type="button"
                title={!sidebarExpanded ? label : undefined}
                aria-label={!sidebarExpanded ? label : undefined}
                onClick={() => {
                  const path =
                    id === "insumos"
                      ? "/admin"
                      : id === "pedidos"
                        ? "/admin/pedidos"
                        : id === "kanban"
                          ? "/admin/pedidos/kanban"
                          : `/admin/${id}`;

                  navigate(path);
                }}
                className={`group relative flex h-12 w-full items-center rounded-lg text-left text-sm transition-colors hover:bg-[#9f0e14] ${
                  sidebarExpanded ? "gap-4 px-3" : "justify-center px-0"
                } ${
                  activeSection === id
                    ? "bg-[#920c12] font-semibold text-white shadow-inner"
                    : "text-[#f5e8c7]/90"
                }`}
              >
                <Icon size={17} className="shrink-0" />

                {sidebarExpanded && <span className="truncate">{label}</span>}

                {id === "precificacao" && (
                  <span
                    className={`size-2 shrink-0 rounded-full bg-[#f1a044] ${
                      sidebarExpanded ? "ml-auto" : "absolute right-2 top-2"
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        </nav>

        <div className="space-y-3 border-t border-[#f5e8c7]/15 p-3">
          <div
            title={
              !sidebarExpanded
                ? supabase
                  ? "Dados sincronizados"
                  : "Modo demonstração"
                : undefined
            }
            className={`flex min-h-12 items-center rounded-lg bg-[#9f0e14]/70 ${
              sidebarExpanded ? "gap-3 px-3 py-2" : "justify-center"
            }`}
          >
            <span className="size-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />

            {sidebarExpanded && (
              <div className="min-w-0">
                <strong className="block truncate text-xs">
                  {supabase ? "Dados sincronizados" : "Modo demonstração"}
                </strong>
                <small className="block truncate text-[10px] text-[#f5e8c7]/65">
                  {supabase
                    ? "Supabase conectado"
                    : "Configure o Supabase para persistir"}
                </small>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            title={!sidebarExpanded ? "Admin — Administrador" : undefined}
            className={`flex min-h-12 w-full items-center rounded-lg transition-colors hover:bg-[#9f0e14] ${
              sidebarExpanded ? "gap-3 px-2" : "justify-center"
            }`}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f5e8c7] text-xs font-bold text-[#9f0e14]">
              AD
            </span>

            {sidebarExpanded && (
              <>
                <span className="min-w-0 flex-1 text-left">
                  <strong className="block text-xs">Admin</strong>
                  <small className="block text-[10px] text-[#f5e8c7]/65">
                    Administrador
                  </small>
                </span>
                <LogOut size={15} className="shrink-0" />
              </>
            )}
          </button>
        </div>
      </aside>

      <main className=" w-full">
        {databaseError && (
          <div className="database-error" role="alert">
            {databaseError}
          </div>
        )}

        <header className="flex min-h-[92px] items-center justify-between gap-6 bg-[#fff6d9] px-6 py-4 sm:px-8 lg:px-11">
          <div className="min-w-0 text-[#295727]">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#537348]">
              Dashboard <span className="mx-1 text-[#a3a77d]">/</span>{" "}
              {activeSection === "insumos"
                ? "Insumos"
                : activeSection === "fichas"
                  ? "Fichas técnicas"
                  : activeSection === "cardapio"
                    ? "Cardápio"
                    : activeSection === "pedidos"
                      ? "Pedidos"
                      : activeSection === "kanban"
                        ? "Kanban"
                        : "Precificação"}
            </p>

           
          </div>

          <div className="flex shrink-0 items-center gap-3 text-[#315d3d]">
            <div className="hidden items-center gap-1.5 text-[10px] text-[#54715b] md:flex">
              {saved ? (
                <>
                  <Check size={14} className="text-[#327047]" />
                  <span>Salvo agora</span>
                </>
              ) : (
                "Última atualização hoje, 09:42"
              )}
            </div>

            <button
              type="button"
              className="grid size-8 place-items-center rounded-full text-[#286342] transition hover:bg-[#e9edcf]"
              title="Ajuda"
              aria-label="Ajuda"
            >
              <CircleHelp size={16} />
            </button>

            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#e7dfbd] bg-[#fff9e8] px-2.5 text-xs font-semibold text-[#315d3d] shadow-sm transition hover:bg-white"
              onClick={logout}
            >
              <span className="grid size-7 place-items-center rounded-full bg-[#e7edce] text-[10px] font-bold text-[#295727]">
                AD
              </span>
              <span>Admin</span>
              <ChevronDown size={14} className="text-[#54715b]" />
            </button>

            <span className="hidden text-xs tracking-[0.25em] text-[#a49d76] sm:inline">
              ··
            </span>
          </div>
        </header>

        {activeSection === "insumos" && <Insumos />}

        {activeSection === "fichas" && <Receitas />}

        {activeSection === "precificacao" && <Precificacao />}

        {activeSection === "cardapio" && <Cardapio />}
      </main>
    </div>
  );
}
