import { BarChart3, ClipboardList, Columns3, LayoutDashboard, LogOut, Moon, Pizza, Settings2, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { publicSupabase } from "../../lib/supabase";

type AdminOrdersNavProps = {
  active: "dashboard" | "insumos" | "fichas" | "precificacao" | "cardapio" | "pedidos" | "kanban";
};

const links = [
  { href: "/admin/dashboard", label: "Dashboard", icon: BarChart3, key: "dashboard" },
  { href: "/admin", label: "Insumos", icon: Settings2, key: "insumos" },
  { href: "/admin/fichas", label: "Fichas técnicas", icon: LayoutDashboard, key: "fichas" },
  { href: "/admin/precificacao", label: "Precificação", icon: Settings2, key: "precificacao" },
  { href: "/admin/cardapio", label: "Cardápio", icon: Pizza, key: "cardapio" },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, key: "pedidos" },
  { href: "/admin/pedidos/kanban", label: "Kanban", icon: Columns3, key: "kanban" },
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
    <div className="admin-orders-links">{links.map(({ href, label, icon: Icon, key }) => <a className={key === active ? "active" : ""} href={href} key={href}><Icon size={17} />{label}</a>)}</div>
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
