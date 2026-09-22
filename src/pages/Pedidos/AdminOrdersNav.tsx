import { ClipboardList, Columns3, LayoutDashboard, Pizza, Settings2 } from "lucide-react";

type AdminOrdersNavProps = { active: "pedidos" | "kanban" };

const links = [
  { href: "/admin", label: "Insumos", icon: Settings2, key: undefined },
  { href: "/admin/fichas", label: "Fichas técnicas", icon: LayoutDashboard, key: undefined },
  { href: "/admin/cardapio", label: "Cardápio", icon: Pizza, key: undefined },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, key: "pedidos" },
  { href: "/admin/pedidos/kanban", label: "Kanban", icon: Columns3, key: "kanban" },
] as const;

export default function AdminOrdersNav({ active }: AdminOrdersNavProps) {
  return <nav className="admin-orders-nav" aria-label="Navegação administrativa">
    <div className="admin-orders-brand"><span>DN</span><strong>Della Nonna <small>Admin</small></strong></div>
    <div className="admin-orders-links">{links.map(({ href, label, icon: Icon, key }) => <a className={key === active ? "active" : ""} href={href} key={href}><Icon size={17} />{label}</a>)}</div>
  </nav>;
}
