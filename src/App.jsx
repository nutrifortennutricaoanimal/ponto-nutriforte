import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { supabase, getColaboradorByEmail } from "./lib/supabase";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Ponto from "./pages/Ponto";
import Admin from "./pages/Admin";
import Cadastro from "./pages/Cadastro";

function LoadingScreen() {
  return (
    <div className="page">
      <div className="loading">Carregando…</div>
    </div>
  );
}

function AdminRoute({ children }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState("loading");

  useEffect(() => {
    let ativo = true;

    async function verificar() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (ativo) setEstado("unauth");
        return;
      }

      try {
        const colaborador = await getColaboradorByEmail(session.user.email);
        if (!colaborador?.ativo || !colaborador?.is_admin) {
          await supabase.auth.signOut();
          if (ativo) setEstado("forbidden");
          return;
        }
        if (ativo) setEstado("ok");
      } catch {
        if (ativo) setEstado("unauth");
      }
    }

    verificar();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(verificar);
    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (estado === "unauth") navigate("/login", { replace: true });
    if (estado === "forbidden") navigate("/", { replace: true });
  }, [estado, navigate]);

  if (estado === "loading") return <LoadingScreen />;
  if (estado === "ok") return children;
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ponto" element={<Ponto />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />
        <Route
          path="/cadastro"
          element={
            <AdminRoute>
              <Cadastro />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
