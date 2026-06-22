import { format, parseISO } from "date-fns";
import { formatarData } from "./dates";
import { listarDiasUteisNoPeriodo } from "./diasUteis";
import { TIPOS_BATIDA } from "./tipoBatida";

export { TIPOS_BATIDA };

export function montarLinhasRegistros({
  colaboradores,
  registros,
  dataInicio,
  dataFim,
  calendarioDias,
  jornadasMap,
  colaboradorIdFiltro = "",
}) {
  const registrosPorChave = new Map();

  for (const r of registros) {
    const dia = formatarData(parseISO(r.timestamp));
    const key = `${r.colaborador_id}|${dia}`;
    if (!registrosPorChave.has(key)) {
      registrosPorChave.set(key, { batidas: {} });
    }
    const linha = registrosPorChave.get(key);
    const existente = linha.batidas[r.tipo];
    if (!existente || parseISO(r.timestamp) > parseISO(existente.timestamp)) {
      linha.batidas[r.tipo] = r;
    }
  }

  const cols = colaboradores
    .filter((c) => !c.is_admin)
    .filter((c) => !colaboradorIdFiltro || c.id === colaboradorIdFiltro);

  const linhas = [];

  for (const colab of cols) {
    const jornada = jornadasMap[colab.jornada_id] || null;
    const diasUteis = listarDiasUteisNoPeriodo(dataInicio, dataFim, jornada, calendarioDias);

    for (const diaDate of diasUteis) {
      const dia = formatarData(diaDate);
      const key = `${colab.id}|${dia}`;
      const existente = registrosPorChave.get(key);
      const batidas = existente?.batidas || {};
      const qtd = Object.keys(batidas).length;

      let status = "ausente";
      if (qtd > 0) {
        status = batidas.entrada && batidas.saida ? "completo" : "parcial";
      }

      linhas.push({
        colaborador_id: colab.id,
        nome: colab.nome,
        matricula: colab.matricula,
        jornada_id: colab.jornada_id,
        data: dia,
        dataIso: format(diaDate, "yyyy-MM-dd"),
        dataDate: diaDate,
        batidas,
        status,
      });
    }
  }

  return linhas.sort((a, b) => {
    const diffData = a.dataDate - b.dataDate;
    if (diffData !== 0) return diffData;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

export function formatarHoraRegistro(registro) {
  if (!registro) return "—";
  return format(parseISO(registro.timestamp), "HH:mm");
}
