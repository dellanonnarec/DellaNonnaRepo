import AdminOrdersNav from "./AdminOrdersNav";
import AdminPedidos from "./AdminPedidos";

export default function AdminPedidosPage() {
  return <div className="admin-orders-shell"><AdminOrdersNav active="pedidos" /><AdminPedidos /></div>;
}
