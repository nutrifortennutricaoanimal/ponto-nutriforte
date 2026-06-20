import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, getColaboradorByEmail, vincularUserId } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      });

      if (authError) throw new Error("E-mail ou senha inválidos.");

      const colaborador = await getColaboradorByEmail(email.trim());

      if (!colaborador || !colaborador.is_admin) {
        await supabase.auth.signOut();
        throw new Error("Acesso restrito ao administrador.");
      }

      if (!colaborador.ativo) {
        await supabase.auth.signOut();
        throw new Error("Administrador inativo.");
      }

      if (!colaborador.user_id) {
        await vincularUserId(colaborador.id, authData.user.id);
      }

      navigate("/admin", { replace: true });
    } catch (err) {
      setErro(err.message || "Erro ao fazer login.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="page">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="page-title" style={{ textAlign: "center", marginBottom: "0.25rem" }}>
          Admin
        </h1>
        <p className="page-subtitle" style={{ textAlign: "center", marginBottom: "2rem" }}>
          Acesso restrito ao administrador
        </p>

        {erro && <div className="msg-erro">{erro}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              className="input"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={carregando}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <Link to="/" className="btn-link" style={{ textAlign: "center", marginTop: "1.5rem", display: "block" }}>
          ← Voltar ao ponto
        </Link>
      </div>
    </div>
  );
}
