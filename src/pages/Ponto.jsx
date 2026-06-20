import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import GeoCheck from "../components/GeoCheck";
import { formatarData } from "../lib/dates";
import {
  getColaboradorByMatricula,
  getUltimoRegistroHoje,
  getRegistrosHoje,
  proximoTipoPonto,
  registrarPonto,
  TIPO_LABELS,
  TIPOS_BATIDA,
} from "../lib/supabase";

// gps → matricula → confirmar (escolhe tipo) → registrar → sucesso
export default function Ponto() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState("gps");
  const [agora, setAgora] = useState(new Date());
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [geoDados, setGeoDados] = useState(null);
  const [colaborador, setColaborador] = useState(null);
  const [tipoSelecionado, setTipoSelecionado] = useState("entrada");
  const [tipoSugerido, setTipoSugerido] = useState(null);
  const [registrosHoje, setRegistrosHoje] = useState([]);
  const [registrando, setRegistrando] = useState(false);
  const [ultimoSucesso, setUltimoSucesso] = useState(null);
  const [matriculaInput, setMatriculaInput] = useState("");
  const [buscandoMatricula, setBuscandoMatricula] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const handleGeo = useCallback((resultado) => {
    if (resultado.ok && etapa === "gps") {
      setGeoDados(resultado);
      setErro(null);
      setEtapa("matricula");
    } else if (!resultado.ok && etapa === "gps") {
      setErro(resultado.erro);
    }
  }, [etapa]);

  async function handleBuscarMatricula() {
    if (!matriculaInput.trim()) {
      setErro("Digite sua matrícula.");
      return;
    }

    setBuscandoMatricula(true);
    setErro(null);
    setAviso(null);

    try {
      const colab = await getColaboradorByMatricula(matriculaInput.trim());
      if (!colab) throw new Error("Matrícula não encontrada.");
      if (colab.is_admin) throw new Error("Matrícula inválida para bater ponto.");

      const [ultimo, hoje] = await Promise.all([
        getUltimoRegistroHoje(colab.id),
        getRegistrosHoje(colab.id),
      ]);

      const sugerido = proximoTipoPonto(ultimo);
      setColaborador(colab);
      setRegistrosHoje(hoje);
      setTipoSugerido(sugerido);
      setTipoSelecionado(sugerido || "entrada");

      if (!sugerido) {
        setAviso("Jornada do dia parece concluída. Escolha o tipo de batida abaixo se precisar registrar outra.");
      } else if (sugerido !== "entrada" && !hoje.some((r) => r.tipo === "entrada")) {
        setAviso("Não há entrada registrada hoje. Confira o tipo de batida antes de confirmar.");
      }

      setEtapa("confirmar");
    } catch (e) {
      setErro(e.message);
    } finally {
      setBuscandoMatricula(false);
    }
  }

  function voltarInicio() {
    navigate("/");
  }

  function reiniciarFluxo() {
    setEtapa("gps");
    setColaborador(null);
    setTipoSelecionado("entrada");
    setTipoSugerido(null);
    setRegistrosHoje([]);
    setGeoDados(null);
    setErro(null);
    setAviso(null);
    setMatriculaInput("");
    setUltimoSucesso(null);
  }

  async function handleConfirmarPonto() {
    if (!colaborador || !geoDados || !tipoSelecionado) return;

    setRegistrando(true);
    setErro(null);

    try {
      const registro = await registrarPonto({
        colaboradorId: colaborador.id,
        tipo: tipoSelecionado,
        latitude: geoDados.latitude,
        longitude: geoDados.longitude,
        localId: geoDados.local.id,
      });

      setUltimoSucesso({
        tipo: tipoSelecionado,
        horario: format(new Date(registro.timestamp), "HH:mm:ss"),
        nome: colaborador.nome,
      });
      setEtapa("sucesso");
    } catch (e) {
      setErro(e.message || "Erro ao registrar ponto.");
    } finally {
      setRegistrando(false);
    }
  }

  const tipoBtn =
    tipoSelecionado === "entrada"
      ? "btn-success"
      : tipoSelecionado === "saida"
        ? "btn-danger"
        : "btn-warning";

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Bater ponto</h1>
        <Link to="/" className="btn-link">
          ← Voltar
        </Link>
      </div>

      <div className="relogio" style={{ fontSize: "1.5rem" }}>
        {format(agora, "HH:mm:ss")}
      </div>
      <p className="page-subtitle" style={{ textAlign: "center", marginBottom: "1rem" }}>
        {formatarData(agora)}
      </p>

      {erro && <div className="msg-erro">{erro}</div>}
      {aviso && <div className="msg-info">{aviso}</div>}

      {etapa === "gps" && (
        <>
          <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
            Verificando sua localização…
          </p>
          <GeoCheck onValidacao={handleGeo} atualizarACadaMs={0} />
        </>
      )}

      {etapa === "matricula" && (
        <>
          {geoDados && (
            <div className="card">
              <span className="status status-ok">✓ {geoDados.local.nome}</span>
            </div>
          )}
          <div className="card">
            <div className="card-title">Digite sua matrícula</div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <input
                type="text"
                className="input"
                value={matriculaInput}
                onChange={(e) => setMatriculaInput(e.target.value)}
                placeholder="Ex: 0012"
                inputMode="numeric"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleBuscarMatricula()}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={buscandoMatricula}
            onClick={handleBuscarMatricula}
          >
            {buscandoMatricula ? "Buscando…" : "Continuar"}
          </button>
        </>
      )}

      {etapa === "confirmar" && colaborador && (
        <>
          <div className="card" style={{ textAlign: "center", padding: "1.5rem" }}>
            <p className="list-item-meta">Confirme seus dados</p>
            <h2 style={{ fontSize: "1.5rem", margin: "0.5rem 0" }}>{colaborador.nome}</h2>
            <p className="page-subtitle">Mat. {colaborador.matricula}</p>
            {geoDados && (
              <p className="list-item-meta" style={{ marginTop: "0.5rem" }}>
                Local: {geoDados.local.nome}
              </p>
            )}
          </div>

          {registrosHoje.length > 0 && (
            <div className="card">
              <div className="card-title">Batidas de hoje</div>
              {registrosHoje.map((r) => (
                <div key={r.id} className="list-item-meta">
                  {TIPO_LABELS[r.tipo]} — {format(parseISO(r.timestamp), "HH:mm:ss")}
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-title">Tipo de batida</div>
            <p className="list-item-meta" style={{ marginBottom: "0.75rem" }}>
              {tipoSugerido
                ? `Sugerido: ${TIPO_LABELS[tipoSugerido]}. Altere se estiver errado.`
                : "Escolha o tipo correto para esta batida."}
            </p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <select
                className="select"
                value={tipoSelecionado}
                onChange={(e) => setTipoSelecionado(e.target.value)}
              >
                {TIPOS_BATIDA.map((t) => (
                  <option key={t} value={t}>
                    {TIPO_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button type="button" className={`btn ${tipoBtn}`} onClick={() => setEtapa("registrar")}>
            Continuar
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: "0.75rem" }}
            onClick={() => {
              setColaborador(null);
              setTipoSelecionado("entrada");
              setTipoSugerido(null);
              setRegistrosHoje([]);
              setMatriculaInput("");
              setAviso(null);
              setEtapa("matricula");
            }}
          >
            Não sou eu
          </button>
        </>
      )}

      {etapa === "registrar" && colaborador && (
        <>
          <div className="card">
            <div className="card-title">Confirmar registro</div>
            <p style={{ fontSize: "1.125rem", fontWeight: 600 }}>{colaborador.nome}</p>
            <p className="list-item-meta">Mat. {colaborador.matricula}</p>
            <p style={{ marginTop: "0.75rem", fontSize: "1.25rem", fontWeight: 700 }}>
              {TIPO_LABELS[tipoSelecionado]}
            </p>
            {geoDados && (
              <p className="list-item-meta" style={{ marginTop: "0.5rem" }}>
                Local: {geoDados.local.nome}
              </p>
            )}
          </div>
          <button
            type="button"
            className={`btn ${tipoBtn}`}
            disabled={registrando}
            onClick={handleConfirmarPonto}
          >
            {registrando ? "Registrando…" : "Confirmar ponto"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: "0.75rem" }}
            onClick={() => setEtapa("confirmar")}
          >
            Voltar
          </button>
        </>
      )}

      {etapa === "sucesso" && ultimoSucesso && (
        <>
          <div className={`feedback-ponto ${ultimoSucesso.tipo}`}>
            <h2>{TIPO_LABELS[ultimoSucesso.tipo]}</h2>
            <p>{ultimoSucesso.nome}</p>
            <p>Registrado às {ultimoSucesso.horario}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={voltarInicio}>
            Voltar ao início
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: "0.75rem" }}
            onClick={reiniciarFluxo}
          >
            Bater outro ponto
          </button>
        </>
      )}
    </div>
  );
}
