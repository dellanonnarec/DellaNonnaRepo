import { useEffect, useState } from "react";
import Pedido from "./pages/Pedido-Publico/Pedido";
import AdminPedidos from "./pages/Pedidos/AdminPedidosPage";
import AdminPedidosKanban from "./pages/Pedidos/AdminPedidosKanbanPage";
import { publicSupabase } from "./lib/supabase";
import "./App.css";
import AuthLogin from "./pages/auth/AuthLogin";

import CardapioPublico from "./pages/Pedido-Publico/CardapioPublico"; 
import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import AdminLayout from "./pages/AdminLayout/AdminLayout";

const supabase = publicSupabase;

function App() {
  const [session, setSession] = useState(false);
  const [authReady, setAuthReady] = useState(!supabase);
  
  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSession(Boolean(data.session));
      setAuthReady(true);
    });

    const { data: listener } =
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(Boolean(nextSession));
      });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!authReady) {
    return (
      <main className="login-page">
        <div className="login-card">
          <p>Restaurando sessão...</p>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      {/* público */}
      <Route path="/pedido" element={<Pedido />} />
      <Route path="/pedido/cardapio" element={<CardapioPublico />} />

      {/* login */}
      {!session && (
        <Route path="*" element={<AuthLogin />} />
      )}

      {/* admin */}
      {session && (
        <>
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/admin/pedidos" element={<AdminPedidos />} />
          <Route
            path="/admin/pedidos/kanban"
            element={<AdminPedidosKanban />}
          />
        </>
      )}

      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export default App;