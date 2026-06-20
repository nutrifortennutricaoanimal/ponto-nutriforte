import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { getPosicaoAtual, encontrarLocalValido } from "../lib/geo";

export default function GeoCheck({ onValidacao, atualizarACadaMs = 30000 }) {
  const [locais, setLocais] = useState([]);
  const [status, setStatus] = useState("carregando");
  const [posicao, setPosicao] = useState(null);
  const [localValido, setLocalValido] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    supabase
      .from("locais_trabalho")
      .select("*")
      .eq("ativo", true)
      .then(({ data, error }) => {
        if (error) {
          setErro("Erro ao carregar locais de trabalho.");
          setStatus("erro");
          return;
        }
        setLocais(data || []);
        if (!data?.length) {
          setErro("Nenhum local de trabalho cadastrado. Contate o administrador.");
          setStatus("sem_locais");
        }
      });
  }, []);

  const verificar = useCallback(async () => {
    if (!locais.length) {
      onValidacao?.({ ok: false, erro: "Nenhum local cadastrado." });
      return;
    }

    setStatus("verificando");
    setErro(null);

    try {
      const pos = await getPosicaoAtual();
      setPosicao(pos);

      const resultado = encontrarLocalValido(pos.latitude, pos.longitude, locais);

      if (resultado) {
        setLocalValido(resultado);
        setStatus("ok");
        onValidacao?.({
          ok: true,
          latitude: pos.latitude,
          longitude: pos.longitude,
          local: resultado.local,
          distancia: resultado.distancia,
        });
      } else {
        setLocalValido(null);
        setStatus("fora");
        const msg = "Você está fora da área permitida para bater ponto.";
        setErro(msg);
        onValidacao?.({ ok: false, erro: msg, latitude: pos.latitude, longitude: pos.longitude });
      }
    } catch (e) {
      setStatus("erro");
      setErro(e.message);
      onValidacao?.({ ok: false, erro: e.message });
    }
  }, [locais, onValidacao]);

  useEffect(() => {
    if (locais.length) verificar();
  }, [locais, verificar]);

  useEffect(() => {
    if (!locais.length || !atualizarACadaMs) return;
    const id = setInterval(verificar, atualizarACadaMs);
    return () => clearInterval(id);
  }, [locais, verificar, atualizarACadaMs]);

  return (
    <div className="card">
      <div className="card-title">Localização</div>
      {status === "carregando" && <p className="list-item-meta">Carregando locais…</p>}
      {status === "verificando" && <p className="list-item-meta">Verificando GPS…</p>}
      {status === "ok" && localValido && (
        <div>
          <span className="status status-ok">✓ Dentro do raio</span>
          <p style={{ marginTop: "0.5rem" }}>
            <strong>{localValido.local.nome}</strong>
            <br />
            <span className="list-item-meta">
              {Math.round(localValido.distancia)}m do centro (raio {localValido.local.raio_metros}m)
            </span>
          </p>
        </div>
      )}
      {(status === "fora" || status === "erro" || status === "sem_locais") && erro && (
        <div>
          <span className="status status-erro">✗ Fora do local</span>
          <p className="list-item-meta" style={{ marginTop: "0.5rem" }}>{erro}</p>
        </div>
      )}
      {posicao && (
        <p className="list-item-meta" style={{ marginTop: "0.5rem" }}>
          GPS: {posicao.latitude.toFixed(5)}, {posicao.longitude.toFixed(5)}
          {posicao.accuracy ? ` (±${Math.round(posicao.accuracy)}m)` : ""}
        </p>
      )}
      <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "0.75rem" }} onClick={verificar}>
        Atualizar localização
      </button>
    </div>
  );
}
