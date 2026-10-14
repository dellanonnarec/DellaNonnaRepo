import { Navigate, useLocation } from "react-router-dom";

import AdminOrdersNav from "../Pedidos/AdminOrdersNav";
import Insumos from "../insumos/Insumos";
import Receitas from "../Receitas/Receitas";
import Precificacao from "../Precificacao/Precificacao";
import Cardapio from "../Cardapio/Cardapio";
import AdminDashboard from "../Dashboard/AdminDashboard";

type AdminSection = "dashboard" | "insumos" | "fichas" | "precificacao" | "cardapio";

const sectionByPath: Record<string, AdminSection> = {
  "/admin/dashboard": "dashboard",
  "/admin": "insumos",
  "/admin/insumos": "insumos",
  "/admin/fichas": "fichas",
  "/admin/precificacao": "precificacao",
  "/admin/cardapio": "cardapio",
};

export default function AdminLayout() {
  const { pathname } = useLocation();
  const activeSection = sectionByPath[pathname];

  if (!activeSection) return <Navigate to="/admin" replace />;

  return (
    <div className="admin-orders-shell">
      <AdminOrdersNav active={activeSection} />
      {activeSection === "dashboard" && <AdminDashboard />}
      {activeSection === "insumos" && <Insumos />}
      {activeSection === "fichas" && <Receitas />}
      {activeSection === "precificacao" && <Precificacao />}
      {activeSection === "cardapio" && <Cardapio />}
    </div>
  );
}
