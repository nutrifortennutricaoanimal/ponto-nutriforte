import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function Cadastro() {
  const [jornadas, setJornadas] = useState([]);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [jornadaId, setJornadaId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    supabase
      .from("jornadas")
      .select("*")
      .eq("ativo", true)
      .then(({ data }) => {
        setJornadas(data || []);
        if (data?.length === 1) setJornadaId(data[0].id);
      });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setSalvando(true);

    try {
      if (!nome.trim() || !matricula.trim()) {
        throw new Error("Preencha nome e matrícula.");
      }
      if (isAdmin && !email.trim()) {
        throw new Error("Administrador precisa de e-mail (login no Supabase).");
      }

      const { data: existente } = await supabase
        .from("colaboradores")
        .select("id")
        .eq("matricula", matricula.trim())
        .maybeSingle();

      const emailFinal = isAdmin
        ? email.trim()
        : `${matricula.trim()}@ponto.nutriforte.local`;

      const payload = {
        email: emailFinal,
        nome: nome.trim(),
        matricula: matricula.trim(),
        jornada_id: jornadaId || null,
        is_admin: isAdmin,
        ativo: true,
      };

      if (existente) {
        const { error } = await supabase
          .from("colaboradores")
          .update(payload)
          .eq("id", existente.id);
        if (error) throw error;
        setSucesso("Colaborador atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("colaboradores").insert(payload);
        if (error) throw error;
        setSucesso(
          isAdmin
            ? "Admin cadastrado! Crie o login no Supabase Auth com o mesmo e-mail."
            : "Colaborador cadastrado com sucesso!"
        );
      }

      setEmail("");
      setNome("");
      setMatricula("");
      setIsAdmin(false);
    } catch (err) {
      setErro(err.message || "Erro ao salvar colaborador.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Cadastro</h1>
        <Link to="/admin" className="btn-link">
          ← Admin
        </Link>
      </div>

      <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
        Cadastre nome e matrícula. Funcionários batem ponto com matrícula + localização.
      </p>

      {erro && <div className="msg-erro">{erro}</div>}
      {sucesso && <div className="msg-info">{sucesso}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="nome">Nome completo</label>
          <input
            id="nome"
            type="text"
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="matricula">Matrícula</label>
          <input
            id="matricula"
            type="text"
            className="input"
            value={matricula}
            onChange={(e) => setMatricula(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="jornada">Jornada</label>
          <select
            id="jornada"
            className="select"
            value={jornadaId}
            onChange={(e) => setJornadaId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              style={{ marginRight: "0.5rem" }}
            />
            Administrador (precisa de e-mail e login no Supabase)
          </label>
        </div>

        {isAdmin && (
          <div className="form-group">
            <label htmlFor="email">E-mail do admin</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={isAdmin}
              placeholder="mesmo e-mail do Supabase Auth"
            />
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar colaborador"}
        </button>
      </form>
    </div>
  );
}
