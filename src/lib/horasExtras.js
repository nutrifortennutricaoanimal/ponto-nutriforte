import {
  startOfDay,
  endOfDay,
  parseISO,
  differenceInMinutes,
} from "date-fns";
import { supabase, isTabelaInexistente } from "./supabase";
import { formatarData, parseData } from "./dates";
import {
  isDiaUtil,
  horarioPrevistoDia,
  listarDiasUteisNoPeriodo,
} from "./diasUteis";

function resolverData(data) {
  if (data instanceof Date) return data;
  if (typeof data === "string") {
    const limpo = data.replace(/\D/g, "");
    if (limpo.length === 8) return parseData(data);
    return parseISO(data);
  }
  return data;
}

function parseHora(horaStr, dataBase) {
  const [h, m] = horaStr.split(":").map(Number);
  const d = new Date(dataBase);
  d.setHours(h, m || 0, 0, 0);
  return d;
}

function minutosEntre(inicio, fim) {
  if (!inicio || !fim) return 0;
  const diff = differenceInMinutes(fim, inicio);
  return diff > 0 ? diff : 0;
}

function formatarHoras(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function horasPrevistasMinutos(jornada, data, calendarioDias = []) {
  if (!jornada) return 0;
  if (!isDiaUtil(data, jornada, calendarioDias)) return 0;

  const horario = horarioPrevistoDia(jornada, data, calendarioDias);
  if (!horario) return 0;

  const entrada = parseHora(horario.entrada, data);
  const saida = parseHora(horario.saida, data);
  const total = minutosEntre(entrada, saida);
  return Math.max(0, total - (horario.intervalo || 0));
}

async function carregarCalendario(dataRef) {
  const dia = formatarData(dataRef).split("/").reverse().join("-");
  const { data, error } = await supabase
    .from("calendario_dias")
    .select("*")
    .eq("data", dia);

  if (error) {
    if (isTabelaInexistente(error)) return [];
    throw error;
  }
  return data || [];
}

export async function calcularHorasExtras(colaboradorId, data) {
  const dataRef = resolverData(data);
  const inicio = startOfDay(dataRef).toISOString();
  const fim = endOfDay(dataRef).toISOString();

  const { data: colaborador, error: errColab } = await supabase
    .from("colaboradores")
    .select("*, jornadas(*)")
    .eq("id", colaboradorId)
    .single();

  if (errColab) throw errColab;

  const calendarioDias = await carregarCalendario(dataRef);
  const jornada = colaborador.jornadas;
  const diaUtil = isDiaUtil(dataRef, jornada, calendarioDias);

  const { data: registros, error: errReg } = await supabase
    .from("registros_ponto")
    .select("*")
    .eq("colaborador_id", colaboradorId)
    .gte("timestamp", inicio)
    .lte("timestamp", fim)
    .in("status", ["ok", "manual"])
    .order("timestamp", { ascending: true });

  if (errReg) throw errReg;

  const porTipo = {};
  for (const r of registros || []) {
    const existente = porTipo[r.tipo];
    if (!existente || parseISO(r.timestamp) > parseISO(existente.timestamp)) {
      porTipo[r.tipo] = r;
    }
  }

  const entrada = porTipo.entrada ? parseISO(porTipo.entrada.timestamp) : null;
  const saida = porTipo.saida ? parseISO(porTipo.saida.timestamp) : null;
  const intervaloInicio = porTipo.intervalo_inicio
    ? parseISO(porTipo.intervalo_inicio.timestamp)
    : null;
  const intervaloFim = porTipo.intervalo_fim
    ? parseISO(porTipo.intervalo_fim.timestamp)
    : null;

  const horarioPrevisto = horarioPrevistoDia(jornada, dataRef, calendarioDias);
  const intervaloPrevistoMin = horarioPrevisto?.intervalo ?? jornada?.intervalo_minutos ?? 0;

  let horasTrabalhadasMin = 0;
  if (entrada && saida) {
    const total = minutosEntre(entrada, saida);
    const intervalo =
      intervaloInicio && intervaloFim
        ? minutosEntre(intervaloInicio, intervaloFim)
        : intervaloPrevistoMin;
    horasTrabalhadasMin = Math.max(0, total - intervalo);
  }

  const horasPrevistasMin = horasPrevistasMinutos(jornada, dataRef, calendarioDias);
  const saldoMin = horasTrabalhadasMin - horasPrevistasMin;

  return {
    colaborador,
    registros: registros || [],
    data: formatarData(dataRef),
    dia_util: diaUtil,
    horas_trabalhadas: formatarHoras(horasTrabalhadasMin),
    horas_trabalhadas_min: horasTrabalhadasMin,
    horas_previstas: formatarHoras(horasPrevistasMin),
    horas_previstas_min: horasPrevistasMin,
    saldo: formatarHoras(Math.abs(saldoMin)),
    saldo_min: saldoMin,
    saldo_positivo: saldoMin >= 0,
  };
}

export async function calcularSaldoPeriodo(colaboradorId, dataInicio, dataFim) {
  const inicio = resolverData(dataInicio);
  const fim = resolverData(dataFim);

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("*, jornadas(*)")
    .eq("id", colaboradorId)
    .single();

  const { data: calendarioDias, error: errCal } = await supabase
    .from("calendario_dias")
    .select("*")
    .gte("data", inicio.toISOString().slice(0, 10))
    .lte("data", fim.toISOString().slice(0, 10));

  const excecoes = isTabelaInexistente(errCal) ? [] : calendarioDias || [];

  const diasUteis = listarDiasUteisNoPeriodo(
    inicio,
    fim,
    colaborador?.jornadas,
    excecoes
  );

  let saldoTotalMin = 0;
  const detalhes = [];

  for (const dia of diasUteis) {
    const resultado = await calcularHorasExtras(colaboradorId, dia);
    saldoTotalMin += resultado.saldo_min;
    detalhes.push(resultado);
  }

  return {
    saldo_min: saldoTotalMin,
    saldo: formatarHoras(Math.abs(saldoTotalMin)),
    saldo_positivo: saldoTotalMin >= 0,
    detalhes,
  };
}

export { formatarHoras };
