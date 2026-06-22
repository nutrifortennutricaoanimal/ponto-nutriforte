import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  supabase,
  buscarRegistrosPeriodo,
  getJornadasMap,
  getCalendarioDias,
  salvarRegistroManual,
  getHistoricoRegistro,
  getAdminColaborador,
  MSG_MIGRACAO_PENDENTE,
  isTabelaInexistente,
} from "../lib/supabase";
import { labelTipoBatida, TIPOS_BATIDA } from "../lib/tipoBatida";
import SecaoColaboradores from "../components/SecaoColaboradores";
import { getPosicaoAtual } from "../lib/geo";
import { calcularSaldoPeriodo } from "../lib/horasExtras";
import {
  dataHoje,
  parseData,
  sanitizarEntradaData,
  formatarData,
  montarTimestamp,
  extrairHora,
} from "../lib/dates";
import {
  montarLinhasRegistros,
  formatarHoraRegistro,
} from "../lib/registrosPivot";
import {
  DIAS_SEMANA_PADRAO,
  normalizarDiasSemana,
} from "../lib/diasUteis";

const ABAS = ["registros", "colaboradores", "horas", "locais", "jornadas", "calendario"];

const STATUS_LABELS = {
  ausente: "Ausente",
  parcial: "Parcial",
  completo: "Completo",
};

function CelulaBatida({ registro, onEditar, onCriar, tipo, linha }) {
  if (registro) {
    return (
      <td className={`td-batida ${registro.editado_em ? "editado" : ""}`}>
        <button
          type="button"
          className="celula-btn"
          onClick={() => onEditar(registro, linha)}
          title={labelTipoBatida(registro.tipo)}
        >
          {formatarHoraRegistro(registro)}
          {registro.editado_em && <span className="badge-editado">✎</span>}
        </button>
      </td>
    );
  }

  return (
    <td className="td-batida vazia" title={labelTipoBatida(tipo)}>
      <button
        type="button"
        className="celula-btn celula-criar"
        onClick={() => onCriar(tipo, linha)}
      >
        —
      </button>
    </td>
  );
}

function ModalRegistro({ modal, onFechar, onSalvo, colaboradoresLista = [] }) {
  const [tipo, setTipo] = useState("entrada");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("08:00");
  const [colaboradorId, setColaboradorId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [carregandoHist, setCarregandoHist] = useState(false);

  useEffect(() => {
    if (!modal) return;
    setErro(null);
    setMotivo("");
    setObservacao(modal.registro?.observacao || "");

    if (modal.modo === "editar" && modal.registro) {
      setTipo(modal.registro.tipo);
      setData(formatarData(parseISO(modal.registro.timestamp)));
      setHora(extrairHora(modal.registro.timestamp));
      setColaboradorId(modal.linha?.colaborador_id || "");
      setCarregandoHist(true);
      getHistoricoRegistro(modal.registro.id)
        .then(setHistorico)
        .catch(() => setHistorico([]))
        .finally(() => setCarregandoHist(false));
    } else {
      setTipo(modal.tipo || "entrada");
      setData(modal.linha?.data || dataHoje());
      setHora(extrairHora(new Date()));
      setColaboradorId(modal.linha?.colaborador_id || modal.colaboradorId || "");
      setHistorico([]);
    }
  }, [modal]);

  if (!modal) return null;

  const colabSelecionado =
    colaboradoresLista.find((c) => c.id === colaboradorId) ||
    (modal.linha?.colaborador_id === colaboradorId ? modal.linha : null);

  async function handleSalvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      parseData(data);
      if (!colaboradorId) throw new Error("Selecione o colaborador.");

      const admin = await getAdminColaborador();
      if (!admin) throw new Error("Sessão de admin inválida.");

      const timestamp = montarTimestamp(data, hora);

      await salvarRegistroManual({
        modo: modal.modo === "editar" ? "editar" : "criar",
        registroId: modal.registro?.id,
        colaboradorId,
        tipo,
        timestamp,
        observacao,
        motivo,
        adminId: admin.id,
      });

      onSalvo();
      onFechar();
    } catch (err) {
      setErro(err.message || "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">
          {modal.modo === "editar" ? "Editar batida" : "Adicionar batida"}
        </h2>
        {(colabSelecionado?.nome || modal.linha?.nome) && (
          <p className="list-item-meta" style={{ marginBottom: "1rem" }}>
            {colabSelecionado?.nome || modal.linha?.nome} · Mat.{" "}
            {colabSelecionado?.matricula || modal.linha?.matricula}
          </p>
        )}

        {erro && <div className="msg-erro">{erro}</div>}

        <form onSubmit={handleSalvar}>
          {modal.modo === "criar" && (
            <div className="form-group">
              <label>Colaborador</label>
              <select
                className="select"
                value={colaboradorId}
                onChange={(e) => setColaboradorId(e.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {colaboradoresLista.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.matricula})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Tipo</label>
            <select className="select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_BATIDA.map((t) => (
                <option key={t} value={t}>
                  {labelTipoBatida(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Data (DD/MM/YYYY)</label>
              <input
                className="input"
                value={data}
                onChange={(e) => setData(sanitizarEntradaData(e.target.value))}
                required
              />
            </div>
            <div className="form-group">
              <label>Hora</label>
              <input
                type="time"
                className="input"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>Observação</label>
            <input
              className="input"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Motivo da {modal.modo === "editar" ? "edição" : "criação"}</label>
            <input
              className="input"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: esqueceu de bater ponto"
            />
          </div>

          {modal.modo === "editar" && (
            <div className="historico-box">
              <div className="card-title">Histórico de edições</div>
              {carregandoHist ? (
                <p className="list-item-meta">Carregando…</p>
              ) : historico.length === 0 ? (
                <p className="list-item-meta">Nenhuma edição anterior.</p>
              ) : (
                historico.map((h) => (
                  <div key={h.id} className="historico-item">
                    <strong>
                      {h.acao === "criacao" ? "Criação manual" : "Edição"} —{" "}
                      {format(parseISO(h.editado_em), "dd/MM/yyyy HH:mm")}
                    </strong>
                    {h.admin?.nome && (
                      <span className="list-item-meta"> por {h.admin.nome}</span>
                    )}
                    {h.motivo && <p className="list-item-meta">{h.motivo}</p>}
                    {h.dados_anteriores && (
                      <p className="list-item-meta">
                        Antes: {labelTipoBatida(h.dados_anteriores.tipo)} às{" "}
                        {format(parseISO(h.dados_anteriores.timestamp), "HH:mm")}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onFechar}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SecaoRegistros() {
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [dataInicio, setDataInicio] = useState(dataHoje());
  const [dataFim, setDataFim] = useState(dataHoje());
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erroData, setErroData] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    supabase
      .from("colaboradores")
      .select("id, nome, matricula, jornada_id, is_admin")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setColaboradores(data || []));
  }, []);

  async function buscar() {
    setCarregando(true);
    setErroData(null);

    try {
      const inicio = parseData(dataInicio);
      const fim = parseData(dataFim);
      if (inicio > fim) throw new Error("Data inicial deve ser anterior à final.");

      const diffDias = (fim - inicio) / (1000 * 60 * 60 * 24);
      if (diffDias > 90) throw new Error("Intervalo máximo de 90 dias.");

      const [registros, jornadasMap, calendarioDias] = await Promise.all([
        buscarRegistrosPeriodo({ dataInicio, dataFim, colaboradorId: colaboradorId || undefined }),
        getJornadasMap(),
        getCalendarioDias(dataInicio, dataFim),
      ]);

      const pivot = montarLinhasRegistros({
        colaboradores,
        registros,
        dataInicio,
        dataFim,
        calendarioDias,
        jornadasMap,
        colaboradorIdFiltro: colaboradorId,
      });

      setLinhas(pivot);
    } catch (e) {
      setErroData(e.message);
      setLinhas([]);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (colaboradores.length) buscar();
  }, [colaboradores.length]);

  return (
    <div>
      <div className="grid-2">
        <div className="form-group">
          <label>De (DD/MM/YYYY)</label>
          <input
            type="text"
            className="input"
            value={dataInicio}
            onChange={(e) => setDataInicio(sanitizarEntradaData(e.target.value))}
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
        <div className="form-group">
          <label>Até (DD/MM/YYYY)</label>
          <input
            type="text"
            className="input"
            value={dataFim}
            onChange={(e) => setDataFim(sanitizarEntradaData(e.target.value))}
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
      </div>
      {erroData && <div className="msg-erro">{erroData}</div>}
      <div className="form-group">
        <label>Colaborador</label>
        <select className="select" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
          <option value="">Todos</option>
          {colaboradores
            .filter((c) => !c.is_admin)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} ({c.matricula})
              </option>
            ))}
        </select>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={buscar} disabled={carregando}>
        {carregando ? "Buscando…" : "Buscar"}
      </button>

      <button
        type="button"
        className="btn btn-secondary btn-sm"
        style={{ marginLeft: "0.5rem" }}
        onClick={() =>
          setModal({
            modo: "criar",
            tipo: "entrada",
            colaboradorId: colaboradorId || "",
            linha: colaboradorId
              ? {
                  colaborador_id: colaboradorId,
                  data: dataInicio,
                  ...colaboradores.find((c) => c.id === colaboradorId),
                }
              : { data: dataInicio },
          })
        }
      >
        + Adicionar batida
      </button>

      <div className="tabela-wrap" style={{ marginTop: "1rem" }}>
        {linhas.length === 0 ? (
          <p className="list-item-meta">Nenhum dia útil no período.</p>
        ) : (
          <table className="tabela-registros">
            <thead>
              <tr>
                <th>Data</th>
                <th>Colaborador</th>
                <th>{labelTipoBatida("entrada")}</th>
                <th>{labelTipoBatida("intervalo_inicio")}</th>
                <th>{labelTipoBatida("intervalo_fim")}</th>
                <th>{labelTipoBatida("saida")}</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((linha) => (
                <tr key={`${linha.colaborador_id}-${linha.data}`} className={`linha-${linha.status}`}>
                  <td>{linha.data}</td>
                  <td>
                    <strong>{linha.nome}</strong>
                    <div className="list-item-meta">Mat. {linha.matricula}</div>
                  </td>
                  {TIPOS_BATIDA.map((tipo) => (
                    <CelulaBatida
                      key={tipo}
                      tipo={tipo}
                      registro={linha.batidas[tipo]}
                      linha={linha}
                      onEditar={(reg, l) => setModal({ modo: "editar", registro: reg, linha: l })}
                      onCriar={(t, l) => setModal({ modo: "criar", tipo: t, linha: l, colaboradorId: l.colaborador_id })}
                    />
                  ))}
                  <td>
                    <span className={`status status-${linha.status === "completo" ? "ok" : linha.status === "ausente" ? "erro" : "pendente"}`}>
                      {STATUS_LABELS[linha.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="list-item-meta" style={{ marginTop: "0.75rem" }}>
        Toque em <strong>—</strong> para incluir batida ou na <strong>hora</strong> para editar. Use <strong>+ Adicionar batida</strong> para cadastro avulso.
      </p>

      <ModalRegistro
        modal={modal}
        onFechar={() => setModal(null)}
        onSalvo={buscar}
        colaboradoresLista={colaboradores.filter((c) => !c.is_admin)}
      />
    </div>
  );
}

function SecaoHoras() {
  const [colaboradores, setColaboradores] = useState([]);
  const [colaboradorId, setColaboradorId] = useState("");
  const [dataInicio, setDataInicio] = useState(dataHoje());
  const [dataFim, setDataFim] = useState(dataHoje());
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erroData, setErroData] = useState(null);

  useEffect(() => {
    supabase
      .from("colaboradores")
      .select("id, nome, matricula")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => setColaboradores(data || []));
  }, []);

  async function calcular() {
    if (!colaboradorId) return;
    setCarregando(true);
    setErroData(null);
    try {
      parseData(dataInicio);
      parseData(dataFim);
      const res = await calcularSaldoPeriodo(colaboradorId, dataInicio, dataFim);
      setResultado(res);
    } catch (e) {
      setResultado({ erro: e.message });
      setErroData(e.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <div className="form-group">
        <label>Colaborador</label>
        <select className="select" value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
          <option value="">Selecione…</option>
          {colaboradores
            .filter((c) => !c.is_admin)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
        </select>
      </div>
      <div className="grid-2">
        <div className="form-group">
          <label>De (DD/MM/YYYY)</label>
          <input
            type="text"
            className="input"
            value={dataInicio}
            onChange={(e) => setDataInicio(sanitizarEntradaData(e.target.value))}
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
        <div className="form-group">
          <label>Até (DD/MM/YYYY)</label>
          <input
            type="text"
            className="input"
            value={dataFim}
            onChange={(e) => setDataFim(sanitizarEntradaData(e.target.value))}
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            maxLength={10}
          />
        </div>
      </div>
      {erroData && <div className="msg-erro">{erroData}</div>}
      <button type="button" className="btn btn-primary btn-sm" onClick={calcular} disabled={carregando || !colaboradorId}>
        Calcular saldo
      </button>

      {resultado && !resultado.erro && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p>
            Saldo do período:{" "}
            <span className={resultado.saldo_positivo ? "saldo-positivo" : "saldo-negativo"}>
              {resultado.saldo_positivo ? "+" : "-"}
              {resultado.saldo}
            </span>
          </p>
          {resultado.detalhes?.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              {resultado.detalhes.map((d) => (
                <div key={d.data} className="list-item-meta">
                  {d.data}: {d.saldo_positivo ? "+" : "-"}
                  {d.saldo} ({d.horas_trabalhadas} / {d.horas_previstas})
                  {!d.dia_util && " · não útil"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {resultado?.erro && <div className="msg-erro">{resultado.erro}</div>}
    </div>
  );
}

function SecaoLocais() {
  const [locais, setLocais] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nome: "", latitude: "", longitude: "", raio_metros: "100", ativo: true });
  const [erro, setErro] = useState(null);
  const [gpsCarregando, setGpsCarregando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("locais_trabalho").select("*").order("nome");
    setLocais(data || []);
  }

  useEffect(() => {
    carregar();
  }, []);

  function novoLocal() {
    setEditando("novo");
    setForm({ nome: "", latitude: "", longitude: "", raio_metros: "100", ativo: true });
    setErro(null);
  }

  function editarLocal(local) {
    setEditando(local.id);
    setForm({
      nome: local.nome,
      latitude: String(local.latitude),
      longitude: String(local.longitude),
      raio_metros: String(local.raio_metros),
      ativo: local.ativo,
    });
    setErro(null);
  }

  async function usarMinhaLocalizacao() {
    setGpsCarregando(true);
    setErro(null);
    try {
      const pos = await getPosicaoAtual();
      setForm((f) => ({
        ...f,
        latitude: pos.latitude.toFixed(7),
        longitude: pos.longitude.toFixed(7),
      }));
    } catch (e) {
      setErro(e.message);
    } finally {
      setGpsCarregando(false);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    const payload = {
      nome: form.nome.trim(),
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      raio_metros: Number(form.raio_metros) || 100,
      ativo: form.ativo,
    };

    if (editando === "novo") {
      await supabase.from("locais_trabalho").insert(payload);
    } else {
      await supabase.from("locais_trabalho").update(payload).eq("id", editando);
    }

    setEditando(null);
    carregar();
  }

  return (
    <div>
      <button type="button" className="btn btn-primary btn-sm" onClick={novoLocal}>
        + Novo local
      </button>

      {editando && (
        <form onSubmit={salvar} className="card" style={{ marginTop: "1rem" }}>
          <div className="form-group">
            <label>Nome</label>
            <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Latitude</label>
              <input className="input" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input className="input" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required />
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={usarMinhaLocalizacao} disabled={gpsCarregando}>
            {gpsCarregando ? "Obtendo GPS…" : "Usar minha localização atual"}
          </button>
          <div className="form-group" style={{ marginTop: "0.75rem" }}>
            <label>Raio (metros)</label>
            <input className="input" type="number" value={form.raio_metros} onChange={(e) => setForm({ ...form, raio_metros: e.target.value })} />
          </div>
          <label>
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo
          </label>
          {erro && <div className="msg-erro">{erro}</div>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary btn-sm">
              Salvar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        {locais.length === 0 ? (
          <p className="list-item-meta">Nenhum local cadastrado.</p>
        ) : (
          locais.map((l) => (
            <div key={l.id} className="list-item">
              <div>
                <strong>{l.nome}</strong>
                <div className="list-item-meta">
                  {l.latitude}, {l.longitude} · raio {l.raio_metros}m
                </div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => editarLocal(l)}>
                Editar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const DIAS_JORNADA = [
  { num: 1, label: "Segunda" },
  { num: 2, label: "Terça" },
  { num: 3, label: "Quarta" },
  { num: 4, label: "Quinta" },
  { num: 5, label: "Sexta" },
  { num: 6, label: "Sábado" },
  { num: 0, label: "Domingo" },
];

const DIAS_DEFAULT = {
  0: { trabalha: false },
  1: { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
  2: { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
  3: { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
  4: { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
  5: { trabalha: true, entrada: "08:00", saida: "17:00", intervalo: 60 },
  6: { trabalha: true, entrada: "08:00", saida: "12:00", intervalo: 0 },
};

function diasDeBancoParaForm(diasBanco) {
  const base = JSON.parse(JSON.stringify(DIAS_DEFAULT));
  if (!diasBanco) return base;
  for (const d of DIAS_JORNADA) {
    const k = String(d.num);
    if (diasBanco[k]) {
      base[d.num] = {
        trabalha: !!diasBanco[k].trabalha,
        entrada: diasBanco[k].entrada || "08:00",
        saida: diasBanco[k].saida || "17:00",
        intervalo: diasBanco[k].intervalo ?? 0,
      };
    } else {
      base[d.num] = { trabalha: false };
    }
  }
  return base;
}

function diasParaBanco(dias) {
  const obj = {};
  for (const d of DIAS_JORNADA) {
    const cfg = dias[d.num];
    if (cfg?.trabalha) {
      obj[String(d.num)] = {
        trabalha: true,
        entrada: cfg.entrada,
        saida: cfg.saida,
        intervalo: Number(cfg.intervalo) || 0,
      };
    } else {
      obj[String(d.num)] = { trabalha: false };
    }
  }
  return obj;
}

function resumoJornada(j) {
  const dias = j.dias || {};
  const partes = DIAS_JORNADA.filter((d) => {
    const cfg = dias[String(d.num)];
    return cfg?.trabalha;
  }).map((d) => {
    const cfg = dias[String(d.num)];
    return `${d.label.slice(0, 3)}: ${cfg.entrada}–${cfg.saida}`;
  });
  return partes.length ? partes.join(" · ") : "Sem dias configurados";
}

function SecaoJornadas() {
  const [jornadas, setJornadas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [nome, setNome] = useState("");
  const [dias, setDias] = useState(JSON.parse(JSON.stringify(DIAS_DEFAULT)));
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    const { data } = await supabase.from("jornadas").select("*").order("nome");
    setJornadas(data || []);
  }

  useEffect(() => {
    carregar();
  }, []);

  function novaJornada() {
    setEditando("novo");
    setNome("");
    setDias(JSON.parse(JSON.stringify(DIAS_DEFAULT)));
    setErro(null);
  }

  function editarJornada(j) {
    setEditando(j.id);
    setNome(j.nome);
    setDias(diasDeBancoParaForm(j.dias));
    setErro(null);
  }

  function setDia(num, campo, valor) {
    setDias((prev) => ({
      ...prev,
      [num]: { ...prev[num], [campo]: valor },
    }));
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);

    try {
      if (!nome.trim()) throw new Error("Informe o nome da jornada.");

      const payload = {
        nome: nome.trim(),
        dias: diasParaBanco(dias),
        dias_semana: DIAS_JORNADA.filter((d) => dias[d.num]?.trabalha).map((d) => d.num),
        sabado: !!dias[6]?.trabalha,
        hora_entrada: dias[1]?.trabalha ? dias[1].entrada : null,
        hora_saida: dias[1]?.trabalha ? dias[1].saida : null,
        intervalo_minutos: dias[1]?.trabalha ? Number(dias[1].intervalo) : 0,
        hora_entrada_sabado: dias[6]?.trabalha ? dias[6].entrada : null,
        hora_saida_sabado: dias[6]?.trabalha ? dias[6].saida : null,
      };

      if (editando === "novo") {
        const { error: insertError } = await supabase.from("jornadas").insert({ ...payload, ativo: true });
        if (insertError) throw insertError;
      } else {
        const { error: updateError } = await supabase.from("jornadas").update(payload).eq("id", editando);
        if (updateError) throw updateError;
      }

      setEditando(null);
      carregar();
    } catch (err) {
      setErro(err.message || "Erro ao salvar jornada.");
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(j) {
    const novo = !j.ativo;
    if (!novo && !confirm(`Desativar jornada "${j.nome}"? Não aparecerá ao cadastrar colaboradores.`)) return;
    const { error: toggleError } = await supabase.from("jornadas").update({ ativo: novo }).eq("id", j.id);
    if (toggleError) { setErro(toggleError.message); return; }
    carregar();
  }

  return (
    <div>
      <button type="button" className="btn btn-primary btn-sm" onClick={novaJornada}>
        + Nova jornada
      </button>

      {editando && (
        <form onSubmit={salvar} className="card" style={{ marginTop: "1rem" }}>
          <div className="card-title">{editando === "novo" ? "Nova jornada" : "Editar jornada"}</div>

          {erro && <div className="msg-erro">{erro}</div>}

          <div className="form-group">
            <label>Nome da jornada</label>
            <input
              className="input"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="jornada-dias-tabela">
            <div className="jornada-dias-header">
              <span>Dia</span>
              <span>Não trabalha</span>
              <span>Entrada</span>
              <span>Saída</span>
              <span>Intervalo (min)</span>
            </div>
            {DIAS_JORNADA.map((d) => {
              const cfg = dias[d.num] || { trabalha: false };
              const naoTrabalha = !cfg.trabalha;
              return (
                <div key={d.num} className={`jornada-dia-linha${naoTrabalha ? " nao-trabalha" : ""}`}>
                  <span className="jornada-dia-nome">{d.label}</span>
                  <span className="jornada-dia-check">
                    <input
                      type="checkbox"
                      checked={naoTrabalha}
                      onChange={(e) => setDia(d.num, "trabalha", !e.target.checked)}
                    />
                  </span>
                  <input
                    type="time"
                    className="input input-sm"
                    value={cfg.entrada || "08:00"}
                    disabled={naoTrabalha}
                    onChange={(e) => setDia(d.num, "entrada", e.target.value)}
                  />
                  <input
                    type="time"
                    className="input input-sm"
                    value={cfg.saida || "17:00"}
                    disabled={naoTrabalha}
                    onChange={(e) => setDia(d.num, "saida", e.target.value)}
                  />
                  <input
                    type="number"
                    className="input input-sm"
                    min="0"
                    value={cfg.intervalo ?? 0}
                    disabled={naoTrabalha}
                    onChange={(e) => setDia(d.num, "intervalo", e.target.value)}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {erro && !editando && <div className="msg-erro" style={{ marginTop: "1rem" }}>{erro}</div>}

      <div className="card" style={{ marginTop: "1rem" }}>
        {jornadas.length === 0 ? (
          <p className="list-item-meta">Nenhuma jornada cadastrada.</p>
        ) : (
          jornadas.map((j) => (
            <div key={j.id} className="list-item">
              <div>
                <strong>{j.nome}</strong>{" "}
                <span className={`status ${j.ativo ? "status-ok" : "status-erro"}`}>
                  {j.ativo ? "Ativa" : "Inativa"}
                </span>
                <div className="list-item-meta">{resumoJornada(j)}</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => editarJornada(j)}>
                  Editar
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${j.ativo ? "btn-danger" : "btn-success"}`}
                  onClick={() => toggleAtivo(j)}
                >
                  {j.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SecaoCalendario() {
  const [jornadas, setJornadas] = useState([]);
  const [dias, setDias] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    data: "",
    tipo: "feriado",
    jornada_id: "",
    hora_entrada: "",
    hora_saida: "",
    observacao: "",
  });
  const [erro, setErro] = useState(null);

  async function carregar() {
    const [{ data: jornadasData }, { data: diasData, error }] = await Promise.all([
      supabase.from("jornadas").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("calendario_dias").select("*, jornadas(nome)").order("data", { ascending: false }),
    ]);

    setJornadas(jornadasData || []);
    if (error && isTabelaInexistente(error)) {
      setErro(MSG_MIGRACAO_PENDENTE);
      setDias([]);
    } else if (error) {
      setErro(error.message);
      setDias([]);
    } else {
      setDias(diasData || []);
      setErro(null);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function novo() {
    setEditando("novo");
    setForm({
      data: dataHoje().split("/").reverse().join("-"),
      tipo: "feriado",
      jornada_id: "",
      hora_entrada: "",
      hora_saida: "",
      observacao: "",
    });
    setErro(null);
  }

  function editar(d) {
    setEditando(d.id);
    setForm({
      data: d.data?.slice(0, 10) || "",
      tipo: d.tipo,
      jornada_id: d.jornada_id || "",
      hora_entrada: d.hora_entrada?.slice(0, 5) || "",
      hora_saida: d.hora_saida?.slice(0, 5) || "",
      observacao: d.observacao || "",
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    try {
      const payload = {
        data: form.data,
        tipo: form.tipo,
        jornada_id: form.jornada_id || null,
        hora_entrada: form.tipo === "dia_extra" && form.hora_entrada ? form.hora_entrada : null,
        hora_saida: form.tipo === "dia_extra" && form.hora_saida ? form.hora_saida : null,
        observacao: form.observacao || null,
      };

      if (editando === "novo") {
        const { error } = await supabase.from("calendario_dias").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendario_dias").update(payload).eq("id", editando);
        if (error) throw error;
      }

      setEditando(null);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function remover(id) {
    if (!confirm("Remover esta entrada do calendário?")) return;
    await supabase.from("calendario_dias").delete().eq("id", id);
    carregar();
  }

  const TIPO_CAL_LABELS = {
    feriado: "Feriado",
    dia_extra: "Dia extra",
    compensacao: "Compensação",
  };

  return (
    <div>
      <p className="page-subtitle" style={{ marginBottom: "1rem" }}>
        Feriados removem o dia da jornada. Dias extras adicionam trabalho em datas específicas.
      </p>
      <button type="button" className="btn btn-primary btn-sm" onClick={novo}>
        + Adicionar data
      </button>

      {editando && (
        <form onSubmit={salvar} className="card" style={{ marginTop: "1rem" }}>
          <div className="form-group">
            <label>Data</label>
            <input type="date" className="input" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Tipo</label>
            <select className="select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              <option value="feriado">Feriado (não trabalha)</option>
              <option value="compensacao">Compensação (não trabalha)</option>
              <option value="dia_extra">Dia extra (trabalha)</option>
            </select>
          </div>
          <div className="form-group">
            <label>Jornada (vazio = todas)</label>
            <select className="select" value={form.jornada_id} onChange={(e) => setForm({ ...form, jornada_id: e.target.value })}>
              <option value="">Todas as jornadas</option>
              {jornadas.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nome}
                </option>
              ))}
            </select>
          </div>
          {form.tipo === "dia_extra" && (
            <div className="grid-2">
              <div className="form-group">
                <label>Entrada</label>
                <input type="time" className="input" value={form.hora_entrada} onChange={(e) => setForm({ ...form, hora_entrada: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Saída</label>
                <input type="time" className="input" value={form.hora_saida} onChange={(e) => setForm({ ...form, hora_saida: e.target.value })} />
              </div>
            </div>
          )}
          <div className="form-group">
            <label>Observação</label>
            <input className="input" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          {erro && <div className="msg-erro">{erro}</div>}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary btn-sm">
              Salvar
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditando(null)}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="card" style={{ marginTop: "1rem" }}>
        {dias.length === 0 ? (
          <p className="list-item-meta">Nenhuma exceção cadastrada.</p>
        ) : (
          dias.map((d) => (
            <div key={d.id} className="list-item">
              <div>
                <strong>
                  {format(parseISO(d.data), "dd/MM/yyyy")} — {TIPO_CAL_LABELS[d.tipo]}
                </strong>
                <div className="list-item-meta">
                  {d.jornadas?.nome ? `Jornada: ${d.jornadas.nome}` : "Todas as jornadas"}
                  {d.observacao ? ` · ${d.observacao}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => editar(d)}>
                  Editar
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => remover(d.id)}>
                  Excluir
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const [aba, setAba] = useState("registros");

  async function handleSair() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1 className="page-title">Admin</h1>
        <button type="button" className="btn-link" onClick={handleSair}>
          Sair
        </button>
      </div>

      <div className="tabs">
        {ABAS.map((a) => (
          <button
            key={a}
            type="button"
            className={`tab ${aba === a ? "active" : ""}`}
            onClick={() => setAba(a)}
          >
            {a === "registros" && "Registros"}
            {a === "colaboradores" && "Colaboradores"}
            {a === "horas" && "Horas extras"}
            {a === "locais" && "Locais"}
            {a === "jornadas" && "Jornadas"}
            {a === "calendario" && "Calendário"}
          </button>
        ))}
      </div>

      {aba === "registros" && <SecaoRegistros />}
      {aba === "colaboradores" && <SecaoColaboradores />}
      {aba === "horas" && <SecaoHoras />}
      {aba === "locais" && <SecaoLocais />}
      {aba === "jornadas" && <SecaoJornadas />}
      {aba === "calendario" && <SecaoCalendario />}
    </div>
  );
}
