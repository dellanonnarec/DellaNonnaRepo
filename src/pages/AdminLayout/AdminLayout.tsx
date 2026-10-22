import { Navigate, useLocation } from "react-router-dom";

import AdminOrdersNav from "../Pedidos/AdminOrdersNav";
import Insumos from "../insumos/Insumos";
import Receitas from "../Receitas/Receitas";
import Precificacao from "../Precificacao/Precificacao";
import Cardapio from "../Cardapio/Cardapio";
import AdminDashboard from "../Dashboard/AdminDashboard";
import AdminPrintCenter from "../Pedidos/AdminPrintCenter";
import PizzeriaSettingsPage from "../AdminSettings/PizzeriaSettingsPage";
import DeliveryRulesPage from "../AdminSettings/DeliveryRulesPage";

type AdminSection = "dashboard" | "insumos" | "fichas" | "precificacao" | "cardapio" | "impressao" | "configuracoes" | "delivery";

const sectionByPath: Record<string, AdminSection> = {
  "/admin/dashboard": "dashboard",
  "/admin": "insumos",
  "/admin/insumos": "insumos",
  "/admin/fichas": "fichas",
  "/admin/precificacao": "precificacao",
  "/admin/cardapio": "cardapio",
  "/admin/impressao": "impressao",
  "/admin/configuracoes": "configuracoes",
  "/admin/delivery": "delivery",
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
      {activeSection === "impressao" && <AdminPrintCenter />}
      {activeSection === "configuracoes" && <PizzeriaSettingsPage />}
      {activeSection === "delivery" && <DeliveryRulesPage />}
    </div>
  );
}
