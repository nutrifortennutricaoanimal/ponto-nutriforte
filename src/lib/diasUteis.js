import { getDay, eachDayOfInterval, startOfDay, format } from "date-fns";
import { parseData } from "./dates";

// date-fns getDay: 0=domingo … 6=sábado
export const DIAS_SEMANA_LABELS = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

export const DIAS_SEMANA_OPCOES = [
  { valor: 1, label: "Segunda" },
  { valor: 2, label: "Terça" },
  { valor: 3, label: "Quarta" },
  { valor: 4, label: "Quinta" },
  { valor: 5, label: "Sexta" },
  { valor: 6, label: "Sábado" },
  { valor: 0, label: "Domingo" },
];

export const DIAS_SEMANA_PADRAO = [1, 2, 3, 4, 5];

function resolverData(data) {
  if (data instanceof Date) return startOfDay(data);
  return startOfDay(parseData(data));
}

function dataIso(d) {
  return format(resolverData(d), "yyyy-MM-dd");
}

export function normalizarDiasSemana(jornada) {
  if (jornada?.dias && typeof jornada.dias === "object") {
    return Object.entries(jornada.dias)
      .filter(([, cfg]) => cfg?.trabalha)
      .map(([k]) => Number(k))
      .sort((a, b) => a - b);
  }
  if (jornada?.dias_semana?.length) {
    return [...jornada.dias_semana].sort((a, b) => a - b);
  }
  const dias = [...DIAS_SEMANA_PADRAO];
  if (jornada?.sabado && !dias.includes(6)) dias.push(6);
  return dias;
}

function excecaoParaDia(data, jornada, calendarioDias) {
  const alvo = dataIso(data);
  return (calendarioDias || []).find((c) => {
    const cData = typeof c.data === "string" ? c.data.slice(0, 10) : dataIso(c.data);
    if (cData !== alvo) return false;
    if (c.jornada_id && jornada?.id && c.jornada_id !== jornada.id) return false;
    return true;
  });
}

export function isDiaUtil(data, jornada, calendarioDias = []) {
  const excecao = excecaoParaDia(data, jornada, calendarioDias);
  if (excecao) {
    if (excecao.tipo === "dia_extra") return true;
    if (excecao.tipo === "feriado" || excecao.tipo === "compensacao") return false;
  }

  const diasSemana = normalizarDiasSemana(jornada);
  return diasSemana.includes(getDay(resolverData(data)));
}

export function listarDiasUteisNoPeriodo(dataInicio, dataFim, jornada, calendarioDias = []) {
  const inicio = resolverData(dataInicio);
  const fim = resolverData(dataFim);
  if (inicio > fim) return [];

  return eachDayOfInterval({ start: inicio, end: fim }).filter((d) =>
    isDiaUtil(d, jornada, calendarioDias)
  );
}

export function horarioPrevistoDia(jornada, data, calendarioDias = []) {
  if (!jornada) return null;

  const excecao = excecaoParaDia(data, jornada, calendarioDias);
  if (excecao?.tipo === "dia_extra" && excecao.hora_entrada && excecao.hora_saida) {
    const intervaloFallback = horarioPrevistoDia(jornada, data, [])?.intervalo || 0;
    return {
      entrada: excecao.hora_entrada.slice(0, 5),
      saida: excecao.hora_saida.slice(0, 5),
      intervalo: intervaloFallback,
    };
  }

  const dia = getDay(resolverData(data));

  if (jornada.dias && typeof jornada.dias === "object") {
    const cfg = jornada.dias[String(dia)];
    if (!cfg?.trabalha) return null;
    return {
      entrada: (cfg.entrada || "08:00").slice(0, 5),
      saida: (cfg.saida || "17:00").slice(0, 5),
      intervalo: Number(cfg.intervalo) || 0,
    };
  }

  if (dia === 6 && jornada.sabado) {
    return {
      entrada: (jornada.hora_entrada_sabado || "08:00").slice(0, 5),
      saida: (jornada.hora_saida_sabado || "12:00").slice(0, 5),
      intervalo: 0,
    };
  }

  return {
    entrada: (jornada.hora_entrada || "08:00").slice(0, 5),
    saida: (jornada.hora_saida || "17:00").slice(0, 5),
    intervalo: jornada.intervalo_minutos || 0,
  };
}

export function formatarDiasSemana(jornada) {
  return normalizarDiasSemana(jornada)
    .map((d) => DIAS_SEMANA_LABELS[d])
    .join(", ");
}
