import { BarChart3, ClipboardList, Columns3, LayoutDashboard, LogOut, Moon, Pizza, Printer, Settings2, Store, Sun, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";

type AdminOrdersNavProps = {
  active: "dashboard" | "insumos" | "fichas" | "precificacao" | "cardapio" | "pedidos" | "kanban" | "impressao" | "configuracoes" | "delivery";
};

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3, key: "dashboard" },
  { href: "/admin", label: "Insumos", icon: Settings2, key: "insumos" },
  { href: "/admin/fichas", label: "Fichas técnicas", icon: LayoutDashboard, key: "fichas" },
  { href: "/admin/precificacao", label: "Precificação", icon: Settings2, key: "precificacao" },
  { href: "/admin/cardapio", label: "Cardápio", icon: Pizza, key: "cardapio" },
  { href: "/admin/configuracoes", label: "Pizzaria", icon: Store, key: "configuracoes" },
  { href: "/admin/delivery", label: "Delivery", icon: Truck, key: "delivery" },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, key: "pedidos" },
  { href: "/admin/pedidos/kanban", label: "Kanban", icon: Columns3, key: "kanban" },
  { href: "/admin/impressao", label: "Impressão", icon: Printer, key: "impressao" },
] as const;

export default function AdminOrdersNav({ active }: AdminOrdersNavProps) {
  const navigate = useNavigate();
  const [darkTheme, setDarkTheme] = useState(
    () => localStorage.getItem("della-admin-theme") === "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.adminTheme = darkTheme ? "dark" : "light";
    localStorage.setItem("della-admin-theme", darkTheme ? "dark" : "light");
    return () => {
      delete document.documentElement.dataset.adminTheme;
    };
  }, [darkTheme]);

  const logout = async () => {
    if (publicSupabase) await publicSupabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return <nav className="admin-orders-nav" aria-label="Navegação administrativa">
    <div className="admin-orders-brand"><span>DN</span><strong>Della Nonna <small>Admin</small></strong></div>
    <div className="admin-orders-links">{links.filter(({ key }) => key !== "impressao" || Boolean(window.desktop)).map(({ href, label, icon: Icon, key }) => <Link className={key === active ? "active" : ""} to={href} key={href}><Icon size={17} />{label}</Link>)}</div>
    <div className="admin-orders-actions">
      <button type="button" onClick={() => setDarkTheme((value) => !value)} aria-label={`Ativar tema ${darkTheme ? "claro" : "escuro"}`} aria-pressed={darkTheme}>
        {darkTheme ? <Sun size={16} /> : <Moon size={16} />}
        <span>{darkTheme ? "Tema claro" : "Tema escuro"}</span>
      </button>
      <button type="button" onClick={() => void logout()} aria-label="Sair da conta">
        <LogOut size={16} /><span>Sair</span>
      </button>
    </div>
  </nav>;
}
