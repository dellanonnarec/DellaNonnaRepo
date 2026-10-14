import AdminOrdersNav from "./AdminOrdersNav";
import AdminPedidosKanban from "./AdminPedidosKanban";

export default function AdminPedidosKanbanPage() {
  return (
    <div className="admin-orders-shell">
      <AdminOrdersNav active="kanban" />
      <AdminPedidosKanban />
    </div>
  );
}
