import AdminOrdersNav from "./AdminOrdersNav";
import AdminPedidosKanban from "./AdminPedidosKanbanInteractive";

export default function AdminPedidosKanbanPage() {
  return <div className="admin-orders-shell"><AdminOrdersNav active="kanban" /><AdminPedidosKanban /></div>;
}
