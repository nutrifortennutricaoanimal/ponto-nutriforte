import { useState, useEffect } from "react";
import { supabase, criarUsuarioAuth } from "../lib/supabase";

const FORM_VAZIO = {
  nome: "",
  matricula: "",
  email: "",
  senha: "",
  jornada_id: "",
  is_admin: false,
};

export default function SecaoColaboradores() {
  const [colaboradores, setColaboradores] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [modo, setModo] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoId, setEditandoId] = useState(null);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const [{ data: cols }, { data: jorns }] = await Promise.all([
      supabase
        .from("colaboradores")
        .select("*, jornadas(nome)")
        .order("nome"),
      supabase.from("jornadas").select("id, nome").eq("ativo", true).order("nome"),
    ]);
    setColaboradores(cols || []);
    setJornadas(jorns || []);
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirCriar() {
    setModo("criar");
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro(null);
    setSucesso(null);
  }

  function abrirEditar(c) {
    setModo("editar");
    setEditandoId(c.id);
    setForm({
      nome: c.nome,
      matricula: c.matricula,
      email: c.email,
      senha: "",
      jornada_id: c.jornada_id || "",
      is_admin: c.is_admin,
    });
    setErro(null);
    setSucesso(null);
  }

  function cancelar() {
    setModo(null);
    setEditandoId(null);
    setForm(FORM_VAZIO);
    setErro(null);
  }

  function traduzirErroBanco(err) {
    const msg = err?.message || "";
    if (msg.includes("colaboradores_email_key")) {
      return "Este e-mail já está cadastrado. Use outro e-mail ou edite o colaborador existente na lista.";
    }
    if (msg.includes("colaboradores_matricula_key")) {
      return "Esta matrícula já está cadastrada. Use Editar na lista ou outra matrícula.";
    }
    if (msg.includes("duplicate key")) {
      return "Cadastro duplicado (e-mail ou matrícula já existe). Verifique a lista abaixo.";
    }
    return msg || "Erro ao salvar colaborador.";
  }

  async function verificarDuplicatas(matricula, email, ignorarId = null) {
    const { data: porMatricula } = await supabase
      .from("colaboradores")
      .select("id, nome")
      .eq("matricula", matricula.trim())
      .maybeSingle();

    if (porMatricula && porMatricula.id !== ignorarId) {
      throw new Error(
        `Matrícula "${matricula.trim()}" já cadastrada para ${porMatricula.nome}. Use "Editar" na lista.`
      );
    }

    const { data: porEmail } = await supabase
      .from("colaboradores")
      .select("id, nome")
      .eq("email", email)
      .maybeSingle();

    if (porEmail && porEmail.id !== ignorarId) {
      throw new Error(
        `E-mail já cadastrado para ${porEmail.nome}. Use outro e-mail ou edite o cadastro existente.`
      );
    }
  }

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      if (!form.nome.trim() || !form.matricula.trim()) {
        throw new Error("Nome e matrícula são obrigatórios.");
      }

      if (modo === "criar") {
        let userId = null;
        let emailFinal = `${form.matricula.trim()}@ponto.nutriforte.local`;

        if (form.is_admin) {
          if (!form.email.trim() || !form.senha.trim()) {
            throw new Error("Administrador precisa de e-mail e senha.");
          }
          if (form.senha.length < 6) {
            throw new Error("Senha deve ter no mínimo 6 caracteres.");
          }
          emailFinal = form.email.trim().toLowerCase();
        }

        await verificarDuplicatas(form.matricula, emailFinal);

        if (form.is_admin) {
          userId = await criarUsuarioAuth(emailFinal, form.senha);
        }

        const { error } = await supabase.from("colaboradores").insert({
          nome: form.nome.trim(),
          matricula: form.matricula.trim(),
          email: emailFinal,
          jornada_id: form.jornada_id || null,
          is_admin: form.is_admin,
          user_id: userId,
          ativo: true,
        });

        if (error) throw error;
        setSucesso(form.is_admin ? "Administrador criado com sucesso!" : "Colaborador criado com sucesso!");
      } else {
        const emailAtual = form.email;
        await verificarDuplicatas(form.matricula, emailAtual, editandoId);

        const { error } = await supabase
          .from("colaboradores")
          .update({
            nome: form.nome.trim(),
            matricula: form.matricula.trim(),
            jornada_id: form.jornada_id || null,
            is_admin: form.is_admin,
          })
          .eq("id", editandoId);

        if (error) throw error;
        setSucesso("Colaborador atualizado!");
      }

      cancelar();
      carregar();
    } catch (err) {
      setErro(traduzirErroBanco(err));
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(c) {
    const novo = !c.ativo;
    if (!novo && !confirm(`Desativar ${c.nome}? Não poderá bater ponto.`)) return;

    const { error } = await supabase
      .from("colaboradores")
      .update({ ativo: novo })
      .eq("id", c.id);

    if (error) {
      setErro(error.message);
      return;
    }
    carregar();
  }

  return (
    <div>
      <button type="button" className="btn btn-primary btn-sm" onClick={abrirCriar}>
        + Novo colaborador
      </button>

      {sucesso && !modo && <div className="msg-info" style={{ marginTop: "1rem" }}>{sucesso}</div>}
      {erro && !modo && <div className="msg-erro" style={{ marginTop: "1rem" }}>{erro}</div>}

      {modo && (
        <form onSubmit={handleSalvar} className="card" style={{ marginTop: "1rem" }}>
          <div className="card-title">
            {modo === "criar" ? "Novo colaborador" : "Editar colaborador"}
          </div>

          {erro && <div className="msg-erro">{erro}</div>}

          <div className="form-group">
            <label>Nome completo</label>
            <input
              className="input"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Matrícula</label>
            <input
              className="input"
              value={form.matricula}
              onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Jornada</label>
            <select
              className="select"
              value={form.jornada_id}
              onChange={(e) => setForm({ ...form, jornada_id: e.target.value })}
            >
              <option value="">Selecione…</option>
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nome}
                </option>
              ))}
            </select>
          </div>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            <input
              type="checkbox"
              checked={form.is_admin}
              onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
              style={{ marginRight: "0.5rem" }}
            />
            Administrador (acesso ao painel Admin)
          </label>

          {modo === "criar" && form.is_admin && (
            <>
              <div className="form-group">
                <label>E-mail (login)</label>
                <input
                  type="email"
                  className="input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required={form.is_admin}
                />
              </div>
              <div className="form-group">
                <label>Senha</label>
                <input
                  type="password"
                  className="input"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  required={form.is_admin}
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {modo === "editar" && form.is_admin && (
            <p className="list-item-meta" style={{ marginBottom: "1rem" }}>
              E-mail e senha não podem ser alterados aqui. Conta: {form.email}
            </p>
          )}

          {modo === "criar" && !form.is_admin && (
            <p className="list-item-meta" style={{ marginBottom: "1rem" }}>
              Funcionários batem ponto com matrícula — sem senha.
            </p>
          )}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        {colaboradores.length === 0 ? (
          <p className="list-item-meta">Nenhum colaborador cadastrado.</p>
        ) : (
          colaboradores.map((c) => (
            <div key={c.id} className="list-item" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                  <strong>{c.nome}</strong>
                  <span className={`status ${c.ativo ? "status-ok" : "status-erro"}`}>
                    {c.ativo ? "Ativo" : "Inativo"}
                  </span>
                  {c.is_admin && <span className="status status-info">Admin</span>}
                </div>
                <div className="list-item-meta">
                  Mat. {c.matricula}
                  {c.jornadas?.nome ? ` · ${c.jornadas.nome}` : ""}
                </div>
                <div className="list-item-meta">{c.email}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => abrirEditar(c)}>
                  Editar
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${c.ativo ? "btn-danger" : "btn-success"}`}
                  onClick={() => toggleAtivo(c)}
                >
                  {c.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
